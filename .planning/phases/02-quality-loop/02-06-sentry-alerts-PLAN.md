---
phase: 02-quality-loop
plan: 06
type: execute
wave: 4
depends_on: [03, 05]
files_modified:
  - campanha-ia/src/lib/quality/alerts.ts
  - campanha-ia/src/lib/quality/alerts.test.ts
  - campanha-ia/src/lib/inngest/functions.ts
  - campanha-ia/src/lib/observability.ts
autonomous: true
requirements: [D-07, D-08, D-09, D-10]

must_haves:
  truths:
    - "lib/quality/alerts.ts exports 3 named threshold constants (FACE_WRONG_THRESHOLD_PCT=5, FACE_WRONG_WOW_DELTA_PP=1, NIVEL_RISCO_ALTO_THRESHOLD_PCT=1) — git-versioned per D-10"
    - "Inngest cron '0 7 * * *' runs daily at 7am UTC and queries 3 things: face_wrong WoW (D-07), nivel_risco='alto' rate (D-08), and Promptfoo regression flag (D-09 — observability-only since CI lands the Sentry issue itself)"
    - "When face_wrong rate > 5% AND WoW delta > +1pp → emits a Sentry warning with fingerprint 'face_wrong_spike_<YYYYMMDD>' (date-bucketed by Monday-of-week)"
    - "When nivel_risco='alto' rate > 1% rolling 7-day → emits a Sentry warning with fingerprint 'nivel_risco_alto_spike_<YYYYMMDD>' (date-bucketed daily)"
    - "Each alert breadcrumb contains top-3 prompt_version SHAs (D-07) or 5 sample campaign_ids (D-08) — NOT the full payload (PII guard)"
    - "Promptfoo PR alert (D-09) is emitted from the GitHub Action eval-on-pr.yml itself (Plan 02-02), NOT from this cron — the cron only checks for residual signal from CI runs (typically a no-op in Phase 02)"
    - "Sentry.captureMessage is used with level: 'warning' + scope.setFingerprint([...]) for dedup (NOT scope.setExtra)"
    - "If Plan 02-05 chose MATERIALIZED VIEW, the cron also runs REFRESH MATERIALIZED VIEW CONCURRENTLY public.vw_prompt_version_regen_correlation"
  artifacts:
    - path: "campanha-ia/src/lib/quality/alerts.ts"
      provides: "Threshold constants + 3 query functions (queryFaceWrongRate, queryNivelRiscoAltoRate, fingerprint helpers)"
      exports: ["FACE_WRONG_THRESHOLD_PCT", "FACE_WRONG_WOW_DELTA_PP", "NIVEL_RISCO_ALTO_THRESHOLD_PCT", "queryFaceWrongRate", "queryNivelRiscoAltoRate", "buildFaceWrongFingerprint", "buildNivelRiscoAltoFingerprint"]
    - path: "campanha-ia/src/lib/observability.ts"
      provides: "captureSyntheticAlert(message, fingerprint, breadcrumbs) helper — wraps Sentry.captureMessage + withScope.setFingerprint"
      exports: ["captureSyntheticAlert"]
    - path: "campanha-ia/src/lib/inngest/functions.ts"
      provides: "qualityAlertsCron — single Inngest createFunction with cron '0 7 * * *' triggering the 3 alert checks"
      contains: "qualityAlertsCron"
  key_links:
    - from: "campanha-ia/src/lib/inngest/functions.ts → qualityAlertsCron"
      to: "campanha-ia/src/lib/quality/alerts.ts → queryFaceWrongRate / queryNivelRiscoAltoRate"
      via: "step.run('check-face-wrong', ...) + step.run('check-nivel-risco-alto', ...)"
      pattern: "queryFaceWrongRate|queryNivelRiscoAltoRate"
    - from: "campanha-ia/src/lib/quality/alerts.ts"
      to: "campanha-ia/src/lib/observability.ts → captureSyntheticAlert"
      via: "import + invoke when threshold breached"
      pattern: "captureSyntheticAlert"
---

<objective>
Land the 3 alert rules that turn judge + regen_reason data into Sentry-routed signal. Implements D-07 (face_wrong WoW), D-08 (nivel_risco='alto' rolling 7d), D-09 (Promptfoo CI regression — observability-only carry from Plan 02-02), D-10 (alert config in TypeScript constants, not Sentry UI rules).

