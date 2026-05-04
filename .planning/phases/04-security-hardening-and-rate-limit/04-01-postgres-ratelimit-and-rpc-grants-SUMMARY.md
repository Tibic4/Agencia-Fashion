---
plan_id: 04-01
phase: 4
status: complete
completed_at: 2026-05-03
---

# Plan 04-01 — SUMMARY

## What was built

1. **`rate_limit_buckets` table** (`20260504_180000_create_rate_limit_buckets.sql`) — Postgres-backed token-bucket state. RLS enabled with no policies (service-role-only). Index on `updated_at` for the future GC sweep.
2. **`consume_rate_limit_token` RPC** (`20260504_180100_create_consume_rate_limit_token_rpc.sql`) — SECURITY DEFINER, `SET search_path = public`, single-statement upsert+refill+decrement. Returns `(allowed, remaining, retry_after_ms)`. REVOKE FROM PUBLIC/anon/authenticated; GRANT EXECUTE TO service_role.
3. **GRANT-hardening for 4 missed RPCs** (`20260504_180200_harden_rpc_grants.sql`) — `acquire_checkout_lock`, `release_checkout_lock`, `can_generate_campaign`, `increment_campaign_usage`.
4. **Drop legacy 1-arg `increment_regen_count`** (`20260504_180300_drop_legacy_increment_regen_count.sql`) — keeps the IDOR-safe 2-arg overload only.
5. **TypeScript caller cleanup** (`src/lib/db/index.ts`) — `incrementRegenCount` now requires `storeId`, calls only the 2-arg RPC, throws on error. Removed the read-modify-write fallback that was the H-9 IDOR leak.
6. **Test rewrite** (`src/lib/db/regen-count.test.ts`) — 3 cases for the new contract; old "fallback path" cases retired.
7. **Placeholder contract test** (`src/lib/rate-limit-pg.test.ts`) — green-by-design; 04-02 replaces it with real assertions.

## Key files created

- `campanha-ia/supabase/migrations/20260504_180000_create_rate_limit_buckets.sql`
- `campanha-ia/supabase/migrations/20260504_180100_create_consume_rate_limit_token_rpc.sql`
- `campanha-ia/supabase/migrations/20260504_180200_harden_rpc_grants.sql`
- `campanha-ia/supabase/migrations/20260504_180300_drop_legacy_increment_regen_count.sql`
- `campanha-ia/src/lib/rate-limit-pg.test.ts`

## Files modified

- `campanha-ia/src/lib/db/index.ts` (incrementRegenCount: dropped optional storeId, removed fallback)
- `campanha-ia/src/lib/db/regen-count.test.ts` (rewrote for D-19 contract)

## Deviations

- **Migration 03 signature adjustment**: plan said `acquire_checkout_lock(uuid, text, text)` but actual baseline signature is `acquire_checkout_lock(uuid, text, integer)` (the third arg is `p_ttl_seconds integer DEFAULT 60`). Used the actual signature.

## Owner action required

NONE in this plan. Migrations applied via Supabase MCP by orchestrator.

## Self-Check: PASSED

- `npx tsc --noEmit` exit 0 (verified)
- `npm test` 30 files / 225 tests passing (was 29/224, +1 placeholder, regen-count rewritten 3→3)
- 4 migration files lint cleanly (Phase 4 / 04-01 banner)
- Each task atomically committed: `feat(04-01)` x4, `refactor(04-01)`, `test(04-01)`
