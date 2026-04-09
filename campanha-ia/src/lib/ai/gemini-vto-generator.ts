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
 * - Mais barato: ~$0.04/imagem (2K) vs ~$0.15/imagem (FASHN)
 *
 * Resolução: 2K (~4MP) — ideal para Instagram Stories (1080x1920, 9:16)
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
const DEFAULT_ASPECT = "9:16";

// ═══════════════════════════════════════
// Singleton GoogleGenAI
// ═══════════════════════════════════════

let _ai: GoogleGenAI | null = null;
function getAI(): GoogleGenAI {
  if (!_ai) {
    const apiKey = process.env.GOOGLE_AI_API_KEY || process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("GOOGLE_AI_API_KEY (ou GEMINI_API_KEY) não configurada");
    _ai = new GoogleGenAI({ apiKey });
  }
  return _ai;
}

// ═══════════════════════════════════════
// Prompt de VTO (narrativo — força do Gemini)
// ═══════════════════════════════════════

function buildVTOPrompt(stylingPrompt: string, bodyType: string): string {
  const fitContext = bodyType === "plus"
    ? `BODY TYPE: Plus-size / curvy figure with full bust, soft defined waist, and wide hips.
FIT DIRECTIVES:
- The garment must accommodate her curves without ANY pulling at seams, stretching, or bunching
- Fabric should drape smoothly over bust, follow the natural waist curve, and flow over hips
- Show how the garment flatters her figure — emphasize the silhouette, not hide it
- Ensure armholes are comfortable and necklines sit correctly on a fuller bust
- If the garment has a waistband, it should sit naturally at her waist without digging in
- Choose angles that celebrate her body shape with confidence and beauty`
    : `BODY TYPE: Standard/slim build with naturally proportioned frame.
FIT DIRECTIVES:
- Garment should fit with appropriate ease — not vacuum-sealed to the body, not overly loose
- Fabric falls cleanly along her frame, following natural contours
- Show natural body movement suggesting the garment is comfortable and lived-in`;

  return `You are an elite commercial fashion photographer with 20 years of experience shooting campaigns for Vogue, ELLE, and luxury e-commerce brands.

I am providing exactly TWO reference images:
• IMAGE 1 (first image): THE MODEL — a person whose identity you must preserve EXACTLY in the output.
• IMAGE 2 (second image): THE GARMENT — a product photo showing the clothing piece(s) that must appear on the model.

YOUR MISSION: Produce a SINGLE stunning photorealistic fashion photograph of the person from IMAGE 1 wearing the COMPLETE outfit from IMAGE 2. This image must be indistinguishable from a real professional photoshoot.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SECTION 1: IDENTITY PRESERVATION (NON-NEGOTIABLE)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• The person's face must be a PIXEL-PERFECT match to IMAGE 1
• Reproduce: exact bone structure, eye shape/color/spacing, nose profile, lip shape/fullness, eyebrow arch, jawline, chin shape
• Skin tone and undertone must be IDENTICAL — no color shifting, no lightening, no darkening
• Preserve every natural detail: beauty marks, freckles, dimples, smile lines
• Hair: same texture, color, volume, length, styling, and part line as IMAGE 1
• Body proportions: same build, shoulder width, hip width, height proportions
• The face must pass a "forensic comparison" — clearly the SAME person

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SECTION 2: GARMENT REPRODUCTION (CRITICAL FIDELITY)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• Reproduce EVERY visible piece from IMAGE 2 — if there's a top AND a bottom, BOTH must appear
• If IMAGE 2 shows a SET/CONJUNTO (blouse + skirt, top + pants, dress + jacket), include ALL pieces
• Color matching: exact hue, saturation, and brightness of the original garment — NO color drift
• Pattern fidelity: stripes, florals, geometric prints, animal prints — match scale, rotation, and placement
• Construction details: every button, zipper, snap, hook, seam, stitch line, pocket, belt loop must be visible
• Embellishments: embroidery, lace, sequins, beading, appliqué — render with photographic accuracy
• Fabric texture: you can SEE the fabric type — ribbed knit shows ridges, silk shows sheen, denim shows weave, chiffon shows transparency
• Labels, tags, price stickers: NOT visible (this is a finished campaign shot)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SECTION 3: FABRIC PHYSICS & TAILORING
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${fitContext}

UNIVERSAL PHYSICS RULES:
• Gravity: fabric hangs DOWN and follows body contours — never floats or defies physics
• Creasing: natural fold lines at elbows, behind knees, at waist when seated — NOT wrinkled or messy
• Seam alignment: center-front seam runs down the sternum, shoulder seams sit on the shoulder point
• Hemlines: even, at the correct length, following the garment's design (not riding up or drooping)
• If there's a collar, it sits properly around the neck with even spacing
• Cuffs/sleeves end at the correct anatomical point (wrist bone for long sleeves, mid-upper arm for short)
• The garment looks like it was TAILORED for this specific person

GARMENT PRESENTATION ("IRONED" LOOK):
• The garment must appear FRESHLY PRESSED and WRINKLE-FREE — as if just steamed by a professional stylist
• ❌ NO random wrinkles, NO creases from storage, NO messy bunching of fabric
• ✅ Only NATURAL fold lines at movement points (elbows when bent, behind knees when walking) are allowed
• The fabric must look CRISP, CLEAN, and PRISTINE — like a luxury lookbook
• Sleeves, collars, and hems must be PERFECTLY aligned and smooth
• If the garment has pleats, they must be SHARP and DEFINED
• Think: the garment was just delivered from the dry cleaner and steamed on-set before this photo

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SECTION 4: SCENE, ENVIRONMENT & PHOTOGRAPHY DIRECTION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${stylingPrompt}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SECTION 5: SKIN & HUMAN REALISM
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• Natural skin rendering — visible pores on nose/cheeks, fine texture on forehead
• Realistic highlights on cheekbones, collarbones, and shoulders from the scene lighting
• Natural color variation: slightly pinker on knuckles, elbows, knees
• Eye realism: visible iris detail, natural moisture, catchlights reflecting the scene light source
• Lips with natural color variation and subtle texture
• Hands: 5 fingers each, realistic proportions, natural nail beds
• The person must look ALIVE — natural body weight distribution, relaxed muscles, breathing pose
• NO airbrushing, NO plastic skin, NO uncanny valley perfection

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SECTION 6: FRAMING & CAMERA (CRITICAL)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🚨 MANDATORY FULL-BODY FRAMING:
• The image MUST show the model from HEAD TO FEET — including shoes/sandals/toes
• Frame: ~10% negative space above the head, ~5% below the feet
• The ENTIRE body must be visible — head, torso, arms, hands, legs, feet
• ❌ ABSOLUTELY FORBIDDEN: cropping at waist, cropping at knees, half-body, bust-only
• If in doubt, zoom OUT slightly to ensure nothing is cut off

CAMERA:
• Output: ONE photorealistic image, portrait orientation, 9:16 aspect ratio (Instagram Stories format)
• Resolution quality: 2K high-resolution — sharp detail in fabric texture and skin
• Camera at eye-level or slightly above (1.5m-1.7m from ground), angled to show full figure
• Sharp focus across the entire figure — thread-level garment detail, individual hair strands at edges
• Natural depth of field appropriate to the scene (studio = deeper DOF, outdoor = shallower)
• Clean image: NO text, NO watermarks, NO split frames, NO borders, NO artifacts
• NO duplicated elements, NO extra limbs, NO distorted proportions
• Color output: sRGB color space, balanced exposure, no blown highlights or crushed shadows`;
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
