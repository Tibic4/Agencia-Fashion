---
phase: 01-ai-pipeline-hardening
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - campanha-ia/supabase/migrations/20260503_120000_add_api_cost_logs_metadata.sql
  - campanha-ia/src/lib/ai/prompt-version.ts
  - campanha-ia/src/lib/ai/sonnet-copywriter.ts
  - campanha-ia/src/lib/ai/gemini-analyzer.ts
  - campanha-ia/src/lib/ai/gemini-vto-generator.ts
  - campanha-ia/src/lib/ai/pipeline.ts
autonomous: false
requirements: [D-15]
user_setup: []

must_haves:
  truths:
    - "api_cost_logs table has a metadata jsonb column (no longer silently dropped by Supabase)"
    - "Every analyzer/Sonnet/VTO cost log row carries metadata.prompt_version (12-char hex)"
    - "prompt_version is computed once at module import (not per-call)"
    - "Two identical system prompts produce the same prompt_version SHA across processes"
  artifacts:
    - path: "campanha-ia/supabase/migrations/20260503_120000_add_api_cost_logs_metadata.sql"
      provides: "ALTER TABLE adding metadata jsonb column to api_cost_logs"
      contains: "ADD COLUMN IF NOT EXISTS metadata jsonb"
    - path: "campanha-ia/src/lib/ai/prompt-version.ts"
      provides: "computePromptVersion(prompt: string) helper + cached SONNET_PROMPT_VERSION/ANALYZER_PROMPT_VERSION/VTO_PROMPT_VERSION constants"
      exports: ["computePromptVersion"]
  key_links:
    - from: "campanha-ia/src/lib/ai/sonnet-copywriter.ts"
      to: "campanha-ia/src/lib/ai/prompt-version.ts"
      via: "import { computePromptVersion } and cache at module top"
      pattern: "computePromptVersion\\("
    - from: "campanha-ia/src/lib/ai/pipeline.ts logSonnetCost/logAnalyzerCost"
      to: "api_cost_logs.metadata"
      via: ".insert({ ..., metadata: { prompt_version: ... } })"
      pattern: "metadata:\\s*\\{[^}]*prompt_version"
---

<objective>
Land production-quality signal infrastructure for D-15 (`prompt_version` traceability) by (a) adding the missing `metadata jsonb` column to `api_cost_logs`, (b) creating a single source-of-truth `computePromptVersion()` helper, and (c) wiring `prompt_version` writes into all three current cost loggers (`logAnalyzerCost`, `logSonnetCost`, `logGeminiVTOCosts`). This unblocks Phase 2's "did Tuesday's prompt edit cause Friday's quality dip?" debugging without it, every regression debug starts from zero.

Purpose: D-15 is the discipline gate for AI quality work. The audit found that `route.ts:834` already writes to `metadata` but the column does not exist in the baseline schema (verified — `grep -n "metadata" supabase/migrations/00000000000000_baseline.sql` returns zero hits in the `api_cost_logs` block at lines 15-35). Supabase silently drops unknown columns, so today's writes are no-ops. This plan fixes the column AND adds prompt-version to every write site.

Output: Migration committed; `prompt-version.ts` module exists; three existing log functions in `pipeline.ts` and `gemini-vto-generator.ts` write `metadata.prompt_version`; admin-review checkpoint confirms the migration is safe to apply against the production Supabase project.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/01-ai-pipeline-hardening/01-CONTEXT.md
@.planning/phases/01-ai-pipeline-hardening/01-AI-SPEC.md
@campanha-ia/supabase/migrations/00000000000000_baseline.sql
@campanha-ia/src/lib/ai/pipeline.ts
@campanha-ia/src/lib/ai/sonnet-copywriter.ts
@campanha-ia/src/lib/ai/gemini-analyzer.ts
@campanha-ia/src/lib/ai/gemini-vto-generator.ts
@campanha-ia/src/app/api/campaign/generate/route.ts

<interfaces>
<!-- The three cost loggers that need prompt_version added. All currently in pipeline.ts (analyzer + sonnet) or gemini-vto-generator.ts (VTO). -->

From campanha-ia/src/lib/ai/pipeline.ts (lines 312-433):
```ts
async function logAnalyzerCost(
  storeId: string,
  campaignId: string | undefined,
  responseTimeMs: number,
  realInputTokens?: number,
  realOutputTokens?: number,
): Promise<void>;

async function logSonnetCost(
  storeId: string,
  campaignId: string | undefined,
  responseTimeMs: number,
  realInputTokens?: number,
  realOutputTokens?: number,
): Promise<void>;
```

From campanha-ia/src/lib/ai/gemini-vto-generator.ts (lines 571-632):
```ts
async function logGeminiVTOCosts(
  storeId: string,
  campaignId: string | undefined,
  attempts: number,
  totalDurationMs: number,
  realInputTokens?: number,
  realOutputTokens?: number,
): Promise<void>;
```

