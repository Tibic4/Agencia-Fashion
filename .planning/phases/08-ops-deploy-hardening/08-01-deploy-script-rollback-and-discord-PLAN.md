---
plan_id: 08-01
phase: 8
title: deploy-crialook.sh rollback path + Discord webhook on deploy success/failure + pm2-logrotate wire + use ops/health-check.sh + pm2-startup validation + cron timeout (D-01..D-05, D-07, D-19, D-20, D-22, D-23)
wave: 1
depends_on: []
owner_action: false
files_modified:
  - deploy-crialook.sh
autonomous: true
requirements: ["D-01", "D-02", "D-03", "D-04", "D-05", "D-07", "D-19", "D-20", "D-22", "D-23"]
must_haves:
  truths:
    - "deploy-crialook.sh captures PREV=$(git rev-parse HEAD) BEFORE the git pull (line ~88) — this is the rollback anchor; if no PREV, rollback can't run"
    - "deploy-crialook.sh wraps the build step (npm run build, line ~120) in a try/catch pattern: if exit !=0, run 'git reset --hard \"$PREV\" && npm ci && npm run build' to restore previous deployable state"
    - "if rollback build ALSO fails (catastrophic), script exits 1 with loud Discord notification — never leave the working tree on a broken commit silently"
    - "deploy-crialook.sh accepts a --rollback flag at $1: when present, skip git pull, just 'git reset --hard HEAD~1 && npm ci && npm run build && pm2 reload crialook' (manual rollback path)"
    - "drop ANY uncommitted local changes on the server before reset (server should not have any; if it does that's the bug per D-03) — use 'git reset --hard' (NOT 'git stash') to be loud about it"
    - "add notify_discord() bash helper at top of deploy-crialook.sh; reads DISCORD_WEBHOOK_URL from env; no-op if absent (D-07: env provisioning is owner-action; script must not crash if URL missing)"
    - "notify_discord() takes 2 args: message text + color (green/red/yellow); posts to DISCORD_WEBHOOK_URL using curl POST with rich embed JSON (Discord webhook format: {embeds: [{title, description, color}]}); always swallows curl errors with '|| true' (notification failure must NEVER fail deploy)"
    - "Discord notify on deploy SUCCESS at end of script: 'Deploy success — commit $(git rev-parse --short HEAD), duration ${DURATION}s' (track DURATION via SECONDS bash builtin — START=$SECONDS at top, DURATION=$((SECONDS-START)) at end)"
    - "Discord notify on deploy FAILURE: trap ERR + EXIT — if EXIT_CODE !=0, post 'Deploy failed at step X — last error: $(tail -3 /tmp/crialook-deploy.log)'. The trap MUST distinguish normal exit from failure (test $? at the trap site)"
    - "Discord notify on rollback fired: 'Build failed — rolling back to commit $PREV ($(git log --format=%s -1 $PREV))'"
    - "deploy-crialook.sh step 7 (pm2 setup) appends pm2-logrotate install (D-22): 'pm2 install pm2-logrotate && pm2 set pm2-logrotate:max_size 50M && pm2 set pm2-logrotate:retain 14' — runs as the same user that runs PM2 (root or DEPLOY_USER-conditional)"
    - "pm2-logrotate install is idempotent (pm2 install pm2-logrotate is a no-op if already installed) — re-running deploy must not multiply the install"
    - "deploy-crialook.sh REMOVES the inline /root/health-check.sh HEREDOC (current lines 243-251) and the cron block (line 254) per D-19 — replace with a cron line that calls ops/health-check.sh in the repo: '*/5 * * * * DISCORD_WEBHOOK_URL=$DISCORD_WEBHOOK_URL $PROJECT_DIR/ops/health-check.sh >> /var/log/crialook/health-check.log 2>&1'"
    - "the new cron line MUST source DISCORD_WEBHOOK_URL into the cron environment so ops/health-check.sh can use it (cron has empty env by default; either inline-prefix the var OR write a tiny wrapper /etc/crialook/cron-health.sh that exports the var then execs the script — pick whichever the executor finds cleaner; both are acceptable)"
    - "the old /root/health-check.sh file should be removed by the new deploy: 'rm -f /root/health-check.sh' (so split-brain from M-3 is closed forever — only ops/health-check.sh exists)"
    - "deploy-crialook.sh validates the pm2 startup output BEFORE piping to bash (D-20, M-4 fix): capture full output of 'pm2 startup systemd -u $DEPLOY_USER --hp $HOME_DIR' to a variable, grep for a line starting with 'sudo env' OR matching 'sudo /usr/bin/env PATH=' (the canonical pm2 startup install command shape), and only execute that captured line. If grep fails, exit 1 with an error message — never run an unvalidated string from a third-party tool"
    - "the ops/health-check.sh cron entry uses --max-time 5 (NOT --max-time 10) per D-23 — D-23 explicitly pins curl to -m 5; the SHALLOW /api/health path is DB-free per existing code at health/route.ts:38-43, so 5s is generous"
    - "D-23 doc note: add a header comment in deploy-crialook.sh near the cron block explaining 'ops/health-check.sh hits /api/health WITHOUT the x-health-secret header — that path is intentionally DB-free (route.ts:38-43); if you ever change the shallow handler to touch DB, BUMP THE TIMEOUT or carve a new shallow endpoint (e.g., /api/health/live)'"
    - "all logging from deploy-crialook.sh tee'd to /tmp/crialook-deploy.log so the trap can include the last error context in the Discord notification (use 'exec > >(tee /tmp/crialook-deploy.log) 2>&1' near top, AFTER the shebang and before the first echo)"
    - "no breaking change to the existing DEPLOY_USER conditional (lines 27-33, 73-95, 130-147) — that scaffolding stays; the dedicated-user migration path is owner-action in plan 08-08"
    - "the rollback path (--rollback) must work whether running as root OR as DEPLOY_USER (it inherits the same conditional logic)"
    - "set -e at top still applies; the trap captures both error AND clean exit so we can disambiguate; use 'trap on_exit EXIT' + 'trap on_error ERR' pattern"
  acceptance:
    - "head -30 deploy-crialook.sh | grep -c 'PREV=' returns at least 1 (PREV captured before git pull is verified by reading the patched file)"
    - "grep -c 'git reset --hard' deploy-crialook.sh returns at least 2 (rollback inside build try/catch + --rollback flag handler)"
    - "grep -c -- '--rollback' deploy-crialook.sh returns at least 1 (flag handler exists)"
    - "grep -c 'notify_discord\\|DISCORD_WEBHOOK_URL' deploy-crialook.sh returns at least 5 (helper + 3+ call sites + env var read)"
    - "grep -c 'pm2 install pm2-logrotate' deploy-crialook.sh returns at least 1"
    - "grep -c 'pm2-logrotate:max_size' deploy-crialook.sh returns at least 1"
    - "grep -c 'pm2-logrotate:retain' deploy-crialook.sh returns at least 1"
    - "grep -c 'ops/health-check.sh' deploy-crialook.sh returns at least 1 (cron points at the repo script)"
    - "grep -c '/root/health-check.sh' deploy-crialook.sh returns at most 1 (only the rm -f cleanup, NOT the HEREDOC) — verify the HEREDOC is gone: 'grep -c \"<< .HEALTH\" deploy-crialook.sh' returns 0"
    - "grep -c 'rm -f /root/health-check.sh' deploy-crialook.sh returns at least 1 (split-brain cleanup)"
    - "grep -c 'pm2 startup' deploy-crialook.sh returns at least 1"
    - "grep -c 'grep.*sudo' deploy-crialook.sh returns at least 1 (validates pm2 startup output BEFORE piping to bash — D-20)"
    - "grep -c -- '--max-time 5\\|max-time 5\\|-m 5' deploy-crialook.sh returns at least 1 OR (cron file content includes -m 5 if owner uses wrapper) — at minimum the cron line written by deploy-crialook.sh references 5s timeout"
    - "grep -c 'trap.*EXIT\\|trap.*ERR' deploy-crialook.sh returns at least 2 (both traps installed)"
    - "grep -c 'tee /tmp/crialook-deploy.log' deploy-crialook.sh returns at least 1 (log capture for trap context)"
    - "bash -n deploy-crialook.sh (syntax-check only, no execution) exits 0 — the patched script must be valid bash"
    - "shellcheck deploy-crialook.sh (if available) reports no NEW errors vs the pre-patch baseline (note: the existing script has minor warnings; this plan must not introduce additional ERROR-level findings)"
    - "the patched deploy-crialook.sh DEPLOY_USER conditional block at the top (lines ~16-33) is preserved verbatim — diff vs baseline shows only ADDITIONS, not deletions to that block"
