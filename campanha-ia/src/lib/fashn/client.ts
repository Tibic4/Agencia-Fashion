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

// Custos dinâmicos por operação Fashn.ai — lidos de admin_settings
// Fallback hardcoded usado se banco indisponível
// Fonte: https://help.fashn.ai/plans-and-pricing/api-pricing
// On-Demand: $0.075/crédito.
const FASHN_COST_FALLBACK: Record<string, number> = {
  "product-to-model": 0.075,
  "tryon-max": 0.15,
  "edit": 0.075,
  "model-create": 0.075,
  "background-remove": 0.075,
};

/**
 * Loga custo de uma chamada Fashn.ai no banco (async, fire-and-forget)
 * Usa pricing dinâmico de admin_settings quando disponível.
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
    const { getExchangeRate, getFashnCostUsd } = await import("@/lib/pricing");

    const [exchangeRate, fashnCosts] = await Promise.all([
      getExchangeRate(),
      getFashnCostUsd(),
    ]);

    const costUsd = fashnCosts[modelName] ?? FASHN_COST_FALLBACK[modelName] ?? 0;
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

// ═══════════════════════════════════════
// VTO Vision Bridge — dados do Step 1 para instruir Fashn
// ═══════════════════════════════════════

export interface VisionDataForVTO {
  fabricDescriptor?: string;  // ex: "ribbed knit with visible vertical channels, matte finish"
  garmentStructure?: string;  // ex: "structured shoulders, elastic waistband, A-line silhouette"
  colorHex?: string;          // ex: "#F5C6D0"
  criticalDetails?: string[]; // ex: ["gold buttons on front placket, 5 total"]
}

/**
 * Constrói prompt dinâmico para Fashn.ai tryon-max usando dados do Vision.
 * Maximiza fidelidade de textura, cor e detalhes da peça.
 */
function buildFashnTryOnPrompt(visionData?: VisionDataForVTO): string {
  const parts: string[] = [];

  // Base instruction
  parts.push("Dress the model in the garment shown in the product photo. The garment must fit naturally on the model body.");

  // Fabric fidelity (highest priority)
  if (visionData?.fabricDescriptor) {
    parts.push(`FABRIC FIDELITY (CRITICAL): The garment fabric is ${visionData.fabricDescriptor}. Reproduce this EXACT texture on the model — the surface must show the same weave pattern, sheen level, and weight. Do NOT smooth or simplify the texture.`);
  }

  // Structural integrity
  if (visionData?.garmentStructure) {
    parts.push(`GARMENT STRUCTURE: ${visionData.garmentStructure}. The garment must maintain this exact silhouette when worn.`);
  }

  // Color accuracy
  if (visionData?.colorHex) {
    parts.push(`COLOR ACCURACY: The garment color must match approximately ${visionData.colorHex}. Do NOT shift the hue, saturation, or brightness of the fabric.`);
  }

  // Critical details
  if (visionData?.criticalDetails?.length) {
    parts.push(`MUST PRESERVE these exact details: ${visionData.criticalDetails.join("; ")}.`);
  }

  // Universal garment preservation + negative prompts
  parts.push("Preserve ALL garment details exactly: embroidery count and spacing, fabric texture, elastic bands, smocking, ruffles, buttons, folded hems, ribbed cuffs.");
  parts.push("REMOVE any price tags, store labels, hanging stickers, barcodes, or plastic tag holders — these are store artifacts, NOT part of the garment. KEEP functional accessories like belts, necklaces, bracelets.");
  parts.push("DO NOT alter the garment in any way: no color shifts, no texture changes, no added or removed patterns, no simplified embroidery, no extra decorative elements.");

  return parts.join("\n");
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
  /** Dados VTO do Vision Analysis (Step 1) para fidelidade máxima */
  visionData?: VisionDataForVTO;
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
      const errorMsg = data.error?.message || data.error || data.message || JSON.stringify(data);
      console.error(`[Fashn] ❌ Job ${jobId} FAILED:`, errorMsg);
      return {
        id: jobId,
        status: "failed",
        outputUrl: null,
        error: typeof errorMsg === 'string' ? errorMsg : "Job failed",
      };
    }
  }

  return { id: jobId, status: "processing", outputUrl: null };
}

// ═══════════════════════════════════════
// API Pública
// ═══════════════════════════════════════

/**
 * Vestir uma peça em um modelo (Virtual Try-On).
 * Requer foto de modelo com corpo visível.
 * Custo: ~R$ 0,87 (2 créditos — quality mode auto)
 */
