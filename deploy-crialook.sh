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

# Usuário que vai rodar Next.js + PM2.
#
# Default mantém o status quo (root) pra não quebrar deploy existente — mas
# rodar Next.js + pipeline IA como root é blast radius desnecessário. Quando
# for migrar pra um host limpo, exporte:
#
#   DEPLOY_USER=crialook bash deploy-crialook.sh
#
# E o script cria o usuário sem shell, instala em /srv/crialook, e configura
# PM2 sob ele. Migrar host EXISTENTE de root pra usuário dedicado precisa de
# planejamento (mover certs, ajustar ownership de /var/log/crialook, mudar
# pm2 startup) — não é hot-swap.
DEPLOY_USER="${DEPLOY_USER:-root}"

if [ "$DEPLOY_USER" = "root" ]; then
  PROJECT_DIR="/root/Agencia-Fashion"
else
  PROJECT_DIR="/srv/$APP_NAME/Agencia-Fashion"
fi
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

# ── 3. Instalar Node.js 24 LTS ──
echo ""
echo "📦 [3/8] Instalando Node.js 24 LTS..."
# Node 20 saiu de suporte em abril/2026. Usar 24 LTS (ativo) ou 22 LTS (manutenção até abril/2027).
if ! command -v node &> /dev/null; then
  curl -fsSL https://deb.nodesource.com/setup_24.x | bash -
  apt install -y nodejs
fi
echo "Node: $(node -v) | NPM: $(npm -v)"

# ── 4. Instalar PM2 ──
echo ""
echo "📦 [4/8] Instalando PM2..."
npm install -g pm2

# ── 5. Clonar e buildar projeto ──
echo ""
echo "📦 [5/8] Clonando projeto (usuário: $DEPLOY_USER, dir: $PROJECT_DIR)..."

# Cria usuário dedicado se for opt-in (DEPLOY_USER != root).
if [ "$DEPLOY_USER" != "root" ]; then
  if ! id "$DEPLOY_USER" &>/dev/null; then
    echo "Criando usuário sem shell: $DEPLOY_USER"
    useradd -r -s /usr/sbin/nologin -m -d "/srv/$APP_NAME" "$DEPLOY_USER"
  fi
  mkdir -p "/srv/$APP_NAME"
  chown -R "$DEPLOY_USER:$DEPLOY_USER" "/srv/$APP_NAME"
fi

PARENT_DIR=$(dirname "$PROJECT_DIR")
mkdir -p "$PARENT_DIR"
cd "$PARENT_DIR"
if [ -d "$PROJECT_DIR" ]; then
  echo "Projeto já existe, atualizando..."
  cd "$PROJECT_DIR"
  git pull
else
  git clone "$REPO_URL" "$(basename "$PROJECT_DIR")"
  cd "$PROJECT_DIR"
fi
if [ "$DEPLOY_USER" != "root" ]; then
  chown -R "$DEPLOY_USER:$DEPLOY_USER" "$PROJECT_DIR"
fi

cd campanha-ia
echo "📦 Instalando dependências (deterministic via npm ci)..."
npm ci

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
echo "📦 [6/8] Configurando PM2 via ecosystem.config.js (usuário: $DEPLOY_USER)..."
# Usar ecosystem.config.js (raiz do repo) garante: max_memory_restart, kill_timeout
# (graceful shutdown 30s pra pipeline IA), backoff exponencial, log paths
# estruturados, autorestart. Se trocássemos por `pm2 start npm ...` perderíamos
# tudo isso silenciosamente.
mkdir -p /var/log/crialook
if [ "$DEPLOY_USER" != "root" ]; then
  chown -R "$DEPLOY_USER:$DEPLOY_USER" /var/log/crialook
fi

if [ "$DEPLOY_USER" = "root" ]; then
  pm2 delete "$APP_NAME" 2>/dev/null || true
  CRIALOOK_HOME="$PROJECT_DIR" pm2 start "$PROJECT_DIR/ecosystem.config.js" --env production
  pm2 save
  pm2 startup systemd -u root --hp /root | tail -1 | bash 2>/dev/null || true
else
  HOME_DIR="/srv/$APP_NAME"
  sudo -u "$DEPLOY_USER" -H bash -c "pm2 delete '$APP_NAME' 2>/dev/null || true"
  sudo -u "$DEPLOY_USER" -H CRIALOOK_HOME="$PROJECT_DIR" \
    bash -c "pm2 start '$PROJECT_DIR/ecosystem.config.js' --env production"
  sudo -u "$DEPLOY_USER" -H bash -c "pm2 save"
  # systemd unit que chama pm2 resurrect como o usuário dedicado
  pm2 startup systemd -u "$DEPLOY_USER" --hp "$HOME_DIR" | tail -1 | bash 2>/dev/null || true
