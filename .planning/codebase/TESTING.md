# Testing Patterns

**Analysis Date:** 2026-05-03

## Test Framework

### crialook-app (Expo Android)

**Primary Runner:**
- **Vitest** v4.1.5 for pure logic (hooks, utilities)
  - Config: `crialook-app/vitest.config.ts`
  - Environment: jsdom (Node.js + DOM simulation)
  - Test paths: `lib/__tests__/**/*.{test,spec}.{ts,tsx}`, `hooks/__tests__/**/*.{test,spec}.{ts,tsx}`

- **Jest** v29.7.0 for React Native components
  - Config: `crialook-app/jest.config.js`
  - Preset: `jest-expo`
  - Test paths: `__tests__/**/*.test.{ts,tsx}`

**Assertion Library:** 
- Vitest: built-in expect (chai-compatible)
- Jest: built-in expect

**Run Commands:**
```bash
npm run test              # Vitest watch mode
npm run test:watch       # Alias for above
npm test -- --coverage   # Vitest with coverage (runs all tests, ~35% threshold for lib/)
npm run test:rn          # Jest for React Native component tests
npm run test:rn:watch    # Jest watch mode
```

### campanha-ia (Next.js)

**Runner:**
- **Vitest** v4.1.5
  - Config: `campanha-ia/vitest.config.ts`
  - Environment: node (server-side testing, no DOM)
  - Test paths: `src/**/*.test.ts`, `src/**/*.test.tsx`, `tests/**/*.test.ts`

**Assertion Library:** 
- Built-in expect

**Run Commands:**
```bash
npm test               # Vitest watch mode
npm run test:ci         # `vitest run` (CI mode, no watch)
```

## Test File Organization

### crialook-app

**Location:**
- **Utilities/Hooks:** Co-located in `lib/__tests__/` or `hooks/__tests__/`
- **Components:** Co-located in `__tests__/` at root
- Pattern: `{feature}/__tests__/{feature}.test.ts(x)`

**Naming:**
- `*.test.ts` for utilities (e.g., `api.classify.test.ts`, `i18n.lookup.test.ts`, `logger.test.ts`)
- `*.test.tsx` for hooks/components (e.g., `useModelSelector.test.tsx`, `example-pulsing-badge.test.tsx`)
- `*.spec.ts` alternative (e.g., `reviewGate.spec.ts`)

**Example structure:**
```
crialook-app/
├── lib/
│   ├── api.ts
│   └── __tests__/
│       ├── api.classify.test.ts
│       ├── logger.test.ts
│       ├── i18n.lookup.test.ts
│       └── reviewGate.spec.ts
├── hooks/
│   ├── gerar/
│   │   └── useModelSelector.ts
│   └── __tests__/
│       ├── useModelSelector.test.tsx
│       ├── useCampaignPolling.test.ts
│       └── useImagePickerSlot.test.ts
└── __tests__/
    └── example-pulsing-badge.test.tsx
```

### campanha-ia

**Location:**
- **Libs/utils:** `src/lib/**/*.test.ts`
- **API routes:** `src/app/api/**/*.test.ts` (emerging pattern, recent additions)
- Pattern: Co-located with source code (same directory)

**Naming:**
- `*.test.ts` for all unit tests

**Example structure:**
```
campanha-ia/src/
├── lib/
│   ├── validation.ts
│   ├── validation.test.ts
│   ├── rate-limit.ts
│   ├── rate-limit.test.ts
│   ├── observability.test.ts
│   ├── mp-signature.test.ts
│   ├── editor-session.test.ts
│   ├── payments/
│   │   ├── google-play.ts
│   │   └── google-play.test.ts
│   └── ...
└── app/
    └── api/
        └── (new test pattern emerging)
```

## Test Structure

### crialook-app — Vitest Hook Test Pattern

