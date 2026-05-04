---
plan_id: 02-03
phase: 2
title: Pipeline resilience — Promise.allSettled, signal honoring, trial fail-secure, refund via add_credits_atomic, upload_failed flag (H-1, H-2, H-3, H-4, D-01..D-14)
wave: 2
depends_on: [02-02]
files_modified:
  - campanha-ia/src/lib/ai/pipeline.ts
  - campanha-ia/src/lib/ai/pipeline.test.ts (extend)
  - campanha-ia/src/app/api/campaign/generate/route.ts
  - campanha-ia/src/lib/ai/gemini-vto-generator.ts (signal threading only)
files_modified_optional:
  - campanha-ia/src/lib/ai/with-timeout.ts (if signal needs to integrate with the timeout wrapper)
autonomous: true
requirements: [H-1, H-2, H-3, H-4, D-01, D-02, D-03, D-04, D-05, D-06, D-07, D-08, D-09, D-10, D-11, D-13, D-14]
must_haves:
  truths:
    - "Promise.all of [copy, image] is replaced with Promise.allSettled. Image-success + copy-failure delivers fallback caption (D-02). Image-partial-success (some VTO succeed, Sonnet OK) delivers ≥1 photo + UX flag partial_delivery (D-01). All-VTO-fail triggers refund via add_credits_atomic (D-03)"
    - "request.signal is read inside the IIFE at every step transition. On signal.aborted: skip remaining steps, do not write delivery rows, do not dispatch Inngest, log api_cost_logs.metadata.client_disconnected=true (D-09)"
    - "Trial-detection failure defaults to isTrialOnly = true (fail-secure per D-04). The Promise.all of [trialCount, purchaseCount] is wrapped in try/catch that flips the default"
    - "Refund branch (route.ts:798-808 area) calls add_credits_atomic instead of manual SELECT-then-UPDATE. The H-11 cousin race window is closed (last manual read-modify-write in the route)"
    - "Upload-failed branch writes api_cost_logs.metadata.upload_failed = true. No new column needed — metadata JSONB already exists (RESEARCH note)"
    - "Every captureError in the route includes structured tags: route='campaign.generate', step='vto|sonnet|trial_check|finalize|teaser|upload|refund', model=<model id>, store_id=hashStoreId(store.id) (D-11)"
    - "Custom Sentry events emitted via captureMessage on success/partial/failed/disconnected (D-14). Names: campaign.generated.success, campaign.generated.partial, campaign.generated.failed, campaign.client_disconnected"
    - "Demo mode skip from P1 commit 479e3be remains intact. failCampaign single-shot from P1 commit 132853b remains intact. NO duplicate fixes"
    - "No retry of failed steps (D-05). No background completion of partial deliveries (D-06)"
  acceptance:
    - "Existing 184 vitest baseline still passes — extend pipeline.test.ts with NEW cases, do not modify existing assertions unless they conflict with D-01..D-06"
    - "New vitest cases cover: (a) Promise.allSettled image-fail → throws with refund tag, (b) Promise.allSettled copy-fail → returns photos + fallback caption + sentry warn, (c) signal.aborted before VTO → no upload, no Inngest, (d) trial-check throw → isTrialOnly = true, (e) refund call uses add_credits_atomic mock"
    - "Static check: grep -n 'Promise.all\\(\\[copyPromise' campanha-ia/src/lib/ai/pipeline.ts returns 0 matches (replaced by allSettled)"
    - "Static check: grep -n 'request.signal' campanha-ia/src/app/api/campaign/generate/route.ts returns ≥ 5 matches (threaded into multiple steps)"
    - "Static check: grep -n 'add_credits_atomic' campanha-ia/src/app/api/campaign/generate/route.ts returns ≥ 1 match in the refund branch"
    - "Static check: grep -n 'metadata.*upload_failed' campanha-ia/src/app/api/campaign/generate/route.ts returns ≥ 1 match"
    - "Static check: grep -n 'metadata.*client_disconnected' campanha-ia/src/app/api/campaign/generate/route.ts returns ≥ 1 match"
    - "Manual trace confirms NO duplicate fixes for M-11 (demo skip — P1) or H-10 (failCampaign — P1)"
---

# Plan 02-03: Pipeline Resilience & Partial-Failure Contracts

