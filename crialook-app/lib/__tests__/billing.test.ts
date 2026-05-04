/**
 * billing.test.ts — unit coverage for the obfuscatedAccountIdAndroid hash
 * binding (compensating control #3 per CLERK_TRUST_COMPENSATING_CONTROLS.md).
 *
 * Why this matters: backend MUST validate that the obfuscatedExternalAccountId
 * coming back from Google Play === SHA256(currentClerkUserId).slice(0,64).
 * If the mobile half regresses (hash truncation off by one, hash omitted on
 * refactor, hash computed from wrong field) the binding silently breaks and
 * a captured purchaseToken becomes replay-able by another user.
 *
 * Mocks:
 *   - react-native-iap: requestPurchase + fetchProducts + initConnection +
 *     listeners — all vi.fn() so we can read args + control responses.
 *   - @/lib/auth: getCurrentUserId vi.fn() controlled per test (the global
 *     setup only stubs getAuthToken, we extend it here for getCurrentUserId).
 *   - @/lib/api: apiPost overridden via __apiFn (set by vitest.setup).
 *   - expo-crypto: real digestStringAsync impl using node:crypto so the hash
 *     math is honestly verified, not mock-checked.
 *
 * Real:
 *   - lib/billing.ts purchaseSubscription end-to-end except the IAP/HTTP
 *     boundaries.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';

// ── react-native-iap mock ────────────────────────────────────────────────
const requestPurchaseMock = vi.fn();
const fetchProductsMock = vi.fn();
const finishTransactionMock = vi.fn();
const initConnectionMock = vi.fn();

vi.mock('react-native-iap', () => ({
  initConnection: (...args: unknown[]) => initConnectionMock(...args),
  endConnection: vi.fn(),
  fetchProducts: (...args: unknown[]) => fetchProductsMock(...args),
  requestPurchase: (...args: unknown[]) => requestPurchaseMock(...args),
  finishTransaction: (...args: unknown[]) => finishTransactionMock(...args),
  getAvailablePurchases: vi.fn().mockResolvedValue([]),
  purchaseErrorListener: vi.fn(() => ({ remove: vi.fn() })),
  purchaseUpdatedListener: vi.fn(() => ({ remove: vi.fn() })),
}));

// ── @/lib/auth — extend the global stub with getCurrentUserId ───────────
const getCurrentUserIdMock: ReturnType<typeof vi.fn<() => string | null>> = vi.fn();
vi.mock('@/lib/auth', () => ({
  getAuthToken: async () => 'test-token',
  getCurrentUserId: () => getCurrentUserIdMock(),
}));

// ── expo-crypto — real SHA-256 via node:crypto ──────────────────────────
vi.mock('expo-crypto', () => ({
  CryptoDigestAlgorithm: { SHA256: 'SHA256' },
  CryptoEncoding: { HEX: 'hex' },
  digestStringAsync: async (_algo: string, data: string) =>
    createHash('sha256').update(data).digest('hex'),
}));

// EXPO_OS must be 'android' so initBilling proceeds (lib/billing.ts:33 short-circuits otherwise).
process.env.EXPO_OS = 'android';

// Import AFTER mocks are registered.
import { purchaseSubscription, type SubscriptionSku } from '@/lib/billing';

// vitest.setup.ts exposes the apiPost mock as globalThis.__apiFn — grab it.
const apiPostMock = (globalThis as { __apiFn?: ReturnType<typeof vi.fn> }).__apiFn!;

const SKU: SubscriptionSku = 'pro_mensal';
const OFFER_TOKEN = 'offer_token_test_123';

beforeEach(() => {
  requestPurchaseMock.mockReset();
  fetchProductsMock.mockReset();
  finishTransactionMock.mockReset();
  initConnectionMock.mockReset();
  getCurrentUserIdMock.mockReset();
  apiPostMock.mockReset();

  // Default happy-path responses — tests can override.
  initConnectionMock.mockResolvedValue(undefined);
  fetchProductsMock.mockResolvedValue([
    {
      id: SKU,
      subscriptionOfferDetailsAndroid: [{ offerToken: OFFER_TOKEN }],
    },
  ]);
  requestPurchaseMock.mockResolvedValue({ purchaseToken: 'tok_test_abc' });
  finishTransactionMock.mockResolvedValue(undefined);
  apiPostMock.mockResolvedValue({ plan: SKU, expiresAt: '2099-01-01T00:00:00Z' });
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('billing — obfuscatedAccountIdAndroid hash binding (control #3)', () => {
  it('passes obfuscatedAccountIdAndroid = SHA256(userId).slice(0,64) under request.google when signed in', async () => {
    const userId = 'user_2abc123def456';
    const expectedHash = createHash('sha256').update(userId).digest('hex').slice(0, 64);
    getCurrentUserIdMock.mockReturnValue(userId);

    await purchaseSubscription(SKU);

    expect(requestPurchaseMock).toHaveBeenCalledTimes(1);
    const callArgs = requestPurchaseMock.mock.calls[0][0] as {
      type: string;
      request: { google: { obfuscatedAccountIdAndroid?: string } };
    };
    expect(callArgs.request.google.obfuscatedAccountIdAndroid).toBe(expectedHash);
    expect(callArgs.request.google.obfuscatedAccountIdAndroid).toHaveLength(64);
  });

  it('omits obfuscatedAccountIdAndroid entirely when getCurrentUserId returns null', async () => {
    getCurrentUserIdMock.mockReturnValue(null);

    await purchaseSubscription(SKU);

    expect(requestPurchaseMock).toHaveBeenCalledTimes(1);
    const callArgs = requestPurchaseMock.mock.calls[0][0] as {
      request: { google: Record<string, unknown> };
    };
    // Per the conditional spread `...(obfuscatedAccountIdAndroid ? {...} : {})`,
    // the key MUST be absent — not set to undefined or null.
    expect(callArgs.request.google).not.toHaveProperty('obfuscatedAccountIdAndroid');
  });

  it('produces a deterministic hash for the same userId across calls', async () => {
    const userId = 'user_2abc123def456';
    getCurrentUserIdMock.mockReturnValue(userId);

    await purchaseSubscription(SKU);
    await purchaseSubscription(SKU);

    const firstHash = (requestPurchaseMock.mock.calls[0][0] as {
      request: { google: { obfuscatedAccountIdAndroid?: string } };
    }).request.google.obfuscatedAccountIdAndroid;
    const secondHash = (requestPurchaseMock.mock.calls[1][0] as {
      request: { google: { obfuscatedAccountIdAndroid?: string } };
    }).request.google.obfuscatedAccountIdAndroid;
    expect(firstHash).toBe(secondHash);
    expect(firstHash).toHaveLength(64);
  });

  it('hash is not the userId itself (basic non-leak sanity)', async () => {
    const userId = 'user_2abc123def456';
    getCurrentUserIdMock.mockReturnValue(userId);

    await purchaseSubscription(SKU);

    const hash = (requestPurchaseMock.mock.calls[0][0] as {
      request: { google: { obfuscatedAccountIdAndroid?: string } };
    }).request.google.obfuscatedAccountIdAndroid;
    expect(hash).not.toContain(userId);
    expect(hash).not.toBe(userId);
    // Also: must be hex chars only.
    expect(hash).toMatch(/^[0-9a-f]+$/);
  });

  it('hash differs across different userIds', async () => {
    getCurrentUserIdMock.mockReturnValue('user_aaa');
    await purchaseSubscription(SKU);
    const hashA = (requestPurchaseMock.mock.calls[0][0] as {
      request: { google: { obfuscatedAccountIdAndroid?: string } };
    }).request.google.obfuscatedAccountIdAndroid;

    requestPurchaseMock.mockClear();
    getCurrentUserIdMock.mockReturnValue('user_bbb');
    await purchaseSubscription(SKU);
    const hashB = (requestPurchaseMock.mock.calls[0][0] as {
      request: { google: { obfuscatedAccountIdAndroid?: string } };
    }).request.google.obfuscatedAccountIdAndroid;

    expect(hashA).not.toBe(hashB);
  });

  it('forwards sku + purchaseToken to /billing/verify after the purchase resolves', async () => {
    getCurrentUserIdMock.mockReturnValue('user_xyz');

    await purchaseSubscription(SKU);

    // First arg of apiPost is the path; second is the body.
    expect(apiPostMock).toHaveBeenCalledWith('/billing/verify', {
      sku: SKU,
      purchaseToken: 'tok_test_abc',
    });
  });
});
