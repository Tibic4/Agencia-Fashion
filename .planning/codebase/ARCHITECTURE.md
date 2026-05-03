<!-- refreshed: 2026-05-03 -->
# Architecture

**Analysis Date:** 2026-05-03

## System Overview

```text
┌───────────────────────────────────────────────────────────────────────────┐
│                      CRIALOOK — PLATFORM ARCHITECTURE                    │
├─────────────────────────────┬───────────────────────────┬─────────────────┤
│   Mobile (crialook-app)     │   Web (campanha-ia)       │   Support       │
│   Expo / React Native       │   Next.js                 │   (curriculo)   │
│   Android-only              │   Web Dashboard + API     │   (loadtests)   │
└─────────────────────────────┴───────────────────────────┴─────────────────┘
         │ (mobile client)         │ (web server)              │
         │                         │                          │ (staging)
         │ HTTP/REST              │ HTTP/REST (Server API)    │
         │ Polling (generation)   │ Inngest job queue         │
         │                         │                          │
         └──────────────┬──────────┴──────────────┬───────────┘
                        │                        │
         ┌──────────────┴────────────────────────┴──────────┐
         │                  SUPABASE                         │
         │  ┌─────────────┐  ┌──────────┐  ┌────────────┐   │
         │  │ Stores DB   │  │ Campaigns│  │ Auth/Plans │   │
         │  │ (user acct) │  │ (output) │  │ (subscr.)  │   │
         │  └─────────────┘  └──────────┘  └────────────┘   │
         │  Clerk (auth)  ↔  Flows (webhooks)                │
         └───────────────────────────────────────────────────┘
                        │
         ┌──────────────┴──────────────────┐
         │      AI/Generation Services      │
         ├─────────────┬──────────────────┤
         │  Gemini 3.1 │  Claude Sonnet   │
         │  (analyzer) │  (copy writing)  │
         │  Gemini 3   │  FAL.ai (gen)    │
         │  (VTO)      │  Google Play API │
         └─────────────┴──────────────────┘
```

## Component Responsibilities

| Component | Responsibility | File |
|-----------|----------------|------|
| **crialook-app (Mobile)** | Campaign generation UI, model selection, generation polling, push notifications, billing (IAP) | `crialook-app/app`, `crialook-app/lib` |
| **campanha-ia (Web)** | Server API, Clerk auth webhooks, AI pipeline orchestration, campaign storage, Supabase migrations, admin dashboard | `campanha-ia/src/app/api`, `campanha-ia/src/lib` |
| **Supabase** | Persistent storage (stores, campaigns, models, plans, usage), auth provider webhook events | Remote Postgres |
| **Clerk** | Mobile + web user identity, session tokens, SSO (Google), auth webhooks | Remote service |
| **Inngest** | Background job queuing (campaign generation, gallery cleanup) | `campanha-ia/src/lib/inngest` |
| **Gemini** | Visual analysis, model preview generation (VTO) | `campanha-ia/src/lib/ai/gemini-*.ts` |
| **Sonnet** | Marketing copy generation (PT-BR + EN locales) | `campanha-ia/src/lib/ai/sonnet-copywriter.ts` |
| **FAL.ai** | AI image generation (virtual try-on backgrounds) | `campanha-ia/src/lib/fal/client.ts` |
| **Google Play API** | Subscription verification, receipt validation | `campanha-ia/src/lib/payments/google-play.ts` |

## Pattern Overview

**Overall:** Monorepo with distinct mobile (Expo/RN) and web (Next.js) codebases, unified by a REST API backend orchestrating AI pipeline flows.

**Key Characteristics:**
- **Mobile-first design**: crialook-app is Android-only (Play Store target); iOS paths are commented out or excluded
- **Async generation with polling**: User submits photo → server queues pipeline → app polls `/campaign/[id]` until completed
- **Hybrid AI**: Gemini for vision/analysis, Sonnet for marketing copy, FAL for image gen
- **Offline-friendly mobile**: API responses cached in MMKV, query state persisted for cold-start UX
- **Authentication boundary**: Clerk handles both mobile + web; backend validates Bearer token per request
- **Plan-based quotas**: Supabase stores plan limits; endpoint checks usage before consumption

## Layers

**Mobile (crialook-app):**
- **Presentation Layer** (`app/`): Route files (Expo Router file-based routing)
  - Tabs: `(tabs)/gerar` (generation), `(tabs)/historico` (history), `(tabs)/modelo` (model gallery), `(tabs)/plano` (billing), `(tabs)/configuracoes` (settings)
  - Auth: `sign-in.tsx`, `sign-up.tsx`, `sso-callback.tsx`, `onboarding.tsx`
  - Legal: `(legal)/privacidade.tsx`, `(legal)/termos.tsx` (bundled content)
  - Entry point: `_layout.tsx` (root provider tree)