## Objective

The headline plan: make `/api/campaign/generate` survive partial AI failures (D-01..D-06), honor client disconnect aggressively (D-07..D-10), fail-secure on trial detection (D-04), account costs honestly on partial failure (H-4), and tag every Sentry event with structured context (D-11..D-14).

This plan owns:
- **H-1** — `Promise.all([copy, image])` → `Promise.allSettled` with explicit success/fallback contracts. `dicas_postagem` shape hardened on Sonnet failure.
- **H-2** — `request.signal` honored end-to-end inside the SSE IIFE (skip remaining steps, abort upload retries, abort teaser branch).
- **H-3** — Trial-detection fail defaults `isTrialOnly = true`.
- **H-4** — `api_cost_logs.metadata.upload_failed` flag when refund branch fires.
- **D-01..D-14** — All decision IDs from CONTEXT.md.
- Refund race conversion to `add_credits_atomic` (CONTEXT scope-in).
- Skip teaser when `modelImageBase64` is the 1×1 fallback — DEPENDS on Plan 02-02's `usingFallbackModel` flag.

## Truths the executor must respect

- **NO Phase-1 duplicates.** M-11 (demo mode skip) is fixed in commit `479e3be`. H-10 (failCampaign single-shot) is fixed in commit `132853b`. The route still calls `failCampaign(...)` from 3 sites — those calls stay; the function itself is already single-shot. Verify by reading the file before editing.
- **No new schema for observability flags.** `api_cost_logs.metadata` is JSONB (existing, per RESEARCH note). Use `metadata.upload_failed = true` and `metadata.client_disconnected = true` instead of new columns.
- **Aggressive cancel (D-07).** The signal must be checked at every `await` boundary in the IIFE: before VTO call, before each upload retry, before teaser, before Inngest dispatch, before final `sendSSE("done", ...)`. No upload, no DB write for delivery, no Inngest dispatch after `signal.aborted`.
- **Gemini SDK has no native cancel (D-08).** The implementation: pass `AbortSignal` to `fetch()` calls (Gemini SDK uses fetch under the hood for some endpoints), but for the `ai.models.generateContent({...})` call, we cannot abort the in-flight call — we just stop awaiting and ignore the resolved promise. Document this in code comments.
- **Cost accounting on disconnect (D-09).** Write to `api_cost_logs` with `metadata.client_disconnected = true`. NO refund (the cost was real). Per-campaign cost metric reconciles.
- **Charge proportional credits on partial (D-01).** If 2 of 3 VTO succeed → 2 photos delivered, 2 credits charged (or however the existing per-photo cost model works — verify against `consumeCredit` semantics). NOT the full-batch credit.
- **Refund proportional? NO.** D-01 charges proportional. D-03 (all-fail) does FULL refund. There's no "partial refund" — partial = partial charge.
- **`partial_delivery` flag in SSE response.** UX badge "Algumas variações não ficaram prontas" is the consumer-side render — backend just emits the flag.
- **`sideEffect` helper from Plan 02-02 is OPTIONAL adoption here.** Use it for the new `api_cost_logs` writes (cleaner) but don't aggressively rewrite all existing manual gates. Limit churn.

## Tasks

### Task 1: Replace Promise.all with Promise.allSettled in pipeline.ts (H-1, D-01..D-03)

<read_first>
- campanha-ia/src/lib/ai/pipeline.ts (full file — especially line 308 area where Promise.all currently lives)
- campanha-ia/src/lib/ai/pipeline.test.ts (existing tests — must not break baseline)
- .planning/phases/02-pipeline-resilience-and-observability/02-CONTEXT.md (D-01, D-02, D-03)
- .planning/audits/MONOREPO-BUG-BASH.md H-1 (root cause)
</read_first>

<action>
Edit `campanha-ia/src/lib/ai/pipeline.ts`. Locate the current `Promise.all([copyPromise, imagePromise])` (around line 308 per audit) and replace with `Promise.allSettled` + explicit branching.

Pseudocode for the replacement (executor adapts to actual current shape):

