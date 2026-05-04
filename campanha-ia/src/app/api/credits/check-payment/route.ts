import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getStoreByClerkId, getStoreCredits } from "@/lib/db";
import { getPaymentStatus } from "@/lib/payments/mercadopago";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";

/**
 * GET /api/credits/check-payment?payment_id=XXX
 * 
 * Verifica o status de um pagamento PIX/boleto pendente.
 * O frontend faz polling neste endpoint até o status mudar.
 * Retorna o saldo atualizado de créditos quando aprovado.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session.userId) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    const paymentId = request.nextUrl.searchParams.get("payment_id");
    if (!paymentId) {
      return NextResponse.json({ error: "payment_id obrigatório" }, { status: 400 });
    }

    // Verificar status no Mercado Pago
    if (!env.MERCADOPAGO_ACCESS_TOKEN) {
      return NextResponse.json({ status: "demo", credits: { campaigns: 0, models: 0 } });
    }

    const payment = await getPaymentStatus(paymentId);

    // Se aprovado, retornar créditos atualizados
    if (payment.status === "approved") {
      const store = await getStoreByClerkId(session.userId);
      const credits = store ? await getStoreCredits(store.id) : { campaigns: 0, models: 0, regenerations: 0 };

      return NextResponse.json({
        status: "approved",
        credits,
        message: "Pagamento aprovado! Créditos adicionados.",
      });
    }

    return NextResponse.json({
      status: payment.status, // "pending", "rejected", "cancelled", etc.
      statusDetail: payment.statusDetail,
      message: payment.status === "pending"
        ? "Aguardando confirmação do pagamento..."
        : `Status: ${payment.status}`,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Erro desconhecido";
    console.error("[API:credits/check-payment] Error:", msg);
    return NextResponse.json({ error: "Erro ao verificar pagamento" }, { status: 500 });
  }
}
