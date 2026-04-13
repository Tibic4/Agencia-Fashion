import { MercadoPagoConfig, Preference, Payment, PreApproval } from "mercadopago";
import { PLANS, type PlanId } from "@/lib/plans";

// Re-export for consumers that imported PlanId from here
export { PLANS, type PlanId };

/**
 * Client do Mercado Pago configurado com access token
 */
const client = new MercadoPagoConfig({
  accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN || "",
});

export const preferenceClient = new Preference(client);
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
      back_url: `${appUrl}/plano?status=approved`,
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

// ═══════════════════════════════════════
// CRÉDITOS AVULSOS (Preference — pagamento único)
// ═══════════════════════════════════════

/**
 * Cria uma preferência de pagamento PONTUAL (para créditos avulsos).
 * Mantém Preference API pois créditos são compra única.
 */
export async function createCheckoutPreference(params: {
  planId: PlanId;
  userId: string;
  userEmail: string;
}) {
  const plan = PLANS[params.planId];
  if (!plan) throw new Error(`Plano inválido: ${params.planId}`);

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  const preference = await preferenceClient.create({
    body: {
      items: [
        {
          id: params.planId,
          title: `CriaLook ${plan.name} — Mensal`,
          description: plan.features.join(", "),
          quantity: 1,
          currency_id: "BRL",
          unit_price: plan.price,
        },
      ],
      payer: {
        email: params.userEmail,
      },
      back_urls: {
        success: `${appUrl}/plano?status=approved`,
        failure: `${appUrl}/plano?status=rejected`,
        pending: `${appUrl}/plano?status=pending`,
      },
      auto_return: "approved",
      external_reference: `${params.userId}|${params.planId}`,
      notification_url: `${appUrl}/api/webhooks/mercadopago`,
      statement_descriptor: "CRIALOOK",
    },
  });

  return {
    preferenceId: preference.id,
    initPoint: preference.init_point,
    sandboxInitPoint: preference.sandbox_init_point,
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
