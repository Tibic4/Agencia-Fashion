import { NextResponse } from "next/server";
import { logger } from "@/lib/observability";
import { auth } from "@clerk/nextjs/server";
import { getStoreByClerkId, listCampaigns, getStorePlanName, getHistoryDaysForPlan } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * GET /api/campaigns
 * 
 * Lista campanhas da loja do usuário logado.
 * Respeita limite de histórico por plano.
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

    // Buscar plano e limites
    const planName = await getStorePlanName(store.id);
    const historyDays = getHistoryDaysForPlan(planName);

    const campaigns = await listCampaigns(store.id, 50, historyDays);

    return NextResponse.json({
      success: true,
      data: campaigns,
      plan: {
        name: planName,
        historyDays,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Erro desconhecido";
    logger.error("[API:campaigns] Error:", message);
    return NextResponse.json({ error: "Erro ao listar campanhas" }, { status: 500 });
  }
}
