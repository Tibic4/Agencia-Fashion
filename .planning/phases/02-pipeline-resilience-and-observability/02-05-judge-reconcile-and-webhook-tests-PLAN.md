---
plan_id: 02-05
phase: 2
title: Judge reconcile cron + dead-letter writer + producer judge_pending writes + HTTP-level webhook tests (H-13, D-15..D-19, QUALITY priority #3)
wave: 3
depends_on: [02-01, 02-02, 02-03, 02-04]
files_modified:
  - campanha-ia/src/lib/ai/pipeline.ts (set judge_pending=true + persist judge_payload at producer time)
  - campanha-ia/src/lib/inngest/functions.ts (clear judge_pending=false on judgeCampaignJob success; clear on falha_judge sentinel write)
  - campanha-ia/src/lib/inngest/judge.test.ts (extend — verify clear behavior)
  - campanha-ia/src/app/api/cron/judge-reconcile/route.ts (new)
  - campanha-ia/src/app/api/cron/judge-reconcile/route.test.ts (new)
  - campanha-ia/src/app/api/webhooks/mercadopago/route.test.ts (extend OR new file — depends on Phase 1's existing test scope)
  - campanha-ia/src/app/api/billing/verify/route.test.ts (new — HTTP-level)
  - campanha-ia/src/app/api/billing/rtdn/route.test.ts (extend — Phase 1 added one for the C-1 RTDN fix; this plan adds full handler-level coverage)
autonomous: true
requirements: [H-13, D-15, D-16, D-17, D-18, D-19, "QUALITY:#3"]
must_haves:
  truths:
    - "Producer (pipeline.ts) sets campaigns.judge_pending=true AND writes judge_payload (full event JSON) AT THE SAME TIME it dispatches the Inngest event. If dispatch throws, judge_pending stays true and the cron will pick it up (D-15/D-17)"
    - "judgeCampaignJob success path clears judge_pending=false + judge_payload=null on the campaign row (so cron stops touching it)"
    - "judgeCampaignJob falha_judge sentinel (P1's Phase 02 D-02 path in functions.ts:342-384) ALSO clears judge_pending=false (sentinel is terminal — cron should not retry forever after sentinel write)"
    - "Reconcile cron runs every 5 minutes (D-16). Query: WHERE judge_pending=true AND judge_retry_count<3 AND (judge_last_attempt IS NULL OR judge_last_attempt < now() - interval '5 minutes')"
    - "Cron iteration: for each row, increment judge_retry_count, set judge_last_attempt=now(), re-emit Inngest event using judge_payload as data"
    - "After 3 failed retries (judge_retry_count >= 3 detected on next pass): INSERT into judge_dead_letter (campaign_id, last_error, retry_count, moved_at), set campaigns.judge_pending=false, emit Sentry 'judge.dead_letter' event (D-18, D-19)"
    - "Cron auth: same Authorization: Bearer ${CRON_SECRET} pattern as /api/cron/downgrade-expired (and Phase 4 will harden cron secret query-param drop separately)"
    - "HTTP-level webhook tests drive Request directly with raw bodies, stub admin client + verifier (per CONTEXT constraint) — assert side effects on Supabase mock + response shape"
    - "Phase 1 already added Mercado Pago + Clerk + RTDN tests for SOME paths (per 01-VERIFICATION). This plan ADDs missing coverage: webhooks/mercadopago full handler, billing/verify (Google Play purchase verification), billing/rtdn additional cases"
  acceptance:
    - "campaigns.judge_pending=true is written via supabase.from('campaigns').update({...}) BEFORE inngest.send. judge_payload contains the full event data"
    - "judgeCampaignJob success step adds an UPDATE clearing judge_pending + judge_payload (verifiable via judge.test.ts new case)"
    - "Falha_judge sentinel write (functions.ts:342-384 area) also clears judge_pending"
    - "Cron route POST handler authenticates via Bearer token, queries pending rows, re-emits Inngest events, increments retry counters; dead-letters at retry_count >= 3"
    - "Cron returns JSON: { ok, processed, dead_lettered, errors }"
    - "Cron tests: (a) no pending rows → returns processed=0, (b) 1 pending row → re-emits + retry_count++, (c) row at retry_count=3 → moves to dead-letter + clears judge_pending"
    - "Webhook tests cover: valid payload+signature → side effects asserted; invalid signature → 401; replay (same x-request-id within 5 min) → 200 dedup"
    - "All new vitest cases pass + baseline 184 preserved"
---

# Plan 02-05: Judge Reconcile Cron + Dead-Letter + HTTP-Level Webhook Tests

## Objective

Three coupled deliverables that close out Phase 2:

1. **H-13 / D-15..D-19** — End-to-end judge_pending lifecycle: producer marks pending, judge clears on success/sentinel, cron re-emits orphans, dead-letter terminates after 3 retries, Sentry alerts on dead-letter.
2. **QUALITY priority #3** — HTTP-level tests for `webhooks/mercadopago`, `billing/verify`, `billing/rtdn` route handlers (drive `Request`, stub admin client + verifier, assert side effects).

This is wave 3 because:
- Producer change in pipeline.ts depends on the schema columns (Plan 02-01 wrote migrations — owner must apply before this code is meaningful, but the producer code can ship regardless).
- Cron uses logger/hashStoreId from Plan 02-02.
- Cron's Sentry alerts use captureMessage patterns established in Plan 02-03.
- Webhook tests are independent of P2's other plans but logically belong here because they're the last QUALITY-priority finding.

## Truths the executor must respect

- **Migrations are NOT applied in this phase.** Plan 02-01 wrote `judge_pending`, `judge_retry_count`, `judge_last_attempt`, `judge_payload` columns + `judge_dead_letter` table. The owner applies via `supabase db push` after review. The producer code in pipeline.ts is forward-compatible: BEFORE the migration is applied, the producer's UPDATE attempting to set these columns will FAIL — wrap the UPDATE in try/catch + captureError, return success path regardless. After migration applies, the UPDATE succeeds. **This forward-compat shim is essential or P2 ships broken.**
- **Pipeline.ts producer site:** the existing `inngest.send({...}).catch(...)` is at lines 345-374 (per audit H-13). The new pre-write happens immediately BEFORE that send.
- **judge.test.ts already covers the falha_judge sentinel** (per RESEARCH inspection). The new vitest case asserts that BOTH the happy-path AND the falha_judge path clear `judge_pending`.
- **Cron secret authentication** uses the SAME pattern as `/api/cron/downgrade-expired/route.ts` (Bearer header). Phase 4 will harden the query-param fallback for `/api/cron/exchange-rate` separately (CONCERNS §10) — this plan doesn't introduce new cron-secret patterns.
- **HTTP-level test fixtures** drive `new Request(url, { method: "POST", body: ... })` and pass to the route handler's `POST` export. Mock `createAdminClient` and signature verifiers via `vi.mock`. Assert response status + assert mock calls (e.g., `expect(supabaseMock.from('stores').update).toHaveBeenCalledWith({...})`). Phase 1 already established this pattern in `01-03`'s `webhooks/mercadopago/route.test.ts` (5 cases) — extend it.
- **Webhook test scope clarity:**
  - **mercadopago:** Phase 1 added 5 regression cases focused on the Phase 1 fixes (C-2 renewal sub_id preservation, C-4 cancel state, H-14 empty x-request-id reject, dedupWebhook integration). Plan 02-05 ADDs full handler-level cases (signature reject, replay dedup with same x-request-id, fraud-gate rejection on amount mismatch, idempotency via credit_purchases.mp_payment_id constraint).
  - **billing/verify:** No tests exist (per QUALITY.md Coverage Gap #3). New file. Cover: valid IAB purchase → updateStorePlan called with right slug; invalid signature → 401; ALREADY-credited (idempotency via plan_payments_applied) → 200 no-op.
  - **billing/rtdn:** Phase 1 added 4 cases for the C-1 fix (REVOKED → free, RENEWED → pro). Plan 02-05 EXTENDS with: invalid Pub/Sub JWT → 401; PROCESSED notification → no plan change; webhook_events dedup re-fire → 200.

## Tasks

### Task 1: Producer-side judge_pending + judge_payload write (D-15, D-17 prereq)

<read_first>
- campanha-ia/src/lib/ai/pipeline.ts:345-374 (current Inngest dispatch site — the H-13 fire-and-forget)
- campanha-ia/src/lib/inngest/functions.ts:315-326 (JudgeRequestEvent shape)
- .planning/phases/02-pipeline-resilience-and-observability/02-RESEARCH.md (R-02 — explains why we persist judge_payload)
- .planning/phases/02-pipeline-resilience-and-observability/02-CONTEXT.md (D-15, D-17)
</read_first>

<action>
Edit `campanha-ia/src/lib/ai/pipeline.ts`. At the existing Inngest dispatch site (around line 345-374), restructure the dispatch block:

```ts
// H-13 / D-15: producer-side judge_pending tracking.
// Set judge_pending=true and persist the full event payload BEFORE dispatch
// so the D-16 reconcile cron can re-emit if Inngest is down or the function
// fails terminally. Wrapped in dryRun gate (D-18) per pipeline convention.
if (!input.dryRun && input.storeId && imageResult.successCount > 0) {
  const judgeEventData = {
    campaignId: campaignId,
    storeId: input.storeId,
    copyText: copyResult.caption_sugerida || JSON.stringify(copyResult),
    productImageUrl: input.productImageUrl,
    modelImageUrl: input.modelImageUrl,
    generatedImageUrl: imageResult.images[0]?.url ?? "",
    prompt_version: copyResult.prompt_version || "",
  };

  // Persist judge_pending + judge_payload BEFORE Inngest dispatch.
  // FORWARD-COMPAT: if migration 20260503_190000_*.sql isn't applied yet,
  // this UPDATE fails. Catch + captureError + continue — don't block the
  // user's response on observability infra.
  try {
    const { createAdminClient } = await import("@/lib/supabase/admin");
    const supabase = createAdminClient();
    const { error: pendingErr } = await supabase
      .from("campaigns")
      .update({
        judge_pending: true,
        judge_payload: judgeEventData,
        judge_retry_count: 0,
        judge_last_attempt: null,
      })
      .eq("id", campaignId);
    if (pendingErr) {
      // Migration probably not applied yet — log and continue.
      captureError(pendingErr, {
        route: "pipeline",
        step: "judge_pending_write",
        campaign_id: campaignId,
        forward_compat: true,
      });
    }
  } catch (e) {
    captureError(e, { route: "pipeline", step: "judge_pending_write", campaign_id: campaignId, forward_compat: true });
  }

  // Now dispatch (existing code, kept):
  inngest.send({ name: "campaign/judge.requested", data: judgeEventData }).catch((err) => {
    captureError(err, { route: "pipeline", step: "judge_dispatch", campaign_id: campaignId });
    // judge_pending stays true → cron picks it up
  });
}
```

The exact field names and structure must match the actual current pipeline code — read the file before editing. Imports for `createAdminClient`, `captureError` may need to be added at the top of `pipeline.ts` if absent.
</action>

<acceptance_criteria>
- pipeline.ts at the Inngest dispatch site sets `judge_pending: true`, `judge_payload: <event data>`, `judge_retry_count: 0`, `judge_last_attempt: null` BEFORE calling `inngest.send`
- The UPDATE is wrapped in try/catch — if it fails (e.g., migration not applied), captureError is called with `forward_compat: true` tag
- Inngest dispatch failure (the existing `.catch`) also has captureError — judge_pending stays true so the cron retries
- `tsc --noEmit` passes
- New vitest case in pipeline.test.ts: mock supabase update to succeed → assert update is called with correct payload BEFORE inngest.send
- New vitest case: mock supabase update to fail → assert captureError is called, dispatch continues
</acceptance_criteria>

---

### Task 2: judgeCampaignJob clears judge_pending on success + on falha_judge sentinel (D-17 / D-18)

<read_first>
- campanha-ia/src/lib/inngest/functions.ts:337-449 (full judgeCampaignJob — main fn + onFailure)
- campanha-ia/src/lib/inngest/judge.test.ts (existing tests — extend, do not break)
- .planning/phases/02-pipeline-resilience-and-observability/02-CONTEXT.md (D-17, D-18)
</read_first>

<action>
Edit `campanha-ia/src/lib/inngest/functions.ts`. Two edits to `judgeCampaignJob`:

**2a — Success path (Step 2 "persist-scores", around line 407-425):**

After `setCampaignScores(...)` succeeds, add a step that clears the campaign's pending flags:

```ts
// D-17: clear judge_pending on success — cron stops re-emitting for this row.
await step.run("clear-judge-pending", async () => {
  const { createAdminClient } = await import("@/lib/supabase/admin");
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("campaigns")
    .update({
      judge_pending: false,
      judge_payload: null,  // payload is no longer needed
    })
    .eq("id", data.campaignId);
  if (error) {
    // Forward-compat: migration may not be applied yet. Log and continue —
    // judge succeeded; pending-clear is observability-only, not user-blocking.
    console.warn(`[Inngest:Judge] judge_pending clear failed: ${error.message}`);
  }
});
```

**2b — onFailure (falha_judge sentinel) path (around line 342-384):**

After the `setCampaignScores(...)` write inside onFailure (which writes the sentinel), also clear judge_pending:

```ts
// D-18: sentinel was written → cron should stop re-emitting. The reconcile
// cron will see judge_pending=false and skip. The campaign retains the
// nivel_risco='falha_judge' marker, which is the desired terminal state.
try {
  const { createAdminClient } = await import("@/lib/supabase/admin");
  const supabase = createAdminClient();
  await supabase
    .from("campaigns")
    .update({ judge_pending: false, judge_payload: null })
    .eq("id", data.campaignId);
} catch (e) {
  console.warn(`[Inngest:Judge] judge_pending clear (sentinel path) failed: ${e instanceof Error ? e.message : e}`);
}
```

Note: the cron writes to `judge_dead_letter` after retry_count exceeds 3 (Plan task 3). The sentinel path here happens INSIDE the judge function's onFailure — that's a different terminal state ("Anthropic 5xx after retries exhausted at the function level, before the cron picks it up"). Both paths must clear judge_pending so the cron stops touching the row.

Extend `judge.test.ts`:

```ts
describe("judgeCampaignJob — happy path also clears judge_pending (D-17)", () => {
  it("calls supabase.update on campaigns table with judge_pending=false after persist-scores", async () => {
    // ... mock supabase.from('campaigns').update + setup ...
    // ... invoke fn ...
    // assert mockSupabaseUpdate was called with { judge_pending: false, judge_payload: null }
  });
});

describe("judgeCampaignJob — falha_judge sentinel also clears judge_pending (D-18)", () => {
  it("after sentinel write, also clears judge_pending=false", async () => {
    // ... invoke onFailure ...
    // assert clear-update was called
  });
});
```

The exact mock setup will need to extend the existing `vi.mock("@/lib/supabase/admin", ...)` (if present) or add it. Adapt to current test file shape.
</action>

<acceptance_criteria>
- Success path of judgeCampaignJob has a 4th `step.run("clear-judge-pending", ...)` that updates campaigns SET judge_pending=false, judge_payload=null
- onFailure handler has a similar update AFTER the sentinel write
- Both clears are wrapped in try/catch (forward-compat — don't break the function on missing column)
- 2 new vitest cases in judge.test.ts assert the clears happen
- Existing 9 cases in judge.test.ts still pass
- `tsc --noEmit` passes
</acceptance_criteria>

---

### Task 3: Reconcile cron route + tests (D-16, D-17, D-18, D-19)

<read_first>
- campanha-ia/src/app/api/cron/downgrade-expired/route.ts (Phase 1's existing cron — pattern reference: Bearer auth, NextResponse.json, captureError on outer catch)
- campanha-ia/src/lib/inngest/client.ts (inngest.send signature)
- campanha-ia/src/lib/inngest/functions.ts:315-326 (JudgeRequestEvent shape — judge_payload mirrors this)
- .planning/phases/02-pipeline-resilience-and-observability/02-CONTEXT.md (D-16 query, D-17 retry semantics, D-18 dead-letter, D-19 Sentry alert)
</read_first>

<action>
Create `campanha-ia/src/app/api/cron/judge-reconcile/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { createAdminClient } from "@/lib/supabase/admin";
import { inngest } from "@/lib/inngest/client";
import { logger, captureError, hashStoreId } from "@/lib/observability";

/**
 * Phase 02 D-16: reconcile cron for orphaned judge dispatches.
 *
 * Runs every 5 minutes (configured in cron platform — Inngest cron, Vercel cron,
 * or system crontab calling this endpoint with Authorization: Bearer ${CRON_SECRET}).
 *
 * Behavior:
 *   1. Query campaigns WHERE judge_pending=true AND judge_retry_count<3
 *      AND (judge_last_attempt IS NULL OR judge_last_attempt < now() - interval '5 minutes')
 *   2. For each row: re-emit Inngest event using stored judge_payload,
 *      increment judge_retry_count, set judge_last_attempt = now()
 *   3. After ROW judge_retry_count would reach 3+: INSERT to judge_dead_letter,
 *      clear judge_pending=false, emit Sentry 'judge.dead_letter' alert (D-19)
 *
 * Auth: Authorization: Bearer ${CRON_SECRET} (same as /api/cron/downgrade-expired).
 */

const MAX_RETRIES = 3;
const STALE_THRESHOLD_MINUTES = 5;

export async function POST(request: NextRequest) {
  // Bearer auth (matches existing cron pattern)
  const authHeader = request.headers.get("authorization") ?? "";
  const expectedToken = `Bearer ${process.env.CRON_SECRET}`;
  if (!process.env.CRON_SECRET || authHeader !== expectedToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = createAdminClient();
    const cutoffIso = new Date(Date.now() - STALE_THRESHOLD_MINUTES * 60 * 1000).toISOString();

    // D-16 query
    const { data: pending, error: queryErr } = await supabase
      .from("campaigns")
      .select("id, store_id, judge_payload, judge_retry_count, judge_last_attempt")
      .eq("judge_pending", true)
      .lt("judge_retry_count", MAX_RETRIES)
      .or(`judge_last_attempt.is.null,judge_last_attempt.lt.${cutoffIso}`);

    if (queryErr) {
      captureError(queryErr, { route: "cron.judge_reconcile", step: "query" });
      return NextResponse.json({ error: "Query failed" }, { status: 500 });
    }

    if (!pending || pending.length === 0) {
      return NextResponse.json({ ok: true, processed: 0, dead_lettered: 0, errors: 0 });
    }

    let processed = 0;
    let deadLettered = 0;
    let errors = 0;

    for (const row of pending) {
      try {
        const newRetryCount = (row.judge_retry_count ?? 0) + 1;

        if (newRetryCount > MAX_RETRIES) {
          // D-18: dead-letter terminal state
          const { error: dlErr } = await supabase.from("judge_dead_letter").insert({
            campaign_id: row.id,
            last_error: "exceeded_3_retries",
            retry_count: row.judge_retry_count ?? 0,
          });
          if (dlErr) {
            captureError(dlErr, { route: "cron.judge_reconcile", step: "dead_letter_insert", campaign_id: row.id });
            errors++;
            continue;
          }

          // Clear judge_pending so cron stops touching this row
          await supabase
            .from("campaigns")
            .update({ judge_pending: false })
            .eq("id", row.id);

          // D-19: Sentry alert
          Sentry.captureMessage("judge.dead_letter", {
            level: "warning",
            tags: {
              route: "cron.judge_reconcile",
              campaign_id: row.id,
              store_id: row.store_id ? hashStoreId(row.store_id) : "unknown",
              reason: "exceeded_3_retries",
            },
          });

          logger.warn("judge_dead_letter_moved", {
            campaign_id: row.id,
            store_id: row.store_id ? hashStoreId(row.store_id) : "unknown",
            retry_count: row.judge_retry_count,
          });

          deadLettered++;
          continue;
        }

        // D-17: re-emit + bump counters
        if (!row.judge_payload) {
          // No payload to re-emit (shouldn't happen if producer wrote it correctly).
          // Mark as dead-letter immediately rather than retry forever.
          captureError(new Error("judge_payload missing on pending campaign"), {
            route: "cron.judge_reconcile",
            step: "missing_payload",
            campaign_id: row.id,
          });
          await supabase.from("judge_dead_letter").insert({
            campaign_id: row.id,
            last_error: "missing_payload",
            retry_count: row.judge_retry_count ?? 0,
          });
          await supabase.from("campaigns").update({ judge_pending: false }).eq("id", row.id);
          deadLettered++;
          continue;
        }

        await inngest.send({
          name: "campaign/judge.requested",
          data: row.judge_payload as Record<string, unknown>,
        });

        await supabase
          .from("campaigns")
          .update({
            judge_retry_count: newRetryCount,
            judge_last_attempt: new Date().toISOString(),
          })
          .eq("id", row.id);

        logger.info("judge_reemit", {
          campaign_id: row.id,
          new_retry_count: newRetryCount,
        });

        processed++;
      } catch (e) {
        captureError(e, {
          route: "cron.judge_reconcile",
          step: "reemit_row",
          campaign_id: row.id,
        });
        errors++;
      }
    }

    return NextResponse.json({ ok: true, processed, dead_lettered: deadLettered, errors });
  } catch (e) {
    captureError(e, { route: "cron.judge_reconcile", step: "outer" });
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
```

Then create `campanha-ia/src/app/api/cron/judge-reconcile/route.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock supabase admin client + inngest send + Sentry
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(),
}));
vi.mock("@/lib/inngest/client", () => ({
  inngest: { send: vi.fn().mockResolvedValue(undefined) },
}));
vi.mock("@sentry/nextjs", () => ({
  captureMessage: vi.fn(),
}));

describe("/api/cron/judge-reconcile", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = "test-secret";
  });

  it("rejects request without Bearer token", async () => {
    const { POST } = await import("./route");
    const res = await POST(new Request("http://test/api/cron/judge-reconcile", { method: "POST" }) as never);
    expect(res.status).toBe(401);
  });

  it("returns processed=0 when no pending rows", async () => {
    // ... mock supabase to return empty array ...
    // ... call POST with valid Bearer ...
    // ... assert processed=0, dead_lettered=0
  });

  it("re-emits Inngest event for a pending row and increments retry_count", async () => {
    // ... mock 1 row at retry_count=1 ...
    // ... assert inngest.send called with judge_payload ...
    // ... assert update called with retry_count=2, judge_last_attempt set
  });

  it("moves to dead-letter when retry_count would exceed 3", async () => {
    // ... mock 1 row at retry_count=3 ...
    // ... assert insert into judge_dead_letter ...
    // ... assert update sets judge_pending=false ...
    // ... assert Sentry.captureMessage called with 'judge.dead_letter'
  });

  it("dead-letters immediately when judge_payload is missing", async () => {
    // ... mock 1 row with judge_payload=null ...
    // ... assert dead-letter insert + judge_pending cleared
  });
});
```

Adapt the supabase mock setup to match Phase 1's existing test patterns (e.g., chained .select().eq().lt() style). Use `vi.mock` factory with `createAdminClient` returning a mock client object.
</action>

<acceptance_criteria>
- File `campanha-ia/src/app/api/cron/judge-reconcile/route.ts` exists
- POST handler validates Bearer token (401 on missing/wrong)
- Query uses correct filter: judge_pending=true, judge_retry_count<3, judge_last_attempt IS NULL OR < cutoff
- Row processing: re-emit via inngest.send → update retry_count + judge_last_attempt
- When new retry would exceed MAX_RETRIES: insert dead-letter + clear judge_pending + emit Sentry 'judge.dead_letter'
- Missing judge_payload → dead-letter immediately (defensive)
- Outer try/catch with captureError on any path
- Test file with at least 5 cases covering: 401 unauth, 0-pending happy path, re-emit success, dead-letter at retry=3, missing-payload defensive
- All test cases pass
- `tsc --noEmit` passes
- Static check: `grep -n "MAX_RETRIES = 3" campanha-ia/src/app/api/cron/judge-reconcile/route.ts` returns 1
- Static check: `grep -n "judge.dead_letter" campanha-ia/src/app/api/cron/judge-reconcile/route.ts` returns ≥ 1
</acceptance_criteria>

---

### Task 4: HTTP-level webhook tests — webhooks/mercadopago full handler (QUALITY #3)

<read_first>
- campanha-ia/src/app/api/webhooks/mercadopago/route.ts (full file — handler under test)
- campanha-ia/src/app/api/webhooks/mercadopago/route.test.ts (Phase 1's existing test file — 5 cases. EXTEND, do not duplicate)
- campanha-ia/src/lib/mp-signature.ts (signature verifier — to mock)
- campanha-ia/src/lib/webhooks/dedup.ts (Phase 1 dedup helper — to mock)
- .planning/codebase/QUALITY.md §"Coverage Gaps" #2
</read_first>

<action>
Extend `campanha-ia/src/app/api/webhooks/mercadopago/route.test.ts` (existing) OR add new cases to it. New cases (Phase 1 already covered some):

```ts
describe("MP webhook full handler — additional coverage (Plan 02-05 / QUALITY #3)", () => {
  it("rejects invalid signature with 401", async () => {
    // mock validateMpSignature to return false
    // POST a payload, expect 401
  });

  it("returns 200 + dedupes on replay (same x-request-id within window)", async () => {
    // mock dedupWebhook to return { isDuplicate: true } on second call
    // first call: process. second call: 200 no-op. Assert no duplicate side effects.
  });

  it("rejects fraud-gate on amount mismatch (paid != expected)", async () => {
    // mock signature ok, but amount in payload != plan price
    // expect 200 (don't 5xx — but no addCreditsToStore call, log warn)
  });

  it("idempotency via credit_purchases.mp_payment_id constraint — second insert returns 23505 swallowed", async () => {
    // mock first call success
    // mock second call: addCreditsToStore throws PG unique violation 23505
    // assert handler returns 200, no double-credit
  });
});
```

Use the Phase 1 test file's imports / mocks as the starting point. Do NOT duplicate the 5 existing cases — they're for the C-2/C-4/H-14 fixes.
</action>

<acceptance_criteria>
- ≥ 4 NEW test cases in `webhooks/mercadopago/route.test.ts` (extending Phase 1's 5)
- Each case drives the route handler via `Request` object passed to the exported `POST`
- Mocks: `validateMpSignature`, `dedupWebhook`, `addCreditsToStore`, supabase admin
- Cases assert response status + side-effect mock-call assertions
- All cases pass
- `tsc --noEmit` passes
</acceptance_criteria>

---

### Task 5: HTTP-level webhook tests — billing/verify (NEW file, QUALITY #3)

<read_first>
- campanha-ia/src/app/api/billing/verify/route.ts (handler under test — Google Play purchase verification)
- campanha-ia/src/lib/payments/google-play.ts (verifier — to mock)
- campanha-ia/src/lib/payments/sku-plan-mapping.ts (Phase 1 added; verify mapping)
- Phase 1's `webhooks/clerk/route.test.ts` and `billing/rtdn/route.test.ts` for shape reference
</read_first>

<action>
Create `campanha-ia/src/app/api/billing/verify/route.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(),
}));
vi.mock("@/lib/payments/google-play", () => ({
  verifyPlayPurchase: vi.fn(),
}));
vi.mock("@clerk/nextjs/server", () => ({
  auth: vi.fn(() => ({ userId: "user_test_123" })),
}));

describe("/api/billing/verify (HTTP handler — QUALITY #3)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects unauthenticated requests with 401", async () => {
    // mock auth() to return { userId: null }
    // assert 401
  });

  it("verifies a valid IAB purchase + calls updateStorePlan with mapped slug", async () => {
    // mock verifyPlayPurchase to return { sku: "pro_mensal", purchaseToken: "...", valid: true }
    // mock store lookup
    // assert updateStorePlan called with planSlug='pro' (per skuToPlanSlug)
    // assert response 200 + { ok: true }
  });

  it("returns 200 no-op when purchase already credited (idempotency via plan_payments_applied)", async () => {
    // mock verifier ok, mock plan_payments_applied lookup to return existing row
    // assert updateStorePlan NOT called (already credited)
    // assert response 200 + { idempotent: true } or similar shape
  });

  it("rejects with 400 when purchaseToken is missing from request body", async () => {
    // POST with empty body
    // assert 400
  });

  it("returns 502 when Google Play verifier returns invalid", async () => {
    // mock verifyPlayPurchase to return { valid: false }
    // assert 502 or 400 (per current handler shape)
  });
});
```

Adapt mock shapes to match the actual `verify/route.ts` implementation (reading the file is required for accurate assertions). The exact response codes and shapes depend on the current handler.
</action>

<acceptance_criteria>
- File `campanha-ia/src/app/api/billing/verify/route.test.ts` exists
- ≥ 5 vitest cases as outlined
- Mocks: createAdminClient, verifyPlayPurchase, Clerk auth
- Each case drives the handler via Request + asserts response + mock-call shape
- All cases pass
- `tsc --noEmit` passes
</acceptance_criteria>

---

### Task 6: HTTP-level webhook tests — billing/rtdn additional cases (QUALITY #3)

<read_first>
- campanha-ia/src/app/api/billing/rtdn/route.ts (handler — Phase 1 fixed C-1)
- campanha-ia/src/app/api/billing/rtdn/route.test.ts (Phase 1's existing 4 cases — REVOKED, RENEWED, etc.)
- campanha-ia/src/lib/payments/google-pubsub-auth.ts (JWT verifier — to mock)
- .planning/codebase/QUALITY.md §"Coverage Gaps" #4
</read_first>

<action>
Extend `campanha-ia/src/app/api/billing/rtdn/route.test.ts` with NEW cases:

```ts
describe("/api/billing/rtdn additional handler coverage (Plan 02-05 / QUALITY #3)", () => {
  it("rejects request with invalid Pub/Sub JWT (401)", async () => {
    // mock verifyPubsubJwt to return { valid: false }
    // assert 401
  });

  it("PROCESSED notification → no plan change", async () => {
    // mock JWT ok, mock notificationType=PROCESSED
    // assert updateStorePlan NOT called
    // assert 200
  });

  it("dedupe via webhook_events: re-fire of same event_id → 200 no side effects", async () => {
    // mock dedupWebhook to return { isDuplicate: true }
    // assert updateStorePlan NOT called, response 200
  });

  it("packageName mismatch rejected with 400", async () => {
    // mock JWT ok, but payload.packageName != expected
    // assert 400
  });
});
```

Do NOT duplicate Phase 1's REVOKED/RENEWED cases.
</action>

<acceptance_criteria>
- ≥ 4 NEW cases in `billing/rtdn/route.test.ts`
- Mocks: verifyPubsubJwt, dedupWebhook, supabase admin
- All cases pass
- `tsc --noEmit` passes
- Static check: total test cases in file (existing + new) ≥ 8
</acceptance_criteria>

---

## Verification

1. `npx tsc --noEmit` in `campanha-ia/` exits 0.
2. `npx vitest run` passes baseline 184 + new cases (estimated +15 to +20 new vitest cases across all 6 tasks).
3. Static checks:
   - `grep -n "judge_pending: true" campanha-ia/src/lib/ai/pipeline.ts` returns ≥ 1
   - `grep -n "judge_pending: false" campanha-ia/src/lib/inngest/functions.ts` returns ≥ 2 (success path + onFailure)
   - `grep -n "judge.dead_letter" campanha-ia/src/app/api/cron/judge-reconcile/route.ts` returns ≥ 1
   - `grep -rn "describe.*MP webhook full handler" campanha-ia/src/app/api/webhooks/` returns ≥ 1 (new describe block)
   - File `campanha-ia/src/app/api/billing/verify/route.test.ts` exists
4. Manual end-to-end trace (no execution required — read paths):
   - Producer dispatches → judge_pending=true.
   - Inngest function succeeds → judge_pending=false.
   - Inngest function fails terminally (sentinel) → judge_pending=false.
   - Cron runs → finds pending → re-emits → retry_count++.
   - Cron at retry_count=3 → dead-letter + Sentry alert.

## Cross-cutting must_haves (this plan + entire phase)

```yaml
truths:
  - producer_writes_judge_pending_true_and_judge_payload_before_dispatch
  - judgejob_clears_judge_pending_on_success_and_on_sentinel
  - cron_query_filters_pending_retry_lt_3_and_5min_stale
  - cron_dead_letters_at_retry_count_3_with_sentry_alert
  - http_level_tests_drive_request_directly_with_mocks
  - phase_1_test_cases_unchanged_only_extended
acceptance:
  - tsc_passes
  - all_new_vitest_cases_pass_184_plus_new_baseline
  - phase_2_d15_through_d19_demonstrably_met
  - quality_priority_3_demonstrably_met_3_routes_have_http_tests
```
