import { NextResponse } from "next/server";
import { logger } from "@/lib/observability";
import { auth } from "@clerk/nextjs/server";
import { getStoreByClerkId, listStoreModels, getStorePlanName, getModelLimitForPlan, getStoreCredits } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * GET /api/model/list
 * Lista todos os modelos da loja do usuário autenticado.
 * Retorna também o plano e limites (plano + avulsos).
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
      return NextResponse.json({ models: [], plan: "free", limit: 0 });
    }

    const [models, planName, credits] = await Promise.all([
      listStoreModels(store.id),
      getStorePlanName(store.id),
      getStoreCredits(store.id),
    ]);

    const limit = getModelLimitForPlan(planName) + (credits.models || 0);

    return NextResponse.json({
      models: models.map((m) => ({
        id: m.id,
        name: m.name || "Modelo",
        skin_tone: m.skin_tone,
        hair_style: m.hair_style,
        hair_texture: m.hair_texture || null,
        hair_length: m.hair_length || null,
        hair_color: m.hair_color || null,
        body_type: m.body_type,
        style: m.style,
        age_range: m.age_range,
        gender: m.gender || "feminino",
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
    logger.error("[API:model/list] Error:", msg);
    return NextResponse.json({ error: "Erro ao listar modelos" }, { status: 500 });
  }
}
