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
import { logModelCost } from "./log-model-cost";
import {
  getStreakBlockedPose,
  updatePoseHistory,
  validatePoseIndex,
} from "./identity-translations";
import { inngest } from "@/lib/inngest/client";

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
   * D-18 (Phase 02 quality-loop): when true, runCampaignPipeline
   *   (a) skips the post-VTO pose-history Supabase update,
   *   (b) skips every logModelCost call (no api_cost_logs row), and
   *   (c) skips the Inngest judge.requested emit (added by Plan 02-03).
   *
   * Used by evals/run.ts to exercise the production pipeline against
   * golden-set entries without polluting production data (cost-log rows,
   * pose-history mutation, or judge-job enqueue). Defaults to false so
   * every existing call site behaves exactly as it did in Phase 01.
   *
   * NOTE: the pre-VTO pose-history READ at the top of the function still
   * runs under dryRun (it's a SELECT — no mutation, useful for the eval
   * to exercise the same pose-blocking logic as production).
   */
  dryRun?: boolean;

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

  // Log de custo do Gemini Analyzer (fire-and-forget — D-18 helper)
  // D-18 (Phase 02): gated behind !input.dryRun so evals/run.ts doesn't
  // pollute api_cost_logs with golden-set runs.
  if (!input.dryRun && input.storeId) {
    logModelCost({
      storeId: input.storeId,
      campaignId: input.campaignId,
      provider: "google",
      model: "gemini-3.1-pro-preview",
      action: "gemini_analyzer",
      usage: {
        inputTokens: analyzerResult._usageMetadata?.promptTokenCount,
        outputTokens: analyzerResult._usageMetadata?.candidatesTokenCount,
      },
      durationMs: analyzerDurationMs,
      promptVersion: ANALYZER_PROMPT_VERSION,
    }).catch((e) =>
      console.warn("[Pipeline] cost-log failed (analyzer):", e?.message ?? e),
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
    // Log custo Sonnet (fire-and-forget — D-18 helper)
    // D-18 (Phase 02): gated behind !input.dryRun so evals/run.ts doesn't
    // pollute api_cost_logs with golden-set runs.
    if (!input.dryRun && input.storeId) {
      logModelCost({
        storeId: input.storeId,
        campaignId: input.campaignId,
        provider: "anthropic",
        model: "claude-sonnet-4-6",
        action: "sonnet_copywriter",
        usage: {
          inputTokens: copyResult._usageMetadata?.inputTokens,
          outputTokens: copyResult._usageMetadata?.outputTokens,
        },
        durationMs: Date.now() - startTime,
        promptVersion: sonnetPromptVersionFor(sonnetLocale),
      }).catch((e) =>
        console.warn("[Pipeline] cost-log failed (sonnet):", e?.message ?? e),
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
  // D-18 (Phase 02): gated behind !input.dryRun so evals/run.ts doesn't
  // mutate stores.recent_pose_indices when exercising the pipeline against
  // golden-set entries.
  if (!input.dryRun && input.storeId && imageResult.successCount > 0) {
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

  // ── D-01 (Phase 02): emit Inngest event so judgeCampaignJob scores this campaign. ──
  // Fire-and-forget — judge runs durably in Inngest with retries: 2 (D-02). Pipeline
  // never awaits or surfaces judge failures to the user. dryRun gate per D-18:
  // evals/run.ts uses dryRun=true to drive the pipeline against golden-set entries
  // without polluting Inngest with eval traffic.
  //
  // Known limitation (Phase 02 scope): productImageUrl + modelImageUrl are empty
  // strings here because pipeline.ts doesn't have public Supabase URLs for those
  // at emit time (it has them as base64 inputs). The judge prompt is robust to
  // missing URLs and scores the text + the VTO generated URL primarily.
  // Phase 03 candidate: move emit to route.ts after savePipelineResultV3 where
  // imageUrls ARE known. Logged in deferred-items.md.
  if (
    !input.dryRun &&
    imageResult.successCount > 0 &&
    input.storeId &&
    input.campaignId
  ) {
    const generatedImageUrl = imageResult.images[0]?.imageUrl;
    if (generatedImageUrl) {
      const sonnetVersion = sonnetPromptVersionFor(input.targetLocale ?? "pt-BR");
      void inngest
        .send({
          name: "campaign/judge.requested",
          data: {
            campaignId: input.campaignId,
            storeId: input.storeId,
            copyText: copyResult.dicas_postagem.caption_sugerida,
            productImageUrl: "",
            modelImageUrl: "",
            generatedImageUrl,
            prompt_version: sonnetVersion,
          },
        })
        .catch((e) =>
          console.warn(
            "[Pipeline] inngest.send judge.requested failed:",
            e instanceof Error ? e.message : e,
          ),
        );
    }
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
// Cost logging — D-18: consolidated into lib/ai/log-model-cost.ts
// ═══════════════════════════════════════
// `logAnalyzerCost` + `logSonnetCost` previously lived here. Both have been
// replaced by direct `logModelCost({...})` calls at the analyzer + Sonnet
// fire-and-forget sites above. See `lib/ai/log-model-cost.ts` for the
// consolidated helper and `lib/pricing/fallbacks.ts` for the fallback
// constants that used to be inline in those functions.
