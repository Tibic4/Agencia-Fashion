# M2 Phase 03 — Coverage ratchet to D-10 spec

**Status:** in-progress (2026-05-04)

## Baseline (pre-Phase 3)

- Web: 271 tests passing. Coverage = lines 24.50% / branches 17.01% /
  functions 30.78% / statements 24.16%. Threshold = 20/13/27/20.
- Mobile: 101 tests passing. Coverage = lines 29.15% / branches 23.46% /
  functions 18.56% / statements 27.64%. Threshold = 29/23/18/27.

D-10 spec target: web 30% / mobile 35% on lines + functions.

## Strategy

1. Add unit tests for highest-value, low-effort utilities first
   (friendly-error, utils, schemas, plans, format helpers, rate-limit
   checkRateLimit, etc).
2. Mobile: cover plans, modelGender, schemas, clerkErrors, toast,
   images, preferences (where MMKV mockable).
3. Skip RN screen hooks (camera/biometric/push) — documented as e2e
   debt in the vitest.config.ts comment.
4. Raise thresholds to actual measured floor (+0pp ratchet) at the end.
   If actual reaches D-10 spec, raise to spec. Otherwise comment the
   honest gap.

## Constraints honored

- No prod-code changes (only tests).
- No threshold lowering — only raise.
- Atomic commits per test batch.
- Husky type-check hook ACTIVE on every commit.
