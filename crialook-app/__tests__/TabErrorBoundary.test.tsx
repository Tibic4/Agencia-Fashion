/**
 * TabErrorBoundary.test.tsx — coverage for per-tab boundary + plan 06-07
 * regression lock-in (production hides error.message).
 *
 * Verifies:
 *   - Renders children when no error.
 *   - Renders fallback with title "Esta tela travou".
 *   - Calls Sentry.captureException with screen tag + scope.
 *   - In non-DEV (__DEV__ === false) the error.message is NOT visible.
 *   - In __DEV__ true the error.message IS visible (dev-only debug surface).
 *
 * Mocks:
 *   - @/lib/sentry → captureException is jest.fn().
 */
import React from 'react';
import { Text } from 'react-native';
import { render, screen } from '@testing-library/react-native';

const mockCaptureException: jest.Mock = jest.fn();
jest.mock('@/lib/sentry', () => ({
  Sentry: {
    captureException: (error: Error, options?: unknown) => mockCaptureException(error, options),
    addBreadcrumb: jest.fn(),
    captureMessage: jest.fn(),
    wrap: (c: unknown) => c,
  },
  initSentry: jest.fn(),
  withSpan: async <T,>(_n: string, _o: string, fn: () => Promise<T>) => fn(),
}));

import { TabErrorBoundary } from '@/components/TabErrorBoundary';

function Bomb({ message = 'tab kaboom' }: { message?: string }): React.ReactElement {
  throw new Error(message);
}

beforeEach(() => {
  mockCaptureException.mockClear();
  jest.spyOn(console, 'error').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  (console.error as jest.Mock).mockRestore?.();
  (console.warn as jest.Mock).mockRestore?.();
});

describe('TabErrorBoundary', () => {
  it('renders children when no error', () => {
    render(
      <TabErrorBoundary screen="historico">
        <Text>healthy tab</Text>
      </TabErrorBoundary>,
    );
    expect(screen.getByText('healthy tab')).toBeOnTheScreen();
  });

  it('renders fallback title "Esta tela travou" when a child throws', () => {
    render(
      <TabErrorBoundary screen="historico">
        <Bomb />
      </TabErrorBoundary>,
    );
    expect(screen.getByText('Esta tela travou')).toBeOnTheScreen();
  });

  it('calls Sentry.captureException with the screen tag + tab-boundary scope', () => {
    render(
      <TabErrorBoundary screen="historico">
        <Bomb message="specific tab kaboom" />
      </TabErrorBoundary>,
    );
    expect(mockCaptureException).toHaveBeenCalledTimes(1);
    const callArgs = mockCaptureException.mock.calls[0] as unknown as [
      Error,
      { tags?: Record<string, string>; contexts?: { react?: { componentStack?: string } } },
    ];
    const [errorArg, optionsArg] = callArgs;
    expect(errorArg).toBeInstanceOf(Error);
    expect(errorArg.message).toBe('specific tab kaboom');
    expect(optionsArg?.tags).toMatchObject({
      screen: 'historico',
      scope: 'tab-boundary',
    });
    expect(optionsArg?.contexts?.react?.componentStack).toBeDefined();
  });

  describe('plan 06-07 regression lock — production hides error.message', () => {
    let originalDev: unknown;

    beforeEach(() => {
      originalDev = (global as { __DEV__?: boolean }).__DEV__;
      (global as { __DEV__?: boolean }).__DEV__ = false;
    });

    afterEach(() => {
      (global as { __DEV__?: unknown }).__DEV__ = originalDev;
    });

    it('does NOT render error.message text when __DEV__ is false', () => {
      render(
        <TabErrorBoundary screen="historico">
          <Bomb message="SECRET INTERNAL ERROR /api/internal/foo" />
        </TabErrorBoundary>,
      );
      expect(screen.getByText('Esta tela travou')).toBeOnTheScreen();
      expect(screen.queryByText(/SECRET INTERNAL ERROR/i)).toBeNull();
    });

    it('DOES render error.message when __DEV__ is true (dev-only debug surface)', () => {
      (global as { __DEV__?: boolean }).__DEV__ = true;
      render(
        <TabErrorBoundary screen="historico">
          <Bomb message="DEV VISIBLE ERROR" />
        </TabErrorBoundary>,
      );
      expect(screen.queryByText(/DEV VISIBLE ERROR/i)).toBeOnTheScreen();
    });
  });
});
