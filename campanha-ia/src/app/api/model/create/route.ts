import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getStoreByClerkId, createStoreModel, listStoreModels, getStorePlanName, getModelLimitForPlan, consumeCredit, getStoreCredits } from "@/lib/db";
import { createAdminClient } from "@/lib/supabase/admin";

export const maxDuration = 120;
export const dynamic = "force-dynamic";

/**
 * POST /api/model/create
 * Salva as configurações da modelo no banco.
 * Gera preview de corpo inteiro descalça (mesmo padrão do banco stock).
 * Opcionalmente envia fotos de referência para Fashn.ai para modelo treinada.
 *
 * Body (FormData):
 *   - skinTone: string
 *   - hairStyle: string
 *   - bodyType: string
 *   - style: string
 *   - ageRange: string
 *   - name: string
 *   - photos: File[] (opcional, 1-4 fotos de referência)
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

    const supabase = createAdminClient();

    // Salvar no banco
    const model = await createStoreModel({
      storeId: store.id,
      skinTone,
      hairStyle,
      bodyType,
      style,
      ageRange,
      name,
    });

    // ── Gerar preview corpo inteiro descalça (mesmo padrão stock) ──
    let previewUrl: string | null = null;
    if (process.env.FASHN_API_KEY) {
      try {
        const { generateCustomModelPreview } = await import("@/lib/fashn/client");
        console.log(`[Model] 🎨 Gerando preview corpo inteiro para "${name}"...`);
        const previewResult = await generateCustomModelPreview({
          skinTone,
          hairStyle,
          bodyType,
          style,
          ageRange,
          name,
          storeId: store.id,
        });

        if (previewResult.status === "completed" && previewResult.outputUrl) {
          previewUrl = previewResult.outputUrl;
          await supabase
            .from("store_models")
            .update({ photo_url: previewUrl, preview_url: previewUrl })
            .eq("id", model.id);
          console.log(`[Model] ✅ Preview gerado: ${previewUrl.slice(0, 60)}...`);
        } else {
          console.warn(`[Model] ⚠️ Preview falhou: ${previewResult.error || "status=" + previewResult.status}`);
        }
      } catch (previewErr) {
        console.warn("[Model] Preview generation falhou:", previewErr);
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        id: model.id,
        previewUrl,
      },
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Erro desconhecido";
    console.error("[API:model/create] Error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
