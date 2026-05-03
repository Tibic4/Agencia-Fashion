<!-- refreshed: 2026-05-03 -->
# Architecture

**Analysis Date:** 2026-05-03

## System Overview

```text
┌────────────────────────────────────────────────────────────────────────────────┐
│                          CRIALOOK — PLATFORM ARCHITECTURE                     │
├──────────────────────────────────────┬─────────────────────────────────────────┤
│ MOBILE — crialook-app (Android only) │ WEB — campanha-ia (Next.js 16)         │
│ Expo SDK 54 / RN 0.81 / Expo Router  │ App Router · React 19 · TS strict       │
│ MMKV cache · TanStack Query · Skia   │ Landing · /gerar · /admin · /editor     │
│ Clerk Expo · expo-iap (Google Play)  │ Server Components · API Routes (SSE)    │
└─────────────────┬────────────────────┴───────────────────┬─────────────────────┘
                  │ HTTPS  Bearer (Clerk JWT)              │ HTTPS  Cookie (Clerk session)
                  │ X-App-Locale: pt-BR | en               │
                  │ Idempotency-Key: <uuid>                │
                  └────────────────────┬───────────────────┘
                                       │
                  ┌────────────────────▼───────────────────┐
                  │  NGINX (VPS KingHost · Ubuntu 24.04)   │
                  │  TLS · HSTS · CSP-RO · Brotli + Gzip   │
                  │  proxy_cache html_cache (landing/legal)│
                  │  rate-limit zones api_limit/webhook    │
                  │  /api/campaign/generate → SSE no-buffer│
                  └────────────────────┬───────────────────┘
                                       │ http://127.0.0.1:3000
                  ┌────────────────────▼───────────────────┐
                  │  Next.js (PM2 fork-mode · 1 instance)  │
                  │  max_memory_restart=1500M · kill=30s   │
                  │  ┌─────────┬───────────┬────────────┐  │
                  │  │ Pages   │ API       │ Webhooks   │  │
                  │  │ Server  │ Routes    │ MP / Clerk │  │
                  │  │ Comps   │ + SSE     │ + RTDN     │  │
                  │  └────┬────┴─────┬─────┴─────┬──────┘  │
                  └───────┼──────────┼───────────┼─────────┘
                          │          │           │
        ┌─────────────────┘          │           └────────────────┐
        │                            │                            │
        ▼                            ▼                            ▼
┌──────────────────────┐ ┌──────────────────────┐ ┌──────────────────────────┐
│ AI PIPELINE (parallel)│ │ INNGEST (background) │ │ EXTERNAL APIS            │
│  Gemini 3.1 Pro       │ │  judge-campaign      │ │  Clerk auth + webhooks   │
│   Analyzer (vision +  │ │  generate-model-     │ │  Mercado Pago checkout + │
│   pose + scene)       │ │   preview            │ │   subscriptions + WH     │
│  Gemini 3 Pro Image   │ │  generate-backdrop   │ │  Google Play (RTDN +     │
│   VTO (1× look)       │ │  storage-gc (cron 3a)│ │   Developer API)         │
│  Claude Sonnet 4.6    │ │  quality-alerts      │ │  AwesomeAPI (USD→BRL)    │
│   Copywriter PT/EN    │ │   (cron 7am UTC)     │ │  Sentry · PostHog        │
└──────────┬───────────┘ └──────────┬───────────┘ └──────────────────────────┘
           │                        │
           └────────────┬───────────┘
                        │
           ┌────────────▼─────────────────────────────────────────────────┐
           │  SUPABASE (Postgres 17 · region SA-East-1)                   │
           │  RLS on all 14+ tables · ~14 RPCs SECURITY DEFINER           │
           │  Storage buckets: product-photos · generated-images · assets │
           │  Service-role key only on server (createAdminClient)         │
           │                                                              │
           │  Core tables: stores · campaigns · campaign_outputs ·        │
           │  campaign_scores · store_models · model_bank · plans ·       │
           │  store_usage · credit_purchases · subscriptions ·            │
           │  push_tokens · mini_trial_uses · checkout_locks ·            │
           │  plan_payments_applied · api_cost_logs · admin_settings ·    │
           │  fashion_facts · showcase_items                              │
           └──────────────────────────────────────────────────────────────┘
                        │
           ┌────────────▼────────────┐
           │  Cron (host-level)      │
           │  /5min  health-check    │
           │  daily   pg_dump backup │
           │  daily   downgrade-     │
           │           expired       │
           │  daily   exchange-rate  │
           └─────────────────────────┘
```

## Component Responsibilities

| Component | Responsibility | File / Path |
|-----------|----------------|-------------|
| **crialook-app (Mobile)** | Photo capture/picker, FormData submission to web SSE, polling `/campaigns/[id]`, model gallery, Google Play IAP, push notifications | `crialook-app/app/`, `crialook-app/lib/api.ts`, `crialook-app/hooks/gerar/` |
| **campanha-ia (Web)** | Landing, `/gerar` SSE pipeline, admin dashboard, webhooks, REST API, Server Components | `campanha-ia/src/app/`, `campanha-ia/src/lib/` |
| **AI Pipeline orchestrator** | Sequence Gemini Analyzer → parallel(VTO, Sonnet) → emit Inngest judge event | `campanha-ia/src/lib/ai/pipeline.ts` |
| **Inngest functions** | Async jobs (judge, model preview, backdrop, storage GC, quality alerts) | `campanha-ia/src/lib/inngest/functions.ts`, `campanha-ia/src/lib/inngest/storage-gc.ts` |
| **Supabase admin layer** | Typed CRUD with service-role key, atomic credit/quota RPCs | `campanha-ia/src/lib/db/index.ts`, `campanha-ia/src/lib/supabase/admin.ts` |
| **Mercado Pago webhook** | HMAC verify → fraud-gate price match → idempotent credit/plan grant | `campanha-ia/src/app/api/webhooks/mercadopago/route.ts` |
| **Clerk webhook** | Svix HMAC verify → create placeholder store on `user.created` | `campanha-ia/src/app/api/webhooks/clerk/route.ts` |
| **Google Play billing** | RTDN handler + verifySubscription via Developer API | `campanha-ia/src/app/api/billing/rtdn/route.ts`, `campanha-ia/src/lib/payments/google-play.ts` |
| **Editor (standalone)** | Konva canvas editor with own HMAC-signed cookie auth (not Clerk) | `campanha-ia/src/app/editor/`, `campanha-ia/src/lib/editor-session.ts` |
| **Nginx** | TLS termination, rate-limit zones, html_cache, SSE no-buffer for `/api/campaign/generate` | `nginx-crialook.conf` |
| **PM2** | Process supervision, graceful 30s shutdown for in-flight pipelines | `ecosystem.config.js` |

## Pattern Overview

**Overall:** Monorepo with three apps. Web (`campanha-ia/`) is the API + dashboard server-of-truth. Mobile (`crialook-app/`) is a thin Expo client that talks only to the web's REST API. `curriculo/` is unrelated and excluded from the platform.

**Key Characteristics:**
- **SSE for the hot path.** `/api/campaign/generate` returns `text/event-stream` (`route.ts:850-857`); the client consumes `progress` / `done` / `error` events. Nginx `/api/campaign/generate` location disables `proxy_buffering`, sets 300s timeouts, and adds `X-Accel-Buffering: no` (`nginx-crialook.conf:127-144`).
- **Synchronous pipeline — not Inngest-queued.** Generation runs inside the request handler (`pipeline.ts:121`) — Inngest is reserved for follow-up jobs (judge scoring, model previews, GC, alerts). The historical `generateCampaignJob` was deleted in Phase 01-03 (`functions.ts:21-25`).
- **Fail-soft + slot reservation.** Generate route reserves credit/plan slot UPFRONT (`generate/route.ts:155-200`), refunds on `successCount === 0`, all uploads failed, retryable errors, or safety blocks. Idempotent via `Idempotency-Key` UUID from client (`useCampaignGenerator.ts:175-179`).
- **Auth dual-mode.** Mobile sends Clerk JWT in `Authorization: Bearer`. Web pages use Clerk session cookies (HTTP). Editor uses its own HMAC-signed cookie (`editor-session.ts:12-21`). Middleware is intentionally NOT applied to `/api/*` so mobile JSON callers don't get HTML 307 redirects (`middleware.ts:14-20`).
- **RLS + service role.** All client-side reads go through Supabase RLS policies keyed on `auth.jwt() ->> 'sub'` matching `stores.clerk_user_id` (`baseline.sql:332-390`). Server uses `createAdminClient()` (service-role) for writes and cross-store reads (`admin.ts:5-16`).
- **Pose anti-monotonia.** Pre-pipeline, `pipeline.ts:131-151` reads `stores.recent_pose_indices` to compute `blockedPoseIndex` (streak of 3 same poses). Post-generation update is fire-and-forget.
- **Android-only mobile.** `crialook-app` targets Google Play exclusively; iOS paths can be dropped (per `MEMORY.md:project_android_only`).
- **Phase 2.5 (Labeling) deferred indefinitely.** Judge captures uncalibrated scores; do not treat as in-progress (per `MEMORY.md:project_phase_25_deferred`).

