import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/guard";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * PATCH /api/admin/stores
 * Body: { storeId, credit_campaigns?, credit_models?, reset_backdrop? }
 */
export async function PATCH(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin.isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const body = await req.json();
  const { storeId, credit_campaigns, credit_models, reset_backdrop } = body;

  if (!storeId) {
    return NextResponse.json({ error: "storeId é obrigatório" }, { status: 400 });
  }

  const supabase = createAdminClient();

  // Build update payload
  const updates: Record<string, unknown> = {};

  if (typeof credit_campaigns === "number") {
    updates.credit_campaigns = credit_campaigns;
  }
  if (typeof credit_models === "number") {
    updates.credit_models = credit_models;
  }
  if (reset_backdrop) {
    // Limpar backdop_updated_at para permitir regeneração imediata
    updates.backdrop_updated_at = null;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "Nenhuma alteração fornecida" }, { status: 400 });
  }

  const { error } = await supabase
    .from("stores")
    .update(updates)
    .eq("id", storeId);

  if (error) {
    console.error("[Admin:Stores] Update error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  console.log(`[Admin:Stores] ✅ Store ${storeId} updated:`, updates);
  return NextResponse.json({ success: true, updates });
}

/**
 * GET /api/admin/stores?id=xxx
 * Retorna detalhes de uma loja específica para o modal admin
 */
export async function GET(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin.isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const storeId = req.nextUrl.searchParams.get("id");
  if (!storeId) {
    return NextResponse.json({ error: "id é obrigatório" }, { status: 400 });
  }

  const supabase = createAdminClient();

  // Tentar query detalhada primeiro
  let store: Record<string, unknown> | null = null;

  const { data: detailData, error: detailError } = await supabase
    .from("stores")
    .select(`
      id, name, segment_primary, brand_color, logo_url,
      credit_campaigns, credit_models, credit_regenerations,
      backdrop_ref_url, backdrop_color, backdrop_season, backdrop_updated_at,
      onboarding_completed, created_at,
      plans!stores_plan_id_fkey(display_name, campaigns_per_period),
      store_usage!store_usage_store_id_fkey(campaigns_generated, campaigns_limit, period_start, period_end)
    `)
    .eq("id", storeId)
    .single();

  if (detailError) {
    console.warn("[Admin:Stores] Detail query failed, trying fallback:", detailError.message);
    // Fallback: select all (sem joins explícitos que podem quebrar)
    const { data: fallbackData, error: fallbackError } = await supabase
      .from("stores")
      .select("*")
      .eq("id", storeId)
      .single();

    if (fallbackError || !fallbackData) {
      console.error("[Admin:Stores] Fallback also failed:", fallbackError?.message);
      return NextResponse.json(
        { error: `Loja não encontrada: ${detailError.message}` },
        { status: 404 }
      );
    }

    store = fallbackData as Record<string, unknown>;
  } else {
    store = detailData as Record<string, unknown>;
  }

  if (!store) {
    return NextResponse.json({ error: "Loja não encontrada" }, { status: 404 });
  }

  // Contar modelos
  const { count: modelsCount } = await supabase
    .from("store_models")
    .select("*", { count: "exact", head: true })
    .eq("store_id", storeId);

  return NextResponse.json({
    success: true,
    store: {
      ...store,
      models_used: modelsCount || 0,
    },
  });
}

/**
 * DELETE /api/admin/stores
 * Body: { storeId }
 * Apaga a loja e todos os dados relacionados (modelos, campanhas, usage, custos).
 */
export async function DELETE(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin.isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const body = await req.json();
  const { storeId } = body;

  if (!storeId) {
    return NextResponse.json({ error: "storeId é obrigatório" }, { status: 400 });
  }

  const supabase = createAdminClient();

  // Verificar se a loja existe
  const { data: store } = await supabase
    .from("stores")
    .select("id, name")
    .eq("id", storeId)
    .single();

  if (!store) {
    return NextResponse.json({ error: "Loja não encontrada" }, { status: 404 });
  }

  console.log(`[Admin:Stores] 🗑️ Deletando loja "${store.name}" (${storeId})...`);

  // Deletar em ordem para respeitar FKs
  const deletions = [
    { table: "api_cost_logs", filter: "store_id" },
    { table: "campaign_photos", filter: "store_id" },
    { table: "campaigns", filter: "store_id" },
    { table: "store_models", filter: "store_id" },
    { table: "store_usage", filter: "store_id" },
  ];

  for (const del of deletions) {
    const { error } = await supabase
      .from(del.table)
      .delete()
      .eq(del.filter, storeId);

    if (error) {
      console.warn(`[Admin:Stores] ⚠️ Erro ao deletar ${del.table}:`, error.message);
    }
  }

  // Deletar storage (backdrops)
  try {
    await supabase.storage.from("assets").remove([`backdrops/${storeId}.png`, `backdrops/${storeId}.jpg`]);
  } catch {
    console.warn("[Admin:Stores] ⚠️ Erro ao limpar storage");
  }

  // Deletar a loja
  const { error: deleteError } = await supabase
    .from("stores")
    .delete()
    .eq("id", storeId);

  if (deleteError) {
    console.error("[Admin:Stores] ❌ Erro ao deletar loja:", deleteError);
    return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }

  console.log(`[Admin:Stores] ✅ Loja "${store.name}" deletada com sucesso`);
  return NextResponse.json({ success: true, deleted: store.name });
}
