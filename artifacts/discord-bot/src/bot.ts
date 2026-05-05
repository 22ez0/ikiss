import {
  Client,
  GatewayIntentBits,
  Partials,
  ActivityType,
} from "discord.js";
import { registerInteractionHandlers } from "./handlers/interactions.js";
import { registerMessageCollector } from "./handlers/collectors.js";
import { initDb, loadAllUsers } from "./db.js";
import { loadSessionFromDb } from "./store.js";
import { activateRpc } from "./selfbot.js";

const BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
if (!BOT_TOKEN) throw new Error("DISCORD_BOT_TOKEN não definido");

export const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.Channel, Partials.Message],
});

registerInteractionHandlers(client);
registerMessageCollector(client);

client.once("ready", async () => {
  console.log(`[bot] conectado como ${client.user?.tag}`);

  client.user?.setPresence({
    status: "online",
    activities: [{ name: "/k", type: ActivityType.Streaming, url: "https://twitch.tv/faren" }],
  });

  console.log("[bot] status de streaming definido: /k");

  // inicializar DB e restaurar sessões
  try {
    await initDb();
    const users = await loadAllUsers();

    if (users.length > 0) {
      console.log(`[db] restaurando ${users.length} sessão(ões)...`);
      let delay = 3000;

      for (const u of users) {
        loadSessionFromDb(u.user_id, { token: u.token, rpc: u.rpc });

        if (u.token && u.rpc) {
          const uid = u.user_id;
          const tok = u.token;
          const rpc = u.rpc;
          setTimeout(async () => {
            try {
              await activateRpc(tok, uid, rpc);
              console.log(`[db] rpc restaurado: ${uid}`);
            } catch (e: any) {
              console.warn(`[db] falha ao restaurar rpc ${uid}:`, e?.message);
            }
          }, delay);
          delay += 2000;
        }
      }
    }
  } catch (e: any) {
    console.warn("[db] erro na inicialização:", e?.message);
  }

});

export async function startBot(): Promise<void> {
  await client.login(BOT_TOKEN);
}
