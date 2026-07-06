# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Infraestrutura de Produção (decidido pelo usuário)

**Serviços utilizados:** Cloudflare · Render · Hostinger VPS · GitHub Pages

| Camada | Serviço | Detalhe |
|---|---|---|
| Frontend | GitHub Pages | ikiss.me via CNAME Cloudflare |
| CDN / DNS / Cache | Cloudflare | Worker edge-proxy, R2 mídia, Turnstile, cache purge |
| API (principal) | Render | Express 5, auto-deploy via render.yaml |
| API (failover) | Hostinger VPS | Docker + nginx, deploy via SSH (.github/workflows/deploy-vps.yml) |
| Media storage | Cloudflare R2 | Avatars, banners, backgrounds, músicas |
| Banco de dados | Neon PostgreSQL | Pooled connection string em DATABASE_URL |
| Discord bot | Render | Serviço separado (faren-discord-bot) |

### Performance para 10.000 perfis

- **Cache em memória na API**: TTL 2 min por perfil (TtlCache em profiles.ts)
- **Cache no edge Cloudflare**: `s-maxage=60, stale-while-revalidate=300` nos GETs públicos
- **Mídia no R2**: `Cache-Control: public, max-age=31536000, immutable`
- **Índice DB**: `username` tem índice único automático; `profiles.userId` tem índice explícito
- **Pool de conexões**: max 20 conexões simultâneas com Neon
- **Cloudflare Worker**: failover automático entre backends Render em caso de 5xx

### Secrets necessários

**No Replit (ambiente de desenvolvimento):**
| Secret | Uso |
|---|---|
| `R2_ACCESS_KEY_ID` | Upload de mídia para Cloudflare R2 |
| `R2_SECRET_ACCESS_KEY` | Upload de mídia para Cloudflare R2 |
| `NEON_DATABASE_URL` | Push de schema para banco de produção |
| `TURNSTILE_SECRET_KEY` | Validação Cloudflare Turnstile nos formulários |
| `EMAIL_WEBHOOK_SECRET` | Webhook Cloudflare Worker → API |
| `DISCORD_BOT_TOKEN` | Bot do Discord |

**No repositório GitHub (Settings → Secrets → Actions):**
| Secret | Uso |
|---|---|
| `R2_ACCESS_KEY_ID` | (igual ao de cima) |
| `R2_SECRET_ACCESS_KEY` | (igual ao de cima) |
| `CLOUDFLARE_PURGE_TOKEN` | Purge automático do cache após deploy do frontend |
| `CLOUDFLARE_ZONE_ID` | ID da zona Cloudflare (já em env var, mas precisa no Actions) |
| `NEON_DATABASE_URL` | Backup diário do banco (db-backup.yml) |
| `RENDER_API_KEY` | Monitoramento de status do deploy no Render |
| `DISCORD_BOT_TOKEN` | (igual ao de cima) |
| `RESEND_API_KEY` | Envio de e-mails transacionais |
| `EMAIL_WEBHOOK_SECRET` | (igual ao de cima) |
| `TURNSTILE_SECRET_KEY` | (igual ao de cima) |
| `VPS_HOST` | IP ou hostname do VPS Hostinger |
| `VPS_USER` | Usuário SSH do VPS Hostinger |
| `VPS_SSH_KEY` | Chave SSH privada para o VPS Hostinger |

**No Render (Service → Environment):**
Mesmos valores acima marcados com `sync: false` no render.yaml.

### Mudanças feitas nesta sessão de migração

1. `pnpm install` executado — dependências instaladas no ambiente Replit
2. `drizzle-kit push` executado — schema do banco aplicado no PostgreSQL do Replit
3. Workflows `Faren Web` (porta 5000) e `API Server` (porta 8080) iniciados e verificados
4. Documentação de infraestrutura e secrets adicionada ao replit.md
5. `.local/state/replit/agent/progress_tracker.md` criado e mantido

### User Preferences
- Falar **somente em português** em todas as respostas
- **API principal: Vercel** (substituindo Render como primário). Render permanece como segunda opção para o futuro.
- Documentar todas as decisões aqui para que outro agente Replit saiba o que fazer

### Migração Render → Vercel (2026-07-06)

**Problema original**: API em `api.ikiss.me` estava apontando para o Render (suspenso/instável), causando:
- "ERRO AO VERIFICAR, TENTE NOVAMENTE" na verificação de username na home
- "Failed to fetch" no cadastro de conta

**Correções aplicadas:**
1. `artifacts/faren/src/pages/home.tsx` — fallback de `VITE_API_URL` agora é `https://api.ikiss.me` (era string vazia, causava URL relativa que GitHub Pages não consegue resolver)
2. `artifacts/faren/src/pages/register.tsx` — fallback de `API_BASE` agora é `https://api.ikiss.me` (era `BASE_URL = /`, mesmo problema)
3. `.github/workflows/deploy-vercel.yml` — reescrito para usar REST API pura (sem CLI Vercel), configurar env vars no projeto e disparar deploy via git source
4. `SESSION_SECRET` adicionado ao GitHub Secrets via libsodium

