-- ── 20260503_120000_add_api_cost_logs_metadata.sql ──
-- D-15: Add metadata jsonb to api_cost_logs so prompt_version, error_code,
-- and other per-call diagnostics are persisted instead of silently dropped
-- by Supabase. Existing write sites in route.ts:834 and the future
-- logModelCost helper (D-18) target this column.

ALTER TABLE public.api_cost_logs
  ADD COLUMN IF NOT EXISTS metadata jsonb;

-- Backfill is unnecessary — historical rows have no prompt_version and
-- querying NULL metadata is acceptable. No index needed at Phase 1 volume
-- (~hundreds of rows/day); add a GIN index in Phase 2 if/when admin/custos
-- starts filtering by metadata->>'prompt_version'.
