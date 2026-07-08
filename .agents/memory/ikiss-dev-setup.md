---
name: Ikiss dev setup no Replit
description: Como o ambiente de desenvolvimento do Ikiss funciona no Replit e o que é necessário para uploads R2 funcionarem
---

# Ikiss dev setup no Replit

## Regra
A API local (porta 8000) DEVE estar rodando para uploads de foto/música/banner funcionarem. O Vite proxy encaminha `/api` para `localhost:8000`. Sem a API local, requests vão para api.ikiss.me (Render, suspenso).

**Why:** O projeto usa Cloudflare R2 para todo o media. O endpoint `POST /api/profile/upload` só funciona com `R2_ACCESS_KEY_ID` e `R2_SECRET_ACCESS_KEY` presentes no processo — que são Replit Secrets injetados automaticamente no workflow `API Server`.

**How to apply:**
- Workflow `API Server`: `PORT=8000 bash artifacts/api-server/start-local.sh` (porta 8000)
- Workflow frontend: `artifacts/ikiss: web` (porta 21395, gerenciado pelo artifact)
- O workflow `Project` deve referenciar `artifacts/ikiss: web`, não `ikiss: web` (conflito de porta)
- Após qualquer mudança no `artifacts/api-server/src/`, rebuildar com `pnpm --filter @workspace/api-server run build` antes de reiniciar o workflow

## Credenciais R2 (não-secretas, em .replit userenv.shared)
- R2_ACCOUNT_ID: 5a9a17dc69ada45f32c4aa36d4e8fdd9
- R2_BUCKET: faren-media (nome real no Cloudflare — não alterar sem migrar o bucket)
- R2_PUBLIC_URL: https://pub-49759bd8e09c4e0b89e475d23d273d2f.r2.dev

## Credenciais sensíveis (Replit Secrets)
- R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY — upload de mídia
- ADMIN_PASSWORD, ADMIN_SECRET — painel admin /devkeefnow
- NEON_DATABASE_URL — banco PostgreSQL

## Prefixos de upload aceitos pelo backend
avatars, banners, backgrounds, music, icons, stories, publications, gallery
(corrigido em artifacts/api-server/src/routes/profiles.ts)