fi

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
apt install -y nginx certbot python3-certbot-nginx
# Brotli é opcional mas a config canônica usa. Ignora silenciosamente se não disponível na distro.
apt install -y libnginx-mod-http-brotli-filter libnginx-mod-http-brotli-static 2>/dev/null || \
  echo "⚠️  brotli modules não disponíveis nesta distro — nginx vai falhar no 'brotli on'. Comentar essas linhas em $PROJECT_DIR/nginx-crialook.conf se necessário."

CANONICAL_NGINX="$PROJECT_DIR/nginx-crialook.conf"
SSL_CERT="/etc/letsencrypt/live/$DOMAIN/fullchain.pem"

if [ -f "$SSL_CERT" ]; then
  # ── Certs já existem: aplica config canônica direto ──
  echo "🔐 Certificados Let's Encrypt já presentes — aplicando config canônica."
  cp "$CANONICAL_NGINX" /etc/nginx/sites-available/$APP_NAME
  ln -sf /etc/nginx/sites-available/$APP_NAME /etc/nginx/sites-enabled/
  rm -f /etc/nginx/sites-enabled/default
  nginx -t && systemctl reload nginx
  CERTBOT_NEEDED=false
else
  # ── Primeiro deploy: bootstrap HTTP-only pro certbot challenge funcionar ──
  echo "🔐 Sem certificados ainda — bootstrap HTTP-only pra certbot."
  cat > /etc/nginx/sites-available/$APP_NAME << 'BOOTSTRAP_NGINX'
server {
    listen 80;
    listen [::]:80;
    server_name crialook.com.br www.crialook.com.br;

    location /.well-known/acme-challenge/ {
        root /var/www/html;
    }

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        # IMPORTANTE: sobrescreve X-Forwarded-For pra impedir IP spoofing.
        # NÃO usar $proxy_add_x_forwarded_for aqui (cliente injetaria header).
        proxy_set_header X-Forwarded-For $remote_addr;
        proxy_set_header X-Forwarded-Proto $scheme;
        client_max_body_size 25M;
    }
}
BOOTSTRAP_NGINX
  mkdir -p /var/www/html
  ln -sf /etc/nginx/sites-available/$APP_NAME /etc/nginx/sites-enabled/
  rm -f /etc/nginx/sites-enabled/default
  nginx -t && systemctl reload nginx
  CERTBOT_NEEDED=true
fi

# ── 8. SSL com Certbot (Let's Encrypt) ──
echo ""
echo "🔒 [8/8] Configurando SSL..."

if [ "$CERTBOT_NEEDED" = "true" ]; then
  echo "Obtendo certificado SSL para $DOMAIN via webroot challenge..."
  # certonly --webroot: só obtém certs, não toca em nginx.conf.
  # Depois aplicamos a config canônica que já tem os listeners SSL.
  if certbot certonly --webroot -w /var/www/html \
       -d "$DOMAIN" -d "www.$DOMAIN" \
       --non-interactive --agree-tos --email admin@$DOMAIN; then
    echo "✅ Certs obtidos. Aplicando config canônica com SSL..."
    cp "$CANONICAL_NGINX" /etc/nginx/sites-available/$APP_NAME
    nginx -t && systemctl reload nginx
    echo "🔄 Configurando renovação automática..."
    systemctl enable certbot.timer
    systemctl start certbot.timer
  else
    echo ""
    echo "⚠️  SSL falhou (DNS pode não estar apontando ainda)."
    echo "   Quando DNS propagar, rodar manualmente:"
    echo "     certbot certonly --webroot -w /var/www/html -d $DOMAIN -d www.$DOMAIN"
    echo "     cp $CANONICAL_NGINX /etc/nginx/sites-available/$APP_NAME"
    echo "     nginx -t && systemctl reload nginx"
    echo ""
  fi
else
  echo "✅ SSL já configurado (config canônica já aplicada)."
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
echo "  Clerk:        https://$DOMAIN/api/webhooks/clerk"
echo "  Mercado Pago: https://$DOMAIN/api/webhooks/mercadopago"
echo ""
echo "🔄 Para redeploy futuro:"
echo "  cd $APP_DIR && git pull && npm ci && npm run build && pm2 reload $APP_NAME"
echo ""
