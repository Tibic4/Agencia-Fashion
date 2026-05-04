import { NextResponse } from "next/server";
import { logger } from "@/lib/observability";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * GET /api/fashion-facts
 * Returns active fashion facts from the database.
 * Used by the FashionFactsCarousel to supplement static facts.
 * Cache: 1 hour (ISR-style)
 *
 * Phase 4 D-17: this endpoint is a public read; uses the admin (service-role)
 * client because RLS on `fashion_facts` blocks anon reads even for is_active=true.
 * A future improvement is to add a permissive RLS policy and switch to anon —
 * outside Phase 4 scope. The previous implementation instantiated the
 * service-role client at MODULE SCOPE, which means the SUPABASE_SERVICE_ROLE_KEY
 * was being read at import-time and lived in module-state forever. Moving the
 * client into the handler keeps the key inside the request lifetime only and
 * matches every other admin path in this codebase.
 */
export async function GET() {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("fashion_facts")
      .select("emoji, category, text, source")
      .eq("is_active", true)
      .order("priority", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) throw error;

    return NextResponse.json({
      facts: data || [],
      count: data?.length || 0,
    }, {
      headers: {
        // Cache for 1 hour at edge, stale-while-revalidate for 6h
        "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=21600",
      },
    });
  } catch (err: any) {
    logger.error("[fashion-facts] Error:", err.message);
    // Return empty — the component has static fallbacks
    return NextResponse.json({ facts: [], count: 0 });
  }
}
