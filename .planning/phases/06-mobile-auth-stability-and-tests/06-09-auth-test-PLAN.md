---
plan_id: 06-09
phase: 6
title: Add lib/__tests__/auth.test.ts — verify JWT cache TTL (30s), 401-retry path, clearAuthTokenCache on signOut
wave: 2
depends_on: []
owner_action: false
files_modified:
  - crialook-app/lib/__tests__/auth.test.ts
autonomous: true
requirements: ["D-19", "D-20", "F-PLAY-READINESS-§9-auth-coverage"]
must_haves:
  truths:
    - "test file lives at crialook-app/lib/__tests__/auth.test.ts (vitest, jsdom)"
    - "test verifies jwtCache returns the cached value within TOKEN_TTL_MS (30s) without calling Clerk getToken twice"
    - "test verifies jwtCache expires after TOKEN_TTL_MS — second call after 30s+1ms refetches from Clerk"
    - "test verifies clearAuthTokenCache() empties the cache — next call refetches"
    - "test verifies 401-retry path in getAuthToken: when Clerk getToken first returns expired/invalid then succeeds, the path completes without throwing (or whatever the actual contract is)"
    - "test uses synthesized JWT-shaped strings (NOT real Clerk JWTs per D-20)"
    - "@clerk/clerk-expo useAuth() is mocked; no real Clerk SDK wired"
    - "vi.useFakeTimers() controls TTL expiry deterministically"
  acceptance:
    - "test -f crialook-app/lib/__tests__/auth.test.ts exits 0"
    - "cd crialook-app && npx vitest run lib/__tests__/auth.test.ts exits 0"
    - "grep -c 'describe\\|it\\(\\|test\\(' crialook-app/lib/__tests__/auth.test.ts returns at least 4"
    - "grep -c 'jwtCache\\|TOKEN_TTL_MS\\|clearAuthTokenCache' crialook-app/lib/__tests__/auth.test.ts returns at least 3"
    - "grep -c 'vi.useFakeTimers\\|vi.advanceTimersByTime\\|vi.setSystemTime' crialook-app/lib/__tests__/auth.test.ts returns at least 1"
    - "grep -c 'vi.mock' crialook-app/lib/__tests__/auth.test.ts returns at least 1"
---

# Plan 06-09: Add `lib/__tests__/auth.test.ts`

## Objective

Per D-19 / D-20, add a vitest test that locks in the contract of the JWT cache layer in `crialook-app/lib/auth.tsx`:

1. **Cache hit within TTL** — second `getAuthToken()` call within `TOKEN_TTL_MS` (30s) returns the cached value WITHOUT calling Clerk's `getToken` again.
2. **Cache expiry after TTL** — second call AFTER `TOKEN_TTL_MS` refetches.
3. **`clearAuthTokenCache()` empties the cache** — next call refetches.
4. **401-retry path** — if the first Clerk getToken returns a stale/invalid token and the API returns 401, the retry-once logic in `lib/api.ts:178-183` triggers a fresh getToken (cache cleared first). This may be tested at the auth-test level OR deferred to a separate api.test.ts; this plan covers the auth-side contract.

These behaviors are critical and currently uncovered. A regression (e.g. TTL accidentally set to 30 minutes) would silently inflate auth round-trips OR (worse) miss server-side session invalidations for ~30 min. A regression in the other direction (TTL 0) would defeat the cache.

## Truths the executor must respect