## Layers

**Web (`campanha-ia/`):**

- **Edge / Middleware** (`src/middleware.ts:104-179`)
  - `clerkMiddleware` — `/admin/*`, `/gerar`, `/historico`, `/modelo`, `/configuracoes`, `/plano`, `/onboarding` require auth.
  - Cookie cache `cl_hs_<userId>` skips Supabase `hasStore` lookup on every navigation (TTL 1h, `middleware.ts:53-54`).
  - `/api/*` and `/editor/*` are NOT gated here — they self-validate.

- **Presentation** (`src/app/`)
  - Public: `page.tsx` (landing), `sobre/`, `termos/`, `privacidade/`, `subprocessadores/`, `dpo/`, `consentimento-biometrico/`, `excluir-conta/`.
  - Auth (Clerk-gated): `(auth)/gerar`, `(auth)/historico`, `(auth)/modelo`, `(auth)/plano`, `onboarding/`.
  - Admin: `admin/{campanhas,clientes,custos,quality,vitrine,logs,configuracoes,editor}` (gated by middleware admin role check, `middleware.ts:108-135`).
  - Standalone editor: `editor/` (HMAC cookie auth, NOT Clerk).

- **API Routes** (`src/app/api/`)
  - `campaign/generate/route.ts` — SSE pipeline entry (`maxDuration=300`, `route.ts:18`).
  - `campaign/[id]/{favorite,regenerate,tips}/route.ts` — campaign actions.
  - `campaigns/route.ts`, `campaigns/[id]/route.ts` — list + read with plan-gated history window.
  - `campaign/format/route.ts` — formatting helper.
  - `webhooks/mercadopago/route.ts`, `webhooks/clerk/route.ts`.
  - `billing/{verify,restore,rtdn}/route.ts` — Google Play (mobile in-app purchase).
  - `checkout/route.ts` — MP PreApproval (web subscription).
  - `credits/{route,check-payment,claim-mini-trial,mini-trial-status,trial-status}` — MP one-shot credit packs + 50-slot mini-trial.
  - `cron/{downgrade-expired,exchange-rate}/route.ts` — `Bearer CRON_SECRET`-gated (`downgrade-expired/route.ts:20-33`).
  - `inngest/route.ts` — Inngest function handler (`serve(...)`, `inngest/route.ts:9`).
  - `store/{route,usage,credits,backdrop,logo,onboarding,push-token}` — store CRUD.
  - `me/{route,export}` — DELETE account + LGPD export.
  - `editor-auth/`, `health/`, `model/`, `models/`, `subscription/`, `showcase/`, `fashion-facts/`, `demo-download/`, `preview/`, `admin/{plans,settings,showcase,storage-gc,stores}/`.

- **Business / AI Pipeline** (`src/lib/ai/`)
  - `pipeline.ts` — orchestrator.
  - `gemini-analyzer.ts` — vision + scene/pose prompt (exports `ANALYZER_PROMPT_VERSION`).
  - `gemini-vto-generator.ts` — VTO image (exports `VTO_PROMPT_VERSION` at line 403).
  - `sonnet-copywriter.ts` — PT-BR/EN copy (`SONNET_PROMPT_VERSION_PT/EN` at line 167-168).
  - `judge.ts` — LLM-as-judge for campaign quality (Phase 02 D-01..D-06; `JUDGE_PROMPT_VERSION`).
  - `identity-translations.ts` — pose history + skin/hair lock helpers.
  - `clients.ts` — single source for `getAnthropic()` + `getGoogleGenAI()` lazy singletons (`clients.ts:32-51`).
  - `backdrop-generator.ts` — empty-studio reference image.
  - `mock-data.ts` — `runMockPipeline()` for demo mode (no API keys).
  - `with-timeout.ts` — external liveness wrapper (no SDK timeout).
  - `log-model-cost.ts` — consolidated `api_cost_logs` writer.

- **Inngest** (`src/lib/inngest/`)
  - `client.ts` — singleton.
  - `functions.ts` — exports `inngestFunctions = [generateModelPreviewJob, generateBackdropJob, judgeCampaignJob, qualityAlertsCron, storageGarbageCollectorCron, storageGarbageCollectorManual]` (line 539-546).
  - `storage-gc.ts` — daily 03:00 UTC cron (line 24) + manual trigger.

- **Data Access** (`src/lib/`)
  - `db/index.ts` — typed Supabase queries (admin client).
  - `supabase/admin.ts` — service-role client (`admin.ts:5-16`).
  - `supabase/server.ts` — `@supabase/ssr` cookie-bound RLS client (`server.ts:4-27`).
  - `supabase/client.ts` — browser anon client.
  - `payments/mercadopago.ts` — `createSubscription`, `cancelSubscription`, `getPaymentStatus`, `getSubscriptionStatus`.
  - `payments/google-play.ts` — Developer API verify + acknowledge.
  - `payments/google-pubsub-auth.ts` — RTDN Pub/Sub bearer verify.
  - `mp-signature.ts` — HMAC validator for `/api/webhooks/mercadopago`.
  - `editor-session.ts` — HMAC-signed editor cookie (replaces legacy `editor_session=authenticated`).
  - `rate-limit.ts` — in-process Map (NOT cluster-safe; PM2 forced to `instances:1` in `ecosystem.config.js:38-39`).
  - `observability.ts` — Sentry wrapper + structured logger.
  - `quality/alerts.ts` — face_wrong WoW + nivel_risco='alto' rolling 7-day breach detectors.
  - `pricing/`, `plans.ts` — plan + credit-pack price catalog.
  - `storage/{garbage-collector,signed-url}.ts` — GC engine + signed URL helper.

**Mobile (`crialook-app/`):**

- **Presentation** (`app/` — Expo Router)
  - Tabs: `(tabs)/gerar/{index,resultado,_layout}.tsx`, `(tabs)/historico.tsx`, `(tabs)/modelo.tsx`, `(tabs)/plano.tsx`, `(tabs)/configuracoes.tsx`.
  - Auth: `sign-in.tsx`, `sign-up.tsx`, `sso-callback.tsx`, `onboarding.tsx`.
  - Legal (bundled): `(legal)/`.
  - Dev: `__catalog.tsx` (Storybook).
  - Root: `_layout.tsx` — providers + `AuthGate` (`_layout.tsx:42-110`).

- **Hooks** (`hooks/gerar/`)
  - `useCampaignGenerator.ts` — assemble FormData → POST → handle quota/error/success → start polling.
  - `useCampaignPolling.ts` — 5s interval, 3min wall-clock timeout, AppState pause/resume (`useCampaignPolling.ts:31-78`).
  - `useImagePickerSlot.ts`, `useModelSelector.ts`.
  - `hooks/useMaterialYou.ts` — Android 12+ palette extraction.
  - `hooks/useNetworkStatus.ts` — expo-network connectivity.

