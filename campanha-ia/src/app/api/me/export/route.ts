import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { captureError } from "@/lib/observability";
import { AuthError, CrialookError, respondToError } from "@/lib/errors";

export const dynamic = "force-dynamic";

/**
 * LGPD art. 18 V (direito à portabilidade).
 *
 * GET /api/me/export
 * Retorna JSON com TODOS os dados do usuário autenticado para download.
 * Content-Disposition attachment para force-download.
 */
export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      throw new AuthError();
    }

    const supabase = createAdminClient();

    const { data: store } = await supabase
      .from("stores")
      .select("*")
      .eq("clerk_user_id", userId)
      .maybeSingle();

    if (!store) {
      return NextResponse.json({
        exported_at: new Date().toISOString(),
        clerk_user_id: userId,
        store: null,
        campaigns: [],
        models: [],
        purchases: [],
        usage: [],
      });
    }

    const storeId = store.id;

    const [campaigns, outputs, scores, models, purchases, usage] = await Promise.all([
      supabase.from("campaigns").select("*").eq("store_id", storeId),
      supabase
        .from("campaign_outputs")
        .select("*, campaigns!inner(store_id)")
        .eq("campaigns.store_id", storeId),
      supabase
        .from("campaign_scores")
        .select("*, campaigns!inner(store_id)")
        .eq("campaigns.store_id", storeId),
      supabase.from("store_models").select("*").eq("store_id", storeId),
      supabase.from("credit_purchases").select("*").eq("store_id", storeId),
      supabase.from("store_usage").select("*").eq("store_id", storeId),
    ]);

    const payload = {
      exported_at: new Date().toISOString(),
      clerk_user_id: userId,
      store,
      campaigns: campaigns.data ?? [],
      campaign_outputs: outputs.data ?? [],
      campaign_scores: scores.data ?? [],
      models: models.data ?? [],
      purchases: purchases.data ?? [],
      usage: usage.data ?? [],
    };

    const json = JSON.stringify(payload, null, 2);
    return new NextResponse(json, {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="crialook-export-${userId}-${Date.now()}.json"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    if (e instanceof CrialookError) return respondToError(e);
    captureError(e, { route: "GET /api/me/export" });
    return NextResponse.json({ error: "Erro ao exportar" }, { status: 500 });
  }
}
