import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getStoreByClerkId, createStoreModel, listStoreModels, getStorePlanName, getModelLimitForPlan } from "@/lib/db";
import { createAdminClient } from "@/lib/supabase/admin";

export const maxDuration = 120;
export const dynamic = "force-dynamic";

/**
 * POST /api/model/create
 * Salva as configurações da modelo no banco.
 * Opcionalmente envia fotos de referência para Fashn.ai para criar modelo treinada.
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
      return NextResponse.json(
        {
          error: `Limite de modelos atingido (${existingModels.length}/${modelLimit}). Faça upgrade do plano para criar mais modelos.`,
          code: "QUOTA_EXCEEDED",
          current: existingModels.length,
          limit: modelLimit,
          plan: planName,
        },
        { status: 403 }
      );
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

    // Upload de fotos de referência (se houver)
    const photoUrls: string[] = [];
    const supabase = createAdminClient();

    for (let i = 0; i < 4; i++) {
      const photo = formData.get(`photo_${i}`) as File | null;
      if (!photo) continue;

      const ext = photo.type.split("/")[1] || "jpg";
      const path = `${store.id}/model_ref_${Date.now()}_${i}.${ext}`;
      const buffer = Buffer.from(await photo.arrayBuffer());

      const { error: uploadErr } = await supabase.storage
        .from("model-previews")
        .upload(path, buffer, { contentType: photo.type, upsert: true });

      if (!uploadErr) {
        const { data } = supabase.storage.from("model-previews").getPublicUrl(path);
        photoUrls.push(data.publicUrl);
      }
    }

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

    // Se tem fotos, tentar criar modelo no Fashn.ai
    let fashnModelId: string | null = null;
    if (photoUrls.length >= 1 && process.env.FASHN_API_KEY) {
      try {
        const { createModel } = await import("@/lib/fashn/client");
        const result = await createModel({
          name: `${name}_${store.id.slice(0, 8)}`,
          sampleImages: photoUrls,
        });
        fashnModelId = result.id;

        // Salvar ID do Fashn no modelo
        await supabase
          .from("store_models")
          .update({ fashn_model_id: fashnModelId, reference_photos: photoUrls })
          .eq("id", model.id);
      } catch (fashnErr) {
        console.warn("[Model] Fashn.ai model create falhou:", fashnErr);
        // Não é erro fatal — modelo salvo no banco, Fashn é opcional
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        id: model.id,
        fashnModelId,
        photoCount: photoUrls.length,
      },
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Erro desconhecido";
    console.error("[API:model/create] Error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
