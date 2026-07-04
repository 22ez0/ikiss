# SETUP.md — Ikiss (ikiss.me)

> **Para agentes e devs que abrirem este workspace:** leia este arquivo primeiro. Ele documenta a arquitetura completa, o estado atual do deploy, o que já está feito e o que ainda precisa de ação manual.

---

## Stack e estrutura

```
pnpm monorepo (workspace)
├── artifacts/faren/          → Frontend React + Vite + TailwindCSS (porta 21395 dev)
├── artifacts/api-server/     → Backend Express 5 + Drizzle ORM (porta 8000 dev local)
├── artifacts/discord-bot/    → Discord bot (slash commands, selfbot RPC)
├── artifacts/mockup-sandbox/ → Canvas UI sandbox (porta 8081)
└── lib/                      → Pacotes compartilhados (api-client, db, etc.)
```

- **Frontend**: React + Vite + TailwindCSS + Framer Motion
- **API**: Express 5 + TypeScript + Drizzle ORM
- **Database**: PostgreSQL via Neon (permanente, sem expiração)
- **Auth**: JWT (jsonwebtoken + bcryptjs)
- **Storage**: Cloudflare R2 (`faren-media` bucket) para avatares, banners, mídia
- **CDN/Proxy**: Cloudflare Worker `ikiss-og-worker` em `ikiss.me/*`
- **Deploy API**: Render (conta **suspensa por Free Tier excedido** — ver seção abaixo)
- **Deploy Frontend**: GitHub Pages com CNAME `ikiss.me`

---

## Como rodar no Replit (estado atual — julho 2026)

### Workflows configurados

| Workflow | Porta | Descrição |
|---|---|---|
| `API Server` | 8000 | API Express real → Neon DB (produção) |
| `artifacts/faren: web` | 21395 | Vite dev server do frontend |
| `artifacts/api-server: API Server` | 8080 | Dev-proxy → api.ikiss.me (produção — inativo enquanto Render estiver suspenso) |

O workflow **`API Server`** (porta 8000) roda a API real via script `artifacts/api-server/start-local.sh`,
usando `NEON_DATABASE_URL` como `DATABASE_URL`. O Vite dev server detecta automaticamente
que está no Replit (`REPL_ID` presente) e proxia `/api` para `http://localhost:8000`.

### Secrets necessários no Replit

Todos os secrets abaixo devem estar configurados em **Secrets** do Replit:

| Secret | Uso |
|---|---|
| `NEON_DATABASE_URL` | PostgreSQL Neon (banco de produção) |
| `SESSION_SECRET` | Assinar JWTs |
| `RESEND_API_KEY` | Envio de emails de verificação |
| `TURNSTILE_SECRET_KEY` | Validação anti-bot (opcional no dev) |
| `R2_ACCESS_KEY_ID` | Upload de mídia para Cloudflare R2 |
| `R2_SECRET_ACCESS_KEY` | Upload de mídia para Cloudflare R2 |
| `EMAIL_WEBHOOK_SECRET` | Webhook de email inbound |
| `DISCORD_BOT_TOKEN` | Bot do Discord |
| `CLOUDFLARE_PURGE_TOKEN` | Purge de cache Cloudflare |
| `RENDER_API_KEY` | Monitorar/disparar deploys no Render |
| `GITHUB_PERSONAL_ACCESS_TOKEN` | Push para GitHub |

### Schema do banco (Neon)

O schema já foi aplicado (julho 2026). Se precisar reaplicar:

```bash
DATABASE_URL=$NEON_DATABASE_URL pnpm --filter @workspace/db run push-force
```

Tabelas existentes (22): `users`, `profiles`, `profile_links`, `followers`, `profile_likes`,
`profile_views`, `username_redirects`, `posts`, `post_likes`, `post_comments`, `post_reports`,
`stories`, `media_gallery`, `profile_publications`, `publication_media`, `support_tickets`,
`music_history`, `profile_reports`, `email_addresses`, `email_inbox`, `emailsnoah_messages`,
`emailsnoah_passwords`.

### Como funciona o proxy de dev

Em desenvolvimento no Replit, o Vite server usa `REPL_ID` para detectar o ambiente e
proxia `/api/*` para `http://localhost:8000` (API local com Neon). Para forçar outra URL:

```bash
VITE_DEV_API_PROXY=https://api.ikiss.me pnpm --filter @workspace/faren run dev
```

---

## ⚠️ Render — Conta Suspensa (ação manual necessária)

**Data da suspensão:** 2026-04-27  
**Motivo:** Free Tier Usage Exceeded (conta tinha 23+ serviços somando mais de 750h/mês)

### Para reativar