---

# Plan 08-01: deploy-crialook.sh rollback + Discord webhook + ops cleanups

## Objective

Per D-01..D-05, D-07, D-19, D-20, D-22, D-23: turn `deploy-crialook.sh` into a fail-loud, rollback-able deploy with Discord notifications on every meaningful event, and clean up the ops debt (split-brain health-check, unvalidated pm2-startup, missing pm2-logrotate, hard-coded curl timeout).

The rollback contract (D-01..D-03):
1. Save `PREV=$(git rev-parse HEAD)` BEFORE `git pull`
2. If `npm run build` fails: `git reset --hard "$PREV" && npm ci && npm run build`
3. If `--rollback` flag passed at $1: skip pull, reset to HEAD~1, rebuild
4. Drop any uncommitted local changes (`git reset --hard`, NOT `git stash`) — server should not have any; if it does, that's the real bug

The Discord contract (D-04, D-05, D-07):
- One helper `notify_discord(message, color)` reads `DISCORD_WEBHOOK_URL` from env (provisioned by owner per D-07)
- No-op + warn if env missing — never crash deploy on missing webhook
- Notify on: deploy success (with SHA + duration), deploy failure (with last error), rollback fired (with PREV SHA + commit subject)
- Cron-detected restart and degraded states are handled in plan 08-04 (`ops/health-check.sh`), not here

