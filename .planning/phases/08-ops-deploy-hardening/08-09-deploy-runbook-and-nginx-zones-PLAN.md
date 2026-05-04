---
plan_id: 08-09
phase: 8
title: ops/deploy.md owner runbook (rollback flow + DISCORD_WEBHOOK_URL provisioning) + nginx zones split owner-action notes (D-02, D-07, D-17)
wave: 2
depends_on: ["08-01", "08-02"]
owner_action: true
files_modified:
  - ops/deploy.md
autonomous: true
requirements: ["D-02", "D-07", "D-17"]
must_haves:
  truths:
    - "deliverable: ops/deploy.md — owner-facing runbook for daily deploy operations + the few owner-action ops that don't fit elsewhere (D-07 webhook provisioning, D-17 nginx zones split, D-02 rollback flow doc)"
    - "doc consolidates THREE owner concerns into one runbook: (1) D-02 'bash deploy-crialook.sh --rollback' flow + when to use vs let auto-rollback fire, (2) D-07 DISCORD_WEBHOOK_URL provisioning at /etc/crialook/webhook.env (owner one-time setup), (3) D-17 nginx zones split — moving limit_req_zone + proxy_cache_path from server scope to /etc/nginx/conf.d/crialook-zones.conf"
    - "doc structure: header → 'Quick reference' (one-line cheat sheet) → 'First-time setup' (D-07 webhook + the optional D-17 zones split) → 'Daily operations' (deploy + rollback) → 'Troubleshooting' → 'Cross-references'"
    - "D-07 DISCORD_WEBHOOK_URL section: exact mkdir + tee + chmod commands. Cite Discord webhook docs (URL pattern: https://discord.com/api/webhooks/<ID>/<TOKEN>). Doc the file location /etc/crialook/webhook.env and the chmod 600 secret-restricted permission. Cross-reference plan 08-01 (Task 5 — the cron wrapper that sources this file)"
    - "D-17 nginx zones split section: (a) explain WHY (M-17: limit_req_zone + proxy_cache_path are valid in http context per nginx docs; in server scope they technically work but the second server block silently ignores them); (b) the migration is one-time owner action because /etc/nginx/conf.d/ is not in the repo. The CANONICAL nginx-crialook.conf KEEPS the zones in server scope (so deploy script copying it doesn't break anything); the owner additionally creates /etc/nginx/conf.d/crialook-zones.conf as a SUPPLEMENTAL file. After the supplemental file lands, the server-scope definitions in nginx-crialook.conf become redundant (nginx logs a duplicate-definition warning) and a follow-up phase can remove them from the canonical config. This plan does NOT modify nginx-crialook.conf — D-17 is owner-action only"
    - "D-17 step-by-step: (1) sudo cat > /etc/nginx/conf.d/crialook-zones.conf << EOF with the limit_req_zone + proxy_cache_path directives, (2) sudo nginx -t (expect possible duplicate-zone warning — that's OK, the zones now exist twice but nginx uses the FIRST definition which is now in conf.d/), (3) sudo systemctl reload nginx, (4) verify via 'nginx -T 2>&1 | grep -c limit_req_zone' (expect 4 — 2 from canonical config + 2 from new conf.d file)"
    - "D-17 NOTE: a future phase (post-M1) can remove the now-duplicated zones from nginx-crialook.conf by sed-stripping lines 7-13 of the canonical config. Until then, the canonical config keeps zones in server scope so deploy-crialook.sh remains idempotent (a fresh distro deploy gets the working config from copy-canonical alone, without requiring the conf.d/ supplemental). Doc this trade-off explicitly"
    - "D-02 rollback section: explain the THREE rollback paths and when to use each: (a) AUTO rollback fired by deploy-crialook.sh on build failure (plan 08-01 Task 2) — happens automatically, owner sees Discord notification, no action needed, (b) MANUAL rollback via 'bash deploy-crialook.sh --rollback' — for cases where build succeeded but a runtime issue surfaces post-deploy (5xx spike, broken page) and owner wants to revert to HEAD~1 fast, (c) DEEP rollback to a specific tagged release — for cases where the issue went unnoticed past several deploys; owner does git checkout <tag> + npm ci + npm run build + pm2 reload manually"
    - "D-02 rollback section: provide the exact 'bash deploy-crialook.sh --rollback' command + expected Discord notification + how to verify ('curl https://crialook.com.br/api/health' + 'pm2 status') + the SLA target ('rollback to last known good in <60s — covered by P8 success criterion #1 in ROADMAP.md')"
    - "doc has a 'Quick reference' section at the top: a 5-line cheat sheet (deploy / rollback / status / logs / Discord notifications). The owner reads ONE doc when something is on fire — make it scannable"
    - "doc cross-references the related plans: 08-01 (deploy script changes), 08-02 (nginx config changes), 08-04 (health check), 08-06 (CSP rollout), 08-08 (DEPLOY_USER migration). Each cross-ref is a one-line bullet"
    - "doc explicitly does NOT duplicate content from those plans — it points the owner at them. Single source of truth principle. The exception is the QUICK REFERENCE which IS partially duplicated for scannability"
    - "doc is concise — target 100-180 lines. Owner doesn't read a 500-line runbook in an emergency"
    - "doc lives at ops/deploy.md (alongside ops/health-check.sh and ops/csp-rollout.md) — sibling-of-other-ops-docs convention"
    - "include a 'Versioning' / changelog table at the bottom so future owners can track what changed"
  acceptance:
    - "test -f ops/deploy.md exits 0"
    - "wc -l ops/deploy.md returns at least 100"
    - "wc -l ops/deploy.md returns at most 250 (concise — runbooks are scannable)"
    - "grep -c '^## ' ops/deploy.md returns at least 5 (Quick reference + First-time setup + Daily operations + Troubleshooting + Cross-references)"
    - "grep -c 'Quick reference\\|Quick ref' ops/deploy.md returns at least 1"
    - "grep -c '/etc/crialook/webhook.env' ops/deploy.md returns at least 1 (D-07 file path)"
    - "grep -c 'discord.com/api/webhooks' ops/deploy.md returns at least 1 (D-07 webhook URL pattern)"
    - "grep -c 'chmod 600' ops/deploy.md returns at least 1 (D-07 secret restriction)"
    - "grep -c 'crialook-zones.conf' ops/deploy.md returns at least 1 (D-17 file)"
    - "grep -c 'limit_req_zone\\|proxy_cache_path' ops/deploy.md returns at least 2 (D-17 directives)"
    - "grep -c -- '--rollback' ops/deploy.md returns at least 2 (D-02 manual rollback flow)"
    - "grep -c 'plan 08-01\\|08-01\\|08-02\\|08-04\\|08-06\\|08-08' ops/deploy.md returns at least 4 (cross-refs to sibling plans)"
    - "grep -c '- \\[ \\]' ops/deploy.md returns at least 3 (owner action checklists)"
    - "grep -c 'systemctl reload nginx\\|nginx -t\\|nginx -T' ops/deploy.md returns at least 2 (D-17 verification commands)"
    - "grep -c 'AUTO rollback\\|auto-rollback\\|automatic rollback' ops/deploy.md returns at least 1 (D-02 explains 3 rollback paths)"
