/**
 * CriaLook — Camada de acesso ao banco de dados (Supabase)
 * 
 * Todas as operações de CRUD centralizzadas aqui.
 * Usa o admin client (service_role) para operações do servidor.
 */

import { createAdminClient } from "@/lib/supabase/admin";

// ═══════════════════════════════════════════════════════════
// STORES
// ═══════════════════════════════════════════════════════════

export interface CreateStoreInput {
  clerkUserId: string;
  name: string;
  segmentPrimary: string;
  city?: string;
  state?: string;
  instagramHandle?: string;
}

export interface StoreRecord {
  id: string;
  clerk_user_id: string;
  name: string;
  segment_primary: string;
  city: string | null;
  state: string | null;
  instagram_handle: string | null;
  plan_id: string | null;
  onboarding_completed: boolean;
  created_at: string;
}

/** Cria a loja do usuário e inicializa store_usage do período */
export async function createStore(input: CreateStoreInput): Promise<StoreRecord> {
  const supabase = createAdminClient();

  // Buscar plano free/starter padrão
  const { data: freePlan } = await supabase
    .from("plans")
    .select("id, campaigns_per_month")
    .eq("name", "gratis")
    .single();

  const { data: store, error } = await supabase
    .from("stores")
    .insert({
      clerk_user_id: input.clerkUserId,
      name: input.name,
      segment_primary: input.segmentPrimary,
      city: input.city || null,
      state: input.state || null,
      instagram_handle: input.instagramHandle || null,
      plan_id: freePlan?.id || null,
      onboarding_completed: true,
    })
    .select()
    .single();

  if (error) throw new Error(`Erro ao criar loja: ${error.message}`);

  // Criar período de usage do mês atual
  const now = new Date();
  const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  await supabase.from("store_usage").insert({
    store_id: store.id,
    period_start: periodStart.toISOString().split("T")[0],
    period_end: periodEnd.toISOString().split("T")[0],
    campaigns_generated: 0,
    campaigns_limit: freePlan?.campaigns_per_month || 5,
  });

  return store;
}

/** Busca a loja pelo clerk_user_id */
export async function getStoreByClerkId(clerkUserId: string): Promise<StoreRecord | null> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("stores")
    .select("*")
    .eq("clerk_user_id", clerkUserId)
    .single();
  return data;
}

// ═══════════════════════════════════════════════════════════
// STORE MODELS
// ═══════════════════════════════════════════════════════════

export interface CreateModelInput {
  storeId: string;
  skinTone: string;
  hairStyle: string;
  bodyType: string;
  style?: string;
  ageRange?: string;
  name?: string;
}

export async function createStoreModel(input: CreateModelInput) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("store_models")
    .insert({
      store_id: input.storeId,
      skin_tone: input.skinTone,
      hair_style: input.hairStyle,
      body_type: input.bodyType,
      style: input.style || "casual",
      age_range: input.ageRange || "25-35",
      name: input.name || "Modelo",
    })
    .select()
    .single();

  if (error) throw new Error(`Erro ao criar modelo: ${error.message}`);
  return data;
}

/**
 * Busca o modelo ativo da loja (último criado e ativo)
 */
export async function getActiveModel(storeId: string) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("store_models")
    .select("*")
    .eq("store_id", storeId)
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.warn(`[DB] Erro ao buscar modelo ativo: ${error.message}`);
    return null;
  }
  return data;
}

/** Lista todos os modelos da loja */
export async function listStoreModels(storeId: string) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("store_models")
    .select("*")
    .eq("store_id", storeId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(`Erro ao listar modelos: ${error.message}`);
  return data || [];
}

/** Deleta um modelo da loja */
export async function deleteStoreModel(storeId: string, modelId: string) {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("store_models")
    .delete()
    .eq("id", modelId)
    .eq("store_id", storeId);

  if (error) throw new Error(`Erro ao deletar modelo: ${error.message}`);
}

