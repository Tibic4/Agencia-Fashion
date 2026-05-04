-- ═══════════════════════════════════════════════════════════
-- Phase 1 / 01-01 — D-01: subscription_status ENUM
-- Non-blocking: ENUM creation + ADD COLUMN with DEFAULT (metadata-only on PG 11+)
-- Migration B (20260503_180100) backfills; Migration A leaves NOT NULL DEFAULT 'active'
-- ═══════════════════════════════════════════════════════════

DO $$ BEGIN
  CREATE TYPE public.subscription_status AS ENUM ('active', 'cancelled', 'grace', 'expired');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.stores
  ADD COLUMN IF NOT EXISTS subscription_status public.subscription_status NOT NULL DEFAULT 'active';

COMMENT ON COLUMN public.stores.subscription_status IS
  'Phase 1 D-01: explicit billing state. Replaces "null sub_id on cancel" semantics. Values: active|cancelled|grace|expired. Backfilled by 20260503_180100. mp_status kept in parallel during transition (D-04, parking lot).';
