/**
 * CriaLook Image Generator v4 — FASHN AI (tryon-max)
 *
 * Usa o endpoint `tryon-max` (flagship) do FASHN para Virtual Try-On.
 * O tryon-max é o melhor modelo para preservar identidade da modelo
 * E fidelidade dos detalhes da peça.
 *
 * Fluxo: produto (foto) + modelo (foto do banco) → FASHN tryon-max → 3 imagens
 *
 * Resolução: 2k (~4MP) — ideal para Instagram Feed (1080x1350 = 1.4MP)
 *
 * Como o SDK v0.13 não tem tipos para tryon-max, usamos REST direto.
 */

// ═══════════════════════════════════════
// Tipos
// ═══════════════════════════════════════

export interface FashnGenInput {
  /** 3 styling prompts do Sonnet (cenário/pose) */
  stylingPrompts: [string, string, string];
  /** Base64 da foto principal do produto (sem prefixo data:) */
  productImageBase64: string;
  productMediaType?: string;
  /** Base64 da foto da modelo do banco (sem prefixo data:) */
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
  /** URL da imagem no CDN do FASHN (72h) */
  imageUrl: string;
  mimeType: string;
  durationMs: number;
}

export interface FashnGenResult {
  images: (GeneratedImage | null)[];
  successCount: number;
  totalDurationMs: number;
}

// ═══════════════════════════════════════
// Config
// ═══════════════════════════════════════

const FASHN_API_URL = process.env.FASHN_API_URL || "https://api.fashn.ai/v1";
const FASHN_MODEL = "tryon-max";
const FASHN_RESOLUTION = "2k";      // ~4MP, ideal para Instagram
const FASHN_MODE = "balanced";       // balanced = 3 credits/img 2k, ~45s
const POLL_INTERVAL_MS = 2000;
const MAX_POLL_ATTEMPTS = 90;        // 90 × 2s = 180s max

// ═══════════════════════════════════════
// Helpers
// ═══════════════════════════════════════

function toBase64DataUri(base64: string, mediaType?: string): string {
  if (base64.startsWith("data:")) return base64;
  if (base64.startsWith("http")) return base64; // já é URL
  const mt = mediaType || "image/jpeg";
  return `data:${mt};base64,${base64}`;
}

function getApiKey(): string {
  const key = process.env.FASHN_API_KEY;
  if (!key) throw new Error("FASHN_API_KEY não configurada");
  return key;
}

// ═══════════════════════════════════════
// REST API calls (tryon-max não está no SDK v0.13)
// ═══════════════════════════════════════

interface FashnRunResponse {
  id: string;
  error?: { name: string; message: string };
}

interface FashnStatusResponse {
  id: string;
  status: "starting" | "in_queue" | "processing" | "completed" | "failed";
  output?: string[];
  error?: { name: string; message: string };
}

async function fashnRun(inputs: Record<string, unknown>): Promise<FashnRunResponse> {
  const resp = await fetch(`${FASHN_API_URL}/run`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${getApiKey()}`,
    },
    body: JSON.stringify({
      model_name: FASHN_MODEL,
      inputs,
    }),
  });

  if (!resp.ok) {
    const errBody = await resp.text().catch(() => "");
    throw new Error(`FASHN /run falhou (${resp.status}): ${errBody}`);
  }

  return resp.json();
}

async function fashnPoll(predictionId: string): Promise<FashnStatusResponse> {
  const resp = await fetch(`${FASHN_API_URL}/status/${predictionId}`, {
    headers: { "Authorization": `Bearer ${getApiKey()}` },
  });

  if (!resp.ok) {
    throw new Error(`FASHN /status falhou (${resp.status})`);
  }

  return resp.json();
}

async function fashnSubscribe(inputs: Record<string, unknown>): Promise<FashnStatusResponse> {
  // 1. Submit
  const run = await fashnRun(inputs);
  if (run.error) {
    throw new Error(`FASHN run error: ${run.error.message}`);
  }

  // 2. Poll até completar
  for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt++) {
    await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));
    const status = await fashnPoll(run.id);

    if (status.status === "completed") return status;
    if (status.status === "failed") {
      throw new Error(`FASHN falhou: ${status.error?.message || "Unknown error"} (${status.error?.name})`);
    }
    // starting, in_queue, processing → continuar polling
  }

  throw new Error(`FASHN timeout após ${MAX_POLL_ATTEMPTS * POLL_INTERVAL_MS / 1000}s`);
}

// ═══════════════════════════════════════
// Função principal — 3 chamadas paralelas
// ═══════════════════════════════════════

export async function generateWithFashn(input: FashnGenInput): Promise<FashnGenResult> {
  const startTime = Date.now();

  console.log(`[FASHN] 🚀 Iniciando 3 chamadas paralelas ao FASHN ${FASHN_MODEL} (${FASHN_RESOLUTION})...`);

  const productImage = toBase64DataUri(input.productImageBase64, input.productMediaType);
  const modelImage = toBase64DataUri(input.modelImageBase64, input.modelMediaType);

  // Disparar 3 chamadas INDEPENDENTES em paralelo
  const settled = await Promise.allSettled(
    input.stylingPrompts.map((prompt, index) =>
      generateSingleImage(prompt, productImage, modelImage, index)
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
// Geração individual via REST
// ═══════════════════════════════════════

async function generateSingleImage(
  stylingPrompt: string,
  productImage: string,
  modelImage: string,
  index: number
): Promise<GeneratedImage> {
  const start = Date.now();
  const conceptName = `Look ${index + 1}`;
  console.log(`[FASHN] 🎨 #${index + 1} "${conceptName}" — iniciando (${FASHN_MODEL} ${FASHN_RESOLUTION})...`);

  const result = await fashnSubscribe({
    product_image: productImage,
    model_image: modelImage,
    prompt: stylingPrompt,
    resolution: FASHN_RESOLUTION,
    generation_mode: FASHN_MODE,
    num_images: 1,
    output_format: "jpeg",
  });

  if (!result.output?.length) {
    throw new Error(`FASHN não retornou imagem para "${conceptName}"`);
  }

  const durationMs = Date.now() - start;
  console.log(`[FASHN] ✅ #${index + 1} "${conceptName}" — ${durationMs}ms`);

  return {
    conceptName,
    imageUrl: result.output[0],
    mimeType: "image/jpeg",
    durationMs,
  };
}

// ═══════════════════════════════════════
// Log de custos
// tryon-max balanced 2k = 3 credits/image
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

  // tryon-max balanced 2k = 3 credits/image, ~$0.05/credit
  const creditsPerImage = 3;
  const costPerCredit = 0.05;
  const totalCostUsd = creditsPerImage * costPerCredit * successCount;

  const { error } = await supabase.from("api_cost_logs").insert({
    store_id: storeId,
    campaign_id: campaignId || null,
    provider: "fashn",
    model_used: `${FASHN_MODEL}-${FASHN_MODE}-${FASHN_RESOLUTION}`,
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
