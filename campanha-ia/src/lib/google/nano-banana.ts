/**
 * Google Nano Banana Pro (Gemini 3 Pro Image) — Image Generation Client
 * 
 * Provider principal para geração de modelo vestindo a peça.
 * Funciona enviando a foto do produto + prompt descritivo → recebe foto de modelo gerada.
 * 
 * Modelo: gemini-3-pro-image-preview (Nano Banana Pro)
 * Qualidade: Studio-quality, 4K support, melhor composição
 * Custo: ~$0.05 por imagem (~R$ 0,25)
 */

import { GoogleGenAI } from "@google/genai";

const GOOGLE_AI_API_KEY = process.env.GOOGLE_AI_API_KEY || "";
const MODEL = "gemini-3-pro-image-preview";

// ═══════════════════════════════════════
// Tipos
// ═══════════════════════════════════════

export type BackgroundStyle = 
  | "branco"          // Fundo branco puro e-commerce
  | "estudio"         // Fundo branco profissional (padrão)
  | "lifestyle"       // Ambiente lifestyle com luz natural
  | "boutique"        // Ambiente de loja/boutique elegante
  | "urbano"          // Cenário urbano/rua da cidade
  | "natureza"        // Ambiente ao ar livre com natureza
  | "interior"        // Interior de loft/apartamento
  | "gradiente"       // Gradiente suave rosa-dourado
  | "minha_marca"     // Cor da marca do cliente como fundo gradiente
  | "personalizado";  // Texto livre do cliente

export interface NanoBananaResult {
  status: "completed" | "failed";
  imageBase64: string | null;
  outputUrl: string | null;
  error?: string;
  durationMs?: number;
}

/**
 * Loga custo de uma chamada Nano Banana no banco (async, fire-and-forget)
 * Usa tokens reais do usageMetadata quando disponíveis.
 */
async function logNanoBananaCost(
  durationMs: number,
  success: boolean,
  storeId?: string,
  campaignId?: string,
  usage?: { inputTokens: number; outputTokens: number },
) {
  try {
    const { createAdminClient } = await import("@/lib/supabase/admin");
    const supabase = createAdminClient();
    const { getExchangeRate, getModelPricing } = await import("@/lib/pricing");
    const exchangeRate = await getExchangeRate();

    let costUsd = 0.03; // fallback estimado
    const inputTokens = usage?.inputTokens || 0;
    const outputTokens = usage?.outputTokens || 0;

    // Se temos tokens reais, calcular custo real
    if (inputTokens > 0 || outputTokens > 0) {
      const pricing = await getModelPricing();
      // Usar pricing do modelo real (Nano Banana 2) ou fallback
      const modelPrice = pricing[MODEL] || pricing["gemini-3-pro-image-preview"] || { inputPerMTok: 1.25, outputPerMTok: 10.00 };
      costUsd = (inputTokens * modelPrice.inputPerMTok) / 1_000_000
              + (outputTokens * modelPrice.outputPerMTok) / 1_000_000;
    }

    const costBrl = costUsd * exchangeRate;

    await supabase.from("api_cost_logs").insert({
      store_id: storeId || null,
      campaign_id: campaignId || null,
      provider: "google",
      model_used: MODEL,
      action: "virtual_try_on",
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      tokens_used: inputTokens + outputTokens,
      cost_usd: costUsd,
      cost_brl: costBrl,
      response_time_ms: durationMs,
    });

    if (inputTokens > 0) {
      console.log(`[NanoBanana] 💰 Custo REAL: R$ ${costBrl.toFixed(4)} (${inputTokens}+${outputTokens} tokens)`);
    }
  } catch (e) {
    console.warn("[NanoBanana] Erro ao salvar custo:", e);
  }
}

// ═══════════════════════════════════════
// QA Visual Agent — compara VTO gerado vs produto original
// ═══════════════════════════════════════

interface QAVisualResult {
  approved: boolean;
  corrections: string[];
  /** Se reprovado, prompt de correção para a 2ª chamada */
  refinementPrompt?: string;
}

