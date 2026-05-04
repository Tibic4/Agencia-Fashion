import { NextResponse } from "next/server";
import { logger } from "@/lib/observability";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/**
 * GET /api/showcase/tips
 * Returns the showcase item marked for the photo tips card (use_in_tips = true).
 * Falls back to first active item if none is marked.
 * Public endpoint — no auth required.
 */
export async function GET() {
  try {
    const supabase = createAdminClient();

    // 1. Try to find item explicitly marked for tips
    const { data: tipsItem } = await supabase
      .from("showcase_items")
      .select("before_photo_url, after_photo_url, caption")
      .eq("is_active", true)
      .eq("use_in_tips", true)
      .order("sort_order")
      .limit(1)
      .maybeSingle();

    if (tipsItem) {
      return NextResponse.json({ success: true, data: tipsItem });
    }

    // 2. Fallback: first active item
    const { data: fallback } = await supabase
      .from("showcase_items")
      .select("before_photo_url, after_photo_url, caption")
      .eq("is_active", true)
      .order("sort_order")
      .limit(1)
      .maybeSingle();

    return NextResponse.json({
      success: true,
      data: fallback || null,
    });
  } catch (error) {
    logger.error("[API:showcase/tips] Error:", error);
    return NextResponse.json({ success: true, data: null });
  }
}
