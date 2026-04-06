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
    let previewUrl: string | null = null;
    if (model && !model.skip) {
      storeModel = await createStoreModel({
        storeId: store.id,
        skinTone: model.skin || "morena_clara",
        hairStyle: model.hair || "ondulado",
        bodyType: model.body || "media",
        style: model.style || "casual_natural",
        ageRange: model.age || "adulta_26_35",
        name: model.name || "Modelo",
      });

      // 2b. Gerar preview corpo inteiro (mesmo padrão do /api/model/create)
      if (process.env.FASHN_API_KEY) {
        try {
          const { generateCustomModelPreview } = await import("@/lib/fashn/client");
          console.log(`[Onboarding] 🎨 Gerando preview para modelo...`);
          const previewResult = await generateCustomModelPreview({
            skinTone: model.skin || "morena_clara",
            hairStyle: model.hair || "ondulado",
            bodyType: model.body || "media",
            style: model.style || "casual_natural",
            ageRange: model.age || "adulta_26_35",
            name: model.name || "Modelo",
            storeId: store.id,
          });

          if (previewResult.status === "completed" && previewResult.outputUrl) {
            previewUrl = previewResult.outputUrl;
            const { createAdminClient } = await import("@/lib/supabase/admin");
            const supabase = createAdminClient();
            await supabase
              .from("store_models")
              .update({ preview_url: previewUrl })
              .eq("id", storeModel.id);
            console.log(`[Onboarding] ✅ Preview gerado com sucesso`);
          }
        } catch (previewErr) {
          console.warn("[Onboarding] Preview generation falhou (não fatal):", previewErr);
        }
      }
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