- **Component Layer** (`components/`): Reusable UI (buttons, modals, sheets, loaders)
  - Bottom sheets for model selection, photo source picker
  - Custom Skia-powered animations (MeshGradient, Confetti, ParticleLoader)
  - Preview cards, error boundaries, offline banner

- **Business Logic Layer** (`hooks/gerar/`, `lib/`):
  - `useCampaignGenerator` — Orchestrates photo upload → API call → state mgmt
  - `useCampaignPolling` — Long-polls `/campaign/[id]` until terminal status
  - `useImagePickerSlot` — Manages photo compression + validation
  - `useModelSelector` — Filter + sort models from gallery

- **Services Layer** (`lib/`):
  - `api.ts` — Centralized HTTP client with retry, timeout, caching (MMKV)
  - `auth.tsx` — Clerk provider + token management (SecureStore)
  - `billing.ts` — In-App Purchase lifecycle (react-native-iap)
  - `cache.ts` — MMKV-backed query cache (faster than AsyncStorage)
  - `notifications.ts` — Push token sync + deep linking on notification tap

- **Persistence Layer**:
  - **MMKV** (`lib/cache.ts`): API response cache (TTL-based, memory-mapped)
  - **SecureStore** (`lib/auth.tsx`): Clerk auth tokens
  - **AsyncStorage** (via `@react-native-async-storage/async-storage`): TanStack Query client state
  - **Preferences** (`lib/preferences.ts`): User toggles (haptics, notifications)

**Web (campanha-ia):**
- **Presentation Layer** (`src/app/`):
  - Routes: `(auth)/gerar` (generation), `(auth)/historico` (history), `(auth)/modelo`, `(auth)/plano`
  - Admin portal: `admin/campanhas`, `admin/clientes`, `admin/logs`, `admin/editor` (design tool)
  - Public: `auth/`, `page.tsx` (landing), pricing/blog (if present)
  - API: `/api/campaign/generate`, `/api/campaign/[id]/*`, `/api/billing/*`, `/api/admin/*`

- **Business Logic Layer** (`src/lib/`, `src/app/api/`):
  - `lib/ai/pipeline.ts` — Orchestrates Gemini → FAL → Sonnet
  - `lib/ai/gemini-analyzer.ts` — Visual analysis + pose tracking
  - `lib/ai/gemini-vto-generator.ts` — Virtual try-on + aspect ratio
  - `lib/ai/sonnet-copywriter.ts` — Marketing copy (locale-aware)
  - `lib/db/index.ts` — Supabase CRUD (stores, campaigns, models, plans)
  - `lib/inngest/functions.ts` — Async job runners

- **Data Access Layer** (`src/lib/`):
  - `lib/db/index.ts` — Typed Supabase queries (admin client)
  - `lib/supabase/admin.ts` — Service-role client initialization
  - Migrations: `supabase/migrations/` (schema management)

- **API Routes** (`src/app/api/`):
  - `campaign/generate/route.ts` — Entry point: FormData → pipeline → create campaign + enqueue Inngest
  - `campaign/[id]/*` — Status polling, regeneration, favorites, tips
  - `billing/verify` — Mercado Pago + Google Play webhook handlers
  - `admin/*` — Admin endpoints (plans, stores, settings)

## Data Flow

### Primary Request Path (Campaign Generation)

1. **User submits photo** (`crialook-app/app/(tabs)/gerar/index.tsx`)
   - Calls `useCampaignGenerator.submit()` with compressed images + metadata
   
2. **Upload FormData to API** (`crialook-app/lib/api.ts` → `POST /api/campaign/generate`)
   - Includes Bearer token (Clerk auth), X-App-Locale header (locale)
   - Rate limit check (anti-abuse per IP)
   - Quota validation (store usage vs plan limit)

3. **Backend: Pipeline orchestration** (`campanha-ia/src/app/api/campaign/generate/route.ts`)
   - Parse FormData (image, model ID, objectives)
   - Create campaign record in Supabase (status: `generating`)
   - Enqueue Inngest job (async pipeline runner)
   - Return campaign ID + estimatedDuration immediately (202 Accepted)

4. **Backend: AI pipeline execution** (`campanha-ia/src/lib/inngest/functions.ts` → `lib/ai/pipeline.ts`)
   - **Step 1:** Gemini 3.1 Pro analyzes clothing image (visual + pose)
   - **Step 2 (parallel):**
     - Gemini 3 Pro Image generates VTO (virtual try-on with model)
     - Claude Sonnet generates marketing copy (PT-BR or EN)
   - **Step 3:** Save results to campaign.output, update status to `completed`
   - On error: status → `failed`, error message stored