System prompt source locations (the strings to hash):
- Sonnet: `campanha-ia/src/lib/ai/sonnet-copywriter.ts` — `buildSystemPrompt(locale)` at top of file (~lines 70-340)
- Analyzer: `campanha-ia/src/lib/ai/gemini-analyzer.ts` — `ANALYZER_PROMPT` or equivalent at module top
- VTO: `campanha-ia/src/lib/ai/gemini-vto-generator.ts` — VTO instructions string

Existing metadata write site (currently no-op, will start working after migration):
```ts
// campanha-ia/src/app/api/campaign/generate/route.ts:834
metadata: { error_code: errCode, message: technicalMsg.slice(0, 500), retryable: isRetryable }
```
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Create migration adding api_cost_logs.metadata jsonb column</name>
  <files>campanha-ia/supabase/migrations/20260503_120000_add_api_cost_logs_metadata.sql</files>
  <action>Create the migration file with this exact content (replaces the silent-drop currently happening at route.ts:834 and unblocks D-15):

```sql
-- ── 20260503_120000_add_api_cost_logs_metadata.sql ──
-- D-15: Add metadata jsonb to api_cost_logs so prompt_version, error_code,
-- and other per-call diagnostics are persisted instead of silently dropped
-- by Supabase. Existing write sites in route.ts:834 and the future
-- logModelCost helper (D-18) target this column.

ALTER TABLE public.api_cost_logs
  ADD COLUMN IF NOT EXISTS metadata jsonb;

-- Backfill is unnecessary — historical rows have no prompt_version and
-- querying NULL metadata is acceptable. No index needed at Phase 1 volume
-- (~hundreds of rows/day); add a GIN index in Phase 2 if/when admin/custos
-- starts filtering by metadata->>'prompt_version'.
```

Filename uses today's date (2026-05-03) + monotonic timestamp (120000) to sort after the 20260430 migration. Do NOT skip the `IF NOT EXISTS` — the column may already exist in dev environments where someone added it ad-hoc.</action>
  <verify>
    <automated>test -f campanha-ia/supabase/migrations/20260503_120000_add_api_cost_logs_metadata.sql &amp;&amp; grep -q "ADD COLUMN IF NOT EXISTS metadata jsonb" campanha-ia/supabase/migrations/20260503_120000_add_api_cost_logs_metadata.sql</automated>
  </verify>
  <done>Migration file exists, contains the `ADD COLUMN IF NOT EXISTS metadata jsonb` clause against `public.api_cost_logs`, and is named so it sorts after `20260430_180000_update_plan_pricing.sql`.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Create prompt-version.ts module with cached SHA constants</name>
  <files>campanha-ia/src/lib/ai/prompt-version.ts, campanha-ia/src/lib/ai/prompt-version.test.ts</files>
  <behavior>
    - computePromptVersion("hello world") returns "94d18b8636aa" (12-char lowercase hex of SHA-256). Verify with `node -e "console.log(require('crypto').createHash('sha256').update('hello world').digest('hex').slice(0,12))"`.
    - computePromptVersion(sameString) called twice returns the same value (deterministic).
    - computePromptVersion("a") !== computePromptVersion("A") (case-sensitive).
    - computePromptVersion("") returns the empty-string SHA prefix "e3b0c44298fc".
  </behavior>
  <action>Create `campanha-ia/src/lib/ai/prompt-version.ts` with this signature (per AI-SPEC.md §4b.3 D-15 paragraph and CONTEXT.md `<specifics>`):

```ts
// campanha-ia/src/lib/ai/prompt-version.ts
import crypto from "node:crypto";

/**
 * D-15: 12-char hex SHA-256 prefix of a system prompt.
 * Stored in api_cost_logs.metadata.prompt_version so we can correlate
 * cost/quality regressions to specific prompt revisions.
 *
 * Computed once at module load by callers (cache the constant), NOT per-call.
 */
export function computePromptVersion(prompt: string): string {
  return crypto.createHash("sha256").update(prompt).digest("hex").slice(0, 12);
}
```

Then add a Vitest unit test at `campanha-ia/src/lib/ai/prompt-version.test.ts` covering the four behaviors above. Use the existing vitest config (no new setup); follow the test style of `campanha-ia/src/lib/payments/google-play.test.ts` (currently modified per `git status` — read first to match imports/describe-it pattern).

Do NOT cache inside the function — caching is the *caller's* job (each system prompt module computes its constant once at import). The function itself is pure.</action>
  <verify>
    <automated>cd campanha-ia &amp;&amp; npx vitest run src/lib/ai/prompt-version.test.ts --reporter=basic</automated>
  </verify>
  <done>Both files exist, all four test cases pass, `computePromptVersion` is exported and pure (no module-level caching inside the function).</done>