export async function tryOnProduct(params: FashnTryOnParams & { storeId?: string; campaignId?: string }): Promise<FashnJobResult> {
  const start = Date.now();
  const jobId = await submitJob("tryon-max", {
    model_image: params.modelImage,
    product_image: params.productImage,
    ...(params.prompt ? { prompt: params.prompt } : {}),
  });
  const result = await pollResult(jobId);
  logFashnCost("virtual_try_on", "tryon-max", Date.now() - start, result.status === "completed", params.storeId, params.campaignId).catch(() => {});
  return result;
}

/**
 * Editar/refinar imagem gerada (alisar roupa, mudar fundo, etc).
 * Custo: ~R$ 0,44 (1 crédito — fast mode auto em 1K)
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

/** Prompts de cenário v2 — iluminação coerente + negative prompts universais */
const UNIVERSAL_NEGATIVE = "DO NOT alter garment color, DO NOT change fabric texture, DO NOT add patterns, DO NOT remove or simplify embroidery. The garment must retain its true color regardless of ambient lighting — warm/cool light should tint SKIN but NOT the garment fabric.";

const BACKGROUND_PROMPTS: Record<string, string> = {
  branco: `Professional fashion e-commerce photo in clean white studio. Even soft diffused overhead lighting at 5500K (neutral white), subtle floor shadow. CRITICAL: Preserve ALL garment details exactly — embroidery count, fabric texture, elastic bands, ribbed cuffs, folded hems, buttons. Smooth fabric without unnatural wrinkles. REMOVE any price tags, store labels, hanging stickers, barcodes, or plastic tag holders from the garment — these are NOT part of the design. KEEP functional accessories like belts, necklaces, bracelets. Remove any mannequin parts, stands, poles, or dark artifacts completely. Clean natural skin on legs and arms with consistent skin tone. Full body visible from head to feet including shoes. ${UNIVERSAL_NEGATIVE}`,
  estudio: `Professional fashion photo in elegant studio with soft gradient backdrop (light grey to white). Professional softbox lighting from front-left, fill light from right, creating soft directional shadows. CRITICAL: Preserve ALL garment details exactly — smocking, ruffles, embroidery patterns, elastic gathering, tie straps. Smooth fabric. REMOVE any price tags, store labels, hanging stickers, barcodes from the garment. KEEP functional accessories like belts, necklaces. Remove any mannequin artifacts, stands or poles completely. Natural skin tones throughout body. ${UNIVERSAL_NEGATIVE}`,
  lifestyle: `Professional fashion photo in bright modern apartment interior with natural sunlight from large windows. Warm golden-hour light from the left, creating soft natural shadows. Contemporary furniture visible in soft focus background. CRITICAL: Preserve ALL garment construction details exactly as shown. Smooth fabric draping naturally with the pose. REMOVE any price tags, store labels, hanging stickers, barcodes from the garment. KEEP functional accessories. Remove any artificial elements, mannequin parts completely. Natural warm skin tones matching ambient light. ${UNIVERSAL_NEGATIVE}`,
  urbano: `Professional fashion photo on a modern city street. Textured concrete or brick wall background, urban sidewalk, moody street-style atmosphere. Cool overcast daylight at ~6500K with slight shadows from buildings. CRITICAL: Preserve ALL garment details exactly. Smooth fabric. REMOVE any price tags, store labels, barcodes. KEEP functional accessories. Remove mannequin artifacts. Natural skin tones with cool undertone from environment. ${UNIVERSAL_NEGATIVE}`,
  natureza: `Professional fashion photo in a beautiful natural garden setting. Lush green tropical plants, soft bokeh background, golden hour sunlight filtering through leaves from the right side. Warm 4500K light temperature. CRITICAL: Preserve ALL garment details exactly. Smooth fabric draping naturally. REMOVE any price tags, store labels, barcodes. KEEP functional accessories. Remove mannequin artifacts. Warm natural skin tones matching golden hour. ${UNIVERSAL_NEGATIVE}`,
  interior: `Professional fashion photo in a modern minimalist interior. Clean white loft apartment with large windows and abundant natural light from behind, contemporary furniture visible in soft focus. Bright airy atmosphere with neutral 5000K lighting. CRITICAL: Preserve ALL garment details exactly. Smooth fabric. REMOVE any price tags, store labels, barcodes. KEEP functional accessories. Remove mannequin artifacts. ${UNIVERSAL_NEGATIVE}`,
  boutique: `Professional fashion photo inside a luxury fashion boutique. Elegant marble surfaces, gold accents, clothing racks softly blurred in background, warm ambient store lighting at ~3500K. Premium retail atmosphere. CRITICAL: Preserve ALL garment details exactly. Smooth fabric. REMOVE any price tags, store labels, barcodes. KEEP functional accessories. Remove mannequin artifacts. ${UNIVERSAL_NEGATIVE}`,
  gradiente: `Professional fashion photo with elegant smooth gradient backdrop transitioning from soft rose pink to warm peach gold. Abstract premium brand aesthetic feel. Soft even studio lighting at 5500K, no directional shadows. CRITICAL: Preserve ALL garment details exactly. Smooth fabric. REMOVE any price tags, store labels, barcodes. KEEP functional accessories. Remove mannequin artifacts. ${UNIVERSAL_NEGATIVE}`,
  personalizado: `Professional fashion photo, smooth fabric without wrinkles. CRITICAL: Preserve ALL original garment details. REMOVE any price tags, store labels, hanging stickers, barcodes. KEEP functional accessories. Remove any mannequin artifacts. ${UNIVERSAL_NEGATIVE}`,
};

