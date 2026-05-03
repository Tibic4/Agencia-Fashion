---
phase: 02-quality-loop
plan: 05
type: execute
wave: 3
depends_on: [03]
files_modified:
  - campanha-ia/supabase/migrations/20260503_140000_create_prompt_version_regen_correlation_view.sql
autonomous: false
requirements: [D-22]

must_haves:
  truths:
    - "Postgres view (or MATERIALIZED VIEW) vw_prompt_version_regen_correlation exists in production"
    - "View JOINs api_cost_logs.metadata->>'prompt_version' WITH campaigns.regenerate_reason ON campaign_id"
    - "View returns aggregated counts per (prompt_version, regenerate_reason) pair so /admin/quality can render a heatmap"
    - "Decision documented inline in the SQL: regular VIEW vs MATERIALIZED VIEW (planner instructs row-count check; <100K rows → regular VIEW, ≥100K → MATERIALIZED + daily refresh cron)"
    - "If MATERIALIZED, an Inngest cron is added to refresh nightly (or planner defers to 02-06 alerts plan if not yet land)"
  artifacts:
    - path: "campanha-ia/supabase/migrations/20260503_140000_create_prompt_version_regen_correlation_view.sql"
      provides: "View definition + (conditionally) UNIQUE INDEX on (prompt_version, regenerate_reason) for fast dashboard queries"
      contains: "vw_prompt_version_regen_correlation"
  key_links:
    - from: "vw_prompt_version_regen_correlation"
      to: "api_cost_logs.metadata + campaigns.regenerate_reason"
      via: "INNER JOIN api_cost_logs ON api_cost_logs.campaign_id = campaigns.id WHERE action='judge_quality' OR action='sonnet_copywriter'"
      pattern: "INNER JOIN.*api_cost_logs|INNER JOIN.*campaigns"
---

<objective>
Land the Postgres view that powers `/admin/quality` Section 4 (correlation matrix). Implements D-22.

Purpose: A single SQL query answers "did Tuesday's prompt edit cause Wednesday's spike in `face_wrong` regens?" — by JOINing the prompt_version SHA on every cost log row with the lojista's regenerate_reason on every campaign.

This plan is `autonomous: false` per output requirement #5 — Supabase migrations cross the prod/dev boundary; user must approve the SQL before commit. The migration file lands but the executor pauses at the checkpoint for user to (a) review the SQL, (b) decide regular vs MATERIALIZED, (c) apply via the project's standard migration workflow.

Output: One new SQL migration file. NO TypeScript code (the dashboard query in Plan 02-04 already references the view by name with a try/catch fallback).
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/02-quality-loop/02-CONTEXT.md
@.planning/phases/02-quality-loop/02-03-SUMMARY.md

<interfaces>
<!-- Schema context the view JOINs across -->

From campanha-ia/supabase/migrations/20260503_120000_add_api_cost_logs_metadata.sql (Phase 01):
- `api_cost_logs.metadata` is a `jsonb` column. The Sonnet copywriter writes `{ "prompt_version": "<12-char SHA>" }` here on every successful generation (action = 'sonnet_copywriter').
- The judge ALSO writes `{ "prompt_version": "<12-char SHA>" }` here (action = 'judge_quality') with JUDGE_PROMPT_VERSION (added by Plan 02-03).

From campanha-ia/supabase/migrations/20260503_120100_add_campaign_regenerate_reason.sql (Phase 01):
- `campaigns.regenerate_reason` is a TEXT column with CHECK constraint enforcing one of: face_wrong, garment_wrong, copy_wrong, pose_wrong, other.
- Partial index `idx_campaigns_regenerate_reason_created_at` already exists for fast filtering.

From campanha-ia/supabase/migrations/00000000000000_baseline.sql:
- `api_cost_logs.campaign_id` is a `uuid` FK to `campaigns.id`. Already indexed (per the baseline schema).

Key insight: a regenerate_reason on a campaign CORRELATES to whichever prompt_version produced that campaign's copy. So the view's JOIN key is `campaigns.id = api_cost_logs.campaign_id`, filtered to `action = 'sonnet_copywriter'` (the prompt_version we care about for the correlation IS the copywriter's; the judge's prompt_version is meta-information about the scoring tool, not the artifact).
</interfaces>

@campanha-ia/supabase/migrations/00000000000000_baseline.sql
@campanha-ia/supabase/migrations/20260503_120000_add_api_cost_logs_metadata.sql
@campanha-ia/supabase/migrations/20260503_120100_add_campaign_regenerate_reason.sql
</context>

