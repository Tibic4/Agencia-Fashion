---
plan_id: 08-04
phase: 8
title: ops/health-check.sh — degraded vs unhealthy detection + Discord notifications for cron-detected restart and degraded states (D-04, D-05, D-06, D-23)
wave: 1
depends_on: []
owner_action: false
files_modified:
  - ops/health-check.sh
autonomous: true
requirements: ["D-04", "D-05", "D-06", "D-23"]
must_haves:
  truths:
    - "ops/health-check.sh today (FULL FILE pre-patch — 41 lines) does: curl /api/health → http_code only → if 200 then up else down + pm2 restart + Discord notify. It uses --max-time 10 and only checks status code, not body — so a 200 with status='degraded' body slips through silently per D-06"
    - "fix per D-06: parse the response body for status field. The shallow public path (no x-health-secret) returns {status: 'ok'}; with valid header it returns {status: 'healthy'|'degraded'|'unhealthy'} per route.ts:87-91. Cron does NOT have the secret (and shouldn't — keeps cron from touching DB); cron sees only the shallow path. So degraded detection via body parse is N/A for the unauthenticated cron path"
    - "RESOLVED ambiguity: D-06 says 'parse response body for status: unhealthy or degraded'. But cron health-check.sh hits the SHALLOW endpoint (no secret) per current line 10 → /api/health → returns {status: 'ok'} flat. To detect degraded from cron, cron would need to send the x-health-secret header AND the deep check would need to be DB-touching. CONCERNS §10 explicitly says shallow path must stay DB-free."
    - "RESOLUTION: cron health-check.sh stays on shallow path (no secret, no DB touch) — so 'degraded' detection is OUT OF SCOPE for cron in this plan. The Discord notification on degraded must come from a DIFFERENT signal: the deep check via internal admin panel OR a future scheduled scrape that DOES use the secret. Document the limitation in the script header comment."
    - "what cron CAN reliably detect: HTTP 503 (route returns 503 when overall = 'unhealthy', per route.ts:100). The shallow path returns 200 always (no DB touch); 503 only ever comes from the deep path. So if cron sees 503, it's either nginx-down (unlikely on the same host) OR someone is hitting the deep path with the secret AND it failed. Cron seeing 503 == treat as unhealthy (already does — non-200 path)"
    - "what cron CAN reliably detect: connection failures, timeouts, 5xx — the existing 'down' branch already handles these. This plan PRESERVES the existing pm2 restart + Discord 'down' notification"
    - "ADD per D-05 'health-check cron detects restart' notification: when STATE_FILE shows 'down' → 'up' transition (line 22 currently only notifies recovery — that's the same signal). EXISTING behavior already handles this. Verify the Discord message includes uptime stats from pm2 (e.g., 'pm2 jlist | jq .[].pm2_env.pm_uptime')"
    - "ADD per D-23: pin curl to --max-time 5 (NOT 10). Doc that shallow /api/health is DB-free — confirmed by reading route.ts:38-43. If cron ever points at the deep path, BUMP the timeout"
    - "ADD per D-04 / D-07 doc: at top of ops/health-check.sh, explain that DISCORD_WEBHOOK_URL is OWNER-ACTION-provisioned via /etc/crialook/webhook.env (sourced by /etc/crialook/cron-health.sh wrapper from plan 08-01). Script remains no-op-on-missing — never crash cron"
    - "ENHANCEMENT: when cron-detected restart fires, gather context for the Discord embed: timestamp + http_code + last 3 lines of pm2 logs (truncated to fit Discord 2000-char limit). Use 'pm2 logs crialook --lines 3 --nostream 2>/dev/null | tail -3'"
    - "preserve the existing STATE_FILE pattern (/tmp/crialook-health-state) — it's how the script avoids notification spam (only notifies on state CHANGE, not on every cron tick)"
    - "preserve the existing Discord JSON payload shape ({content: text}) — that works without jq dependency. If jq is available, upgrade to embeds with color (green=recover, red=down, yellow=restart fired) for parity with deploy-crialook.sh (08-01) — but keep simple text fallback"
    - "DO NOT add the deep-check secret path here — that's a separate concern (CONCERNS §10 explicitly warns against making cron path DB-touching)"
    - "DO NOT add Inngest/Sentry alerting — keep the script standalone Discord-only; the comment block at top can mention 'consider Sentry CSP integration for additional alerting' but no impl"
    - "the script must remain runnable WITHOUT jq installed (jq is not in default Ubuntu 24.04 minimal image); add a 'command -v jq' guard same pattern as deploy-crialook.sh (08-01 Task 1)"
    - "set -euo pipefail at top must stay (current line 8) — but add explicit 'curl ... || true' patterns where curl failure is expected (e.g., the Discord post call)"
  acceptance:
    - "test -f ops/health-check.sh exits 0"
    - "head -1 ops/health-check.sh | grep -q '#!/usr/bin/env bash\\|#!/bin/bash' && echo SHEBANG_OK"
    - "grep -c -- '--max-time 5' ops/health-check.sh returns at least 1 (D-23 timeout pinned to 5s)"
    - "grep -c -- '--max-time 10' ops/health-check.sh returns 0 (old 10s removed)"
    - "grep -c 'STATE_FILE' ops/health-check.sh returns at least 3 (state-change-only notification preserved)"
    - "grep -c 'DISCORD_WEBHOOK_URL' ops/health-check.sh returns at least 2 (env var read + Discord post call)"
    - "grep -c 'pm2 restart\\|pm2 reload' ops/health-check.sh returns at least 1 (restart on down preserved)"
    - "grep -c 'pm2 logs' ops/health-check.sh returns at least 1 (D-05 enhancement: include log context in restart notification)"
    - "grep -c 'D-23\\|DB-free\\|shallow path' ops/health-check.sh returns at least 1 (doc note about path contract)"
    - "grep -c 'jq\\|command -v' ops/health-check.sh returns at least 1 (jq optional fallback handled)"
    - "bash -n ops/health-check.sh exits 0 (script is valid bash)"
    - "DISCORD_WEBHOOK_URL='' bash ops/health-check.sh 2>&1 | head -5 — exits 0 OR 1 (depending on whether localhost is up); script must not crash on missing env (no 'unbound variable' error)"
    - "STATE_FILE=/tmp/test-state-$$ DISCORD_WEBHOOK_URL='' URL='http://127.0.0.1:99999/nope' bash ops/health-check.sh 2>&1 | grep -ic 'down\\|down\\|unreachable' returns at least 1 (script handles unreachable URL without crashing)"
