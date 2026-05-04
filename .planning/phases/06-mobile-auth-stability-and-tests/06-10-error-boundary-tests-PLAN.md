---
plan_id: 06-10
phase: 6
title: Add ErrorBoundary + TabErrorBoundary jest tests (renders fallback, captures to Sentry)
wave: 2
depends_on: ["06-07"]
owner_action: false
files_modified:
  - crialook-app/__tests__/ErrorBoundary.test.tsx
  - crialook-app/__tests__/TabErrorBoundary.test.tsx
autonomous: true
requirements: ["D-19", "D-20", "F-PLAY-READINESS-§9-error-boundary-coverage"]
must_haves:
  truths:
    - "tests live in crialook-app/__tests__/ (jest, jest-expo preset — RN renderer + Reanimated mocks; vitest doesn't run RN component tests in this repo)"
    - "ErrorBoundary.test.tsx verifies: renders children when no error; renders fallback UI on thrown error; calls Sentry.captureException in componentDidCatch"
    - "TabErrorBoundary.test.tsx verifies: renders children when no error; renders fallback with title 'Esta tela travou'; calls Sentry.captureException with screen tag; reset() clears error and re-renders children; in production (__DEV__ false) error.message is NOT visible (validates plan 06-07 fix)"
    - "Sentry is mocked — no real DSN call; captureException is a vi.fn / jest.fn"
    - "tests do NOT import the real react-native-reanimated; jest-expo preset handles the mock"
  acceptance:
    - "test -f crialook-app/__tests__/ErrorBoundary.test.tsx exits 0"
    - "test -f crialook-app/__tests__/TabErrorBoundary.test.tsx exits 0"
    - "cd crialook-app && npm run test:rn -- --testPathPattern=ErrorBoundary exits 0"
    - "grep -c 'describe\\|it\\(\\|test\\(' crialook-app/__tests__/ErrorBoundary.test.tsx returns at least 3"
    - "grep -c 'describe\\|it\\(\\|test\\(' crialook-app/__tests__/TabErrorBoundary.test.tsx returns at least 4"
    - "grep -c '__DEV__\\|isDev' crialook-app/__tests__/TabErrorBoundary.test.tsx returns at least 1 (validates plan 06-07's __DEV__ guard)"
---

# Plan 06-10: ErrorBoundary + TabErrorBoundary tests

## Objective

Per D-19 / D-20, add jest tests for the two React error boundaries:

- `crialook-app/components/ErrorBoundary.tsx` — root-level catch-all (`AppErrorBoundary`).
- `crialook-app/components/TabErrorBoundary.tsx` — per-tab isolated boundary (the one F-10 / plan 06-07 just hardened).

The TabErrorBoundary test specifically locks in the plan 06-07 fix: in non-DEV (production) mode, the raw `error.message` MUST NOT render. This prevents a future regression that re-introduces the leak.

## Truths the executor must respect

- These tests use **jest + jest-expo preset** (not vitest) because they exercise React Native components — the jest-expo preset wires the RN renderer + Reanimated mock. Test files live in `crialook-app/__tests__/` (NOT `lib/__tests__/`); per `crialook-app/jest.config.js:18`, `testMatch: ['<rootDir>/__tests__/**/*.test.{ts,tsx}']`.
- Existing peer test: `crialook-app/__tests__/example-pulsing-badge.test.tsx`. Read it to confirm the jest pattern in this repo (imports, render helpers, mock conventions).
- Mocking strategy:
  - `@/lib/sentry` — replace `Sentry.captureException` with a `jest.fn()`.
  - `@expo/vector-icons/FontAwesome` — leave as-is if jest-expo handles it; otherwise stub to `() => null`.
  - `@/lib/i18n` — `t()` likely needs a stub returning the key as-is (or a small dictionary). Read jest.setup.ts to see if it's globally mocked.
- For testing `__DEV__ === false` behavior in TabErrorBoundary: `__DEV__` is a global injected by jest-expo. Override it per-test with `(global as any).__DEV__ = false;` in a `describe` block, restore in afterEach. Be careful — other tests in the same file may rely on the default.
- Use `@testing-library/react-native` for `render` + `fireEvent`. If it's not in package.json yet, the executor should add it via `npm run lock:fix` workflow — but pre-research showed it's likely already a dep. Confirm before assuming.
- DO NOT import `react-native-reanimated` directly — jest-expo's mock takes over.

