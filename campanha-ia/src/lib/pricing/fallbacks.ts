// campanha-ia/src/lib/pricing/fallbacks.ts
//
// D-18 (AI Pipeline Hardening, Phase 01): single source of truth for the
// per-action token estimates, per-model price tables, and BRL/USD exchange-
// rate fallback that were previously duplicated across three cost-log
// helpers (`logAnalyzerCost` + `logSonnetCost` in pipeline.ts and
// `logGeminiVTOCosts` in gemini-vto-generator.ts).
//
// Used exclusively by `lib/ai/log-model-cost.ts` when the live pricing
// source (`lib/pricing` → admin_settings) is unavailable. Values were lifted
// verbatim from the three legacy functions before deletion — DO NOT change
// the numbers without auditing every cost-log call site that previously had
// its own fallback constants inline.

/** BRL per USD fallback used when `getExchangeRate()` throws. Matches the
 *  hardcoded 5.8 in all three legacy loggers and the `FALLBACK_EXCHANGE_RATE`
 *  constant inside `lib/pricing/index.ts`. */
export const FALLBACK_EXCHANGE_RATE = 5.8;

/** Token estimates per pipeline action when the SDK does not return real
 *  usage from `_usageMetadata`. Keys MUST match the `action` strings written
 *  to `api_cost_logs` (already filtered against by `/admin/custos:49`
 *  v7Actions Set). */
export const FALLBACK_TOKENS: Record<string, { inputTokens: number; outputTokens: number }> = {
  // pipeline.ts:341-342 — logAnalyzerCost FALLBACK_INPUT/OUTPUT
  gemini_analyzer:    { inputTokens: 4000, outputTokens: 2000 },
  // pipeline.ts:406-407 — logSonnetCost FALLBACK_INPUT/OUTPUT
  sonnet_copywriter:  { inputTokens: 2500, outputTokens: 800 },
  // gemini-vto-generator.ts:603-604 — logGeminiVTOCosts FALLBACK_*_PER_IMG.
  // Pipeline v7 generates one image per campaign (foto única universal —
  // see PipelineInput.photoCount @deprecated note), so the per-image
  // values become the per-call fallback directly.
  gemini_vto_v6:      { inputTokens: 4600, outputTokens: 4000 },
  // Phase 02 D-04: LLM-as-judge (claude-sonnet-4-6 via lib/ai/judge.ts).
  //   Input estimate (~1200 tokens):
  //     - JUDGE_SYSTEM_PROMPT body ≈ 800 tokens (PT-BR rubric + Forbidden List
  //       + 5-trigger taxonomy verbatim citations from DOMAIN-RUBRIC.md).
  //     - User text (3 image URLs + copyText caption_sugerida ~250 chars +
  //       prompt_version SHA + prefix labels) ≈ 350 tokens. Round to 1200.
  //   Output estimate (~800 tokens):
  //     - 6 numeric dims + 1 enum + 6 PT-BR justificativas (each capped at
  //       500 chars by Zod, but the model usually emits ~80-100 tokens each).
  //     - 6 × 100 = 600 + JSON wrapping + tool_use envelope ≈ 800.
  //   Cost target: ~R$0.02/campaign at FALLBACK_PRICES["claude-sonnet-4-6"]
  //     = (1200 × 3.0 + 800 × 15.0) / 1M × 5.8 BRL/USD
  //     = ($0.0036 + $0.0120) × 5.8 ≈ R$0.0905. Above the CONTEXT.md hand-wave
  //     of R$0.02 because the rubric prompt is denser than the back-of-envelope
  //     assumed. Real usage from the SDK overrides this fallback once the
  //     judge is live (logModelCost prefers args.usage.* when present).
  judge_quality:      { inputTokens: 1200, outputTokens: 800 },
};

/** Per-model fallback price (USD per 1M tokens) when `getModelPricing()`
 *  is unavailable or has no entry for the requested model. Values lifted
 *  from the three legacy cost loggers (pipeline.ts:327, 393 and
 *  gemini-vto-generator.ts:588). */
export const FALLBACK_PRICES: Record<string, { inputPerMTok: number; outputPerMTok: number }> = {
  "gemini-3.1-pro-preview":      { inputPerMTok: 2.0,  outputPerMTok: 12.0 },
  "claude-sonnet-4-6":           { inputPerMTok: 3.0,  outputPerMTok: 15.0 },
  "gemini-3-pro-image-preview":  { inputPerMTok: 2.0,  outputPerMTok: 120.0 },
};
