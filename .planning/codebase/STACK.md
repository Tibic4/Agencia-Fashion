# Technology Stack

**Analysis Date:** 2026-05-03

## Languages

**Primary:**
- TypeScript 5.x — Core language for `campanha-ia` (Next.js backend/frontend) and `crialook-app` (Expo mobile app)
- JavaScript (Node.js) — `loadtests/` (k6 scenarios), deployment scripts, PM2 configuration
- Python 3.x — `curriculo/gerar.py` (CV PDF generator using ReportLab)

**Secondary:**
- Bash — Infrastructure and deployment scripts (`deploy-crialook.sh`, ops scripts)

## Runtime

**Environment:**
- Node.js 24 LTS (default in deployment, specified in `deploy-crialook.sh`)
- Python 3.x (for PDF curriculum generator in `curriculo/`)

**Package Managers:**
- npm (Node.js) — Primary; configured with npm@10 lockfile format (required by EAS build)
  - `campanha-ia/package.json` — Next.js backend & frontend
  - `crialook-app/package.json` — Expo React Native Android app
  - `loadtests/` — k6 load testing scenarios
- pip (Python) — `curriculo/requirements.txt` (not present in repo, but gerar.py uses ReportLab)

## Frameworks

**Core:**
- Next.js 16.2.4 — Web backend and public landing (`campanha-ia/`)
  - Uses App Router for API routes and server actions
  - Configured in `campanha-ia/next.config.ts`
- Expo 54.0.34 — React Native framework for Android app (`crialook-app/`)
  - Entry: `crialook-app/app/` (Expo Router with file-based routing)
  - iOS support disabled (Android-only, Play Store only)
  - EAS build configured in `crialook-app/.eas/`

**Frontend/UI:**
- React 19.1.0 (pinned explicitly in `crialook-app/package.json` due to React Native renderer requirements)
- React 19.2.4 (`campanha-ia/` for web)
- React Native 0.81.5 (Expo Android runtime)
- Tailwind CSS 4.x — Styling in `campanha-ia/`
- Framer Motion 12.38.0 — Animations in `campanha-ia/`
- Lucide React — Icons
- Konva 10.2.3 + react-konva — Canvas-based design editor in `campanha-ia/`

**Testing:**
- Vitest 4.1.5 — Unit testing (`campanha-ia/` and `crialook-app/`)
  - Config: `crialook-app/vitest.config.ts`, `campanha-ia/vitest.config.ts`
- Jest 29.7.0 — React Native testing (`crialook-app/`)
  - Config: `crialook-app/jest.config.js`
- @testing-library/react — React component testing
- @testing-library/react-native — React Native component testing

**Build/Dev Tools:**
- Vite 6.4.2 — Build tool for web components
- Storybook 8.6.18 — Component library (`crialook-app/.storybook/`)
- Babel — JavaScript transpilation
- ESLint 9 — Linting (`campanha-ia/`)
- Husky 9.1.7 — Git hooks
- lint-staged 16.4.0 — Pre-commit linting
- TypeScript 5.x — Type checking

**Load Testing:**
- k6 1.7.1 (Grafana) — Performance and stress testing (`loadtests/`)
  - Scenarios in `loadtests/scenarios/` (smoke, load, stress, spike, webhook tests)
  - Library utilities in `loadtests/lib/`

## Key Dependencies

**Critical (Business Logic):**
- @anthropic-ai/sdk ^0.92.0 — Claude LLM for campaign copywriting (`campanha-ia/src/lib/ai/sonnet-copywriter.ts`)
- @google/genai ^1.48.0 — Gemini for image analysis and VTO generation (`campanha-ia/src/lib/ai/gemini-analyzer.ts`)
- @fal-ai/client ^1.9.5 — Fallback IDM-VTON virtual try-on (`campanha-ia/src/lib/fal/client.ts`)
- fashn ^0.13.0 — Fashion AI provider for product analysis

**Authentication:**
- @clerk/nextjs ^7.0.8 — Auth for `campanha-ia` (web backend)
- @clerk/clerk-expo ^2.19.31 — Auth for `crialook-app` (mobile app)
- @clerk/types — Shared type definitions
- expo-auth-session ~7.0.11 — OAuth session handling
- expo-secure-store ~15.0.8 — Secure credential storage

