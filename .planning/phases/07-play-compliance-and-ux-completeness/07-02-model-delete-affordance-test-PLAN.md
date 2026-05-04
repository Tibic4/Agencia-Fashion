---
plan_id: 07-02
phase: 7
title: Vitest jsdom contract test for ModelBottomSheet trash affordance — proves onDelete fires after danger confirm (D-01..D-05)
wave: 2
depends_on: ["07-01"]
owner_action: false
files_modified:
  - crialook-app/components/__tests__/ModelBottomSheet.test.tsx
  - crialook-app/vitest.config.ts
autonomous: true
requirements: ["D-01", "D-03", "D-05"]
must_haves:
  truths:
    - "test file lives at crialook-app/components/__tests__/ModelBottomSheet.test.tsx (NEW directory) and renders ModelBottomSheet via @testing-library/react under jsdom"
    - "vitest.config.ts include array adds 'components/__tests__/**/*.{test,spec}.{ts,tsx}' so the new test is picked up by the existing CI invocation `npm test -- --coverage`"
    - "test stubs @gorhom/bottom-sheet (BottomSheetModal renders children inline like the existing RegenerateReasonPicker test does, components/historico/__tests__/RegenerateReasonPicker.test.tsx) — mirror that mock structure for consistency"
    - "test stubs react-native primitives (Pressable, Text, View) to DOM equivalents per the project's established pattern (RegenerateReasonPicker.test.tsx)"
    - "test stubs @expo/vector-icons (FontAwesome) to render the icon name as a text node so the assertion against the trash glyph is grep-able"
    - "test stubs ConfirmSheet so `useConfirmSheet().ask` is a vi.fn() the test can resolve to true or false"
    - "test stubs lib/toast so `toast.success` is a vi.fn() the test can assert was called"
    - "test stubs lib/i18n so `useT().t(key)` returns the key (no real i18n lookup); assertions use the keys"
    - "test case 1: when onDelete is undefined, NO trash button renders (queryByLabelText 'Deletar modelo' is null)"
    - "test case 2: when onDelete is provided AND model.is_custom is false, NO trash button renders (catalog model gating)"
    - "test case 3: when onDelete is provided AND model.is_custom is true, the trash button renders with accessibilityLabel 'Deletar modelo'"
    - "test case 4: tapping trash + confirm=true calls onDelete with the model.id, dismisses sheet, and emits toast.success once"
    - "test case 5: tapping trash + confirm=false does NOT call onDelete and does NOT call toast.success"
    - "test does NOT rely on the real Reanimated/Skia/expo-image runtime — those are stubbed similarly to the RegenerateReasonPicker pattern"
    - "test runs green via `cd crialook-app && npm test` (vitest)"
  acceptance:
    - "test -f crialook-app/components/__tests__/ModelBottomSheet.test.tsx exits 0"
    - "grep -c \"^  it\\(\\|^  test\\(\" crialook-app/components/__tests__/ModelBottomSheet.test.tsx returns at least 5 (one per case above)"
    - "grep -c 'Deletar modelo' crialook-app/components/__tests__/ModelBottomSheet.test.tsx returns at least 3 (test names + assertions)"
    - "grep -c 'is_custom' crialook-app/components/__tests__/ModelBottomSheet.test.tsx returns at least 2 (true case + false case)"
    - "grep -c \"vi.mock\\(\" crialook-app/components/__tests__/ModelBottomSheet.test.tsx returns at least 5 (gorhom + react-native + vector-icons + ConfirmSheet + toast)"
    - "grep -c 'components/__tests__' crialook-app/vitest.config.ts returns at least 1 (include array updated)"
    - "cd crialook-app && npm test -- --run 2>&1 | grep -E 'ModelBottomSheet|Test Files.*passed' returns at least 1 line showing the new test ran"
    - "cd crialook-app && npm test -- --run --coverage 2>&1 | tail -20 shows no NEW threshold failure (coverage may rise; vitest.config.ts thresholds remain a floor — Phase 7 does NOT ratchet them, that's a follow-up)"
---

# Plan 07-02: Vitest test for ModelBottomSheet delete affordance

## Objective

