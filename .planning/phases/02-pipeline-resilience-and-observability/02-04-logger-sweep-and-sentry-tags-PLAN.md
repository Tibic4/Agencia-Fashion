---
plan_id: 02-04
phase: 2
title: Logger sweep — replace 42 console.* in /api/campaign/generate with logger.* + captureError at every catch (D-12, QUALITY priority #2)
wave: 2
depends_on: [02-02]
files_modified:
  - campanha-ia/src/app/api/campaign/generate/route.ts
files_modified_optional:
  - campanha-ia/src/lib/observability.ts (only if a captureCampaignSuccess helper proves valuable — defer if not)
autonomous: true
requirements: [D-11, D-12, D-13, D-14, "QUALITY:#2"]
must_haves:
  truths:
    - "All 42 raw console.{log,warn,error} in /api/campaign/generate/route.ts are replaced with logger.{debug,info,warn,error} from @/lib/observability (D-12)"
    - "Logger levels: info for happy-path step transitions, warn for fallback/partial paths, error for unrecoverable failures. Debug for high-frequency in-loop logs (D-12)"
    - "Every existing catch block in the route has captureError(err, { route: 'campaign.generate', step: <step>, store_id: hashStoreId(store.id) | 'anon', model: <model id when relevant> }) added — D-11 structured tags"
    - "No PII in payload: store_id is hashed via hashStoreId from Plan 02-02. User text inputs (loja name etc.) truncated to 50 chars + suffix. Image data referenced only by Supabase storage path, never base64 (D-13)"
    - "Existing 11 routes with captureError stay UNCHANGED. The sweep targets ONLY /api/campaign/generate"
    - "Plan 02-03's catches (added in that plan for trial fail-secure, refund failure, etc.) DO NOT need to be re-instrumented here — Plan 02-03 already adds them with the right tags"
  acceptance:
    - "grep -c 'console\\.' campanha-ia/src/app/api/campaign/generate/route.ts returns 0 (was 42)"
    - "grep -c 'logger\\.' campanha-ia/src/app/api/campaign/generate/route.ts returns ≥ 30 (most former console.* calls are now logger.*; some may be removed entirely as duplicates)"
    - "grep -c 'captureError' campanha-ia/src/app/api/campaign/generate/route.ts returns ≥ 6 (one per identifiable catch block — count exact during execution)"
    - "Every captureError call includes a `step:` field in the context object"
    - "tsc --noEmit passes"
    - "All existing route tests (if any HTTP-level test exists post-Plan 02-05) pass; vitest baseline 184+ pass"
---

# Plan 02-04: Logger Sweep + Sentry Tags for /api/campaign/generate

## Objective

Eliminate the biggest blind spot in the codebase: 42 raw `console.*` and 0 `captureError` in the headline product flow. After this plan, every step transition is structured-logged and every catch has a Sentry event with `route+step+model+store_id_hash` tags.

This plan owns:
- **D-11** — Structured tags on every captureError.
- **D-12** — Logger replaces all 42 console.* calls.
- **D-13** — No PII in payload.
- **QUALITY priority #2** — Add Sentry + structured logging to the route.

## Truths the executor must respect

- This plan does NOT add new functionality — it's a pure observability sweep. No behavioral changes.
- Plan 02-03 (parallel wave) is also editing this file. The two plans MUST coordinate: **the executor of Plan 02-04 should run AFTER Plan 02-03 is committed** (logical dependency, not declared because both are wave 2). Practical approach: Plan 02-03 lands first (it does behavioral work + ADDS some captureError calls), then Plan 02-04 sweeps the remaining console.* calls and adds tags to any catches Plan 02-03 didn't already instrument.
- Alternatively, if waves are executed strictly in parallel, the executor must reconcile by reading the file AFTER Plan 02-03's edits and only sweeping what remains.
- **Recommended ordering:** treat 02-04 as logically depending on 02-03 even though wave is the same — this minimizes merge friction. Plan-checker may relax this.
- Replace `console.*` with the appropriate `logger.*` level — don't blindly map console.log → logger.info. High-frequency in-loop logs (e.g., per-image upload progress) should be `logger.debug` (suppressed in prod per observability.ts:15).
- Catches added in Plan 02-03 (trial check, refund, disconnect) ALREADY have captureError + tags. This plan just covers any pre-existing catch blocks without instrumentation.
- The 42-count is the BASELINE. Some console.* calls may be removed entirely as redundant rather than converted (e.g., a `console.log("step done")` that's already covered by a structured logger.info elsewhere).

## Tasks

### Task 1: Inventory existing console.* + catch blocks in the route

<read_first>
- campanha-ia/src/app/api/campaign/generate/route.ts (FULL file — required for inventory)
- campanha-ia/src/lib/observability.ts (logger + captureError API — see RESEARCH §R-01)
- .planning/codebase/QUALITY.md §"Coverage Gaps" #1 (the rationale)
</read_first>

<action>
Before editing, the executor produces a small inventory in their working memory or scratch. Identify:

1. All `console.{log,warn,error}` call sites — there are 42 per the audit.
2. All `try { ... } catch` blocks — list each with its current step semantic ("vto", "sonnet", "trial_check", "finalize", "teaser", "upload", "refund", or whatever the closest semantic name).
3. Which catch blocks Plan 02-03 already instrumented (skip these).
4. Which catch blocks have NO captureError today (target list).

The inventory is not a deliverable — it's just the executor's working list. After inventory, proceed to Task 2.
</action>

<acceptance_criteria>
- Executor has a clear list of catch blocks needing instrumentation
- Executor distinguishes Plan 02-03-touched catches from Plan-02-04-only catches (no double-instrumentation)
- No file edits in this task — pure analysis
</acceptance_criteria>

---

### Task 2: Replace 42 console.* with logger.* + add imports

<read_first>
- campanha-ia/src/lib/observability.ts (the logger API)
- All identified console.* sites from Task 1 (in route.ts)
</read_first>

<action>
At the top of `campanha-ia/src/app/api/campaign/generate/route.ts`, ensure these imports exist (add if missing):

```ts
import { logger, captureError, hashStoreId } from "@/lib/observability";
import * as Sentry from "@sentry/nextjs";
```

Replace each `console.{log,warn,error}` call with the appropriate `logger.*` call.

**Mapping rules:**

| Original | Replace with | Notes |
|---|---|---|
| `console.log("[Generate] 🚀 Starting...")` | `logger.info("campaign_generate_start", { /* ctx */ })` | Drop emoji prefix; use snake_case event name as msg |
| `console.log("[Pipeline] step X done", X)` | `logger.info("pipeline_step_done", { step: "X" })` | Structure the data; X goes in ctx, not interpolated |
| `console.warn("Sonnet returned no copy, using fallback")` | `logger.warn("sonnet_fallback_used", { reason: "no_copy" })` | warn-level for fallback paths |
| `console.error("Pipeline failed:", err)` | `logger.error("pipeline_failed", { error: err instanceof Error ? err.message : String(err) })` | error-level; err.message in ctx |
| Per-iteration progress logs | `logger.debug("upload_progress", { i, total })` | debug — suppressed in prod |
| Cost summary line | `logger.info("api_cost_summary", { cost_brl, model })` | info — useful even in prod |

**Naming convention for event names (the first arg to logger.*):**

- `snake_case`
- Verb-first or domain-event style: `pipeline_step_done`, `vto_upload_failed`, `sonnet_fallback_used`, `refund_credit_returned`, `client_disconnected`
- NO emojis, NO bracket prefixes
- Free to be descriptive — the value is grep-ability

**Ctx field conventions:**

- Always include `store_id: hashStoreId(store.id)` if `store` is in scope (NOT raw UUID, per D-13)
- `step` field for any pipeline-step-related log
- `error: err.message` (truncated to 500 chars if from raw exception)
- `model: <id>` when the log refers to a specific AI provider call
- User text inputs (loja name, productType, etc.) MUST be truncated to 50 chars + "..." suffix per D-13
</action>

<acceptance_criteria>
- ZERO `console.*` calls remain in `route.ts` (`grep -c "console\\." campanha-ia/src/app/api/campaign/generate/route.ts` returns 0)
- AT LEAST 30 `logger.*` calls in `route.ts` (some console.* may be deleted as redundant; net reduction below ~25 is suspicious — verify by re-reading)
- Imports of `logger`, `captureError`, `hashStoreId` are at the top of the file
- No raw `console.error("[Generate] ...", err)` patterns remain
- No emojis in logger event names (`grep -P "logger\\.\\w+\\(\".*[\\u{1F300}-\\u{1F9FF}]" campanha-ia/src/app/api/campaign/generate/route.ts` returns 0)
- All store-id references in logger ctx use `hashStoreId(store.id)` — `grep -E "logger\\..*store_id:.*store\\.id[^_]" campanha-ia/src/app/api/campaign/generate/route.ts` returns 0 (no raw UUID)
- `tsc --noEmit` passes
</acceptance_criteria>

---

### Task 3: Add captureError to every catch block (D-11)

<read_first>
- campanha-ia/src/app/api/campaign/generate/route.ts (the catches identified in Task 1)
- Plan 02-03's edits (already-instrumented catches — skip)
</read_first>

<action>
For every catch block NOT already instrumented by Plan 02-03, add captureError with structured tags right at the catch entry:

```ts
} catch (err) {
  captureError(err, {
    route: "campaign.generate",
    step: "<vto | sonnet | trial_check | finalize | teaser | upload | refund | log_disconnect | misc>",
    store_id: store ? hashStoreId(store.id) : "anon",
    model: "<gemini-vto | gemini-3.1-pro | sonnet-4.6 | n/a>",  // when relevant
  });
  // ... existing handling logic ...
}
```

The `step` value is per-catch — the executor picks the closest semantic name. Suggested mapping:

| Catch location (approximate) | step value |
|---|---|
| Around the VTO call | `vto` |
| Around the Sonnet copy call | `sonnet` |
| Around the trial-detection Promise.all | `trial_check` (Plan 02-03 owns this) |
| Around the upload retry loop | `upload` |
| Around the refund branch | `refund` (Plan 02-03 owns this) |
| Around the teaser branch | `teaser` |
| Around the Inngest dispatch | `inngest_dispatch` |
| Around `failCampaign` calls | `fail_campaign_write` |
| Around final SSE emit | `sse_emit` |
| Outer catch (covers everything) | `outer` (or omit step, use `model: "pipeline_v6"`) |
| Around the api_cost_logs insert (cost log catch) | `cost_log` |
| Around the disconnect log helper | `log_disconnect` (Plan 02-03 owns this) |

If a catch block currently swallows the error silently (e.g., `try { ... } catch {}`) and the swallowing is intentional (e.g., the writer.close() cleanup), DO NOT add captureError — the silent swallow is correct behavior. Add a comment marking it as intentional:

```ts
try {
  await writer.close();
} catch {
  // Intentional swallow: writer cleanup. Errors here mean the connection is
  // already torn down; nothing actionable.
}
```
</action>

<acceptance_criteria>
- Every catch block in `route.ts` either: (a) has `captureError(err, { route, step, store_id, model? })`, OR (b) has a comment justifying why it's an intentional silent swallow
- All `step:` values come from the curated list above (no free-form drift)
- All `store_id:` references use `hashStoreId(store.id)` or the literal `"anon"` (never raw UUID)
- Static check: `grep -c "captureError" campanha-ia/src/app/api/campaign/generate/route.ts` returns ≥ 6
- Static check: `grep -B 2 "} catch.*{$\\|catch (.*) {$" campanha-ia/src/app/api/campaign/generate/route.ts` followed by manual review confirms no naked silent swallows without justification comment
- `tsc --noEmit` passes
- The custom Sentry events from Plan 02-03 (D-14) are NOT duplicated here — those are captureMessage calls, this plan only adds captureError on exception paths
</acceptance_criteria>

---

### Task 4: PII truncation pass on user-text fields (D-13)

<read_first>
- campanha-ia/src/app/api/campaign/generate/route.ts:81-115 (existing safeStr / sanitization — D-13 builds on this)
- All logger.* call sites that include user-supplied strings (storeName, productType, material, title, etc.) in ctx
</read_first>

<action>
Audit every `logger.*` call added in Task 2 for user-text fields in the ctx object. Truncate any user-supplied string field to 50 chars with `"..."` suffix.

Helper function (add at the top of the route file, or import from `lib/utils/`):

```ts
function truncForLog(s: unknown, max = 50): string {
  if (typeof s !== "string") return String(s);
  return s.length > max ? s.slice(0, max) + "..." : s;
}
```

Then in any logger call:

```ts
logger.info("campaign_inputs_received", {
  store_id: hashStoreId(store.id),
  loja_name: truncForLog(storeName),    // max 50 chars
  product_type: truncForLog(productType),
  title: truncForLog(title),
  // image references: NEVER base64 — use storage paths only
  model_image_path: modelStoragePath,   // not modelImageBase64
});
```

Verify NO logger.* calls include base64 data, full image buffers, or full Clerk JWT tokens.
</action>

<acceptance_criteria>
- A `truncForLog` helper exists (top of file, or imported)
- All user-text fields in logger ctx use `truncForLog(value)` — `grep -nE "logger\\..*\\b(storeName|productType|material|title|loja_name)\\b" campanha-ia/src/app/api/campaign/generate/route.ts` shows truncated wrapping
- ZERO base64 strings logged: `grep -nE "logger\\..*base64|Base64\\b" campanha-ia/src/app/api/campaign/generate/route.ts` returns 0 (image data references go through storage paths)
- `tsc --noEmit` passes
</acceptance_criteria>

---

## Verification

1. `npx tsc --noEmit` in `campanha-ia/` exits 0.
2. `grep -c "console\\." campanha-ia/src/app/api/campaign/generate/route.ts` returns 0.
3. `grep -c "logger\\." campanha-ia/src/app/api/campaign/generate/route.ts` returns ≥ 30.
4. `grep -c "captureError" campanha-ia/src/app/api/campaign/generate/route.ts` returns ≥ 6.
5. `grep -nE "store_id:.*store\\.id[^_]" campanha-ia/src/app/api/campaign/generate/route.ts` returns 0 (no raw store UUIDs in logger ctx).
6. `npx vitest run` passes baseline (no behavioral test should regress; this plan adds no new tests — Plan 02-05 owns the HTTP-level route tests).
7. Manual trace: pick 3 random catch blocks; verify each has captureError with `route + step + store_id + model?`.

## Cross-cutting must_haves

```yaml
truths:
  - zero_console_calls_in_generate_route
  - logger_levels_match_severity_info_warn_error_debug
  - every_catch_has_captureerror_with_structured_tags_or_intentional_swallow_comment
  - no_raw_store_uuid_in_logger_ctx_only_hashstoreid_or_anon
  - user_text_truncated_to_50_chars_in_logger_ctx
  - no_base64_or_jwt_logged
acceptance:
  - tsc_passes
  - vitest_baseline_184_preserved
  - quality_priority_2_demonstrably_addressed
```