Pattern: alert thresholds are git-versioned constants in `lib/quality/alerts.ts`; queries use the supabase admin client; synthetic Sentry issues use `Sentry.captureMessage` with `level: 'warning'` + stable `fingerprint` arrays so dedup works correctly (a weekly spike doesn't re-fire on every cron run within the same week).

Purpose: A prompt edit that degrades face-rendering or breaks the 5-trigger taxonomy now generates a Sentry warning within 24h, not a complaint thread in 2 weeks.
Output: New `lib/quality/alerts.ts` (constants + query functions), extended `lib/observability.ts` (captureSyntheticAlert helper), new `qualityAlertsCron` in `lib/inngest/functions.ts`.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/02-quality-loop/02-CONTEXT.md
@.planning/phases/02-quality-loop/02-03-SUMMARY.md
@.planning/phases/02-quality-loop/02-05-SUMMARY.md
@.planning/phases/01-ai-pipeline-hardening/01-AI-SPEC.md

<interfaces>
<!-- The patterns this plan extends -->

From campanha-ia/src/lib/observability.ts (extant — extend, don't replace):
```typescript
export function captureError(err: unknown, ctx: Ctx = {}): void {
  Sentry.withScope((scope) => {
    for (const [k, v] of Object.entries(ctx)) scope.setExtra(k, v);
    if (err instanceof Error) Sentry.captureException(err);
    else Sentry.captureException(new Error(String(err)));
  });
}
```

The new helper this plan adds (`captureSyntheticAlert`) DIFFERS from `captureError` in two ways:
1. Uses `Sentry.captureMessage(...)` (not captureException) because there is no thrown error — it's a synthetic warning condition.
2. Uses `scope.setFingerprint(['fingerprint-key'])` to control Sentry's grouping (so weekly spikes dedup to one issue per week instead of one per cron firing).

From campanha-ia/src/lib/inngest/functions.ts (Inngest cron pattern — read storage-gc.ts for an existing cron template):
```typescript
import { storageGarbageCollectorCron } from "./storage-gc";  // line 4-7 import

// storageGarbageCollectorCron is the existing cron-triggered function in this codebase.
// It's exported and registered in inngestFunctions array (line 304).
```
Read `campanha-ia/src/lib/inngest/storage-gc.ts` for the cron-trigger Inngest config syntax (`triggers: [{ cron: '0 7 * * *' }]`).

From the Phase 02 schemas:
- `campaigns.regenerate_reason` text column (one of 5 enum values from VALID_REGENERATE_REASONS, or NULL).
- `campaign_scores.nivel_risco` text column (one of 'baixo'|'medio'|'alto'|'falha_judge').
- Plan 02-05's `vw_prompt_version_regen_correlation` view if it landed (use it for face_wrong WoW query — single SELECT instead of inline JOIN).

From .planning/phases/02-quality-loop/02-CONTEXT.md `<specifics>` Synthetic Sentry issue fingerprints (LOCKED):
- `face_wrong_spike_<YYYYMMDD>` — date-bucketed by Monday-of-week (so all 7 days of the same week dedup to one issue)
- `nivel_risco_alto_spike_<YYYYMMDD>` — date-bucketed daily (each day gets its own issue if the spike persists)
- `promptfoo_regression_pr_<PR_NUMBER>` — per-PR (this lives in the GitHub Action from Plan 02-02 if implemented; this cron does NOT emit it)

From .planning/phases/02-quality-loop/02-05-SUMMARY.md (just landed): tells you whether Plan 02-05's view is regular VIEW or MATERIALIZED. If MATERIALIZED, this plan adds a REFRESH step at the start of the cron (per Plan 02-05's note).
</interfaces>

@campanha-ia/src/lib/observability.ts
@campanha-ia/src/lib/inngest/functions.ts
@campanha-ia/src/lib/inngest/storage-gc.ts
@campanha-ia/src/lib/db/index.ts
@campanha-ia/supabase/migrations/00000000000000_baseline.sql
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Extend lib/observability.ts with captureSyntheticAlert helper</name>
  <files>campanha-ia/src/lib/observability.ts, campanha-ia/src/lib/observability.test.ts</files>
  <read_first>
    - campanha-ia/src/lib/observability.ts (the file being modified — read in FULL, lines 1-75)
    - .planning/phases/02-quality-loop/02-CONTEXT.md `<specifics>` (fingerprint patterns LOCKED)
  </read_first>
  <behavior>
    - Test 1: `captureSyntheticAlert("face_wrong rate spiked to 8%", "face_wrong_spike_20260504", { top_prompt_versions: ["a1b2c3"] })` calls `Sentry.captureMessage(message, "warning")` exactly once and `scope.setFingerprint(["face_wrong_spike_20260504"])` exactly once.
    - Test 2: Breadcrumbs object is set via `scope.setExtra('breadcrumbs', breadcrumbs)` (mirror existing captureError shape so admin viewing in Sentry sees the same panel).
    - Test 3: Re-calling with the SAME fingerprint twice in a row does NOT throw — Sentry handles dedup; our wrapper just sets the fingerprint and emits.
    - Test 4: Wrapper never throws even if Sentry.captureMessage rejects (mirror existing captureError try/catch behavior in observability.ts:42-55).
  </behavior>
  <action>
    Append to `campanha-ia/src/lib/observability.ts` (after the existing `identifyForSentry` function at line 74):

    ```typescript
    /**
     * Phase 02 D-10 — emit a synthetic Sentry warning with a STABLE fingerprint.
     *
     * Use case: scheduled crons that detect threshold breaches (face_wrong rate
     * spike, nivel_risco='alto' rate spike). Unlike captureError, there is no
     * thrown exception — we synthesize a warning so Sentry's existing alert
     * routing fires.
     *
     * Why fingerprint and not setExtra: setExtra creates a NEW Sentry issue per
     * call. Fingerprint groups identical values into ONE issue across calls. A
     * weekly cron that re-detects the same spike must dedup to one issue per
     * spike-window, not 7 issues in a week.
     *
     * Date-bucketed fingerprints (caller's responsibility):
     *   face_wrong_spike_<YYYYMMDD>      — bucket by Monday-of-week
     *   nivel_risco_alto_spike_<YYYYMMDD> — bucket daily
     *   promptfoo_regression_pr_<PR_NUMBER> — emitted from GitHub Action, not here
     */
     export function captureSyntheticAlert(
       message: string,
       fingerprint: string,
       breadcrumbs: Ctx = {},
     ): void {
       try {
         Sentry.withScope((scope) => {
           scope.setLevel("warning");
           scope.setFingerprint([fingerprint]);
           scope.setExtra("breadcrumbs", breadcrumbs);
           scope.setExtra("alert_kind", "synthetic_threshold_breach");
           Sentry.captureMessage(message, "warning");
         });
       } catch {
         // Never let observability break the cron.
       }
       logger.warn(`[synthetic_alert] ${message}`, { fingerprint, ...breadcrumbs });
     }
    ```

    Then create `campanha-ia/src/lib/observability.test.ts`. Mock `@sentry/nextjs` (vi.mock with named exports for withScope, captureMessage). Cover the 4 behavior cases.

    If `observability.test.ts` already exists in the project, APPEND a new `describe("captureSyntheticAlert")` block instead of replacing the file.
  </action>
  <acceptance_criteria>
    - `grep -c "captureSyntheticAlert" campanha-ia/src/lib/observability.ts` ≥ 2 (export + JSDoc).
    - `grep -nE "scope\\.setFingerprint" campanha-ia/src/lib/observability.ts | wc -l` ≥ 1.
    - `grep -nE "captureMessage" campanha-ia/src/lib/observability.ts | wc -l` ≥ 1.
    - `cd campanha-ia && npx vitest run src/lib/observability.test.ts` passes all 4 (or 4+ existing) tests.
    - `cd campanha-ia && npx tsc --noEmit` clean.
  </acceptance_criteria>
  <verify>
    <automated>cd campanha-ia && npx vitest run src/lib/observability.test.ts && npx tsc --noEmit</automated>
  </verify>
  <done>captureSyntheticAlert exported; fingerprint dedup proven; tests green; no regression to existing captureError tests.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Create lib/quality/alerts.ts with thresholds + query functions</name>
  <files>campanha-ia/src/lib/quality/alerts.ts, campanha-ia/src/lib/quality/alerts.test.ts</files>
  <read_first>
    - campanha-ia/src/lib/observability.ts (captureSyntheticAlert — just added in Task 1)
    - campanha-ia/src/lib/db/index.ts:265-310 (VALID_REGENERATE_REASONS — query category source)
    - campanha-ia/supabase/migrations/00000000000000_baseline.sql lines 60-76 (campaign_scores schema)
    - .planning/phases/02-quality-loop/02-CONTEXT.md decisions D-07, D-08, D-10 (locked thresholds)
    - .planning/phases/02-quality-loop/02-05-SUMMARY.md (whether vw_prompt_version_regen_correlation view is available)
  </read_first>
  <behavior>
    - Test 1: `queryFaceWrongRate(supabase)` returns `{ thisWeekPct, lastWeekPct, deltaPp, topPromptVersions }`. Mock supabase to return 100 campaigns with 8 face_wrong this week, 50 campaigns with 1 face_wrong last week. Expect `thisWeekPct === 8`, `lastWeekPct === 2`, `deltaPp === 6`, `topPromptVersions` array length ≤ 3.
    - Test 2: `queryFaceWrongRate` returns null/empty when there's no data (graceful degradation — alert just doesn't fire).
    - Test 3: `queryNivelRiscoAltoRate(supabase)` returns `{ pct, sampleCampaignIds }`. Mock 100 campaign_scores rows with 2 nivel_risco='alto'. Expect `pct === 2`, sampleCampaignIds.length ≤ 5.
    - Test 4: `queryNivelRiscoAltoRate` excludes `falha_judge` rows from the denominator (sentinel filtering — D-02 from Plan 02-03).
    - Test 5: `buildFaceWrongFingerprint(new Date('2026-05-04'))` (a Monday) returns `'face_wrong_spike_20260504'`. Same date next week (`new Date('2026-05-11')`) returns `'face_wrong_spike_20260511'` — different week, different fingerprint.
    - Test 6: `buildFaceWrongFingerprint(new Date('2026-05-07'))` (a Thursday) ALSO returns `'face_wrong_spike_20260504'` — bucketed to Monday-of-week.
    - Test 7: `buildNivelRiscoAltoFingerprint(new Date('2026-05-04'))` returns `'nivel_risco_alto_spike_20260504'`. Different day → different fingerprint (daily bucketing per D-08).
    - Test 8: Threshold constants exported with exact LOCKED values: `FACE_WRONG_THRESHOLD_PCT === 5`, `FACE_WRONG_WOW_DELTA_PP === 1`, `NIVEL_RISCO_ALTO_THRESHOLD_PCT === 1`.
  </behavior>
  <action>
    1. Create `campanha-ia/src/lib/quality/` directory if it doesn't exist.

    2. Create `campanha-ia/src/lib/quality/alerts.ts`:

       ```typescript
       /**
        * Phase 02 D-07/D-08/D-10 — alert thresholds + queries.
        *
        * Why git-versioned constants (not Sentry UI rules) per D-10:
        * thresholds change on PR review, not in a console; rationale lives
        * in the comment block adjacent to each constant; reverting a bad
        * threshold change is `git revert`, not click-archaeology.
        *
        * Sentry rule itself is just "fire on any synthetic issue with a
        * fingerprint matching face_wrong_spike_* or nivel_risco_alto_spike_*".
        * That rule is configured ONCE in Sentry UI and never edited again.
        */
       import type { SupabaseClient } from "@supabase/supabase-js";

       /** D-07 thresholds — LOCKED. Cron fires when BOTH conditions are true. */
       export const FACE_WRONG_THRESHOLD_PCT = 5;
       export const FACE_WRONG_WOW_DELTA_PP  = 1;

       /** D-08 threshold — LOCKED. Rolling 7-day window. */
       export const NIVEL_RISCO_ALTO_THRESHOLD_PCT = 1;

       /** Sample size for breadcrumb arrays. PII guard — never include full payload. */
       const TOP_PROMPT_VERSIONS_BREADCRUMB_LIMIT = 3;
       const SAMPLE_CAMPAIGN_IDS_BREADCRUMB_LIMIT = 5;

       export interface FaceWrongRateResult {
         thisWeekPct: number;
         lastWeekPct: number;
         deltaPp: number;
         topPromptVersions: string[];  // top SHAs by face_wrong count this week
         sampleSize: { thisWeek: number; lastWeek: number };
       }

       export async function queryFaceWrongRate(
         supabase: SupabaseClient,
         now: Date = new Date(),
       ): Promise<FaceWrongRateResult> {
         const sevenDaysAgo  = new Date(now.getTime() -  7 * 24 * 60 * 60 * 1000);
         const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

         // This week (last 7 days)
         const { data: thisWeek } = await supabase
           .from("campaigns")
           .select("id, regenerate_reason")
           .gte("created_at", sevenDaysAgo.toISOString());

         // Last week (the 7 days BEFORE that)
         const { data: lastWeek } = await supabase
           .from("campaigns")
           .select("id, regenerate_reason")
           .gte("created_at", fourteenDaysAgo.toISOString())
           .lt("created_at", sevenDaysAgo.toISOString());

         const thisWeekRows = thisWeek ?? [];
         const lastWeekRows = lastWeek ?? [];

         const thisFW = thisWeekRows.filter((r) => r.regenerate_reason === "face_wrong").length;
         const lastFW = lastWeekRows.filter((r) => r.regenerate_reason === "face_wrong").length;

         const thisWeekPct = thisWeekRows.length > 0 ? (thisFW / thisWeekRows.length) * 100 : 0;
         const lastWeekPct = lastWeekRows.length > 0 ? (lastFW / lastWeekRows.length) * 100 : 0;
         const deltaPp = thisWeekPct - lastWeekPct;

         // Join with api_cost_logs to enrich with prompt_version SHAs (top 3 by count)
         const faceWrongCampaignIds = thisWeekRows
           .filter((r) => r.regenerate_reason === "face_wrong")
           .map((r) => r.id);
         let topPromptVersions: string[] = [];
         if (faceWrongCampaignIds.length > 0) {
           const { data: logs } = await supabase
             .from("api_cost_logs")
             .select("metadata, campaign_id")
             .in("campaign_id", faceWrongCampaignIds)
             .eq("action", "sonnet_copywriter")
             .limit(500);
           const counts = new Map<string, number>();
           for (const log of logs ?? []) {
             const pv = (log.metadata as { prompt_version?: string } | null)?.prompt_version;
             if (pv) counts.set(pv, (counts.get(pv) ?? 0) + 1);
           }
           topPromptVersions = Array.from(counts.entries())
             .sort(([, a], [, b]) => b - a)
             .slice(0, TOP_PROMPT_VERSIONS_BREADCRUMB_LIMIT)
             .map(([pv]) => pv);
         }

         return {
           thisWeekPct,
           lastWeekPct,
           deltaPp,
           topPromptVersions,
           sampleSize: { thisWeek: thisWeekRows.length, lastWeek: lastWeekRows.length },
         };
       }

       export interface NivelRiscoAltoResult {
         pct: number;
         altoCount: number;
         validTotal: number;          // excludes falha_judge sentinel rows
         sampleCampaignIds: string[]; // up to 5, no PII (just UUIDs)
       }

       export async function queryNivelRiscoAltoRate(
         supabase: SupabaseClient,
         now: Date = new Date(),
       ): Promise<NivelRiscoAltoResult> {
         const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
         const { data } = await supabase
           .from("campaign_scores")
           .select("campaign_id, nivel_risco")
           .gte("created_at", sevenDaysAgo.toISOString());

         // Exclude falha_judge sentinel from the denominator (D-02 from Plan 02-03)
         const valid = (data ?? []).filter((r) => r.nivel_risco !== "falha_judge");
         const altoRows = valid.filter((r) => r.nivel_risco === "alto");
         const pct = valid.length > 0 ? (altoRows.length / valid.length) * 100 : 0;

         return {
           pct,
           altoCount: altoRows.length,
           validTotal: valid.length,
           sampleCampaignIds: altoRows.slice(0, SAMPLE_CAMPAIGN_IDS_BREADCRUMB_LIMIT).map((r) => r.campaign_id),
         };
       }

       /**
        * D-07 fingerprint — bucketed by Monday-of-week so all 7 days of the same
        * week dedup to a single Sentry issue. ISO week starts on Monday.
        */
       export function buildFaceWrongFingerprint(d: Date): string {
         const monday = new Date(d);
         const day = monday.getUTCDay(); // 0 Sun, 1 Mon, ..., 6 Sat
         const diff = day === 0 ? -6 : 1 - day; // shift back to Monday
         monday.setUTCDate(monday.getUTCDate() + diff);
         monday.setUTCHours(0, 0, 0, 0);
         const yyyy = monday.getUTCFullYear().toString().padStart(4, "0");
         const mm   = (monday.getUTCMonth() + 1).toString().padStart(2, "0");
         const dd   = monday.getUTCDate().toString().padStart(2, "0");
         return `face_wrong_spike_${yyyy}${mm}${dd}`;
       }

       /** D-08 fingerprint — bucketed daily. */
       export function buildNivelRiscoAltoFingerprint(d: Date): string {
         const yyyy = d.getUTCFullYear().toString().padStart(4, "0");
         const mm   = (d.getUTCMonth() + 1).toString().padStart(2, "0");
         const dd   = d.getUTCDate().toString().padStart(2, "0");
         return `nivel_risco_alto_spike_${yyyy}${mm}${dd}`;
       }
       ```

    3. Create `campanha-ia/src/lib/quality/alerts.test.ts` covering all 8 behavior tests above. Mock the supabase client with the same builder pattern from Plan 02-04 Task 2's test (or simpler: vi.fn returning resolved Promise with controlled `data`).
  </action>
  <acceptance_criteria>
    - `ls campanha-ia/src/lib/quality/alerts.ts campanha-ia/src/lib/quality/alerts.test.ts` returns both files.
    - `grep -E "FACE_WRONG_THRESHOLD_PCT = 5|FACE_WRONG_WOW_DELTA_PP = 1|NIVEL_RISCO_ALTO_THRESHOLD_PCT = 1" campanha-ia/src/lib/quality/alerts.ts | wc -l` ≥ 3 (LOCKED constants present with exact values).
    - `grep -c "queryFaceWrongRate\|queryNivelRiscoAltoRate\|buildFaceWrongFingerprint\|buildNivelRiscoAltoFingerprint" campanha-ia/src/lib/quality/alerts.ts` ≥ 4 (4 named exports declared).
    - `grep -c "falha_judge" campanha-ia/src/lib/quality/alerts.ts` ≥ 1 (sentinel filter present in nivel_risco query).
    - `cd campanha-ia && npx vitest run src/lib/quality/alerts.test.ts` passes all 8 tests.
    - `cd campanha-ia && npx tsc --noEmit` clean.
  </acceptance_criteria>
  <verify>
    <automated>cd campanha-ia && npx vitest run src/lib/quality/alerts.test.ts && npx tsc --noEmit</automated>
  </verify>
  <done>alerts.ts exports thresholds + 2 query functions + 2 fingerprint builders; sentinel filter present; 8 tests green.</done>