**Opção A — Mais simples (reativar grátis)**
1. Acesse [dashboard.render.com](https://dashboard.render.com)
2. Billing → adicione um cartão de crédito (não cobra imediatamente)
3. Os serviços voltam automaticamente. Risco: suspende novamente no fim do mês.

**Opção B — Recomendada (Starter $7/mês)**
1. Adicione cartão (passo acima)
2. `faren-api` → Settings → Instance Type: **Starter ($7/mês)**
3. Não suspende mais por inatividade nem cold start.

### Após reativar: recriar o serviço no Render via API

O serviço `faren-api` (ID antigo: `srv-d7gjdc5ckfvc73ftk79g`) não existe mais.
Após adicionar o cartão **e conectar o GitHub ao Render** (dashboard.render.com → Account → GitHub),
rode o script abaixo para recriar o serviço com todas as variáveis de ambiente:

```bash
# Substituir os valores <...> pelos valores reais
curl -s "https://api.render.com/v1/services" \
  -X POST \
  -H "Authorization: Bearer $RENDER_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "web_service",
    "name": "faren-api",
    "ownerId": "tea-d2s4fh3e5dus73cpehkg",
    "repo": "https://github.com/22ez0/ikiss",
    "branch": "main",
    "region": "oregon",
    "plan": "free",
    "serviceDetails": {
      "runtime": "node",
      "envSpecificDetails": {
        "buildCommand": "npm install -g pnpm@10 && pnpm install && pnpm --filter @workspace/api-server run build",
        "startCommand": "node --enable-source-maps artifacts/api-server/dist/index.mjs"
      },
      "healthCheckPath": "/api/healthz",
      "autoDeploy": "yes"
    }
  }'
```

Após criação do serviço, definir todas as env vars (use `RENDER_API_KEY` e o novo service ID):

```bash
SERVICE_ID="srv-NOVO_ID_AQUI"
RENDER_KEY="$RENDER_API_KEY"

set_env() {
  curl -s -X PUT "https://api.render.com/v1/services/$SERVICE_ID/env-vars" \
    -H "Authorization: Bearer $RENDER_KEY" \
    -H "Content-Type: application/json" \
    -d "$1"
}

set_env "[
  {\"key\":\"NODE_ENV\",\"value\":\"production\"},
  {\"key\":\"PORT\",\"value\":\"10000\"},
  {\"key\":\"DATABASE_URL\",\"value\":\"$NEON_DATABASE_URL\"},
  {\"key\":\"SESSION_SECRET\",\"value\":\"$SESSION_SECRET\"},
  {\"key\":\"ADMIN_LOGIN\",\"value\":\"keefaren\"},
  {\"key\":\"ADMIN_PASSWORD\",\"value\":\"$ADMIN_PASSWORD_HASH\"},
  {\"key\":\"CORS_ALLOWED_ORIGINS\",\"value\":\"https://ikiss.me,https://www.ikiss.me\"},
  {\"key\":\"RATE_LIMIT_WINDOW_MS\",\"value\":\"60000\"},
  {\"key\":\"RATE_LIMIT_MAX\",\"value\":\"300\"},
  {\"key\":\"ENABLE_BOT_BLOCKING\",\"value\":\"true\"},
  {\"key\":\"EMAIL_FROM\",\"value\":\"Ikiss <no-reply@ikiss.me>\"},
  {\"key\":\"RESEND_API_KEY\",\"value\":\"$RESEND_API_KEY\"},
  {\"key\":\"TURNSTILE_SECRET_KEY\",\"value\":\"$TURNSTILE_SECRET_KEY\"},
  {\"key\":\"R2_ACCOUNT_ID\",\"value\":\"5a9a17dc69ada45f32c4aa36d4e8fdd9\"},
  {\"key\":\"R2_BUCKET\",\"value\":\"faren-media\"},
  {\"key\":\"R2_PUBLIC_URL\",\"value\":\"https://pub-49759bd8e09c4e0b89e475d23d273d2f.r2.dev\"},
  {\"key\":\"R2_ACCESS_KEY_ID\",\"value\":\"$R2_ACCESS_KEY_ID\"},
  {\"key\":\"R2_SECRET_ACCESS_KEY\",\"value\":\"$R2_SECRET_ACCESS_KEY\"},
  {\"key\":\"EMAIL_WEBHOOK_SECRET\",\"value\":\"$EMAIL_WEBHOOK_SECRET\"},
  {\"key\":\"APP_URL\",\"value\":\"https://ikiss.me\"}
]"
```

Depois atualizar o GitHub Actions secret `RENDER_SERVICE_ID` com o novo ID e o DNS do Cloudflare
para `api.ikiss.me` CNAME → `<novo-servico>.onrender.com`.

### Docker alternativo (sem GitHub conectado)

Se não quiser conectar GitHub ao Render, use a imagem Docker via ghcr.io:

```bash
# A imagem é buildada pelo GitHub Actions (.github/workflows/build-docker.yml)
# após cada push em main. Fica disponível em:
# ghcr.io/22ez0/ikiss-api:latest
```

---

## Arquitetura de produção

```
Browser → ikiss.me (Cloudflare)
                ↓
        Cloudflare Worker: ikiss-og-worker
          - /api/* → proxia para Render (ikiss-api.onrender.com) ← INATIVO
          - /{username} (bots) → OG SSR preview
          - scheduled() → keep-alive ping a cada 14min
                ↓
        GitHub Pages (branch gh-pages, CNAME: ikiss.me)
                ↓
        Render → faren-api [SUSPENSO]
                ↓
        Neon PostgreSQL (faren-prod) ← banco OK, schema aplicado
                ↓
        Cloudflare R2 (faren-media) → cdn: pub-49759bd8e09c4e0b89e475d23d273d2f.r2.dev
```

### DNS atual (ikiss.me)

| Tipo | Nome | Conteúdo | Status |
|---|---|---|---|
| A | @ | 185.199.108-111.153 | ✅ GitHub Pages |
| CNAME | www | 22ez0.github.io | ✅ |
| CNAME | api | ikiss-api.onrender.com | ⚠️ Render suspenso |
| MX | @ | inbound-smtp.sa-east-1.amazonaws.com | ✅ |
| TXT | resend._domainkey | (chave DKIM Resend) | ✅ |

---

## GitHub Actions

| Workflow | Trigger | O que faz |
|---|---|---|
| `deploy-frontend.yml` | push main (faren/**, public/**) | Build + publish GitHub Pages + purge CF cache |
| `deploy-backend.yml` | push main (api-server/**, lib/**) | Notifica que Render auto-deploya |
| `build-docker.yml` | push main (api-server/**, lib/**, Dockerfile) | Build + push Docker para `ghcr.io/22ez0/ikiss-api:latest` |
| `deploy-render-docker.yml` | após build-docker.yml | Dispara deploy no Render (quando service_id configurado) |
| `monitor-api-health.yml` | cron 5min | Abre/fecha issue se API cair |
| `db-backup.yml` | cron 03h UTC | Backup do banco no GitHub Artifacts |
| `sync-secrets-to-replit.yml` | manual | Sincroniza secrets GitHub → Replit |

---

## Comandos úteis

```bash
# Rodar localmente (todos os workflows já iniciam automaticamente no Replit)
pnpm --filter @workspace/faren run dev          # frontend :21395
PORT=8000 bash artifacts/api-server/start-local.sh  # API :8000 (Neon DB)

# Schema
DATABASE_URL=$NEON_DATABASE_URL pnpm --filter @workspace/db run push-force

# Build
pnpm run build   # typecheck + build todos os pacotes

# Deploy manual no Render (quando service existir)
curl -sX POST "https://api.render.com/v1/services/SEU_SERVICE_ID/deploys" \
  -H "Authorization: Bearer $RENDER_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"clearCache":"do_not_clear"}'

# Purge de cache no Cloudflare
curl -sX POST "https://api.cloudflare.com/client/v4/zones/3f8e4388690c7690170ce02480edb571/purge_cache" \
  -H "Authorization: Bearer $CLOUDFLARE_PURGE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"purge_everything":true}'
```

---

## Notas importantes para devs

- **NUNCA usar `--frozen-lockfile`** no Render — o lockfile muda a cada pacote novo. Build command: `npm install -g pnpm@10 && pnpm install && pnpm --filter @workspace/<pkg> run build`
- **Dark mode** aplicado via `document.documentElement.classList.add("dark")` em `main.tsx`
- **JWT token** armazenado em `localStorage` E cookie `faren_token` (30 dias)
- **Uploads de mídia** → sempre vão para R2, nunca base64 no Postgres
- **Admin panel** → `/devkeefnow` ou `/keefaren` | login: `keefaren` / `Hungria2021@`
- **Após mudança no schema DB** → `DATABASE_URL=$NEON_DATABASE_URL pnpm --filter @workspace/db run push`
- **Render suspendeu por Free Tier** → adicionar cartão em dashboard.render.com resolve. Mover para Starter ($7/mês) evita recorrência.
- **VPS (Hostinger)**: secrets `VPS_HOST`, `VPS_USER`, `VPS_SSH_KEY` precisam ser reconfigurados (valores inválidos). Script de deploy disponível em `scripts/deploy-vps.sh`.
- **Imagem Docker**: buildada pelo GitHub Actions e disponível em `ghcr.io/22ez0/ikiss-api:latest` após qualquer push em main.

---

## IDs de referência

| Recurso | ID / URL |
|---|---|
| Cloudflare Account | `5a9a17dc69ada45f32c4aa36d4e8fdd9` |
| Cloudflare Zone ikiss.me | `3f8e4388690c7690170ce02480edb571` |
| Cloudflare Zone faren.com.br | `620599580cd4d65037e8d0b5af79c27e` |
| Render Owner (Team) | `tea-d2s4fh3e5dus73cpehkg` |
| R2 Bucket | `faren-media` |
| R2 CDN URL | `https://pub-49759bd8e09c4e0b89e475d23d273d2f.r2.dev` |
| Resend Domain | `ikiss.me` (verificado) |
| GitHub Repo | `22ez0/ikiss` |