Per D-01, D-03, D-05 — once 07-01 lands the trash icon UI, prove the affordance contract with a vitest jsdom test:

1. The trash icon does not render unless both `onDelete` is provided AND `model.is_custom === true` (gating).
2. Tapping the icon opens a danger ConfirmSheet (verified by the `ask` mock being called with `variant: 'danger'`).
3. Confirm (true) → `onDelete(modelId)` + sheet dismiss + `toast.success`.
4. Cancel (false) → no `onDelete`, no toast.

This pins the F-11 contract so any future refactor that drops the gating, the confirm, or the toast surface is caught by CI before it ships.

## Truths the executor must respect

- The test file is **new**: `crialook-app/components/__tests__/ModelBottomSheet.test.tsx`. The `__tests__` directory under `components/` doesn't exist yet — create it.
- vitest.config.ts (`crialook-app/vitest.config.ts`) currently includes `components/historico/__tests__/**/*` but NOT a generic `components/__tests__/**/*`. Add the generic pattern so the new test runs under the existing `npm test` invocation. Do NOT remove the historico-specific entry (defensive: explicit beats implicit, and it documents the colocation pattern).
- The reference test for the mocking pattern is `crialook-app/components/historico/__tests__/RegenerateReasonPicker.test.tsx`. Follow its structure verbatim for:
  - `vi.mock('react-native', ...)` — DOM-friendly primitive stubs
  - `vi.mock('@gorhom/bottom-sheet', ...)` — BottomSheetModal/Backdrop/ScrollView render children inline as `<div>`
  - `vi.mock('@expo/vector-icons', ...)` — icon → text node showing name (e.g., `<span>icon:trash</span>`)
- Additional mocks specific to ModelBottomSheet:
  - `vi.mock('expo-image', () => ({ Image: (props) => <img src={props.source?.uri} alt="" /> }))` — needed because the sheet renders the model photo
  - `vi.mock('expo-blur', () => ({ BlurView: ({ children }) => <div>{children}</div> }))` — close button wrapper
  - `vi.mock('expo-linear-gradient', () => ({ LinearGradient: ({ children }) => <div>{children}</div> }))` — CTA wrapper
  - `vi.mock('expo-haptics', () => ({ impactAsync: vi.fn().mockResolvedValue(undefined), ImpactFeedbackStyle: { Light: 'Light', Heavy: 'Heavy' } }))`
  - `vi.mock('react-native-gesture-handler', () => ({ Gesture: { Pinch: () => ({ onUpdate: () => ({ onEnd: () => ({}) }) }), Tap: () => ({ numberOfTaps: () => ({ maxDelay: () => ({ onStart: () => ({}) }) }) }), Pan: () => ({ minPointers: () => ({ maxPointers: () => ({ onUpdate: () => ({ onEnd: () => ({}) }) }) }) }), Simultaneous: (...args) => ({}) }, GestureDetector: ({ children }) => <>{children}</> }))` — gesture API stubbed; the test doesn't exercise gestures
  - `vi.mock('react-native-reanimated', () => ({ default: { View: 'div', createAnimatedComponent: (c) => c }, useAnimatedStyle: () => ({}), useSharedValue: (v) => ({ value: v }), withSpring: (v) => v, withTiming: (v) => v, runOnJS: (fn) => fn }))`
  - `vi.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }))`
  - `vi.mock('@/components/skia', () => ({ AuraGlow: () => null }))`
  - `vi.mock('@/components/ConfirmSheet', () => ({ useConfirmSheet: () => ({ ConfirmEl: null, ask: askMock }) }))` where `askMock = vi.fn()` is hoisted via `vi.hoisted`
  - `vi.mock('@/lib/toast', () => ({ toast: { success: toastSuccessMock, error: vi.fn(), warning: vi.fn(), info: vi.fn() } }))` where `toastSuccessMock = vi.fn()` is hoisted
  - `vi.mock('@/lib/i18n', () => ({ useT: () => ({ t: (k) => k }) }))` — return key for assertion clarity
  - `vi.mock('@/components/useColorScheme', () => ({ useColorScheme: () => 'light' }))`
  - `vi.mock('@/constants/Colors', () => ({ default: { light: { card: '#fff', text: '#000', textSecondary: '#666', border: '#eee' }, brand: { primary: '#000', secondary: '#fff', gradientPrimary: ['#000', '#fff'] } } }))`
