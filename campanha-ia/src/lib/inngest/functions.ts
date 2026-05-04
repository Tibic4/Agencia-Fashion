import { inngest } from "./client";
import { getGoogleGenAI } from "@/lib/ai/clients";
import {
  storageGarbageCollectorCron,
  storageGarbageCollectorManual,
} from "./storage-gc";
import { scoreCampaignQuality, JUDGE_PROMPT_VERSION } from "@/lib/ai/judge";
import { setCampaignScores } from "@/lib/db";
import { logModelCost } from "@/lib/ai/log-model-cost";
import {
  FACE_WRONG_THRESHOLD_PCT,
  FACE_WRONG_WOW_DELTA_PP,
  NIVEL_RISCO_ALTO_THRESHOLD_PCT,
  queryFaceWrongRate,
  queryNivelRiscoAltoRate,
  buildFaceWrongFingerprint,
  buildNivelRiscoAltoFingerprint,
} from "@/lib/quality/alerts";
import { captureSyntheticAlert } from "@/lib/observability";

// NOTE: `generateCampaignJob` (event "campaign/generate.requested") was deleted
// in Phase 01-03 (D-09). Zero producers ever sent that event — generation is
// synchronous via SSE in /api/campaign/generate. The historical pipeline-import
// surface here is intentionally smaller now: the only remaining campaign-side
// import was for that deprecated job.

// ═══════════════════════════════════════════════════════════
// MODEL PREVIEW — Gemini 3.1 Flash Image (provider único)
// ═══════════════════════════════════════════════════════════

interface ModelPreviewEvent {
  modelId: string;
  storeId: string;
  skinTone: string;
  hairStyle: string;
  /** Novos campos granulares de cabelo */
  hairTexture?: string | null;
  hairLength?: string | null;
  hairColor?: string | null;
  /** Se true, replica o cabelo da foto de referência em vez de usar os campos granulares */
  hairFromPhoto?: boolean;
  bodyType: string;
  style: string;
  ageRange: string;
  name: string;
  /** Gênero: feminino | masculino (default feminino) */
  gender?: string;
  /** URL do crop facial no Supabase Storage (leve — evita limite do Inngest) */
  faceRefUrl?: string | null;
}

/**
 * Gera preview de modelo via Gemini 3.1 Flash Image.
 * Custo: ~$0.001/imagem (~R$ 0,006)
 * Retorna URL pública no Supabase Storage ou null se falhar.
 */
