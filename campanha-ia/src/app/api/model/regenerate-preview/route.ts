import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getStoreByClerkId } from "@/lib/db";
import { createAdminClient } from "@/lib/supabase/admin";
import { generatePreviewDirect } from "@/lib/model-preview";

export const dynamic = "force-dynamic";

/**
 * POST /api/model/regenerate-preview
 * Gera (ou regenera) a preview de um modelo customizado.
 * Provider: Gemini 3.1 Flash Image Preview
 * Body: { modelId: string }
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

    const { modelId } = await request.json();
    if (!modelId) {
      return NextResponse.json({ error: "modelId obrigatório" }, { status: 400 });
    }

    const supabase = createAdminClient();

    // Buscar modelo da loja
    const { data: model, error } = await supabase
      .from("store_models")
      .select("*")
      .eq("id", modelId)
      .eq("store_id", store.id)
      .single();

    if (error || !model) {
      return NextResponse.json({ error: "Modelo não encontrado" }, { status: 404 });
    }

    // Gerar preview via Gemini 3.1 Flash Image (fire-and-forget)
    generatePreviewDirect({
      modelId,
      storeId: store.id,
      skinTone: model.skin_tone || "morena",
      hairStyle: model.hair_style || "ondulado",
      bodyType: model.body_type || "media",
      style: model.style || "casual_natural",
      ageRange: model.age_range || "adulta_26_35",
      name: model.name || "Modelo",
    }).catch((err) => {
      console.error("[API:model/regenerate-preview] Preview generation failed:", err);
    });

    return NextResponse.json({
      success: true,
      message: "Preview sendo gerada. Atualize a página em alguns segundos.",
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Erro desconhecido";
    console.error("[API:model/regenerate-preview] Error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
