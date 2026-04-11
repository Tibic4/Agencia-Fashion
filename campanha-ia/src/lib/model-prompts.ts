/**
 * CriaLook Model Prompt Builder v6.1 — Anti-Hallucination Studio Lighting
 *
 * Prompts centralizados para geração de preview de modelo virtual.
 * Usados tanto pelo model-preview.ts (fallback direto) quanto pelo Inngest (background job).
 *
 * ALTERE AQUI para modificar prompts — ambos os fluxos herdam automaticamente.
 *
 * Dois modos:
 *   1. MULTIMODAL (com foto) — Gemini replica a face da foto + corpo/cabelo conforme specs
 *   2. TEXT-ONLY (sem foto) — Gemini gera modelo 100% do zero, fotorrealista
 *
 * v6.1 — Novidades:
 *   - Iluminação simplificada: descreve EFEITO, não equipamento (anti guarda-chuva)
 *   - Negativas explícitas contra equipamento de estúdio visível
 *   - Aspect ratio 3:4 (menos espaço vazio = menos delírios)
 *   - Fundo reforçado: "COMPLETELY EMPTY", "absolutely NOTHING"
 */

// ═══════════════════════════════════════
// Descritores composicionais — COMUNS
// ═══════════════════════════════════════

export const SKIN_DESC: Record<string, string> = {
  branca: "fair/light complexion with warm peachy undertones, natural flush on cheeks",
  morena_clara: "light olive/honey-toned complexion with golden undertones, sun-kissed warmth",
  morena: "warm medium-brown complexion with rich caramel undertones, even smooth tone",
  negra: "deep rich dark-brown complexion with beautiful warm undertones, luminous healthy glow",
};

export const HAIR_TEXTURE_DESC: Record<string, string> = {
  liso: "sleek straight shiny",
  ondulado: "soft naturally wavy with gentle S-curves",
  cacheado: "voluminous well-defined curly with bounce",
  crespo: "beautiful natural afro-textured coily with volume and definition",
};

export const HAIR_LENGTH_DESC: Record<string, string> = {
  raspado: "buzz cut / very short cropped close to the scalp",
  joaozinho: "close-cropped pixie cut framing the face",
  chanel: "chin-length structured bob cut",
  ombro: "shoulder-length with subtle layers",
  medio: "mid-back length, flowing with natural movement",
  longo: "long waist-length with healthy flowing ends",
};

export const HAIR_COLOR_DESC: Record<string, string> = {
  preto: "jet black with subtle blue-black sheen",
  castanho_escuro: "deep dark brown with chocolate tones",
  castanho: "warm chestnut brown with subtle caramel highlights",
  ruivo: "rich auburn red with copper undertones",
  loiro_escuro: "warm honey-blonde with darker roots",
  loiro: "light golden blonde with sun-kissed dimension",
  platinado: "cool-toned platinum blonde with silvery sheen",
};

/** Legado — fallback para modelos antigos com hair_style único */
export const HAIR_DESC: Record<string, string> = {
  liso: "sleek straight dark brown hair with natural shine, shoulder-length",
  ondulado: "soft wavy chestnut brown hair with gentle volume, mid-back length",
  cacheado: "voluminous curly dark brown hair with well-defined ringlets, mid-back length",
  crespo: "beautiful natural afro-textured coily black hair with volume and definition",
  curto: "stylish short-cropped dark brown hair in a chic pixie cut",
};

/**
 * Compõe descrição de cabelo a partir de 3 campos granulares.
 * Ex: "voluminous well-defined curly auburn red hair with copper undertones, mid-back length"
 */
export function buildHairDescription(texture?: string, length?: string, color?: string): string {
  const t = HAIR_TEXTURE_DESC[texture || ""] || "soft naturally wavy";
  const l = HAIR_LENGTH_DESC[length || ""] || "shoulder-length";
  const c = HAIR_COLOR_DESC[color || ""] || "dark brown";
  return `${t} ${c} hair, ${l}`;
}