---

# Plan 08-04: ops/health-check.sh — degraded detection + Discord enhancements + curl timeout pin

## Objective

Per D-04, D-05, D-06, D-23: upgrade `ops/health-check.sh` (the cron-driven restart-on-failure script) so:
- Curl is pinned to `--max-time 5` (not 10) per D-23
- The Discord notification on cron-detected restart includes context (timestamp, last 3 lines of pm2 logs) per D-05
- The script gracefully handles `jq` absence (parity with deploy-crialook.sh from 08-01)
- The header comment documents the DB-free shallow-path contract (D-23) and the DISCORD_WEBHOOK_URL provisioning expectation (D-07)
- Per D-06: degraded-vs-unhealthy detection. **Resolved during planning:** cron stays on the SHALLOW (DB-free, no-secret) path; "degraded" status is only available via the DEEP (secret-required, DB-touching) path. Mixing those would violate CONCERNS §10. Documented limitation; keep cron focused on what it can reliably observe (HTTP 503, 5xx, timeouts, network errors).

The existing script (41 lines) already has the core shape: curl shallow → state file → on down: pm2 restart + Discord notify; on recover: Discord notify-once. This plan adds context to the notifications and tightens the timeout — surgical edits, not a rewrite.

## Truths the executor must respect

- **Cron stays on the shallow path.** The shallow path (`/api/health` without `x-health-secret`) is DB-free per `route.ts:38-43`. CONCERNS §10 explicitly forbids a DB-touching cron health check (would create restart loops on transient DB blips). So cron CANNOT see "degraded" status from the body — that's a deep-path-only signal. D-06's degraded notification is owned by the eventual admin-panel scrape (out of scope for this plan); cron focuses on what it can observe.
- **Don't introduce jq as a hard dependency.** Default Ubuntu 24.04 minimal images don't include `jq`. Use the same `command -v jq` pattern as deploy-crialook.sh (08-01 Task 1): if `jq` is available, build a rich Discord embed; otherwise, fall back to simple `{content: text}` payload.
- **Preserve the state-change-only notification.** The current STATE_FILE-based deduplication is the right design — without it, every 5-min cron tick on a down system would spam Discord. Don't break that.
- **Notifications are best-effort.** Every Discord curl call ends with `|| true`. A Discord outage must NEVER fail the cron run (cron failures appear in /var/log/syslog and confuse ops).
- **Pm2 logs context.** When cron fires a restart, the Discord notification should include the last 3 lines of `pm2 logs crialook` so the operator can triage from the notification alone. Use `pm2 logs crialook --lines 3 --nostream 2>/dev/null | tail -3` and truncate to fit Discord's payload limit.
- **`set -euo pipefail` is in effect.** Be explicit about acceptable failures (`|| true` patterns). The current script is already `set -euo pipefail` (line 8) — keep it.

