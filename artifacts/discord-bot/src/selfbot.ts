import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { Client: SelfbotClient, RichPresence } = require("discord.js-selfbot-v13");

export interface RpcOptions {
  iconUrl?: string;
  statusType: "playing" | "watching" | "streaming";
  title: string;
  subtitle: string;
  detail: string;
  customUrl: string;
  buttonLabel?: string;
  buttonUrl?: string;
}

const selfbotClients = new Map<string, InstanceType<typeof SelfbotClient>>();
const selfbotTokens = new Map<string, string>();
const activeRpcOptions = new Map<string, RpcOptions>();
const rpcIntervals = new Map<string, ReturnType<typeof setInterval>>();

const CLIENT_ID = process.env.DISCORD_CLIENT_ID ?? "1500071757925584996";
const RPC_REFRESH_MS = 90 * 1000; // 90 segundos

async function getSelfbotClient(token: string, userId: string): Promise<InstanceType<typeof SelfbotClient>> {
  if (selfbotClients.has(userId)) {
    const existing = selfbotClients.get(userId)!;
    if (existing.user) return existing;
    existing.destroy();
    selfbotClients.delete(userId);
  }

  return new Promise((resolve, reject) => {
    const client = new SelfbotClient({ checkUpdate: false });

    const timeout = setTimeout(() => {
      client.destroy();
      reject(new Error("timeout ao conectar ao discord — tente novamente"));
    }, 20000);

    const onReconnect = async () => {
      const opts = activeRpcOptions.get(userId);
      if (!opts) return;
      try {
        const rp = await buildRichPresence(client, opts);
        await client.user.setActivity(rp);
        console.log(`[rpc] re-aplicado após reconexão ${userId}`);
      } catch (e: any) {
        console.warn(`[rpc] falhou ao re-aplicar reconexão ${userId}:`, e?.message);
      }
    };

    client.once("ready", () => {
      clearTimeout(timeout);
      selfbotClients.set(userId, client);
      selfbotTokens.set(userId, token);

      // reconexão: gateway READY + WebSocket resume
      client.on("ready", onReconnect);
      client.on("resumed", onReconnect);

      resolve(client);
    });

    client.once("error", (err: Error) => {
      clearTimeout(timeout);
      reject(err);
    });

    client.login(token).catch((err: Error) => {
      clearTimeout(timeout);
      const msg = err?.message ?? String(err);
      if (msg.includes("TOKEN_INVALID") || msg.includes("Improper token")) {
        reject(new Error("token inválido — verifique e tente novamente"));
      } else {
        reject(new Error(`erro ao conectar: ${msg}`));
      }
    });
  });
}

export async function validateToken(token: string, userId: string): Promise<{ username: string; id: string }> {
  // usa login via WebSocket — o Discord bloqueia HTTP requests com user token sem headers do browser
  const client = await getSelfbotClient(token, userId);
  const u = client.user;
  return {
    username: u.globalName || u.username || "desconhecido",
    id: u.id,
  };
}

export function getConnectedUser(userId: string): { username: string; id: string } | null {
  const client = selfbotClients.get(userId);
  if (!client?.user) return null;
  return {
    username: client.user.globalName || client.user.username || "desconhecido",
    id: client.user.id,
  };
}

export async function clearDm(token: string, userId: string, targetId: string): Promise<void> {
  const client = await getSelfbotClient(token, userId);
  const channel = await client.users.createDM(targetId);
  if (!channel) throw new Error("dm não encontrada com esse usuário");

  const messages = await channel.messages.fetch({ limit: 100 });
  const own = messages.filter((m: any) => m.author.id === client.user.id);

  for (const [, msg] of own) {
    await msg.delete().catch(() => null);
    await new Promise((r) => setTimeout(r, 400));
  }
}

export async function leaveAllServers(token: string, userId: string): Promise<number> {
  const client = await getSelfbotClient(token, userId);
  const guilds = [...client.guilds.cache.values()];

  let count = 0;
  for (const guild of guilds) {
    await guild.leave().catch(() => null);
    count++;
    await new Promise((r) => setTimeout(r, 500));
  }

  return count;
}

async function buildRichPresence(
  client: InstanceType<typeof SelfbotClient>,
  opts: RpcOptions
): Promise<InstanceType<typeof RichPresence>> {
  const typeMap: Record<string, number> = {
    playing: 0,
    streaming: 1,
    watching: 3,
  };

  const rp = new RichPresence(client)
    .setApplicationId(CLIENT_ID)
    .setName(opts.title || "ikiss")
    .setType(typeMap[opts.statusType] ?? 0);

  if (opts.subtitle) rp.setDetails(opts.subtitle);
  if (opts.detail) rp.setState(opts.detail);

  if (opts.statusType === "streaming") {
    rp.setURL(opts.customUrl || "https://ikiss.me");
  }

  if (opts.iconUrl) {
    try {
      const externalAssets = await RichPresence.getExternal(client, CLIENT_ID, opts.iconUrl);
      if (externalAssets[0]?.external_asset_path) {
        rp.setAssetsLargeImage(externalAssets[0].external_asset_path);
        const hoverText = opts.subtitle || opts.detail || "";
        if (hoverText) rp.setAssetsLargeText(hoverText);
      }
    } catch (e: any) {
      console.warn("[rpc] getExternal falhou, usando fallback:", e?.message);
      rp.setAssetsLargeImage(`mp:external/${opts.iconUrl}`);
      const hoverText = opts.subtitle || opts.detail || "";
      if (hoverText) rp.setAssetsLargeText(hoverText);
    }
  }

  if (opts.buttonLabel && opts.buttonUrl) {
    try {
      rp.addButton(opts.buttonLabel, opts.buttonUrl);
    } catch (e: any) {
      console.warn("[rpc] addButton falhou:", e?.message);
    }
  }

  return rp;
}

