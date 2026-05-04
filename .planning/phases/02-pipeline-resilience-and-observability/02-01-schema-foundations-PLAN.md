---
plan_id: 02-01
phase: 2
title: Schema foundations — judge_pending columns + judge_dead_letter table + judge_payload column (D-15..D-19)
wave: 1
depends_on: []
files_modified:
  - campanha-ia/supabase/migrations/ (new files only — never apply)
autonomous: true
requirements: [H-13, D-15, D-16, D-17, D-18, D-19]
must_haves:
  truths:
    - "judge_pending BOOLEAN DEFAULT false, judge_retry_count INT DEFAULT 0, judge_last_attempt TIMESTAMPTZ NULL added to campaigns table (D-15)"
    - "judge_payload JSONB NULL added to campaigns table (so reconcile cron can re-emit without join — see RESEARCH §R-02)"
    - "judge_dead_letter table created (id uuid PK, campaign_id uuid FK, last_error TEXT, moved_at TIMESTAMPTZ DEFAULT now()) with RLS enabled, NO policies (service-role only) — D-18"
    - "Migration is non-blocking: ADD COLUMN with DEFAULT (metadata-only on PG 11+), CREATE TABLE for new dead-letter table"
    - "All migration files written to disk only — owner applies via supabase db push later (HARD CONSTRAINT — same as Phase 1)"
  acceptance:
    - "Three migration files exist under campanha-ia/supabase/migrations/ with timestamps 20260503_190000_*, 20260503_190100_*, 20260503_190200_*"
    - "ALTER TABLE campaigns ADD COLUMN statements are idempotent (IF NOT EXISTS where supported, or guard via DO block)"
    - "judge_dead_letter has RLS enabled but ZERO policies (matches webhook_events pattern from Phase 1's 20260503_180300_*)"
    - "Migration files do NOT call any RPC, do NOT trigger backfill, do NOT modify existing rows"
    - "NO supabase db push, NO mcp__supabase__apply_migration, NO mcp__supabase__execute_sql for DDL invoked"
---

# Plan 02-01: Schema Foundations for judge_pending + dead-letter

## Objective

Stage the database schema needed for the H-13 fix (judge re-emit + dead-letter). Three migrations, all non-blocking, all metadata-only.

This plan owns:

- **D-15** — Add `judge_pending`, `judge_retry_count`, `judge_last_attempt` columns to `campaigns`.
- **D-17 prereq** — Add `judge_payload JSONB` column to `campaigns` so the reconcile cron can re-emit the original Inngest event without joining product/model/generated image URLs (see RESEARCH §R-02 — open question resolved).
- **D-18** — Create `judge_dead_letter` table for terminal failures (campaigns that exceeded 3 retries).

## Truths the executor must respect

- All three migration files are WRITTEN ONLY. No `supabase db push`, no `mcp__supabase__apply_migration`, no `mcp__supabase__execute_sql` for DDL. Same constraint as Phase 1's 01-01 (see `01-VERIFICATION.md`).
- The `campaigns` table is on the production hot path. ADD COLUMN with DEFAULT must be metadata-only (Postgres 11+ behavior); never run `ALTER TABLE ... SET NOT NULL` in the same migration without a verified backfill.
- `judge_dead_letter` table follows the `webhook_events` pattern from Phase 1: RLS ENABLED, ZERO policies, service-role-only access (the admin client bypasses RLS).
- `judge_payload JSONB` is required because the `campaigns` table does not currently store the producer-side fields (`copyText`, `prompt_version`, etc. — see RESEARCH R-02). Stashing the full event payload at emit time is cheaper than re-deriving from joins inside the cron.
- File naming follows Phase 1 convention. Suggested timestamps: `20260503_190000_*`, `20260503_190100_*`, `20260503_190200_*`. Sequential ordering matters — column adds first, then dead-letter table.

## Tasks

### Task 1: Migration — Add judge_pending columns to campaigns (D-15)

<read_first>
- campanha-ia/supabase/migrations/20260503_180300_create_webhook_events.sql (Phase 1 pattern reference for RLS-enabled, no-policy table)
- campanha-ia/supabase/migrations/20260503_180000_add_subscription_status_enum.sql (Phase 1 ENUM pattern reference)
- campanha-ia/supabase/migrations/00000000000000_baseline.sql §"campaigns" (search for `CREATE TABLE.*campaigns`)
- .planning/phases/02-pipeline-resilience-and-observability/02-CONTEXT.md (D-15)
</read_first>

<action>
Create file `campanha-ia/supabase/migrations/20260503_190000_add_judge_pending_columns.sql`:

```sql
-- Phase 02 D-15: judge_pending tracking columns on campaigns.
--
-- The Inngest judge dispatch (pipeline.ts) is currently fire-and-forget; if
-- the dispatch fails or the function fails terminally, the row never gets
-- a quality score. These columns let a reconcile cron (D-16) re-emit the
-- event up to 3 times before moving the row to judge_dead_letter (D-18).
--
-- Non-blocking: ADD COLUMN with DEFAULT is metadata-only on PG 11+.
-- No backfill needed — judge_pending defaults to false (matches existing
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
```
</action>