</task>

<task type="auto" tdd="false">
  <name>Task 3: Add qualityAlertsCron to lib/inngest/functions.ts (single cron, 3 checks)</name>
  <files>campanha-ia/src/lib/inngest/functions.ts</files>
  <read_first>
    - campanha-ia/src/lib/inngest/functions.ts (THE file being modified — read lines 251-307 for the cron function template; read whatever judgeCampaignJob added in Plan 02-03 to see where the new function should land)
    - campanha-ia/src/lib/inngest/storage-gc.ts (existing cron template — note the `triggers: [{ cron: '...' }]` syntax)
    - campanha-ia/src/lib/quality/alerts.ts (just created in Task 2)
    - campanha-ia/src/lib/observability.ts captureSyntheticAlert (just added in Task 1)
    - .planning/phases/02-quality-loop/02-05-SUMMARY.md (does the correlation view need REFRESH? if MATERIALIZED, yes)
    - .planning/phases/02-quality-loop/02-CONTEXT.md `<specifics>` Synthetic Sentry issue fingerprints (LOCKED)
  </read_first>
  <action>
    Modify `campanha-ia/src/lib/inngest/functions.ts`:

    1. Add imports near the top (after the imports added by Plan 02-03):
       ```typescript
       import {
         FACE_WRONG_THRESHOLD_PCT,
         FACE_WRONG_WOW_DELTA_PP,
         NIVEL_RISCO_ALTO_THRESHOLD_PCT,
         queryFaceWrongRate,
         queryNivelRiscoAltoRate,
         buildFaceWrongFingerprint,
         buildNivelRiscoAltoFingerprint,
       } from "@/lib/quality/alerts";
       import { captureSyntheticAlert } from "@/lib/observability";
       ```

    2. Insert new section BEFORE the `export const inngestFunctions = [...]` array (the array currently has judgeCampaignJob from Plan 02-03; this plan adds qualityAlertsCron):

       ```typescript
       // ═══════════════════════════════════════════════════════════
       // QUALITY ALERTS — Daily 7am UTC cron (Phase 02 D-07/D-08/D-10)
       // ═══════════════════════════════════════════════════════════
       //
       // Single cron runs 3 checks:
       //  (a) face_wrong WoW spike (D-07)
       //  (b) nivel_risco='alto' rolling 7-day spike (D-08)
       //  (c) [optional, conditional] REFRESH the prompt×regen correlation
       //      MATERIALIZED VIEW from Plan 02-05 — only if the view is
       //      MATERIALIZED (regular VIEW recomputes on read; no refresh needed).
       //
       // D-09 (Promptfoo PR regression Sentry issue) is NOT here — it is emitted
       // by the GitHub Action eval-on-pr.yml (Plan 02-02) at PR-level. This cron
       // is only for periodic threshold checks against production data.

       export const qualityAlertsCron = inngest.createFunction(
         {
           id: "quality-alerts-daily",
           triggers: [{ cron: "0 7 * * *" }],  // daily 7am UTC
         },
         async ({ step }) => {
           const { createAdminClient } = await import("@/lib/supabase/admin");
           const supabase = createAdminClient();
           const now = new Date();

           // Optional Step 0: REFRESH MATERIALIZED VIEW if Plan 02-05 picked that variant.
           // Per Plan 02-05 SUMMARY: if regular VIEW was chosen, this step is a no-op
           // (rpc returns "function not found" → caught silently).
           // If you ran Plan 02-05 and it was MATERIALIZED, switch this to:
           //   await supabase.rpc('refresh_prompt_version_regen_correlation');
           // (which would be a wrapper SQL function created in 02-05's migration).
           // For Phase 02 default (regular VIEW), this step is intentionally absent.

           // Step 1: face_wrong WoW spike (D-07)
           await step.run("check-face-wrong-spike", async () => {
             const r = await queryFaceWrongRate(supabase, now);
             if (
               r.thisWeekPct > FACE_WRONG_THRESHOLD_PCT &&
               r.deltaPp > FACE_WRONG_WOW_DELTA_PP
             ) {
               captureSyntheticAlert(
                 `face_wrong rate spike: ${r.thisWeekPct.toFixed(1)}% this week (Δ +${r.deltaPp.toFixed(1)}pp WoW)`,
                 buildFaceWrongFingerprint(now),
                 {
                   this_week_pct: r.thisWeekPct,
                   last_week_pct: r.lastWeekPct,
                   delta_pp: r.deltaPp,
                   sample_size: r.sampleSize,
                   top_prompt_versions: r.topPromptVersions,  // PII-safe: SHA strings only
                   threshold_pct: FACE_WRONG_THRESHOLD_PCT,
                   threshold_delta_pp: FACE_WRONG_WOW_DELTA_PP,
                 },
               );
               return { fired: true, kind: "face_wrong_spike", ...r };
             }
             return { fired: false, kind: "face_wrong_spike", ...r };
           });

           // Step 2: nivel_risco='alto' rolling 7-day spike (D-08)
           await step.run("check-nivel-risco-alto-spike", async () => {
             const r = await queryNivelRiscoAltoRate(supabase, now);
             if (r.pct > NIVEL_RISCO_ALTO_THRESHOLD_PCT) {
               captureSyntheticAlert(
                 `nivel_risco='alto' rate spike: ${r.pct.toFixed(2)}% (${r.altoCount}/${r.validTotal} last 7 days)`,
                 buildNivelRiscoAltoFingerprint(now),
                 {
                   pct: r.pct,
                   alto_count: r.altoCount,
                   valid_total: r.validTotal,
                   sample_campaign_ids: r.sampleCampaignIds,  // PII-safe: UUIDs only, NOT full payloads
                   threshold_pct: NIVEL_RISCO_ALTO_THRESHOLD_PCT,
                 },
               );
               return { fired: true, kind: "nivel_risco_alto_spike", ...r };
             }
             return { fired: false, kind: "nivel_risco_alto_spike", ...r };
           });

           return { ranAt: now.toISOString() };
         }
       );
       ```

    3. **Update the inngestFunctions array** at the bottom to include `qualityAlertsCron`:
       ```typescript
       export const inngestFunctions = [
         generateModelPreviewJob,
         generateBackdropJob,
         judgeCampaignJob,
         qualityAlertsCron,                     // ← NEW (Phase 02 D-07/D-08)
         storageGarbageCollectorCron,
         storageGarbageCollectorManual,
       ];
       ```

    Honor Plan 02-05's actual decision: if 02-05 SUMMARY says "MATERIALIZED chosen + needs refresh cron", uncomment Step 0 and add the refresh call. If 02-05 SUMMARY says "regular VIEW", leave Step 0 absent. Document the choice in the SUMMARY for this plan.

    DO NOT add a vitest for the cron itself — Inngest cron handlers are integration territory, and the underlying logic (queries + fingerprint builders) is already covered by Task 2's tests. A SUMMARY-noted manual smoke (force-fire via Inngest dashboard) is the intended verification.
  </action>
  <acceptance_criteria>
    - `grep -nE "qualityAlertsCron" campanha-ia/src/lib/inngest/functions.ts | wc -l` ≥ 3 (define + comment + array entry).
    - `grep -E "id: \"quality-alerts-daily\"|cron: \"0 7 \\* \\* \\*\"" campanha-ia/src/lib/inngest/functions.ts | wc -l` ≥ 2 (id + cron schedule LOCKED).
    - `grep -nE "step\\.run\\(\"check-face-wrong-spike\"|step\\.run\\(\"check-nivel-risco-alto-spike\"" campanha-ia/src/lib/inngest/functions.ts | wc -l` ≥ 2 (2 alert checks registered).
    - `grep -E "FACE_WRONG_THRESHOLD_PCT|FACE_WRONG_WOW_DELTA_PP|NIVEL_RISCO_ALTO_THRESHOLD_PCT" campanha-ia/src/lib/inngest/functions.ts | grep -v '^#' | wc -l` ≥ 3 (constants imported + used).
    - `grep -c "captureSyntheticAlert" campanha-ia/src/lib/inngest/functions.ts` ≥ 2 (2 invocations: face_wrong + nivel_risco_alto).
    - Existing inngestFunctions array length grew by exactly 1 vs the prior commit (qualityAlertsCron added; storage-gc + judgeCampaignJob untouched).
    - `cd campanha-ia && npx tsc --noEmit` clean.
    - Existing Plan 02-03 tests still pass: `cd campanha-ia && npx vitest run src/lib/inngest/judge.test.ts`.
  </acceptance_criteria>
  <verify>
    <automated>cd campanha-ia && npx vitest run src/lib/inngest/judge.test.ts src/lib/quality/alerts.test.ts src/lib/observability.test.ts && npx tsc --noEmit</automated>
  </verify>
  <done>qualityAlertsCron registered in inngestFunctions; runs daily 7am UTC; 2 alert checks emit synthetic Sentry issues with stable fingerprints; PII-safe breadcrumbs; tsc clean; no regression to judgeCampaignJob tests.</done>
