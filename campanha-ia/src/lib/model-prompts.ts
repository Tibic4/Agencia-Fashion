/**
 * Prompt builders centralizados para geração de preview de modelo.
 * Usados tanto pelo Inngest (background) quanto pelo model-preview.ts (fallback).
 * Altere AQUI para modificar prompts — ambos os fluxos herdam.
 */

// ── Descritores otimizados para Gemini Image Generation ──
export const SKIN_DESC: Record<string, string> = {
  branca: "fair/light complexion, warm undertones",
  morena_clara: "light olive/honey-toned complexion",
  morena: "warm medium-brown complexion",
  negra: "rich dark-brown complexion, deep skin tone",
};
// ── Cabelo: 3 dimensões composicionais ──

export const HAIR_TEXTURE_DESC: Record<string, string> = {
  liso: "sleek straight",
  ondulado: "soft wavy",
  cacheado: "voluminous curly",
  crespo: "beautiful afro-textured coily",
};

export const HAIR_LENGTH_DESC: Record<string, string> = {
  joaozinho: "close-cropped pixie cut",
  chanel: "chin-length bob",
  ombro: "shoulder-length",
  medio: "mid-back length, flowing",
  longo: "long waist-length, flowing",
};

export const HAIR_COLOR_DESC: Record<string, string> = {
  preto: "black",
  castanho_escuro: "dark brown",
  castanho: "chestnut brown",
  ruivo: "auburn red",
  loiro_escuro: "honey-blonde",
  loiro: "light blonde",
  platinado: "platinum blonde",
};

/** Legado — fallback para modelos antigos com hair_style único */
export const HAIR_DESC: Record<string, string> = {
  liso: "sleek straight dark brown hair, shoulder-length",
  ondulado: "soft wavy chestnut brown hair, mid-back length",
  cacheado: "voluminous curly dark brown hair, mid-back length",
  crespo: "beautiful afro-textured coily black hair, natural volume",
  curto: "stylish short-cropped dark brown hair, pixie cut",
};

/**
 * Compõe descrição de cabelo a partir de 3 campos granulares.
 * Ex: "voluminous curly auburn red hair, mid-back length"
 */
export function buildHairDescription(texture?: string, length?: string, color?: string): string {
  const t = HAIR_TEXTURE_DESC[texture || ""] || "soft wavy";
  const l = HAIR_LENGTH_DESC[length || ""] || "shoulder-length";
  const c = HAIR_COLOR_DESC[color || ""] || "dark brown";
  return `${t} ${c} hair, ${l}`;
}

export const BODY_DESC: Record<string, string> = {
  magra: "slim athletic silhouette",
  media: "naturally proportioned average build",
  plus_size: "confident plus-size curvy figure, full hips and natural curves",
};

export const AGE_DESC: Record<string, string> = {
  jovem_18_25: "a youthful 20-year-old",
  adulta_26_35: "a 30-year-old",
  madura_36_50: "an elegant 40-year-old",
};

export const POSE_DESC: Record<string, string> = {
  casual_natural: "Standing relaxed with a warm, approachable smile. Arms naturally at her sides, weight slightly on one leg.",
  elegante: "Poised and confident with one hand gently resting on her hip. Chin slightly lifted, subtle sophisticated smile.",
  esportivo: "Dynamic stance with energy and movement. Bright expression, slight forward lean suggesting motion.",
  urbano: "Cool asymmetric stance with street-style attitude. One shoulder slightly forward, confident gaze.",
};

export interface PromptTraits {
  skinTone: string;
  /** Legado — usado como fallback se granulares não vierem */
  hairStyle: string;
  /** Novos campos granulares (opcionais para backward compat) */
  hairTexture?: string;
  hairLength?: string;
  hairColor?: string;
  bodyType: string;
  style: string;
  ageRange: string;
}

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
  // Priorizar campos granulares, fallback para legado
  const hair = (traits.hairTexture && traits.hairLength && traits.hairColor)
    ? buildHairDescription(traits.hairTexture, traits.hairLength, traits.hairColor)
    : HAIR_DESC[traits.hairStyle] || "soft wavy dark brown hair, shoulder-length";
  const body = BODY_DESC[traits.bodyType] || "average build";
  const age = AGE_DESC[traits.ageRange] || "a 30-year-old";
  const pose = POSE_DESC[traits.style] || "Standing relaxed with a natural, friendly expression.";

  const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [];

  if (faceBase64) {
    // ── Modo MULTIMODAL: foto facial + prompt referencial ──
    parts.push({
      inlineData: {
        mimeType: faceMimeType || "image/jpeg",
        data: faceBase64,
      },
    });
    parts.push({ text: [
      `You are given a reference photo showing ONLY a face. Generate a photorealistic full-body studio photograph using this face as identity reference.`,
      ``,
      `FACE IDENTITY (from reference photo):`,
      `- Reproduce the EXACT facial structure: eye shape, nose, lips, eyebrows, jawline`,
      `- Match the skin complexion and undertones exactly as shown`,
      `- Preserve the facial expression style and overall likeness`,
      `- DO NOT alter the face shape, features, or skin color`,
      ``,
      `BODY (INDEPENDENT from reference — use these specifications):`,
      `- Build: ${body}`,
      `- This body type is MANDATORY regardless of what the reference photo may suggest`,
      `- Height: proportional for ${age} Brazilian woman`,
      ``,
      `HAIR: ${hair}`,
      `- The hair style, color, and length MUST match the specification above`,
      `- DO NOT copy the hair from the reference photo — use ONLY the specified description`,
      ``,
      `OUTFIT: Plain white crew-neck t-shirt and simple black shorts. Barefoot.`,
      `DO NOT add any accessories, jewelry, glasses, or extra clothing items.`,
      `DO NOT carry over any clothing or accessories from the reference photo.`,
      ``,
      `POSE: ${pose}`,
      ``,
      `LIGHTING NORMALIZATION (CRITICAL):`,
      `- COMPLETELY IGNORE any lighting, shadows, or color cast from the reference photo`,
      `- Apply fresh professional studio lighting: soft key light from 45° above-left, fill light from right`,
      `- The output must look like a professional studio shoot regardless of reference photo quality`,
      `- If the reference photo is dark, overexposed, warm-tinted, or has mixed lighting — normalize everything`,
      ``,
      `PHOTOGRAPHY:`,
      `- Professional e-commerce fashion photography`,
      `- Clean seamless white background (#FFFFFF)`,
      `- Camera at eye level, 85mm portrait lens, full body framing from top of head to toes`,
      `- Sharp focus, high resolution, natural skin texture visible`,
      ``,
      `CRITICAL RULES:`,
      `- Show the COMPLETE figure from head to bare feet`,
      `- The face MUST closely match the identity from the reference photo`,
      `- The body MUST follow the specified build, not the reference photo`,
      `- The outfit MUST be exactly as specified (white t-shirt + black shorts)`,
      `- The hair MUST follow the specified style/color/length, not the reference photo`,
    ].join("\n") });
  } else {
    // ── Modo TEXT-ONLY: prompt descritivo (sem foto) ──
    parts.push({ text: [
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
    ].join("\n") });
  }

  return parts;
}

