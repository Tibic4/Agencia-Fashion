#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════
# ops/health-check.sh — cron-driven liveness check + auto-restart + Discord notify
#
# Cron (deploy-crialook.sh writes this):
#   */5 * * * * /etc/crialook/cron-health.sh >> /var/log/crialook/health-check.log 2>&1
#
# The wrapper at /etc/crialook/cron-health.sh sources DISCORD_WEBHOOK_URL from
# /etc/crialook/webhook.env (OWNER-ACTION-provisioned per D-07 — see ops/deploy.md
# from plan 08-09) and execs this script.
#
# CONTRACT (D-23, CONCERNS §10):
#   - This script hits the SHALLOW /api/health endpoint (no x-health-secret header).
#     The shallow path is DB-free (route.ts:38-43) — returns {status: 'ok'} flat.
#     If you ever change the shallow handler to touch DB, BUMP --max-time below
#     OR carve a new shallow endpoint (e.g., /api/health/live).
#   - Curl is pinned to --max-time 5: shallow path is DB-free so 5s is generous.
#
# WHAT CRON CAN OBSERVE:
#   - HTTP 200: app up
#   - HTTP 503: app deep-check returning unhealthy (deep-path signal — uncommon
#     from cron because cron doesn't send the secret, but observable if a deep
#     scrape sets the unhealthy state and cron tick races into the deep handler
#     somehow — defensive: treat 503 as down)
#   - HTTP 5xx, timeouts, connection refused: app down
#   - HTTP 200 with body status='degraded': NOT VISIBLE to cron because the
#     shallow path doesn't return that field. Degraded detection lives elsewhere
#     (admin panel deep scrape — out of scope for this script). See D-06 in
#     plan 08-04 for the resolution rationale.
#
# DISCORD NOTIFICATIONS (D-04, D-05):
#   - State-change-only (STATE_FILE deduplication): notify on down→up and on up→down.
#     Don't notify on every cron tick.
#   - On down: post 🚨 with last 3 lines of pm2 logs for triage context.
#   - On recover: post ✅ with no logs (recovery is unambiguous).
#   - DISCORD_WEBHOOK_URL missing → script logs a warn ONCE per run and continues.
#     Notifications are best-effort; never fail cron because Discord is down.
#
# LIVE TEST:
#   STATE_FILE=/tmp/test bash ops/health-check.sh
# ═══════════════════════════════════════════════════════════

set -euo pipefail

URL="${URL:-https://crialook.com.br/api/health}"
WEBHOOK_URL="${DISCORD_WEBHOOK_URL:-}" # Export no shell ou /etc/crialook/webhook.env
STATE_FILE="${STATE_FILE:-/tmp/crialook-health-state}"

# D-23: --max-time 5 (was 10). Shallow /api/health path is DB-free (route.ts:38-43).
STATUS=$(curl -fsS -o /dev/null -w "%{http_code}" --max-time 5 "$URL" 2>&1 || echo "000")

PREVIOUS="unknown"
[ -f "$STATE_FILE" ] && PREVIOUS=$(cat "$STATE_FILE")

# ── Discord notify helper (D-04, D-07) ──
# Best-effort: missing webhook = warn once, never fail cron.
DISCORD_WARN_LOGGED=false
notify_discord() {
  local message="$1"
  local color="${2:-3447003}"  # blue default; 3066993=green, 15158332=red, 16776960=yellow
  if [ -z "${WEBHOOK_URL:-}" ]; then
    if [ "$DISCORD_WARN_LOGGED" = "false" ]; then
      echo "[health-check] WARN: DISCORD_WEBHOOK_URL not set — notifications disabled."
      DISCORD_WARN_LOGGED=true
    fi
    return 0
  fi
  if command -v jq >/dev/null 2>&1; then
    curl -fsS -X POST -H "Content-Type: application/json" \
      --max-time 5 \
      -d "{\"embeds\":[{\"title\":\"CriaLook Health\",\"description\":$(printf '%s' "$message" | jq -Rs .),\"color\":$color}]}" \
      "$WEBHOOK_URL" > /dev/null || true
  else
    # Fallback: simple text content (no jq required). Strip newlines + escape "
    local safe
    safe=$(printf '%s' "$message" | tr '\n' ' ' | sed 's/"/\\"/g')
    curl -fsS -X POST -H "Content-Type: application/json" \
      --max-time 5 \
      -d "{\"content\":\"$safe\"}" \
      "$WEBHOOK_URL" > /dev/null || true
  fi
}

if [ "$STATUS" = "200" ]; then
  echo "up" > "$STATE_FILE"
  # Recovered: notify ONCE on transition (state-change deduplication).
  if [ "$PREVIOUS" = "down" ]; then
    notify_discord "✅ CriaLook RECOVERED — HTTP $STATUS at $(date '+%Y-%m-%d %H:%M:%S %Z')" 3066993
  fi
  exit 0
fi

# Down: reinicia e alerta
echo "down" > "$STATE_FILE"
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S %Z')
echo "[health] STATUS=$STATUS at $TIMESTAMP — restarting PM2"

# Capture last 3 lines of pm2 logs BEFORE restart for triage context (D-05).
# pm2 logs --nostream prints buffered logs and exits; --lines 3 limits.
# tail -3 is defense-in-depth; truncate to fit Discord's 2000-char content limit.
PM2_TAIL=$(pm2 logs crialook --lines 3 --nostream 2>/dev/null | tail -3 | head -c 800 || echo "(pm2 logs unavailable)")

# Capture pm2 uptime stat (was the process even running?). pm_uptime is ms since last start.
if command -v jq >/dev/null 2>&1; then
  PM2_STATUS=$(pm2 jlist 2>/dev/null | jq -r '.[] | select(.name=="crialook") | "uptime_ms=\(.pm2_env.pm_uptime) restarts=\(.pm2_env.restart_time) status=\(.pm2_env.status)"' 2>/dev/null || echo "(pm2 unavailable)")
else
  PM2_STATUS="(jq not installed — install for richer pm2 stats)"
fi

pm2 restart crialook || true

# D-05: Notify with rich context — timestamp, http_code, pm2 status, log tail.
notify_discord "🚨 CriaLook DOWN at $TIMESTAMP — HTTP $STATUS — pm2 restart fired

PM2 status before restart: $PM2_STATUS

Last log lines (truncated):
\`\`\`
$PM2_TAIL
\`\`\`" 15158332

exit 1
