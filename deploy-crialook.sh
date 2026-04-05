#!/bin/bash
# ═══════════════════════════════════════════════════════
# 🚀 CriaLook — Script de Deploy VPS (Ubuntu 24.04)
# Rodar como root: bash deploy-crialook.sh
# ═══════════════════════════════════════════════════════

set -e

echo "══════════════════════════════════════════"
echo "🚀 CriaLook — Deploy Automático"
echo "══════════════════════════════════════════"

# ── 1. Atualizar sistema ──
echo ""
echo "📦 [1/6] Atualizando sistema..."
apt update && apt upgrade -y
apt install -y curl git build-essential

# ── 2. Instalar Node.js 20 ──
echo ""
echo "📦 [2/6] Instalando Node.js 20..."
if ! command -v node &> /dev/null; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt install -y nodejs
fi
echo "Node: $(node -v) | NPM: $(npm -v)"

# ── 3. Instalar PM2 ──
echo ""
echo "📦 [3/6] Instalando PM2..."
npm install -g pm2

# ── 4. Clonar e buildar projeto ──
echo ""
echo "📦 [4/6] Clonando projeto..."
cd /root
if [ -d "Agencia-Fashion" ]; then
  echo "Projeto já existe, atualizando..."
  cd Agencia-Fashion
  git pull
else
  git clone https://github.com/Tibic4/Agencia-Fashion.git
  cd Agencia-Fashion
fi

cd campanha-ia
echo "📦 Instalando dependências..."
npm install

echo ""
echo "══════════════════════════════════════════"
echo "⚠️  IMPORTANTE: Configure o .env.local agora!"
echo "══════════════════════════════════════════"
echo ""
echo "Copie o conteúdo do seu .env.local local para:"
echo "  /root/Agencia-Fashion/campanha-ia/.env.local"
echo ""
echo "Use: nano /root/Agencia-Fashion/campanha-ia/.env.local"
echo "Cole tudo, salve com Ctrl+O, Enter, Ctrl+X"
echo ""
read -p "Pressione ENTER quando o .env.local estiver configurado..."

# Build
echo ""
echo "🔨 Buildando projeto..."
npm run build

# ── 5. Configurar PM2 ──
echo ""
echo "📦 [5/6] Configurando PM2..."
pm2 delete crialook 2>/dev/null || true
pm2 start npm --name "crialook" -- start
pm2 save
pm2 startup systemd -u root --hp /root | tail -1 | bash

# ── 6. Configurar Nginx ──
echo ""
echo "📦 [6/6] Configurando Nginx..."
apt install -y nginx

cat > /etc/nginx/sites-available/crialook << 'NGINX'
server {
    listen 80;
    server_name crialook.com.br www.crialook.com.br _;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 120s;
        proxy_send_timeout 120s;
        client_max_body_size 15M;
    }
}
NGINX

# Ativar site
ln -sf /etc/nginx/sites-available/crialook /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

echo ""
echo "══════════════════════════════════════════"
echo "✅ DEPLOY CONCLUÍDO!"
echo "══════════════════════════════════════════"
echo ""
echo "🌐 Acesse: http://191.252.159.29"
echo ""
echo "📋 Próximos passos:"
echo "  1. Apontar DNS crialook.com.br → 191.252.159.29"
echo "  2. Instalar SSL: sudo certbot --nginx -d crialook.com.br"
echo "     (instalar certbot: apt install certbot python3-certbot-nginx)"
echo ""
echo "🔧 Comandos úteis:"
echo "  pm2 status          → ver se está rodando"
echo "  pm2 logs crialook   → ver logs"
echo "  pm2 restart crialook → reiniciar app"
echo ""
