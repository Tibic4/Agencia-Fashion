#!/bin/bash
# ═══════════════════════════════════════
# CriaLook — Deploy Script para VPS
# ═══════════════════════════════════════
# Uso: ssh user@vps 'bash -s' < deploy/deploy.sh
#
# Pré-requisitos na VPS:
#   - Docker + Docker Compose
#   - Nginx
#   - Certbot (SSL)
#   - Git

set -e

APP_DIR="/opt/crialook"
REPO="https://github.com/Tibic4/Agencia-Fashion.git"

echo "🚀 Deploy CriaLook iniciando..."

# 1. Clone ou pull
if [ -d "$APP_DIR" ]; then
  echo "📦 Atualizando código..."
  cd "$APP_DIR"
  git pull origin main
else
  echo "📦 Clonando repositório..."
  git clone "$REPO" "$APP_DIR"
  cd "$APP_DIR"
fi

cd "$APP_DIR/campanha-ia"

# 2. Verificar .env.local
if [ ! -f .env.local ]; then
  echo "⚠️  .env.local não encontrado!"
  echo "   Copie o .env.example e preencha:"
  echo "   cp .env.example .env.local && nano .env.local"
  exit 1
fi

# 3. Build e start com Docker
echo "🐳 Construindo imagem Docker..."
docker compose down 2>/dev/null || true
docker compose up -d --build

# 4. Verificar se está rodando
echo "⏳ Aguardando app iniciar..."
sleep 5
if curl -sf http://localhost:3000 > /dev/null; then
  echo "✅ CriaLook rodando em http://localhost:3000"
else
  echo "❌ App não respondeu. Verificar logs:"
  echo "   docker compose logs -f"
  exit 1
fi

# 5. Configurar Nginx (primeira vez)
NGINX_CONF="/etc/nginx/sites-available/crialook"
if [ ! -f "$NGINX_CONF" ]; then
  echo "🔧 Configurando Nginx..."
  cp deploy/nginx.conf "$NGINX_CONF"
  ln -sf "$NGINX_CONF" /etc/nginx/sites-enabled/crialook
  nginx -t && systemctl reload nginx
  
  # SSL com Certbot
  echo "🔒 Gerando certificado SSL..."
  certbot --nginx -d crialook.com.br -d www.crialook.com.br --non-interactive --agree-tos
fi

echo ""
echo "═══════════════════════════════════════"
echo "✅ Deploy concluído!"
echo "   🌐 https://crialook.com.br"
echo "═══════════════════════════════════════"
