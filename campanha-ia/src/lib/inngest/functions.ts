import { inngest } from "./client";
import { savePipelineResultV3, incrementCampaignsUsed } from "@/lib/db";
import { runCampaignPipeline } from "@/lib/ai/pipeline";
import {
  storageGarbageCollectorCron,
  storageGarbageCollectorManual,
} from "./storage-gc";

interface CampaignGenerateEvent {
  campaignId: string;
  storeId: string;
  imageBase64: string;
  mediaType: string;
  price: string;
  storeName: string;
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
          storeName: data.storeName,
          // Fallback 1x1 transparent PNG — inngest jobs typically don't have a model
          modelImageBase64: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
          modelMediaType: "image/png",
        },
        (stepName: string, label: string, progress: number) => {
          console.log(`[Inngest:Pipeline] ${stepName} (${progress}%) — ${label}`);
        }
      );
    });

    // Step 2: Salvar resultado no banco
    await step.run("save-result", async () => {
      await savePipelineResultV3({
        campaignId: data.campaignId,
        durationMs: result.durationMs,
        analise: result.analise as unknown as Record<string, unknown>,
        imageUrls: result.images.map(img => (img ? "pending" : null)),
        prompts: (result.vto_hints?.scene_prompts || []) as unknown as Record<string, unknown>[],
        dicas_postagem: result.dicas_postagem as unknown as Record<string, unknown>,
        successCount: result.successCount,
      });
      await incrementCampaignsUsed(data.storeId);
    });

    return { campaignId: data.campaignId, durationMs: result.durationMs };
  }
);

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
    const { GoogleGenAI } = await import("@google/genai");
    const { buildGeminiParts } = await import("@/lib/model-prompts");
    const apiKey = process.env.GOOGLE_AI_API_KEY;
    if (!apiKey) {
      console.warn("[Gemini:Preview] GOOGLE_AI_API_KEY não configurada");
      return null;
    }

    const ai = new GoogleGenAI({ apiKey });

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
      },
      faceBase64,
      faceMime,
    );

    console.log(`[Gemini:Preview] 🎨 Gerando via gemini-3-pro-image-preview — modo: ${mode}...`);

    const response = await ai.models.generateContent({
      model: "gemini-3-pro-image-preview",
      contents: [{ role: "user", parts }],
      config: {
        responseModalities: ["IMAGE", "TEXT"],
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
      const modelPrice = pricing["gemini-3-pro-image-preview"] || { inputPerMTok: 1.25, outputPerMTok: 10.00 };

      // Estimar tokens: ~250 input (prompt + imagem ref), ~4000 output (imagem gerada)
      const inputTokens = faceBase64 ? 1300 : 250;
      const outputTokens = 4000;
      const costUsd = (inputTokens * modelPrice.inputPerMTok + outputTokens * modelPrice.outputPerMTok) / 1_000_000;
      const costBrl = costUsd * exchangeRate;

      await supabase.from("api_cost_logs").insert({
        store_id: data.storeId || null,
        campaign_id: null,
        provider: "google",
        model_used: "gemini-3-pro-image-preview",
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
      // Marcar modelo como 'failed' para não ficar eternamente pendente
      try {
        const { createAdminClient } = await import("@/lib/supabase/admin");
        const supabase = createAdminClient();
        const data = event.data?.event?.data as ModelPreviewEvent;
        if (data?.modelId) {
          await supabase
            .from("store_models")
            .update({ preview_status: "failed", preview_url: null })
            .eq("id", data.modelId);
          console.error(`[Inngest:ModelPreview] ❌ Todas as tentativas falharam para model ${data.modelId} — marcado como failed`);
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

/**
 * Lista de todas as functions Inngest para registrar no handler.
 */
export const inngestFunctions = [
  generateCampaignJob,
  generateModelPreviewJob,
  storageGarbageCollectorCron,
  storageGarbageCollectorManual,
];
