/**
 * CriaLook Campaign Pipeline v7 — Hybrid (Gemini + Sonnet)
 *
 * Fluxo híbrido otimizado:
 * 1. Gemini 3.1 Pro — Análise visual + scene/styling prompt (visão superior)
 * 2. EM PARALELO:
 *    a) Gemini 3 Pro Image — 1 chamada VTO (foto única universal)
 *    b) Claude Sonnet 4.6 — Copy premium em PT-BR (dicas de postagem)
 *
 * Cada modelo faz o que faz melhor:
 * - Gemini = visão multimodal + prompts de imagem (mesma família do VTO)
 * - Sonnet = copy PT-BR natural, persuasivo e que respeita constraints
 */

import type { GeminiAnalise } from "./gemini-analyzer";
import { analyzeWithGemini, ANALYZER_PROMPT_VERSION } from "./gemini-analyzer";
import type { GeneratedImage } from "./gemini-vto-generator";
import { generateWithGeminiVTO } from "./gemini-vto-generator";
import type { SonnetDicasPostagem } from "./sonnet-copywriter";
import { generateCopyWithSonnet, sonnetPromptVersionFor } from "./sonnet-copywriter";
import {
  getStreakBlockedPose,
  updatePoseHistory,
  validatePoseIndex,
} from "./identity-translations";

// ═══════════════════════════════════════
// Tipos públicos
// ═══════════════════════════════════════

// ModelInfo agora vive em identity-translations.ts (fonte única, usada por
// analyzer + VTO). Re-exportado aqui pra preservar compatibilidade com
// qualquer caller externo que ainda importe `ModelInfo` deste módulo.
export type { ModelInfo } from "./identity-translations";
import type { ModelInfo } from "./identity-translations";

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
  /**
   * Locale do app que disparou a geração — controla o idioma do copy
   * gerado pelo Sonnet. Default `pt-BR` mantém compatibilidade com chamadas
   * antigas (dashboard web, curl, jobs internos).
   */
  targetLocale?: "pt-BR" | "en";
  /** Controle e tracking */
  storeId?: string;
  campaignId?: string;
  signal?: AbortSignal;

  /**
   * @deprecated Foto única é universal — sempre 1 imagem.
   *
   * Param mantido só por compat com chamadas legadas do route.ts (até o
   * agente de pricing/trial limpar o `isTrialOnly ? 1 : 3` lá). Qualquer
   * valor passado é IGNORADO. Pode remover quando route.ts parar de passar.
   */
  photoCount?: number;
}

export interface PipelineResult {
  analise: GeminiAnalise;
  vto_hints: { scene_prompts: string[]; aspect_ratio: string; category: string };
  dicas_postagem: SonnetDicasPostagem;
  /** Array de 1 — null significa que a imagem falhou */
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

