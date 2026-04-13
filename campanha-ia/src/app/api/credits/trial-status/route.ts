import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getStoreByClerkId } from "@/lib/db";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/**
 * GET /api/credits/trial-status
 * 
 * Retorna se o usuário já utilizou o pacote Trial.
 * Verifica na tabela credit_purchases se há compra com características do trial.
 */
export async function GET() {
  try {
    const session = await auth();
    if (!session.userId) {
      return NextResponse.json({ used: false });
    }

    const store = await getStoreByClerkId(session.userId);
    if (!store) {
      return NextResponse.json({ used: false });
    }

    const supabase = createAdminClient();
    const { count } = await supabase
      .from("credit_purchases")
      .select("id", { count: "exact", head: true })
      .eq("store_id", store.id)
      .eq("type", "campaigns")
      .eq("quantity", 3)
      .lte("price_brl", 20); // trial = R$ 19,90

    return NextResponse.json({ used: (count ?? 0) > 0 });
  } catch {
    return NextResponse.json({ used: false });
  }
}
