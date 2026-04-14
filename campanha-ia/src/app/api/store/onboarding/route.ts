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
    const { storeName, segment, city, state, instagram, model, brandColor } = body;

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
      brandColor: brandColor || undefined,
    });

    // 2. Criar modelo virtual (se não pulou E se o plano permite)
    let storeModel = null;
    let previewUrl: string | null = null;
    if (model && !model.skip) {
      // ── Verificar se o plano permite criar modelo ──
      const { getStorePlanName, getModelLimitForPlan, listStoreModels } = await import("@/lib/db");
      const planName = await getStorePlanName(store.id);
      const modelLimit = getModelLimitForPlan(planName);
      const existingModels = await listStoreModels(store.id);

      if (existingModels.length < modelLimit) {
        storeModel = await createStoreModel({
          storeId: store.id,
          skinTone: model.skin || "morena_clara",
          hairStyle: model.hair || "ondulado",
          bodyType: model.body || "media",
          style: model.style || "casual_natural",
          ageRange: model.age || "adulta_26_35",
          name: model.name || "Modelo",
        });

        // 2b. Gerar preview corpo inteiro via Gemini (fire-and-forget)
        if (process.env.GOOGLE_AI_API_KEY) {
          try {
            const { generatePreviewDirect } = await import("@/lib/model-preview");
            console.log(`[Onboarding] 🎨 Gerando preview para modelo...`);
            generatePreviewDirect({
              modelId: storeModel.id,
              storeId: store.id,
              skinTone: model.skin || "morena_clara",
              hairStyle: model.hair || "ondulado",
              bodyType: model.body || "media",
              style: model.style || "casual_natural",
              ageRange: model.age || "adulta_26_35",
              name: model.name || "Modelo",
            }).catch((err) => {
              console.warn("[Onboarding] Preview generation falhou (não fatal):", err);
            });
          } catch (previewErr) {
            console.warn("[Onboarding] Preview generation falhou (não fatal):", previewErr);
          }
        }
      } else {
        console.log(`[Onboarding] ⚠️ Modelo não criado: plano "${planName}" permite ${modelLimit} modelos (tem ${existingModels.length})`);
      }
    }

    // 3. Gerar backdrop personalizado via Inngest (fire-and-forget)
    if (brandColor && process.env.GOOGLE_AI_API_KEY) {
      try {
        const { inngest } = await import("@/lib/inngest/client");
        await inngest.send({
          name: "store/backdrop.requested",
          data: {
            storeId: store.id,
            brandColor: brandColor.startsWith("#") ? brandColor : `#${brandColor}`,
          },
        });
        console.log(`[Onboarding] 🚀 Backdrop disparado via Inngest (${brandColor})`);
      } catch (backdropErr) {
        console.warn("[Onboarding] Backdrop dispatch falhou (não fatal):", backdropErr);
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