---

# Plan 08-09: ops/deploy.md owner runbook + nginx zones split owner-action notes

## Objective

Per D-02, D-07, D-17: consolidate three owner-action concerns into a single concise runbook at `ops/deploy.md`:

- **D-02:** Document the `bash deploy-crialook.sh --rollback` flow (three rollback paths: auto, manual, deep)
- **D-07:** Document the one-time `DISCORD_WEBHOOK_URL` provisioning at `/etc/crialook/webhook.env` that plan 08-01's cron wrapper sources
- **D-17:** Document the nginx zones split — moving `limit_req_zone` and `proxy_cache_path` from server scope to `/etc/nginx/conf.d/crialook-zones.conf`. This is owner-action because `/etc/nginx/conf.d/` is not tracked by the repo; the canonical `nginx-crialook.conf` keeps the zones in server scope for deploy idempotency

The doc is the owner's single entry point for deploy ops. It does NOT duplicate the per-plan implementation details (those live in their respective plan docs); it gives the owner a flat, scannable guide for "what do I do when X".

## Truths the executor must respect

- **Concise > exhaustive.** Target 100-180 lines. Owner reads this when something is on fire — make it scannable.
- **Quick reference at the top.** Owner scrolls to top, sees 5 cheat-sheet lines, takes the right action without reading the full doc.
- **Cross-reference, don't duplicate.** Each related plan (08-01, 08-02, 08-04, 08-06, 08-08) gets a one-line bullet pointing the owner at it. The exception is the Quick Reference cheat-sheet (intentionally duplicates the most-common commands for scannability).
- **D-17's awkward middle ground.** The canonical `nginx-crialook.conf` keeps zones in server scope (for deploy idempotency — a fresh distro gets a working config from `copy-canonical` alone). The owner's one-time action ADDS a supplemental `/etc/nginx/conf.d/crialook-zones.conf` so future server blocks (if added) see the zones in http context. After the supplemental lands, the server-scope definitions in nginx-crialook.conf become redundant and a follow-up phase can clean them up. Doc this trade-off honestly.
- **D-07's webhook URL is a SECRET.** `chmod 600` after writing. Doc the URL pattern (`https://discord.com/api/webhooks/<ID>/<TOKEN>`) so owner knows where to get one (Discord channel settings → Integrations → Webhooks → New Webhook → Copy URL).
- **D-02's three rollback paths.** AUTO (deploy script handles, owner just sees Discord), MANUAL (owner runs `--rollback` for fast revert to HEAD~1), DEEP (owner does manual git + npm + pm2 for older revert). Each path has its triggering condition + exact command + verification step.
- **No code changes.** This plan is doc-only. Cross-references say "see plan 08-XX" — those plans own their implementation.

