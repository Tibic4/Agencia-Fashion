/**
 * CriaLook Image Generator v6 — Gemini 3 Pro Image (Nano Banana Pro)
 *
 * Usa o modelo `gemini-3-pro-image-preview` para Virtual Try-On via
 * multi-image fusion nativa do Gemini.
 *
 * Vantagens sobre FASHN tryon-max:
 * - Entende conjuntos (blusa + saia) como peça única
 * - Aceita fotos com fundo poluído (loja, manequim)
 * - Prompt narrativo = controle fino do resultado
 * - Saída em base64 (upload direto pro Supabase, sem CDN temporário)
 * - Thinking sempre ativo = máxima qualidade de composição
 * - Character consistency STRONGEST entre todos os modelos
 *
 * Resolução: 2K (~4MP) — ideal para Instagram Stories (1080x1920, 9:16)
 */

import { getGoogleGenAI } from "./clients";
import { callGeminiSafe } from "./gemini-error-handler";
import { type ModelInfo, buildIdentityLock } from "./identity-translations";
import { computePromptVersion } from "./prompt-version";
import { logModelCost } from "./log-model-cost";

// ═══════════════════════════════════════
// Tipos
// ═══════════════════════════════════════

export interface GeminiVTOInput {
  /** Styling/scene prompt único do Gemini Analyzer (cenário + estilo) */
  stylingPrompt: string;
  /** Base64 da foto principal do produto (sem prefixo data:) */
  productImageBase64: string;
  productMediaType?: string;
  /** Base64 da foto da modelo do banco (sem prefixo data:) */
  modelImageBase64: string;
  modelMediaType?: string;
  /** Base64 do backdrop de referência (estúdio vazio na cor da marca) */
  backdropImageBase64?: string;
  backdropMediaType?: string;
  /** Tipo de corpo */
  bodyType?: "normal" | "plus";
  /** Gênero do modelo */
  gender?: string;
  /**
   * ModelInfo completo da loja → usado pra construir o IDENTITY LOCK
   * (cabelo color/textura/comprimento, pele, idade) que sobrescreve a
   * descrição da cena. Se ausente, cai no fallback genérico ("preserve
   * from IMAGE 1") — funciona mas alucina mais.
   */
  modelInfo?: ModelInfo;
  /** Aspect ratio sugerido */
  aspectRatio?: string;
  /** Store ID para tracking de custos */
  storeId?: string;
  campaignId?: string;
  /** Callback chamado quando a imagem termina */
  onImageComplete?: (success: boolean) => void | Promise<void>;
}

export interface GeneratedImage {
  conceptName: string;
  /** Base64 da imagem gerada (sem prefixo data:) */
  imageBase64: string;
  /** URL opcional — preenchida após upload para Supabase */
  imageUrl: string;
  mimeType: string;
  durationMs: number;
  /** Token usage real do Gemini (quando disponível) */
  tokenUsage?: {
    promptTokenCount: number;
    candidatesTokenCount: number;
    totalTokenCount: number;
  };
}

export interface GeminiVTOResult {
  /** Array de tamanho 1 — null significa que a imagem falhou */
  images: (GeneratedImage | null)[];
  successCount: number;
  totalDurationMs: number;
}

// ═══════════════════════════════════════
// Config
// ═══════════════════════════════════════

const MODEL = "gemini-3-pro-image-preview";
const IMAGE_SIZE = "2K";
const DEFAULT_ASPECT = "9:16";

// ═══════════════════════════════════════
// Prompt de VTO (narrativo — força do Gemini)
// ═══════════════════════════════════════