- **Lib**
  - `api.ts` — central HTTP client: timeout, retries (GET only), in-flight dedup, MMKV cache, zod schema validation (`api.ts:9-152`).
  - `auth.tsx` — Clerk Expo provider, SecureStore token cache, jwtCache TTL 30s, 6s init fallback for Client Trust OFF (`auth.tsx:30-43`).
  - `cache.ts` — MMKV-backed key/value with TTL.
  - `query-client.ts` — TanStack Query + AsyncStorage persistence + AppState focus wiring.
  - `billing.ts` — react-native-iap (Google Play Billing) lifecycle.
  - `notifications.ts` — Expo push token registration + deep-link handler.
  - `sentry.ts` — Session Replay disabled in 3 layers (see `_layout.tsx:25-32` comment).
  - `i18n/`, `theme/`, `schemas.ts` (zod), `toast.ts`, `haptics.ts`, `legal/`.

## Data Flow

### Hot Path 1 — `/gerar` SSE Pipeline

1. **User taps Gerar** (`crialook-app/app/(tabs)/gerar/index.tsx`)
   - Compresses photos via `useImagePickerSlot`, builds `CampaignInputs`.

2. **`useCampaignGenerator.submit()`** (`crialook-app/hooks/gerar/useCampaignGenerator.ts:128-236`)
   - Wraps in Sentry span `campaign.submit`.
   - `getAuthToken()` → Clerk JWT from in-memory 30s cache, fallback to `clerk.session.getToken()` (`auth.tsx:120-135`).
   - Builds `FormData` (`image`, `closeUpImage`, `secondImage`, `price`, `title`, `targetAudience`, `toneOverride`, `backgroundType`, `bodyType`, `customModelId`/`modelBankId`).
   - `fetch(${BASE_URL}/campaign/generate, POST)` with headers `X-App-Locale`, `Idempotency-Key: <uuid>`, `Authorization: Bearer ...` (line 175-186).

3. **Nginx forwards SSE** (`nginx-crialook.conf:127-144`)
   - Location `/api/campaign/generate`: `proxy_buffering off`, `proxy_cache off`, `proxy_read_timeout 300s`, `client_max_body_size 25M`.
   - Rate-limit zone `api_limit` (10r/s, burst=5).

4. **Server validates + reserves** (`campanha-ia/src/app/api/campaign/generate/route.ts:50-200`)
   - `auth()` extracts `clerkUserId` (line 53).
   - Per-IP rate-limit via `checkRateLimit(ip, {authenticated})` (line 56-67).
   - Parse FormData; whitelist `objective` (line 77); sanitize all strings via `safeStr` strip `<>` (line 81-88).
   - Validate price `0 ≤ n ≤ 99999` (line 129-137); MIME ∈ {jpeg,png,webp,gif} (line 140-143); size ≤10MB (line 144).
   - `getStoreByClerkId(clerkUserId)` (line 151).
   - Quota: `canGenerateCampaign(store.id)` → if denied, 429 `QUOTA_EXCEEDED` with `used/limit/credits/upgradeHint` (line 164-175).
   - **Reserve UPFRONT** (race-condition fix): if avulso credit available → `consumeCredit(store.id, 'campaigns')` (line 178-194); else → `incrementCampaignsUsed(store.id)` (line 197).
   - Trial-only detection: `mini_trial_uses` exists AND zero `credit_purchases` rows → `isTrialOnly = true` → 1 photo + 2 blurred teasers later (line 212-235).

5. **Image preprocessing** (line 247-303)
   - Sharp downscale to 1536px, WebP 80% (line 252-265). Reject if >8MB after optim (line 267-275).
   - Same downscale for `closeUpImage` and `secondImage` to 1024px WebP 75%.

6. **Upload product photo to `product-photos` bucket** (line 311-335).

7. **Create campaign row** `status=pending` (line 337-346).

8. **Resolve model image** (line 376-480)
   - Priority: explicit `customModelId` (store-owned) → `modelBankId` (public bank) → store's active model → 1×1 transparent PNG fallback.

9. **SSE stream open** (line 482-857)
   - `TransformStream`, writer; `sendSSE(event, data)` writes `event: ...\ndata: ...JSON...\n\n` (line 490-494).
   - Returns `Response(stream.readable, headers={Content-Type:'text/event-stream', Cache-Control:'no-cache,no-transform', Connection:'keep-alive', X-Accel-Buffering:'no'})` (line 850-857).
   - Async IIFE drives the pipeline:

10. **`runCampaignPipeline()`** (`campanha-ia/src/lib/ai/pipeline.ts:121-392`)
    - **Read pose history**: `stores.recent_pose_indices` → `getStreakBlockedPose()` (line 131-151).
    - **Step 1 — Gemini 3.1 Pro Analyzer** (line 153-166): vision + `vto_hints.scene_prompts[0]` + `pose_index`. Logs cost via `logModelCost` (line 189-205).
    - Emit `progress` events 8% / 30% / 40% via `onProgress?.(...)` callback wrapping `sendSSE("progress", ...)` (`generate/route.ts:521-525`).
    - **Step 2 — PARALLEL** (`Promise.all`, line 308):
      - `imagePromise` = `generateWithGeminiVTO()` — 1 look, with identity-lock built from `modelInfo` (skin/hair/age/gender).
      - `copyPromise` = `generateCopyWithSonnet()` — `targetLocale` PT-BR or EN; on failure falls back to hard-coded captions (line 251-274).
    - **Step 3 — Persist pose history** (line 316-331) fire-and-forget if `successCount > 0`.
    - **Step 4 — Emit Inngest event `campaign/judge.requested`** (line 345-374) — only if `successCount > 0`, NOT in `dryRun` (eval mode), gated to skip fully on D-18.
    - Returns `{analise, vto_hints, dicas_postagem, images, successCount, durationMs}`.

11. **Server post-pipeline** (`generate/route.ts:527-786`)
    - If `successCount === 0`: refund credit/slot via `add_credits_atomic` RPC or `decrement_campaigns_used` RPC; send `error` SSE `ALL_IMAGES_FAILED` (line 531-571).
    - Upload each generated image to `generated-images` bucket with 3-attempt exponential backoff (400ms, 1200ms) (line 580-622).
    - If ALL uploads failed: refund credit/slot, send `error` SSE `ALL_UPLOADS_FAILED` (line 629-671).
    - Trial-only: generate 2 blurred teasers (left top-half, right bottom-half) via Sharp `extract+blur+webp` and upload to `generated-images` (line 681-741).
    - `savePipelineResultV3(...)` writes the v3 JSON blob into `campaigns.output` (line 743-752).
    - Send final `done` SSE with `{success, campaignId, data: {analise, images, prompts, dicas_postagem, durationMs, successCount}}` (line 767-786).
    - On pipeline error: refund logic for `retryable || SAFETY_BLOCKED || IMAGE_GENERATION_BLOCKED` (line 800-814); insert `pipeline_error` row in `api_cost_logs.metadata` (line 817-837); send `error` SSE.
    - `finally { writer.close() }` always closes the stream (line 845-846).

12. **Mobile parses** (`useCampaignGenerator.ts:188-227`)
    - Reads `res.text()`, JSON-parses; checks `code === 'QUOTA_EXCEEDED'` → opens quota modal; else extracts `campaignId` from regex `"campaignId"\s*:\s*"([^"]+)"` (line 215) — current implementation reads SSE-as-text, falling back to regex match.
    - Calls `polling.start(campaignId)`, invalidates `/campaigns` and `/store/usage` MMKV cache.

13. **Polling** (`useCampaignPolling.ts:60-78`)
    - `apiGet('/campaigns/${id}')` every 5s, hard-stop at 180s (line 31-32).
    - Pauses on AppState background, resumes on foreground (per file header).
    - Terminal: `data.status === 'completed'` → `onStatus({kind:'completed'})` → refetch `qk.campaigns.list()` so the unseen-generations badge surfaces it (`useCampaignGenerator.ts:88-105`).

14. **Result screen** `app/(tabs)/gerar/resultado.tsx` reads campaign via TanStack Query.

### Hot Path 2 — Mercado Pago Webhook → Credit Grant

1. **MP POSTs** `/api/webhooks/mercadopago` with headers `x-signature: ts=...,v1=<hmac>` and `x-request-id: <id>`.

2. **Nginx routes** via `/api/webhooks/` location: rate-limit zone `webhook_limit` (30r/s, burst=60), `proxy_buffering off`, `client_max_body_size 1M` (`nginx-crialook.conf:113-124`).

