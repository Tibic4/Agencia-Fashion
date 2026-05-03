# Coding Conventions

**Analysis Date:** 2026-05-03

## Naming Patterns

**Files:**
- **Components:** PascalCase (e.g., `AppHeader.tsx`, `CameraCaptureModal.tsx`, `BeforeAfterSlider.tsx`)
- **Hooks:** camelCase with `use` prefix (e.g., `useModelSelector.ts`, `useHeaderHeight()`, `useCampaignPolling.test.ts`)
- **Utils/lib:** camelCase (e.g., `api.ts`, `logger.ts`, `validation.ts`, `rate-limit.ts`)
- **Routes (Next.js):** Follows Next.js conventions with bracket notation (e.g., `src/app/api/admin/plans/route.ts`, `[id]/regenerate/route.ts`)
- **Screens (Expo Router):** Lowercase with hyphens (e.g., `(tabs)/gerar/index.tsx`, `(legal)/privacidade.tsx`)

**Functions:**
- camelCase for functions and methods
- Verb-noun pattern for actions (e.g., `getAuthToken()`, `invalidateCache()`, `sanitizeForLog()`)
- Prefix `use` for React hooks (e.g., `useModelSelector`, `useHeaderHeight`)
- Utility helpers exported as named functions (e.g., `export function isValidUuid()`, `export function badRequest()`)

**Variables:**
- camelCase for variables and constants
- SCREAMING_SNAKE_CASE for module-level constants (e.g., `DEFAULT_TIMEOUT_MS = 60_000`, `ANON_HOURLY_LIMIT = 3`, `HEADER_HEIGHT = 56`)
- Underscore prefix for unused parameters (e.g., `_n: string`, `_o: string`, `_install_exclude_reason`) to satisfy linters
- Map/Set instance variables use descriptive names (e.g., `hourlyMap`, `dailyMap`, `secureStoreMem`, `appStateListeners`)

**Types:**
- PascalCase for interfaces and type aliases (e.g., `type ModelItem`, `interface UseModelSelectorResult`, `interface RateEntry`)
- Type-suffixed names when needed for clarity (e.g., `type ModelFilter`, `type ThemeMode`, `type ApiErrorCode`)

## Code Style

**Formatting:**
- No Prettier config file detected — code follows standard JavaScript formatting
- Consistent indentation: 2 spaces (visible in all config files and source)
- Line length: No strict enforcement detected; ranges from ~80–100 characters in most files
- Semicolons: Always present (enforced implicitly by convention)
- Trailing commas: Used in multi-line structures (arrays, objects, function parameters)

**Linting:**
- **campanha-ia:** ESLint v9 with Next.js config (`eslint.config.mjs`)
  - Core: `eslint-config-next/core-web-vitals` + `eslint-config-next/typescript`
  - Rules relaxed to warnings for legacy code: `@typescript-eslint/no-explicit-any`, `@next/next/no-img-element`, `react-hooks/exhaustive-deps`, `@next/next/no-html-link-for-pages`
  - Unused variable detection: `{ argsIgnorePattern: "^_", varsIgnorePattern: "^_" }` (prefix underscore = intentionally unused)
  - Global ignores: `.next/`, `out/`, `build/`, `scripts/`, `scratch/`
  
- **crialook-app:** No ESLint config — TypeScript strict mode enforcement only
  - TypeScript strict enabled in `tsconfig.json`

**TypeScript Strict Mode:**
- **crialook-app:** `"strict": true` in `tsconfig.json` (extends `expo/tsconfig.base`)
- **campanha-ia:** `"strict": true` in `tsconfig.json` with additional flags:
  - `noUnusedLocals: false` (allow unused locals — legacy code pragmatism)
  - `noUnusedParameters: false` (allow unused parameters — common in callbacks)
  - `noFallthroughCasesInSwitch: true` (prevent switch fallthrough bugs)
  - `noImplicitOverride: true` (require `override` keyword in derived classes)

## Import Organization

**Order (observed pattern):**
1. External libraries (React, React Native, Expo, TanStack, etc.)
2. Type imports from external libraries
3. Internal absolute imports using `@/` alias
4. Relative imports (rare in both projects)

**Example from `crialook-app/hooks/gerar/useModelSelector.ts`:**
```typescript
import { useMemo, useState } from 'react';
import { useQueries } from '@tanstack/react-query';
import { apiGet } from '@/lib/api';
import { qk } from '@/lib/query-client';
import { t } from '@/lib/i18n';
import type { ModelItem } from '@/types';
```

**Path Aliases:**
- `@/*` → project root (`crialook-app/`)
- `@/*` → `./src/*` (`campanha-ia/`)
- Allows clean imports across deeply nested screens/components without `../../../` chains

