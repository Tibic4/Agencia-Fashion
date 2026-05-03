# Codebase Structure

**Analysis Date:** 2026-05-03

## Directory Layout

```
Agencia-Fashion/
├── crialook-app/                 # Mobile app (Expo, Android-only)
│   ├── app/                      # Route files (Expo Router)
│   │   ├── _layout.tsx           # Root provider tree + auth gate
│   │   ├── index.tsx             # Splash redirect
│   │   ├── sign-in.tsx
│   │   ├── sign-up.tsx
│   │   ├── sso-callback.tsx
│   │   ├── onboarding.tsx
│   │   ├── (legal)/              # Modal route group
│   │   │   ├── privacidade.tsx
│   │   │   ├── termos.tsx
│   │   │   ├── consentimento-biometrico.tsx
│   │   │   └── _layout.tsx       # Legal nav stack
│   │   └── (tabs)/               # Bottom tab navigator
│   │       ├── _layout.tsx       # Tab config
│   │       ├── gerar/            # Generation tab
│   │       │   ├── index.tsx     # Main generation form
│   │       │   ├── resultado.tsx # Results screen + trial paywall
│   │       │   └── _layout.tsx   # Stack within tab
│   │       ├── historico.tsx     # Campaign history
│   │       ├── modelo.tsx        # Model gallery
│   │       ├── plano.tsx         # Billing/plans
│   │       └── configuracoes.tsx # Settings + logout
│   │
│   ├── components/               # UI components
│   │   ├── AppFadeIn.tsx         # Splash fade + safety net hideAsync
│   │   ├── AppHeader.tsx         # Shared tab header
│   │   ├── AppErrorBoundary.tsx  # Root error boundary + Sentry wrap
│   │   ├── OfflineBanner.tsx     # Connectivity indicator
│   │   ├── ToastHost.tsx         # Root toast renderer
│   │   ├── CameraCaptureModal.tsx
│   │   ├── PhotoSourceSheet.tsx
│   │   ├── ModelBottomSheet.tsx
│   │   ├── GenerationLoadingScreen.tsx
│   │   ├── QuotaExceededModal.tsx
│   │   ├── BiometricConsentModal.tsx
│   │   ├── CreateModelSheet.tsx
│   │   ├── skia/                 # Animated graphics (Skia)
│   │   │   ├── MeshGradient.tsx
│   │   │   ├── Confetti.tsx
│   │   │   ├── AuraGlow.tsx
│   │   │   └── ParticleLoader.tsx
│   │   └── ...other components
│   │
│   ├── hooks/                    # Custom hooks
│   │   ├── gerar/                # Generation logic
│   │   │   ├── useCampaignGenerator.ts  # Submit + polling orchestration
│   │   │   ├── useCampaignPolling.ts    # Long-poll campaign status
│   │   │   ├── useImagePickerSlot.ts   # Photo compression + validation
│   │   │   └── useModelSelector.ts     # Filter/sort models
│   │   ├── useMaterialYou.ts    # Material 3 color extraction
│   │   ├── useNetworkStatus.ts  # Connectivity via expo-network
│   │   ├── useColorScheme.ts    # Dark/light detection
│   │   └── __tests__/           # Hook unit tests
│   │
│   ├── lib/                      # Services & utilities
│   │   ├── api.ts               # HTTP client (retry, cache, auth)
│   │   ├── auth.tsx             # Clerk context + SecureStore
│   │   ├── cache.ts             # MMKV-backed response cache
│   │   ├── billing.ts           # IAP lifecycle (react-native-iap)
│   │   ├── notifications.ts     # Push token + deep linking
│   │   ├── preferences.ts       # MMKV user toggles
│   │   ├── query-client.ts      # TanStack Query setup + persistence
│   │   ├── sentry.ts            # Error tracking initialization
│   │   ├── logger.ts            # Console + breadcrumb logging
│   │   ├── haptics.ts           # Vibration feedback
│   │   ├── navigationLock.ts    # Back button handling
│   │   ├── reviewGate.ts        # Play Store in-app review
│   │   ├── plans.ts             # Plan limits (quota logic)
│   │   ├── modelGender.ts       # Gender emoji for models
│   │   ├── images.ts            # Image compression utilities
│   │   ├── fonts.ts             # Font loading helpers
│   │   ├── clerkErrors.ts       # Clerk error messages
│   │   ├── i18n/                # Internationalization
│   │   │   ├── index.ts         # Translation API (i18n-js)
│   │   │   └── strings.ts       # String literals (PT-BR + EN)
│   │   ├── legal/
│   │   │   └── content.ts       # GDPR/privacy content bundles
│   │   ├── theme/
│   │   │   ├── index.tsx        # Theme context provider
│   │   │   └── tokens.ts        # Design tokens (colors, spacing)
│   │   └── schemas.ts           # Zod runtime validators
│   │
│   ├── constants/               # Static config
│   │   └── Colors.ts            # Brand + semantic colors (light/dark)
│   │
│   ├── types/                   # Shared TypeScript interfaces
│   │   └── index.ts             # Campaign, ModelItem, StoreUsage, QuotaData, ApiError, etc.
│   │
│   ├── assets/                  # Images, fonts
│   │   └── ...image files
│   │
│   ├── __tests__/               # Integration tests
│   │   └── ...test files
│   │
│   ├── .storybook/              # Storybook config
│   ├── .eas/                    # EAS CLI config
│   ├── app.config.ts            # Expo config (plugins, permissions, native settings)
│   ├── package.json             # npm@10 lock required (EAS build expectation)
│   ├── tsconfig.json
│   ├── jest.config.js
│   └── vitest.config.ts
│
├── campanha-ia/                 # Web backend (Next.js)
│   ├── src/
│   │   ├── app/
│   │   │   ├── layout.tsx       # Root metadata + providers
│   │   │   ├── page.tsx         # Landing page
│   │   │   │
│   │   │   ├── (auth)/          # Protected routes (Clerk guard)
│   │   │   │   ├── layout.tsx   # Shared chrome (header, sidebar)
│   │   │   │   ├── gerar/
│   │   │   │   │   └── page.tsx
│   │   │   │   ├── historico/
│   │   │   │   │   └── page.tsx
│   │   │   │   ├── modelo/
│   │   │   │   │   └── page.tsx
│   │   │   │   ├── plano/
│   │   │   │   │   └── page.tsx
│   │   │   │   └── configuracoes/
│   │   │   │       └── page.tsx
│   │   │   │
│   │   │   ├── admin/           # Admin-only routes
│   │   │   │   ├── layout.tsx
│   │   │   │   ├── page.tsx     # Dashboard overview
│   │   │   │   ├── campanhas/   # Campaign management
│   │   │   │   ├── clientes/    # Store list + editing
│   │   │   │   ├── custos/      # Cost tracking
│   │   │   │   ├── editor/      # Konva design tool
│   │   │   │   │   ├── page.tsx
│   │   │   │   │   └── EditorClient.tsx
│   │   │   │   ├── logs/        # Job status + errors
│   │   │   │   └── vitrine/     # Model gallery manager
│   │   │   │
│   │   │   ├── api/
│   │   │   │   ├── campaign/
│   │   │   │   │   ├── generate/route.ts      # POST entry point
│   │   │   │   │   ├── [id]/
│   │   │   │   │   │   ├── route.ts           # GET campaign details
│   │   │   │   │   │   ├── favorite/route.ts
│   │   │   │   │   │   ├── regenerate/route.ts
│   │   │   │   │   │   └── tips/route.ts
│   │   │   │   │   └── list/route.ts
│   │   │   │   │
│   │   │   │   ├── admin/
│   │   │   │   │   ├── plans/route.ts         # Plan CRUD
│   │   │   │   │   ├── stores/route.ts        # Store listing + updates
│   │   │   │   │   ├── settings/route.ts
│   │   │   │   │   ├── showcase/route.ts
│   │   │   │   │   ├── storage-gc/route.ts    # Gallery cleanup job
│   │   │   │   │   └── logs/route.ts
│   │   │   │   │
│   │   │   │   ├── billing/
│   │   │   │   │   ├── verify/route.ts        # Subscription verification
│   │   │   │   │   ├── restore/route.ts       # Mobile IAP receipt
│   │   │   │   │   └── rtdn/route.ts          # Real-time dev notifications
│   │   │   │   │
│   │   │   │   ├── webhooks/                  # Clerk auth events
│   │   │   │   │   └── clerk/route.ts
│   │   │   │   │
│   │   │   │   ├── store/
│   │   │   │   │   ├── route.ts               # GET store profile + usage
│   │   │   │   │   ├── models/route.ts        # Store's models
│   │   │   │   │   ├── push-token/route.ts
│   │   │   │   │   ├── onboarding/route.ts
│   │   │   │   │   └── settings/route.ts
│   │   │   │   │
│   │   │   │   └── public/
│   │   │   │       ├── campaign/[token]/route.ts  # Public campaign preview
│   │   │   │       └── og-image/route.ts           # Dynamic OG images
│   │   │   │
│   │   │   └── globals.css      # Tailwind + semantic tokens
│   │   │
│   │   ├── components/          # React UI (Tailwind)
│   │   │   ├── ClientProviders.tsx  # Root client-side providers
│   │   │   ├── CookieBanner.tsx
│   │   │   ├── GenerationLoadingScreen.tsx
│   │   │   ├── CreativePreview.tsx
│   │   │   ├── InstagramEditor.tsx    # Konva-based editor wrapper
│   │   │   ├── konva/                 # Canvas components
│   │   │   │   ├── KonvaCanvas.tsx
│   │   │   │   ├── KonvaCompositor.tsx
│   │   │   │   ├── DraggableElement.tsx
│   │   │   │   └── ImportPanel.tsx
│   │   │   ├── BeforeAfterSlider.tsx
│   │   │   ├── HeadlineABTest.tsx
│   │   │   ├── FashionFactsCarousel.tsx
│   │   │   ├── HowItWorksAnimation.tsx
│   │   │   ├── FloatingWhatsApp.tsx
│   │   │   └── ...other shared UI
│   │   │
│   │   ├── lib/
│   │   │   ├── db/               # Supabase data access
│   │   │   │   └── index.ts      # All queries + mutations (admin client)
│   │   │   │
│   │   │   ├── supabase/
│   │   │   │   ├── admin.ts      # Service-role client
│   │   │   │   └── client.ts     # Client-side (RLS) client
│   │   │   │
│   │   │   ├── ai/               # AI pipeline
│   │   │   │   ├── pipeline.ts   # Main orchestrator
│   │   │   │   ├── gemini-analyzer.ts      # Visual analysis
│   │   │   │   ├── gemini-vto-generator.ts # Virtual try-on
│   │   │   │   ├── sonnet-copywriter.ts    # Marketing copy
│   │   │   │   ├── backdrop-generator.ts   # Background prompt
│   │   │   │   ├── identity-translations.ts # Model metadata + pose history
│   │   │   │   ├── gemini-error-handler.ts # API error retry
│   │   │   │   ├── mock-data.ts            # Demo mode fallback
│   │   │   │   └── .test.ts files
│   │   │   │
│   │   │   ├── inngest/          # Job queue
│   │   │   │   ├── client.ts     # Inngest SDK initialization
│   │   │   │   ├── functions.ts  # Job definitions + handlers
│   │   │   │   └── storage-gc.ts # Gallery cleanup task
│   │   │   │
│   │   │   ├── payments/         # Billing
│   │   │   │   ├── google-play.ts           # Google Play API client
│   │   │   │   ├── mercado-pago.ts         # MP webhook parsing
│   │   │   │   └── subscription-sync.ts
│   │   │   │
│   │   │   ├── fal/              # Image generation
│   │   │   │   └── client.ts     # FAL.ai SDK wrapper
│   │   │   │
│   │   │   ├── rate-limit.ts     # Anti-abuse per IP + user
│   │   │   ├── env.ts            # Env var validation (Zod)
│   │   │   ├── plans.ts          # Plan metadata (limits, pricing)
│   │   │   ├── friendly-error.ts # User-facing error messages
│   │   │   ├── observability.ts  # Sentry integration
│   │   │   ├── editor-session.ts # Canvas state persistence
│   │   │   ├── model-prompts.ts  # Cached prompt templates
│   │   │   ├── model-preview.ts  # VTO rendering hints
│   │   │   ├── mp-signature.ts   # Mercado Pago request signing
│   │   │   ├── admin/            # Admin utilities
│   │   │   │   ├── guard.ts      # Role-based auth
│   │   │   │   └── format.ts     # Display formatting
│   │   │   ├── analytics/
│   │   │   │   └── posthog.tsx   # Analytics client
│   │   │   ├── hooks/            # React hooks
│   │   │   │   ├── useStoreUsage.tsx
│   │   │   │   └── useWakeLock.ts
│   │   │   ├── google/
│   │   │   │   └── nano-banana.ts # Google API utilities
│   │   │   └── ...other utilities
│   │   │
│   │   └── types/
│   │       └── index.ts          # Shared types (if any)
│   │
│   ├── supabase/
│   │   └── migrations/           # SQL schema versions
│   │       ├── 00000000000000_baseline.sql
│   │       ├── 20260405_plan_features.sql
│   │       ├── 20260419_add_credits_atomic_rpc.sql
│   │       ├── 20260421_add_campaign_title.sql
│   │       ├── 20260424_add_checkout_locks.sql
│   │       ├── 20260427_subscriptions.sql
│   │       └── ...other migrations
│   │
│   ├── public/                  # Static assets
│   │   ├── og-image.png
│   │   ├── icon-192.png
│   │   └── ...other static files
│   │
│   ├── deploy/                  # Deployment scripts
│   ├── docs/                    # Documentation
│   ├── test-images/             # Test fixtures
│   │
│   ├── package.json
│   ├── tsconfig.json
│   ├── vitest.config.ts
│   ├── eslint.config.js
│   ├── next.config.js
│   ├── tailwind.config.ts
│   ├── postcss.config.js
│   └── .env.local (excluded from git)
│
├── curriculo/                   # Python utility
│   ├── gerar.py                 # CV generation script
│   └── alton-vieira-cv.pdf
│
├── loadtests/                   # k6 performance tests
│   ├── scenarios/
│   │   └── ...k6 test files
│   ├── lib/
│   ├── reports/
│   ├── .env.loadtest
│   └── README.md
│
├── ops/                         # DevOps
│   ├── backup-supabase.sh
│   ├── health-check.sh
│   └── README.md
│
├── docs/                        # Project documentation
│   ├── juridico/               # Legal docs
│   └── legacy/                 # Archived docs
│
├── .github/
│   └── workflows/              # CI/CD (if configured)
│
├── .planning/                  # GSD planning artifacts
│   ├── codebase/               # This directory
│   └── phases/                 # Execution phase logs
│
├── .vscode/
├── .cursor/
├── .claude/
│   └── skills/                 # Project skills (if present)
│
├── .gitignore
├── package.json (monorepo root, if present)
├── pnpm-workspace.yaml (if using pnpm)
└── README.md
```

