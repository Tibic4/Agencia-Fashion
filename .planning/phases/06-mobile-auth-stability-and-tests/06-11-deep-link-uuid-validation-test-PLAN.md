---
plan_id: 06-11
phase: 6
title: Add deep-link UUID validation test for _layout.tsx:75-79 (regex check before navigating)
wave: 2
depends_on: []
owner_action: false
files_modified:
  - crialook-app/lib/_layout-deep-link.ts
  - crialook-app/lib/__tests__/deep-link-uuid.test.ts
  - crialook-app/app/_layout.tsx
autonomous: true
requirements: ["D-18", "F-PLAY-READINESS-§5-deep-link"]
must_haves:
  truths:
    - "the UUID_REGEX and isValidCampaignId function are extracted from app/_layout.tsx:75-79 into a new file crialook-app/lib/_layout-deep-link.ts so they're testable without spinning up the whole layout module"
    - "app/_layout.tsx imports isValidCampaignId from the new file (zero behavioral change to the layout)"
    - "test file lib/__tests__/deep-link-uuid.test.ts covers: valid lowercase UUID accepted, valid uppercase UUID accepted, valid mixed-case accepted, missing-hyphen rejected, wrong-length rejected, non-hex chars rejected, empty string rejected, undefined rejected, number rejected, object rejected, path-traversal attempt rejected ('../../../etc/passwd'), SQL-injection-shaped string rejected"
    - "all dependencies are pure node + vitest — no RN imports needed (good extraction)"
  acceptance:
    - "test -f crialook-app/lib/_layout-deep-link.ts exits 0"
    - "test -f crialook-app/lib/__tests__/deep-link-uuid.test.ts exits 0"
    - "grep -c 'UUID_REGEX\\|isValidCampaignId' crialook-app/lib/_layout-deep-link.ts returns at least 2 (definition + export)"
    - "grep -c 'from .*_layout-deep-link' crialook-app/app/_layout.tsx returns 1 (import)"
    - "grep -c 'const UUID_REGEX' crialook-app/app/_layout.tsx returns 0 (the regex is no longer redefined inline)"
    - "cd crialook-app && npx vitest run lib/__tests__/deep-link-uuid.test.ts exits 0"
    - "grep -c 'describe\\|it\\(\\|test\\(' crialook-app/lib/__tests__/deep-link-uuid.test.ts returns at least 8"
    - "cd crialook-app && npx tsc --noEmit exits 0"
---

# Plan 06-11: Deep-link UUID validation test

## Objective

Per D-18, add a test for the UUID regex guard at `app/_layout.tsx:75-79`. Currently the regex + `isValidCampaignId` function are defined inline at module scope, which means we can't import them into a test without dragging in the entire `_layout.tsx` (which has side effects: `initSentry()`, `initLocale()`, `pruneApiCache()`, `wireQueryClientLifecycle()`, etc., plus React Native module imports that fail in vitest's jsdom env).

Solution: extract the regex + function into `crialook-app/lib/_layout-deep-link.ts` (pure module, no side effects), import it from both `app/_layout.tsx` and the new test file. Behavior of `_layout.tsx` is byte-identical; test gains testability.

## Truths the executor must respect

- The extracted module MUST be pure: only the regex constant and the type-guard function. No imports beyond TypeScript types if any. This makes it vitest-loadable.
- The naming `_layout-deep-link.ts` (with leading underscore) signals "private to _layout.tsx" — convention from the repo's existing `_layout.tsx` naming. If this convention isn't followed elsewhere in `lib/`, drop the underscore: `lib/deep-link-validation.ts`.
- `app/_layout.tsx` change MUST be minimal: replace the inline `const UUID_REGEX = ...; function isValidCampaignId(...)` block (lines 75-79) with a single `import { isValidCampaignId } from '@/lib/_layout-deep-link';` (place the import near the other top-of-file imports, NOT mid-file). Confirm the file's other behavior (the SPLASH_SAFETY_TIMEOUT_MS at line 70-73) is untouched.
- The test cases must be exhaustive — UUIDs are simple; testing edge cases (path traversal, injection attempts) costs nothing and locks in the regex's strict semantics for future contributors who might be tempted to "loosen" the regex.

## Tasks

### Task 1: Extract UUID validation to a pure module

