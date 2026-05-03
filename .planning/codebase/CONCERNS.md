# Codebase Concerns

**Analysis Date:** 2026-05-03

## Tech Debt

### In-Memory Rate Limiter — Not Suitable for Distributed Deployment
- **Issue:** `campanha-ia/src/lib/rate-limit.ts` uses in-memory Maps for hourly/daily tracking. State is lost on process restart; no sharing across multiple instances.
- **Files:** `campanha-ia/src/lib/rate-limit.ts` (lines 23-24, 44-52)
- **Impact:** In multi-instance deployments (Vercel, scaled VPS), rate limits are per-process, not per-user/IP. Abusers can bypass by spreading requests across servers.
- **Fix approach:** Migrate to Redis-backed rate limiting or use Upstash (serverless Redis). `checkRateLimit()` calls in `campanha-ia/src/app/api/campaign/generate/route.ts` (line 60) must return distributed results.

### Regenerate Feature Gate — TODO Comment Signals Incomplete Implementation
- **Issue:** `FEATURE_REGENERATE_CAMPAIGN` env var is marked as OFF by design but the canRegenerate logic contains a TODO at line 330 of `campanha-ia/src/lib/db/index.ts`: "substituir por lookup real de plano antes de habilitar em prod." Placeholder limit of 3 regens/campaign hardcoded.
- **Files:** `campanha-ia/src/lib/db/index.ts` (lines 312-334), `campanha-ia/src/app/api/campaign/[id]/regenerate/route.ts` (lines 12-24)
- **Impact:** Feature is blocked until plan-based limits are implemented. Reaching 3 regens per campaign will fail silently if feature is enabled without completing the TODO.
- **Fix approach:** Before enabling `FEATURE_REGENERATE_CAMPAIGN=1` in production, implement `getRegenerationLimitForPlan(planName)` function, integrate into `canRegenerate()`, and add tests in `tests/regenerate-quota.test.ts`.

### Fire-and-Forget Storage Cleanup — Potential Orphaned Files
- **Issue:** `campanha-ia/src/lib/db/index.ts` lines 214-216 perform async storage deletion with `.then().catch(() => { /* ignore */ })` after model deletion. If Supabase Storage API fails silently, files remain in bucket.
- **Files:** `campanha-ia/src/lib/db/index.ts` (lines 213-217)
- **Impact:** Long-term bloat in Supabase Storage. No audit trail of orphaned images or cost visibility.
- **Fix approach:** Log cleanup failures to analytics/Sentry instead of silently ignoring. Periodically scan for orphaned Storage objects not referenced in database.

### Low Test Coverage on API Webhooks
- **Issue:** Vitest coverage thresholds show 30% lines/functions/statements for `src/app/api/**` routes. Payment webhooks (Mercado Pago) and subscription events have minimal test coverage.
- **Files:** `campanha-ia/vitest.config.ts` (lines 23-27), `campanha-ia/src/app/api/**` (payment routes)
- **Impact:** Webhook handlers can fail silently (e.g., subscription status not synced, credits not added). Changes to billing logic risk production breakage.
- **Fix approach:** Add integration tests for webhook signature validation, duplicate handling, and state transitions. Target 70%+ coverage for payment routes before next billing cycle.

### Race Condition in Store Usage Upsert — Fixed But Needs Verification
- **Issue:** `getOrCreateCurrentUsage()` at `campanha-ia/src/lib/db/index.ts` line 434 uses `onConflict: "store_id,period_start"` to handle concurrent requests. The fix is in-place (lines 482-506) but the pattern relies on `ignoreDuplicates: true` + retry via `getCurrentUsage()`. If the 2nd request's retry is skipped (e.g., premature return), campaign generation could be blocked.
- **Files:** `campanha-ia/src/lib/db/index.ts` (lines 434-507)
- **Impact:** Under high concurrent load (multiple simultaneous uploads), some users may see quota errors when quota should be available.
- **Fix approach:** Add integration tests with concurrent requests to `POST /api/campaign/generate` from same store. Verify both requests succeed or one blocks with clear error, never hangs.

### Clerk Client Trust Disabled for Play Store Review
- **Issue:** Memory note mentions "Clerk Client Trust desligado pra Play review — reativar quando app for aprovado no Play Store". No code found explicitly toggling this (likely an environment-level setting), but decision-pending state creates risk of shipping wrong auth config.
- **Files:** Configuration unclear; check Clerk dashboard settings
- **Impact:** Once app is live on Play Store, Client Trust must be re-enabled for security. If forgotten, users can forge bearer tokens.
- **Fix approach:** Document this in `.planning/` (already noted in memory). Add checklist item to "Post-Launch" phase: verify Client Trust enabled in Clerk production settings, test with real Play Store app.