function buildVTOPrompt(
  stylingPrompt: string,
  bodyType: string,
  gender?: string,
  hasBackdrop?: boolean,
  modelInfo?: ModelInfo,
): string {
  const isMale = gender === 'masculino' || gender === 'male' || gender === 'm';

  // IDENTITY LOCK — bloco prioritário no topo do prompt. Linguagem positiva
  // (afirmações concretas em vez de "do not change") + hex de cor de cabelo
  // ancora muito mais forte que natural language livre. Se modelInfo não
  // tem dados, retorna null e cai pro fallback genérico de preservação.
  const identityLock = buildIdentityLock(modelInfo);

  const fitContext = bodyType === "plus"
    ? (isMale
      ? `BODY TYPE: Robust/heavy-set male build with broad shoulders and stocky frame.
FIT DIRECTIVES:
- The garment must accommodate his build without ANY pulling at seams, stretching, or bunching
- Fabric should drape smoothly over shoulders and chest, following the natural torso shape
- Show how the garment flatters his strong build with confidence
- Ensure armholes are comfortable and necklines sit correctly on a broader chest
- If the garment has a waistband, it should sit naturally without digging in
- Choose angles that project confidence and masculine strength`
      : `BODY TYPE: Plus-size / curvy figure with full bust, soft defined waist, and wide hips.
FIT DIRECTIVES:
- The garment must accommodate her curves without ANY pulling at seams, stretching, or bunching
- Fabric should drape smoothly over bust, follow the natural waist curve, and flow over hips
- Show how the garment flatters her figure — emphasize the silhouette, not hide it
- Ensure armholes are comfortable and necklines sit correctly on a fuller bust
- If the garment has a waistband, it should sit naturally at her waist without digging in
- Choose angles that celebrate her body shape with confidence and beauty`)
    : (isMale
      ? `BODY TYPE: Standard/athletic male build with naturally proportioned frame.
FIT DIRECTIVES:
- Garment should fit with appropriate ease — not vacuum-sealed to the body, not overly loose
- Fabric falls cleanly along his frame, following natural contours
- Show natural body movement suggesting the garment is comfortable and worn-in`
      : `BODY TYPE: Standard/slim build with naturally proportioned frame.
FIT DIRECTIVES:
- Garment should fit with appropriate ease — not vacuum-sealed to the body, not overly loose
- Fabric falls cleanly along her frame, following natural contours
- Show natural body movement suggesting the garment is comfortable and lived-in`);

  const stylingSection = isMale
    ? `SECTION 8: STYLING COMPLETION & POLISH
• Hair: styled appropriately for the outfit mood (textured/swept back for formal, natural/tousled for casual)
• Minimal accessories if appropriate (watch, simple bracelet, sunglasses)
• Clean, well-groomed facial hair — maintain EXACTLY as in IMAGE 1 (beard, stubble, clean-shaven — whatever is shown)
• Nails: clean and well-groomed
• The overall look must feel COMPLETE — as if a professional stylist prepared every detail
• Think: this image will be posted on Instagram by a premium men's fashion brand`
    : `SECTION 8: STYLING COMPLETION & POLISH
• Hair: styled appropriately for the outfit mood (loose waves for casual, updo for formal, etc.)
• Minimal tasteful jewelry that complements without distracting from the garment
• Natural makeup that matches the scene mood (soft glam for editorial, minimal for casual)
• Nails: clean, well-groomed, matching the overall color palette
• The overall look must feel COMPLETE — as if a professional stylist prepared every detail
• Think: this image will be posted on Instagram by a luxury fashion brand`;

  const imageLabels = hasBackdrop
    ? `I am providing reference images in this order:
• FIRST image: THE MODEL — a person whose identity you must preserve EXACTLY in the output.
• SECOND image: THE GARMENT — a product photo showing the clothing piece(s) that must appear on the model.
• LAST image: BACKDROP REFERENCE — an empty studio environment photo. Reproduce this EXACT backdrop
  (wall color, floor, lighting, texture, shadow). Do NOT use any person or object from this image.
  It is ONLY a visual reference for the environment/background of the output photo.
  The floor in the output should remain MATTE — do NOT add glossy reflections of the person on the floor.`
    : `I am providing exactly TWO reference images:
• IMAGE 1 (first image): THE MODEL — a person whose identity you must preserve EXACTLY in the output.
• IMAGE 2 (second image): THE GARMENT — a product photo showing the clothing piece(s) that must appear on the model.`;

  const identityLockBlock = identityLock
    ? `${identityLock}\n\n`
    : "";

  return `You are an elite commercial fashion photographer with 20 years of experience shooting campaigns for Vogue, ELLE, and luxury e-commerce brands.

${identityLockBlock}${imageLabels}

YOUR MISSION: Produce a SINGLE stunning photorealistic fashion photograph of the person from IMAGE 1 wearing the COMPLETE outfit from IMAGE 2. This image must be indistinguishable from a real professional photoshoot.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SECTION 1: IDENTITY PRESERVATION (NON-NEGOTIABLE)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🚨 THE FACE IN THE OUTPUT MUST BE THE EXACT SAME PERSON AS IMAGE 1 — NOT A SIMILAR PERSON.
• ANCHOR POINTS: Use IMAGE 1 as the SOLE identity reference throughout the entire generation process.
  — Before generating ANYTHING, study IMAGE 1 for 5 seconds: memorize the face shape, nose bridge angle, eye spacing ratio, lip thickness, chin line.
• Reproduce: exact bone structure, eye shape/color/spacing, nose profile, lip shape/fullness, eyebrow arch, jawline, chin shape
• Skin tone and undertone must be IDENTICAL — no color shifting, no lightening, no darkening
• Preserve every natural detail: beauty marks, freckles, dimples, smile lines, wrinkles, asymmetries
• Hair: same EXACT texture, color, volume, length, styling, and part line as IMAGE 1 — do NOT change the hairstyle
• Body proportions: same build, shoulder width, hip width, height proportions — match IMAGE 1 exactly
• Age appearance: the generated person must look the SAME AGE as IMAGE 1 — no younger, no older
• The face must pass a "forensic comparison" — a viewer shown IMAGE 1 and the output must say "same person"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SECTION 2: GARMENT REPRODUCTION (CRITICAL FIDELITY)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🔍 STEP 1 — SURFACE MARK SCAN (DO THIS FIRST, BEFORE ANYTHING ELSE):
Study IMAGE 2 carefully for 5 seconds. Look for ANY of these surface details on the garment:
  — Embossed/debossed logos (same color as fabric, visible only by shadow/texture difference)
  — Embroidered logos, monograms, or initials (thread on fabric)
  — Printed brand names, symbols, or icons
  — Tone-on-tone marks (subtle, same-color impressions on the chest, sleeve, or back)
  — Small metal/rubber brand badges or tags sewn onto the fabric
If you find ANY brand mark: you MUST reproduce it in the output at the EXACT same position, scale, and style.
These marks are the garment's IDENTITY — removing them is like removing the person's face.

🚨 BRAND MARK FIDELITY (NON-NEGOTIABLE — SAME PRIORITY AS FACE):
• If IMAGE 2 has a logo/mark on the LEFT CHEST → the output MUST show that SAME mark on the left chest
• If IMAGE 2 has a logo/mark on the RIGHT CHEST → the output MUST show that SAME mark on the right chest
• Embossed/tonal logos (same color as fabric): reproduce the EXACT shadow pattern and dimensional texture
• Embroidered logos: reproduce the thread color, stitch pattern, and raised texture
• Printed logos: reproduce the exact ink color, opacity, and position
• ❌ FORBIDDEN: smoothing over logos, blurring marks, replacing with plain fabric, inventing new logos

• Reproduce EVERY visible piece from IMAGE 2 — if there's a top AND a bottom, BOTH must appear
• If IMAGE 2 shows a SET/CONJUNTO (blouse + skirt, top + pants, dress + jacket), include ALL pieces
• Color matching: exact hue, saturation, and brightness of the original garment — NO color drift
• Pattern fidelity: stripes, florals, geometric prints, animal prints — match scale, rotation, and placement
• Construction details: every button, zipper, snap, hook, seam, stitch line, pocket, belt loop must be visible
• Embellishments: embroidery, lace, sequins, beading, appliqué — render with photographic accuracy
• Fabric texture: you can SEE the fabric type — ribbed knit shows ridges, silk shows sheen, denim shows weave, chiffon shows transparency
• Retail tags, price stickers, hang tags, barcode labels: NOT visible (this is a finished campaign shot)

💠 DENIM / JEANS SPECIAL HANDLING (CRITICAL — MOST COMMON AI COLOR ERROR):
Denim is the fabric AI models get WRONG the most. Follow these rules STRICTLY:
• Study the EXACT wash/shade of the denim in IMAGE 2 — is it raw dark indigo? Medium stonewash? Light acid wash? Black denim? Grey denim?
• The output denim MUST be the EXACT SAME shade and wash as IMAGE 2 — pixel-match the color
• If IMAGE 2 shows dark indigo jeans, the output MUST be dark indigo — NOT medium blue, NOT faded, NOT grey
• If IMAGE 2 shows light wash jeans, the output MUST be light wash — NOT dark, NOT medium
• Preserve the denim’s unique characteristics: whiskering patterns, honeycombs behind knees, selvedge lines, pocket stitching color
• Denim texture: visible diagonal twill weave pattern, with appropriate sheen for the wash type (raw = slight sheen, stonewash = matte)
• ❌ FORBIDDEN: shifting dark indigo to medium blue, shifting medium wash to light, removing whiskering/fading patterns, making black denim look navy

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

🚨 BACKGROUND FIDELITY (CRITICAL):
• If a BACKDROP REFERENCE image was provided (LAST image), reproduce that EXACT environment:
  — Same wall color, same floor color (white matte), same wall-floor junction shadow
  — Same lighting setup, same surface texture, same proportions
  — The floor MUST remain MATTE — no glossy reflections of the model on the floor
• If the scene description above specifies a backdrop color (hex code), reproduce that EXACT color — do NOT approximate
• ❌ FORBIDDEN: inventing a different background style, adding/removing props, changing the lighting setup

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SECTION 5: SKIN & HUMAN REALISM
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• Natural skin rendering — visible pores on nose/cheeks, fine texture on forehead
• Realistic highlights on cheekbones, collarbones, and shoulders from the scene lighting
• Natural color variation: slightly pinker on knuckles, elbows, knees
• Eye realism: visible iris detail, natural moisture, catchlights reflecting the scene light source
• Lips with natural color variation and subtle texture
• The person must look ALIVE — natural body weight distribution, relaxed muscles, breathing pose
• NO airbrushing, NO plastic skin, NO uncanny valley perfection

🚨 HANDS & FINGERS (CRITICAL — AI COMMON FAILURE POINT):
• Each hand has EXACTLY 5 fingers: thumb, index, middle, ring, pinky — COUNT them before finalizing
• Fingers must have 3 visible joints (or 2 for thumb), natural nail beds, and realistic skin folds
• Finger proportions: index ≈ ring > middle > pinky > thumb (in length)
• ❌ ABSOLUTELY FORBIDDEN: 6+ fingers, fused fingers, missing fingers, extra-long fingers, stub fingers
• ❌ NO melted/boneless fingers, NO fingers disappearing into fabric, NO transparent fingers
• Hands should be relaxed or in a natural pose — resting on hip, at sides, touching hair, or holding an accessory
• If a hand is partially behind the body or garment, the VISIBLE portion must still be anatomically correct
• Wrists: normal diameter, visible wrist bones, natural transition from forearm to hand

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
• Clean image: NO text overlays, NO watermarks, NO split frames, NO borders, NO artifacts
• ✅ EXCEPTION: brand logos, labels, or text that are PRINTED/EMBROIDERED/EMBOSSED on the garment fabric itself MUST be preserved — they are part of the garment's design
• NO duplicated elements, NO extra limbs, NO distorted proportions
• Color output: sRGB color space, balanced exposure, no blown highlights or crushed shadows

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SECTION 7: FOOTWEAR & ACCESSORIES (COMPLETE THE LOOK)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• The model MUST wear shoes/sandals that COMPLEMENT and MATCH the garment's style
• Color harmony: shoes should coordinate with the outfit's color palette (not clash)
• Style matching: elegant dress → heels/stilettos; casual outfit → sneakers/flats; beach dress → sandals
• ❌ NO bare feet (unless the garment is swimwear/beachwear)
• ❌ NO mismatched shoes (e.g., sneakers with an evening gown)
• Shoes must be fully visible in the frame (part of the full-body requirement)
• If the garment image shows shoes/sandals, replicate THOSE exact shoes
• If no shoes are visible in the garment image, choose elegant neutral shoes that complement the look

${stylingSection}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SECTION 9: NEGATIVE PROMPT — DO NOT GENERATE ANY OF THESE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
❌ ANATOMICAL ERRORS:
- Extra fingers (6+), missing fingers, fused/melted fingers, stub fingers, boneless hands
- Extra limbs, missing limbs, distorted joints, twisted wrists or ankles
- Teeth errors: extra teeth, missing teeth, metallic teeth, blurred mouth interior
- Ears: distorted, asymmetric placement, missing earlobes, floating earrings

❌ IDENTITY DRIFT:
- Different face than IMAGE 1 — the person must be RECOGNIZABLE, not a "similar-looking" person
- Skin tone change: lighter or darker than the reference
- Eye color change: must match IMAGE 1 exactly
- Different hairstyle, hair color, or hair length than IMAGE 1

❌ GARMENT ERRORS:
- Changing the garment's color (must match IMAGE 2 exactly)
- Adding patterns/prints to a solid-color garment
- Removing buttons, pockets, or construction details visible in IMAGE 2
- Transparent or see-through fabric where it shouldn't be
- Merging separate garment pieces into one (if IMAGE 2 shows a top + skirt, generate BOTH as separate pieces)

❌ TEXTURE & COLOR FIDELITY (CRITICAL — COMMON AI FAILURE):
- NO color shifting: if the garment is cobalt blue in IMAGE 2, it must be cobalt blue in output — not navy, not teal, not royal blue
- 💠 DENIM COLOR LOCK: Denim/jeans are the #1 color-shift failure in AI. If IMAGE 2 contains denim:
  • DARK INDIGO denim → output MUST be dark indigo (NOT medium blue, NOT stonewash, NOT faded)
  • MEDIUM WASH denim → output MUST be medium wash (NOT dark, NOT light)
  • LIGHT/ACID WASH denim → output MUST be light wash (NOT medium, NOT dark)
  • BLACK denim → output MUST be true black (NOT charcoal, NOT dark navy, NOT faded grey)
  • Copy the EXACT tone by matching it to the pixel colors in IMAGE 2 — do NOT interpret or ”improve”
- NO saturation loss: vibrant colors must stay vibrant — do not desaturate or wash out colors
- NO texture simplification: if IMAGE 2 shows smocking/shirring (elastic gathered texture), the output MUST show the same 3D gathered ridges — not smooth fabric
- NO flat shading: fabric must show realistic light interaction — highlights on folds, shadows in creases, specular on satin/silk
- NO plastic/synthetic look: cotton must look like cotton (matte, soft), silk must look like silk (lustrous, flowing), denim must look like denim (textured weave)
- Ribbed knit → visible ribbing ridges | Lace → visible lace pattern holes | Chiffon → visible transparency layers
- Pattern scale must match: if stripes are 2cm wide in IMAGE 2, they must be ~2cm wide on the model — not stretched or compressed
- Color temperature consistency: garment color under studio lighting (IMAGE 2) must look natural under the SCENE lighting — adjust for warm/cool shift but maintain the SAME perceived hue

❌ COMPOSITION ERRORS:
- Overlay text, watermarks, borders, frames, split panels (NOT garment logos — those MUST stay)
- ✅ GARMENT BRAND LOGOS/MARKS: Any logo, monogram, embroidered mark, printed brand name, or embossed symbol that is PART of the garment's fabric/design MUST be faithfully reproduced — do NOT remove, blur, or alter brand identifiers on the clothing
- Multiple people (output ONE person only)
- Cropped body (must be HEAD TO FEET)
- Floating objects, duplicated elements, background artifacts
- Blurry faces, distorted features, uncanny valley expressions`;
}


