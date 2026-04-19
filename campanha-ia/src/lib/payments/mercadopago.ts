import { MercadoPagoConfig, Payment, PreApproval } from "mercadopago";
import { PLANS, type PlanId } from "@/lib/plans";

// Re-export for consumers that imported PlanId from here
export { PLANS, type PlanId };

const client = new MercadoPagoConfig({
  accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN || "",
});

export const paymentClient = new Payment(client);
export const preApprovalClient = new PreApproval(client);

// ═══════════════════════════════════════
// ASSINATURA RECORRENTE (PreApproval)
// ═══════════════════════════════════════

/**
 * Cria uma assinatura recorrente (subscription) via PreApproval.
 * Retorna init_point para redirect — o cliente preenche o cartão no MP.
 */
export async function createSubscription(params: {
  planId: PlanId;
  storeId: string;
  userEmail: string;
}) {
  const plan = PLANS[params.planId];
  if (!plan) throw new Error(`Plano inválido: ${params.planId}`);

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  const subscription = await preApprovalClient.create({
    body: {
      reason: `CriaLook ${plan.name} — Mensal`,
      auto_recurring: {
        frequency: 1,
        frequency_type: "months",
        transaction_amount: plan.price,
        currency_id: "BRL",
      },
      back_url: `${appUrl}/plano?source=subscription`,
      payer_email: params.userEmail,
      external_reference: `${params.storeId}|${params.planId}`,
      status: "pending",
    },
  });

  return {
    subscriptionId: subscription.id,
    initPoint: subscription.init_point,
    sandboxInitPoint: (subscription as unknown as Record<string, unknown>).sandbox_init_point as string | undefined,
  };
}

/**
 * Cancela uma assinatura recorrente
 */
export async function cancelSubscription(subscriptionId: string) {
  const result = await preApprovalClient.update({
    id: subscriptionId,
    body: {
      status: "cancelled",
    },
  });

  return {
    id: result.id,
    status: result.status,
  };
}

/**
 * Busca o status de uma assinatura
 */
export async function getSubscriptionStatus(subscriptionId: string) {
  const result = await preApprovalClient.get({ id: subscriptionId });

  return {
    id: result.id,
    status: result.status,
    reason: result.reason,
    payerEmail: result.payer_email,
    externalReference: result.external_reference,
    autoRecurring: result.auto_recurring,
    nextPaymentDate: result.next_payment_date,
  };
}

/**
 * Verifica status de um pagamento pelo ID
 */
export async function getPaymentStatus(paymentId: string) {
  const payment = await paymentClient.get({ id: paymentId });
  return {
    status: payment.status,
    statusDetail: payment.status_detail,
    externalReference: payment.external_reference,
    transactionAmount: payment.transaction_amount,
    payer: payment.payer,
  };
}
