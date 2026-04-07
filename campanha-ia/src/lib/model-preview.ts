/**
 * Geração direta de preview de modelo virtual.
 * Pipeline: Gemini 3.1 Flash Image (~R$0,006) → Fashn.ai fallback (~R$0,43)
 * 
 * Chamado fire-and-forget pelo POST /api/model/create.
 * Não bloqueia a resposta — o frontend faz polling.
 */

interface ModelPreviewParams {
  modelId: string;
  storeId: string;
  skinTone: string;
  hairStyle: string;
  bodyType: string;
  style: string;
  ageRange: string;
  name: string;
}

// ── Descritores otimizados para Gemini Image Generation ──
const SKIN: Record<string, string> = {
  branca: "fair/light complexion, warm undertones",
  morena_clara: "light olive/honey-toned complexion",
  morena: "warm medium-brown complexion",
  negra: "rich dark-brown complexion, deep skin tone",
};
const HAIR: Record<string, string> = {
  liso: "sleek straight black hair, shoulder-length",
  ondulado: "soft wavy dark hair, flowing past shoulders",
  cacheado: "voluminous curly hair, natural bouncy texture",
  crespo: "beautiful afro-textured coily hair, natural volume",
  curto: "stylish short-cropped hair",
};
const BODY: Record<string, string> = {
  magra: "slim athletic silhouette",
  media: "naturally proportioned average build",
  plus_size: "confident plus-size curvy figure, full hips and natural curves",
};
const AGE: Record<string, string> = {
  jovem_18_25: "a youthful 20-year-old",
  adulta_26_35: "a 30-year-old",
  madura_36_50: "an elegant 40-year-old",
};
const POSE: Record<string, string> = {
  casual_natural: "Standing relaxed with a warm, approachable smile. Arms naturally at her sides, weight slightly on one leg.",
  elegante: "Poised and confident with one hand gently resting on her hip. Chin slightly lifted, subtle sophisticated smile.",
  esportivo: "Dynamic stance with energy and movement. Bright expression, slight forward lean suggesting motion.",
  urbano: "Cool asymmetric stance with street-style attitude. One shoulder slightly forward, confident gaze.",
};

function buildPrompt(data: ModelPreviewParams): string {
  return [
    `Generate a photorealistic full-body studio photograph of ${AGE[data.ageRange] || "a 30-year-old"} Brazilian woman.`,
    ``,
    `Subject: ${SKIN[data.skinTone] || "warm medium complexion"}, ${HAIR[data.hairStyle] || "soft wavy dark hair"}, ${BODY[data.bodyType] || "average build"}.`,
    `Outfit: Plain white crew-neck t-shirt and simple black shorts. Barefoot.`,
    ``,
    `Pose: ${POSE[data.style] || "Standing relaxed with a natural, friendly expression."}`,
    ``,
    `Photography direction: Professional e-commerce fashion photography. Clean seamless white background.`,
    `Soft diffused studio lighting from above and front, creating gentle shadows.`,
    `Camera at eye level, 85mm portrait lens, full body framing from top of head to toes.`,
    `Sharp focus, high resolution, natural skin texture visible.`,
    ``,
    `Important: Show the complete figure from head to bare feet. The entire body must be visible within the frame.`,
  ].join("\n");
}

/**
 * Tenta gerar preview via Gemini 3.1 Flash Image.
 * Retorna URL pública ou null.
 */
async function tryGemini(data: ModelPreviewParams): Promise<string | null> {
  const apiKey = process.env.GOOGLE_AI_API_KEY;
  if (!apiKey) return null;

  try {
    const { GoogleGenAI } = await import("@google/genai");
    const ai = new GoogleGenAI({ apiKey });

    console.log(`[Preview:Gemini] 🎨 Gerando para "${data.name}"...`);

    const response = await ai.models.generateContent({
      model: "gemini-3.1-flash-image-preview",
      contents: [{ role: "user", parts: [{ text: buildPrompt(data) }] }],
      config: {
        responseModalities: ["IMAGE", "TEXT"],
      } as any,
    });

    const parts = response.candidates?.[0]?.content?.parts || [];
    const imagePart = parts.find((p: any) => p.inlineData?.mimeType?.startsWith("image/"));

    if (!imagePart || !(imagePart as any).inlineData?.data) {
      console.warn("[Preview:Gemini] ⚠️ Sem imagem na resposta");
      return null;
    }

    const imageData = (imagePart as any).inlineData.data;
    const mimeType = (imagePart as any).inlineData.mimeType || "image/png";
    const ext = mimeType.includes("jpeg") ? "jpg" : "png";

    // Upload para Supabase Storage
    const { createAdminClient } = await import("@/lib/supabase/admin");
    const supabase = createAdminClient();
    const buffer = Buffer.from(imageData, "base64");
    const filePath = `model-previews/${data.storeId}/${data.modelId}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("assets")
      .upload(filePath, buffer, { contentType: mimeType, upsert: true });

    if (uploadError) {
      console.warn("[Preview:Gemini] ⚠️ Upload falhou:", uploadError.message);
      return null;
    }

    const { data: pub } = supabase.storage.from("assets").getPublicUrl(filePath);
    console.log(`[Preview:Gemini] ✅ OK: ${pub.publicUrl.slice(0, 60)}...`);
    return pub.publicUrl;
  } catch (err) {
    console.warn("[Preview:Gemini] ❌ Falha:", err instanceof Error ? err.message : err);
    return null;
  }
}

/**
 * Fallback: gera preview via Fashn.ai.
 */
async function tryFashn(data: ModelPreviewParams): Promise<string | null> {
  if (!process.env.FASHN_API_KEY) return null;

  try {
    console.log(`[Preview:Fashn] 🔄 Fallback para "${data.name}"...`);
    const { generateCustomModelPreview } = await import("@/lib/fashn/client");

    const result = await generateCustomModelPreview({
      skinTone: data.skinTone,
      hairStyle: data.hairStyle,
      bodyType: data.bodyType,
      style: data.style,
      ageRange: data.ageRange,
      name: data.name,
      storeId: data.storeId,
    });

    if (result.status !== "completed" || !result.outputUrl) {
      console.warn("[Preview:Fashn] ❌ Falhou:", result.error || result.status);
      return null;
    }

    console.log(`[Preview:Fashn] ✅ OK: ${result.outputUrl.slice(0, 60)}...`);
    return result.outputUrl;
  } catch (err) {
    console.warn("[Preview:Fashn] ❌ Erro:", err instanceof Error ? err.message : err);
    return null;
  }
}

/**
 * Gera preview da modelo e salva no banco.
 * Pipeline: Gemini (primário) → Fashn.ai (fallback)
 * 
 * Chamada fire-and-forget — não bloqueia o request HTTP.
 */
export async function generatePreviewDirect(data: ModelPreviewParams): Promise<void> {
  console.log(`[Preview] 🚀 Iniciando para "${data.name}" (${data.modelId})...`);

  // Tentar Gemini primeiro
  let url = await tryGemini(data);

  // Fallback para Fashn.ai
  if (!url) {
    url = await tryFashn(data);
  }

  if (!url) {
    console.error(`[Preview] ❌ Todos os providers falharam para "${data.name}"`);
    return;
  }

  // Salvar no DB
  const { createAdminClient } = await import("@/lib/supabase/admin");
  const supabase = createAdminClient();

  await supabase
    .from("store_models")
    .update({ photo_url: url })
    .eq("id", data.modelId);

  console.log(`[Preview] 💾 Salvo no DB para "${data.name}" (${data.modelId})`);
}
