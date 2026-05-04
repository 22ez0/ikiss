import { Router, type IRouter } from "express";
import type { Request, Response } from "express";
import pkg from "pg";
const { Pool } = pkg;

const router: IRouter = Router();

const ALLOWED_DISCORD_IDS = [
  "1495245938116005908",
  "1499585365328134247",
  "1424456058012696769",
];

const BOT_TOKEN = process.env.DISCORD_BOT_TOKEN ?? "";
const EMAIL_WEBHOOK_SECRET = process.env.EMAIL_WEBHOOK_SECRET ?? "";

const pool = new Pool({
  connectionString: process.env.NEON_DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 3,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

async function ensureEmailTables(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS email_addresses (
      id            SERIAL PRIMARY KEY,
      discord_user_id TEXT NOT NULL,
      address       TEXT NOT NULL UNIQUE,
      created_at    TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS email_inbox (
      id          SERIAL PRIMARY KEY,
      address     TEXT NOT NULL,
      from_addr   TEXT NOT NULL,
      subject     TEXT NOT NULL DEFAULT '',
      body        TEXT NOT NULL DEFAULT '',
      code        TEXT,
      received_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_email_inbox_address ON email_inbox(address)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_email_inbox_received ON email_inbox(received_at DESC)`);
}

ensureEmailTables().catch((e) => console.error("[email] falha ao criar tabelas:", e?.message));

function extractCode(text: string): string | null {
  const patterns = [
    /\b(\d{6})\b/,
    /c[oó]digo[:\s]+([A-Z0-9\-]{4,10})/i,
    /code[:\s]+([A-Z0-9\-]{4,10})/i,
    /verifica[çc][aã]o[:\s]+([A-Z0-9\-]{4,10})/i,
    /verification[:\s]+([A-Z0-9\-]{4,10})/i,
    /otp[:\s]+([A-Z0-9]{4,8})/i,
    /pin[:\s]+([0-9]{4,8})/i,
    /\b([A-Z0-9]{6,8})\b/,
  ];
  for (const re of patterns) {
    const m = text.match(re);
    if (m) return m[1];
  }
  return null;
}

function htmlToText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<\/tr>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

async function sendDiscordDm(discordUserId: string, content: string): Promise<void> {
  if (!BOT_TOKEN) return;
  const dmRes = await fetch("https://discord.com/api/v10/users/@me/channels", {
    method: "POST",
    headers: { Authorization: `Bot ${BOT_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ recipient_id: discordUserId }),
  });
  if (!dmRes.ok) { console.error("[email] abrir DM falhou:", await dmRes.text()); return; }
  const { id: channelId } = (await dmRes.json()) as { id: string };
  const msgRes = await fetch(`https://discord.com/api/v10/channels/${channelId}/messages`, {
    method: "POST",
    headers: { Authorization: `Bot ${BOT_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ content }),
  });
  if (!msgRes.ok) console.error("[email] enviar DM falhou:", await msgRes.text());
}

function checkSecret(req: Request, res: Response): boolean {
  if (!EMAIL_WEBHOOK_SECRET) return true;
  const s = req.headers["x-webhook-secret"] ?? req.headers["x-email-secret"] ?? req.query.secret;
  if (s !== EMAIL_WEBHOOK_SECRET) { res.status(401).json({ error: "Unauthorized" }); return false; }
  return true;
}

router.post("/email/inbound", async (req: Request, res: Response): Promise<void> => {
  if (!checkSecret(req, res)) return;
  try {
    const body = req.body as Record<string, string>;
    const from = body.from ?? body.sender ?? "desconhecido";
    const to = (body.to ?? body.recipient ?? "").toLowerCase().trim();
    const subject = body.subject ?? "(sem assunto)";
    const rawText = body.text ?? body["body-plain"] ?? "";
    const rawHtml = body.html ?? body["body-html"] ?? "";
    const text = rawText || htmlToText(rawHtml);
    const preview = text.slice(0, 800).trim();
    const code = extractCode(text) ?? extractCode(subject) ?? null;

    await pool.query(
      "INSERT INTO email_inbox (address, from_addr, subject, body, code) VALUES ($1,$2,$3,$4,$5)",
      [to, from, subject, text.slice(0, 4000), code]
    );

    const ownerRes = await pool.query<{ discord_user_id: string }>(
      "SELECT discord_user_id FROM email_addresses WHERE address = $1", [to]
    );
    const owner = ownerRes.rows[0]?.discord_user_id ?? null;

    let msg = `📧 **EMAIL RECEBIDO**\n\`\`\`\nPara:     ${to}\nDe:       ${from}\nAssunto:  ${subject}\n\`\`\`\n`;
    if (code) msg += `🔑 **CÓDIGO: \`${code}\`**\n\n`;
    msg += `**Conteúdo:**\n\`\`\`\n${preview}${text.length > 800 ? "\n...(truncado)" : ""}\n\`\`\``;

    const notified = new Set<string>();
    if (owner) { await sendDiscordDm(owner, msg); notified.add(owner); }
    for (const id of ALLOWED_DISCORD_IDS) {
      if (!notified.has(id)) { await sendDiscordDm(id, msg); notified.add(id); }
    }

    res.json({ ok: true });
  } catch (e: any) {
    console.error("[email] inbound erro:", e?.message);
    res.status(500).json({ error: "internal error" });
  }
});

router.post("/email/addresses", async (req: Request, res: Response): Promise<void> => {
  if (!checkSecret(req, res)) return;
  try {
    const { discordUserId, address } = req.body as { discordUserId?: string; address?: string };
    if (!discordUserId || !address) { res.status(400).json({ error: "discordUserId e address obrigatórios" }); return; }
    if (!ALLOWED_DISCORD_IDS.includes(discordUserId)) { res.status(403).json({ error: "Usuário não autorizado" }); return; }

    const clean = address.toLowerCase().replace(/[^a-z0-9._+-]/g, "").slice(0, 40);
    if (!clean) { res.status(400).json({ error: "Endereço inválido" }); return; }
    const full = `${clean}@faren.com.br`;

    const exists = await pool.query("SELECT id FROM email_addresses WHERE address = $1", [full]);
    if (exists.rows.length > 0) { res.status(409).json({ error: "Endereço já em uso" }); return; }

    await pool.query(
      "INSERT INTO email_addresses (discord_user_id, address) VALUES ($1, $2)",
      [discordUserId, full]
    );
    res.json({ ok: true, address: full });
  } catch (e: any) {
    res.status(500).json({ error: e?.message });
  }
});

router.get("/email/addresses", async (req: Request, res: Response): Promise<void> => {
  if (!checkSecret(req, res)) return;
  try {
    const discordUserId = req.query.discordUserId as string;
    if (!discordUserId) { res.status(400).json({ error: "discordUserId obrigatório" }); return; }
    const r = await pool.query(
      "SELECT address, created_at FROM email_addresses WHERE discord_user_id = $1 ORDER BY created_at DESC",
      [discordUserId]
    );
    res.json({ addresses: r.rows });
  } catch (e: any) {
    res.status(500).json({ error: e?.message });
  }
});

router.get("/email/inbox", async (req: Request, res: Response): Promise<void> => {
  if (!checkSecret(req, res)) return;
  try {
    const discordUserId = req.query.discordUserId as string;
    const address = req.query.address as string | undefined;
    const limit = Math.min(Number(req.query.limit ?? 5), 20);

    if (!discordUserId) { res.status(400).json({ error: "discordUserId obrigatório" }); return; }

    let addresses: string[] = [];
    if (address) {
      const owns = await pool.query(
        "SELECT id FROM email_addresses WHERE address = $1 AND discord_user_id = $2", [address, discordUserId]
      );
      if (owns.rows.length === 0) { res.status(403).json({ error: "Endereço não pertence a este usuário" }); return; }
      addresses = [address];
    } else {
      const r = await pool.query("SELECT address FROM email_addresses WHERE discord_user_id = $1", [discordUserId]);
      addresses = r.rows.map((row: { address: string }) => row.address);
    }

    if (addresses.length === 0) { res.json({ emails: [] }); return; }

    const placeholders = addresses.map((_: string, i: number) => `$${i + 1}`).join(", ");
    const r = await pool.query(
      `SELECT id, address, from_addr, subject, body, code, received_at FROM email_inbox WHERE address IN (${placeholders}) ORDER BY received_at DESC LIMIT $${addresses.length + 1}`,
      [...addresses, limit]
    );
    res.json({ emails: r.rows });
  } catch (e: any) {
    res.status(500).json({ error: e?.message });
  }
});

router.post("/email/test", async (req: Request, res: Response): Promise<void> => {
  try {
    const msg = `📧 **TESTE DE EMAIL**\n\`\`\`\nPara:     teste@faren.com.br\nDe:       noreply@discord.com\nAssunto:  Verifique seu endereço de email\n\`\`\`\n🔑 **CÓDIGO: \`847291\`**\n\n**Conteúdo:**\n\`\`\`\nSeu código de verificação é 847291.\nEle expira em 10 minutos.\n\`\`\``;
    for (const id of ALLOWED_DISCORD_IDS) await sendDiscordDm(id, msg);
    res.json({ ok: true, message: "DM de teste enviada" });
  } catch (e: any) {
    res.status(500).json({ error: e?.message });
  }
});

export default router;