5. **Mobile: Polling for completion** (`crialook-app/hooks/gerar/useCampaignPolling.ts`)
   - Polls `GET /campaign/[id]` every 500ms–2s (backoff)
   - Stops when status ∈ {`completed`, `failed`, `expired`}
   - Updates local state + TanStack Query cache

6. **Mobile: Display results** (`crialook-app/app/(tabs)/gerar/resultado.tsx`)
   - Fetches full campaign via TanStack Query
   - Renders image carousel, copy preview, sharing buttons
   - Trial campaigns show 2 locked teaser angles (paywall)

### Push Notification Path

1. **Server enqueues notification job** (after campaign completion in `lib/inngest/functions.ts`)
   - Fetches store.push_tokens from Supabase
   - Sends via Firebase Cloud Messaging (implicit via Expo)

2. **Mobile receives notification** (`lib/notifications.ts`)
   - `addNotificationResponseListener()` fires when user taps
   - Deep link to `/gerar/resultado?id=[campaignId]`
   - If cold-start: `getLastNotificationResponseAsync()` catches in `app/_layout.tsx`

### Authentication Flow

1. **Mobile Clerk SSO**:
   - `sign-in.tsx` uses `useOAuth()` (Google)
   - Clerk redirects to `sso-callback.tsx` with code
   - `useAuth()` hooks polling + detects session
   - `AuthGate` redirects to onboarding or tabs once signed in

2. **API authentication**:
   - Mobile calls `/api/campaign/generate` with Bearer token
   - Token refreshed transparently via `getAuthToken()` (Clerk SDK)
   - Backend validates token via Clerk webhooks or direct lookup

### Billing/Subscription Path

1. **Mobile In-App Purchase (IAP)**:
   - `lib/billing.ts` initializes `react-native-iap`
   - User taps "upgrade" → IAP modal → completion callback
   - Sends receipt to `/api/billing/restore` (mobile) or `/api/billing/verify` (server)

2. **Google Play Subscription Verification** (`campanha-ia/src/lib/payments/google-play.ts`):
   - Receipt validation against Google Play Developer API
   - Updates `store.plan_id` and `store_usage.campaigns_limit`

3. **Webhook Handling** (`campanha-ia/src/app/api/billing/`):
   - Mercado Pago webhooks for web checkout
   - Google Play real-time notifications for subscription changes

**State Management:**
- **Mobile**: React Context (`AuthProvider`) for auth state + TanStack Query for server data
- **Cache**: MMKV for API responses (TTL-expiry), AsyncStorage for query state persistence
- **Server**: Supabase as single source of truth; Inngest for job state

## Key Abstractions

**CampaignInputs** (Mobile):
- Purpose: Type-safe bundle of user input (photos, objectives, model choice)
- Examples: `crialook-app/hooks/gerar/useCampaignGenerator.ts` (definition + usage)
- Pattern: Validated struct passed to submit function

**PipelineInput/PipelineResult** (Server):
- Purpose: Unified interface for AI orchestration
- Examples: `campanha-ia/src/lib/ai/pipeline.ts`
- Pattern: Server abstracts Gemini + Sonnet complexity from route handler

**Campaign** (Shared):
- Purpose: Canonical campaign shape (shared type)
- Examples: `crialook-app/types/index.ts`, Supabase table schema
- Pattern: Single source of truth for campaign data

**StoreRecord/StoreUsage** (Server):
- Purpose: Encapsulates store metadata + monthly quota tracking
- Examples: `campanha-ia/src/lib/db/index.ts`
- Pattern: Typed interfaces wrapping Supabase rows

## Entry Points

**Mobile:**
- Location: `crialook-app/app/_layout.tsx`
- Triggers: App launch (Expo SDK)
- Responsibilities: Initialize Sentry, font loading, auth gating, root provider tree (Query client, Auth, Theme)

**Web:**
- Location: `campanha-ia/src/app/layout.tsx`
- Triggers: Next.js server start
- Responsibilities: Metadata, font preload, ClerkProvider, Tailwind, PostHog analytics

**API Generation Endpoint:**
- Location: `campanha-ia/src/app/api/campaign/generate/route.ts`
- Triggers: Mobile POST + FormData
- Responsibilities: Validation, quota check, campaign creation, Inngest job enqueue

**Inngest Async Pipeline:**
- Location: `campanha-ia/src/lib/inngest/functions.ts`
- Triggers: `generate-campaign` event
- Responsibilities: Orchestrate AI calls, save results, notify user

