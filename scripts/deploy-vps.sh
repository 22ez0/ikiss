#!/bin/bash
# =============================================================================
# deploy-vps.sh — Executado no VPS pelo GitHub Actions a cada push em main
# Não execute manualmente — use o workflow deploy-vps.yml
# =============================================================================
set -euo pipefail

APP_DIR="/opt/faren"
cd "$APP_DIR"

echo "==> Atualizando código..."
git fetch origin main
git reset --hard origin/main

echo "==> Buildando e subindo containers (zero-downtime)..."
docker compose build api
docker compose up -d --no-deps api

echo "==> Aguardando healthcheck..."
for i in $(seq 1 20); do
  if docker compose exec -T api wget -qO- http://localhost:3000/api/healthz > /dev/null 2>&1; then
    echo "==> API saudável após ${i}x verificação."
    break
  fi
  if [ "$i" -eq 20 ]; then
    echo "ERRO: API não ficou saudável em tempo hábil. Revertendo..."
    docker compose restart api
    exit 1
  fi
  echo "    Aguardando... ($i/20)"
  sleep 3
done

echo "==> Deploy concluído com sucesso."
docker compose ps
