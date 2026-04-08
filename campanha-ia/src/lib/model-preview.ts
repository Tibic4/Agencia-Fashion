/**
 * Geração direta de preview de modelo virtual.
 * Provider: Gemini 3.1 Flash Image (~R$0,03)
 * 
 * Suporta dois modos:
 *   1. Text-only (sem foto) — gera modelo baseado em traits descritivos
 *   2. Multimodal (com foto) — usa crop facial como referência de identidade
 * 
 * PROMPTS centralizados em @/lib/model-prompts.ts (fonte única de verdade).
 * 
 * Chamado fire-and-forget pelo POST /api/model/create ou regenerate-preview.
 * Não bloqueia a resposta — o frontend faz polling.
 */

import { buildGeminiParts } from "@/lib/model-prompts";

export interface ModelPreviewParams {
  modelId: string;
  storeId: string;
  skinTone: string;
  hairStyle: string;
  bodyType: string;
  style: string;
  ageRange: string;
  name: string;
  /** Base64 do crop facial de referência (opcional) */
  faceRefBase64?: string | null;
  /** MIME type do crop facial */
  faceRefMimeType?: string;
}

/**
 * Gera preview via Gemini 3.1 Flash Image.
 * Modo automático: se faceRefBase64 está presente, usa multimodal.
 * Retorna URL pública ou null.
 */
async function tryGemini(data: ModelPreviewParams): Promise<string | null> {
  const apiKey = process.env.GOOGLE_AI_API_KEY;
  if (!apiKey) return null;

  try {
    const { GoogleGenAI } = await import("@google/genai");
    const ai = new GoogleGenAI({ apiKey });

    const mode = data.faceRefBase64 ? "multimodal (face ref)" : "text-only";
    console.log(`[Preview:Gemini] 🎨 Gerando para "${data.name}" — modo: ${mode}...`);

    // ── Montar parts via builder centralizado (fonte única de verdade) ──
    const parts = buildGeminiParts(
      { skinTone: data.skinTone, hairStyle: data.hairStyle, bodyType: data.bodyType, style: data.style, ageRange: data.ageRange },
      data.faceRefBase64,
      data.faceRefMimeType,
    );

    const response = await ai.models.generateContent({
      model: "gemini-3-pro-image-preview",
      contents: [{ role: "user", parts }],
      config: {
        responseModalities: ["IMAGE", "TEXT"],
      } as any,
    });

    const responseParts = response.candidates?.[0]?.content?.parts || [];
    const imagePart = responseParts.find((p: any) => p.inlineData?.mimeType?.startsWith("image/"));

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

    // ── Logar custo no admin ──
    try {
      const { getModelPricing, getExchangeRate } = await import("@/lib/pricing");
      const pricing = await getModelPricing();
      const exchangeRate = await getExchangeRate();
      const modelPrice = pricing["gemini-3-pro-image-preview"] || { inputPerMTok: 1.25, outputPerMTok: 10.00 };

      const inputTokens = data.faceRefBase64 ? 1300 : 250;
      const outputTokens = 4000;
      const costUsd = (inputTokens * modelPrice.inputPerMTok + outputTokens * modelPrice.outputPerMTok) / 1_000_000;
      const costBrl = costUsd * exchangeRate;

      await supabase.from("api_cost_logs").insert({
        store_id: data.storeId || null,
        campaign_id: null,
        provider: "google",
        model_used: "gemini-3-pro-image-preview",
        action: "model_preview",
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        tokens_used: inputTokens + outputTokens,
        cost_usd: costUsd,
        cost_brl: costBrl,
      });

      console.log(`[Preview:Gemini] 💰 Custo: R$ ${costBrl.toFixed(4)}`);
    } catch (costErr) {
      console.warn("[Preview:Gemini] ⚠️ Falha ao logar custo:", costErr);
    }

    console.log(`[Preview:Gemini] ✅ OK (${mode}): ${pub.publicUrl.slice(0, 60)}...`);
    return pub.publicUrl;
  } catch (err) {
    console.warn("[Preview:Gemini] ❌ Falha:", err instanceof Error ? err.message : err);
    return null;
  }
}

/**
 * Gera preview da modelo e salva no banco.
 * Provider único: Gemini 3.1 Flash Image Preview
 * 
 * Chamada fire-and-forget — não bloqueia o request HTTP.
 */
export async function generatePreviewDirect(data: ModelPreviewParams): Promise<void> {
  const mode = data.faceRefBase64 ? "multimodal" : "text-only";
  console.log(`[Preview] 🚀 Iniciando para "${data.name}" (${data.modelId}) — modo: ${mode}...`);

  const url = await tryGemini(data);

  if (!url) {
    console.error(`[Preview] ❌ Geração de preview falhou para "${data.name}"`);
    return;
  }

  // Salvar no DB
  const { createAdminClient } = await import("@/lib/supabase/admin");
  const supabase = createAdminClient();

  await supabase
    .from("store_models")
    .update({ preview_url: url })
    .eq("id", data.modelId);

  console.log(`[Preview] 💾 Salvo no DB para "${data.name}" (${data.modelId})`);
}
