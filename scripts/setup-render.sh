#!/bin/bash
# Ikiss — Setup do serviço no Render via API
#
# Pré-requisitos:
#   1. Conta Render criada com cartão adicionado (obrigatório para criar serviços)
#   2. Render GitHub App instalado na conta GitHub 22ez0:
#      https://github.com/apps/render/installations/new
#   3. Variáveis de ambiente configuradas:
#      RENDER_API_KEY, NEON_DATABASE_URL, SESSION_SECRET, RESEND_API_KEY,
#      TURNSTILE_SECRET_KEY, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY,
#      EMAIL_WEBHOOK_SECRET, ADMIN_PASSWORD_HASH
#
# Uso:
#   RENDER_API_KEY=rnd_xxx bash scripts/setup-render.sh
#
set -euo pipefail

API_KEY="${RENDER_API_KEY:?RENDER_API_KEY must be set}"
OWNER_ID="tea-d94lhg8js32c73epf53g"  # reumally@outlook.com.br

echo "==> [1/3] Criando serviço ikiss-api no Render..."
RESPONSE=$(curl -s -X POST "https://api.render.com/v1/services" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"type\": \"web_service\",
    \"name\": \"ikiss-api\",
    \"ownerId\": \"$OWNER_ID\",
    \"repo\": \"https://github.com/22ez0/ikiss\",
    \"branch\": \"main\",
    \"region\": \"oregon\",
    \"plan\": \"free\",
    \"serviceDetails\": {
      \"runtime\": \"node\",
      \"envSpecificDetails\": {
        \"buildCommand\": \"npm install -g pnpm@10 && pnpm install && pnpm --filter @workspace/api-server run build\",
        \"startCommand\": \"node --enable-source-maps artifacts/api-server/dist/index.mjs\"
      },
      \"healthCheckPath\": \"/api/healthz\",
      \"autoDeploy\": \"yes\"
    }
  }")

echo "Render response: $RESPONSE"

SERVICE_ID=$(echo "$RESPONSE" | node -e "
const c=[];process.stdin.on('data',d=>c.push(d));process.stdin.on('end',()=>{
  try{const d=JSON.parse(Buffer.concat(c));
  console.log(d.service?.id||d.id||'');}catch{console.log('');}
})" 2>/dev/null || echo "")

if [ -z "$SERVICE_ID" ]; then
  echo "ERRO: não foi possível criar o serviço. Verifique:"
  echo "  - Cartão adicionado em dashboard.render.com/billing"
  echo "  - GitHub App instalado em github.com/apps/render/installations/new"
  echo "Resposta: $RESPONSE"
  exit 1
fi

echo "==> Serviço criado: $SERVICE_ID"

echo "==> [2/3] Configurando variáveis de ambiente..."

if [ -z "${ADMIN_PASSWORD:-}" ]; then
  echo "ERRO: variável ADMIN_PASSWORD não definida. Defina-a antes de rodar o script."
  exit 1
fi

curl -sf -X PUT "https://api.render.com/v1/services/$SERVICE_ID/env-vars" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d "[
    {\"key\":\"NODE_ENV\",\"value\":\"production\"},
    {\"key\":\"PORT\",\"value\":\"10000\"},
    {\"key\":\"DATABASE_URL\",\"value\":\"${NEON_DATABASE_URL}\"},
    {\"key\":\"SESSION_SECRET\",\"value\":\"${SESSION_SECRET}\"},
    {\"key\":\"ADMIN_LOGIN\",\"value\":\"keefaren\"},
    {\"key\":\"ADMIN_PASSWORD\",\"value\":\"${ADMIN_PASSWORD}\"},
    {\"key\":\"CORS_ALLOWED_ORIGINS\",\"value\":\"https://ikiss.me,https://www.ikiss.me\"},
    {\"key\":\"RATE_LIMIT_WINDOW_MS\",\"value\":\"60000\"},
    {\"key\":\"RATE_LIMIT_MAX\",\"value\":\"300\"},
    {\"key\":\"ENABLE_BOT_BLOCKING\",\"value\":\"true\"},
    {\"key\":\"EMAIL_FROM\",\"value\":\"Ikiss <no-reply@ikiss.me>\"},
    {\"key\":\"RESEND_API_KEY\",\"value\":\"${RESEND_API_KEY}\"},
    {\"key\":\"TURNSTILE_SECRET_KEY\",\"value\":\"${TURNSTILE_SECRET_KEY}\"},
    {\"key\":\"R2_ACCOUNT_ID\",\"value\":\"5a9a17dc69ada45f32c4aa36d4e8fdd9\"},
    {\"key\":\"R2_BUCKET\",\"value\":\"faren-media\"},
    {\"key\":\"R2_PUBLIC_URL\",\"value\":\"https://pub-49759bd8e09c4e0b89e475d23d273d2f.r2.dev\"},
    {\"key\":\"R2_ACCESS_KEY_ID\",\"value\":\"${R2_ACCESS_KEY_ID}\"},
    {\"key\":\"R2_SECRET_ACCESS_KEY\",\"value\":\"${R2_SECRET_ACCESS_KEY}\"},
    {\"key\":\"EMAIL_WEBHOOK_SECRET\",\"value\":\"${EMAIL_WEBHOOK_SECRET}\"},
    {\"key\":\"APP_URL\",\"value\":\"https://ikiss.me\"}
  ]" | node -e "const c=[];process.stdin.on('data',d=>c.push(d));process.stdin.on('end',()=>console.log('Env vars:', JSON.parse(Buffer.concat(c)).length||'ok'))"

echo "==> [3/3] Deploy iniciado automaticamente (autoDeploy: yes)."
echo ""
echo "Próximos passos:"
echo "  1. Aguardar deploy em: https://dashboard.render.com/web/$SERVICE_ID"
echo "  2. Atualizar secret RENDER_SERVICE_ID no GitHub: $SERVICE_ID"
echo "  3. Verificar healthz: https://ikiss-api.onrender.com/api/healthz"
echo "  4. Se a URL do serviço for diferente de ikiss-api.onrender.com,"
echo "     atualizar o CNAME api.ikiss.me no Cloudflare e a var BACKENDS no Worker."
