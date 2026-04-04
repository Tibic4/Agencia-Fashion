import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/**
 * GET /api/showcase
 * Retorna itens ativos da vitrine antes/depois (público)
 */
export async function GET() {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("showcase_items")
      .select("id, before_photo_url, after_photo_url, caption, sort_order")
      .eq("is_active", true)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: false });

    if (error) throw error;

    return NextResponse.json({ success: true, data: data || [] });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Erro desconhecido";
    console.error("[API:showcase] Error:", message);
    return NextResponse.json({ error: "Erro ao buscar vitrine" }, { status: 500 });
  }
}