The ops cleanups bundled (small + thematic):
- D-19: stop regenerating `/root/health-check.sh`; cron calls `ops/health-check.sh` in the repo directly; `rm -f /root/health-check.sh` to close split-brain
- D-20: validate pm2 startup output (grep `^sudo`) before piping to bash
- D-22: wire `pm2 install pm2-logrotate && pm2 set pm2-logrotate:max_size 50M && pm2 set pm2-logrotate:retain 14`
- D-23: pin cron `curl` to `-m 5`; doc that `/api/health` shallow path stays DB-free

## Truths the executor must respect

- **Don't break the DEPLOY_USER conditional.** Lines 16-33, 73-95, 130-147 of the current `deploy-crialook.sh` set up the optional dedicated-user path. Plan 08-08 will exercise it via owner-action; this plan must leave it intact.
- **set -e is in effect.** Combine with `trap on_exit EXIT` + `trap on_error ERR` so the Discord notification fires on both clean and dirty exits.
- **Notification is best-effort.** Wrap every `notify_discord` call's underlying `curl` with `|| true`. A Discord outage must NEVER fail a deploy.
- **The rollback path must be idempotent.** Running `bash deploy-crialook.sh --rollback` twice in a row should converge (HEAD~1 the first time; if owner wants HEAD~2, they pass `--rollback HEAD~2` — extra credit, not required for v1).
- **Validate before piping to bash.** Per M-4 (D-20): `pm2 startup systemd ...` writes a "run this as sudo" line. The current code does `... | tail -1 | bash 2>/dev/null || true` which silently runs whatever the last line is. Capture the full output, grep for a line starting with `sudo` or matching the canonical pm2 startup install shape (`sudo env PATH=...`), error out if not found, then `eval` the matched line.
- **Logrotate plugin install is idempotent at the PM2 level.** Re-running `pm2 install pm2-logrotate` is a no-op if already installed. The `pm2 set` calls are also idempotent (last-write-wins). Safe to re-run on every deploy.
- **The cron line must transport `DISCORD_WEBHOOK_URL` into the cron environment.** Cron runs with empty env by default. Two acceptable patterns:
  - Inline-prefix on the cron line: `*/5 * * * * DISCORD_WEBHOOK_URL=... /path/ops/health-check.sh ...`
  - Wrapper at `/etc/crialook/cron-health.sh` that `export`s the var then `exec`s the script
  Executor picks whichever is cleaner; the wrapper is slightly more auditable (no secret in `crontab -l` output).
- **Split-brain cleanup is final.** `rm -f /root/health-check.sh` runs on every deploy after this lands. The first deploy post-merge removes the stale script; subsequent deploys are no-ops on that line.
- **Logging to `/tmp/crialook-deploy.log` enables rich trap context.** Use `exec > >(tee /tmp/crialook-deploy.log) 2>&1` AFTER the shebang. The trap reads `tail -3 /tmp/crialook-deploy.log` to extract the last error context for the Discord embed.
- **Build duration timer.** Use bash builtin `SECONDS=0` near top, `DURATION=$SECONDS` at end. Print as `${DURATION}s` in the success notification.

## Tasks

### Task 1: Add traps + log capture + Discord helper + duration timer at the top of deploy-crialook.sh

