import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/observability";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/admin/guard";
import { z } from "zod";

export const dynamic = "force-dynamic";

// allowlist de keys aceitas (evita envenenamento de settings arbitrários)
const ALLOWED_SETTING_KEYS = [
  "usd_brl_rate",
  "gc_last_run",
  "gc_dry_run_default",
  "feature_flags",
  "admin_notice",
  "maintenance_mode",
] as const;

const SettingUpsertSchema = z.object({
  key: z.enum(ALLOWED_SETTING_KEYS as unknown as [string, ...string[]]),
  value: z.union([z.string(), z.number(), z.boolean(), z.record(z.string(), z.unknown())]),
});

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
    logger.error("[API:admin/settings] GET error:", error);
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

    const body = await req.json();
    const parsed = SettingUpsertSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Key inválida ou não permitida", details: parsed.error.issues },
        { status: 400 },
      );
    }
    const { key, value } = parsed.data;

    const supabase = createAdminClient();

    // Store as JSON-compatible value
    const jsonValue = value;
    const { error } = await supabase
      .from("admin_settings")
      .upsert({ key, value: jsonValue }, { onConflict: "key" });

    if (error) throw error;

    return NextResponse.json({ success: true, message: `${key} atualizado para ${value}` });
  } catch (error) {
    logger.error("[API:admin/settings] PUT error:", error);
    return NextResponse.json({ error: "Erro ao atualizar configuração" }, { status: 500 });
  }
}
