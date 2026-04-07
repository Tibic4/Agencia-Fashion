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
// MODEL PREVIEW — Gemini primário + Fashn.ai fallback
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
 * Gera preview de modelo via Gemini 3.1 Flash Image.
 * Custo: ~$0.001/imagem (~R$ 0,006) — 70x mais barato que Fashn.
 * Retorna URL pública no Supabase Storage ou null se falhar.
 */
async function generatePreviewWithGemini(data: ModelPreviewEvent): Promise<string | null> {
  try {
    const { GoogleGenAI } = await import("@google/genai");
    const apiKey = process.env.GOOGLE_AI_API_KEY;
    if (!apiKey) {
      console.warn("[Gemini:Preview] GOOGLE_AI_API_KEY não configurada");
      return null;
    }

    const ai = new GoogleGenAI({ apiKey });

    // ── Descritores otimizados para Gemini Image Generation ──
    const skinDesc: Record<string, string> = {
      branca: "fair/light complexion, warm undertones",
      morena_clara: "light olive/honey-toned complexion",
      morena: "warm medium-brown complexion",
      negra: "rich dark-brown complexion, deep skin tone",
    };
    const hairDesc: Record<string, string> = {
      liso: "sleek straight black hair, shoulder-length",
      ondulado: "soft wavy dark hair, flowing past shoulders",
      cacheado: "voluminous curly hair, natural bouncy texture",
      crespo: "beautiful afro-textured coily hair, natural volume",
      curto: "stylish short-cropped hair",
    };
    const bodyDesc: Record<string, string> = {
      magra: "slim athletic silhouette",
      media: "naturally proportioned average build",
      plus_size: "confident plus-size curvy figure, full hips and natural curves",
    };
    const ageDesc: Record<string, string> = {
      jovem_18_25: "a youthful 20-year-old",
      adulta_26_35: "a 30-year-old",
      madura_36_50: "an elegant 40-year-old",
    };
    const poseDesc: Record<string, string> = {
      casual_natural: "Standing relaxed with a warm, approachable smile. Arms naturally at her sides, weight slightly on one leg.",
      elegante: "Poised and confident with one hand gently resting on her hip. Chin slightly lifted, subtle sophisticated smile.",
      esportivo: "Dynamic stance with energy and movement. Bright expression, slight forward lean suggesting motion.",
      urbano: "Cool asymmetric stance with street-style attitude. One shoulder slightly forward, confident gaze.",
    };

    const skin = skinDesc[data.skinTone] || "warm medium complexion";
    const hair = hairDesc[data.hairStyle] || "soft wavy dark hair";
    const body = bodyDesc[data.bodyType] || "average build";
    const age = ageDesc[data.ageRange] || "a 30-year-old";
    const pose = poseDesc[data.style] || "Standing relaxed with a natural, friendly expression.";

    // Prompt otimizado para Gemini — estilo descritivo, direção fotográfica
    const prompt = [
      `Generate a photorealistic full-body studio photograph of ${age} Brazilian woman.`,
      ``,
      `Subject: ${skin}, ${hair}, ${body}.`,
      `Outfit: Plain white crew-neck t-shirt and simple black shorts. Barefoot.`,
      ``,
      `Pose: ${pose}`,
      ``,
      `Photography direction: Professional e-commerce fashion photography. Clean seamless white background.`,
      `Soft diffused studio lighting from above and front, creating gentle shadows.`,
      `Camera at eye level, 85mm portrait lens, full body framing from top of head to toes.`,
      `Sharp focus, high resolution, natural skin texture visible.`,
      ``,
      `Important: Show the complete figure from head to bare feet. The entire body must be visible within the frame.`,
    ].join("\n");

    console.log(`[Gemini:Preview] 🎨 Gerando via gemini-3.1-flash-image-preview...`);

    const response = await ai.models.generateContent({
      model: "gemini-3.1-flash-image-preview",
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: {
        responseModalities: ["IMAGE", "TEXT"],
      } as any,
    });

    // Extrair imagem da resposta
    const parts = response.candidates?.[0]?.content?.parts || [];
    const imagePart = parts.find((p: any) => p.inlineData?.mimeType?.startsWith("image/"));

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
 * Pipeline: Gemini 3.1 Flash Image (~R$0,006) → Fashn.ai fallback (~R$0,43)
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

    // Step 1: Tentar Gemini (rápido, ~R$0,006)
    const geminiUrl = await step.run("generate-gemini-preview", async () => {
      console.log(`[Inngest:ModelPreview] 🎨 Tentando Gemini para "${data.name}" (model: ${data.modelId})...`);
      return await generatePreviewWithGemini(data);
    });

    // Step 2: Fallback para Fashn.ai se Gemini falhou
    const previewUrl = geminiUrl || await step.run("fallback-fashn-preview", async () => {
      console.log(`[Inngest:ModelPreview] 🔄 Gemini falhou, usando Fashn.ai fallback...`);
      const { generateCustomModelPreview } = await import("@/lib/fashn/client");

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

      console.log(`[Inngest:ModelPreview] ✅ Fashn fallback OK: ${result.outputUrl.slice(0, 60)}...`);
      return result.outputUrl;
    });

    // Step 3: Salvar URL no banco
    await step.run("save-preview-url", async () => {
      const { createAdminClient } = await import("@/lib/supabase/admin");
      const supabase = createAdminClient();

      await supabase
        .from("store_models")
        .update({ photo_url: previewUrl, preview_url: previewUrl })
        .eq("id", data.modelId);

      console.log(`[Inngest:ModelPreview] 💾 Preview salvo (${geminiUrl ? "Gemini" : "Fashn"}) para model ${data.modelId}`);
    });

    return { modelId: data.modelId, previewUrl, provider: geminiUrl ? "gemini" : "fashn" };
  }
);

/**
 * Lista de todas as functions Inngest para registrar no handler.
 */
export const inngestFunctions = [generateCampaignJob, generateModelPreviewJob];