- Use `vi.hoisted` for the mock fns (`askMock`, `toastSuccessMock`) so they're available inside the `vi.mock` factories (vitest hoists `vi.mock` to the top of the file, before any non-`vi.hoisted` declaration).
- The component is a `forwardRef` exposing `present(model)`. The test creates a ref via `React.createRef()`, calls `ref.current.present(modelFixture)` to mount with a model, then asserts on the rendered output. Wrap the call in `act()` to flush state.
- Two model fixtures:
  - `customModel = { id: 'm-custom-1', name: 'Ana', body_type: 'media', is_custom: true, image_url: 'http://x/a.jpg' }`
  - `catalogModel = { id: 'm-catalog-1', name: 'Default', body_type: 'media', is_custom: false, image_url: 'http://x/b.jpg' }`
- DO NOT raise vitest coverage thresholds in this plan. The thresholds (lines 29 / functions 18 / branches 23 / statements 27) stay as-is — adding tests can only raise actual coverage, never lower it. A future plan (post-Phase 7) may ratchet, mirroring the Phase 6 D-19 / Plan 06-12 pattern. **Note for any threshold ratchet:** measure post-Phase 7 with `npm test -- --coverage` and bump the floor to current measured numbers, but DO NOT do it in this plan (different concern, different blast radius).

## Tasks

### Task 1: Add `components/__tests__/**` to vitest.config.ts include array

<read_first>
- crialook-app/vitest.config.ts (lines 11-19 — `include` array)
</read_first>

<action>
In `crialook-app/vitest.config.ts`, update the `include` array (lines 11-19) to add a generic `components/__tests__/**` entry alongside the existing `components/historico/__tests__/**` entry:

```typescript
include: [
  'lib/__tests__/**/*.{test,spec}.{ts,tsx}',
  'hooks/__tests__/**/*.{test,spec}.{ts,tsx}',
  // Phase 02 D-11: components/historico/ holds the regenerate-reason
  // picker (Gorhom Bottom Sheet). Tests live next to the component so
  // co-location stays even though we only ship Vitest for one folder
  // today; expand here when more components/* dirs grow tests.
  'components/historico/__tests__/**/*.{test,spec}.{ts,tsx}',
  // Phase 07 D-01..D-05: components/__tests__/ holds the ModelBottomSheet
  // delete-affordance contract test (F-11). Same Gorhom + DOM-stub pattern
  // as RegenerateReasonPicker; kept generic so future component tests at
  // components/__tests__/*.test.tsx are auto-picked-up.
  'components/__tests__/**/*.{test,spec}.{ts,tsx}',
],
```

Do NOT touch any other field (coverage thresholds, environment, setupFiles, alias).
</action>

<verify>
```bash
grep -n "components/__tests__" crialook-app/vitest.config.ts
# Expect at least 1 hit (the new include line)

grep -n "components/historico/__tests__" crialook-app/vitest.config.ts
# Expect 1 hit (existing line preserved)
```
</verify>

### Task 2: Create the ModelBottomSheet test