## Tasks

### Task 1: Header rewrite — document the contracts (D-04, D-07, D-23)

<read_first>
- ops/health-check.sh (FULL FILE — 41 lines)
- campanha-ia/src/app/api/health/route.ts (lines 23-43 — confirms shallow vs deep path contract)
- .planning/phases/08-ops-deploy-hardening/08-CONTEXT.md (D-04, D-07, D-23)
- .planning/codebase/CONCERNS.md §10 "Health-check cron auto-restarts on any non-200" (the constraint that shallow stays DB-free)
</read_first>

<action>
Replace the existing header comment block (lines 1-7) with a fuller doc:

```bash
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
```

Reasoning: future operators (and the auditing-future-self) need to know WHY each design choice exists. Inlining the contract beats a separate ops doc that goes stale.
</action>

<verify>
```bash
head -50 ops/health-check.sh | grep -c 'D-23\|DB-free\|shallow path'   # expect ≥ 2
head -50 ops/health-check.sh | grep -c 'STATE_FILE\|state-change'      # expect ≥ 1
head -50 ops/health-check.sh | grep -c 'DISCORD_WEBHOOK_URL'           # expect ≥ 1
bash -n ops/health-check.sh && echo SYNTAX_OK
```
</verify>

### Task 2: Pin curl --max-time 5 (D-23) + add jq fallback for Discord payload

<read_first>
- ops/health-check.sh (lines 9-15 — the URL, WEBHOOK_URL, STATE_FILE, and curl invocation)
- deploy-crialook.sh (Task 1 from plan 08-01 — the notify_discord helper pattern with jq fallback)
</read_first>

<action>
Find the existing curl invocation (line 14):
```bash
STATUS=$(curl -fsS -o /dev/null -w "%{http_code}" --max-time 10 "$URL" 2>&1 || echo "000")
```

Replace with:
```bash
# D-23: --max-time 5 (was 10). Shallow /api/health path is DB-free (route.ts:38-43).
STATUS=$(curl -fsS -o /dev/null -w "%{http_code}" --max-time 5 "$URL" 2>&1 || echo "000")
```

Then, BEFORE the `if [ "$STATUS" = "200" ]; then` line, add a Discord helper function (mirror of deploy-crialook.sh from plan 08-01 but local to this script — keeps both files self-contained):

```bash
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
```

Reasoning: pulling the helper into a function:
- Eliminates the inline `curl -fsS -X POST -H ... -d "..." "$WEBHOOK_URL"` duplication on lines 23-25 and 36-38 of the current script
- Adds the jq fallback (parity with 08-01)
- Adds color support so different Discord embed colors signal different states (red=down, green=recover, yellow=restart fired)
- Adds `--max-time 5` to the Discord curl too (current calls have no timeout — a hung Discord ingest could block cron forever)
</action>

