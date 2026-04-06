/**
 * Fashn.ai — Virtual Try-On & Product-to-Model API Client
 *
 * Documentação: https://docs.fashn.ai
 * API: POST /v1/run com { model_name, inputs }
 *
 * Funcionalidades:
 *  - Gerar modelo vestindo a peça (product-to-model) — a partir de foto flat-lay
 *  - Vestir roupas em modelos virtuais (tryon-v1.6) — requer foto de modelo
 *  - Editar/refinar imagem (edit) — alisar roupa, mudar fundo
 *  - Criar modelos virtuais personalizadas (model-create)
 */

const FASHN_API_URL = process.env.FASHN_API_URL || "https://api.fashn.ai/v1";
const FASHN_API_KEY = process.env.FASHN_API_KEY || "";

// ═══════════════════════════════════════
// Tipos
// ═══════════════════════════════════════

interface FashnJobResult {
  id: string;
  status: "completed" | "processing" | "failed";
  outputUrl: string | null;
  error?: string;
}

// Custos fixos por operação Fashn.ai (em USD, extraídos da tabela de preços)
const FASHN_COST_USD: Record<string, number> = {
  "product-to-model": 0.03,
  "tryon-max": 0.08,
  "edit": 0.02,
  "model-create": 0.10,
  "background-remove": 0.02,
};

/**
 * Loga custo de uma chamada Fashn.ai no banco (async, fire-and-forget)
 */
async function logFashnCost(
  action: string,
  modelName: string,
  durationMs: number,
  success: boolean,
  storeId?: string,
  campaignId?: string,
) {
  try {
    const { createAdminClient } = await import("@/lib/supabase/admin");
    const supabase = createAdminClient();
    const exchangeRate = parseFloat(process.env.USD_BRL_EXCHANGE_RATE || "5.80");
    const costUsd = FASHN_COST_USD[modelName] || 0;
    const costBrl = costUsd * exchangeRate;

    await supabase.from("api_cost_logs").insert({
      store_id: storeId || null,
      campaign_id: campaignId || null,
      provider: "fashn.ai",
      model_used: modelName,
      action,
      input_tokens: 0,
      output_tokens: 0,
      tokens_used: 0,
      cost_usd: costUsd,
      cost_brl: costBrl,
      response_time_ms: durationMs,
    });
  } catch (e) {
    console.warn("[Fashn] Erro ao salvar custo:", e);
  }
}

interface FashnProductToModelParams {
  /** URL ou base64 data URI da foto do produto */
  productImage: string;
  /** Tipo de corpo: normal (P/M/G) ou plus (GG/XGG) */
  bodyType?: "normal" | "plus";
}

interface FashnTryOnParams {
  /** URL ou base64 da foto do produto (roupa) */
  productImage: string;
  /** URL ou base64 da foto do modelo */
  modelImage: string;
  /** Prompt opcional para ajustes (ex: "tuck in shirt") */
  prompt?: string;
}

interface FashnEditParams {
  /** URL ou base64 da imagem a editar */
  image: string;
  /** Instrução de edição */
  prompt: string;
}

interface FashnModelCreateParams {
  /** Nome do modelo */
  name: string;
  /** URLs das fotos de referência (mínimo 4) */
  sampleImages: string[];
}

// ═══════════════════════════════════════
// Helpers
// ═══════════════════════════════════════

/** Submeter job para a API Fashn e obter ID */
async function submitJob(modelName: string, inputs: Record<string, unknown>): Promise<string> {
  if (!FASHN_API_KEY) {
    throw new Error("FASHN_API_KEY não configurada");
  }

  const res = await fetch(`${FASHN_API_URL}/run`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${FASHN_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model_name: modelName,
      inputs,
    }),
  });

  if (!res.ok) {
    const error = await res.text();
    throw new Error(`Fashn.ai ${modelName} error (${res.status}): ${error}`);
  }

  const job = await res.json();
  return job.id;
}

/** Polling para obter resultado (máx 120s) */
async function pollResult(jobId: string, maxSeconds = 120): Promise<FashnJobResult> {
  const maxAttempts = Math.floor(maxSeconds / 2);

  for (let i = 0; i < maxAttempts; i++) {
    await new Promise((r) => setTimeout(r, 2000));

    const res = await fetch(`${FASHN_API_URL}/status/${jobId}`, {
      headers: { Authorization: `Bearer ${FASHN_API_KEY}` },
    });

    if (!res.ok) continue;

    const data = await res.json();

    if (data.status === "completed") {
      return {
        id: jobId,
        status: "completed",
        outputUrl: data.output?.[0] || data.output_url || null,
      };
    }

    if (data.status === "failed") {
      return {
        id: jobId,
        status: "failed",
        outputUrl: null,
        error: data.error?.message || "Job failed",
      };
    }
  }

  return { id: jobId, status: "processing", outputUrl: null };
}

// ═══════════════════════════════════════
// API Pública
// ═══════════════════════════════════════