/** Define um modelo como ativo (desativa os outros) */
export async function setActiveModel(storeId: string, modelId: string) {
  const supabase = createAdminClient();

  // Desativar todos
  await supabase
    .from("store_models")
    .update({ is_active: false })
    .eq("store_id", storeId);

  // Ativar o selecionado
  await supabase
    .from("store_models")
    .update({ is_active: true })
    .eq("id", modelId)
    .eq("store_id", storeId);
}

/** Retorna o nome do plano da loja */
export async function getStorePlanName(storeId: string): Promise<string> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("stores")
    .select("plan_id, plans(name)")
    .eq("id", storeId)
    .single();

  if (!data?.plans) return "free";
  const plans = data.plans as unknown as { name: string };
  return plans.name || "free";
}

/** Limites de modelos por plano (01_ARQUITETURA_GERAL.md) */
export function getModelLimitForPlan(planName: string): number {
  const limits: Record<string, number> = {
    gratis: 0,
    starter: 1,
    pro: 2,
    business: 3,
    agencia: 5,
  };
  return limits[planName] ?? 0;
}

// ═══════════════════════════════════════════════════════════
// CAMPAIGNS
// ═══════════════════════════════════════════════════════════

export interface CreateCampaignInput {
  storeId: string;
  productPhotoUrl: string;
  productPhotoStoragePath: string;
  price: number;
  objective: string;
  targetAudience?: string;
  toneOverride?: string;
  useModel: boolean;
  modelId?: string;
}

export interface SavePipelineResultInput {
  campaignId: string;
  durationMs: number;
  vision: Record<string, unknown>;
  strategy: Record<string, unknown>;
  output: Record<string, unknown>;
  score: Record<string, unknown>;
}

/** Cria uma campanha com status pending */
export async function createCampaign(input: CreateCampaignInput) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("campaigns")
    .insert({
      store_id: input.storeId,
      product_photo_url: input.productPhotoUrl,
      product_photo_storage_path: input.productPhotoStoragePath,
      price: input.price,
      objective: input.objective,
      target_audience: input.targetAudience || null,
      tone_override: input.toneOverride || null,
      use_model: input.useModel,
      model_id: input.modelId || null,
      status: "processing",
      pipeline_started_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) throw new Error(`Erro ao criar campanha: ${error.message}`);
  return data;
}

/** Salva os resultados do pipeline na campanha */
export async function savePipelineResult(input: SavePipelineResultInput) {
  const supabase = createAdminClient();

  // 1. Atualizar status da campanha
  await supabase
    .from("campaigns")
    .update({
      status: "completed",
      pipeline_completed_at: new Date().toISOString(),
      pipeline_duration_ms: input.durationMs,
    })
    .eq("id", input.campaignId);

  // 2. Salvar outputs
  const output = input.output as Record<string, unknown>;
  await supabase.from("campaign_outputs").insert({
    campaign_id: input.campaignId,
    vision_analysis: input.vision,
    strategy: input.strategy,
    headline_principal: (output.headline_principal as string) || null,
    headline_variacao_1: (output.headline_variacao_1 as string) || null,
    headline_variacao_2: (output.headline_variacao_2 as string) || null,
    instagram_feed: (output.instagram_feed as string) || null,
    instagram_stories: (output.instagram_stories as Record<string, unknown>) || null,
    whatsapp: (output.whatsapp as string) || null,
    meta_ads: (output.meta_ads as Record<string, unknown>) || null,
    hashtags: (output.hashtags as string[]) || [],
    refinements: (output.refinements as Record<string, unknown>) || null,
  });

  // 3. Salvar score
  const score = input.score as Record<string, unknown>;
  await supabase.from("campaign_scores").insert({
    campaign_id: input.campaignId,
    nota_geral: Number(score.nota_geral) || 0,
    conversao: Number(score.conversao) || 0,
    clareza: Number(score.clareza) || 0,
    urgencia: Number(score.urgencia) || 0,
    naturalidade: Number(score.naturalidade) || 0,
    aprovacao_meta: Number(score.aprovacao_meta) || 0,
    nivel_risco: (score.nivel_risco as string) || "medio",
    resumo: (score.resumo as string) || null,
    pontos_fortes: (score.pontos_fortes as unknown) || null,
    melhorias: (score.melhorias as unknown) || null,
    alertas_meta: (score.alertas_meta as unknown) || null,
  });
}

