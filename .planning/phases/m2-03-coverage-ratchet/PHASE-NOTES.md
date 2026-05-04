# M2 Phase 03 — Coverage ratchet to D-10 spec

**Status:** complete (2026-05-04)

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

## Outcomes (2026-05-04)

**Web (campanha-ia/):** 271 → 414 tests (+143).
- Lines:      24.50 → 30.24 (D-10 spec 30%: REACHED)
- Branches:   17.01 → 24.14 (no D-10 target; +7pp gain)
- Functions:  30.78 → 42.49 (D-10 spec 30%: REACHED with margin)
- Statements: 24.16 → 30.16

**Mobile (crialook-app/):** 101 → 169 tests (+68).
- Lines:      29.15 → 37.51 (D-10 spec 35%: REACHED)
- Branches:   23.46 → 32.31 (+9pp gain)
- Functions:  18.56 → 27.27 (D-10 spec 35%: GAP — 8pp short)
- Statements: 27.64 → 35.89

## Final thresholds set in vitest.config.ts

- Web: lines 30, functions 42, branches 24, statements 30 (raised from 20/27/13/20).
- Mobile: lines 37, functions 27, branches 32, statements 35 (raised from 29/18/23/27).

## D-10 spec status

- Web (target 30/30 lines+funcs): REACHED on both metrics.
- Mobile (target 35/35 lines+funcs): REACHED on lines (37.51%); GAP on functions (27.27% vs 35%).
  - Honest gap documented in `crialook-app/vitest.config.ts` threshold comment:
    RN screen hooks (camera/biometric/push/navigation/notifications side-effects)
    cannot be covered with vitest+jsdom — they need Maestro/Detox e2e, which is
    explicit ROADMAP parking-lot per `.planning/M2-NOTES.md` §What's NOT.
  - Most uncovered functions live in lib/cache.ts, lib/sentry.ts, lib/auth.tsx
    (Provider component effects), lib/notifications side-paths, etc.

## Test files added (this phase)

Web (10 files):
- src/lib/friendly-error.test.ts
- src/lib/utils.test.ts
- src/lib/admin/format.test.ts
- src/lib/plans.test.ts
- src/lib/schemas.test.ts
- src/lib/payments/google-pubsub-auth.test.ts
- src/lib/pricing/index.test.ts
- src/lib/ai/clients.test.ts
- src/lib/ai/identity-translations.test.ts
- src/lib/storage/signed-url.test.ts
- src/lib/supabase/client.test.ts
- src/lib/model-prompts.test.ts
- src/lib/utils/haptics.test.ts
- (validation.test.ts and rate-limit.test.ts extended with new cases)

Mobile (9 files):
- lib/__tests__/plans.test.ts
- lib/__tests__/modelGender.test.ts
- lib/__tests__/schemas.test.ts
- lib/__tests__/clerkErrors.test.ts
- lib/__tests__/toast.test.ts
- lib/__tests__/legal.content.test.ts
- lib/__tests__/images.test.ts
- lib/__tests__/notifications.test.ts
- lib/__tests__/preferences.test.ts

## Constraints honored

- No prod-code changes (only tests).
- No threshold lowering — only raise.
- Atomic commits per test batch (8 commits: m2-03-01 through m2-03-08).
- Husky type-check hook ACTIVE on every commit (caught 2 type errors).
- Test count grew monotonically (no skip/.todo).
- Time budget respected (~2h).
