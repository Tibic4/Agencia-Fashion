---
phase: 01-ai-pipeline-hardening
plan: 04
subsystem: ai-pipeline
tags: [d-18, log-model-cost, cost-logging, consolidation, fallbacks]
requires:
  - api_cost_logs table + metadata jsonb column (Plan 01-01)
  - SONNET_PROMPT_VERSION_PT/EN, sonnetPromptVersionFor (sonnet-copywriter.ts, Plan 01-01)
  - ANALYZER_PROMPT_VERSION (gemini-analyzer.ts, Plan 01-01)
  - VTO_PROMPT_VERSION (gemini-vto-generator.ts, Plan 01-01)
  - getExchangeRate, getModelPricing (lib/pricing/index.ts)
  - createAdminClient (lib/supabase/admin.ts)
provides:
  - logModelCost(args) helper — single writer for api_cost_logs
  - LogModelCostArgs interface (locked signature for D-18 + downstream Plan 05)
  - FALLBACK_TOKENS, FALLBACK_PRICES, FALLBACK_EXCHANGE_RATE (lib/pricing/fallbacks.ts)
affects:
  - api_cost_logs writes from pipeline.ts (analyzer + sonnet) — now via logModelCost
  - api_cost_logs writes from gemini-vto-generator.ts (VTO) — now via logModelCost
tech-stack:
  added: []
  patterns:
    - "Fire-and-forget helper preserves existing pipeline.ts:174-178 contract"
    - "Live pricing source (admin_settings) → per-action/per-model fallback table fallback chain"
    - "Caller-supplied promptVersion (cached at module load) → metadata.prompt_version (no per-call SHA recomputation)"
key-files:
  created:
    - campanha-ia/src/lib/pricing/fallbacks.ts
    - campanha-ia/src/lib/ai/log-model-cost.ts
    - campanha-ia/src/lib/ai/log-model-cost.test.ts
  modified:
    - campanha-ia/src/lib/ai/pipeline.ts
    - campanha-ia/src/lib/ai/gemini-vto-generator.ts
decisions:
  - "Helper signature locked to CONTEXT.md D-18 spec; promptVersion accepted as plain string from caller (cached at module load) — helper does NOT recompute the SHA."
  - "Per-image VTO fallback (FALLBACK_INPUT_PER_IMG * successCount) collapsed to a flat per-call value because pipeline v7 generates exactly one image per campaign (foto única universal); the multiplier semantics no longer apply."
  - "metadata=null when promptVersion is omitted, so legacy callers (none today, but Plan 05's Sonnet rewrite goes through here) don't accidentally write {} into api_cost_logs.metadata."
  - "Determinism test (C-02 regression gate) pins exchangeRate via the args.exchangeRate override path so the test is independent of any cached/live admin_settings value."
metrics:
  duration_min: 14
  tasks_completed: 3
  tasks_total: 3
  files_created: 3
  files_modified: 2
  loc_added: 446
  loc_removed: 224
  loc_net: 222
  tests_added: 7
  completed: 2026-05-03
status: complete
---

# Phase 01 Plan 04: logModelCost Consolidation (D-18) Summary

Three near-identical cost loggers (`logAnalyzerCost` + `logSonnetCost` in `pipeline.ts`, `logGeminiVTOCosts` in `gemini-vto-generator.ts`) collapsed onto one `logModelCost({ provider, model, action, usage, durationMs, promptVersion })` helper backed by per-action/per-model fallback tables in `lib/pricing/fallbacks.ts`. D-15's `metadata.prompt_version` contract preserved end-to-end (all four cached `*_PROMPT_VERSION` SHAs from Plan 01-01 produce byte-identical post-migration values).

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Create `lib/pricing/fallbacks.ts` with FALLBACK_TOKENS / FALLBACK_PRICES / FALLBACK_EXCHANGE_RATE | `a254c70` | `campanha-ia/src/lib/pricing/fallbacks.ts` |
| 2 | Create `logModelCost` helper + 7 Vitest cases (TDD) | `ccc5c08` | `campanha-ia/src/lib/ai/log-model-cost.ts`, `log-model-cost.test.ts` |
| 3a | Migrate `pipeline.ts` analyzer + sonnet sites; DELETE `logAnalyzerCost` + `logSonnetCost` | `2435d9b` | `campanha-ia/src/lib/ai/pipeline.ts` |
| 3b | Migrate `gemini-vto-generator.ts` VTO site; DELETE `logGeminiVTOCosts` | `2194077` | `campanha-ia/src/lib/ai/gemini-vto-generator.ts` |

## LoC Delta

