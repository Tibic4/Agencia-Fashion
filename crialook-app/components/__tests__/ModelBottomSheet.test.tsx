/**
 * ModelBottomSheet — Phase 7 F-11 delete-affordance contract test.
 *
 * Proves D-01..D-05:
 *   1. Trash icon hidden when onDelete absent.
 *   2. Trash icon hidden for non-custom models (gating).
 *   3. Trash icon visible for custom models with onDelete wired.
 *   4. Confirm=true → onDelete(modelId) + dismiss + toast.success.
 *   5. Confirm=false → no onDelete, no toast.
 *
 * Mocking strategy mirrors components/historico/__tests__/RegenerateReasonPicker.test.tsx:
 *   - @gorhom/bottom-sheet → render children inline; ref exposes
 *     present/dismiss; dismiss is a hoisted vi.fn() the test asserts on.
 *   - react-native primitives → DOM equivalents.
 *   - @expo/vector-icons/FontAwesome → text node showing the icon name
 *     ("icon:trash" so the tree assertion is grep-able).
 *   - reanimated/gesture-handler/skia/blur/linear-gradient/expo-image
 *     → minimal stubs (none of them are exercised by the trash-icon path).
 *   - ConfirmSheet.useConfirmSheet → ask is a hoisted vi.fn() the test
 *     resolves to true/false to drive the two confirm branches.
 *   - lib/toast.toast.success → hoisted vi.fn() asserted on per branch.
 *   - lib/i18n.useT → t(k) returns k for legible assertion strings.
 */
import React from 'react';
import { render, fireEvent, act } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';

// ─── Hoisted mocks (must be defined before vi.mock factories run) ────────
const { askMock, toastSuccessMock, dismissMock } = vi.hoisted(() => ({
  askMock: vi.fn(),
  toastSuccessMock: vi.fn(),
  dismissMock: vi.fn(),
}));

// ─── react-native primitive stubs (DOM-friendly) ─────────────────────────
vi.mock('react-native', () => {
  const ReactLib = require('react');
  const flattenStyle = (s: any): any => {
    if (!s) return {};
    if (Array.isArray(s)) {
      return s.reduce((acc: any, item: any) => Object.assign(acc, flattenStyle(item)), {});
    }
    if (typeof s === 'object') return s;
    return {};
  };
  const makeComp = (tag: string) => (props: any) => {
    const {
      children,
      onPress,
      accessibilityRole,
      accessibilityLabel,
      testID,
      style,
      hitSlop: _hitSlop,
      pointerEvents: _pe,
      ...rest
    } = props || {};
    const handler = onPress ? { onClick: (e: any) => onPress(e) } : {};
    return ReactLib.createElement(
      tag,
      {
        'data-testid': testID,
        'data-role': accessibilityRole,
        'aria-label': accessibilityLabel,
        'data-style': JSON.stringify(flattenStyle(style)),
        ...handler,
        ...rest,
      },
      children,
    );
  };
  return {
    View: makeComp('div'),
    Text: makeComp('span'),
    Pressable: makeComp('button'),
    StyleSheet: {
      create: (s: any) => s,
      hairlineWidth: 1,
      absoluteFill: {},
      absoluteFillObject: {},
    },
    Platform: { OS: 'android', select: (o: any) => o.android ?? o.default },
    useWindowDimensions: () => ({ width: 360, height: 720 }),
  };
});

// ─── @gorhom/bottom-sheet — render children inline ───────────────────────
vi.mock('@gorhom/bottom-sheet', () => {
  const ReactLib = require('react');
  const Pass = (props: any) => ReactLib.createElement('div', null, props.children);
  return {
    __esModule: true,
    BottomSheetModal: ReactLib.forwardRef((props: any, ref: any) => {
      ReactLib.useImperativeHandle(ref, () => ({
        present: () => {},
        dismiss: dismissMock,
      }));
      return ReactLib.createElement('div', { 'data-testid': 'bottom-sheet-modal' }, props.children);
    }),
    BottomSheetBackdrop: Pass,
    BottomSheetScrollView: Pass,
    BottomSheetView: Pass,
  };
});

