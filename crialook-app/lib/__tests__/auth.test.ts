/**
 * auth.test.ts — unit coverage for jwtCache TTL semantics + clearAuthTokenCache.
 *
 * Why this matters: the 30s in-memory JWT cache (lib/auth.tsx:117-135) is a
 * critical perf optimization AND a security boundary — too long a TTL means
 * server-side session invalidations are missed; too short means we hammer
 * Clerk's API. A silent regression here is invisible until it bites.
 *
 * Mocks:
 *   - @clerk/clerk-expo: getClerkInstance returns a controlled session.getToken vi.fn()
 *     (auth.tsx uses the non-hook accessor `getClerkInstance().session?.getToken()`,
 *     not useAuth() — confirmed at lib/auth.tsx:126-127).
 *   - expo-secure-store, react-native, etc are already stubbed in vitest.setup.ts.
 *
 * Real:
 *   - lib/auth.tsx getAuthToken + clearAuthTokenCache + getCurrentUserId.
 *   - vi.useFakeTimers() so TTL expiry is deterministic.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const getTokenMock: ReturnType<typeof vi.fn<() => Promise<string | null>>> = vi.fn();
const userIdRef: { value: string | null } = { value: 'user_test_id' };

vi.mock('@clerk/clerk-expo', () => ({
  // ClerkProvider/useAuth/useUser are React-tree pieces we don't exercise
  // here — keep stubs so the module loads.
  ClerkProvider: ({ children }: { children: unknown }) => children,
  useAuth: () => ({ isLoaded: true, isSignedIn: true, signOut: vi.fn() }),
  useUser: () => ({ user: { id: userIdRef.value } }),
  // The non-hook accessor used by lib/auth.tsx getAuthToken + getCurrentUserId.
  getClerkInstance: () => ({
    session: { getToken: getTokenMock },
    user: userIdRef.value ? { id: userIdRef.value } : null,
  }),
}));

// vitest.setup.ts globally stubs @/lib/auth to only export getAuthToken
// (so tests for unrelated modules don't drag the Clerk SDK in). Override
// here with importOriginal so we exercise the REAL getAuthToken / cache
// helpers — the @clerk/clerk-expo mock above is what controls behavior.
vi.mock('@/lib/auth', async () => {
  const actual = await vi.importActual<typeof import('@/lib/auth')>('@/lib/auth');
  return actual;
});

import { getAuthToken, clearAuthTokenCache, getCurrentUserId } from '@/lib/auth';

const FAKE_JWT_1 = 'eyJhbGciOiJIUzI1NiJ9.fake1.fakeSig1';
const FAKE_JWT_2 = 'eyJhbGciOiJIUzI1NiJ9.fake2.fakeSig2';

// Mirror the constant from lib/auth.tsx — kept literal here so a refactor
// that changes the value forces a test update.
const TOKEN_TTL_MS = 30_000;

beforeEach(() => {
  getTokenMock.mockReset();
  clearAuthTokenCache();
  userIdRef.value = 'user_test_id';
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('auth — jwtCache TTL semantics', () => {
  it('returns the cached JWT on the second call within TTL without calling Clerk getToken again', async () => {
    getTokenMock.mockResolvedValueOnce(FAKE_JWT_1);

    const first = await getAuthToken();
    expect(first).toBe(FAKE_JWT_1);
    expect(getTokenMock).toHaveBeenCalledTimes(1);

    // Advance clock by less than TTL — cache should still be hot.
    vi.advanceTimersByTime(TOKEN_TTL_MS - 1);

    const second = await getAuthToken();
    expect(second).toBe(FAKE_JWT_1);
    expect(getTokenMock).toHaveBeenCalledTimes(1); // STILL 1 — cache hit
  });

  it('refetches from Clerk after TTL expiry', async () => {
    getTokenMock
      .mockResolvedValueOnce(FAKE_JWT_1)
      .mockResolvedValueOnce(FAKE_JWT_2);

    await getAuthToken();
    expect(getTokenMock).toHaveBeenCalledTimes(1);

    // Advance past TTL — cache should be stale.
    vi.advanceTimersByTime(TOKEN_TTL_MS + 1);

    const second = await getAuthToken();
    expect(second).toBe(FAKE_JWT_2);
    expect(getTokenMock).toHaveBeenCalledTimes(2);
  });

  it('clearAuthTokenCache forces refetch on next call (signOut path)', async () => {
    getTokenMock
      .mockResolvedValueOnce(FAKE_JWT_1)
      .mockResolvedValueOnce(FAKE_JWT_2);

    await getAuthToken();
    expect(getTokenMock).toHaveBeenCalledTimes(1);

    clearAuthTokenCache();

    const second = await getAuthToken();
    expect(second).toBe(FAKE_JWT_2);
    expect(getTokenMock).toHaveBeenCalledTimes(2);
  });

  it('returns null when Clerk getToken returns null (signed out / no session)', async () => {
    getTokenMock.mockResolvedValueOnce(null);

    const result = await getAuthToken();
    expect(result).toBeNull();
  });

  it('does not cache a null result (so signing in immediately after signing out fetches a fresh token)', async () => {
    getTokenMock
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(FAKE_JWT_1);

    const first = await getAuthToken();
    expect(first).toBeNull();

    // No clearAuthTokenCache; just call again — null was not cached.
    const second = await getAuthToken();
    expect(second).toBe(FAKE_JWT_1);
    expect(getTokenMock).toHaveBeenCalledTimes(2);
  });

  it('returns null when Clerk getToken throws (network error / SDK not initialized)', async () => {
    getTokenMock.mockRejectedValueOnce(new Error('network down'));

    const result = await getAuthToken();
    expect(result).toBeNull();
    // The next call should attempt again — failure was not cached.
    getTokenMock.mockResolvedValueOnce(FAKE_JWT_1);
    const second = await getAuthToken();
    expect(second).toBe(FAKE_JWT_1);
  });
});

describe('auth — getCurrentUserId (used by lib/billing.ts hash binding)', () => {
  it('returns the Clerk user.id when a session is hydrated', () => {
    userIdRef.value = 'user_abc123';
    expect(getCurrentUserId()).toBe('user_abc123');
  });

  it('returns null when no session', () => {
    userIdRef.value = null;
    expect(getCurrentUserId()).toBeNull();
  });
});