**crialook-app Babel production setup:**
- Babel preset: `babel-preset-expo`
- Production plugin: `transform-remove-console` (strips console.log/warn calls from release AAB, keeps console.error for Sentry)

## Error Handling

**Strategy:**
- **crialook-app:** Try-catch with typed ApiError classification
  - `lib/api.ts` classifies HTTP status codes to `ApiErrorCode` union (QUOTA_EXCEEDED | RATE_LIMITED | MODEL_OVERLOADED | TIMEOUT | BAD_REQUEST | UNKNOWN)
  - Retry logic: GET-only, max 2 retries with exponential backoff (600ms base delay)
  - Timeout: 60s default, configurable per-call
  - Error context sanitization via `lib/logger.ts` → redacts JWTs, Bearer tokens, Clerk keys before logging

- **campanha-ia:** Response factory functions in `lib/validation.ts`
  - `badRequest(msg, code)` → `{ error, code }` with status 400
  - `unauthorized()`, `forbidden()`, `notFound()` → standardized error shapes
  - Route handlers wrap in try-catch, log errors with context (`console.error("[API:endpoint]", error)`)

**Patterns:**
- In hooks/composables: Promise rejection causes state update with `error` field (e.g., `result.current.loading` becomes false on error)
- In API routes: Explicit status codes in response; errors logged with route prefix like `[API:admin/plans]`
- Validation errors: Return Response.json with code + message rather than throwing

## Logging

**Framework:** `console` (production calls stripped via Babel in crialook-app)

**Patterns (crialook-app):**
- `logger.info(message, context?)` — dev: console.log + Sentry info
- `logger.warn(message, context?)` — dev: console.warn + Sentry warning
- `logger.error(message, error?, context?)` — dev: console.error + Sentry error with breadcrumbs
- All context objects recursively sanitized via `sanitizeForLog()` before Sentry capture
- Example: `logger.error('Failed to load models', err, { modelId: 'abc', filter: 'all' })`

**Patterns (campagna-ia):**
- Direct console calls: `console.error("[API:admin/plans] GET error:", error)`
- Route prefix format: `[API:endpoint-path]` identifies source in logs
- No explicit logger abstraction — console sufficient for backend API routes

## Comments

**When to Comment:**
- Function/component headers explain **why** over **what** (code is readable; intent is not)
- Example from `AppHeader.tsx`: "Why: the marketing site ships with a sticky header... This file is the app's answer"
- Complex control flow: `if (payloadCode && [...includes...])` — logic is obvious, intent comment explains why the check exists
- Hacks/TODOs: e.g., Babel config comments explain why `transform-remove-console` is necessary, rate-limiter comments explain why in-memory state + module-level cleanup

**JSDoc/TSDoc:**
- Used sparingly but consistently
- Export comments on public functions: `/** Invalida o cache — chamar no signOut pra evitar reuso de token antigo. */`
- Type field comments: `/** Estado especial em remainingQuota === 1 — última do mês. Tom urgente. */`
- Hook/component file headers: Multi-line block explaining contract, layout assumptions, why the file exists

**Language:**
- Portuguese mixed freely with English for inline comments
- Public docs (function/type JSDoc) bilingual: `pt-BR` and English equally represented

## Function Design

**Size:** 
- Utility functions: 10–30 lines average (e.g., `shouldRetry()`, `classifyStatus()`, `matchesFilter()`)
- Hooks: 50–150 lines (include state setup, memoization, multiple queries)
- Components: 150–400 lines (layouts + event handlers + computed state)

**Parameters:**
- Max 2–3 required parameters; additional config via options object
- Example: `apiGet(path, schema?, options?)` where schema is Zod type and options includes timeout, retry count
- Callbacks as last parameter when present

**Return Values:**
- Functions return typed values: `Promise<T>`, `T | null`, discriminated unions for error cases
- Hooks return object with properties: `{ loading, error, data, refetch, ... }`
- Void functions rare; prefer returning status or side-effect result

## Module Design

**Exports:**
- Named exports preferred (allows tree-shaking, IDE autocomplete)
- `export function`, `export const`, `export type` pattern throughout
- Barrel files (`index.ts`) used sparingly; mostly only in `types/`, `lib/`, `constants/`
- Example from `crialook-app/lib/api.ts`: exports `apiGet`, `apiPost`, `apiPatch`, `apiDelete`, `invalidateCache`, `invalidateCachePrefix` as named functions

**File structure:**
- One primary export per file (component, hook, or utility module)
- Related types exported from same file (e.g., `useModelSelector.ts` exports `type ModelFilter`)
- Private helpers (prefixed `_` or not exported) kept in the same file for clarity

---

*Convention analysis: 2026-05-03*