<read_first>
- deploy-crialook.sh (FULL FILE — to see current top-of-file structure: shebang, set -e, DOMAIN/APP_NAME/APP_PORT/REPO_URL constants, DEPLOY_USER conditional)
- ops/health-check.sh (to confirm the existing Discord webhook payload format being reused)
- .planning/phases/08-ops-deploy-hardening/08-CONTEXT.md (D-01..D-05, D-07, D-19, D-20, D-22, D-23)
</read_first>

<action>
Add immediately AFTER the existing `set -e` line and BEFORE the `DOMAIN="crialook.com.br"` constant block:

```bash
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

# Fallback if jq absent: simple text content (lossy but functional)
if ! command -v jq >/dev/null 2>&1; then
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
```

Reasoning: declaring `notify_discord` twice (once with `jq`, once without) using a `command -v` guard makes the script robust on minimal Ubuntu installs that don't have `jq`. `jq` is preferred because it produces valid JSON for any payload; the fallback is good enough for ASCII-only error messages.
</action>

<verify>
```bash
bash -n deploy-crialook.sh && echo SYNTAX_OK
grep -c 'notify_discord' deploy-crialook.sh        # expect ≥ 5 (definition x2 + 3+ call sites)
grep -c 'trap on_error ERR\|trap on_exit EXIT' deploy-crialook.sh  # expect 2
grep -c 'tee /tmp/crialook-deploy.log' deploy-crialook.sh           # expect 1
grep -c 'SECONDS=0' deploy-crialook.sh                              # expect 1
```
</verify>

### Task 2: Capture PREV before git pull + add --rollback flag handler + build try/catch with rollback

<read_first>
- deploy-crialook.sh (lines 80-95 — the git pull / clone block; lines 117-120 — npm run build)
- .planning/phases/08-ops-deploy-hardening/08-CONTEXT.md (D-01, D-02, D-03)
</read_first>

<action>
1. **Add a `--rollback` flag handler** immediately after the trap setup from Task 1 and BEFORE the `echo "═══..."` banner:

```bash
# ── Rollback flag (D-02) ──
# Usage: bash deploy-crialook.sh --rollback
# Skips git pull; resets to HEAD~1; rebuilds; reloads PM2. Owner-driven manual rollback.
if [ "${1:-}" = "--rollback" ]; then
  echo "════════════════════════════════════════"
  echo "🔙 CriaLook — Rollback Manual"
  echo "════════════════════════════════════════"
  PROJECT_DIR_RB="${PROJECT_DIR:-/root/Agencia-Fashion}"
  if [ "${DEPLOY_USER:-root}" != "root" ]; then
    PROJECT_DIR_RB="/srv/crialook/Agencia-Fashion"
  fi
  cd "$PROJECT_DIR_RB"
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
```

Reasoning: the rollback path is short and deliberately intersects nothing with the normal flow. It does NOT pm2-logrotate-install, doesn't re-run nginx config, etc. — it's a hot-reload of a known-good prior commit. If the owner needs a deeper rollback (back to a tagged release), they can use `git reset --hard <SHA>` manually then re-run `npm ci && npm run build && pm2 reload crialook` — which is what plan 08-09's `ops/deploy.md` will document.

2. **Capture PREV before `git pull`** (current line ~88). Find:
```bash
if [ -d "$PROJECT_DIR" ]; then
  echo "Projeto já existe, atualizando..."
  cd "$PROJECT_DIR"
  git pull
else
  git clone "$REPO_URL" "$(basename "$PROJECT_DIR")"
  cd "$PROJECT_DIR"
fi
```

Replace with:
```bash
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
```

3. **Wrap `npm run build` in a try/catch with rollback** (current line ~117-120). Find:
```bash
# Build
echo ""
echo "🔨 Buildando projeto..."
npm run build
```

Replace with:
```bash
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
```

Reasoning: the rollback build catastrophic path exits 1 BEFORE PM2 reload. This is intentional — if the rollback build itself fails, PM2 keeps serving the OLD `.next/` and the operator gets paged. Don't reload-into-broken.
</action>

<verify>
```bash
bash -n deploy-crialook.sh && echo SYNTAX_OK
grep -c 'PREV=' deploy-crialook.sh                          # expect ≥ 2 (capture before pull + fresh clone branch)
grep -c -- '--rollback' deploy-crialook.sh                  # expect ≥ 1
grep -c 'git reset --hard' deploy-crialook.sh               # expect ≥ 3 (uncommitted-cleanup + build-fail-rollback + --rollback flag)
grep -c 'rollback build ALSO failed\|rollback failed' deploy-crialook.sh  # expect ≥ 1 (catastrophic guard)
```
</verify>