</task>

</tasks>

<verification>
End-to-end smoke (manual, dev environment with Inngest dev server):

1. **Force-fire the cron** via Inngest dashboard:
   - Inngest dev: navigate to `quality-alerts-daily` function → "Trigger" button → submit empty payload.
   - Confirm both steps execute (status = success on `check-face-wrong-spike` + `check-nivel-risco-alto-spike`).

2. **Test threshold breach** by seeding test data:
   ```sql
   -- Seed 100 campaigns, 8 with face_wrong this week
   -- (or run an INSERT script that simulates the spike)
   ```
   Re-fire the cron → verify a Sentry warning issue appears with fingerprint `face_wrong_spike_<this_monday>`.

3. **Test fingerprint dedup**: re-fire the cron same day → verify NO new Sentry issue (existing one updates with new occurrence count).

4. **Test fingerprint week-rollover**: in dev, mock `now` to next Monday → re-fire → verify a NEW Sentry issue with `face_wrong_spike_<next_monday>` fingerprint.

5. Visual check in Sentry UI: confirm both fingerprints route to the same project channel as existing alerts (no new routing config needed per D-10).

Automated:
- `cd campanha-ia && npx vitest run src/lib/observability.test.ts src/lib/quality/alerts.test.ts src/lib/inngest/judge.test.ts`
- `cd campanha-ia && npx tsc --noEmit`
</verification>

