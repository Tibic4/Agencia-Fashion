# External Integrations

**Analysis Date:** 2026-05-03

## APIs & External Services

**Large Language Models (AI):**
- Anthropic Claude Sonnet 4.6 — Copywriting in Portuguese for campaigns
  - SDK: `@anthropic-ai/sdk` v0.92.0
  - Env var: `ANTHROPIC_API_KEY`
  - Used in: `campanha-ia/src/lib/ai/sonnet-copywriter.ts`
  - Flow: Receives scene/styling context → outputs Portuguese campaign copy + hashtags

- Google Gemini 3.1 Pro & 3 Pro Image — Image analysis and virtual try-on
  - SDK: `@google/genai` v1.48.0
  - Env vars: `GEMINI_API_KEY`, `GOOGLE_AI_API_KEY`, `GOOGLE_GENAI_API_KEY`, `AI_MODEL_GEMINI_FLASH`
  - Used in: `campanha-ia/src/lib/ai/gemini-analyzer.ts`, `campanha-ia/src/lib/ai/gemini-vto-generator.ts`
  - Flow: (a) Analyzer vision → extracts scene/color/styling → (b) VTO → generates single virtual try-on image

- fal.ai IDM-VTON — Fallback virtual try-on (~R$ 0.15-0.25/image)
  - SDK: `@fal-ai/client` v1.9.5
  - Env var: `FAL_KEY`
  - Used in: `campanha-ia/src/lib/fal/client.ts`
  - Flow: Secondary VTO provider when Gemini unavailable; cheaper open-source model

