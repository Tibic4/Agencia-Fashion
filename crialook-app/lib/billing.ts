import { Platform } from 'react-native';
import {
  initConnection,
  endConnection,
  getSubscriptions,
  requestSubscription,
  finishTransaction,
  getAvailablePurchases,
  purchaseErrorListener,
  purchaseUpdatedListener,
  type Subscription,
  type SubscriptionPurchase,
} from 'react-native-iap';
import { apiPost } from './api';
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
  if (Platform.OS !== 'android') return;
  if (connected) return;
  await initConnection();
  connected = true;

  purchaseUpdatedSub = purchaseUpdatedListener(async (purchase: SubscriptionPurchase) => {
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
    /* swallow — user cancellations and Play errors are surfaced by requestSubscription */
  });
}

export async function shutdownBilling() {
  if (Platform.OS !== 'android') return;
  purchaseUpdatedSub?.remove();
  purchaseErrorSub?.remove();
  purchaseUpdatedSub = null;
  purchaseErrorSub = null;
  if (connected) {
    await endConnection();
    connected = false;
  }
}

export async function loadSubscriptionOfferings(): Promise<Subscription[]> {
  await initBilling();
  return await getSubscriptions({ skus: [...SUBSCRIPTION_SKUS] });
}

export interface VerifiedSubscription {
  plan: SubscriptionSku;
  expiresAt: string;
}

export async function purchaseSubscription(sku: SubscriptionSku): Promise<VerifiedSubscription> {
  return withSpan(`billing.purchase:${sku}`, 'billing.purchase', async () => {
    await initBilling();
    const purchase = await requestSubscription({ sku });
    const target = Array.isArray(purchase) ? purchase[0] : purchase;
    if (!target?.purchaseToken) {
      throw new ApiError('Purchase token missing', 0, 'UNKNOWN');
    }

    const verified = await apiPost<VerifiedSubscription>('/billing/verify', {
      sku,
      purchaseToken: target.purchaseToken,
    });

    await finishTransaction({ purchase: target as SubscriptionPurchase, isConsumable: false });
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
