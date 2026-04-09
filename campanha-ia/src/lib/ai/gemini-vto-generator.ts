/**
 * CriaLook Image Generator v5 — Gemini 3.1 Flash Image (Nano Banana 2)
 *
 * Usa o modelo `gemini-3.1-flash-image-preview` para Virtual Try-On via
 * multi-image fusion nativa do Gemini.
 *
 * Vantagens sobre FASHN tryon-max:
 * - Entende conjuntos (blusa + saia) como peça única
 * - Aceita fotos com fundo poluído (loja, manequim)
 * - Prompt narrativo = controle fino do resultado
 * - Saída em base64 (upload direto pro Supabase, sem CDN temporário)
 * - Mais barato: ~$0.04/imagem vs ~$0.15/imagem (FASHN)
 *
 * Resolução: 2K (~4MP) — ideal para Instagram Feed (1080x1350)
 */

import { GoogleGenAI } from "@google/genai";

// ═══════════════════════════════════════
// Tipos
// ═══════════════════════════════════════

export interface GeminiVTOInput {
  /** 3 styling/scene prompts do Sonnet (cenário + estilo) */
  stylingPrompts: [string, string, string];
  /** Base64 da foto principal do produto (sem prefixo data:) */
  productImageBase64: string;
  productMediaType?: string;
  /** Base64 da foto da modelo do banco (sem prefixo data:) */
  modelImageBase64: string;
  modelMediaType?: string;
  /** Tipo de corpo */
  bodyType?: "normal" | "plus";
  /** Aspect ratio sugerido */
  aspectRatio?: string;
  /** Store ID para tracking de custos */
  storeId?: string;
  campaignId?: string;
}

export interface GeneratedImage {
  conceptName: string;
  /** Base64 da imagem gerada (sem prefixo data:) */
  imageBase64: string;
  /** URL opcional — preenchida após upload para Supabase */
  imageUrl: string;
  mimeType: string;
  durationMs: number;
}

export interface GeminiVTOResult {
  images: (GeneratedImage | null)[];
  successCount: number;
  totalDurationMs: number;
}

// ═══════════════════════════════════════
// Config
// ═══════════════════════════════════════

const MODEL = "gemini-3.1-flash-image-preview";
const IMAGE_SIZE = "2K";
const DEFAULT_ASPECT = "3:4";

// ═══════════════════════════════════════
// Singleton GoogleGenAI
// ═══════════════════════════════════════

let _ai: GoogleGenAI | null = null;
function getAI(): GoogleGenAI {
  if (!_ai) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("GEMINI_API_KEY não configurada");
    _ai = new GoogleGenAI({ apiKey });
  }
  return _ai;
}

// ═══════════════════════════════════════
// Prompt de VTO (narrativo — força do Gemini)
// ═══════════════════════════════════════