**Database & State:**
- @supabase/supabase-js ^2.101.1 — PostgreSQL client for `campanha-ia`
- @supabase/ssr ^0.10.0 — Server-side Supabase helpers
- @react-native-async-storage/async-storage 2.2.0 — Local storage for mobile app
- react-native-mmkv ^3.2.0 — Fast persistent key-value store for mobile app

**Payments:**
- react-native-iap ^14.7.20 — In-app purchases (Google Play Billing) for `crialook-app`
- mercadopago ^2.12.0 — Mercado Pago integration for `campanha-ia`

**Query & Caching:**
- @tanstack/react-query ^5.62.0 — Server state management (both web and mobile)
- @tanstack/react-query-persist-client — Client-side cache persistence
- @tanstack/query-sync-storage-persister — Cache synchronization

**Error Tracking & Observability:**
- @sentry/nextjs ^10.47.0 — Error tracking for `campanha-ia`
- @sentry/react-native 7.13.0 — Error tracking for `crialook-app`
- posthog-js ^1.364.7 — Product analytics in `campanha-ia`

**Async Jobs & Workflows:**
- inngest ^4.1.2 — Async job orchestration for `campanha-ia` (pipeline retries, email delivery)

**Mobile-Specific:**
- expo-notifications ~0.32.17 — Push notifications
- expo-media-library ~18.2.1 — Access to device media
- expo-image-picker ~17.0.11 — Photo/media selection
- expo-file-system ~19.0.21 — File system access
- expo-image-manipulator ~14.0.8 — Image resizing/compression
- expo-blur ~15.0.8 — Visual blur effects
- react-native-gesture-handler ~2.28.0 — Touch gesture recognition
- react-native-reanimated ~4.1.1 — GPU-accelerated animations
- @gorhom/bottom-sheet ^5.2.10 — Bottom sheet modal component
- @shopify/flash-list 2.0.2 — High-performance list component
- @shopify/react-native-skia 2.2.12 — Graphics rendering

**Utilities:**
- zod ^3.23.8 — Schema validation (both projects)
- jose ^6.2.3 — JWT handling
- clsx ^2.1.1 — Conditional CSS class composition
- uuid ^14.0.0 — UUID generation
- html2canvas-pro ^2.0.2 — DOM-to-canvas rendering
- i18n-js ^4.5.3 — Internationalization framework
- sharp ^0.34.5 — Image processing (Node.js server-side)

## Configuration

**Environment:**
- Zod-based environment validation in `campanha-ia/src/lib/env.ts`
  - Parses and validates at boot via `src/instrumentation.ts`
  - Required vars fail fast rather than at first use
  - Supports optional/required-only-in-production patterns

**Build:**
- `crialook-app/tsconfig.json` — TypeScript config for mobile app
- `campanha-ia/tsconfig.json` — TypeScript config for web backend/frontend
- `crialook-app/.env.example` — Mobile app secrets template
- `crialook-app/.env` — Runtime config (not committed; contains EXPO_PUBLIC_* vars)
- `campanha-ia/.env.example` — Web backend secrets template
- `crialook-app/app.config.ts` — Expo app configuration (Android package name, permissions, icon)
- `crialook-app/eas.json` — EAS Build configuration for Android release builds
- `crialook-app/.npmrc` — npm client configuration (legacy peer deps)

## Platform Requirements

**Development:**
- Node.js 24 LTS (or npm 10 minimum for `crialook-app` lockfile compatibility with EAS)
- npm@10 (never plain `npm install` on `crialook-app` — use `npm run lock:fix` to regenerate npm@10 format)
- Expo CLI (globally installed or via npx)
- TypeScript 5.x
- Python 3.x (for `curriculo/gerar.py`)

**Production:**
- **`campanha-ia` Web Backend:** 
  - Ubuntu 24.04 VPS (2 vCPU, 4GB RAM tested)
  - Node.js 24 LTS
  - PM2 (process manager)
  - Nginx (reverse proxy with SSL via Let's Encrypt)
  - PostgreSQL (Supabase hosted)
  
- **`crialook-app` Mobile:**
  - Android 9+ (Play Store target: API 34)
  - EAS Build system for AAB generation
  
- **Deployment:**
  - Automated via `deploy-crialook.sh` (idempotent, includes Node.js install, PM2 setup, SSL, Nginx config)
  - Domain: crialook.com.br with SSL
  - Firewall: UFW with ports 80/443/SSH open

---

*Stack analysis: 2026-05-03*
