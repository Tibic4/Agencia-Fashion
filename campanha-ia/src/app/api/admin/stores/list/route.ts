import { NextResponse } from "next/server";
import { logger } from "@/lib/observability";
import { requireAdmin } from "@/lib/admin/guard";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/stores/list — lista todas as lojas (admin only)
 */
export async function GET() {
  const admin = await requireAdmin();
  if (!admin.isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("stores")
    .select("id, name, segment_primary, onboarding_completed, created_at, plans!stores_plan_id_fkey(display_name), store_usage!store_usage_store_id_fkey(campaigns_generated, campaigns_limit)")
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) {
    logger.error("Error fetching stores:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ stores: data ?? [] });
}
