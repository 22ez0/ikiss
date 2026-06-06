import { Router, type IRouter } from "express";
import { db, profilesTable, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth } from "../lib/auth.js";

const router: IRouter = Router();

const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID ?? "";
const DISCORD_CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET ?? "";
const DISCORD_REDIRECT_URI = process.env.DISCORD_REDIRECT_URI ?? "https://ikiss.me/";

const DISCORD_SCOPES = [
  "identify",
  "guilds.join",
  "rpc",
  "application_identities.write",
].join(" ");

router.get("/discord/auth/url", (_req, res): void => {
  const params = new URLSearchParams({
    client_id: DISCORD_CLIENT_ID,
    response_type: "code",
    redirect_uri: DISCORD_REDIRECT_URI,
    scope: DISCORD_SCOPES,
  });
  res.json({ url: `https://discord.com/oauth2/authorize?${params}` });
});

router.post("/discord/auth/callback", requireAuth, async (req, res): Promise<void> => {
  const { code } = req.body as { code?: string };
  if (!code) {
    res.status(400).json({ error: "código de autorização ausente" });
    return;
  }

  if (!DISCORD_CLIENT_SECRET) {
    res.status(503).json({ error: "DISCORD_CLIENT_SECRET não configurado no servidor" });
    return;
  }

  try {
    const tokenRes = await fetch("https://discord.com/api/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: DISCORD_CLIENT_ID,
        client_secret: DISCORD_CLIENT_SECRET,
        grant_type: "authorization_code",
        code,
        redirect_uri: DISCORD_REDIRECT_URI,
      }),
    });

    if (!tokenRes.ok) {
      const err = await tokenRes.text();
      console.error("[discord oauth] token exchange failed:", err);
      res.status(400).json({ error: "falha ao trocar código por token" });
      return;
    }

    const tokenData = await tokenRes.json() as {
      access_token: string;
      refresh_token: string;
      expires_in: number;
      token_type: string;
    };

    const userRes = await fetch("https://discord.com/api/users/@me", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });

    if (!userRes.ok) {
      res.status(400).json({ error: "falha ao buscar dados do usuário discord" });
      return;
    }

    const discordUser = await userRes.json() as {
      id: string;
      username: string;
      discriminator: string;
      avatar?: string;
      premium_type?: number;
    };

    const avatarUrl = discordUser.avatar
      ? `https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.${discordUser.avatar.startsWith("a_") ? "gif" : "png"}?size=256`
      : null;

    const discordUsername =
      discordUser.discriminator === "0"
        ? discordUser.username
        : `${discordUser.username}#${discordUser.discriminator}`;

    const userId = req.user!.userId;
    const expiresAt = new Date(Date.now() + tokenData.expires_in * 1000);

    await db
      .update(profilesTable)
      .set({
        discordUserId: discordUser.id,
        discordUsername,
        discordAvatarUrl: avatarUrl,
        discordNitro: (discordUser.premium_type ?? 0) > 0,
      })
      .where(eq(profilesTable.userId, userId));

    res.json({
      success: true,
      discord: {
        id: discordUser.id,
        username: discordUsername,
        avatarUrl,
        nitro: (discordUser.premium_type ?? 0) > 0,
      },
    });
  } catch (err) {
    console.error("[discord oauth]", err);
    res.status(500).json({ error: "erro interno ao conectar discord" });
  }
});

router.delete("/discord/auth/disconnect", requireAuth, async (req, res): Promise<void> => {
  const userId = req.user!.userId;
  await db
    .update(profilesTable)
    .set({
      discordUserId: null,
      discordUsername: null,
      discordAvatarUrl: null,
      discordNitro: false,
      discordBoost: false,
    })
    .where(eq(profilesTable.userId, userId));

  res.json({ success: true });
});

export default router;
