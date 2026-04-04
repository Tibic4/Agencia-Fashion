/**
 * Fashn.ai — Virtual Try-On API Client
 *
 * Documentação: https://docs.fashn.ai
 * Funcionalidades:
 *  - Vestir roupas em modelos virtuais (product-to-model)
 *  - Criar modelos virtuais personalizadas (model-create)
 */

const FASHN_API_URL = process.env.FASHN_API_URL || "https://api.fashn.ai/v1";
const FASHN_API_KEY = process.env.FASHN_API_KEY || "";

interface FashnTryOnParams {
  /** URL da foto do produto (roupa) */
  garmentImageUrl: string;
  /** URL da foto do modelo */
  modelImageUrl: string;
  /** Categoria da peça */
  category?: "tops" | "bottoms" | "one-pieces";
}

interface FashnTryOnResult {
  id: string;
  status: "completed" | "processing" | "failed";
  outputUrl: string | null;
}

interface FashnModelCreateParams {
  /** Nome do modelo */
  name: string;
  /** URLs das fotos de referência (mínimo 4) */
  sampleImages: string[];
}

interface FashnModelCreateResult {
  id: string;
  status: string;
}

/**
 * Vestir uma peça em um modelo virtual (Virtual Try-On).
 */
export async function tryOnProduct(params: FashnTryOnParams): Promise<FashnTryOnResult> {
  if (!FASHN_API_KEY) {
    throw new Error("FASHN_API_KEY não configurada");
  }

  // 1. Criar o job de try-on
  const createRes = await fetch(`${FASHN_API_URL}/run`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${FASHN_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model_image: params.modelImageUrl,
      garment_image: params.garmentImageUrl,
      category: params.category || "tops",
    }),
  });

  if (!createRes.ok) {
    const error = await createRes.text();
    throw new Error(`Fashn.ai run error (${createRes.status}): ${error}`);
  }

  const job = await createRes.json();
  const jobId = job.id;

  // 2. Polling para obter resultado (máx 60s)
  const maxAttempts = 30;
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise((r) => setTimeout(r, 2000));

    const statusRes = await fetch(`${FASHN_API_URL}/status/${jobId}`, {
      headers: { Authorization: `Bearer ${FASHN_API_KEY}` },
    });

    if (!statusRes.ok) continue;

    const status = await statusRes.json();

    if (status.status === "completed") {
      return {
        id: jobId,
        status: "completed",
        outputUrl: status.output?.[0] || status.output_url || null,
      };
    }

    if (status.status === "failed") {
      return { id: jobId, status: "failed", outputUrl: null };
    }
  }

  return { id: jobId, status: "processing", outputUrl: null };
}

/**
 * Criar um modelo virtual personalizado (model training).
 */
export async function createModel(params: FashnModelCreateParams): Promise<FashnModelCreateResult> {
  if (!FASHN_API_KEY) {
    throw new Error("FASHN_API_KEY não configurada");
  }

  const res = await fetch(`${FASHN_API_URL}/models`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${FASHN_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: params.name,
      samples: params.sampleImages,
    }),
  });

  if (!res.ok) {
    const error = await res.text();
    throw new Error(`Fashn.ai model create error (${res.status}): ${error}`);
  }

  const result = await res.json();
  return { id: result.id, status: result.status };
}

/**
 * Verificar se a API está acessível.
 */
export async function checkFashnHealth(): Promise<boolean> {
  if (!FASHN_API_KEY) return false;

  try {
    const res = await fetch(`${FASHN_API_URL}/status`, {
      headers: { Authorization: `Bearer ${FASHN_API_KEY}` },
    });
    return res.ok || res.status === 401; // 401 = key inválida mas API acessível
  } catch {
    return false;
  }
}