/**
 * Pipeline com Banco de Modelos: try-on + edit.
 * Usa uma modelo pré-gerada do banco para vestir a peça.
 * Custo Fashn: ~R$ 1,31 (3 créditos: 2 tryon-max + 1 edit)
 */
export async function generateWithModelBank(
  productImage: string,
  modelImageUrl: string,
  backgroundType: string = "branco",
  backgroundValue?: string,
  visionData?: VisionDataForVTO,
): Promise<FashnJobResult> {
  // Passo 1: Try-On Max — vestir a peça na modelo do banco (com VTO data do Vision)
  const tryonResult = await tryOnProduct({
    productImage,
    modelImage: modelImageUrl,
    visionData,
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
 * Gerar preview de modelo personalizada — mesmo padrão do banco stock.
 * Corpo inteiro, descalça, camiseta branca + short preto, fundo branco.
 * Custo: 1 crédito (~$0.075)
 */
export async function generateCustomModelPreview(params: {
  skinTone: string;
  hairStyle: string;
  bodyType: string;
  style: string;
  ageRange: string;
  name: string;
  storeId?: string;
}): Promise<FashnJobResult> {
  const skinMap: Record<string, string> = {
    branca: "light/fair skin",
    morena_clara: "light brown/olive skin",
    morena: "medium brown skin",
    negra: "dark brown/black skin",
  };
  const hairMap: Record<string, string> = {
    liso: "straight hair",
    ondulado: "wavy hair",
    cacheado: "curly hair",
    crespo: "coily/afro-textured hair",
    curto: "short hair",
  };
  const bodyMap: Record<string, string> = {
    magra: "slim/athletic build (US 2-6)",
    media: "average build (US 8-12)",
    plus_size: "plus-size/curvy body (US 14-20, wide hips, full curves)",
  };
  const ageMap: Record<string, string> = {
    jovem_18_25: "young woman aged 18-25",
    adulta_26_35: "adult woman aged 26-35",
    madura_36_50: "mature woman aged 36-50",
  };
  const styleMap: Record<string, string> = {
    casual_natural: "relaxed casual pose, natural friendly expression, hands relaxed at sides",
    elegante: "elegant confident pose, sophisticated poised expression, one hand on hip",
    esportivo: "dynamic athletic pose, energetic bright expression, slight weight shift",
    urbano: "cool street-style pose, edgy confident expression, relaxed asymmetric stance",
  };

  const skinDesc = skinMap[params.skinTone] || "medium skin";  
  const hairDesc = hairMap[params.hairStyle] || "wavy hair";
  const bodyDesc = bodyMap[params.bodyType] || "average build";
  const ageDesc = ageMap[params.ageRange] || "adult woman aged 26-35";
  const styleDesc = styleMap[params.style] || "relaxed natural pose, friendly expression";

  const prompt = `Full body photo from head to bare feet of a Brazilian ${ageDesc} with ${skinDesc}, ${hairDesc}, ${bodyDesc}. Wearing a plain white crew-neck t-shirt and plain black shorts. ${styleDesc}. Clean white studio background, professional fashion e-commerce photography. High resolution, sharp focus. Barefoot, NO shoes. Full body VISIBLE from head to toes. NO cropping at knees or ankles. NO accessories, NO jewelry.`;

  const start = Date.now();
  const jobId = await submitJob("product-to-model", {
    prompt,
    aspect_ratio: "9:16",
  });
  const result = await pollResult(jobId);
  logFashnCost("custom_model_preview", "product-to-model", Date.now() - start, result.status === "completed", params.storeId).catch(() => {});
  return result;
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