<read_first>
- crialook-app/components/historico/__tests__/RegenerateReasonPicker.test.tsx (FULL FILE — this is the canonical pattern; mirror its structure: hoisted mocks, vi.mock blocks, render → fireEvent.click pattern)
- crialook-app/components/ModelBottomSheet.tsx (post-07-01 — confirm the trash icon's accessibilityLabel, the gating condition `isCustom && onDelete`, the ConfirmSheet integration shape)
- crialook-app/components/ConfirmSheet.tsx (lines 235-244 — `ask(opts)` returns `Promise<boolean>`)
- crialook-app/lib/toast.ts (lines 45-54 — `toast.success(text)` signature)
- crialook-app/vitest.setup.ts (whatever this file contains, to know what's already globally stubbed)
- .planning/phases/07-play-compliance-and-ux-completeness/07-CONTEXT.md (D-01..D-05 confirm the contract)
</read_first>

<action>
Create the file `crialook-app/components/__tests__/ModelBottomSheet.test.tsx` with this content (executor: take the structure verbatim, adjust import paths if the local conventions differ — the goal is the test cases, not the literal file):

```typescript
/**
 * ModelBottomSheet — Phase 7 F-11 delete-affordance contract test.
 *
 * Proves D-01..D-05:
 *   1. Trash icon hidden when onDelete absent.
 *   2. Trash icon hidden for non-custom models (gating).
 *   3. Trash icon visible for custom models with onDelete wired.
 *   4. Confirm=true triggers onDelete + dismiss + toast.
 *   5. Confirm=false triggers neither.
 *
 * Mocking strategy mirrors components/historico/__tests__/RegenerateReasonPicker.test.tsx:
 *   - @gorhom/bottom-sheet → render children inline
 *   - react-native primitives → DOM equivalents
 *   - @expo/vector-icons → text node showing name
 *   - reanimated/gesture-handler/skia/blur/linear-gradient/haptics → stubs
 *   - ConfirmSheet.useConfirmSheet → ask is a vi.fn() the test resolves
 *   - lib/toast.toast.success → vi.fn() the test asserts on
 *   - lib/i18n.useT → t(k) returns k for legible assertions
 */
import React from 'react';
import { render, fireEvent, act } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';

// ─── Hoisted mocks (must be defined before vi.mock factories run) ────────
const { askMock, toastSuccessMock, dismissMock } = vi.hoisted(() => ({
  askMock: vi.fn<[unknown], Promise<boolean>>(),
  toastSuccessMock: vi.fn<[string], void>(),
  dismissMock: vi.fn<[], void>(),
}));

// ─── react-native primitive stubs (DOM-friendly) ─────────────────────────
vi.mock('react-native', () => {
  const React = require('react');
  const passthrough = (tag: string) => (props: any) => {
    const { children, accessibilityLabel, accessibilityRole, onPress, onClick, ...rest } = props ?? {};
    return React.createElement(
      tag,
      {
        ...rest,
        'aria-label': accessibilityLabel,
        role: accessibilityRole,
        onClick: onPress || onClick,
      },
      children,
    );
  };
  return {
    StyleSheet: { create: (s: unknown) => s, hairlineWidth: 1, absoluteFillObject: {} },
    View: passthrough('div'),
    Text: passthrough('span'),
    Pressable: passthrough('button'),
    Modal: passthrough('div'),
    Platform: { OS: 'android', select: (m: any) => m.android ?? m.default },
    useWindowDimensions: () => ({ width: 360, height: 720 }),
  };
});

// ─── @gorhom/bottom-sheet — render children inline ───────────────────────
vi.mock('@gorhom/bottom-sheet', () => {
  const React = require('react');
  const Pass = ({ children }: any) => React.createElement('div', null, children);
  return {
    BottomSheetModal: React.forwardRef(({ children }: any, ref: any) => {
      React.useImperativeHandle(ref, () => ({
        present: () => {},
        dismiss: dismissMock,
      }));
      return React.createElement('div', { 'data-testid': 'bottom-sheet-modal' }, children);
    }),
    BottomSheetBackdrop: Pass,
    BottomSheetScrollView: Pass,
  };
});

// ─── expo-image / expo-blur / expo-linear-gradient ───────────────────────
vi.mock('expo-image', () => ({
  Image: (props: any) =>
    require('react').createElement('img', { src: props.source?.uri, alt: '' }),
}));
vi.mock('expo-blur', () => ({
  BlurView: ({ children }: any) => require('react').createElement('div', null, children),
}));
vi.mock('expo-linear-gradient', () => ({
  LinearGradient: ({ children }: any) =>
    require('react').createElement('div', null, children),
}));

// ─── expo-haptics ────────────────────────────────────────────────────────
vi.mock('expo-haptics', () => ({
  impactAsync: vi.fn().mockResolvedValue(undefined),
  ImpactFeedbackStyle: { Light: 'Light', Heavy: 'Heavy', Medium: 'Medium' },
}));

// ─── react-native-safe-area-context ──────────────────────────────────────
vi.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

// ─── react-native-gesture-handler ────────────────────────────────────────
vi.mock('react-native-gesture-handler', () => {
  const chain = (): any => new Proxy(() => chain(), { get: () => chain });
  return {
    Gesture: {
      Pinch: () => chain(),
      Tap: () => chain(),
      Pan: () => chain(),
      Simultaneous: () => ({}),
    },
    GestureDetector: ({ children }: any) =>
      require('react').createElement(require('react').Fragment, null, children),
  };
});

// ─── react-native-reanimated ─────────────────────────────────────────────
vi.mock('react-native-reanimated', () => {
  const React = require('react');
  return {
    default: {
      View: ({ children, ...rest }: any) => React.createElement('div', rest, children),
      createAnimatedComponent: (c: any) => c,
    },
    useAnimatedStyle: () => ({}),
    useSharedValue: (v: any) => ({ value: v }),
    withSpring: (v: any) => v,
    withTiming: (v: any) => v,
    runOnJS: (fn: any) => fn,
  };
});

// ─── @expo/vector-icons (FontAwesome) ────────────────────────────────────
vi.mock('@expo/vector-icons', () => ({
  FontAwesome: ({ name }: any) =>
    require('react').createElement('span', null, `icon:${name}`),
}));

// ─── App-internal mocks ──────────────────────────────────────────────────
vi.mock('@/components/skia', () => ({ AuraGlow: () => null }));
vi.mock('@/components/useColorScheme', () => ({ useColorScheme: () => 'light' }));
vi.mock('@/constants/Colors', () => ({
  default: {
    light: { card: '#fff', text: '#000', textSecondary: '#666', border: '#eee' },
    brand: { primary: '#000', secondary: '#fff', gradientPrimary: ['#000', '#fff'] },
  },
  brand: { primary: '#000', secondary: '#fff', gradientPrimary: ['#000', '#fff'] },
}));
vi.mock('@/lib/theme/tokens', () => ({
  tokens: { fontWeight: { semibold: '600' }, radii: { full: 9999 } },
}));
vi.mock('@/lib/i18n', () => ({ useT: () => ({ t: (k: string) => k }) }));
vi.mock('@/lib/toast', () => ({
  toast: {
    success: toastSuccessMock,
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
  },
}));
vi.mock('@/components/ConfirmSheet', () => ({
  useConfirmSheet: () => ({ ConfirmEl: null, ask: askMock }),
}));

// ─── SUT ─────────────────────────────────────────────────────────────────
import { ModelBottomSheet, type ModelBottomSheetRef } from '@/components/ModelBottomSheet';

const customModel = {
  id: 'm-custom-1',
  name: 'Ana',
  body_type: 'media',
  is_custom: true,
  image_url: 'http://example/a.jpg',
} as any;

const catalogModel = {
  id: 'm-catalog-1',
  name: 'Default',
  body_type: 'media',
  is_custom: false,
  image_url: 'http://example/b.jpg',
} as any;

beforeEach(() => {
  askMock.mockReset();
  toastSuccessMock.mockReset();
  dismissMock.mockReset();
});

describe('ModelBottomSheet — F-11 delete affordance (Phase 7)', () => {
  it('hides the trash button when onDelete prop is absent', async () => {
    const ref = React.createRef<ModelBottomSheetRef>();
    const onSelect = vi.fn();
    const { queryByLabelText } = render(
      <ModelBottomSheet ref={ref} onSelect={onSelect} />,
    );
    await act(async () => {
      ref.current?.present(customModel);
    });
    expect(queryByLabelText('Deletar modelo')).toBeNull();
  });

  it('hides the trash button for non-custom catalog models even when onDelete is wired', async () => {
    const ref = React.createRef<ModelBottomSheetRef>();
    const onDelete = vi.fn();
    const { queryByLabelText } = render(
      <ModelBottomSheet ref={ref} onSelect={vi.fn()} onDelete={onDelete} />,
    );
    await act(async () => {
      ref.current?.present(catalogModel);
    });
    expect(queryByLabelText('Deletar modelo')).toBeNull();
  });

  it('renders the trash button for custom models with onDelete wired (D-01, D-05)', async () => {
    const ref = React.createRef<ModelBottomSheetRef>();
    const { queryByLabelText, getByText } = render(
      <ModelBottomSheet ref={ref} onSelect={vi.fn()} onDelete={vi.fn()} />,
    );
    await act(async () => {
      ref.current?.present(customModel);
    });
    expect(queryByLabelText('Deletar modelo')).not.toBeNull();
    expect(getByText('icon:trash')).toBeTruthy();
  });

  it('confirm=true → calls onDelete(modelId), dismisses sheet, emits toast.success (D-03)', async () => {
    askMock.mockResolvedValueOnce(true);
    const ref = React.createRef<ModelBottomSheetRef>();
    const onDelete = vi.fn();
    const { getByLabelText } = render(
      <ModelBottomSheet ref={ref} onSelect={vi.fn()} onDelete={onDelete} />,
    );
    await act(async () => {
      ref.current?.present(customModel);
    });
    await act(async () => {
      fireEvent.click(getByLabelText('Deletar modelo'));
    });
    expect(askMock).toHaveBeenCalledWith(
      expect.objectContaining({
        variant: 'danger',
        title: 'model.deleteTitle',
        message: 'model.deleteMessage',
        confirmLabel: 'common.delete',
      }),
    );
    expect(onDelete).toHaveBeenCalledWith('m-custom-1');
    expect(dismissMock).toHaveBeenCalledTimes(1);
    expect(toastSuccessMock).toHaveBeenCalledWith('model.deletedToast');
  });

  it('confirm=false → does NOT call onDelete and does NOT emit toast.success (D-03)', async () => {
    askMock.mockResolvedValueOnce(false);
    const ref = React.createRef<ModelBottomSheetRef>();
    const onDelete = vi.fn();
    const { getByLabelText } = render(
      <ModelBottomSheet ref={ref} onSelect={vi.fn()} onDelete={onDelete} />,
    );
    await act(async () => {
      ref.current?.present(customModel);
    });
    await act(async () => {
      fireEvent.click(getByLabelText('Deletar modelo'));
    });
    expect(askMock).toHaveBeenCalledTimes(1);
    expect(onDelete).not.toHaveBeenCalled();
    expect(toastSuccessMock).not.toHaveBeenCalled();
  });
});
```

If a mock signature drifts (e.g., the actual ConfirmSheet API in a later refactor returns `{ ask, ConfirmEl, dismiss }` with a different shape), update the mock to match. Goal is GREEN tests with the contract intact.
</action>

<verify>
```bash
cd crialook-app
test -f components/__tests__/ModelBottomSheet.test.tsx && echo OK
# Expect: OK

grep -c "^  it(" components/__tests__/ModelBottomSheet.test.tsx
# Expect: 5

npm test -- --run 2>&1 | tail -25
# Expect:
#   - File: components/__tests__/ModelBottomSheet.test.tsx in the report
#   - 5 tests passing in that file
#   - Overall: Test Files X passed (X) where X includes the new file
#   - Coverage thresholds satisfied
```

If any test fails, do NOT skip it. Either:
1. The 07-01 implementation drifted from the contract → fix 07-01 first.
2. A mock is wrong → fix the mock.
3. The component imports something not yet stubbed → add the mock and re-run.

Coverage may rise (additional component code is now exercised). The thresholds in vitest.config.ts (lines 29 / functions 18 / branches 23 / statements 27) are floors — rising coverage is fine. If a future PR wants to ratchet, that's a follow-up plan, not this one.
</verify>

## Files modified

- `crialook-app/components/__tests__/ModelBottomSheet.test.tsx` — NEW; 5 contract tests
- `crialook-app/vitest.config.ts` — include array adds `components/__tests__/**`

## Why this matters (risk if skipped)

Without the test, the F-11 fix from 07-01 is one accidental refactor away from regressing. The whole reason F-11 exists today is that long-press in `ModelGridCard` got repurposed for peek and nobody noticed the delete trigger silently disappeared. A contract test prevents the same drift on the new bottom-sheet trash icon.
