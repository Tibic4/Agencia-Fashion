import * as Crypto from 'expo-crypto';
import {
  initConnection,
  endConnection,
  fetchProducts,
  requestPurchase,
  finishTransaction,
  getAvailablePurchases,
  purchaseErrorListener,
  purchaseUpdatedListener,
  type ProductSubscription,
  type ProductSubscriptionAndroid,
  type Purchase,
} from 'react-native-iap';
import { apiPost } from './api';
import { getCurrentUserId } from './auth';
import { withSpan } from './sentry';
import { ApiError } from '@/types';

export const SUBSCRIPTION_SKUS = [
  'essencial_mensal',
  'pro_mensal',
  'business_mensal',
] as const;

export type SubscriptionSku = typeof SUBSCRIPTION_SKUS[number];

let connected = false;
let purchaseUpdatedSub: { remove: () => void } | null = null;
let purchaseErrorSub: { remove: () => void } | null = null;

export async function initBilling() {
  if (process.env.EXPO_OS !== 'android') return;
  if (connected) return;
  await initConnection();
  connected = true;

  purchaseUpdatedSub = purchaseUpdatedListener(async (purchase: Purchase) => {
    try {
      if (!purchase.purchaseToken || !purchase.productId) return;
      await apiPost('/billing/verify', {
        sku: purchase.productId,
        purchaseToken: purchase.purchaseToken,
      });
      await finishTransaction({ purchase, isConsumable: false });
    } catch {
      /* server may have already acknowledged; safe to ignore */
    }
  });

  purchaseErrorSub = purchaseErrorListener(() => {
    /* swallow — user cancellations and Play errors are surfaced by requestPurchase */
  });
}

export async function shutdownBilling() {
  if (process.env.EXPO_OS !== 'android') return;
  purchaseUpdatedSub?.remove();
  purchaseErrorSub?.remove();
  purchaseUpdatedSub = null;
  purchaseErrorSub = null;
  if (connected) {
    await endConnection();
    connected = false;
  }
}

export async function loadSubscriptionOfferings(): Promise<ProductSubscription[]> {
  await initBilling();
  const result = await fetchProducts({ skus: [...SUBSCRIPTION_SKUS], type: 'subs' });
  return (result ?? []) as ProductSubscription[];
}

export interface VerifiedSubscription {
  plan: SubscriptionSku;
  expiresAt: string;
}

/** Hash determinístico do Clerk user.id pra Google Play (constraint: max 64
 *  chars, charset alfanumérico). Sem isso o backend não consegue verificar
 *  no `/billing/verify` se o `purchaseToken` pertence à sessão do usuário. */
async function hashUserIdForBilling(userId: string): Promise<string> {
  const digest = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    userId,
    { encoding: Crypto.CryptoEncoding.HEX },
  );
  return digest.slice(0, 64);
}

export async function purchaseSubscription(sku: SubscriptionSku): Promise<VerifiedSubscription> {
  return withSpan(`billing.purchase:${sku}`, 'billing.purchase', async () => {
    await initBilling();

    const offeringsRaw = await fetchProducts({ skus: [sku], type: 'subs' });
    const offerings = (offeringsRaw ?? []) as ProductSubscription[];
    const offer = offerings.find(o => o.id === sku) as
      | ProductSubscriptionAndroid
      | undefined;
    const offerToken = offer?.subscriptionOfferDetailsAndroid?.[0]?.offerToken;
    if (!offerToken) {
      throw new ApiError('Subscription offer not available', 0, 'UNKNOWN');
    }

    // Vincula a compra ao userId Clerk via obfuscatedAccountIdAndroid. Sem
    // isso, um purchaseToken capturado pode ser reenviado por outro usuário
    // pra ativar plano gratuitamente. Backend deve checar que o
    // obfuscatedAccountId do purchase Google === hash(currentUserId).
    const userId = getCurrentUserId();
    const obfuscatedAccountIdAndroid = userId ? await hashUserIdForBilling(userId) : undefined;

    const result = await requestPurchase({
      type: 'subs',
      request: {
        google: {
          skus: [sku],
          subscriptionOffers: [{ sku, offerToken }],
          ...(obfuscatedAccountIdAndroid ? { obfuscatedAccountIdAndroid } : {}),
        },
      },
    });

    const target = Array.isArray(result) ? result[0] : result;
    if (!target?.purchaseToken) {
      throw new ApiError('Purchase token missing', 0, 'UNKNOWN');
    }

    const verified = await apiPost<VerifiedSubscription>('/billing/verify', {
      sku,
      purchaseToken: target.purchaseToken,
    });

    await finishTransaction({ purchase: target, isConsumable: false });
    return verified;
  });
}

export async function restorePurchases(): Promise<{ restored: number }> {
  return withSpan('billing.restore', 'billing.restore', async () => {
    await initBilling();
    const purchases = await getAvailablePurchases();
    const subs = purchases.filter(p =>
      SUBSCRIPTION_SKUS.includes(p.productId as SubscriptionSku),
    );
    if (subs.length === 0) return { restored: 0 };

    const res = await apiPost<{ restored: number }>('/billing/restore', {
      purchases: subs.map(p => ({ sku: p.productId, token: p.purchaseToken })),
    });
    return res;
  });
}

export function isUserCancelledError(e: unknown): boolean {
  const code = (e as { code?: string })?.code;
  return code === 'E_USER_CANCELLED' || code === 'E_USER_ERROR';
}
