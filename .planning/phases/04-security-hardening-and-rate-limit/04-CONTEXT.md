# Phase 4: Security Hardening & Rate Limit - Context

**Gathered:** 2026-05-04
**Status:** Ready for planning (Phase 1 dependency satisfied)

<domain>
## Phase Boundary

Close defense-in-depth gaps that compound with billing/AI risks — webhook replay, SSRF on `/api/campaign/format`, MIME-type forgery, RPC GRANT drift, in-memory rate limiter under Cloudflare, committed `.env.loadtest`, admin role drift — so a single leak doesn't cascade into account compromise or unbounded AI spend.

Full scope from PHASE-DETAILS Phase 4 §"Scope (in)". Out-of-scope: MP IP allowlist (parking), full prompt-injection eval suite (Promptfoo never blocks per memory), editor → per-user passwords (acceptable at scale).

</domain>

<decisions>
## Implementation Decisions

### MP webhook replay defense
- **D-01:** Reuse the `webhook_events` table from Phase 1 (delivered in commit `e7c2938`). Query path filters by `provider='mp'`. Avoid duplicating dedup infrastructure.
- **D-02:** If queries/UI need MP-only view, expose as a Postgres VIEW `mp_webhook_seen` over `webhook_events WHERE provider='mp'`. No new physical table.
- **D-03:** Reject empty `x-request-id` at handler entry (400 Bad Request). HMAC + 5min skew + dedup is layered defense.

### Rate limit storage
- **D-04:** Postgres-backed token bucket. Schema: `rate_limit_buckets (key TEXT PRIMARY KEY, tokens INTEGER, refilled_at TIMESTAMPTZ)`. `key` = `<route>:<client_id>` where client_id is `store_id` if authed, else `cf-connecting-ip` hash.
- **D-05:** Refill via `UPDATE … RETURNING` arithmetic in a SECURITY DEFINER RPC `consume_rate_limit_token(key, capacity, refill_rate)`. Single round-trip per request. Latency budget: ≤10ms p95.
- **D-06:** Cloudflare-aware: read `cf-connecting-ip` first, fall back to `x-forwarded-for` parsing, then socket. Document in route comments.
- **D-07:** PM2 restart no longer resets attacker quota — bucket survives process restart.
- **D-08:** Redis migration is parking-lot; document the migration path in a `docs/ratelimit.md` for future reference.

### Admin role cutover
- **D-09:** `publicMetadata.role === 'admin'` becomes the **canonical** check. All `/api/admin/*` routes + middleware switch to it.
- **D-10:** `ADMIN_USER_IDS` env var stays as **break-glass only**. Behavior:
  - In production: env var has NO default; if set, log Sentry warn `admin.breakglass_used` with userId
  - In development: env var still works as today
- **D-11:** Migration strategy: add `publicMetadata.role` to existing admin users via Clerk Dashboard (one-time manual op, owner does post-deploy). Document in `docs/admin-role-migration.md`.
- **D-12:** Add log-on-deny: every 403 from `/api/admin/*` emits Sentry warn `admin.deny` with tags `route, userId_hash, reason` (no current audit trail).

### `.env.loadtest` cleanup
- **D-13:** Sequence:
  1. **Audit content first**: open the file, identify every credential/cookie/token. Document what's there in the audit task output.
  2. If real Clerk session cookie present: revoke session in Clerk Dashboard immediately (manual owner step — flag in plan)
  3. Add `loadtests/.env.loadtest` to `.gitignore`
  4. `git filter-repo --path loadtests/.env.loadtest --invert-paths` to remove from full history
  5. Document recovery path: `git filter-repo` rewrites history; backup repo before; communicate force-push timing to anyone with local clones (here: just owner)
- **D-14:** Owner action (manual): execute the Clerk revoke + force-push. Plan flags these as `owner-action` checkpoints.

### Other in-scope hardening (Claude's discretion within constraints)
- **D-15:** Pin `/api/campaign/format` `imageUrl` host to Supabase Storage origin allowlist; mirror on `/api/campaign/generate`'s `modelImageUrl`. Allowlist lives in code (env-configurable).
- **D-16:** Sharp `.metadata()` magic-byte check on uploaded buffers (generate, logo, model/create routes). Reject mismatched MIME at route boundary.
- **D-17:** Replace top-level service-role `createClient` in `app/api/fashion-facts/route.ts` with `createAdminClient()` inside handler. Same audit pass on `middleware.ts:hasStore`.
- **D-18:** RPC GRANT hardening: `REVOKE ALL FROM PUBLIC, anon, authenticated; GRANT EXECUTE TO service_role` on `acquire_checkout_lock`, `release_checkout_lock`, `can_generate_campaign`, `increment_campaign_usage`. Match existing hardened-RPC pattern.
- **D-19:** Drop legacy `increment_regen_count(uuid)` single-arg overload (no IDOR check).
- **D-20:** Anon-abuse counter persists in Postgres (reuses `rate_limit_buckets` infra from D-04).
- **D-21:** Gate `/api/campaign/generate` behind `auth().userId` (since `IS_DEMO_MODE` never fires in prod). Demo path stays for dev/test envs.
- **D-22:** Throttle `/api/credits/claim-mini-trial`. Require `email_verified === true` before granting trial.
- **D-23:** Drop `?secret=` query-string path on `/api/cron/exchange-rate`. `Authorization: Bearer` only.
- **D-24:** Add Clerk webhook timestamp-skew check (Svix) + tests for clerk webhook + admin route 403.

