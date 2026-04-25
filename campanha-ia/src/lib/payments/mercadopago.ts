import { MercadoPagoConfig, Payment, PreApproval } from "mercadopago";
import { PLANS, type PlanId } from "@/lib/plans";

// Re-export for consumers that imported PlanId from here
export { PLANS, type PlanId };

// não aceita string vazia. Se MP_ACCESS_TOKEN faltar, cliente é null
// e quem tentar usar recebe erro claro em vez de falhar silenciosamente no MP.
function createMpClient(): MercadoPagoConfig | null {
  const token = process.env.MERCADOPAGO_ACCESS_TOKEN;
  if (!token || token.length < 20) {
    if (process.env.NODE_ENV === "production") {
      // Em prod, logamos um warn inicial (não falha o boot)
      console.warn("[MP] ⚠️ MERCADOPAGO_ACCESS_TOKEN ausente ou inválido — pagamentos desabilitados");
    }
    return null;
  }
  return new MercadoPagoConfig({ accessToken: token });
}

const client = createMpClient();

function requireClient(): MercadoPagoConfig {
  if (!client) {
    throw new Error("MERCADOPAGO_ACCESS_TOKEN não configurado — pagamentos desabilitados");
  }
  return client;
}

function getPaymentClient(): Payment {
  return new Payment(requireClient());
}
function getPreApprovalClient(): PreApproval {
  return new PreApproval(requireClient());
}

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

  const subscription = await getPreApprovalClient().create({
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
  const result = await getPreApprovalClient().update({
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
  const result = await getPreApprovalClient().get({ id: subscriptionId });

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
  const payment = await getPaymentClient().get({ id: paymentId });
  return {
    status: payment.status,
    statusDetail: payment.status_detail,
    externalReference: payment.external_reference,
    transactionAmount: payment.transaction_amount,
    payer: payment.payer,
  };
}
