/**
 * Pricing Engine — Custos dinâmicos de API (FinOps)
 *
 * Centraliza:
 * - MODEL_PRICING (LLM tokens) → lido do admin_settings
 * - USD_BRL_EXCHANGE_RATE → atualizado automaticamente via API pública
 *
 * Cache em memória com TTL de 5 min para não bater no banco a cada chamada.
 */

export interface ModelPricing {
  inputPerMTok: number;
  outputPerMTok: number;
}

// ═══════════════════════════════════════
// Cache em memória (TTL 5 min)
// ═══════════════════════════════════════

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutos

let modelPricingCache: CacheEntry<Record<string, ModelPricing>> | null = null;
let exchangeRateCache: CacheEntry<number> | null = null;

// Fallbacks hardcoded (usados se o banco estiver indisponível)
//
// FONTE OFICIAL: https://ai.google.dev/gemini-api/docs/pricing
// Última verificação: 2026-04-11
const FALLBACK_MODEL_PRICING: Record<string, ModelPricing> = {
  // ═══ EM USO (Pipeline v7 — 100% Gemini) ═══
  // Gemini 3.1 Pro — Analisador de peças + Copywriter Pro
  // Gemini 3 Pro Image — Gerador de imagens VTO
  // Google OFICIAL (ai.google.dev/gemini-api/docs/pricing):
  //   Image input  = 560 tokens/img ($0.0011/img)
  //   Image output = $120/MTok, 1120 tokens/img (1K-2K) = $0.134/img
  //   Text  output — também cobrado a $120/MTok neste modelo
  // Validação: campanha (3 imgs) = 3868 out tokens × $120/M + 10125 in × $2/M
  //   = $0.464 + $0.020 = $0.484 (Google cobrou ~$0.505) ✅
  "gemini-3-pro-image-preview": { inputPerMTok: 2.00, outputPerMTok: 120.00 },
  // Gemini 3.1 Flash Image — image output $60/MTok
  "gemini-3.1-flash-image-preview": { inputPerMTok: 0.50, outputPerMTok: 60.00 },
  // Gemini 3.1 Pro — Copywriter Pro (Smart Tips)
  "gemini-3.1-pro-preview": { inputPerMTok: 2.00, outputPerMTok: 12.00 },
  // Gemini 3 Flash — Preview de modelos (legado tips, agora Pro)
  "gemini-3-flash-preview": { inputPerMTok: 0.50, outputPerMTok: 3.00 },

  // ═══ LEGADO (mantidos para cálculo de custo de campanhas antigas) ═══
  "gemini-2.5-flash": { inputPerMTok: 0.30, outputPerMTok: 2.50 },
  "gemini-2.5-pro": { inputPerMTok: 1.25, outputPerMTok: 10.00 },
  "gemini-3.1-flash-lite-preview": { inputPerMTok: 0.20, outputPerMTok: 1.00 },
  "claude-opus-4-6": { inputPerMTok: 15.00, outputPerMTok: 75.00 },
  "claude-sonnet-4-6": { inputPerMTok: 3.00, outputPerMTok: 15.00 },
  "claude-sonnet-4-20250514": { inputPerMTok: 3.00, outputPerMTok: 15.00 },
  "claude-haiku-4-20250514": { inputPerMTok: 1.00, outputPerMTok: 5.00 },
};

const FALLBACK_EXCHANGE_RATE = 5.80;

// ═══════════════════════════════════════
// Leitura do banco (admin_settings)
// ═══════════════════════════════════════

async function getAdminSetting(key: string): Promise<unknown | null> {
  try {
    const { createAdminClient } = await import("@/lib/supabase/admin");
    const supabase = createAdminClient();
    const { data } = await supabase
      .from("admin_settings")
      .select("value")
      .eq("key", key)
      .single();
    return data?.value ?? null;
  } catch {
    return null;
  }
}

// ═══════════════════════════════════════
// Model Pricing (LLM tokens)
// ═══════════════════════════════════════

export async function getModelPricing(): Promise<Record<string, ModelPricing>> {
  if (modelPricingCache && Date.now() < modelPricingCache.expiresAt) {
    return modelPricingCache.data;
  }

  const raw = await getAdminSetting("model_pricing");
  const data = (raw && typeof raw === "object" ? raw : FALLBACK_MODEL_PRICING) as Record<string, ModelPricing>;

  modelPricingCache = { data, expiresAt: Date.now() + CACHE_TTL_MS };
  return data;
}

/**
 * Calcula custo real em BRL baseado em tokens consumidos.
 * Usa pricing dinâmico do banco quando disponível.
 */
export async function calculateCostBrlDynamic(
  model: string,
  usage: { inputTokens: number; outputTokens: number },
): Promise<number> {
  const [pricing, rate] = await Promise.all([
    getModelPricing(),
    getExchangeRate(),
  ]);

  const modelPrice = pricing[model];
  if (!modelPrice) return 0;

  const costUsd =
    (usage.inputTokens * modelPrice.inputPerMTok) / 1_000_000 +
    (usage.outputTokens * modelPrice.outputPerMTok) / 1_000_000;

  return costUsd * rate;
}

// ═══════════════════════════════════════
// Exchange Rate (USD → BRL)
// ═══════════════════════════════════════

export async function getExchangeRate(): Promise<number> {
  if (exchangeRateCache && Date.now() < exchangeRateCache.expiresAt) {
    return exchangeRateCache.data;
  }

  // 1. Tentar ler do admin_settings
  const raw = await getAdminSetting("usd_brl_exchange_rate");
  const data = raw ? parseFloat(String(raw)) : FALLBACK_EXCHANGE_RATE;

  exchangeRateCache = { data, expiresAt: Date.now() + CACHE_TTL_MS };
  return data;
}

/**
 * Atualiza a taxa de câmbio no banco via API pública (AwesomeAPI).
 * Deve ser chamada por um cron/scheduled job diariamente.
 */
export async function refreshExchangeRate(): Promise<{ rate: number; source: string }> {
  try {
    // AwesomeAPI — gratuita, sem auth, dados do Banco Central
    const res = await fetch("https://economia.awesomeapi.com.br/json/last/USD-BRL", {
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) throw new Error(`AwesomeAPI ${res.status}`);

    const data = await res.json();
    const rate = parseFloat(data.USDBRL?.bid || data.USDBRL?.ask);

    if (!rate || rate < 3 || rate > 10) {
      throw new Error(`Rate fora do range esperado: ${rate}`);
    }

    // Salvar no banco
    const { createAdminClient } = await import("@/lib/supabase/admin");
    const supabase = createAdminClient();
    await supabase
      .from("admin_settings")
      .update({ value: rate.toFixed(4), updated_at: new Date().toISOString() })
      .eq("key", "usd_brl_exchange_rate");

    // Invalidar cache
    exchangeRateCache = { data: rate, expiresAt: Date.now() + CACHE_TTL_MS };

    console.log(`[Pricing] 💱 Câmbio atualizado: R$ ${rate.toFixed(4)} (AwesomeAPI)`);
    return { rate, source: "awesomeapi" };
  } catch (e) {
    console.warn("[Pricing] Falha ao atualizar câmbio:", e);
    const fallback = await getExchangeRate();
    return { rate: fallback, source: "cache/fallback" };
  }
}

/**
 * Invalida todos os caches de pricing (útil após edição no admin).
 */
export function invalidatePricingCache() {
  modelPricingCache = null;
  exchangeRateCache = null;
}

