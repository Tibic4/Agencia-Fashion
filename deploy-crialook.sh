#!/bin/bash
# ═══════════════════════════════════════════════════════
# 🚀 CriaLook — Script de Deploy VPS (Ubuntu 24.04)
# Rodar como root: bash deploy-crialook.sh
# Inclui: SSL automático, health check, PM2, Nginx
# ═══════════════════════════════════════════════════════

set -e

# ── Log capture for trap context ──
# Tee everything to /tmp/crialook-deploy.log so the EXIT/ERR traps can include
# the last few lines in the Discord notification.
exec > >(tee /tmp/crialook-deploy.log) 2>&1

# ── Duration timer ──
SECONDS=0

# ── Discord notification helper (D-04, D-05, D-07) ──
# DISCORD_WEBHOOK_URL is owner-provisioned on the server (NOT in repo).
# If the env var is missing, this helper warns once and no-ops on every call —
# deploys must NEVER fail because Discord is down or the URL is missing.
DISCORD_WARN_LOGGED=false
if command -v jq >/dev/null 2>&1; then
  notify_discord() {
    local message="$1"
    local color="${2:-3447003}"  # 3447003 = blue (default), 3066993 = green, 15158332 = red, 16776960 = yellow
    if [ -z "${DISCORD_WEBHOOK_URL:-}" ]; then
      if [ "$DISCORD_WARN_LOGGED" = "false" ]; then
        echo "⚠ DISCORD_WEBHOOK_URL not set — Discord notifications disabled. Owner must export it on the server (see ops/deploy.md)."
        DISCORD_WARN_LOGGED=true
      fi
      return 0
    fi
    curl -fsS -X POST -H "Content-Type: application/json" \
      --max-time 5 \
      -d "{\"embeds\":[{\"title\":\"CriaLook Deploy\",\"description\":$(printf '%s' "$message" | jq -Rs .),\"color\":$color}]}" \
      "$DISCORD_WEBHOOK_URL" > /dev/null || true
  }
else
  # Fallback if jq absent: simple text content (lossy but functional)
  notify_discord() {
    local message="$1"
    if [ -z "${DISCORD_WEBHOOK_URL:-}" ]; then
      if [ "$DISCORD_WARN_LOGGED" = "false" ]; then
        echo "⚠ DISCORD_WEBHOOK_URL not set — Discord notifications disabled."
        DISCORD_WARN_LOGGED=true
      fi
      return 0
    fi
    # Strip newlines + escape double-quotes for JSON safety
    local safe
    safe=$(printf '%s' "$message" | tr '\n' ' ' | sed 's/"/\\"/g')
    curl -fsS -X POST -H "Content-Type: application/json" \
      --max-time 5 \
      -d "{\"content\":\"$safe\"}" \
      "$DISCORD_WEBHOOK_URL" > /dev/null || true
  }
fi

# ── EXIT/ERR traps (D-04, D-05) ──
DEPLOY_FAILED=false
on_error() {
  DEPLOY_FAILED=true
}
on_exit() {
  local exit_code=$?
  if [ "$DEPLOY_FAILED" = "true" ] || [ $exit_code -ne 0 ]; then
    local last_err
    last_err=$(tail -5 /tmp/crialook-deploy.log 2>/dev/null | tr '\n' ' ' | head -c 500)
    notify_discord "🚨 Deploy FAILED (exit=$exit_code, ${SECONDS}s) — last log: $last_err" 15158332
  fi
}
trap on_error ERR
trap on_exit EXIT

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
# pm2 startup) — não é hot-swap. Plan 08-08 doc cobre o cutover.
DEPLOY_USER="${DEPLOY_USER:-root}"

if [ "$DEPLOY_USER" = "root" ]; then
  PROJECT_DIR="/root/Agencia-Fashion"
else
  PROJECT_DIR="/srv/$APP_NAME/Agencia-Fashion"
fi
APP_DIR="$PROJECT_DIR/campanha-ia"

