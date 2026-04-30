/**
 * CriaLook — Fonte de Verdade de Planos & Preços
 * 
 * TODOS os planos, packs avulsos e trial estão definidos aqui.
 * Qualquer outro arquivo que referencia preços/limites DEVE importar daqui.
 */

// ═══════════════════════════════════════════════════════════
// ASSINATURAS MENSAIS
// ═══════════════════════════════════════════════════════════

export const PLANS = {
  essencial: {
    id: "essencial",
    name: "Essencial",
    price: 89.0,
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
    price: 179.0,
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
    price: 379.0,
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

// ═══════════════════════════════════════════════════════════
// LIMITES POR PLANO
// ═══════════════════════════════════════════════════════════

/** Limite de modelos por nome de plano (inclui alias "free"/"gratis") */
export function getModelLimitForPlan(planName: string): number {
  const limits: Record<string, number> = {
    gratis: 0,
    free: 0,
    essencial: PLANS.essencial.models,
    pro: PLANS.pro.models,
    business: PLANS.business.models,
  };
  return limits[planName] ?? 0;
}

/** Dias de histórico por plano (0 = ilimitado) */
export function getHistoryDaysForPlan(planName: string): number {
  const limits: Record<string, number> = {
    gratis: 7,
    free: 7,
    essencial: 30,
    pro: 365,
    business: 0, // ilimitado
  };
  return limits[planName] ?? 7;
}

// ═══════════════════════════════════════════════════════════
// PACKS AVULSOS — CAMPANHAS
// ═══════════════════════════════════════════════════════════

export const CREDIT_PACKAGES_CAMPAIGNS = {
  "3_campanhas": {
    type: "campaigns" as const,
    quantity: 3,
    price: 24.90,
    title: "Starter — 3 Campanhas",
    description: "3 campanhas completas com modelo virtual (R$ 8,30/cada)",
  },
  "10_campanhas": {
    type: "campaigns" as const,
    quantity: 10,
    price: 69.90,
    title: "Smart — 10 Campanhas",
    description: "10 campanhas completas com modelo virtual (R$ 6,99/cada)",
  },
  "20_campanhas": {
    type: "campaigns" as const,
    quantity: 20,
    price: 119.90,
    title: "Volume — 20 Campanhas",
    description: "20 campanhas completas com modelo virtual (R$ 6,00/cada)",
  },
} as const;

// ═══════════════════════════════════════════════════════════
// PACKS AVULSOS — MODELOS
// ═══════════════════════════════════════════════════════════

export const CREDIT_PACKAGES_MODELS = {
  "3_modelos": {
    type: "models" as const,
    quantity: 3,
    price: 19.90,
    title: "Básico — 3 Modelos",
    description: "3 modelos virtuais para suas campanhas (R$ 6,63/cada)",
  },
  "10_modelos": {
    type: "models" as const,
    quantity: 10,
    price: 49.90,
    title: "Smart — 10 Modelos",
    description: "10 modelos virtuais para suas campanhas (R$ 4,99/cada)",
  },
  "25_modelos": {
    type: "models" as const,
    quantity: 25,
    price: 99.90,
    title: "Volume — 25 Modelos",
    description: "25 modelos virtuais para suas campanhas (R$ 4,00/cada)",
  },
} as const;

// Trial pago saiu — agora o trial é o mini-trial gratuito (1 campanha,
// 1 foto), gerenciado pelos endpoints `/api/credits/{claim,}-mini-trial`.
// Ver `components/ClaimMiniTrialBanner.tsx`.

// ═══════════════════════════════════════════════════════════
// ALL CREDIT PACKAGES (unified map for API)
// ═══════════════════════════════════════════════════════════

export const ALL_CREDIT_PACKAGES = {
  ...Object.fromEntries(
    Object.entries(CREDIT_PACKAGES_CAMPAIGNS).map(([k, v]) => [k, { ...v, trial: false, bonusModels: 0 }])
  ),
  ...Object.fromEntries(
    Object.entries(CREDIT_PACKAGES_MODELS).map(([k, v]) => [k, { ...v, trial: false, bonusModels: 0 }])
  ),
} as const;

export type CreditPackageId = keyof typeof ALL_CREDIT_PACKAGES;
