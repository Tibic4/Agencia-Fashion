/**
 * CriaLook Image Generator v3
 *
 * Dispara 3 chamadas INDEPENDENTES ao Gemini Image em paralelo.
 * Cada chamada usa um prompt diferente gerado pelo Claude Opus.
 * Resultado: array de 3 imagens (null se falhou individualmente).
 */

import { GoogleGenAI } from "@google/genai";
import type { OpusPrompt } from "./opus-analyzer";

const GOOGLE_AI_API_KEY = process.env.GOOGLE_AI_API_KEY || "";
const MODEL = "gemini-3-pro-image-preview";

// ═══════════════════════════════════════
// Tipos
// ═══════════════════════════════════════

export interface ImageGenInput {
  /** Os 3 prompts gerados pelo Opus */
  prompts: [OpusPrompt, OpusPrompt, OpusPrompt];
  /** Base64 da foto principal do produto */
  productImageBase64: string;
  productMediaType?: string;
  /** Extras (close-up, segunda peça) */
  extraImages?: { base64: string; mediaType?: string }[];
  /** Base64 da foto da modelo do banco */
  modelImageBase64: string;
  modelMediaType?: string;
  /** Tipo de corpo */
  bodyType?: "normal" | "plus";
  /** Store ID para tracking de custos */
  storeId?: string;
  campaignId?: string;
}

export interface GeneratedImage {
  conceptName: string;
  imageBase64: string;
  durationMs: number;
}

export interface ImageGenResult {
  /** Array de 3 — null significa que essa imagem falhou */
  images: (GeneratedImage | null)[];
  successCount: number;
  totalDurationMs: number;
}

// ═══════════════════════════════════════
// Função principal — 3 chamadas paralelas
// ═══════════════════════════════════════

/**
 * Gera 3 imagens em paralelo (Promise.allSettled).
 * Se uma falhar, as outras continuam normalmente.
 * Retorna array de 3 resultados: GeneratedImage ou null (falhou).
 */
export async function generateImages(input: ImageGenInput): Promise<ImageGenResult> {
  if (!GOOGLE_AI_API_KEY) {
    throw new Error("GOOGLE_AI_API_KEY não configurada");
  }

  const startTime = Date.now();
  const ai = new GoogleGenAI({ apiKey: GOOGLE_AI_API_KEY });

  console.log(`[ImageGen] 🚀 Iniciando 3 chamadas paralelas ao Gemini...`);

  // Disparar 3 chamadas INDEPENDENTES em paralelo
  const settled = await Promise.allSettled(
    input.prompts.map((prompt, index) =>
      generateSingleImage(ai, prompt, input, index)
    )
  );

  // Mapear resultados — null para as que falharam
  const images: (GeneratedImage | null)[] = settled.map((r, i) => {
    if (r.status === "fulfilled") return r.value;
    console.warn(
      `[ImageGen] ❌ Imagem #${i + 1} "${input.prompts[i].concept_name}" falhou: ${
        (r.reason as Error)?.message || r.reason
      }`
    );
    return null;
  });

  const successCount = images.filter(Boolean).length;
  const totalDurationMs = Date.now() - startTime;

  console.log(
    `[ImageGen] ✅ ${successCount}/3 imagens geradas em ${totalDurationMs}ms`
  );

  // Log de custos (fire-and-forget, não bloquear)
  if (input.storeId) {
    logImageGenCosts(
      input.storeId,
      input.campaignId,
      successCount,
      totalDurationMs
    ).catch((e) => console.warn("[ImageGen] Erro ao salvar custo:", e));
  }

  return { images, successCount, totalDurationMs };
}

// ═══════════════════════════════════════
// Geração de imagem individual
// ═══════════════════════════════════════

