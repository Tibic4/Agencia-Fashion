-- Phase 02 D-15: judge_pending tracking columns on campaigns.
--
-- The Inngest judge dispatch (pipeline.ts) is currently fire-and-forget; if
-- the dispatch fails or the function fails terminally, the row never gets
-- a quality score. These columns let a reconcile cron (D-16) re-emit the
-- event up to 3 times before moving the row to judge_dead_letter (D-18).
--
-- Non-blocking: ADD COLUMN with DEFAULT is metadata-only on PG 11+.
-- No backfill needed -- judge_pending defaults to false (matches existing
-- behavior where rows have no pending dispatch tracking).

ALTER TABLE public.campaigns
  ADD COLUMN IF NOT EXISTS judge_pending BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.campaigns
  ADD COLUMN IF NOT EXISTS judge_retry_count INTEGER NOT NULL DEFAULT 0;

ALTER TABLE public.campaigns
  ADD COLUMN IF NOT EXISTS judge_last_attempt TIMESTAMPTZ NULL;

-- Index for the cron query (D-16):
--   WHERE judge_pending = true
--     AND judge_retry_count < 3
--     AND (judge_last_attempt IS NULL OR judge_last_attempt < now() - interval '5 minutes')
-- Partial index keeps the index small (most rows have judge_pending=false).
CREATE INDEX IF NOT EXISTS idx_campaigns_judge_pending
  ON public.campaigns (judge_last_attempt NULLS FIRST)
  WHERE judge_pending = true;

COMMENT ON COLUMN public.campaigns.judge_pending IS
  'Phase 02 D-15: true while the Inngest judge dispatch is outstanding. Cleared by judgeCampaignJob on success or by D-18 dead-letter move.';
COMMENT ON COLUMN public.campaigns.judge_retry_count IS
  'Phase 02 D-15: incremented by the reconcile cron on each re-emit. Max 3 per D-18.';
COMMENT ON COLUMN public.campaigns.judge_last_attempt IS
  'Phase 02 D-15: set by the reconcile cron when it re-emits. Cron skips rows where this is < 5 minutes old (D-16).';
