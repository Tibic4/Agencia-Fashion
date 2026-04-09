/**
 * CriaLook Model Prompt Builder v5.1 — Ultra-Realistic Model Generation
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
 * Otimizado para Gemini 3.1 Flash Image Preview (Nano Banana 2):
 * — Prompts narrativos detalhados → Gemini entende linguagem de fotógrafo
 * — Descrições de anatomia realista → evita "uncanny valley"
 * — Instruções de iluminação profissional → qualidade de estúdio
 */

// ═══════════════════════════════════════
// Descritores composicionais
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

export const BODY_DESC: Record<string, string> = {
  magra: "slim petite build with graceful proportions, naturally slender frame",
  media: "naturally proportioned average build with balanced figure, healthy and fit",
  plus_size: "confident plus-size curvy figure with full bust, defined waist, wide hips, and natural voluminous curves — beautiful and proportional",
};

export const AGE_DESC: Record<string, string> = {
  jovem_18_25: "a youthful 21-year-old with fresh, vibrant skin and a bright youthful energy",
  adulta_26_35: "a 30-year-old woman with refined features and an air of self-assured confidence",
  madura_36_50: "an elegant 42-year-old woman with graceful maturity, fine laugh lines adding character",
};

export const POSE_DESC: Record<string, string> = {
  casual_natural: "She stands in a relaxed, natural pose with weight shifted slightly to her left leg. Her arms hang loosely at her sides with fingers gently curled. Her chin is level, eyes looking directly at camera with a warm, genuine smile showing just a hint of teeth. Her shoulders are relaxed and level, conveying approachability.",
  elegante: "She stands tall with impeccable posture, one hand gently resting on her hip with fingers elegantly spread. Her chin is slightly lifted, creating a poised silhouette. She has a sophisticated closed-lip smile with a subtle raise of one eyebrow, radiating quiet confidence. Her free arm falls gracefully at her side.",
  esportivo: "She stands in an energetic, dynamic stance with feet shoulder-width apart and a slight forward lean suggesting readiness and movement. Her arms are relaxed but active, one slightly bent. She wears a bright, beaming smile with a spark of vitality in her eyes. Her body language exudes health and energy.",
  urbano: "She stands with cool street-style attitude — one shoulder slightly forward, asymmetric stance, weight on her back foot. Her expression is a confident, knowing half-smile with a slightly lowered chin and direct eye contact. One hand casually in her pocket or hooked into a waistband. The overall vibe is effortlessly cool.",
};

// ═══════════════════════════════════════
// Types
// ═══════════════════════════════════════

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
}

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
  const skin = SKIN_DESC[traits.skinTone] || "warm medium complexion";
  const useHairFromPhoto = traits.hairFromPhoto && faceBase64;
  const hair = useHairFromPhoto
    ? null
    : (traits.hairTexture && traits.hairLength && traits.hairColor)
      ? buildHairDescription(traits.hairTexture, traits.hairLength, traits.hairColor)
      : HAIR_DESC[traits.hairStyle] || "soft wavy dark brown hair, shoulder-length";
  const body = BODY_DESC[traits.bodyType] || "average build";
  const age = AGE_DESC[traits.ageRange] || "a 30-year-old woman";
  const pose = POSE_DESC[traits.style] || POSE_DESC.casual_natural;

  const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [];

  if (faceBase64) {
    // ══════════════════════════════════════════════════
    // Modo MULTIMODAL: foto facial + prompt referencial
    // ══════════════════════════════════════════════════
    parts.push({
      inlineData: {
        mimeType: faceMimeType || "image/jpeg",
        data: faceBase64,
      },
    });
    parts.push({ text: buildMultimodalPrompt(skin, hair, body, age, pose, !!useHairFromPhoto) });
  } else {
    // ══════════════════════════════════════════════════
    // Modo TEXT-ONLY: prompt descritivo (sem foto)
    // ══════════════════════════════════════════════════
    parts.push({ text: buildTextOnlyPrompt(skin, hair!, body, age, pose) });
  }

  return parts;
}

// ═══════════════════════════════════════
// Prompt MULTIMODAL (com foto de referência)
// ═══════════════════════════════════════