// ═══════════════════════════════════════
// D-15: prompt_version (cached at module load)
// ═══════════════════════════════════════
// buildVTOPrompt is per-call (interpolates stylingPrompt, bodyType, gender,
// modelInfo) but the change-detectable surface is the static template. We
// hash a canonical "no styling, normal body, no model info, no backdrop"
// rendering so the SHA flips when the template text is edited and stays
// stable across per-call substitutions. Sentinel scene token chosen to be
// short + unambiguous so the hash isn't dominated by user input.
const VTO_TEMPLATE_PROMPT = buildVTOPrompt(
  "__SCENE__",
  "normal",
  undefined,
  false,
  undefined,
);
export const VTO_PROMPT_VERSION = computePromptVersion(VTO_TEMPLATE_PROMPT);

// ═══════════════════════════════════════
// Função principal — chamada única (foto única universal)
// ═══════════════════════════════════════

export async function generateWithGeminiVTO(input: GeminiVTOInput): Promise<GeminiVTOResult> {
  const startTime = Date.now();

  console.log(`[Gemini VTO] 🚀 Iniciando chamada ao ${MODEL} (${IMAGE_SIZE})...`);

  let image: GeneratedImage | null = null;
  try {
    image = await generateSingleImage(
      input.stylingPrompt,
      input.productImageBase64,
      input.productMediaType || "image/jpeg",
      input.modelImageBase64,
      input.modelMediaType || "image/jpeg",
      input.bodyType || "normal",
      input.aspectRatio || DEFAULT_ASPECT,
      0,
      input.gender,
      input.backdropImageBase64,
      input.backdropMediaType,
      input.modelInfo,
    );
    await input.onImageComplete?.(true);
  } catch (err) {
    console.warn(
      `[Gemini VTO] ❌ Imagem falhou: ${(err as Error)?.message || err}`,
    );
    await input.onImageComplete?.(false);
  }

  const images: (GeneratedImage | null)[] = [image];
  const successCount = image ? 1 : 0;
  const totalDurationMs = Date.now() - startTime;

  console.log(`[Gemini VTO] ✅ ${successCount}/1 imagem gerada em ${totalDurationMs}ms`);

  // Tokens reais da imagem (se houve sucesso)
  const realInputTokens = image?.tokenUsage?.promptTokenCount ?? 0;
  const realOutputTokens = image?.tokenUsage?.candidatesTokenCount ?? 0;
  const hasRealTokens = realInputTokens > 0 && realOutputTokens > 0;

  // Log de custos (fire-and-forget — D-18 helper)
  if (input.storeId) {
    logModelCost({
      storeId: input.storeId,
      campaignId: input.campaignId,
      provider: "google",
      model: MODEL,
      action: "gemini_vto_v6",
      usage: hasRealTokens
        ? { inputTokens: realInputTokens, outputTokens: realOutputTokens }
        : undefined,
      durationMs: totalDurationMs,
      promptVersion: VTO_PROMPT_VERSION,
    }).catch((e) => console.warn("[Gemini VTO] cost-log failed:", e?.message ?? e));
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
  index: number,
  gender?: string,
  backdropBase64?: string,
  backdropMime?: string,
  modelInfo?: ModelInfo,
): Promise<GeneratedImage> {
  const start = Date.now();
  const conceptName = `Look ${index + 1}`;
  console.log(`[Gemini VTO] 🎨 #${index + 1} "${conceptName}" — iniciando (${MODEL} ${IMAGE_SIZE})...`);

  const ai = getGoogleGenAI();
  const hasBackdrop = !!backdropBase64;
  const vtoPrompt = buildVTOPrompt(stylingPrompt, bodyType, gender, hasBackdrop, modelInfo);

  // Map aspect ratio to Gemini format
  const geminiAspect = mapAspectRatio(aspectRatio);

  const response = await callGeminiSafe(
    () => ai.models.generateContent({
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
        // LAST IMAGE: Backdrop reference (if provided)
        ...(backdropBase64 ? [{
          inlineData: {
            mimeType: (backdropMime || "image/png") as any,
            data: backdropBase64,
          },
        }] : []),
      ],
      config: {
        responseModalities: ["IMAGE", "TEXT"],
        imageConfig: {
          aspectRatio: geminiAspect as any,
          imageSize: IMAGE_SIZE as any,
        },
        // Pro model has thinking ALWAYS ON — no thinkingConfig needed
      },
    }),
    { label: `Gemini VTO #${index + 1}`, maxRetries: 1, backoffMs: 4000 }
  );

  // Extrair imagem do response
  const parts = response.candidates?.[0]?.content?.parts || [];
  const imagePart = parts.find((p: any) => p.inlineData);

  if (!imagePart || !(imagePart as any).inlineData) {
    // Verificar se foi bloqueado por segurança
    const candidate = response.candidates?.[0];
    if (candidate?.finishReason === "SAFETY") {
      throw new Error(`Conteúdo bloqueado pela IA. Envie apenas fotos de peças de roupa.`);
    }
    const textPart = parts.find((p: any) => p.text);
    const reason = (textPart as any)?.text || "sem imagem no response";
    throw new Error(`A IA não conseguiu gerar a foto "${conceptName}". Tente novamente.`);
  }

  const inlineData = (imagePart as any).inlineData;
  const imageBase64 = inlineData.data as string;
  const mimeType = inlineData.mimeType || "image/png";

  // Extrair token usage real do response
  const usage = response.usageMetadata;
  const tokenUsage = usage ? {
    promptTokenCount: (usage as any).promptTokenCount || 0,
    candidatesTokenCount: (usage as any).candidatesTokenCount || 0,
    totalTokenCount: (usage as any).totalTokenCount || 0,
  } : undefined;

  const durationMs = Date.now() - start;
  console.log(
    `[Gemini VTO] ✅ #${index + 1} "${conceptName}" — ${durationMs}ms` +
    ` (${Math.round(imageBase64.length / 1024)}KB base64)` +
    (tokenUsage ? ` [tokens: ${tokenUsage.promptTokenCount} in / ${tokenUsage.candidatesTokenCount} out]` : "")
  );

  return {
    conceptName,
    imageBase64,
    imageUrl: "", // será preenchido após upload para Supabase
    mimeType,
    durationMs,
    tokenUsage,
  };
}

// ═══════════════════════════════════════
// Helpers
// ═══════════════════════════════════════

function mapAspectRatio(ratio: string): string {
  const valid = ["1:1", "2:3", "3:2", "3:4", "4:3", "4:5", "5:4", "9:16", "16:9", "21:9", "1:4", "4:1", "1:8", "8:1"];
  return valid.includes(ratio) ? ratio : "9:16"; // fallback alinhado com DEFAULT_ASPECT
}

// ═══════════════════════════════════════
// Cost logging — D-18: consolidated into lib/ai/log-model-cost.ts
// ═══════════════════════════════════════
// `logGeminiVTOCosts` previously lived here. Replaced by a direct
// `logModelCost({...})` call at the fire-and-forget site above. See
// `lib/ai/log-model-cost.ts` for the consolidated helper and
// `lib/pricing/fallbacks.ts` for the per-image fallback constants
// (FALLBACK_TOKENS["gemini_vto_v6"]) that used to be inline here.
//
// NOTE: pipeline v7 generates exactly one image per campaign (foto única
// universal), so the per-image fallback values from the deleted function
// (4600 in / 4000 out) translate directly to the per-call fallback in
// FALLBACK_TOKENS without a successCount multiplier.

