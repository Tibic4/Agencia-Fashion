---
plan_id: 01-03
phase: 1
title: Mercado Pago Webhook Hardening — dedup, sub_id preservation, status column, ownership cross-check
wave: 2
depends_on: [01-01, 01-02]
files_modified:
  - campanha-ia/src/app/api/webhooks/mercadopago/route.ts
  - campanha-ia/src/lib/db/index.ts
  - campanha-ia/src/lib/mp-signature.ts
autonomous: true
requirements: [C-2, C-4, H-14, M-18, L-11]
must_haves:
  truths:
    - "Renewal payment webhooks NEVER set mercadopago_subscription_id to null (C-2 fix)"
    - "subscription_preapproval cancel sets subscription_status='cancelled' instead of nulling sub_id (C-4 fix)"
    - "Every MP webhook handler call inserts (provider='mp', event_id=x-request-id) into webhook_events BEFORE business logic"
    - "Empty x-request-id is rejected with 400 (H-14 fix) — does not reach the dedup or signature path"
    - "subscription_preapproval handler validates external_reference and storeId BEFORE mutating stores (M-18 fix)"
    - "Non-active MP subscription statuses (pending, expired, failed) log at warn level (L-11 fix)"
  acceptance:
    - "After a renewal payment webhook, stores.mercadopago_subscription_id is unchanged (regression test)"
    - "Cancel-then-immediate-resubscribe within the same cron window leaves the user on the paid plan"
    - "Replaying the same MP webhook (same x-request-id) twice processes once and short-circuits the second"
---

# Plan 01-03: Mercado Pago Webhook Hardening

## Objective

Fix the four C/H/M findings on the MP webhook path:

1. **C-2** — Stop `updateStorePlan` from clobbering `mercadopago_subscription_id` on renewal payments.
2. **C-4** — Replace "null sub_id on cancel" with positive-intent `subscription_status` column write.
3. **H-14** — Reject empty `x-request-id` outright (defense in depth + dedup contract).
4. **M-18** — Cross-check `external_reference` ownership on cancel before mutating.
5. **L-11** — Log unknown subscription statuses at `warn`.

Plus: integrate `dedupWebhook(provider='mp', eventId=x-request-id, payload)` from 01-02 at the top of the handler so replays are 200-no-op'd.

## Truths the executor must respect

