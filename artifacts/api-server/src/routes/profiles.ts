// @ts-nocheck
import { Router, type IRouter, type Request } from "express";
import Busboy from "busboy";
import { db, usersTable, profilesTable, profileLinksTable, profileViewsTable, profileLikesTable, followersTable, profileReportsTable, usernameRedirectsTable } from "@workspace/db";
import { eq, and, sql, gt } from "drizzle-orm";
import { UpdateProfileBody, ConnectDiscordBody, ConnectMusicBody, AddProfileLinkBody, UpdateProfileLinkBody, UpdateProfileLinkParams, DeleteProfileLinkParams } from "@workspace/api-zod";
import { requireAuth, optionalAuth } from "../lib/auth";
import { fetchLastfmNowPlaying } from "./music";
import { parseDataUri, uploadBuffer, ALLOWED_UPLOAD_MIMES } from "../lib/r2";

const UPLOAD_PREFIXES = new Set(["avatars", "banners", "backgrounds", "music", "icons", "stories", "publications", "gallery"]);
const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;

async function maybeUploadDataUri(value: string | undefined, prefix: string): Promise<string | undefined> {
  if (value === undefined) return undefined;
  if (!value.startsWith("data:")) return value;
  const parsed = parseDataUri(value);
  if (!parsed) return value;
  if (!process.env.R2_BUCKET || !process.env.R2_ACCESS_KEY_ID) return value;
  try {
    return await uploadBuffer({ buffer: parsed.buffer, mime: parsed.mime, prefix });
  } catch (e) {
    console.error("[r2] upload failed, keeping data URI:", (e as Error).message);
    return value;
  }
}

function normalizeLinkUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  let candidate = trimmed;
  if (!/^https?:\/\//i.test(candidate)) {
    candidate = "https://" + candidate.replace(/^\/+/, "");
  }
  try {
    const u = new URL(candidate);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    if (!u.hostname || !u.hostname.includes(".")) return null;
    return u.toString();
  } catch {
    return null;
  }
}

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

class TtlCache<T> {
  private store = new Map<string, CacheEntry<T>>();

  get(key: string): T | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return undefined;
    }
    return entry.data;
  }

  set(key: string, data: T, ttlMs: number) {
    this.store.set(key, { data, expiresAt: Date.now() + ttlMs });
  }

  delete(key: string) {
    this.store.delete(key);
  }
}

const profileCache = new TtlCache<any>();
const nowPlayingCache = new TtlCache<any>();
const PROFILE_TTL_MS = 120_000;
const NOW_PLAYING_TTL_MS = 30_000;
const NOW_PLAYING_REFRESHING = new Set<string>();

const userIdToUsername = new Map<number, string>();

function invalidateProfileCacheByUserId(userId: number) {
  const username = userIdToUsername.get(userId);
  if (username) {
    profileCache.delete(`profile:${username}`);
  }
}

function getClientIp(req: Request): string {
  const forwarded = req.headers["x-forwarded-for"];
  const raw = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  return (raw?.split(",")[0] || req.socket.remoteAddress || "unknown").trim();
}

const router: IRouter = Router();

const DEPRECATED_DASHBOARD_BG_COLORS = new Set<string>(["gradient:rosa"]);

function normalizeDashboardBgColor(raw: string | null | undefined): string {
  const s = (raw ?? "").trim();
  if (!s) return "#000000";
  if (DEPRECATED_DASHBOARD_BG_COLORS.has(s)) return "#000000";
  return s;
}

async function persistDeprecatedDashboardBg(userId: number, profile: any) {
  const v = profile?.dashboardBgColor;
  if (!v) return profile;
  const next = normalizeDashboardBgColor(v);
  if (next === v) return profile;
  const [migrated] = await db
    .update(profilesTable)
    .set({ dashboardBgColor: next })
    .where(eq(profilesTable.userId, userId))
    .returning();
  return migrated ?? profile;
}

