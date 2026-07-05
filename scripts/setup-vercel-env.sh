#!/usr/bin/env bash
# =============================================================================
# setup-vercel-env.sh
# Inject all production env vars into an existing Vercel project via API.
#
# Usage:
#   VERCEL_TOKEN=vck_... VERCEL_PROJECT_ID=prj_... bash scripts/setup-vercel-env.sh
#
# Required env vars (all already available as Replit secrets):
#   VERCEL_TOKEN          — Vercel personal access token
#   VERCEL_PROJECT_ID     — project ID from vercel.com dashboard (prj_...)
#   NEON_DATABASE_URL     — Neon PostgreSQL connection string
#   SESSION_SECRET        — session signing secret
#   RESEND_API_KEY        — Resend email API key
#   TURNSTILE_SECRET_KEY  — Cloudflare Turnstile secret
#   R2_ACCESS_KEY_ID      — Cloudflare R2 access key
#   R2_SECRET_ACCESS_KEY  — Cloudflare R2 secret key
#   EMAIL_WEBHOOK_SECRET  — email webhook HMAC secret
#
# Optional:
#   ADMIN_PASSWORD        — admin panel password (plaintext, compared directly)
# =============================================================================
set -euo pipefail

API="https://api.vercel.com/v10/projects"
AUTH="Authorization: Bearer ${VERCEL_TOKEN:?VERCEL_TOKEN is required}"
PROJECT_ID="${VERCEL_PROJECT_ID:?VERCEL_PROJECT_ID is required}"

if [ -z "${NEON_DATABASE_URL:-}" ]; then
  echo "ERRO: NEON_DATABASE_URL não definida."
  exit 1
fi

if [ -z "${ADMIN_PASSWORD:-}" ]; then
  echo "AVISO: ADMIN_PASSWORD não definida — a variável não será enviada. Você pode adicioná-la manualmente no dashboard do Vercel."
fi

echo "==> Injetando env vars no projeto Vercel $PROJECT_ID ..."

# Build the JSON array of env vars
VARS='[
  {"key":"NODE_ENV","value":"production","type":"plain","target":["production"]},
  {"key":"DATABASE_URL","value":"'"${NEON_DATABASE_URL}"'","type":"encrypted","target":["production"]},
  {"key":"SESSION_SECRET","value":"'"${SESSION_SECRET:?SESSION_SECRET is required}"'","type":"encrypted","target":["production"]},
  {"key":"ADMIN_LOGIN","value":"keefaren","type":"plain","target":["production"]},
  {"key":"CORS_ALLOWED_ORIGINS","value":"https://ikiss.me,https://www.ikiss.me","type":"plain","target":["production"]},
  {"key":"RATE_LIMIT_WINDOW_MS","value":"60000","type":"plain","target":["production"]},
  {"key":"RATE_LIMIT_MAX","value":"300","type":"plain","target":["production"]},
  {"key":"ENABLE_BOT_BLOCKING","value":"true","type":"plain","target":["production"]},
  {"key":"EMAIL_FROM","value":"Ikiss <no-reply@ikiss.me>","type":"plain","target":["production"]},
  {"key":"RESEND_API_KEY","value":"'"${RESEND_API_KEY:?RESEND_API_KEY is required}"'","type":"encrypted","target":["production"]},
  {"key":"TURNSTILE_SECRET_KEY","value":"'"${TURNSTILE_SECRET_KEY:?TURNSTILE_SECRET_KEY is required}"'","type":"encrypted","target":["production"]},
  {"key":"R2_ACCOUNT_ID","value":"5a9a17dc69ada45f32c4aa36d4e8fdd9","type":"plain","target":["production"]},
  {"key":"R2_BUCKET","value":"faren-media","type":"plain","target":["production"]},
  {"key":"R2_PUBLIC_URL","value":"https://pub-49759bd8e09c4e0b89e475d23d273d2f.r2.dev","type":"plain","target":["production"]},
  {"key":"R2_ACCESS_KEY_ID","value":"'"${R2_ACCESS_KEY_ID:?R2_ACCESS_KEY_ID is required}"'","type":"encrypted","target":["production"]},
  {"key":"R2_SECRET_ACCESS_KEY","value":"'"${R2_SECRET_ACCESS_KEY:?R2_SECRET_ACCESS_KEY is required}"'","type":"encrypted","target":["production"]},
  {"key":"EMAIL_WEBHOOK_SECRET","value":"'"${EMAIL_WEBHOOK_SECRET:?EMAIL_WEBHOOK_SECRET is required}"'","type":"encrypted","target":["production"]},
  {"key":"APP_URL","value":"https://ikiss.me","type":"plain","target":["production"]}
]'

# Add ADMIN_PASSWORD if set
if [ -n "${ADMIN_PASSWORD:-}" ]; then
  VARS=$(echo "$VARS" | jq \
    --arg pw "$ADMIN_PASSWORD" \
    '. + [{"key":"ADMIN_PASSWORD","value":$pw,"type":"encrypted","target":["production"]}]')
fi

RESPONSE=$(curl -sf -X POST "$API/$PROJECT_ID/env" \
  -H "$AUTH" \
  -H "Content-Type: application/json" \
  -d "$VARS" 2>&1) && RC=0 || RC=$?

if [ $RC -ne 0 ]; then
  echo "ERRO ao enviar env vars:"
  echo "$RESPONSE"
  exit 1
fi

echo "✅ Env vars injetadas com sucesso!"
echo ""
echo "==> Disparando redeploy..."

DEPLOY_RESP=$(curl -sf -X POST "https://api.vercel.com/v13/deployments" \
  -H "$AUTH" \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"ikiss-api\",\"project\":\"$PROJECT_ID\",\"target\":\"production\"}" 2>&1) && RC2=0 || RC2=$?

if [ $RC2 -eq 0 ]; then
  DEPLOY_URL=$(echo "$DEPLOY_RESP" | jq -r '.url // empty')
  echo "✅ Deploy disparado${DEPLOY_URL:+ → https://$DEPLOY_URL}"
else
  echo "Redeploy pode precisar ser feito manualmente no dashboard. Env vars foram salvas."
fi

echo ""
echo "Próximos passos:"
echo "  1. Verifique o build no dashboard do Vercel"
echo "  2. Quando o deploy ficar verde, atualize o CNAME api.ikiss.me → <url>.vercel.app"
echo "  3. Adicione VERCEL_PROJECT_ID como GitHub secret para auto-deploy em pushes"