# ── Rollback flag (D-02) ──
# Usage: bash deploy-crialook.sh --rollback
# Skips git pull; resets to HEAD~1; rebuilds; reloads PM2. Owner-driven manual rollback.
if [ "${1:-}" = "--rollback" ]; then
  echo "════════════════════════════════════════"
  echo "🔙 CriaLook — Rollback Manual"
  echo "════════════════════════════════════════"
  cd "$PROJECT_DIR"
  PREV_SHA=$(git rev-parse HEAD)
  TARGET_SHA=$(git rev-parse HEAD~1)
  echo "Resetting from $PREV_SHA → $TARGET_SHA"
  git reset --hard HEAD~1
  cd campanha-ia
  npm ci
  npm run build
  pm2 reload crialook
  notify_discord "🔙 Manual rollback: $PREV_SHA → $TARGET_SHA ($(git log --format=%s -1 HEAD)) (${SECONDS}s)" 16776960
  echo "✅ Rollback complete. Pre-rollback SHA was: $PREV_SHA"
  exit 0
fi

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
  # ── Capture PREV before pull (D-01) ──
  # Drop any uncommitted local changes (D-03: server should be clean; if not, that's the bug).
  # 'git reset --hard' is intentionally loud — we WANT to surface unauthorized server-side edits in the deploy log.
  if ! git diff --quiet || ! git diff --cached --quiet; then
    echo "⚠ Server working tree is dirty — uncommitted changes will be DISCARDED (D-03):"
    git status --short
    git reset --hard HEAD
  fi
  PREV=$(git rev-parse HEAD)
  echo "📍 PREV (rollback anchor) = $PREV"
  git pull
else
  git clone "$REPO_URL" "$(basename "$PROJECT_DIR")"
  cd "$PROJECT_DIR"
  PREV=$(git rev-parse HEAD)  # fresh clone — PREV = HEAD (no rollback target if the very first build fails)
  echo "📍 PREV (fresh clone) = $PREV"
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

# Build (with rollback on failure — D-01)
echo ""
echo "🔨 Buildando projeto..."
if ! npm run build; then
  echo "❌ Build failed — rolling back to $PREV..."
  notify_discord "🔙 Build failed on $(git rev-parse --short HEAD) — rolling back to $PREV ($(git log --format=%s -1 $PREV))" 16776960
  cd "$PROJECT_DIR"
  git reset --hard "$PREV"
  cd campanha-ia
  npm ci
  if ! npm run build; then
    # Catastrophic — rollback build also failed. Loud notification + exit.
    echo "💥 Rollback build ALSO failed — manual intervention required."
    notify_discord "💥 CRITICAL: rollback build failed for $PREV. Server is on previous commit but build artifacts may be inconsistent. Manual intervention required." 15158332
    exit 1
  fi
  echo "✅ Rolled back to $PREV successfully."
  notify_discord "✅ Rolled back to $PREV after build failure." 3066993
  # Continue the deploy flow (PM2 etc.) so the rolled-back build comes online.
fi

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
  # Validate pm2 startup output BEFORE eval (D-20, M-4 fix)
  PM2_STARTUP_OUT=$(pm2 startup systemd -u root --hp /root 2>&1)
  PM2_STARTUP_CMD=$(printf '%s\n' "$PM2_STARTUP_OUT" | grep -E '^sudo (env|/usr/bin/env) PATH=' | head -1 || true)
  if [ -z "$PM2_STARTUP_CMD" ]; then
    echo "⚠ pm2 startup did not emit a recognized 'sudo env PATH=...' install line:"
    echo "$PM2_STARTUP_OUT"
    echo "→ skipping pm2 startup auto-install (PM2 will not auto-start on reboot)."
  else
    echo "Running validated pm2 startup install: $PM2_STARTUP_CMD"
    eval "$PM2_STARTUP_CMD"
  fi
else
  HOME_DIR="/srv/$APP_NAME"
  sudo -u "$DEPLOY_USER" -H bash -c "pm2 delete '$APP_NAME' 2>/dev/null || true"
  sudo -u "$DEPLOY_USER" -H CRIALOOK_HOME="$PROJECT_DIR" \
    bash -c "pm2 start '$PROJECT_DIR/ecosystem.config.js' --env production"
  sudo -u "$DEPLOY_USER" -H bash -c "pm2 save"
  # systemd unit que chama pm2 resurrect como o usuário dedicado — validate output (D-20)
  PM2_STARTUP_OUT=$(pm2 startup systemd -u "$DEPLOY_USER" --hp "$HOME_DIR" 2>&1)
  PM2_STARTUP_CMD=$(printf '%s\n' "$PM2_STARTUP_OUT" | grep -E '^sudo (env|/usr/bin/env) PATH=' | head -1 || true)
  if [ -z "$PM2_STARTUP_CMD" ]; then
    echo "⚠ pm2 startup did not emit a recognized 'sudo env PATH=...' install line for $DEPLOY_USER:"
    echo "$PM2_STARTUP_OUT"
  else
    echo "Running validated pm2 startup install: $PM2_STARTUP_CMD"
    eval "$PM2_STARTUP_CMD"
  fi