| File | Added | Removed |
|---|---:|---:|
| `lib/pricing/fallbacks.ts` (new) | 44 | — |
| `lib/ai/log-model-cost.ts` (new) | 105 | — |
| `lib/ai/log-model-cost.test.ts` (new) | 235 | — |
| `lib/ai/pipeline.ts` (refactor) | 37 | 148 |
| `lib/ai/gemini-vto-generator.ts` (refactor) | 25 | 76 |
| **Totals** | **446** | **224** |

Net: +222 LoC. Test file accounts for 235 LoC of the gross add — the implementation surface itself shrunk meaningfully (3 ~60-line functions → 1 ~80-line helper + 1 ~30-line constants module).

## Tests Added (7 cases, all passing)

| # | Suite | Asserts |
|---|---|---|
| 1 | determinism (C-02 regression gate) | Same input twice → byte-identical insert payloads via `expect(p[0]).toEqual(p[1])` |
| 2 | D-15 prompt_version forwarding | `promptVersion: "abc123def456"` → captured `metadata.prompt_version === "abc123def456"` |
| 3 | metadata=null when promptVersion omitted | Legacy callers don't accidentally write `{}` into the jsonb column |
| 4 | Fallback tokens when usage undefined | `usage: undefined` + `action: "gemini_analyzer"` → captured input=4000, output=2000 (matches old logAnalyzerCost FALLBACK_INPUT/OUTPUT) |
| 5 | Real tokens override fallback | `usage: { inputTokens: 1234, outputTokens: 567 }` → captured 1234/567, fallback ignored |
| 6 | Cost arithmetic | 1M in @ $2/M + 1M out @ $12/M = $14 USD; * 2 BRL/USD = R$28 (cost_brl == cost_usd * exchangeRate) |
| 7 | Fire-and-forget on insert failure | Supabase mock returns `{ error: ... }` → `logModelCost(...)` resolves successfully + console.warn called |

Full suite: 69/69 across 9 test files.

## D-15 prompt_version Contract Preserved

The critical preservation rule from the executor brief was that `metadata.prompt_version` must still flow end-to-end after consolidation. Concrete evidence:

**Before (pipeline.ts analyzer site, pre-Plan-04):**
```ts
logAnalyzerCost(
  input.storeId,
  input.campaignId,
  analyzerDurationMs,
  analyzerResult._usageMetadata?.promptTokenCount,
  analyzerResult._usageMetadata?.candidatesTokenCount,
  ANALYZER_PROMPT_VERSION,                                    // ← 6th positional arg
).catch((e) => console.warn("[Pipeline] Erro ao salvar custo Analyzer:", e));
```

**After (pipeline.ts analyzer site, post-Plan-04):**
```ts
logModelCost({
  storeId: input.storeId,
  campaignId: input.campaignId,
  provider: "google",
  model: "gemini-3.1-pro-preview",
  action: "gemini_analyzer",
  usage: {
    inputTokens: analyzerResult._usageMetadata?.promptTokenCount,
    outputTokens: analyzerResult._usageMetadata?.candidatesTokenCount,
  },
  durationMs: analyzerDurationMs,
  promptVersion: ANALYZER_PROMPT_VERSION,                      // ← named arg, same constant
}).catch((e) => console.warn("[Pipeline] cost-log failed (analyzer):", e?.message ?? e));
```

Inside `logModelCost` (`log-model-cost.ts:88-91`):
```ts
const metadata = args.promptVersion
  ? { prompt_version: args.promptVersion }
  : null;

const { error } = await supabase.from("api_cost_logs").insert({
  ...
  metadata,
});
```

Same contract end-to-end: cached `*_PROMPT_VERSION` constant → `args.promptVersion` → `metadata.prompt_version` jsonb field. Same wiring for the Sonnet (`sonnetPromptVersionFor(sonnetLocale)`) and VTO (`VTO_PROMPT_VERSION`) call sites.

### Cached SHA Snapshot (boot-time) — UNCHANGED post-migration

Verified via `npx tsx` re-import of all four `*_PROMPT_VERSION` exports immediately before and immediately after the consolidation:

| Constant | Module | Pre-migration | Post-migration |
|---|---|---|---|
| `SONNET_PROMPT_VERSION_PT` | `lib/ai/sonnet-copywriter.ts` | `368daa52106b` | `368daa52106b` ✓ |
| `SONNET_PROMPT_VERSION_EN` | `lib/ai/sonnet-copywriter.ts` | `6fb4023c4732` | `6fb4023c4732` ✓ |
| `ANALYZER_PROMPT_VERSION`  | `lib/ai/gemini-analyzer.ts`   | `5c900fb19472` | `5c900fb19472` ✓ |
| `VTO_PROMPT_VERSION`       | `lib/ai/gemini-vto-generator.ts` | `9d5c754caf28` | `9d5c754caf28` ✓ |

