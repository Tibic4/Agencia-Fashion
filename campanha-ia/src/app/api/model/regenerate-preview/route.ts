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
 * Suporta modo multimodal se o modelo tem face_ref_url salva.
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

    // Se o modelo tem face_ref_url, buscar a imagem e converter para base64
    let faceRefBase64: string | null = null;
    let faceRefMimeType = "image/jpeg";

    if (model.face_ref_url) {
      try {
        const res = await fetch(model.face_ref_url);
        if (res.ok) {
          const arrayBuffer = await res.arrayBuffer();
          faceRefBase64 = Buffer.from(arrayBuffer).toString("base64");
          faceRefMimeType = res.headers.get("content-type") || "image/jpeg";
          console.log(`[Regen] 📷 Face ref carregada para modelo ${modelId}`);
        }
      } catch (fetchErr) {
        console.warn("[Regen] ⚠️ Falha ao carregar face_ref_url:", fetchErr);
      }
    }

    // Gerar preview via Gemini 3.1 Flash Image (fire-and-forget)
    generatePreviewDirect({
      modelId,
      storeId: store.id,
      skinTone: model.skin_tone || "morena",
      hairStyle: model.hair_style || "ondulado",
      hairTexture: model.hair_texture || undefined,
      hairLength: model.hair_length || undefined,
      hairColor: model.hair_color || undefined,
      bodyType: model.body_type || "media",
      style: model.style || "casual_natural",
      ageRange: model.age_range || "adulta_26_35",
      name: model.name || "Modelo",
      gender: model.gender || "feminino",
      faceRefBase64,
      faceRefMimeType,
    }).catch((err) => {
      console.error("[API:model/regenerate-preview] Preview generation failed:", err);
    });

    return NextResponse.json({
      success: true,
      message: "Preview sendo gerada. Atualize a página em alguns segundos.",
      mode: faceRefBase64 ? "multimodal" : "text-only",
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Erro desconhecido";
    console.error("[API:model/regenerate-preview] Error:", msg);
    return NextResponse.json({ error: "Erro ao regenerar preview" }, { status: 500 });
  }
}