function formatProfile(
  user: { id: number; username: string; displayName: string | null; avatarUrl: string | null },
  profile: any,
  links: Array<{ id: number; platform: string; label: string; url: string; iconUrl: string | null; sortOrder: number }>
) {
  return {
    id: profile.id,
    userId: profile.userId,
    username: user.username,
    displayName: user.displayName,
    bio: profile.bio,
    avatarUrl: user.avatarUrl,
    bannerUrl: profile.bannerUrl,
    backgroundUrl: profile.backgroundUrl,
    accentColor: profile.accentColor,
    backgroundOpacity: profile.backgroundOpacity,
    backgroundBlur: profile.backgroundBlur,
    backgroundType: profile.backgroundType,
    glowColor: profile.glowColor,
    nameBorderOpacity: profile.nameBorderOpacity,
    cursorStyle: profile.cursorStyle,
    musicUrl: profile.musicUrl,
    musicTitle: profile.musicTitle,
    musicIconUrl: profile.musicIconUrl,
    musicPrivate: profile.musicPrivate,
    badges: profile.badges ?? [],
    particleEffect: profile.particleEffect,
    clickEffect: profile.clickEffect,
    fontFamily: profile.fontFamily,
    layoutStyle: profile.layoutStyle,
    typewriterTexts: profile.typewriterTexts ?? [],
    profileTitle: profile.profileTitle,
    showViews: profile.showViews,
    statusText: profile.statusText ?? null,
    statusEmoji: profile.statusEmoji ?? null,
    statusColor: profile.statusColor ?? null,
    statusUpdatedAt: profile.statusUpdatedAt ? profile.statusUpdatedAt.toISOString() : null,
    statusExpiresAt: profile.statusExpiresAt ? profile.statusExpiresAt.toISOString() : null,
    links: links.map(l => ({
      id: l.id,
      platform: l.platform,
      label: l.label,
      url: l.url,
      iconUrl: l.iconUrl,
      sortOrder: l.sortOrder,
    })),
    discordConnected: !!profile.discordUserId,
    discordUserId: profile.discordUserId,
    discordUsername: profile.discordUsername,
    discordAvatarUrl: profile.discordAvatarUrl,
    discordStatus: profile.discordStatus,
    discordActivity: profile.discordActivity,
    discordStatusEmoji: profile.discordStatusEmoji,
    discordNitro: profile.discordNitro,
    discordBoost: profile.discordBoost,
    showDiscordAvatar: profile.showDiscordAvatar !== false,
    showDiscordPresence: profile.showDiscordPresence !== false,
    musicConnected: profile.musicConnected === "true",
    musicService: profile.musicService,
    musicUsername: profile.musicUsername,
    followersCount: profile.followersCount,
    followingCount: profile.followingCount,
    likesCount: profile.likesCount,
    viewsCount: profile.viewsCount,
    dashboardBgColor: normalizeDashboardBgColor(profile.dashboardBgColor),
    createdAt: profile.createdAt.toISOString(),
  };
}

router.get("/profile", requireAuth, async (req, res): Promise<void> => {
  const userId = req.user!.userId;

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  let [profile] = await db.select().from(profilesTable).where(eq(profilesTable.userId, userId)).limit(1);
  if (!profile) {
    [profile] = await db.insert(profilesTable).values({ userId, badges: [] }).returning();
  }

  profile = await persistDeprecatedDashboardBg(userId, profile);

  const links = await db.select().from(profileLinksTable).where(eq(profileLinksTable.profileId, profile.id)).orderBy(profileLinksTable.sortOrder);

  res.json(formatProfile(user, profile, links));
});