// ─── expo-haptics — global setup mock returns undefined; SUT calls
//     Haptics.impactAsync(...).catch(noop). Override locally with a
//     resolved Promise so the .catch() does not throw.
vi.mock('expo-haptics', () => ({
  impactAsync: vi.fn().mockResolvedValue(undefined),
  notificationAsync: vi.fn().mockResolvedValue(undefined),
  ImpactFeedbackStyle: { Light: 'Light', Medium: 'Medium', Heavy: 'Heavy' },
  NotificationFeedbackType: { Success: 'Success', Warning: 'Warning', Error: 'Error' },
}));

// ─── expo-image / expo-blur / expo-linear-gradient ───────────────────────
vi.mock('expo-image', () => ({
  Image: (props: any) => require('react').createElement('img', { src: props.source && props.source.uri, alt: '' }),
}));
vi.mock('expo-blur', () => ({
  BlurView: (props: any) => require('react').createElement('div', null, props.children),
}));
vi.mock('expo-linear-gradient', () => ({
  LinearGradient: (props: any) => require('react').createElement('div', null, props.children),
}));

// ─── react-native-gesture-handler ────────────────────────────────────────
vi.mock('react-native-gesture-handler', () => {
  // Chainable proxy: every property access returns a callable proxy that,
  // when called, returns itself. Supports `Gesture.Pan().minPointers(1)
  // .maxPointers(2).onUpdate(fn).onEnd(fn)` without enumerating method names.
  const makeChain = (): any => {
    const target: any = function () {
      return target;
    };
    return new Proxy(target, {
      get: (_t, key) => {
        if (key === 'then') return undefined; // not a thenable
        if (key === Symbol.toPrimitive) return undefined;
        return makeChain();
      },
      apply: () => makeChain(),
    });
  };
  return {
    Gesture: {
      Pinch: () => makeChain(),
      Tap: () => makeChain(),
      Pan: () => makeChain(),
      Simultaneous: () => ({}),
    },
    GestureDetector: (props: any) =>
      require('react').createElement(require('react').Fragment, null, props.children),
  };
});

// ─── react-native-reanimated ─────────────────────────────────────────────
vi.mock('react-native-reanimated', () => {
  const ReactLib = require('react');
  return {
    __esModule: true,
    default: {
      View: (props: any) => ReactLib.createElement('div', null, props.children),
      createAnimatedComponent: (c: any) => c,
    },
    useAnimatedStyle: () => ({}),
    useSharedValue: (v: any) => ({ value: v }),
    withSpring: (v: any) => v,
    withTiming: (v: any) => v,
    runOnJS: (fn: any) => fn,
  };
});

// ─── @expo/vector-icons (FontAwesome via the deep import path) ──────────
vi.mock('@expo/vector-icons/FontAwesome', () => ({
  __esModule: true,
  default: (props: any) => require('react').createElement('span', null, 'icon:' + props.name),
}));

// ─── App-internal mocks ──────────────────────────────────────────────────
vi.mock('@/components/skia', () => ({ AuraGlow: () => null }));
vi.mock('@/components/useColorScheme', () => ({ useColorScheme: () => 'light' }));
vi.mock('@/constants/Colors', () => ({
  __esModule: true,
  default: {
    light: {
      card: '#fff',
      text: '#000',
      textSecondary: '#666',
      border: '#eee',
      background: '#fff',
    },
    dark: {
      card: '#000',
      text: '#fff',
      textSecondary: '#999',
      border: '#333',
      background: '#000',
    },
    brand: {
      primary: '#D946EF',
      secondary: '#EC4899',
      error: '#EF4444',
      gradientPrimary: ['#EC4899', '#D946EF', '#A855F7'],
    },
  },
}));
vi.mock('@/lib/theme/tokens', () => ({
  tokens: {
    fontWeight: { semibold: '600', bold: '700' },
    radii: { full: 9999, xxxl: 24, sm: 4, md: 8, lg: 12, xl: 16 },
    spacing: { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32 },
  },
  rounded: (r: number) => ({ borderRadius: r }),
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
vi.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

// ─── SUT ─────────────────────────────────────────────────────────────────
import { ModelBottomSheet } from '@/components/ModelBottomSheet';
import type { ModelBottomSheetRef } from '@/components/ModelBottomSheet';

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
    const { queryByLabelText } = render(
      <ModelBottomSheet ref={ref} onSelect={vi.fn()} />,
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