All four match Plan 01-01-SUMMARY's recorded baseline byte-for-byte. No system prompt was edited by this plan; the consolidation was strictly mechanical (wiring change only).

## Verification

```text
$ cd campanha-ia && npx tsc --noEmit
(0 errors)

$ cd campanha-ia && npx vitest run --reporter=default
 ✓ src/lib/ai/log-model-cost.test.ts (7 tests) 76ms
 ✓ src/lib/ai/with-timeout.test.ts (5 tests) 17ms
 ✓ src/lib/mp-signature.test.ts (11 tests) 11ms
 ✓ src/lib/ai/prompt-version.test.ts (4 tests) 9ms
 ✓ src/lib/rate-limit.test.ts (4 tests) 8ms
 ✓ src/lib/validation.test.ts (5 tests) 9ms
 ✓ src/lib/observability.test.ts (3 tests) 14ms
 (+ 2 more files)

 Test Files  9 passed (9)
      Tests  69 passed (69)
   Duration  2.38s

$ grep -rn "^(async )?function (logAnalyzerCost|logSonnetCost|logGeminiVTOCosts)" campanha-ia/src/
(no matches — all three legacy function definitions deleted)

$ grep -c "logModelCost(" campanha-ia/src/lib/ai/pipeline.ts campanha-ia/src/lib/ai/gemini-vto-generator.ts
campanha-ia/src/lib/ai/pipeline.ts:3       (1 import + 2 call sites)
campanha-ia/src/lib/ai/gemini-vto-generator.ts:2  (1 import + 1 call site)

$ grep -rn "FALLBACK_INPUT|FALLBACK_OUTPUT" campanha-ia/src/lib/ai/
(no matches — inline constants centralized in lib/pricing/fallbacks.ts:FALLBACK_TOKENS)
```

Manual smoke (`SELECT … FROM api_cost_logs ORDER BY created_at DESC LIMIT 5`) is gated on Plan 01-01's open `checkpoint:human-verify` — the migration adding the `metadata jsonb` column has not been applied yet. Until then, `metadata.prompt_version` writes through `logModelCost` will be silently dropped by Supabase exactly as documented in 01-01-SUMMARY's "Hidden bug fix" note. This blocks observation but does NOT block landing the consolidation — once the migration applies, all three legacy call sites and the new helper begin persisting prompt_version on the same row schema.

## LogModelCostArgs Signature (locked, for downstream Plan 05)

Plan 05 (Sonnet rewrite to `tool_use` + Zod boundary, D-16) MUST keep using `logModelCost`. Do not regress to inline supabase writes.

```ts
export interface LogModelCostArgs {
  storeId: string;
  campaignId?: string;
  provider: "google" | "anthropic";
  model: string;            // e.g., "claude-sonnet-4-6"
  action: string;           // e.g., "sonnet_copywriter"
  usage?: { inputTokens?: number; outputTokens?: number };
  durationMs: number;
  exchangeRate?: number;    // override; defaults to getExchangeRate() with FALLBACK_EXCHANGE_RATE
  promptVersion?: string;   // D-15: cached *_PROMPT_VERSION constant from Plan 01-01
}
export async function logModelCost(args: LogModelCostArgs): Promise<void>;
```

Plan 05's call site for the migrated Sonnet copywriter should look identical to the current pipeline.ts:208-220 site — only the `usage` extraction may change (the `tool_use` response shape may surface tokens differently than the current text-completion path).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — Blocking] Vitest reporter `basic` no longer exists in Vitest 4.x**
- **Found during:** Task 2 (first test run).
- **Issue:** Plan body and execution-directives both invoke `--reporter=basic`. Vitest 4.x dropped that alias; the run failed with `Failed to load custom Reporter from basic` / `ERR_LOAD_URL`.
- **Fix:** Switched to `--reporter=default` for both the targeted run and the full suite. No test logic changed.
- **Files modified:** None (CLI invocation only).
- **Commit:** N/A (verification command, not a code change).

### Plan-vs-implementation refinements (no rule needed, just notes)

