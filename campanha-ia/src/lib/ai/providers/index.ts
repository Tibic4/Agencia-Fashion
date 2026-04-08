/**
 * Provider Factory — configura qual LLM usar por step do pipeline.
 *
 * Estratégia híbrida:
 * - Vision, Refiner, Scorer → Gemini 2.5 Flash (10x mais barato, structured output)
 * - Strategy → Gemini 2.5 Pro (raciocínio forte, 60% mais barato que Sonnet)
 * - Copywriter → Claude Sonnet 4 (tom brasileiro superior)
 *
 * Fallback: se GOOGLE_AI_API_KEY não existe, usa Claude para tudo.
 */

import type { LLMProvider } from "./types";
import { GeminiProvider } from "./gemini";
import { ClaudeProvider } from "./claude";

export type PipelineStepName = "vision" | "strategy" | "copywriter" | "refiner" | "scorer";

// ═══════════════════════════════════════
// Configuração de providers por step
// ═══════════════════════════════════════

interface StepConfig {
  provider: LLMProvider;
  /** Se true, usa structured output (Gemini responseSchema) */
  structuredOutput: boolean;
}

/** Cache de providers para não recriar */
let _providers: Record<PipelineStepName, StepConfig> | null = null;

/**
 * Retorna o provider configurado para cada step.
 * Lê variáveis de ambiente para override por step.
 */
export function getStepProviders(): Record<PipelineStepName, StepConfig> {
  if (_providers) return _providers;

  const hasGoogleKey = !!process.env.GOOGLE_AI_API_KEY;
  const hasAnthropicKey = !!process.env.ANTHROPIC_API_KEY;

  if (!hasGoogleKey && !hasAnthropicKey) {
    throw new Error("Nenhuma API key configurada (GOOGLE_AI_API_KEY ou ANTHROPIC_API_KEY)");
  }

  // Modelos configuráveis por env
  const geminiFlash = process.env.AI_MODEL_GEMINI_FLASH || "gemini-3-flash-preview";
  const geminiPro = process.env.AI_MODEL_GEMINI_PRO || "gemini-3.1-pro-preview";
  const claudeSonnet = process.env.AI_MODEL_CLAUDE_SONNET || "claude-sonnet-4-20250514";

  if (hasGoogleKey) {
    // Estratégia híbrida (recomendada)
    _providers = {
      vision: {
        provider: new GeminiProvider(process.env.AI_MODEL_VISION || geminiFlash),
        structuredOutput: true,
      },
      strategy: {
        provider: new GeminiProvider(process.env.AI_MODEL_STRATEGY || geminiFlash),
        structuredOutput: true,
      },
      copywriter: {
        // Claude mantido para tom brasileiro — fallback para Gemini Pro se sem key Anthropic
        provider: hasAnthropicKey
          ? new ClaudeProvider(process.env.AI_MODEL_COPYWRITER || claudeSonnet)
          : new GeminiProvider(process.env.AI_MODEL_COPYWRITER || geminiPro),
        structuredOutput: !hasAnthropicKey, // Gemini usa schema, Claude não
      },
      refiner: {
        provider: new GeminiProvider(process.env.AI_MODEL_REFINER || geminiFlash),
        structuredOutput: true,
      },
      scorer: {
        provider: new GeminiProvider(process.env.AI_MODEL_SCORER || "gemini-3.1-flash-lite-preview"),
        structuredOutput: true,
      },
    };
  } else {
    // Fallback: tudo Claude (caso sem Google key)
    _providers = {
      vision: {
        provider: new ClaudeProvider(process.env.AI_MODEL_VISION || claudeSonnet),
        structuredOutput: false,
      },
      strategy: {
        provider: new ClaudeProvider(process.env.AI_MODEL_STRATEGY || claudeSonnet),
        structuredOutput: false,
      },
      copywriter: {
        provider: new ClaudeProvider(process.env.AI_MODEL_COPYWRITER || claudeSonnet),
        structuredOutput: false,
      },
      refiner: {
        provider: new ClaudeProvider(process.env.AI_MODEL_REFINER || claudeSonnet),
        structuredOutput: false,
      },
      scorer: {
        provider: new ClaudeProvider(process.env.AI_MODEL_SCORER || claudeSonnet),
        structuredOutput: false,
      },
    };
  }

  // Log da configuração no startup
  console.log("[AI Providers] Configuração:");
  for (const [step, config] of Object.entries(_providers)) {
    const p = config.provider;
    console.log(`  ${step}: ${p.name} (structured: ${config.structuredOutput})`);
  }

  return _providers;
}

// Re-export para conveniência
export { GeminiProvider } from "./gemini";
export { ClaudeProvider } from "./claude";
export type { LLMProvider, LLMRequest, LLMVisionRequest, LLMResponse } from "./types";
export { calculateCostBrl, MODEL_PRICING } from "./types";
