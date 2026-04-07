import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getStoreByClerkId, listStoreModels, getStorePlanName, getModelLimitForPlan } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * GET /api/model/list
 * Lista todos os modelos da loja do usuário autenticado.
 * Retorna também o plano e limites.
 */
export async function GET() {
  try {
    const session = await auth();
    if (!session.userId) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    const store = await getStoreByClerkId(session.userId);
    if (!store) {
      // Loja ainda não existe — retorna lista vazia
      return NextResponse.json({ models: [], plan: "free", limit: 1 });
    }

    const [models, planName] = await Promise.all([
      listStoreModels(store.id),
      getStorePlanName(store.id),
    ]);

    const limit = getModelLimitForPlan(planName);

    return NextResponse.json({
      models: models.map((m) => ({
        id: m.id,
        name: m.name || "Modelo",
        skin_tone: m.skin_tone,
        hair_style: m.hair_style,
        body_type: m.body_type,
        style: m.style,
        age_range: m.age_range,
        is_active: m.is_active,
        created_at: m.created_at,
        photo_url: m.preview_url || m.reference_photos?.[0] || null,
        face_ref_url: m.face_ref_url || null,
      })),
      plan: planName,
      limit,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Erro desconhecido";
    console.error("[API:model/list] Error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