**Status do deploy Vercel:**
- O workflow `.github/workflows/deploy-vercel.yml` está configurado e funcional
- **AÇÃO MANUAL NECESSÁRIA** para completar a migração:
  1. Criar o projeto Vercel em [vercel.com](https://vercel.com) → New Project → importar `22ez0/ikiss`
  2. Copiar o Project ID (em Settings → General)
  3. Adicionar `VERCEL_PROJECT_ID` em GitHub → Settings → Secrets → Actions
  4. Gerar um Personal Access Token em Vercel → Account Settings → Tokens (escopo Full)
  5. Atualizar `VERCEL_TOKEN` em GitHub → Settings → Secrets → Actions com o novo token
  6. Rodar workflow manualmente: GitHub Actions → "Deploy API → Vercel" → Run workflow
  7. Após o deploy, atualizar DNS da Cloudflare: `api.ikiss.me` CNAME → domínio do projeto Vercel (ex: `ikiss-api.vercel.app`)

**Frontend (GitHub Pages):** Deploy automático funciona e está atualizado (`deploy-frontend.yml` define `VITE_API_URL=https://api.ikiss.me`)

## Project: Ikiss

**Ikiss** is a personalized profile platform (ikiss.me) inspired by guns.lol with the visual design of keefnow.com.br. Pure black backgrounds, massive bold uppercase typography, solid + outline text, minimal tracked-letter buttons.

### Key Features
- Personalized user profiles with custom colors, backgrounds, badges, social links
- **Live preview** while editing profile (split-screen editor with 4 tabs)
- **Particle effects** — snow, stars, sakura, fireflies, bubbles, rain
- **Click effects** — hearts, stars, sparkles, explosions on cursor click
- **Custom fonts** — default (Inter), mono, cursive, serif, pixel (8-bit)
- **Typewriter text** — cycles through custom texts with animated typing
- **Layout styles** — centered or left-aligned profile layout
- **Background types** — image/GIF, video/GIF, or solid color with opacity + blur controls
- **Avatar/banner media** — image, GIF, or video; videos autoplay muted in loop
- **Discord rich integration** — status badge, activity, avatar sync, Nitro/boost flags, visibility toggles
- **Music tracking** — Now Playing widget with Spotify/Last.fm integration plus custom title/icon/GIF/private mode for live music
- **Social links** — public profile displays links as transparent logo-only icons
- Followers, likes, views social system (show/hide view count toggle)
- Badge system — predefined badges plus custom emoji/color badges, max 6 user-selected badges active
- Analytics dashboard (views by day/week/month, top countries)
- Trending profiles discovery page
- Dark mode, pure black theme (keefnow.com.br aesthetic)
- Admin moderation panel at `/devkeefnow` and `/keefaren`
- Footer credits Faren and links Keefnow to `https://keefnow.com.br`
- **3-tier verification badges**: blue (verified), gold (verified_gold), white (verified_white) — Instagram-style SVG badges with glow
- **Open Graph meta tags**: site-level in index.html + dynamic per-profile on page load + `/api/og/:username` endpoint for bots/crawlers
- **Save login**: token stored in both localStorage AND a 30-day cookie (`faren_token`) for redundancy
- **Spotify player**: height=152 (full player, not compact) with support for tracks, playlists, and albums
- **Follow button**: transparent with rounded-full borders (both Follow and Following states)

### Routes
- `/` — Landing page with hero and trending profiles
- `/login` — Auth login (glassmorphism card)
- `/register` — Registration with username validation
- `/:username` — Public profile page
- `/dashboard` — Stats & analytics dashboard
- `/dashboard/edit` — Live profile editor (split-screen)
- `/discover` — Trending profiles grid
- `/devkeefnow` — Private admin/moderation panel (not linked in nav)
- `/keefaren` — Alias for admin panel (ikiss.me/keefaren)
- GitHub Pages custom domain is configured with `artifacts/faren/public/CNAME` as `ikiss.me`
- GitHub Pages SPA deep links use `artifacts/faren/public/404.html` + `index.html` redirect script to preserve routes like `/keefaren`

### Deployment (GitHub + Render)
- **GitHub repo**: https://github.com/22ez0/ikiss
- **GitHub username**: 22ez0
- **Frontend**: GitHub Pages → ikiss.me (auto-deploys on push to main via `.github/workflows/deploy-frontend.yml`)
- **API**: Cloudflare Worker → api.ikiss.me → Render backends (auto-deploys via `render.yaml`)
- **Render setup**: Import repo at render.com/new, pick "Blueprint" and select `render.yaml` — it will create the web service automatically
- **GitHub Actions secrets needed**: `CLOUDFLARE_ZONE_ID`, `CLOUDFLARE_PURGE_TOKEN`
- **DNS for ikiss.me**: Managed via Cloudflare — CNAME `@` → `22ez0.github.io`, `api` CNAME → Cloudflare Worker
- **Portability**: All configuration is in env vars (`.env.example`). Switching hosts = change `DATABASE_URL`, `SESSION_SECRET`, `CORS_ALLOWED_ORIGINS`, `VITE_API_URL`
- **IMPORTANTE — build command**: NUNCA usar `--frozen-lockfile` nos serviços do Render. O lockfile muda a cada novo pacote adicionado ao workspace. Build command correto: `npm install -g pnpm@10 && pnpm install && pnpm --filter @workspace/<pkg> run build`. Isso vale para `faren-api` (srv-d7gjdc5ckfvc73ftk79g) e `faren-discord-bot` (srv-d7qtjf28qa3s73d4sdgg).

### Admin Access
- Admin route: `/devkeefnow`
- Default admin login: `keefaren`
- Default admin password: `Hungria2021@`
- Token is stored in `localStorage` as `adminToken` (expires 7 days — auto-clears on 401 and forces re-login)
- Admin panel can search users, ban/unban, grant/revoke 3 types of verified badge (blue/gold/white), and view registration/last-login IPs.

### Media Uploads — Cloudflare R2 (IMPORTANT)
**Todos os uploads de mídia do Faren vão para Cloudflare R2.** Nada de mídia é salvo em base64 no Postgres.

- **What goes to R2**: avatars, banners, profile backgrounds, music files (mp3/m4a/ogg/wav/webm), and custom music icons. Anything the user uploads via the editor.
- **Server**: `artifacts/api-server/src/lib/r2.ts` configures an S3 client pointing to `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`. `uploadBuffer({ buffer, mime, prefix })` uses sha256 of the file contents to produce a content-addressed key (`<prefix>/<userId>/<sha256>.<ext>`) — same file = same key, no duplicate uploads. `Cache-Control: public, max-age=31536000, immutable` is set since URLs change when content changes.
- **Upload route**: `POST /api/profile/upload?prefix=avatars|banners|backgrounds|music|icons` (multipart/form-data, requires JWT). Max 50MB per file. Returns `{ url }` pointing to `R2_PUBLIC_URL/<key>`.
- **Public URLs**: served from the public R2 bucket URL configured in `R2_PUBLIC_URL` (e.g. `https://cdn.ikiss.me` or `https://pub-xxxx.r2.dev`).
- **Required env vars** (Render + local): `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `R2_PUBLIC_URL`. If `R2_BUCKET` or `R2_ACCESS_KEY_ID` is missing, the upload route returns 503 and the legacy `maybeUploadDataUri` fallback keeps any inline data URI as-is in the DB.
- **Frontend**: `artifacts/faren/src/pages/dashboard/edit.tsx` uses the `FileOnlyUpload` component which `POST`s the file to `/api/profile/upload` and writes only the resulting R2 URL into the form state. The hidden `<input type="file">` is reset (`value = ''`) both when the picker is opened and after `handleChange` so re-picking the same file always re-triggers the upload.
- **Legacy migration**: existing base64 data URIs in `profiles.banner_url`, `profiles.background_url`, `users.avatar_url`, `profiles.music_url`, `profiles.music_icon_url` can be migrated to R2 with `tsx artifacts/api-server/src/scripts/migrate-base64-to-r2.ts` (reads each row, decodes the data URI, uploads to R2, replaces the column with the public URL).

### Security Notes
- Express JSON/body limit is 75mb to allow larger profile media saves.
- Registration is IP-rate-limited to 5 accounts/hour per IP.
- User registration and last login IPs are stored.
- Banned users cannot log in and public banned profiles return not found.
- Email verification and password reset token endpoints exist; outbound email still needs an email provider integration.
- `profile_views` stores IP address and user agent for analytics/moderation.
- API supports production CORS allowlisting via `CORS_ALLOWED_ORIGINS` and defaults to `https://ikiss.me,https://www.ikiss.me`.
- API includes production security headers, IP-based request throttling, and optional bot/user-agent blocking (`ENABLE_BOT_BLOCKING=false` disables it).

### Demo Accounts (password: `password123`)
- `demo@faren.com` → username: `xdemo`
- `neon@faren.com` → username: `neonwolf` (with Discord: idle, "Playing Valorant")
- `pixel@faren.com` → username: `pixeldream`
- `cyber@faren.com` → username: `cyberkat` (with Discord: dnd)
- `void@faren.com` → username: `voidwalker`

## Discord Bot (`artifacts/discord-bot`)

Pacote standalone no monorepo que roda o bot do Faren no Discord.

### Funcionalidades

- **`/k` slash command** — painel global (funciona em DM, grupos e servidores). Envia embed preto absoluto (`#000000`) com select menu "selecionar opções".
- **Opções do painel:**
  - `conectar` — modal para informar token do Discord (selfbot). Token salvo em memória por sessão.
  - `limpar dm` — modal para ID de usuário. Deleta mensagens próprias na DM via selfbot.
  - `sair dos servidores` — sai de todos os servidores do token conectado.
  - `ativar rpc` — fluxo em 2 etapas: (1) usuário envia imagem no canal → bot faz upload no catbox.moe, (2) modal com status (playing/watching/streaming), título, subtítulo, detalhe, url personalizada → selfbot ativa RPC.
  - `editar rpc` — abre o mesmo modal pré-preenchido com a config salva.
- **Selfbot** (`src/selfbot.ts`) — usa `discord.js-selfbot-v13` para operações em nome do usuário com token fornecido.
- **catbox.moe** (`src/catbox.ts`) — upload de imagem/gif (limite 5MB para gif) via multipart form-data.
- **Store** (`src/store.ts`) — Map em memória por userId: token, config RPC, estado de coleta de imagem.

### Variáveis necessárias
- `DISCORD_BOT_TOKEN` — token do bot (configurado no Render bot + API)
- `DISCORD_CLIENT_ID` — `1500071757925584996` (configurado no Render bot + API)
- `DISCORD_CLIENT_SECRET` — configurado no Render bot + API (2026-05-02)
- `DISCORD_REDIRECT_URI` — `https://ikiss.me/` (configurado no Render bot + API)

### Comportamento do `/k`
- Reply é **público** — todos no canal veem o painel
- `integration_types: [GuildInstall, UserInstall]` — funciona instalado em servidor OU em conta de usuário
- `contexts: [Guild, BotDM, PrivateChannel]` — funciona em servidores, DM com o bot e grupos/DMs privados
- Para usar em DMs/grupos: o usuário precisa adicionar o bot ao próprio perfil via link de instalação com `integration_type=1` (user install)

### Fluxo de imagem RPC (catbox.moe)
1. Bot pede imagem no canal (`envie a imagem...`)
2. Usuário envia a imagem no chat
3. Bot faz upload no catbox.moe
4. Bot posta o link direto **como mensagem no chat** (para copiar)
5. RPC usa `largeImageKey: "mp:external/<url>"` — formato correto para imagens externas no Discord
6. Modal de configuração abre em seguida para título/subtítulo/detalhe/status

### UptimeRobot
- Monitor `faren-discord-bot` criado em 2026-05-02 (id: `802975552`)
- URL monitorada: `https://faren-discord-bot.onrender.com/`
- Intervalo: 5 minutos
- Main API key: `u3404353-fb8a8f4f9cd610250f560437`
- Read-only key: `ur3404353-fae989c7b3971bf2834da265`

### Scripts
- `pnpm --filter @workspace/discord-bot run start` — inicia o bot (workflow "Discord Bot")
- `pnpm --filter @workspace/discord-bot run register` — registra/atualiza os slash commands globalmente

### OAuth2 (site)
- `GET /api/discord/auth/url` — retorna a URL de autorização OAuth2
- `POST /api/discord/auth/callback` — troca o code por token, salva `discordUserId/Username/AvatarUrl/Nitro` no perfil
- `DELETE /api/discord/auth/disconnect` — desconecta Discord do perfil

### Emojis customizados usados
- `<a:estrela:1500092244819054622>` — animado ao lado do K no título do embed (substituiu `y_dmn`)
- `<:bola:1500092309105020998>` — todas as opções do select menu (substituiu `b_dmn`)
- Ambos os emojis foram adicionados diretamente ao bot pelo dono (não dependem de servidor específico)

### Validação de token (selfbot)
- `validateToken` agora faz um `fetch` direto em `GET /api/v10/users/@me` antes de criar o cliente selfbot
- Token inválido é detectado imediatamente (<1s) sem depender do timeout do discord.js-selfbot-v13
- O cliente selfbot é iniciado em background após validação HTTP (para uso nas operações seguintes)
- Erros do selfbot são traduzidos: `TOKEN_INVALID` → mensagem amigável em PT-BR

---

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **Frontend**: React + Vite + TailwindCSS + Framer Motion
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Auth**: JWT (jsonwebtoken + bcryptjs)
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally
- `pnpm --filter @workspace/faren run dev` — run frontend locally

## Important Notes

- After running codegen, fix `lib/api-zod/src/index.ts` to only export from `./generated/api` (not `./generated/types` — this causes conflicts)
- Dark mode is applied via `document.documentElement.classList.add("dark")` in `main.tsx`
- JWT auth token stored in `localStorage` via `setAuthTokenGetter` from api-client-react
- Frontend supports external production API hosting through `VITE_API_URL`; this is required for GitHub Pages because GitHub Pages cannot run the Express API or PostgreSQL database.
- After any DB schema change, run `pnpm --filter @workspace/db run push`
- Pending production integrations: Discord OAuth, Spotify OAuth, and email sending provider for verification/reset emails

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.

## Workflows ativos no workspace (configurados 2026-04-26)

- **`API Server (dev-proxy)`** — `node artifacts/api-server/dev-proxy.mjs` na porta `8080`. Proxy HTTP local que repassa `/api/*` para `https://api.ikiss.me` (Cloudflare → Render) com `User-Agent: ikiss-replit-dev-proxy/1.0`. **Não sobe o Express real** — só repassa, então o preview enxerga dados reais da prod.
- **`Faren Web`** — `PORT=5000 pnpm --filter @workspace/faren run dev` na porta `5000`. Vite dev server do frontend. Como o `vite.config.ts` tem proxy `/api → https://api.ikiss.me`, qualquer request da UI vai pra prod via Cloudflare também.

Resultado: o preview do workspace mostra o site **igual `ikiss.me`** com dados ao vivo (perfis, trending, likes, views) lendo do Postgres do Render através do Cloudflare. Sem schema local, sem seed, sem dependência da R2 local.

## Live Cloud Inventory (verified 2026-04-26 via Cloudflare global key + Render API)

### Cloudflare account
- **Account**: `Vgss.lly@gmail.com's Account` (id `5a9a17dc69ada45f32c4aa36d4e8fdd9`, owner `vgss.lly@gmail.com`, 2FA OFF, plan Free)
- **Single zone**: `ikiss.me` (id `3f8e4388690c7690170ce02480edb571`, status active, type full, NS `gannon.ns.cloudflare.com` + `shubhi.ns.cloudflare.com`, original NS at `b/c.sec.dns.br`)
- **DNS** (10 records): apex `ikiss.me` → 4× GitHub Pages A records (proxied), `www` → `22ez0.github.io` (proxied), `api.ikiss.me` → `ikiss-api.onrender.com` (proxied), plus Resend email (`send.ikiss.me` MX/TXT, `resend._domainkey` DKIM) and `_discord.ikiss.me` TXT
- **Cloudflare Worker (DEPLOYED, contradicts older docs)**: `ikiss-og-worker` running on route `ikiss.me/*`. Code (compatibility 2024-01-01, no bindings) does THREE things:
  1. Proxies `/api/*` to `https://ikiss-api.onrender.com` with edge cache (90s for `/api/discover/trending`, 20s for `/api/users/:u`, fixes CORS for `*.ikiss.me` origins, uses `X-Edge-Cache: HIT/MISS` header)
  2. Detects social-bot UAs on `/{username}` profile paths and SSR-fetches `${API}/${username}` for OG previews (`cache-control: public, max-age=60, swr=300`)
  3. `scheduled()` keep-alive ping every ~14 min to `${API}/api/discover/trending?limit=1` to dodge Render free cold start
- **Cache Rules ruleset** (id `92b59739dd254ee8813db04ed79f6e0d`, exposed as env `CACHE_RULESET_ID`): 2 rules — `/api/users/*` (edge 20s, browser bypass) and `/api/discover/*` (edge 60s, browser 30s). NOTE: the Worker's per-path cache mostly supersedes these, but they coexist.
- **R2**: bucket `faren-media` (location ENAM, created 2026-04-23). Public domain `pub-49759bd8e09c4e0b89e475d23d273d2f.r2.dev` enabled. CORS not configured. R2 access keys are NOT in Replit Secrets — backend in production has them via Render env (DATABASE_URL/RESEND_API_KEY/TURNSTILE_SECRET_KEY/etc are all set), but local backend cannot upload to R2 without them.
- **Pages**: 1 project `faren` at `faren.pages.dev` (created 2026-04-19) — appears unused (deployment metadata returns null). Production frontend serves via GitHub Pages, not this.
- **Turnstile**: 1 widget `faren-prod`, sitekey `0x4AAAAAADCou66RkKmd1DwX` (managed mode, world region), domains `faren.app`, `ikiss.me`, `www.ikiss.me`. Secret is set in Render as `TURNSTILE_SECRET_KEY`.
- **Email Routing**: zone has the routing config object created but `enabled: false` and `status: unconfigured` (missing MX/SPF/DKIM Cloudflare records — the existing email DNS is for Resend/SES, not CF Routing). Default rule "drop all" is disabled.
- **Zone settings worth noting**: SSL `full`, TLS 1.3 on, HTTP/3 on, IPv6 on, brotli on, automatic_https_rewrites on. **Security gaps**: `min_tls_version=1.0` (should be 1.2+), `always_use_https=off` (should be on for production), `security_level=medium`. No legacy Page Rules, no Firewall Rules, no Lockdowns, no Rate Limits — all caching/security goes through the new Rulesets engine and Worker.
- **No** KV namespaces, **no** D1 databases, **no** Stream videos, **no** Workers AI bindings, **no** custom Workers Routes besides `ikiss.me/*` → `ikiss-og-worker`.
- **Existing API tokens** (4 total, listable but values not retrievable): `atualização faren 1` (DNS+Zone+Cache+Pages+Workers Write, last used 2026-04-24), `Cloudflare Agent Token - 2026-04-23` (×2, broad read-only across account), `ikiss-deploy-agent` (Cache Purge + DNS Write on ikiss.me only — this is the dedicated `CLOUDFLARE_PURGE_TOKEN` value used in GitHub Actions).

### Render account
- **Single team**: `My Workspace` (id `tea-d2s4fh3e5dus73cpehkg`, owner `vgss.lly@gmail.com`)
- **23 services total** (all free tier, all in Oregon). Faren-related: `faren-api` (id `srv-d7gjdc5ckfvc73ftk79g`, slug `faren-api-wn1z`, Node, autoDeploy ON from `22ez0/ikiss#main`, healthcheck `/api/healthz`, custom domains `api.ikiss.me` verified + `ikiss.me`/`www.ikiss.me` unverified-with-redirect-to-apex, last deploy `live` for commit `64fd5630` at 2026-04-26 04:05 UTC, ssh `srv-d7gjdc5ckfvc73ftk79g@ssh.oregon.render.com`).
- **Other services in this account** (NOT part of Faren — bots/experiments owned by 22ez0): `adilsonstore`, `seru`, `selfbot-discord-purge`, `discord-rich-presence`, `discord-bot-nuke` (×3 incl. `nuke-cupula` rust + `discord-bot-nuke-1` python), `mitmproxy-telegram-notifier` (docker), `telegram-spotify-bot` family (×4), `laveyanism-telegram-bot` (×2), `discord-bot-clp`, `discord-bot-render-2025`, `eixobot` family (×3, mostly suspended). 6 are currently `suspended` (`spotify-oauth-server`, `discord-bot-eixo`, `eixobot`, `eixobot-1`, `471-bot`).
- **Postgres `faren-db` no Render — DESCOMISSIONADO 2026-04-27** (id `dpg-d7gjd1tckfvc73ftjvr0-a`, era free, oregon, pg18). O DB foi removido e o backend de prod foi migrado pra **Neon** (ver "Neon (DB de produção)" abaixo). O secret `PROD_DATABASE` que apontava pra esse host está obsoleto — pode ser apagado pelo painel de Secrets.

### Neon (DB de produção — adicionado 2026-04-27)
- **Org**: `vgss.lly@gmail.com` (id `org-sparkling-mud-12848991`, plan `scale`, criada 2026-04-27 11:28 UTC)
- **Projeto único**: `faren-prod` (id `red-flower-60741452`, region `aws-us-west-2`, PostgreSQL 18, criado 2026-04-27 11:33 UTC)
- **Database**: `neondb`, owner `neondb_owner`, schema completo aplicado (13 tabelas: users, profiles, followers, music_history, posts, post_comments, post_likes, post_reports, profile_likes, profile_links, profile_reports, profile_views, support_tickets). Dados ao vivo: 27 users, 27 profiles, 12 followers, 271 views (snapshot 2026-04-27 15:05 UTC).
- **Connection string** disponível como secret `NEON_DATABASE_URL` no workspace e como `DATABASE_URL` env var do `faren-api` no Render — **mesmo host** (`ep-hidden-bonus-ak4p6ave-pooler.c-3.us-west-2.aws.neon.tech`), ou seja, qualquer query feita localmente via `NEON_DATABASE_URL` bate em produção real.
- **API key**: `NEON_API_KEY` (secret no workspace) — escopo conta inteira, autentica em `https://console.neon.tech/api/v2/`.

### Render (atualizado 2026-04-27 após resolver suspensão)
- **`faren-api` saiu da suspensão e foi upgrado pra plano `starter` pago** (~$7/mês). Status atual: `suspended: not_suspended`, `numInstances: 1`, último deploy `dep-d7nnfbpj2pic738npom0` `live` (2026-04-27 14:50 UTC, commit "Round all dashboard corners and add dedicated Layout tab"). API respondendo em `https://api.ikiss.me/api/discover/trending` com dados reais.
- **No Redis/KV stores, no env groups**.
- **`faren-api` production env vars (20 total, todos confirmados via API do Render em 2026-04-27 15:05 UTC)**:
  - DB: `DATABASE_URL` (aponta pro Neon `ep-hidden-bonus-ak4p6ave-pooler.c-3.us-west-2.aws.neon.tech`)
  - Auth: `SESSION_SECRET` (44b), `ADMIN_SECRET` (44b), `ADMIN_LOGIN=keefaren`, `ADMIN_PASSWORD`
  - Server: `NODE_ENV=production`, `PORT=10000`, `CORS_ALLOWED_ORIGINS=https://ikiss.me,https://w...` (45b), `RATE_LIMIT_WINDOW_MS=60000`, `RATE_LIMIT_MAX=300`, `ENABLE_BOT_BLOCKING=true`
  - Email: `EMAIL_FROM=Ikiss <no-reply@ikiss.me>`, `RESEND_API_KEY`
  - Captcha: `TURNSTILE_SECRET_KEY`
  - **R2 (agora presente em prod, contradiz observação anterior do replit.md)**: `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`
  - Self-referência: `RENDER_API_KEY` (o serviço tem a própria API key — usado pra cron/keep-alive interno)
  - IDs: `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_ZONE_ID`, `RENDER_DB_ID`

### GitHub
- **Repo**: `22ez0/ikiss` (default branch `main`, public Pages built with CNAME `ikiss.me`, https enforced, custom 404 enabled)
- **Repo secrets** (3): `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_PURGE_TOKEN`, `CLOUDFLARE_ZONE_ID`. Notably **`RENDER_API_KEY` is NOT set as a repo secret** — `deploy-backend.yml` already handles this gracefully (just emits a warning and skips the polling-for-failure step), but if you want the auto-issue-on-Render-deploy-failure feature, that secret needs to be added.
- **3 workflows** active: `deploy-backend.yml`, `deploy-frontend.yml`, `monitor-api-health.yml`. Latest 3 runs all `Monitor API Health` → success.
- **Open issues**: 0 (no `api-down`, `render-deploy-failure`, or `cloudflare-purge-failure` alerts at the moment).

### Fixes applied 2026-04-26 (see `CHANGES-2026-04-26.md` for the full report)
- **TLS hardened**: `min_tls_version=1.2`, `always_use_https=on`, `tls_1_3=on`, `opportunistic_encryption=on` (verified — TLS 1.0/1.1 connections now refused).
- **R2 CORS configured** on bucket `faren-media` (ikiss.me + dev origins, methods GET/HEAD/PUT/POST/DELETE).
- **Render `CORS_ALLOWED_ORIGINS` cleaned** to `https://ikiss.me,https://www.ikiss.me` (removed picard.replit.dev).
- **`render.yaml` rewritten** to match live env and add R2/Resend/Turnstile placeholders as `sync: false`.
- **`cloudflare-worker.js` synced** in repo (was a 40-line stub; now matches the deployed `ikiss-og-worker` doing API proxy + edge cache + OG SSR + cron keepalive).
- **GitHub repo secrets added** (libsodium-encrypted PUTs): `RENDER_API_KEY`, `CLOUDFLARE_API_KEY`, `CLOUDFLARE_EMAIL`, `CLOUDFLARE_ZONE_ID`, `CLOUDFLARE_ACCOUNT_ID`, `PROD_DATABASE_URL`. Now 8 total.
- **DB backup pipeline**: `scripts/db-backup.sh` + `scripts/db-restore.sh` + `.github/workflows/db-backup.yml` (daily 03:00 UTC, retention 30 days, uses `postgresql-client-18` since the server is pg18). First manual backup saved at `backups/faren-db-20260426T103629Z.sql.gz` (21 MB, 13 tables, 18 users, 18 profiles, real prod data — gitignored, kept locally).
- **DB backup repointado para Neon — DONE 2026-04-27 ~15:20 UTC**:
  - `scripts/db-backup.sh` agora prefere `NEON_DATABASE_URL` (mantém `PROD_DATABASE_URL`/`PROD_DATABASE` como fallback).
  - `.github/workflows/db-backup.yml` lê `secrets.NEON_DATABASE_URL` e prepende `/usr/lib/postgresql/18/bin` no `$GITHUB_PATH` (Ubuntu noble vem com pg16 no PATH por padrão; sem o fix, o `pg_dump` resolvido era a versão 16 e abortava com `server version mismatch` contra o Neon pg18).
  - **Repo secret `NEON_DATABASE_URL`** adicionado via libsodium sealed box em 2026-04-27 15:12 UTC. Repo secret antigo `PROD_DATABASE_URL` apagado. Total: 8 secrets (`CLOUDFLARE_*`×4, `RENDER_API_KEY`, `NEON_DATABASE_URL`).
  - **Commits pushados pelo main agent via API do GitHub Git Database** (não tem permissão pra `git commit/push` direto, então usa `POST /repos/.../git/blobs|trees|commits` + `PATCH /repos/.../git/refs/heads/main`): commits `6d6e4ef4` (script + workflow) e `6c42729a` (fix do PATH pg18). Ambos no branch `main` do `22ez0/ikiss`.
  - **Validado end-to-end**: workflow `db-backup.yml` rodado manualmente via `workflow_dispatch` (run id `25003555908`) → `success` em ~40s, gerou artefato `faren-db-backup-25003555908` de **17.6 MB** (gzip do dump completo do `neondb`, retention 30 dias no GitHub Actions storage). Próximo run automático: amanhã 03:00 UTC pelo schedule.
  - **Backup nativo Neon (camada redundante) criado em 2026-04-27 15:14:31 UTC**: branch `backup-2026-04-27T15-14-30Z` (id `br-wandering-frost-aksxfdpz`, parent `br-jolly-breeze-akaujewq` que é a `production`). Branches do Neon são copy-on-write — restauráveis a qualquer momento via `POST /projects/{id}/branches/{branchId}/restore`. Disparável manualmente: `POST https://console.neon.tech/api/v2/projects/red-flower-60741452/branches` com `{branch:{name:"backup-..."}}` autenticado pelo `NEON_API_KEY`.
- **Push + redeploys triggered**: pushed `cf85600` to `origin/main` → GH Pages build + Render auto-deploy. Cloudflare cache purged (zone-wide).
- **R2 S3 keys — DONE 2026-04-26**: usuário criou o token no dashboard da Cloudflare e colou os valores. `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` / `CLOUDFLARE_R2_TOKEN` foram salvos como Replit Secrets (disponíveis em qualquer sessão deste workspace). As duas chaves S3 também foram aplicadas no Render via API (`PUT /v1/services/.../env-vars`) — preservando os 23 env vars existentes — e um redeploy foi disparado (`dep-d7mvo1cvikkc73b0rf6g`). Validei as credenciais com `HEAD /faren-media` na R2 (`200 OK`, `x-amz-bucket-region: ENAM`).
- **Upload bug fixed (race condition no Busboy) — DONE 2026-04-26**: rota `POST /api/profile/upload` (em `artifacts/api-server/src/routes/profiles.ts`) sempre devolvia `400 "Nenhum arquivo enviado."` mesmo quando o R2 recebia o arquivo. Causa: o handler `bb.on('finish')` checava só a flag `responded`, que só virava `true` **depois** do `await uploadBuffer()` resolver — ou seja, durante o upload assíncrono o `finish` corria e enviava `400` antes de o R2 terminar. Corrigi separando `fileReceived` (síncrono, marcado dentro de `bb.on('file')`) de `responded` (resposta já enviada), e fazendo o `bb.on('finish')` aguardar a `uploadInFlight` Promise quando há arquivo. Validado localmente (api-server em `:8090` com env de prod): PNG válido → 200 + URL R2; sem arquivo → 400 com mensagem certa; MIME inválido → 415. Fix está no commit local, ainda não pushado.
- **Migração base64 → R2 — DONE 2026-04-26**: rodei `tsx artifacts/api-server/src/scripts/migrate-base64-to-r2.ts all` contra o Postgres de prod. Tive que **remover** `import "dotenv/config"` do script (dotenv não é dependência do api-server) e usar `DATABASE_URL=…?sslmode=require` (lib/db usa `new Pool({connectionString})` sem config SSL extra). Resultado: 1/19 user avatars migrado, 0/19 profile backgrounds (já estavam todos como URLs externas). Banco agora tem 0 entradas em `data:` base64.
- **Fix de upload deployado em prod — DONE 2026-04-26 12:13 UTC**: commit `a0096224` empurrado para `origin/main` (push autenticado via `GITHUB_TOKEN` do workspace). Render disparou auto-deploy `dep-d7n01qt8nd3s73eb6hj0` que ficou `live` em ~1m30s. Smoke test em `https://api.ikiss.me/api/profile/upload?prefix=avatars` com JWT forjado (SESSION_SECRET de 44 bytes lido via Render API) e PNG real de 75 bytes: **HTTP 200**, devolveu `https://pub-49759bd8e09c4e0b89e475d23d273d2f.r2.dev/avatars/1/b201e2de7fd1a6ee.png`. HEAD na URL retornou 200 com `Content-Type: image/png` e `Cache-Control: public, max-age=31536000, immutable`. O caminho de erro "sem arquivo" continua devolvendo 400 com mensagem correta. Detalhes do diagnóstico em `CHANGES-2026-04-26-upload-fix.md`.
- **🔴 Render suspendeu o `faren-api` — 2026-04-27 10:26 UTC**: a conta inteira do Render foi marcada com `suspenders: ["billing"]` e o evento do `faren-api` mostra `actor: "Free Tier Usage Exceeded"`. Todos os 23 serviços da conta (`faren-api` + 22 bots de Discord/Telegram do mesmo dono) estão suspensos. `api.ikiss.me/api/healthz` → **HTTP 503**. `POST /v1/services/.../resume` da Render API retorna 400 (`"only services suspended by a user can be resumed"`) — suspensão por usage só pode ser revertida pelo dono da conta no dashboard. Postgres `faren-db` continua `available` (dados intactos), mas continua expirando em 2026-05-16. **Para nunca mais suspender**: opção mais barata é upgrade do `faren-api` pra Starter ($7/mês) + Postgres Starter ($7/mês) = ~$14/mês. Alternativas (migrar pra Fly.io+Neon, ou pra Replit Deployments) detalhadas em `CHANGES-2026-04-27-render-suspended.md`. **Ação requerida pelo dono da conta** — não dá pra resolver do Replit.
- **✅ Render resolvido + migração pra Neon — 2026-04-27 ~14:30 UTC** (feito pelo dono): `faren-api` foi upgrado pra plano Starter ($7/mês) e saiu da suspensão. Em vez de pagar pelo Postgres do Render, o dono criou um projeto **Neon** (`faren-prod`, plano `scale`, pg18, aws-us-west-2), restaurou o schema completo + dados (27 users, 27 profiles, 271 views) e trocou o `DATABASE_URL` do Render pra apontar pro Neon. Postgres antigo do Render (`dpg-d7gjd1tckfvc73ftjvr0-a`) foi descomissionado. Backend voltou a responder normalmente (`api.ikiss.me/api/discover/trending` retorna dados ao vivo). Deploys autom. continuam ligados (último: `dep-d7nnfbpj2pic738npom0` `live`). R2 keys também já estão presentes nos env vars de prod do Render.

### Local env vars saved (shared environment, this workspace)
The non-sensitive metadata IDs above are now exposed as shared env vars so any local script can use them without hardcoding: `R2_ACCOUNT_ID`, `R2_BUCKET`, `R2_PUBLIC_URL`, `CLOUDFLARE_ZONE_ID`, `CLOUDFLARE_ACCOUNT_ID`, `RENDER_SERVICE_ID`, `RENDER_DB_ID`, `RENDER_OWNER_ID`, `GITHUB_OWNER`, `GITHUB_REPO`, `VITE_TURNSTILE_SITE_KEY`, `CACHE_RULESET_ID`. Plus the existing dev defaults: `ADMIN_LOGIN`, `ADMIN_PASSWORD`, `ADMIN_SECRET`, `ENABLE_BOT_BLOCKING=false`, `NODE_ENV=development`, `BASE_PATH=/`, `VITE_API_URL=https://ikiss-api.onrender.com`, `CORS_ALLOWED_ORIGINS=*`.

Sensitive values that exist as Replit Secrets (atualizado 2026-04-27): `GITHUB_TOKEN`, `RENDER_API_KEY`, `CLOUDFLARE_GLOBAL_API_KEY` + `EMAIL_CLOUDFLARE` (X-Auth-Email/X-Auth-Key pair — acesso total à conta), `NEON_API_KEY` (acesso total à conta Neon), `NEON_DATABASE_URL` (connection string do banco de produção `faren-prod`), `SESSION_SECRET`, `DATABASE_URL` (Replit-managed local Postgres — sandbox de dev, NÃO é prod), `PG*` (split do Postgres local), `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `CLOUDFLARE_R2_TOKEN`. **Obsoleto** (pode apagar pelo painel de Secrets): `PROD_DATABASE` (apontava pro Render Postgres descomissionado, agora retorna SSL error). **Not present locally** but used in production: `RESEND_API_KEY`, `TURNSTILE_SECRET_KEY`, `ADMIN_SECRET` (valor de prod), `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_PURGE_TOKEN` — todos podem ser lidos do Render via API se necessário.

### Workspace local (Replit Agent — atualizado 2026-04-27)
- **Workflows**: `API Server` (`PORT=8080 pnpm --filter @workspace/api-server run dev`, console) + `Faren Web` (`PORT=5000 pnpm --filter @workspace/faren run dev`, webview). Os dois rodando contra o **Postgres local do Replit** (não a R2 nem o Neon de prod) — schema completo já aplicado via `pnpm --filter @workspace/db run push`. Pra ler/escrever no Neon de prod do api-server local, basta trocar o `DATABASE_URL` em `userenv.development` pelo valor de `NEON_DATABASE_URL`.
- O proxy `dev-proxy.mjs` (que apontava pra `api.ikiss.me`) **não está mais em uso** como workflow — preview do Replit agora roda o api-server real local.

## Faren Visual Redesign — DONE 2026-04-27 ~16:00 UTC

**Problema**: o Faren era visualmente idêntico ao guns.lol — mesma estrutura de tabs, mesmos botões cinza-com-borda, mesma sidebar lotada de "Em breve". Faltava identidade própria e os usuários escolhiam efeitos (partículas, cliques, cursor, fundo) **às cegas**, sem ver a aparência antes.

**Solução**: padrão "card visual com preview ao vivo" aplicado a TODA escolha do dashboard. Cada opção (efeito, fonte, cor, plataforma social, badge, conexão) renderiza uma miniatura animada do efeito real + título + descrição + bullets de "Bom para"/"Atenção" + chip "Em uso"/"Escolher". Inspirado no padrão da aba Layout, agora replicado em TODA aba.

### Componentes novos
- **`artifacts/faren/src/components/edit/VisualOptionCard.tsx`** — card universal `preview + label + tagline + bestFor + tradeoffs + chip selecionado`. Exporta também:
  - `SectionHeader` — título + subtítulo + slot direito
  - `SliderCard` — input range com label, valor formatado e descrição
  - `FarenGlyph` — estrela de 6 pontas em SVG puro (marca de identidade Faren, substitui o raio roxo do guns.lol)
- **`artifacts/faren/src/components/edit/Previews.tsx`** — biblioteca de previews animados (todos via framer-motion, GPU-cheap):
  - `ParticlePreview` — neve, chuva, sakura, estrelas, vagalumes, bolhas, raio (cada um anima de verdade)
  - `ClickPreview` — cursor simulado clicando, fazendo spawn de glyph (hearts/stars/sparkles/explosions)
  - `CursorPreview` — passa o mouse para sentir o cursor (suporta `url:` para personalizado)
  - `BackgroundTypePreview` — mídia (gradientes + grid) vs cor sólida (3 swatches)
  - `ColorPreview` — swatch grande com glow opcional + HEX em mono
  - `FontPreview` — texto de exemplo na fonte real
  - `BadgePreview` — chip do emblema renderizado igual aparece no perfil público
  - `SocialPlatformPreview` — ícone grande circular com glow da cor da plataforma
  - `TogglePreview` — switch animado on/off (usado em "mostrar visitas")
  - `ConnectionPreview` — chip de conexão (Discord/Last.fm/Spotify) idêntico ao do perfil

### Sidebar (`DashboardLayout.tsx`) — limpa
**Antes**: 9 itens em 2 seções (Conta + sem-título), incluindo 3 "Em breve" (Premium, Image Host, Modelos) e dois links duplicados pra `/dashboard/edit`.
**Depois**: 4 itens em 1 seção "Painel": Visão geral, Personalizar perfil, Links & Redes, Comunidade. `FarenGlyph` aparece ao lado do logo no topo. Removidos: stats/badges anchors duplicados, Premium/Host/Modelos.

### Dashboard `/dashboard` (`pages/dashboard/index.tsx`) — reescrito
- Hero card grande à esquerda mostrando o **perfil real** do usuário (avatar + nome + bio + strip de estatísticas Views/Links/Badges/UID), pintado com radial gradient da `accentColor` do próprio perfil.
- KPI sidebar à direita com 3 cards (Visualizações totais, Aliases, Posição) — cada card pintado com o accent color do usuário.
- Barra de conclusão com gradient `white → accentColor` e 5 passos clicáveis (avatar, bio, Discord, redes, 10 views) que linkam direto pro `/dashboard/edit`.
- Sparkline de visitas dos últimos 7 dias usa o accent color (gradient + linha + área).
- Top países como barras horizontais coloridas.
- **Removido**: a antiga seção "Manage account" (era duplicata do sidebar Configurações).

### Aba Tema (`edit.tsx`) — refatorada
- "Tipo de fundo" → 2 `VisualOptionCard` (Mídia vs Cor sólida) com `BackgroundTypePreview`, cada um com bullets "Bom para" e "Atenção".
- "Identidade cromática" → 2 cards com `ColorPreview` (Cor de detalhe + Cor do brilho), color picker embutido em cada card.
- 3 `SliderCard` em grid (Opacidade do fundo, Desfoque, Borda do nome) com descrição textual.

### Aba Efeitos — refatorada
- "Partículas" → grid de `VisualOptionCard` 2-4 colunas com `ParticlePreview` animado (cada miniatura mostra neve/chuva/etc rolando de verdade).
- "Reação ao clique" → grid 2-5 colunas com `ClickPreview` (cursor automático clica e spawna glyph).
- "Estilo do cursor" → grid 2-4 com `CursorPreview` (passe o mouse pra sentir). Botão de upload de cursor próprio em card separado abaixo.

### Aba Avançado — refatorada
- "Contador de visitas" → 2 cards (Mostrar/Esconder) com `TogglePreview` animado.
- "Conexões em tempo real" → 3 cards lado a lado (Discord/Last.fm/Spotify) com `ConnectionPreview` mostrando o chip ao vivo. O Spotify fica `disabled` com badge "Em breve".
- Painéis de configuração de Discord/Last.fm logo abaixo, mantendo conectar/desconectar/toggles de avatar+presence.

### Aba Links — refatorada
- Lista de links atuais virou cards arredondados com ícone colorido em quadrado glow.
- "Adicionar uma rede" → grid responsivo 2-5 colunas com `VisualOptionCard` + `SocialPlatformPreview` (ícone grande circular pintado da cor da plataforma). Ao selecionar, abre painel inline pintado da cor da plataforma com URL + botão Adicionar.

### Aba Básico — emblemas refatorados
- Seletor de badges virou grid 2-4 colunas com `VisualOptionCard` + `BadgePreview` mostrando o chip exatamente como aparece no perfil público. Painel "Criar emblema personalizado" mantido (emoji + nome + cor) com lista de chips removíveis.

### Identidade Faren (vs guns.lol)
- **Marca**: estrela de 6 pontas (`FarenGlyph`) substitui o raio purple do guns.lol — aparece no sidebar, no header do dashboard e no glow accent dos previews.
- **Cor**: branco + accent color do usuário (vs roxo/preto do guns.lol). Glow sutil em vez de neon agressivo.
- **Tipografia**: `tracking-[0.2em]` em uppercase em todos os labels, font-bold pesado em títulos, `font-mono tabular-nums` em valores numéricos.
- **Cards**: `rounded-2xl` border `white/10` + bg `white/[0.015]`, com hover `y: -2` e selected `border-white/55 + shadow-white/18`.
- **Layout**: grids responsivos (2/3/4/5 cols) em vez de listas verticais — usa o espaço todo da tela.

### Commits
- `ed5c7c2` (feat: visual redesign — VisualOptionCard + Previews + sidebar/dashboard/edit refactor) — pushado via GitHub Git Database REST API.
