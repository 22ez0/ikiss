# SETUP.md — Ikiss (ikiss.me)

> **Para agentes e devs que abrirem este workspace:** leia este arquivo primeiro. Ele documenta a arquitetura completa, o estado atual do deploy, o que já está feito e o que ainda precisa de ação manual.

---

## Stack e estrutura

```
pnpm monorepo (workspace)
├── artifacts/faren/          → Frontend React + Vite + TailwindCSS (porta 5000)
├── artifacts/api-server/     → Backend Express 5 + Drizzle ORM (porta 8080)
├── artifacts/discord-bot/    → Discord bot (slash commands, selfbot RPC)
├── artifacts/mockup-sandbox/ → Canvas UI sandbox (porta 8081)
└── lib/                      → Pacotes compartilhados (api-client, db, etc.)
```

- **Frontend**: React + Vite + TailwindCSS + Framer Motion
- **API**: Express 5 + TypeScript + Drizzle ORM
- **Database**: PostgreSQL via Neon (produção) / Replit Postgres (dev local)
- **Auth**: JWT (jsonwebtoken + bcryptjs)
- **Storage**: Cloudflare R2 (`faren-media` bucket) para avatares, banners, mídia
- **CDN/Proxy**: Cloudflare Worker `ikiss-og-worker` em `ikiss.me/*`
- **Deploy API**: Render (`faren-api` → `srv-d7gjdc5ckfvc73ftk79g`)
- **Deploy Frontend**: GitHub Pages com CNAME `ikiss.me`

---

## Como rodar no Replit (faça isso primeiro)

### 1. Verificar workflows

Os workflows já estão configurados no `.replit`. Devem estar rodando:

| Workflow | Porta | Descrição |
|---|---|---|
| `artifacts/faren: web` | 5000 | Vite dev server do frontend |
| `artifacts/api-server: API Server` | 8080 | Dev-proxy → api.ikiss.me (prod) |
| `artifacts/mockup-sandbox` | 8081 | Canvas UI sandbox |

> O workflow `API Server` (sem artifact) pode falhar com `EADDRINUSE` — **ignore**, o artifact já ocupa a porta 8080.

### 2. Schema do banco local

Se `/api/healthz` retornar erro de tabela, aplique o schema:

```bash
pnpm --filter @workspace/db run push
```

### 3. Como funciona o proxy de dev

O `artifacts/api-server: API Server` roda `node dev-proxy.mjs` que repassa `/api/*` para `https://api.ikiss.me` (Cloudflare → Render). O preview mostra dados reais de produção.

Para trabalhar com API local (sem prod):
1. Edite `artifacts/api-server/.replit-artifact/artifact.toml` → mude `run = "node dev-proxy.mjs"` para `run = "pnpm --filter @workspace/api-server run dev"`
2. Aplique o schema: `pnpm --filter @workspace/db run push`
3. Reinicie o workflow

---

## Arquitetura de produção

```
Browser → ikiss.me (Cloudflare)
                ↓
        Cloudflare Worker: ikiss-og-worker
          - /api/* → proxia para Render (ikiss-api.onrender.com)
          - /{username} (bots) → OG SSR preview
          - scheduled() → keep-alive ping a cada 14min
                ↓
        GitHub Pages (branch gh-pages, CNAME: ikiss.me)
                ↓
        Render → faren-api (srv-d7gjdc5ckfvc73ftk79g)
                ↓
        Neon PostgreSQL (faren-prod, aws-us-west-2)
                ↓
        Cloudflare R2 (faren-media) → cdn: pub-49759bd8e09c4e0b89e475d23d273d2f.r2.dev
```

---

## Estado atual do deploy (atualizado 2026-06-06)

### ✅ Concluído

| Item | Status |
|---|---|
| GitHub repo renomeado: `22ez0/faren` → `22ez0/ikiss` | ✅ |
| Domínio migrado: `faren.com.br` → `ikiss.me` em todos os arquivos | ✅ |
| Cloudflare DNS configurado: A records GitHub Pages + api CNAME → Render | ✅ |
| Cloudflare Worker `ikiss-og-worker` roteado para `ikiss.me/*` | ✅ |
| GitHub Actions secrets: `CLOUDFLARE_ZONE_ID`, `CLOUDFLARE_PURGE_TOKEN`, `GH_TOKEN` | ✅ |
| CNAME file: `artifacts/faren/public/CNAME` = `ikiss.me` | ✅ |
| GitHub Pages custom domain atualizado para `ikiss.me` | ✅ |
| Replit Secrets: `CLOUDFLARE_API_TOKEN`, `HOSTINGER_API_KEY` | ✅ |
| Todos os workflows `.github/workflows/*.yml` atualizados para `ikiss.me` | ✅ |

### ⚠️ Ação manual necessária

