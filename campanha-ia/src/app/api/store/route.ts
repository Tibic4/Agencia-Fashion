import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getStoreByClerkId } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * GET /api/store
 * 
 * Retorna a loja do usuário logado.
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

    return NextResponse.json({ success: true, data: store });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Erro desconhecido";
    console.error("[API:store] Error:", message);
    return NextResponse.json({ error: "Erro ao buscar loja" }, { status: 500 });
  }
}