/**
 * Agente de QA Visual: analisa a imagem VTO gerada e compara com o produto original.
 * Usa Gemini Flash (texto) — custo ~$0.001, ~2-3s.
 * 
 * Retorna approved=true se a imagem está fiel, ou corrections[] com problemas encontrados.
 */
async function qaVisualCheck(
  generatedImageBase64: string,
  productImageBase64: string,
  productMimeType: string,
  closeUpBase64?: string,
  visionData?: {
    fabricDescriptor?: string;
    garmentStructure?: string;
    colorHex?: string;
    criticalDetails?: string[];
  },
): Promise<QAVisualResult> {
  try {
    const ai = new GoogleGenAI({ apiKey: GOOGLE_AI_API_KEY });

    const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [];

    // Imagem 1: Produto original
    parts.push({
      inlineData: { mimeType: productMimeType || "image/jpeg", data: productImageBase64 },
    });

    // Imagem 2: Close-up do tecido (se disponível)
    if (closeUpBase64) {
      parts.push({
        inlineData: { mimeType: "image/jpeg", data: closeUpBase64 },
      });
    }

    // Imagem 3: Imagem VTO gerada
    parts.push({
      inlineData: { mimeType: "image/png", data: generatedImageBase64 },
    });

    // Prompt do QA Agent
    const fabricRef = visionData?.fabricDescriptor ? `\nExpected fabric: ${visionData.fabricDescriptor}` : "";
    const colorRef = visionData?.colorHex ? `\nExpected color hex: ${visionData.colorHex}` : "";
    const structureRef = visionData?.garmentStructure ? `\nExpected structure: ${visionData.garmentStructure}` : "";
    const detailsRef = visionData?.criticalDetails?.length 
      ? `\nCritical details to verify: ${visionData.criticalDetails.join("; ")}` : "";

    parts.push({
      text: `You are a QA inspector for a fashion e-commerce virtual try-on system.

IMAGES PROVIDED:
- Image 1: ORIGINAL PRODUCT (reference — the source of truth)
${closeUpBase64 ? "- Image 2: CLOSE-UP of the fabric texture (reference)" : ""}
- ${closeUpBase64 ? "Image 3" : "Image 2"}: GENERATED virtual try-on image (what we need to verify)

REFERENCE DATA:${fabricRef}${colorRef}${structureRef}${detailsRef}

YOUR TASK: Compare the generated image against the original product using CHAIN OF THOUGHT reasoning.
You MUST analyze step-by-step BEFORE giving your verdict:

STEP 1 — COLOR: Look at both images carefully. What is the EXACT color of the garment in the original? What is the EXACT color in the generated image? Compare hue, saturation, and brightness. Are they the same?

STEP 2 — TEXTURE: What fabric texture do you see in the original (ribbed, smooth, knit, woven, sheer, etc.)? What texture do you see in the generated image? Is it the same type?

STEP 3 — DETAILS: Count specific details in both images. How many buttons? What neckline shape? Any embroidery, patterns, prints, or logos? Compare exact counts and positions.

STEP 4 — FIT & SILHOUETTE: How does the garment sit on the body? Is the length correct? Is it too tight or too loose compared to expected fit?

STEP 5 — MISSING ELEMENTS: Is anything from the original completely absent in the generated image? Check for missing accessories, belts, ties, pockets, etc.

After completing ALL 5 steps with detailed observations, and ONLY THEN, provide your final assessment.

RESPOND in this exact JSON format:
{
  "reasoning": "Brief summary of your step-by-step analysis (2-4 sentences)",
  "approved": true/false,
  "issues": [
    {"category": "color|texture|details|fit|missing", "description": "what's wrong specifically", "severity": "minor|major"}
  ]
}

Rules:
- Only flag REAL visual differences that a customer would notice
- Minor issues (very slight color shift, tiny detail) → approved: true with issues noted
- Major issues (wrong color, missing print, wrong texture, missing piece) → approved: false
- If the image looks good overall, approve it even with minor imperfections
- Be strict about COLOR and FABRIC TEXTURE — these are the most important
- Your reasoning field MUST show evidence of step-by-step analysis`
    });

    console.log(`[QA-Agent] 🔍 Analisando fidelidade do VTO...`);
    const qaStart = Date.now();

    const response = await ai.models.generateContent({
      model: process.env.AI_MODEL_GEMINI_FLASH || "gemini-3-flash-preview",
      contents: [{ role: "user", parts }],
      config: {
        temperature: 0.2,
        maxOutputTokens: 1024,
      } as any,
    });

    const qaMs = Date.now() - qaStart;
    const qaText = response.candidates?.[0]?.content?.parts?.[0]?.text || "";
    console.log(`[QA-Agent] ⏱️ Análise em ${qaMs}ms`);

    // Parse QA response
    try {
      const jsonMatch = qaText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        console.warn("[QA-Agent] ⚠️ Resposta sem JSON, aprovando por padrão");
        return { approved: true, corrections: [] };
      }

      const qa = JSON.parse(jsonMatch[0]);
      const majorIssues = (qa.issues || []).filter((i: any) => i.severity === "major");

      if (qa.reasoning) {
        console.log(`[QA-Agent] 🧠 CoT reasoning: ${qa.reasoning.substring(0, 150)}...`);
      }

      if (qa.approved || majorIssues.length === 0) {
        const minorCount = (qa.issues || []).length - majorIssues.length;
        console.log(`[QA-Agent] ✅ Aprovado (${minorCount} issues menores)`);
        return { approved: true, corrections: [] };
      }

      // Construir prompt de correção baseado nos problemas
      const corrections = majorIssues.map((i: any) => `${i.category}: ${i.description}`);
      const refinementPrompt = majorIssues.map((i: any) => {
        switch (i.category) {
          case "color": return `FIX COLOR: ${i.description}. Match the EXACT color from the original product photo.`;
          case "texture": return `FIX TEXTURE: ${i.description}. The fabric must match the original texture precisely.`;
          case "details": return `FIX DETAILS: ${i.description}. Preserve ALL original garment details exactly.`;
          case "fit": return `FIX FIT: ${i.description}. Adjust the garment fit to look natural.`;
          case "missing": return `FIX MISSING: ${i.description}. Include this element from the original.`;
          default: return `FIX: ${i.description}`;
        }
      }).join("\n");

      console.log(`[QA-Agent] ❌ Reprovado — ${majorIssues.length} problema(s) grave(s):`);
      corrections.forEach((c: string) => console.log(`  └─ ${c}`));

      return { approved: false, corrections, refinementPrompt };
    } catch {
      console.warn("[QA-Agent] ⚠️ Erro ao parsear resposta QA, aprovando por padrão");
      return { approved: true, corrections: [] };
    }
  } catch (err) {
    console.warn("[QA-Agent] ❌ Falha no QA (não fatal):", err instanceof Error ? err.message : err);
    return { approved: true, corrections: [] }; // fail-open: se QA falhar, aceita a imagem
  }
}