## Tasks

### Task 1: Author ops/deploy.md

<read_first>
- deploy-crialook.sh (post-plan-08-01 — to confirm the --rollback flag handler exists for D-02 reference)
- ops/health-check.sh (post-plan-08-04 — to confirm the wrapper at /etc/crialook/cron-health.sh sources /etc/crialook/webhook.env for D-07 reference)
- nginx-crialook.conf (post-plan-08-02 — to confirm zones still in server scope for D-17 trade-off explanation)
- ops/csp-rollout.md (sibling owner-action doc for tone/style reference)
- ops/DEPLOY_USER_MIGRATION.md (post-plan-08-08 — sibling owner-action doc for cross-ref)
- .planning/phases/08-ops-deploy-hardening/08-CONTEXT.md (D-02, D-07, D-17)
</read_first>

<action>
Create `ops/deploy.md`:

```markdown
# Deploy Runbook (CriaLook ops)

Owner-facing runbook for daily deploy operations. **Read this first when something is on fire.**

## Quick reference

```bash
# Normal deploy (creates rollback anchor + Discord notify)
ssh root@crialook.com.br
cd /srv/crialook/Agencia-Fashion   # or /root/Agencia-Fashion if pre-08-08 cutover
bash deploy-crialook.sh

# Manual rollback to HEAD~1 (use when build succeeded but runtime issue post-deploy)
bash deploy-crialook.sh --rollback

# Status checks
pm2 status crialook                              # process state
curl -sI https://crialook.com.br/api/health      # site health (200 = up)
tail -50 /var/log/crialook/health-check.log      # cron health log

# Discord notification source: posts to DISCORD_WEBHOOK_URL via /etc/crialook/webhook.env
```

---

## First-time setup (one-time owner actions)

### Provision DISCORD_WEBHOOK_URL (D-07, plan 08-01)

The deploy script and cron health-check both notify Discord. URL is owner-provisioned:

```bash
# 1. Create a Discord webhook in your server:
#    Discord channel settings → Integrations → Webhooks → New Webhook → Copy URL
#    URL pattern: https://discord.com/api/webhooks/<ID>/<TOKEN>

# 2. On the VPS, write the env file:
sudo mkdir -p /etc/crialook
echo "DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/REDACTED" | sudo tee /etc/crialook/webhook.env
sudo chmod 600 /etc/crialook/webhook.env  # secret — restrict reads to root only

