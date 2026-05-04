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
 *   - expo-linear-gradient → simple stub (the gradient pulls in native deps).
 */
import React from 'react';
import { Text } from 'react-native';
import { render, screen } from '@testing-library/react-native';

const mockCaptureException: jest.Mock = jest.fn(() => 'evt_12345');
jest.mock('@/lib/sentry', () => ({
  Sentry: {
    captureException: (error: Error, options?: unknown) => mockCaptureException(error, options),
    addBreadcrumb: jest.fn(),
    captureMessage: jest.fn(),
    wrap: (c: unknown) => c,
  },
  initSentry: jest.fn(),
  setSentryUser: jest.fn(),
  withSpan: async <T,>(_n: string, _o: string, fn: () => Promise<T>) => fn(),
}));

jest.mock('expo-linear-gradient', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    LinearGradient: ({ children, style }: { children?: React.ReactNode; style?: unknown }) =>
      React.createElement(View, { style }, children),
  };
});

import { AppErrorBoundary } from '@/components/ErrorBoundary';

// Component that throws on first render — drives the boundary.
function Bomb({ message = 'kaboom' }: { message?: string }): React.ReactElement {
  throw new Error(message);
}

beforeEach(() => {
  mockCaptureException.mockClear();
  // Suppress React's "consider adding error boundary" log during tests.
  jest.spyOn(console, 'error').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  (console.error as jest.Mock).mockRestore?.();
  (console.warn as jest.Mock).mockRestore?.();
});

describe('AppErrorBoundary', () => {
  it('renders children when no error', () => {
    render(
      <AppErrorBoundary>
        <Text>healthy child</Text>
      </AppErrorBoundary>,
    );
    expect(screen.getByText('healthy child')).toBeOnTheScreen();
  });

  it('renders fallback UI title "Algo deu errado" when a child throws', () => {
    render(
      <AppErrorBoundary>
        <Bomb />
      </AppErrorBoundary>,
    );
    // Title comes from i18n key errorBoundary.title — pt-BR is the default
    // locale resolved by lib/i18n at module init.
    expect(screen.getByText('Algo deu errado')).toBeOnTheScreen();
  });

  it('calls Sentry.captureException in componentDidCatch with the thrown Error', () => {
    render(
      <AppErrorBoundary>
        <Bomb message="specific kaboom" />
      </AppErrorBoundary>,
    );
    expect(mockCaptureException).toHaveBeenCalledTimes(1);
    const callArgs = mockCaptureException.mock.calls[0] as unknown as [Error, { contexts?: { react?: { componentStack?: string } } }];
    const [errorArg, optionsArg] = callArgs;
    expect(errorArg).toBeInstanceOf(Error);
    expect(errorArg.message).toBe('specific kaboom');
    // The boundary attaches the React component stack to the Sentry context.
    expect(optionsArg?.contexts?.react?.componentStack).toBeDefined();
  });
});