<tasks>

<task type="auto" tdd="false">
  <name>Task 1: Check api_cost_logs row count to decide VIEW vs MATERIALIZED VIEW</name>
  <files>(read-only — produces a decision recorded in Task 2's SQL comment header)</files>
  <read_first>
    - .planning/phases/02-quality-loop/02-CONTEXT.md decision D-22 (decision rule: <100K rows → regular VIEW; ≥100K → MATERIALIZED + daily refresh)
  </read_first>
  <action>
    Use the Supabase MCP tool (per the MCP server instructions in this environment — execute_sql is the standard query tool) to run a row count against the live api_cost_logs table:

    ```sql
    SELECT COUNT(*) AS row_count FROM api_cost_logs;
    ```

    Also helpful (informs whether the view needs an index):
    ```sql
    SELECT
      COUNT(DISTINCT (metadata->>'prompt_version')) AS distinct_prompt_versions,
      COUNT(DISTINCT campaign_id) AS distinct_campaigns
    FROM api_cost_logs WHERE action = 'sonnet_copywriter';
    ```

    Decision rule:
    - row_count < 100,000 → use `CREATE VIEW` (regular view; query is recomputed each call but cheap at this scale)
    - row_count ≥ 100,000 → use `CREATE MATERIALIZED VIEW` + add a daily refresh trigger (NOTE: refresh logic lands in Plan 02-06's alerts cron file, since that plan already adds a 7am UTC Inngest cron; bundle the REFRESH MATERIALIZED VIEW into one of those handlers OR add a new cron in this migration's wake — file as a follow-up note in SUMMARY)

    Record the row_count + chosen variant in the SUMMARY for Task 2's executor to honor.

    If supabase MCP is unavailable or the row_count query fails, default to **regular VIEW** (safer for low-traffic Phase 02 environment; the MATERIALIZED variant can be a follow-up swap when traffic grows). Document the fallback decision in the SUMMARY.
  </action>
  <acceptance_criteria>
    - Row count obtained (or fallback decision documented).
    - Choice recorded for Task 2.
  </acceptance_criteria>
  <verify>
    <automated>echo "Decision documented in SUMMARY post-completion."</automated>
  </verify>
  <done>Decision rule applied; regular VIEW vs MATERIALIZED chosen with rationale.</done>
</task>

<task type="auto" tdd="false">
  <name>Task 2: Write the SQL migration creating vw_prompt_version_regen_correlation</name>
  <files>campanha-ia/supabase/migrations/20260503_140000_create_prompt_version_regen_correlation_view.sql</files>
  <read_first>
    - Task 1 decision (regular VIEW vs MATERIALIZED VIEW)
    - campanha-ia/supabase/migrations/00000000000000_baseline.sql (campaigns + api_cost_logs schemas to JOIN)
    - campanha-ia/supabase/migrations/20260503_120000_add_api_cost_logs_metadata.sql (the metadata jsonb column)
    - campanha-ia/supabase/migrations/20260503_120100_add_campaign_regenerate_reason.sql (the regenerate_reason text column + CHECK)
    - .planning/phases/02-quality-loop/02-CONTEXT.md decision D-22
  </read_first>
  <action>
    Create `campanha-ia/supabase/migrations/20260503_140000_create_prompt_version_regen_correlation_view.sql`. Choose VIEW vs MATERIALIZED based on Task 1.

    **If regular VIEW (default for <100K rows):**
    ```sql
    -- Phase 02 D-22: prompt_version × regenerate_reason correlation view.
    --
    -- Powers /admin/quality Section 4 (correlation matrix). Answers "did
    -- Tuesday's prompt edit cause Wednesday's spike in face_wrong regens?"
    -- via a single SELECT.
    --
    -- JOIN key: campaigns.id = api_cost_logs.campaign_id, filtered to the
    -- copywriter cost-log row (action='sonnet_copywriter') because the
    -- prompt_version we correlate against IS the copywriter's prompt SHA;
    -- the judge's prompt_version is meta-info about the scoring tool, not
    -- the artifact being judged.
    --
    -- Why a regular VIEW (vs MATERIALIZED): row_count check at migration time
    -- (see SUMMARY for the exact figure) was below the 100K threshold from
    -- D-22. A regular VIEW recomputes on every dashboard query, which at this
    -- scale costs <50ms (api_cost_logs.campaign_id is indexed; the partial
    -- index idx_campaigns_regenerate_reason_created_at trims the right side).
    -- Swap to MATERIALIZED + daily REFRESH when api_cost_logs crosses 100K.

    CREATE OR REPLACE VIEW public.vw_prompt_version_regen_correlation AS
    SELECT
      acl.metadata->>'prompt_version'  AS prompt_version,
      c.regenerate_reason              AS regenerate_reason,
      COUNT(*)                         AS campaign_count,
      MIN(c.created_at)                AS first_seen,
      MAX(c.created_at)                AS last_seen
    FROM public.campaigns c
    INNER JOIN public.api_cost_logs acl
      ON acl.campaign_id = c.id
    WHERE
      acl.action = 'sonnet_copywriter'
      AND acl.metadata->>'prompt_version' IS NOT NULL
      AND c.regenerate_reason IS NOT NULL
    GROUP BY acl.metadata->>'prompt_version', c.regenerate_reason;

    COMMENT ON VIEW public.vw_prompt_version_regen_correlation IS
      'Phase 02 D-22: per (prompt_version, regenerate_reason) campaign counts. /admin/quality Section 4 reads this.';

    -- Permission grants: Supabase service role already has access via owner
    -- inheritance from the public schema. No explicit GRANT needed for the
    -- admin client (createAdminClient uses the service role key).
    ```

    **If MATERIALIZED VIEW (≥100K rows path):**
    ```sql
    -- (Same header doc as above, but explain the MATERIALIZED choice.)
    -- Why MATERIALIZED: row_count was above 100K at migration time. Recomputing
    -- on every dashboard request would scan the table; a MATERIALIZED VIEW
    -- snapshots the aggregate and refreshes nightly (cron added in Plan 02-06
    -- alongside the alert crons — single Inngest function handles both).

    CREATE MATERIALIZED VIEW public.vw_prompt_version_regen_correlation AS
    SELECT
      acl.metadata->>'prompt_version'  AS prompt_version,
      c.regenerate_reason              AS regenerate_reason,
      COUNT(*)                         AS campaign_count,
      MIN(c.created_at)                AS first_seen,
      MAX(c.created_at)                AS last_seen
    FROM public.campaigns c
    INNER JOIN public.api_cost_logs acl
      ON acl.campaign_id = c.id
    WHERE
      acl.action = 'sonnet_copywriter'
      AND acl.metadata->>'prompt_version' IS NOT NULL
      AND c.regenerate_reason IS NOT NULL
    GROUP BY acl.metadata->>'prompt_version', c.regenerate_reason;

    -- Required for CONCURRENT refresh (which avoids locking readers):
    CREATE UNIQUE INDEX vw_prompt_version_regen_correlation_unique_idx
      ON public.vw_prompt_version_regen_correlation (prompt_version, regenerate_reason);

    COMMENT ON MATERIALIZED VIEW public.vw_prompt_version_regen_correlation IS
      'Phase 02 D-22: per (prompt_version, regenerate_reason) campaign counts. /admin/quality Section 4 reads this. Refreshed nightly by Inngest cron (Plan 02-06).';

    -- Initial population (so /admin/quality has data on day 1; Inngest cron
    -- replaces this on subsequent days):
    REFRESH MATERIALIZED VIEW public.vw_prompt_version_regen_correlation;
    ```

    **In either case**, follow the project's existing migration filename convention (timestamp-prefixed; reuse the `20260503_HHMMSS_` pattern visible in other Phase 01 migrations).

    DO NOT apply the migration in this task — application is the user's responsibility (gated by the checkpoint). DO write the file so it lands in the next merge.
  </action>
  <acceptance_criteria>
    - File `campanha-ia/supabase/migrations/20260503_140000_create_prompt_version_regen_correlation_view.sql` exists.
    - `grep -c "vw_prompt_version_regen_correlation" campanha-ia/supabase/migrations/20260503_140000_create_prompt_version_regen_correlation_view.sql` ≥ 2 (CREATE + COMMENT).
    - `grep -cE "INNER JOIN.*api_cost_logs|JOIN.*campaigns" campanha-ia/supabase/migrations/20260503_140000_create_prompt_version_regen_correlation_view.sql` ≥ 1.
    - `grep -E "action = 'sonnet_copywriter'" campanha-ia/supabase/migrations/20260503_140000_create_prompt_version_regen_correlation_view.sql | wc -l` ≥ 1 (filters to copywriter rows, not judge rows).
    - `grep -E "metadata->>'prompt_version'" campanha-ia/supabase/migrations/20260503_140000_create_prompt_version_regen_correlation_view.sql | wc -l` ≥ 1.
    - SQL is syntactically valid (no `--apply` here; user applies via standard migration workflow).
  </acceptance_criteria>
  <verify>
    <automated>grep -c "CREATE\\s\\+\\(MATERIALIZED\\s\\+\\)\\?VIEW" campanha-ia/supabase/migrations/20260503_140000_create_prompt_version_regen_correlation_view.sql</automated>
  </verify>
  <done>Migration file written; correct VIEW variant chosen; JOIN + WHERE filters correct; ready for user review.</done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 3: User reviews and applies migration</name>
  <what-built>
    A new SQL migration file at `campanha-ia/supabase/migrations/20260503_140000_create_prompt_version_regen_correlation_view.sql` defining the `vw_prompt_version_regen_correlation` view (or MATERIALIZED VIEW per row-count decision in Task 1).
  </what-built>
  <how-to-verify>
    1. **Read the SQL** — verify the JOIN logic, the WHERE filters (only `action='sonnet_copywriter'` rows), and the GROUP BY shape.

    2. **Decide on apply path**:
       - Option A: `cd campanha-ia && npx supabase db push` (project's standard migration apply, if configured)
       - Option B: Apply via Supabase Studio → SQL Editor (paste the migration, execute against the prod project ref)
       - Option C: Apply via Supabase MCP `apply_migration` tool (if comfortable with direct production application)

    3. **Verify the view exists** by querying:
       ```sql
       SELECT * FROM vw_prompt_version_regen_correlation LIMIT 5;
       ```
       Should return rows (even if empty) without error.

    4. **Verify the dashboard now hits the view** — reload `/admin/quality` and check Section 4 changes from "view not yet created" to either an empty result or actual correlation data.

    5. **If MATERIALIZED was chosen**, confirm the initial REFRESH ran (the migration includes it) and add a follow-up note for Plan 02-06's executor: "include `REFRESH MATERIALIZED VIEW CONCURRENTLY public.vw_prompt_version_regen_correlation;` in the daily 7am UTC Inngest cron".

    6. **If anything looks off** (wrong filter, wrong JOIN key, missing index), reject and ask for revision.
  </how-to-verify>
  <resume-signal>Type "applied" once the view exists in production. Type "needs revision" with the specific change needed. Type "needs materialized refresh cron" to add a TODO for 02-06's executor.</resume-signal>
</task>

</tasks>

<verification>
End-to-end:
1. After user applies, run in Supabase SQL Editor:
   ```sql
   SELECT prompt_version, regenerate_reason, campaign_count, last_seen
   FROM vw_prompt_version_regen_correlation
   ORDER BY campaign_count DESC LIMIT 20;
   ```
   Returns rows (or empty if no `regenerate_reason` data yet — that's fine, the view shape is what matters at this stage).
2. Reload `/admin/quality` → Section 4 no longer shows "view not yet created" placeholder.

Automated:
- `grep -E "CREATE.*VIEW.*vw_prompt_version_regen_correlation" campanha-ia/supabase/migrations/20260503_140000_create_prompt_version_regen_correlation_view.sql`
</verification>

<success_criteria>
- Migration file exists with the locked view name `vw_prompt_version_regen_correlation`.
- Decision (VIEW vs MATERIALIZED) recorded inline + in SUMMARY.
- View JOINs api_cost_logs.metadata->>'prompt_version' WITH campaigns.regenerate_reason via campaign_id.
- Filtered to action='sonnet_copywriter' (the artifact's prompt SHA, not judge's meta-prompt SHA).
- User has reviewed, applied, and confirmed the view exists in production.
- /admin/quality Section 4 stops showing the placeholder.
</success_criteria>

<output>
After completion, create `.planning/phases/02-quality-loop/02-05-SUMMARY.md` documenting:
- Final api_cost_logs row count (from Task 1)
- VIEW vs MATERIALIZED decision + rationale
- Migration apply path used (CLI / Studio / MCP)
- Confirmation the view exists post-apply (paste row count or 0-row LIMIT 1 result)
- Whether Plan 02-06 needs to add a REFRESH cron (yes if MATERIALIZED, no if regular VIEW)
</output>
