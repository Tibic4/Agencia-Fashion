/**
 * CriaLook Campaign Pipeline v6
 *
 * Fluxo 100% Google:
 * 1. Gemini 3.1 Pro — Análise visual + scene/styling prompts + dicas de postagem
 * 2. Gemini 3 Pro Image — 3 chamadas VTO em paralelo (multi-image fusion)
 *
 * Contexto rico: dados da modelo (skin_tone, body_type, hair, etc.) e
 * cenário preferido são passados ao Gemini 3.1 Pro para prompts ultra-detalhados.
 */

import type { GeminiAnalise, GeminiDicasPostagem, GeminiVTOHint } from "./gemini-analyzer";
import { analyzeWithGemini, getTexturedBackdropPrompt } from "./gemini-analyzer";
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
  gender?: string;
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
  /** Informações de contexto para o Gemini Analyzer */
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
  analise: GeminiAnalise;
  vto_hints: GeminiVTOHint;
  dicas_postagem: GeminiDicasPostagem;
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

  // — Etapa 1: Gemini 3.1 Pro analisa o produto ————————————————
  // NOTA: step name "sonnet" mantido para compatibilidade com o frontend
  await onProgress?.("sonnet", "Analisando fotos do produto...", 8);

  const analyzerStart = Date.now();
  const analyzerResult = await analyzeWithGemini({
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
  const analyzerDurationMs = Date.now() - analyzerStart;

  // Log de custo do Gemini Analyzer (fire-and-forget)
  if (input.storeId) {
    logAnalyzerCost(
      input.storeId,
      input.campaignId,
      analyzerDurationMs,
      analyzerResult._usageMetadata?.promptTokenCount,
      analyzerResult._usageMetadata?.candidatesTokenCount
    ).catch((e) =>
      console.warn("[Pipeline] Erro ao salvar custo Analyzer:", e)
    );
  }

  // NOTA: step name "sonnet_done" mantido para compatibilidade com o frontend
  await onProgress?.("sonnet_done", "Análise completa! Criando looks...", 30);

  // — Etapa 2: Gemini VTO gera 3 imagens em paralelo ————
  await onProgress?.("prompts_ready", "Montando editoriais de moda...", 40);

  // Track per-image completion for granular progress (45→55→68→80%)
  let imagesCompleted = 0;
  const imageProgressBase = 45;  // starting progress
  const imageProgressEnd = 85;   // ending progress after all images
  const imageProgressPerImage = (imageProgressEnd - imageProgressBase) / 3; // ~13.3% each

  // ── Backdrop injection: PROGRAMMATIC override ──
  // Instead of trusting the AI text model to copy backdrop text identically
  // into all 3 scene_prompts (which fails ~70% of the time), we inject the
  // EXACT SAME backdrop string into each prompt here in the pipeline.
  let finalPrompts = analyzerResult.vto_hints.scene_prompts as [string, string, string];

  if (input.backgroundType === "minha_marca" && input.brandColor) {
    const backdropText = getTexturedBackdropPrompt(input.brandColor);
    console.log(`[Pipeline] 🎨 Injecting programmatic backdrop for ${input.brandColor} into all 3 prompts`);
    finalPrompts = finalPrompts.map(
      (prompt) => `${prompt}\n\n${backdropText}`
    ) as [string, string, string];
  }

  const imageResult = await generateWithGeminiVTO({
    stylingPrompts: finalPrompts,
    productImageBase64: input.imageBase64,
    productMediaType: input.mediaType,
    modelImageBase64: input.modelImageBase64,
    modelMediaType: input.modelMediaType,
    bodyType: input.bodyType === "plus" ? "plus" : "normal",
    aspectRatio: analyzerResult.vto_hints.aspect_ratio,
    gender: input.modelInfo?.gender,
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
    `[Pipeline v6] ✅ Concluído em ${durationMs}ms | ${imageResult.successCount}/3 imagens | peça: ${analyzerResult.analise.tipo_peca}`
  );

  return {
    analise: analyzerResult.analise,
    vto_hints: analyzerResult.vto_hints,
    dicas_postagem: analyzerResult.dicas_postagem,
    images: imageResult.images,
    successCount: imageResult.successCount,
    durationMs,
  };
}

// ═══════════════════════════════════════
// Log de custo do Gemini Analyzer
// ═══════════════════════════════════════

async function logAnalyzerCost(
  storeId: string,
  campaignId: string | undefined,
  responseTimeMs: number,
  realInputTokens?: number,
  realOutputTokens?: number,
) {
  const { createAdminClient } = await import("@/lib/supabase/admin");
  const supabase = createAdminClient();

  let exchangeRate = 5.8;
  let modelPrice = { inputPerMTok: 2.00, outputPerMTok: 12.00 }; // Gemini 3.1 Pro fallback

  try {
    const { getExchangeRate, getModelPricing } = await import("@/lib/pricing");
    exchangeRate = await getExchangeRate();
    const pricing = await getModelPricing();
    if (pricing["gemini-3.1-pro-preview"]) {
      modelPrice = pricing["gemini-3.1-pro-preview"];
    }
  } catch {
    // fallback
  }

  // Usar tokens REAIS da API quando disponíveis
  const FALLBACK_INPUT = 5000;
  const FALLBACK_OUTPUT = 3000;
  const inputTokens = realInputTokens || FALLBACK_INPUT;
  const outputTokens = realOutputTokens || FALLBACK_OUTPUT;
  const source = realInputTokens ? "real" : "estimated";

  const costUsd =
    (inputTokens * modelPrice.inputPerMTok) / 1_000_000 +
    (outputTokens * modelPrice.outputPerMTok) / 1_000_000;

  console.log(
    `[Pipeline] 💰 Analyzer (${source}): $${costUsd.toFixed(4)} / R$ ${(costUsd * exchangeRate).toFixed(4)}` +
    ` | tokens: ${inputTokens} in + ${outputTokens} out`
  );

  const { error } = await supabase.from("api_cost_logs").insert({
    store_id: storeId,
    campaign_id: campaignId || null,
    provider: "google",
    model_used: "gemini-3.1-pro-preview",
    action: "gemini_analyzer",
    cost_usd: costUsd,
    cost_brl: costUsd * exchangeRate,
    exchange_rate: exchangeRate,
    input_tokens: inputTokens,
    output_tokens: outputTokens,
    tokens_used: inputTokens + outputTokens,
    response_time_ms: responseTimeMs,
  });

  if (error) {
    console.warn("[Pipeline] ⚠️ Falha ao logar custo Analyzer:", error.message);
  }
}