router.patch("/profile", requireAuth, async (req, res): Promise<void> => {
  const userId = req.user!.userId;
  const parsed = UpdateProfileBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const {
    displayName, bio, avatarUrl, bannerUrl, backgroundUrl,
    accentColor, backgroundOpacity, backgroundBlur, backgroundType,
    glowColor, nameBorderOpacity, cursorStyle, musicUrl, musicTitle, musicIconUrl, musicPrivate, badges,
    particleEffect, clickEffect, fontFamily, layoutStyle,
    typewriterTexts, profileTitle, showViews, showDiscordAvatar, showDiscordPresence,
  } = parsed.data;

  const resolvedAvatarUrl = await maybeUploadDataUri(avatarUrl, `avatars/${userId}`);
  const resolvedBannerUrl = await maybeUploadDataUri(bannerUrl, `banners/${userId}`);
  const resolvedBackgroundUrl = await maybeUploadDataUri(backgroundUrl, `backgrounds/${userId}`);

  const userUpdates = {
    ...(displayName !== undefined ? { displayName } : {}),
    ...(resolvedAvatarUrl !== undefined ? { avatarUrl: resolvedAvatarUrl } : {}),
  };

  if (Object.keys(userUpdates).length > 0) {
    await db.update(usersTable).set(userUpdates).where(eq(usersTable.id, userId));
  }

  const [profile] = await db.select().from(profilesTable).where(eq(profilesTable.userId, userId)).limit(1);

  if (!profile) {
    res.status(404).json({ error: "Profile not found" });
    return;
  }

  const [updated] = await db.update(profilesTable).set({
    ...(bio !== undefined ? { bio } : {}),
    ...(resolvedBannerUrl !== undefined ? { bannerUrl: resolvedBannerUrl } : {}),
    ...(resolvedBackgroundUrl !== undefined ? { backgroundUrl: resolvedBackgroundUrl } : {}),
    ...(accentColor !== undefined ? { accentColor } : {}),
    ...(backgroundOpacity !== undefined ? { backgroundOpacity } : {}),
    ...(backgroundBlur !== undefined ? { backgroundBlur } : {}),
    ...(backgroundType !== undefined ? { backgroundType } : {}),
    ...(glowColor !== undefined ? { glowColor } : {}),
    ...(nameBorderOpacity !== undefined && nameBorderOpacity !== null ? { nameBorderOpacity } : {}),
    ...(cursorStyle !== undefined ? { cursorStyle } : {}),
    ...(musicUrl !== undefined ? { musicUrl } : {}),
    ...(musicTitle !== undefined ? { musicTitle } : {}),
    ...(musicIconUrl !== undefined ? { musicIconUrl } : {}),
    ...(musicPrivate !== undefined ? { musicPrivate } : {}),
    ...(badges !== undefined ? { badges } : {}),
    ...(particleEffect !== undefined ? { particleEffect } : {}),
    ...(clickEffect !== undefined ? { clickEffect } : {}),
    ...(fontFamily !== undefined ? { fontFamily } : {}),
    ...(layoutStyle !== undefined ? { layoutStyle } : {}),
    ...(typewriterTexts !== undefined ? { typewriterTexts } : {}),
    ...(profileTitle !== undefined ? { profileTitle } : {}),
    ...(showViews !== undefined ? { showViews } : {}),
    ...(showDiscordAvatar !== undefined ? { showDiscordAvatar } : {}),
    ...(showDiscordPresence !== undefined ? { showDiscordPresence } : {}),
    ...((req.body as any).dashboardBgColor !== undefined
      ? { dashboardBgColor: normalizeDashboardBgColor(String((req.body as any).dashboardBgColor)) }
      : {}),
  }).where(eq(profilesTable.userId, userId)).returning();

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  const links = await db.select().from(profileLinksTable).where(eq(profileLinksTable.profileId, profile.id)).orderBy(profileLinksTable.sortOrder);

  profileCache.delete(`profile:${user.username}`);

  res.json(formatProfile(user, updated, links));
});

