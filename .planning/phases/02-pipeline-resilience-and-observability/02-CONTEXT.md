# Phase 2: Pipeline Resilience & Observability - Context

**Gathered:** 2026-05-03
**Status:** Ready for planning (after Phase 1 execute completes)

<domain>
## Phase Boundary

Make `/api/campaign/generate` (the headline product flow, 898 LOC, 0 captureError today) survive partial AI failures, abort on client disconnect, account costs honestly, and emit structured telemetry — so the next regression is visible in Sentry instead of PM2 stdout.

In scope (from PHASE-DETAILS Phase 2):
- Replace `Promise.all([copy, image])` with `Promise.allSettled` and explicit success/fallback contracts; harden `dicas_postagem` shape on Sonnet failure
- Honor `request.signal` end-to-end inside the SSE IIFE (skip remaining steps, abort upload retries, abort teaser branch); document Gemini SDK has no native cancel
- Default trial-eligibility to `isTrialOnly = true` on detection-query failure (fail-secure)
- Mark `api_cost_logs` with `upload_failed` flag when refund branch fires; reconcile per-campaign cost metric
- Skip teaser when `modelImageBase64` is the 1×1 fallback
- Add `judge_pending` flag on campaign rows + reconcile cron that re-emits Inngest events
- Force `storeId` filter on `incrementRegenCount` SELECT (close IDOR even though feature flag is off)
- Demo mode must NOT increment `campaigns_generated`
- Centralize `dryRun` gating via a `sideEffect(input, fn)` helper across pipeline + gemini-vto-generator
- Convert refund race in `app/api/campaign/generate/route.ts:805-812` to use `add_credits_atomic`
- Replace 42 raw `console.*` in the generate route with `logger.*` + `captureError` at every catch
- Add HTTP-level tests for `webhooks/mercadopago`, `billing/verify`, `billing/rtdn` route handlers

Out of scope:
- Anything that re-opens Phase 2.5 (Labeling) — judge stays uncalibrated; we only persist the signal
- Promptfoo blocking (stays observability-only per project memory)
- Re-architecting SSE protocol

</domain>

<decisions>
## Implementation Decisions

### Partial-failure contracts (UX)
- **D-01:** VTO partial fail (some of 3 succeed, Sonnet OK) → deliver successful photos + copy + UX flag `partial_delivery`. UI shows badge "Algumas variações não ficaram prontas". Charge proportional credits (1 photo = 1 credit, NOT 3). Sentry event tagged `partial_failure=true` with `photos_delivered=N`.
- **D-02:** Sonnet fail (VTO OK) → deliver photos + minimal fallback copy ("Sua campanha está pronta!" + generic hashtags). Sentry warn-level event. Charge full credit (photos are the headline value).
- **D-03:** All VTO fail → hard error, full refund via `add_credits_atomic`, user-facing error message, Sentry error-level event.
- **D-04:** Trial-detection fail (Supabase blip) → default `isTrialOnly = true` (fail-secure: free user gets 1 photo, not 3). Sentry warn-level event.
- **D-05:** No automatic retry of failed steps. Failure is delivered once, user can re-run if they want more (re-running is full price).
- **D-06:** No background completion of partial deliveries. What's delivered is final.

### Abort semantics on client disconnect
- **D-07:** Aggressive cancel. `request.signal` propagates end-to-end into every Gemini/Sonnet call site, every Supabase write, every upload retry, the teaser branch.
- **D-08:** Gemini SDK has no native cancel — implement as: pass `AbortSignal` to fetch, but if Gemini call is already in-flight, we stop awaiting and ignore the resolved promise. Document that Gemini billing for in-flight calls is sunk cost.
- **D-09:** Cost accounting on disconnect: write to `api_cost_logs` with new flag `client_disconnected=true`. No refund (cost was real). Per-campaign cost metric reconciles.
- **D-10:** Zero work after disconnect: no upload, no teaser, no DB writes for delivery, no Inngest dispatch. Only the "log this disconnect" path runs.

### Telemetry strategy (Sentry + logger)
- **D-11:** Structured tags on every captureError in `/generate`: `route=campaign.generate`, `step=vto|sonnet|trial_check|finalize|teaser|upload|refund`, `model=gemini-3.1-pro|sonnet-4.6|gemini-vto`, `store_id=<sha256:8>`. Hash store_id (8 chars sha256 prefix) — never raw UUID.
- **D-12:** Logger levels: `info` for happy path step transitions, `warn` for fallback/partial paths, `error` for unrecoverable failures. Logger replaces all 42 `console.*` calls.
- **D-13:** No PII in payload field. Only IDs/hashes. If image data must be referenced, use Supabase storage path (no base64). User text inputs (loja name, etc.) get truncated to 50 chars + suffix.
- **D-14:** Custom Sentry events: `campaign.generated.success`, `campaign.generated.partial`, `campaign.generated.failed`, `campaign.client_disconnected`, `judge.pending.created`, `judge.pending.resolved`. Used for dashboards/alerts.

### `judge_pending` + reconcile cron design
- **D-15:** Flag lives as a column on `campaigns` table: `judge_pending BOOLEAN DEFAULT false`, `judge_retry_count INT DEFAULT 0`, `judge_last_attempt TIMESTAMPTZ NULL`. No separate queue table — campaigns is the source of truth.
- **D-16:** Reconcile cron schedule: every 5 minutes. Query: `WHERE judge_pending=true AND judge_retry_count<3 AND (judge_last_attempt IS NULL OR judge_last_attempt < now()-interval '5 minutes')`.
- **D-17:** On reconcile: re-emit Inngest event for the orphaned campaign, increment `judge_retry_count`, set `judge_last_attempt=now()`. Inngest function clears `judge_pending=false` on success.
- **D-18:** Dead letter: after 3 failed retries, INSERT row into new `judge_dead_letter` table (id, campaign_id, last_error, moved_at) and set `judge_pending=false` on the campaign (so cron stops touching it). Manual ops review.
- **D-19:** Sentry alert on dead-letter insertion: `judge.dead_letter` event tagged with `reason`. Pages no one initially — observability only — but ready to wire to alert if rate spikes.

