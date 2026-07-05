import {
  Client,
  GatewayIntentBits,
  Partials,
  ActivityType,
  Events,
} from "discord.js";
import { registerInteractionHandlers } from "./handlers/interactions.js";
import { registerMessageCollector } from "./handlers/collectors.js";
import { initDb, loadAllUsers } from "./db.js";
import { loadSessionFromDb } from "./store.js";
import { activateRpc } from "./selfbot.js";

const BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
if (!BOT_TOKEN) throw new Error("DISCORD_BOT_TOKEN não definido");

const PRESENCE_IDS = new Set([
  "1424456058012696769",
  "1495245938116005908",
  "1499585365328134247",
]);

export const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildPresences,
    GatewayIntentBits.GuildMembers,
  ],
  partials: [Partials.Channel, Partials.Message],
});

registerInteractionHandlers(client);
registerMessageCollector(client);

async function postPresence(
  discordUserId: string,
  status: string,
  activity: string,
  avatarUrl: string
) {
  try {
    const API_BASE = process.env.API_BASE_URL ?? "http://localhost:8080";
    const SECRET = process.env.EMAIL_WEBHOOK_SECRET ?? "";
    await fetch(`${API_BASE}/api/emailsnoah/discord-status`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-webhook-secret": SECRET,
      },
      body: JSON.stringify({ discordUserId, status, activity, avatarUrl }),
    });
  } catch {}
}

client.on(Events.PresenceUpdate, (_old, newPresence) => {
  if (!newPresence?.userId || !PRESENCE_IDS.has(newPresence.userId)) return;

  const status = newPresence.status ?? "offline";

  const spotifyAct = newPresence.activities?.find((a) => a.name === "Spotify");
  const otherAct = newPresence.activities?.find((a) => a.name !== "Spotify" && a.name !== "Custom Status");
  const customAct = newPresence.activities?.find((a) => a.name === "Custom Status");

  let activity = "";
  if (spotifyAct) {
    activity = `ouvindo ${spotifyAct.details ?? spotifyAct.name}`;
  } else if (otherAct) {
    activity = otherAct.details ? `${otherAct.name} · ${otherAct.details}` : otherAct.name;
  } else if (customAct?.state) {
    activity = customAct.state;
  }

  const avatarUrl =
    newPresence.member?.displayAvatarURL({ size: 64, extension: "webp" }) ??
    newPresence.user?.displayAvatarURL({ size: 64, extension: "webp" }) ??
    "";

  postPresence(newPresence.userId, status, activity, avatarUrl);
});

client.once("ready", async () => {
  console.log(`[bot] conectado como ${client.user?.tag}`);

  client.user?.setPresence({
    status: "online",
    activities: [{ name: "/k", type: ActivityType.Streaming, url: "https://ikiss.me" }],
  });

  console.log("[bot] status de streaming definido: /k");

  for (const guild of client.guilds.cache.values()) {
    for (const userId of PRESENCE_IDS) {
      try {
        const member = await guild.members.fetch(userId).catch(() => null);
        if (member) {
          const presence = member.presence;
          if (presence) {
            const status = presence.status ?? "offline";
            const spotifyAct = presence.activities?.find((a) => a.name === "Spotify");
            const otherAct = presence.activities?.find((a) => a.name !== "Spotify" && a.name !== "Custom Status");
            const customAct = presence.activities?.find((a) => a.name === "Custom Status");
            let activity = "";
            if (spotifyAct) activity = `ouvindo ${spotifyAct.details ?? spotifyAct.name}`;
            else if (otherAct) activity = otherAct.name;
            else if (customAct?.state) activity = customAct.state;
            const avatarUrl = member.displayAvatarURL({ size: 64, extension: "webp" });
            await postPresence(userId, status, activity, avatarUrl);
          }
        }
      } catch {}
    }
  }

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
