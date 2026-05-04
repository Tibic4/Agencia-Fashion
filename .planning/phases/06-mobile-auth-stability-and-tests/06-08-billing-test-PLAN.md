---
plan_id: 06-08
phase: 6
title: Add lib/__tests__/billing.test.ts — verify obfuscatedAccountIdAndroid is computed correctly from getCurrentUserId() and included in requestPurchase
wave: 2
depends_on: []
owner_action: false
files_modified:
  - crialook-app/lib/__tests__/billing.test.ts
autonomous: true
requirements: ["D-19", "D-20", "F-PLAY-READINESS-§9-billing-coverage"]
must_haves:
  truths:
    - "test file lives at crialook-app/lib/__tests__/billing.test.ts (vitest, jsdom env per existing config)"
    - "test verifies hashUserIdForBilling produces SHA256(userId).slice(0,64) — exact length 64 hex chars"
    - "test verifies that when getCurrentUserId() returns a Clerk user id, requestPurchase is called with subscriptionOffers[].obfuscatedAccountIdAndroid set to the hash"
    - "test verifies that when getCurrentUserId() returns null (signed out), obfuscatedAccountIdAndroid is omitted (NOT undefined explicitly — the spread excludes it)"
    - "test verifies hash is deterministic — same userId always yields the same hash"
    - "test verifies hash is not the userId itself (basic anti-leak check)"
    - "all dependencies mocked: react-native-iap (requestPurchase), @/lib/auth (getCurrentUserId)"
    - "no real Clerk JWT or real Play Billing call — pure unit test"
  acceptance:
    - "test -f crialook-app/lib/__tests__/billing.test.ts exits 0"
    - "cd crialook-app && npx vitest run lib/__tests__/billing.test.ts exits 0"
    - "grep -c 'describe\\|it\\(\\|test\\(' crialook-app/lib/__tests__/billing.test.ts returns at least 4 (multiple test cases)"
    - "grep -c 'obfuscatedAccountIdAndroid' crialook-app/lib/__tests__/billing.test.ts returns at least 3"
    - "grep -c 'hashUserIdForBilling\\|sha256' crialook-app/lib/__tests__/billing.test.ts returns at least 1"
    - "grep -c 'vi.mock' crialook-app/lib/__tests__/billing.test.ts returns at least 1 (proper vitest mocking)"
---

# Plan 06-08: Add `lib/__tests__/billing.test.ts`

## Objective

Per D-19 (test coverage gap from CRIALOOK-PLAY-READINESS.md §9) + D-20 (use the now-stable Phase 03 jest infra; vitest for pure logic), add a vitest test that verifies the billing flow's `obfuscatedAccountIdAndroid` hash binding works correctly.

This is a **release-critical** test because:
- Mobile-side hash binding is the consumer half of compensating control 3 (per `crialook-app/docs/CLERK_TRUST_COMPENSATING_CONTROLS.md` from plan 06-04 — backend half is currently MISSING, but mobile half MUST stay correct so that when backend lands the validation, the matchup works).
- A regression here (e.g. hash truncation off by one char, or hash skipped on a refactor) would silently break the security binding. No user-facing symptom — exactly the kind of thing tests catch.

## Truths the executor must respect

