import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getStoreByClerkId, getCurrentUsage, getOrCreateCurrentUsage, getStorePlanName, getModelLimitForPlan, getHistoryDaysForPlan, getStoreCredits } from "@/lib/db";

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

    // Auto-cria a linha de usage se não existe — vai zerar pra usuários
    // antigos que nunca tiveram a linha criada (counter ficava 0/0).
    let usage = await getOrCreateCurrentUsage(store.id);
    let planName = await getStorePlanName(store.id);
    const credits = await getStoreCredits(store.id);

    // Auto-downgrade: se o plano é pago mas não tem período ativo nem assinatura,
    // significa que o período expirou após cancelamento — fazer downgrade para grátis.
    const isPaidPlan = planName !== "free" && planName !== "gratis";
    if (isPaidPlan && !usage && !store.plan_id) {
      // plan_id is null — already free, just stale planName
    } else if (isPaidPlan && !usage) {
      // Check if subscription was cancelled (no active subscription)
      const { createAdminClient: createAdmin } = await import("@/lib/supabase/admin");
      const sb = createAdmin();
      const { data: storeCheck } = await sb
        .from("stores")
        .select("mercadopago_subscription_id")
        .eq("id", store.id)
        .single();

      if (!storeCheck?.mercadopago_subscription_id) {
        // Período expirou + sem assinatura = downgrade automático
        const { updateStorePlan } = await import("@/lib/db");
        await updateStorePlan(store.id, "gratis");
        // Recarregar dados após downgrade
        usage = await getCurrentUsage(store.id);
        planName = "gratis";
        console.log(`[API:store/usage] 🔻 Auto-downgrade: store ${store.id} → grátis (período expirou, sem assinatura)`);
      }
    }

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
    // Garantir que créditos nunca sejam negativos
    const creditCampaigns = Math.max(0, credits.campaigns || 0);
    const creditModels = Math.max(0, credits.models || 0);

    return NextResponse.json({
      success: true,
      data: {
        plan_name: planName,
        campaigns_generated: usage?.campaigns_generated ?? 0,
        campaigns_limit: planCampaignLimit + creditCampaigns,
        models_used: modelsUsed,
        models_limit: planModelLimit + creditModels,
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
