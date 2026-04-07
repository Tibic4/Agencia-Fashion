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

export const HAIR_DESC: Record<string, string> = {
  liso: "sleek straight black hair, shoulder-length",
  ondulado: "soft wavy dark hair, flowing past shoulders",
  cacheado: "voluminous curly hair, natural bouncy texture",
  crespo: "beautiful afro-textured coily hair, natural volume",
  curto: "stylish short-cropped hair",
};

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
  hairStyle: string;
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
  const hair = HAIR_DESC[traits.hairStyle] || "soft wavy dark hair";
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
      ``,
      `OUTFIT: Plain white crew-neck t-shirt and simple black shorts. Barefoot.`,
      `DO NOT add any accessories, jewelry, glasses, or extra clothing items.`,
      `DO NOT carry over any clothing or accessories from the reference photo.`,
      ``,
      `POSE: ${pose}`,
      ``,
      `PHOTOGRAPHY:`,
      `- Professional e-commerce fashion photography`,
      `- Clean seamless white background`,
      `- Soft diffused studio lighting from above and front, creating gentle shadows`,
      `- Normalize lighting — ignore any lighting conditions from the reference photo`,
      `- Camera at eye level, 85mm portrait lens, full body framing from top of head to toes`,
      `- Sharp focus, high resolution, natural skin texture visible`,
      ``,
      `CRITICAL RULES:`,
      `- Show the COMPLETE figure from head to bare feet`,
      `- The face MUST closely match the identity from the reference photo`,
      `- The body MUST follow the specified build, not the reference photo`,
      `- The outfit MUST be exactly as specified (white t-shirt + black shorts)`,
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
