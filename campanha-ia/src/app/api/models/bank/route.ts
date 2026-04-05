import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * GET /api/models/bank
 * Retorna as modelos padrão do banco (10 plus + 10 normais)
 * Query params opcionais: ?body_type=plus_size | normal
 */
export async function GET(request: Request) {
  try {
    const supabase = createAdminClient();
    const { searchParams } = new URL(request.url);
    const bodyType = searchParams.get("body_type");

    let query = supabase
      .from("model_bank")
      .select("id, name, body_type, skin_tone, pose, image_url, thumbnail_url")
      .eq("is_active", true)
      .order("body_type")
      .order("name");

    if (bodyType && (bodyType === "plus_size" || bodyType === "normal")) {
      query = query.eq("body_type", bodyType);
    }

    const { data, error } = await query;

    if (error) {
      console.error("[API:model-bank] Erro:", error);
      return NextResponse.json({ error: "Erro ao buscar modelos" }, { status: 500 });
    }

    return NextResponse.json({
      models: data || [],
      total: data?.length || 0,
    });
  } catch (err) {
    console.error("[API:model-bank] Erro inesperado:", err);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

/**
 * GET /api/models/bank/random
 * Retorna uma modelo aleatória do banco
 */
