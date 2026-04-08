import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/**
 * GET /api/showcase/tips
 * Returns the first active showcase item (before/after) for the photo tips card.
 * Public endpoint — no auth required.
 */
export async function GET() {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("showcase_items")
      .select("before_photo_url, after_photo_url, caption")
      .eq("is_active", true)
      .order("sort_order")
      .limit(1)
      .maybeSingle();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      data: data || null,
    });
  } catch (error) {
    console.error("[API:showcase/tips] Error:", error);
    return NextResponse.json({ success: true, data: null });
  }
}
