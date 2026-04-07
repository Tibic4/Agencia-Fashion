/**
 * Google Nano Banana 2 (Gemini 3.1 Flash Image) — Image Generation Client
 * 
 * Provider principal para geração de modelo vestindo a peça.
 * Funciona enviando a foto do produto + prompt descritivo → recebe foto de modelo gerada.
 * 
 * Modelo: gemini-3.1-flash-image-preview (Nano Banana 2)
 * Custo: ~$0.03 por imagem (~R$ 0,15)
 */

import { GoogleGenAI } from "@google/genai";

const GOOGLE_AI_API_KEY = process.env.GOOGLE_AI_API_KEY || "";
const MODEL = "gemini-3.1-flash-image-preview";

// ═══════════════════════════════════════
// Tipos
// ═══════════════════════════════════════

export type BackgroundStyle = 
  | "estudio"        // Fundo branco profissional (padrão)
  | "boutique"       // Ambiente de loja/boutique elegante
  | "urbano"         // Cenário urbano/rua da cidade
  | "natureza"       // Ambiente ao ar livre com natureza
  | "personalizado"; // Cliente envia foto do cenário

export interface NanoBananaResult {
  status: "completed" | "failed";
  imageBase64: string | null;
  outputUrl: string | null;
  error?: string;
  durationMs?: number;
}

/**
 * Loga custo de uma chamada Nano Banana no banco (async, fire-and-forget)
 * Usa tokens reais do usageMetadata quando disponíveis.
 */
async function logNanoBananaCost(
  durationMs: number,
  success: boolean,
  storeId?: string,
  campaignId?: string,
  usage?: { inputTokens: number; outputTokens: number },
) {
  try {
    const { createAdminClient } = await import("@/lib/supabase/admin");
    const supabase = createAdminClient();
    const { getExchangeRate, getModelPricing } = await import("@/lib/pricing");
    const exchangeRate = await getExchangeRate();

    let costUsd = 0.03; // fallback estimado
    const inputTokens = usage?.inputTokens || 0;
    const outputTokens = usage?.outputTokens || 0;

    // Se temos tokens reais, calcular custo real
    if (inputTokens > 0 || outputTokens > 0) {
      const pricing = await getModelPricing();
      // Gemini imagen usa pricing de flash para tokens de texto, mas output de imagem tem pricing separado
      // Usar o pricing do modelo ou um fallback razoável
      const modelPrice = pricing["gemini-2.5-flash"] || { inputPerMTok: 0.30, outputPerMTok: 2.50 };
      costUsd = (inputTokens * modelPrice.inputPerMTok) / 1_000_000
              + (outputTokens * modelPrice.outputPerMTok) / 1_000_000;
    }

    const costBrl = costUsd * exchangeRate;

    await supabase.from("api_cost_logs").insert({
      store_id: storeId || null,
      campaign_id: campaignId || null,
      provider: "google",
      model_used: MODEL,
      action: "virtual_try_on",
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      tokens_used: inputTokens + outputTokens,
      cost_usd: costUsd,
      cost_brl: costBrl,
      response_time_ms: durationMs,
    });

    if (inputTokens > 0) {
      console.log(`[NanoBanana] 💰 Custo REAL: R$ ${costBrl.toFixed(4)} (${inputTokens}+${outputTokens} tokens)`);
    }
  } catch (e) {
    console.warn("[NanoBanana] Erro ao salvar custo:", e);
  }
}

export interface NanoBananaTryOnParams {
  /** Base64 da foto do produto (sem o prefixo data:...) */
  productImageBase64: string;
  /** MIME type da foto do produto */
  productMimeType?: string;
  /** Base64 da foto close-up do tecido (opcional) */
  closeUpBase64?: string;
  /** MIME type da foto close-up */
  closeUpMimeType?: string;
  /** Base64 da segunda peça do conjunto (opcional) */
  secondPieceBase64?: string;
  /** MIME type da segunda peça */
  secondPieceMimeType?: string;
  /** Base64 da foto do modelo do banco */
  modelImageBase64: string;
  /** MIME type da foto do modelo */
  modelMimeType?: string;
  /** Descrição da peça (do vision analysis) */
  productDescription?: string;
  /** Tipo de corpo da modelo */
  bodyType?: "normal" | "plus";
  /** Estilo de cenário/fundo */
  background?: BackgroundStyle;
  /** Tipo de campanha (define aspect ratio) */
  campaignType?: "instagram_feed" | "instagram_story" | "ecommerce" | "banner";
  /** Base64 da foto de cenário personalizado (quando background = "personalizado") */
  customBackgroundBase64?: string;
  /** MIME type da foto de cenário personalizado */
  customBackgroundMimeType?: string;
  /** Store ID para tracking de custo */
  storeId?: string;
  /** Campaign ID para tracking de custo */
  campaignId?: string;
  /** Dados VTO do Vision Analysis (Step 1) para fidelidade máxima */
  visionData?: {
    fabricDescriptor?: string;
    garmentStructure?: string;
    colorHex?: string;
    criticalDetails?: string[];
  };
}