// PATCH /profile/status — Instagram-Notes-style status bubble
// body: { statusText?: string|null, statusEmoji?: string|null, statusColor?: string|null, statusExpiresAt?: string|null }
// To clear: send statusText: null or empty string.
router.patch("/profile/status", requireAuth, async (req, res): Promise<void> => {
  const userId = req.user!.userId;
  const body: any = req.body || {};

  const rawText = body.statusText;
  const text = rawText == null ? null : String(rawText).trim().slice(0, 60);
  const emoji = body.statusEmoji == null ? null : String(body.statusEmoji).trim().slice(0, 8) || null;
  const color = body.statusColor == null ? null : String(body.statusColor).trim().slice(0, 32) || null;

  let expiresAt: Date | null = null;
  if (body.statusExpiresAt) {
    const d = new Date(body.statusExpiresAt);
    if (!Number.isNaN(d.getTime())) expiresAt = d;
  }

  const clearing = !text;

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const [profile] = await db.select().from(profilesTable).where(eq(profilesTable.userId, userId)).limit(1);
  if (!profile) {
    res.status(404).json({ error: "Profile not found" });
    return;
  }

  const [updated] = await db.update(profilesTable).set(
    clearing
      ? {
          statusText: null,
          statusEmoji: null,
          statusColor: null,
          statusUpdatedAt: null,
          statusExpiresAt: null,
        }
      : {
          statusText: text,
          statusEmoji: emoji,
          statusColor: color,
          statusUpdatedAt: new Date(),
          statusExpiresAt: expiresAt,
        },
  ).where(eq(profilesTable.userId, userId)).returning();

  profileCache.delete(`profile:${user.username}`);

  res.json({
    statusText: updated.statusText,
    statusEmoji: updated.statusEmoji,
    statusColor: updated.statusColor,
    statusUpdatedAt: updated.statusUpdatedAt ? updated.statusUpdatedAt.toISOString() : null,
    statusExpiresAt: updated.statusExpiresAt ? updated.statusExpiresAt.toISOString() : null,
  });
});

router.post("/profile/upload", requireAuth, async (req, res): Promise<void> => {
  const userId = req.user!.userId;

  if (!process.env.R2_BUCKET || !process.env.R2_ACCESS_KEY_ID) {
    res.status(503).json({ error: "Upload de arquivos indisponível no momento." });
    return;
  }

  const contentType = req.headers["content-type"] || "";
  if (!contentType.toLowerCase().startsWith("multipart/form-data")) {
    res.status(400).json({ error: "Envio deve ser multipart/form-data." });
    return;
  }

  const rawPrefix = String((req.query.prefix as string | undefined) || "uploads").toLowerCase();
  const prefixBase = UPLOAD_PREFIXES.has(rawPrefix) ? rawPrefix : "uploads";
  const prefix = `${prefixBase}/${userId}`;

  let bb: ReturnType<typeof Busboy>;
  try {
    bb = Busboy({ headers: req.headers, limits: { files: 1, fileSize: MAX_UPLOAD_BYTES } });
  } catch (e) {
    res.status(400).json({ error: "Não foi possível processar o upload." });
    return;
  }

  let responded = false;
  let fileReceived = false;
  let uploadInFlight: Promise<void> | null = null;

  const fail = (status: number, message: string) => {
    if (responded) return;
    responded = true;
    req.unpipe(bb);
    res.status(status).json({ error: message });
  };

  bb.on("file", (_name, fileStream, info) => {
    fileReceived = true;
    const mime = (info.mimeType || "application/octet-stream").toLowerCase();
    if (!ALLOWED_UPLOAD_MIMES.has(mime)) {
      fileStream.resume();
      fail(415, `Tipo de arquivo não permitido: ${mime}`);
      return;
    }

    const chunks: Buffer[] = [];
    let total = 0;
    let truncated = false;

    fileStream.on("data", (chunk: Buffer) => {
      total += chunk.length;
      if (total > MAX_UPLOAD_BYTES) {
        truncated = true;
        return;
      }
      chunks.push(chunk);
    });

    fileStream.on("limit", () => {
      truncated = true;
    });

    fileStream.on("end", () => {
      if (responded) return;
      if (truncated) {
        fail(413, `Arquivo excede o limite de ${MAX_UPLOAD_BYTES / (1024 * 1024)}MB.`);
        return;
      }
      uploadInFlight = (async () => {
        try {
          const url = await uploadBuffer({ buffer: Buffer.concat(chunks), mime, prefix });
          if (responded) return;
          responded = true;
          res.json({ url });
        } catch (e) {
          console.error("[upload] r2 failed:", (e as Error).message);
          fail(500, "Falha ao enviar para o armazenamento.");
        }
      })();
    });

    fileStream.on("error", (err) => {
      console.error("[upload] file stream error:", err);
      fail(500, "Erro ao ler o arquivo.");
    });
  });

  bb.on("error", (err) => {
    console.error("[upload] busboy error:", err);
    fail(400, "Erro no envio do arquivo.");
  });

  // Busboy is a Writable stream — `finish` fires once the entire request body
  // has been parsed. By this point, the synchronous portion of every `file`
  // handler has already run, so `fileReceived` is reliable.
  bb.on("finish", async () => {
    if (responded) return;
    if (!fileReceived) {
      fail(400, "Nenhum arquivo enviado.");
      return;
    }
    // A file was received and an async upload may still be in flight.
    // Await it so we don't fall through and accidentally leave the request hanging.
    if (uploadInFlight) {
      try { await uploadInFlight; } catch { /* fail() already handled */ }
    }
  });

  req.pipe(bb);
});