# 3. Verify the cron wrapper sources it:
cat /etc/crialook/cron-health.sh
# Expected: line containing ". /etc/crialook/webhook.env"
```

After this:
- Every `bash deploy-crialook.sh` posts ✅ deploy success / 🚨 deploy failure to Discord
- Every cron health-check (5min) posts 🚨 down / ✅ recovered notifications
- Cron WARN-once-per-run if file missing (graceful)

Cross-ref: plan 08-01 Task 5 (cron wrapper); plan 08-04 (health-check Discord enhancements).

### Optional: nginx zones split (D-17, M-17)

The canonical `nginx-crialook.conf` defines `limit_req_zone` + `proxy_cache_path` at server scope (technically valid but per nginx docs they belong in http context). To move them to http context:

```bash
# 1. Create the supplemental conf.d/ file (extracts the zones from nginx-crialook.conf lines 7-13)
sudo tee /etc/nginx/conf.d/crialook-zones.conf << 'ZONES'
# Phase 8 D-17: limit_req_zone + proxy_cache_path moved to http context per nginx docs.
# Originally defined at server scope in /etc/nginx/sites-available/crialook (lines 7-13);
# server-scope definitions are now redundant (nginx logs duplicate warnings — that's OK).
# A follow-up phase can sed-strip lines 7-13 from the canonical nginx-crialook.conf to
# eliminate the duplication; meanwhile, server-scope keeps deploy-crialook.sh idempotent.

limit_req_zone $binary_remote_addr zone=api_limit:10m rate=10r/s;
limit_req_zone $binary_remote_addr zone=webhook_limit:10m rate=30r/s;

proxy_cache_path /var/cache/nginx/crialook levels=1:2 keys_zone=html_cache:10m
                 max_size=100m inactive=1h use_temp_path=off;
ZONES

# 2. Validate
sudo nginx -t
# Expected: "syntax is ok" + possibly a "duplicate zone html_cache" or "duplicate ... api_limit" WARN
# (warns are OK — nginx uses the first definition, which is now in conf.d/)

# 3. Reload nginx
sudo systemctl reload nginx

# 4. Verify both definitions exist (the duplication is intentional during transition):
sudo nginx -T 2>&1 | grep -c 'limit_req_zone'
# Expected: 4 (2 from canonical config + 2 from new conf.d/)
sudo nginx -T 2>&1 | grep -c 'proxy_cache_path'
# Expected: 2 (1 from each)
```

**Trade-off:** The canonical nginx-crialook.conf keeps the zones in server scope so a fresh distro deploy gets a working config from `cp nginx-crialook.conf /etc/nginx/sites-available/crialook` alone (no dependency on conf.d/). After this owner action lands, future deploys log a "duplicate zone" WARN — non-fatal. A follow-up phase post-M1 can sed-strip the redundant server-scope definitions from the canonical config to clean up the warning.

Cross-ref: nginx-crialook.conf:7-13 (the server-scope definitions this duplicates); MONOREPO-BUG-BASH M-17 (the diagnosis).

---

## Daily operations

### Normal deploy

```bash
ssh root@crialook.com.br
cd /srv/crialook/Agencia-Fashion   # /root/Agencia-Fashion if pre-08-08 cutover
bash deploy-crialook.sh
```

What happens (per plan 08-01):
1. Captures `PREV=<current SHA>` as rollback anchor
2. `git pull` (drops any uncommitted local changes — server should be clean)
3. `npm ci && npm run build` — if build fails, AUTO-ROLLBACK to PREV + Discord notify
4. PM2 reload (graceful 30s shutdown window for in-flight pipelines)
5. pm2-logrotate ensured (50M × 14 retention)
6. nginx config copied from canonical + reloaded
7. Health check passes → Discord ✅ "Deploy success" notification

If anything fails: Discord 🚨 notification fires with last 5 lines of log context.

### Rollback paths (D-02)

Three rollback paths, each for a different scenario:

**1. AUTO rollback** (plan 08-01 Task 2)
- Triggered by: `npm run build` failure during normal deploy
- Action: deploy script automatically `git reset --hard $PREV && npm ci && npm run build && pm2 reload`
- Owner action: NONE — Discord notification arrives describing the rollback
- SLA: site never serves stale .next/ — old code stays online until rolled-back build is ready
- Catastrophic case (rollback build also fails): Discord 💥 CRITICAL notification + deploy script exits 1; owner must manually intervene

**2. MANUAL rollback to HEAD~1** (plan 08-01 Task 2)
- Triggered by: build SUCCEEDED but post-deploy runtime issue (5xx spike, broken page, regression)
- Action: `bash deploy-crialook.sh --rollback`
- What happens: skips git pull; `git reset --hard HEAD~1 && npm ci && npm run build && pm2 reload`
- Owner action: paste the command, wait <60s, verify
- SLA: <60s from command to live (per P8 success criterion #1 in ROADMAP.md)
- Discord notification: 🔙 "Manual rollback: <PREV_SHA> → <TARGET_SHA>"

```bash
ssh root@crialook.com.br
cd /srv/crialook/Agencia-Fashion
bash deploy-crialook.sh --rollback
# Wait <60s, then verify:
curl -sI https://crialook.com.br/api/health | head -1
# Expected: HTTP/2 200
pm2 status crialook
# Expected: status=online, restart count incremented by 1
```

**3. DEEP rollback to a specific tagged release**
- Triggered by: issue went unnoticed past several deploys; HEAD~1 isn't enough
- Action: manual git + npm + pm2 (the script doesn't support arbitrary-SHA rollback by design — keeps the script simple)

```bash
ssh root@crialook.com.br
cd /srv/crialook/Agencia-Fashion
git log --oneline -20    # find the target SHA
git reset --hard <SHA>   # e.g., the SHA before the regression-introducing commit
cd campanha-ia
npm ci
npm run build
pm2 reload crialook
# Verify
curl -sI https://crialook.com.br/api/health | head -1
```

After deep rollback, manually post a Discord notification:
```bash
. /etc/crialook/webhook.env
curl -fsS -X POST -H 'Content-Type: application/json' \
  -d "{\"content\":\"🔙 Deep rollback to $(git rev-parse --short HEAD) — manual investigation in progress\"}" \
  "$DISCORD_WEBHOOK_URL"