- The MP webhook MUST always return 200 to MP for both real success AND processing errors that we choose to swallow — this prevents MP retry loops. Signature failures get 401, missing/empty `x-request-id` gets 400 (defense in depth — not a retryable state from MP's perspective).
- Idempotency for credit grants is currently in-place via `credit_purchases.mercadopago_payment_id` UNIQUE index AND `plan_payments_applied.payment_id` UNIQUE. Webhook_events dedup is **belt+suspenders** at the request layer; do NOT remove the existing per-table guards.
- The `mp_status` column STAYS in parallel — we WRITE the new `subscription_status` column on cancel/authorized; we do NOT remove the existing logic.
- Existing fraud gates (`amountMatches`, `PLANS` lookup, `ALL_CREDIT_PACKAGES` lookup) MUST be preserved exactly. They run BEFORE any state mutation today and stay in that order.
- `updateStorePlan` is also called from `/api/billing/verify` (Play subscription path); that path passes a real `mpSubscriptionId` argument already. Don't break it. The fix is a `undefined`-check in `updateStorePlan` itself, not a removal of the parameter.

## Tasks

### Task 1: Fix `updateStorePlan` to preserve `mercadopago_subscription_id` when caller does not pass one (C-2)

<read_first>
- campanha-ia/src/lib/db/index.ts (lines 706-770 — current `updateStorePlan`)
- campanha-ia/src/app/api/webhooks/mercadopago/route.ts (line 224 — call without sub_id, intentional comment at lines 222-223)
- campanha-ia/src/app/api/billing/verify/route.ts (line where updateStorePlan is called — confirms verify passes the sub_id)
- .planning/audits/MONOREPO-BUG-BASH.md (C-2 finding)
</read_first>

<action>
Edit `campanha-ia/src/lib/db/index.ts` lines 706-735. Change the `updateStorePlan` function signature so `mpSubscriptionId` semantics are explicit: `undefined` means "preserve existing value", and only `null` or a string means "overwrite".

Replace the current `.update({ ... mercadopago_subscription_id: mpSubscriptionId || null, ... })` (line 730-733) with conditional spread:

```ts
export async function updateStorePlan(storeId: string, planName: string, mpSubscriptionId?: string | null) {
  const supabase = createAdminClient();

  // Buscar ID do plano
  const { data: plan } = await supabase
    .from("plans")
    .select("id, campaigns_per_month")
    .eq("name", planName)
    .single();

  if (!plan) throw new Error(`Plano "${planName}" não encontrado`);

  // Buscar plano anterior para detectar mudança (antes do update)
  const { data: storeData } = await supabase
    .from("stores")
    .select("plan_id")
    .eq("id", storeId)
    .single();
  const planChanged = storeData?.plan_id !== plan.id;

  // Phase 1 / C-2: only mutate mercadopago_subscription_id when caller EXPLICITLY
  // passes one. `undefined` = preserve existing (renewal payment path); `null` = clear
  // (legacy callers, or explicit clear); `string` = set.
  const subUpdate =
    mpSubscriptionId === undefined ? {} : { mercadopago_subscription_id: mpSubscriptionId };

  // Atualizar loja
  await supabase
    .from("stores")
    .update({
      plan_id: plan.id,
      ...subUpdate,
      // updated_at is auto-set by the BEFORE UPDATE trigger from 20260503_180200.
      // Keeping the explicit set here is harmless (trigger overrides) but redundant —
      // we leave it for backward-compat readability.
      updated_at: new Date().toISOString(),
    })
    .eq("id", storeId);

  // ... rest of function (period reset logic) unchanged
```

Keep the entire period-reset logic that follows (lines 737-769) exactly as-is.
</action>

<acceptance_criteria>
- `updateStorePlan` signature is `(storeId: string, planName: string, mpSubscriptionId?: string | null)`
- The `.update()` payload is built via conditional spread: `mercadopago_subscription_id` ONLY appears in the payload when `mpSubscriptionId !== undefined`
- File no longer contains the literal `mercadopago_subscription_id: mpSubscriptionId || null`
- TypeScript compile passes
- Vitest (or new co-located test): calling `updateStorePlan('s1', 'pro')` with no third arg, against a store row that has `mercadopago_subscription_id = 'sub_xyz'`, leaves `mercadopago_subscription_id` unchanged after the call
- Calling `updateStorePlan('s1', 'pro', 'sub_new')` overwrites with `'sub_new'`
- Calling `updateStorePlan('s1', 'pro', null)` clears to `null`
</acceptance_criteria>

---

### Task 2: MP webhook handler — reject empty x-request-id, integrate dedupWebhook (H-14, D-06)

<read_first>
- campanha-ia/src/app/api/webhooks/mercadopago/route.ts (entire file — 318 lines)
- campanha-ia/src/lib/webhooks/dedup.ts (created by 01-02)
- campanha-ia/src/lib/mp-signature.ts (signature validator interface)
- .planning/phases/01-payments-webhook-integrity/01-CONTEXT.md (D-06 ordering)
</read_first>

<action>
Edit `campanha-ia/src/app/api/webhooks/mercadopago/route.ts`. In the `POST(request)` handler, after the existing logger call (line 58-63) but BEFORE `validateWebhookSignature`, add the empty-id reject. Then after signature validation passes (line 70), add the `dedupWebhook` short-circuit. Wrap business logic in try/finally with `markWebhookProcessed`.

Concrete shape (replace lines 52-94 of the current file):

```ts
import { dedupWebhook, markWebhookProcessed } from "@/lib/webhooks/dedup";

export async function POST(request: NextRequest) {
  const xRequestId = request.headers.get("x-request-id")?.trim() || "";
  if (!xRequestId) {
    // H-14: MP docs require x-request-id. Treat absence as invalid event.
    logger.warn("mp_webhook_missing_request_id");
    return NextResponse.json({ error: "missing x-request-id" }, { status: 400 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    logger.warn("mp_webhook_invalid_json", { xRequestId });
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  logger.info("mp_webhook_received", {
    type: body?.type,
    action: body?.action,
    dataId: (body?.data as Record<string, unknown>)?.id,
    liveMode: body?.live_mode,
    xRequestId,
  });

  const dataId = (body?.data as Record<string, unknown>)?.id ? String((body.data as Record<string, unknown>).id) : "";
  if (!validateWebhookSignature(request, dataId)) {
    logger.warn("mp_webhook_invalid_signature", { xRequestId });
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  // D-06: dedup BEFORE business logic. webhook_events PK (provider, event_id) is the truth.
  let dedup;
  try {
    dedup = await dedupWebhook("mp", xRequestId, body);
  } catch (e) {
    captureError(e, { route: "/api/webhooks/mercadopago", phase: "dedup" });
    // Cannot dedup — fail closed by returning 200 (avoid MP retry loop) but capture for ops.
    return NextResponse.json({ received: true, error: "dedup_failed" }, { status: 200 });
  }
  if (dedup.duplicate) {
    logger.info("mp_webhook_duplicate_short_circuit", { xRequestId });
    return NextResponse.json({ received: true, duplicate: true }, { status: 200 });
  }

  try {
    if (body.type === "payment" && (body.data as Record<string, unknown>)?.id) {
      await handlePaymentEvent(String((body.data as Record<string, unknown>).id));
    }
    if (body.type === "subscription_preapproval" && (body.data as Record<string, unknown>)?.id) {
      await handleSubscriptionEvent(String((body.data as Record<string, unknown>).id));
    }
    await markWebhookProcessed("mp", xRequestId);
    return NextResponse.json({ received: true }, { status: 200 });
  } catch (error: unknown) {
    captureError(error, { route: "/api/webhooks/mercadopago", xRequestId });
    // Do NOT markWebhookProcessed — the row stays unprocessed for ops reconcile.
    return NextResponse.json({ received: true, error: true }, { status: 200 });
  }
}
```

Also update `validateMpSignature` callers / the `validateWebhookSignature` wrapper to use the `xRequestId` we already trimmed (line 24-39 — the wrapper currently re-reads the header inline; have it accept `xRequestId` as a parameter so we don't read the header twice with different normalization):

```ts
function validateWebhookSignature(
  request: NextRequest,
  dataId: string,
  xRequestId: string,
): boolean {
  const secret = process.env.MERCADOPAGO_WEBHOOK_SECRET;
  if (!secret) {
    logger.error("mp_webhook_secret_missing");
    return false;
  }
  return validateMpSignature({
    secret,
    xSignatureHeader: request.headers.get("x-signature") || "",
    xRequestId,
    dataId,
  });
}
```

And update the call site to pass `xRequestId`.
</action>

<acceptance_criteria>
- Handler reads `x-request-id`, trims, and 400's on empty (no signature check, no dedup, no processing)
- `dedupWebhook("mp", xRequestId, body)` is called AFTER signature validation passes and BEFORE `handlePaymentEvent`/`handleSubscriptionEvent`
- On `dedup.duplicate === true`: handler returns 200 immediately, does NOT call business logic
- On business-logic success: `markWebhookProcessed("mp", xRequestId)` is awaited before returning 200
- On business-logic exception: `captureError` is called and 200 is returned, but `markWebhookProcessed` is NOT called (so ops can see "received but not processed")
- `validateWebhookSignature` accepts `xRequestId` as a parameter; the inline `request.headers.get("x-request-id") || ""` is removed from inside it
- Vitest: a webhook POST with empty `x-request-id` returns 400; a POST with the same `x-request-id` twice returns 200+`duplicate:true` on the second call without invoking `handlePaymentEvent`
</acceptance_criteria>

---

### Task 3: Subscription cancel — write `subscription_status='cancelled'` instead of nulling sub_id (C-4)

<read_first>
- campanha-ia/src/app/api/webhooks/mercadopago/route.ts (lines 280-313 — current handleSubscriptionEvent switch)
- .planning/phases/01-payments-webhook-integrity/01-CONTEXT.md (D-01, D-04)
- campanha-ia/supabase/migrations/20260503_180000_add_subscription_status_enum.sql (column from 01-01)
</read_first>

<action>
Edit `campanha-ia/src/app/api/webhooks/mercadopago/route.ts`, function `handleSubscriptionEvent`. Replace the switch cases for `authorized`, `cancelled`, and add a `default` that warn-logs (L-11). Add the M-18 ownership cross-check before any mutation.

Replace lines 270-313 with:

```ts
const ref = subscription.externalReference || "";
const [storeId, planId] = ref.split("|");

if (!storeId || !planId) {
  logger.warn("mp_subscription_invalid_ref", {
    subscription_id: subscriptionId,
    ref,
  });
  return;
}

// M-18: defense-in-depth — confirm the subscription returned by MP matches the
// subscriptionId we asked about. Signature already covers data.id; this guards
// against a tampered external_reference resource being followed across stores.
if (subscription.id !== subscriptionId) {
  logger.warn("mp_subscription_id_mismatch", {
    requested: subscriptionId,
    returned: subscription.id,
    storeId,
  });
  return;
}

const supabase = createAdminClient();

switch (subscription.status) {
  case "authorized":
    // Assinatura ativada — salvar subscription_id e marcar status active.
    logger.info("mp_subscription_authorized", { storeId, planId, subscriptionId });
    await supabase.from("stores").update({
      mercadopago_subscription_id: subscriptionId,
      subscription_status: "active",
    }).eq("id", storeId);
    break;

  case "paused":
    // Pause é informacional — não muda plano ativo, não muda sub_id.
    logger.info("mp_subscription_paused", { storeId, planId, subscriptionId });
    break;

  case "cancelled":
    // C-4 fix: NÃO nullar mercadopago_subscription_id. Marcar subscription_status='cancelled'.
    // Plano permanece ativo até o fim do period_end (cron/downgrade-expired faz o flip).
    // Mantendo o sub_id permite reconciliação se o usuário re-assina, e elimina o
    // race condition entre cancel + cron + resubscribe descrito em H-7.
    logger.info("mp_subscription_cancelled_pending_period_end", { storeId, planId, subscriptionId });
    await supabase.from("stores").update({
      subscription_status: "cancelled",
    }).eq("id", storeId);
    break;

  default:
    // L-11: pending, expired, failed, etc. — surface at warn so ops sees them.
    logger.warn("mp_subscription_status_unhandled", {
      storeId,
      planId,
      subscriptionId,
      status: subscription.status,
    });
}
```

Note: do NOT remove `mercadopago_subscription_id` from the row when cancelling. The cron in plan 01-05 will use `subscription_status='cancelled' AND period_end < today` as its candidate filter (replacing the current `IS NULL` check).
</action>

<acceptance_criteria>
- The `cancelled` switch arm sets `subscription_status: 'cancelled'` and does NOT touch `mercadopago_subscription_id`
- The `authorized` switch arm sets BOTH `mercadopago_subscription_id` AND `subscription_status: 'active'`
- The `default` switch arm emits `logger.warn(...)` with the status string in metadata
- The M-18 ownership cross-check (`subscription.id !== subscriptionId`) is present and short-circuits with a warn log before any DB write
- The string literal `mercadopago_subscription_id: null` does NOT appear in the cancelled arm
- Vitest: simulating a `subscription_preapproval` cancel event leaves `mercadopago_subscription_id` unchanged on the store row and sets `subscription_status='cancelled'`
- Vitest: simulating a status that isn't `authorized | paused | cancelled` (e.g. `expired`) triggers a `logger.warn` call with `mp_subscription_status_unhandled`
</acceptance_criteria>

---

### Task 4: HTTP-level integration test for the renewal-preserves-sub-id flow (C-2 regression test)

<read_first>
- campanha-ia/src/app/api/webhooks/mercadopago/route.ts (final shape after tasks 1-3)
- campanha-ia/src/lib/mp-signature.test.ts (test setup pattern)
- .planning/PHASE-DETAILS.md §"Phase 2" QUALITY priority #3 (HTTP-level webhook tests are technically Phase 2 scope, but the regression test for C-2 is M1-critical — see ROADMAP success criterion #2)
</read_first>

<action>
Create `campanha-ia/src/app/api/webhooks/mercadopago/route.test.ts` (or add to existing test file if one exists). Mock `getPaymentStatus`, `getSubscriptionStatus`, `updateStorePlan`, `addCreditsToStore`, and the dedup helper. Drive the handler with a synthetic `Request` that has a valid signature (use the test-mode HMAC secret).

Test cases (minimum):

1. **Renewal payment preserves sub_id (C-2 regression):** Pre-set `stores.mercadopago_subscription_id = 'sub_existing'`. Fire a `payment` webhook with `external_reference = 'storeId|planId'`, paid amount matching the plan price. Assert `updateStorePlan` was called WITHOUT a third argument (or with `undefined`). Spy on the supabase update — assert payload does NOT include `mercadopago_subscription_id` key.

2. **Cancel preserves sub_id (C-4 regression):** Fire a `subscription_preapproval` webhook with status=`cancelled`. Assert the supabase `.update({...})` payload contains `subscription_status: 'cancelled'` and does NOT contain a `mercadopago_subscription_id` key.

3. **Replay short-circuits (D-06 regression):** Fire the same webhook twice with the same `x-request-id`. Mock `dedupWebhook` to return `{duplicate: false}` first call, `{duplicate: true}` second call. Assert business logic mocks (`getPaymentStatus`, `getSubscriptionStatus`) are called exactly once total.

4. **Empty x-request-id rejects (H-14):** POST with no `x-request-id` header. Assert response status is 400 and signature validator is NOT called.

5. **Default case warns (L-11):** Fire a `subscription_preapproval` webhook with status=`pending` (or `expired`). Mock `logger.warn` and assert it was called with `mp_subscription_status_unhandled`.
</action>

<acceptance_criteria>
- Test file exists at `campanha-ia/src/app/api/webhooks/mercadopago/route.test.ts` (or equivalent)
- All 5 test cases above are present and pass
- `npx vitest run src/app/api/webhooks/mercadopago/route.test.ts` exits 0
- Test #1 explicitly asserts the SHAPE of the update payload (key not present, not just value=truthy)
- No test hits the real Supabase DB (all `createAdminClient` paths mocked)
</acceptance_criteria>

---

## Verification

1. `npx tsc --noEmit` in `campanha-ia/` passes.
2. `npx vitest run src/lib/webhooks src/app/api/webhooks/mercadopago` exits 0.
3. Static check: `grep -n 'mercadopago_subscription_id: null' campanha-ia/src/app/api/webhooks/mercadopago/route.ts` returns 0 matches.
4. Static check: `grep -n 'mercadopago_subscription_id: mpSubscriptionId || null' campanha-ia/src/lib/db/index.ts` returns 0 matches.
5. Manual smoke: fire a test webhook in staging (or against the dev MP sandbox) and verify `webhook_events` table has 1 row with `processed_at` set after a successful processing.

## must_haves

```yaml
truths:
  - mp_webhook_dedup_via_x_request_id
  - empty_x_request_id_rejected_400
  - renewal_payment_preserves_sub_id
  - cancel_writes_status_not_null_sub_id
  - subscription_event_validates_ownership_pre_mutation
  - unknown_mp_status_warn_logged
acceptance:
  - tsc_noemit_passes
  - vitest_mp_route_tests_pass
  - no_null_sub_id_writes_in_mp_webhook
```