/** Marca campanha como falha */
export async function failCampaign(campaignId: string, errorMessage: string) {
  const supabase = createAdminClient();
  await supabase
    .from("campaigns")
    .update({
      status: "failed",
      error_message: errorMessage,
      pipeline_completed_at: new Date().toISOString(),
    })
    .eq("id", campaignId);
}

// ═══════════════════════════════════════════════════════════
// STORE USAGE (Quota)
// ═══════════════════════════════════════════════════════════

/** Busca o uso atual do período da loja */
export async function getCurrentUsage(storeId: string) {
  const supabase = createAdminClient();
  const today = new Date().toISOString().split("T")[0];

  const { data } = await supabase
    .from("store_usage")
    .select("*")
    .eq("store_id", storeId)
    .lte("period_start", today)
    .gte("period_end", today)
    .order("period_start", { ascending: false })
    .limit(1)
    .single();

  return data;
}

/** Incrementa o contador de campanhas geradas */
export async function incrementCampaignsUsed(storeId: string) {
  const usage = await getCurrentUsage(storeId);
  if (!usage) return;

  const supabase = createAdminClient();
  await supabase
    .from("store_usage")
    .update({ campaigns_generated: (usage.campaigns_generated || 0) + 1 })
    .eq("id", usage.id);
}

/** Verifica se a loja pode gerar mais campanhas neste período */
export async function canGenerateCampaign(storeId: string): Promise<{ allowed: boolean; used: number; limit: number }> {
  const usage = await getCurrentUsage(storeId);
  if (!usage) return { allowed: true, used: 0, limit: 999 }; // Sem controle caso não ache

  return {
    allowed: usage.campaigns_generated < usage.campaigns_limit,
    used: usage.campaigns_generated,
    limit: usage.campaigns_limit,
  };
}

// ═══════════════════════════════════════════════════════════
// CAMPAIGNS (Leitura para o histórico)
// ═══════════════════════════════════════════════════════════

/** Lista campanhas da loja com scores (para o histórico) */
export async function listCampaigns(storeId: string, limit = 20) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("campaigns")
    .select("id, price, objective, target_audience, status, created_at, pipeline_duration_ms, campaign_scores(nota_geral), campaign_outputs(headline_principal)")
    .eq("store_id", storeId)
    .eq("is_archived", false)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(`Erro ao listar campanhas: ${error.message}`);
  return data || [];
}

/** Busca uma campanha completa com outputs e scores */
export async function getCampaignById(campaignId: string) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("campaigns")
    .select("*, campaign_outputs(*), campaign_scores(*)")
    .eq("id", campaignId)
    .single();

  if (error) throw new Error(`Campanha não encontrada: ${error.message}`);
  return data;
}

// ═══════════════════════════════════════════════════════════
// API COST LOGS
// ═══════════════════════════════════════════════════════════

export interface LogApiCostInput {
  storeId?: string;
  campaignId?: string;
  provider: string;
  endpoint: string;
  model?: string;
  pipelineStep?: string;
  inputTokens?: number;
  outputTokens?: number;
  costUsd: number;
  costBrl: number;
  responseTimeMs?: number;
  statusCode?: number;
  isError?: boolean;
  errorMessage?: string;
}

export async function logApiCost(input: LogApiCostInput) {
  const supabase = createAdminClient();
  await supabase.from("api_cost_logs").insert({
    store_id: input.storeId || null,
    campaign_id: input.campaignId || null,
    provider: input.provider,
    endpoint: input.endpoint,
    model: input.model || null,
    pipeline_step: input.pipelineStep || null,
    input_tokens: input.inputTokens || null,
    output_tokens: input.outputTokens || null,
    cost_usd: input.costUsd,
    cost_brl: input.costBrl,
    exchange_rate: parseFloat(process.env.USD_BRL_EXCHANGE_RATE || "5.5"),
    response_time_ms: input.responseTimeMs || null,
    status_code: input.statusCode || null,
    is_error: input.isError || false,
    error_message: input.errorMessage || null,
  });
}