function stopRpcInterval(userId: string): void {
  const existing = rpcIntervals.get(userId);
  if (existing) {
    clearInterval(existing);
    rpcIntervals.delete(userId);
  }
}

function startRpcInterval(token: string, userId: string): void {
  stopRpcInterval(userId);

  const interval = setInterval(async () => {
    const opts = activeRpcOptions.get(userId);
    if (!opts) {
      stopRpcInterval(userId);
      return;
    }

    try {
      const client = await getSelfbotClient(token, userId);
      const rp = await buildRichPresence(client, opts);
      await client.user.setActivity(rp);
      console.log(`[rpc] keep-alive para ${userId}`);
    } catch (e: any) {
      console.warn(`[rpc] keep-alive falhou para ${userId}:`, e?.message);
    }
  }, RPC_REFRESH_MS);

  rpcIntervals.set(userId, interval);
}

export async function activateRpc(token: string, userId: string, opts: RpcOptions): Promise<void> {
  const client = await getSelfbotClient(token, userId);
  const rp = await buildRichPresence(client, opts);
  await client.user.setActivity(rp);

  activeRpcOptions.set(userId, opts);
  startRpcInterval(token, userId);
}

export async function deactivateRpc(token: string, userId: string): Promise<void> {
  stopRpcInterval(userId);
  activeRpcOptions.delete(userId);

  const client = await getSelfbotClient(token, userId);
  await client.user.setActivity(null);
}

export async function sendSelfDm(token: string, userId: string, content: string): Promise<void> {
  const client = await getSelfbotClient(token, userId);
  const dmChannel = await client.users.createDM(userId);
  await dmChannel.send(content);
}

export interface CloneResult {
  roles: number;
  categories: number;
  channels: number;
  errors: string[];
}

export async function cloneServer(
  token: string,
  userId: string,
  sourceGuildId: string,
  targetGuildId: string
): Promise<CloneResult> {
  const client = await getSelfbotClient(token, userId);

  const source = client.guilds.cache.get(sourceGuildId);
  if (!source) throw new Error(`servidor de origem \`${sourceGuildId}\` não encontrado — certifique-se de estar nele`);

  const target = client.guilds.cache.get(targetGuildId);
  if (!target) throw new Error(`servidor de destino \`${targetGuildId}\` não encontrado — certifique-se de estar nele`);

  await source.fetch();
  await target.fetch();

  const result: CloneResult = { roles: 0, categories: 0, channels: 0, errors: [] };
  const categoryMap = new Map<string, string>();

  // clonar cargos (exceto @everyone)
  const sourceRoles = [...source.roles.cache.values()]
    .filter((r: any) => r.name !== "@everyone")
    .sort((a: any, b: any) => a.position - b.position);

  for (const role of sourceRoles) {
    try {
      await target.roles.create({
        name: role.name,
        color: role.color,
        hoist: role.hoist,
        mentionable: role.mentionable,
        permissions: role.permissions,
      });
      result.roles++;
      await new Promise((r) => setTimeout(r, 300));
    } catch (e: any) {
      result.errors.push(`cargo "${role.name}": ${e.message}`);
    }
  }

  // clonar categorias primeiro
  const categories = [...source.channels.cache.values()].filter((c: any) => c.type === 4);
  for (const cat of categories) {
    try {
      const newCat = await target.channels.create({
        name: cat.name,
        type: 4,
      });
      categoryMap.set(cat.id, newCat.id);
      result.categories++;
      await new Promise((r) => setTimeout(r, 300));
    } catch (e: any) {
      result.errors.push(`categoria "${cat.name}": ${e.message}`);
    }
  }

  // clonar canais (texto e voz)
  const channels = [...source.channels.cache.values()].filter((c: any) => c.type === 0 || c.type === 2);
  for (const ch of channels) {
    try {
      const parentId = ch.parentId ? categoryMap.get(ch.parentId) : undefined;
      await target.channels.create({
        name: ch.name,
        type: ch.type,
        topic: ch.topic ?? undefined,
        nsfw: ch.nsfw ?? false,
        bitrate: ch.bitrate ?? undefined,
        userLimit: ch.userLimit ?? undefined,
        parent: parentId,
      });
      result.channels++;
      await new Promise((r) => setTimeout(r, 300));
    } catch (e: any) {
      result.errors.push(`canal "${ch.name}": ${e.message}`);
    }
  }

  return result;
}
