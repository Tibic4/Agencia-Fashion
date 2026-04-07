import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * GET /api/fashion-facts
 * Returns active fashion facts from the database.
 * Used by the FashionFactsCarousel to supplement static facts.
 * Cache: 1 hour (ISR-style)
 */
export async function GET() {
  try {
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
    console.error("[fashion-facts] Error:", err.message);
    // Return empty — the component has static fallbacks
    return NextResponse.json({ facts: [], count: 0 });
  }
}