### Task 3: Validate pm2 startup output before piping to bash (D-20)

<read_first>
- deploy-crialook.sh (lines 134-147 — the pm2 setup block including both DEPLOY_USER branches)
</read_first>

<action>
Find both `pm2 startup systemd ... | tail -1 | bash` invocations (lines 138 and 146). Replace each with a validated capture:

For the root branch (was line 138):
```bash
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
```

For the DEPLOY_USER branch (was line 146):
```bash
PM2_STARTUP_OUT=$(pm2 startup systemd -u "$DEPLOY_USER" --hp "$HOME_DIR" 2>&1)
PM2_STARTUP_CMD=$(printf '%s\n' "$PM2_STARTUP_OUT" | grep -E '^sudo (env|/usr/bin/env) PATH=' | head -1 || true)
if [ -z "$PM2_STARTUP_CMD" ]; then
  echo "⚠ pm2 startup did not emit a recognized 'sudo env PATH=...' install line for $DEPLOY_USER:"
  echo "$PM2_STARTUP_OUT"
else
  echo "Running validated pm2 startup install: $PM2_STARTUP_CMD"
  eval "$PM2_STARTUP_CMD"
fi
```

Reasoning: `pm2 startup` always prints the install command on a line beginning with `sudo env PATH=...` or `sudo /usr/bin/env PATH=...` (PM2 4.x and 5.x). Locale or version variations may add extra lines (warnings, suggestions); grepping for the canonical shape is safer than `tail -1`. If absent, log loudly and proceed — losing auto-start-on-reboot is annoying but not deploy-blocking.
</action>

<verify>
```bash
grep -c 'PM2_STARTUP_OUT=' deploy-crialook.sh   # expect 2 (one per branch)
grep -c 'grep -E.*sudo' deploy-crialook.sh      # expect ≥ 2
grep -c '| tail -1 | bash' deploy-crialook.sh   # expect 0 (old pattern removed)
```
</verify>

### Task 4: Wire pm2-logrotate (D-22)

<read_first>
- deploy-crialook.sh (lines 134-147 — the PM2 setup block; the logrotate install must run AFTER `pm2 save` but BEFORE the health-check wait at line 152)
- ecosystem.config.js (lines 12-15 — the existing comment that documents the install steps; this plan automates them)
</read_first>

<action>
Insert AFTER the `pm2 startup systemd` block (right after the validated install from Task 3) and BEFORE the `# Verificar se app está rodando` block at current line 149:

```bash
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
```

Reasoning: `compress true` is bonus — it gzips rotated logs, saving disk on long-running VPS. Not strictly required by D-22 but nearly free.
</action>

<verify>
```bash
grep -c 'pm2 install pm2-logrotate' deploy-crialook.sh    # expect ≥ 1 (root branch + DEPLOY_USER branch may collapse to ≥ 1 grep hit per call)
grep -c 'pm2-logrotate:max_size 50M' deploy-crialook.sh   # expect ≥ 1
grep -c 'pm2-logrotate:retain 14' deploy-crialook.sh      # expect ≥ 1
```
</verify>

### Task 5: Replace inline /root/health-check.sh with cron line pointing at ops/health-check.sh (D-19, D-23)

<read_first>
- deploy-crialook.sh (lines 240-254 — the entire health-check cron block, HEREDOC + crontab append)
- ops/health-check.sh (FULL FILE — to confirm the script is at the expected path and uses DISCORD_WEBHOOK_URL from env)
- .planning/phases/08-ops-deploy-hardening/08-CONTEXT.md (D-19, D-23)
</read_first>

<action>
Replace the entire current block (lines 240-254 — the `cat > /root/health-check.sh << 'HEALTH'` HEREDOC and the cron line that follows) with:

```bash
# ── Health check cron (D-19, D-23) ──
# Cron calls ops/health-check.sh (in the repo) directly. No more split-brain
# /root/health-check.sh that gets regenerated and overwrites local edits.
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

# D-23: pin curl in ops/health-check.sh to -m 5 (script already does --max-time 10;
# this plan does not modify ops/health-check.sh — that's plan 08-04. The cron
# wrapper is fast-path; if the script ever blocks, systemd-timeout could be added
# here as defense-in-depth, but cron has no native timeout so we rely on the
# script's curl --max-time. Note: /api/health shallow path is DB-FREE per
# health/route.ts:38-43 — if you ever change that, BUMP THE TIMEOUT here too.

# Replace any existing crialook-health entry, then append the new one.
(crontab -l 2>/dev/null | grep -v 'crialook.*health\|health-check' ; \
 echo "*/5 * * * * /etc/crialook/cron-health.sh >> /var/log/crialook/health-check.log 2>&1") | crontab -

mkdir -p /var/log/crialook
echo "✅ Health check cron configured (every 5min → /var/log/crialook/health-check.log)"
```

