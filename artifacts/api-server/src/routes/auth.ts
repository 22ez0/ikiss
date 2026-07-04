import { Router, type IRouter, type Request } from "express";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { db, usersTable, profilesTable, usernameRedirectsTable } from "@workspace/db";
import { eq, and, gt } from "drizzle-orm";
import { RegisterBody, LoginBody } from "@workspace/api-zod";
import { signToken, requireAuth } from "../lib/auth";
import { sendVerificationEmail, sendPasswordResetEmail } from "../lib/email";
import { logger } from "../lib/logger";

const router: IRouter = Router();

const TURNSTILE_SECRET = process.env.TURNSTILE_SECRET_KEY || "1x0000000000000000000000000000000AA";

async function verifyTurnstile(token: string | undefined, ip: string): Promise<boolean> {
  if (!token) return false;
  try {
    const body = new URLSearchParams({
      secret: TURNSTILE_SECRET,
      response: token,
    });
    // remoteip is optional in Turnstile and can cause false negatives
    // behind some proxy/mobile network combinations.
    if (ip && ip !== "unknown") {
      body.set("remoteip", ip);
    }
    const r = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });
    const data = await r.json() as { success?: boolean; ["error-codes"]?: string[] };
    if (data.success) return true;

    // Retry once without remoteip to avoid proxy/IP mismatch failures.
    const retry = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ secret: TURNSTILE_SECRET, response: token }).toString(),
    });
    const retryData = await retry.json() as { success?: boolean; ["error-codes"]?: string[] };
    if (!retryData.success) {
      console.warn("[turnstile] verify failed", retryData["error-codes"] || data["error-codes"] || []);
    }
    return !!retryData.success;
  } catch (e) {
    console.error("[turnstile] verify failed", (e as Error).message);
    return false;
  }
}

const registerAttempts = new Map<string, { count: number; resetAt: number }>();

function getClientIp(req: Request) {
  const forwarded = req.headers["x-forwarded-for"];
  const raw = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  return (raw?.split(",")[0] || req.socket.remoteAddress || "unknown").trim();
}

function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function newToken() {
  return crypto.randomBytes(32).toString("hex");
}

const RESERVED_USERNAMES = new Set([
  'keefaren', 'admin', 'administrator', 'api', 'static', 'dashboard',
  'login', 'register', 'signup', 'profile', 'settings', 'help', 'support',
  'root', 'system', 'moderator', 'mod', 'staff', 'team', 'official',
  'ikiss', 'keef', 'null', 'undefined', 'test', 'demo', 'example',
  'comunidade', 'community', 'notifications', 'feed', 'explore', 'search',
]);

function validateUsername(username: string): string | null {
  if (username.length < 3) return "Nome de usuário deve ter pelo menos 3 caracteres.";
  if (username.length > 15) return "Nome de usuário deve ter no máximo 15 caracteres.";
  if (!/^[a-z0-9_]+$/.test(username)) return "Nome de usuário só pode ter letras minúsculas, números e _";
  if (username.startsWith('_') || username.endsWith('_')) return "Nome de usuário não pode começar ou terminar com _";
  if (/__/.test(username)) return "Nome de usuário não pode ter _ consecutivos.";
  if (RESERVED_USERNAMES.has(username.toLowerCase())) return "Este nome de usuário não está disponível.";
  return null;
}

