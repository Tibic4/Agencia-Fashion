-- Phase 01 / Plan 07 — Production Signal MVP
-- D-01: capture lojista's regeneration reason on the campaigns row.
-- D-02: is_favorited stays untouched — reason carries the actionable signal.
-- D-03: regenerate that captures a reason is FREE this phase (no credit charged).
-- D-04: capture-and-surface only — no alerts / no LLM judging / no rollback automation in this phase.

-- Stored as text + CHECK constraint (NOT a Postgres ENUM) per CONTEXT.md specifics:
-- text+CHECK is easier to extend with new values without ENUM migration ceremony.

ALTER TABLE public.campaigns
  ADD COLUMN IF NOT EXISTS regenerate_reason text;

ALTER TABLE public.campaigns
  DROP CONSTRAINT IF EXISTS campaigns_regenerate_reason_check;

ALTER TABLE public.campaigns
  ADD CONSTRAINT campaigns_regenerate_reason_check
  CHECK (
    regenerate_reason IS NULL
    OR regenerate_reason IN ('face_wrong', 'garment_wrong', 'copy_wrong', 'pose_wrong', 'other')
  );

-- Partial index keeps footprint tiny: only ~5-10% of campaigns are regenerated,
-- and only the reason-providing fraction lands as non-NULL. Covers the
-- /admin/custos aggregate query path: WHERE regenerate_reason IS NOT NULL
-- AND created_at >= thisMonth GROUP BY regenerate_reason.
CREATE INDEX IF NOT EXISTS idx_campaigns_regenerate_reason_created_at
  ON public.campaigns (regenerate_reason, created_at DESC)
  WHERE regenerate_reason IS NOT NULL;