```typescript
/**
 * Hook integration test: useModelSelector.
 *
 * Why .tsx: precisa do <QueryClientProvider> wrapper.
 * Why mockar @/lib/query-client: módulo real importa react-native-mmkv 
 * em runtime — em jsdom isso explode.
 */
import React from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/query-client', () => ({
  qk: { store: { models: () => ['store', 'models'] as const } },
}));

vi.mock('@/lib/i18n', () => ({
  t: (key: string) => (key === 'modelNames.random' ? 'Aleatório' : key),
}));

import { useModelSelector } from '../gerar/useModelSelector';

const apiFn = (globalThis as any).__apiFn as ReturnType<typeof vi.fn>;

function makeWrapper() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0, staleTime: 0 } },
  });
  const Wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client }, children);
  return Wrapper;
}

beforeEach(() => {
  apiFn.mockReset();
});

describe('useModelSelector', () => {
  it('merges bank + custom models and exposes loading', async () => {
    apiFn.mockImplementation((path: string) => {
      if (path === '/models/bank') {
        return Promise.resolve({
          models: [{ id: 'b1', name: 'Stock Ana', body_type: 'padrao' }],
        });
      }
      return Promise.resolve({ models: [] });
    });

    const { result } = renderHook(() => useModelSelector(), { 
      wrapper: makeWrapper() 
    });

    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.models[0].id).toBe('b1');
  });

  it('survives a /model/list failure', async () => {
    apiFn.mockImplementation((path: string) => {
      if (path === '/models/bank') {
        return Promise.resolve({ models: [{ id: 'b1', name: 'Stock', body_type: 'padrao' }] });
      }
      return Promise.reject(new Error('network'));
    });

    const { result } = renderHook(() => useModelSelector(), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.loading).toBe(false));

    // Bank loaded; custom failed silently. Picker must render what exists.
    expect(result.current.models.map((m) => m.id)).toEqual(['b1']);
  });
});
```

**Key patterns:**
- `beforeEach()` resets mocks between tests (isolation)
- `renderHook()` + wrapper factory for context setup
- `waitFor()` for async state updates
- `vi.fn()` mock tracking on global (tests inject via `globalThis.__apiFn`)
- Mocks use `vi.mock()` at top level before imports
- Test names describe behavior (action → expected outcome)

### campanha-ia — Vitest Unit Test Pattern

```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// Pure function test (no setup needed)
describe("isValidUuid", () => {
  it("aceita UUIDs v4 válidos", () => {
    expect(isValidUuid("550e8400-e29b-41d4-a716-446655440000")).toBe(true);
  });

  it("rejeita strings malformadas", () => {
    expect(isValidUuid("abc")).toBe(false);
    expect(isValidUuid("550e8400e29b41d4a716446655440000")).toBe(false);
  });

  it("rejeita SQL injection attempts", () => {
    expect(isValidUuid("'; DROP TABLE stores; --")).toBe(false);
  });
});

// HTTP function test with fetch mock
const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  vi.resetModules(); // clears tokenCache module-level state
  process.env = { ...ORIGINAL_ENV };
  process.env.GOOGLE_PLAY_PACKAGE_NAME = "com.crialook.app";
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  vi.restoreAllMocks();
});

describe("verifySubscription", () => {
  it("OAuth + Play API: retorna status normalizado", async () => {
    const fetchSpy = mockFetchSequence([
      { ok: true, json: { access_token: "ya29.test", expires_in: 3600 } },
      { ok: true, json: { paymentState: 1, expiryTimeMillis: "1735689600000" } },
    ]);

    const { verifySubscription } = await import("./google-play");
    const status = await verifySubscription("essencial_mensal", "purchase-token-123");

    expect(status.paymentState).toBe(1);
    expect(fetchSpy).toHaveBeenCalledTimes(2); // OAuth + Play API
  });

  it("propaga erro quando OAuth falha", async () => {
    mockFetchSequence([{ ok: false, status: 401, text: "invalid_grant" }]);

    const { verifySubscription } = await import("./google-play");
    await expect(
      verifySubscription("essencial_mensal", "tok")
    ).rejects.toThrow(/Google OAuth2 token exchange failed: 401/);
  });
});
```

**Key patterns:**
- `vi.resetModules()` clears module-level cache between tests (important for `global` state)
- Mix of pure function tests (direct assertions) and async HTTP tests (mocked fetch)
- `mockFetchSequence()` helper verifies exact call order and arguments
- `vi.restoreAllMocks()` cleanup in afterEach
- Portuguese test names (domain language matches codebase)

## Mocking

### Framework: Vitest `vi.mock()` and Jest `jest.mock()`

**crialook-app (Vitest):**

Mock placement: `crialook-app/vitest.setup.ts` (auto-loaded)

```typescript
vi.mock('react-native', () => ({
  AppState: { currentState: 'active', addEventListener: (_event, cb) => ({ remove: () => {} }) },
  Platform: { OS: 'android', select: (obj) => obj.android ?? obj.default },
}));

vi.mock('expo-secure-store', () => ({
  getItemAsync: async (k) => secureStoreMem.get(k) ?? null,
  setItemAsync: async (k, v) => secureStoreMem.set(k, String(v)),
  deleteItemAsync: async (k) => secureStoreMem.delete(k),
}));

const apiFn = vi.fn();
vi.mock('@/lib/api', () => ({
  api: apiFn,
  apiGet: apiFn,
  apiPost: apiFn,
  // tests access via (globalThis as any).__apiFn = apiFn
}));
```

**crialook-app (Jest for components):**

Mock placement: `crialook-app/jest.setup.ts` (auto-loaded)