// ═══════════════════════════════════════
// Descritores — FEMININO
// ═══════════════════════════════════════

export const BODY_DESC_F: Record<string, string> = {
  magra: "slim petite build with graceful proportions, naturally slender frame",
  media: "naturally proportioned average build with balanced figure, healthy and fit",
  plus_size: "confident plus-size curvy figure with full bust, defined waist, wide hips, and natural voluminous curves — beautiful and proportional",
};

export const AGE_DESC_F: Record<string, string> = {
  jovem_18_25: "a youthful 21-year-old woman with fresh, vibrant skin and a bright youthful energy",
  adulta_26_35: "a 30-year-old woman with refined features and an air of self-assured confidence",
  madura_36_50: "an elegant 42-year-old woman with graceful maturity, fine laugh lines adding character",
};

// ═══════════════════════════════════════
// Descritores — MASCULINO
// ═══════════════════════════════════════

export const BODY_DESC_M: Record<string, string> = {
  atletico: "athletic lean muscular build with defined shoulders and torso, natural V-taper",
  medio: "naturally proportioned average male build with balanced frame, healthy and fit",
  robusto: "strong broad-shouldered husky build with solid frame, naturally large and powerful",
};

export const AGE_DESC_M: Record<string, string> = {
  jovem_18_25: "a youthful 21-year-old man with fresh features and energetic presence",
  adulto_26_35: "a 30-year-old man with defined jawline and self-assured confidence",
  maduro_36_50: "a distinguished 42-year-old man with mature features, subtle crow's feet adding character",
};

// ═══════════════════════════════════════
// POSE — simplificada (A-Pose) para menos alucinação
// Mesma pose para ambos os gêneros
// ═══════════════════════════════════════

export const POSE_SIMPLE = `POSE (A-POSE — CRITICAL for anatomical accuracy):
The model stands in a SIMPLE, RELAXED A-POSE facing the camera directly:
- Feet hip-width apart, flat on the ground, weight evenly distributed
- Arms relaxed at sides, slightly away from the body (~15 degrees), palms facing inward
- Fingers naturally slightly curled and SEPARATED — do NOT clench fists or interlock fingers
- Chin level, eyes looking directly at camera with a natural, relaxed expression (slight closed-lip smile)
- Shoulders relaxed and level, back straight, natural upright posture
- This is a NEUTRAL pose — do NOT put hands on hips, do NOT bend arms, do NOT cross legs`;

// ═══════════════════════════════════════
// Descritores legado — backward compat
// ═══════════════════════════════════════

/** @deprecated Use BODY_DESC_F */
export const BODY_DESC = BODY_DESC_F;
/** @deprecated Use AGE_DESC_F */
export const AGE_DESC = AGE_DESC_F;
/** @deprecated Use POSE_SIMPLE */
export const POSE_DESC: Record<string, string> = {
  casual_natural: POSE_SIMPLE,
  elegante: POSE_SIMPLE,
  esportivo: POSE_SIMPLE,
  urbano: POSE_SIMPLE,
};

// ═══════════════════════════════════════
// Types
// ═══════════════════════════════════════

export type Gender = "feminino" | "masculino";

export interface PromptTraits {
  skinTone: string;
  /** Legado — usado como fallback se granulares não vierem */
  hairStyle: string;
  /** Novos campos granulares (opcionais para backward compat) */
  hairTexture?: string;
  hairLength?: string;
  hairColor?: string;
  /** Se true, replica o cabelo da foto de referência */
  hairFromPhoto?: boolean;
  bodyType: string;
  style: string;
  ageRange: string;
  /** Gênero do modelo (default: feminino) */
  gender?: Gender;
}

// ═══════════════════════════════════════
// Helpers de gênero
// ═══════════════════════════════════════

function getBodyDesc(gender: Gender, bodyType: string): string {
  if (gender === "masculino") {
    return BODY_DESC_M[bodyType] || "average male build";
  }
  return BODY_DESC_F[bodyType] || "average build";
}

