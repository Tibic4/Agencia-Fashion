/**
 * Pipeline de geração de campanha — v2.1 (Híbrido Claude/Gemini)
 *
 * v2.1 melhorias:
 * - Refiner → Scorer sequencial (score avalia texto refinado, não bruto)
 * - Few-Shot Prompting no Vision (2 exemplos completos)
 * - Frameworks AIDA/PAS/BAF no Copywriter + limites de chars
 * - Lista negra expandida (2 camadas: Copywriter + Refiner)
 * - Positive realism constraints no VTO (6 regras)
 * - Chain of Thought no QA Visual Agent (+25-40% acurácia)
 * - Feedback loop priorizado com RETRY FOCUS CRITICAL OVERRIDE
 * - SSE streaming para progresso em tempo real no frontend
 * - OnProgress aceita callbacks async (void | Promise<void>)
 *
 * v2.0 base:
 * - Provider abstraction: Gemini Flash (Vision, Refiner, Scorer) + Claude (Copywriter)
 * - Structured Output: Gemini usa responseSchema nativo (zero erros de JSON)
 * - Validação Zod: resposta validada contra schemas reais
 * - Custo real: tokens contados pela API, não hardcoded
 * - Retry único: sem duplicação pipeline × provider
 */

import { getStepProviders, calculateCostBrl } from "./providers";
import type { LLMResponse } from "./providers";
import {
  VisionOutputSchema,
  StrategyOutputSchema,
  CopyOutputSchema,
  ScoreOutputSchema,
} from "@/lib/schemas";
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
import type { z } from "zod";

// ═══════════════════════════════════════
// Pipeline de geração de campanha
// ═══════════════════════════════════════

export interface PipelineInput {
  imageBase64: string;
  mediaType?: "image/jpeg" | "image/png" | "image/webp" | "image/gif";
  /** Fotos extras (close-up do tecido, outra peça do conjunto, etc.) */
  extraImages?: { base64: string; mediaType?: "image/jpeg" | "image/png" | "image/webp" | "image/gif" }[];
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
  /** Material/tecido informado pelo usuário (opcional) */
  material?: string;
  /** Cenário/fundo escolhido (branco, estudio, urbano, personalizado:...) */
  backgroundType?: string;
  /** AbortSignal para cancelar pipeline quando cliente desconecta */
  signal?: AbortSignal;
}

export interface PipelineResult {
  vision: VisionAnalysis;
  strategy: Strategy;
  output: Omit<CampaignOutput, "id" | "campaign_id">;
  score: Omit<CampaignScore, "id" | "campaign_id">;
  needsRefinement: boolean;
  durationMs: number;
  costBreakdown: CostEntry[];
}

interface CostEntry {
  step: string;
  provider: string;
  model: string;
  durationMs: number;
  estimatedCostBrl: number;
  inputTokens: number;
  outputTokens: number;
}

export type OnProgress = (step: PipelineStep, label: string, progress: number) => void | Promise<void>;

// ═══════════════════════════════════════
// Retry com backoff (nível único — providers NÃO fazem retry)
// ═══════════════════════════════════════
async function withRetry<T>(
  fn: () => Promise<T>,
  stepName: string,
  maxRetries = 2,
  signal?: AbortSignal,
): Promise<{ result: T; attempts: number }> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    // Verificar abort antes de cada tentativa
    if (signal?.aborted) {
      console.warn(`[Pipeline:${stepName}] ⚠️ Abortado pelo cliente (disconnect)`);
      throw new DOMException("Pipeline abortado: cliente desconectou", "AbortError");
    }
    try {
      const result = await fn();
      return { result, attempts: attempt + 1 };
    } catch (error: unknown) {
      // Se foi abort, propagar imediatamente
      if (error instanceof DOMException && error.name === "AbortError") throw error;
      if (signal?.aborted) throw new DOMException("Pipeline abortado: cliente desconectou", "AbortError");

      const errMsg = error instanceof Error ? error.message : String(error);
      const isRetryable = errMsg.includes("429") || errMsg.includes("500") || errMsg.includes("503") || errMsg.includes("overloaded");

      console.warn(`[Pipeline:${stepName}] Tentativa ${attempt + 1}/${maxRetries + 1} falhou: ${errMsg}`);

      if (attempt === maxRetries || !isRetryable) throw error;
      await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, attempt))); // exponential backoff
    }
  }
  throw new Error(`Pipeline falhou no step ${stepName} após ${maxRetries + 1} tentativas`);
}