function buildVTOPrompt(stylingPrompt: string, bodyType: string): string {
  const fitContext = bodyType === "plus"
    ? `The model has a plus-size curvy body with full figure. Ensure the garment fits naturally, flattering her curves — no pulling at seams, no bunching. The fabric should drape smoothly over her bust, waist, and hips. Choose poses and angles that celebrate her body shape confidently.`
    : `The model has a standard/slim build. Ensure the garment fits naturally with appropriate ease — not too tight, not too loose. The fabric should fall cleanly along her frame.`;

  return `You are an elite fashion photographer and virtual try-on specialist working for a premium e-commerce brand.

I am providing exactly TWO reference images in this request:
• IMAGE 1 (first image): The PERSON — a fashion model reference photo. This is the person who must appear in the final image.
• IMAGE 2 (second image): The GARMENT/OUTFIT — a product photo that may show clothing on a mannequin, flat-lay, hanger, or worn by a different person.

YOUR TASK: Create a single photorealistic image of the person from IMAGE 1 wearing ALL garments/pieces visible in IMAGE 2.

━━━ IDENTITY PRESERVATION (HIGHEST PRIORITY) ━━━
• Reproduce the person's face with pixel-level accuracy — same bone structure, eye shape, nose, lips, skin texture
• Match skin tone and undertone EXACTLY — warm/cool, no color shifts
• Preserve hairstyle, hair color, hair texture, and hair volume precisely
• Maintain body proportions, posture baseline, and physical build
• The result must be indistinguishable from a real photo of THIS specific person

━━━ GARMENT FIDELITY (CRITICAL) ━━━
• Reproduce EVERY visible piece from the product image — if there is a blouse AND a skirt, include BOTH
• Match fabric colors exactly — same hue, saturation, and value. No color drift
• Preserve ALL details: buttons, zippers, seams, stitching, embroidery, lace, pleats, ruffles
• Maintain exact patterns: stripes, florals, geometric prints must match scale and placement
• Reproduce fabric texture faithfully: ribbed knit, smooth silk, denim weave, crepe, chiffon
• Labels, tags, and small brand details should NOT be visible (clean product shot)

━━━ FABRIC PHYSICS & FIT ━━━
${fitContext}
• The garment must drape realistically following gravity and body contours
• Show natural fabric creasing at bend points (elbows, waist, knees) — NOT wrinkled or messy
• Seams must align with the body's center line and shoulder points
• Hemlines must be even and at the correct length relative to the body

━━━ SCENE, STYLING & PHOTOGRAPHY ━━━
${stylingPrompt}

━━━ TECHNICAL REQUIREMENTS ━━━
• Output a single photorealistic image at professional fashion photography quality
• Sharp focus on fabric texture and garment details — thread-level clarity
• Natural skin rendering — visible pores, subtle highlights, no airbrushed plastic look
• Realistic eye reflections matching the scene lighting
• Clean image with no artifacts, no text overlays, no watermarks, no split frames
• Portrait orientation (3:4 aspect ratio)
• The person should appear confident, natural, and alive — NOT posed like a mannequin`;
}

// ═══════════════════════════════════════
// Função principal — 3 chamadas paralelas
// ═══════════════════════════════════════

export async function generateWithGeminiVTO(input: GeminiVTOInput): Promise<GeminiVTOResult> {
  const startTime = Date.now();

  console.log(`[Gemini VTO] 🚀 Iniciando 3 chamadas paralelas ao ${MODEL} (${IMAGE_SIZE})...`);

  // Disparar 3 chamadas INDEPENDENTES em paralelo
  const settled = await Promise.allSettled(
    input.stylingPrompts.map((prompt, index) =>
      generateSingleImage(
        prompt,
        input.productImageBase64,
        input.productMediaType || "image/jpeg",
        input.modelImageBase64,
        input.modelMediaType || "image/jpeg",
        input.bodyType || "normal",
        input.aspectRatio || DEFAULT_ASPECT,
        index
      )
    )
  );

  const images: (GeneratedImage | null)[] = settled.map((r, i) => {
    if (r.status === "fulfilled") return r.value;
    console.warn(
      `[Gemini VTO] ❌ Imagem #${i + 1} falhou: ${(r.reason as Error)?.message || r.reason}`
    );
    return null;
  });

  const successCount = images.filter(Boolean).length;
  const totalDurationMs = Date.now() - startTime;

  console.log(`[Gemini VTO] ✅ ${successCount}/3 imagens geradas em ${totalDurationMs}ms`);

  // Log de custos (fire-and-forget)
  if (input.storeId) {
    logGeminiVTOCosts(input.storeId, input.campaignId, successCount, totalDurationMs)
      .catch((e) => console.warn("[Gemini VTO] Erro ao salvar custo:", e));
  }

  return { images, successCount, totalDurationMs };
}

// ═══════════════════════════════════════
// Geração individual via @google/genai
// ═══════════════════════════════════════