```ts
// H-1 / D-01..D-03: Promise.allSettled with explicit per-arm fallback.
//
// Contracts:
//   D-01 image partial (some VTO ok, Sonnet ok) → deliver ≥1 photo + copy + UX flag partial_delivery. Charge proportional.
//   D-02 sonnet fail (image ok)                  → deliver photos + minimal fallback caption ("Sua campanha está pronta!" + generic hashtags). Charge full credit.
//   D-03 all-image fail                          → throw with code='ALL_VTO_FAILED' so route.ts refund branch fires (full refund via add_credits_atomic).

const [copyOutcome, imageOutcome] = await Promise.allSettled([copyPromise, imagePromise]);

// Image arm — primary value
let images: Array<{ url: string; width: number; height: number }>;
let partialDelivery = false;
if (imageOutcome.status === "fulfilled") {
  const imageResult = imageOutcome.value;
  images = imageResult.images;  // adapt to actual shape
  if (imageResult.successCount > 0 && imageResult.successCount < imageResult.requestedCount) {
    partialDelivery = true;  // D-01
  }
  if (imageResult.successCount === 0) {
    // D-03: all VTO failed — escalate
    const err: Error & { code?: string } = new Error("All VTO calls failed");
    err.code = "ALL_VTO_FAILED";
    throw err;
  }
} else {
  // imageOutcome.status === "rejected" — same as all-fail
  const err: Error & { code?: string } = new Error(
    `Image generation failed: ${imageOutcome.reason instanceof Error ? imageOutcome.reason.message : String(imageOutcome.reason)}`,
  );
  err.code = "ALL_VTO_FAILED";
  throw err;
}

// Copy arm — fallback to minimal copy on fail (D-02)
let copyResult;
if (copyOutcome.status === "fulfilled") {
  copyResult = copyOutcome.value;
} else {
  // D-02 fallback caption
  copyResult = {
    caption_sugerida: "Sua campanha está pronta!",
    dicas_postagem: {
      hashtags: ["#novaColecao", "#moda", "#estilo"],
      melhor_horario: "18:00-21:00",
      cta: "Confira agora",
      tom: "neutro",
    },
  };
  // Sentry warn — not error (we still delivered)
  captureError(new Error(`Sonnet failed, using fallback caption: ${copyOutcome.reason instanceof Error ? copyOutcome.reason.message : String(copyOutcome.reason)}`), {
    route: "campaign.generate",
    step: "sonnet",
    severity: "warn",   // D-02 is warn-level
  });
}

// dicas_postagem shape harden — even if Sonnet returned but with missing fields
if (!copyResult.dicas_postagem) {
  copyResult.dicas_postagem = {
    hashtags: [],
    melhor_horario: "18:00-21:00",
    cta: "Confira agora",
    tom: "neutro",
  };
}

return { images, copy: copyResult, partial_delivery: partialDelivery };
```

The exact field names must match the existing pipeline return shape — read the current code and adapt. The intent is:
1. `Promise.all` → `Promise.allSettled`.
2. Image-arm rejection or zero-success-count → throw with `code: "ALL_VTO_FAILED"`.
3. Image-arm partial-success → emit `partial_delivery: true` flag.
4. Copy-arm rejection → fallback object (no throw).
5. `dicas_postagem` is always defined post-this-block (defensive shape).

Update `pipeline.test.ts` with NEW cases (do not modify existing dryRun/D-18 cases):
- `it("D-03: image arm rejects → throws with code=ALL_VTO_FAILED")`
- `it("D-02: copy arm rejects → returns photos + fallback caption + emits Sentry warn")`
- `it("D-01: image arm successCount < requestedCount → returns partial_delivery=true")`
- `it("D-02: copy succeeds but dicas_postagem missing → returns shape-hardened dicas_postagem")`
</action>