function getAgeDesc(gender: Gender, ageRange: string): string {
  if (gender === "masculino") {
    return AGE_DESC_M[ageRange] || AGE_DESC_M["adulto_26_35"] || "a 30-year-old man";
  }
  return AGE_DESC_F[ageRange] || "a 30-year-old woman";
}

function getGenderWord(gender: Gender): { person: string; pronoun: string; possessive: string; nationality: string } {
  if (gender === "masculino") {
    return { person: "man", pronoun: "he", possessive: "his", nationality: "Brazilian man" };
  }
  return { person: "woman", pronoun: "she", possessive: "her", nationality: "Brazilian woman" };
}

function getOutfitDesc(gender: Gender): string {
  if (gender === "masculino") {
    return `• Plain white crew-neck t-shirt: slightly relaxed fit, soft cotton fabric with visible weave texture, natural small wrinkles at the hem and sleeves, no graphics/logos/text
• Simple black shorts: above-the-knee length, clean hem, matte fabric
• Completely barefoot: natural toes, visible toenails, feet flat on the ground
• NO accessories whatsoever: no rings, bracelets, necklaces, watches, glasses, hats, belts, or bags`;
  }
  return `• Plain white crew-neck t-shirt: slightly relaxed fit, soft cotton fabric with visible weave texture, natural small wrinkles at the hem and sleeves, no graphics/logos/text
• Simple black shorts: mid-thigh length, clean hem, matte fabric
• Completely barefoot: natural toes, visible toenails, feet flat on the ground
• NO accessories whatsoever: no rings, bracelets, necklaces, earrings, watches, glasses, hair ties, belts, or bags`;
}

// ═══════════════════════════════════════
// Anatomia — guard contra alucinações
// ═══════════════════════════════════════

const ANATOMY_GUARD = `━━━ ANATOMY VERIFICATION (MANDATORY — check before finalizing) ━━━
• EXACTLY 5 fingers on EACH hand — count them carefully. No extra, no missing, no fused fingers.
• EXACTLY 5 toes on EACH foot — all visible, natural, correctly proportioned.
• Both hands fully visible with fingers SEPARATED and relaxed — do NOT hide hands behind body.
• Palms face inward toward the thighs in a natural resting position.
• Two arms, two legs — anatomically correct proportions and positions.
• Natural nail beds on both fingers and toes.
• Subtle body asymmetry (as in real humans) — not perfectly symmetrical.
• The body transitions SEAMLESSLY from the face — no visible "seam" at the neck.`;

// ═══════════════════════════════════════
// Prompt Builder principal
// ═══════════════════════════════════════

/**
 * Monta as parts para o request do Gemini.
 * Se faceBase64 está presente → modo multimodal (foto + prompt referencial).
 * Senão → modo text-only (prompt descritivo).
 */
export function buildGeminiParts(
  traits: PromptTraits,
  faceBase64?: string | null,
  faceMimeType?: string,
): Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> {
  const gender: Gender = traits.gender || "feminino";
  const skin = SKIN_DESC[traits.skinTone] || "warm medium complexion";
  const useHairFromPhoto = traits.hairFromPhoto && faceBase64;
  const hair = useHairFromPhoto
    ? null
    : (traits.hairTexture && traits.hairLength && traits.hairColor)
      ? buildHairDescription(traits.hairTexture, traits.hairLength, traits.hairColor)
      : HAIR_DESC[traits.hairStyle] || "soft wavy dark brown hair, shoulder-length";
  const body = getBodyDesc(gender, traits.bodyType);
  const age = getAgeDesc(gender, traits.ageRange);
  const g = getGenderWord(gender);

  const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [];

  if (faceBase64) {
    parts.push({
      inlineData: {
        mimeType: faceMimeType || "image/jpeg",
        data: faceBase64,
      },
    });
    parts.push({ text: buildMultimodalPrompt(skin, hair, body, age, g, !!useHairFromPhoto) });
  } else {
    parts.push({ text: buildTextOnlyPrompt(skin, hair!, body, age, g) });
  }

  return parts;
}

