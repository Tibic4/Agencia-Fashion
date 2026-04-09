/**
 * CriaLook Campaign Pipeline v5
 *
 * Fluxo:
 * 1. Claude Sonnet — Análise visual + scene/styling prompts + dicas de postagem
 * 2. Gemini 3.1 Flash Image — 3 chamadas VTO em paralelo (multi-image fusion)
 *
 * Contexto rico: dados da modelo (skin_tone, body_type, hair, etc.) e
 * cenário preferido são passados ao Sonnet para prompts ultra-detalhados.
 */

import type { SonnetAnalise, SonnetDicasPostagem, SonnetVTOHint } from "./sonnet-analyzer";
import { analyzeWithSonnet } from "./sonnet-analyzer";
import type { GeneratedImage } from "./gemini-vto-generator";
import { generateWithGeminiVTO } from "./gemini-vto-generator";

// ═══════════════════════════════════════
// Tipos públicos
// ═══════════════════════════════════════

export interface ModelInfo {
  skinTone?: string;
  bodyType?: string;
  pose?: string;
  hairColor?: string;
  hairTexture?: string;
  hairLength?: string;
  ageRange?: string;
  style?: string;
}

export interface PipelineInput {
  /** Foto principal do produto (base64, sem prefixo data:) */
  imageBase64: string;
  mediaType?: "image/jpeg" | "image/png" | "image/webp" | "image/gif";
  /** Extras: close-up, segunda peça */
  extraImages?: { base64: string; mediaType?: "image/jpeg" | "image/png" | "image/webp" | "image/gif" }[];
  /** Foto da modelo do banco (base64) — obrigatória */
  modelImageBase64: string;
  modelMediaType?: string;
  /** Metadados da modelo (para prompts contextuais) */
  modelInfo?: ModelInfo;
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
  vto_hints: SonnetVTOHint;
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
    modelInfo: input.modelInfo,
  });
  const sonnetDurationMs = Date.now() - sonnetStart;

  // Log de custo do Sonnet (fire-and-forget)
  if (input.storeId) {
    logSonnetCost(input.storeId, input.campaignId, sonnetDurationMs).catch((e) =>
      console.warn("[Pipeline] Erro ao salvar custo Sonnet:", e)
    );
  }

  await onProgress?.("sonnet_done", "Análise completa! Criando looks...", 30);

  // — Etapa 2: Gemini VTO gera 3 imagens em paralelo ————
  await onProgress?.("prompts_ready", "Montando editoriais de moda...", 40);

  // Track per-image completion for granular progress (45→55→68→80%)
  let imagesCompleted = 0;
  const imageProgressBase = 45;  // starting progress
  const imageProgressEnd = 85;   // ending progress after all images
  const imageProgressPerImage = (imageProgressEnd - imageProgressBase) / 3; // ~13.3% each

  const imageResult = await generateWithGeminiVTO({
    stylingPrompts: sonnetResult.vto_hints.scene_prompts,
    productImageBase64: input.imageBase64,
    productMediaType: input.mediaType,
    modelImageBase64: input.modelImageBase64,
    modelMediaType: input.modelMediaType,
    bodyType: input.bodyType === "plus" ? "plus" : "normal",
    aspectRatio: sonnetResult.vto_hints.aspect_ratio,
    storeId: input.storeId,
    campaignId: input.campaignId,
    onImageComplete: async (index, success) => {
      imagesCompleted++;
      const progressNow = Math.round(imageProgressBase + (imagesCompleted * imageProgressPerImage));
      const emoji = success ? "✅" : "⚠️";
      const label = `Foto ${imagesCompleted}/3 ${emoji} ${imagesCompleted < 3 ? "— próxima saindo..." : "— finalizando!"}`;
      await onProgress?.(`image_${index}_done`, label, progressNow);
    },
  });

  await onProgress?.("saving", "Salvando resultados...", 92);
  await onProgress?.("done", "Pronto!", 100);

  const durationMs = Date.now() - startTime;
  console.log(
    `[Pipeline v5] ✅ Concluído em ${durationMs}ms | ${imageResult.successCount}/3 imagens | peça: ${sonnetResult.analise.tipo_peca}`
  );

  return {
    analise: sonnetResult.analise,
    vto_hints: sonnetResult.vto_hints,
    dicas_postagem: sonnetResult.dicas_postagem,
    images: imageResult.images,
    successCount: imageResult.successCount,
    durationMs,
  };
}

// ═══════════════════════════════════════
// Log de custo do Sonnet
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