<acceptance_criteria>
- `Promise.all([copyPromise, imagePromise])` is removed; `Promise.allSettled([copyPromise, imagePromise])` replaces it
- Image arm rejection or zero successCount → throws `Error` with `code === "ALL_VTO_FAILED"`
- Copy arm rejection → continues with fallback caption object (does not throw)
- `partial_delivery: true` is emitted in the return object when image arm has partial success
- `dicas_postagem` is always present in the return object (shape-hardened)
- Sentry warn captured when Sonnet falls back (not error-level)
- 4 new vitest cases pass, baseline 184 also pass
- Static check: `grep -c "Promise.all\\(\\[" campanha-ia/src/lib/ai/pipeline.ts` returns 0 matches inside the runCampaignPipeline function (other Promise.all usage in pipeline.ts is OK if it's not the copy+image arm)
- Static check: `grep -n "ALL_VTO_FAILED" campanha-ia/src/lib/ai/pipeline.ts` returns ≥ 1 match
</acceptance_criteria>

---

### Task 2: Honor request.signal end-to-end in the SSE IIFE (H-2, D-07..D-10)

<read_first>
- campanha-ia/src/app/api/campaign/generate/route.ts (full file — focus on the IIFE and signal threading at line 513 area)
- campanha-ia/src/lib/ai/pipeline.ts (signal field on input — declared but unused per H-2)
- campanha-ia/src/lib/ai/with-timeout.ts (timeout wrapper — D-08 says no native Gemini cancel; document)
- .planning/audits/MONOREPO-BUG-BASH.md H-2 (current state)
- .planning/phases/02-pipeline-resilience-and-observability/02-CONTEXT.md (D-07, D-08, D-09, D-10)
</read_first>

<action>
Edit `campanha-ia/src/app/api/campaign/generate/route.ts`. The IIFE is the `(async () => { ... })()` block inside the `POST` handler. Add signal checks at every step transition and at the start of the upload retry loop.

The pattern at every check:

```ts
if (request.signal.aborted) {
  // D-10: zero work after disconnect — log + early return
  await logDisconnectAndExit({ store, campaignRecord, currentStep: "before_vto" });
  return;  // exits the IIFE
}
```

Where `logDisconnectAndExit` is a new helper inside the route file (or extracted to a small `lib/ai/log-disconnect.ts`):

```ts
async function logDisconnectAndExit({ store, campaignRecord, currentStep }: {
  store: { id: string } | null;
  campaignRecord: { id: string } | null;
  currentStep: string;
}) {
  if (!store) return;  // anonymous demo path — nothing to log
  try {
    const supabase = createAdminClient();
    await supabase.from("api_cost_logs").insert({
      store_id: store.id,
      campaign_id: campaignRecord?.id ?? null,
      provider: "system",
      model_used: "client_disconnect",
      action: "client_disconnected",
      cost_usd: 0,
      cost_brl: 0,
      input_tokens: 0,
      output_tokens: 0,
      tokens_used: 0,
      metadata: {
        client_disconnected: true,
        last_step: currentStep,
      },
    });
    // D-14 custom Sentry event
    Sentry.captureMessage("campaign.client_disconnected", {
      level: "info",
      tags: {
        route: "campaign.generate",
        step: currentStep,
        store_id: hashStoreId(store.id),
      },
    });
    logger.info("client_disconnected", { last_step: currentStep, store_id: hashStoreId(store.id) });
  } catch (e) {
    captureError(e, {
      route: "campaign.generate",
      step: "log_disconnect",
      store_id: hashStoreId(store.id),
    });
  }
}
```

Insert signal checks at AT LEAST these points inside the IIFE:

1. Before VTO call (around the `runCampaignPipeline` invocation)
2. Before each iteration of the upload retry loop (around lines 594-622)
3. Before the teaser branch (around line 681)
4. Before the Inngest judge dispatch (around line 345 in pipeline.ts is ok; but in route.ts there's also a pre-dispatch slot)
5. Before `sendSSE("done", ...)` final emit
6. Before any `failCampaign(...)` call (don't write failure if user disconnected — just log disconnect)

Thread `request.signal` into `runCampaignPipeline` (already passed; unused per H-2). Inside `pipeline.ts`, also add signal checks at:

1. Top of function — early-return if already aborted
2. Between Sonnet and image kickoff
3. Inside the loop that constructs Promise.allSettled (each VTO call could be wrapped in `if (input.signal?.aborted) return;`)

For the Gemini SDK call (no native cancel), add a comment:

```ts
// D-08: Gemini SDK has no native cancel. The in-flight generateContent call
// keeps running and we sink-cost the API spend. After this await, signal
// check stops downstream work.
```

The existing IIFE has SSE writer try/catch (`try { await writer.close() } catch {}`). Don't break that — keep the writer cleanup at the end, but skip all delivery writes after disconnect.
</action>

<acceptance_criteria>
- `request.signal.aborted` is checked at AT LEAST 5 distinct sites in the IIFE (before VTO, before each upload retry, before teaser, before Inngest dispatch, before final SSE emit)
- A `logDisconnectAndExit` helper writes `api_cost_logs.metadata.client_disconnected = true` exactly once on first detected abort
- After disconnect: no upload, no `failCampaign`, no Inngest dispatch, no SSE delivery emit (only writer close)
- `runCampaignPipeline` reads `input.signal?.aborted` at top + between Sonnet and image (or equivalent — verify shape)
- Comment at the Gemini SDK call documents D-08 ("no native cancel — in-flight call sunk cost")
- New vitest case: simulate `signal.aborted = true` BEFORE VTO → assert no upload happens, no Inngest send happens, `api_cost_logs` row has `metadata.client_disconnected = true`
- Static check: `grep -c "request.signal.aborted" campanha-ia/src/app/api/campaign/generate/route.ts` returns ≥ 5
- Static check: `grep -c "input.signal" campanha-ia/src/lib/ai/pipeline.ts` returns ≥ 2 (used, not just declared)
</acceptance_criteria>

---

### Task 3: Trial detection fail-secure (H-3, D-04)

<read_first>
- campanha-ia/src/app/api/campaign/generate/route.ts:212-235 (current trial detection)
- .planning/audits/MONOREPO-BUG-BASH.md H-3 (current behavior: fails to false → user gets 3 photos)
- .planning/phases/02-pipeline-resilience-and-observability/02-CONTEXT.md (D-04 — fail-secure default true)
</read_first>

<action>
Edit `campanha-ia/src/app/api/campaign/generate/route.ts` around lines 212-235 (trial detection block).

Replace the current `catch (trialErr) → isTrialOnly = false` with `isTrialOnly = true`:

```ts
let isTrialOnly = false;
try {
  // existing Promise.all of [trialCount, purchaseCount] queries
  const [trialCount, purchaseCount] = await Promise.all([
    /* ... existing query ... */,
    /* ... existing query ... */,
  ]);
  isTrialOnly = (trialCount.count > 0 && purchaseCount.count === 0);
} catch (trialErr) {
  // D-04: fail-secure. Detection failure → assume trial (1 photo, not 3).
  // Prevents abuse where DB outage could be triggered to get 3 photos
  // on a single trial credit.
  isTrialOnly = true;
  captureError(trialErr, {
    route: "campaign.generate",
    step: "trial_check",
    store_id: store ? hashStoreId(store.id) : "anon",
    severity: "warn",
    fail_secure_applied: true,
  });
  logger.warn("trial_check_fail_secure", {
    reason: trialErr instanceof Error ? trialErr.message : String(trialErr),
  });
}
```

If `logger`/`captureError`/`hashStoreId` are not yet imported at the top of the route, add them (Plan 02-04 will do the broader sweep, but this task may need the imports for its own captureError calls).
</action>

<acceptance_criteria>
- The `catch (trialErr)` branch now sets `isTrialOnly = true` (was `false`)
- The catch branch calls `captureError` with structured tags (`route`, `step='trial_check'`, `store_id`, `fail_secure_applied: true`)
- Comment documents D-04 fail-secure rationale
- New vitest case (or integration check via existing route handler test if one exists): mock the trial-detection query to throw → assert `isTrialOnly` is `true` for the rest of the request
- Static check: `grep -A 5 "catch (trialErr" campanha-ia/src/app/api/campaign/generate/route.ts` shows `isTrialOnly = true` on the failing path
</acceptance_criteria>

---

### Task 4: Refund branch via add_credits_atomic + upload_failed flag (H-4, refund race fix, D-03)

<read_first>
- campanha-ia/src/app/api/campaign/generate/route.ts:798-808 (current refund branch — manual SELECT-then-UPDATE)
- campanha-ia/supabase/migrations/20260419_add_credits_atomic_rpc.sql (RPC signature)
- campanha-ia/supabase/migrations/20260424_harden_rpcs_and_constraints.sql:6-34 (hardened version)
- .planning/phases/02-pipeline-resilience-and-observability/02-RESEARCH.md (R-03 — RPC confirmed pre-existing, with refund call shape)
</read_first>

<action>
Two edits in `campanha-ia/src/app/api/campaign/generate/route.ts`:

**4a — Refund branch (currently around lines 798-808):**

Replace the manual SELECT-then-UPDATE:

```ts
const { data: curr } = await sb.from("stores").select("credit_campaigns").eq("id", store.id).single();
await sb.from("stores").update({ credit_campaigns: (curr?.credit_campaigns || 0) + 1 }).eq("id", store.id);
```

With the atomic RPC call:

```ts
// CONTEXT scope-in: convert refund race to add_credits_atomic.
// Closes the H-11-cousin window in this last manual read-modify-write site.
const { error: refundErr } = await sb.rpc("add_credits_atomic", {
  p_store_id: store.id,
  p_column: "credit_campaigns",
  p_quantity: 1,
});
if (refundErr) {
  captureError(new Error(`Refund failed: ${refundErr.message}`), {
    route: "campaign.generate",
    step: "refund",
    store_id: hashStoreId(store.id),
    error_code: errCode,
  });
  // Do NOT throw — refund failure shouldn't block the SSE error response.
  // Sentry alert is the recovery channel.
} else {
  logger.info("refund_credit_returned", {
    store_id: hashStoreId(store.id),
    error_code: errCode,
  });
}
```

**4b — Upload-failed flag in api_cost_logs:**

Locate the upload-failure branch (around route.ts:574-672 per audit H-4) — the path that triggers when upload retries exhaust and the route falls into the refund-or-error path. Add to the `api_cost_logs` insert (which currently happens around line 815-829 — that insert already exists for the pipeline_error case):

```ts
metadata: {
  error_code: errCode,
  message: technicalMsg.slice(0, 500),
  retryable: isRetryable,
  upload_failed: <boolean — true when this error is upload-related>,
}
```

The way to determine `upload_failed = true`:
- The upload retry loop sets a local boolean (e.g., `let uploadFailed = false`) flipped to `true` when the loop exhausts retries without ANY successful upload.
- The catch block reads that flag.

Alternatively, inspect `errCode` — if it's `ALL_UPLOADS_FAILED` (a code emitted by the upload branch), set `upload_failed = true`.

Pick whichever approach is cleaner given the actual current code shape. The intent is per-campaign cost-metric reconciliation: when the user got nothing AND we burned Gemini cost, the cost log row says so.
</action>

<acceptance_criteria>
- Refund branch uses `sb.rpc("add_credits_atomic", { p_store_id, p_column: "credit_campaigns", p_quantity: 1 })` instead of SELECT-then-UPDATE
- Refund failure → `captureError` with structured tags + DOES NOT throw (no blocking the SSE error response)
- `api_cost_logs.metadata.upload_failed = true` is written when the upload-failed code path triggers the cost log insert
- New vitest case: mock supabase.rpc("add_credits_atomic") to return error → assert captureError is called, no throw, response continues
- Static check: `grep -n "add_credits_atomic" campanha-ia/src/app/api/campaign/generate/route.ts` returns ≥ 1 match in the refund branch
- Static check: `grep -n "metadata.*upload_failed" campanha-ia/src/app/api/campaign/generate/route.ts` returns ≥ 1 match
- Static check: `grep -B 2 -A 4 "credit_campaigns:.*\\+ 1" campanha-ia/src/app/api/campaign/generate/route.ts` returns 0 matches (manual increment removed)
</acceptance_criteria>

---

### Task 5: D-14 custom Sentry events on success/partial/failed/disconnected

<read_first>
- campanha-ia/sentry.server.config.ts (existing Sentry setup — verify Sentry import is available in route.ts)
- .planning/phases/02-pipeline-resilience-and-observability/02-CONTEXT.md (D-14 — event names listed)
- campanha-ia/src/lib/observability.ts (the captureError + identifyForSentry already exist; D-14 events use Sentry.captureMessage directly)
</read_first>

<action>
At the SUCCESS path (final `sendSSE("done", ...)` in the route), emit the success event:

```ts
import * as Sentry from "@sentry/nextjs";  // already imported in many files; verify

// D-14: success event for dashboards
Sentry.captureMessage("campaign.generated.success", {
  level: "info",
  tags: {
    route: "campaign.generate",
    store_id: hashStoreId(store.id),
    photos_delivered: String(images.length),
    partial_delivery: String(partialDelivery),
  },
});
```

At the PARTIAL-delivery branch (when `partial_delivery: true` from pipeline):

```ts
// D-14: partial event — distinguishable from success in dashboards
Sentry.captureMessage("campaign.generated.partial", {
  level: "warning",
  tags: {
    route: "campaign.generate",
    store_id: hashStoreId(store.id),
    photos_delivered: String(images.length),
    photos_requested: String(requestedCount),
  },
});
```

At the FAIL paths (the catch block that calls `failCampaign` and refund):

```ts
// D-14: failed event
Sentry.captureMessage("campaign.generated.failed", {
  level: "error",
  tags: {
    route: "campaign.generate",
    store_id: hashStoreId(store.id),
    error_code: errCode,
    refund_applied: String(creditReserved && shouldRefund),
  },
});
```

The `campaign.client_disconnected` event is already emitted in Task 2's `logDisconnectAndExit`.

Note: `Sentry.captureMessage(..., { tags })` puts tags on the event for filtering. Tags are flat strings (not nested). The structured `route+step+model+store_id_hash` from D-11 maps to `tags.route`, `tags.step`, `tags.model`, `tags.store_id`. captureError already uses `setExtra` for the same context — extra fields are searchable but not as cheap as tags. Mixing tags + extra is fine.
</action>

<acceptance_criteria>
- `Sentry.captureMessage("campaign.generated.success", ...)` is emitted at the final success SSE emit
- `Sentry.captureMessage("campaign.generated.partial", ...)` is emitted when `partial_delivery: true`
- `Sentry.captureMessage("campaign.generated.failed", ...)` is emitted in the catch block (alongside the existing `failCampaign` call — both fire)
- `Sentry.captureMessage("campaign.client_disconnected", ...)` is emitted in `logDisconnectAndExit` (Task 2)
- All 4 events include tags: `route`, `store_id` (hashed), and event-specific tags (photos_delivered, error_code, etc.)
- Static check: `grep -c "Sentry.captureMessage" campanha-ia/src/app/api/campaign/generate/route.ts` returns ≥ 4
- Static check: `grep -c "campaign.generated.success\\|campaign.generated.partial\\|campaign.generated.failed\\|campaign.client_disconnected" campanha-ia/src/app/api/campaign/generate/route.ts` returns ≥ 4
</acceptance_criteria>

---

## Verification

1. `npx tsc --noEmit` in `campanha-ia/` exits 0.
2. `npx vitest run src/lib/ai src/app/api/campaign/generate` passes (existing baseline + new cases).
3. Static checks (all from acceptance criteria above) pass.
4. Manual trace through `route.ts` confirms:
   - 3 `failCampaign(...)` calls remain (P1 fix at function-level still active — DO NOT add status guards at call sites).
   - Demo mode quota gate from P1 commit `479e3be` is intact (the `!IS_DEMO_MODE` guard around `canGenerateCampaign`).
   - Refund branch is now atomic (RPC) not SELECT-then-UPDATE.
   - Trial check fails-secure to `true`.
   - Signal checked at ≥ 5 sites in IIFE.
   - Promise.allSettled in pipeline.ts.
5. Verification of P1 NON-DUPLICATION: `git log --oneline | grep -E "479e3be|132853b"` shows both commits exist (proving P1 fixes shipped). The plan's acceptance criteria for these fixes is "still in place" — not "fixed in this plan".

## Cross-cutting must_haves

```yaml
truths:
  - promise_all_replaced_with_allsettled_in_pipeline
  - signal_aborted_checked_at_5plus_sites_in_iife
  - trial_check_fails_secure_to_true
  - refund_uses_add_credits_atomic_not_manual_select_update
  - upload_failed_flag_in_api_cost_logs_metadata
  - client_disconnected_flag_in_api_cost_logs_metadata
  - sentry_custom_events_for_success_partial_failed_disconnected
  - hashstoreid_used_for_all_store_id_tags
  - phase_1_fixes_for_m11_h10_h11_h6_intact_no_duplication
acceptance:
  - tsc_passes
  - vitest_pipeline_route_tests_pass
  - phase_2_partial_failure_contracts_d01_through_d06_demonstrably_met
  - phase_2_abort_semantics_d07_through_d10_demonstrably_met
```