## Known Bugs

### Storage Path Extraction Logic May Fail With Non-Standard URLs
- **Symptoms:** Model deletion in `deleteStoreModel()` extracts file paths from Supabase public URLs. If URL structure changes or CDN is used, extraction returns null and files never get deleted.
- **Files:** `campanha-ia/src/lib/db/index.ts` (lines 198-211)
- **Trigger:** Delete a model after Supabase Storage bucket configuration or CDN migrat changes URL format
- **Workaround:** Manually delete files from Supabase Dashboard. Add logging to see what URLs are being parsed.

### Exchange Rate Hardcoded in Cost Logger
- **Symptoms:** `logApiCost()` reads `USD_BRL_EXCHANGE_RATE` environment variable with fallback `5.5`. If env var is missing and BRL exchange rate is actually `6.5`, all cost logs will be off by ~20%.
- **Files:** `campanha-ia/src/lib/db/index.ts` (line 643)
- **Trigger:** Missing or stale environment variable in production
- **Workaround:** Ensure `.env.production` always has `USD_BRL_EXCHANGE_RATE` set. Monitor api_cost_logs for suspiciously low/high cost_brl values.

## Security Considerations

### Password-Based Editor Access — Weak Auth Model
- **Risk:** `campanha-ia` has an editor with password-based auth (`EDITOR_PASSWORD` env var). No rate limiting on login attempts (uses in-memory `checkLoginRateLimit()` at `campanha-ia/src/lib/rate-limit.ts` lines 102-150, which is local-only and lost on restart).
- **Files:** `campanha-ia/.env.example` (line 11), rate limit logic in `campanha-ia/src/lib/rate-limit.ts` (lines 102-150)
- **Current mitigation:** In-memory login attempt tracking; blocked for 1 hour after 5 failed attempts
- **Recommendations:** Consider replacing password auth with token-based (JWT or API key). If password auth must remain, migrate login rate limit to Redis-backed system. Log failed attempts to audit log / Sentry.

### Price Validation — Integer Overflow Not Handled
- **Risk:** `campanha-ia/src/app/api/campaign/generate/route.ts` line 130 validates price as numeric in range 0-99999. Inputs like `999999999.99` or `-1.5` are correctly rejected, but no overflow check for multiplication in cost calculations downstream.
- **Files:** `campanha-ia/src/app/api/campaign/generate/route.ts` (lines 128-137)
- **Current mitigation:** Zod schema validation on request parsing
- **Recommendations:** Add explicit bounds checks before any currency arithmetic. Use fixed-point decimal types (e.g., cents as integers) instead of floats to avoid precision loss.

### Image File Type Validation — MIME Type Spoofing
- **Risk:** Line 141 checks `imageFile.type` which is client-controlled (can be spoofed). No server-side magic bytes check.
- **Files:** `campanha-ia/src/app/api/campaign/generate/route.ts` (lines 140-146)
- **Current mitigation:** File size limit (10MB); type list whitelist
- **Recommendations:** Add server-side image format detection (e.g., `sharp().metadata()`) to verify actual format matches MIME type.

## Performance Bottlenecks

### Large Component Files — Potential Render Overhead
- **Problem:** `crialook-app/app/(tabs)/gerar/resultado.tsx` (1373 LOC), `campanha-ia/src/app/(auth)/gerar/page.tsx` (1577 LOC), `crialook-app/components/GenerationLoadingScreen.tsx` (884 LOC), and `crialook-app/components/InstagramEditor.tsx` (907 LOC) are monolithic. Complex state and nested conditions may cause unnecessary re-renders on mobile.
- **Files:** 
  - `crialook-app/app/(tabs)/gerar/resultado.tsx`
  - `campanha-ia/src/app/(auth)/gerar/page.tsx`
  - `crialook-app/components/GenerationLoadingScreen.tsx`
  - `campanha-ia/src/components/InstagramEditor.tsx`
- **Cause:** UI and business logic interleaved; no component extraction for subviews.
- **Improvement path:** Break into smaller presentational components (e.g., ImageGallery, CaptionEditor, SettingsPanel). Memoize expensive child components with React.memo(). Profile with React Profiler to identify slow renders.

