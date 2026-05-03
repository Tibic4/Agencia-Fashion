/**
 * RegenerateReasonPicker — D-11 contract test (Phase 02).
 *
 * Renders the picker in jsdom by stubbing:
 *   - @gorhom/bottom-sheet  → renders children inline (Modal/Backdrop/View
 *                              are no-ops). The presentation layer is
 *                              integration-tested manually on Android.
 *   - react-native primitives → mapped to plain DOM nodes so
 *                                @testing-library/react can fire pointer
 *                                events on them. The vitest.setup.ts global
 *                                react-native stub lacks View/Pressable/Text
 *                                because the existing useModelSelector tests
 *                                only need AppState/Platform.
 *   - @expo/vector-icons   → text node showing the icon name (so a11y
 *                              labels and row counts assert cleanly).
 *
 * What this proves:
 *   1. With visible=true, picker renders 5 reason rows + 1 cancel row.
 *   2. Each PT-BR label maps 1:1 to the correct backend enum value.
 *   3. Cancel calls onCancel and never calls onSelect.
 *   4. Each reason row exposes a button role with the PT-BR label as a11y label.
 */
import React from 'react';
import { render, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';

// ─── react-native primitive stubs (DOM-friendly) ───────────────────────────
vi.mock('react-native', () => {
  const React = require('react');

  // RN accepts `style={[a, b, false && c]}` arrays. react-dom does not.
  // Flatten + filter falsy + drop unknown DOM props to avoid noise.
  function flattenStyle(s: any): Record<string, any> {
    if (!s) return {};
    if (Array.isArray(s)) {
      return s.reduce<Record<string, any>>((acc, item) => Object.assign(acc, flattenStyle(item)), {});
    }
    if (typeof s === 'object') return s;
    return {};
  }

  function makeComp(tag: string) {
    return ({
      children,
      onPress,
      accessibilityRole,
      accessibilityLabel,
      testID,
      style,
      // RN-only props that DOM doesn't grok — drop them.
      android_ripple: _ripple,
      ...rest
    }: any) => {
      const handler = onPress ? { onClick: (e: any) => onPress(e) } : {};
      return React.createElement(
        tag,
        {
          'data-testid': testID,
          'data-role': accessibilityRole,
          'aria-label': accessibilityLabel,
          // Render style as data-* so jsdom doesn't try to parse RN units.
          'data-style': JSON.stringify(flattenStyle(style)),
          ...handler,
          ...rest,
        },
        children,
      );
    };
  }

  return {
    View: makeComp('div'),
    Text: makeComp('span'),
    Pressable: makeComp('button'),
    StyleSheet: { create: (s: any) => s, hairlineWidth: 1, absoluteFill: {} },
    Platform: { OS: 'android', select: (o: any) => o.android ?? o.default },
  };
});

// ─── @gorhom/bottom-sheet stub ─────────────────────────────────────────────
// Phase 02 strategy: render-children pass-through. The real BottomSheetModal
// uses native deps (Reanimated worklets + RNGH) that don't load in jsdom.
// We assert behavior at the props level here; visual validation is the
// manual smoke step in the plan's verification block.
vi.mock('@gorhom/bottom-sheet', () => {
  const React = require('react');
  return {
    __esModule: true,
    BottomSheetModal: React.forwardRef(({ children }: any, ref: any) => {
      // Imperative ref API used by the picker — present + dismiss are no-ops.
      React.useImperativeHandle(ref, () => ({ present: () => {}, dismiss: () => {} }));
      return React.createElement('div', { 'data-testid': 'bottom-sheet-modal' }, children);
    }),
    BottomSheetBackdrop: () => null,
    BottomSheetView: ({ children }: any) =>
      React.createElement('div', { 'data-testid': 'bottom-sheet-view' }, children),
    BottomSheetModalProvider: ({ children }: any) =>
      React.createElement('div', null, children),
    default: () => null,
  };
});

// ─── @expo/vector-icons stub ───────────────────────────────────────────────
vi.mock('@expo/vector-icons/FontAwesome', () => {
  const React = require('react');
  const Comp = ({ name }: any) =>
    React.createElement('i', { 'data-icon': name }, null);
  return { __esModule: true, default: Comp };
});

// ─── Theme/colors/safe-area shims ──────────────────────────────────────────
vi.mock('@/constants/Colors', () => ({
  default: {
    light: { text: '#000', textSecondary: '#666', border: '#ccc', card: '#fff' },
    dark: { text: '#fff', textSecondary: '#999', border: '#333', card: '#000' },
    brand: { error: '#ef4444', primary: '#ec4899' },
  },
}));

vi.mock('@/components/useColorScheme', () => ({
  useColorScheme: () => 'light',
}));

vi.mock('@/lib/theme/tokens', () => ({
  tokens: {
    spacing: {
      xxs: 2, xs: 4, sm: 8, md: 12, mdLg: 14, lg: 16, xl: 20, xxl: 24, xxxl: 32, huge: 48,
    },
    radii: { sm: 4, md: 8, lg: 12, xl: 16, xxl: 20, xxxl: 24, full: 9999 },
    fontSize: { xs: 11, sm: 13, base: 15, md: 14, lg: 17, xl: 18, xxl: 20, xxxl: 24, displayLg: 32 },
    fontWeight: { medium: '500', semibold: '600', bold: '700', black: '900' },
  },
  rounded: (r: number) => ({ borderRadius: r }),
}));

vi.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

import { RegenerateReasonPicker } from '../RegenerateReasonPicker';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('RegenerateReasonPicker', () => {
  it('Test 1 — renders 5 reason rows + 1 cancel row when visible', () => {
    const { getAllByRole } = render(
      <RegenerateReasonPicker
        visible={true}
        onSelect={() => {}}
        onCancel={() => {}}
      />,
    );

    const buttons = getAllByRole('button');
    // 5 reason rows + 1 cancel row.
    expect(buttons.length).toBe(6);

    const labels = buttons.map((b) => b.getAttribute('aria-label'));
    expect(labels).toEqual([
      'Rosto errado',
      'Peça errada',
      'Texto ruim',
      'Pose errada',
      'Outro motivo',
      'Cancelar',
    ]);
  });

  it('Test 2 — each PT-BR label maps to the correct backend enum value', () => {
    const onSelect = vi.fn();
    const { getByLabelText } = render(
      <RegenerateReasonPicker visible={true} onSelect={onSelect} onCancel={() => {}} />,
    );

    fireEvent.click(getByLabelText('Rosto errado'));
    fireEvent.click(getByLabelText('Peça errada'));
    fireEvent.click(getByLabelText('Texto ruim'));
    fireEvent.click(getByLabelText('Pose errada'));
    fireEvent.click(getByLabelText('Outro motivo'));

    expect(onSelect).toHaveBeenCalledTimes(5);
    expect(onSelect.mock.calls.map((c) => c[0])).toEqual([
      'face_wrong',
      'garment_wrong',
      'copy_wrong',
      'pose_wrong',
      'other',
    ]);
  });

  it('Test 3 — Cancelar fires onCancel and never onSelect', () => {
    const onSelect = vi.fn();
    const onCancel = vi.fn();
    const { getByLabelText } = render(
      <RegenerateReasonPicker visible={true} onSelect={onSelect} onCancel={onCancel} />,
    );

    fireEvent.click(getByLabelText('Cancelar'));

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('Test 4 — every reason row exposes role=button + aria-label', () => {
    const { getAllByRole } = render(
      <RegenerateReasonPicker visible={true} onSelect={() => {}} onCancel={() => {}} />,
    );

    const buttons = getAllByRole('button');
    for (const b of buttons) {
      // Each row must be a button with a non-empty a11y label.
      expect(b.getAttribute('aria-label')).toBeTruthy();
    }
  });
});
