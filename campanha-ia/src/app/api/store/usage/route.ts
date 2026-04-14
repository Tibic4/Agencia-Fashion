import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getStoreByClerkId, getCurrentUsage, getStorePlanName, getModelLimitForPlan, getHistoryDaysForPlan, getStoreCredits } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * GET /api/store/usage
 * 
 * Retorna o uso atual e limites baseados no plano real da loja + créditos avulsos.
 */
export async function GET() {
  try {
    const session = await auth();
    if (!session.userId) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    const store = await getStoreByClerkId(session.userId);
    if (!store) {
      return NextResponse.json({ error: "Loja não encontrada", code: "NO_STORE" }, { status: 404 });
    }

    const usage = await getCurrentUsage(store.id);
    const planName = await getStorePlanName(store.id);
    const credits = await getStoreCredits(store.id);

    // Contar modelos criados
    let modelsUsed = 0;
    try {
      const { createAdminClient } = await import("@/lib/supabase/admin");
      const supabase = createAdminClient();
      const { count } = await supabase
        .from("store_models")
        .select("*", { count: "exact", head: true })
        .eq("store_id", store.id);
      modelsUsed = count || 0;
    } catch {}

    const planCampaignLimit = usage?.campaigns_limit ?? 0;
    const planModelLimit = getModelLimitForPlan(planName);

    return NextResponse.json({
      success: true,
      data: {
        plan_name: planName,
        campaigns_generated: usage?.campaigns_generated ?? 0,
        campaigns_limit: planCampaignLimit + (credits.campaigns || 0),
        models_used: modelsUsed,
        models_limit: planModelLimit + (credits.models || 0),
        history_days: getHistoryDaysForPlan(planName),
        period_start: usage?.period_start ?? null,
        period_end: usage?.period_end ?? null,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Erro desconhecido";
    console.error("[API:store/usage] Error:", message);
    return NextResponse.json({ error: "Erro ao buscar uso" }, { status: 500 });
  }
}
