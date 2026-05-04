-- Phase 02 R-02: persist the Inngest judge event payload on the campaign row
-- so the reconcile cron (D-16/D-17) can re-emit the original event verbatim
-- without re-deriving copyText / prompt_version / image URLs from joins.
--
-- The producer (pipeline.ts:345-374) currently sends:
--   { campaignId, storeId, copyText, productImageUrl, modelImageUrl,
--     generatedImageUrl, prompt_version }
-- Of those, only campaignId/storeId/generatedImageUrl are easily recoverable
-- from joins. copyText and prompt_version live in transient pipeline state.
--
-- Stashing the full payload as JSONB at emit time costs ~1KB/row and saves
-- the cron from joining 3+ tables to reconstruct the event.
--
-- Non-blocking: ADD COLUMN NULL is metadata-only.

ALTER TABLE public.campaigns
  ADD COLUMN IF NOT EXISTS judge_payload JSONB NULL;

COMMENT ON COLUMN public.campaigns.judge_payload IS
  'Phase 02 R-02: full Inngest "campaign/judge.requested" event payload, persisted at producer emit time so the D-16 reconcile cron can re-emit without joins. Set to NULL once the judge succeeds (campaign_scores row exists) -- see Plan 02-05.';
