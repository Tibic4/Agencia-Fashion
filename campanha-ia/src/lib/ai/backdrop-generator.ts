/**
 * CriaLook Backdrop Reference Generator
 *
 * Gera uma foto de estúdio vazio na cor da marca da loja.
 * Essa foto é usada como referência visual nas chamadas VTO
 * para garantir consistência de fundo entre as 3 fotos.
 *
 * Fluxo:
 * 1. Recebe hex da cor da marca
 * 2. Gera imagem via Gemini Pro Image (estúdio vazio)
 * 3. Upload para Supabase Storage
 * 4. Atualiza stores (backdrop_ref_url, backdrop_color, backdrop_updated_at)
 */

import { GoogleGenAI } from "@google/genai";
import { createAdminClient } from "@/lib/supabase/admin";
import { callGeminiSafe } from "./gemini-error-handler";

// ═══════════════════════════════════════
// Config
// ═══════════════════════════════════════

const MODEL = "gemini-3-pro-image-preview";
const IMAGE_SIZE = "2K";

// ═══════════════════════════════════════
// Singleton GoogleGenAI (shared with VTO)
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
// Prompt builder
// ═══════════════════════════════════════

/**
 * Builds the prompt for generating an empty studio backdrop.
 * Only the wall color ({hex}) is variable — everything else is fixed.
 */
function buildBackdropPrompt(hex: string): string {
  return `CONTEXT & OBJECTIVE:
Generate a hyper-realistic image of a COMPLETELY EMPTY fashion store fitting room background.

---

ABSOLUTE RULE — EMPTY:
The scene must be 100% empty.
No people, no objects, no furniture, nothing.

---

COMPOSITION:
- Front-facing camera at eye-level (~1.5m height)
- 85mm portrait lens equivalent
- Vertical 9:16
- Natural perspective with slight depth of field
- Wall fills ~60% of frame (top), floor fills ~40% (bottom)
- Wall-floor junction sits slightly below center of frame

---

WALL:
- Color: EXACT ${hex}
- Matte finish with very subtle plaster texture
- Uniform color — no gradients, no patterns
- Slight natural falloff toward corners (2% darker at edges)

---

FLOOR (REALISM FIX):
- Color base: EXACT #FFFFFF

IMPORTANT — The floor MUST look real, not flat:
- Add VERY subtle micro texture (like smooth painted concrete)
- Add a soft light gradient (slightly darker toward the back near the wall)
- Add realistic contact shadow where the wall meets the floor
- Add minimal soft reflection (diffused, not glossy)
- Near the wall: a VERY subtle color tint from the wall color bouncing onto the white floor — fades to pure white toward camera

DO NOT:
- make it perfectly flat white
- remove contact shadow
- make it glossy, shiny, or reflective in ANY way
- show any reflection of objects on the floor

---

WALL + FLOOR CONNECTION:
- Straight corner with clean transition
- Slight natural shadow at the base (ESSENTIAL for depth)

---

LIGHTING:
- Soft, natural indoor lighting from slightly above and front
- A gentle pool of light falls on the center floor area
- Creates natural falloff toward edges
- No harsh shadows, no visible light sources

---

ATMOSPHERE:
- Clean, minimalist, real retail environment
- Natural depth (NOT artificial or flat)
- Smooth color transitions with no visible banding

---

NEGATIVE PROMPT:
no objects, no chair, no frame, no decor, no mirror, no rack, no clothing, no people, no mannequin, no props, no text, no logos, no watermark, no banding, no flat shading

---

FINAL VALIDATION:
If the floor looks flat or artificial, the image is incorrect.
If any object appears, the image is invalid.
If wall-floor junction has no shadow, the image is invalid.

---

OUTPUT:
- Photorealistic
- 2K resolution
- Vertical 9:16`;
}

// ═══════════════════════════════════════
// Generation + Upload + DB update
// ═══════════════════════════════════════

export interface BackdropResult {
  url: string;
  color: string;
  generatedAt: string;
}

/**
 * Generates an empty studio backdrop image for a store's brand color.
 * Uploads to Supabase Storage and updates the stores table.
 */