export interface NanoBananaTryOnParams {
  /** Base64 da foto do produto (sem o prefixo data:...) */
  productImageBase64: string;
  /** MIME type da foto do produto */
  productMimeType?: string;
  /** Base64 da foto close-up do tecido (opcional) */
  closeUpBase64?: string;
  /** MIME type da foto close-up */
  closeUpMimeType?: string;
  /** Base64 da segunda peça do conjunto (opcional) */
  secondPieceBase64?: string;
  /** MIME type da segunda peça */
  secondPieceMimeType?: string;
  /** Base64 da foto do modelo do banco */
  modelImageBase64: string;
  /** MIME type da foto do modelo */
  modelMimeType?: string;
  /** Descrição da peça (do vision analysis) */
  productDescription?: string;
  /** Tipo de corpo da modelo */
  bodyType?: "normal" | "plus";
  /** Estilo de cenário/fundo */
  background?: BackgroundStyle;
  /** Tipo de campanha (define aspect ratio) */
  campaignType?: "instagram_feed" | "instagram_story" | "ecommerce" | "banner";
  /** Base64 da foto de cenário personalizado (quando background = "personalizado") */
  customBackgroundBase64?: string;
  /** MIME type da foto de cenário personalizado */
  customBackgroundMimeType?: string;
  /** Cor hex da marca do cliente (quando background = "minha_marca") */
  brandColorHex?: string;
  /** Store ID para tracking de custo */
  storeId?: string;
  /** Campaign ID para tracking de custo */
  campaignId?: string;
  /** Dados VTO do Vision Analysis (Step 1) para fidelidade máxima */
  visionData?: {
    fabricDescriptor?: string;
    garmentStructure?: string;
    colorHex?: string;
    criticalDetails?: string[];
  };
}