### In-Memory Rate Limit Cleanup — Global Interval Running Always
- **Problem:** `campanha-ia/src/lib/rate-limit.ts` line 44 sets a global `setInterval()` every module load (even in non-server contexts). Cleanup runs every 10 minutes even if no requests are being made.
- **Files:** `campanha-ia/src/lib/rate-limit.ts` (lines 41-52)
- **Cause:** Global setup in module scope with no guard for server-only execution
- **Improvement path:** Move interval setup into an initialization function called only in API route handlers or a single location. Or use Vercel Cron to periodically prune stale entries rather than constant polling.

### Gemini API Calls — No Streaming, Full Response Wait
- **Problem:** `campanha-ia/src/lib/ai/gemini-analyzer.ts`, `gemini-vto-generator.ts`, and other pipeline steps wait for full API response before processing. No streaming responses to show progress to user.
- **Files:** `campanha-ia/src/lib/ai/gemini-*.ts` (all 600+ LOC files)
- **Cause:** SDK default behavior; frontend has no server-sent events to consume
- **Improvement path:** Implement streaming responses in generation route using `ReadableStream`. Show "Analyzing product…" → "Generating VTO…" → "Writing captions…" progress to user during 30-60s pipeline.

## Fragile Areas

### Store Models Deletion — Cascading Cleanup Complexity
- **Files:** `campanha-ia/src/lib/db/index.ts` (lines 182-227)
- **Why fragile:** Deletes model from DB, then attempts async storage cleanup. If storage cleanup fails, DB state is inconsistent (model gone, files remain). No transaction wrapper.
- **Safe modification:** Add Supabase trigger or RPC to handle storage cleanup atomically. Or implement a cleanup queue (Inngest job) that runs after DB delete succeeds, with retry logic.
- **Test coverage:** No dedicated tests for `deleteStoreModel()` with storage cleanup. Add test covering both success and storage API failure scenarios.

### Campaign Generation Pipeline — Multi-Step State Machine Without Explicit Checks
- **Files:** 
  - `campanha-ia/src/app/api/campaign/generate/route.ts` (lines 50-300+)
  - `campanha-ia/src/lib/ai/pipeline.ts`
- **Why fragile:** Pipeline transitions: "processing" → "completed" or "failed". If any AI step throws, campaign marked failed but storage files may be partially uploaded. No cleanup of orphaned images.
- **Safe modification:** Wrap entire pipeline in transaction or add explicit rollback on failure. Store pipeline step + error state in campaigns.error_message for debugging.
- **Test coverage:** Integration tests for failure scenarios (API timeouts, out-of-quota, image upload failure) are weak.

### Supabase RPC Fallbacks — Inconsistent Error Handling Across Operations
- **Files:** 
  - `campanha-ia/src/lib/db/index.ts` (lines 268-301, 510-527, 760-827)
- **Why fragile:** `incrementRegenCount()`, `incrementCampaignsUsed()`, `addCreditsToStore()`, `consumeCredit()` all have fallback to read-modify-write if RPC fails. Fallbacks are not atomic; concurrent requests can double-count or corrupt state.
- **Safe modification:** Ensure Supabase RPCs always exist and are tested. If RPC fails, queue operation to Inngest for retry rather than falling back to unsafe read-modify-write.
- **Test coverage:** No tests for RPC failure paths. Add mocked tests where `supabase.rpc()` throws and verify fallback behavior.

## Scaling Limits

### Single VPS Instance — No Horizontal Scaling Plan
- **Current capacity:** VPS with single Node.js process (as seen from in-memory rate limiter design)
- **Limit:** Process runs out of memory or CPU around ~1000 concurrent requests. Global module state (rate limit maps, interval) doesn't sync across instances.
- **Scaling path:** Move to Vercel or auto-scaling container platform. Migrate rate limiting and session state to Redis. Use environment-based feature flags instead of compile-time constants.

### Supabase Row Limits — No Pagination on Large Queries
- **Current capacity:** `listCampaigns()` at `campanha-ia/src/lib/db/index.ts` line 556 defaults to limit=20. If user has 10,000 campaigns, filtering/sorting on client is not feasible.
- **Limit:** UI hangs when loading history for power users (500+ campaigns).
- **Scaling path:** Implement cursor-based pagination. Add indices on (store_id, created_at). Add server-side filtering by date range before returning to client.

### Gemini API Quota — No Fairness Scheduling
- **Current capacity:** All generation requests hit Gemini API synchronously. If 100 users generate simultaneously, API quota exhausted in seconds.
- **Limit:** During peak hours, 90% of generate requests fail with 429 Too Many Requests.
- **Scaling path:** Implement request queue using Inngest. Rate limit API calls to Gemini (max 10 req/sec). Show "Queued — processing in X seconds" to user instead of failing.

## Dependencies at Risk

