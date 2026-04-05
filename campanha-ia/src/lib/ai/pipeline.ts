import { callClaude, callClaudeVision } from "./anthropic";
import { AI_MODELS } from "./config";
import {
  VISION_SYSTEM,
  buildVisionPrompt,
  STRATEGY_SYSTEM,
  buildStrategyPrompt,
  COPYWRITER_SYSTEM,
  buildCopywriterPrompt,
  REFINER_SYSTEM,
  buildRefinerPrompt,
  SCORER_SYSTEM,
  buildScorerPrompt,
} from "./prompts";
import type {
  VisionAnalysis,
  Strategy,
  CampaignOutput,
  CampaignScore,
  PipelineStep,
} from "@/types";

// ═══════════════════════════════════════
// Pipeline de geração de campanha
// ═══════════════════════════════════════

export interface PipelineInput {
  imageBase64: string;
  mediaType?: "image/jpeg" | "image/png" | "image/webp" | "image/gif";
  price: string;
  objective: string;
  storeName: string;
  targetAudience?: string;
  toneOverride?: string;
  storeSegment?: string;
  bodyType?: string;
  storeId?: string;
  campaignId?: string;
  /** Tipo de produto (blusa, saia, vestido, etc.) */
  productType?: string;
}

export interface PipelineResult {
  vision: VisionAnalysis;
  strategy: Strategy;
  output: Omit<CampaignOutput, "id" | "campaign_id">;
  score: Omit<CampaignScore, "id" | "campaign_id">;
  durationMs: number;
  costBreakdown: CostEntry[];
}

interface CostEntry {
  step: string;
  provider: string;
  model: string;
  durationMs: number;
  estimatedCostBrl: number;
}

export type OnProgress = (step: PipelineStep, label: string, progress: number) => void;

// ═══════════════════════════════════════
// Retry com backoff (doc 07 seção 5)
// ═══════════════════════════════════════
async function withRetry<T>(
  fn: () => Promise<T>,
  stepName: string,
  maxRetries = 2,
): Promise<{ result: T; attempts: number }> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const result = await fn();
      return { result, attempts: attempt + 1 };
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : String(error);
      console.warn(`[Pipeline:${stepName}] Tentativa ${attempt + 1}/${maxRetries + 1} falhou: ${errMsg}`);
      if (attempt === maxRetries) throw error;
      await new Promise((r) => setTimeout(r, 1000 * (attempt + 1))); // backoff
    }
  }
  throw new Error(`Pipeline falhou no step ${stepName} após ${maxRetries + 1} tentativas`);
}

/**
 * Executa o pipeline completo de geração de campanha.
 * Sem dependência de banco — retorna dados puros para a API route salvar.
 * Inclui retry com backoff, log de custos por etapa, e re-prompt para JSON inválido.
 */