// ═══════════════════════════════════════
// Prompt MULTIMODAL (com foto de referência)
// ═══════════════════════════════════════

interface GenderWords {
  person: string;
  pronoun: string;
  possessive: string;
  nationality: string;
}

function buildMultimodalPrompt(
  skin: string,
  hair: string | null,
  body: string,
  age: string,
  g: GenderWords,
  useHairFromPhoto: boolean,
): string {
  return `You are an elite fashion and portrait photographer specializing in photorealistic model photography for premium e-commerce brands.

I am providing ONE reference photo showing a person's face. Your task is to generate a PHOTOREALISTIC full-body studio photograph using this face as the identity anchor.

━━━ FACE & IDENTITY (from reference photo — HIGHEST PRIORITY) ━━━
• Reproduce the EXACT facial structure with sub-millimeter precision: bone structure, eye shape and color, nose bridge and tip, lip shape and fullness, eyebrow arch and thickness, jawline contour, chin shape
• Match the skin complexion and undertones EXACTLY as photographed — ${skin}
• Preserve any natural beauty marks, freckles, or dimples visible in the reference
• The face must pass a "side-by-side comparison test" — it should be recognizable as the exact same person
• Maintain natural micro-expressions: subtle crow's feet when smiling, nasolabial folds, forehead creases
• NEVER idealize, smooth, or "beautify" the face — preserve its authentic character

━━━ BODY (INDEPENDENT from reference — use these specifications) ━━━
• Build: ${body}
• Age context: ${age}
• This body type is MANDATORY regardless of what the reference photo may suggest
• Proportions must be anatomically realistic and natural for a ${g.nationality}
• Visible collarbones, natural arm/hand proportions, realistic finger detail
• The body should transition SEAMLESSLY from the face — no visible "seam" at the neck

━━━ HAIR ━━━${useHairFromPhoto ? `
• REPLICATE the EXACT hair from the reference photo: texture, color, length, volume, part line, and styling
• Preserve the natural fall pattern and how it frames the face
• Maintain any highlights, lowlights, or natural color variation visible in the reference
• This is the person's real hair — maintain it EXACTLY as photographed` : `
• Hair: ${hair}
• The hair MUST match this description — do NOT copy hair from the reference photo
• Ensure the hair looks naturally attached to the scalp with realistic hairline
• Individual strand visibility at the edges, natural light play through hair strands
• Volume and movement should match the specified texture`}

━━━ OUTFIT (strict specification) ━━━
${getOutfitDesc(g.person === "man" ? "masculino" : "feminino")}
• DO NOT carry over ANY clothing or accessories from the reference photo

━━━ ${POSE_SIMPLE} ━━━

${ANATOMY_GUARD}

━━━ STUDIO LIGHTING & PHOTOGRAPHY (CRITICAL) ━━━
• COMPLETELY DISREGARD any lighting from the reference photo — apply fresh professional studio lighting
• Soft, even, professional studio lighting with gentle directional shadows that sculpt the face and body naturally
• Subtle edge separation between the person and the background — a gentle glow, not harsh contrast
• Color temperature: neutral daylight-balanced, clean white balance
• Natural catchlight in both eyes
• Clean seamless PLAIN white background (#FAFAFA) — absolutely NOTHING else in the background
• Camera: shot at eye level, full body framing from 10cm above head to 5cm below feet
• Sharp focus across entire figure
• Natural skin rendering: visible pores, subtle skin texture, no airbrushing or plastic smoothing
• Realistic shadow beneath feet grounding the person in the space

━━━ OUTPUT REQUIREMENTS ━━━
• A SINGLE photorealistic image — indistinguishable from a real studio photograph
• The person must look ALIVE — not a mannequin, doll, or 3D render
• Natural, breathing quality — subtle body weight distribution, relaxed shoulders
• Complete figure visible: top of head to bare toes, nothing cropped
• Portrait orientation (3:4 aspect ratio)
• No text, watermarks, frames, or borders
• NO visible lighting equipment, softboxes, umbrellas, reflectors, or studio gear
• NO background elements, props, furniture, or objects — ONLY the clean white backdrop
• The background must be COMPLETELY EMPTY — just a plain seamless white surface`;
}