<acceptance_criteria>
- File `campanha-ia/supabase/migrations/20260503_190000_add_judge_pending_columns.sql` exists
- Three ADD COLUMN statements use `IF NOT EXISTS` (idempotent re-run safe)
- All three columns have `NOT NULL DEFAULT` or `NULL` defaults — non-blocking metadata-only
- Partial index `idx_campaigns_judge_pending` is created with `WHERE judge_pending = true` predicate
- COMMENT statements document the Phase 02 D-15 purpose
- File does NOT include any UPDATE, INSERT, or RPC call
- Static check: `grep -c "ALTER TABLE public.campaigns" campanha-ia/supabase/migrations/20260503_190000_*.sql` returns 3
- Static check: `grep -c "CREATE INDEX IF NOT EXISTS" campanha-ia/supabase/migrations/20260503_190000_*.sql` returns 1
</acceptance_criteria>

---

### Task 2: Migration — Add judge_payload column to campaigns (R-02 resolution)

<read_first>
- .planning/phases/02-pipeline-resilience-and-observability/02-RESEARCH.md §R-02 ("Open question" — explains why)
- campanha-ia/src/lib/inngest/functions.ts:315-326 (JudgeRequestEvent interface — the payload shape we'll persist)
</read_first>

<action>
Create file `campanha-ia/supabase/migrations/20260503_190100_add_campaigns_judge_payload.sql`:

```sql
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
  'Phase 02 R-02: full Inngest "campaign/judge.requested" event payload, persisted at producer emit time so the D-16 reconcile cron can re-emit without joins. Set to NULL once the judge succeeds (campaign_scores row exists) — see Plan 02-05.';
```
</action>

<acceptance_criteria>
- File `campanha-ia/supabase/migrations/20260503_190100_add_campaigns_judge_payload.sql` exists
- Single ADD COLUMN with `JSONB NULL` and `IF NOT EXISTS`
- COMMENT documents the R-02 rationale
- Migration is non-blocking (no NOT NULL, no DEFAULT non-trivial expression, no backfill)
- File contains NO ALTER TABLE other than the single ADD COLUMN
</acceptance_criteria>

---

### Task 3: Migration — Create judge_dead_letter table (D-18)

<read_first>
- campanha-ia/supabase/migrations/20260503_180300_create_webhook_events.sql (Phase 1 pattern: RLS ENABLED, no policies, service-role-only)
- .planning/phases/02-pipeline-resilience-and-observability/02-CONTEXT.md (D-18, D-19)
</read_first>

<action>
Create file `campanha-ia/supabase/migrations/20260503_190200_create_judge_dead_letter.sql`:

```sql
-- Phase 02 D-18: dead-letter table for judge dispatches that exceeded 3 retries.
--
-- After judge_retry_count >= 3, the reconcile cron (Plan 02-05) inserts a row
-- here, sets campaigns.judge_pending = false (so the cron stops touching it),
-- and emits a Sentry "judge.dead_letter" event (D-19) for ops review.
--
-- Schema is observability-only — no foreign-key cascade actions, manual ops
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
  'Phase 02 D-18: terminal failures of campaign/judge.requested dispatches (judge_retry_count exceeded 3). Manual ops review only — no automated re-processing. RLS enabled with no policies = service-role-only.';
COMMENT ON COLUMN public.judge_dead_letter.last_error IS
  'Phase 02 D-18: last error message captured by the cron at move-to-dead-letter time. Free-form text (no schema validation).';
COMMENT ON COLUMN public.judge_dead_letter.retry_count IS
  'Phase 02 D-18: snapshot of campaigns.judge_retry_count at move-to-dead-letter time. Always >= 3.';
```
</action>

<acceptance_criteria>
- File `campanha-ia/supabase/migrations/20260503_190200_create_judge_dead_letter.sql` exists
- CREATE TABLE has: id (UUID PK with gen_random_uuid()), campaign_id (UUID FK ON DELETE CASCADE), last_error (TEXT NULL), retry_count (INTEGER DEFAULT 3), moved_at (TIMESTAMPTZ DEFAULT now())
- TWO indexes: by campaign_id and by moved_at DESC
- `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` is present
- ZERO `CREATE POLICY` statements (service-role-only — matches webhook_events)
- ZERO `GRANT` statements to anon/authenticated
- COMMENT statements document D-18 + D-19 context
- Static check: `grep -c "CREATE POLICY" campanha-ia/supabase/migrations/20260503_190200_*.sql` returns 0
- Static check: `grep -c "ENABLE ROW LEVEL SECURITY" campanha-ia/supabase/migrations/20260503_190200_*.sql` returns 1
</acceptance_criteria>

---

## Verification

1. Three new files exist under `campanha-ia/supabase/migrations/`:
   - `20260503_190000_add_judge_pending_columns.sql`
   - `20260503_190100_add_campaigns_judge_payload.sql`
   - `20260503_190200_create_judge_dead_letter.sql`
2. Static check: `grep -L "supabase db push\|apply_migration\|execute_sql" .planning/phases/02-pipeline-resilience-and-observability/02-01-*.md` confirms PLAN itself doesn't instruct executor to apply.
3. Manual: open each `.sql` and confirm no UPDATE/DELETE/RPC calls — DDL only.
4. Static check (after Plan 02-05): `grep -c "judge_pending" campanha-ia/src/` should return ≥ 3 references (producer, cron, Inngest function clear).

## Cross-cutting must_haves

```yaml
truths:
  - judge_pending_columns_on_campaigns_not_separate_queue_table
  - judge_dead_letter_table_has_rls_no_policies
  - all_migrations_non_blocking_metadata_only
  - judge_payload_jsonb_persisted_for_reconcile_reemit
  - migrations_written_only_never_applied_in_this_phase
acceptance:
  - three_migration_files_exist_with_correct_timestamps
  - no_ddl_via_mcp_or_supabase_cli_invoked
  - rls_enabled_zero_policies_on_dead_letter
```