3. **HMAC validation** (`webhooks/mercadopago/route.ts:24-39, 67-70`)
   - `validateMpSignature({secret: MERCADOPAGO_WEBHOOK_SECRET, xSignatureHeader, xRequestId, dataId})` — 5min anti-replay window via `ts`, `timingSafeEqual` compare. Reject 401 if invalid.

4. **Logger emits PII-safe metadata only** (line 58-63) — NEVER logs body (payer.email, cpf).

5. **Route on `body.type`:**
   - `payment` → `handlePaymentEvent(paymentId)` (line 75-77).
   - `subscription_preapproval` → `handleSubscriptionEvent(subscriptionId)` (line 82-84).

6. **`handlePaymentEvent(paymentId)`** (line 99-254)
   - `getPaymentStatus(paymentId)` → MP API call.
   - If `status === 'approved'`:
     - **CRÉDITO AVULSO** (`external_reference = "credit|<storeId>|<type>|<qty>[|bonusModels:N]"`):
       - Validate type ∈ {campaigns, models, regenerations} (line 124).
       - **FRAUD GATE**: lookup `ALL_CREDIT_PACKAGES.find(p => p.type===t && p.quantity===q)`; if no match → reject (line 127-136). Then `amountMatches(paid, expectedPrice)` with R$0.01 tolerance — reject if mismatch (line 137-143).
       - **Idempotency**: check `credit_purchases.mercadopago_payment_id == paymentId`; ignore duplicate (line 144-154).
       - `addCreditsToStore(storeId, type, quantity, transactionAmount, paymentId)` (line 158-164).
       - Bonus models if `|bonusModels:N` part present, capped at 10 (line 169-179).
     - **PLANO RECORRENTE** (`external_reference = "<storeId>|<planId>"`):
       - Validate `PLANS[planId]` exists; reject if unknown (line 193-199).
       - Fraud-gate: `paid == plan.price ± R$0.01`, reject if mismatch (line 200-206).
       - Idempotency: `plan_payments_applied.payment_id == paymentId` → ignore (line 209-217).
       - `updateStorePlan(storeId, planId)` resets quota for the month (line 224).
       - INSERT into `plan_payments_applied` (line 227-232).
       - Save `mercadopago_customer_id` on `stores` (line 235-239).
   - On `rejected`: log only (MP retries 4× automatically). On `pending`: log (PIX/boleto).

7. **`handleSubscriptionEvent(subscriptionId)`** (line 260-318)
   - `getSubscriptionStatus(...)` → MP API.
   - `authorized`: save `mercadopago_subscription_id` on store (plan activates via separate payment event).
   - `paused`: log only.
   - `cancelled`: clear `mercadopago_subscription_id` BUT keep current plan until period_end (downgrade happens via `cron/downgrade-expired`).

8. **Always returns 200** on processing errors (line 88-93) to prevent infinite MP retries; bugs go to Sentry via `captureError`.

### Hot Path 3 — App → Web API Auth

1. **Clerk Expo init** (`crialook-app/lib/auth.tsx:88-100`)
   - `<ClerkProvider publishableKey tokenCache>` where `tokenCache` is SecureStore-backed (`auth.tsx:9-19`).
   - Inner `AuthInner` (line 45-86) uses `useClerkAuth()` + `useUser()` to derive `{isSignedIn, user, loading, signOut}`.
   - **6s init fallback** (`INIT_TIMEOUT_MS = 6000`, line 43-54): if `isLoaded` doesn't flip, force `loading: false` so user lands on `/sign-in` instead of eternal splash. This exists because **Clerk Client Trust is OFF** for Play Store review (per `MEMORY.md:project_clerk_client_trust`); reactivate after Play approval.

2. **Sign-in flow** (`app/sign-in.tsx`, `app/sso-callback.tsx`)
   - Google OAuth via `useSSO()`; redirect to `sso-callback.tsx`; `expo-web-browser.maybeCompleteAuthSession()` invoked at module scope in `_layout.tsx:56`.

3. **`AuthGate`** (`app/_layout.tsx:85-110+`)
   - Reads `useAuth()`; routes:
     - signed-out + in tabs → `replace('/sign-in')`.
     - signed-in + in `(sign-in|sign-up)` → `replace('/(tabs)/gerar')`.
   - Gate `<Slot />` render on `routeReady` to avoid render-then-redirect flicker.

4. **Per-request token attachment** (`crialook-app/lib/api.ts:49-58`)
   - `getCommonHeaders()` always sets `X-App-Locale: <lang>`; `getAuthToken()` prepends `Authorization: Bearer ...`.
   - **30s in-memory JWT cache** (`auth.tsx:117-135`): `clerk.session?.getToken()` is the network call; cache holds the JWT for 30s (Clerk tokens are ~60s TTL with auto-refresh). Saves 100-400ms on screens making N parallel calls.

5. **Clerk webhook on signup** (`campanha-ia/src/app/api/webhooks/clerk/route.ts`)
   - Svix signature verify (`svix-id`, `svix-timestamp`, `svix-signature` headers, line 19-46).
   - On `user.created` (only event processed, line 64-66): create placeholder `stores` row with `onboarding_completed=false` and email-prefix as name (line 88-97).
   - This eliminates the "user just signed up but middleware sees no store" flicker.

6. **Web `/api/*` validation** — every route handler does `const { userId } = await auth()` and returns 401 JSON if missing (e.g., `campaign/generate/route.ts:52-53`, `checkout/route.ts:23-26`, `store/usage/route.ts:14-17`). Middleware does NOT redirect `/api/*` because mobile cannot follow HTML 307 → `/sign-in` (`middleware.ts:14-20`).

7. **Editor — separate auth** (`src/lib/editor-session.ts:12-21`)
   - HMAC-SHA256 token format `<issuedAt>.<expiresAt>.<nonce>.<hmac>`; 30-day default TTL; `timingSafeEqual` comparison (line 23-41). Replaces legacy `editor_session=authenticated` plain-string cookie.

## Background Job Topology

**Inngest functions** registered in `src/lib/inngest/functions.ts:539-546`, served at `/api/inngest` (`inngest/route.ts:9`). Inngest event keys via `INNGEST_EVENT_KEY` env (`client.ts:11-14`).

| Function | ID | Trigger | Retries | Purpose | File |
|----------|-----|---------|---------|---------|------|
| `generateModelPreviewJob` | `generate-model-preview` | event `model/preview.requested` | 2 | Generate virtual-model preview via Gemini 3.1 Flash Image (~R$0.006); upload to `assets/model-previews/<storeId>/<modelId>.<ext>`; on terminal failure mark `store_models.preview_status='failed'` | `functions.ts:206-262` |
| `generateBackdropJob` | `generate-backdrop` | event `store/backdrop.requested` | 2 | Generate brand-color empty studio reference for VTO consistency | `functions.ts:279-309` |
| `judgeCampaignJob` | `judge-campaign` | event `campaign/judge.requested` | 2 | LLM-as-judge scoring (Phase 02 D-01..D-06); `scoreCampaignQuality` via Anthropic tool_use + Zod; UPSERT into `campaign_scores`; logs cost with `JUDGE_PROMPT_VERSION`. Terminal failure writes `nivel_risco='falha_judge'` sentinel (D-02) so `/admin/quality` distinguishes judge-failure from low-quality | `functions.ts:337-449` |
| `qualityAlertsCron` | `quality-alerts-daily` | cron `0 7 * * *` (7am UTC) | 2 | (a) face_wrong WoW spike (>threshold AND Δ>delta), (b) nivel_risco='alto' rolling 7-day spike. Fires synthetic Sentry alerts with PII-safe fingerprints | `functions.ts:469-534` |
| `storageGarbageCollectorCron` | `storage-garbage-collector` | cron `0 3 * * *` (3am UTC) | 1 | Delete unfavorited campaign images older than 25 days. `concurrency:1 key:storage-gc-global` so cron + manual never overlap | `storage-gc.ts:16-52` |
| `storageGarbageCollectorManual` | `storage-gc-manual` | event `storage/gc.requested` | 0 | Admin-triggered GC with `dryRun` toggle (default `true`) | `storage-gc.ts:58-76` |

