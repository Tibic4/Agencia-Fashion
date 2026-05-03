---
phase: 01-ai-pipeline-hardening
plan: 04
type: execute
wave: 3
depends_on: ["01-01", "01-03"]
files_modified:
  - campanha-ia/src/lib/ai/log-model-cost.ts
  - campanha-ia/src/lib/ai/log-model-cost.test.ts
  - campanha-ia/src/lib/pricing/fallbacks.ts
  - campanha-ia/src/lib/ai/pipeline.ts
  - campanha-ia/src/lib/ai/gemini-vto-generator.ts
autonomous: true
requirements: [D-18]
user_setup: []

must_haves:
  truths:
    - "logModelCost is the single function that writes to api_cost_logs (one signature, one helper, one fire-and-forget contract)"
    - "logAnalyzerCost, logSonnetCost, logGeminiVTOCosts no longer exist (deleted, not deprecated)"
    - "All three call sites in pipeline.ts and gemini-vto-generator.ts call logModelCost with provider/model/action discriminators"
    - "Fallback token + price constants live in lib/pricing/fallbacks.ts (one source of truth)"
    - "Same input → same api_cost_logs row (deterministic test gate)"
    - "metadata.prompt_version flows through from Plan 01's cached constants without re-hashing"
  artifacts:
    - path: "campanha-ia/src/lib/ai/log-model-cost.ts"
      provides: "logModelCost(args) helper writing to api_cost_logs with metadata.prompt_version"
      exports: ["logModelCost", "type LogModelCostArgs"]
    - path: "campanha-ia/src/lib/pricing/fallbacks.ts"
      provides: "FALLBACK_TOKENS map (per-action) + FALLBACK_PRICES map (per-model) + FALLBACK_EXCHANGE_RATE constant"
      exports: ["FALLBACK_TOKENS", "FALLBACK_PRICES", "FALLBACK_EXCHANGE_RATE"]
    - path: "campanha-ia/src/lib/ai/log-model-cost.test.ts"
      provides: "Vitest determinism + metadata.prompt_version + fire-and-forget tests"
  key_links:
    - from: "campanha-ia/src/lib/ai/pipeline.ts (was: logAnalyzerCost, logSonnetCost)"
      to: "campanha-ia/src/lib/ai/log-model-cost.ts logModelCost"
      via: "import { logModelCost } from \"./log-model-cost\""
      pattern: "logModelCost\\(\\{"
    - from: "campanha-ia/src/lib/ai/gemini-vto-generator.ts (was: logGeminiVTOCosts at line 571)"
      to: "campanha-ia/src/lib/ai/log-model-cost.ts logModelCost"
      via: "import { logModelCost } from \"./log-model-cost\""
      pattern: "logModelCost\\(\\{"
---

<objective>
Consolidate the three duplicate cost-log functions (`logAnalyzerCost` at `pipeline.ts:312-370`, `logSonnetCost` at `pipeline.ts:376-433`, `logGeminiVTOCosts` at `gemini-vto-generator.ts:571-632`) into one `logModelCost` helper per D-18. Move scattered fallback constants (`FALLBACK_INPUT = 4000`, `FALLBACK_OUTPUT = 2000` for analyzer; different values for Sonnet; different again for VTO; the `5.8` exchange rate fallback repeated three times; per-model price tables duplicated three times) into `lib/pricing/fallbacks.ts` as the single source of truth.

