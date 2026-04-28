export const PLANS = {
  essencial: {
    id: "essencial",
    name: "Essencial",
    price: 179.0,
    campaigns_per_month: 15,
    models: 5,
    features: [
      "15 campanhas/mês",
      "5 modelos virtuais",
      "Virtual Try-On com IA",
      "Legenda e Hashtags IA",
      "Fundo Inteligente Adaptável",
      "Suporte WhatsApp",
    ],
  },
  pro: {
    id: "pro",
    name: "Pro",
    price: 359.0,
    campaigns_per_month: 40,
    models: 15,
    features: [
      "40 campanhas/mês",
      "15 modelos virtuais",
      "Virtual Try-On com IA",
      "Legenda e Hashtags IA",
      "Alta Prioridade na Fila",
      "Fundo Inteligente Adaptável",
      "Suporte WhatsApp",
    ],
  },
  business: {
    id: "business",
    name: "Business",
    price: 749.0,
    campaigns_per_month: 100,
    models: 40,
    features: [
      "100 campanhas/mês",
      "40 modelos virtuais",
      "Virtual Try-On com IA",
      "Legenda e Hashtags IA",
      "Prioridade Máxima na Fila",
      "Fundo Inteligente Adaptável",
      "Suporte VIP Dedicado",
    ],
  },
} as const;

export type PlanId = keyof typeof PLANS;