## Tasks

### Task 1: Confirm test infra

<read_first>
- crialook-app/jest.config.js (testMatch, setupFilesAfterEnv, transformIgnorePatterns)
- crialook-app/jest.setup.ts (global mocks — Sentry? i18n?)
- crialook-app/__tests__/example-pulsing-badge.test.tsx (the one existing jest test — pattern reference)
- crialook-app/package.json (confirm @testing-library/react-native is a dependency; if not, this plan needs to add it via lock:fix BEFORE writing tests)
- crialook-app/components/ErrorBoundary.tsx (full file — confirm export name, fallback UI structure, Sentry call shape)
- crialook-app/components/TabErrorBoundary.tsx (full file post-plan-06-07 — confirm __DEV__ wrap is in place)
- crialook-app/lib/sentry.ts (confirm Sentry.captureException is a function we can mock by replacing the module)
</read_first>

<action>
Confirm:
1. `@testing-library/react-native` is in `package.json` dependencies or devDependencies. If NOT, add it: edit package.json to add `"@testing-library/react-native": "^12.0.0"` (or latest 12.x) under devDependencies, then run `npm run lock:fix`. **Do NOT use plain `npm install`.**
2. Plan 06-07 has landed (`grep '__DEV__' crialook-app/components/TabErrorBoundary.tsx` returns the new guard).
3. The existing jest test `example-pulsing-badge.test.tsx` runs cleanly (`npm run test:rn -- --testPathPattern=example-pulsing` exits 0) — confirms infra is healthy.
</action>

### Task 2: Write `__tests__/ErrorBoundary.test.tsx`

<read_first>
- crialook-app/components/ErrorBoundary.tsx (full file — confirm class export, getDerivedStateFromError shape, componentDidCatch shape, render() fallback structure)
- (re-uses Task 1 reads)
</read_first>

<action>
Create `crialook-app/__tests__/ErrorBoundary.test.tsx`:

```tsx
/**
 * ErrorBoundary.test.tsx — coverage for AppErrorBoundary (root catch-all).
 *
 * Verifies:
 *   - Renders children when no error.
 *   - Renders fallback UI when a child throws.
 *   - Calls Sentry.captureException in componentDidCatch.
 *
 * Mocks:
 *   - @/lib/sentry → captureException is jest.fn().
 */
import React from 'react';
import { Text } from 'react-native';
import { render } from '@testing-library/react-native';

const captureExceptionMock = jest.fn();
jest.mock('@/lib/sentry', () => ({
  Sentry: {
    captureException: (...args: any[]) => captureExceptionMock(...args),
    addBreadcrumb: jest.fn(),
    captureMessage: jest.fn(),
    wrap: (c: any) => c,
  },
  initSentry: jest.fn(),
}));

// Adjust the import — read crialook-app/components/ErrorBoundary.tsx for the
// actual export name (`AppErrorBoundary`?).
import { AppErrorBoundary } from '@/components/ErrorBoundary';

// Component that throws on first render — used to drive the boundary.
function Bomb({ message = 'kaboom' }: { message?: string }): JSX.Element {
  throw new Error(message);
}

beforeEach(() => {
  captureExceptionMock.mockClear();
  // Suppress React's "consider adding error boundary" log during tests.
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  (console.error as jest.Mock).mockRestore?.();
});

describe('AppErrorBoundary', () => {
  it('renders children when no error', () => {
    const { getByText } = render(
      <AppErrorBoundary>
        <Text>healthy child</Text>
      </AppErrorBoundary>,
    );
    expect(getByText('healthy child')).toBeTruthy();
  });

  it('renders fallback UI when a child throws', () => {
    const { queryByText } = render(
      <AppErrorBoundary>
        <Bomb />
      </AppErrorBoundary>,
    );
    // The fallback UI's exact title text — read from ErrorBoundary.tsx and
    // substitute. Likely "Algo deu errado" or similar Portuguese string.
    // Adjust based on actual content.
    expect(queryByText(/algo deu errado|erro/i)).toBeTruthy();
  });

  it('calls Sentry.captureException in componentDidCatch', () => {
    render(
      <AppErrorBoundary>
        <Bomb message="specific kaboom" />
      </AppErrorBoundary>,
    );
    expect(captureExceptionMock).toHaveBeenCalledTimes(1);
    const [errorArg] = captureExceptionMock.mock.calls[0];
    expect(errorArg).toBeInstanceOf(Error);
    expect((errorArg as Error).message).toBe('specific kaboom');
  });
});
```

