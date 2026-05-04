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
  /**
   * D-01 (Phase 02): true when image arm succeeded but with fewer photos
   * than requested (partial). UI may render an "Algumas variações não ficaram
   * prontas" badge. With single-image flow today this is rarely true; reserved
   * for the 3-photo restoration in M2.
   */
  partial_delivery?: boolean;
  /**
   * D-02 (Phase 02): true when copy arm rejected and we returned the
   * fallback dicas_postagem instead. Caller may surface a Sentry warn or a
   * "copy gerada com modelo de fallback" UI hint.
   */
  copy_fallback_used?: boolean;
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

  // D-07/D-08 (Phase 02 H-2): aggressive cancel — bail before any work if
  // the client already disconnected. The route.ts IIFE owns the
  // logDisconnectAndExit; pipeline only signals via thrown CLIENT_DISCONNECTED.
  if (input.signal?.aborted) {
    const ab: Error & { code?: string } = new Error("client_disconnected");
    ab.code = "CLIENT_DISCONNECTED";
    throw ab;
  }

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
  // analyzer doesn't support image/gif (we never accept gif on the input side
  // anyway — route gates to jpeg/png/webp). Coerce gif→jpeg defensively.
  const analyzerMediaType: "image/jpeg" | "image/png" | "image/webp" =
    input.mediaType === "image/png" || input.mediaType === "image/webp"
      ? input.mediaType
      : "image/jpeg";
  const analyzerResult = await analyzeWithGemini({
    productImageBase64: input.imageBase64,
    productMediaType: analyzerMediaType,
    extraImages: input.extraImages,
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

  // D-07 (Phase 02): second checkpoint — between analyzer and VTO/Sonnet.
  // Gemini SDK has no native cancel (D-08), so we sink-cost the analyzer call
  // that just completed but skip the more expensive VTO + Sonnet round.
  if (input.signal?.aborted) {
    const ab: Error & { code?: string } = new Error("client_disconnected");
    ab.code = "CLIENT_DISCONNECTED";
    throw ab;
  }

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
    // D-18 (Phase 02) follow-up from Plan 02-03: thread dryRun so the
    // VTO cost-log write is gated identically to analyzer + sonnet.
    // Coherent dryRun semantics across all 4 cost-log sites.
    dryRun: input.dryRun,
    onImageComplete: async (success) => {
      const emoji = success ? "✅" : "⚠️";
      const label = `Foto ${emoji} — finalizando!`;
      await onProgress?.("image_0_done", label, imageProgressEnd);
    },
  });

  // D-01..D-03 (Phase 02 H-1): Promise.allSettled with explicit per-arm fallback.
  //
  // Contracts:
  //   D-01 image partial (some VTO ok, Sonnet ok) → return ≥1 photo + copy + UX flag partial_delivery. Charge proportional (route owns charge).
  //   D-02 sonnet fail (image ok)                  → return photos + minimal fallback caption + copy_fallback_used=true.
  //                                                  (The .catch() inside copyPromise already returns a fallback object — allSettled just lets us flag it explicitly.)
  //   D-03 all-image fail / image arm rejects      → throw with code='ALL_VTO_FAILED' so route.ts refund branch fires.
  //
  // Aggressive cancel (D-07): if request.signal already aborted by the time
  // both arms resolve, surface a synthetic AbortError so the route.ts
  // disconnect handler short-circuits the post-pipeline writes.
  if (input.signal?.aborted) {
    const ab: Error & { code?: string } = new Error("client_disconnected");
    ab.code = "CLIENT_DISCONNECTED";
    throw ab;
  }

  const [copyOutcome, imageOutcome] = await Promise.allSettled([copyPromise, imagePromise]);

  // Image arm — primary value
  let imageResult: Awaited<ReturnType<typeof generateWithGeminiVTO>>;
  const partialDelivery = false;
  if (imageOutcome.status === "fulfilled") {
    imageResult = imageOutcome.value;
    if (imageResult.successCount === 0) {
      // D-03: every VTO call failed — escalate so route.ts refund fires.
      // (route.ts also checks successCount === 0 below; this throw is the
      // belt-and-braces path for callers that don't read successCount.)
      const err: Error & { code?: string } = new Error("All VTO calls failed");
      err.code = "ALL_VTO_FAILED";
      throw err;
    }
    // Single-image flow today — partial_delivery only relevant for future 3-photo restoration.
  } else {
    // imageOutcome.status === "rejected" — same as all-fail
    const reason = imageOutcome.reason;
    const err: Error & { code?: string } = new Error(
      `Image generation failed: ${reason instanceof Error ? reason.message : String(reason)}`,
    );
    err.code = "ALL_VTO_FAILED";
    throw err;
  }

  // Copy arm — fallback to minimal copy on fail (D-02). The .catch() inside
  // copyPromise already absorbs failures and returns a fallback object, so
  // copyOutcome.status === "rejected" should be unreachable in practice. We
  // keep the branch for defense-in-depth in case the .catch is removed later.
  let copyResult;
  let copyFallbackUsed = false;
  if (copyOutcome.status === "fulfilled") {
    copyResult = copyOutcome.value;
    // Heuristic: the existing .catch returns an object whose
    // dicas_postagem.caption_sugerida starts with "✨ Novidade que vai te
    // surpreender!" — flag it so the route can emit a warn-level Sentry event.
    if (
      copyResult.dicas_postagem.caption_sugerida ===
      "✨ Novidade que vai te surpreender! Confira e me conta o que achou 💕"
    ) {
      copyFallbackUsed = true;
    }
  } else {
    // Belt-and-braces — should not be reached because copyPromise has its own .catch.
    copyFallbackUsed = true;
    copyResult = {
      dicas_postagem: {
        melhor_dia: "Terça",
        melhor_horario: "21h",
        sequencia_sugerida: "Feed → Story",
        caption_sugerida: "Sua campanha está pronta!",
        caption_alternativa: "Confira agora",
        tom_legenda: "Neutro",
        cta: "Confira agora",
        dica_extra: "",
        story_idea: "",
        hashtags: ["novacolecao", "moda", "estilo"],
        legendas: [
          { foto: 1, plataforma: "Instagram Feed", legenda: "Sua campanha está pronta!" },
          { foto: 2, plataforma: "WhatsApp", legenda: "Confira agora!" },
          { foto: 3, plataforma: "Stories", legenda: "Novidade!" },
        ],
      } as SonnetDicasPostagem,
      _usageMetadata: undefined,
    };
  }

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
      const judgeEventData = {
        campaignId: input.campaignId,
        storeId: input.storeId,
        copyText: copyResult.dicas_postagem.caption_sugerida,
        productImageUrl: "",
        modelImageUrl: "",
        generatedImageUrl,
        prompt_version: sonnetVersion,
      };

      // H-13 / D-15 (Phase 02): producer-side judge_pending tracking.
      // Set judge_pending=true and persist judge_payload BEFORE the Inngest
      // dispatch so the D-16 reconcile cron can re-emit if Inngest is down
      // or the function fails terminally.
      //
      // FORWARD-COMPAT: if migration 20260503_190000_*.sql isn't applied yet,
      // this UPDATE fails. Catch + log + continue — observability infra
      // shouldn't block the user's response.
      try {
        const { createAdminClient: createAdminPending } = await import("@/lib/supabase/admin");
        const sbPending = createAdminPending();
        const { error: pendingErr } = await sbPending
          .from("campaigns")
          .update({
            judge_pending: true,
            judge_payload: judgeEventData,
            judge_retry_count: 0,
            judge_last_attempt: null,
          })
          .eq("id", input.campaignId);
        if (pendingErr) {
          // Migration probably not applied yet — log and continue.
          const { captureError: captureErrPending } = await import("@/lib/observability");
          captureErrPending(pendingErr, {
            route: "pipeline",
            step: "judge_pending_write",
            campaign_id: input.campaignId,
            forward_compat: true,
          });
        }
      } catch (pendingExc) {
        const { captureError: captureErrExc } = await import("@/lib/observability");
        captureErrExc(pendingExc, {
          route: "pipeline",
          step: "judge_pending_write",
          campaign_id: input.campaignId,
          forward_compat: true,
        });
      }

      void inngest
        .send({
          name: "campaign/judge.requested",
          data: judgeEventData,
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
    partial_delivery: partialDelivery,
    copy_fallback_used: copyFallbackUsed,
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
