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

interface FashnProductToModelParams {
  /** URL ou base64 data URI da foto do produto */
  productImage: string;
}

interface FashnTryOnParams {
  /** URL ou base64 da foto do produto (roupa) */
  garmentImage: string;
  /** URL ou base64 da foto do modelo */
  modelImage: string;
  /** Categoria da peça */
  category?: "tops" | "bottoms" | "one-pieces" | "auto";
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
export async function productToModel(params: FashnProductToModelParams): Promise<FashnJobResult> {
  const jobId = await submitJob("product-to-model", {
    product_image: params.productImage,
  });
  return pollResult(jobId);
}

/**
 * Vestir uma peça em um modelo (Virtual Try-On).
 * Requer foto de modelo com corpo visível.
 * Custo: ~R$ 0,43
 */
export async function tryOnProduct(params: FashnTryOnParams): Promise<FashnJobResult> {
  const jobId = await submitJob("tryon-v1.6", {
    model_image: params.modelImage,
    garment_image: params.garmentImage,
    category: params.category || "auto",
  });
  return pollResult(jobId);
}

/**
 * Editar/refinar imagem gerada (alisar roupa, mudar fundo, etc).
 * Custo: ~R$ 0,10
 */
export async function editImage(params: FashnEditParams): Promise<FashnJobResult> {
  const jobId = await submitJob("edit", {
    image: params.image,
    prompt: params.prompt,
  });
  return pollResult(jobId);
}

/** Prompts de fundo otimizados (anti-manequim) */
const BACKGROUND_PROMPTS: Record<string, string> = {
  branco: "Professional fashion photo in white studio. Smooth fabric, no wrinkles. Remove any mannequin parts, stands, poles, or dark artifacts. Clean natural skin on legs and arms. Soft studio lighting. Full body visible.",
  estudio: "Professional fashion photo in elegant studio. Smooth fabric. Remove any mannequin artifacts, stands or poles. Natural skin tones throughout body. Soft gradient backdrop. Professional lighting.",
  lifestyle: "Professional fashion photo in urban outdoor setting. Smooth fabric. Remove any artificial elements, mannequin parts. Natural skin tones. Natural lighting.",
  personalizado: "Professional fashion photo, smooth fabric without wrinkles. Remove any mannequin artifacts.",
};

/**
 * Pipeline A+: product-to-model + edit (alisar + fundo).
 * Usado quando NÃO há modelo do banco selecionada.
 * Custo total: ~R$ 0,25
 */
export async function generateModelImage(
  productImage: string,
  backgroundType: "branco" | "estudio" | "lifestyle" | "personalizado" = "branco",
  backgroundValue?: string,
): Promise<FashnJobResult> {
  // Passo 1: Gerar modelo vestindo a peça (com prompt melhor)
  const jobId = await submitJob("product-to-model", {
    product_image: productImage,
    prompt: "Full body fashion model, standing pose, natural skin tone on legs and arms, no mannequin, no black legs, no stand or pole, professional fashion photo, white studio background",
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
  garmentImage: string,
  modelImageUrl: string,
  category: "tops" | "bottoms" | "one-pieces" | "auto" = "auto",
  backgroundType: "branco" | "estudio" | "lifestyle" | "personalizado" = "branco",
  backgroundValue?: string,
): Promise<FashnJobResult> {
  // Passo 1: Try-On — vestir a peça na modelo do banco
  const tryonResult = await tryOnProduct({
    garmentImage,
    modelImage: modelImageUrl,
    category,
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
