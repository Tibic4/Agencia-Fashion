/**
 * CriaLook — Camada de acesso ao banco de dados (Supabase)
 * 
 * Todas as operações de CRUD centralizzadas aqui.
 * Usa o admin client (service_role) para operações do servidor.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { getModelLimitForPlan, getHistoryDaysForPlan } from "@/lib/plans";

// Re-export for consumers
export { getModelLimitForPlan, getHistoryDaysForPlan };

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
  brandColor?: string;
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
  brand_colors: { primary?: string } | null;
  backdrop_ref_url: string | null;
  backdrop_color: string | null;
  backdrop_season: string | null;
  backdrop_updated_at: string | null;
  onboarding_completed: boolean;
  created_at: string;
}

/** Cria a loja do usuário e inicializa store_usage do período */
export async function createStore(input: CreateStoreInput): Promise<StoreRecord> {
  const supabase = createAdminClient();

  // Buscar plano grátis para atribuir automaticamente
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
      brand_colors: input.brandColor ? { primary: input.brandColor } : null,
      plan_id: freePlan?.id || null,
      onboarding_completed: true,
    })
    .select()
    .single();

  if (error) throw new Error(`Erro ao criar loja: ${error.message}`);

  // Criar período de usage do mês atual com limite do plano grátis
  const now = new Date();
  const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  await supabase.from("store_usage").insert({
    store_id: store.id,
    period_start: periodStart.toISOString().split("T")[0],
    period_end: periodEnd.toISOString().split("T")[0],
    campaigns_generated: 0,
    campaigns_limit: freePlan?.campaigns_per_month ?? 0,
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
  gender?: string;
}

export async function createStoreModel(input: CreateModelInput) {
  const supabase = createAdminClient();

  // Auto-ativar se for a primeira modelo da loja
  const { count } = await supabase
    .from("store_models")
    .select("id", { count: "exact", head: true })
    .eq("store_id", input.storeId);

  const isFirst = (count ?? 0) === 0;

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
      gender: input.gender || "feminino",
      is_active: isFirst,
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

/** Deleta um modelo da loja (com cleanup de Storage) */
export async function deleteStoreModel(storeId: string, modelId: string) {
  const supabase = createAdminClient();

  // Buscar URLs para limpar do Storage
  const { data: model } = await supabase
    .from("store_models")
    .select("face_ref_url, preview_url")
    .eq("id", modelId)
    .eq("store_id", storeId)
    .single();

  // Limpar arquivos do Storage (fire-and-forget)
  if (model) {
    const pathsToDelete: string[] = [];
    // Extrair path relativo da URL pública do Supabase Storage
    const extractPath = (url: string, bucket: string) => {
      const marker = `/storage/v1/object/public/${bucket}/`;
      const idx = url.indexOf(marker);
      return idx >= 0 ? url.substring(idx + marker.length) : null;
    };

    if (model.face_ref_url) {
      const p = extractPath(model.face_ref_url, "assets");
      if (p) pathsToDelete.push(p);
    }
    if (model.preview_url) {
      const p = extractPath(model.preview_url, "assets");
      if (p) pathsToDelete.push(p);
    }

    if (pathsToDelete.length > 0) {
      supabase.storage.from("assets").remove(pathsToDelete)
        .then(() => console.log(`[DB] 🧹 Storage cleanup: ${pathsToDelete.length} arquivo(s) removidos`))
        .catch(() => { /* ignore cleanup failures */ });
    }
  }

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

/* getModelLimitForPlan and getHistoryDaysForPlan are imported from @/lib/plans */

/** Incrementa o contador de regenerações de uma campanha (ATÔMICO via RPC) */
export async function incrementRegenCount(campaignId: string): Promise<number> {
  const supabase = createAdminClient();

  const { data, error } = await supabase.rpc("increment_regen_count", {
    p_campaign_id: campaignId,
  });

  if (error) {
    console.warn(`[DB] ⚠️ incrementRegenCount RPC falhou, usando fallback: ${error.message}`);
    // Fallback para read-modify-write (melhor que quebrar)
    const { data: campaign } = await supabase
      .from("campaigns")
      .select("regen_count")
      .eq("id", campaignId)
      .single();
    const newCount = (campaign?.regen_count || 0) + 1;
    await supabase.from("campaigns").update({ regen_count: newCount }).eq("id", campaignId);
    return newCount;
  }

  return data ?? 0;
}

/**
 * Verifica se a campanha pode regenerar.
 * NOTA: Regeneração está INTENCIONALMENTE desabilitada em todos os planos (BUG 7 audit).
 * A rota /api/campaign/[id]/regenerate ainda existe mas sempre retorna 403.
 * Quando for reabilitada, implementar lógica de limite por plano aqui.
 */
export async function canRegenerate(campaignId: string, _storeId: string): Promise<{ allowed: boolean; used: number; limit: number }> {
  const supabase = createAdminClient();
  
  const { data: campaign } = await supabase
    .from("campaigns")
    .select("regen_count")
    .eq("id", campaignId)
    .single();
  
  const used = campaign?.regen_count || 0;
  
  return {
    allowed: false, // Desabilitado intencionalmente
    used,
    limit: 0,
  };
}

/** Gera um token de prévia para uma campanha */
export async function generatePreviewToken(campaignId: string): Promise<string> {
  const supabase = createAdminClient();
  const token = crypto.randomUUID().replace(/-/g, "").slice(0, 16);
  
  await supabase
    .from("campaigns")
    .update({ preview_token: token })
    .eq("id", campaignId);
  
  return token;
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
  title?: string;
}

/** Cria uma campanha com status processing */
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
      title: input.title || null,
      use_model: true,
      status: "processing",
      pipeline_started_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) throw new Error(`Erro ao criar campanha: ${error.message}`);
  return data;
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

/** Incrementa o contador de campanhas geradas (ATÔMICO via RPC) */
export async function incrementCampaignsUsed(storeId: string) {
  const usage = await getCurrentUsage(storeId);
  if (!usage) return;

  const supabase = createAdminClient();

  const { error } = await supabase.rpc("increment_campaigns_used", {
    p_usage_id: usage.id,
  });

  if (error) {
    console.warn(`[DB] ⚠️ increment_campaigns_used RPC falhou, usando fallback: ${error.message}`);
    // Fallback para read-modify-write
    await supabase
      .from("store_usage")
      .update({ campaigns_generated: (usage.campaigns_generated || 0) + 1 })
      .eq("id", usage.id);
  }
}

/** Verifica se a loja pode gerar mais campanhas neste período */
export async function canGenerateCampaign(storeId: string): Promise<{ allowed: boolean; used: number; limit: number; hasAvulso: boolean }> {
  const usage = await getCurrentUsage(storeId);
  const credits = await getStoreCredits(storeId);
  const avulso = credits.campaigns || 0;

  const used = usage?.campaigns_generated ?? 0;
  const planLimit = usage?.campaigns_limit ?? 0;

  // Plano ainda tem quota? Usar slot do plano.
  // Senão, verificar se tem crédito avulso (consumido separadamente no generate).
  const planAllowed = used < planLimit;
  const hasAvulso = avulso > 0;

  return {
    allowed: planAllowed || hasAvulso,
    used,
    limit: planLimit + avulso,
    hasAvulso: !planAllowed && hasAvulso,
  };
}

// ═══════════════════════════════════════════════════════════
// CAMPAIGNS (Leitura para o histórico)
// ═══════════════════════════════════════════════════════════

/** Lista campanhas da loja com scores (para o histórico) - respeita limite de histórico do plano */
export async function listCampaigns(storeId: string, limit = 20, historyDays = 0) {
  const supabase = createAdminClient();
  
  let query = supabase
    .from("campaigns")
    .select("id, title, sequence_number, price, objective, target_audience, status, created_at, pipeline_duration_ms, regen_count, preview_token, is_favorited, output, campaign_scores(nota_geral), campaign_outputs(headline_principal)")
    .eq("store_id", storeId)
    .eq("is_archived", false)
    .order("created_at", { ascending: false })
    .limit(limit);
  
  // Filtrar por dias de histórico se o plano limita
  if (historyDays > 0) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - historyDays);
    query = query.gte("created_at", cutoff.toISOString());
  }

  const { data, error } = await query;

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
    model_used: input.model || null,
    action: input.pipelineStep || null,
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

  // Buscar plano anterior para detectar mudança (antes do update)
  const { data: storeData } = await supabase
    .from("stores")
    .select("plan_id")
    .eq("id", storeId)
    .single();
  const planChanged = storeData?.plan_id !== plan.id;

  // Atualizar loja
  await supabase
    .from("stores")
    .update({
      plan_id: plan.id,
      mercadopago_subscription_id: mpSubscriptionId || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", storeId);

  // Resetar ou criar store_usage do período
  const usage = await getCurrentUsage(storeId);
  if (usage) {
    // Período ativo existe — só resetar contador se mudou de plano (upgrade/downgrade).
    // Se é renovação do mesmo plano (cobrança recorrente mensal), apenas atualizar o limite.
    await supabase
      .from("store_usage")
      .update({
        campaigns_generated: planChanged ? 0 : usage.campaigns_generated,
        campaigns_limit: plan.campaigns_per_month,
      })
      .eq("id", usage.id);
  } else {
    // Período expirado ou inexistente — criar novo período de 30 dias
    const now = new Date();
    const periodStart = now.toISOString().split("T")[0];
    const periodEndDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const periodEnd = periodEndDate.toISOString().split("T")[0];

    await supabase.from("store_usage").insert({
      store_id: storeId,
      period_start: periodStart,
      period_end: periodEnd,
      campaigns_generated: 0,
      campaigns_limit: plan.campaigns_per_month,
    });

    console.log(`[DB] ✅ Novo período criado para store ${storeId}: ${periodStart} → ${periodEnd}`);
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
  const now = new Date();
  await supabase.from("credit_purchases").insert({
    store_id: storeId,
    type,
    quantity,
    price_brl: priceBrl,
    mercadopago_payment_id: mpPaymentId,
    period_start: new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0],
    period_end: new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split("T")[0],
    consumed: 0,
  });

  // 2. Incrementar créditos na loja (atômico via RPC)
  const columnMap = {
    campaigns: "credit_campaigns",
    models: "credit_models",
    regenerations: "credit_regenerations",
  };

  const column = columnMap[type];

  const { error: rpcError } = await supabase.rpc("add_credits_atomic", {
    p_store_id: storeId,
    p_column: column,
    p_quantity: quantity,
  });

  if (rpcError) {
    console.warn(`[Credits] ⚠️ add_credits_atomic RPC falhou, usando fallback: ${rpcError.message}`);
    // Fallback: read-modify-write (melhor que falhar)
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
  }

  console.log(`[Credits] ✅ +${quantity} ${type} adicionados à loja ${storeId}`);
}

/**
 * Consome 1 crédito avulso (ATÔMICO via RPC).
 * Retorna true se consumiu, false se não tinha crédito.
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

  const { data, error } = await supabase.rpc("consume_credit_atomic", {
    p_store_id: storeId,
    p_column: column,
  });

  if (error) {
    console.warn(`[Credits] ⚠️ consume_credit_atomic RPC falhou, usando fallback: ${error.message}`);
    // Fallback para read-modify-write
    const { data: store } = await supabase
      .from("stores")
      .select(column)
      .eq("id", storeId)
      .single();
    const currentValue = (store as unknown as Record<string, number>)?.[column] || 0;
    if (currentValue <= 0) return false;
    await supabase.from("stores").update({ [column]: currentValue - 1 }).eq("id", storeId);
    console.log(`[Credits] 🔻 -1 ${type} consumido da loja ${storeId} (fallback, restam: ${currentValue - 1})`);
    return true;
  }

  const newVal = data as number;
  if (newVal < 0) return false; // RPC retorna -1 se não tinha crédito

  console.log(`[Credits] 🔻 -1 ${type} consumido da loja ${storeId} (atômico, restam: ${newVal})`);
  return true;
}

/**
 * Verifica se a loja tem crédito avulso disponível (sem consumir)
 */
export async function hasAvulsoCredit(
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
  return currentValue > 0;
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

// ═══════════════════════════════════════════════════════════
// PIPELINE V3 — Salvar resultado do novo fluxo Opus + Gemini
// ═══════════════════════════════════════════════════════════

export interface SavePipelineResultV3Input {
  campaignId: string;
  durationMs: number;
  analise: Record<string, unknown>;
  /** Array de 3 URLs públicas das imagens (string) ou null se falhou */
  imageUrls: (string | null)[];
  /** Os 3 prompts gerados pelo Opus (enviados ao frontend para regeneração) */
  prompts: Record<string, unknown>[];
  dicas_postagem: Record<string, unknown>;
  successCount: number;
}

/**
 * Salva os resultados do pipeline v3 (Opus + Gemini 3x) na campanha.
 * Usa o campo JSONB `output` da tabela campaigns para armazenar tudo.
 * NÃO altera a tabela campaign_outputs (compatibilidade com v2).
 */
export async function savePipelineResultV3(input: SavePipelineResultV3Input) {
  const supabase = createAdminClient();

  const { error } = await supabase
    .from("campaigns")
    .update({
      status: "completed",
      pipeline_completed_at: new Date().toISOString(),
      pipeline_duration_ms: input.durationMs,
      // Armazenar tudo no campo JSONB output (campaigns.output)
      output: {
        version: "v3",
        analise: input.analise,
        image_urls: input.imageUrls,
        prompts: input.prompts,
        dicas_postagem: input.dicas_postagem,
        success_count: input.successCount,
        generated_at: new Date().toISOString(),
      },
    })
    .eq("id", input.campaignId);

  if (error) {
    console.error(
      `[DB] ❌ savePipelineResultV3 FALHOU | campaign=${input.campaignId} | erro: ${error.message}`
    );
    throw new Error(`Falha ao salvar resultado: ${error.message}`);
  }

  console.log(
    `[DB] ✅ savePipelineResultV3 | campaign=${input.campaignId} | ${input.successCount}/3 imagens | ${input.durationMs}ms`
  );
}