```

### Status + logs

```bash
pm2 status crialook                                # process state, uptime, restart count
pm2 logs crialook --lines 50 --nostream            # last 50 log lines (non-streaming)
pm2 monit                                          # interactive monitor (CPU/RAM)
tail -50 /var/log/crialook/health-check.log        # cron health-check tail
tail -50 /var/log/crialook/out.log                 # PM2 stdout
tail -50 /var/log/crialook/error.log               # PM2 stderr
journalctl -u nginx --since '1 hour ago'           # nginx system journal
sudo nginx -T | grep -A 3 'server_name'            # full effective nginx config
```

---

## Troubleshooting

### Site returns 502 after deploy
PM2 process probably failed to start. Check `pm2 logs crialook --lines 100`. Common causes:
- Missing `.env.local` or wrong permissions → see plan 08-08 Common Errors
- npm ci failed due to lock drift → check `npm ci` output in deploy log at `/tmp/crialook-deploy.log`

### Discord notifications stopped firing
- Verify `/etc/crialook/webhook.env` exists + correct URL: `cat /etc/crialook/webhook.env`
- Verify the wrapper sources it: `cat /etc/crialook/cron-health.sh`
- Test manually: `. /etc/crialook/webhook.env && curl -fsS -X POST -H 'Content-Type: application/json' -d '{"content":"test"}' "$DISCORD_WEBHOOK_URL"`
- If Discord rotated the webhook, regenerate URL from Discord channel settings → update `/etc/crialook/webhook.env`

### Health-check cron loop-restarting
`/var/log/crialook/health-check.log` shows repeated `STATUS=000 — restarting PM2`. Causes:
- nginx down (verify `systemctl status nginx`) — health check goes through nginx
- /api/health timeout > 5s (cron timeout per D-23) — check next.js logs for slow shallow handler

### Deploy auto-rollback fired multiple times in a row
Indicates a persistent build issue. Check `/tmp/crialook-deploy.log` for the failing step. Common: TypeScript error introduced in last PR, missing dependency, env-var schema validation failure (instrumentation.ts loadEnv throws at boot — see plan 08-05 Task 1's boot log line).

### Need to revert past several deploys
Use DEEP rollback (above). Then root-cause the regression before redeploying.

---

## Operational checklists

Before every prod deploy:
- [ ] PR merged to main; CI green (lint + typecheck + tests + legal-drift + deploy-user-lint)
- [ ] Mental check: "if this build fails AND auto-rollback fails, am I OK with manual intervention right now?"
- [ ] If a major change (schema migration, env var addition): low-traffic window selected

After every prod deploy:
- [ ] Discord ✅ "Deploy success" notification received
- [ ] `curl -sI https://crialook.com.br/api/health | head -1` returns `HTTP/2 200`
- [ ] `pm2 status crialook` shows uptime > 0 and increased restart count