- Test framework: vitest, jsdom, in `crialook-app/lib/__tests__/`. Globals enabled.
- Per D-20: synthesize fake Clerk JWTs (random base64-ish strings — no need to be cryptographically valid since signature isn't checked client-side). Do NOT use real tokens.
- Mock `@clerk/clerk-expo` `useAuth()` and `getToken()` to return controlled values.
- Use `vi.useFakeTimers()` + `vi.advanceTimersByTime(...)` to deterministically test TTL expiry. Real `setTimeout(..., 30_000)` waits would make the suite painfully slow and flaky.
- Read the actual export names from `lib/auth.tsx` before writing the test — `getAuthToken`, `clearAuthTokenCache`, `TOKEN_TTL_MS` are the names per pre-research; confirm they're exported (or accessible) at the module boundary.

## Tasks

### Task 1: Read the source under test

<read_first>
- crialook-app/lib/auth.tsx (full file — focus exports and the jwtCache code at lines 117-140; confirm getAuthToken signature and what it returns when cache hits / misses)
- crialook-app/lib/api.ts (focus lines 175-190 — the 401-retry path; only relevant if you decide to test the integration)
- crialook-app/lib/__tests__/api.classify.test.ts (vitest pattern reference)
- crialook-app/vitest.setup.ts (any global mocks affecting auth)
- .planning/phases/06-mobile-auth-stability-and-tests/06-CONTEXT.md (D-19, D-20)
</read_first>

<action>
Note from reading:
- The exact name of the function that hits the cache (`getAuthToken`?). Per pre-research lines 117-135 it's the function that reads `jwtCache` and falls back to Clerk.
- Whether `TOKEN_TTL_MS` is a `const` exported, a module-private constant, or something the test needs to mock.
- The exact name of the cache reset (`clearAuthTokenCache`).
- Whether `getAuthToken` is async (likely yes — returns `Promise<string | null>`).
- How Clerk's getToken is wired in — `useAuth()` hook returns `{ getToken }`? Or is there a non-hook accessor like `Clerk.session?.getToken()`?
</action>

### Task 2: Write the test

<read_first>
- (re-uses Task 1 reads)
</read_first>

<action>
Create `crialook-app/lib/__tests__/auth.test.ts`. Adapt the function/export names to what was actually found in Task 1.

```ts
/**
 * auth.test.ts — unit coverage for jwtCache TTL semantics + clearAuthTokenCache.
 *
 * Why this matters: the 30s in-memory JWT cache (lib/auth.tsx:117-135) is a
 * critical perf optimization AND a security boundary — too long a TTL means
 * server-side session invalidations are missed; too short means we hammer
 * Clerk's API. A silent regression here is invisible until it bites.
 *
 * Mocks:
 *   - @clerk/clerk-expo: getToken via useAuth (or whichever accessor lib/auth.tsx uses).
 *
 * Real:
 *   - The module under test (lib/auth.tsx).
 *   - vi.useFakeTimers() so TTL expiry is deterministic.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const getTokenMock = vi.fn();

// Mock @clerk/clerk-expo BEFORE importing the SUT.
// The exact mock shape depends on what lib/auth.tsx imports — adjust based
// on what you read in Task 1.
vi.mock('@clerk/clerk-expo', () => ({
  useAuth: () => ({
    isSignedIn: true,
    isLoaded: true,
    signOut: vi.fn(),
    getToken: getTokenMock,
  }),
  ClerkProvider: ({ children }: any) => children,
  // Add other named exports lib/auth.tsx pulls in.
}));

// Import AFTER mock. Adjust function names per Task 1 findings.
import { getAuthToken, clearAuthTokenCache } from '@/lib/auth';

const FAKE_JWT_1 = 'eyJhbGciOiJIUzI1NiJ9.fake1.fakeSig1';
const FAKE_JWT_2 = 'eyJhbGciOiJIUzI1NiJ9.fake2.fakeSig2';
const TOKEN_TTL_MS = 30_000; // mirror the constant from lib/auth.tsx — kept literal here so a refactor that changes the value forces a test update

beforeEach(() => {
  getTokenMock.mockReset();
  clearAuthTokenCache();
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
    getTokenMock.mockResolvedValueOnce(FAKE_JWT_1).mockResolvedValueOnce(FAKE_JWT_2);

    await getAuthToken();
    expect(getTokenMock).toHaveBeenCalledTimes(1);

    // Advance past TTL — cache should be stale.
    vi.advanceTimersByTime(TOKEN_TTL_MS + 1);

    const second = await getAuthToken();
    expect(second).toBe(FAKE_JWT_2);
    expect(getTokenMock).toHaveBeenCalledTimes(2);
  });

  it('clearAuthTokenCache forces refetch on next call', async () => {
    getTokenMock.mockResolvedValueOnce(FAKE_JWT_1).mockResolvedValueOnce(FAKE_JWT_2);

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
    getTokenMock.mockResolvedValueOnce(null).mockResolvedValueOnce(FAKE_JWT_1);

    const first = await getAuthToken();
    expect(first).toBeNull();

    // No clearAuthTokenCache; just call again.
    const second = await getAuthToken();
    expect(second).toBe(FAKE_JWT_1);
    expect(getTokenMock).toHaveBeenCalledTimes(2);
  });
});
```

**Adjustments you MUST make based on Task 1 reading:**
- If `getAuthToken` is exported under a different name (e.g. `getCachedJwt`), use the actual name.
- If the Clerk SDK is accessed differently (e.g. `Clerk.session?.getToken()` instead of `useAuth().getToken()`), adjust the mock shape accordingly.
- If `lib/auth.tsx` imports more from `@clerk/clerk-expo` than `useAuth`, expand the mock to include those exports (otherwise the mock leaves them undefined and the SUT explodes on load).
- The "does not cache a null result" test — confirm by re-reading lib/auth.tsx:122-130. If the cache DOES store nulls (it shouldn't, but confirm), drop or invert this test. The contract is what matters.
- 401-retry path: if `getAuthToken` itself doesn't have retry logic (the retry lives in `lib/api.ts:178-183` calling `clearAuthTokenCache()` first), then the auth-test scope ends at "clearAuthTokenCache forces refetch" — the retry is api.ts's job and would be a separate api.test.ts case. The orchestrator's must_haves accept this scope.
</action>

<verify>
```bash
cd crialook-app
npx vitest run lib/__tests__/auth.test.ts 2>&1 | tail -20
# Expect: all tests pass

grep -c 'describe\|it\(' crialook-app/lib/__tests__/auth.test.ts
# Expect: 5+ (one describe + 5 it cases above)
```
</verify>

### Task 3: Run full vitest suite

<action>
```bash
cd crialook-app
npm test 2>&1 | tail -10
# Expect: green; auth.test.ts is included in the run
```
</action>

<verify>
```bash
cd crialook-app
npm test 2>&1 | grep -E 'auth\.test|passed|failed' | tail -10
```
</verify>

## Files modified

- `crialook-app/lib/__tests__/auth.test.ts` (NEW)

## Why this matters (risk if skipped)

The JWT cache at `lib/auth.tsx:117-135` is the most-traveled code path in the app — every authed API call hits it. A regression here is silent (no error, no Sentry event) but bad in two directions: too-long TTL means server invalidations don't propagate (security); too-short TTL means we hammer Clerk and tank perf. Without these tests, a refactor that flips a `>` to `>=` (off-by-one on expiry check) ships unnoticed.