**Adjustments based on Task 1:**
- `AppErrorBoundary` → actual class name from ErrorBoundary.tsx export.
- Fallback text in test 2 → substitute the actual title string from ErrorBoundary.tsx render().
- If Sentry call shape includes a tags/contexts second arg, assert on that too: `expect(captureExceptionMock).toHaveBeenCalledWith(expect.any(Error), expect.objectContaining({ tags: expect.any(Object) }));`
</action>

### Task 3: Write `__tests__/TabErrorBoundary.test.tsx`

<read_first>
- crialook-app/components/TabErrorBoundary.tsx (full file post-plan-06-07 — confirm the __DEV__ guard is at the location we expect)
</read_first>

<action>
Create `crialook-app/__tests__/TabErrorBoundary.test.tsx`:

```tsx
/**
 * TabErrorBoundary.test.tsx — coverage for per-tab boundary + plan 06-07
 * regression lock-in (production hides error.message).
 *
 * Verifies:
 *   - Renders children when no error.
 *   - Renders fallback with title "Esta tela travou".
 *   - Calls Sentry.captureException with screen tag.
 *   - reset() clears error and re-renders children.
 *   - In non-DEV (__DEV__ === false) the error.message is NOT visible.
 *
 * Mocks:
 *   - @/lib/sentry → captureException is jest.fn().
 *   - @/lib/i18n → t() returns the key (or the existing global stub).
 */
import React from 'react';
import { Text } from 'react-native';
import { fireEvent, render } from '@testing-library/react-native';

const captureExceptionMock = jest.fn();
jest.mock('@/lib/sentry', () => ({
  Sentry: {
    captureException: (...args: any[]) => captureExceptionMock(...args),
    addBreadcrumb: jest.fn(),
    captureMessage: jest.fn(),
  },
}));

// If i18n is not globally mocked in jest.setup.ts, stub here so t() returns
// a predictable string for the "Tentar de novo" button query.
jest.mock('@/lib/i18n', () => ({
  t: (key: string) => key,
}));

import { TabErrorBoundary } from '@/components/TabErrorBoundary';

function Bomb({ message = 'tab kaboom' }: { message?: string }): JSX.Element {
  throw new Error(message);
}

// Stable component that flips behavior via a ref so reset() can re-render to
// healthy state.
function Toggle({ shouldThrow }: { shouldThrow: boolean }): JSX.Element {
  if (shouldThrow) throw new Error('toggle error');
  return <Text>recovered</Text>;
}

beforeEach(() => {
  captureExceptionMock.mockClear();
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  (console.error as jest.Mock).mockRestore?.();
});

describe('TabErrorBoundary', () => {
  it('renders children when no error', () => {
    const { getByText } = render(
      <TabErrorBoundary screen="historico">
        <Text>healthy tab</Text>
      </TabErrorBoundary>,
    );
    expect(getByText('healthy tab')).toBeTruthy();
  });

  it('renders fallback title "Esta tela travou" when a child throws', () => {
    const { getByText } = render(
      <TabErrorBoundary screen="historico">
        <Bomb />
      </TabErrorBoundary>,
    );
    expect(getByText('Esta tela travou')).toBeTruthy();
  });

  it('calls Sentry.captureException with the screen tag', () => {
    render(
      <TabErrorBoundary screen="historico">
        <Bomb message="specific tab kaboom" />
      </TabErrorBoundary>,
    );
    expect(captureExceptionMock).toHaveBeenCalledTimes(1);
    const [errorArg, optionsArg] = captureExceptionMock.mock.calls[0];
    expect(errorArg).toBeInstanceOf(Error);
    expect((errorArg as Error).message).toBe('specific tab kaboom');
    expect(optionsArg).toMatchObject({
      tags: expect.objectContaining({ screen: 'historico', scope: 'tab-boundary' }),
    });
  });

  it('reset() clears error so children re-render after pressing retry', () => {
    let throwOnNextRender = true;
    function GuardedToggle(): JSX.Element {
      if (throwOnNextRender) throw new Error('first paint failed');
      return <Text>recovered</Text>;
    }

    const { getByText, queryByText } = render(
      <TabErrorBoundary screen="historico">
        <GuardedToggle />
      </TabErrorBoundary>,
    );

    // Initially boomed → fallback visible.
    expect(getByText('Esta tela travou')).toBeTruthy();

    // Flip the bomb so the next render succeeds.
    throwOnNextRender = false;

    // Press "Tentar de novo" (mocked via t() returning the i18n key —
    // adjust to the actual key if i18n stub differs).
    fireEvent.press(getByText('common.retry'));

    expect(queryByText('recovered')).toBeTruthy();
    expect(queryByText('Esta tela travou')).toBeNull();
  });

  describe('plan 06-07 regression lock — production hides error.message', () => {
    let originalDev: any;

    beforeEach(() => {
      originalDev = (global as any).__DEV__;
      (global as any).__DEV__ = false;
    });

    afterEach(() => {
      (global as any).__DEV__ = originalDev;
    });

    it('does NOT render error.message text when __DEV__ is false', () => {
      const { queryByText } = render(
        <TabErrorBoundary screen="historico">
          <Bomb message="SECRET INTERNAL ERROR /api/internal/foo" />
        </TabErrorBoundary>,
      );
      expect(queryByText('Esta tela travou')).toBeTruthy();
      expect(queryByText(/SECRET INTERNAL ERROR/i)).toBeNull();
    });

    it('DOES render error.message when __DEV__ is true (dev-only debug surface)', () => {
      (global as any).__DEV__ = true;
      const { queryByText } = render(
        <TabErrorBoundary screen="historico">
          <Bomb message="DEV VISIBLE ERROR" />
        </TabErrorBoundary>,
      );
      expect(queryByText(/DEV VISIBLE ERROR/i)).toBeTruthy();
    });
  });
});
```