**Producers (who emits events):**
- `model/preview.requested` — `/api/store/onboarding/*`, `/api/model/*`, admin model creation flows.
- `store/backdrop.requested` — `/api/store/backdrop/*`.
- `campaign/judge.requested` — `pipeline.ts:354-373` after successful VTO. **Known limitation** (Phase 02 scope): `productImageUrl` and `modelImageUrl` are emitted as empty strings because pipeline.ts only has base64 inputs at emit time; judge prompt is robust to missing URLs (`pipeline.ts:339-343`).
- `storage/gc.requested` — admin button.

**Cron-style HTTP routes** (NOT Inngest, called by external scheduler with `Bearer CRON_SECRET`):

| Route | Method | Schedule | File |
|-------|--------|----------|------|
| `/api/cron/downgrade-expired` | POST | Hourly (per README) | `app/api/cron/downgrade-expired/route.ts:35-107` |
| `/api/cron/exchange-rate` | GET | Daily | `app/api/cron/exchange-rate/route.ts:16-45` |

**Host-level cron** (configured by `deploy-crialook.sh:240-254`):

| Job | Schedule | Purpose |
|-----|----------|---------|
| `/root/health-check.sh` | `*/5 * * * *` | curl `localhost:3000/api/health`; `pm2 restart crialook` if non-200 |
| `pg_dump` Supabase backup | Daily | 30-day retention (per `ops/`) |

## Database Schema Overview

**Provider:** Supabase Postgres 17, region SA-East-1. Project ID: `emybirklqhonqodzyzet` (per `baseline.sql:5`).

**Migrations location:** `campanha-ia/supabase/migrations/` (18 files; baseline at `00000000000000_baseline.sql` last regenerated 2026-04-24, then 17 incremental migrations through 2026-05-03).

**Tables:**

| Table | Purpose | RLS Policy |
|-------|---------|-----------|
| `stores` | Per-user shop record; PK `id uuid`, UNIQUE `clerk_user_id`. Holds `plan_id`, `mercadopago_{customer,subscription}_id`, credit balances (`credit_campaigns/models/regenerations`), `recent_pose_indices int[]`, `backdrop_*`, `onboarding_completed` | User can SELECT/UPDATE own row by `clerk_user_id == auth.jwt()->>'sub'`; service-role can INSERT (`baseline.sql:380-390`) |
| `campaigns` | One row per generation; FK `store_id`. Status flow `pending → generating → completed | failed | expired`. Stores `output jsonb` (v3 pipeline result), `regen_count`, `is_favorited`, `parent_campaign_id` for regeneration tree | User manages own (via store FK) `baseline.sql:332-336` |
| `campaign_outputs` | Legacy v1/v2 output blob (kept for back-compat with old campaigns) | Read-only via store ownership join |
| `campaign_scores` | LLM-as-judge scores: `nota_geral`, `conversao`, `clareza`, `urgencia`, `naturalidade`, `aprovacao_meta`, `nivel_risco`, `pontos_fortes/melhorias/alertas_meta jsonb`. UNIQUE on `campaign_id` (added `20260503_140000_add_campaign_scores_unique_campaign_id.sql`) for idempotent UPSERT (D-06) | Read via store ownership join |
| `model_bank` | Public catalog of pre-generated virtual models (image, body_type, skin_tone, hair_*, age_range, style, gender, pose). Public read where `is_active=true` | `model_bank_public_read` policy |
| `store_models` | Per-store custom models. Has `preview_url`, `preview_status`, `face_ref_url`, all hair/skin/style fields | User manages own |
| `plans` | Catalog: `gratis`, `essencial`, `pro`, `business`. Defines `campaigns_per_month`, `models_limit`, `regenerations_per_campaign`, `history_days`, `score_level`, feature flags | Public SELECT |
| `store_usage` | Monthly counter; UNIQUE `(store_id, period_start)`. Holds `campaigns_generated`, `campaigns_limit`, `regenerations_used`, `models_created` | User reads own |
| `credit_purchases` | One row per MP credit pack purchase; UNIQUE `mercadopago_payment_id` (idempotency). Tracks `quantity`, `consumed`, `period_end` | User reads own |
| `subscriptions` | Google Play subscription state per user. PK `clerk_user_id`, UNIQUE `purchase_token`. Tracks `sku`, `plan`, `expiry_time`, `state`, `acknowledged`. RLS DISABLED — server-only (`20260427_subscriptions.sql:23-57`) | service-role only |
| `push_tokens` | Expo push tokens. PK `id`, UNIQUE `(clerk_user_id, token)`. RLS DISABLED — server-only (`20260427_push_tokens.sql:15-30`) | service-role only |
| `mini_trial_uses` | 50-slot beta trial; PK `clerk_user_id` (1-per-user enforced). Has `claim_mini_trial(user_id, store_id, slots=50)` RPC with `pg_advisory_xact_lock` to prevent racing on slot 50 (`20260424_mini_trial.sql:38-75`) | service-role only |
| `checkout_locks` | TTL-based dedup for MP PreApproval creation. PK `(store_id, plan_id)` + 60s expiry. `acquire_checkout_lock` / `release_checkout_lock` RPCs (`20260424_add_checkout_locks.sql:11-67`) | service-role only |
| `plan_payments_applied` | MP payment-id idempotency for plan renewal. UNIQUE `payment_id` (`20260424_add_plan_payments_applied.sql`) | service-role only |
| `api_cost_logs` | Per-call provider cost ledger. Columns `provider`, `model_used`, `action`, `input/output_tokens`, `cost_usd/brl`, `metadata jsonb` (added `20260503_120000_add_api_cost_logs_metadata.sql` for `prompt_version` correlation) | service-role only |
| `admin_settings` | Key/value config (e.g., `usd_brl_rate`). Public read; service-role write | `Anyone can read admin settings` + service-role ALL |
| `fashion_facts` | Tip-of-the-day pool for `/gerar` UX. Public read where `is_active=true` | `fashion_facts_read` policy |
| `showcase_items` | Before/after gallery for landing/marketing. Public read | `showcase_public_read` policy |

**Views:**
- `vw_prompt_version_regen_correlation` (`20260503_141500_create_prompt_version_regen_correlation_view.sql`) — joins `api_cost_logs.metadata.prompt_version` with `campaigns.regen_count` to detect prompt-edit regressions. Regular VIEW (not materialized — swap to MATERIALIZED + add `step.run('refresh', ...)` in `qualityAlertsCron` when `api_cost_logs > 100K rows`, per `functions.ts:464-467`).

**RPCs (`SECURITY DEFINER` + `search_path=public` + GRANT to `service_role` only):**

| RPC | Purpose | File |
|-----|---------|------|
| `add_credits_atomic(store_id, column, qty)` | Increment one of 3 credit columns. Validates column whitelist + qty range 1-10000 | `20260424_harden_rpcs_and_constraints.sql:6-34` |
| `consume_credit_atomic(store_id, column)` | `SELECT ... FOR UPDATE` row-lock + decrement; returns -1 on insufficient | `20260424_harden_rpcs_and_constraints.sql:37-67` |
| `can_generate_campaign(store_id)` | Check usage vs limit + extra credit availability for current month | `baseline.sql:417-453` |
| `increment_campaign_usage(store_id)` | Upsert `store_usage` row, increment `campaigns_generated` | `baseline.sql:484-512` |
| `increment_campaigns_used(usage_id)` | Increment by usage row id (already-known) | `baseline.sql:514-528`, hardened `20260424_harden_rpcs_and_constraints.sql:70-88` |
| `decrement_campaigns_used(usage_id)` | Atomic refund slot via `GREATEST(0, n-1)` | `20260424_harden_rpcs_and_constraints.sql:91-109` |
| `increment_regen_count(campaign_id, store_id)` | Anti-IDOR: validates `store_id` matches campaign before increment | `20260424_harden_rpcs_and_constraints.sql:112-134` |
| `acquire_checkout_lock(store_id, plan_id, ttl=60s)` | UPSERT into `checkout_locks` with TTL; returns true if acquired, false if active lock exists | `20260424_add_checkout_locks.sql:34-65` |
| `release_checkout_lock(store_id, plan_id)` | DELETE lock row | `20260424_add_checkout_locks.sql:67+` |
| `claim_mini_trial(user_id, store_id, slots=50)` | `pg_advisory_xact_lock('mini_trial_claim')` + INSERT + grant 1 campaign credit. Returns jsonb status | `20260424_mini_trial.sql:38-90` |
| `delete_store_cascade(store_id)` | LGPD account deletion — wipes campaigns, models, usage, credits | `20260424_delete_store_cascade.sql:7+` |
| `set_default_plan()` | Trigger: assign `gratis` plan_id on new `stores` row | `baseline.sql:562-574` |
| `set_campaign_sequence_number()` | Trigger: per-store auto-increment `sequence_number` | `baseline.sql:546-560`, `20260421_add_campaign_title.sql:16+` |
| `update_updated_at_column()` | Trigger: bump `updated_at` on UPDATE | `baseline.sql:576-586` |
| `set_subscriptions_updated_at()` | Trigger for `subscriptions` table | `20260427_subscriptions.sql:43-49` |

