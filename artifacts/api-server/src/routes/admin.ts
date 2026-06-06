import { Router, type IRouter } from "express";
import jwt from "jsonwebtoken";
import { db, usersTable, profilesTable, profileReportsTable, supportTicketsTable, postReportsTable, postsTable, usernameRedirectsTable } from "@workspace/db";
import { eq, ilike, or, desc } from "drizzle-orm";

const router: IRouter = Router();
const ADMIN_LOGIN = process.env.ADMIN_LOGIN ?? "keefaren";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? "Hungria2021@";
const ADMIN_SECRET = process.env.ADMIN_SECRET ?? process.env.SESSION_SECRET ?? "ikiss-admin-secret";

function signAdminToken() {
  return jwt.sign({ admin: true }, ADMIN_SECRET, { expiresIn: "7d" });
}

function requireAdmin(req: any, res: any, next: any) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  try {
    const payload = jwt.verify(authHeader.slice(7), ADMIN_SECRET) as any;
    if (!payload.admin) throw new Error("not admin");
    next();
  } catch {
    res.status(401).json({ error: "Unauthorized" });
  }
}

router.post("/admin/login", (req, res): void => {
  if (req.body?.login !== ADMIN_LOGIN || req.body?.password !== ADMIN_PASSWORD) {
    res.status(401).json({ error: "Login inválido" });
    return;
  }
  res.json({ token: signAdminToken() });
});

router.get("/admin/users", requireAdmin, async (req, res): Promise<void> => {
  const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
  const rows = await db
    .select({
      id: usersTable.id,
      email: usersTable.email,
      username: usersTable.username,
      displayName: usersTable.displayName,
      banned: usersTable.banned,
      emailVerified: usersTable.emailVerified,
      registrationIp: usersTable.registrationIp,
      lastLoginIp: usersTable.lastLoginIp,
      createdAt: usersTable.createdAt,
      badges: profilesTable.badges,
      followersCount: profilesTable.followersCount,
      viewsCount: profilesTable.viewsCount,
    })
    .from(usersTable)
    .leftJoin(profilesTable, eq(profilesTable.userId, usersTable.id))
    .where(q ? or(ilike(usersTable.username, `%${q}%`), ilike(usersTable.email, `%${q}%`), ilike(usersTable.displayName, `%${q}%`)) : undefined)
    .orderBy(desc(usersTable.createdAt))
    .limit(200);
  res.json(rows);
});

const RESERVED_USERNAMES_ADMIN = new Set([
  'keefaren', 'admin', 'administrator', 'api', 'static', 'dashboard',
  'login', 'register', 'signup', 'profile', 'settings', 'help', 'support',
  'root', 'system', 'moderator', 'mod', 'staff', 'team', 'official',
  'ikiss', 'keef', 'null', 'undefined', 'test', 'demo', 'example',
  'comunidade', 'community', 'notifications', 'feed', 'explore', 'search',
]);

router.post("/admin/users/:userId/username", requireAdmin, async (req, res): Promise<void> => {
  const userId = Number(req.params.userId);
  const newUsername = String(req.body?.username ?? "").trim().toLowerCase();
  if (!newUsername) { res.status(400).json({ error: "Username obrigatório" }); return; }
  if (newUsername.length < 1 || newUsername.length > 15) { res.status(400).json({ error: "Username deve ter 1 a 15 caracteres." }); return; }
  if (!/^[a-z0-9_]+$/.test(newUsername)) { res.status(400).json({ error: "Apenas letras minúsculas, números e _" }); return; }
  if (newUsername.startsWith("_") || newUsername.endsWith("_") || /__/.test(newUsername)) { res.status(400).json({ error: "Formato inválido (_ no início/fim ou duplo)" }); return; }
  if (RESERVED_USERNAMES_ADMIN.has(newUsername)) { res.status(400).json({ error: "Username reservado." }); return; }

  const [existing] = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.username, newUsername)).limit(1);
  if (existing && existing.id !== userId) { res.status(409).json({ error: "Username já em uso." }); return; }

  const [currentUser] = await db.select({ id: usersTable.id, username: usersTable.username }).from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  if (!currentUser) { res.status(404).json({ error: "Usuário não encontrado." }); return; }

  const oldUsername = currentUser.username;
  if (oldUsername === newUsername) {
    res.json({ success: true, username: newUsername });
    return;
  }

  await db.transaction(async (tx) => {
    await tx.update(usersTable).set({ username: newUsername }).where(eq(usersTable.id, userId));
    // Free the new username from any old redirect that pointed to it.
    await tx.delete(usernameRedirectsTable).where(eq(usernameRedirectsTable.oldUsername, newUsername));
    // Record the old username so /oldUsername still resolves to this user
    // (until someone else registers the old username, which clears the entry).
    await tx
      .insert(usernameRedirectsTable)
      .values({ oldUsername, targetUserId: userId })
      .onConflictDoUpdate({
        target: usernameRedirectsTable.oldUsername,
        set: { targetUserId: userId, createdAt: new Date() },
      });
  });

  res.json({ success: true, username: newUsername });
});

