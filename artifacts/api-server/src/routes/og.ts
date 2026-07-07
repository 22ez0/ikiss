import { Router, type IRouter, type Request, type Response } from "express";
import { db, usersTable, profilesTable, usernameRedirectsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router: IRouter = Router();

const SITE_URL = "https://ikiss.me";
const API_URL = "https://api.ikiss.me";
const DEFAULT_IMAGE = `${SITE_URL}/opengraph.jpg`;

const RESERVED = new Set([
  "api", "health", "og", "favicon.ico", "favicon.png", "robots.txt",
  "sitemap.xml", "opengraph.jpg", "404.html",
  // Reserve bot so the OG catch-all never intercepts /api/bot routes.
  "bot",
  // Note: kept as lowercase — RESERVED is compared after rawUsername.toLowerCase()
  "cname",
]);

function esc(str: string) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

async function serveOgPage(username: string, res: Response): Promise<void> {
  const rawUsername = username.toLowerCase().trim();

  if (!rawUsername || RESERVED.has(rawUsername)) {
    res.redirect(302, SITE_URL);
    return;
  }

  try {
    let [user] = await db
      .select({
        id: usersTable.id,
        username: usersTable.username,
        displayName: usersTable.displayName,
        avatarUrl: usersTable.avatarUrl,
      })
      .from(usersTable)
      .where(eq(usersTable.username, rawUsername))
      .limit(1);

    // Old username fallback: render the OG card for the current owner so that
    // shared links keep their preview after a rename.
    if (!user) {
      const [redirect] = await db
        .select({ targetUserId: usernameRedirectsTable.targetUserId })
        .from(usernameRedirectsTable)
        .where(eq(usernameRedirectsTable.oldUsername, rawUsername))
        .limit(1);
      if (redirect) {
        const [target] = await db
          .select({
            id: usersTable.id,
            username: usersTable.username,
            displayName: usersTable.displayName,
            avatarUrl: usersTable.avatarUrl,
          })
          .from(usersTable)
          .where(eq(usersTable.id, redirect.targetUserId))
          .limit(1);
        if (target) user = target;
      }
    }

    if (!user) {
      res.redirect(302, SITE_URL);
      return;
    }

    const [profile] = await db
      .select({
        bannerUrl: profilesTable.bannerUrl,
        backgroundUrl: profilesTable.backgroundUrl,
        bio: profilesTable.bio,
        accentColor: profilesTable.accentColor,
        badges: profilesTable.badges,
      })
      .from(profilesTable)
      .where(eq(profilesTable.userId, user.id))
      .limit(1);

    const displayName = user.displayName || user.username;
    const bio = (profile?.bio || `Veja o perfil de @${user.username} na Ikiss`).slice(0, 200);
    const isUsableImage = (u: string | null | undefined): u is string =>
      !!u && !u.startsWith("data:") && !/\.(mp4|webm|mov|m4v)(\?|$)/i.test(u);
    const isGif = (u: string | null | undefined): u is string =>
      isUsableImage(u) && /\.gif(\?|$)/i.test(u);

    const rawBg = profile?.backgroundUrl;
    const rawBanner = profile?.bannerUrl;
    const rawAvatar = user.avatarUrl;

    const backgroundUrl = isUsableImage(rawBg) ? rawBg : null;
    const bannerUrl = isUsableImage(rawBanner) ? rawBanner : null;
    const avatarUrl = isUsableImage(rawAvatar) ? rawAvatar : DEFAULT_IMAGE;

    // Priority: any GIF (background > banner > avatar) wins over static images.
    // Without a GIF, fall back to banner first since it tends to be landscape
    // (matches the "@mataremos" preview style); then background, then avatar.
    const gifPick =
      (isGif(rawBg) && rawBg) ||
      (isGif(rawBanner) && rawBanner) ||
      (isGif(rawAvatar) && rawAvatar) ||
      null;
    const ogImageUrl = gifPick || bannerUrl || backgroundUrl || avatarUrl || DEFAULT_IMAGE;

    const profileUrl = `${SITE_URL}/${user.username}`;
    const accentColor = profile?.accentColor || "#ffffff";

    const badges = profile?.badges ?? [];
    const isVerifiedGold = badges.includes("verified_gold");
    const isVerified = isVerifiedGold || badges.includes("verified_white") || badges.includes("verified");
    const verifiedSymbol = isVerifiedGold ? " ✦" : isVerified ? " ✓" : "";

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=60, stale-while-revalidate=300");
    res.send(`<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>${esc(displayName)}${verifiedSymbol} — Ikiss</title>
  <meta name="description" content="${esc(bio)}"/>

  <meta property="og:type" content="profile"/>
  <meta property="og:url" content="${esc(profileUrl)}"/>
  <meta property="og:title" content="${esc(displayName)}${verifiedSymbol} (@${esc(user.username)}) — Ikiss"/>
  <meta property="og:description" content="${esc(bio)}"/>
  <meta property="og:image" content="${esc(ogImageUrl)}"/>
  <meta property="og:image:width" content="1200"/>
  <meta property="og:image:height" content="630"/>
  <meta property="og:site_name" content="Ikiss"/>
  <meta property="og:locale" content="pt_BR"/>

  <meta property="profile:username" content="${esc(user.username)}"/>

  <meta name="twitter:card" content="summary_large_image"/>
  <meta name="twitter:url" content="${esc(profileUrl)}"/>
  <meta name="twitter:title" content="${esc(displayName)}${verifiedSymbol} (@${esc(user.username)}) — Ikiss"/>
  <meta name="twitter:description" content="${esc(bio)}"/>
  <meta name="twitter:image" content="${esc(ogImageUrl)}"/>

  <link rel="canonical" href="${esc(profileUrl)}"/>
  <meta http-equiv="refresh" content="0; url=${esc(profileUrl)}"/>

  <style>
    body { margin: 0; background: #0a0a0a; color: #fff; font-family: Inter, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; flex-direction: column; gap: 16px; }
    .card { background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 16px; padding: 32px; text-align: center; max-width: 400px; width: 90%; }
    img.avatar { width: 80px; height: 80px; border-radius: 50%; object-fit: cover; border: 2px solid ${esc(accentColor)}; margin-bottom: 12px; }
    h1 { font-size: 1.4rem; margin: 0 0 4px; }
    p.username { color: ${esc(accentColor)}; font-size: 0.9rem; margin: 0 0 12px; }
    p.bio { font-size: 0.85rem; opacity: 0.7; margin: 0 0 20px; line-height: 1.5; }
    a.btn { display: inline-block; padding: 10px 24px; border: 1px solid ${esc(accentColor)}; border-radius: 999px; color: ${esc(accentColor)}; text-decoration: none; font-size: 0.9rem; font-weight: 600; }
  </style>
</head>
<body>
  <div class="card">
    ${avatarUrl !== DEFAULT_IMAGE ? `<img class="avatar" src="${esc(avatarUrl)}" alt="${esc(displayName)}" onerror="this.style.display='none'"/>` : ''}
    <h1>${esc(displayName)}</h1>
    <p class="username">@${esc(user.username)}</p>
    ${bio ? `<p class="bio">${esc(bio)}</p>` : ''}
    <a class="btn" href="${esc(profileUrl)}">Ver perfil na Ikiss</a>
  </div>
</body>
</html>`);
  } catch (err) {
    console.error("[og] failed to render profile page:", err instanceof Error ? err.message : err);
    res.redirect(302, SITE_URL);
  }
}

router.get("/og/:username", async (req, res): Promise<void> => {
  await serveOgPage(req.params.username || "", res);
});

router.get("/:username", async (req, res): Promise<void> => {
  const username = req.params.username || "";
  if (!username || !/^[a-zA-Z0-9_.]{1,30}$/.test(username)) {
    res.redirect(302, SITE_URL);
    return;
  }
  const ua = req.get("user-agent") || "";
  const isSocialBot = /facebookexternalhit|twitterbot|whatsapp|linkedinbot|slackbot|telegrambot|discordbot|pinterestbot|applebot|googlebot|bingbot|duckduckbot|ia_archiver|embedly|quora|outbrain|vkshare|viber|line\//i.test(ua);
  if (!isSocialBot) {
    res.redirect(302, `${SITE_URL}/${username}`);
    return;
  }
  await serveOgPage(username, res);
});

export { serveOgPage };
export default router;
