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
