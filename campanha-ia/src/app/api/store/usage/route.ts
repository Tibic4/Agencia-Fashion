import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getStoreByClerkId, getCurrentUsage } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * GET /api/store/usage
 * 
 * Retorna o uso atual (campanhas geradas vs limite) da loja do usuário logado.
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

    return NextResponse.json({
      success: true,
      data: {
        campaigns_generated: usage?.campaigns_generated ?? 0,
        campaigns_limit: usage?.campaigns_limit ?? 3,
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