router.post("/auth/register", async (req, res): Promise<void> => {
  const ip = getClientIp(req);
  const now = Date.now();
  const attempt = registerAttempts.get(ip);
  if (attempt && attempt.resetAt > now && attempt.count >= 3) {
    res.status(429).json({ error: "Muitas contas criadas nesse IP. Tente novamente mais tarde." });
    return;
  }
  const turnstileToken = (req.body && (req.body.turnstileToken || req.body["cf-turnstile-response"])) as string | undefined;
  // Only validate Turnstile when a token was actually provided (widget loaded).
  // When the widget fails to load (no token), fall back to IP rate-limiting only.
  if (process.env.TURNSTILE_SECRET_KEY && turnstileToken && !(await verifyTurnstile(turnstileToken, ip))) {
    res.status(400).json({ error: "Verificação de segurança falhou. Tente novamente." });
    return;
  }

  const parsed = RegisterBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const email = parsed.data.email.trim().toLowerCase();
  const username = parsed.data.username.trim().toLowerCase();
  const { password, displayName } = parsed.data;

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    res.status(400).json({ error: "E-mail inválido" });
    return;
  }

  const usernameError = validateUsername(username);
  if (usernameError) {
    res.status(400).json({ error: usernameError });
    return;
  }

  const [existing] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.email, email))
    .limit(1);

  if (existing) {
    res.status(409).json({ error: "E-mail já está em uso" });
    return;
  }

  const [existingUsername] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.username, username))
    .limit(1);

  if (existingUsername) {
    res.status(409).json({ error: "Nome de usuário indisponível" });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const verificationToken = newToken();

  const [user] = await db.insert(usersTable).values({
    email,
    username,
    passwordHash,
    displayName: displayName ?? null,
    registrationIp: ip,
    lastLoginIp: ip,
    verificationTokenHash: hashToken(verificationToken),
    verificationTokenExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
  }).returning();

  await db.insert(profilesTable).values({
    userId: user.id,
    badges: [],
  });

  // If this username had a previous redirect entry (someone else used to own
  // it and was renamed), claim it: the new registration owns the username now.
  await db.delete(usernameRedirectsTable).where(eq(usernameRedirectsTable.oldUsername, username));

  // Count only successful account creations per IP.
  if (!attempt || attempt.resetAt <= now) {
    registerAttempts.set(ip, { count: 1, resetAt: now + 60 * 60 * 1000 });
  } else {
    attempt.count += 1;
  }

  const token = signToken({ userId: user.id, username: user.username });

  // Fire-and-forget: don't make the user wait on the SMTP round trip.
  sendVerificationEmail(email, verificationToken).then((ok) => {
    if (!ok) logger.warn({ email }, "[auth/register] verification email not sent");
  });

  const includeDevLink = process.env.NODE_ENV !== "production" || !process.env.RESEND_API_KEY;

  res.status(201).json({
    user: {
      id: user.id,
      email: user.email,
      username: user.username,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      createdAt: user.createdAt.toISOString(),
    },
    token,
    emailVerificationRequired: true,
    ...(includeDevLink ? { devVerificationLink: `/api/auth/verify-email?token=${verificationToken}` } : {}),
  });
});

router.post("/auth/login", async (req, res): Promise<void> => {
  const ip = getClientIp(req);
  const turnstileToken = (req.body && (req.body.turnstileToken || req.body["cf-turnstile-response"])) as string | undefined;
  if (process.env.TURNSTILE_SECRET_KEY && !(await verifyTurnstile(turnstileToken, ip))) {
    res.status(400).json({ error: "Verificação de segurança falhou. Tente novamente." });
    return;
  }

  const rawIdentifier = typeof req.body?.identifier === "string"
    ? req.body.identifier.trim()
    : typeof req.body?.email === "string" ? req.body.email.trim() : "";
  const password = typeof req.body?.password === "string" ? req.body.password : "";

  if (!rawIdentifier || password.length < 6) {
    res.status(400).json({ error: "Informe e-mail (ou @usuario) e senha." });
    return;
  }

  const usernameCandidate = rawIdentifier.replace(/^@/, "").toLowerCase();
  const isEmail = rawIdentifier.includes("@") && rawIdentifier.indexOf("@") > 0;

  // Backward-compat with LoginBody zod (which expects email): only validate when no identifier shortcut was sent.
  if (!req.body?.identifier) {
    const parsed = LoginBody.safeParse({ email: rawIdentifier, password });
    if (!parsed.success && isEmail) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
  }

  const emailKey = isEmail ? rawIdentifier.trim().toLowerCase() : "";
  const [user] = isEmail
    ? await db.select().from(usersTable).where(eq(usersTable.email, emailKey)).limit(1)
    : await db.select().from(usersTable).where(eq(usersTable.username, usernameCandidate)).limit(1);

  if (!user || user.banned) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  const token = signToken({ userId: user.id, username: user.username });
  await db.update(usersTable).set({ lastLoginIp: getClientIp(req) }).where(eq(usersTable.id, user.id));

  res.json({
    user: {
      id: user.id,
      email: user.email,
      username: user.username,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      createdAt: user.createdAt.toISOString(),
    },
    token,
  });
});