| Item | O que fazer |
|---|---|
| **Nameservers no Hostinger** | No painel [hpanel.hostinger.com](https://hpanel.hostinger.com): Domains → ikiss.me → DNS/Nameservers → trocar para `jack.ns.cloudflare.com` + `maya.ns.cloudflare.com` |
| **Turnstile domains** | No painel Cloudflare → Turnstile → widget `faren-prod` → adicionar `ikiss.me` e `www.ikiss.me` |
| **Render custom domain** | No painel Render → `faren-api` → Settings → Custom Domains → adicionar `api.ikiss.me` |

> **Por que o ikiss.me está dando 404?** O DNS do Hostinger ainda aponta para os nameservers de parking deles (`hermes/artemis.dns-parking.com`) em vez dos do Cloudflare. Assim que trocar os NS, o site vai no ar em ~1h.

---

## DNS configurado no Cloudflare (zona: ikiss.me)

| Tipo | Nome | Destino | Proxied |
|---|---|---|---|
| A | ikiss.me | 185.199.108.153 | ❌ (GitHub Pages precisa ser direto) |
| A | ikiss.me | 185.199.109.153 | ❌ |
| A | ikiss.me | 185.199.110.153 | ❌ |
| A | ikiss.me | 185.199.111.153 | ❌ |
| CNAME | www | 22ez0.github.io | ❌ |
| CNAME | api | ikiss-api.onrender.com | ✅ |

---

## IDs e referências rápidas

| Recurso | Valor |
|---|---|
| Cloudflare Account ID | `5a9a17dc69ada45f32c4aa36d4e8fdd9` |
| Cloudflare Zone ID (ikiss.me) | `3f8e4388690c7690170ce02480edb571` |
| Cloudflare Worker | `ikiss-og-worker` |
| Render Service ID | `srv-d7gjdc5ckfvc73ftk79g` |
| Render Service URL | `https://ikiss-api.onrender.com` |
| Neon Project | `faren-prod` (red-flower-60741452, aws-us-west-2) |
| R2 Bucket | `faren-media` |
| R2 Public URL | `https://pub-49759bd8e09c4e0b89e475d23d273d2f.r2.dev` |
| GitHub Repo | `22ez0/ikiss` (branch: main) |
| GitHub Pages branch | `gh-pages` |
| GitHub Pages CNAME | `ikiss.me` |

---

## Secrets necessários

### Replit Secrets (já configurados)
- `GITHUB_TOKEN` — push para `22ez0/ikiss`
- `CLOUDFLARE_API_TOKEN` — DNS + Workers na zona ikiss.me
- `HOSTINGER_API_KEY` — API do Hostinger (nameservers)
- `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` — uploads para R2
- `NEON_DATABASE_URL` — banco de produção (também em `DATABASE_URL`)
- `RENDER_API_KEY` — monitorar deploys no Render
- `NEON_API_KEY` — API do Neon (backups, branches)

### GitHub Actions Secrets (já configurados)
- `CLOUDFLARE_ZONE_ID` = `3f8e4388690c7690170ce02480edb571`
- `CLOUDFLARE_PURGE_TOKEN` — purge de cache pós-deploy
- `GH_TOKEN` — abrir issues de alerta
- `RENDER_API_KEY` — monitorar deploys do Render
- `NEON_DATABASE_URL` — backup diário do banco

---

## Comandos úteis

```bash
# Rodar localmente
pnpm --filter @workspace/faren run dev          # frontend :5000
pnpm --filter @workspace/api-server run dev      # API :8080 (real)
node artifacts/api-server/dev-proxy.mjs          # proxy → prod :8080

# Schema
pnpm --filter @workspace/db run push             # aplica schema no banco local

# Build
pnpm run build                                   # typecheck + build todos os pacotes

# Codegen (após mudar OpenAPI spec)
pnpm --filter @workspace/api-spec run codegen

# Deploy manual no Render
curl -sX POST "https://api.render.com/v1/services/srv-d7gjdc5ckfvc73ftk79g/deploys" \
  -H "Authorization: Bearer $RENDER_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"clearCache":"do_not_clear"}'

# Purge de cache no Cloudflare
curl -sX POST "https://api.cloudflare.com/client/v4/zones/3f8e4388690c7690170ce02480edb571/purge_cache" \
  -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"purge_everything":true}'
```

---

## Fluxo de deploy

1. **Push para `main`** → GitHub Actions dispara automaticamente:
   - `deploy-frontend.yml` → builda e publica no GitHub Pages (gh-pages branch) + purge CF cache
   - `deploy-backend.yml` → Render auto-deploy (watch: api-server/**, lib/**, render.yaml)
2. **Monitor** → `monitor-api-health.yml` roda a cada 5min, abre/fecha issue `api-down`
3. **Backup DB** → `db-backup.yml` roda diariamente às 03:00 UTC, salva no GitHub Actions Artifacts

---

## Notas importantes para devs

- **NUNCA usar `--frozen-lockfile`** no Render — o lockfile muda a cada pacote novo. Build command: `npm install -g pnpm@10 && pnpm install && pnpm --filter @workspace/<pkg> run build`
- **Dark mode** aplicado via `document.documentElement.classList.add("dark")` em `main.tsx`
- **JWT token** armazenado em `localStorage` E cookie `faren_token` (30 dias)
- **Uploads de mídia** → sempre vão para R2, nunca base64 no Postgres
- **Admin panel** → `/devkeefnow` ou `/keefaren` | login: `keefaren` / `Hungria2021@`
- **Após mudança no schema DB** → `pnpm --filter @workspace/db run push`
- **Após mudar OpenAPI spec** → `pnpm --filter @workspace/api-spec run codegen` e corrigir `lib/api-zod/src/index.ts` para exportar só de `./generated/api`
