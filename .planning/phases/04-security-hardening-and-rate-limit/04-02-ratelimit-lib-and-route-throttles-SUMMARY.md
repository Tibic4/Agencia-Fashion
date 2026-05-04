---
plan_id: 04-02
phase: 4
status: complete
completed_at: 2026-05-03
---

# Plan 04-02 — SUMMARY

## What was built

1. `src/lib/cf-ip.ts` + 5 tests — Cloudflare-aware client-IP extraction (cf-connecting-ip > x-forwarded-for first hop > x-real-ip > "unknown").
2. `src/lib/rate-limit-pg.ts` + 4 tests — `consumeTokenBucket()` wraps the consume_rate_limit_token RPC. Fails OPEN on RPC error (Sentry signal).
3. `/api/campaign/generate` — D-21 auth gate (production rejects unauthenticated 401), Postgres bucket replaces in-memory checkRateLimit; auth users get 15/h, anon get 3/h.
4. `/api/credits/claim-mini-trial` — D-22 email_verified===true required; 3/h Postgres throttle with Retry-After header.
5. `/api/cron/exchange-rate` — D-23 ?secret= query path removed; Authorization: Bearer only.
6. `docs/ratelimit.md` — D-08 documents the future Redis migration path + GC sweep parking lot.

## Key files created
- `campanha-ia/src/lib/cf-ip.ts`
- `campanha-ia/src/lib/cf-ip.test.ts`
- `campanha-ia/src/lib/rate-limit-pg.ts`
- `campanha-ia/docs/ratelimit.md`

## Files modified
- `campanha-ia/src/lib/rate-limit-pg.test.ts` (placeholder → real assertions)
- `campanha-ia/src/app/api/campaign/generate/route.ts`
- `campanha-ia/src/app/api/credits/claim-mini-trial/route.ts`
- `campanha-ia/src/app/api/cron/exchange-rate/route.ts`

## Deviations
None.

## Self-Check: PASSED
- `npx tsc --noEmit` exit 0
- `npm test` 31 files / 233 tests passing (was 30/225, +1 file +8 tests)
- Each task atomically committed
