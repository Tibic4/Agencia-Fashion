-- ═══════════════════════════════════════════════════════════
-- Phase 4 / 04-01 — D-19: drop legacy single-arg increment_regen_count(uuid).
-- The 2-arg overload increment_regen_count(uuid, uuid) STAYS — it has the IDOR guard.
-- The TypeScript fallback in src/lib/db/index.ts line 340 is removed in the same plan.
-- ═══════════════════════════════════════════════════════════

DROP FUNCTION IF EXISTS public.increment_regen_count(uuid);

COMMENT ON FUNCTION public.increment_regen_count(uuid, uuid) IS
  'Phase 4 D-19: only IDOR-safe overload remains. Legacy 1-arg version dropped — passing only campaign_id without store_id is no longer accepted.';