### Claude's Discretion (planner / executor decides)
- Exact placement of `Promise.allSettled` refactor in route.ts (line ranges flexible; preserve SSE shape)
- Whether `sideEffect(input, fn)` helper lives in `lib/utils/` or co-located with pipeline code
- Test fixture format for HTTP-level webhook tests (raw Request bodies vs builder helpers)
- Logger module choice if not already standardized (likely use existing `lib/logger.ts` or equivalent — researcher confirms)
- `incrementRegenCount` IDOR fix shape (add `storeId` to WHERE clause vs RPC)

### Flagged for plan-phase research
- **R-01:** Confirm location of `lib/logger.ts` (or equivalent) and its API surface — D-12 assumes it exists. If absent, create as part of this phase.
- **R-02:** Confirm Inngest function name + signature for "judge" — D-17 needs to know how to re-emit. Read `inngest/judge.test.ts` and `inngest/functions/`.
- **R-03:** Verify `add_credits_atomic` RPC exists or needs creation as part of D-03. Phase 1 plan 01-05 may have already added — researcher checks.

</decisions>

<specifics>
## Specific Ideas

- "Failures must be visible in Sentry, not PM2 stdout" — D-11..D-14 enforces structured capture at every catch
- "Fail-secure on trial detection" — D-04 (1 photo not 3 if Supabase hiccups)
- "Client disconnect is real money, not a refund" — D-09 (log cost, no refund)
- "Judge data must not be lost forever" — D-15..D-19 (judge_pending + reconcile + dead-letter)

</specifics>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope sources
- `.planning/PROJECT.md` — vision, constraints (Phase 2.5 deferred — DO NOT propose judge calibration)
- `.planning/ROADMAP.md` §"Phase 2"
- `.planning/PHASE-DETAILS.md` §"Phase 2"
- `.planning/STATE.md`

### Findings to address
- `.planning/audits/MONOREPO-BUG-BASH.md` — H-1, H-2, H-3, H-4, H-9, H-10 (cross-cut Phase 1), H-12, H-13, M-11, M-15
- `.planning/codebase/CONCERNS.md` §11 "Race conditions in fallback read-modify-write paths" (refund branch)
- `.planning/codebase/QUALITY.md` §"Coverage Gaps" #1, #2, #3

### Codebase intel
- `.planning/codebase/ARCHITECTURE.md` §"Request flow for `/gerar` SSE pipeline" + §"Background job topology"
- `.planning/codebase/STACK.md` §Inngest section
- `.planning/codebase/QUALITY.md` §test inventory

### Phase 1 dependency
- `.planning/phases/01-payments-webhook-integrity/01-CONTEXT.md` — Phase 2 inherits webhook_events table + add_credits_atomic RPC. Read before planning to avoid duplicate scope.
- `.planning/phases/01-payments-webhook-integrity/01-RESEARCH.md` — researcher findings that may inform Phase 2

### Out-of-M1 (DO NOT broaden)
- `.planning/ROADMAP.md` §"Out-of-milestone (parking lot)" — Phase 2.5 (Labeling) is indefinitely deferred; judge_pending + reconcile + dead-letter are observability-only, NOT calibration

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `add_credits_atomic` RPC (likely added in Phase 1 01-05) — D-03 refund path uses it
- `webhook_events` dedup table (Phase 1 01-01) — webhook HTTP-level tests in D-... reference its existence
- Existing Inngest setup — D-17 reuses existing function dispatch
- Existing Sentry setup (`sentry.server.config.ts`) — D-11 adds tags to existing capture
- `lib/logger.ts` (TBC by R-01) — D-12 uses or creates

### Established Patterns
- SSE IIFE pattern in `/generate` — D-07/D-08 must preserve SSE shape; abort handling threads through IIFE
- Sentry `captureError` pattern — D-11 standardizes tags but doesn't replace existing helper
- Cron route pattern (`/api/cron/*`) — D-16 reconcile cron follows same shape
- RLS on all tables — new `judge_dead_letter` table needs RLS (service-role-only)

### Integration Points
- `app/api/campaign/generate/route.ts:805-812` — refund race (D-... uses `add_credits_atomic`)
- `app/api/campaign/generate/route.ts` (898 LOC, 42 console.*) — full logger migration
- `inngest/judge.*` — D-17 re-emit path
- `app/api/cron/judge-reconcile/route.ts` (new) — D-16 cron

</code_context>

<deferred>
## Deferred Ideas

- **Auto-retry of failed steps** — D-05 explicitly excludes; one-shot delivery. Could revisit in M2.
- **Background completion of partial deliveries** — D-06 explicitly excludes; what's delivered is final.
- **Refund proportional to steps completed on disconnect** — D-09 says no refund. Could be a future "fairness" feature.
- **Judge calibration / Promptfoo blocking** — Phase 2.5 deferred indefinitely per project memory. judge_pending stores raw signal; calibration is out of M1, out of M2, parking lot indefinitely.
- **Logger consolidation across rest of monorepo** — D-12 only fixes the 42 in `/generate`. Broader sweep is parking lot.
- **`CrialookError` base class** — parking lot per ROADMAP. D-... uses existing error patterns.
- **Custom Sentry dashboards from D-14 events** — events are emitted but dashboard wiring is ops follow-up, not in M1.

</deferred>

---

*Phase: 02-pipeline-resilience-and-observability*
*Context gathered: 2026-05-03*