```typescript
jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn().mockResolvedValue(null),
  setItemAsync: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('react-native-mmkv', () => {
  const store = new Map();
  return {
    MMKV: jest.fn().mockImplementation(() => ({
      getString: (k) => store.get(k) ?? null,
      set: (k, v) => store.set(k, String(v)),
    })),
  };
});
```

**campanha-ia (Vitest):**

Mock placement: Inline in test files (per-test setup)

```typescript
vi.mock("jose", () => {
  function FakeSignJWT(this: any) {
    return {
      setProtectedHeader: vi.fn(() => builder),
      setIssuer: vi.fn(() => builder),
      sign: vi.fn(async () => "FAKE.JWT.SIGNED"),
    };
  }
  return { importPKCS8: vi.fn(async () => ({})), SignJWT: FakeSignJWT };
});

vi.mock("node:fs", () => ({
  readFileSync: vi.fn(() => JSON.stringify({ client_email: "test@test.com" })),
}));
```

**What to Mock:**
- External APIs (fetch, HTTP libraries)
- Native/async modules (expo-*, react-native-*)
- Filesystem operations (node:fs)
- Environment variables (process.env in beforeEach)
- Sentry, analytics, logging (dev convenience)

**What NOT to Mock:**
- The function/hook under test itself
- Validation functions (Zod schemas, etc.)
- Business logic helpers (test the real logic)
- Pure utilities (test real output)

## Fixtures and Factories

**Test Data Approach:**

crialook-app uses `vi.fn()` stubs injected into `globalThis`:
```typescript
const apiFn = (globalThis as any).__apiFn as ReturnType<typeof vi.fn>;

beforeEach(() => {
  apiFn.mockReset();
});

apiFn.mockImplementation((path: string) => {
  if (path === '/models/bank') {
    return Promise.resolve({ models: [{ id: 'b1', name: 'Stock Ana' }] });
  }
  if (path === '/model/list') {
    return Promise.resolve({ models: [{ id: 'c1', name: 'My Model' }] });
  }
  return Promise.resolve({ models: [] });
});
```

campanha-ia uses inline mock responses:
```typescript
function mockFetchSequence(responses: MockResponse[]) {
  let idx = 0;
  const fn = vi.fn(async () => {
    const r = responses[idx++];
    return {
      ok: r.ok ?? true,
      status: r.status ?? 200,
      json: async () => r.json,
      text: async () => r.text ?? "",
    } as Response;
  });
  globalThis.fetch = fn as unknown as typeof globalThis.fetch;
  return fn;
}
```

**Location:**
- No separate fixture files; factories inline in test suites
- Test data is mock response shapes (API responses, DB records)
- Complex nested objects: define inline or extract to const at top of describe block

## Coverage

### crialook-app

**Configuration** (`vitest.config.ts`):
```typescript
coverage: {
  provider: 'v8',
  reporter: ['text', 'html'],
  include: ['lib/**/*.{ts,tsx}', 'hooks/**/*.{ts,tsx}'],
  exclude: ['**/*.test.*', '**/__tests__/**', '**/node_modules/**'],
  thresholds: {
    lines: 35,
    functions: 35,
    branches: 30,
    statements: 35,
  },
}
```

**Run:**
```bash
npm test -- --coverage
```

**Thresholds:** 35% lines/functions/statements, 30% branches (floor, not enforced in CI yet — cobertura inicial baixa em telas RN)

### campanha-ia

**Configuration** (`vitest.config.ts`):
```typescript
coverage: {
  provider: 'v8',
  reporter: ['text', 'html'],
  include: ['src/lib/**/*.ts', 'src/app/api/**/*.ts'],
  exclude: ['**/*.test.*', '**/__tests__/**', '**/*.types.ts', '**/node_modules/**'],
  thresholds: {
    lines: 30,
    functions: 30,
    branches: 25,
    statements: 30,
  },
}
```

**Note:** `src/lib/` has good coverage in validation/rate-limit/mercadopago-signature; `src/app/api/` is weak (webhooks + billing need tests).

## CI/CD Test Runs

**GitHub Actions** (`.github/workflows/ci.yml`):

### crialook-app
```yaml
mobile-typecheck-test:
  runs-on: ubuntu-latest
  working-directory: crialook-app
  steps:
    - Install dependencies: npm ci --legacy-peer-deps
    - Type-check: npm run typecheck
    - Run vitest (lib utils): npm test
```

No jest component tests in CI yet (would require Android SDK or Detox setup).

### campanha-ia
```yaml
lint-typecheck-build:
  working-directory: campanha-ia
  steps:
    - npm ci
    - npm run lint
    - npx tsc --noEmit
    - npm run build (with placeholder env vars)

test:
  working-directory: campanha-ia
  steps:
    - npm ci
    - npm test --if-present -- --run
```