### Claude's Discretion
- Exact RPC argument shape for `consume_rate_limit_token` (capacity + refill_rate as args vs hardcoded per-route)
- Allowlist storage format for D-15 (env var CSV vs JSON file in `lib/security/`)
- Sharp `.metadata()` failure message wording
- Whether `mp_webhook_seen` view is created (D-02 — only if any code/query reads it)

### Flagged for plan-phase research
- **R-01:** Scan `loadtests/.env.loadtest` content. Confirm whether real Clerk session is present. If yes, owner-action checkpoint added to plan.
- **R-02:** Confirm exact files calling the legacy `increment_regen_count(uuid)` overload before drop (so we don't drop a callable).
- **R-03:** List every existing call site of `ADMIN_USER_IDS` so D-10 cutover is exhaustive.
- **R-04:** Confirm Clerk webhook handler currently lacks Svix timestamp-skew check (sanity check before D-24 task).

</decisions>

<specifics>
## Specific Ideas

- "Reuse webhook_events from P1 — don't duplicate" (D-01)
- "Postgres token bucket survives PM2 restart" (D-04, D-07)
- "Admin role: one canonical source, ADMIN_USER_IDS as fire alarm" (D-09, D-10)
- "Sessão antes de qualquer coisa" — revoke Clerk session BEFORE filter-repo (D-13 step ordering)
- "Force-push é destrutivo — owner aprova explicitamente" (D-14)

</specifics>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope sources
- `.planning/PROJECT.md`
- `.planning/ROADMAP.md` §"Phase 4"
- `.planning/PHASE-DETAILS.md` §"Phase 4"
- `.planning/STATE.md`

### Findings to address
- `.planning/audits/MONOREPO-BUG-BASH.md` — H-5, H-8, H-14, M-8, M-16
- `.planning/codebase/CONCERNS.md` — §1 (service-role key handling), §2 (admin guard, editor — partial), §3 (webhook hardening), §4 (RPC GRANT, legacy overload), §5 (SSRF, MIME), §6 (anon abuse, claim-mini-trial), §10 (cron exchange-rate), §12 (test coverage clerk + admin)

### Phase 1 dependency (already delivered)
- `.planning/phases/01-payments-webhook-integrity/01-VERIFICATION.md` — confirms `webhook_events` table and `add_credits_atomic` RPC exist
- `.planning/phases/01-payments-webhook-integrity/01-CONTEXT.md` — D-05..D-08 (webhook_events schema)

### Codebase intel
- `.planning/codebase/ARCHITECTURE.md` §"MP webhook" + §"Database schema overview"
- `.planning/codebase/CONCERNS.md` (full doc — Phase 4 is the answer to most of it)
- `.planning/codebase/STACK.md` §"campanha-ia" — Sharp, Clerk, MP versions

### Out-of-M1 (DO NOT broaden)
- `.planning/ROADMAP.md` §"Out-of-milestone" — MP IP allowlist, editor passwords, RPC body-internal validation deeper pass

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets (delivered by Phase 1)
- `webhook_events` table — D-01 reuses
- `add_credits_atomic` RPC pattern — D-05 mirrors for `consume_rate_limit_token`
- SECURITY DEFINER RPC convention — D-05, D-18 follow

### Established Patterns
- RLS on all tables — new `rate_limit_buckets` needs RLS (service-role-only)
- Sentry capture pattern — D-12 layers on top
- Cron route pattern — D-23 changes auth shape, not route shape

### Integration Points
- `app/api/webhooks/mercadopago/route.ts` — D-01 dedup, D-03 x-request-id check
- `app/api/campaign/format/route.ts` — D-15 SSRF allowlist
- `app/api/campaign/generate/route.ts` — D-15 modelImageUrl, D-16 MIME, D-21 auth gate
- `app/api/admin/*` — D-09 cutover, D-12 log-on-deny
- `app/api/credits/claim-mini-trial/route.ts` — D-22
- `app/api/cron/exchange-rate/route.ts` — D-23
- `lib/middleware.ts:hasStore` — D-17 audit
- `app/api/fashion-facts/route.ts` — D-17 service-role move
- `loadtests/.env.loadtest` — D-13 cleanup
- `supabase/migrations/` — new RPCs + RLS migrations (NOT pushed; owner applies)

</code_context>

<deferred>
## Deferred Ideas

- **MP IP allowlist at nginx** — explicit defer per ROADMAP parking-lot.
- **Full prompt-injection eval suite** — Promptfoo stays observability-only per project memory.
- **Editor → per-user passwords** — acceptable at current scale per CONCERNS §2; revisit when editor count grows.
- **Redis rate-limit migration** — D-08 documents path; execution is parking-lot.
- **Force-push impact on collaborators** — only owner has clones; if that changes later, repeat communication step.
- **Deep input validation pass on every SECURITY DEFINER RPC body** — Phase 4 hardens GRANTs, body-internal audit is parking-lot.

</deferred>

---

*Phase: 04-security-hardening-and-rate-limit*
*Context gathered: 2026-05-04*
