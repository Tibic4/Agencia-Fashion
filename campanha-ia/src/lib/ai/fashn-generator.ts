/**
 * CriaLook Image Generator v4 — FASHN AI
 *
 * Usa o endpoint `product-to-model` do FASHN para gerar
 * 3 fotos de modelos vestindo a peça.
 *
 * Fluxo: produto (foto) + modelo (foto do banco) → FASHN → 3 imagens
 *
 * O FASHN faz Virtual Try-On real — coloca a peça na modelo de referência.
 * Muito melhor que text-to-image para e-commerce de moda.
 */

import Fashn from "fashn";

// ═══════════════════════════════════════
// Tipos
// ═══════════════════════════════════════

export interface FashnGenInput {
  /** 3 styling prompts do Sonnet (cenário/pose) */
  stylingPrompts: [string, string, string];
  /** Base64 da foto principal do produto (com prefixo data: ou URL) */
  productImageBase64: string;
  productMediaType?: string;
  /** Base64 da foto da modelo do banco (com prefixo data: ou URL) */
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
  /** URL da imagem no CDN do FASHN (72h) ou base64 */
  imageUrl: string;
  /** Se tiver base64 */
  imageBase64?: string;
  mimeType: string;
  durationMs: number;
}

export interface FashnGenResult {
  images: (GeneratedImage | null)[];
  successCount: number;
  totalDurationMs: number;
}

// ═══════════════════════════════════════
// Singleton Fashn client
// ═══════════════════════════════════════

let _client: Fashn | null = null;
function getClient(): Fashn {
  if (!_client) {
    const apiKey = process.env.FASHN_API_KEY;
    if (!apiKey) throw new Error("FASHN_API_KEY não configurada");
    _client = new Fashn({ apiKey });
  }
  return _client;
}

// ═══════════════════════════════════════
// Helpers
// ═══════════════════════════════════════

function toBase64DataUri(base64: string, mediaType?: string): string {
  if (base64.startsWith("data:")) return base64;
  const mt = mediaType || "image/jpeg";
  return `data:${mt};base64,${base64}`;
}

// ═══════════════════════════════════════
// Função principal — 3 chamadas paralelas (max concurrency 6)
// ═══════════════════════════════════════

export async function generateWithFashn(input: FashnGenInput): Promise<FashnGenResult> {
  const client = getClient();
  const startTime = Date.now();

  console.log(`[FASHN] 🚀 Iniciando 3 chamadas paralelas ao FASHN product-to-model...`);

  const productImage = toBase64DataUri(input.productImageBase64, input.productMediaType);
  const modelImage = toBase64DataUri(input.modelImageBase64, input.modelMediaType);

  // Disparar 3 chamadas INDEPENDENTES em paralelo
  const settled = await Promise.allSettled(
    input.stylingPrompts.map((prompt, index) =>
      generateSingleImage(client, prompt, productImage, modelImage, input, index)
    )
  );

  const images: (GeneratedImage | null)[] = settled.map((r, i) => {
    if (r.status === "fulfilled") return r.value;
    console.warn(
      `[FASHN] ❌ Imagem #${i + 1} falhou: ${(r.reason as Error)?.message || r.reason}`
    );
    return null;
  });

  const successCount = images.filter(Boolean).length;
  const totalDurationMs = Date.now() - startTime;

  console.log(`[FASHN] ✅ ${successCount}/3 imagens geradas em ${totalDurationMs}ms`);

  // Log de custos (fire-and-forget)
  if (input.storeId) {
    logFashnCosts(input.storeId, input.campaignId, successCount, totalDurationMs)
      .catch((e) => console.warn("[FASHN] Erro ao salvar custo:", e));
  }

  return { images, successCount, totalDurationMs };
}

// ═══════════════════════════════════════
// Geração individual
// ═══════════════════════════════════════

async function generateSingleImage(
  client: Fashn,
  stylingPrompt: string,
  productImage: string,
  modelImage: string,
  input: FashnGenInput,
  index: number
): Promise<GeneratedImage> {
  const start = Date.now();
  const conceptName = `Look ${index + 1}`;
  console.log(`[FASHN] 🎨 #${index + 1} "${conceptName}" — iniciando...`);

  // Usar product-to-model com model_image para try-on
  const result = await client.predictions.subscribe({
    model_name: "product-to-model",
    inputs: {
      product_image: productImage,
      model_image: modelImage,
      prompt: stylingPrompt,
      resolution: "1k",
      aspect_ratio: (input.aspectRatio || "3:4") as "3:4" | "4:5" | "2:3",
      output_format: "jpeg",
    },
  });

  if (result.status !== "completed" || !result.output?.length) {
    const errorMsg = result.error?.message || "FASHN não retornou imagem";
    throw new Error(`FASHN falhou para "${conceptName}": ${errorMsg}`);
  }

  const durationMs = Date.now() - start;
  console.log(`[FASHN] ✅ #${index + 1} "${conceptName}" — ${durationMs}ms`);

  // result.output é array de URLs no CDN do FASHN
  const imageUrl = result.output[0];

  return {
    conceptName,
    imageUrl,
    mimeType: "image/jpeg",
    durationMs,
  };
}

// ═══════════════════════════════════════
// Log de custos
// FASHN product-to-model quality 2k = 4 credits/image
// Preço por credit: ~$0.05 (estimativa)
// ═══════════════════════════════════════

async function logFashnCosts(
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

  // 2 credits por imagem quality 1k, ~$0.05/credit
  const creditsPerImage = 2;
  const costPerCredit = 0.05;
  const totalCostUsd = creditsPerImage * costPerCredit * successCount;

  const { error } = await supabase.from("api_cost_logs").insert({
    store_id: storeId,
    campaign_id: campaignId || null,
    provider: "fashn",
    model_used: "product-to-model-quality-2k",
    action: "fashn_tryon_v4",
    cost_usd: totalCostUsd,
    cost_brl: totalCostUsd * exchangeRate,
    exchange_rate: exchangeRate,
    response_time_ms: totalMs,
  });

  if (error) {
    console.warn("[FASHN] ⚠️ Falha ao logar custo:", error.message);
  }
}
