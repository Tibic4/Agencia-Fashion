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
  /** Base64 da foto do modelo do banco */
  modelImageBase64: string;
  /** MIME type da foto do modelo */
  modelMimeType?: string;
  /** Descrição da peça (do vision analysis) */
  productDescription?: string;
  /** Estilo de cenário/fundo */
  background?: BackgroundStyle;
  /** Base64 da foto de cenário personalizado (quando background = "personalizado") */
  customBackgroundBase64?: string;
  /** MIME type da foto de cenário personalizado */
  customBackgroundMimeType?: string;
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
  hasCloseUp?: boolean;
  hasCustomBackground?: boolean;
}): string {
  const bg = params.background || "estudio";
  const bgPrompt = BACKGROUND_PROMPTS[bg];

  const closeUpInstruction = params.hasCloseUp
    ? "\n- The SECOND image is a CLOSE-UP of the fabric texture. Use it to reproduce the EXACT same texture (ribbed, knit, woven, smooth, etc.) on the generated garment."
    : "";

  const customBgInstruction = params.hasCustomBackground
    ? "\n- One of the images is the CLIENT'S STORE/LOCATION. Use it as the background environment, matching perspective and lighting."
    : "";

  const basePrompt = `You are a world-class fashion photography editor specializing in Brazilian e-commerce.

TASK: Generate a SINGLE photorealistic image of a real-looking Brazilian woman model wearing the EXACT garment shown in the product photos.

IMAGE INPUTS:
- The FIRST image is the FULL product on a mannequin — this is the garment to recreate EXACTLY.${closeUpInstruction}${customBgInstruction}
- The LAST image (before this text) is the REFERENCE MODEL — match her body type, skin tone, hair, and face.

GARMENT RULES (CRITICAL):
1. PRESERVE the garment EXACTLY: same color, fabric texture, pattern, neckline, sleeves, length, and ALL details (buttons, rings, zippers, embroidery, seams)
2. The fabric texture must be IDENTICAL to the original product photo
3. DO NOT add, remove, or modify ANY garment detail
4. If the garment is a TOP (blouse, shirt, crop top), pair it with stylish high-waisted jeans or the bottom shown in the product photo

FOOTWEAR (MANDATORY):
5. The model must ALWAYS wear appropriate footwear — NEVER barefoot
6. Choose footwear that complements the outfit:
   - For casual looks: clean white sneakers or stylish sandals
   - For elegant/formal looks: nude heels or strappy sandals
   - For bohemian/relaxed looks: espadrilles or flat sandals
   - For sporty looks: fashionable sneakers

BACKGROUND:
7. ${bgPrompt}

PHOTOGRAPHY:
8. Full body photo from head to feet including shoes, 9:16 vertical portrait orientation
9. Natural confident pose, one hand slightly on hip or relaxed, looking at camera with a natural smile
10. Professional fashion photography lighting
11. The model should look like a REAL person, not AI-generated
12. Output ONLY the image, absolutely no text or watermarks`;

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

  try {
    const ai = new GoogleGenAI({ apiKey: GOOGLE_AI_API_KEY });

    // Montar as parts: imagens + prompt
    const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [];

    // 1. Foto do produto (obrigatória)
    parts.push({
      inlineData: {
        mimeType: params.productMimeType || "image/jpeg",
        data: params.productImageBase64,
      },
    });

    // 2. Close-up do tecido (opcional)
    if (params.closeUpBase64) {
      parts.push({
        inlineData: {
          mimeType: params.closeUpMimeType || "image/jpeg",
          data: params.closeUpBase64,
        },
      });
    }

    // 3. Cenário personalizado (opcional)
    if (params.background === "personalizado" && params.customBackgroundBase64) {
      parts.push({
        inlineData: {
          mimeType: params.customBackgroundMimeType || "image/jpeg",
          data: params.customBackgroundBase64,
        },
      });
    }

    // 4. Modelo de referência (sempre por último antes do prompt)
    parts.push({
      inlineData: {
        mimeType: params.modelMimeType || "image/png",
        data: params.modelImageBase64,
      },
    });

    // 5. Prompt
    parts.push({
      text: buildTryOnPrompt({
        description: params.productDescription,
        background: params.background,
        hasCloseUp: !!params.closeUpBase64,
        hasCustomBackground: params.background === "personalizado" && !!params.customBackgroundBase64,
      }),
    });

    const response = await ai.models.generateContent({
      model: MODEL,
      contents: [{
        role: "user",
        parts,
      }],
    });

    // Extrair imagem do response
    if (response.candidates?.[0]?.content?.parts) {
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData?.data) {
          return {
            status: "completed",
            imageBase64: part.inlineData.data,
            outputUrl: null,
          };
        }
      }
    }

    return {
      status: "failed",
      imageBase64: null,
      outputUrl: null,
      error: "Nano Banana não retornou imagem",
    };
  } catch (error: any) {
    return {
      status: "failed",
      imageBase64: null,
      outputUrl: null,
      error: `Nano Banana error: ${error.message}`,
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
