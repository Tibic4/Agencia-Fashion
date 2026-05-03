-- Phase 02 / Plan 03 — Judge wiring prerequisite
-- D-06 setCampaignScores uses UPSERT on campaign_id; baseline schema only has
-- a primary key on `id`. Without this UNIQUE constraint, .upsert(...).match({campaign_id})
-- raises "no unique constraint matching ON CONFLICT specification" at runtime.
--
-- Apply BEFORE Plan 02-03 judge code reaches production (idempotent IF NOT EXISTS).

ALTER TABLE public.campaign_scores
  DROP CONSTRAINT IF EXISTS campaign_scores_campaign_id_key;

ALTER TABLE public.campaign_scores
  ADD CONSTRAINT campaign_scores_campaign_id_key
  UNIQUE (campaign_id);