<read_first>
- crialook-app/app/_layout.tsx (focus lines 75-79 — the UUID_REGEX + isValidCampaignId block; also note where in the file these are USED so we can confirm the extraction doesn't break the call site)
- .planning/phases/06-mobile-auth-stability-and-tests/06-CONTEXT.md (D-18)
- .planning/audits/CRIALOOK-PLAY-READINESS.md §5 "Deep link validation" (lines 212-216)
</read_first>

<action>
Create `crialook-app/lib/_layout-deep-link.ts` with EXACTLY:

```ts
/**
 * Deep-link UUID validation extracted from app/_layout.tsx so the validator
 * is testable in isolation (without dragging in initSentry, initLocale,
 * react-native-* native modules etc. that the layout module side-effects).
 *
 * Used by:
 *   - app/_layout.tsx — validates `campaignId` from incoming deep links
 *     before navigating to /campaign/[id].
 *
 * Why strict UUID regex: prevents arbitrary route injection
 * (`crialook://campaign/../../../../etc/passwd` style) AND ensures the
 * downstream `apiGet('/campaigns/${id}')` doesn't pass a malformed id to
 * the backend (the backend would reject it but failing fast at the entry
 * point is cheaper).
 */

export const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidCampaignId(value: unknown): value is string {
  return typeof value === 'string' && UUID_REGEX.test(value);
}
```
</action>

<verify>
```bash
test -f crialook-app/lib/_layout-deep-link.ts && echo "OK"
grep -c 'UUID_REGEX\|isValidCampaignId' crialook-app/lib/_layout-deep-link.ts
# Expect: 4+ (export const, function name, function body usage)
```
</verify>

### Task 2: Update `app/_layout.tsx` to import the extracted helper

<read_first>
- crialook-app/app/_layout.tsx (current state — confirm lines 75-79 contain the inline definitions, and confirm the imports section near the top of the file)
</read_first>

<action>
In `crialook-app/app/_layout.tsx`:

1. Remove the inline definitions at lines 75-79:

```tsx
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidCampaignId(value: unknown): value is string {
  return typeof value === 'string' && UUID_REGEX.test(value);
}
```

2. Add a single import line in the imports section near the top of the file (alongside other `@/lib` imports). Suggested placement: after the other `@/lib/...` imports, before the providers/components imports:

```tsx
import { isValidCampaignId } from '@/lib/_layout-deep-link';
```

3. Leave the `SPLASH_SAFETY_TIMEOUT_MS` block at lines 70-73 unchanged.

4. Leave every call site of `isValidCampaignId(...)` in the file unchanged — the import means callers are now using the imported function instead of the inline one. Functionally identical.

5. If `UUID_REGEX` is referenced anywhere ELSE in `_layout.tsx` (not just inside `isValidCampaignId`), also import it: `import { UUID_REGEX, isValidCampaignId } from '@/lib/_layout-deep-link';`. Read the full file to confirm.
</action>

<verify>
```bash
grep -c 'from .*_layout-deep-link' crialook-app/app/_layout.tsx
# Expect: 1 (the import)

grep -c 'const UUID_REGEX' crialook-app/app/_layout.tsx
# Expect: 0 (regex is no longer redefined inline)

grep -c 'function isValidCampaignId' crialook-app/app/_layout.tsx
# Expect: 0 (function is no longer redefined inline)

grep -c 'isValidCampaignId(' crialook-app/app/_layout.tsx
# Expect: at least 1 (the original call sites are still there, calling the imported version)

cd crialook-app && npx tsc --noEmit 2>&1 | tail -5
# Expect: no errors
```
</verify>

### Task 3: Write `lib/__tests__/deep-link-uuid.test.ts`

<read_first>
- crialook-app/lib/_layout-deep-link.ts (just created — confirm exports)
- crialook-app/vitest.config.ts (confirm the new test path matches the include pattern `lib/__tests__/**`)
</read_first>

<action>
Create `crialook-app/lib/__tests__/deep-link-uuid.test.ts`:

```ts
/**
 * deep-link-uuid.test.ts — locks in strict UUID validation for deep-link
 * campaignId routing (CONCERNS §7, CRIALOOK-PLAY-READINESS.md §5).
 *
 * The regex must be STRICT: any future "loosening" (allow non-hex chars
 * to support legacy IDs, drop hyphens for compactness, etc.) opens deep-
 * link injection / IDOR. These tests are the regression lock.
 */
import { describe, expect, it } from 'vitest';
import { UUID_REGEX, isValidCampaignId } from '@/lib/_layout-deep-link';

describe('deep-link UUID validation', () => {
  describe('valid UUIDs are accepted', () => {
    it('accepts a canonical lowercase UUID v4', () => {
      expect(isValidCampaignId('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
    });

    it('accepts an uppercase UUID', () => {
      expect(isValidCampaignId('550E8400-E29B-41D4-A716-446655440000')).toBe(true);
    });

    it('accepts a mixed-case UUID', () => {
      expect(isValidCampaignId('550e8400-E29B-41d4-A716-446655440000')).toBe(true);
    });

    it('accepts UUIDs of any version (regex is version-agnostic, matches our use case)', () => {
      // v1 (time-based)
      expect(isValidCampaignId('c232ab00-9414-11ec-b3c8-9e6bdeced846')).toBe(true);
      // v7 (sortable, recent draft)
      expect(isValidCampaignId('018e4f30-7c3a-7000-8123-456789abcdef')).toBe(true);
    });
  });

  describe('malformed UUIDs are rejected', () => {
    it('rejects a UUID missing a hyphen', () => {
      expect(isValidCampaignId('550e8400e29b-41d4-a716-446655440000')).toBe(false);
    });

    it('rejects a UUID with extra hyphens', () => {
      expect(isValidCampaignId('550e-8400-e29b-41d4-a716-446655440000')).toBe(false);
    });

    it('rejects a UUID one character too short', () => {
      expect(isValidCampaignId('550e8400-e29b-41d4-a716-44665544000')).toBe(false);
    });

    it('rejects a UUID one character too long', () => {
      expect(isValidCampaignId('550e8400-e29b-41d4-a716-4466554400000')).toBe(false);
    });

    it('rejects a UUID with non-hex characters', () => {
      expect(isValidCampaignId('550e8400-e29b-41d4-a716-44665544000Z')).toBe(false);
    });

    it('rejects a UUID with leading whitespace', () => {
      expect(isValidCampaignId(' 550e8400-e29b-41d4-a716-446655440000')).toBe(false);
    });

    it('rejects a UUID with trailing whitespace', () => {
      expect(isValidCampaignId('550e8400-e29b-41d4-a716-446655440000 ')).toBe(false);
    });
  });

  describe('attack-shaped inputs are rejected', () => {
    it('rejects a path-traversal attempt', () => {
      expect(isValidCampaignId('../../../../etc/passwd')).toBe(false);
    });

    it('rejects a SQL-injection-shaped string', () => {
      expect(isValidCampaignId("' OR '1'='1")).toBe(false);
    });

    it('rejects a JS injection attempt', () => {
      expect(isValidCampaignId('<script>alert(1)</script>')).toBe(false);
    });

    it('rejects a UUID with a query string appended', () => {
      expect(isValidCampaignId('550e8400-e29b-41d4-a716-446655440000?evil=1')).toBe(false);
    });

    it('rejects a UUID with a fragment appended', () => {
      expect(isValidCampaignId('550e8400-e29b-41d4-a716-446655440000#evil')).toBe(false);
    });

    it('rejects a UUID with appended path segments', () => {
      expect(isValidCampaignId('550e8400-e29b-41d4-a716-446655440000/admin')).toBe(false);
    });
  });

  describe('non-string types are rejected', () => {
    it('rejects undefined', () => {
      expect(isValidCampaignId(undefined)).toBe(false);
    });

    it('rejects null', () => {
      expect(isValidCampaignId(null)).toBe(false);
    });

    it('rejects empty string', () => {
      expect(isValidCampaignId('')).toBe(false);
    });

    it('rejects a number', () => {
      expect(isValidCampaignId(550840029)).toBe(false);
    });

    it('rejects an object', () => {
      expect(isValidCampaignId({ id: '550e8400-e29b-41d4-a716-446655440000' })).toBe(false);
    });

    it('rejects an array', () => {
      expect(isValidCampaignId(['550e8400-e29b-41d4-a716-446655440000'])).toBe(false);
    });
  });

  describe('UUID_REGEX export sanity', () => {
    it('UUID_REGEX is a RegExp instance', () => {
      expect(UUID_REGEX).toBeInstanceOf(RegExp);
    });

    it('UUID_REGEX is anchored at both ends (^ and $) to prevent partial matches', () => {
      expect(UUID_REGEX.source).toMatch(/^\^/);
      expect(UUID_REGEX.source).toMatch(/\$$/);
    });
  });
});
```
</action>

<verify>
```bash
cd crialook-app
npx vitest run lib/__tests__/deep-link-uuid.test.ts 2>&1 | tail -20
# Expect: all tests pass

grep -c 'it(' crialook-app/lib/__tests__/deep-link-uuid.test.ts
# Expect: 20+ test cases
```
</verify>

### Task 4: Confirm full vitest suite still green

<action>
```bash
cd crialook-app
npm test 2>&1 | tail -10
# Expect: green; new test included

npx tsc --noEmit 2>&1 | tail -5
# Expect: no type errors from the extraction
```
</action>

<verify>
```bash
cd crialook-app
npm test 2>&1 | grep -E 'deep-link-uuid|passed|failed'
```
</verify>

## Files modified

- `crialook-app/lib/_layout-deep-link.ts` (NEW — extracted UUID_REGEX + isValidCampaignId)
- `crialook-app/lib/__tests__/deep-link-uuid.test.ts` (NEW)
- `crialook-app/app/_layout.tsx` (small refactor: replace inline definitions with import — zero behavioral change)

## Why this matters (risk if skipped)

The UUID regex is the FIRST line of defense against deep-link injection. If a future contributor "loosens" it ("we got a request from a partner with a different ID format, let's allow word characters too"), the test fails immediately and forces a deliberate decision rather than a silent regression. Path traversal, fragment/query injection, and type-confusion attacks become visible in the test suite — invisible without it.
