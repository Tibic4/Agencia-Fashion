import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getStoreByClerkId } from "@/lib/db";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/**
 * GET /api/model/preview-status?ids=uuid1,uuid2,...
 * 
 * Endpoint leve para polling batched de previews pendentes.
 * Retorna o status (url ou null) de cada modelo consultada.
 * Custo: zero — apenas SELECT no banco.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session.userId) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    const store = await getStoreByClerkId(session.userId);
    if (!store) {
      return NextResponse.json({ error: "Loja não encontrada" }, { status: 404 });
    }

    const idsParam = request.nextUrl.searchParams.get("ids");
    if (!idsParam) {
      return NextResponse.json({ error: "Parâmetro 'ids' obrigatório" }, { status: 400 });
    }

    const modelIds = idsParam.split(",").filter(Boolean).slice(0, 20); // Max 20 por request

    if (modelIds.length === 0) {
      return NextResponse.json({ statuses: {} });
    }

    const supabase = createAdminClient();

    const { data: models, error } = await supabase
      .from("store_models")
      .select("id, photo_url, preview_url, created_at")
      .eq("store_id", store.id)
      .in("id", modelIds);

    if (error) {
      return NextResponse.json({ error: "Erro ao consultar modelos" }, { status: 500 });
    }

    // Montar mapa de statuses
    const statuses: Record<string, { url: string | null; status: string }> = {};

    for (const model of models || []) {
      const url = model.photo_url || model.preview_url || null;
      const createdAt = new Date(model.created_at).getTime();
      const ageMs = Date.now() - createdAt;

      if (url) {
        statuses[model.id] = { url, status: "completed" };
      } else if (ageMs > 5 * 60 * 1000) {
        // Mais de 5 min sem preview = provavelmente falhou
        statuses[model.id] = { url: null, status: "failed" };
      } else {
        statuses[model.id] = { url: null, status: "generating" };
      }
    }

    return NextResponse.json({ statuses });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Erro desconhecido";
    console.error("[API:model/preview-status] Error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