Reasoning:
- The wrapper at `/etc/crialook/cron-health.sh` keeps the secret out of `crontab -l` and out of the deploy script source (the wrapper sources `/etc/crialook/webhook.env` which the OWNER provisions per D-07 — see plan 08-09's `ops/deploy.md` for the owner action).
- The wrapper resolves `$PROJECT_DIR` from the deploy script's own scope at write time, so the path is baked into the wrapper file. If the owner later moves the repo, they re-run deploy and the wrapper is regenerated with the new path.
- D-23 timeout: this plan does NOT modify `ops/health-check.sh` (that's plan 08-04 — it does the degraded-detection upgrade and tightens curl `--max-time`). The header note explains the contract.
- The `grep -v` pattern catches both old `health-check` entries and any new `crialook.*health` entries — safe to re-run.
</action>

<verify>
```bash
bash -n deploy-crialook.sh && echo SYNTAX_OK
grep -c '/root/health-check.sh' deploy-crialook.sh                  # expect 1 (only the rm -f cleanup line)
grep -c 'rm -f /root/health-check.sh' deploy-crialook.sh             # expect 1
grep -c "<< 'HEALTH'\|<<HEALTH" deploy-crialook.sh                   # expect 0 (HEREDOC removed)
grep -c 'ops/health-check.sh' deploy-crialook.sh                     # expect ≥ 1 (referenced via wrapper or directly)
grep -c '/etc/crialook/cron-health.sh\|/etc/crialook/webhook.env' deploy-crialook.sh  # expect ≥ 1
grep -c 'crialook.*health\|health-check' deploy-crialook.sh          # expect ≥ 2 (the grep -v line + new echo line + comments)
```
</verify>

### Task 6: Add deploy-success notification at the END of the script

<read_first>
- deploy-crialook.sh (the very last block, currently lines 256-277 — the "DEPLOY CONCLUÍDO" banner and the helpful echo lines)
</read_first>

<action>
Insert immediately BEFORE the existing `echo "══════════════════════════════════════════"` (line ~257, the "DEPLOY CONCLUÍDO" banner) and AFTER the cron block from Task 5:

```bash
# ── Success notification (D-04, D-05) ──
COMMIT_SHA=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")
COMMIT_MSG=$(git log --format=%s -1 HEAD 2>/dev/null || echo "unknown")
notify_discord "✅ Deploy success — \`$COMMIT_SHA\` (${SECONDS}s) — $COMMIT_MSG" 3066993
```

The existing `trap on_exit EXIT` from Task 1 will check `$? == 0` and `$DEPLOY_FAILED == false` — it won't double-notify because the trap only fires on failure. Verify by reading the on_exit body in Task 1: it checks `if [ "$DEPLOY_FAILED" = "true" ] || [ $exit_code -ne 0 ]` — success path skips notification in the trap, so the explicit success line above is the only success notification.
</action>

<verify>
```bash
grep -c 'Deploy success' deploy-crialook.sh    # expect 1
grep -c 'notify_discord.*3066993' deploy-crialook.sh  # expect ≥ 2 (success + rolled-back-successfully from Task 2)
```
</verify>

## Files modified

- `deploy-crialook.sh` — add traps + log capture + Discord helper + duration timer (Task 1); --rollback flag handler + PREV capture + build try/catch with rollback (Task 2); pm2 startup output validation (Task 3); pm2-logrotate wire (Task 4); replace inline health-check with cron wrapper (Task 5); success notification (Task 6)

## Why this matters (risk if skipped)

Today, a bad deploy leaves the working tree on the new commit with stale `.next/`. Discord stays silent. `/root/health-check.sh` gets regenerated on every deploy run, blowing away local edits. `pm2 startup` may silently fail to install. PM2 logs grow unbounded. Cron-detected restarts give zero observability. After this plan: every deploy event pages Discord, build failure auto-reverts to last-known-good, and the ops surface is a single source of truth (`ops/health-check.sh` + `ecosystem.config.js`).