</task>

<task type="auto">
  <name>Task 3: Wire prompt_version into all three existing cost loggers</name>
  <files>campanha-ia/src/lib/ai/sonnet-copywriter.ts, campanha-ia/src/lib/ai/gemini-analyzer.ts, campanha-ia/src/lib/ai/gemini-vto-generator.ts, campanha-ia/src/lib/ai/pipeline.ts</files>
  <action>Add a module-level cached SHA constant to each of the three prompt-owning files, then thread it through to the corresponding cost-log insert. **Do NOT consolidate the loggers in this task** — that is D-18 / Plan 04. This task only adds the `metadata: { prompt_version }` write to the three existing functions.

Step 3a — In `campanha-ia/src/lib/ai/sonnet-copywriter.ts`, after the imports, add:
```ts
import { computePromptVersion } from "./prompt-version";

// D-15: cached at module load. If buildSystemPrompt is locale-dependent,
// compute once per locale and look up by locale key inside generateCopyWithSonnet.
const SONNET_SYSTEM_PROMPT_PT = buildSystemPrompt("pt-BR");
const SONNET_SYSTEM_PROMPT_EN = buildSystemPrompt("en-US");
export const SONNET_PROMPT_VERSION_PT = computePromptVersion(SONNET_SYSTEM_PROMPT_PT);
export const SONNET_PROMPT_VERSION_EN = computePromptVersion(SONNET_SYSTEM_PROMPT_EN);
export function sonnetPromptVersionFor(locale: string): string {
  return locale.toLowerCase().startsWith("en") ? SONNET_PROMPT_VERSION_EN : SONNET_PROMPT_VERSION_PT;
}
```
If `buildSystemPrompt` is not the actual function name in the file, read it (`grep -n "function build" sonnet-copywriter.ts`) and adapt the symbol — the goal is "hash whatever string ends up in `system:` of the Anthropic call". If the prompt has no locale arg, drop the locale split and export a single `SONNET_PROMPT_VERSION` constant.

Step 3b — In `campanha-ia/src/lib/ai/gemini-analyzer.ts`, same pattern: import `computePromptVersion`, cache `ANALYZER_PROMPT_VERSION = computePromptVersion(<the prompt string passed to generateContent>)` at module load, export it.

Step 3c — In `campanha-ia/src/lib/ai/gemini-vto-generator.ts`, same: cache `VTO_PROMPT_VERSION` at module load.

Step 3d — In `campanha-ia/src/lib/ai/pipeline.ts`:
- Update `logAnalyzerCost` signature to accept `promptVersion: string` as a new required arg, and add `metadata: { prompt_version: promptVersion }` to the `.insert({...})` call at line ~352.
- Update `logSonnetCost` signature the same way (line ~376), accept `promptVersion: string`, add `metadata: { prompt_version: promptVersion }` to the insert at line ~415.
- Update the call sites in `runCampaignPipeline` (where `logAnalyzerCost(...)` and `logSonnetCost(...)` are awaited/fired) to pass the cached constants:
  - `logAnalyzerCost(..., ANALYZER_PROMPT_VERSION)` — import from `./gemini-analyzer`.
  - `logSonnetCost(..., sonnetPromptVersionFor(locale))` — import from `./sonnet-copywriter`.

Step 3e — In `campanha-ia/src/lib/ai/gemini-vto-generator.ts` `logGeminiVTOCosts` (line ~571): add `metadata: { prompt_version: VTO_PROMPT_VERSION }` to its `.insert({...})`. The function lives in the same file as the constant so no import needed.

Verify nothing else writes to `api_cost_logs` without `metadata` — `grep -rn "from(.*api_cost_logs.*).insert\|api_cost_logs.*insert" campanha-ia/src/` should return only these three call sites + the existing `route.ts:834` (which already writes metadata.error_code; leave it untouched).