- **Per-image VTO multiplier removed.** The plan's suggested fallbacks table marked `gemini_vto_v5/v6` as `{ inputTokens: 3500, outputTokens: 1290 }` (the v5 backdrop-studio shape). The actual values inside `logGeminiVTOCosts` were `4600 / 4000` per-image, and the function multiplied by `successCount`. Pipeline v7 generates exactly one image per campaign (`PipelineInput.photoCount` is `@deprecated` and ignored — see pipeline.ts:73-79), so I lifted the per-image values verbatim into `FALLBACK_TOKENS["gemini_vto_v6"]` as a flat per-call value, dropping the multiplier semantics. Documented inline in `lib/pricing/fallbacks.ts:30-33` and in the deletion comment at `gemini-vto-generator.ts:578-587`.
- **Other action keys (`gemini_vto_v5`, `backdrop_studio`, `model_preview`) NOT added.** The plan's suggested table included those keys, but only `gemini_vto_v6` is wired through `logModelCost` today. The other three actions are written by call sites in `lib/google/nano-banana.ts`, `lib/inngest/functions.ts`, `lib/db/index.ts`, `lib/model-preview.ts`, `lib/ai/backdrop-generator.ts`, and `app/api/campaign/[id]/tips/route.ts` (per Plan 01-01's "Out-of-scope discoveries" list). Adding fallback entries for actions that no `logModelCost` caller uses today would create unused dead-code constants. They will be added when those six call sites migrate (a separate cleanup phase, not this plan's scope).
- **Other model prices (`gemini-3.1-flash-image-preview`, `gemini-3-flash-preview`, etc.) NOT added to `FALLBACK_PRICES`.** Same reason: only the three models that the three deleted functions actually fell back to are seeded. The live `getModelPricing()` source in `lib/pricing/index.ts:34-60` already carries a comprehensive fallback for every supported model; `FALLBACK_PRICES` exists only as a last-resort safety net for the three models the consolidated helper specifically calls.

### Threat surface scan

No new auth paths, network endpoints, or trust-boundary surface introduced. The new `logModelCost` writes through the same service-role `createAdminClient` admin path the three deleted functions used. The fallback-constants module is a pure data export. Per the plan's threat register, the C-02 determinism test is the gate for T-04-04 (DoS via determinism regression) and now lives in CI.

### Stub tracking

None — `logModelCost` writes a complete row on every call; no placeholder columns, no TODO branches.

## Note for Wave 4 (Sonnet tool_use migration — Plan 01-05)

When Plan 01-05 rewrites `sonnet-copywriter.ts` to use Anthropic `tool_use` + Zod boundary validation (D-16), the call site in `pipeline.ts:200-225` MUST continue to call `logModelCost(...)`. Do NOT regress to inline supabase writes. The only thing that may need to change in that block is the `usage.inputTokens`/`outputTokens` extraction — Anthropic's `tool_use` response surfaces token usage in the same `usage` field as text completions today, but if Plan 05 migrates to streaming or a different SDK shape, audit `_usageMetadata?.inputTokens` / `_usageMetadata?.outputTokens` to make sure the extraction still resolves.

The C-02 determinism test in `log-model-cost.test.ts` is the regression gate that catches "Plan 05 silently changed the cost-log row shape". It runs in CI alongside the rest of the suite.

## Self-Check: PASSED

- [FOUND] `campanha-ia/src/lib/pricing/fallbacks.ts` (Task 1)
- [FOUND] `campanha-ia/src/lib/ai/log-model-cost.ts` (Task 2)
- [FOUND] `campanha-ia/src/lib/ai/log-model-cost.test.ts` (Task 2, 7/7 passing)
- [FOUND] `logModelCost(` call sites in `pipeline.ts` (×2: analyzer + sonnet) and `gemini-vto-generator.ts` (×1: VTO)
- [VERIFIED ABSENT] No function definitions for `logAnalyzerCost` / `logSonnetCost` / `logGeminiVTOCosts` anywhere in `campanha-ia/src/`
- [VERIFIED ABSENT] No inline `FALLBACK_INPUT` / `FALLBACK_OUTPUT` constants in `campanha-ia/src/lib/ai/`
- [FOUND] commit `a254c70` (Task 1) on main
- [FOUND] commit `ccc5c08` (Task 2) on main
- [FOUND] commit `2435d9b` (Task 3a) on main
- [FOUND] commit `2194077` (Task 3b) on main
- [VERIFIED] `npx tsc --noEmit` returns 0 errors at HEAD
- [VERIFIED] `npx vitest run` returns 69/69 passing at HEAD
- [VERIFIED] All four cached `*_PROMPT_VERSION` SHAs match Plan 01-01-SUMMARY's recorded baseline byte-for-byte (`368daa52106b` / `6fb4023c4732` / `5c900fb19472` / `9d5c754caf28`)
