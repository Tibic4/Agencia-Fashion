import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getStoreByClerkId, canRegenerate, incrementRegenCount } from "@/lib/db";

/**
 * POST /api/campaign/[id]/regenerate
 * Verifica se a campanha pode ser regenerada (limite por plano).
 * Retorna { allowed, used, limit } e incrementa o contador se permitido.
 */
export async function POST(
  _req: NextRequest,
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
    const regen = await canRegenerate(id, store.id);

    if (!regen.allowed) {
      return NextResponse.json({
        error: "Limite de regenerações atingido para esta campanha",
        code: "REGEN_LIMIT_REACHED",
        data: { used: regen.used, limit: regen.limit },
      }, { status: 403 });
    }

    // Incrementar contagem com ownership check (anti-IDOR)
    const newCount = await incrementRegenCount(id, store.id);

    return NextResponse.json({
      success: true,
      data: { used: newCount, limit: regen.limit },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Erro desconhecido";
    console.error("[API:regenerate] Error:", message);
    return NextResponse.json({ error: "Erro ao verificar regeneração" }, { status: 500 });
  }
}