<verify>
```bash
grep -c -- '--max-time 5' ops/health-check.sh   # expect ≥ 2 (health curl + Discord curls)
grep -c -- '--max-time 10' ops/health-check.sh  # expect 0 (old timeout removed)
grep -c 'notify_discord()' ops/health-check.sh  # expect 1 (function definition)
grep -c 'command -v jq' ops/health-check.sh     # expect 1 (fallback guard)
bash -n ops/health-check.sh && echo SYNTAX_OK
```
</verify>

### Task 3: Replace inline curl-Discord blocks with notify_discord calls + add pm2 logs context (D-05)

<read_first>
- ops/health-check.sh (lines 19-39 — the if-200/else-down branches with inline curl Discord calls)
</read_first>

<action>
Find the recovery branch (current lines 19-28):
```bash
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
```

Replace with:
```bash
if [ "$STATUS" = "200" ]; then
  echo "up" > "$STATE_FILE"
  # Recovered: notify ONCE on transition (state-change deduplication).
  if [ "$PREVIOUS" = "down" ]; then
    notify_discord "✅ CriaLook RECOVERED — HTTP $STATUS at $(date '+%Y-%m-%d %H:%M:%S %Z')" 3066993
  fi
  exit 0
fi
```

Find the down branch (current lines 31-39):
```bash
echo "down" > "$STATE_FILE"
echo "[health] STATUS=$STATUS — reiniciando PM2"
pm2 restart crialook || true

if [ -n "$WEBHOOK_URL" ]; then
  curl -fsS -X POST -H "Content-Type: application/json" \
    -d "{\"content\":\"🚨 CriaLook DOWN (http=$STATUS) — pm2 restart disparado\"}" \
    "$WEBHOOK_URL" >/dev/null || true
fi

exit 1
```

Replace with:
```bash
echo "down" > "$STATE_FILE"
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S %Z')
echo "[health] STATUS=$STATUS at $TIMESTAMP — restarting PM2"

# Capture last 3 lines of pm2 logs BEFORE restart for triage context (D-05).
# pm2 logs --nostream prints buffered logs and exits; --lines 3 limits.
# tail -3 is defense-in-depth; truncate to fit Discord's 2000-char content limit.
PM2_TAIL=$(pm2 logs crialook --lines 3 --nostream 2>/dev/null | tail -3 | head -c 800 || echo "(pm2 logs unavailable)")

# Capture pm2 uptime stat (was the process even running?). pm_uptime is ms since last start.
PM2_STATUS=$(pm2 jlist 2>/dev/null | (command -v jq >/dev/null && jq -r '.[] | select(.name=="crialook") | "uptime_ms=\(.pm2_env.pm_uptime) restarts=\(.pm2_env.restart_time) status=\(.pm2_env.status)"') 2>/dev/null || echo "(jq/pm2 unavailable)")

pm2 restart crialook || true

# D-05: Notify with rich context — timestamp, http_code, pm2 status, log tail.
notify_discord "🚨 CriaLook DOWN at $TIMESTAMP — HTTP $STATUS — pm2 restart fired

PM2 status before restart: $PM2_STATUS

Last log lines (truncated):
\`\`\`
$PM2_TAIL
\`\`\`" 15158332

exit 1
```

Reasoning:
- `pm2 logs --nostream --lines 3` is non-blocking (exits immediately after printing buffered logs)
- `head -c 800` keeps the embed under Discord's 4096-char description limit (with safety margin for the rest of the message)
- `pm2 jlist | jq` extracts the uptime + restart count for the embed; if jq unavailable, falls back gracefully
- The triple-backtick code fence in the message renders as a code block in Discord — readable
</action>

<verify>
```bash
grep -c 'pm2 logs' ops/health-check.sh           # expect ≥ 1
grep -c 'pm2 jlist\|pm_uptime' ops/health-check.sh  # expect ≥ 1
grep -c 'notify_discord' ops/health-check.sh     # expect ≥ 3 (definition + recovery + down)
grep -c 'PM2_TAIL\|PM2_STATUS' ops/health-check.sh  # expect ≥ 4 (declaration + use)
bash -n ops/health-check.sh && echo SYNTAX_OK
```
</verify>