router.post("/profile/links", requireAuth, async (req, res): Promise<void> => {
  const userId = req.user!.userId;
  const parsed = AddProfileLinkBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [profile] = await db.select().from(profilesTable).where(eq(profilesTable.userId, userId)).limit(1);
  if (!profile) {
    res.status(404).json({ error: "Profile not found" });
    return;
  }

  const normalizedUrl = normalizeLinkUrl(parsed.data.url);
  if (!normalizedUrl) {
    res.status(400).json({ error: "URL inválida" });
    return;
  }

  const [link] = await db.insert(profileLinksTable).values({
    profileId: profile.id,
    platform: parsed.data.platform,
    label: parsed.data.label,
    url: normalizedUrl,
    iconUrl: parsed.data.iconUrl ?? null,
    sortOrder: parsed.data.sortOrder ?? 0,
  }).returning();

  invalidateProfileCacheByUserId(userId);

  res.status(201).json({
    id: link.id,
    platform: link.platform,
    label: link.label,
    url: link.url,
    iconUrl: link.iconUrl,
    sortOrder: link.sortOrder,
  });
});

router.patch("/profile/links/:linkId", requireAuth, async (req, res): Promise<void> => {
  const userId = req.user!.userId;

  const rawId = Array.isArray(req.params.linkId) ? req.params.linkId[0] : req.params.linkId;
  const params = UpdateProfileLinkParams.safeParse({ linkId: parseInt(rawId, 10) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateProfileLinkBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [profile] = await db.select().from(profilesTable).where(eq(profilesTable.userId, userId)).limit(1);
  if (!profile) {
    res.status(404).json({ error: "Profile not found" });
    return;
  }

  let normalizedUrl: string | undefined;
  if (parsed.data.url !== undefined) {
    const n = normalizeLinkUrl(parsed.data.url);
    if (!n) {
      res.status(400).json({ error: "URL inválida" });
      return;
    }
    normalizedUrl = n;
  }

  const [link] = await db.update(profileLinksTable).set({
    ...(parsed.data.platform !== undefined ? { platform: parsed.data.platform } : {}),
    ...(parsed.data.label !== undefined ? { label: parsed.data.label } : {}),
    ...(normalizedUrl !== undefined ? { url: normalizedUrl } : {}),
    ...(parsed.data.iconUrl !== undefined ? { iconUrl: parsed.data.iconUrl } : {}),
    ...(parsed.data.sortOrder !== undefined ? { sortOrder: parsed.data.sortOrder } : {}),
  }).where(and(eq(profileLinksTable.id, params.data.linkId), eq(profileLinksTable.profileId, profile.id))).returning();

  if (!link) {
    res.status(404).json({ error: "Link not found" });
    return;
  }

  invalidateProfileCacheByUserId(userId);

  res.json({
    id: link.id,
    platform: link.platform,
    label: link.label,
    url: link.url,
    iconUrl: link.iconUrl,
    sortOrder: link.sortOrder,
  });
});

router.delete("/profile/links/:linkId", requireAuth, async (req, res): Promise<void> => {
  const userId = req.user!.userId;

  const rawId = Array.isArray(req.params.linkId) ? req.params.linkId[0] : req.params.linkId;
  const params = DeleteProfileLinkParams.safeParse({ linkId: parseInt(rawId, 10) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [profile] = await db.select().from(profilesTable).where(eq(profilesTable.userId, userId)).limit(1);
  if (!profile) {
    res.status(404).json({ error: "Profile not found" });
    return;
  }

  await db.delete(profileLinksTable).where(and(eq(profileLinksTable.id, params.data.linkId), eq(profileLinksTable.profileId, profile.id)));

  invalidateProfileCacheByUserId(userId);

  res.sendStatus(204);
});

router.post("/profile/discord", requireAuth, async (req, res): Promise<void> => {
  const userId = req.user!.userId;
  const parsed = ConnectDiscordBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [profile] = await db.update(profilesTable).set({
    discordUserId: parsed.data.discordUserId,
    discordUsername: parsed.data.discordUsername,
    discordAvatarUrl: parsed.data.discordAvatarUrl ?? null,
    discordStatus: parsed.data.discordStatus ?? null,
    discordActivity: parsed.data.discordActivity ?? null,
    discordStatusEmoji: parsed.data.discordStatusEmoji ?? null,
    discordNitro: parsed.data.discordNitro ?? false,
    discordBoost: parsed.data.discordBoost ?? false,
  }).where(eq(profilesTable.userId, userId)).returning();

  invalidateProfileCacheByUserId(userId);

  res.json({
    connected: true,
    discordUserId: profile.discordUserId,
    discordUsername: profile.discordUsername,
    discordAvatarUrl: profile.discordAvatarUrl,
    discordStatus: profile.discordStatus,
    discordActivity: profile.discordActivity,
    discordStatusEmoji: profile.discordStatusEmoji,
    discordNitro: profile.discordNitro,
    discordBoost: profile.discordBoost,
  });
});

router.delete("/profile/discord", requireAuth, async (req, res): Promise<void> => {
  const userId = req.user!.userId;

  await db.update(profilesTable).set({
    discordUserId: null,
    discordUsername: null,
    discordAvatarUrl: null,
    discordStatus: null,
    discordActivity: null,
    discordStatusEmoji: null,
    discordNitro: false,
    discordBoost: false,
  }).where(eq(profilesTable.userId, userId));

  invalidateProfileCacheByUserId(userId);

  res.json({ success: true, message: "Discord disconnected" });
});

router.get("/profile/discord/status", requireAuth, async (req, res): Promise<void> => {
  const userId = req.user!.userId;
  const [profile] = await db.select().from(profilesTable).where(eq(profilesTable.userId, userId)).limit(1);

  if (!profile) {
    res.json({ connected: false });
    return;
  }

  res.json({
    connected: !!profile.discordUserId,
    discordUserId: profile.discordUserId,
    discordUsername: profile.discordUsername,
    discordAvatarUrl: profile.discordAvatarUrl,
    discordStatus: profile.discordStatus,
    discordActivity: profile.discordActivity,
    discordStatusEmoji: profile.discordStatusEmoji,
    discordNitro: profile.discordNitro,
    discordBoost: profile.discordBoost,
  });
});

router.get("/users/:username", optionalAuth, async (req, res): Promise<void> => {
  const rawUsername = (Array.isArray(req.params.username) ? req.params.username[0] : req.params.username).toLowerCase();
  const currentUserId = req.user?.userId;
  const cacheKey = `profile:${rawUsername}`;

  let cachedBase = profileCache.get(cacheKey);
  if (cachedBase?.dashboardBgColor && normalizeDashboardBgColor(cachedBase.dashboardBgColor) !== cachedBase.dashboardBgColor) {
    profileCache.delete(cacheKey);
    cachedBase = undefined;
  }

  let baseData: any;
  if (cachedBase) {
    baseData = cachedBase;
  } else {
    let [user] = await db.select().from(usersTable).where(eq(usersTable.username, rawUsername)).limit(1);

    // Old username fallback: if no live user holds this handle, look up the
    // username_redirects table and signal the rename to the client.
    //
    // We respond with 410 Gone (not 301) on purpose: browsers automatically
    // try to follow 3xx responses in fetch(), and when the response has no
    // Location header the request fails with a network error — the JSON body
    // never reaches the SPA, so the client-side redirect can't run. 410 is
    // returned untouched and lets the SPA inspect `data.error === "username_renamed"`
    // and route to `data.redirectTo`.
    if (!user) {
      const [redirect] = await db
        .select({ targetUserId: usernameRedirectsTable.targetUserId })
        .from(usernameRedirectsTable)
        .where(eq(usernameRedirectsTable.oldUsername, rawUsername))
        .limit(1);
      if (redirect) {
        const [target] = await db.select().from(usersTable).where(eq(usersTable.id, redirect.targetUserId)).limit(1);
        if (target && !target.banned) {
          res.status(410).json({
            error: "username_renamed",
            redirectTo: target.username,
            username: target.username,
          });
          return;
        }
      }
    }

    if (!user || user.banned) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    let [profile] = await db.select().from(profilesTable).where(eq(profilesTable.userId, user.id)).limit(1);

    if (!profile) {
      res.status(404).json({ error: "Profile not found" });
      return;
    }

    const prevBg = profile.dashboardBgColor;
    profile = await persistDeprecatedDashboardBg(user.id, profile);
    if (prevBg != null && prevBg !== profile.dashboardBgColor) {
      profileCache.delete(cacheKey);
    }

    const links = await db.select().from(profileLinksTable).where(eq(profileLinksTable.profileId, profile.id)).orderBy(profileLinksTable.sortOrder);

    baseData = formatProfile(user, profile, links);
    baseData._musicConfig = {
      musicPrivate: profile.musicPrivate,
      musicConnected: profile.musicConnected,
      musicService: profile.musicService,
      musicUsername: profile.musicUsername,
    };

    profileCache.set(cacheKey, baseData, PROFILE_TTL_MS);
    userIdToUsername.set(user.id, user.username);
  }

  const [isFollowing, hasLiked, nowPlaying] = await Promise.all([
    currentUserId
      ? db.select({ id: followersTable.followerId }).from(followersTable)
          .where(and(eq(followersTable.followerId, currentUserId), eq(followersTable.followingId, baseData.userId)))
          .limit(1)
          .then(r => r.length > 0)
      : Promise.resolve(false),

    currentUserId
      ? db.select({ id: profileLikesTable.userId }).from(profileLikesTable)
          .where(and(eq(profileLikesTable.userId, currentUserId), eq(profileLikesTable.profileUserId, baseData.userId)))
          .limit(1)
          .then(r => r.length > 0)
      : Promise.resolve(false),

    ((): Promise<any> => {
      const mc = baseData._musicConfig;
      if (!mc?.musicPrivate && mc?.musicConnected === "true" && mc?.musicService === "lastfm" && mc?.musicUsername) {
        const npKey = `np:${mc.musicUsername}`;
        const cached = nowPlayingCache.get(npKey);
        // Always return immediately — never block the profile response.
        // If cache is missing/stale, refresh in background (single-flight per username).
        if (!NOW_PLAYING_REFRESHING.has(npKey)) {
          NOW_PLAYING_REFRESHING.add(npKey);
          fetchLastfmNowPlaying(mc.musicUsername)
            .then(result => nowPlayingCache.set(npKey, result, NOW_PLAYING_TTL_MS))
            .catch(() => {})
            .finally(() => NOW_PLAYING_REFRESHING.delete(npKey));
        }
        return Promise.resolve(cached ?? { isPlaying: false });
      }
      return Promise.resolve({ isPlaying: false });
    })(),
  ]);

  const { _musicConfig: _, ...profileData } = baseData;

  if (currentUserId) {
    res.set("Cache-Control", "private, max-age=0, no-store");
  } else {
    res.set("Cache-Control", "public, max-age=0, s-maxage=60, stale-while-revalidate=300");
  }

  res.json({
    ...profileData,
    nowPlaying,
    isFollowing,
    hasLiked,
  });
});

router.post("/users/:username/report", optionalAuth, async (req, res): Promise<void> => {
  const rawUsername = Array.isArray(req.params.username) ? req.params.username[0] : req.params.username;
  const { reason, details } = req.body as { reason?: string; details?: string };

  if (!reason || typeof reason !== "string" || reason.trim().length === 0) {
    res.status(400).json({ error: "Motivo da denúncia é obrigatório." });
    return;
  }

  const [targetUser] = await db.select().from(usersTable).where(eq(usersTable.username, rawUsername)).limit(1);
  if (!targetUser) {
    res.status(404).json({ error: "Usuário não encontrado." });
    return;
  }

  const ip = getClientIp(req);
  const windowStart = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const [recentReport] = await db
    .select({ id: profileReportsTable.id })
    .from(profileReportsTable)
    .where(
      and(
        eq(profileReportsTable.reportedUserId, targetUser.id),
        eq(profileReportsTable.reporterIp, ip),
        gt(profileReportsTable.createdAt, windowStart)
      )
    )
    .limit(1);

  if (recentReport) {
    res.status(429).json({ error: "Você já denunciou este perfil recentemente." });
    return;
  }

  await db.insert(profileReportsTable).values({
    reporterUserId: req.user?.userId ?? null,
    reportedUserId: targetUser.id,
    reason: reason.trim().slice(0, 200),
    details: details?.trim().slice(0, 1000) ?? null,
    reporterIp: ip,
    status: "pending",
  });

  res.json({ success: true, message: "Denúncia recebida. Nossa equipe irá analisar." });
});

router.post("/profile/discord/lanyard", requireAuth, async (req, res): Promise<void> => {
  const userId = req.user!.userId;
  const { discordUserId } = req.body as { discordUserId?: string };

  if (!discordUserId || typeof discordUserId !== "string" || !/^\d{17,20}$/.test(discordUserId.trim())) {
    res.status(400).json({ error: "Discord User ID inválido. Deve ser um número com 17–20 dígitos." });
    return;
  }

  const uid = discordUserId.trim();

  try {
    const lanyardRes = await fetch(`https://api.lanyard.rest/v1/users/${uid}`, {
      headers: { "User-Agent": "ikiss.me/1.0" },
      signal: AbortSignal.timeout(8000),
    });

    if (!lanyardRes.ok) {
      if (lanyardRes.status === 404) {
        res.status(404).json({ error: "Usuário não encontrado no Lanyard. Entre no servidor discord.gg/lanyard primeiro." });
      } else {
        res.status(502).json({ error: "Lanyard indisponível. Tente novamente." });
      }
      return;
    }

    const lanyardData = await lanyardRes.json() as any;
    if (!lanyardData.success) {
      res.status(404).json({ error: "Usuário não encontrado no Lanyard." });
      return;
    }

    const data = lanyardData.data;
    const discordUser = data.discord_user;
    const avatarHash = discordUser?.avatar;
    const discordAvatarUrl = avatarHash
      ? `https://cdn.discordapp.com/avatars/${uid}/${avatarHash}.${avatarHash.startsWith("a_") ? "gif" : "png"}?size=128`
      : null;

    const activityName = data.activities?.[0]?.name || null;
    const statusEmoji = data.activities?.find((a: any) => a.type === 4)?.emoji?.name || null;

    await db.update(profilesTable).set({
      discordUserId: uid,
      discordUsername: discordUser?.global_name || discordUser?.username || null,
      discordAvatarUrl,
      discordStatus: data.discord_status || "offline",
      discordActivity: activityName,
      discordStatusEmoji: statusEmoji,
      discordNitro: !!discordUser?.premium_type,
      discordBoost: false,
    }).where(eq(profilesTable.userId, userId));

    invalidateProfileCacheByUserId(userId);

    res.json({
      connected: true,
      discordUsername: discordUser?.global_name || discordUser?.username,
      discordAvatarUrl,
      discordStatus: data.discord_status || "offline",
      discordUserId: uid,
    });
  } catch (err: any) {
    if (err.name === "TimeoutError") {
      res.status(504).json({ error: "Lanyard demorou demais para responder." });
    } else {
      res.status(500).json({ error: "Erro ao conectar com Lanyard." });
    }
  }
});

export default router;