Weekly:
- [ ] Spot-check `tail -100 /var/log/crialook/health-check.log` — should be all `[health] STATUS=200` lines OR known degraded windows you triaged
- [ ] Spot-check Sentry dashboard for new error categories
- [ ] Review CSP rollout doc (`ops/csp-rollout.md`) — if in observation window, count days since last violation

---

## Cross-references

- **plan 08-01:** deploy-crialook.sh — rollback flag, Discord helper, pm2-logrotate, ops cleanups
- **plan 08-02:** nginx-crialook.conf — Brotli graceful fallback, SSE proxy_request_buffering, CSP report-uri
- **plan 08-04:** ops/health-check.sh — degraded detection rationale, Discord enhancements
- **plan 08-06:** ops/csp-rollout.md — Report-Only → enforced 14-day gate procedure
- **plan 08-08:** ops/DEPLOY_USER_MIGRATION.md — root → crialook user 7-step SSH/sudo cutover
- **MONOREPO-BUG-BASH M-17:** the original diagnosis behind D-17 (nginx zones split)
- **CONCERNS §10:** the original diagnosis behind D-07 (DISCORD provisioning)

---

## Versioning

| Date | Editor | Change |
|------|--------|--------|
| 2026-05-04 | Phase 8 plan 08-09 | Initial runbook; D-07 webhook + D-17 zones-split owner actions documented |
```
</action>

<verify>
```bash
test -f ops/deploy.md && echo OK
wc -l ops/deploy.md                                                 # expect 100-250
grep -c '^## ' ops/deploy.md                                        # expect ≥ 5
grep -c 'Quick reference\|Quick ref' ops/deploy.md                  # expect ≥ 1
grep -c '/etc/crialook/webhook.env' ops/deploy.md                   # expect ≥ 1
grep -c 'discord.com/api/webhooks' ops/deploy.md                    # expect ≥ 1
grep -c 'chmod 600' ops/deploy.md                                   # expect ≥ 1
grep -c 'crialook-zones.conf' ops/deploy.md                         # expect ≥ 1
grep -c 'limit_req_zone\|proxy_cache_path' ops/deploy.md            # expect ≥ 2
grep -c -- '--rollback' ops/deploy.md                               # expect ≥ 2
grep -c 'plan 08-01\|08-01\|08-02\|08-04\|08-06\|08-08' ops/deploy.md  # expect ≥ 4
grep -c '- \[ \]' ops/deploy.md                                     # expect ≥ 3
grep -c 'systemctl reload nginx\|nginx -t\|nginx -T' ops/deploy.md  # expect ≥ 2
grep -c 'AUTO rollback\|auto-rollback' ops/deploy.md                # expect ≥ 1
```
</verify>

## Files modified

- `ops/deploy.md` — NEW; concise owner runbook covering D-02 rollback flow + D-07 Discord webhook provisioning + D-17 nginx zones split (Task 1)

## Owner-action callout (D-02, D-07, D-17)

This entire plan is owner-action. The agent writes the runbook; the owner:
- Reads "Quick reference" when something is on fire
- Executes "First-time setup" once (D-07 webhook provisioning, optionally D-17 zones split)
- Reads "Daily operations" → "Rollback paths" when needing manual rollback (D-02)

The runbook is the durable knowledge surface — it survives staffing changes, agent restarts, and rare ops events the owner won't remember command-line details for after months.

## Why this matters (risk if skipped)

Without `ops/deploy.md`, the owner needs to chase three different per-plan docs to find rollback commands, webhook provisioning, and the nginx zones split rationale. In an outage, they'd be reading agent-generated plan files at 2 AM with adrenaline. This runbook is the single scannable surface they hit first. The "Quick reference" cheat sheet at the top means even at 2 AM the right action is visible without scrolling.