export async function generateBackdrop(
  storeId: string,
  brandHex: string
): Promise<BackdropResult> {
  const startTime = Date.now();
  const hex = brandHex.startsWith("#") ? brandHex : `#${brandHex}`;

  console.log(`[Backdrop] 🎨 Generating studio backdrop for store ${storeId} (${hex})...`);

  const ai = getAI();
  const prompt = buildBackdropPrompt(hex);

  // ── Generate image ──
  const response = await callGeminiSafe(
    () => ai.models.generateContent({
      model: MODEL,
      contents: [{ text: prompt }],
      config: {
        responseModalities: ["IMAGE", "TEXT"],
        imageConfig: {
          aspectRatio: "9:16" as any,
          imageSize: IMAGE_SIZE as any,
        },
      },
    }),
    { label: "Backdrop Generator", maxRetries: 2, backoffMs: 3000 }
  );

  // ── Extract image ──
  const parts = response.candidates?.[0]?.content?.parts || [];
  const imagePart = parts.find((p: any) => p.inlineData);

  if (!imagePart || !(imagePart as any).inlineData) {
    const candidate = response.candidates?.[0];
    if (candidate?.finishReason === "SAFETY") {
      throw new Error("Backdrop bloqueado por segurança. Tente outra cor.");
    }
    throw new Error("A IA não conseguiu gerar o estúdio. Tente novamente.");
  }

  const inlineData = (imagePart as any).inlineData;
  const imageBase64 = inlineData.data as string;
  const mimeType = (inlineData.mimeType || "image/png") as string;

  const durationMs = Date.now() - startTime;
  const sizeKB = Math.round(imageBase64.length / 1024);
  console.log(`[Backdrop] ✅ Generated in ${durationMs}ms (${sizeKB}KB base64)`);

  // ── Upload to Supabase Storage ──
  const supabase = createAdminClient();
  const ext = mimeType.includes("png") ? "png" : "jpg";
  const storagePath = `backdrops/${storeId}.${ext}`;

  // Convert base64 to Buffer
  const buffer = Buffer.from(imageBase64, "base64");

  const { error: uploadError } = await supabase.storage
    .from("assets")
    .upload(storagePath, buffer, {
      contentType: mimeType,
      upsert: true, // overwrite existing
    });

  if (uploadError) {
    console.error(`[Backdrop] Upload error:`, uploadError);
    throw new Error(`Erro ao salvar estúdio: ${uploadError.message}`);
  }

  // Get public URL
  const { data: urlData } = supabase.storage
    .from("assets")
    .getPublicUrl(storagePath);

  const publicUrl = urlData.publicUrl;
  const now = new Date().toISOString();

  // ── Update stores table ──
  const { error: updateError } = await supabase
    .from("stores")
    .update({
      backdrop_ref_url: publicUrl,
      backdrop_color: hex,
      backdrop_updated_at: now,
    })
    .eq("id", storeId);

  if (updateError) {
    console.error(`[Backdrop] DB update error:`, updateError);
    throw new Error(`Erro ao atualizar loja: ${updateError.message}`);
  }

  console.log(`[Backdrop] 🏪 Store ${storeId} updated — backdrop: ${publicUrl}`);

  // ── Logar custo no admin ──
  try {
    const { getModelPricing, getExchangeRate } = await import("@/lib/pricing");
    const pricing = await getModelPricing();
    const exchangeRate = await getExchangeRate();
    const modelPrice = pricing[MODEL] || { inputPerMTok: 2.00, outputPerMTok: 120.00 };

    // Backdrop: text-only prompt (~1000 tokens input), 1 imagem gerada (~4000 tokens output)
    const inputTokens = 1000;
    const outputTokens = 4000;
    const costUsd =
      (inputTokens * modelPrice.inputPerMTok) / 1_000_000 +
      (outputTokens * modelPrice.outputPerMTok) / 1_000_000;
    const costBrl = costUsd * exchangeRate;

    await supabase.from("api_cost_logs").insert({
      store_id: storeId,
      campaign_id: null,
      provider: "google",
      model_used: MODEL,
      action: "backdrop_studio",
      cost_usd: costUsd,
      cost_brl: costBrl,
      exchange_rate: exchangeRate,
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      tokens_used: inputTokens + outputTokens,
      response_time_ms: durationMs,
    });

    console.log(
      `[Backdrop] 💰 Custo: $${costUsd.toFixed(4)} / R$ ${costBrl.toFixed(4)}` +
      ` | pricing: $${modelPrice.inputPerMTok}/MTok in, $${modelPrice.outputPerMTok}/MTok out`
    );
  } catch (costErr) {
    console.warn("[Backdrop] ⚠️ Falha ao logar custo:", costErr);
  }

  return {
    url: publicUrl,
    color: hex,
    generatedAt: now,
  };
}

// ═══════════════════════════════════════
// Rate limit check
// ═══════════════════════════════════════

/**
 * Checks if a store can regenerate its backdrop (30-day cooldown).
 * Returns { allowed: true } or { allowed: false, nextAvailableDate }.
 */
export async function canRegenerateBackdrop(
  storeId: string,
  newColor: string
): Promise<{ allowed: boolean; nextAvailableDate?: string; currentColor?: string }> {
  const supabase = createAdminClient();

  const { data: store } = await supabase
    .from("stores")
    .select("backdrop_color, backdrop_updated_at")
    .eq("id", storeId)
    .single();

  if (!store) {
    return { allowed: true }; // store not found = first time
  }

  // First time generating backdrop
  if (!store.backdrop_updated_at) {
    return { allowed: true };
  }

  // Color changed → allow (it's a real need)
  const normalizeHex = (h: string) => h.replace(/^#/, "").toLowerCase();
  const currentColor = normalizeHex(store.backdrop_color || "");
  const targetColor = normalizeHex(newColor);
  if (currentColor !== targetColor) {
    return { allowed: true, currentColor: store.backdrop_color || "" };
  }

  // Same color — check 30-day cooldown
  const lastUpdated = new Date(store.backdrop_updated_at);
  const now = new Date();
  const daysSince = Math.floor((now.getTime() - lastUpdated.getTime()) / (1000 * 60 * 60 * 24));

  if (daysSince >= 30) {
    return { allowed: true, currentColor };
  }

  const nextDate = new Date(lastUpdated);
  nextDate.setDate(nextDate.getDate() + 30);

  return {
    allowed: false,
    nextAvailableDate: nextDate.toISOString(),
    currentColor,
  };
}

// ═══════════════════════════════════════
// Helper: download backdrop as base64
// ═══════════════════════════════════════

/**
 * Downloads a backdrop image URL and returns base64 string.
 * Used by the pipeline to inject into VTO calls.
 */
export async function downloadBackdropBase64(url: string): Promise<string | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.warn(`[Backdrop] Download failed: ${response.status} ${response.statusText}`);
      return null;
    }
    const buffer = await response.arrayBuffer();
    return Buffer.from(buffer).toString("base64");
  } catch (err) {
    console.warn(`[Backdrop] Download error:`, err);
    return null;
  }
}
