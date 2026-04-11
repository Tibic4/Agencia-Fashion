import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getStoreByClerkId, setActiveModel } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * POST /api/model/[id]/activate
 * Define este modelo como ativo para a loja.
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session.userId) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    const store = await getStoreByClerkId(session.userId);
    if (!store) {
      return NextResponse.json({ error: "Loja não encontrada" }, { status: 404 });
    }

    const { id } = await params;
    await setActiveModel(store.id, id);

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Erro desconhecido";
    console.error("[API:model/activate] Error:", msg);
    return NextResponse.json({ error: "Erro ao ativar modelo" }, { status: 500 });
  }
}