- Fashn.ai — Fashion product analysis (secondary provider)
  - SDK: fashn v0.13.0
  - Env vars: `FASHN_API_KEY`, `FASHN_API_URL` (default: https://api.fashn.ai/v1)
  - Used in: `campanha-ia/src/lib/ai/` pipeline

**Image Generation & Processing:**
- Google Cloud Storage (implicit via Supabase storage)
  - Stores campaign images, backdrop references, user uploads
  - Storage client wired in `campanha-ia/src/lib/storage/`

**Analytics & Tracking:**
- PostHog — Product analytics and feature flagging
  - SDK: `posthog-js` v1.364.7
  - Env vars: `POSTHOG_KEY`, `NEXT_PUBLIC_POSTHOG_HOST`, `NEXT_PUBLIC_POSTHOG_KEY`
  - Used in: `campanha-ia/` client-side for conversion tracking
  - Consent-gated: Only enabled if user consents to analytics

## Data Storage

**Databases:**
- PostgreSQL (Supabase hosted)
  - Connection: `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
  - Used in: `campanha-ia/` (backend queries and RLS policies)
  - Schema managed with: SQL migrations (path: `campanha-ia/migrations/` inferred)
  - Tables: stores, plans, campaigns, store_usage, webhooks, users (via Clerk)
  - Client: `@supabase/supabase-js` v2.101.1

**File Storage:**
- Supabase Storage (Google Cloud Storage backend)
  - Used in: `campanha-ia/` for campaign images, backdrops, model photos
  - Access: Service role key for server-side uploads/deletes
  - Client: `@supabase/supabase-js` with `.storage()` API

**Caching & Persistence:**
- AsyncStorage (React Native) — Mobile app local state
  - Library: `@react-native-async-storage/async-storage` v2.2.0
  - Used in: `crialook-app/` for offline-first feature flags and preferences
- MMKV — Fast key-value store for mobile app
  - Library: `react-native-mmkv` v3.2.0
  - Used in: `crialook-app/` for cache persistence
- React Query Client-Side Cache — In-memory + persisted via AsyncStorage/MMKV
  - Libraries: `@tanstack/react-query` + `@tanstack/react-query-persist-client`
  - Configured in: `crialook-app/lib/query-client.ts`

**In-Memory Cache (Web Backend):**
- Rate limiter in-memory Map
  - File: `campanha-ia/src/lib/rate-limit.ts`
  - ⚠️ **Limitation**: Single-process only. Cannot scale to multiple PM2 instances without migrating to Postgres/Redis
  - Note in `ecosystem.config.js` line 34: "sem antes migrar o rate limiter pra storage compartilhado"

## Authentication & Identity

**Auth Provider:**
- Clerk — User authentication and session management
  - SDKs: `@clerk/nextjs` v7.0.8 (web), `@clerk/clerk-expo` v2.19.31 (mobile)
  - Web setup: `campanha-ia/` uses Clerk middleware for protected routes
  - Mobile setup: `crialook-app/lib/auth.tsx` wraps app with `ClerkProvider`
    - Token cache: Secure storage via `expo-secure-store`
    - **Status**: Client Trust disabled for Play Store review; reactivate post-approval per `project_clerk_client_trust.md`
    - Boot timeout: 6 seconds fallback to avoid infinite splash screen if Clerk is slow/offline
  - Webhooks: `CLERK_WEBHOOK_SECRET` validates events at `campanha-ia/src/app/api/webhooks/clerk/route.ts`
  - JWT: Optional custom JWT key at `CLERK_JWT_KEY`

**Webhook Authentication:**
- Clerk webhook verification using `CLERK_WEBHOOK_SECRET`
  - Validates signature on user creation, updates, deletions
  - Triggers store creation/sync in `campanha-ia/src/lib/db/`

## Monitoring & Observability

**Error Tracking:**
- Sentry — Production error tracking and performance monitoring
  - SDKs: `@sentry/nextjs` v10.47.0 (web), `@sentry/react-native` v7.13.0 (mobile)
  - Web config: `campanha-ia/src/instrumentation.ts` (server-side), client-side in layout
  - Mobile config: `crialook-app/lib/sentry.ts`
    - Session Replay disabled (MediaCodec freeze bug in Sentry RN 7.2; fixed in 7.13)
    - Trace sampling: Default 20%, elevated to 100% for billing/generation operations
    - PII redaction: Auth headers and user context scrubbed before sending
  - Env vars: `SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_ORG`, `SENTRY_PROJECT`, `SENTRY_AUTH_TOKEN`

**Logging:**
- Console logging (structured via `campanha-ia/src/lib/observability.ts`)
- PM2 logs written to `/var/log/crialook/` (configured in `ecosystem.config.js`)
- Request logging via Nginx (structured format at `nginx-crialook.conf`)
- PostHog for user funnel/event analytics (opt-in consent)

**Uptime Monitoring:**
- Health check endpoint: `campanha-ia/src/app/api/health/route.ts`
  - Requires `HEALTH_CHECK_SECRET` query param
  - Monitored via external service (assumed UptimeRobot based on `curriculo/gerar.py` mention)

## CI/CD & Deployment

**Hosting:**
- **Web (`campanha-ia`):** VPS Ubuntu 24.04 (crialook.com.br)
  - Process manager: PM2
  - Web server: Nginx reverse proxy with SSL (Let's Encrypt)
  - Script: `deploy-crialook.sh` (idempotent, automates full setup)
  
- **Mobile (`crialook-app`):** Google Play Store (Android-only)
  - Build system: EAS Build (Expo managed service)
  - AAB signed via `crialook-app/play-store-key.json` (Google Play signing key)
  - Config: `crialook-app/eas.json`

**CI Pipeline:**
- GitHub Actions (inferred from repo structure)
  - Pre-commit hooks via Husky (`campanha-ia/.husky/`) validate linting
  - lint-staged runs ESLint on changed TypeScript files

**Deployment Automation:**
- `deploy-crialook.sh` — Full VPS setup (git clone, Node.js install, PM2, Nginx config, SSL certs)
- `ecosystem.config.js` — PM2 app lifecycle configuration
- Nginx config: `nginx-crialook.conf` with CSP, rate limiting, gzip/brotli, static caching

## Environment Configuration

**Required env vars (Production):**
- Core: `NODE_ENV`, `NEXT_PUBLIC_APP_URL`
- Supabase: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- Clerk: `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, `CLERK_WEBHOOK_SECRET`
- Mercado Pago: `MERCADOPAGO_ACCESS_TOKEN`, `MERCADOPAGO_WEBHOOK_SECRET`
- AI APIs: `ANTHROPIC_API_KEY` (required); `GEMINI_API_KEY` optional
- Observability: `SENTRY_DSN` (optional but recommended); `POSTHOG_KEY` for web analytics
- Inngest: `INNGEST_EVENT_KEY`, `INNGEST_SIGNING_KEY`
- Google Play: `GOOGLE_PLAY_PACKAGE_NAME` for subscription verification
- Admin/Cron: `ADMIN_USER_IDS`, `CRON_SECRET`, `HEALTH_CHECK_SECRET`
- Feature flags: `FEATURE_REGENERATE_CAMPAIGN`, `MINI_TRIAL_KILLSWITCH`, `MINI_TRIAL_TOTAL_SLOTS`

**Secrets location:**
- `.env.local` (Vercel-style, gitignored)
- `.env` files in each subdirectory (gitignored)
- Environment passed to PM2 via `ecosystem.config.js` env_production section
- Kubernetes-style or CI secret managers for GitHub Actions (specifics not detailed in codebase)

**Non-secret configuration:**
- `APP_URL` — Public domain (crialook.com.br)
- `FASHN_API_URL` — Default: https://api.fashn.ai/v1
- `USD_BRL_EXCHANGE_RATE` — Optional; used for pricing conversions
- `API_BUDGET_MONTHLY_BRL` — Optional; usage cap in Brazilian Real

## Webhooks & Callbacks

**Incoming (Webhook Endpoints):**
- **Mercado Pago Notifications** — `campanha-ia/src/app/api/billing/rtdn/route.ts`
  - Path: `/api/billing/rtdn`
  - Auth: HMAC-SHA256 signature validation
  - Events: Subscription renewal, cancellation, payment hold, expiration
  - SLA: Must respond <10s or Mercado Pago retries with exponential backoff
  - Idempotency: Handled via DB transaction atomicity

- **Google Play Pub/Sub RTDN** — `campanha-ia/src/app/api/billing/rtdn/route.ts` (same endpoint, different JWT auth)
  - Path: `/api/billing/rtdn`
  - Auth: JWT from accounts.google.com (issuer validation)
  - Events: App subscription state changes (purchase, renewal, cancel, hold, revoke)
  - Requires: `GOOGLE_PUBSUB_AUDIENCE`, `GOOGLE_PUBSUB_ALLOWED_SERVICE_ACCOUNT`, `GOOGLE_PLAY_PACKAGE_NAME`
  - **Status**: Disabled (503) until Google Play config arrives

- **Clerk Webhooks** — `campanha-ia/src/app/api/webhooks/clerk/route.ts` (assumed)
  - Path: `/api/webhooks/clerk` (inferred)
  - Auth: Signature validation via `CLERK_WEBHOOK_SECRET`
  - Events: user.created, user.updated, user.deleted
  - Side effects: Creates/updates store in Supabase

**Outgoing (API Calls):**
- **Anthropic API** — Synchronous LLM calls (campaign copy generation)
- **Google Gemini** — Synchronous image analysis and VTO
- **fal.ai** — Async VTO fallback
- **Fashn.ai** — Fashion analysis
- **Mercado Pago API** — Create checkout sessions, verify webhooks, query subscriptions
- **Google Play Developer API** — Verify subscription tokens (via `crialook-app/lib/billing.ts`)
- **Inngest Webhooks** — Fire events for async job orchestration
- **PostHog API** — Analytics data ingestion (client-side JS)
- **Sentry API** — Error event ingestion (both SDKs)
- **Supabase API** — Realtime subscriptions and RPC calls

## Payment Processing

**Provider:** Mercado Pago (primary), Google Play Billing (mobile subscriptions)

**Mercado Pago Integration:**
- SDK: `mercadopago` v2.12.0 (`campanha-ia/src/lib/payments/mercadopago.ts`)
- Plans configured in Supabase: gratis, essencial_mensal, pro_mensal, business_mensal
- Checkout flow: `campanha-ia/src/app/api/checkout/route.ts` creates PreApproval subscription
- Webhook handler: `/api/billing/rtdn` processes payment state changes
- Fraud gate: Validates amount matches expected plan pricing (prevents payment disputes)
- Idempotency: Database transactions ensure duplicate webhooks don't double-credit

**Google Play Billing (Mobile):**
- SDK: `react-native-iap` v14.7.20 (`crialook-app/lib/billing.ts`)
- Flow: User selects plan in mobile app → requestPurchase → receipt verified at backend
- Backend verification: `campanha-ia/src/app/api/billing/verify/route.ts` validates with Google Play Developer API
- Subscriptions managed: essencial_mensal, pro_mensal, business_mensal (same SKUs as Mercado Pago)

**Trial & Redemption:**
- Free plan (gratis) auto-assigned to all new users
- Mini-trial system: `campanha-ia/src/app/api/credits/claim-mini-trial/route.ts`
  - Killswitch: `MINI_TRIAL_KILLSWITCH` env var
  - Slot limit: `MINI_TRIAL_TOTAL_SLOTS`
- Upgrade flow: `campanha-ia/src/app/api/checkout/route.ts` → Mercado Pago checkout
- Restore flow: `campanha-ia/src/app/api/billing/restore/route.ts` (refetch subscriptions after network failure)

## Async Job Processing

**Inngest:**
- SDK: `inngest` v4.1.2
- Config: `campanha-ia/src/lib/inngest/client.ts`
- Env vars: `INNGEST_EVENT_KEY`, `INNGEST_SIGNING_KEY`
- Used for:
  - Campaign generation pipeline retries (AI fallback chains)
  - Email delivery (transactional emails)
  - Cron jobs (downgrade expired subscriptions, exchange rate updates)
- Functions: `campanha-ia/src/lib/inngest/functions.ts` (inferred)

## Compliance & Data Handling

**LGPD (Brazilian Data Privacy Law):**
- Consent management: Biometric consent gate (`campanha-ia/src/components/ConsentBiometric.tsx` inferred)
- Cookie consent: `campanha-ia/src/components/CookieBanner.tsx`
- Data export: `campanha-ia/src/app/api/me/export/route.ts` (Art. 18 V/VI portability)
- Data deletion: Store deletion via authenticated endpoints
- Documentation: `/termos`, `/privacidade`, `/dpo`, `/consentimento-biometrico` routes

---

*Integration audit: 2026-05-03*