// ═══════════════════════════════════════
// Cenários
// ═══════════════════════════════════════

const BACKGROUND_PROMPTS: Record<string, string> = {
  branco: "Pure clean white background, minimalist fashion e-commerce style, even soft lighting.",
  estudio: "Clean white studio background with professional fashion ecommerce lighting, soft shadows.",
  lifestyle: "Aspirational lifestyle setting, bright airy café or cozy apartment with natural window light, warm tones, slightly blurred background.",
  boutique: "Elegant fashion boutique interior background with tasteful decor, soft warm lighting, clothing racks subtly blurred in background. The environment should look like a high-end Brazilian fashion store.",
  urbano: "Urban city street background, stylish neighborhood with modern architecture, natural daylight. The model appears to be casually walking on a clean sidewalk.",
  natureza: "Beautiful outdoor setting with soft natural light, lush green vegetation slightly blurred in background, golden hour lighting.",
  interior: "Modern minimalist loft interior with large windows and abundant natural light, neutral tones, elegant furniture subtly blurred in background.",
  gradiente: "Smooth soft gradient background transitioning from pastel pink to warm peach-gold, fashion brand aesthetic, studio lighting.",
  minha_marca: "Smooth elegant gradient studio background using the brand's signature color tones, professional fashion photography lighting, subtle shadows.",
  personalizado: "Use the provided background/store photo as the environment. Place the model naturally in this exact location, matching the lighting and perspective.",
};

// ═══════════════════════════════════════
// Prompt otimizado para moda
// ═══════════════════════════════════════