function buildMultimodalPrompt(
  skin: string,
  hair: string | null,
  body: string,
  age: string,
  pose: string,
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
• Proportions must be anatomically realistic and natural for a Brazilian woman
• Visible collarbones, natural arm/hand proportions, realistic finger detail (5 fingers per hand, natural nail beds)
• Subtle body asymmetry (as in real humans) — not perfectly symmetrical
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
• Plain white crew-neck t-shirt: slightly relaxed fit, soft cotton fabric with visible weave texture, natural small wrinkles at the hem and sleeves, no graphics/logos/text
• Simple black shorts: mid-thigh length, clean hem, matte fabric
• Completely barefoot: natural toes, visible toenails, feet flat on the ground
• NO accessories whatsoever: no rings, bracelets, necklaces, earrings, watches, glasses, hair ties, belts, or bags
• DO NOT carry over ANY clothing or accessories from the reference photo

━━━ POSE & EXPRESSION ━━━
${pose}

━━━ STUDIO LIGHTING & PHOTOGRAPHY (CRITICAL) ━━━
• COMPLETELY DISREGARD any lighting from the reference photo — apply fresh professional studio lighting
• Key light: Large octagonal softbox positioned 45° above-left, creating soft directional modeling on the face
• Fill light: Large white reflector on the right side, filling shadows to a 2:1 ratio (natural, not flat)
• Hair light: Subtle rim light from behind-left, creating a gentle edge separation from background
• Color temperature: 5500K daylight-balanced, neutral white balance
• Catchlight in eyes: Single soft rectangular catchlight reflecting the key light
• Clean seamless infinity white background (#FAFAFA, not pure harsh white)
• Camera: 85mm portrait lens at f/5.6, shot at eye level, full body framing from 10cm above head to 5cm below feet
• Sharp focus across entire figure, slight natural vignette at extreme corners
• Natural skin rendering: visible pores, subtle skin texture, no airbrushing or plastic smoothing
• Realistic shadow beneath feet and subtle body shadow on background

━━━ OUTPUT REQUIREMENTS ━━━
• A SINGLE photorealistic image — indistinguishable from a real studio photograph
• The person must look ALIVE — not a mannequin, doll, or 3D render
• Natural, breathing quality — subtle body weight distribution, relaxed shoulders
• Complete figure visible: top of head to bare toes, nothing cropped
• Portrait orientation (3:4 aspect ratio)
• No text, watermarks, frames, or borders
• No background elements besides the seamless white studio backdrop`;
}

// ═══════════════════════════════════════
// Prompt TEXT-ONLY (sem foto — 100% descritivo)
// ═══════════════════════════════════════

function buildTextOnlyPrompt(
  skin: string,
  hair: string,
  body: string,
  age: string,
  pose: string,
): string {
  return `You are an elite fashion and portrait photographer. Generate a PHOTOREALISTIC full-body studio photograph of a Brazilian fashion model. This image must be indistinguishable from a real photograph taken in a professional studio — NOT a digital illustration, painting, 3D render, or AI-looking image.

━━━ THE PERSON ━━━
• ${age} Brazilian woman — her features should reflect the rich ethnic diversity of Brazil
• Skin: ${skin}
• Hair: ${hair}
• Build: ${body}
• She has a unique, memorable face with individual character — NOT a generic "AI pretty face"
• Natural beauty: subtle imperfections that make her look REAL (a small mole, slightly asymmetric eyebrows, natural skin texture with visible pores)
• Her eyes have depth and life — visible iris detail, natural moisture, genuine catchlights
• Her lips have natural color variation and subtle texture
• Realistic hands with 5 well-defined fingers each, natural nail beds with clean short nails
• Natural body proportions with subtle asymmetry (as in real humans)

━━━ OUTFIT (strict specification) ━━━
• Plain white crew-neck t-shirt: soft cotton with visible fabric texture, slight natural wrinkles at the hem and where the body moves, relaxed comfortable fit — NOT skin-tight, NOT oversized
• Simple black shorts: mid-thigh length, clean matte fabric
• Completely barefoot: realistic feet with natural toes, visible toenails, feet flat on the ground
• NO accessories: no jewelry, no glasses, no watches, no hair accessories, no bags — absolutely nothing extra

━━━ POSE & EXPRESSION ━━━
${pose}

━━━ STUDIO LIGHTING & PHOTOGRAPHY ━━━
• Large octagonal softbox key light positioned 45° above-left, creating soft directional shadows that sculpt the face and body
• White reflector fill from the right, maintaining a natural 2:1 lighting ratio (visible shadows but not harsh)
• Subtle hair/rim light from behind-left creating gentle edge separation from background
• Color temperature: 5500K daylight balanced, perfectly neutral white balance
• Single soft rectangular catchlight visible in both eyes
• Clean seamless infinity white background (#FAFAFA — slightly warm white, not harsh blue-white)
• Camera: 85mm portrait lens at f/5.6, positioned at the model's eye level
• Full body framing: from 10cm above the head to 5cm below the feet — ENTIRE body visible
• Sharp focus across the entire figure with just a hint of natural depth falloff
• Subtle natural shadow beneath her feet grounding her in the space
• Very slight natural vignette at extreme corners (as in real photography)

━━━ SKIN & REALISM DIRECTIVES ━━━
• Natural skin rendering is CRITICAL — this must look like a photograph, NOT a digital painting
• Visible pores on the nose and cheeks (fine, natural, not exaggerated)
• Subtle veins visible on the backs of hands and inner wrists
• Natural skin color variation: slightly pinker on knuckles, elbows, and knees
• Genuine body hair (fine, barely visible arm hair, natural eyebrows)
• If her skin tone is deeper, show how the studio light creates beautiful warm highlights on her cheekbones and shoulders
• NO airbrushing, NO plastic smoothing, NO uncanny valley perfection

━━━ OUTPUT REQUIREMENTS ━━━
• A SINGLE photorealistic studio photograph
• The person must look ALIVE and PRESENT — natural breathing pose, weight distributed realistically
• She should feel like a real person standing in a real studio — not a generated avatar
• Portrait orientation (3:4 aspect ratio)
• No text, watermarks, logos, frames, or borders
• No background elements — only the clean white studio backdrop`;
}
