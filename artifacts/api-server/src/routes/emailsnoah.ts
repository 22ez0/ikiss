import { Router } from "express";
import type { Request, Response } from "express";
import pkg from "pg";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const { Pool } = pkg;

const router = Router();

const ALLOWED_USERS = [
  { id: "1424456058012696769", name: "bella" },
  { id: "1495245938116005908", name: "noah" },
  { id: "1499585365328134247", name: "erick" },
];
const ALLOWED_IDS = ALLOWED_USERS.map((u) => u.id);

const EMAIL_WEBHOOK_SECRET = process.env.EMAIL_WEBHOOK_SECRET ?? "";
const JWT_SECRET = process.env.SESSION_SECRET ?? "emailsnoah-fallback-secret";

const pool = new Pool({
  connectionString: process.env.NEON_DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 3,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

async function ensureTables(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS emailsnoah_passwords (
      discord_user_id TEXT PRIMARY KEY,
      password_hash   TEXT NOT NULL,
      updated_at      TIMESTAMPTZ DEFAULT NOW()
    )
  `);
}

ensureTables().catch((e) => console.error("[emailsnoah] table error:", e?.message));

function checkSecret(req: Request, res: Response): boolean {
  if (!EMAIL_WEBHOOK_SECRET) return true;
  const s = req.headers["x-webhook-secret"] ?? req.headers["x-email-secret"] ?? req.query.secret;
  if (s !== EMAIL_WEBHOOK_SECRET) {
    res.status(401).json({ error: "Unauthorized" });
    return false;
  }
  return true;
}

function verifyToken(req: Request): { discordUserId: string; name: string } | null {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) return null;
  try {
    return jwt.verify(auth.slice(7), JWT_SECRET) as { discordUserId: string; name: string };
  } catch {
    return null;
  }
}

router.get("/emailsnoah/users", (_req: Request, res: Response): void => {
  res.json({ users: ALLOWED_USERS.map((u) => ({ id: u.id, name: u.name })) });
});

router.post("/emailsnoah/set-password", async (req: Request, res: Response): Promise<void> => {
  if (!checkSecret(req, res)) return;
  try {
    const { discordUserId, password } = req.body as { discordUserId?: string; password?: string };
    if (!discordUserId || !password) {
      res.status(400).json({ error: "discordUserId e password obrigatórios" });
      return;
    }
    if (!ALLOWED_IDS.includes(discordUserId)) {
      res.status(403).json({ error: "Usuário não autorizado" });
      return;
    }
    if (password.length < 4) {
      res.status(400).json({ error: "Senha muito curta (mínimo 4 caracteres)" });
      return;
    }
    const hash = await bcrypt.hash(password, 10);
    await pool.query(
      `INSERT INTO emailsnoah_passwords (discord_user_id, password_hash, updated_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (discord_user_id) DO UPDATE SET password_hash = $2, updated_at = NOW()`,
      [discordUserId, hash]
    );
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: e?.message });
  }
});

router.post("/emailsnoah/login", async (req: Request, res: Response): Promise<void> => {
  try {
    const { discordUserId, password } = req.body as { discordUserId?: string; password?: string };
    if (!discordUserId || !password) {
      res.status(400).json({ error: "discordUserId e password obrigatórios" });
      return;
    }
    if (!ALLOWED_IDS.includes(discordUserId)) {
      res.status(403).json({ error: "Acesso negado" });
      return;
    }
    const r = await pool.query(
      "SELECT password_hash FROM emailsnoah_passwords WHERE discord_user_id = $1",
      [discordUserId]
    );
    if (r.rows.length === 0) {
      res.status(401).json({ error: "Senha não cadastrada. Use /senha no Discord para criar sua senha." });
      return;
    }
    const valid = await bcrypt.compare(password, r.rows[0].password_hash);
    if (!valid) {
      res.status(401).json({ error: "Senha incorreta" });
      return;
    }
    const user = ALLOWED_USERS.find((u) => u.id === discordUserId)!;
    const token = jwt.sign({ discordUserId, name: user.name }, JWT_SECRET, { expiresIn: "7d" });
    res.json({ ok: true, token, name: user.name, discordUserId });
  } catch (e: any) {
    res.status(500).json({ error: e?.message });
  }
});

router.get("/emailsnoah/profiles", async (req: Request, res: Response): Promise<void> => {
  const session = verifyToken(req);
  if (!session) {
    res.status(401).json({ error: "Não autenticado" });
    return;
  }
  try {
    const r = await pool.query(
      `SELECT
         u.id, u.username, u.avatar_url, u.display_name, u.verified, u.verified_type,
         p.bio, p.banner_url, p.accent_color,
         p.discord_user_id, p.discord_username, p.discord_avatar_url,
         p.discord_status, p.discord_activity, p.discord_status_emoji,
         p.discord_nitro, p.discord_boost,
         p.show_discord_presence,
         p.music_title, p.music_url, p.music_icon_url, p.music_private,
         p.status_text, p.status_emoji, p.status_color,
         p.followers_count, p.likes_count, p.views_count
       FROM users u
       JOIN profiles p ON p.user_id = u.id
       WHERE p.discord_user_id = ANY($1)`,
      [ALLOWED_IDS]
    );
    res.json({ profiles: r.rows });
  } catch (e: any) {
    res.status(500).json({ error: e?.message });
  }
});

router.get("/emailsnoah/inbox", async (req: Request, res: Response): Promise<void> => {
  const session = verifyToken(req);
  if (!session) {
    res.status(401).json({ error: "Não autenticado" });
    return;
  }
  try {
    const limit = Math.min(Number(req.query.limit ?? 30), 50);
    const addrRes = await pool.query(
      "SELECT address FROM email_addresses WHERE discord_user_id = $1",
      [session.discordUserId]
    );
    const addresses: string[] = addrRes.rows.map((r: any) => r.address as string);
    if (addresses.length === 0) {
      res.json({ emails: [], addresses: [] });
      return;
    }
    const placeholders = addresses.map((_: string, i: number) => `$${i + 1}`).join(", ");
    const r = await pool.query(
      `SELECT id, address, from_addr, subject, body, code, received_at
       FROM email_inbox
       WHERE address IN (${placeholders})
       ORDER BY received_at DESC LIMIT $${addresses.length + 1}`,
      [...addresses, limit]
    );
    res.json({ emails: r.rows, addresses });
  } catch (e: any) {
    res.status(500).json({ error: e?.message });
  }
});

router.get("/emailsnoah/email/:id", async (req: Request, res: Response): Promise<void> => {
  const session = verifyToken(req);
  if (!session) {
    res.status(401).json({ error: "Não autenticado" });
    return;
  }
  try {
    const emailId = Number(req.params.id);
    const addrRes = await pool.query(
      "SELECT address FROM email_addresses WHERE discord_user_id = $1",
      [session.discordUserId]
    );
    const addresses: string[] = addrRes.rows.map((r: any) => r.address as string);
    if (addresses.length === 0) {
      res.status(404).json({ error: "Email não encontrado" });
      return;
    }
    const r = await pool.query(
      "SELECT id, address, from_addr, subject, body, code, received_at FROM email_inbox WHERE id = $1 AND address = ANY($2)",
      [emailId, addresses]
    );
    if (r.rows.length === 0) {
      res.status(404).json({ error: "Email não encontrado" });
      return;
    }
    res.json({ email: r.rows[0] });
  } catch (e: any) {
    res.status(500).json({ error: e?.message });
  }
});

export default router;