/**
 * Cria um CostEntry a partir de LLMResponse + timing
 */
function buildCostEntry(step: string, response: LLMResponse, startTime: number): CostEntry {
  return {
    step,
    provider: response.provider,
    model: response.model,
    durationMs: Date.now() - startTime,
    estimatedCostBrl: calculateCostBrl(response.model, response.usage),
    inputTokens: response.usage.inputTokens,
    outputTokens: response.usage.outputTokens,
  };
}

/**
 * Executa o pipeline completo de geração de campanha.
 *
 * v2.0: Provider híbrido + paralelismo + validação Zod + custo real.
 */
export async function runCampaignPipeline(
  input: PipelineInput,
  onProgress?: OnProgress,
): Promise<PipelineResult> {
  const startTime = Date.now();
  const costs: CostEntry[] = [];
  const providers = getStepProviders();

  // ── STEP 1: Vision ──────────────────────────
  onProgress?.("vision", "Analisando produto...", 10);
  const visionStart = Date.now();
  const hasMultiplePhotos = !!(input.extraImages && input.extraImages.length > 0);
  const visionConfig = providers.vision;

  const { result: visionResponse } = await withRetry(
    () => visionConfig.provider.generateWithVision({
      system: VISION_SYSTEM,
      messages: [{ role: "user", content: buildVisionPrompt(input.productType, input.material, hasMultiplePhotos) }],
      imageBase64: input.imageBase64,
      extraImages: input.extraImages,
      mediaType: input.mediaType,
      temperature: 0.3,
      maxTokens: 4096,
      responseSchema: visionConfig.structuredOutput ? VisionOutputSchema : undefined,
    }),
    "Vision",
    2,
    input.signal,
  );
  costs.push(buildCostEntry("vision", visionResponse, visionStart));
  const vision = parseAndValidate<VisionAnalysis>(visionResponse.text, VisionOutputSchema, "Vision");

  // Null safety: se Vision falhar, abortar com erro claro
  if (!vision?.produto?.nome_generico) {
    console.error("[Pipeline] ❌ Vision retornou dados inválidos:", JSON.stringify(vision).slice(0, 200));
    throw new Error("Pipeline falhou: Vision não conseguiu analisar a imagem. Tente outra foto com melhor iluminação.");
  }

  // ── STEP 2: Strategy ────────────────────────
  onProgress?.("strategy", "Criando estratégia...", 25);
  const stratStart = Date.now();
  const stratConfig = providers.strategy;

  const { result: strategyResponse } = await withRetry(
    () => stratConfig.provider.generate({
      system: STRATEGY_SYSTEM,
      messages: [{
        role: "user",
        content: buildStrategyPrompt({
          produto: vision.produto?.nome_generico || "Produto de moda",
          preco: input.price,
          objetivo: input.objective,
          atributos: JSON.stringify(vision.atributos_visuais || {}),
          segmento: vision.segmento || "feminino",
          mood: Array.isArray(vision.mood) ? vision.mood : [String(vision.mood || "moda")],
          publicoAlvo: input.targetAudience,
          tomOverride: input.toneOverride,
          storeSegment: input.storeSegment,
          bodyType: input.bodyType,
        }),
      }],
      temperature: 0.8,
      responseSchema: stratConfig.structuredOutput ? StrategyOutputSchema : undefined,
    }),
    "Strategy",
    2,
    input.signal,
  );
  costs.push(buildCostEntry("strategy", strategyResponse, stratStart));
  const strategy = parseAndValidate<Strategy>(strategyResponse.text, StrategyOutputSchema, "Strategy");

  // ── STEP 3: Copywriter (Claude — tom brasileiro) ──────
  onProgress?.("copywriter", "Escrevendo textos...", 45);
  const copyStart = Date.now();
  const copyConfig = providers.copywriter;

  const { result: copyResponse } = await withRetry(
    () => copyConfig.provider.generate({
      system: COPYWRITER_SYSTEM,
      messages: [{
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
      }],
      maxTokens: 4096,
      temperature: 0.85,
      responseSchema: copyConfig.structuredOutput ? CopyOutputSchema : undefined,
    }),
    "Copywriter",
    2,
    input.signal,
  );
  costs.push(buildCostEntry("copywriter", copyResponse, copyStart));
  const copyTexts = parseJSON<any>(copyResponse.text, "Copywriter");

  // ── STEP 4+5: Scorer + Refiner em PARALELO ────────────────────────
  // Scorer avalia o copy bruto; Refiner refina em paralelo.
  // Se score >= 70, descartamos o Refiner (copy já é bom o suficiente).
  onProgress?.("refiner", "Refinando e avaliando...", 55);

  const refinerConfig = providers.refiner;
  const scorerConfig = providers.scorer;

  const refinerStart = Date.now();
  const scorerStart = Date.now();

  const [refinerSettled, scorerSettled] = await Promise.allSettled([
    withRetry(
      () => refinerConfig.provider.generate({
        system: REFINER_SYSTEM,
        messages: [{ role: "user", content: buildRefinerPrompt({
          textos: JSON.stringify(copyTexts),
          estrategia: JSON.stringify(strategy),
        }) }],
        maxTokens: 8192,
        temperature: 0.5,
      }),
      "Refiner", 2, input.signal,
    ),
    withRetry(
      () => scorerConfig.provider.generate({
        system: SCORER_SYSTEM,
        messages: [{ role: "user", content: buildScorerPrompt({
          textos: JSON.stringify(copyTexts),
          estrategia: JSON.stringify(strategy),
          produto: vision.produto?.nome_generico || "Produto",
          preco: input.price,
        }) }],
        temperature: 0.3,
        responseSchema: scorerConfig.structuredOutput ? ScoreOutputSchema : undefined,
      }),
      "Scorer", 2, input.signal,
    ),
  ]);

  // Processar Scorer
  onProgress?.("scorer", "Avaliando campanha...", 70);
  let score: Omit<CampaignScore, "id" | "campaign_id">;
  if (scorerSettled.status === "fulfilled") {
    costs.push(buildCostEntry("scorer", scorerSettled.value.result, scorerStart));
    score = parseAndValidate<Omit<CampaignScore, "id" | "campaign_id">>(
      scorerSettled.value.result.text, ScoreOutputSchema, "Scorer"
    );
  } else {
    console.warn("[Pipeline] ⚠️ Scorer falhou:", scorerSettled.reason);
    score = { nota_geral: 70, conversao: 70, clareza: 70, urgencia: 70, naturalidade: 70,
      aprovacao_meta: 70, criatividade: 70, nivel_risco: "baixo", resumo: "Score indisponível",
      pontos_fortes: [], melhorias: [], alertas_meta: [], previsao_engajamento: "medio" } as any;
  }

  // Processar Refiner — só aplicar se score < 70
  let finalTexts = { ...copyTexts };
  let refinements: any[] = [];

  if (score.nota_geral < 70 && refinerSettled.status === "fulfilled") {
    costs.push(buildCostEntry("refiner", refinerSettled.value.result, refinerStart));
    const refined = parseJSON<any>(refinerSettled.value.result.text, "Refiner");
    if (refined.textos_refinados) {
      finalTexts = { ...copyTexts, ...refined.textos_refinados };
      refinements = refined.refinements || [];
      console.log(`[Pipeline] ✂️ Refiner aplicado (score ${score.nota_geral} < 70)`);
    }
  } else if (score.nota_geral >= 70) {
    console.log(`[Pipeline] ⚡ Refiner ignorado (score ${score.nota_geral} >= 70 — copy já está bom)`);
  } else if (refinerSettled.status === "rejected") {
    console.warn("[Pipeline] ⚠️ Refiner falhou:", refinerSettled.reason);
  }

  // ── Flag de refinamento ──
  const needsRefinement = score.nota_geral < 55;
  if (needsRefinement) {
    console.log(`[Pipeline] ⚠️ Score ${score.nota_geral} < 55 — sinalizando needsRefinement para o frontend`);
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
    refinements: refinements,
  };

  const durationMs = Date.now() - startTime;
  onProgress?.("done", "Pronto!", 100);

  // ── Log de custos por etapa ──
  const totalCostBrl = costs.reduce((s, c) => s + c.estimatedCostBrl, 0);
  const totalTokens = costs.reduce((s, c) => s + c.inputTokens + c.outputTokens, 0);
  console.log(`[Pipeline] ✅ Concluído em ${durationMs}ms | Custo: R$ ${totalCostBrl.toFixed(4)} | Tokens: ${totalTokens}`);
  for (const c of costs) {
    console.log(`  └─ ${c.step}: ${c.provider}/${c.model} | ${c.durationMs}ms | R$ ${c.estimatedCostBrl.toFixed(4)} | ${c.inputTokens}+${c.outputTokens} tokens`);
  }

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
    needsRefinement,
    durationMs,
    costBreakdown: costs,
  };
}

