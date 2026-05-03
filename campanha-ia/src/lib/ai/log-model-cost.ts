// campanha-ia/src/lib/ai/log-model-cost.ts
//
// D-18 (Phase 01 AI Pipeline Hardening): single helper that writes one row
// to `api_cost_logs`. Replaces the three near-identical `logAnalyzerCost`,
// `logSonnetCost`, and `logGeminiVTOCosts` functions that were inline in
// `pipeline.ts` and `gemini-vto-generator.ts` before this plan.
//
// Contract (per CONTEXT.md `<code_context>` "Established Patterns"):
//  * Fire-and-forget — every call site does
//      `logModelCost({...}).catch((e) => console.warn("[Pipeline] ...", e.message))`
//    so the user-facing SSE path never blocks on cost-log writes.
//  * `metadata.prompt_version` (D-15) is forwarded from the caller's cached
//    `*_PROMPT_VERSION` constant — `logModelCost` does NOT recompute the SHA.
//  * Token resolution: real usage from the SDK takes precedence; if absent,
//    we fall back to the per-action estimate in `FALLBACK_TOKENS[action]`.
//  * Pricing resolution: live `getModelPricing()` / `getExchangeRate()` first,
//    `FALLBACK_PRICES[model]` / `FALLBACK_EXCHANGE_RATE` if the live source
//    throws. `args.exchangeRate` (when supplied) shortcuts the live lookup
//    entirely — used by the Vitest determinism gate.

import {
  FALLBACK_EXCHANGE_RATE,
  FALLBACK_PRICES,
  FALLBACK_TOKENS,
} from "@/lib/pricing/fallbacks";

export interface LogModelCostArgs {
  storeId: string;
  campaignId?: string;
  provider: "google" | "anthropic";
  /** Model id as it appears in `api_cost_logs.model_used` (e.g. "gemini-3.1-pro-preview"). */
  model: string;
  /** Action label as it appears in `api_cost_logs.action` (e.g. "gemini_analyzer"). */
  action: string;
  /** Real token usage returned by the SDK; falls back to FALLBACK_TOKENS[action] when undefined. */
  usage?: { inputTokens?: number; outputTokens?: number };
  durationMs: number;
  /** Override for tests / callers that already resolved the rate. Skips live lookup. */
  exchangeRate?: number;
  /** D-15: cached SHA prefix of the system prompt. Lands in metadata.prompt_version. */
  promptVersion?: string;
}

export async function logModelCost(args: LogModelCostArgs): Promise<void> {
  const { createAdminClient } = await import("@/lib/supabase/admin");
  const supabase = createAdminClient();

  // ── Resolve exchange rate + per-model price (live → fallback) ──────────
  let exchangeRate = args.exchangeRate ?? FALLBACK_EXCHANGE_RATE;
  let modelPrice = FALLBACK_PRICES[args.model];
  if (args.exchangeRate === undefined) {
    try {
      const { getExchangeRate, getModelPricing } = await import("@/lib/pricing");
      exchangeRate = await getExchangeRate();
      const livePricing = await getModelPricing();
      if (livePricing[args.model]) {
        modelPrice = livePricing[args.model];
      }
    } catch {
      // silent — FALLBACK_EXCHANGE_RATE + FALLBACK_PRICES already set above
    }
  }
  if (!modelPrice) {
    console.warn(`[logModelCost] no fallback price for model "${args.model}" — cost will be 0`);
    modelPrice = { inputPerMTok: 0, outputPerMTok: 0 };
  }

  // ── Resolve token counts (real usage → per-action fallback) ────────────
  const fallbackTokens = FALLBACK_TOKENS[args.action] ?? { inputTokens: 0, outputTokens: 0 };
  const inputTokens = args.usage?.inputTokens ?? fallbackTokens.inputTokens;
  const outputTokens = args.usage?.outputTokens ?? fallbackTokens.outputTokens;
  const tokenSource = args.usage?.inputTokens !== undefined ? "real" : "estimated";

  // ── Cost arithmetic (USD per 1M tokens; BRL = USD × rate) ──────────────
  const costUsd =
    (inputTokens * modelPrice.inputPerMTok) / 1_000_000 +
    (outputTokens * modelPrice.outputPerMTok) / 1_000_000;
  const costBrl = costUsd * exchangeRate;

  console.log(
    `[Pipeline] 💰 ${args.action} (${tokenSource}): $${costUsd.toFixed(4)} / R$ ${costBrl.toFixed(4)}` +
    ` | tokens: ${inputTokens} in + ${outputTokens} out`,
  );

  // ── D-15 metadata: only emit prompt_version when supplied ──────────────
  const metadata = args.promptVersion
    ? { prompt_version: args.promptVersion }
    : null;

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
    metadata,
  });

  if (error) {
    console.warn(`[Pipeline] cost-log failed for ${args.action}:`, error.message);
  }
}
