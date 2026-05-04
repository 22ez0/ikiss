import { Router, type IRouter } from "express";
import type { Request, Response } from "express";

const router: IRouter = Router();

const OWNER_DISCORD_ID = "1495245938116005908";
const BOT_TOKEN = process.env.DISCORD_BOT_TOKEN ?? "";
const EMAIL_WEBHOOK_SECRET = process.env.EMAIL_WEBHOOK_SECRET ?? "";

function extractCode(text: string): string | null {
  const patterns = [
    /\b(\d{6})\b/,
    /\b([A-Z0-9]{6,8})\b/,
    /c[oó]digo[:\s]+([A-Z0-9\-]{4,10})/i,
    /code[:\s]+([A-Z0-9\-]{4,10})/i,
    /verifica[çc][aã]o[:\s]+([A-Z0-9\-]{4,10})/i,
    /verification[:\s]+([A-Z0-9\-]{4,10})/i,
    /otp[:\s]+([A-Z0-9]{4,8})/i,
    /pin[:\s]+([0-9]{4,8})/i,
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

async function sendDiscordDm(content: string): Promise<void> {
  if (!BOT_TOKEN) {
    console.warn("[email] DISCORD_BOT_TOKEN não definido — DM não enviada");
    return;
  }

  const dmRes = await fetch(`https://discord.com/api/v10/users/@me/channels`, {
    method: "POST",
    headers: {
      Authorization: `Bot ${BOT_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ recipient_id: OWNER_DISCORD_ID }),
  });

  if (!dmRes.ok) {
    const err = await dmRes.text();
    console.error("[email] falha ao abrir DM:", err);
    return;
  }

  const { id: channelId } = (await dmRes.json()) as { id: string };

  const msgRes = await fetch(`https://discord.com/api/v10/channels/${channelId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bot ${BOT_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ content }),
  });

  if (!msgRes.ok) {
    const err = await msgRes.text();
    console.error("[email] falha ao enviar mensagem:", err);
  }
}

router.post("/email/inbound", async (req: Request, res: Response): Promise<void> => {
  if (EMAIL_WEBHOOK_SECRET) {
    const secret = req.headers["x-webhook-secret"] ?? req.headers["x-email-secret"];
    if (secret !== EMAIL_WEBHOOK_SECRET) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
  }

  try {
    const body = req.body as Record<string, string>;

    const from = body.from ?? body.sender ?? "desconhecido";
    const to = body.to ?? body.recipient ?? "";
    const subject = body.subject ?? "(sem assunto)";
    const rawText = body.text ?? body["body-plain"] ?? "";
    const rawHtml = body.html ?? body["body-html"] ?? "";

    const text = rawText || htmlToText(rawHtml);
    const preview = text.slice(0, 800).trim();
    const code = extractCode(text) ?? extractCode(subject);

    let msg = `📧 **EMAIL RECEBIDO**\n`;
    msg += `\`\`\`\n`;
    msg += `Para:     ${to}\n`;
    msg += `De:       ${from}\n`;
    msg += `Assunto:  ${subject}\n`;
    msg += `\`\`\`\n`;

    if (code) {
      msg += `🔑 **CÓDIGO: \`${code}\`**\n\n`;
    }

    msg += `**Conteúdo:**\n\`\`\`\n${preview}${text.length > 800 ? "\n...(truncado)" : ""}\n\`\`\``;

    await sendDiscordDm(msg);

    res.json({ ok: true });
  } catch (e: any) {
    console.error("[email] erro ao processar email:", e?.message);
    res.status(500).json({ error: "internal error" });
  }
});

router.post("/email/test", async (req: Request, res: Response): Promise<void> => {
  try {
    await sendDiscordDm(
      `📧 **TESTE DE EMAIL**\n\`\`\`\nPara:     voce@faren.com.br\nDe:       test@example.com\nAssunto:  Seu código de verificação\n\`\`\`\n🔑 **CÓDIGO: \`847291\`**\n\n**Conteúdo:**\n\`\`\`\nSeu código de verificação é 847291.\nEle expira em 10 minutos.\n\`\`\``
    );
    res.json({ ok: true, message: "DM de teste enviada" });
  } catch (e: any) {
    res.status(500).json({ error: e?.message });
  }
});

export default router;
