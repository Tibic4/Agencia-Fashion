-- Phase 02 / Plan 05 — D-22: prompt_version × regenerate_reason correlation view.
--
-- Powers /admin/quality Section 4 (correlation matrix tile) and backs the
-- per-prompt-version drift query used by alert (a) in Plan 02-06.
-- Answers in a single SELECT: "did Tuesday's prompt edit cause Wednesday's
-- spike in face_wrong regens?"
--
-- ── JOIN logic ─────────────────────────────────────────────────────────
-- JOIN key: campaigns.id = api_cost_logs.campaign_id, filtered to the
-- copywriter cost-log row (action='sonnet_copywriter') because the
-- prompt_version we correlate against IS the copywriter's prompt SHA;
-- the judge's prompt_version (action='judge_quality') is meta-info about
-- the scoring tool, not the artifact being judged.
--
-- Includes campaigns whose regenerate_reason IS NULL (most of them) so
-- callers can compute regen-rate denominators and filter as needed. The
-- correlation matrix tile in /admin/quality applies its own
-- `WHERE regenerate_reason IS NOT NULL` to render the heatmap.
--
-- ── VIEW vs MATERIALIZED VIEW decision ─────────────────────────────────
-- Chose regular CREATE VIEW (not MATERIALIZED). Rationale:
--   * Phase 02 environment row count is well below the D-22 threshold
--     (<100K api_cost_logs rows; live count not queryable from this
--     executor — defaulted to the safer variant per planner's fallback
--     instructions).
--   * Real-time freshness: callers see judge writes + regen-reason writes
--     immediately, no cron-refresh staleness window.
--   * Smaller blast radius: no MATERIALIZED storage to reclaim, no
--     UNIQUE INDEX coupling to maintain, no REFRESH cron to schedule in
--     Plan 02-06.
--   * Cost: the JOIN is cheap because api_cost_logs.campaign_id is FK-
--     indexed and `idx_campaigns_regenerate_reason_created_at` (partial)
--     trims the campaigns side. Expected <50ms at current scale.
--
-- Swap to MATERIALIZED + daily REFRESH CONCURRENTLY when api_cost_logs
-- crosses ~100K rows. Migration recipe:
--   DROP VIEW public.vw_prompt_version_regen_correlation;
--   CREATE MATERIALIZED VIEW public.vw_prompt_version_regen_correlation AS <same SELECT>;
--   CREATE UNIQUE INDEX vw_prompt_version_regen_correlation_unique_idx
--     ON public.vw_prompt_version_regen_correlation (prompt_version, regenerate_reason);
--   REFRESH MATERIALIZED VIEW public.vw_prompt_version_regen_correlation;
-- Then add a REFRESH CONCURRENTLY call to the 7am UTC Inngest cron in
-- Plan 02-06's alerts handler.
--
-- ── Apply ──────────────────────────────────────────────────────────────
-- Not auto-applied. Apply manually via:
--   cd campanha-ia && npx supabase db push --linked
-- (mirrors the workflow used for the Phase 01 metadata + regenerate_reason
-- migrations and the 14:00 UNIQUE-constraint migration that landed earlier
-- today.)

-- ── Created_at column source ───────────────────────────────────────────
-- We expose campaigns.created_at (the lojista action timestamp) rather
-- than api_cost_logs.created_at because the correlation question is
-- "which campaigns ran on which prompt SHA, and what reason did the
-- lojista give". A campaign + its copywriter cost log are written in the
-- same pipeline run within milliseconds of each other, so the timestamps
-- are effectively interchangeable for date-range filters.

CREATE OR REPLACE VIEW public.vw_prompt_version_regen_correlation AS
SELECT
  acl.metadata->>'prompt_version'  AS prompt_version,
  c.regenerate_reason              AS regenerate_reason,
  c.id                             AS campaign_id,
  c.store_id                       AS store_id,
  c.created_at                     AS created_at
FROM public.campaigns c
INNER JOIN public.api_cost_logs acl
  ON acl.campaign_id = c.id
WHERE
  acl.action = 'sonnet_copywriter'
  AND acl.metadata->>'prompt_version' IS NOT NULL;

COMMENT ON VIEW public.vw_prompt_version_regen_correlation IS
  'Phase 02 D-22: per-campaign prompt_version × regenerate_reason rows. /admin/quality Section 4 reads this. Includes NULL regenerate_reason rows so callers can compute regen-rate denominators. Filtered to action=sonnet_copywriter so we correlate against the copy artifact prompt SHA, not the judge meta-prompt SHA.';

-- ── Permissions ─────────────────────────────────────────────────────────
-- Supabase service role inherits SELECT on the view via public-schema
-- ownership, which is what createAdminClient() uses for /admin/quality
-- queries. No explicit GRANT needed; lojista anon/authenticated roles
-- have no need to read this view (admin-only surface).