router.post("/admin/users/:userId/ban", requireAdmin, async (req, res): Promise<void> => {
  const userId = Number(req.params.userId);
  const banned = req.body?.banned !== false;
  await db.update(usersTable).set({ banned }).where(eq(usersTable.id, userId));
  res.json({ success: true, banned });
});

router.post("/admin/users/:userId/verified", requireAdmin, async (req, res): Promise<void> => {
  const userId = Number(req.params.userId);
  const enabled = req.body?.verified !== false;
  const type: string = req.body?.type || "verified";
  const validTypes = ["verified", "verified_gold", "verified_white"];
  const badgeType = validTypes.includes(type) ? type : "verified";
  const [profile] = await db.select().from(profilesTable).where(eq(profilesTable.userId, userId)).limit(1);
  if (!profile) {
    res.status(404).json({ error: "Perfil não encontrado" });
    return;
  }
  const badges = new Set(profile.badges ?? []);
  if (enabled) {
    validTypes.forEach(t => badges.delete(t));
    badges.add(badgeType);
  } else {
    validTypes.forEach(t => badges.delete(t));
  }
  await db.update(profilesTable).set({ badges: [...badges] }).where(eq(profilesTable.userId, userId));
  res.json({ success: true, verified: enabled, type: badgeType });
});

router.get("/admin/users/:userId/profile", requireAdmin, async (req, res): Promise<void> => {
  const userId = Number(req.params.userId);
  if (!Number.isFinite(userId)) { res.status(400).json({ error: "userId inválido" }); return; }
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  if (!user) { res.status(404).json({ error: "Usuário não encontrado" }); return; }
  const [profile] = await db.select().from(profilesTable).where(eq(profilesTable.userId, userId)).limit(1);
  if (!profile) { res.status(404).json({ error: "Perfil não encontrado" }); return; }
  res.json({
    id: user.id,
    username: user.username,
    email: user.email,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    bio: profile.bio,
    bannerUrl: profile.bannerUrl,
    backgroundUrl: profile.backgroundUrl,
    backgroundType: profile.backgroundType,
    accentColor: profile.accentColor,
    glowColor: profile.glowColor,
    backgroundOpacity: profile.backgroundOpacity,
    backgroundBlur: profile.backgroundBlur,
    nameBorderOpacity: profile.nameBorderOpacity,
    cursorStyle: profile.cursorStyle,
    musicUrl: profile.musicUrl,
    musicTitle: profile.musicTitle,
    musicIconUrl: profile.musicIconUrl,
    musicPrivate: profile.musicPrivate,
    particleEffect: profile.particleEffect,
    clickEffect: profile.clickEffect,
    fontFamily: profile.fontFamily,
    layoutStyle: profile.layoutStyle,
    profileTitle: profile.profileTitle,
    typewriterTexts: profile.typewriterTexts,
    badges: profile.badges,
    showViews: profile.showViews,
    showDiscordAvatar: profile.showDiscordAvatar,
    showDiscordPresence: profile.showDiscordPresence,
  });
});

router.patch("/admin/users/:userId/profile", requireAdmin, async (req, res): Promise<void> => {
  const userId = Number(req.params.userId);
  if (!Number.isFinite(userId)) { res.status(400).json({ error: "userId inválido" }); return; }
  const body = req.body || {};

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  if (!user) { res.status(404).json({ error: "Usuário não encontrado" }); return; }
  const [profile] = await db.select().from(profilesTable).where(eq(profilesTable.userId, userId)).limit(1);
  if (!profile) { res.status(404).json({ error: "Perfil não encontrado" }); return; }

  const userUpdates: Record<string, unknown> = {};
  if (typeof body.displayName === "string") userUpdates.displayName = body.displayName.slice(0, 80);
  if (typeof body.email === "string" && body.email.trim()) userUpdates.email = body.email.trim().toLowerCase().slice(0, 254);
  if (typeof body.avatarUrl === "string") userUpdates.avatarUrl = body.avatarUrl;
  if (Object.keys(userUpdates).length > 0) {
    await db.update(usersTable).set(userUpdates).where(eq(usersTable.id, userId));
  }

  const profileUpdates: Record<string, unknown> = {};
  const stringFields = [
    "bio", "bannerUrl", "backgroundUrl", "backgroundType", "accentColor", "glowColor",
    "cursorStyle", "musicUrl", "musicTitle", "musicIconUrl", "particleEffect", "clickEffect",
    "fontFamily", "layoutStyle", "profileTitle",
  ] as const;
  for (const k of stringFields) {
    if (typeof body[k] === "string") profileUpdates[k] = body[k];
  }
  const numberFields = ["backgroundOpacity", "backgroundBlur", "nameBorderOpacity"] as const;
  for (const k of numberFields) {
    if (typeof body[k] === "number" && Number.isFinite(body[k])) profileUpdates[k] = body[k];
  }
  const boolFields = ["musicPrivate", "showViews", "showDiscordAvatar", "showDiscordPresence"] as const;
  for (const k of boolFields) {
    if (typeof body[k] === "boolean") profileUpdates[k] = body[k];
  }
  if (Array.isArray(body.badges)) {
    profileUpdates.badges = body.badges.filter((b: unknown) => typeof b === "string").slice(0, 12);
  }
  if (Array.isArray(body.typewriterTexts)) {
    profileUpdates.typewriterTexts = body.typewriterTexts.filter((t: unknown) => typeof t === "string").slice(0, 20);
  }
  if (Object.keys(profileUpdates).length > 0) {
    await db.update(profilesTable).set(profileUpdates).where(eq(profilesTable.userId, userId));
  }

  res.json({ success: true });
});