## Directory Purposes

**crialook-app/**
- Purpose: Mobile client (Expo/React Native, Android-only)
- Contains: Routes, components, hooks, services, constants, types
- Key files: `app/_layout.tsx` (root), `app/(tabs)/gerar/index.tsx` (generation), `lib/api.ts` (HTTP client)

**campanha-ia/**
- Purpose: Web server (Next.js backend + web UI)
- Contains: API routes, server-side logic, AI orchestration, Supabase migrations
- Key files: `src/app/api/campaign/generate/route.ts` (entry point), `src/lib/ai/pipeline.ts` (orchestrator), `src/lib/db/index.ts` (data access)

**curriculo/**
- Purpose: Legacy utility (CV generator)
- Contains: Single Python script + PDF
- Use: Not part of active product

**loadtests/**
- Purpose: k6 performance/load testing
- Contains: Test scenarios, load test scripts, reports
- Use: Validate API capacity before production deployments

**ops/**
- Purpose: Operational scripts
- Contains: Backup, health check, monitoring automation
- Use: DevOps, infrastructure management

## Key File Locations

**Entry Points:**
- Mobile: `crialook-app/app/_layout.tsx` — Root app initialization (Sentry, auth, providers)
- Web: `campanha-ia/src/app/layout.tsx` — Next.js root (metadata, Clerk provider)
- API: `campanha-ia/src/app/api/campaign/generate/route.ts` — Campaign generation endpoint (POST)

**Configuration:**
- Mobile: `crialook-app/app.config.ts` (Expo config), `crialook-app/tsconfig.json`
- Web: `campanha-ia/next.config.js`, `campanha-ia/tailwind.config.ts`, `campanha-ia/src/lib/env.ts` (Zod validation)
- Database: `campanha-ia/supabase/migrations/` (schema definitions)

**Core Logic:**
- Mobile generation flow: `crialook-app/hooks/gerar/useCampaignGenerator.ts` (orchestrator), `crialook-app/lib/api.ts` (HTTP)
- Web generation flow: `campanha-ia/src/app/api/campaign/generate/route.ts` (endpoint), `campanha-ia/src/lib/ai/pipeline.ts` (AI calls)
- Database: `campanha-ia/src/lib/db/index.ts` (Supabase CRUD)

**Testing:**
- Mobile unit tests: `crialook-app/__tests__/`, `crialook-app/hooks/__tests__/`
- Web unit tests: `campanha-ia/src/**/*.test.ts`
- Mobile e2e: Managed via `crialook-app/vitest.config.ts` (Vitest)
- Web e2e: `campanha-ia/vitest.config.ts`

## Naming Conventions

**Files:**
- Routes: Kebab-case (`sign-in.tsx`, `gerar/resultado.tsx`) per Expo Router / Next.js conventions
- Components: PascalCase (`GenerationLoadingScreen.tsx`, `QuotaExceededModal.tsx`)
- Utilities: camelCase (`useCampaignGenerator.ts`, `api.ts`, `cache.ts`)
- Types: PascalCase interfaces + types (`Campaign`, `ModelItem`, `StoreRecord`)
- Tests: `[file].test.ts` or `[file].spec.ts`

**Directories:**
- Feature groups: Kebab-case (`gerar/`, `historico/`)
- Route groups (Expo/Next): Parentheses `(tabs)`, `(auth)`, `(legal)`
- Domain layers: Lowercase (`lib/`, `components/`, `hooks/`, `types/`)
- Nested utilities: Subdirectories by domain (`lib/ai/`, `lib/inngest/`, `lib/payments/`)

**Variables/Functions:**
- camelCase for functions, variables, object keys
- UPPER_CASE for constants (`DEFAULT_TIMEOUT_MS`, `INIT_TIMEOUT_MS`)
- Prefix hooks with `use` (`useAuth`, `useCampaignGenerator`)
- Prefix context consumers with `use` (`usePreference`, `useColorScheme`)

**API Endpoints:**
- Kebab-case paths (`/api/campaign/generate`, `/api/store/push-token`, `/api/admin/plans`)
- HTTP method in function name: `export async function POST(request: NextRequest) {}`

## Where to Add New Code

**New Feature (e.g., "Add model tagging"):**
- Primary code:
  - Mobile UI: `crialook-app/app/(tabs)/modelo.tsx` (if filtering), or new component in `crialook-app/components/`
  - Mobile logic: `crialook-app/hooks/` (if stateful) or `crialook-app/lib/` (utilities)
  - Backend API: `campanha-ia/src/app/api/store/models/route.ts` (new endpoint or extend existing)
  - Database: `campanha-ia/supabase/migrations/[timestamp]_add_model_tags.sql` (schema change)
- Tests: Mirror structure with `.test.ts` suffix

**New Component/Module:**
- Mobile UI component: `crialook-app/components/[Name].tsx`
- Mobile service/utility: `crialook-app/lib/[feature].ts`
- Mobile custom hook: `crialook-app/hooks/[feature]/use[Feature].ts`
- Web component: `campanha-ia/src/components/[Name].tsx`
- Web service/utility: `campanha-ia/src/lib/[domain]/[feature].ts`

**Utilities (shared across screens/routes):**
- Mobile shared helpers: `crialook-app/lib/`
- Web shared helpers: `campanha-ia/src/lib/`
- Domain-specific (e.g., AI, payments): Subdirectory within `lib/` (e.g., `lib/ai/`, `lib/payments/`)

**New API Route (Web):**
- Path should match URL: `/api/[domain]/[resource]/route.ts`
  - Example: `src/app/api/store/models/route.ts` → `GET /api/store/models`
  - Example: `src/app/api/campaign/[id]/favorite/route.ts` → `POST /api/campaign/[id]/favorite`

**Database Migration (Web):**
- File: `campanha-ia/supabase/migrations/[YYYYMMDD]_[description].sql`
- Content: SQL DDL (CREATE TABLE, ALTER, etc.)
- Idempotent: Use `IF NOT EXISTS` / `IF EXISTS` to avoid errors on re-apply

## Special Directories

**crialook-app/.storybook/**
- Purpose: Storybook component catalog (dev tool)
- Generated: No (hand-written config)
- Committed: Yes
- Run: `npm run storybook:dev` (port 6006)

**crialook-app/.eas/**
- Purpose: EAS CLI configuration (Expo build service)
- Generated: Partially (by eas-cli)
- Committed: Yes
- Note: Never run plain `npm install` here; always `npm run lock:fix`

**campanha-ia/supabase/migrations/**
- Purpose: Schema versioning (Postgres DDL)
- Generated: No (hand-written)
- Committed: Yes
- Note: Immutable once applied; new changes = new migration file

**campanha-ia/.env.local**
- Purpose: Local development secrets
- Generated: Yes (developer creates)
- Committed: No (in .gitignore)
- Contains: API keys, database URL, Clerk keys, etc.

**.planning/codebase/**
- Purpose: GSD (Get-Shit-Done) analysis documents
- Generated: Yes (by /gsd-map-codebase)
- Committed: Yes (guidance for execution)
- Contents: ARCHITECTURE.md, STRUCTURE.md, CONVENTIONS.md, TESTING.md, STACK.md, INTEGRATIONS.md, CONCERNS.md

**.planning/phases/**
- Purpose: GSD execution logs
- Generated: Yes (by /gsd-execute-phase)
- Committed: Yes (audit trail)
- Contents: Phase execution results, timing, errors

---

*Structure analysis: 2026-05-03*