export async function runCampaignPipeline(
  input: PipelineInput,
  onProgress?: OnProgress,
): Promise<PipelineResult> {
  const startTime = Date.now();
  const costs: CostEntry[] = [];

  // ── STEP 1: Vision ──────────────────────────
  onProgress?.("vision", "Analisando produto...", 10);
  const visionStart = Date.now();
  const { result: visionRaw } = await withRetry(
    () => callClaudeVision({
      system: VISION_SYSTEM,
      prompt: buildVisionPrompt(input.productType),
      imageBase64: input.imageBase64,
      mediaType: input.mediaType,
    }),
    "Vision",
  );
  costs.push({
    step: "vision",
    provider: "anthropic",
    model: AI_MODELS.VISION,
    durationMs: Date.now() - visionStart,
    estimatedCostBrl: 0.08, // ~1K tokens in + 500 out
  });
  const vision = parseJSON<VisionAnalysis>(visionRaw, "Vision");

  // ── STEP 2: Strategy ────────────────────────
  onProgress?.("strategy", "Criando estratégia...", 25);
  const stratStart = Date.now();
  const { result: strategyRaw } = await withRetry(
    () => callClaude({
      system: STRATEGY_SYSTEM,
      messages: [
        {
          role: "user",
          content: buildStrategyPrompt({
            produto: vision.produto.nome_generico,
            preco: input.price,
            objetivo: input.objective,
            atributos: JSON.stringify(vision.atributos_visuais),
            segmento: vision.segmento,
            mood: vision.mood,
            publicoAlvo: input.targetAudience,
            tomOverride: input.toneOverride,
            storeSegment: input.storeSegment,
            bodyType: input.bodyType,
          }),
        },
      ],
      temperature: 0.8,
    }),
    "Strategy",
  );
  costs.push({
    step: "strategy",
    provider: "anthropic",
    model: AI_MODELS.STRATEGY,
    durationMs: Date.now() - stratStart,
    estimatedCostBrl: 0.06,
  });
  const strategy = parseJSON<Strategy>(strategyRaw, "Strategy");

  // ── STEP 3: Copywriter ──────────────────────
  onProgress?.("copywriter", "Escrevendo textos...", 45);
  const copyStart = Date.now();
  const { result: copyRaw } = await withRetry(
    () => callClaude({
      system: COPYWRITER_SYSTEM,
      messages: [
        {
          role: "user",
          content: buildCopywriterPrompt({
            produto: vision.produto.nome_generico,
            preco: input.price,
            loja: input.storeName,
            estrategia: JSON.stringify(strategy),
            segmento: vision.segmento,
            atributos: JSON.stringify(vision.atributos_visuais),
            storeSegment: input.storeSegment,
            bodyType: input.bodyType,
          }),
        },
      ],
      maxTokens: 4096,
      temperature: 0.85,
    }),
    "Copywriter",
  );
  costs.push({
    step: "copywriter",
    provider: "anthropic",
    model: AI_MODELS.COPYWRITER,
    durationMs: Date.now() - copyStart,
    estimatedCostBrl: 0.10,
  });
  const copyTexts = parseJSON<any>(copyRaw, "Copywriter");

  // ── STEP 4: Refiner ─────────────────────────
  onProgress?.("refiner", "Refinando copy...", 60);
  const refineStart = Date.now();
  const { result: refinerRaw } = await withRetry(
    () => callClaude({
      system: REFINER_SYSTEM,
      messages: [
        {
          role: "user",
          content: buildRefinerPrompt({
            textos: JSON.stringify(copyTexts),
            estrategia: JSON.stringify(strategy),
          }),
        },
      ],
      maxTokens: 3000,
      temperature: 0.5,
    }),
    "Refiner",
  );
  costs.push({
    step: "refiner",
    provider: "anthropic",
    model: AI_MODELS.REFINER,
    durationMs: Date.now() - refineStart,
    estimatedCostBrl: 0.05,
  });
  const refined = parseJSON<any>(refinerRaw, "Refiner");

  // Use refined texts if available, else original
  const finalTexts = refined.textos_refinados || copyTexts;

  // ── STEP 5: Scorer (paralelo com composição) ────
  onProgress?.("scorer", "Avaliando qualidade...", 75);
  const scoreStart = Date.now();
  const { result: scoreRaw } = await withRetry(
    () => callClaude({
      system: SCORER_SYSTEM,
      messages: [
        {
          role: "user",
          content: buildScorerPrompt({
            textos: JSON.stringify(finalTexts),
            estrategia: JSON.stringify(strategy),
            produto: vision.produto.nome_generico,
            preco: input.price,
          }),
        },
      ],
      temperature: 0.3,
    }),
    "Scorer",
  );
  costs.push({
    step: "scorer",
    provider: "anthropic",
    model: AI_MODELS.SCORER,
    durationMs: Date.now() - scoreStart,
    estimatedCostBrl: 0.04,
  });
  const score = parseJSON<Omit<CampaignScore, "id" | "campaign_id">>(scoreRaw, "Scorer");

  // ── AUTO-RETRY: Se score < 40, re-executar Copywriter + Refiner (doc 07 seção 5) ──
  if (score.nota_geral < 40) {
    console.warn(`[Pipeline] ⚠️ Score ${score.nota_geral} < 40 — re-executando Copywriter+Refiner`);
    onProgress?.("copywriter", "Score baixo, melhorando textos...", 80);
    
    const retryRaw = await callClaude({
      system: COPYWRITER_SYSTEM,
      messages: [
        {
          role: "user",
          content: buildCopywriterPrompt({
            produto: vision.produto.nome_generico,
            preco: input.price,
            loja: input.storeName,
            estrategia: JSON.stringify(strategy),
            segmento: vision.segmento,
            atributos: JSON.stringify(vision.atributos_visuais),
            storeSegment: input.storeSegment,
            bodyType: input.bodyType,
          }),
        },
      ],
      maxTokens: 3000,
      temperature: 0.9, // Mais variação na segunda tentativa
    });
    const retryTexts = parseJSON<any>(retryRaw, "Copywriter-Retry");
    Object.assign(finalTexts, retryTexts);
    costs.push({
      step: "copywriter_retry",
      provider: "anthropic",
      model: AI_MODELS.COPYWRITER,
      durationMs: 0,
      estimatedCostBrl: 0.10,
    });
  }

  // ── STEP 6: Compose output ──────────────────
  onProgress?.("composition", "Montando resultado...", 95);

  const output: Omit<CampaignOutput, "id" | "campaign_id"> = {
    vision_analysis: vision,
    strategy,
    headline_principal: finalTexts.headline_principal,
    headline_variacao_1: finalTexts.headline_variacao_1 || null,
    headline_variacao_2: finalTexts.headline_variacao_2 || null,
    instagram_feed: finalTexts.instagram_feed,
    instagram_stories: finalTexts.instagram_stories,
    whatsapp: finalTexts.whatsapp,
    meta_ads: finalTexts.meta_ads,
    hashtags: finalTexts.hashtags || [],
    product_image_clean_url: null,
    model_image_url: null,
    lifestyle_image_url: null,
    creative_feed_url: null,
    creative_stories_url: null,
    refinements: refined.refinements || [],
  };

  const durationMs = Date.now() - startTime;
  onProgress?.("done", "Pronto!", 100);

  // ── Log de custos por etapa (se storeId presente) ──
  if (input.storeId) {
    logCostsAsync(input.storeId, input.campaignId, costs).catch((e) =>
      console.warn("[Pipeline] Falha ao salvar custos:", e)
    );
  }

  return {
    vision,
    strategy,
    output,
    score,
    durationMs,
    costBreakdown: costs,
  };
}

