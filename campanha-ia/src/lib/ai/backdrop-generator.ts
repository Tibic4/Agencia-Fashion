/**
 * CriaLook Backdrop Reference Generator
 *
 * Gera uma foto de estúdio vazio na cor da marca da loja.
 * Essa foto é usada como referência visual na chamada VTO pra ancorar
 * o fundo na cor exata da marca (e manter consistência se o pipeline
 * voltar a gerar mais de uma foto por campanha).
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
// Season types & Prompt builder
// ═══════════════════════════════════════

export type BackdropSeason = "primavera" | "verao" | "outono" | "inverno";

const SEASON_LIGHTING: Record<BackdropSeason, string> = {
  primavera: `Soft, naturally diffused daylight as if streaming through large studio windows on a bright spring morning. The light has a clean, airy quality — neither warm nor cool, just pure natural white light with a very subtle pink warmth. It creates gentle, barely-visible shadows that keep the scene feeling open and fresh. A delicate pool of light falls on the center of the white floor. The overall mood is fresh, light, and delicate — like a crisp spring morning.`,

  verao: `Bright, warm golden-hour light flooding the studio from the front-left. The light has a noticeable warm golden cast that makes the wall color appear rich and sun-kissed. Strong, confident illumination with minimal shadows — the scene feels vibrant and energetic. A generous pool of warm golden light falls across the center floor, creating a gentle warm reflection. The overall mood is energetic, warm, and tropical — like a radiant summer afternoon.`,

  outono: `Soft, warm amber-toned lighting as if from late afternoon sun filtering through the studio. The light has a cozy, intimate quality with golden-amber undertones that enrich the wall color. It creates gentle directional shadows with soft edges, adding depth and warmth. A muted amber-tinted pool of light rests on the center floor. The overall mood is earthy, warm, and intimate — like a golden autumn sunset.`,

  inverno: `Crisp, cool-toned daylight as if from an overcast winter sky streaming through north-facing windows. The light has a subtle blue-white quality that feels clean and ethereal. Sharp, even illumination with minimal warmth — the scene feels pure and sophisticated. The white floor takes on a very subtle cool blue tint from the reflected light. The overall mood is minimal, icy, and sophisticated — like a serene winter morning.`,
};

/**
 * Builds the prompt for generating an empty studio backdrop.
 * Uses narrative-style description (per Gemini docs best practices).
 * Season controls ONLY the lighting mood — wall stays flat solid color.
 */
function buildBackdropPrompt(hex: string, season: BackdropSeason = "primavera"): string {
  const lighting = SEASON_LIGHTING[season];

  return `A photorealistic interior photograph of a completely empty fashion photography studio, captured with an 85mm portrait lens at eye level, approximately 1.5 meters height. The composition is vertical 9:16 portrait format.

The back wall occupies the upper 60% of the frame and the floor occupies the lower 40%. The wall-to-floor junction sits slightly below the vertical center, creating a sharp, clean straight-line horizontal transition. A realistic contact shadow runs along the entire wall-floor junction line — this shadow is essential for depth and must not be omitted.

The wall is painted in a single, exact solid color: ${hex}. It has a perfectly flat matte finish with very subtle plaster micro-texture. The color is completely uniform across the entire wall surface — absolutely no gradient, no pattern, no color variation whatsoever. There is only a natural 2% light falloff toward the far corners.

The floor is clean white (#FFFFFF) smooth matte painted concrete with subtle micro-texture that makes it look like a real physical surface. The floor is NOT glossy, NOT reflective, and NOT mirror-like. Near the wall junction, a very faint color bounce from the ${hex} wall tints the white floor — this tint gradually fades to pure white as it approaches the camera. The floor has a soft natural luminosity gradient: slightly darker near the wall, brighter near the camera.

${lighting}

The scene must be completely empty — there are zero objects, zero furniture, zero decoration, zero props, zero plants, and zero people anywhere in the frame. No mannequin, no text, no watermark, no logo. The entire center of the frame is open negative space designed for placing a standing fashion model later. This is a clean, minimalist, real retail studio environment with natural depth.

If the floor looks flat or artificial, the image is incorrect. If any object appears, the image is invalid. If the wall-floor junction has no contact shadow, the image is invalid.`;
}

// ═══════════════════════════════════════
// Generation + Upload + DB update
// ═══════════════════════════════════════

export interface BackdropResult {
  url: string;
  color: string;
  season: BackdropSeason;
  generatedAt: string;
}

/**
 * Generates an empty studio backdrop image for a store's brand color.
 * Uploads to Supabase Storage and updates the stores table.
 */
export async function generateBackdrop(
  storeId: string,
  brandHex: string,
  season: BackdropSeason = "primavera"
): Promise<BackdropResult> {
  const startTime = Date.now();
  const hex = brandHex.startsWith("#") ? brandHex : `#${brandHex}`;

  console.log(`[Backdrop] 🎨 Generating studio backdrop for store ${storeId} (${hex}) [${season}]...`);

  const ai = getAI();
  const prompt = buildBackdropPrompt(hex, season);

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
      backdrop_season: season,
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

    // Backdrop = 1 imagem; tokens de fallback = média histórica do VTO
    // (4600 input + 4000 output por imagem).
    const inputTokens = 4600;
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
    season,
    generatedAt: now,
  };
}

// ═══════════════════════════════════════
// Rate limit check
// ═══════════════════════════════════════

/**
 * Checks if a store can regenerate its backdrop (30-day cooldown).
 * Changing color OR season always bypasses the cooldown.
 * Returns { allowed: true } or { allowed: false, nextAvailableDate }.
 */
export async function canRegenerateBackdrop(
  storeId: string,
  newColor: string,
  newSeason?: BackdropSeason
): Promise<{ allowed: boolean; nextAvailableDate?: string; currentColor?: string }> {
  const supabase = createAdminClient();

  const { data: store } = await supabase
    .from("stores")
    .select("backdrop_color, backdrop_season, backdrop_updated_at")
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

  // Season changed → allow
  if (newSeason && store.backdrop_season !== newSeason) {
    return { allowed: true, currentColor: store.backdrop_color || "" };
  }

  // Same color + same season — check 30-day cooldown
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