router.get("/auth/verify-email", async (req, res): Promise<void> => {
  const token = typeof req.query.token === "string" ? req.query.token : "";
  if (!token) {
    res.status(400).json({ error: "Token obrigatório" });
    return;
  }
  const [user] = await db.select().from(usersTable).where(and(eq(usersTable.verificationTokenHash, hashToken(token)), gt(usersTable.verificationTokenExpiresAt, new Date()))).limit(1);
  if (!user) {
    res.status(400).json({ error: "Token inválido ou expirado" });
    return;
  }
  await db.update(usersTable).set({ emailVerified: true, verificationTokenHash: null, verificationTokenExpiresAt: null }).where(eq(usersTable.id, user.id));
  res.json({ success: true, message: "E-mail verificado" });
});

router.post("/auth/forgot-password", async (req, res): Promise<void> => {
  const email = (typeof req.body?.email === "string" ? req.body.email : "").trim().toLowerCase();
  const generic = { success: true, message: "Se existir uma conta, enviaremos instruções para redefinir a senha." };
  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
  if (user) {
    const token = newToken();
    await db.update(usersTable).set({
      resetTokenHash: hashToken(token),
      resetTokenExpiresAt: new Date(Date.now() + 60 * 60 * 1000),
    }).where(eq(usersTable.id, user.id));

    sendPasswordResetEmail(email, token).then((ok) => {
      if (!ok) logger.warn({ email }, "[auth/forgot-password] reset email not sent");
    });

    const includeDevLink = process.env.NODE_ENV !== "production" || !process.env.RESEND_API_KEY;
    res.json(includeDevLink ? { ...generic, devResetLink: `/reset-password?token=${token}` } : generic);
    return;
  }
  res.json(generic);
});

router.post("/auth/reset-password", async (req, res): Promise<void> => {
  const token = typeof req.body?.token === "string" ? req.body.token : "";
  const password = typeof req.body?.password === "string" ? req.body.password : "";
  if (!token || password.length < 6) {
    res.status(400).json({ error: "Token e senha válida são obrigatórios" });
    return;
  }
  const [user] = await db.select().from(usersTable).where(and(eq(usersTable.resetTokenHash, hashToken(token)), gt(usersTable.resetTokenExpiresAt, new Date()))).limit(1);
  if (!user) {
    res.status(400).json({ error: "Token inválido ou expirado" });
    return;
  }
  await db.update(usersTable).set({
    passwordHash: await bcrypt.hash(password, 10),
    resetTokenHash: null,
    resetTokenExpiresAt: null,
  }).where(eq(usersTable.id, user.id));
  res.json({ success: true, message: "Senha redefinida" });
});

router.post("/auth/logout", (_req, res): void => {
  res.json({ success: true, message: "Logged out" });
});

router.get("/auth/me", requireAuth, async (req, res): Promise<void> => {
  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, req.user!.userId))
    .limit(1);

  if (!user) {
    res.status(401).json({ error: "User not found" });
    return;
  }

  res.json({
    id: user.id,
    email: user.email,
    username: user.username,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    createdAt: user.createdAt.toISOString(),
  });
});

export default router;
