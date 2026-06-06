import { logger } from "./logger";

const RESEND_API = "https://api.resend.com/emails";

const APP_URL = (process.env.APP_URL || "https://ikiss.me").replace(/\/+$/, "");
const FROM = process.env.EMAIL_FROM || "Ikiss <no-reply@ikiss.me>";

type SendArgs = { to: string; subject: string; html: string; text: string };

async function send({ to, subject, html, text }: SendArgs): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    logger.warn({ to, subject }, "[email] RESEND_API_KEY not set — skipping send");
    return false;
  }
  try {
    const r = await fetch(RESEND_API, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from: FROM, to, subject, html, text }),
    });
    if (!r.ok) {
      const body = await r.text();
      logger.error({ status: r.status, body, to, subject }, "[email] resend send failed");
      return false;
    }
    return true;
  } catch (e) {
    logger.error({ err: (e as Error).message, to, subject }, "[email] resend send threw");
    return false;
  }
}

function shell(title: string, bodyHtml: string): string {
  return `<!doctype html><html lang="pt-br"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title></head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Inter,sans-serif;color:#e6e6e6">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0a;padding:32px 16px">
    <tr><td align="center">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#111;border:1px solid #222;border-radius:14px;overflow:hidden">
        <tr><td style="padding:28px 32px 8px 32px">
          <div style="font-size:22px;font-weight:700;letter-spacing:.02em;color:#fff">ikiss</div>
        </td></tr>
        <tr><td style="padding:8px 32px 32px 32px;font-size:15px;line-height:1.6;color:#d4d4d4">
          ${bodyHtml}
        </td></tr>
        <tr><td style="padding:18px 32px 28px 32px;border-top:1px solid #1f1f1f;color:#777;font-size:12px;line-height:1.5">
          Você está recebendo este e-mail porque alguém usou seu endereço em <a href="${APP_URL}" style="color:#9ca3af">ikiss.me</a>.<br>
          Se não foi você, pode ignorar com segurança.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

export async function sendVerificationEmail(to: string, token: string): Promise<boolean> {
  const link = `${APP_URL}/verify-email?token=${encodeURIComponent(token)}`;
  const subject = "Verifique seu email";
  const html = shell(subject, `
    <h1 style="margin:0 0 12px 0;font-size:20px;color:#fff">Confirme seu e-mail</h1>
    <p style="margin:0 0 20px 0">Bem-vindo ao Ikiss! Clique no botão abaixo pra confirmar seu endereço e ativar sua conta.</p>
    <p style="margin:0 0 24px 0">
      <a href="${link}" style="display:inline-block;background:#fff;color:#000;text-decoration:none;font-weight:600;padding:12px 22px;border-radius:10px">Verificar e-mail</a>
    </p>
    <p style="margin:0 0 8px 0;color:#9a9a9a;font-size:13px">Ou copie e cole este link no navegador:</p>
    <p style="margin:0;word-break:break-all;color:#9ca3af;font-size:13px">${link}</p>
    <p style="margin:18px 0 0 0;color:#777;font-size:12px">Este link expira em 24 horas.</p>
  `);
  const text = `Verifique seu e-mail no Ikiss\n\nAbra este link para confirmar sua conta:\n${link}\n\nEste link expira em 24 horas. Se não foi você, ignore este e-mail.`;
  return send({ to, subject, html, text });
}

export async function sendPasswordResetEmail(to: string, token: string): Promise<boolean> {
  const link = `${APP_URL}/reset-password?token=${encodeURIComponent(token)}`;
  const subject = "Redefinir sua senha do Ikiss";
  const html = shell(subject, `
    <h1 style="margin:0 0 12px 0;font-size:20px;color:#fff">Redefinir senha</h1>
    <p style="margin:0 0 20px 0">Recebemos um pedido pra redefinir a senha da sua conta. Clique no botão pra escolher uma nova.</p>
    <p style="margin:0 0 24px 0">
      <a href="${link}" style="display:inline-block;background:#fff;color:#000;text-decoration:none;font-weight:600;padding:12px 22px;border-radius:10px">Redefinir senha</a>
    </p>
    <p style="margin:0 0 8px 0;color:#9a9a9a;font-size:13px">Ou copie e cole este link no navegador:</p>
    <p style="margin:0;word-break:break-all;color:#9ca3af;font-size:13px">${link}</p>
    <p style="margin:18px 0 0 0;color:#777;font-size:12px">Este link expira em 1 hora. Se não foi você, ignore este e-mail — sua senha continua a mesma.</p>
  `);
  const text = `Redefinir sua senha do Ikiss\n\nAbra este link para escolher uma nova senha:\n${link}\n\nEste link expira em 1 hora. Se não foi você, ignore este e-mail.`;
  return send({ to, subject, html, text });
}