async function generatePreviewWithGemini(data: ModelPreviewEvent): Promise<string | null> {
  try {
    const { buildGeminiParts } = await import("@/lib/model-prompts");

    // getGoogleGenAI throws MissingAIKeyError if neither env var is set.
    // Catch and return null so the Inngest job can mark the preview failed
    // without bubbling a hard exception (preserves the original behavior
    // where missing key was a soft warn-and-skip, not a job-killer).
    let ai;
    try {
      ai = getGoogleGenAI();
    } catch (e) {
      console.warn("[Gemini:Preview] GoogleGenAI client unavailable:", e instanceof Error ? e.message : e);
      return null;
    }

    // ── Baixar foto facial se tiver URL ──
    let faceBase64: string | null = null;
    let faceMime = "image/jpeg";
    if (data.faceRefUrl) {
      try {
        const imgRes = await fetch(data.faceRefUrl);
        if (imgRes.ok) {
          const buf = Buffer.from(await imgRes.arrayBuffer());
          faceBase64 = buf.toString("base64");
          faceMime = imgRes.headers.get("content-type") || "image/jpeg";
          console.log(`[Gemini:Preview] 📷 Face ref baixada (${(buf.length / 1024).toFixed(0)}KB)`);
        }
      } catch (e) {
        console.warn("[Gemini:Preview] ⚠️ Falha ao baixar face ref:", e);
      }
    }

    // ── Montar parts via builder centralizado ──
    const mode = faceBase64 ? "multimodal (face ref)" : "text-only";
    const parts = buildGeminiParts(
      {
        skinTone: data.skinTone,
        hairStyle: data.hairStyle,
        hairTexture: data.hairTexture || undefined,
        hairLength: data.hairLength || undefined,
        hairColor: data.hairColor || undefined,
        hairFromPhoto: data.hairFromPhoto || false,
        bodyType: data.bodyType,
        style: data.style,
        ageRange: data.ageRange,
        gender: (data.gender as any) || "feminino",
      },
      faceBase64,
      faceMime,
    );

    console.log(`[Gemini:Preview] 🎨 Gerando via gemini-3.1-flash-image-preview — modo: ${mode}...`);

    const response = await ai.models.generateContent({
      model: "gemini-3.1-flash-image-preview",
      contents: [{ role: "user", parts }],
      config: {
        responseModalities: ["IMAGE", "TEXT"],
        imageConfig: {
          aspectRatio: "3:4",
          imageSize: "2K",
        },
        thinkingConfig: {
          thinkingLevel: "minimal",
          includeThoughts: false,
        },
      } as any,
    });

    // Extrair imagem da resposta
    const responseParts = response.candidates?.[0]?.content?.parts || [];
    const imagePart = responseParts.find((p: any) => p.inlineData?.mimeType?.startsWith("image/"));

    if (!imagePart || !(imagePart as any).inlineData?.data) {
      console.warn("[Gemini:Preview] ⚠️ Nenhuma imagem na resposta");
      return null;
    }

    const imageData = (imagePart as any).inlineData.data;
    const mimeType = (imagePart as any).inlineData.mimeType || "image/png";
    const ext = mimeType.includes("jpeg") ? "jpg" : "png";

    // Upload para Supabase Storage
    const { createAdminClient } = await import("@/lib/supabase/admin");
    const supabase = createAdminClient();

    const buffer = Buffer.from(imageData, "base64");
    const filePath = `model-previews/${data.storeId}/${data.modelId}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("assets")
      .upload(filePath, buffer, {
        contentType: mimeType,
        upsert: true,
      });

    if (uploadError) {
      console.warn("[Gemini:Preview] ⚠️ Upload falhou:", uploadError.message);
      return null;
    }

    const { data: publicData } = supabase.storage.from("assets").getPublicUrl(filePath);

    // ── Logar custo no admin ──
    try {
      const { getModelPricing, getExchangeRate } = await import("@/lib/pricing");
      const pricing = await getModelPricing();
      const exchangeRate = await getExchangeRate();
      const modelPrice = pricing["gemini-3.1-flash-image-preview"] || { inputPerMTok: 0.50, outputPerMTok: 60.00 };

      // Mesma lógica do VTO por imagem: 4600 input + 4000 output
      // Flash Image = metade do custo do Pro Image (~R$1.39 vs ~R$2.85)
      const inputTokens = faceBase64 ? 4600 : 250;
      const outputTokens = 4000;
      const costUsd = (inputTokens * modelPrice.inputPerMTok + outputTokens * modelPrice.outputPerMTok) / 1_000_000;
      const costBrl = costUsd * exchangeRate;

      await supabase.from("api_cost_logs").insert({
        store_id: data.storeId || null,
        campaign_id: null,
        provider: "google",
        model_used: "gemini-3.1-flash-image-preview",
        action: "model_preview",
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        tokens_used: inputTokens + outputTokens,
        cost_usd: costUsd,
        cost_brl: costBrl,
      });

      console.log(`[Gemini:Preview] 💰 Custo: R$ ${costBrl.toFixed(4)} (${mode})`);
    } catch (costErr) {
      console.warn("[Gemini:Preview] ⚠️ Falha ao logar custo:", costErr);
    }

    console.log(`[Gemini:Preview] ✅ Imagem gerada e salva: ${publicData.publicUrl.slice(0, 60)}...`);
    return publicData.publicUrl;
  } catch (err) {
    console.warn("[Gemini:Preview] ❌ Falha:", err instanceof Error ? err.message : err);
    return null;
  }
}

/**
 * Job: Gerar preview de modelo virtual em background.
 * Provider único: Gemini 3.1 Flash Image (~R$0,01)
 * Retry automático: 2 tentativas com backoff exponencial.
 */
export const generateModelPreviewJob = inngest.createFunction(
  {
    id: "generate-model-preview",
    retries: 2,
    triggers: [{ event: "model/preview.requested" }],
    onFailure: async ({ event }) => {
      // type-guard robusto — Inngest pode envelopar em estruturas diferentes
      try {
        const { createAdminClient } = await import("@/lib/supabase/admin");
        const supabase = createAdminClient();
        const rawData =
          (event.data as unknown as { event?: { data?: ModelPreviewEvent } })?.event?.data ??
          (event.data as unknown as ModelPreviewEvent);
        const modelId = typeof rawData?.modelId === "string" ? rawData.modelId : null;
        if (modelId) {
          await supabase
            .from("store_models")
            .update({ preview_status: "failed", preview_url: null })
            .eq("id", modelId);
          console.error(`[Inngest:ModelPreview] ❌ Falhou p/ model ${modelId} — marcado failed`);
        } else {
          console.error("[Inngest:ModelPreview] onFailure: modelId ausente no evento");
        }
      } catch (e) {
        console.error("[Inngest:ModelPreview] Erro no onFailure:", e);
      }
    },
  },
  async ({ event, step }) => {
    const data = event.data as ModelPreviewEvent;

    // Step 1: Gerar preview com Gemini
    const previewUrl = await step.run("generate-gemini-preview", async () => {
      console.log(`[Inngest:ModelPreview] 🎨 Gerando preview para "${data.name}" (model: ${data.modelId})...`);
      const url = await generatePreviewWithGemini(data);
      if (!url) {
        throw new Error("Gemini preview generation failed");
      }
      return url;
    });

    // Step 2: Salvar URL no banco
    await step.run("save-preview-url", async () => {
      const { createAdminClient } = await import("@/lib/supabase/admin");
      const supabase = createAdminClient();

      await supabase
        .from("store_models")
        .update({ preview_url: previewUrl })
        .eq("id", data.modelId);

      console.log(`[Inngest:ModelPreview] 💾 Preview salvo (Gemini) para model ${data.modelId}`);
    });

    return { modelId: data.modelId, previewUrl, provider: "gemini" };
  }
);

// ═══════════════════════════════════════════════════════════
// BACKDROP GENERATOR — Estúdio vazio na cor da marca
// ═══════════════════════════════════════════════════════════

interface BackdropGenerateEvent {
  storeId: string;
  brandColor: string;
  season?: string;
}

/**
 * Job: Gerar backdrop de referência (estúdio vazio) em background.
 * Usado como imagem de referência visual pelo VTO para consistência de fundos.
 * Retry automático: 2 tentativas com backoff exponencial.
 */
export const generateBackdropJob = inngest.createFunction(
  {
    id: "generate-backdrop",
    retries: 2,
    triggers: [{ event: "store/backdrop.requested" }],
    onFailure: async ({ event }) => {
      try {
        const data = event.data?.event?.data as BackdropGenerateEvent;
        if (data?.storeId) {
          console.error(`[Inngest:Backdrop] ❌ Todas as tentativas falharam para store ${data.storeId}`);
        }
      } catch (e) {
        console.error("[Inngest:Backdrop] Erro no onFailure:", e);
      }
    },
  },
  async ({ event, step }) => {
    const data = event.data as BackdropGenerateEvent;

    // Step 1: Gerar backdrop via Gemini
    const result = await step.run("generate-backdrop-image", async () => {
      console.log(`[Inngest:Backdrop] 🎨 Gerando estúdio para store ${data.storeId} (${data.brandColor}) [${data.season || 'primavera'}]...`);
      const { generateBackdrop } = await import("@/lib/ai/backdrop-generator");
      const season = (data.season as any) || "primavera";
      return await generateBackdrop(data.storeId, data.brandColor, season);
    });

    console.log(`[Inngest:Backdrop] ✅ Backdrop salvo: ${result.url.slice(0, 60)}...`);
    return { storeId: data.storeId, backdropUrl: result.url, color: result.color };
  }
);

// ═══════════════════════════════════════════════════════════
// JUDGE — LLM-as-judge for campaign quality (Phase 02 D-01..D-06)
// ═══════════════════════════════════════════════════════════

interface JudgeRequestEvent {
  campaignId: string;
  storeId: string;
  /** SonnetDicasPostagem.caption_sugerida (or stringified full JSON) */
  copyText: string;
  productImageUrl: string;
  modelImageUrl: string;
  generatedImageUrl: string;
  /** SHA from sonnet-copywriter prompt — for traceability of which copy
   *  the score belongs to (correlates with api_cost_logs.metadata). */
  prompt_version: string;
}

/**
 * Job: score every successful campaign with the LLM-as-judge.
 * Triggered by event campaign/judge.requested emitted from pipeline.ts.
 * Provider: Anthropic (claude-sonnet-4-6) — same model as copywriter for
 * cost-forecast symmetry. Cost target: ~R$0.09/campaign per D-04 fallback.
 * Retries: 2 with exponential backoff (matches generateModelPreviewJob).
 * Terminal failure: writes nivel_risco='falha_judge' sentinel per D-02 so
 * /admin/quality (Plan 02-04) can distinguish judge-failure from low-quality.
 */
export const judgeCampaignJob = inngest.createFunction(
  {
    id: "judge-campaign",
    retries: 2,
    triggers: [{ event: "campaign/judge.requested" }],
    onFailure: async ({ event, error }) => {
      // D-02 sentinel: persist nivel_risco='falha_judge' so dashboards
      // can distinguish "judge failed" (transport / Anthropic 5xx after
      // retries / Zod boundary error after final retry) from "low quality".
      // captureError is already invoked inside scoreCampaignQuality on
      // JudgeInvalidOutputError; this branch handles transport failures.
      try {
        const data =
          (event.data as unknown as { event?: { data?: JudgeRequestEvent } })?.event?.data ??
          (event.data as unknown as JudgeRequestEvent);
        if (data?.campaignId) {
          await setCampaignScores({
            campaignId: data.campaignId,
            // Numeric dims clamped to 1 (post-clamp lower bound) so the
            // NOT NULL columns are satisfied. Downstream queries treat
            // falha_judge as "ignore numerics".
            naturalidade: 1,
            conversao: 1,
            clareza: 1,
            aprovacao_meta: 1,
            nota_geral: 1,
            nivel_risco: "falha_judge",
            justificativas: {
              naturalidade: "judge falhou — score não confiável",
              conversao: "judge falhou — score não confiável",
              clareza: "judge falhou — score não confiável",
              aprovacao_meta: "judge falhou — score não confiável",
              nota_geral: "judge falhou — score não confiável",
              nivel_risco: `judge falhou após retries: ${
                error?.message?.slice(0, 200) ?? "unknown"
              }`,
            },
          });
          console.error(
            `[Inngest:Judge] ❌ Falhou p/ campaign ${data.campaignId} — sentinel falha_judge gravado`,
          );

          // D-18 (Phase 02): sentinel was written → cron should stop re-emitting.
          // Clears judge_pending so the D-16 reconcile cron skips this row.
          // The campaign retains the nivel_risco='falha_judge' marker, which is
          // the desired terminal state.
          // FORWARD-COMPAT: migration may not be applied yet; failure is logged
          // and ignored (judge succeeded its terminal-failure write — pending-clear
          // is observability-only, not user-blocking).
          try {
            const { createAdminClient: createAdminClear } = await import("@/lib/supabase/admin");
            const sbClear = createAdminClear();
            await sbClear
              .from("campaigns")
              .update({ judge_pending: false, judge_payload: null })
              .eq("id", data.campaignId);
          } catch (clearErr) {
            console.warn(
              `[Inngest:Judge] judge_pending clear (sentinel path) failed: ${clearErr instanceof Error ? clearErr.message : clearErr}`,
            );
          }
        } else {
          console.error("[Inngest:Judge] onFailure: campaignId ausente no evento");
        }
      } catch (e) {
        console.error("[Inngest:Judge] Erro no onFailure handler:", e);
      }
    },
  },
  async ({ event, step }) => {
    const data = event.data as JudgeRequestEvent;

    // Step 1: call the judge (Anthropic tool_use + Zod boundary inside
    // scoreCampaignQuality; throws JudgeInvalidOutputError on schema drift
    // — non-retryable but Inngest's retry: 2 still catches transport flakes).
    const judgeResult = await step.run("score-campaign", async () => {
      return await scoreCampaignQuality({
        campaignId: data.campaignId,
        storeId: data.storeId,
        copyText: data.copyText,
        productImageUrl: data.productImageUrl,
        modelImageUrl: data.modelImageUrl,
        generatedImageUrl: data.generatedImageUrl,
        prompt_version: data.prompt_version,
      });
    });

    // Step 2: persist scores (idempotent UPSERT on campaign_id per D-06).
    // If event re-fires for same campaignId (Inngest retry, manual replay),
    // only one row exists in campaign_scores.
    await step.run("persist-scores", async () => {
      await setCampaignScores({
        campaignId: data.campaignId,
        naturalidade:   judgeResult.output.naturalidade,
        conversao:      judgeResult.output.conversao,
        clareza:        judgeResult.output.clareza,
        aprovacao_meta: judgeResult.output.aprovacao_meta,
        nota_geral:     judgeResult.output.nota_geral,
        nivel_risco:    judgeResult.output.nivel_risco,
        justificativas: {
          naturalidade:   judgeResult.output.justificativa_naturalidade,
          conversao:      judgeResult.output.justificativa_conversao,
          clareza:        judgeResult.output.justificativa_clareza,
          aprovacao_meta: judgeResult.output.justificativa_aprovacao_meta,
          nota_geral:     judgeResult.output.justificativa_nota_geral,
          nivel_risco:    judgeResult.output.justificativa_nivel_risco,
        },
      });
    });

    // Step 3: log cost (D-05 — JUDGE_PROMPT_VERSION lands in
    // api_cost_logs.metadata.prompt_version so judge-prompt edits are
    // themselves correlatable to score shifts).
    await step.run("log-cost", async () => {
      await logModelCost({
        storeId: data.storeId,
        campaignId: data.campaignId,
        provider: "anthropic",
        model: "claude-sonnet-4-6",
        action: "judge_quality",
        usage: judgeResult._usageMetadata,
        durationMs: judgeResult.durationMs,
        promptVersion: JUDGE_PROMPT_VERSION,
      });
    });

    // Step 4 (Phase 02 D-17): clear judge_pending on success — cron stops
    // re-emitting for this row. Forward-compat: migration may not be applied
    // yet OR Supabase env vars may not be set (test runners); failure is
    // logged and continues (judge succeeded; pending-clear is
    // observability-only, not user-blocking).
    await step.run("clear-judge-pending", async () => {
      try {
        const { createAdminClient: createAdminCJP } = await import("@/lib/supabase/admin");
        const sbCJP = createAdminCJP();
        const { error } = await sbCJP
          .from("campaigns")
          .update({
            judge_pending: false,
            judge_payload: null,
          })
          .eq("id", data.campaignId);
        if (error) {
          console.warn(`[Inngest:Judge] judge_pending clear failed: ${error.message}`);
        }
      } catch (clearErr) {
        console.warn(
          `[Inngest:Judge] judge_pending clear exception: ${clearErr instanceof Error ? clearErr.message : clearErr}`,
        );
      }
    });

    return {
      campaignId: data.campaignId,
      nota_geral: judgeResult.output.nota_geral,
      nivel_risco: judgeResult.output.nivel_risco,
    };
  },
);

// ═══════════════════════════════════════════════════════════
// QUALITY ALERTS — Daily 7am UTC cron (Phase 02 D-07/D-08/D-10)
// ═══════════════════════════════════════════════════════════
//
// Single cron runs 2 checks against production data:
//   (a) face_wrong WoW spike (D-07) — bucket-by-Monday fingerprint
//   (b) nivel_risco='alto' rolling 7-day spike (D-08) — daily-bucket fingerprint
//
// D-09 (Promptfoo PR regression Sentry issue) is NOT here — it is emitted by
// the GitHub Action .github/workflows/eval-on-pr.yml (Plan 02-02) at PR-level.
// Different cadence (per-PR vs daily); intentional separation.
//
// Per Plan 02-05 SUMMARY: vw_prompt_version_regen_correlation was created as a
// regular VIEW (not MATERIALIZED), so this cron does NOT need a REFRESH step.
// If the view is later swapped to MATERIALIZED (when api_cost_logs > 100K rows),
// add `await supabase.rpc('refresh_prompt_version_regen_correlation')` as Step 0
// of qualityAlertsCron below.

export const qualityAlertsCron = inngest.createFunction(
  {
    id: "quality-alerts-daily",
    retries: 2,
    triggers: [{ cron: "0 7 * * *" }], // daily 7am UTC
  },
  async ({ step }) => {
    const { createAdminClient } = await import("@/lib/supabase/admin");
    const supabase = createAdminClient();
    const now = new Date();

    // Step 1: face_wrong WoW spike (D-07)
    const faceWrongResult = await step.run("check-face-wrong-spike", async () => {
      const r = await queryFaceWrongRate(supabase, now);
      const breached =
        r.thisWeekPct > FACE_WRONG_THRESHOLD_PCT &&
        r.deltaPp     > FACE_WRONG_WOW_DELTA_PP;

      if (breached) {
        captureSyntheticAlert(
          `face_wrong rate spike: ${r.thisWeekPct.toFixed(1)}% this week ` +
            `(Δ +${r.deltaPp.toFixed(1)}pp WoW)`,
          buildFaceWrongFingerprint(now),
          {
            this_week_pct: r.thisWeekPct,
            last_week_pct: r.lastWeekPct,
            delta_pp: r.deltaPp,
            sample_size: r.sampleSize,
            top_prompt_versions: r.topPromptVersions, // PII-safe: SHA strings only
            threshold_pct: FACE_WRONG_THRESHOLD_PCT,
            threshold_delta_pp: FACE_WRONG_WOW_DELTA_PP,
          },
        );
      }
      return { fired: breached, kind: "face_wrong_spike", ...r };
    });

    // Step 2: nivel_risco='alto' rolling 7-day spike (D-08)
    const nivelRiscoResult = await step.run("check-nivel-risco-alto-spike", async () => {
      const r = await queryNivelRiscoAltoRate(supabase, now);
      const breached = r.pct > NIVEL_RISCO_ALTO_THRESHOLD_PCT;

      if (breached) {
        captureSyntheticAlert(
          `nivel_risco='alto' rate spike: ${r.pct.toFixed(2)}% ` +
            `(${r.altoCount}/${r.validTotal} last 7 days)`,
          buildNivelRiscoAltoFingerprint(now),
          {
            pct: r.pct,
            alto_count: r.altoCount,
            valid_total: r.validTotal,
            sample_campaign_ids: r.sampleCampaignIds, // PII-safe: opaque UUIDs only
            threshold_pct: NIVEL_RISCO_ALTO_THRESHOLD_PCT,
          },
        );
      }
      return { fired: breached, kind: "nivel_risco_alto_spike", ...r };
    });

    return {
      ranAt: now.toISOString(),
      faceWrong: { fired: faceWrongResult.fired, thisWeekPct: faceWrongResult.thisWeekPct },
      nivelRiscoAlto: { fired: nivelRiscoResult.fired, pct: nivelRiscoResult.pct },
    };
  },
);

/**
 * Lista de todas as functions Inngest para registrar no handler.
 */
export const inngestFunctions = [
  generateModelPreviewJob,
  generateBackdropJob,
  judgeCampaignJob,                      // Phase 02 D-01 — LLM-as-judge async
  qualityAlertsCron,                     // Phase 02 D-07/D-08 — daily 7am UTC alerts
  storageGarbageCollectorCron,
  storageGarbageCollectorManual,
];
