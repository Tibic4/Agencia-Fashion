import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getStoreByClerkId, canRegenerate, incrementRegenCount } from "@/lib/db";
import { env } from "@/lib/env";

/**
 * POST /api/campaign/[id]/regenerate
 *
 * Verifica se a campanha pode ser regenerada (limite por plano).
 * Retorna { allowed, used, limit } e incrementa o contador se permitido.
 *
 * Feature gate: FEATURE_REGENERATE_CAMPAIGN=1 destrava a rota. Default = off.
 * Quando off, devolve 404 (Not Found) em vez de 403 — pra qualquer cliente
 * que tente bater aqui (legado / futuro botão UI), a resposta deixa claro
 * "feature não existe" e não "você não tem permissão / atingiu limite".
 *
 * O mesmo flag é checado também em `canRegenerate` (src/lib/db/index.ts) —
 * defesa em profundidade caso alguém chame a função fora dessa rota.
 */
function regenerateEnabled(): boolean {
  const v = env.FEATURE_REGENERATE_CAMPAIGN;
  if (!v) return false;
  return v === "1" || v.toLowerCase() === "true" || v.toLowerCase() === "on";
}

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!regenerateEnabled()) {
    return NextResponse.json(
      {
        error: "Feature de regeneração não está disponível",
        code: "FEATURE_DISABLED",
      },
      { status: 404 }
    );
  }

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
