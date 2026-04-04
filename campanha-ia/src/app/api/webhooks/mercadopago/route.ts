import { NextRequest, NextResponse } from "next/server";
import { getPaymentStatus } from "@/lib/payments/mercadopago";

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

      // Extrair userId e planId do external_reference
      const [userId, planId] = (payment.externalReference || "").split("|");

      if (payment.status === "approved") {
        console.log(`[Webhook:MercadoPago] ✅ Pagamento aprovado! User: ${userId}, Plano: ${planId}`);

        // TODO: Quando Supabase estiver configurado:
        // 1. Atualizar plano do usuário no banco
        // 2. Resetar contador de campanhas do mês
        // 3. Enviar email de confirmação
        //
        // await supabase.from("subscriptions").upsert({
        //   user_id: userId,
        //   plan_id: planId,
        //   status: "active",
        //   mp_payment_id: paymentId,
        //   current_period_start: new Date().toISOString(),
        //   current_period_end: addMonths(new Date(), 1).toISOString(),
        // });
      }

      if (payment.status === "rejected") {
        console.log(`[Webhook:MercadoPago] ❌ Pagamento rejeitado. User: ${userId}`);
      }

      if (payment.status === "pending") {
        console.log(`[Webhook:MercadoPago] ⏳ Pagamento pendente (PIX/boleto). User: ${userId}`);
      }
    }

    // Mercado Pago espera 200 OK
    return NextResponse.json({ received: true }, { status: 200 });
  } catch (error: any) {
    console.error("[Webhook:MercadoPago] Erro:", error.message);
    // Retorna 200 mesmo em erro para evitar retries infinitos
    return NextResponse.json({ received: true, error: true }, { status: 200 });
  }
}
