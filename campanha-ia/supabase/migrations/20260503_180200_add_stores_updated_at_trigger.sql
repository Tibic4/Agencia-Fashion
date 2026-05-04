-- ═══════════════════════════════════════════════════════════
-- Phase 1 / 01-01 — R-02: wire update_updated_at_column() to stores
-- Makes D-09 (optimistic lock via updated_at) robust without auditing every writer.
-- The function exists in baseline (line 576-586) but no trigger wires it to stores.
-- Today some paths (consumeCredit fallback, addCreditsToStore fallback, generate refund branch)
-- update stores without setting updated_at manually — the trigger closes that gap.
-- ═══════════════════════════════════════════════════════════

DROP TRIGGER IF EXISTS stores_set_updated_at ON public.stores;
CREATE TRIGGER stores_set_updated_at
  BEFORE UPDATE ON public.stores
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