/**
 * Gerar modelo vestindo a peça (a partir da foto flat-lay do produto).
 * Não precisa de foto de modelo — a IA gera automaticamente.
 * Custo: ~R$ 0,15
 */
export async function productToModel(params: FashnProductToModelParams & { storeId?: string; campaignId?: string }): Promise<FashnJobResult> {
  const start = Date.now();
  const jobId = await submitJob("product-to-model", {
    product_image: params.productImage,
  });
  const result = await pollResult(jobId);
  logFashnCost("virtual_try_on", "product-to-model", Date.now() - start, result.status === "completed", params.storeId, params.campaignId).catch(() => {});
  return result;
}

/**
 * Vestir uma peça em um modelo (Virtual Try-On).
 * Requer foto de modelo com corpo visível.
 * Custo: ~R$ 0,43
 */
export async function tryOnProduct(params: FashnTryOnParams & { storeId?: string; campaignId?: string }): Promise<FashnJobResult> {
  const start = Date.now();
  const jobId = await submitJob("tryon-max", {
    model_image: params.modelImage,
    product_image: params.productImage,
    ...(params.prompt && { prompt: params.prompt }),
  });
  const result = await pollResult(jobId);
  logFashnCost("virtual_try_on", "tryon-max", Date.now() - start, result.status === "completed", params.storeId, params.campaignId).catch(() => {});
  return result;
}

/**
 * Editar/refinar imagem gerada (alisar roupa, mudar fundo, etc).
 * Custo: ~R$ 0,10
 */
export async function editImage(params: FashnEditParams & { storeId?: string; campaignId?: string }): Promise<FashnJobResult> {
  const start = Date.now();
  const jobId = await submitJob("edit", {
    image: params.image,
    prompt: params.prompt,
  });
  const result = await pollResult(jobId);
  logFashnCost("edit_image", "edit", Date.now() - start, result.status === "completed", params.storeId, params.campaignId).catch(() => {});
  return result;
}

/** Prompts de cenário otimizados (anti-manequim + anti-etiqueta) */
const BACKGROUND_PROMPTS: Record<string, string> = {
  branco: "Professional fashion e-commerce photo in clean white studio. CRITICAL: Preserve ALL garment details exactly — embroidery count, fabric texture, elastic bands, ribbed cuffs, folded hems, buttons. Smooth fabric without unnatural wrinkles. REMOVE any price tags, store labels, hanging stickers, barcodes, or plastic tag holders from the garment — these are NOT part of the design. KEEP functional accessories like belts, necklaces, bracelets. Remove any mannequin parts, stands, poles, or dark artifacts completely. Clean natural skin on legs and arms with consistent skin tone. Soft studio lighting with subtle shadows. Full body visible from head to feet including shoes.",
  estudio: "Professional fashion photo in elegant studio with soft gradient backdrop. CRITICAL: Preserve ALL garment details exactly — smocking, ruffles, embroidery patterns, elastic gathering, tie straps. Smooth fabric. REMOVE any price tags, store labels, hanging stickers, barcodes from the garment. KEEP functional accessories like belts, necklaces. Remove any mannequin artifacts, stands or poles completely. Natural skin tones throughout body. Professional soft lighting.",
  lifestyle: "Professional fashion photo in urban outdoor setting with natural environment. CRITICAL: Preserve ALL garment construction details exactly as shown. Smooth fabric. REMOVE any price tags, store labels, hanging stickers, barcodes from the garment. KEEP functional accessories. Remove any artificial elements, mannequin parts completely. Natural skin tones. Natural warm lighting.",
  urbano: "Professional fashion photo on a modern city street. Textured concrete or brick wall background, urban sidewalk, moody street-style atmosphere. CRITICAL: Preserve ALL garment details exactly. Smooth fabric. REMOVE any price tags, store labels, barcodes. KEEP functional accessories. Remove mannequin artifacts. Natural skin tones. Cool urban lighting with slight shadows.",
  natureza: "Professional fashion photo in a beautiful natural garden setting. Lush green tropical plants, soft bokeh background, golden hour sunlight filtering through leaves. CRITICAL: Preserve ALL garment details exactly. Smooth fabric. REMOVE any price tags, store labels, barcodes. KEEP functional accessories. Remove mannequin artifacts. Warm natural skin tones.",
  interior: "Professional fashion photo in a modern minimalist interior. Clean white loft apartment with large windows and abundant natural light, contemporary furniture visible in soft focus. CRITICAL: Preserve ALL garment details exactly. Smooth fabric. REMOVE any price tags, store labels, barcodes. KEEP functional accessories. Remove mannequin artifacts. Bright airy atmosphere.",
  boutique: "Professional fashion photo inside a luxury fashion boutique. Elegant marble surfaces, gold accents, clothing racks softly blurred in background, warm ambient store lighting. CRITICAL: Preserve ALL garment details exactly. Smooth fabric. REMOVE any price tags, store labels, barcodes. KEEP functional accessories. Remove mannequin artifacts. Premium retail atmosphere.",
  gradiente: "Professional fashion photo with elegant smooth gradient backdrop transitioning from soft rose pink to warm peach gold. Abstract premium brand aesthetic feel. CRITICAL: Preserve ALL garment details exactly. Smooth fabric. REMOVE any price tags, store labels, barcodes. KEEP functional accessories. Remove mannequin artifacts. Soft even studio lighting.",
  personalizado: "Professional fashion photo, smooth fabric without wrinkles. CRITICAL: Preserve ALL original garment details. REMOVE any price tags, store labels, hanging stickers, barcodes. KEEP functional accessories. Remove any mannequin artifacts.",
};