// ═══════════════════════════════════════
// Cenários
// ═══════════════════════════════════════

const BACKGROUND_PROMPTS: Record<BackgroundStyle, string> = {
  estudio: "Clean white studio background with professional fashion ecommerce lighting, soft shadows.",
  boutique: "Elegant fashion boutique interior background with tasteful decor, soft warm lighting, clothing racks subtly blurred in background. The environment should look like a high-end Brazilian fashion store.",
  urbano: "Urban city street background, stylish neighborhood with modern architecture, natural daylight. The model appears to be casually walking on a clean sidewalk.",
  natureza: "Beautiful outdoor setting with soft natural light, lush green vegetation slightly blurred in background, golden hour lighting.",
  personalizado: "Use the provided background/store photo as the environment. Place the model naturally in this exact location, matching the lighting and perspective.",
};

// ═══════════════════════════════════════
// Prompt otimizado para moda
// ═══════════════════════════════════════

function buildTryOnPrompt(params: {
  description?: string;
  background?: BackgroundStyle;
  bodyType?: "normal" | "plus";
  hasCloseUp?: boolean;
  hasSecondPiece?: boolean;
  hasCustomBackground?: boolean;
  visionData?: {
    fabricDescriptor?: string;
    garmentStructure?: string;
    colorHex?: string;
    criticalDetails?: string[];
  };
}): string {
  const bg = params.background || "estudio";
  const bgPrompt = BACKGROUND_PROMPTS[bg];
  const isPlus = params.bodyType === "plus";

  const closeUpInstruction = params.hasCloseUp
    ? "\n- The THIRD image is a CLOSE-UP of the fabric texture. Examine it carefully to reproduce the EXACT same texture (ribbed, knit, woven, smooth, etc.) on the generated garment. This is the most important reference for material accuracy."
    : "";

  const secondPieceInstruction = params.hasSecondPiece
    ? "\n- The FOURTH image is the SECOND PIECE of the set/conjunto (e.g., matching skirt, pants, or top). The model must wear BOTH pieces together as a coordinated set."
    : "";

  const customBgInstruction = params.hasCustomBackground
    ? "\n- One of the images is the CLIENT'S STORE/LOCATION. Use it as the background environment, matching perspective and lighting."
    : "";

  const bodyTypeInstruction = isPlus
    ? "The model should have a plus-size/curvy body type (Brazilian GG/XGG sizing, approximately US size 14-22). Voluptuous, confident, beautiful curves."
    : "The model should have a standard/slim body type (Brazilian P/M sizing, approximately US size 4-8). Slim, athletic build.";

  const basePrompt = `You are a world-class fashion photography editor specializing in Brazilian e-commerce.

TASK: Generate a SINGLE photorealistic image of a real-looking Brazilian woman model wearing the EXACT garment shown in the product photos.

IMAGE INPUTS (in order):
- The FIRST image is the REFERENCE MODEL — match her EXACT face, skin tone, hair style, and body proportions.
- The SECOND image is the MAIN PRODUCT on a mannequin — this is the garment to recreate EXACTLY.${closeUpInstruction}${secondPieceInstruction}${customBgInstruction}

MODEL BODY TYPE (CRITICAL):
1. ${bodyTypeInstruction}
2. The garment must FIT this body type naturally — adjust how the fabric drapes, stretches, and falls on this specific body shape.
3. DO NOT change the body type from the reference — if the instruction says standard, generate a standard body; if plus, generate plus.

GARMENT RULES (CRITICAL):
4. PRESERVE the garment EXACTLY: same color, fabric texture, pattern, neckline, sleeves, length, and ALL details (buttons, rings, zippers, embroidery, seams)
5. The fabric texture must be IDENTICAL to the original product photo
${params.visionData?.fabricDescriptor ? `5b. FABRIC TEXTURE FIDELITY: This garment is made of ${params.visionData.fabricDescriptor}. The generated image MUST show this exact texture — do not smooth, simplify, or change the fabric appearance.` : ""}
${params.visionData?.colorHex ? `5c. COLOR TARGET: Match the garment color to approximately ${params.visionData.colorHex}. Do NOT shift the hue, saturation, or brightness.` : ""}
${params.visionData?.garmentStructure ? `5d. GARMENT STRUCTURE: ${params.visionData.garmentStructure}. Maintain this exact silhouette when worn.` : ""}
${params.visionData?.criticalDetails?.length ? `5e. CRITICAL DETAILS TO PRESERVE: ${params.visionData.criticalDetails.join("; ")}` : ""}
6. PAY SPECIAL ATTENTION to elastic bands, ribbed edges, and cuffs — reproduce them tightly and precisely as shown on the mannequin
7. DO NOT add, remove, or modify ANY garment detail
8. EMBROIDERY/PRINTS COUNT: If the garment has embroidered elements (stars, flowers, etc.), reproduce the EXACT SAME NUMBER and SPACING as shown in the product photo. Do NOT add extra elements or make the pattern denser than the original.
9. Match the EXACT proportions of the garment relative to the body — if the top is cropped, it should end at exactly the same point
10. If the garment is a TOP (blouse, shirt, crop top), pair it with stylish high-waisted jeans or the bottom shown in the product photo
11. DO NOT alter the garment in any way: no color shifts, no texture changes, no added or removed patterns, no simplified embroidery

FOOTWEAR (MANDATORY):
10. The model must ALWAYS wear appropriate footwear — NEVER barefoot
11. Choose footwear that complements the outfit:
   - For casual looks: clean white sneakers or stylish sandals
   - For elegant/formal looks: nude heels or strappy sandals
   - For bohemian/relaxed looks: espadrilles or flat sandals
   - For sporty looks: fashionable sneakers

BACKGROUND:
12. ${bgPrompt}

PHOTOGRAPHY:
13. Full body photo from head to feet including shoes, vertical portrait orientation
14. Natural confident pose, one hand slightly on hip or relaxed, looking at camera with a natural smile
15. Professional fashion photography lighting with subtle shadows
16. The model should look like a REAL person, not AI-generated
17. Output ONLY the image, absolutely no text or watermarks`;

  if (params.description) {
    return `${basePrompt}\n\nProduct details for reference: ${params.description}`;
  }
  return basePrompt;
}