### Task 4: Smoke test the patched script

<read_first>
- ops/health-check.sh (FULL FILE post all patches)
</read_first>

<action>
Run two smoke tests to validate behavior without affecting the real STATE_FILE or pm2:

```bash
# Test 1: missing DISCORD_WEBHOOK_URL — must not crash, must log warn
STATE_FILE=/tmp/test-state-up DISCORD_WEBHOOK_URL='' WEBHOOK_URL='' URL='http://localhost:3000/api/health' bash ops/health-check.sh 2>&1 || true
echo "--- Test 1 done ---"

# Test 2: unreachable URL — must report down, must not crash
STATE_FILE=/tmp/test-state-bad DISCORD_WEBHOOK_URL='' WEBHOOK_URL='' URL='http://127.0.0.1:99999/nope' bash ops/health-check.sh 2>&1 || true
echo "--- Test 2 done ---"

# Cleanup
rm -f /tmp/test-state-up /tmp/test-state-bad
```

Expected:
- Test 1: either prints "up" (if local app is running on 3000) or attempts pm2 restart (silently fails because pm2 isn't installed locally — the `|| true` guards). Discord warn log appears once. Script exits 0 or 1 cleanly, no "unbound variable" errors.
- Test 2: prints "down" path with "STATUS=000 — restarting PM2", attempts pm2 restart (ignored), tries Discord (no-op due to empty URL), exits 1.

Note: the `WEBHOOK_URL=''` env override matches the variable name actually used in the script (line 11 currently: `WEBHOOK_URL="${DISCORD_WEBHOOK_URL:-}"`). After Task 2 the script reads `DISCORD_WEBHOOK_URL` directly inside notify_discord — the WEBHOOK_URL variable should be removed OR renamed for clarity. Executor decides; either way, the env override pattern works because the script reads the env at start.
</action>

<verify>
```bash
# All previous greps still pass
grep -c -- '--max-time 5' ops/health-check.sh
grep -c 'notify_discord' ops/health-check.sh
grep -c 'pm2 logs' ops/health-check.sh
bash -n ops/health-check.sh && echo SYNTAX_OK

# Smoke tests don't crash:
STATE_FILE=/tmp/test-state-bad DISCORD_WEBHOOK_URL='' WEBHOOK_URL='' URL='http://127.0.0.1:99999/nope' bash ops/health-check.sh 2>&1 | head -5
# Expected: prints "[health] STATUS=000 ... — restarting PM2" with no bash unbound-var errors
```
</verify>

## Files modified

- `ops/health-check.sh` — header rewrite documenting the DB-free shallow-path contract + DISCORD_WEBHOOK_URL provisioning expectation (Task 1); curl --max-time pinned to 5s + Discord notify_discord helper with jq fallback added (Task 2); inline curl-Discord calls replaced with notify_discord + pm2 logs context added to down notification (Task 3); smoke tests pass (Task 4)

## Owner-action callout (D-07)

`DISCORD_WEBHOOK_URL` is OWNER-ACTION-provisioned via `/etc/crialook/webhook.env`:

```bash
# On the VPS, as root or DEPLOY_USER:
sudo mkdir -p /etc/crialook
echo "DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/REDACTED" | sudo tee /etc/crialook/webhook.env
sudo chmod 600 /etc/crialook/webhook.env  # secret — restrict reads
```

Plan 08-01 writes the wrapper at `/etc/crialook/cron-health.sh` that sources this file. Without provisioning, this script logs `WARN: DISCORD_WEBHOOK_URL not set` once per cron run and continues — no notifications, but no crashes either.

## Why this matters (risk if skipped)

Today, the cron-detected restart Discord message is generic: `"🚨 CriaLook DOWN (http=502)"`. The operator has to ssh in and `pm2 logs crialook` to triage. After this plan, the Discord embed includes the last 3 log lines + pm2 uptime/restart stats — operator can triage from phone. The 5s timeout per D-23 prevents cron from blocking 10s on a hung curl (which can stack up if cron tick interval is short). The header doc cements the shallow-path-must-stay-DB-free contract that future maintainers might otherwise violate.
