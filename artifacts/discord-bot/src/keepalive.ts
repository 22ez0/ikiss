const BOT_URL =
  process.env.BOT_PUBLIC_URL ?? "https://ikiss-discord-bot.onrender.com";

const PING_MS = 4 * 60 * 1000; // 4 minutos — Render dorme após 15min sem ping

export function startKeepalive(): void {
  setInterval(async () => {
    try {
      const res = await fetch(`${BOT_URL}/`, { signal: AbortSignal.timeout(10000) });
      console.log(`[keepalive] ping ${res.ok ? "ok" : res.status}`);
    } catch (e: any) {
      console.warn("[keepalive] ping falhou:", e?.message);
    }
  }, PING_MS);

  console.log(`[keepalive] iniciado — ping a cada ${PING_MS / 60000}min → ${BOT_URL}`);
}