async function generateSingleImage(
  ai: GoogleGenAI,
  prompt: OpusPrompt,
  input: ImageGenInput,
  index: number
): Promise<GeneratedImage> {
  const start = Date.now();
  console.log(
    `[ImageGen] 🎨 #${index + 1} "${prompt.concept_name}" — iniciando...`
  );

  // Parts: modelo → produto → extras → prompt
  const parts: Array<
    { text: string } | { inlineData: { mimeType: string; data: string } }
  > = [];

  // 1. Foto da modelo de referência (PRIMEIRO — âncora de identidade)
  parts.push({
    inlineData: {
      mimeType: input.modelMediaType || "image/png",
      data: input.modelImageBase64,
    },
  });

  // 2. Foto principal do produto
  parts.push({
    inlineData: {
      mimeType: input.productMediaType || "image/jpeg",
      data: input.productImageBase64,
    },
  });

  // 3. Extras (close-up de textura, segunda peça do conjunto)
  if (input.extraImages?.length) {
    for (const img of input.extraImages) {
      parts.push({
        inlineData: {
          mimeType: img.mediaType || "image/jpeg",
          data: img.base64,
        },
      });
    }
  }

  // 4. Prompt completo — positivo + negativo combinados em um único texto
  const bodyDesc =
    input.bodyType === "plus"
      ? "The model should have a plus-size/curvy body type (Brazilian GG/XGG sizing). Voluptuous, confident, beautiful curves."
      : "The model should have a standard/slim body type (Brazilian P/M sizing).";

  const extrasDesc = input.extraImages?.length
    ? "ADDITIONAL REFERENCE IMAGES: The extra images provided show close-up texture and/or the second piece of the set — use them to accurately reproduce fabric details and complete the outfit."
    : "";

  parts.push({
    text: `${prompt.positive_prompt}

MODEL IDENTITY (CRITICAL): Use the FIRST image as the exclusive model reference. Match her EXACT face features, skin tone, hair color, hair length, hair style, and body proportions. The model must look like the SAME PERSON across all generated photos.
PRODUCT REFERENCE: Use the SECOND image as the exact garment to reproduce. The garment must be IDENTICAL to the product in the photo — same color, same fabric texture, same details.
${extrasDesc}

MODEL BODY TYPE: ${bodyDesc}

POSE: ${prompt.pose}
SETTING: ${prompt.scenario}

TECHNICAL REQUIREMENTS:
- Full body photograph from head to feet, vertical portrait orientation (4:5 ratio)
- Professional fashion photography studio lighting
- The model must look like a REAL Brazilian person, not a mannequin or illustration
- Output ONLY the image — no text, no watermarks, no logos overlaid

ABSOLUTE RESTRICTIONS — DO NOT DO ANY OF THIS:
${prompt.negative_prompt}
- Do NOT generate barefoot model — always add appropriate footwear
- Do NOT show the model's face differently from the reference photo
- Do NOT change the garment color, fabric, or silhouette`,
  });

  const response = await ai.models.generateContent({
    model: MODEL,
    contents: [{ role: "user", parts }],
    config: {
      responseModalities: ["TEXT", "IMAGE"],
      imageConfig: {
        aspectRatio: "4:5",
        imageSize: "2K",
      },
    } as any,
  });

  // Extrair imagem da resposta
  const parts_resp = response.candidates?.[0]?.content?.parts;
  if (parts_resp) {
    for (const part of parts_resp) {
      if ((part as any).inlineData?.data) {
        const durationMs = Date.now() - start;
        console.log(
          `[ImageGen] ✅ #${index + 1} "${prompt.concept_name}" — ${durationMs}ms`
        );
        return {
          conceptName: prompt.concept_name,
          imageBase64: (part as any).inlineData.data,
          durationMs,
        };
      }
    }
  }

  throw new Error(
    `Gemini não retornou imagem para "${prompt.concept_name}" (sem inlineData)`
  );
}

// ═══════════════════════════════════════
// Log de custos ($0.101 por imagem 2K)
// ═══════════════════════════════════════

async function logImageGenCosts(
  storeId: string,
  campaignId: string | undefined,
  successCount: number,
  totalMs: number
) {
  const { createAdminClient } = await import("@/lib/supabase/admin");
  const supabase = createAdminClient();

  let exchangeRate = 5.8;
  try {
    const { getExchangeRate } = await import("@/lib/pricing");
    exchangeRate = await getExchangeRate();
  } catch {
    // fallback
  }

  const costPerImage = 0.101;
  const totalCostUsd = costPerImage * successCount;

  const { error } = await supabase.from("api_cost_logs").insert({
    store_id: storeId,
    campaign_id: campaignId || null,
    provider: "google",
    model_used: MODEL,
    action: "image_generation_v3",
    cost_usd: totalCostUsd,
    cost_brl: totalCostUsd * exchangeRate,
    exchange_rate: exchangeRate,
    response_time_ms: totalMs,
  });

  if (error) {
    console.warn("[ImageGen] ⚠️ Falha ao logar custo:", error.message);
  }
}
