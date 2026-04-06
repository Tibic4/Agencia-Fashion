import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/admin/guard";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/plans — lista todos os planos (admin only)
 */
export async function GET() {
  try {
    const admin = await requireAdmin();
    if (!admin.isAdmin) {
      return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
    }

    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("plans")
      .select("*")
      .order("price_monthly");

    if (error) throw error;

    return NextResponse.json({ success: true, data: data ?? [] });
  } catch (error) {
    console.error("[API:admin/plans] GET error:", error);
    return NextResponse.json({ error: "Erro ao buscar planos" }, { status: 500 });
  }
}