## Architectural Constraints

- **Threading:** Single-threaded event loop (Expo/RN on mobile, Node on web). Inngest uses worker pool for parallel AI calls.
- **Global state:** Minimal — Context only for auth (mobile). Preferences use MMKV-backed external store. No Redux/Zustand.
- **Circular imports:** None detected; lib/* imports are acyclic.
- **Mobile networking:** Assumes IPv4 → IPv6 dual-stack; uses expo-network for connectivity detection (OfflineBanner).
- **Credentials:** Clerk tokens in SecureStore (mobile), session cookie + Bearer (web). Service-role key in environment only.
- **CORS:** Web backend serves API with appropriate headers; mobile uses Bearer token (no cookie-based CORS issues).
- **Rate limiting:** Per-IP + per-authenticated-user in `lib/rate-limit.ts` (campanha-ia).
- **Locale:** X-App-Locale header (mobile) controls output language (PT-BR or EN).

## Anti-Patterns

### God Components (Avoided)

**What would happen:** `resultado.tsx` trying to manage polling, caching, and rendering all at once.
**Why it's wrong:** High cognitive load, hard to test, mutations buried in render path.
**Do this instead:** Extract polling to hook (`useCampaignPolling`) + hook owns its own interval lifecycle. Component uses hook result + renders. See `crialook-app/hooks/gerar/useCampaignPolling.ts`.

### Async-on-Module-Scope (Avoided in Mobile)

**What would happen:** Calling `await getAuthToken()` at module scope (e.g., top of lib/api.ts).
**Why it's wrong:** Blocks app boot; if Clerk takes 6s to load, app is stuck.
**Do this instead:** Init hooks that do top-level setup safely (`app/_layout.tsx` calls `wireQueryClientLifecycle()`, `setupQueryPersistence()`, `initSentry()` with `.catch(() => {})`). Async auth waits for `loading: false` from `useAuth()` context.

### Uncontrolled Cache Staleness (Avoided)

**What would happen:** API response cached with no TTL; user updates model, but old data shows forever.
**Why it's wrong:** Stale UI state; user sees wrong data across sessions.
**Do this instead:** API cache uses TTL expiry + manual invalidation. See `crialook-app/lib/cache.ts` (cacheMs param) + `useCampaignGenerator` calling `invalidateApiCache()` on completion.

### Polling Without Backoff (Avoided)

**What would happen:** Poll every 100ms forever.
**Why it's wrong:** Battery drain, server load, app hang if network slow.
**Do this instead:** `useCampaignPolling` uses exponential backoff (500ms → 2s) + stops at terminal status. See `crialook-app/hooks/gerar/useCampaignPolling.ts`.

### Missing Quota Check Pre-Flight (Avoided in Mobile)

**What would happen:** User taps "generate" without quota; app uploads photos, then 402 QUOTA_EXCEEDED; wasted data.
**Why it's wrong:** Frustrating UX, bandwidth cost.
**Do this instead:** `resultado.tsx` checks `canGenerateCampaign()` (queries `/store/usage`). If quota exceeded, shows modal without upload. See `crialook-app/hooks/gerar/useCampaignGenerator.ts` (`simulateQuotaExceeded`).

## Error Handling

**Strategy:** Typed error codes with locale-aware messages.

**Patterns:**
- API errors classify HTTP status + response body code (e.g., 429 → `RATE_LIMITED`, 402 → `QUOTA_EXCEEDED`)
- Mobile wraps error in `ApiError` (custom class) with message + code
- Locale-aware text: `t('errors.rateLimited')` pulls from `lib/i18n/strings.ts`
- Unrecoverable errors surface via `AppErrorBoundary` (root level crash reporting to Sentry)
- Generation errors (in Inngest pipeline) stored on campaign.output + surfaced in resultado.tsx

## Cross-Cutting Concerns

**Logging:**
- Mobile: `lib/logger.ts` (console or Sentry breadcrumb)
- Web: Structured logs via Sentry + console (Inngest jobs can log to stdout)

**Validation:**
- Mobile: Zod schemas in `lib/schemas.ts` + runtime validation on API responses
- Web: Zod + route handler guards (e.g., VALID_OBJECTIVES whitelist in `/api/campaign/generate`)

**Authentication:**
- Mobile: Clerk auth context + SecureStore token cache
- Web: Clerk `auth()` server function + Bearer token validation

**Analytics (Web only):**
- PostHog integration in `src/lib/analytics/posthog.tsx`
- Tracks page views, custom events (generation start, error, completion)

---

*Architecture analysis: 2026-05-03*
