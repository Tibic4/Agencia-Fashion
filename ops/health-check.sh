#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════
# Health check externo com alerta Discord/Slack.
# Roda via cron em /etc/cron.d/crialook-health:
#   */5 * * * * www-data /var/www/crialook/ops/health-check.sh
# ═══════════════════════════════════════════════════════════

set -euo pipefail

URL="https://crialook.com.br/api/health"
WEBHOOK_URL="${DISCORD_WEBHOOK_URL:-}" # Export no shell ou /etc/crialook/webhook.env
STATE_FILE="/tmp/crialook-health-state"

STATUS=$(curl -fsS -o /dev/null -w "%{http_code}" --max-time 10 "$URL" 2>&1 || echo "000")

PREVIOUS="unknown"
[ -f "$STATE_FILE" ] && PREVIOUS=$(cat "$STATE_FILE")

if [ "$STATUS" = "200" ]; then
  echo "up" > "$STATE_FILE"
  # Recuperou: avisa 1x
  if [ "$PREVIOUS" = "down" ] && [ -n "$WEBHOOK_URL" ]; then
    curl -fsS -X POST -H "Content-Type: application/json" \
      -d "{\"content\":\"✅ CriaLook recuperou ($STATUS)\"}" \
      "$WEBHOOK_URL" >/dev/null || true
  fi
  exit 0
fi

# Down: reinicia e alerta
echo "down" > "$STATE_FILE"
echo "[health] STATUS=$STATUS — reiniciando PM2"
pm2 restart crialook || true

if [ -n "$WEBHOOK_URL" ]; then
  curl -fsS -X POST -H "Content-Type: application/json" \
    -d "{\"content\":\"🚨 CriaLook DOWN (http=$STATUS) — pm2 restart disparado\"}" \
    "$WEBHOOK_URL" >/dev/null || true
fi

exit 1
