import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getStoreByClerkId, createStoreModel, listStoreModels, getStorePlanName, getModelLimitForPlan, consumeCredit, getStoreCredits } from "@/lib/db";
import { inngest } from "@/lib/inngest/client";

export const maxDuration = 30;
export const dynamic = "force-dynamic";

/**
 * POST /api/model/create
 * Salva as configurações da modelo no banco.
 * Dispara geração de preview em background via Inngest.
 * Retorna imediatamente (<1s) com o model.id.
 *
 * Body (FormData):
 *   - skinTone: string
 *   - hairStyle: string
 *   - bodyType: string
 *   - style: string
 *   - ageRange: string
 *   - name: string
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session.userId) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    const store = await getStoreByClerkId(session.userId);
    if (!store) {
      return NextResponse.json({ error: "Loja não encontrada" }, { status: 404 });
    }

    // ── Verificar limite de modelos do plano ──
    const [existingModels, planName] = await Promise.all([
      listStoreModels(store.id),
      getStorePlanName(store.id),
    ]);
    const modelLimit = getModelLimitForPlan(planName);

    if (existingModels.length >= modelLimit) {
      // Plano esgotou — tentar crédito avulso de modelos
      const creditUsed = await consumeCredit(store.id, "models");
      if (creditUsed) {
        console.log(`[Model] 💳 Crédito avulso de modelo consumido (plano: ${existingModels.length}/${modelLimit})`);
      } else {
        const credits = await getStoreCredits(store.id);
        return NextResponse.json(
          {
            error: `Limite de modelos atingido (${existingModels.length}/${modelLimit}). Compre créditos avulsos ou faça upgrade.`,
            code: "QUOTA_EXCEEDED",
            current: existingModels.length,
            limit: modelLimit,
            plan: planName,
            creditsAvailable: credits.models,
          },
          { status: 403 }
        );
      }
    }

    const formData = await request.formData();
    const skinTone = formData.get("skinTone") as string;
    const hairStyle = formData.get("hairStyle") as string;
    const bodyType = formData.get("bodyType") as string;
    const style = formData.get("style") as string;
    const ageRange = formData.get("ageRange") as string;
    const name = (formData.get("name") as string) || "Modelo";

    if (!skinTone || !hairStyle || !bodyType) {
      return NextResponse.json({ error: "Preencha todos os campos obrigatórios" }, { status: 400 });
    }

    // Salvar no banco (photo_url = null → frontend mostra placeholder)
    const model = await createStoreModel({
      storeId: store.id,
      skinTone,
      hairStyle,
      bodyType,
      style,
      ageRange,
      name,
    });

    // ── Disparar geração de preview em background via Inngest ──
    // Fire-and-forget: retorna imediatamente, preview gera em ~20-60s
    // Retry automático: 2 tentativas com backoff exponencial
    if (process.env.GOOGLE_AI_API_KEY || process.env.FASHN_API_KEY) {
      try {
        await inngest.send({
          name: "model/preview.requested",
          data: {
            modelId: model.id,
            storeId: store.id,
            skinTone,
            hairStyle,
            bodyType,
            style: style || "casual_natural",
            ageRange: ageRange || "adulta_26_35",
            name,
          },
        });
        console.log(`[Model] 🚀 Preview disparado via Inngest para "${name}" (model: ${model.id})`);
      } catch (inngestErr) {
        // Inngest falhou — log mas não bloqueia a criação do modelo
        console.warn("[Model] ⚠️ Inngest dispatch falhou (preview será gerado manualmente):", inngestErr);
      }
    }

    // Retorno instantâneo (<1s) — frontend mostra placeholder
    return NextResponse.json({
      success: true,
      data: {
        id: model.id,
        previewUrl: null,
        previewStatus: "pending",
        traits: { skinTone, hairStyle, bodyType, style, ageRange },
      },
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Erro desconhecido";
    console.error("[API:model/create] Error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