/** Build body type instruction for Fashn prompts */
function getBodyTypeInstruction(bodyType?: "normal" | "plus"): string {
  if (bodyType === "plus") {
    return "Plus-size/curvy Brazilian woman (GG/XGG sizing, US 14-18). Full curves, wide hips, thick thighs. DO NOT generate slim/thin body.";
  }
  return "Slim/standard Brazilian woman (P/M sizing, US 4-8). Slim athletic build. DO NOT generate plus-size body.";
}

/**
 * Pipeline A+: product-to-model + edit (alisar + fundo).
 * Usado quando NÃO há modelo do banco selecionada.
 * Custo total: ~R$ 0,25
 */
export async function generateModelImage(
  productImage: string,
  backgroundType: string = "branco",
  backgroundValue?: string,
  bodyType?: "normal" | "plus",
): Promise<FashnJobResult> {
  const bodyInstruction = getBodyTypeInstruction(bodyType);

  // Passo 1: Gerar modelo vestindo a peça (corpo inteiro, head to feet)
  const jobId = await submitJob("product-to-model", {
    product_image: productImage,
    prompt: `Full body photo from head to feet of a ${bodyInstruction}. Confident natural smile, relaxed standing pose. White studio background, fashion e-commerce photography. CRITICAL: Reproduce the garment EXACTLY as shown — preserve every detail: embroidery count and spacing, fabric texture, elastic bands, smocking, ruffles, buttons, folded hems. Do NOT add or remove any decorative design elements. REMOVE any price tags, store labels, hanging stickers, barcodes, or plastic tag holders — these are store artifacts, NOT part of the garment design. KEEP functional accessories like belts, necklaces, bracelets, scarves. Must be wearing stylish shoes (NEVER barefoot).`,
    aspect_ratio: "9:16",
  });
  const modelResult = await pollResult(jobId);

  if (modelResult.status !== "completed" || !modelResult.outputUrl) {
    return modelResult;
  }

  // Passo 2: Refinar (alisar roupa + aplicar fundo)
  const prompt = backgroundType === "personalizado" && backgroundValue
    ? backgroundValue
    : BACKGROUND_PROMPTS[backgroundType];

  return editImage({ image: modelResult.outputUrl, prompt });
}

/**
 * Pipeline com Banco de Modelos: try-on + edit.
 * Usa uma modelo pré-gerada do banco para vestir a peça.
 * Custo total: ~R$ 0,53
 */
export async function generateWithModelBank(
  productImage: string,
  modelImageUrl: string,
  backgroundType: string = "branco",
  backgroundValue?: string,
): Promise<FashnJobResult> {
  // Passo 1: Try-On Max — vestir a peça na modelo do banco
  const tryonResult = await tryOnProduct({
    productImage,
    modelImage: modelImageUrl,
    prompt: "Preserve ALL garment details exactly: embroidery count and spacing, fabric texture, elastic bands, smocking, ruffles, buttons, folded hems. Do NOT add or remove decorative design elements. REMOVE any price tags, store labels, hanging stickers, barcodes, or plastic tag holders — these are store artifacts, NOT part of the garment. KEEP functional accessories like belts, necklaces, bracelets. Garment must fit naturally on the model body.",
  });

  if (tryonResult.status !== "completed" || !tryonResult.outputUrl) {
    return tryonResult;
  }

  // Passo 2: Edit — alisar roupa + fundo profissional
  const prompt = backgroundType === "personalizado" && backgroundValue
    ? backgroundValue
    : BACKGROUND_PROMPTS[backgroundType];

  return editImage({ image: tryonResult.outputUrl, prompt });
}

/**
 * Criar modelo virtual personalizada a partir de fotos de referência.
 * Custo: variável (~R$ 0,50+)
 */
export async function createModel(params: FashnModelCreateParams): Promise<{ id: string }> {
  const jobId = await submitJob("model-create", {
    name: params.name,
    sample_images: params.sampleImages,
  });
  return { id: jobId };
}

/**
 * Verificar se a API está acessível.
 */
export async function checkFashnHealth(): Promise<boolean> {
  if (!FASHN_API_KEY) return false;

  try {
    const res = await fetch(`${FASHN_API_URL}/status/health`, {
      headers: { Authorization: `Bearer ${FASHN_API_KEY}` },
    });
    return res.ok || res.status === 401;
  } catch {
    return false;
  }
}