// ═══════════════════════════════════════════════════════════
// PLANS & SUBSCRIPTIONS
// ═══════════════════════════════════════════════════════════

/** Atualiza o plano da loja (webhook do Mercado Pago) */
export async function updateStorePlan(storeId: string, planName: string, mpSubscriptionId?: string) {
  const supabase = createAdminClient();

  // Buscar ID do plano
  const { data: plan } = await supabase
    .from("plans")
    .select("id, campaigns_per_month")
    .eq("name", planName)
    .single();

  if (!plan) throw new Error(`Plano "${planName}" não encontrado`);

  // Atualizar loja
  await supabase
    .from("stores")
    .update({
      plan_id: plan.id,
      mercadopago_subscription_id: mpSubscriptionId || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", storeId);

  // Resetar store_usage do período atual
  const usage = await getCurrentUsage(storeId);
  if (usage) {
    await supabase
      .from("store_usage")
      .update({
        campaigns_generated: 0,
        campaigns_limit: plan.campaigns_per_month,
      })
      .eq("id", usage.id);
  }
}

// ═══════════════════════════════════════════════════════════
// CRÉDITOS AVULSOS (seção 5.4 da arquitetura)
// ═══════════════════════════════════════════════════════════

/**
 * Adiciona créditos à loja após pagamento aprovado
 */
export async function addCreditsToStore(
  storeId: string,
  type: "campaigns" | "models" | "regenerations",
  quantity: number,
  priceBrl: number,
  mpPaymentId: string
) {
  const supabase = createAdminClient();

  // 1. Registrar a compra
  await supabase.from("credit_purchases").insert({
    store_id: storeId,
    package_type: type,
    quantity,
    price_brl: priceBrl,
    mercadopago_payment_id: mpPaymentId,
    payment_status: "approved",
  });

  // 2. Incrementar créditos na loja
  const columnMap = {
    campaigns: "credit_campaigns",
    models: "credit_models",
    regenerations: "credit_regenerations",
  };

  const column = columnMap[type];

  // Buscar valor atual e somar
  const { data: store } = await supabase
    .from("stores")
    .select(column)
    .eq("id", storeId)
    .single();

  const currentValue = (store as unknown as Record<string, number>)?.[column] || 0;

  await supabase
    .from("stores")
    .update({ [column]: currentValue + quantity })
    .eq("id", storeId);

  console.log(`[Credits] ✅ +${quantity} ${type} adicionados à loja ${storeId}`);
}

/**
 * Consome 1 crédito avulso (retorna true se tinha crédito, false se não)
 */
export async function consumeCredit(
  storeId: string,
  type: "campaigns" | "models" | "regenerations"
): Promise<boolean> {
  const supabase = createAdminClient();

  const columnMap = {
    campaigns: "credit_campaigns",
    models: "credit_models",
    regenerations: "credit_regenerations",
  };

  const column = columnMap[type];

  const { data: store } = await supabase
    .from("stores")
    .select(column)
    .eq("id", storeId)
    .single();

  const currentValue = (store as unknown as Record<string, number>)?.[column] || 0;

  if (currentValue <= 0) return false;

  await supabase
    .from("stores")
    .update({ [column]: currentValue - 1 })
    .eq("id", storeId);

  console.log(`[Credits] 🔻 -1 ${type} consumido da loja ${storeId} (restam: ${currentValue - 1})`);
  return true;
}

/**
 * Retorna saldo de créditos avulsos da loja
 */
export async function getStoreCredits(storeId: string) {
  const supabase = createAdminClient();

  const { data: store } = await supabase
    .from("stores")
    .select("credit_campaigns, credit_models, credit_regenerations")
    .eq("id", storeId)
    .single();

  return {
    campaigns: store?.credit_campaigns || 0,
    models: store?.credit_models || 0,
    regenerations: store?.credit_regenerations || 0,
  };
}