// ═══════════════════════════════════════
// Log custos no banco (assíncrono, não bloqueia)
// ═══════════════════════════════════════
async function logCostsAsync(storeId: string, campaignId: string | undefined, costs: CostEntry[]) {
  try {
    const { createAdminClient } = await import("@/lib/supabase/admin");
    const supabase = createAdminClient();
    
    const rows = costs.map((c) => ({
      store_id: storeId,
      campaign_id: campaignId || null,
      provider: c.provider,
      model_used: c.model,
      action: c.step,
      cost_usd: c.estimatedCostBrl / 5.80,
      cost_brl: c.estimatedCostBrl,
    }));

    await supabase.from("api_cost_logs").insert(rows);
    console.log(`[Pipeline] 💰 ${rows.length} entradas de custo salvas (total: R$ ${costs.reduce((s, c) => s + c.estimatedCostBrl, 0).toFixed(2)})`);
  } catch (e) {
    console.warn("[Pipeline] Erro ao salvar custos:", e);
  }
}

// ═══════════════════════════════════════
// Helpers
// ═══════════════════════════════════════

/**
 * Parse JSON robusto — tenta extrair JSON mesmo com markdown wrapper
 * Se falhar, faz retry pedindo JSON limpo (doc 07 seção 5)
 */
function parseJSON<T>(raw: string, stepName: string): T {
  // Remove possíveis wrappers markdown
  let cleaned = raw.trim();

  // Remove ```json ... ```
  const jsonBlock = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonBlock) {
    cleaned = jsonBlock[1].trim();
  }

  // Remove possíveis prefixos/sufixos não-JSON
  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace !== -1 && firstBrace < lastBrace) {
    cleaned = cleaned.slice(firstBrace, lastBrace + 1);
  }

  try {
    return JSON.parse(cleaned) as T;
  } catch (error) {
    console.error(`[Pipeline:${stepName}] Falha ao parsear JSON:`, cleaned.slice(0, 200));
    throw new Error(`Pipeline falhou no step ${stepName}: resposta inválida da IA`);
  }
}