router.get("/admin/reports", requireAdmin, async (req, res): Promise<void> => {
  const status = typeof req.query.status === "string" ? req.query.status : "pending";
  const rows = await db
    .select({
      id: profileReportsTable.id,
      reportedUserId: profileReportsTable.reportedUserId,
      reporterUserId: profileReportsTable.reporterUserId,
      reason: profileReportsTable.reason,
      details: profileReportsTable.details,
      reporterIp: profileReportsTable.reporterIp,
      status: profileReportsTable.status,
      createdAt: profileReportsTable.createdAt,
      reportedUsername: usersTable.username,
      reportedDisplayName: usersTable.displayName,
    })
    .from(profileReportsTable)
    .leftJoin(usersTable, eq(profileReportsTable.reportedUserId, usersTable.id))
    .where(status !== "all" ? eq(profileReportsTable.status, status) : undefined)
    .orderBy(desc(profileReportsTable.createdAt))
    .limit(100);
  res.json(rows);
});

router.post("/admin/reports/:reportId/resolve", requireAdmin, async (req, res): Promise<void> => {
  const reportId = Number(req.params.reportId);
  const action = req.body?.action as "dismiss" | "ban" | undefined;

  await db.update(profileReportsTable)
    .set({ status: action === "ban" ? "actioned" : "dismissed" })
    .where(eq(profileReportsTable.id, reportId));

  if (action === "ban") {
    const [report] = await db.select().from(profileReportsTable).where(eq(profileReportsTable.id, reportId)).limit(1);
    if (report) {
      await db.update(usersTable).set({ banned: true }).where(eq(usersTable.id, report.reportedUserId));
    }
  }

  res.json({ success: true });
});

router.get("/admin/support", requireAdmin, async (req, res): Promise<void> => {
  const rows = await db
    .select()
    .from(supportTicketsTable)
    .orderBy(desc(supportTicketsTable.createdAt))
    .limit(200);
  res.json(rows);
});

router.post("/admin/support/:ticketId/resolve", requireAdmin, async (req, res): Promise<void> => {
  const ticketId = Number(req.params.ticketId);
  const status = req.body?.status || "resolved";
  await db.update(supportTicketsTable).set({ status }).where(eq(supportTicketsTable.id, ticketId));
  res.json({ success: true });
});

router.get("/admin/post-reports", requireAdmin, async (req, res): Promise<void> => {
  const rows = await db
    .select({
      id: postReportsTable.id,
      postId: postReportsTable.postId,
      reason: postReportsTable.reason,
      status: postReportsTable.status,
      reporterIp: postReportsTable.reporterIp,
      createdAt: postReportsTable.createdAt,
      postContent: postsTable.content,
      postUserId: postsTable.userId,
      reporterUserId: postReportsTable.reporterUserId,
    })
    .from(postReportsTable)
    .leftJoin(postsTable, eq(postReportsTable.postId, postsTable.id))
    .where(eq(postReportsTable.status, "pending"))
    .orderBy(desc(postReportsTable.createdAt))
    .limit(100);
  res.json(rows);
});

router.post("/admin/post-reports/:reportId/resolve", requireAdmin, async (req, res): Promise<void> => {
  const reportId = Number(req.params.reportId);
  const action = req.body?.action as "dismiss" | "remove" | undefined;

  if (action === "remove") {
    const [report] = await db.select().from(postReportsTable).where(eq(postReportsTable.id, reportId)).limit(1);
    if (report) {
      await db.update(postsTable).set({ status: "removed" }).where(eq(postsTable.id, report.postId));
    }
  }

  await db.update(postReportsTable)
    .set({ status: action === "remove" ? "actioned" : "dismissed" })
    .where(eq(postReportsTable.id, reportId));

  res.json({ success: true });
});

export default router;