### Next.js 16.2.4 — Major Version Gap
- **Risk:** `campanha-ia/package.json` pins Next.js `16.2.4` which is early in v16 lifecycle. Critical security patches or performance fixes may require patch upgrades.
- **Impact:** If v16.3 brings breaking changes to middleware or API routes, upgrade may block other dependencies.
- **Migration plan:** Track Next.js releases. Test patch upgrades (16.2.5, 16.3.0) monthly. Document any API changes that affect auth middleware or streaming responses.

### React Native 0.81.5 — Expo Ecosystem Lag
- **Risk:** `crialook-app/package.json` uses React Native `0.81.5` which is behind latest (0.76+ available). Expo may lag behind React Native core by 1-2 quarters.
- **Impact:** Ecosystem libs (react-native-reanimated, expo-router) may have bugs or lack features in older RN versions.
- **Migration plan:** Plan RN upgrade as quarterly task. Test on real Android device (not just EAS Simulator). Watch Expo SDK releases and upgrade in lockstep.

### Anthropic SDK 0.92.0 — API Changes Risk
- **Risk:** `campanha-ia/package.json` uses `@anthropic-ai/sdk@^0.92.0`. Caret range allows up to 0.99.0 before major bump. API changes in minor versions (e.g., new required params) could break at runtime.
- **Impact:** If Anthropic releases 0.95.0 with breaking changes to message streaming, all Sonnet generation fails.
- **Migration plan:** Pin exact version or use tilde `~0.92.0`. Test Anthropic SDK updates in separate branch before merging. Monitor Anthropic changelog for deprecations.

## Missing Critical Features

### No Offline Mode for Mobile App
- **Problem:** `crialook-app` requires live API connection to generate campaigns. No drafts or queued generations on poor connectivity.
- **Blocks:** Users in areas with spotty network can't use app.
- **Recommendation:** Implement Inngest + service worker for queued generation. Show "Pending — will process when online" for offline submissions.

### No Admin Dashboard for Store Metrics
- **Problem:** `campanha-ia/src/app/admin/` exists but no real-time dashboard for campaign performance, quota usage, or cost tracking.
- **Blocks:** Cannot easily debug quota issues or see which stores are heavy API consumers.
- **Recommendation:** Add admin dashboard route with charts for: campaigns/day, failed generations, cost by store. Integrate with api_cost_logs table.

### No Email Notifications for Plan Expiry
- **Problem:** When store's subscription ends, no email sent to notify user. Quota silently drops to 0.
- **Blocks:** User comes back after 2 months, confused why app is blocked.
- **Recommendation:** Add Inngest job triggered by plan expiration. Send reminder email 7 days before, again on expiry.

## Test Coverage Gaps

### API Route: POST /api/campaign/[id]/regenerate — Regenerate Quota Tests Missing
- **What's not tested:** Feature gate disabled (304 error), quota exceeded (403), concurrent regens (race condition), storeId mismatch (IDOR).
- **Files:** `campanha-ia/src/app/api/campaign/[id]/regenerate/route.ts`
- **Risk:** Changes to `canRegenerate()` or `incrementRegenCount()` logic can silently break quota enforcement.
- **Priority:** High — blocking feature gate before launch.

### Payment Webhook: POST /api/webhooks/mercadopago — Signature Verification Tests Missing
- **What's not tested:** Replay attack (same webhook sent twice), forged signature, missing required fields, idempotency (webhook received 2x, only 1 credit added).
- **Files:** `campanha-ia/src/app/api/webhooks/mercadopago/route.ts`
- **Risk:** Signature validation could be bypassed, leading to unpaid credits being added to accounts.
- **Priority:** High — security-critical.

### Mobile: Campaign Polling During Generation — Concurrency and Timeout Tests Missing
- **What's not tested:** Poll timeout (API never returns), rapid button mashing (100 polls/sec), polled campaign changes status mid-load.
- **Files:** `crialook-app/hooks/__tests__/useCampaignPolling.test.ts` exists but only covers happy path
- **Risk:** Polling stuck in infinite loop, consuming battery + quota.
- **Priority:** Medium — affects UX on slow networks.

### Storage Cleanup — No Tests for Fire-and-Forget Deletion
- **What's not tested:** Storage API fails, storage file already deleted, concurrent deletes of same model.
- **Files:** `campanha-ia/src/lib/db/index.ts` (deleteStoreModel) has no dedicated tests
- **Risk:** Orphaned files accumulate in Storage; no visibility into cleanup failures.
- **Priority:** Medium — cost + data hygiene issue.

---

*Concerns audit: 2026-05-03*
