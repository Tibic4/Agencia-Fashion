#!/bin/bash
# ═══════════════════════════════════════════════════════
# 🚀 CriaLook — Script de Deploy VPS (Ubuntu 24.04)
# Rodar como root: bash deploy-crialook.sh
# Inclui: SSL automático, health check, PM2, Nginx
# ═══════════════════════════════════════════════════════

set -e

DOMAIN="crialook.com.br"
APP_NAME="crialook"
APP_PORT=3000
REPO_URL="https://github.com/Tibic4/Agencia-Fashion.git"
PROJECT_DIR="/root/Agencia-Fashion"
APP_DIR="$PROJECT_DIR/campanha-ia"

echo "══════════════════════════════════════════"
echo "🚀 CriaLook — Deploy Automático v2"
echo "══════════════════════════════════════════"

# ── 1. Atualizar sistema ──
echo ""
echo "📦 [1/8] Atualizando sistema..."
apt update && apt upgrade -y
apt install -y curl git build-essential ufw

# ── 2. Firewall ──
echo ""
echo "🔒 [2/8] Configurando firewall..."
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw --force enable

# ── 3. Instalar Node.js 20 ──
echo ""
echo "📦 [3/8] Instalando Node.js 20..."
if ! command -v node &> /dev/null; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt install -y nodejs
fi
echo "Node: $(node -v) | NPM: $(npm -v)"

# ── 4. Instalar PM2 ──
echo ""
echo "📦 [4/8] Instalando PM2..."
npm install -g pm2

# ── 5. Clonar e buildar projeto ──
echo ""
echo "📦 [5/8] Clonando projeto..."
cd /root
if [ -d "Agencia-Fashion" ]; then
  echo "Projeto já existe, atualizando..."
  cd Agencia-Fashion
  git pull
else
  git clone "$REPO_URL"
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
echo "  $APP_DIR/.env.local"
echo ""
echo "Use: nano $APP_DIR/.env.local"
echo "Cole tudo, salve com Ctrl+O, Enter, Ctrl+X"
echo ""

if [ ! -f ".env.local" ]; then
  read -p "Pressione ENTER quando o .env.local estiver configurado..."
fi

# Build
echo ""
echo "🔨 Buildando projeto..."
npm run build

# ── 6. Configurar PM2 ──
echo ""
echo "📦 [6/8] Configurando PM2..."
pm2 delete "$APP_NAME" 2>/dev/null || true
pm2 start npm --name "$APP_NAME" -- start
pm2 save
pm2 startup systemd -u root --hp /root | tail -1 | bash 2>/dev/null || true

# Verificar se app está rodando
echo "⏳ Aguardando app iniciar..."
sleep 5
if curl -s http://localhost:$APP_PORT/api/health > /dev/null 2>&1; then
  echo "✅ App rodando e saudável!"
else
  echo "⚠️  App pode estar inicializando... verifique: pm2 logs $APP_NAME"
fi

# ── 7. Configurar Nginx ──
echo ""
echo "📦 [7/8] Configurando Nginx..."
apt install -y nginx

cat > /etc/nginx/sites-available/$APP_NAME << 'NGINX'
server {
    listen 80;
    server_name crialook.com.br www.crialook.com.br _;

    # Rate limiting
    limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # Health check (sem rate limit)
    location = /api/health {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        access_log off;
    }

    # Webhook endpoints (sem rate limit, precisam funcionar sempre)
    location ~ ^/api/webhook {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 30s;
        client_max_body_size 1M;
    }

    # API routes (com rate limit)
    location /api/ {
        limit_req zone=api burst=20 nodelay;
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

    # Static + pages
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
        proxy_read_timeout 60s;
        client_max_body_size 15M;
    }

    # Cache para assets estáticos
    location /_next/static/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_cache_valid 200 365d;
        add_header Cache-Control "public, max-age=31536000, immutable";
    }
}
NGINX

# Ativar site
ln -sf /etc/nginx/sites-available/$APP_NAME /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

# ── 8. SSL com Certbot (Let's Encrypt) ──
echo ""
echo "🔒 [8/8] Configurando SSL..."
apt install -y certbot python3-certbot-nginx

# Tentar obter certificado SSL
echo ""
echo "Tentando obter certificado SSL para $DOMAIN..."
if certbot --nginx -d "$DOMAIN" -d "www.$DOMAIN" --non-interactive --agree-tos --email admin@$DOMAIN --redirect 2>/dev/null; then
  echo "✅ SSL configurado com sucesso!"
  echo "🔄 Configurando renovação automática..."
  systemctl enable certbot.timer
  systemctl start certbot.timer
else
  echo ""
  echo "⚠️  SSL falhou (DNS pode não estar apontando ainda)."
  echo "   Para configurar manualmente depois:"
  echo "   certbot --nginx -d $DOMAIN -d www.$DOMAIN"
  echo ""
fi

# ── Cron para health check ──
echo ""
echo "⏰ Configurando health check automático..."
cat > /root/health-check.sh << 'HEALTH'
#!/bin/bash
RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/health)
if [ "$RESPONSE" != "200" ]; then
  echo "[$(date)] ⚠️ Health check falhou (HTTP $RESPONSE) — reiniciando app..."
  pm2 restart crialook
fi
HEALTH
chmod +x /root/health-check.sh

# Rodar a cada 5 minutos
(crontab -l 2>/dev/null | grep -v health-check; echo "*/5 * * * * /root/health-check.sh >> /root/health-check.log 2>&1") | crontab -

echo ""
echo "══════════════════════════════════════════"
echo "✅ DEPLOY CONCLUÍDO!"
echo "══════════════════════════════════════════"
echo ""
echo "🌐 Acesse: https://$DOMAIN"
echo "💚 Health: https://$DOMAIN/api/health"
echo ""
echo "🔧 Comandos úteis:"
echo "  pm2 status              → ver se está rodando"
echo "  pm2 logs $APP_NAME      → ver logs em tempo real"
echo "  pm2 restart $APP_NAME   → reiniciar app"
echo "  certbot renew --dry-run → testar renovação SSL"
echo ""
echo "📋 Webhook URLs (configurar no Clerk e Mercado Pago):"
echo "  Clerk:       https://$DOMAIN/api/webhook/clerk"
echo "  Mercado Pago: https://$DOMAIN/api/webhooks/mercadopago"
echo ""
echo "🔄 Para redeploy futuro:"
echo "  cd $APP_DIR && git pull && npm install && npm run build && pm2 restart $APP_NAME"
echo ""
