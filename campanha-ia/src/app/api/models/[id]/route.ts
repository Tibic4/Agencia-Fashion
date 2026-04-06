import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getStoreByClerkId, deleteStoreModel } from "@/lib/db";

/**
 * DELETE /api/models/[id]
 * Exclui uma modelo personalizada da loja do usuário.
 */
export async function DELETE(
  request: NextRequest,
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

    const { id: modelId } = await params;
    if (!modelId) {
      return NextResponse.json({ error: "ID da modelo é obrigatório" }, { status: 400 });
    }

    await deleteStoreModel(store.id, modelId);

    return NextResponse.json({ success: true, message: "Modelo excluída com sucesso" });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Erro desconhecido";
    console.error("[API:models/delete]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