**Adjustments based on Task 1:**
- `TabErrorBoundary` and `screen` prop name → confirm against actual export.
- `'common.retry'` → if i18n is NOT globally stubbed to return the key, substitute the actual translated string ("Tentar de novo"?).
- The `description` text "Toca em "Tentar de novo"" — if i18n returns Portuguese strings instead of keys, adjust the `getByText('common.retry')` call accordingly.
</action>

<verify>
```bash
cd crialook-app
npm run test:rn -- --testPathPattern=ErrorBoundary 2>&1 | tail -30
# Expect: both new test files run, all green

grep -c 'describe\|it\(' crialook-app/__tests__/ErrorBoundary.test.tsx
# Expect: 3+

grep -c 'describe\|it\(' crialook-app/__tests__/TabErrorBoundary.test.tsx
# Expect: 4+ (5 ungrouped + 2 inside the regression-lock describe = 7 total `it`s)

grep -c '__DEV__' crialook-app/__tests__/TabErrorBoundary.test.tsx
# Expect: 4+ (overrides + asserts)
```
</verify>

### Task 4: Confirm full RN test suite green

<action>
```bash
cd crialook-app
npm run test:rn 2>&1 | tail -10
# Expect: all 3 jest test files pass (existing example + 2 new)
```
</action>

<verify>
```bash
cd crialook-app
npm run test:rn 2>&1 | grep -E 'Tests|Test Suites'
# Expect: "Tests: X passed" with X >= 7-10 (3 ErrorBoundary + 7 TabErrorBoundary + N from existing example file)
```
</verify>

## Files modified

- `crialook-app/__tests__/ErrorBoundary.test.tsx` (NEW)
- `crialook-app/__tests__/TabErrorBoundary.test.tsx` (NEW)
- (possibly) `crialook-app/package.json` + `package-lock.json` IF `@testing-library/react-native` was missing — added via `npm run lock:fix`

## Why this matters (risk if skipped)

Error boundaries are the LAST line of defense — when they break, every other error handling assumption falls. A regression that silently breaks `componentDidCatch` (e.g. wrapping the Sentry call in a `__DEV__` guard "for symmetry") would mean prod errors go un-reported AND the user sees the blank fallback. The TabErrorBoundary regression-lock test specifically guards the plan 06-07 fix from being naively reverted.