function buildTryOnPrompt(params: {
  description?: string;
  background?: BackgroundStyle;
  brandColorHex?: string;
  bodyType?: "normal" | "plus";
  hasCloseUp?: boolean;
  hasSecondPiece?: boolean;
  hasCustomBackground?: boolean;
  visionData?: {
    fabricDescriptor?: string;
    garmentStructure?: string;
    colorHex?: string;
    criticalDetails?: string[];
  };
}): string {
  const bgRaw = params.background || "estudio";
  // Handle "personalizado:descrição livre" format from frontend
  let bg = bgRaw as string;
  let customBgText = "";
  if (bg.startsWith("personalizado:")) {
    customBgText = bg.substring("personalizado:".length).trim();
    bg = "personalizado";
  }
  let bgPrompt = BACKGROUND_PROMPTS[bg] || BACKGROUND_PROMPTS["estudio"];
  // Inject custom text into personalizado prompt
  if (bg === "personalizado" && customBgText) {
    bgPrompt = `Background scene: ${customBgText}. Place the model naturally in this setting with matching lighting and perspective. Professional fashion photography style.`;
  }
  // Inject brand color hex into minha_marca prompt
  if (bg === "minha_marca" && params.brandColorHex) {
    bgPrompt = `Smooth elegant gradient studio background centered around the brand color ${params.brandColorHex}. Create a subtle gradient from a lighter tint of this color to a darker shade, professional fashion photography lighting, subtle shadows. The background must harmonize with the brand identity.`;
  }
  const isPlus = params.bodyType === "plus";

  const closeUpInstruction = params.hasCloseUp
    ? "\n- The THIRD image is a CLOSE-UP of the fabric texture. Examine it carefully to reproduce the EXACT same texture (ribbed, knit, woven, smooth, etc.) on the generated garment. This is the most important reference for material accuracy."
    : "";

  const secondPieceInstruction = params.hasSecondPiece
    ? "\n- The FOURTH image is the SECOND PIECE of the set/conjunto (e.g., matching skirt, pants, or top). The model must wear BOTH pieces together as a coordinated set."
    : "";

  const customBgInstruction = params.hasCustomBackground
    ? "\n- One of the images is the CLIENT'S STORE/LOCATION. Use it as the background environment, matching perspective and lighting."
    : "";

  const bodyTypeInstruction = isPlus
    ? "The model should have a plus-size/curvy body type (Brazilian GG/XGG sizing, approximately US size 14-22). Voluptuous, confident, beautiful curves."
    : "The model should have a standard/slim body type (Brazilian P/M sizing, approximately US size 4-8). Slim, athletic build.";

  const basePrompt = `You are a world-class fashion photography editor specializing in Brazilian e-commerce.

TASK: Generate a SINGLE photorealistic image of a real-looking Brazilian woman model wearing the EXACT garment shown in the product photos.

IMAGE INPUTS (in order):
- The FIRST image is the REFERENCE MODEL — match her EXACT face, skin tone, hair style, and body proportions.
- The SECOND image is the MAIN PRODUCT on a mannequin — this is the garment to recreate EXACTLY.${closeUpInstruction}${secondPieceInstruction}${customBgInstruction}

MODEL BODY TYPE (CRITICAL):
1. ${bodyTypeInstruction}
2. The garment must FIT this body type naturally — adjust how the fabric drapes, stretches, and falls on this specific body shape.
3. DO NOT change the body type from the reference — if the instruction says standard, generate a standard body; if plus, generate plus.

GARMENT RULES (CRITICAL):
4. PRESERVE the garment EXACTLY: same color, fabric texture, pattern, neckline, sleeves, length, and ALL details (buttons, rings, zippers, embroidery, seams)
5. The fabric texture must be IDENTICAL to the original product photo
${params.visionData?.fabricDescriptor ? `5b. FABRIC TEXTURE FIDELITY: This garment is made of ${params.visionData.fabricDescriptor}. The generated image MUST show this exact texture — do not smooth, simplify, or change the fabric appearance.` : ""}
${params.visionData?.colorHex ? `5c. COLOR TARGET: Match the garment color to approximately ${params.visionData.colorHex}. Do NOT shift the hue, saturation, or brightness.` : ""}
${params.visionData?.garmentStructure ? `5d. GARMENT STRUCTURE: ${params.visionData.garmentStructure}. Maintain this exact silhouette when worn.` : ""}
${params.visionData?.criticalDetails?.length ? `5e. CRITICAL DETAILS TO PRESERVE: ${params.visionData.criticalDetails.join("; ")}` : ""}
6. PAY SPECIAL ATTENTION to elastic bands, ribbed edges, and cuffs — reproduce them tightly and precisely as shown on the mannequin
7. DO NOT add, remove, or modify ANY garment detail
8. EMBROIDERY/PRINTS COUNT: If the garment has embroidered elements (stars, flowers, etc.), reproduce the EXACT SAME NUMBER and SPACING as shown in the product photo. Do NOT add extra elements or make the pattern denser than the original.
9. Match the EXACT proportions of the garment relative to the body — if the top is cropped, it should end at exactly the same point
10. If the garment is a TOP (blouse, shirt, crop top), pair it with stylish high-waisted jeans or the bottom shown in the product photo
11. DO NOT alter the garment in any way: no color shifts, no texture changes, no added or removed patterns, no simplified embroidery

FOOTWEAR (MANDATORY):
10. The model must ALWAYS wear appropriate footwear — NEVER barefoot
11. Choose footwear that complements the outfit:
   - For casual looks: clean white sneakers or stylish sandals
   - For elegant/formal looks: nude heels or strappy sandals
   - For bohemian/relaxed looks: espadrilles or flat sandals
   - For sporty looks: fashionable sneakers

BACKGROUND:
12. ${bgPrompt}

PHOTOGRAPHY:
13. Full body photo from head to feet including shoes, vertical portrait orientation
14. Natural confident pose, one hand slightly on hip or relaxed, looking at camera with a natural smile
15. Professional fashion photography lighting with subtle shadows
16. The model should look like a REAL person, not AI-generated
17. Output ONLY the image, absolutely no text or watermarks

PHYSICAL REALISM REQUIREMENTS (CRITICAL):
18. The fabric texture must be PERFECTLY UNIFORM and physically realistic across the entire garment — no smudged, melted or morphed fabric zones
19. The model has EXACTLY two arms and two legs in anatomically correct positions with natural proportions
20. The neckline, collar, and garment opening shapes must EXACTLY MATCH the original product photo
21. All seams must be straight, continuous, and match the original garment construction
22. The garment silhouette must maintain physically correct proportions — no stretched, compressed, or warped sections
23. Fabric folds and draping must follow real-world gravity and body contour physics`;

  if (params.description) {
    return `${basePrompt}\n\nProduct details for reference: ${params.description}`;
  }
  return basePrompt;
}