- Test framework: **vitest** (not Jest). The file lives in `crialook-app/lib/__tests__/` which matches the vitest config `include` pattern (per `crialook-app/vitest.config.ts:14`). Existing peers: `api.classify.test.ts`, `api.regenerateCampaign.test.ts`, `i18n.lookup.test.ts`, `logger.test.ts`, `reviewGate.spec.ts`.
- Environment: jsdom (per vitest config). Globals enabled (per config `globals: true`) — `describe`, `it`, `expect`, `vi` are available without import.
- The function under test is `hashUserIdForBilling` (or whatever it's named — confirm by reading `crialook-app/lib/billing.ts`). It must produce `SHA256(userId).slice(0,64)` per `lib/billing.ts:108-110` and the audit doc (`CRIALOOK-PLAY-READINESS.md` line 190).
- The wider integration to test: `purchaseSubscription` (or whichever exported function) reads `getCurrentUserId()` from `@/lib/auth`, calls `hashUserIdForBilling`, and passes the result into `requestPurchase` from `react-native-iap` as `subscriptionOffers[].obfuscatedAccountIdAndroid`.
- Mock everything heavy:
  - `react-native-iap` — replace `requestPurchase` with a `vi.fn()` so we can inspect the args.
  - `@/lib/auth` — replace `getCurrentUserId` with a `vi.fn()` we control per test.
  - Don't mock `crypto` — node's `crypto.createHash` works in the jsdom env and the hash math is deterministic, real testing is more valuable than testing a mock.
- The test does NOT need to verify the entire purchase flow (no Play Billing API mock, no UI assertions). Scope is the hash binding contract.

## Tasks

### Task 1: Read the source under test

<read_first>
- crialook-app/lib/billing.ts (focus the area around line 105-120 where `hashUserIdForBilling` is defined and called; confirm the export name, the function it's wired into, and the exact `requestPurchase` arg shape)
- crialook-app/lib/auth.tsx (focus the `getCurrentUserId` export — line numbers may have drifted)
- crialook-app/lib/__tests__/api.classify.test.ts (use as a vitest pattern reference — peer test in the same directory)
- crialook-app/vitest.config.ts (confirm globals enabled, jsdom env)
- crialook-app/vitest.setup.ts (check for any existing global mocks that affect billing)
- .planning/phases/06-mobile-auth-stability-and-tests/06-CONTEXT.md (D-19, D-20)
</read_first>

<action>
Note from reading:
- The exact name of the hash function (`hashUserIdForBilling`?) and where it's exported from (`@/lib/billing`?).
- The exact name of the public function that integrates hash + getCurrentUserId + requestPurchase (probably `purchaseSubscription` or similar — read the export list at the top of `lib/billing.ts`).
- The exact shape `requestPurchase` is called with (lines 112-119 per pre-research): `{ sku, subscriptionOffers: [{ ..., ...(obfuscatedAccountIdAndroid ? { obfuscatedAccountIdAndroid } : {}) }] }` — note the conditional spread.
</action>

### Task 2: Write the test file

<read_first>
- (re-uses Task 1 reads)
</read_first>

<action>
Create `crialook-app/lib/__tests__/billing.test.ts`. Adapt the function/export names to what you actually found in Task 1; the structure below is canonical.

```ts
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
 *   - react-native-iap.requestPurchase: vi.fn() so we can read args.
 *   - @/lib/auth.getCurrentUserId: vi.fn() controlled per test.
 *
 * Real:
 *   - node `crypto.createHash` — deterministic, no value in mocking.
 */
import { createHash } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock react-native-iap before the SUT import so the mock is picked up.
vi.mock('react-native-iap', () => ({
  requestPurchase: vi.fn(),
  // Add other named exports billing.ts touches if needed (initConnection,
  // endConnection, etc.) — read lib/billing.ts to see what's imported.
}));

vi.mock('@/lib/auth', () => ({
  getCurrentUserId: vi.fn(),
}));

// Import AFTER mocks are registered (vitest hoists vi.mock automatically,
// but the explicit ordering keeps the test readable).
import { requestPurchase } from 'react-native-iap';
import { getCurrentUserId } from '@/lib/auth';
// ↓ Adjust the named imports based on what billing.ts actually exports.
// If `hashUserIdForBilling` is not exported, drop the unit-level test for
// it and only test the integration via the public purchase function.
import { /* hashUserIdForBilling, */ purchaseSubscription } from '@/lib/billing';

const requestPurchaseMock = vi.mocked(requestPurchase);
const getCurrentUserIdMock = vi.mocked(getCurrentUserId);

beforeEach(() => {
  requestPurchaseMock.mockReset();
  getCurrentUserIdMock.mockReset();
  requestPurchaseMock.mockResolvedValue({ purchaseToken: 'tok_test_123' } as any);
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('billing — obfuscatedAccountIdAndroid hash binding', () => {
  describe('hashUserIdForBilling (or equivalent internal helper)', () => {
    /**
     * Skip this `describe` block if `hashUserIdForBilling` is NOT exported
     * from lib/billing.ts. The integration tests below cover the same
     * contract end-to-end. If you can refactor a one-line export to make
     * the helper testable directly, do it — but don't change the function
     * shape.
     */
    it.skip('produces SHA256(userId).slice(0,64) — pending direct export', () => {
      // const userId = 'user_2abc123def456';
      // const expected = createHash('sha256').update(userId).digest('hex').slice(0, 64);
      // expect(hashUserIdForBilling(userId)).toBe(expected);
    });
  });

  describe('purchaseSubscription integration', () => {
    it('passes obfuscatedAccountIdAndroid = SHA256(userId).slice(0,64) to requestPurchase when signed in', async () => {
      const userId = 'user_2abc123def456';
      const expectedHash = createHash('sha256').update(userId).digest('hex').slice(0, 64);
      getCurrentUserIdMock.mockReturnValue(userId);

      await purchaseSubscription('plan_pro_monthly' /* substitute the actual SKU type */);

      expect(requestPurchaseMock).toHaveBeenCalledTimes(1);
      const callArgs = requestPurchaseMock.mock.calls[0][0] as any;
      // The exact shape per lib/billing.ts:112-119:
      //   { sku, subscriptionOffers: [{ ...(obfuscatedAccountIdAndroid ? {obfuscatedAccountIdAndroid} : {}) }] }
      // Adjust the access path if billing.ts uses a different shape.
      expect(callArgs.subscriptionOffers?.[0]?.obfuscatedAccountIdAndroid).toBe(expectedHash);
    });

    it('omits obfuscatedAccountIdAndroid entirely when getCurrentUserId returns null', async () => {
      getCurrentUserIdMock.mockReturnValue(null);

      await purchaseSubscription('plan_pro_monthly');

      expect(requestPurchaseMock).toHaveBeenCalledTimes(1);
      const callArgs = requestPurchaseMock.mock.calls[0][0] as any;
      // Per the conditional spread `...(obfuscatedAccountIdAndroid ? { obfuscatedAccountIdAndroid } : {})`,
      // the key MUST be absent — not set to undefined or null.
      expect(callArgs.subscriptionOffers?.[0]).not.toHaveProperty('obfuscatedAccountIdAndroid');
    });

    it('produces a deterministic hash for the same userId across calls', async () => {
      const userId = 'user_2abc123def456';
      getCurrentUserIdMock.mockReturnValue(userId);

      await purchaseSubscription('plan_pro_monthly');
      await purchaseSubscription('plan_pro_monthly');

      const firstHash = (requestPurchaseMock.mock.calls[0][0] as any).subscriptionOffers?.[0]?.obfuscatedAccountIdAndroid;
      const secondHash = (requestPurchaseMock.mock.calls[1][0] as any).subscriptionOffers?.[0]?.obfuscatedAccountIdAndroid;
      expect(firstHash).toBe(secondHash);
      expect(firstHash).toHaveLength(64);
    });

    it('hash is not the userId itself (basic non-leak sanity)', async () => {
      const userId = 'user_2abc123def456';
      getCurrentUserIdMock.mockReturnValue(userId);

      await purchaseSubscription('plan_pro_monthly');

      const hash = (requestPurchaseMock.mock.calls[0][0] as any).subscriptionOffers?.[0]?.obfuscatedAccountIdAndroid;
      expect(hash).not.toContain(userId);
      expect(hash).not.toBe(userId);
    });

    it('hash differs across different userIds', async () => {
      getCurrentUserIdMock.mockReturnValue('user_aaa');
      await purchaseSubscription('plan_pro_monthly');
      const hashA = (requestPurchaseMock.mock.calls[0][0] as any).subscriptionOffers?.[0]?.obfuscatedAccountIdAndroid;

      requestPurchaseMock.mockClear();
      getCurrentUserIdMock.mockReturnValue('user_bbb');
      await purchaseSubscription('plan_pro_monthly');
      const hashB = (requestPurchaseMock.mock.calls[0][0] as any).subscriptionOffers?.[0]?.obfuscatedAccountIdAndroid;

      expect(hashA).not.toBe(hashB);
    });
  });
});
```

**Adjustments you MUST make based on Task 1 reading:**
- Replace `purchaseSubscription` with the actual public function name in `lib/billing.ts` that wraps `requestPurchase` (look for a function calling `getCurrentUserId` + `requestPurchase`).
- Replace `'plan_pro_monthly'` with the actual SKU type (`ValidSku`?) the function expects.
- If `hashUserIdForBilling` IS exported, un-skip the direct unit test by importing it and asserting `expect(hashUserIdForBilling(userId)).toBe(expected)`.
- If the `requestPurchase` arg shape differs (different key path to `obfuscatedAccountIdAndroid`), follow what billing.ts:112-119 actually does — DO NOT make up a shape.
</action>

<verify>
```bash
cd crialook-app
npx vitest run lib/__tests__/billing.test.ts 2>&1 | tail -20
# Expect: all tests pass (or `.skip`-ped — skipped is OK if hashUserIdForBilling isn't exported)
```
</verify>

### Task 3: Confirm the test runs in the full vitest suite

<action>
```bash
cd crialook-app
npm test 2>&1 | tail -10
# Expect: green summary, no FAIL lines; new test file is included
```
</action>

<verify>
Confirm the new test file is picked up:
```bash
cd crialook-app
npx vitest run --reporter=verbose lib/__tests__/billing.test.ts 2>&1 | head -20
# Expect: each test name listed, all green
```
</verify>

## Files modified

- `crialook-app/lib/__tests__/billing.test.ts` (NEW)

## Why this matters (risk if skipped)

The hash binding is invisible to the user — no UI surface tells you it's broken. A refactor that drops the conditional spread (`...(obfuscatedAccountIdAndroid ? {…} : {})` → `obfuscatedAccountIdAndroid: undefined`) would silently switch from "absent key" to "explicit undefined", which Google Play might (or might not, depending on SDK version) interpret as "no binding" — a captured purchaseToken from any user could then be replay-attacked by any other user (once backend control 3 lands). Without this test, we'd ship the regression and only catch it in a security incident.
