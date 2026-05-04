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
  /**
   * Obfuscated external account id passed by the client at purchase time
   * (`obfuscatedAccountIdAndroid` in react-native-iap's
   * `requestPurchase.google` payload). Backend must verify this matches
   * SHA256(currentClerkUserId).slice(0,64) so that a captured purchaseToken
   * cannot be replayed by a different user. See `crialook-app/lib/billing.ts`
   * `hashUserIdForBilling` for the mobile producer.
   *
   * In Play Developer API v3 this is exposed as
   * `obfuscatedExternalAccountId` on the SubscriptionPurchase response.
   */
  obfuscatedExternalAccountId?: string;
}

// ─────────────────────────────────────────────────────────────────────
// Implementação Google Play Developer API v3 (purchases.subscriptions)
// ─────────────────────────────────────────────────────────────────────
// O fluxo OAuth2 com Service Account funciona assim:
//   1. Carregamos o JSON da SA (file ou inline) e extraímos o private_key
//      (RSA PEM) e o client_email.
//   2. Assinamos um JWT RS256 com claim `iss=client_email`,
//      `aud=https://oauth2.googleapis.com/token`,
//      `scope=https://www.googleapis.com/auth/androidpublisher`,
//      `iat=now`, `exp=now+1h`.
//   3. Trocamos esse JWT por um access_token no endpoint OAuth2 do Google.
//   4. Cacheamos o access_token (TTL ~55min) e usamos pra chamar a Play
//      Developer API. JWT lib (jose) já é dep do projeto pro RTDN.
//
// Endpoints v3 que usamos:
//   GET ...purchases/subscriptions/{sku}/tokens/{token}           → status
//   POST ...purchases/subscriptions/{sku}/tokens/{token}:acknowledge
//   POST ...purchases/subscriptions/{sku}/tokens/{token}:cancel
//
// Refs: https://developers.google.com/android-publisher/api-ref/rest

import { readFileSync } from "node:fs";
import { SignJWT, importPKCS8 } from "jose";

interface ServiceAccountKey {
  client_email: string;
  private_key: string;
  token_uri?: string;
}

function loadServiceAccountKey(): ServiceAccountKey {
  const inline = process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON;
  const path = process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON_PATH;
  let raw: string | null = null;
  if (inline) raw = inline;
  else if (path) raw = readFileSync(path, "utf-8");
  if (!raw) throw new GooglePlayNotConfiguredError();
  const parsed = JSON.parse(raw) as ServiceAccountKey;
  if (!parsed.client_email || !parsed.private_key) {
    throw new GooglePlayNotConfiguredError();
  }
  return parsed;
}

interface CachedToken {
  token: string;
  /** epoch ms quando o token vira expirado pro cache (5min antes do real). */
  expiresAt: number;
}
let tokenCache: CachedToken | null = null;
const TOKEN_TTL_MS = 55 * 60 * 1000; // 55min — Google emite com 1h

async function getAccessToken(): Promise<string> {
  if (tokenCache && tokenCache.expiresAt > Date.now()) {
    return tokenCache.token;
  }

  const sa = loadServiceAccountKey();
  const tokenUri = sa.token_uri ?? "https://oauth2.googleapis.com/token";

  const privateKey = await importPKCS8(sa.private_key, "RS256");
  const now = Math.floor(Date.now() / 1000);
  const jwt = await new SignJWT({
    scope: "https://www.googleapis.com/auth/androidpublisher",
  })
    .setProtectedHeader({ alg: "RS256", typ: "JWT" })
    .setIssuer(sa.client_email)
    .setSubject(sa.client_email)
    .setAudience(tokenUri)
    .setIssuedAt(now)
    .setExpirationTime(now + 3600)
    .sign(privateKey);

  const body = new URLSearchParams({
    grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
    assertion: jwt,
  });

  const res = await fetch(tokenUri, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Google OAuth2 token exchange failed: ${res.status} ${text}`);
  }
  const data = (await res.json()) as { access_token: string; expires_in: number };
  tokenCache = {
    token: data.access_token,
    expiresAt: Date.now() + Math.min(data.expires_in * 1000 - 60_000, TOKEN_TTL_MS),
  };
  return data.access_token;
}

function playApiUrl(sku: ValidSku, token: string, action?: "acknowledge" | "cancel"): string {
  const base = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${PACKAGE_NAME}/purchases/subscriptions/${encodeURIComponent(sku)}/tokens/${encodeURIComponent(token)}`;
  return action ? `${base}:${action}` : base;
}

export async function verifySubscription(
  sku: ValidSku,
  purchaseToken: string,
): Promise<PlaySubscriptionStatus> {
  const accessToken = await getAccessToken();
  const res = await fetch(playApiUrl(sku, purchaseToken), {
    headers: { authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Play API verify failed: ${res.status} ${text}`);
  }
  // Resposta v3 (purchases.subscriptions.get):
  //   { expiryTimeMillis, paymentState, autoRenewing, acknowledgementState,
  //     linkedPurchaseToken, ... }
  const raw = (await res.json()) as Record<string, unknown>;
  return {
    paymentState: typeof raw.paymentState === "number" ? raw.paymentState : null,
    expiryTimeMillis: String(raw.expiryTimeMillis ?? "0"),
    autoRenewing: Boolean(raw.autoRenewing),
    linkedPurchaseToken:
      typeof raw.linkedPurchaseToken === "string" ? raw.linkedPurchaseToken : undefined,
    acknowledgementState:
      typeof raw.acknowledgementState === "number" ? raw.acknowledgementState : 0,
    obfuscatedExternalAccountId:
      typeof raw.obfuscatedExternalAccountId === "string"
        ? raw.obfuscatedExternalAccountId
        : undefined,
  };
}

export async function acknowledgeSubscription(
  sku: ValidSku,
  purchaseToken: string,
): Promise<void> {
  const accessToken = await getAccessToken();
  const res = await fetch(playApiUrl(sku, purchaseToken, "acknowledge"), {
    method: "POST",
    headers: {
      authorization: `Bearer ${accessToken}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({}),
  });
  // 200 ou 204 são sucesso. 410 = "already acknowledged" (idempotente, não erra).
  if (res.ok || res.status === 410) return;
  const text = await res.text().catch(() => "");
  throw new Error(`Play API acknowledge failed: ${res.status} ${text}`);
}

export async function cancelSubscription(
  sku: ValidSku,
  purchaseToken: string,
): Promise<void> {
  const accessToken = await getAccessToken();
  const res = await fetch(playApiUrl(sku, purchaseToken, "cancel"), {
    method: "POST",
    headers: {
      authorization: `Bearer ${accessToken}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({}),
  });
  if (res.ok || res.status === 410) return;
  const text = await res.text().catch(() => "");
  throw new Error(`Play API cancel failed: ${res.status} ${text}`);
}
