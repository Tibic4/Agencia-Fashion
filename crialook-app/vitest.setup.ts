/**
 * Vitest setup. Mocks the React Native universe so we can renderHook on
 * pure-logic hooks (state machines + effects + listeners) in a Node/jsdom
 * environment, without bundling Metro or Flow source.
 *
 * What we mock:
 *   - react-native           → AppState/Alert/Platform stubs
 *   - expo-image-picker      → no real picker; tests drive responses
 *   - expo-camera            → not loaded by hooks under test
 *   - expo-secure-store      → in-memory map
 *   - expo-haptics           → no-ops
 *   - expo-localization      → fixed pt-BR
 *   - i18n string lookup is real (lib/i18n/strings.ts is plain JS data)
 *   - Sentry/api/auth/images → minimal shims
 *
 * The hook code itself is unmocked — that's what we're testing.
 */
import { vi } from 'vitest';

// ── react-native ────────────────────────────────────────────────────────
const appStateListeners = new Set<(state: string) => void>();

vi.mock('react-native', () => ({
  AppState: {
    currentState: 'active',
    addEventListener: (_event: string, cb: (state: string) => void) => {
      appStateListeners.add(cb);
      return { remove: () => appStateListeners.delete(cb) };
    },
  },
  Platform: { OS: 'android', select: (obj: any) => obj.android ?? obj.default },
  Alert: { alert: vi.fn() },
}));

// Helper exposed to tests via dynamic import to drive AppState transitions.
(globalThis as any).__emitAppState = (state: string) => {
  for (const cb of appStateListeners) cb(state);
};

// ── expo-* native modules ──────────────────────────────────────────────
vi.mock('expo-image-picker', () => ({
  launchImageLibraryAsync: vi.fn(),
  launchCameraAsync: vi.fn(),
}));

vi.mock('expo-haptics', () => ({
  impactAsync: vi.fn(),
  notificationAsync: vi.fn(),
  ImpactFeedbackStyle: { Light: 'Light', Medium: 'Medium', Heavy: 'Heavy' },
  NotificationFeedbackType: { Success: 'Success', Warning: 'Warning', Error: 'Error' },
}));

const secureStoreMem = new Map<string, string>();
vi.mock('expo-secure-store', () => ({
  getItemAsync: async (k: string) => secureStoreMem.get(k) ?? null,
  setItemAsync: async (k: string, v: string) => {
    secureStoreMem.set(k, v);
  },
  deleteItemAsync: async (k: string) => {
    secureStoreMem.delete(k);
  },
}));

vi.mock('expo-localization', () => ({
  getLocales: () => [{ languageCode: 'pt' }],
}));

vi.mock('expo-image-manipulator', () => ({
  manipulateAsync: vi.fn(async (uri: string) => ({ uri: `${uri}#compressed` })),
  SaveFormat: { JPEG: 'jpeg' },
}));

// ── App-level shims ────────────────────────────────────────────────────
vi.mock('@/lib/sentry', () => ({
  initSentry: vi.fn(),
  setSentryUser: vi.fn(),
  captureError: vi.fn(),
  captureMessage: vi.fn(),
  withSpan: async <T,>(_n: string, _o: string, fn: () => Promise<T>) => fn(),
  Sentry: { wrap: <T,>(c: T) => c },
}));

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  sanitizeForLog: (v: unknown) => v,
}));

vi.mock('@/lib/auth', () => ({
  getAuthToken: async () => 'test-token',
}));

// In-memory cache shim. Works for read/write/invalidate but doesn't persist.
const cacheMem = new Map<string, unknown>();
vi.mock('@/lib/cache', () => ({
  readCache: async (k: string) => (cacheMem.has(k) ? cacheMem.get(k) : null),
  writeCache: async (k: string, v: unknown) => {
    cacheMem.set(k, v);
  },
  invalidateCache: async (k: string) => {
    cacheMem.delete(k);
  },
  invalidateAll: async () => cacheMem.clear(),
  withCache: async <T,>(_k: string, _ttl: number, fn: () => Promise<T>) => fn(),
}));

// apiGet/apiGetCached default to a vi.fn so tests can override per-suite.
const apiFn = vi.fn();
vi.mock('@/lib/api', () => ({
  api: apiFn,
  apiGet: apiFn,
  apiGetCached: apiFn,
  apiPost: apiFn,
  apiPatch: apiFn,
  apiDelete: apiFn,
  invalidateApiCache: async () => {
    /* no-op for tests */
  },
}));

(globalThis as any).__apiFn = apiFn;

// __DEV__ flag the app code branches on.
(globalThis as any).__DEV__ = false;

// jsdom doesn't ship fetch — a stub is enough; tests that need network
// override globalThis.fetch directly.
if (!('fetch' in globalThis)) {
  (globalThis as any).fetch = vi.fn();
}
