import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/admin/guard";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/settings
 * Returns all admin settings
 */
export async function GET() {
  try {
    const admin = await requireAdmin();
    if (!admin.isAdmin) {
      return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
    }

    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("admin_settings")
      .select("key, value")
      .order("key");

    if (error) throw error;

    // Normalize: JSON value → plain string
    const normalized = (data ?? []).map(row => ({
      key: row.key,
      value: typeof row.value === "string" ? row.value : String(row.value),
    }));

    return NextResponse.json({ success: true, data: normalized });
  } catch (error) {
    console.error("[API:admin/settings] GET error:", error);
    return NextResponse.json({ error: "Erro ao buscar configurações" }, { status: 500 });
  }
}

/**
 * PUT /api/admin/settings
 * Updates a single setting
 * Body: { key: string, value: string }
 */
export async function PUT(req: NextRequest) {
  try {
    const admin = await requireAdmin();
    if (!admin.isAdmin) {
      return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
    }

    const { key, value } = await req.json();
    if (!key || value === undefined) {
      return NextResponse.json({ error: "key e value são obrigatórios" }, { status: 400 });
    }

    const supabase = createAdminClient();

    // Store as JSON-compatible value
    const jsonValue = value;
    const { error } = await supabase
      .from("admin_settings")
      .upsert({ key, value: jsonValue }, { onConflict: "key" });

    if (error) throw error;

    return NextResponse.json({ success: true, message: `${key} atualizado para ${value}` });
  } catch (error) {
    console.error("[API:admin/settings] PUT error:", error);
    return NextResponse.json({ error: "Erro ao atualizar configuração" }, { status: 500 });
  }
}
