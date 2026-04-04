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

/**
 * Lista de todas as functions Inngest para registrar no handler.
 */
export const inngestFunctions = [generateCampaignJob];