fi

# ── pm2-logrotate (D-22, M-CONCERNS §10) ──
# Idempotent: pm2 install is no-op if already installed; pm2 set is last-write-wins.
# Runs as the same user that runs PM2 (root or DEPLOY_USER, mirroring above).
if [ "$DEPLOY_USER" = "root" ]; then
  pm2 install pm2-logrotate || echo "⚠ pm2-logrotate install failed (non-fatal)"
  pm2 set pm2-logrotate:max_size 50M
  pm2 set pm2-logrotate:retain 14
  pm2 set pm2-logrotate:compress true
else
  sudo -u "$DEPLOY_USER" -H bash -c "pm2 install pm2-logrotate || true"
  sudo -u "$DEPLOY_USER" -H bash -c "pm2 set pm2-logrotate:max_size 50M"
  sudo -u "$DEPLOY_USER" -H bash -c "pm2 set pm2-logrotate:retain 14"
  sudo -u "$DEPLOY_USER" -H bash -c "pm2 set pm2-logrotate:compress true"
fi
echo "✅ pm2-logrotate configured: 50M max, 14 day retention, compress on"

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
  echo "⚠️  brotli modules não disponíveis nesta distro — nginx vai falhar no 'brotli on'. Comentar essas linhas em $PROJECT_DIR/nginx-crialook.conf se necessário (sed-strip entre BROTLI BLOCK START / END markers — ver plan 08-02)."

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

# ── Health check cron (D-19, D-23) ──
# Cron calls ops/health-check.sh (in the repo) directly. No more split-brain
# inline-HEREDOC script at /root that gets regenerated and overwrites local edits.
echo ""
echo "⏰ Configurando health check automático (cron → ops/health-check.sh)..."

# Clean up split-brain script from prior deploys (M-3 fix, D-19).
rm -f /root/health-check.sh

# Write a tiny env-injecting wrapper so DISCORD_WEBHOOK_URL is available to
# the script under cron's empty environment. Wrapper is auditable in /etc/crialook/
# rather than inline-prefixed on the cron line (which would leak the URL into
# `crontab -l` output).
mkdir -p /etc/crialook
cat > /etc/crialook/cron-health.sh << CRONWRAP
#!/bin/bash
# Wrapper for cron → ops/health-check.sh. Writes DISCORD_WEBHOOK_URL into env.
# Edit DISCORD_WEBHOOK_URL below or set it from /etc/crialook/webhook.env.
[ -f /etc/crialook/webhook.env ] && . /etc/crialook/webhook.env
exec "$PROJECT_DIR/ops/health-check.sh"
CRONWRAP
chmod +x /etc/crialook/cron-health.sh

# D-23 timeout note: ops/health-check.sh hits /api/health WITHOUT the
# x-health-secret header — that path is intentionally DB-free (route.ts:38-43);
# if you ever change the shallow handler to touch DB, BUMP THE TIMEOUT (currently
# --max-time 5 inside ops/health-check.sh) or carve a new shallow endpoint
# (e.g., /api/health/live).

# Replace any existing crialook-health entry, then append the new one.
(crontab -l 2>/dev/null | grep -v 'crialook.*health\|health-check' ; \
 echo "*/5 * * * * /etc/crialook/cron-health.sh >> /var/log/crialook/health-check.log 2>&1") | crontab -

mkdir -p /var/log/crialook
echo "✅ Health check cron configured (every 5min → /var/log/crialook/health-check.log)"

# ── Success notification (D-04, D-05) ──
COMMIT_SHA=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")
COMMIT_MSG=$(git log --format=%s -1 HEAD 2>/dev/null || echo "unknown")
notify_discord "✅ Deploy success — \`$COMMIT_SHA\` (${SECONDS}s) — $COMMIT_MSG" 3066993

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
echo "🔙 Manual rollback (D-02):"
echo "  bash deploy-crialook.sh --rollback"
echo ""