// ═══════════════════════════════════════
// API
// ═══════════════════════════════════════

/**
 * Gera foto de modelo vestindo a peça usando Nano Banana 2.
 * Envia: foto do produto + (opcional) close-up + (opcional) cenário + modelo de referência + prompt
 * Recebe: foto gerada em base64
 */
export async function nanoBananaTryOn(params: NanoBananaTryOnParams): Promise<NanoBananaResult> {
  if (!GOOGLE_AI_API_KEY) {
    return { status: "failed", imageBase64: null, outputUrl: null, error: "GOOGLE_AI_API_KEY não configurada" };
  }

  const start = Date.now();

  try {
    const ai = new GoogleGenAI({ apiKey: GOOGLE_AI_API_KEY });

    // Montar as parts: imagens + prompt
    // ORDEM CRÍTICA: Modelo → Produto → Close-up → 2ª Peça → Cenário → Prompt
    // Cada imagem é claramente identificada no prompt para evitar confusão
    const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [];

    // 1. Modelo de referência (PRIMEIRO — rosto, corpo, tom de pele)
    parts.push({
      inlineData: {
        mimeType: params.modelMimeType || "image/png",
        data: params.modelImageBase64,
      },
    });

    // 2. Foto do produto principal (SEGUNDO — outfit completo no manequim)
    parts.push({
      inlineData: {
        mimeType: params.productMimeType || "image/jpeg",
        data: params.productImageBase64,
      },
    });

    // 3. Close-up do tecido (TERCEIRO — textura, detalhes — opcional)
    if (params.closeUpBase64) {
      parts.push({
        inlineData: {
          mimeType: params.closeUpMimeType || "image/jpeg",
          data: params.closeUpBase64,
        },
      });
    }

    // 4. Cenário personalizado (opcional)
    if (params.background === "personalizado" && params.customBackgroundBase64) {
      parts.push({
        inlineData: {
          mimeType: params.customBackgroundMimeType || "image/jpeg",
          data: params.customBackgroundBase64,
        },
      });
    }

    // 5. Segunda peça do conjunto (opcional)
    if (params.secondPieceBase64) {
      parts.push({
        inlineData: {
          mimeType: params.secondPieceMimeType || "image/jpeg",
          data: params.secondPieceBase64,
        },
      });
    }

    // 6. Prompt
    parts.push({
      text: buildTryOnPrompt({
        description: params.productDescription,
        background: params.background,
        bodyType: params.bodyType,
        hasCloseUp: !!params.closeUpBase64,
        hasSecondPiece: !!params.secondPieceBase64,
        hasCustomBackground: params.background === "personalizado" && !!params.customBackgroundBase64,
        visionData: params.visionData,
      }),
    });

    // Mapear aspect ratio por tipo de campanha
    const aspectRatios: Record<string, string> = {
      instagram_feed: "4:5",
      instagram_story: "9:16",
      ecommerce: "3:4",
      banner: "16:9",
    };
    const aspectRatio = aspectRatios[params.campaignType || "instagram_feed"] || "4:5";

    const response = await ai.models.generateContent({
      model: MODEL,
      contents: [{
        role: "user",
        parts,
      }],
      config: {
        responseModalities: ["TEXT", "IMAGE"],
        imageConfig: {
          aspectRatio,
          imageSize: "2K",
        },
      } as any,
    });

    const durationMs = Date.now() - start;

    // Extrair usageMetadata para custo REAL
    const usageMetadata = (response as any).usageMetadata;
    const usage = usageMetadata ? {
      inputTokens: usageMetadata.promptTokenCount || usageMetadata.inputTokens || 0,
      outputTokens: usageMetadata.candidatesTokenCount || usageMetadata.outputTokens || 0,
    } : undefined;

    if (usage) {
      console.log(`[NanoBanana] 📊 Tokens reais: input=${usage.inputTokens}, output=${usage.outputTokens}`);
    }

    // Extrair imagem do response
    if (response.candidates?.[0]?.content?.parts) {
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData?.data) {
          logNanoBananaCost(durationMs, true, params.storeId, params.campaignId, usage).catch(() => {});
          return {
            status: "completed",
            imageBase64: part.inlineData.data,
            outputUrl: null,
            durationMs,
          };
        }
      }
    }

    logNanoBananaCost(durationMs, false, params.storeId, params.campaignId, usage).catch(() => {});
    return {
      status: "failed",
      imageBase64: null,
      outputUrl: null,
      error: "Nano Banana não retornou imagem",
      durationMs,
    };
  } catch (error: any) {
    const durationMs = Date.now() - start;
    logNanoBananaCost(durationMs, false, params.storeId, params.campaignId).catch(() => {});
    return {
      status: "failed",
      imageBase64: null,
      outputUrl: null,
      error: `Nano Banana error: ${error.message}`,
      durationMs,
    };
  }
}

/**
 * Lista os cenários disponíveis para o frontend
 */
export function getAvailableBackgrounds(): Array<{ id: BackgroundStyle; label: string; description: string }> {
  return [
    { id: "estudio", label: "Estúdio Profissional", description: "Fundo branco limpo, iluminação profissional" },
    { id: "boutique", label: "Boutique", description: "Interior de loja elegante com decoração sutil" },
    { id: "urbano", label: "Urbano", description: "Cenário de rua com arquitetura moderna" },
    { id: "natureza", label: "Ao Ar Livre", description: "Ambiente natural com vegetação e luz dourada" },
    { id: "personalizado", label: "Sua Loja", description: "Envie uma foto da sua loja como fundo" },
  ];
}

/**
 * Verifica se a API Google AI está configurada
 */
export function isNanoBananaAvailable(): boolean {
  return !!GOOGLE_AI_API_KEY;
}
