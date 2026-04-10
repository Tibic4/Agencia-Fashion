import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getStoreByClerkId, getStoreCredits } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * GET /api/store/credits
 * 
 * Retorna saldo de créditos avulsos da loja.
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

    const credits = await getStoreCredits(store.id);

    return NextResponse.json({
      success: true,
      data: credits,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Erro desconhecido";
    console.error("[API:store/credits] Error:", message);
    return NextResponse.json({ error: "Erro ao buscar créditos" }, { status: 500 });
  }
}