// ═══════════════════════════════════════
// Prompt TEXT-ONLY (sem foto — 100% descritivo)
// ═══════════════════════════════════════

function buildTextOnlyPrompt(
  skin: string,
  hair: string,
  body: string,
  age: string,
  g: GenderWords,
): string {
  return `You are an elite fashion and portrait photographer. Generate a PHOTOREALISTIC full-body studio photograph of a ${g.nationality} fashion model. This image must be indistinguishable from a real photograph taken in a professional studio — NOT a digital illustration, painting, 3D render, or AI-looking image.

━━━ THE PERSON ━━━
• ${age} — ${g.possessive} features should reflect the rich ethnic diversity of Brazil
• Skin: ${skin}
• Hair: ${hair}
• Build: ${body}
• ${g.pronoun.charAt(0).toUpperCase() + g.pronoun.slice(1)} has a unique, memorable face with individual character — NOT a generic "AI pretty face"
• Natural beauty: subtle imperfections that make ${g.pronoun} look REAL (a small mole, slightly asymmetric eyebrows, natural skin texture with visible pores)
• ${g.possessive.charAt(0).toUpperCase() + g.possessive.slice(1)} eyes have depth and life — visible iris detail, natural moisture, genuine catchlights
• Realistic hands with 5 well-defined fingers each, natural nail beds with clean short nails
• Natural body proportions with subtle asymmetry (as in real humans)

━━━ OUTFIT (strict specification) ━━━
${getOutfitDesc(g.person === "man" ? "masculino" : "feminino")}

━━━ ${POSE_SIMPLE} ━━━

${ANATOMY_GUARD}

━━━ STUDIO LIGHTING & PHOTOGRAPHY ━━━
• Soft, even, professional studio lighting with gentle directional shadows that sculpt the face and body naturally
• Subtle edge separation between the person and the background — a gentle glow, not harsh contrast
• Color temperature: neutral daylight balanced, clean white balance
• Natural catchlight visible in both eyes
• Clean seamless PLAIN white background (#FAFAFA) — absolutely NOTHING else in the background
• Camera: shot at the model's eye level
• Full body framing: from 10cm above the head to 5cm below the feet — ENTIRE body visible
• Sharp focus across the entire figure
• Subtle natural shadow beneath feet grounding the person in the space

━━━ SKIN & REALISM DIRECTIVES ━━━
• Natural skin rendering is CRITICAL — this must look like a photograph, NOT a digital painting
• Visible pores on the nose and cheeks (fine, natural, not exaggerated)
• Subtle veins visible on the backs of hands and inner wrists
• Natural skin color variation: slightly pinker on knuckles, elbows, and knees
• Genuine body hair (fine, barely visible arm hair, natural eyebrows)
• NO airbrushing, NO plastic smoothing, NO uncanny valley perfection

━━━ OUTPUT REQUIREMENTS ━━━
• A SINGLE photorealistic studio photograph
• The person must look ALIVE and PRESENT — natural breathing pose, weight distributed realistically
• ${g.pronoun.charAt(0).toUpperCase() + g.pronoun.slice(1)} should feel like a real person standing in a real studio — not a generated avatar
• Portrait orientation (3:4 aspect ratio)
• No text, watermarks, logos, frames, or borders
• NO visible lighting equipment, softboxes, umbrellas, reflectors, or studio gear
• NO background elements, props, furniture, or objects — ONLY the clean white backdrop
• The background must be COMPLETELY EMPTY — just a plain seamless white surface`;
}