**Node version:** 24 (specified in actions/setup-node)
**Cache:** npm dependencies cached per job

## Test Types

### Unit Tests

**crialook-app:**
- `lib/__tests__/` utilities: pure functions, validation, caching, i18n lookup
- `hooks/__tests__/` hooks: state management, API interaction, TanStack Query patterns
- Example: `useModelSelector.test.tsx` tests filtering, merging, error recovery

**campanha-ia:**
- `src/lib/` functions: validation, rate-limiting, Mercado Pago signatures, Google Play API clients, observability
- Examples: `validation.test.ts` (UUID validation, SQL injection), `google-play.test.ts` (OAuth + Play API integration)

### Integration Tests

**crialook-app:**
- Hook tests with QueryClientProvider wrapper (simulates React Query integration)
- Tests verify hook behavior under real async conditions (mocked API, real state machine)

**campanha-ia:**
- API route tests (emerging pattern): mock fetch, verify request shape + response handling
- Example: `verifySubscription()` test chains OAuth token exchange → Play API GET → assertions on normalized response

### E2E Tests

Not present in codebase. Mobile (crialook-app) would require Detox or similar; web (campanha-ia) could use Playwright but none configured.

## Common Patterns

### Async Testing (crialook-app)

```typescript
describe('async state', () => {
  it('handles promise resolution', async () => {
    apiFn.mockResolvedValue({ data: 'test' });
    const { result } = renderHook(() => useMyHook());

    // Initially loading
    expect(result.current.loading).toBe(true);

    // Wait for async operation
    await waitFor(() => expect(result.current.loading).toBe(false));

    // Assert final state
    expect(result.current.data).toEqual({ data: 'test' });
  });

  it('handles promise rejection', async () => {
    apiFn.mockRejectedValue(new Error('network'));
    const { result } = renderHook(() => useMyHook());

    await waitFor(() => expect(result.current.error).toBeDefined());
    expect(result.current.error.message).toBe('network');
  });
});
```

### Error Testing (campanha-ia)

```typescript
describe('error cases', () => {
  it('validates input and rejects invalid data', () => {
    expect(() => parsePayload(null)).toThrow('Invalid payload');
    expect(() => parsePayload({})).toThrow('Missing required fields');
  });

  it('propagates HTTP errors with status codes', async () => {
    mockFetchSequence([
      { ok: false, status: 500, text: 'Internal error' },
    ]);

    await expect(someApiCall()).rejects.toThrow(/API failed: 500/);
  });

  it('is idempotent — 410 Gone is not an error', async () => {
    mockFetchSequence([{ ok: false, status: 410, text: 'already processed' }]);

    // Should NOT throw
    await expect(acknowledgeSubscription(...)).resolves.toBeUndefined();
  });
});
```

### Mocking Module-Level State

```typescript
beforeEach(() => {
  vi.resetModules(); // Clears module cache + tokenCache singleton
  process.env = { ...ORIGINAL_ENV };
});

afterEach(() => {
  vi.restoreAllMocks();
  process.env = { ...ORIGINAL_ENV };
});

describe('stateful operation', () => {
  it('caches token between calls', async () => {
    const fetchSpy = mockFetchSequence([
      { ok: true, json: { access_token: 'ya29.cached', expires_in: 3600 } },
      { ok: true, json: { paymentState: 1 } },
      { ok: true, status: 200, json: {} },
    ]);

    const { verifySubscription, acknowledgeSubscription } = await import('./google-play');
    await verifySubscription('sku1', 'tok1');
    await acknowledgeSubscription('sku1', 'tok1');

    // 1 OAuth + 2 Play calls = 3 fetches (if no cache, would be 4)
    expect(fetchSpy).toHaveBeenCalledTimes(3);
  });
});
```

## Recent Additions

**crialook-app:**
- `hooks/__tests__/useModelSelector.test.tsx` — comprehensive hook test with QueryClient wrapper, multi-source data merging, filter logic
- `hooks/__tests__/useCampaignPolling.test.ts` — polling behavior testing
- `lib/__tests__/reviewGate.spec.ts` — using .spec extension alternative

**campanha-ia:**
- `src/lib/payments/google-play.test.ts` — new client for Google Play Developer API (commit 8577f83), detailed tests for:
  - Pure functions (SKU validation, plan mapping, env config detection)
  - HTTP functions (OAuth token exchange, Play API verify/acknowledge/cancel)
  - Fetch mocking with response sequencing
  - Token caching behavior
  - URL encoding for security (path traversal protection)
  - Idempotency (410 Gone handling)

---

*Testing analysis: 2026-05-03*
