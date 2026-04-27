/**
 * Google Play Developer API client (subscriptions).
 *
 * Placeholder enquanto a service account não está configurada.
 *
 * O que falta para virar funcional:
 *  1. GCP project com `androidpublisher.googleapis.com` habilitada
 *  2. Service account com role `Service Account User` + acesso linked
 *     no Play Console (API access > Link service account)
 *  3. Service account JSON key salvo em uma das duas formas:
 *     a) Arquivo: `play-store-key.json` no root do projeto + caminho em
 *        `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON_PATH`
 *     b) Inline: conteúdo do JSON colado em
 *        `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON` (recomendado para Vercel/VPS
 *        sem filesystem persistente — basta env var)
 *  4. `GOOGLE_PLAY_PACKAGE_NAME=com.crialook.app`
 *
 * Quando estes 4 estiverem prontos, implementar:
 *  - getAccessToken() — assina JWT, troca por OAuth2 token (cache 50min)
 *  - verifySubscription(sku, token) — GET .../subscriptions/{sku}/tokens/{token}
 *  - acknowledgeSubscription(sku, token) — POST .../acknowledge
 *  - cancelSubscription(sku, token) — POST .../cancel (usado em DELETE /me)
 *
 * Por que não implementar agora?
 *   Sem as 4 envs acima, o código não tem como ser exercitado nem testado.
 *   Pior: um stub que silenciosamente "valida" qualquer token vai aprovar
 *   compras fake no MVP. É mais seguro retornar 503 explicitamente.
 */

export const PACKAGE_NAME = process.env.GOOGLE_PLAY_PACKAGE_NAME ?? "com.crialook.app";

/**
 * Detecta se o ambiente está pronto para validar compras.
 * Quando false, os endpoints /billing/* retornam 503 com mensagem clara.
 */
export function isGooglePlayConfigured(): boolean {
  const hasInline = Boolean(process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON);
  const hasFile = Boolean(process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON_PATH);
  return Boolean(process.env.GOOGLE_PLAY_PACKAGE_NAME) && (hasInline || hasFile);
}

/**
 * Lista de SKUs aceitos. Mantido em sincronia com o app mobile
 * (`crialook-app/lib/billing.ts:SUBSCRIPTION_SKUS`).
 *
 * Por que não importar do mobile? Esses são repos separados — duplicar
 * é mais barato que criar package compartilhado para 3 strings que
 * praticamente nunca mudam.
 */
export const VALID_SKUS = [
  "essencial_mensal",
  "pro_mensal",
  "business_mensal",
] as const;

export type ValidSku = (typeof VALID_SKUS)[number];

export function isValidSku(sku: unknown): sku is ValidSku {
  return typeof sku === "string" && (VALID_SKUS as readonly string[]).includes(sku);
}

/**
 * Mapeia SKU → nome interno do plano usado em `stores.plan`.
 * Mantém compatibilidade com `getModelLimitForPlan` e similares.
 */
export function planFromSku(sku: ValidSku): "essencial" | "pro" | "business" {
  if (sku === "essencial_mensal") return "essencial";
  if (sku === "pro_mensal") return "pro";
  return "business";
}

// ─────────────────────────────────────────────────────────────────────
// Stubs — todos lançam para forçar tratamento explícito no caller.
// Quando a service account chegar, substituir por chamadas reais à
// `androidpublisher_v3` (lib `googleapis`).
// ─────────────────────────────────────────────────────────────────────

export class GooglePlayNotConfiguredError extends Error {
  constructor() {
    super(
      "Google Play API not configured. Set GOOGLE_PLAY_PACKAGE_NAME and GOOGLE_PLAY_SERVICE_ACCOUNT_JSON{,_PATH}.",
    );
    this.name = "GooglePlayNotConfiguredError";
  }
}

export interface PlaySubscriptionStatus {
  /** 1 = received, 0 = pending */
  paymentState: number | null;
  /** ms epoch as string (Play returns string) */
  expiryTimeMillis: string;
  autoRenewing: boolean;
  /** Set when this purchase was an upgrade/downgrade — old token */
  linkedPurchaseToken?: string;
  /** 0 = ACK pending, 1 = acknowledged */
  acknowledgementState: number;
}

export async function verifySubscription(
  _sku: ValidSku,
  _purchaseToken: string,
): Promise<PlaySubscriptionStatus> {
  throw new GooglePlayNotConfiguredError();
}

export async function acknowledgeSubscription(
  _sku: ValidSku,
  _purchaseToken: string,
): Promise<void> {
  throw new GooglePlayNotConfiguredError();
}

export async function cancelSubscription(
  _sku: ValidSku,
  _purchaseToken: string,
): Promise<void> {
  throw new GooglePlayNotConfiguredError();
}