// ═══════════════════════════════════════
// API
// ═══════════════════════════════════════

/**
 * Gera foto de modelo vestindo a peça usando Nano Banana Pro.
 * Envia: foto do produto + (opcional) close-up + (opcional) cenário + modelo de referência + prompt
 * Recebe: foto gerada em base64
 */
export async function nanoBananaTryOn(params: NanoBananaTryOnParams): Promise<NanoBananaResult> {
  if (!GOOGLE_AI_API_KEY) {
    return { status: "failed", imageBase64: null, outputUrl: null, error: "GOOGLE_AI_API_KEY não configurada" };
  }

  const start = Date.now();

  try {
    const ai = new GoogleGenAI({ apiKey: GOOGLE_AI_API_KEY });

    // Montar as parts: imagens + prompt
    // ORDEM CRÍTICA: Modelo → Produto → Close-up → 2ª Peça → Cenário → Prompt
    // Cada imagem é claramente identificada no prompt para evitar confusão
    const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [];

    // 1. Modelo de referência (PRIMEIRO — rosto, corpo, tom de pele)
    parts.push({
      inlineData: {
        mimeType: params.modelMimeType || "image/png",
        data: params.modelImageBase64,
      },
    });

    // 2. Foto do produto principal (SEGUNDO — outfit completo no manequim)
    parts.push({
      inlineData: {
        mimeType: params.productMimeType || "image/jpeg",
        data: params.productImageBase64,
      },
    });

    // 3. Close-up do tecido (TERCEIRO — textura, detalhes — opcional)
    if (params.closeUpBase64) {
      parts.push({
        inlineData: {
          mimeType: params.closeUpMimeType || "image/jpeg",
          data: params.closeUpBase64,
        },
      });
    }

    // 4. Cenário personalizado (opcional)
    if (params.background === "personalizado" && params.customBackgroundBase64) {
      parts.push({
        inlineData: {
          mimeType: params.customBackgroundMimeType || "image/jpeg",
          data: params.customBackgroundBase64,
        },
      });
    }

    // 5. Segunda peça do conjunto (opcional)
    if (params.secondPieceBase64) {
      parts.push({
        inlineData: {
          mimeType: params.secondPieceMimeType || "image/jpeg",
          data: params.secondPieceBase64,
        },
      });
    }

    // 6. Prompt
    parts.push({
      text: buildTryOnPrompt({
        description: params.productDescription,
        background: params.background,
        brandColorHex: params.brandColorHex,
        bodyType: params.bodyType,
        hasCloseUp: !!params.closeUpBase64,
        hasSecondPiece: !!params.secondPieceBase64,
        hasCustomBackground: params.background === "personalizado" && !!params.customBackgroundBase64,
        visionData: params.visionData,
      }),
    });

    // Mapear aspect ratio por tipo de campanha
    const aspectRatios: Record<string, string> = {
      instagram_feed: "4:5",
      instagram_story: "9:16",
      ecommerce: "3:4",
      banner: "16:9",
    };
    const aspectRatio = aspectRatios[params.campaignType || "instagram_feed"] || "4:5";

    const response = await ai.models.generateContent({
      model: MODEL,
      contents: [{
        role: "user",
        parts,
      }],
      config: {
        responseModalities: ["TEXT", "IMAGE"],
        imageConfig: {
          aspectRatio,
          imageSize: "1024",
        },
      } as any,
    });

    const durationMs = Date.now() - start;

    // Extrair usageMetadata para custo REAL
    const usageMetadata = (response as any).usageMetadata;
    const usage = usageMetadata ? {
      inputTokens: usageMetadata.promptTokenCount || usageMetadata.inputTokens || 0,
      outputTokens: usageMetadata.candidatesTokenCount || usageMetadata.outputTokens || 0,
    } : undefined;

    if (usage) {
      console.log(`[NanoBanana] 📊 Tokens reais: input=${usage.inputTokens}, output=${usage.outputTokens}`);
    }

    // Extrair imagem do response
    if (response.candidates?.[0]?.content?.parts) {
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData?.data) {
          logNanoBananaCost(durationMs, true, params.storeId, params.campaignId, usage).catch(() => {});
          
          // ── QA Visual Agent: verificar fidelidade da imagem ──
          console.log(`[NanoBanana] 🔍 Iniciando QA Visual Agent...`);
          const qaResult = await qaVisualCheck(
            part.inlineData.data,
            params.productImageBase64,
            params.productMimeType || "image/jpeg",
            params.closeUpBase64,
            params.visionData,
          );

          if (qaResult.approved) {
            // ✅ QA aprovado — retornar imagem da 1ª geração
            console.log(`[NanoBanana] ✅ QA aprovado — usando 1ª geração (${durationMs}ms)`);
            return {
              status: "completed",
              imageBase64: part.inlineData.data,
              outputUrl: null,
              durationMs,
            };
          }

          // ❌ QA reprovado — verificar se há tempo para retry
          const elapsedSoFar = Date.now() - start;
          const VPS_TIMEOUT_REDLINE_MS = 35_000; // 35s — limite seguro antes do 504 do NGINX

          if (elapsedSoFar > VPS_TIMEOUT_REDLINE_MS) {
            // ⏱️ Timeout Limiter: sem tempo para retry, entregar V1 com imperfeições
            console.warn(`[NanoBanana] ⏱️ Timeout Limiter: ${elapsedSoFar}ms > ${VPS_TIMEOUT_REDLINE_MS}ms redline — entregando V1 com imperfeições`);
            return {
              status: "completed",
              imageBase64: part.inlineData.data,
              outputUrl: null,
              durationMs: elapsedSoFar,
            };
          }

          console.log(`[NanoBanana] 🔄 QA reprovado (${elapsedSoFar}ms elapsed, dentro do limite) — gerando 2ª tentativa com correções...`);
          try {
            const retryStart = Date.now();

            // Adicionar correções do QA ao prompt original
            const correctedPrompt = buildTryOnPrompt({
              description: params.productDescription,
              background: params.background,
              brandColorHex: params.brandColorHex,
              bodyType: params.bodyType,
              hasCloseUp: !!params.closeUpBase64,
              hasSecondPiece: !!params.secondPieceBase64,
              hasCustomBackground: params.background === "personalizado" && !!params.customBackgroundBase64,
              visionData: params.visionData,
            });

            // Construir prompt de correção PRIORIZADO baseado nos problemas do QA
            // Ordenar issues por severidade: major primeiro, depois minor
            const sortedIssues = [...(qaResult.corrections || [])].sort((a, b) => {
              const aSev = a.includes("COLOR") || a.includes("TEXTURE") ? 0 : 1;
              const bSev = b.includes("COLOR") || b.includes("TEXTURE") ? 0 : 1;
              return aSev - bSev;
            });
            const primaryIssue = sortedIssues[0] || qaResult.refinementPrompt?.split("\n")[0] || "";

            const refinementSuffix = `\n\n[RETRY FOCUS CRITICAL OVERRIDE — this instruction has MAXIMUM PRIORITY]\n\nThe FIRST generation attempt FAILED quality control. The issues found, in order of severity:\n\n${qaResult.refinementPrompt}\n\nPRIMARY FAILURE (fix this FIRST, above all else): ${primaryIssue}\n\nIf you must trade off between perfecting the background/pose vs. getting the garment fidelity right, ALWAYS prioritize the garment fidelity. Every other instruction is secondary to correcting the issues listed above.\n\n${params.visionData?.colorHex ? `COLOR TARGET: The garment color MUST match approximately ${params.visionData.colorHex}. Do NOT shift the hue.` : ""}`;

            // Reusar as mesmas parts mas com prompt corrigido
            const retryParts = parts.slice(0, -1); // remove o prompt antigo
            retryParts.push({ text: correctedPrompt + refinementSuffix });

            const retryResponse = await ai.models.generateContent({
              model: MODEL,
              contents: [{ role: "user", parts: retryParts }],
              config: {
                responseModalities: ["TEXT", "IMAGE"],
                imageConfig: {
                  aspectRatio,
                  imageSize: "2K",
                },
              } as any,
            });

            const retryDuration = Date.now() - retryStart;
            const totalDuration = Date.now() - start;

            // Extrair usageMetadata da 2ª chamada
            const retryUsage = (retryResponse as any).usageMetadata;
            const retryTokens = retryUsage ? {
              inputTokens: retryUsage.promptTokenCount || retryUsage.inputTokens || 0,
              outputTokens: retryUsage.candidatesTokenCount || retryUsage.outputTokens || 0,
            } : undefined;

            logNanoBananaCost(retryDuration, true, params.storeId, params.campaignId, retryTokens).catch(() => {});

            if (retryResponse.candidates?.[0]?.content?.parts) {
              for (const retryPart of retryResponse.candidates[0].content.parts) {
                if (retryPart.inlineData?.data) {
                  console.log(`[NanoBanana] ✅ 2ª geração OK (${retryDuration}ms, total ${totalDuration}ms)`);
                  return {
                    status: "completed",
                    imageBase64: retryPart.inlineData.data,
                    outputUrl: null,
                    durationMs: totalDuration,
                  };
                }
              }
            }

            // 2ª geração não produziu imagem — usar a 1ª mesmo
            console.warn("[NanoBanana] ⚠️ 2ª geração sem imagem — usando 1ª geração");
            return {
              status: "completed",
              imageBase64: part.inlineData.data,
              outputUrl: null,
              durationMs: totalDuration,
            };
          } catch (retryErr) {
            // Erro na 2ª geração — usar a 1ª geração como fallback
            console.warn("[NanoBanana] ⚠️ Erro na 2ª geração:", retryErr instanceof Error ? retryErr.message : retryErr);
            return {
              status: "completed",
              imageBase64: part.inlineData.data,
              outputUrl: null,
              durationMs: Date.now() - start,
            };
          }
        }
      }
    }

    logNanoBananaCost(durationMs, false, params.storeId, params.campaignId, usage).catch(() => {});
    return {
      status: "failed",
      imageBase64: null,
      outputUrl: null,
      error: "Nano Banana não retornou imagem",
      durationMs,
    };
  } catch (error: any) {
    const durationMs = Date.now() - start;
    logNanoBananaCost(durationMs, false, params.storeId, params.campaignId).catch(() => {});
    return {
      status: "failed",
      imageBase64: null,
      outputUrl: null,
      error: `Nano Banana error: ${error.message}`,
      durationMs,
    };
  }
}

