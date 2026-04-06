import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { cancelSubscription } from "@/lib/payments/mercadopago";
import { getStoreByClerkId } from "@/lib/db";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/**
 * POST /api/subscription/cancel
 * 
 * Cancela a assinatura recorrente do usuário no Mercado Pago.
 * O plano permanece ativo até o fim do período já pago.
 */
export async function POST() {
  try {
    const session = await auth();
    if (!session.userId) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    const store = await getStoreByClerkId(session.userId);
    if (!store) {
      return NextResponse.json({ error: "Loja não encontrada" }, { status: 404 });
    }

    // Buscar subscription ID
    const supabase = createAdminClient();
    const { data: storeData } = await supabase
      .from("stores")
      .select("mercadopago_subscription_id")
      .eq("id", store.id)
      .single();

    const subscriptionId = storeData?.mercadopago_subscription_id;

    if (!subscriptionId) {
      return NextResponse.json(
        { error: "Nenhuma assinatura ativa encontrada", code: "NO_SUBSCRIPTION" },
        { status: 400 }
      );
    }

    if (!process.env.MERCADOPAGO_ACCESS_TOKEN) {
      return NextResponse.json({
        success: true,
        demo: true,
        message: "Modo demo — cancelamento simulado",
      });
    }

    // Cancelar no Mercado Pago
    const result = await cancelSubscription(subscriptionId);

    console.log(`[API:subscription/cancel] ✅ Assinatura ${subscriptionId} cancelada. Status: ${result.status}`);

    // Limpar subscription ID localmente (webhook também fará isso)
    await supabase.from("stores").update({
      mercadopago_subscription_id: null,
      updated_at: new Date().toISOString(),
    }).eq("id", store.id);

    return NextResponse.json({
      success: true,
      message: "Assinatura cancelada. Seu plano permanece ativo até o fim do período pago.",
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Erro desconhecido";
    console.error("[API:subscription/cancel] Error:", message);
    return NextResponse.json(
      { error: "Erro ao cancelar assinatura", details: process.env.NODE_ENV === "development" ? message : undefined },
      { status: 500 }
    );
  }
}
