/**
 * Abstração de LLM Provider — permite trocar Claude/Gemini por step.
 * Cada provider implementa esta interface.
 */

import type { z } from "zod";

// ═══════════════════════════════════════
// Request / Response
// ═══════════════════════════════════════

export interface LLMRequest {
  /** System prompt (persona + instruções) */
  system: string;
  /** Mensagem do usuário (texto ou multimodal) */
  messages: LLMMessage[];
  /** Temperatura (0-1) */
  temperature?: number;
  /** Máximo de tokens na resposta */
  maxTokens?: number;
  /** Zod schema para structured output (Gemini usa nativo, Claude ignora) */
  responseSchema?: z.ZodSchema;
}

export interface LLMVisionRequest extends LLMRequest {
  /** Imagem principal em base64 */
  imageBase64: string;
  /** MIME type da imagem principal */
  mediaType?: "image/jpeg" | "image/png" | "image/webp" | "image/gif";
  /** Imagens extras (close-up, etc.) */
  extraImages?: { base64: string; mediaType?: "image/jpeg" | "image/png" | "image/webp" | "image/gif" }[];
}

export interface LLMMessage {
  role: "user" | "assistant";
  content: string;
}

export interface LLMResponse {
  /** Texto bruto da resposta */
  text: string;
  /** Tokens consumidos (para cálculo de custo real) */
  usage: {
    inputTokens: number;
    outputTokens: number;
  };
  /** Provider que gerou a resposta */
  provider: "anthropic" | "google";
  /** Modelo usado */
  model: string;
}

// ═══════════════════════════════════════
// Provider interface
// ═══════════════════════════════════════

export interface LLMProvider {
  readonly name: "anthropic" | "google";

  /** Chamada de texto (Strategy, Copywriter, Refiner, Scorer) */
  generate(request: LLMRequest): Promise<LLMResponse>;

  /** Chamada com visão/imagem (Vision step) */
  generateWithVision(request: LLMVisionRequest): Promise<LLMResponse>;
}

// ═══════════════════════════════════════
// Pricing (USD per million tokens)
// ═══════════════════════════════════════
// NOTA: Preços dinâmicos vivem em admin_settings (via @/lib/pricing).
// O fallback abaixo é usado pelo pipeline síncrono (calculateCostBrl).
// Para custo dinâmico assíncrono, use calculateCostBrlDynamic de @/lib/pricing.

export interface ModelPricing {
  inputPerMTok: number;
  outputPerMTok: number;
}

export const MODEL_PRICING: Record<string, ModelPricing> = {
  // Gemini Legacy
  "gemini-2.5-flash": { inputPerMTok: 0.30, outputPerMTok: 2.50 },
  "gemini-2.5-pro": { inputPerMTok: 1.25, outputPerMTok: 10.00 },
  // Gemini 3 (preços oficiais abril/2026)
  "gemini-3-flash-preview": { inputPerMTok: 0.50, outputPerMTok: 3.00 },
  "gemini-3.1-flash-lite-preview": { inputPerMTok: 0.20, outputPerMTok: 1.00 },
  "gemini-3.1-pro-preview": { inputPerMTok: 2.00, outputPerMTok: 12.00 },
  "gemini-3.1-flash-image-preview": { inputPerMTok: 0.50, outputPerMTok: 3.00 },
  "gemini-3-pro-image-preview": { inputPerMTok: 1.25, outputPerMTok: 10.00 },
  // Claude
  "claude-sonnet-4-6": { inputPerMTok: 3.00, outputPerMTok: 15.00 },
  "claude-sonnet-4-20250514": { inputPerMTok: 3.00, outputPerMTok: 15.00 },
  "claude-haiku-4-20250514": { inputPerMTok: 1.00, outputPerMTok: 5.00 },
};

/**
 * Calcula custo real em BRL baseado em tokens consumidos.
 * Versão SÍNCRONA (usa fallback hardcoded). Para preços dinâmicos do banco,
 * use calculateCostBrlDynamic() de @/lib/pricing.
 */
export function calculateCostBrl(
  model: string,
  usage: { inputTokens: number; outputTokens: number },
  exchangeRate?: number,
): number {
  const rate = exchangeRate ?? parseFloat(process.env.USD_BRL_EXCHANGE_RATE || "5.80");
  const pricing = MODEL_PRICING[model];
  if (!pricing) return 0;

  const costUsd =
    (usage.inputTokens * pricing.inputPerMTok) / 1_000_000 +
    (usage.outputTokens * pricing.outputPerMTok) / 1_000_000;

  return costUsd * rate;
}