**Storage buckets:**
- `product-photos` — original user uploads; path `campaigns/<storeId>/<timestamp>.<ext>` (`generate/route.ts:309`).
- `generated-images` — VTO outputs and trial teasers; path `campaigns/<campaignId>/v6_look_<n>.<ext>` and `teaser_{left,right}.webp` (`generate/route.ts:587, 712-714`).
- `assets` — model previews, backdrops; path `model-previews/<storeId>/<modelId>.<ext>` (`functions.ts:144-145`).

## Mobile ↔ Web Boundary

**Transport:**
- Base URL via `EXPO_PUBLIC_API_URL` (`api.ts:9`). All requests are JSON or `multipart/form-data` over HTTPS.
- Common headers: `X-App-Locale` (PT-BR | en) on every call; `Authorization: Bearer <Clerk JWT>` when signed in (`api.ts:49-58`).
- `Idempotency-Key: <uuid>` set on `POST /campaign/generate` (`useCampaignGenerator.ts:175-179`) — backend doesn't yet enforce it but client honors the contract so backend can opt in without breaking change.

**Auth:**
- Mobile: Clerk Expo SDK with SecureStore-backed token cache (`auth.tsx:9-19`). JWT in-memory cached 30s to amortize parallel calls (`auth.tsx:117-135`).
- Web: Clerk session cookies for HTML pages; `auth()` server helper for `/api/*` JWT extraction.
- **Crucial split**: middleware does NOT touch `/api/*` (`middleware.ts:14-20`). Each API route calls `auth()` itself and returns 401 JSON, never HTML 307. This is required because mobile cannot parse the redirect.

**Endpoints called by mobile** (canonical list):

| Endpoint | Method | Purpose | File |
|----------|--------|---------|------|
| `/campaign/generate` | POST (SSE response) | Pipeline entry | `app/api/campaign/generate/route.ts` |
| `/campaigns` | GET | Paginated history (history_days from plan) | `app/api/campaigns/route.ts:13-44` |
| `/campaigns/[id]` | GET | Single campaign + scores + v3 mapping | `app/api/campaigns/[id]/route.ts` |
| `/campaign/[id]/favorite` | POST | Toggle favorite flag | `app/api/campaign/[id]/favorite/` |
| `/campaign/[id]/regenerate` | POST | Capture regen reason (free) OR consume credit. Feature-flagged `FEATURE_REGENERATE_CAMPAIGN=1`; off → 404 (`regenerate/route.ts:33-50`) | `app/api/campaign/[id]/regenerate/route.ts` |
| `/campaign/[id]/tips` | GET | Per-campaign Sonnet tips | `app/api/campaign/[id]/tips/` |
| `/store` | GET/POST/PATCH | Store profile | `app/api/store/route.ts` |
| `/store/usage` | GET | Quota + plan + auto-downgrade if expired (`store/usage/route.ts:31-54`) | `app/api/store/usage/route.ts` |
| `/store/credits` | GET | Credit balance | `app/api/store/credits/` |
| `/store/onboarding` | POST | Complete onboarding + emit `model/preview.requested` | `app/api/store/onboarding/` |
| `/store/backdrop` | POST | Trigger Inngest backdrop job | `app/api/store/backdrop/` |
| `/store/logo` | POST | Upload + brand-color extraction | `app/api/store/logo/` |
| `/store/push-token` | POST | Upsert/clear Expo push token. `null` ⇒ delete-all on signout (`push-token/route.ts:43-50`) | `app/api/store/push-token/route.ts` |
| `/credits` | GET/POST | List packs / create MP Preference for credit purchase | `app/api/credits/route.ts` |
| `/credits/check-payment` | POST | Poll MP payment status | `app/api/credits/check-payment/` |
| `/credits/claim-mini-trial` | POST | Trigger `claim_mini_trial` RPC | `app/api/credits/claim-mini-trial/` |
| `/credits/mini-trial-status` | GET | Slot count + already-used flag | `app/api/credits/mini-trial-status/` |
| `/credits/trial-status` | GET | Legacy trial status | `app/api/credits/trial-status/` |
| `/billing/verify` | POST | Mobile sends `{sku, purchaseToken}` after Google Play purchase → server calls Developer API, acks, upserts `subscriptions`, updates `stores.plan`. 503 if Play API not configured (`billing/verify/route.ts:39-52`) | `app/api/billing/verify/route.ts` |
| `/billing/restore` | POST | Re-validate stored purchaseToken on app boot | `app/api/billing/restore/route.ts` |
| `/billing/rtdn` | POST | Google Cloud Pub/Sub Real-Time Developer Notifications. Auth via Pub/Sub bearer (`google-pubsub-auth.ts`) | `app/api/billing/rtdn/route.ts` |
| `/checkout` | POST | Web-side MP PreApproval (subscription) — primarily for web users; mobile uses `/billing/verify` instead | `app/api/checkout/route.ts` |
| `/me` | DELETE | LGPD account deletion (`delete_store_cascade` + push_tokens cleanup) | `app/api/me/route.ts` |
| `/me/export` | GET | LGPD data export | `app/api/me/export/` |
| `/health` | GET | Health probe (used by host `/5min` cron) | `app/api/health/` |

## Deployment Topology

**Hosting:** VPS KingHost · Ubuntu 24.04 · 2 vCPU · 4GB RAM. Domain `crialook.com.br` with Cloudflare DNS.

**Process supervision** (`ecosystem.config.js`):
- PM2 `fork` mode (NOT cluster — would break in-process rate limiter, see line 32-37).
- `instances: 1`, `max_memory_restart: 1500M`, `kill_timeout: 30_000` (graceful shutdown for in-flight pipelines).
- Backoff: `min_uptime: 30s`, `max_restarts: 10`, `restart_delay: 3000`.
- Logs: `/var/log/crialook/{out,error}.log`.
- Reads `CRIALOOK_HOME` env (default `/root/Agencia-Fashion`); `cwd = $CRIALOOK_HOME/campanha-ia`.

**Reverse proxy** (`nginx-crialook.conf`):
- HTTP→HTTPS 301 redirect (line 15-20).
- TLS via Let's Encrypt (`/etc/letsencrypt/live/crialook.com.br/`); managed by certbot (renewal via `certbot.timer`).
- Security headers: HSTS preload, X-Content-Type-Options, X-Frame-Options SAMEORIGIN, Referrer-Policy, Permissions-Policy, CSP-Report-Only with allowlist for Clerk, Supabase, MP, Sentry, PostHog (line 32-39).
- Compression: gzip + Brotli at level 5 (line 41-72).
- Rate limit zones: `api_limit=10r/s` (burst 20), `webhook_limit=30r/s` (burst 60) (line 7-8).
- HTML cache zone `html_cache` 100MB / 1h, used on `/` (2min TTL) and `/(sobre|termos|privacidade|subprocessadores|dpo|consentimento-biometrico)` (5min TTL); `proxy_cache_bypass` on Authorization or session cookie (line 161-196).
- **Special locations:**
  - `/api/webhooks/` — `webhook_limit`, no buffering, body 1M cap (line 113-124).
  - `/api/campaign/generate` — SSE-tuned: no buffering, no cache, 300s timeouts, body 25M cap, `chunked_transfer_encoding on`, X-Forwarded-For overwritten (anti-spoof) (line 127-144).
  - `/api/` general — 120s timeouts, body 25M cap (line 147-158).
  - `/_next/static/` and `\.(jpg|png|webp|...)$` — `Cache-Control: public, max-age=31536000, immutable` (line 74-92).
  - `/.well-known/` — JSON Content-Type forced + 1h cache for Android App Links / iOS Universal Links (line 99-110).