<success_criteria>
- `lib/quality/alerts.ts` ships 3 git-versioned threshold constants (LOCKED values) + 2 query functions + 2 fingerprint builders.
- `captureSyntheticAlert` exported from `lib/observability.ts` — uses Sentry.captureMessage + scope.setFingerprint (NOT setExtra) for dedup.
- `qualityAlertsCron` runs daily at 7am UTC, executes 2 alert checks, emits synthetic Sentry warnings only when thresholds are breached.
- Fingerprints are date-bucketed: `face_wrong_spike_<Monday>` (week granularity), `nivel_risco_alto_spike_<day>` (day granularity).
- Breadcrumbs are PII-safe: top-3 prompt_version SHAs (face_wrong) or 5 sample campaign UUIDs (nivel_risco_alto) — never full payloads.
- D-09 (Promptfoo PR regression alert) is correctly OUT of this plan — handled by GitHub Action from Plan 02-02.
- All 12 new tests (4 observability + 8 alerts) green; existing Phase 01 + Plan 02-03 tests green.
- inngestFunctions array length grew by exactly 1 (qualityAlertsCron added; nothing removed).
</success_criteria>

<output>
After completion, create `.planning/phases/02-quality-loop/02-06-SUMMARY.md` documenting:
- Files created/modified
- Whether the optional Step 0 (REFRESH MATERIALIZED VIEW from Plan 02-05) was added — and the SQL invocation used
- Sample of one synthetic Sentry alert observed in dev (paste fingerprint + breadcrumbs JSON)
- Threshold tuning notes for Phase 03 (e.g. if alerts fire too often, suggest raising thresholds; if alerts never fire, suggest lowering)
- Any deferred items (e.g. "alert threshold tuning is per-product judgement; revisit after 2 weeks of production signal")
</output>
