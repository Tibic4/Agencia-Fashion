-- Phase 02 D-18: dead-letter table for judge dispatches that exceeded 3 retries.
--
-- After judge_retry_count >= 3, the reconcile cron (Plan 02-05) inserts a row
-- here, sets campaigns.judge_pending = false (so the cron stops touching it),
-- and emits a Sentry "judge.dead_letter" event (D-19) for ops review.
--
-- Schema is observability-only -- no foreign-key cascade actions, manual ops
-- review only. RLS enabled with NO policies (service-role-only access).

CREATE TABLE IF NOT EXISTS public.judge_dead_letter (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id   UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  last_error    TEXT NULL,
  retry_count   INTEGER NOT NULL DEFAULT 3,
  moved_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_judge_dead_letter_campaign_id
  ON public.judge_dead_letter (campaign_id);

CREATE INDEX IF NOT EXISTS idx_judge_dead_letter_moved_at
  ON public.judge_dead_letter (moved_at DESC);

-- D-18: RLS enabled, ZERO policies (service-role-only). Mirrors the
-- webhook_events pattern from Phase 1 (20260503_180300_*).
ALTER TABLE public.judge_dead_letter ENABLE ROW LEVEL SECURITY;

-- No GRANTs to anon/authenticated. Service role bypasses RLS by design.

COMMENT ON TABLE public.judge_dead_letter IS
  'Phase 02 D-18: terminal failures of campaign/judge.requested dispatches (judge_retry_count exceeded 3). Manual ops review only -- no automated re-processing. RLS enabled with no policies = service-role-only.';
COMMENT ON COLUMN public.judge_dead_letter.last_error IS
  'Phase 02 D-18: last error message captured by the cron at move-to-dead-letter time. Free-form text (no schema validation).';
COMMENT ON COLUMN public.judge_dead_letter.retry_count IS
  'Phase 02 D-18: snapshot of campaigns.judge_retry_count at move-to-dead-letter time. Always >= 3.';
