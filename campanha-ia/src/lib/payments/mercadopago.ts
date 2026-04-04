import { MercadoPagoConfig, Preference, Payment } from "mercadopago";

/**
 * Client do Mercado Pago configurado com access token
 */
const client = new MercadoPagoConfig({
  accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN || "",
});

export const preferenceClient = new Preference(client);
export const paymentClient = new Payment(client);

/**
 * Planos do CriaLook — alinhados com tabela `plans` do Supabase
 */
export const PLANS = {
  starter: {
    id: "starter",
    name: "Starter",
    price: 59.0,
    campaigns_per_month: 15,
    features: ["15 campanhas/mês", "4 canais", "Score de qualidade"],
  },
  pro: {
    id: "pro",
    name: "Pro",
    price: 129.0,
    campaigns_per_month: 40,
    features: [
      "40 campanhas/mês",
      "4 canais",
      "Modelo virtual IA",
      "Score + sugestões",
      "Suporte prioritário",
    ],
  },
  business: {
    id: "business",
    name: "Business",
    price: 249.0,
    campaigns_per_month: 100,
    features: [
      "100 campanhas/mês",
      "4 canais",
      "Modelo virtual IA",
      "Remove background",
      "Suporte prioritário",
    ],
  },
  agencia: {
    id: "agencia",
    name: "Agência",
    price: 499.0,
    campaigns_per_month: 200,
    features: [
      "200 campanhas/mês",
      "4 canais",
      "Modelos virtuais ilimitados",
      "Remove background",
      "API access",
      "Suporte VIP",
    ],
  },
} as const;

export type PlanId = keyof typeof PLANS;

/**
 * Cria uma preferência de pagamento no Mercado Pago
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
