import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { captureError, logger } from "@/lib/observability";

export const dynamic = "force-dynamic";

/**
 * FASE I — LGPD art. 18 VI (direito à eliminação).
 *
 * DELETE /api/me
 * Remove a loja do usuário autenticado e todos os dados associados.
 * O usuário Clerk em si precisa ser deletado separadamente via Clerk Dashboard
 * (ou implementar via Clerk Backend SDK — fora do escopo deste endpoint).
 *
 * Operação em cascata (respeitando FKs):
 *  1. campaign_outputs (via campaigns)
 *  2. campaign_scores (via campaigns)
 *  3. campaigns
 *  4. store_models
 *  5. credit_purchases
 *  6. store_usage
 *  7. plan_payments_applied
 *  8. api_cost_logs (por store_id)
 *  9. stores
 */
export async function DELETE() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    const supabase = createAdminClient();
    const { data: store } = await supabase
      .from("stores")
      .select("id")
      .eq("clerk_user_id", userId)
      .maybeSingle();

    if (!store) {
      return NextResponse.json({ ok: true, message: "Nada a deletar" });
    }

    const storeId = store.id;

    // Buscar IDs de campaigns da store (para deletar campaign_outputs/scores)
    const { data: campaigns } = await supabase
      .from("campaigns")
      .select("id")
      .eq("store_id", storeId);
    const campaignIds = (campaigns || []).map((c) => c.id);

    if (campaignIds.length > 0) {
      await supabase.from("campaign_outputs").delete().in("campaign_id", campaignIds);
      await supabase.from("campaign_scores").delete().in("campaign_id", campaignIds);
    }

    await supabase.from("campaigns").delete().eq("store_id", storeId);
    await supabase.from("store_models").delete().eq("store_id", storeId);
    await supabase.from("credit_purchases").delete().eq("store_id", storeId);
    await supabase.from("store_usage").delete().eq("store_id", storeId);
    await supabase.from("plan_payments_applied").delete().eq("store_id", storeId);
    await supabase.from("api_cost_logs").delete().eq("store_id", storeId);
    await supabase.from("stores").delete().eq("id", storeId);

    // TODO: também deletar arquivos em Storage (buckets: product-photos, generated-images, store-assets).
    // Deixar para o garbage collector passar (já tem lógica de purge).

    logger.info("user_self_delete", { user_id: userId, store_id: storeId });

    return NextResponse.json({
      ok: true,
      message:
        "Dados da sua loja foram removidos. Para apagar sua conta Clerk (email/senha), acesse Configurações → Excluir conta.",
    });
  } catch (e) {
    captureError(e, { route: "DELETE /api/me" });
    return NextResponse.json({ error: "Erro ao deletar" }, { status: 500 });
  }
}