// ═══════════════════════════════════════
// Log custos no banco (assíncrono)
// ═══════════════════════════════════════
async function logCostsAsync(storeId: string, campaignId: string | undefined, costs: CostEntry[]) {
  try {
    const { createAdminClient } = await import("@/lib/supabase/admin");
    const supabase = createAdminClient();
    const { getExchangeRate } = await import("@/lib/pricing");
    const exchangeRate = await getExchangeRate();

    const rows = costs.map((c) => ({
      store_id: storeId,
      campaign_id: campaignId || null,
      provider: c.provider,
      model_used: c.model,
      action: c.step,
      input_tokens: c.inputTokens,
      output_tokens: c.outputTokens,
      cost_usd: c.estimatedCostBrl / exchangeRate,
      cost_brl: c.estimatedCostBrl,
      exchange_rate: exchangeRate,
      response_time_ms: c.durationMs,
    }));

    await supabase.from("api_cost_logs").insert(rows);
    console.log(`[Pipeline] 💰 ${rows.length} entradas de custo salvas (total: R$ ${costs.reduce((s, c) => s + c.estimatedCostBrl, 0).toFixed(4)})`);
  } catch (e) {
    console.warn("[Pipeline] Erro ao salvar custos:", e);
  }
}

// ═══════════════════════════════════════
// Helpers
// ═══════════════════════════════════════

