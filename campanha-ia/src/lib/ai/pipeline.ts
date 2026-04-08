/**
 * CriaLook Campaign Pipeline v3
 *
 * Novo fluxo simplificado de 2 etapas:
 * 1. Claude Opus — Análise visual profunda + 3 prompts + dicas de postagem
 * 2. Gemini Image — 3 chamadas INDEPENDENTES em paralelo
 *
 * Substitui o pipeline v2.1 (Vision → Strategy → Copywriter → Scorer → Konva).
 */

import type { OpusAnalise, OpusDicasPostagem, OpusPrompt } from "./opus-analyzer";
import { analyzeWithOpus } from "./opus-analyzer";
import type { GeneratedImage } from "./image-generator";
import { generateImages } from "./image-generator";

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
  /** Informações de contexto para o Opus */
  price?: string;
  storeName?: string;
  bodyType?: "normal" | "plus";
  backgroundType?: string;
  /** Cor da marca da loja (hex) */
  brandColor?: string;
  /** Campos legados — mantidos para não quebrar a route, mas não usados pelo v3 */
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
  analise: OpusAnalise;
  prompts: [OpusPrompt, OpusPrompt, OpusPrompt];
  dicas_postagem: OpusDicasPostagem;
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

  // — Etapa 1: Opus analisa o produto ——————————————————————
  await onProgress?.("opus", "Analisando fotos do produto...", 8);

  const opusStart = Date.now();
  const opusResult = await analyzeWithOpus({
    productImageBase64: input.imageBase64,
    productMediaType: input.mediaType as any,
    extraImages: input.extraImages as any,
    price: input.price,
    storeName: input.storeName,
    bodyType: (input.bodyType === "plus" ? "plus" : "normal"),
    backgroundType: input.backgroundType,
    brandColor: input.brandColor,
  });
  const opusDurationMs = Date.now() - opusStart;

  // Log de custo do Opus (fire-and-forget)
  if (input.storeId) {
    logOpusCost(input.storeId, input.campaignId, opusDurationMs).catch((e) =>
      console.warn("[Pipeline] Erro ao salvar custo Opus:", e)
    );
  }

  await onProgress?.("opus_done", "Análise completa! Criando prompts...", 30);

  // — Etapa 2: Gemini gera 3 imagens em paralelo ————————————
  await onProgress?.("images_start", "Gerando foto 1 com IA...", 45);

  const imageResult = await generateImages({
    prompts: opusResult.prompts,
    productImageBase64: input.imageBase64,
    productMediaType: input.mediaType,
    extraImages: input.extraImages as any,
    modelImageBase64: input.modelImageBase64,
    modelMediaType: input.modelMediaType,
    bodyType: input.bodyType === "plus" ? "plus" : "normal",
    storeId: input.storeId,
    campaignId: input.campaignId,
  });

  await onProgress?.("saving", "Salvando resultados...", 92);
  await onProgress?.("done", "Pronto!", 100);

  const durationMs = Date.now() - startTime;
  console.log(
    `[Pipeline v3] ✅ Concluído em ${durationMs}ms | ${imageResult.successCount}/3 imagens | peça: ${opusResult.analise.tipo_peca}`
  );

  return {
    analise: opusResult.analise,
    prompts: opusResult.prompts,
    dicas_postagem: opusResult.dicas_postagem,
    images: imageResult.images,
    successCount: imageResult.successCount,
    durationMs,
  };
}

// ═══════════════════════════════════════
// Log de custo do Opus
// Pricing claude-opus-4-6: $15 / 1M input, $75 / 1M output
// Imagem ~1600 tokens, prompt ~1000 tokens, resposta ~5000 tokens
// Estimativa conservadora por chamada: ~$0.48 (6.6K in + 5.2K out)
// ═══════════════════════════════════════

async function logOpusCost(
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

  // Estimativa baseada nos logs médios: input=6700, output=5200
  const avgInputTokens = 6700;
  const avgOutputTokens = 5200;
  const costUsd =
    (avgInputTokens / 1_000_000) * 15 + (avgOutputTokens / 1_000_000) * 75;

  const { error } = await supabase.from("api_cost_logs").insert({
    store_id: storeId,
    campaign_id: campaignId || null,
    provider: "anthropic",
    model_used: "claude-opus-4-6",
    action: "opus_analyzer",
    cost_usd: costUsd,
    cost_brl: costUsd * exchangeRate,
    exchange_rate: exchangeRate,
    tokens_used: avgInputTokens + avgOutputTokens,
    response_time_ms: responseTimeMs,
  });

  if (error) {
    console.warn("[Pipeline] ⚠️ Falha ao logar custo Opus:", error.message);
  }
}