- **X-Forwarded-For** is OVERWRITTEN (not appended via `$proxy_add_x_forwarded_for`) on every location to prevent client-side IP spoofing (line 119-120, 133-135 etc).

**Container image** (`campanha-ia/Dockerfile`):
- Multi-stage: `node:20-alpine` `deps` → `builder` → `runner`.
- Build args for all `NEXT_PUBLIC_*` vars (line 29-38).
- Runtime: non-root user `nextjs:1001`, `EXPOSE 3000`, `HEALTHCHECK` curl `/api/health` every 30s.
- Uses Next.js standalone output (`COPY .next/standalone ./` line 56). **Note**: production deploy uses PM2 + bare `npm start` per `deploy-crialook.sh:31-32`, NOT this Dockerfile. Dockerfile exists for local Compose dev (`docker-compose.yml`).

**Deploy script** (`deploy-crialook.sh`):
- Idempotent. Run as `root` (default) or with `DEPLOY_USER=crialook` opt-in for non-root install (line 19-33).
- Steps: apt update → ufw → Node 24 LTS (NOT 20; comment at line 56-57 — Node 20 left support April/2026) → PM2 → git clone/pull → `npm ci` → wait for `.env.local` → `npm run build` → PM2 start via `ecosystem.config.js` → Nginx + certbot bootstrap (HTTP-only cert challenge then swap to canonical config with SSL) → setup `/root/health-check.sh` cron `*/5`.
- Webhook URLs printed at end (line 270-272): `https://crialook.com.br/api/webhooks/{clerk,mercadopago}` for ops to wire in dashboards.

**Mobile build** (`crialook-app/eas.json`, `app.config.ts`):
- EAS Build profiles: `development`, `preview`, `production` (3 variants with distinct bundle IDs, schemes, icons via `app.config.ts`).
- Android-only target (per `MEMORY.md:project_android_only`).
- **EAS uses npm 10**: regenerate lockfile with `npm run lock:fix`, NOT plain `npm install` (per `MEMORY.md:project_eas_npm_lock`).
- OTA via Expo Updates `production` channel; native rebuild gated by EAS Workflow fingerprint diff.

## Key Abstractions

**`PipelineInput` / `PipelineResult`** (`campanha-ia/src/lib/ai/pipeline.ts:39-109`)
- Unified contract between route handler and AI orchestrator. `dryRun: true` (D-18) skips `api_cost_logs` writes, pose-history mutation, and judge enqueue — used by `evals/run.ts` to exercise pipeline without polluting prod data.
- `photoCount` field is deprecated and ignored (single-image flow); kept for back-compat (`pipeline.ts:90-99`).

**`ModelInfo`** (`campanha-ia/src/lib/ai/identity-translations.ts`)
- Re-exported from `pipeline.ts:36-37`. Encodes skin/hair (color hex)/age/gender/body for identity-lock injection into the VTO prompt — anti-hallucination for hair color and ethnicity drift.

**Pose history** (`stores.recent_pose_indices int[]`)
- Cap of 3 (`POSE_HISTORY_CAP`). Streak detection `getStreakBlockedPose` returns blocked index if last 3 entries are identical, forcing the Analyzer to choose another pose from the 8-pose bank (`pipeline.ts:131-151`).

**Prompt versioning**
- SHA12 fingerprints of each system prompt: `ANALYZER_PROMPT_VERSION`, `VTO_PROMPT_VERSION`, `SONNET_PROMPT_VERSION_PT/EN`, `JUDGE_PROMPT_VERSION`. Written into `api_cost_logs.metadata.prompt_version` so quality regressions can be correlated to prompt edits via `vw_prompt_version_regen_correlation`.

**`createAdminClient()`** (`campanha-ia/src/lib/supabase/admin.ts:5-16`)
- Lazy service-role Supabase client. Used by all server-side mutations and any read needing to bypass RLS. **Never** imported into client components — search `'@/lib/supabase/admin'` should only match files under `src/lib/`, `src/app/api/`, server-only modules.

**`api()` wrapper** (`crialook-app/lib/api.ts:115`)
- Single mobile HTTP client with: timeout (60s default), GET retries (max 2 with 600ms base backoff on 408/429/5xx), in-flight GET dedup keyed by URL (`api.ts:113`), MMKV TTL cache, optional Zod schema validation, AbortSignal composition (caller + timeout).

## Entry Points

**Mobile app launch** (`crialook-app/app/_layout.tsx`)
- Module-scope: `initSentry()`, `initLocale()`, `pruneApiCache()`, `wireQueryClientLifecycle()`, `setupQueryPersistence()`, `WebBrowser.maybeCompleteAuthSession()`, `SplashScreen.preventAutoHideAsync()` (line 42-62).
- 12s `SplashScreen.hideAsync` safety-net (line 70-73) so a stuck React tree doesn't trap the user on splash.
- Provider tree: `SafeAreaProvider` → `AuthProvider` → `QueryClientProvider` → `ThemeProvider` → `BottomSheetModalProvider` → `<AuthGate>` → `<Slot/>`.

**Web app entry** (`campanha-ia/src/app/layout.tsx`)
- `<ClerkProvider>` + Tailwind globals + Sentry instrumentation (`src/instrumentation.ts`).

**Pipeline entry** (`campanha-ia/src/app/api/campaign/generate/route.ts:50`)
- The single hot path. `maxDuration = 300` (line 18) — Vercel/Nginx must allow up to 5min.

**Inngest entry** (`campanha-ia/src/app/api/inngest/route.ts:9`)
- `serve({client: inngest, functions: inngestFunctions})` — same handler exports `GET`, `POST`, `PUT`. Inngest dashboard polls/pushes here.

## Architectural Constraints

- **Threading:** Single Node event loop per PM2 process. PM2 forced to `instances: 1` (`ecosystem.config.js:38-39`) because `lib/rate-limit.ts` is an in-process Map — going cluster-mode would split the limit across processes (~50% leak per instance). Migration path: Postgres or Redis-backed limiter.
- **Global state (server):** `lib/ai/clients.ts` lazy singletons for Anthropic + Google clients (`clients.ts:32-51`); `lib/payments/mercadopago.ts` lazy MP client (`mercadopago.ts:9-21`). Both gracefully degrade when env keys missing.
- **Global state (mobile):** `jwtCache` 30s TTL (`auth.tsx:117`), MMKV singleton via `lib/cache.ts`, TanStack QueryClient via `getQueryClient()` (`query-client.ts`).
- **Auth pinning:** Clerk Client Trust currently OFF for Play Store review (per `MEMORY.md:project_clerk_client_trust`). 6s splash-fallback in `auth.tsx:43` exists for this. Re-enable after approval, consider lowering to 3s.
- **EAS lockfile:** `crialook-app/package-lock.json` MUST be npm-10-compatible. Use `npm run lock:fix`, never raw `npm install` (per `MEMORY.md:project_eas_npm_lock`).
- **Android-only mobile:** No iOS code paths should be added (per `MEMORY.md:project_android_only`).
- **Phase 2.5 (Labeling) deferred indefinitely:** Judge captures uncalibrated; do not propose implementation without authorization. Promptfoo is informational-only and never blocks PRs (per `MEMORY.md:project_phase_25_deferred`).
- **CSP currently Report-Only:** `nginx-crialook.conf:39` — graduate to enforced once telemetry is clean.
- **`/api/*` middleware exemption:** Adding new protected routes requires per-route `auth()` call. Do NOT add `/api/...` patterns to `isProtectedRoute` matcher in `middleware.ts:21-29` (would break mobile JSON callers with HTML 307).
- **Editor must not use Clerk:** It's standalone Konva tool with `editor-session.ts` HMAC cookie. `middleware.ts:9-12` short-circuits all `/editor*` and `/api/editor-auth*` paths.
- **SSE 300s ceiling:** Pipeline must finish in 5min — both `route.ts:18` (`maxDuration=300`) and Nginx `proxy_read_timeout 300s` (line 140) cap it. Real p95 ~50-60s.
- **Webhook idempotency is ROW-based:** Adding new MP event handlers must include either a UNIQUE-constraint dedup table (like `plan_payments_applied`) or check existing rows before mutating.

