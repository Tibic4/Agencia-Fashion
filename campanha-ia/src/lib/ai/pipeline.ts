/**
 * CriaLook Campaign Pipeline v4
 *
 * Fluxo:
 * 1. Claude Sonnet — Análise visual + styling hints + dicas de postagem
 * 2. FASHN AI — 3 chamadas product-to-model em paralelo (Virtual Try-On)
 *
 * Substitui pipeline v3 (Opus + Gemini Image).
 */

import type { SonnetAnalise, SonnetDicasPostagem, SonnetFashnHint } from "./sonnet-analyzer";
import { analyzeWithSonnet } from "./sonnet-analyzer";
import type { GeneratedImage } from "./fashn-generator";
import { generateWithFashn } from "./fashn-generator";

// ═══════════════════════════════════════
// Tipos públicos
// ═══════════════════════════════════════

export interface PipelineInput {
  /** Foto principal do produto (base64, sem prefixo data:) */
  imageBase64: string;
  mediaType?: "image/jpeg" | "image/png" | "image/webp" | "image/gif";
  /** Extras: close-up, segunda peça */
  extraImages?: { base64: string; mediaType?: "image/jpeg" | "image/png" | "image/webp" | "image/gif" }[];
  /** Foto da modelo do banco (base64) — obrigatória */
  modelImageBase64: string;
  modelMediaType?: string;
  /** Informações de contexto para o Sonnet */
  price?: string;
  storeName?: string;
  bodyType?: "normal" | "plus";
  backgroundType?: string;
  /** Cor da marca da loja (hex) */
  brandColor?: string;
  /** Campos legados — mantidos para compatibilidade com a route */
  objective?: string;
  targetAudience?: string;
  toneOverride?: string;
  storeSegment?: string;
  productType?: string;
  material?: string;
  /** Controle e tracking */
  storeId?: string;
  campaignId?: string;
  signal?: AbortSignal;
}

export interface PipelineResult {
  analise: SonnetAnalise;
  fashn_hints: SonnetFashnHint;
  dicas_postagem: SonnetDicasPostagem;
  /** Array de 3 — null significa que aquela imagem falhou */
  images: (GeneratedImage | null)[];
  successCount: number;
  durationMs: number;
}

export type OnProgress = (
  step: string,
  label: string,
  progress: number
) => void | Promise<void>;

// ═══════════════════════════════════════
// Pipeline principal
// ═══════════════════════════════════════

export async function runCampaignPipeline(
  input: PipelineInput,
  onProgress?: OnProgress
): Promise<PipelineResult> {
  const startTime = Date.now();

  // — Etapa 1: Sonnet analisa o produto ——————————————————————
  await onProgress?.("sonnet", "Analisando fotos do produto...", 8);

  const sonnetStart = Date.now();
  const sonnetResult = await analyzeWithSonnet({
    productImageBase64: input.imageBase64,
    productMediaType: input.mediaType as any,
    extraImages: input.extraImages as any,
    price: input.price,
    storeName: input.storeName,
    bodyType: (input.bodyType === "plus" ? "plus" : "normal"),
    backgroundType: input.backgroundType,
    brandColor: input.brandColor,
  });
  const sonnetDurationMs = Date.now() - sonnetStart;

  // Log de custo do Sonnet (fire-and-forget)
  if (input.storeId) {
    logSonnetCost(input.storeId, input.campaignId, sonnetDurationMs).catch((e) =>
      console.warn("[Pipeline] Erro ao salvar custo Sonnet:", e)
    );
  }

  await onProgress?.("sonnet_done", "Análise completa! Gerando looks...", 30);

  // — Etapa 2: FASHN gera 3 imagens em paralelo (Virtual Try-On) ————
  await onProgress?.("images_start", "Vestindo a modelo com IA...", 45);

  const imageResult = await generateWithFashn({
    stylingPrompts: sonnetResult.fashn_hints.styling_prompts,
    productImageBase64: input.imageBase64,
    productMediaType: input.mediaType,
    modelImageBase64: input.modelImageBase64,
    modelMediaType: input.modelMediaType,
    bodyType: input.bodyType === "plus" ? "plus" : "normal",
    aspectRatio: sonnetResult.fashn_hints.aspect_ratio,
    storeId: input.storeId,
    campaignId: input.campaignId,
  });

  await onProgress?.("saving", "Salvando resultados...", 92);
  await onProgress?.("done", "Pronto!", 100);

  const durationMs = Date.now() - startTime;
  console.log(
    `[Pipeline v4] ✅ Concluído em ${durationMs}ms | ${imageResult.successCount}/3 imagens | peça: ${sonnetResult.analise.tipo_peca}`
  );

  return {
    analise: sonnetResult.analise,
    fashn_hints: sonnetResult.fashn_hints,
    dicas_postagem: sonnetResult.dicas_postagem,
    images: imageResult.images,
    successCount: imageResult.successCount,
    durationMs,
  };
}

// ═══════════════════════════════════════
// Log de custo do Sonnet
// Pricing claude-sonnet-4: $3 / 1M input, $15 / 1M output
// Imagem ~1600 tokens, prompt ~800 tokens, resposta ~2500 tokens
// Estimativa por chamada: ~$0.04 (4.4K in + 2.5K out)
// ═══════════════════════════════════════

async function logSonnetCost(
  storeId: string,
  campaignId: string | undefined,
  responseTimeMs: number,
) {
  const { createAdminClient } = await import("@/lib/supabase/admin");
  const supabase = createAdminClient();

  let exchangeRate = 5.8;
  try {
    const { getExchangeRate } = await import("@/lib/pricing");
    exchangeRate = await getExchangeRate();
  } catch {
    // fallback
  }

  // Estimativa: input=4400, output=2500
  const avgInputTokens = 4400;
  const avgOutputTokens = 2500;
  const costUsd =
    (avgInputTokens / 1_000_000) * 3 + (avgOutputTokens / 1_000_000) * 15;

  const { error } = await supabase.from("api_cost_logs").insert({
    store_id: storeId,
    campaign_id: campaignId || null,
    provider: "anthropic",
    model_used: "claude-sonnet-4",
    action: "sonnet_analyzer",
    cost_usd: costUsd,
    cost_brl: costUsd * exchangeRate,
    exchange_rate: exchangeRate,
    tokens_used: avgInputTokens + avgOutputTokens,
    response_time_ms: responseTimeMs,
  });

  if (error) {
    console.warn("[Pipeline] ⚠️ Falha ao logar custo Sonnet:", error.message);
  }
}
