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
    // não vaza error.message (pode conter nome de coluna/constraint)
    console.error("[Admin:Stores] Update error:", error);
    return NextResponse.json(
      { error: "Erro ao atualizar loja", code: "UPDATE_FAILED" },
      { status: 500 },
    );
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
      plans!stores_plan_id_fkey(display_name, campaigns_per_month),
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

  console.log(`[Admin:Stores] 🗑️ Deletando loja "${store.name}" (${storeId}) via RPC cascade...`);

  // RPC atômica (SECURITY DEFINER, transacional) em vez do loop legado.
  const { data: deleted, error: rpcError } = await supabase.rpc("delete_store_cascade", {
    p_store_id: storeId,
  });

  if (rpcError) {
    console.error("[Admin:Stores] ❌ delete_store_cascade falhou:", rpcError);
    return NextResponse.json(
      { error: "Erro ao deletar loja", code: "DELETE_FAILED" },
      { status: 500 },
    );
  }

  // Deletar storage (backdrops) — fora da transação porque é outro serviço
  try {
    await supabase.storage.from("assets").remove([`backdrops/${storeId}.png`, `backdrops/${storeId}.jpg`]);
  } catch {
    console.warn("[Admin:Stores] ⚠️ Erro ao limpar storage (não-crítico)");
  }

  console.log(`[Admin:Stores] ✅ Loja "${store.name}" deletada — rows:`, deleted);
  return NextResponse.json({ success: true, deleted: store.name, rows: deleted });
}