## Anti-Patterns

### Cluster-mode PM2 (would silently break rate limiter)

**What happens:** Bumping `ecosystem.config.js:38-39` to `exec_mode:'cluster', instances:N` doubles request capacity but `lib/rate-limit.ts` is an in-process `Map`.
**Why it's wrong:** Limits leak ~`100/N`% per instance, opening abuse window on the expensive AI pipeline.
**Do this instead:** Migrate `rate-limit.ts` to Postgres-backed token bucket (or Upstash) BEFORE going cluster. The `instances:1` line has an explicit comment forbidding this (line 32-37).

### Adding `/api/...` to middleware protected matcher

**What happens:** Mobile `fetch('/api/foo')` returns HTML 307 → `/sign-in` because `auth.protect()` redirects.
**Why it's wrong:** Mobile JSON callers can't parse HTML; the entire flow post-login dies silently.
**Do this instead:** Each new `/api/*` route does `const { userId } = await auth(); if (!userId) return NextResponse.json({error:'Não autenticado'}, {status:401})`. Pattern at `generate/route.ts:52-53`, `checkout/route.ts:23-26`, `store/usage/route.ts:14-17`.

### Importing `createAdminClient` into client components

**What happens:** `'use client'` file imports `@/lib/supabase/admin` → service-role key bundled into JS sent to browser.
**Why it's wrong:** Catastrophic — full DB write access leaked.
**Do this instead:** Server Components / route handlers / Inngest functions only. Use `@/lib/supabase/server.ts` (cookie-bound RLS client) or `@/lib/supabase/client.ts` (anon RLS) for browser.

### Polling without backoff

**What happens:** Tight `setInterval(100ms)` polling `/campaigns/[id]` until completed.
**Why it's wrong:** Battery drain on mobile, unnecessary load on the API.
**Do this instead:** `useCampaignPolling` uses 5s interval + 3min wall-clock timeout + AppState pause/resume (`useCampaignPolling.ts:31-78`).

### Reading X-Forwarded-For via `$proxy_add_x_forwarded_for`

**What happens:** Nginx appends to client-supplied header, so `request.headers.get('x-forwarded-for').split(',')[0]` returns spoofed IP.
**Why it's wrong:** Per-IP rate-limit (`generate/route.ts:57-59`) becomes trivially bypassable.
**Do this instead:** OVERWRITE on every Nginx location: `proxy_set_header X-Forwarded-For $remote_addr;` (already done at `nginx-crialook.conf:119-120, 133-135, 153, 167-168, 186, 197, 205`).

### Skipping fraud-gate on new MP webhook event types

**What happens:** Adding a new `external_reference` parser path that trusts `payment.transactionAmount` without re-checking against catalog.
**Why it's wrong:** Attacker forges `external_reference="credit|<their-store>|campaigns|9999"` and pays R$1 → 9999 credits.
**Do this instead:** Always `find` the matching package/plan in `PLANS`/`ALL_CREDIT_PACKAGES` and `amountMatches(paid, expected)` with R$0.01 tolerance (`webhooks/mercadopago/route.ts:127-143, 192-206`).

## Error Handling

**Strategy:** Typed error codes propagated end-to-end so mobile can render localized messages.

**Codes** (subset — defined inline at route handlers + `crialook-app/lib/api.ts:21-37`):
- `RATE_LIMITED` (429), `QUOTA_EXCEEDED` (429 with `used/limit/credits/upgradeHint`), `INVALID_PRICE` (400), `INVALID_IMAGE_TYPE` (400), `IMAGE_TOO_LARGE` (400), `IMAGE_TOO_LARGE_POST_OPTIM` (400), `MISSING_IMAGE` (400), `API_KEY_MISSING` (500), `PIPELINE_ERROR` (500), `MODEL_OVERLOADED`, `SAFETY_BLOCKED`, `IMAGE_GENERATION_BLOCKED`, `ALL_IMAGES_FAILED`, `ALL_UPLOADS_FAILED`, `BAD_REQUEST`, `TIMEOUT`, `FEATURE_DISABLED`, `INVALID_PLAN`, `NO_STORE`, `MISSING_AI_KEY`.

**Pipeline error path** (`generate/route.ts:787-846`)
- Categorize via `error.code`, `error.retryable`, `error.technicalMessage`.
- Refund credit/slot if `retryable || SAFETY_BLOCKED || IMAGE_GENERATION_BLOCKED`.
- Insert `pipeline_error` row in `api_cost_logs` with `metadata.{error_code, message:slice(500), retryable}`.
- Send `error` SSE event with `{error, code, retryable}`.
- `finally { writer.close() }` always.

**Webhook error path** (`webhooks/mercadopago/route.ts:88-93`)
- Always returns 200 OK to prevent infinite MP retries.
- Real bugs go to Sentry via `captureError()` from `lib/observability`.
- Per-event errors (e.g., MP API down) are re-thrown inside `handlePaymentEvent` to bubble to outer 200 response (line 102-107).

**Mobile error path** (`crialook-app/lib/api.ts:21-152`)
- Wraps all errors in `ApiError` (`@/types`) with `code: ApiErrorCode`.
- `payloadCode` (from `data.code`) takes precedence over HTTP status mapping.
- `errorMessageFor(code)` in `useCampaignGenerator.ts:30-40` resolves to localized strings via `t('errors.*')`.
- `<AppErrorBoundary>` at root catches uncaught throws and reports to Sentry.

## Cross-Cutting Concerns

**Logging:**
- Web: `lib/observability.ts` exports `logger.{info,warn,error}` + `captureError`. Logs are PII-safe (e.g., MP webhook line 58-63 logs only `type/action/dataId/liveMode`, never body).
- Mobile: `lib/logger.ts` console + Sentry breadcrumb.
- Server console output captured by PM2 → `/var/log/crialook/{out,error}.log`.

**Validation:**
- Web: hand-rolled `safeStr` + whitelists in route handlers (e.g., `generate/route.ts:81-88, 124-146`).
- Mobile: Zod schemas in `crialook-app/lib/schemas.ts`; `api()` wrapper accepts optional `schema: ZodType<T>` (`api.ts:96-100`) and validates JSON before returning.

**Authentication:**
- All `/api/*` routes call `auth()` from `@clerk/nextjs/server` and 401 JSON on missing `userId`.
- Webhooks self-validate signatures (Svix HMAC for Clerk, custom HMAC for MP, Pub/Sub bearer for Google RTDN).
- Cron routes: `Bearer ${CRON_SECRET}` with `timingSafeEqual` (`downgrade-expired/route.ts:20-33`, `exchange-rate/route.ts:23-26`).

**Observability:**
- Sentry: `sentry.{client,edge,server}.config.ts` at `campanha-ia/`; `crialook-app/lib/sentry.ts` (Session Replay disabled in 3 layers — see `_layout.tsx:25-32`).
- PostHog: `src/lib/analytics/posthog.tsx` web only; LGPD consent gate via banner.
- UptimeRobot: external uptime checks against `/api/health`.
- Synthetic alerts: `qualityAlertsCron` writes Sentry events with PII-safe fingerprints `face_wrong_<weekISO>` and `nivel_risco_alto_<dateISO>` (`functions.ts:481-525`).

**Rate limiting:**
- `lib/rate-limit.ts` — in-process Map. Per-IP for `/campaign/generate`. Per-user (`checkLoginRateLimit`) for `/checkout`, `/credits`. Cluster-incompatible (see Constraints).
- Nginx zones: `api_limit` 10r/s burst 20, `webhook_limit` 30r/s burst 60.

**LGPD:**
- Pages: `/privacidade`, `/termos`, `/dpo`, `/subprocessadores`, `/consentimento-biometrico`, `/excluir-conta`.
- Endpoints: `DELETE /api/me` → `delete_store_cascade` RPC + push_tokens cleanup; `GET /api/me/export` data export.
- PII redaction in Sentry (`sentry.*.config.ts`).
- Cookie consent banner with PostHog gate.

---

*Architecture analysis: 2026-05-03*
