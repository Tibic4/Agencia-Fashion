/* PLANS — fonte de verdade dos planos pagos.
 *
 * Features são strings KEY + vars opcionais (não literais), pra que `plano.tsx`
 * resolva via `t(key, vars)` no render. Antes ficavam hardcoded em PT-BR e
 * mostravam "15 campanhas/mês" mesmo no app em EN. */

export interface PlanFeature {
  /** Chave em `i18n/strings.ts > features.*` */
  key:
    | 'campaignsPerMonth'
    | 'virtualModels'
    | 'virtualTryOn'
    | 'captionsAi'
    | 'smartBackground'
    | 'supportWhatsapp'
    | 'supportVip'
    | 'priorityHigh'
    | 'priorityMax';
  /** Vars de interpolação (ex: { n: 15 } pra "15 campanhas/mês"). */
  vars?: Record<string, string | number>;
}

export const PLANS = {
  essencial: {
    id: "essencial",
    name: "Essencial",
    price: 179.0,
    campaigns_per_month: 15,
    models: 5,
    features: [
      { key: 'campaignsPerMonth', vars: { n: 15 } },
      { key: 'virtualModels', vars: { n: 5 } },
      { key: 'virtualTryOn' },
      { key: 'captionsAi' },
      { key: 'smartBackground' },
      { key: 'supportWhatsapp' },
    ] satisfies PlanFeature[],
  },
  pro: {
    id: "pro",
    name: "Pro",
    price: 359.0,
    campaigns_per_month: 40,
    models: 15,
    features: [
      { key: 'campaignsPerMonth', vars: { n: 40 } },
      { key: 'virtualModels', vars: { n: 15 } },
      { key: 'virtualTryOn' },
      { key: 'captionsAi' },
      { key: 'priorityHigh' },
      { key: 'smartBackground' },
      { key: 'supportWhatsapp' },
    ] satisfies PlanFeature[],
  },
  business: {
    id: "business",
    name: "Business",
    price: 749.0,
    campaigns_per_month: 100,
    models: 40,
    features: [
      { key: 'campaignsPerMonth', vars: { n: 100 } },
      { key: 'virtualModels', vars: { n: 40 } },
      { key: 'virtualTryOn' },
      { key: 'captionsAi' },
      { key: 'priorityMax' },
      { key: 'smartBackground' },
      { key: 'supportVip' },
    ] satisfies PlanFeature[],
  },
} as const;

export type PlanId = keyof typeof PLANS;
