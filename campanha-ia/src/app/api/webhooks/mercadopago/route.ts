import { NextRequest, NextResponse } from "next/server";
import { getPaymentStatus } from "@/lib/payments/mercadopago";
import { updateStorePlan } from "@/lib/db";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/**
 * POST /api/webhooks/mercadopago
 * 
 * Recebe notificações do Mercado Pago sobre pagamentos.
 * Documentação: https://www.mercadopago.com.br/developers/pt/docs/your-integrations/notifications/webhooks
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    console.log("[Webhook:MercadoPago] Recebido:", JSON.stringify(body, null, 2));

    // Verificar tipo de notificação
    if (body.type === "payment" && body.data?.id) {
      const paymentId = String(body.data.id);

      // Buscar detalhes do pagamento
      const payment = await getPaymentStatus(paymentId);

      console.log("[Webhook:MercadoPago] Pagamento:", {
        status: payment.status,
        amount: payment.transactionAmount,
        ref: payment.externalReference,
      });

      // Extrair storeId e planId do external_reference (formato: "storeId|planId")
      const [storeId, planId] = (payment.externalReference || "").split("|");

      if (payment.status === "approved" && storeId && planId) {
        console.log(`[Webhook:MercadoPago] ✅ Pagamento aprovado! Store: ${storeId}, Plano: ${planId}`);

        // 1. Atualizar plano da loja + resetar store_usage
        await updateStorePlan(storeId, planId, paymentId);

        // 2. Registrar pagamento no Mercado Pago
        const supabase = createAdminClient();
        await supabase.from("stores").update({
          mercadopago_customer_id: (payment.payer as Record<string, unknown>)?.id?.toString() || null,
          updated_at: new Date().toISOString(),
        }).eq("id", storeId);

        console.log(`[Webhook:MercadoPago] ✅ Plano atualizado para "${planId}"`);
      }

      if (payment.status === "rejected") {
        console.log(`[Webhook:MercadoPago] ❌ Pagamento rejeitado. Store: ${storeId}`);
      }

      if (payment.status === "pending") {
        console.log(`[Webhook:MercadoPago] ⏳ Pagamento pendente (PIX/boleto). Store: ${storeId}`);
      }
    }

    // Mercado Pago espera 200 OK
    return NextResponse.json({ received: true }, { status: 200 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Erro desconhecido";
    console.error("[Webhook:MercadoPago] Erro:", message);
    // Retorna 200 mesmo em erro para evitar retries infinitos
    return NextResponse.json({ received: true, error: true }, { status: 200 });
  }
}