  // — Histórico de poses recentes da loja (anti-monotonia entre campanhas) —
  // Lê stores.recent_pose_indices (cap = POSE_HISTORY_CAP = 3). Não bloqueia
  // poses individuais — só detecta streak: se as últimas 3 campanhas usaram
  // a MESMA pose, força o Analyzer a escolher outra. Caso contrário, o
  // Analyzer escolhe livre entre as 8 poses do banco.
  let recentPoseHistory: number[] = [];
  if (input.storeId) {
    try {
      const { createAdminClient } = await import("@/lib/supabase/admin");
      const supabase = createAdminClient();
      const { data: store } = await supabase
        .from("stores")
        .select("recent_pose_indices")
        .eq("id", input.storeId)
        .single();
      recentPoseHistory = (store?.recent_pose_indices as number[] | null) ?? [];
    } catch (e) {
      console.warn("[Pipeline] failed to fetch pose history (continuing without):", e);
    }
  }
  const blockedPoseIndex = getStreakBlockedPose(recentPoseHistory);

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
    blockedPoseIndex,
  });
  const analyzerDurationMs = Date.now() - analyzerStart;

  // Valida o pose_index retornado (range + respeita streak block). Não
  // derruba a campanha se inválido — Gemini já gerou, adiantar pro VTO.
  // Mas loga pra acompanhar taxa de violação no admin.
  const poseValidationErrors = validatePoseIndex(
    analyzerResult.vto_hints.pose_index,
    blockedPoseIndex,
  );
  if (poseValidationErrors.length > 0) {
    console.warn(
      "[Pipeline] ⚠️ pose_index violou regras:",
      poseValidationErrors,
      "index=",
      analyzerResult.vto_hints.pose_index,
      "blocked=",
      blockedPoseIndex,
    );
  }

  // Log de custo do Gemini Analyzer (fire-and-forget)
  if (input.storeId) {
    logAnalyzerCost(
      input.storeId,
      input.campaignId,
      analyzerDurationMs,
      analyzerResult._usageMetadata?.promptTokenCount,
      analyzerResult._usageMetadata?.candidatesTokenCount,
      ANALYZER_PROMPT_VERSION,
    ).catch((e) =>
      console.warn("[Pipeline] Erro ao salvar custo Analyzer:", e)
    );
  }

  // NOTA: step name "sonnet_done" mantido para compatibilidade com o frontend
  await onProgress?.("sonnet_done", "Análise completa! Criando looks + copy...", 30);

  // — Etapa 2: Em PARALELO: VTO (Gemini) + Copy (Sonnet) ————
  await onProgress?.("prompts_ready", "Montando editorial + escrevendo copy...", 40);

  // Single-image flow: progresso vai direto pra 85% quando a imagem termina
  // (não há mais granularidade de 3 fotos pra mostrar).
  const imageProgressEnd = 85;

  const isMale = input.modelInfo?.gender === 'masculino' || input.modelInfo?.gender === 'male' || input.modelInfo?.gender === 'm';

  // Sonnet Copy — roda em paralelo com VTO (análise visual autônoma da foto)
  const sonnetLocale: "pt-BR" | "en" = input.targetLocale ?? "pt-BR";
  const copyPromise = generateCopyWithSonnet({
    price: input.price,
    storeName: input.storeName,
    productImageBase64: input.imageBase64,
    productMediaType: input.mediaType,
    targetAudience: input.targetAudience,
    toneOverride: input.toneOverride,
    targetLocale: sonnetLocale,
  }).then((copyResult) => {
    // Log custo Sonnet (fire-and-forget)
    if (input.storeId) {
      logSonnetCost(
        input.storeId,
        input.campaignId,
        Date.now() - startTime,
        copyResult._usageMetadata?.inputTokens,
        copyResult._usageMetadata?.outputTokens,
        sonnetPromptVersionFor(sonnetLocale),
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
        sequencia_sugerida: "Poste a foto principal no feed e use o carrossel pra mostrar detalhes da peça",
        caption_sugerida: "✨ Novidade que vai te surpreender! Confira e me conta o que achou 💕",
        caption_alternativa: "Elegância e atitude em cada detalhe. Para quem sabe o que quer ✨",
        tom_legenda: "Descontraído e acolhedor",
        cta: "Manda QUERO no direct 💬",
        dica_extra: "Combine a foto com close-up da peça pra valorizar o caimento e os detalhes.",
        story_idea: "Faça uma enquete no story: 'Comprariam essa peça?' — interação simples puxa engajamento.",
        hashtags: isMale ? ["modamasculina", "lookdodia", "novidade", "tendencia", "estilo"] : ["modafeminina", "lookdodia", "novidade", "tendencia", "estilo"],
        legendas: [
          { foto: 1, plataforma: "Instagram Feed", legenda: "✨ Novidade que vai te surpreender! Confira 💕" },
          { foto: 2, plataforma: "WhatsApp", legenda: "Chegou novidade! Manda um oi que eu te conto tudo 😍" },
          { foto: 3, plataforma: "Stories", legenda: "Qual é a sua vibe? Vote aqui! 🔥" },
        ],
      } as SonnetDicasPostagem,
      _usageMetadata: undefined,
    };
  });

  // Foto única universal — não há mais slicing nem photoCount variável.
  // Param `input.photoCount` é ignorado por compat (ver doc no PipelineInput).
  const stylingPrompt = analyzerResult.vto_hints.scene_prompts[0];

  // VTO Image — roda em paralelo com Sonnet
  const imagePromise = generateWithGeminiVTO({
    stylingPrompt,
    productImageBase64: input.imageBase64,
    productMediaType: input.mediaType,
    modelImageBase64: input.modelImageBase64,
    modelMediaType: input.modelMediaType,
    bodyType: input.bodyType === "plus" ? "plus" : "normal",
    aspectRatio: analyzerResult.vto_hints.aspect_ratio,
    gender: input.modelInfo?.gender,
    // modelInfo completo → buildIdentityLock() no VTO gera o bloco de
    // hair color (com hex), texture, length, skin, age. Sem isso, cai no
    // fallback genérico ("preserve from IMAGE 1") que aluciona mais.
    modelInfo: input.modelInfo,
    storeId: input.storeId,
    campaignId: input.campaignId,
    onImageComplete: async (success) => {
      const emoji = success ? "✅" : "⚠️";
      const label = `Foto ${emoji} — finalizando!`;
      await onProgress?.("image_0_done", label, imageProgressEnd);
    },
  });

  // Esperar ambos terminarem
  const [copyResult, imageResult] = await Promise.all([copyPromise, imagePromise]);

  // Atualiza histórico de poses se VTO produziu a imagem com sucesso.
  // Fire-and-forget — falhar aqui não derruba a campanha (na próxima geração
  // o histórico se auto-corrige).
  if (input.storeId && imageResult.successCount > 0) {
    void (async () => {
      try {
        const { createAdminClient } = await import("@/lib/supabase/admin");
        const supabase = createAdminClient();
        const usedIndex = analyzerResult.vto_hints.pose_index;
        const updated = updatePoseHistory(recentPoseHistory, usedIndex);
        await supabase
          .from("stores")
          .update({ recent_pose_indices: updated })
          .eq("id", input.storeId);
      } catch (e) {
        console.warn("[Pipeline] failed to update pose history:", e);
      }
    })();
  }

  await onProgress?.("saving", "Salvando resultados...", 92);
  await onProgress?.("done", "Pronto!", 100);

  const durationMs = Date.now() - startTime;
  console.log(
    `[Pipeline v7] ✅ Concluído em ${durationMs}ms | ${imageResult.successCount}/1 imagem | peça: ${analyzerResult.analise.tipo_peca} | copy: Sonnet`
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
  realInputTokens: number | undefined,
  realOutputTokens: number | undefined,
  promptVersion: string,
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
    metadata: { prompt_version: promptVersion },
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
  realInputTokens: number | undefined,
  realOutputTokens: number | undefined,
  promptVersion: string,
) {
  const { createAdminClient } = await import("@/lib/supabase/admin");
  const supabase = createAdminClient();

  let exchangeRate = 5.8;
  let modelPrice = { inputPerMTok: 3.00, outputPerMTok: 15.00 }; // Sonnet 4.6

  try {
    const { getExchangeRate, getModelPricing } = await import("@/lib/pricing");
    exchangeRate = await getExchangeRate();
    const pricing = await getModelPricing();
    if (pricing["claude-sonnet-4-6"]) {
      modelPrice = pricing["claude-sonnet-4-6"];
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
    model_used: "claude-sonnet-4-6",
    action: "sonnet_copywriter",
    cost_usd: costUsd,
    cost_brl: costUsd * exchangeRate,
    exchange_rate: exchangeRate,
    input_tokens: inputTokens,
    output_tokens: outputTokens,
    tokens_used: inputTokens + outputTokens,
    response_time_ms: responseTimeMs,
    metadata: { prompt_version: promptVersion },
  });

  if (error) {
    console.warn("[Pipeline] ⚠️ Falha ao logar custo Sonnet:", error.message);
  }
}