/**
 * Lista os cenários disponíveis para o frontend
 */
export function getAvailableBackgrounds(): Array<{ id: BackgroundStyle; label: string; description: string }> {
  return [
    { id: "branco", label: "Branco", description: "Fundo branco puro, estilo e-commerce" },
    { id: "estudio", label: "Estúdio", description: "Fundo branco com iluminação profissional" },
    { id: "lifestyle", label: "Lifestyle", description: "Ambiente aspiracional com luz natural" },
    { id: "boutique", label: "Boutique", description: "Interior de loja elegante" },
    { id: "urbano", label: "Urbano", description: "Cenário de rua com arquitetura moderna" },
    { id: "natureza", label: "Natureza", description: "Ambiente natural com vegetação e luz dourada" },
    { id: "interior", label: "Interior", description: "Loft moderno com luz natural" },
    { id: "gradiente", label: "Gradiente", description: "Gradiente suave rosa-dourado" },
    { id: "minha_marca", label: "Minha Marca", description: "Fundo com a cor da sua marca" },
    { id: "personalizado", label: "Personalizado", description: "Descreva o cenário que deseja" },
  ];
}

/**
 * Verifica se a API Google AI está configurada
 */
export function isNanoBananaAvailable(): boolean {
  return !!GOOGLE_AI_API_KEY;
}
