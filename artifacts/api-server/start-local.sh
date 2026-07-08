#!/bin/bash
# Inicia o API server real localmente usando o banco Neon.
# Usado pelo workflow "artifacts/api-server: API Server" em dev.
set -e

cd "$(dirname "$0")"

# Mapear NEON_DATABASE_URL → DATABASE_URL (Replit secret → env var da API)
export DATABASE_URL="${NEON_DATABASE_URL:-}"
export NODE_ENV=development
export PORT="${PORT:-8000}"

# Valores fixos (não-secretos)
export R2_ACCOUNT_ID="5a9a17dc69ada45f32c4aa36d4e8fdd9"
export R2_BUCKET="ikiss-media"
export R2_PUBLIC_URL="https://api.ikiss.me/api/cdn"
export APP_URL="https://ikiss.me"
export CORS_ALLOWED_ORIGINS="https://ikiss.me,https://www.ikiss.me"
export RATE_LIMIT_WINDOW_MS="60000"
export RATE_LIMIT_MAX="300"
export ENABLE_BOT_BLOCKING="false"
export EMAIL_FROM="Ikiss <suporte@ikiss.me>"

# Validar que DATABASE_URL está disponível
if [ -z "$DATABASE_URL" ]; then
  echo "ERRO: NEON_DATABASE_URL não está configurado como secret no Replit." >&2
  exit 1
fi

# Se não tiver build, fazer agora
if [ ! -f "./dist/index.mjs" ]; then
  echo "[start-local] Sem build encontrado, buildando..."
  cd ../..
  pnpm --filter @workspace/api-server run build
  cd artifacts/api-server
fi

echo "[start-local] Iniciando API local em :$PORT → Neon DB"
exec node --enable-source-maps ./dist/index.mjs
