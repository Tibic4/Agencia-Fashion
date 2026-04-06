import { inngest } from "./client";
import { savePipelineResult, incrementCampaignsUsed } from "@/lib/db";
import { runCampaignPipeline } from "@/lib/ai/pipeline";

interface CampaignGenerateEvent {
  campaignId: string;
  storeId: string;
  imageBase64: string;
  mediaType: string;
  price: string;
  objective: string;
  storeName: string;
  targetAudience?: string;
  toneOverride?: string;
}

/**
 * Job: Gerar campanha de IA de forma assíncrona.
 * Inngest v4: createFunction recebe 2 args (config, handler).
 */
export const generateCampaignJob = inngest.createFunction(
  {
    id: "generate-campaign",
    retries: 2,
    triggers: [{ event: "campaign/generate.requested" }],
  },
  async ({ event, step }) => {
    const data = event.data as CampaignGenerateEvent;

    // Step 1: Rodar pipeline de IA
    const result = await step.run("run-pipeline", async () => {
      return await runCampaignPipeline(
        {
          imageBase64: data.imageBase64,
          mediaType: data.mediaType as "image/jpeg" | "image/png" | "image/webp" | "image/gif",
          price: data.price,
          objective: data.objective,
          storeName: data.storeName,
          targetAudience: data.targetAudience,
          toneOverride: data.toneOverride,
        },
        (stepName: string, label: string, progress: number) => {
          console.log(`[Inngest:Pipeline] ${stepName} (${progress}%) — ${label}`);
        }
      );
    });

    // Step 2: Salvar resultado no banco
    await step.run("save-result", async () => {
      await savePipelineResult({
        campaignId: data.campaignId,
        durationMs: result.durationMs,
        vision: result.vision as unknown as Record<string, unknown>,
        strategy: result.strategy as unknown as Record<string, unknown>,
        output: result.output as unknown as Record<string, unknown>,
        score: result.score as unknown as Record<string, unknown>,
      });
      await incrementCampaignsUsed(data.storeId);
    });

    return { campaignId: data.campaignId, durationMs: result.durationMs };
  }
);

// ═══════════════════════════════════════════════════════════
// MODEL PREVIEW — Geração assíncrona em background
// ═══════════════════════════════════════════════════════════

interface ModelPreviewEvent {
  modelId: string;
  storeId: string;
  skinTone: string;
  hairStyle: string;
  bodyType: string;
  style: string;
  ageRange: string;
  name: string;
}

/**
 * Job: Gerar preview de modelo virtual em background.
 * Disparado imediatamente após POST /api/model/create.
 * Retry automático: 2 tentativas com backoff exponencial.
 * Custo: 1 crédito Fashn.ai (~$0.075 = ~R$ 0,44)
 */
export const generateModelPreviewJob = inngest.createFunction(
  {
    id: "generate-model-preview",
    retries: 2,
    triggers: [{ event: "model/preview.requested" }],
  },
  async ({ event, step }) => {
    const data = event.data as ModelPreviewEvent;

    // Step 1: Gerar preview via Fashn.ai (polling interno ~20-60s)
    const previewUrl = await step.run("generate-fashn-preview", async () => {
      const { generateCustomModelPreview } = await import("@/lib/fashn/client");

      console.log(`[Inngest:ModelPreview] 🎨 Gerando preview para "${data.name}" (model: ${data.modelId})...`);

      const result = await generateCustomModelPreview({
        skinTone: data.skinTone,
        hairStyle: data.hairStyle,
        bodyType: data.bodyType,
        style: data.style,
        ageRange: data.ageRange,
        name: data.name,
        storeId: data.storeId,
      });

      if (result.status !== "completed" || !result.outputUrl) {
        throw new Error(`Fashn preview falhou: ${result.error || "status=" + result.status}`);
      }

      console.log(`[Inngest:ModelPreview] ✅ Preview gerado: ${result.outputUrl.slice(0, 60)}...`);
      return result.outputUrl;
    });

    // Step 2: Salvar URL no banco
    await step.run("save-preview-url", async () => {
      const { createAdminClient } = await import("@/lib/supabase/admin");
      const supabase = createAdminClient();

      await supabase
        .from("store_models")
        .update({ photo_url: previewUrl, preview_url: previewUrl })
        .eq("id", data.modelId);

      console.log(`[Inngest:ModelPreview] 💾 Preview salvo no DB para model ${data.modelId}`);
    });

    return { modelId: data.modelId, previewUrl };
  }
);

/**
 * Lista de todas as functions Inngest para registrar no handler.
 */
export const inngestFunctions = [generateCampaignJob, generateModelPreviewJob];
