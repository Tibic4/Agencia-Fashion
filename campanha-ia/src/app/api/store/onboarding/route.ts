import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/observability";
import { auth } from "@clerk/nextjs/server";
import { createStore, createStoreModel, getStoreByClerkId } from "@/lib/db";
import { createAdminClient } from "@/lib/supabase/admin";
import { env } from "@/lib/env";
import {
  AuthError,
  ValidationError,
  CrialookError,
  respondToError,
} from "@/lib/errors";

export const dynamic = "force-dynamic";

/**
 * POST /api/store/onboarding
 *
 * Cria/atualiza a loja e modelo virtual do usuário após o onboarding.
 *
 * Atenção ao caminho do webhook: `clerk.user.created` cria uma loja
 * placeholder (name=emailPrefix, segment_primary='outro',
 * onboarding_completed=false) ANTES do usuário ver o form. Quando ele
 * termina o onboarding e chega aqui, a loja JÁ existe — então:
 *
 *  - existing.onboarding_completed = true  → retorna idempotente (já fez)
 *  - existing.onboarding_completed = false → UPDATE com dados do form +
 *    seta onboarding_completed=true. Antes a função early-returnava
 *    "Loja já existe" e os dados do form eram silenciosamente descartados.
 *  - sem existing → CREATE clássico.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session.userId) {
      throw new AuthError();
    }

    const body = await request.json();
    const { storeName, segment, city, state, instagram, model, brandColor } = body;

    const existing = await getStoreByClerkId(session.userId);

    // Idempotência: já completou onboarding antes — retorna sem reescrever.
    if (existing && existing.onboarding_completed) {
      return NextResponse.json({
        success: true,
        data: { store: existing },
        message: "Onboarding já foi concluído",
      });
    }

    if (!storeName || !segment) {
      throw new ValidationError("Nome da loja e segmento são obrigatórios", "MISSING_REQUIRED");
    }

    let store;
    if (existing) {
      // Placeholder do webhook → UPDATE com dados reais do form
      const supabase = createAdminClient();
      const { data: updated, error: updateErr } = await supabase
        .from("stores")
        .update({
          name: storeName,
          segment_primary: segment,
          city: city || null,
          state: state || null,
          instagram_handle: instagram || null,
          brand_colors: brandColor ? { primary: brandColor } : null,
          onboarding_completed: true,
        })
        .eq("id", existing.id)
        .select()
        .single();
      if (updateErr || !updated) {
        throw new CrialookError(
          "STORE_UPDATE_FAILED",
          "Erro ao atualizar loja",
          500,
          updateErr ?? undefined,
        );
      }
      store = updated;
    } else {
      // 1. Criar loja (caso o webhook tenha falhado ou não tenha disparado)
      store = await createStore({
        clerkUserId: session.userId,
        name: storeName,
        segmentPrimary: segment,
        city: city || undefined,
        state: state || undefined,
        instagramHandle: instagram || undefined,
        brandColor: brandColor || undefined,
      });
    }

    // 2. Criar modelo virtual (se não pulou E se o plano permite)
    let storeModel = null;
    const previewUrl: string | null = null;
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
        if (env.GOOGLE_AI_API_KEY) {
          try {
            const { generatePreviewDirect } = await import("@/lib/model-preview");
            logger.info(`[Onboarding] 🎨 Gerando preview para modelo...`);
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
              logger.warn("[Onboarding] Preview generation falhou (não fatal):", err);
            });
          } catch (previewErr) {
            logger.warn("[Onboarding] Preview generation falhou (não fatal):", previewErr);
          }
        }
      } else {
        logger.info(`[Onboarding] ⚠️ Modelo não criado: plano "${planName}" permite ${modelLimit} modelos (tem ${existingModels.length})`);
      }
    }




    // Bust o cache do middleware: o cookie cl_hs_<userId> ficava com "0"
    // (placeholder sem onboarding) por 1h, fazendo o user voltar pra
    // /onboarding mesmo depois de concluir. Sobrescrever pra "1" aqui
    // garante que a próxima request middleware-side já leia "tem store
    // completo" sem ida ao DB.
    const response = NextResponse.json({
      success: true,
      data: { store, model: storeModel },
    });
    response.cookies.set(`cl_hs_${session.userId}`, "1", {
      maxAge: 60 * 60,
      path: "/",
      sameSite: "lax",
      httpOnly: true,
    });
    return response;
  } catch (error: unknown) {
    if (error instanceof CrialookError) return respondToError(error);
    const message = error instanceof Error ? error.message : "Erro desconhecido";
    logger.error("[API:store/onboarding] Error:", message);
    return NextResponse.json(
      { error: "Erro ao configurar loja", details: env.NODE_ENV === "development" ? message : undefined },
      { status: 500 }
    );
  }
}
