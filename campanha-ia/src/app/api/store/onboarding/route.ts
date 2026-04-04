import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createStore, createStoreModel, getStoreByClerkId } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * POST /api/store/onboarding
 * 
 * Cria a loja e modelo virtual do usuário após o onboarding.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session.userId) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    // Verificar se já tem loja
    const existing = await getStoreByClerkId(session.userId);
    if (existing) {
      return NextResponse.json({
        success: true,
        data: { store: existing },
        message: "Loja já existe",
      });
    }

    const body = await request.json();
    const { storeName, segment, city, state, instagram, model } = body;

    if (!storeName || !segment) {
      return NextResponse.json(
        { error: "Nome da loja e segmento são obrigatórios" },
        { status: 400 }
      );
    }

    // 1. Criar loja
    const store = await createStore({
      clerkUserId: session.userId,
      name: storeName,
      segmentPrimary: segment,
      city: city || undefined,
      state: state || undefined,
      instagramHandle: instagram || undefined,
    });

    // 2. Criar modelo virtual (se não pulou)
    let storeModel = null;
    if (model && !model.skip) {
      storeModel = await createStoreModel({
        storeId: store.id,
        skinTone: model.skin || "morena_clara",
        hairStyle: model.hair || "ondulado",
        bodyType: model.body || "media",
      });
    }

    return NextResponse.json({
      success: true,
      data: { store, model: storeModel },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Erro desconhecido";
    console.error("[API:store/onboarding] Error:", message);
    return NextResponse.json(
      { error: "Erro ao configurar loja", details: process.env.NODE_ENV === "development" ? message : undefined },
      { status: 500 }
    );
  }
}