Do NOT break the fire-and-forget `.catch((e) => console.warn(...))` contract on these calls — `pipeline.ts:174-178, 203-213` per CONTEXT.md `<code_context>`.</action>
  <verify>
    <automated>cd campanha-ia &amp;&amp; npx tsc --noEmit &amp;&amp; grep -c "metadata:.*prompt_version" src/lib/ai/pipeline.ts src/lib/ai/gemini-vto-generator.ts | grep -v ':0$'</automated>
  </verify>
  <done>TypeScript compiles. All three cost-log inserts (`logAnalyzerCost`, `logSonnetCost`, `logGeminiVTOCosts`) include `metadata: { prompt_version: <constant> }`. Each prompt-owning module exports its `*_PROMPT_VERSION` constant. Fire-and-forget pattern preserved.</done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <what-built>Migration `20260503_120000_add_api_cost_logs_metadata.sql` has been written but NOT applied to the remote Supabase project. Code changes write to `metadata.prompt_version` — those writes will silently no-op (Supabase drops unknown columns) until the migration is applied.</what-built>
  <how-to-verify>
    1. Open `campanha-ia/supabase/migrations/20260503_120000_add_api_cost_logs_metadata.sql` and confirm the `ALTER TABLE` statement is correct.
    2. Decide application path:
       - Local first: `cd campanha-ia &amp;&amp; supabase db reset` (dev only) OR `supabase db push` against your local project, then verify with `supabase db diff`.
       - Remote: apply via Supabase MCP `apply_migration` tool OR via `supabase db push --linked` (CLI requires `supabase link` first).
    3. After applying, verify the column exists by running this SQL in the Supabase dashboard SQL Editor (or via MCP `execute_sql`):
       ```sql
       SELECT column_name, data_type FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'api_cost_logs' AND column_name = 'metadata';
       ```
       Expected: one row, `metadata`, `jsonb`.
    4. Trigger one campaign generation in a non-production environment, then query `SELECT created_at, model_used, metadata FROM api_cost_logs ORDER BY created_at DESC LIMIT 5;` — every row should now have `metadata.prompt_version` as a 12-char hex string.
  </how-to-verify>
  <resume-signal>Type "applied" once the migration is live in the target Supabase environment AND the smoke-test query shows metadata.prompt_version populated. Type "rolled back" with a short note if you need to revert.</resume-signal>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Application code → Supabase Postgres | Schema migration writes via privileged service-role key; no user input in this path |
| LLM SDK response → api_cost_logs metadata | The 12-char SHA is computed from the *system prompt string* the application controls — model output never enters the SHA |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-01-01 | Tampering | api_cost_logs.metadata jsonb column | accept | Service-role-only writes (existing `createAdminClient` pattern); RLS already blocks anonymous writes per existing baseline policies |
| T-01-02 | Information Disclosure | metadata.prompt_version exposes a content fingerprint | accept | 12-char SHA-256 prefix is a one-way hash; cannot be reversed to recover the prompt; even if leaked it only reveals "this row used prompt revision X" |
| T-01-03 | Denial of Service | Migration on a hot table could lock writes | mitigate | `ADD COLUMN ... jsonb` with no DEFAULT and no NOT NULL is metadata-only in Postgres ≥11 (no table rewrite, no row-lock); checkpoint requires human verification before applying to production |
| T-01-04 | Repudiation | Cost-log writes are fire-and-forget; failures hidden in console.warn | accept | Existing `.catch((e) => console.warn(...))` pattern is intentional (per CONTEXT.md `<code_context>` "user-facing path never waits"); D-18 / Plan 04 will add Sentry breadcrumbs to the consolidated helper |
</threat_model>

<verification>
Phase-level checks for this plan:

1. `cd campanha-ia &amp;&amp; npx tsc --noEmit` returns zero errors.
2. `cd campanha-ia &amp;&amp; npx vitest run src/lib/ai/prompt-version.test.ts` passes 4/4.
3. `grep -c "computePromptVersion" campanha-ia/src/lib/ai/sonnet-copywriter.ts campanha-ia/src/lib/ai/gemini-analyzer.ts campanha-ia/src/lib/ai/gemini-vto-generator.ts` returns ≥1 in each file.
4. `grep "ADD COLUMN IF NOT EXISTS metadata jsonb" campanha-ia/supabase/migrations/20260503_120000_add_api_cost_logs_metadata.sql` returns 1 hit.
5. Manual: One campaign generation produces 3 `api_cost_logs` rows where `metadata->>'prompt_version'` matches `length() = 12` and is hex.
</verification>

<success_criteria>
- Migration file exists, applied to target Supabase environment, `metadata jsonb` column visible in `information_schema.columns`.
- `prompt-version.ts` module + tests committed; tests pass.
- Three cost-log functions (`logAnalyzerCost`, `logSonnetCost`, `logGeminiVTOCosts`) write `metadata.prompt_version` on every successful call.
- Cached `*_PROMPT_VERSION` constants exported from the three prompt-owning modules so D-18's consolidated helper (Plan 04) can import them without re-hashing.
- Fire-and-forget cost-log contract preserved (no `await` chain blocks the SSE response path).
</success_criteria>

<output>
After completion, create `.planning/phases/01-ai-pipeline-hardening/01-01-SUMMARY.md` documenting:
- The exact migration filename and the SQL applied.
- The three exported `*_PROMPT_VERSION` constant names + their initial SHA values (for downstream plans to import).
- Confirmation that `metadata.prompt_version` is populated in production via the verification SQL.
</output>