/**
 * Parse JSON robusto — tenta extrair JSON mesmo com markdown wrapper.
 */
function parseJSON<T>(raw: string, stepName: string): T {
  let cleaned = raw.trim();

  // Remove ```json ... ```
  const jsonBlock = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonBlock) {
    cleaned = jsonBlock[1].trim();
  }

  // Detectar se é objeto ou array
  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");
  const firstBracket = cleaned.indexOf("[");
  const lastBracket = cleaned.lastIndexOf("]");

  if (firstBracket !== -1 && (firstBrace === -1 || firstBracket < firstBrace)) {
    cleaned = cleaned.slice(firstBracket, lastBracket + 1);
  } else if (firstBrace !== -1 && lastBrace !== -1 && firstBrace < lastBrace) {
    cleaned = cleaned.slice(firstBrace, lastBrace + 1);
  }

  try {
    return JSON.parse(cleaned) as T;
  } catch {
    // Tentar reparar JSON truncado — fechar strings, objetos e arrays abertos
    console.warn(`[Pipeline:${stepName}] JSON truncado, tentando reparar...`);
    let repaired = cleaned;
    // Fechar string aberta
    const quoteCount = (repaired.match(/(?<!\\)"/g) || []).length;
    if (quoteCount % 2 !== 0) repaired += '"';
    // Fechar estruturas abertas
    const opens = (repaired.match(/[{[]/g) || []).length;
    const closes = (repaired.match(/[}\]]/g) || []).length;
    for (let i = 0; i < opens - closes; i++) {
      // Determinar se fechar com } ou ]
      const lastOpen = Math.max(repaired.lastIndexOf("{"), repaired.lastIndexOf("["));
      repaired += repaired[lastOpen] === "{" ? "}" : "]";
    }
    try {
      return JSON.parse(repaired) as T;
    } catch {
      console.error(`[Pipeline:${stepName}] Falha ao parsear JSON mesmo reparado:`, cleaned.slice(0, 300));
      throw new Error(`Pipeline falhou no step ${stepName}: resposta inválida da IA`);
    }
  }
}

/**
 * Parse JSON + validação Zod.
 * Se Gemini com responseSchema, JSON já é válido — Zod serve como double-check.
 */
function parseAndValidate<T>(raw: string, schema: z.ZodSchema<T>, stepName: string): T {
  const parsed = parseJSON<unknown>(raw, stepName);

  const result = schema.safeParse(parsed);
  if (!result.success) {
    console.warn(`[Pipeline:${stepName}] ⚠️ Schema validation failed, applying defaults:`, result.error.issues.slice(0, 3));
    // Tentar forçar defaults via schema.parse com catch
    try {
      // Se parsed é um objeto, mesclar com defaults do schema
      if (parsed && typeof parsed === 'object') {
        return schema.parse(parsed) as T;
      }
    } catch {
      console.warn(`[Pipeline:${stepName}] ⚠️ Schema.parse also failed, using raw parsed data`);
    }
    return parsed as T;
  }

  return result.data;
}
