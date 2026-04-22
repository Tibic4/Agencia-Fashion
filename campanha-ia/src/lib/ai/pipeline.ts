/**
 * CriaLook Campaign Pipeline v7 — Hybrid (Gemini + Sonnet)
 *
 * Fluxo híbrido otimizado:
 * 1. Gemini 3.1 Pro — Análise visual + scene/styling prompts (visão superior)
 * 2. EM PARALELO:
 *    a) Gemini 3 Pro Image — 3 chamadas VTO (multi-image fusion)
 *    b) Claude Sonnet 4.6 — Copy premium em PT-BR (dicas de postagem)
 *
 * Cada modelo faz o que faz melhor:
 * - Gemini = visão multimodal + prompts de imagem (mesma família do VTO)
 * - Sonnet = copy PT-BR natural, persuasivo e que respeita constraints
 */

import type { GeminiAnalise } from "./gemini-analyzer";
import { analyzeWithGemini } from "./gemini-analyzer";
import type { GeneratedImage } from "./gemini-vto-generator";
import { generateWithGeminiVTO } from "./gemini-vto-generator";
import type { SonnetDicasPostagem } from "./sonnet-copywriter";
import { generateCopyWithSonnet } from "./sonnet-copywriter";

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
  vto_hints: { scene_prompts: [string, string, string]; aspect_ratio: string; category: string };
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

  // — Etapa 1: Gemini 3.1 Pro analisa o produto (visão + VTO prompts) ————
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
  await onProgress?.("sonnet_done", "Análise completa! Criando looks + copy...", 30);

  // — Etapa 2: Em PARALELO: VTO (Gemini) + Copy (Sonnet) ————
  await onProgress?.("prompts_ready", "Montando editoriais + escrevendo copy...", 40);

  // Track per-image completion for granular progress (45→55→68→80%)
  let imagesCompleted = 0;
  const imageProgressBase = 45;  // starting progress
  const imageProgressEnd = 85;   // ending progress after all images
  const imageProgressPerImage = (imageProgressEnd - imageProgressBase) / 3; // ~13.3% each

  // Sonnet Copy — roda em paralelo com VTO (com imagem para identificação visual)
  const copyPromise = generateCopyWithSonnet({
    analise: analyzerResult.analise,
    price: input.price,
    storeName: input.storeName,
    productImageBase64: input.imageBase64,
    productMediaType: input.mediaType,
  }).then((copyResult) => {
    // Log custo Sonnet (fire-and-forget)
    if (input.storeId) {
      logSonnetCost(
        input.storeId,
        input.campaignId,
        Date.now() - startTime,
        copyResult._usageMetadata?.inputTokens,
        copyResult._usageMetadata?.outputTokens,
      ).catch((e) =>
        console.warn("[Pipeline] Erro ao salvar custo Sonnet:", e)
      );
    }
    return copyResult;
  }).catch((err) => {
    console.error("[Pipeline] ❌ Sonnet Copy falhou:", err instanceof Error ? err.message : err);
    // Fallback: dicas genéricas
    return {
      dicas_postagem: {
        melhor_dia: "Terça — público engajado no meio da semana",
        melhor_horario: "21h — quando relaxam e abrem o Instagram",
        sequencia_sugerida: "Use as 3 fotos como carrossel no feed para maximizar engajamento",
        caption_sugerida: "✨ Novidade que vai te surpreender! Confira e me conta o que achou 💕",
        caption_alternativa: "Elegância e atitude em cada detalhe. Para quem sabe o que quer ✨",
        tom_legenda: "Descontraído e acolhedor",
        cta: "Manda QUERO no direct 💬",
        dica_extra: "Poste as 3 fotos como carrossel e peça para seguidores votarem a favorita nos comentários.",
        story_idea: "Faça uma enquete com as 3 fotos: 'Qual é a sua vibe? A, B ou C?' — stories com votação têm 3x mais interação.",
        hashtags: ["modafeminina", "lookdodia", "novidade", "tendencia", "estilo", "moda2026", "fashion", "instafashion", "ootd", "modabrasileira"],
        legendas: [
          { foto: 1, plataforma: "Instagram Feed", legenda: "✨ Novidade que vai te surpreender! Confira 💕" },
          { foto: 2, plataforma: "WhatsApp", legenda: "Chegou novidade! Manda um oi que eu te conto tudo 😍" },
          { foto: 3, plataforma: "Stories", legenda: "Qual é a sua vibe? Vote aqui! 🔥" },
        ],
      } as SonnetDicasPostagem,
      _usageMetadata: undefined,
    };
  });

  // VTO Images — roda em paralelo com Sonnet
  const imagePromise = generateWithGeminiVTO({
    stylingPrompts: analyzerResult.vto_hints.scene_prompts as [string, string, string],
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

  // Esperar ambos terminarem
  const [copyResult, imageResult] = await Promise.all([copyPromise, imagePromise]);

  await onProgress?.("saving", "Salvando resultados...", 92);
  await onProgress?.("done", "Pronto!", 100);

  const durationMs = Date.now() - startTime;
  console.log(
    `[Pipeline v7] ✅ Concluído em ${durationMs}ms | ${imageResult.successCount}/3 imagens | peça: ${analyzerResult.analise.tipo_peca} | copy: Sonnet`
  );

  return {
    analise: analyzerResult.analise,
    vto_hints: analyzerResult.vto_hints,
    dicas_postagem: copyResult.dicas_postagem,
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
  const FALLBACK_INPUT = 4000; // menor sem copy
  const FALLBACK_OUTPUT = 2000; // menor sem copy
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

// ═══════════════════════════════════════
// Log de custo do Sonnet Copywriter
// ═══════════════════════════════════════

async function logSonnetCost(
  storeId: string,
  campaignId: string | undefined,
  responseTimeMs: number,
  realInputTokens?: number,
  realOutputTokens?: number,
) {
  const { createAdminClient } = await import("@/lib/supabase/admin");
  const supabase = createAdminClient();

  let exchangeRate = 5.8;
  let modelPrice = { inputPerMTok: 3.00, outputPerMTok: 15.00 }; // Sonnet 4.6

  try {
    const { getExchangeRate, getModelPricing } = await import("@/lib/pricing");
    exchangeRate = await getExchangeRate();
    const pricing = await getModelPricing();
    if (pricing["claude-sonnet-4-20250514"]) {
      modelPrice = pricing["claude-sonnet-4-20250514"];
    }
  } catch {
    // fallback
  }

  const FALLBACK_INPUT = 2500;
  const FALLBACK_OUTPUT = 800;
  const inputTokens = realInputTokens || FALLBACK_INPUT;
  const outputTokens = realOutputTokens || FALLBACK_OUTPUT;
  const source = realInputTokens ? "real" : "estimated";

  const costUsd =
    (inputTokens * modelPrice.inputPerMTok) / 1_000_000 +
    (outputTokens * modelPrice.outputPerMTok) / 1_000_000;

  console.log(
    `[Pipeline] 💰 Sonnet Copy (${source}): $${costUsd.toFixed(4)} / R$ ${(costUsd * exchangeRate).toFixed(4)}` +
    ` | tokens: ${inputTokens} in + ${outputTokens} out`
  );

  const { error } = await supabase.from("api_cost_logs").insert({
    store_id: storeId,
    campaign_id: campaignId || null,
    provider: "anthropic",
    model_used: "claude-sonnet-4-20250514",
    action: "sonnet_copywriter",
    cost_usd: costUsd,
    cost_brl: costUsd * exchangeRate,
    exchange_rate: exchangeRate,
    input_tokens: inputTokens,
    output_tokens: outputTokens,
    tokens_used: inputTokens + outputTokens,
    response_time_ms: responseTimeMs,
  });

  if (error) {
    console.warn("[Pipeline] ⚠️ Falha ao logar custo Sonnet:", error.message);
  }
}
