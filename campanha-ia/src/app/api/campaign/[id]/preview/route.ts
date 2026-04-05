import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getStoreByClerkId, getStorePlanName, hasPreviewLink, generatePreviewToken } from "@/lib/db";

/**
 * POST /api/campaign/[id]/preview
 * Gera um token de prévia pública para a campanha.
 * Disponível apenas para planos Pro+.
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

    const planName = await getStorePlanName(store.id);
    if (!hasPreviewLink(planName)) {
      return NextResponse.json(
        { error: "Link de prévia disponível a partir do plano Pro", code: "PLAN_UPGRADE_REQUIRED" },
        { status: 403 }
      );
    }

    const { id } = await params;
    const token = await generatePreviewToken(id);
    const previewUrl = `${process.env.NEXT_PUBLIC_BASE_URL || "https://crialook.com.br"}/preview/${token}`;

    return NextResponse.json({
      success: true,
      data: { token, url: previewUrl },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Erro desconhecido";
    console.error("[API:preview] Error:", message);
    return NextResponse.json({ error: "Erro ao gerar prévia" }, { status: 500 });
  }
}
