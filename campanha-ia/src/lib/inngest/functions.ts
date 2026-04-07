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
// MODEL PREVIEW — Gemini 3.1 Flash Image (provider único)
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
      { skinTone: data.skinTone, hairStyle: data.hairStyle, bodyType: data.bodyType, style: data.style, ageRange: data.ageRange },
      faceBase64,
      faceMime,
    );

    console.log(`[Gemini:Preview] 🎨 Gerando via gemini-3.1-flash-image-preview — modo: ${mode}...`);

    const response = await ai.models.generateContent({
      model: "gemini-3.1-flash-image-preview",
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
export const inngestFunctions = [generateCampaignJob, generateModelPreviewJob];