Purpose: The audit found that the three functions are 90% structurally identical — they differ only in (a) provider name, (b) model id, (c) action label, (d) per-action fallback constants. The duplication makes adding a new metadata field (e.g., D-15's `prompt_version`) a three-place edit, and it makes silent drift inevitable (today, the VTO fallback exchange rate already differs from the analyzer fallback by a typo waiting to happen). One helper + one fallbacks module collapses the surface.

Output: Two new files (`log-model-cost.ts`, `lib/pricing/fallbacks.ts`); deterministic Vitest coverage; three call sites in `pipeline.ts` (analyzer + sonnet) and `gemini-vto-generator.ts` (VTO) call `logModelCost(...)`; the three old functions DELETED (not commented out, not deprecated — DELETED, per CONTEXT.md `<scope>` "delete the three duplicates").
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/01-ai-pipeline-hardening/01-CONTEXT.md
@.planning/phases/01-ai-pipeline-hardening/01-AI-SPEC.md
@.planning/phases/01-ai-pipeline-hardening/01-01-SUMMARY.md
@campanha-ia/src/lib/ai/pipeline.ts
@campanha-ia/src/lib/ai/gemini-vto-generator.ts

<interfaces>
<!-- The three functions to delete. Their structure dictates the consolidated signature. -->

From campanha-ia/src/lib/ai/pipeline.ts:312-370 (logAnalyzerCost — to be DELETED):
```ts
async function logAnalyzerCost(
  storeId: string, campaignId: string | undefined, responseTimeMs: number,
  realInputTokens?: number, realOutputTokens?: number,
): Promise<void> {
  // exchange rate fallback 5.8
  // model price fallback { inputPerMTok: 2.00, outputPerMTok: 12.00 } for gemini-3.1-pro-preview
  // FALLBACK_INPUT = 4000, FALLBACK_OUTPUT = 2000
  // provider: "google", model_used: "gemini-3.1-pro-preview", action: "gemini_analyzer"
}
```

From campanha-ia/src/lib/ai/pipeline.ts:376-433 (logSonnetCost — to be DELETED):
```ts
async function logSonnetCost(
  storeId: string, campaignId: string | undefined, responseTimeMs: number,
  realInputTokens?: number, realOutputTokens?: number,
): Promise<void> {
  // exchange rate fallback 5.8
  // model price fallback { inputPerMTok: 3.00, outputPerMTok: 15.00 } for claude-sonnet-4-6
  // FALLBACK_INPUT = 2500, FALLBACK_OUTPUT = 800
  // provider: "anthropic", model_used: "claude-sonnet-4-6", action: "sonnet_copywriter"
}
```

From campanha-ia/src/lib/ai/gemini-vto-generator.ts:571-632 (logGeminiVTOCosts — to be DELETED):
```ts
async function logGeminiVTOCosts(
  storeId: string, campaignId: string | undefined,
  attempts: number, totalDurationMs: number,
  realInputTokens?: number, realOutputTokens?: number,
): Promise<void> {
  // similar shape — read the file for exact action/model/fallback values
}
```

Target signature locked by CONTEXT.md D-18:
```ts
export interface LogModelCostArgs {
  storeId: string;
  campaignId?: string;
  provider: "google" | "anthropic";
  model: string;                             // e.g., "gemini-3.1-pro-preview"
  action: string;                            // e.g., "gemini_analyzer", "sonnet_copywriter", "gemini_vto_v6"
  usage?: { inputTokens?: number; outputTokens?: number };  // real tokens from API; falls back to FALLBACK_TOKENS[action]
  durationMs: number;
  exchangeRate?: number;                     // override for tests; defaults to getExchangeRate() with fallback
  promptVersion?: string;                    // D-15: written to metadata.prompt_version
}
export async function logModelCost(args: LogModelCostArgs): Promise<void>;
```

Plan 01 deliverable (consume, do NOT recompute the SHA here):
- `SONNET_PROMPT_VERSION_PT` / `SONNET_PROMPT_VERSION_EN` / `sonnetPromptVersionFor(locale)` exported from `sonnet-copywriter.ts`
- `ANALYZER_PROMPT_VERSION` exported from `gemini-analyzer.ts`
- `VTO_PROMPT_VERSION` exported from `gemini-vto-generator.ts`

Pattern preserved (per CONTEXT.md `<code_context>`): fire-and-forget — every call site does `logModelCost({...}).catch((e) => console.warn("[Pipeline] cost-log failed:", e.message))` so the user-facing SSE path never waits.
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Create lib/pricing/fallbacks.ts with all three fallback tables</name>
  <files>campanha-ia/src/lib/pricing/fallbacks.ts</files>
  <action>Create `campanha-ia/src/lib/pricing/fallbacks.ts` with three exported tables, lifted from the constants currently embedded in the three soon-to-be-deleted functions:

```ts
// campanha-ia/src/lib/pricing/fallbacks.ts
// D-18: single source of truth for per-action fallback tokens, per-model
// fallback prices, and the BRL/USD exchange-rate fallback. Used by
// lib/ai/log-model-cost.ts when the live pricing source (lib/pricing) is
// unavailable. Centralizes constants previously duplicated across
// pipeline.ts (logAnalyzerCost + logSonnetCost) and gemini-vto-generator.ts
// (logGeminiVTOCosts).

/** BRL per USD fallback used when getExchangeRate() throws. Matches the
 *  hardcoded 5.8 in all three legacy loggers. */
export const FALLBACK_EXCHANGE_RATE = 5.8;

/** Token estimates per pipeline action when the SDK does not return real
 *  usage. Keys MUST match the `action` strings written to api_cost_logs
 *  (already filtered against by /admin/custos:49 v7Actions Set). */
export const FALLBACK_TOKENS: Record<string, { inputTokens: number; outputTokens: number }> = {
  gemini_analyzer:    { inputTokens: 4000, outputTokens: 2000 },
  sonnet_copywriter:  { inputTokens: 2500, outputTokens: 800 },
  gemini_vto_v5:      { inputTokens: 3500, outputTokens: 1290 },  // verify against gemini-vto-generator.ts:571-632 current values
  gemini_vto_v6:      { inputTokens: 3500, outputTokens: 1290 },
  backdrop_studio:    { inputTokens: 1200, outputTokens: 1290 },
  model_preview:      { inputTokens: 1200, outputTokens: 1290 },
};

/** Per-model fallback price (USD per 1M tokens) when getModelPricing()
 *  is unavailable or has no entry. Values lifted from the three legacy
 *  cost loggers. */
export const FALLBACK_PRICES: Record<string, { inputPerMTok: number; outputPerMTok: number }> = {
  "gemini-3.1-pro-preview":       { inputPerMTok: 2.00, outputPerMTok: 12.00 },
  "claude-sonnet-4-6":            { inputPerMTok: 3.00, outputPerMTok: 15.00 },
  "gemini-3-pro-image-preview":   { inputPerMTok: 0.30, outputPerMTok: 30.00 },  // image gen — verify
  "gemini-3.1-flash-image-preview": { inputPerMTok: 0.075, outputPerMTok: 0.30 },
};
```

**Verification step before commit:** the values for `gemini_vto_v5/v6` and the image-preview model prices must match what `logGeminiVTOCosts` currently uses. Read `campanha-ia/src/lib/ai/gemini-vto-generator.ts:571-632` first and copy the exact constants — do not invent values. If the current code uses different fallback constants for `v5` vs `v6`, list both keys with their respective values; do not collapse.</action>
  <verify>
    <automated>cd campanha-ia &amp;&amp; npx tsc --noEmit src/lib/pricing/fallbacks.ts &amp;&amp; grep -c "FALLBACK_EXCHANGE_RATE\\|FALLBACK_TOKENS\\|FALLBACK_PRICES" src/lib/pricing/fallbacks.ts</automated>
  </verify>
  <done>File exists, all three tables exported, values match the constants currently in `logAnalyzerCost`/`logSonnetCost`/`logGeminiVTOCosts` (verified by reading source before writing), tsc clean.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Create logModelCost helper + Vitest determinism tests</name>
  <files>campanha-ia/src/lib/ai/log-model-cost.ts, campanha-ia/src/lib/ai/log-model-cost.test.ts</files>
  <behavior>
    - Same input → same api_cost_logs row: call logModelCost twice with identical args (mock the supabase admin client, capture .insert payload), assert both payloads are deeply equal. Per CONTEXT.md C-02 this is the regression-prevention test for D-18.
    - metadata.prompt_version is forwarded: logModelCost({ ..., promptVersion: "abc123def456" }) → captured insert payload has `metadata.prompt_version === "abc123def456"`.
    - Falls back to FALLBACK_TOKENS[action] when usage is undefined: logModelCost({ action: "gemini_analyzer", usage: undefined, ... }) → captured payload has input_tokens=4000, output_tokens=2000.
    - Real tokens override fallbacks: logModelCost({ action: "gemini_analyzer", usage: { inputTokens: 1234, outputTokens: 567 }, ... }) → captured payload has input_tokens=1234, output_tokens=567.
    - cost_brl = cost_usd × exchangeRate (use exchangeRate=2.0 for arithmetic clarity in the test): assert cost_brl === cost_usd * 2.
    - Fire-and-forget: insert error does NOT throw — logModelCost returns successfully even if supabase mock returns { error: { message: "..." } }; only console.warn is called.
  </behavior>
  <action>Create `campanha-ia/src/lib/ai/log-model-cost.ts` with the consolidated helper. The signature is locked by CONTEXT.md D-18:

```ts
// campanha-ia/src/lib/ai/log-model-cost.ts
import { FALLBACK_EXCHANGE_RATE, FALLBACK_PRICES, FALLBACK_TOKENS } from "@/lib/pricing/fallbacks";

export interface LogModelCostArgs {
  storeId: string;
  campaignId?: string;
  provider: "google" | "anthropic";
  model: string;
  action: string;
  usage?: { inputTokens?: number; outputTokens?: number };
  durationMs: number;
  exchangeRate?: number;
  promptVersion?: string;
}

/**
 * D-18: single helper that writes one row to api_cost_logs.
 *
 * Replaces logAnalyzerCost + logSonnetCost + logGeminiVTOCosts. Fire-and-forget
 * by contract — callers do `logModelCost({...}).catch((e) => console.warn(...))`
 * so the user-facing SSE path never waits.
 *
 * D-15: when promptVersion is supplied, it lands in metadata.prompt_version
 * (the column added by 20260503_120000_add_api_cost_logs_metadata.sql).
 */
export async function logModelCost(args: LogModelCostArgs): Promise<void> {
  const { createAdminClient } = await import("@/lib/supabase/admin");
  const supabase = createAdminClient();

  // Resolve exchange rate (live → fallback)
  let exchangeRate = args.exchangeRate ?? FALLBACK_EXCHANGE_RATE;
  let modelPrice = FALLBACK_PRICES[args.model];
  if (args.exchangeRate === undefined) {
    try {
      const { getExchangeRate, getModelPricing } = await import("@/lib/pricing");
      exchangeRate = await getExchangeRate();
      const livePricing = await getModelPricing();
      if (livePricing[args.model]) modelPrice = livePricing[args.model];
    } catch {
      // fall back silently — FALLBACK_EXCHANGE_RATE + FALLBACK_PRICES already set
    }
  }
  if (!modelPrice) {
    console.warn(`[logModelCost] no fallback price for model "${args.model}" — cost will be 0`);
    modelPrice = { inputPerMTok: 0, outputPerMTok: 0 };
  }

  // Resolve token counts (real → fallback)
  const fallbackTokens = FALLBACK_TOKENS[args.action] ?? { inputTokens: 0, outputTokens: 0 };
  const inputTokens = args.usage?.inputTokens ?? fallbackTokens.inputTokens;
  const outputTokens = args.usage?.outputTokens ?? fallbackTokens.outputTokens;
  const tokenSource = args.usage?.inputTokens !== undefined ? "real" : "estimated";

  const costUsd =
    (inputTokens * modelPrice.inputPerMTok) / 1_000_000 +
    (outputTokens * modelPrice.outputPerMTok) / 1_000_000;
  const costBrl = costUsd * exchangeRate;

  console.log(
    `[Pipeline] 💰 ${args.action} (${tokenSource}): $${costUsd.toFixed(4)} / R$ ${costBrl.toFixed(4)}` +
    ` | tokens: ${inputTokens} in + ${outputTokens} out`,
  );

  const metadata: Record<string, unknown> = {};
  if (args.promptVersion) metadata.prompt_version = args.promptVersion;

  const { error } = await supabase.from("api_cost_logs").insert({
    store_id: args.storeId,
    campaign_id: args.campaignId ?? null,
    provider: args.provider,
    model_used: args.model,
    action: args.action,
    cost_usd: costUsd,
    cost_brl: costBrl,
    exchange_rate: exchangeRate,
    input_tokens: inputTokens,
    output_tokens: outputTokens,
    tokens_used: inputTokens + outputTokens,
    response_time_ms: args.durationMs,
    metadata: Object.keys(metadata).length > 0 ? metadata : null,
  });

  if (error) {
    console.warn(`[Pipeline] ⚠️ Falha ao logar custo ${args.action}:`, error.message);
  }
}
```

Then create `log-model-cost.test.ts` covering all six behaviors above. Use `vi.mock("@/lib/supabase/admin")` to capture `.insert()` payloads. Use `vi.mock("@/lib/pricing")` to control `getExchangeRate`/`getModelPricing` results. Match the test style of `campanha-ia/src/lib/payments/google-play.test.ts`.

Determinism test (the C-02 regression gate) MUST be present: same input twice produces identical insert payloads. This is the test that prevents "logModelCost looked equivalent to the three old functions" and then silently differs in some edge case.</action>
  <verify>
    <automated>cd campanha-ia &amp;&amp; npx vitest run src/lib/ai/log-model-cost.test.ts --reporter=basic</automated>
  </verify>
  <done>Both files exist, all six test cases pass (determinism, prompt_version forwarding, fallback tokens, real tokens override, cost arithmetic, fire-and-forget), tsc clean.</done>
</task>

<task type="auto">
  <name>Task 3: Migrate pipeline.ts and gemini-vto-generator.ts call sites; DELETE the three legacy functions</name>
  <files>campanha-ia/src/lib/ai/pipeline.ts, campanha-ia/src/lib/ai/gemini-vto-generator.ts</files>
  <action>Replace every call to the legacy logger functions with `logModelCost(...)`, then DELETE the legacy function definitions. After this task, `grep -rn "logAnalyzerCost\\|logSonnetCost\\|logGeminiVTOCosts" campanha-ia/src/` MUST return zero hits.

Step 3a — In `pipeline.ts`:
1. Add at the top: `import { logModelCost } from "./log-model-cost";` and `import { ANALYZER_PROMPT_VERSION } from "./gemini-analyzer";` and `import { sonnetPromptVersionFor } from "./sonnet-copywriter";` (the *_PROMPT_VERSION exports come from Plan 01).
2. Find the call sites (currently around `pipeline.ts:174-178, 203-213` per CONTEXT.md `<code_context>`). Each currently looks like:
   ```ts
   logAnalyzerCost(storeId, campaignId, durationMs, realIn, realOut)
     .catch((e) => console.warn("[Pipeline] ⚠️ Falha ao logar custo Analyzer:", e.message));
   ```
   Replace each with:
   ```ts
   logModelCost({
     storeId,
     campaignId,
     provider: "google",
     model: "gemini-3.1-pro-preview",
     action: "gemini_analyzer",
     usage: { inputTokens: realIn, outputTokens: realOut },
     durationMs,
     promptVersion: ANALYZER_PROMPT_VERSION,
   }).catch((e) => console.warn("[Pipeline] cost-log failed:", e.message));
   ```
   And the Sonnet equivalent:
   ```ts
   logModelCost({
     storeId,
     campaignId,
     provider: "anthropic",
     model: "claude-sonnet-4-6",
     action: "sonnet_copywriter",
     usage: { inputTokens: realIn, outputTokens: realOut },
     durationMs,
     promptVersion: sonnetPromptVersionFor(locale),  // locale from the surrounding scope
   }).catch((e) => console.warn("[Pipeline] cost-log failed:", e.message));
   ```
3. DELETE the entire `async function logAnalyzerCost(...)` block at lines 312-370 and the entire `async function logSonnetCost(...)` block at lines 376-433.

Step 3b — In `gemini-vto-generator.ts`:
1. Add: `import { logModelCost } from "./log-model-cost";` (VTO_PROMPT_VERSION is already in this file from Plan 01 task 3c).
2. Find the call site at line 431 (`logGeminiVTOCosts(...)`). Replace with `logModelCost({ ..., action: "gemini_vto_v6" /* match current action label exactly */, promptVersion: VTO_PROMPT_VERSION, ... })`. Read the existing call to copy storeId/campaignId/durationMs/usage values exactly.
3. DELETE the entire `async function logGeminiVTOCosts(...)` block at lines 571-632.

Step 3c — Final cleanup:
- `grep -rn "logAnalyzerCost\\|logSonnetCost\\|logGeminiVTOCosts" campanha-ia/src/` returns ZERO hits. If anything remains (a test importing one of them, an unused symbol), delete it too.
- `grep -rn "FALLBACK_INPUT\\|FALLBACK_OUTPUT" campanha-ia/src/lib/ai/` returns ZERO hits (these constants are now centralized in `lib/pricing/fallbacks.ts:FALLBACK_TOKENS`).
- `cd campanha-ia &amp;&amp; npx tsc --noEmit` clean.
- `cd campanha-ia &amp;&amp; npm test -- --run` green (the determinism test from Task 2 + any existing pipeline tests).
- Manual smoke: trigger one campaign generation; query `SELECT created_at, action, metadata FROM api_cost_logs ORDER BY created_at DESC LIMIT 5;` — three rows (analyzer, sonnet_copywriter, gemini_vto_*), each with `metadata->>'prompt_version'` populated.

Do NOT preserve the legacy functions as deprecated stubs. CONTEXT.md D-18 says "Delete the three duplicates" — keeping deprecated versions defeats the consolidation.</action>
  <verify>
    <automated>cd campanha-ia &amp;&amp; npx tsc --noEmit &amp;&amp; bash -c '! grep -rn "logAnalyzerCost\\|logSonnetCost\\|logGeminiVTOCosts" src/'</automated>
  </verify>
  <done>All three legacy functions deleted; all three call sites use `logModelCost`; tsc + tests green; manual smoke confirms one row per call with `metadata.prompt_version` populated.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Application → Supabase api_cost_logs.insert | Service-role write; no user input enters args (storeId/campaignId from authenticated session, action/model/provider are constants) |
| Pipeline orchestrator → logModelCost | Internal — fire-and-forget contract is the only invariant |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-04-01 | Tampering | promptVersion field is application-controlled | accept | Sourced from cached SHA constants computed at module load (Plan 01); no path for user input to reach this field |
| T-04-02 | Information Disclosure | Cost values exposed via metadata jsonb | accept | Existing api_cost_logs already exposes cost_brl/cost_usd; metadata adds only prompt_version (one-way SHA) |
| T-04-03 | Repudiation | Fire-and-forget loses cost-log writes on transient supabase failure | accept | Existing contract per `pipeline.ts:174-178` "user-facing path never waits"; cost rows are best-effort metering, not financial-record-keeping |
| T-04-04 | DoS | Determinism regression: same input produces different rows over time | mitigate | Determinism test (Task 2) is the C-02 regression gate; runs in CI |
</threat_model>

<verification>
1. `cd campanha-ia &amp;&amp; npx tsc --noEmit` returns zero errors.
2. `cd campanha-ia &amp;&amp; npx vitest run src/lib/ai/log-model-cost.test.ts` passes 6/6.
3. `cd campanha-ia &amp;&amp; npm test -- --run` exits 0.
4. `grep -c "logAnalyzerCost\\|logSonnetCost\\|logGeminiVTOCosts" campanha-ia/src/` returns 0.
5. `grep -c "logModelCost(" campanha-ia/src/lib/ai/pipeline.ts campanha-ia/src/lib/ai/gemini-vto-generator.ts | grep -v ':0$'` returns ≥1 hit per file.
6. Manual: one campaign generation produces three `api_cost_logs` rows with `metadata->>'prompt_version'` populated and `metadata->>'prompt_version'` matching the cached constants exported by Plan 01.
</verification>

<success_criteria>
- `logModelCost` exists with the locked signature (`LogModelCostArgs` interface).
- Three legacy functions deleted (not deprecated, DELETED).
- All three call sites migrated; `prompt_version` flows through from cached constants.
- Fallback constants centralized in `lib/pricing/fallbacks.ts`.
- Determinism + prompt_version + fallback + fire-and-forget tests pass.
</success_criteria>

<output>
After completion, create `.planning/phases/01-ai-pipeline-hardening/01-04-SUMMARY.md` documenting:
- The exact `LogModelCostArgs` signature so Plan 05 (Sonnet rewrite) calls it correctly.
- Confirmation grep that the three legacy function names appear ZERO times in `src/`.
- Sample row from `api_cost_logs` after the smoke test, redacted.
</output>
