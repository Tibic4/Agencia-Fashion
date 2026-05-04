# Phase 8: Ops & Deploy Hardening - Context

**Gathered:** 2026-05-04
**Status:** Ready for planning (P1 dependency done; web phases done — final M1 phase)

<domain>
## Phase Boundary

Make the deploy script + nginx + PM2 surface fail-loud, rollback-able, and observability-correct so a bad deploy can be reverted in <5 min and a degraded-but-up app actually pages someone.

In scope (PHASE-DETAILS Phase 8 — full list there). Out: multi-instance rate-limit (P4), GPG-signed commits (parking), MP IP allowlist (parking).

</domain>

<decisions>
## Implementation Decisions

### Deploy rollback (M-2)
- **D-01:** `git reset --hard $PREV + npm ci + rebuild`. Capture `PREV=$(git rev-parse HEAD)` before `git pull`. On build failure: `git reset --hard "$PREV" && npm ci && npm run build`.
- **D-02:** Document `bash deploy-crialook.sh --rollback` flow in `ops/deploy.md` (or extend `deploy-crialook.sh` header).
- **D-03:** Drop uncommitted local changes (server should not have any; if it does, that's the bug).

### Deploy / health notifications (M-1)
- **D-04:** Discord webhook. Env: `DISCORD_WEBHOOK_URL`.
- **D-05:** Notification triggers:
  - Deploy success (with commit SHA + duration)
  - Deploy failure (with last error line)
  - Health-check cron detects restart (with timestamp + uptime stats)
  - Cron-detected `degraded` state (D-06)
- **D-06:** Health check distinguishes degraded vs healthy: parse response body for `status: "unhealthy"` or `status: "degraded"`. 503 = unhealthy. 200 with degraded body = degraded (notify but don't restart).
- **D-07:** Discord webhook URL stored as env var on server (not in repo). Doc the provisioning step.

### CSP Report-Only → Enforced timing (M-6)
- **D-08:** Plan adds `report-uri` (Sentry CSP integration or `/api/csp-report` endpoint).
- **D-09:** Stay in `Content-Security-Policy-Report-Only` mode for **2 weeks**. Owner monitors Sentry CSP reports.
- **D-10:** After 2 weeks of zero violations, owner flips header from `Content-Security-Policy-Report-Only` to `Content-Security-Policy` (single nginx config edit). Doc the criteria + flip step in `ops/csp-rollout.md`.
- **D-11:** Re-trigger 2-week observation window if any violation appears.

### DEPLOY_USER root cleanup (CONCERNS §10)
- **D-12:** **AGGRESSIVE plan with structured owner-action task list** (per owner choice). Plan contains numbered sequential tasks marked `owner-action: true` (SSH/sudo work, not autonomous):
  1. Create dedicated `crialook` user on server: `sudo adduser --system --group --shell /bin/bash crialook`
  2. Transfer ownership: `sudo chown -R crialook:crialook /var/www/crialook /var/log/crialook`
  3. Sudoers config: only allow `crialook` to run specific commands (`/usr/bin/systemctl restart crialook`, `/usr/bin/nginx -s reload`)
  4. Update `deploy-crialook.sh`: replace any `sudo` calls with the limited sudoers set
  5. Update PM2 ecosystem.config.js: `user: 'crialook'`
  6. Smoke test: deploy from new user, verify nginx reload, PM2 restart all work
  7. Rollback path: doc how to revert to root if migration breaks
- **D-13:** Add CI/lint check that warns if production env runs as root. Helper: `scripts/check-deploy-user.sh` runs in CI, parses `ecosystem.config.js`, fails if `user === 'root'`.
- **D-14:** Owner executes the SSH/sudo steps manually (I don't have prod SSH creds). Plan provides exact commands ready to paste.
- **D-15:** Doc lives at `ops/DEPLOY_USER_MIGRATION.md`.

### nginx fixes (M-5, M-13, M-17)
- **D-16:** Brotli block: generate conditionally or require Brotli install before continuing. Pattern: `nginx -t` checks `--with-http_brotli_module`; if absent, skip Brotli config block (nginx doesn't fail) but log warn.
- **D-17:** Move `limit_req_zone` and `proxy_cache_path` from server scope to `/etc/nginx/conf.d/crialook-zones.conf` (http context). Required for nginx to parse correctly.
- **D-18:** Add `proxy_request_buffering off;` to `/api/campaign/generate` location for SSE multipart upload latency improvement.

### Other small ops fixes (Claude's discretion within constraints)
- **D-19 (M-3):** Stop regenerating `/root/health-check.sh` on every deploy run. Cron calls `ops/health-check.sh` (in repo) directly.
- **D-20 (M-4):** Validate `pm2 startup systemd` output before piping to bash (capture, grep `^sudo`, validate format).
- **D-21 (M-7):** Move `start = Date.now()` for DB latency metric in `/api/health` to immediately before the Supabase call (not at top of handler).
- **D-22 (CONCERNS §10):** Wire `pm2 install pm2-logrotate && pm2 set pm2-logrotate:max_size 50M && pm2 set pm2-logrotate:retain 14` into `deploy-crialook.sh`.
- **D-23 (CONCERNS §10):** Pin health-check cron `curl` to `-m 5` timeout. Doc that `/api/health` shallow path stays DB-free.
- **D-24 (M-9):** Add a single boot log line summarizing env load status (so server start is observable).
- **D-25 (M-10):** Switch `getCurrentUsage` from `.single()` to `.maybeSingle()` with explicit multi-row handling. Verify `(store_id, period_start)` UNIQUE constraint is in place.
- **D-26 (L-5):** Verify `loadtests/README.md` capacity numbers carry `last measured: <date>` note OR move into per-run reports.
- **D-27 (M-14):** Verify CI Sentry source-map upload only fires on main-branch deploys, not PR builds (saves Sentry quota).
- **D-28 (L-8):** Add explicit `signingKey` to `inngest/client.ts`.
- **D-29:** Verify Sentry `Pipeline:Scorer` ignore filter (`sentry.server.config.ts`) is intentional — confirm in commit/comment that it's not silencing real judge failures (P2 added judge_pending tracking; the filter may now mask real signals).

### Claude's Discretion
- Format of Discord webhook payload (rich embed vs simple text)
- Brotli fallback approach (warn vs block deploy)
- Exact CI lint check shell for `check-deploy-user.sh`

### Flagged for plan-phase research
- **R-01:** Read `deploy-crialook.sh` current shape — D-01..D-03 patches in place
- **R-02:** Read `nginx-crialook.conf` current state for D-16..D-18 patches
- **R-03:** Read `ecosystem.config.js` current `user` field — D-13 lint baseline
- **R-04:** Confirm `/api/health` current shape — D-06, D-21, D-23
- **R-05:** Confirm Sentry `Pipeline:Scorer` filter location and current behavior (D-29)

</decisions>

<specifics>
## Specific Ideas

- "Bad deploy reverts em <5 min" — D-01..D-03
- "Discord webhook pra deploy + degraded + restart" — D-04..D-06
- "2 semanas zero violation = enforce CSP" — D-09..D-11
- "DEPLOY_USER cutover é aggressive — owner SSH/sudo via plan estruturado, eu não tenho creds" — D-12..D-15
- "nginx fixes têm fallback graceful (Brotli warn não block)" — D-16

</specifics>

<canonical_refs>
## Canonical References

### Phase scope sources
- `.planning/PROJECT.md`
- `.planning/ROADMAP.md` §"Phase 8"
- `.planning/PHASE-DETAILS.md` §"Phase 8"

### Findings to address
- `.planning/audits/MONOREPO-BUG-BASH.md` — M-1, M-2, M-3, M-4, M-5, M-6, M-7, M-9, M-10, M-13, M-14, M-17, L-5, L-8
- `.planning/codebase/CONCERNS.md` §10 (deploy as root, pm2-logrotate, health-check cron, cron/exchange-rate)

### Codebase intel
- `.planning/codebase/ARCHITECTURE.md` §"Deployment topology"
- `.planning/codebase/STACK.md`

### Phase 1 dependency (done)
- P1 fixed billing/credit atomicity. P8 doesn't extend that, just hardens ops surface.

### Phase 2 dependency (done)
- P2 added judge_pending tracking. D-29 verifies the Sentry Pipeline:Scorer ignore filter doesn't mask new signals.

### Out-of-M1
- Multi-instance rate-limit migration → P4 (already done if executed)
- GPG-signed commit verification → parking lot
- MP webhook IP allowlist → parking lot

</canonical_refs>

<code_context>
## Existing Code Insights

### Files this phase touches
- `deploy-crialook.sh` — D-01..D-03, D-12 sudoers integration, D-22 logrotate
- `nginx-crialook.conf` — D-16, D-17, D-18
- `/etc/nginx/conf.d/crialook-zones.conf` (new) — D-17
- `ops/health-check.sh` — D-19 single source
- `ops/csp-rollout.md` (new) — D-08..D-11
- `ops/DEPLOY_USER_MIGRATION.md` (new) — D-15
- `ops/deploy.md` (new or update) — D-02
- `ecosystem.config.js` — D-12 step 5
- `scripts/check-deploy-user.sh` (new) — D-13
- `.github/workflows/ci.yml` — D-13 wire lint
- `inngest/client.ts` — D-28
- `campanha-ia/src/app/api/health/route.ts` — D-06, D-21, D-23
- `campanha-ia/src/lib/db/index.ts` — D-25 getCurrentUsage
- `campanha-ia/sentry.server.config.ts` — D-29 verify filter
- `loadtests/README.md` — D-26

### Established Patterns
- Atomic per-task commits (P1, P2, P3, P4)
- Owner-action checkpoints (P4, P5, P6, P7) — D-12 follows
- Migration-files-written-not-pushed (no migrations in P8 — pure ops/code)

</code_context>

<deferred>
## Deferred Ideas

- GPG-signed commit verification → parking lot
- MP webhook IP allowlist → parking lot (IP ranges churn)
- Multi-instance rate-limit migration → P4 owns
- Cron secret query-param fix on `/api/cron/exchange-rate` → moved to P4 (D-23 in P4 CONTEXT)
- Brotli installation script as part of bootstrap → parking lot if not blocking

</deferred>

---

*Phase: 08-ops-deploy-hardening*
*Context gathered: 2026-05-04*
