#!/bin/bash
# =============================================================================
# setup-vps.sh — Configuração inicial do VPS Hostinger para o Faren
# Execute UMA VEZ como root no VPS recém-criado:
#   curl -fsSL https://raw.githubusercontent.com/22ez0/faren/main/scripts/setup-vps.sh | bash
# =============================================================================
set -euo pipefail

REPO="https://github.com/22ez0/faren.git"
APP_DIR="/opt/faren"
DOMAIN="api.faren.com.br"
EMAIL="vgss.lly@gmail.com"

echo "==> [1/7] Atualizando pacotes..."
apt-get update -y && apt-get upgrade -y

echo "==> [2/7] Instalando dependências..."
apt-get install -y curl git ufw

echo "==> [3/7] Instalando Docker..."
curl -fsSL https://get.docker.com | sh
systemctl enable docker
systemctl start docker

echo "==> [4/7] Configurando firewall (UFW)..."
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

echo "==> [5/7] Clonando repositório..."
git clone "$REPO" "$APP_DIR"
cd "$APP_DIR"

echo "==> [6/7] Criando .env.production..."
cat > "$APP_DIR/.env.production" << 'ENVEOF'
# Preencha os valores abaixo antes de fazer deploy
NODE_ENV=production
PORT=3000
DATABASE_URL=
SESSION_SECRET=
ADMIN_SECRET=
ADMIN_LOGIN=keefaren
ADMIN_PASSWORD=
CORS_ALLOWED_ORIGINS=https://faren.com.br,https://www.faren.com.br
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX=300
ENABLE_BOT_BLOCKING=true
EMAIL_FROM=Faren <no-reply@faren.com.br>
RESEND_API_KEY=
TURNSTILE_SECRET_KEY=
R2_ACCOUNT_ID=5a9a17dc69ada45f32c4aa36d4e8fdd9
R2_BUCKET=faren-media
R2_PUBLIC_URL=https://pub-49759bd8e09c4e0b89e475d23d273d2f.r2.dev
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
DISCORD_BOT_TOKEN=
DISCORD_CLIENT_ID=1500071757925584996
DISCORD_CLIENT_SECRET=
DISCORD_REDIRECT_URI=https://faren.com.br/
ENVEOF

echo ""
echo "========================================================"
echo " IMPORTANTE: edite o arquivo abaixo com seus segredos:"
echo "   nano $APP_DIR/.env.production"
echo "========================================================"
echo ""

echo "==> [7/7] Obtendo certificado SSL (Let's Encrypt)..."
mkdir -p "$APP_DIR/nginx/certs"

# Sobe nginx só na porta 80 pra validar o domínio
docker run --rm -p 80:80 \
  -v "$APP_DIR/nginx/certs:/etc/letsencrypt" \
  certbot/certbot certonly \
  --standalone \
  --non-interactive \
  --agree-tos \
  --email "$EMAIL" \
  -d "$DOMAIN"

echo ""
echo "==> Setup concluído!"
echo ""
echo "Próximos passos:"
echo "  1. Edite $APP_DIR/.env.production com seus segredos reais"
echo "  2. Execute: cd $APP_DIR && docker compose up -d --build"
echo "  3. Configure os segredos no GitHub Actions (ver README)"
echo ""
echo "Renovação de SSL já está configurada automaticamente via certbot container."