async function generateSingleImage(
  stylingPrompt: string,
  productBase64: string,
  productMime: string,
  modelBase64: string,
  modelMime: string,
  bodyType: string,
  aspectRatio: string,
  index: number
): Promise<GeneratedImage> {
  const start = Date.now();
  const conceptName = `Look ${index + 1}`;
  console.log(`[Gemini VTO] 🎨 #${index + 1} "${conceptName}" — iniciando (${MODEL} ${IMAGE_SIZE})...`);

  const ai = getAI();
  const vtoPrompt = buildVTOPrompt(stylingPrompt, bodyType);

  // Map aspect ratio to Gemini format
  const geminiAspect = mapAspectRatio(aspectRatio);

  const response = await ai.models.generateContent({
    model: MODEL,
    contents: [
      { text: vtoPrompt },
      // IMAGE 1: Model (person)
      {
        inlineData: {
          mimeType: modelMime as any,
          data: modelBase64,
        },
      },
      // IMAGE 2: Product (garment/outfit)
      {
        inlineData: {
          mimeType: productMime as any,
          data: productBase64,
        },
      },
    ],
    config: {
      responseModalities: ["IMAGE", "TEXT"],
      imageConfig: {
        aspectRatio: geminiAspect as any,
        imageSize: IMAGE_SIZE as any,
      },
    },
  });

  // Extrair imagem do response
  const parts = response.candidates?.[0]?.content?.parts || [];
  const imagePart = parts.find((p: any) => p.inlineData);

  if (!imagePart || !(imagePart as any).inlineData) {
    // Verificar se foi bloqueado por segurança
    const candidate = response.candidates?.[0];
    if (candidate?.finishReason === "SAFETY") {
      throw new Error(`Imagem #${index + 1} bloqueada — conteúdo filtrado pelo safety`);
    }
    const textPart = parts.find((p: any) => p.text);
    const reason = (textPart as any)?.text || "sem imagem no response";
    throw new Error(`Gemini não gerou imagem para "${conceptName}": ${reason}`);
  }

  const inlineData = (imagePart as any).inlineData;
  const imageBase64 = inlineData.data as string;
  const mimeType = inlineData.mimeType || "image/png";

  const durationMs = Date.now() - start;
  console.log(`[Gemini VTO] ✅ #${index + 1} "${conceptName}" — ${durationMs}ms (${Math.round(imageBase64.length / 1024)}KB base64)`);

  return {
    conceptName,
    imageBase64,
    imageUrl: "", // será preenchido após upload para Supabase
    mimeType,
    durationMs,
  };
}

// ═══════════════════════════════════════
// Helpers
// ═══════════════════════════════════════

function mapAspectRatio(ratio: string): string {
  const valid = ["1:1", "2:3", "3:2", "3:4", "4:3", "4:5", "5:4", "9:16", "16:9"];
  return valid.includes(ratio) ? ratio : "3:4";
}

// ═══════════════════════════════════════
// Log de custos
// Gemini 3.1 Flash Image: ~$0.04/imagem (2K)
// Input: ~0.001/img, Output: ~0.04/img (1312×1744 ≈ $0.0385/img)
// ═══════════════════════════════════════

async function logGeminiVTOCosts(
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

  // Gemini 3.1 Flash Image 2K: ~$0.04/imagem (input tokens + output image)
  const costPerImage = 0.04;
  const totalCostUsd = costPerImage * successCount;

  const { error } = await supabase.from("api_cost_logs").insert({
    store_id: storeId,
    campaign_id: campaignId || null,
    provider: "google",
    model_used: MODEL,
    action: "gemini_vto_v5",
    cost_usd: totalCostUsd,
    cost_brl: totalCostUsd * exchangeRate,
    exchange_rate: exchangeRate,
    response_time_ms: totalMs,
  });

  if (error) {
    console.warn("[Gemini VTO] ⚠️ Falha ao logar custo:", error.message);
  }
}
