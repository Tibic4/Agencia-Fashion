---
plan_id: 01-04
phase: 1
title: Clerk webhook + Google Play billing — store init via createStore, plan_id fix on RTDN/restore
wave: 2
depends_on: [01-01, 01-02]
files_modified:
  - campanha-ia/src/app/api/webhooks/clerk/route.ts
  - campanha-ia/src/app/api/billing/restore/route.ts
  - campanha-ia/src/app/api/billing/rtdn/route.ts
  - campanha-ia/src/lib/db/index.ts
  - campanha-ia/src/lib/payments/sku-plan-mapping.ts
autonomous: true
requirements: [C-1, C-3]
must_haves:
  truths:
    - "Clerk user.created webhook produces a stores row with non-null plan_id AND a matching store_usage row in one logical transaction"
    - "Google Play /api/billing/restore writes plan via updateStorePlan(storeId, planSlug), NOT a non-existent stores.plan column"
    - "Google Play /api/billing/rtdn writes plan via updateStorePlan(storeId, planSlug), NOT a non-existent stores.plan column"
    - "Both Play paths include dedupWebhook to short-circuit replays"
  acceptance:
    - "After firing a synthetic Clerk user.created webhook, SELECT plan_id FROM stores returns non-null AND a store_usage row exists with the same store_id"
    - "After firing a synthetic RTDN notificationType=12 (REVOKED), the store's plan_id changes to the free plan's id (NOT the literal string 'free')"
---

# Plan 01-04: Clerk Webhook + Google Play Billing Path Fixes

## Objective

Close the three Critical findings outside the MP webhook:

1. **C-1** — Replace `supabase.from("stores").update({ plan: ... })` (writes to a non-existent column, silent no-op) with `updateStorePlan(storeId, planSlug)` in `/api/billing/restore` and `/api/billing/rtdn`.
2. **C-3** — Stop the Clerk webhook from inserting a bare `stores` row without `plan_id`/`store_usage`. Route through `createStore` (with a small `onboarding_completed` flag addition).
3. Integrate `dedupWebhook` (from 01-02) for both Clerk (`svix-id`) and Google Play RTDN (Pub/Sub `messageId`).

This plan does NOT touch the MP webhook (that's 01-03) and does NOT touch the cron / DB atomicity layer (that's 01-05).

## Truths the executor must respect

- The Play billing path uses Google Pub/Sub Bearer-JWT verification (already in place per `lib/payments/google-pubsub-auth.ts`). The Pub/Sub message envelope provides a unique `messageId` — use that as the dedup `event_id`. NOT `purchaseToken` (which can repeat across notification types for the same subscription lifecycle).
- The free plan in this codebase is named `"gratis"` (per backfill in 01-01 and per `getStorePlanName` default). When RTDN signals revoke/expire, the correct slug is `"gratis"` — NOT `"free"` (the current `route.ts:232` literal `"free"` is part of the C-1 bug).
- `planFromSku()` is referenced in `route.ts:238` of the RTDN path. If it doesn't already return canonical plan names that match the `plans.name` rows, this plan must add a `skuToPlanSlug` helper that maps Play SKU → DB slug.
- The Clerk webhook's idempotency check (`existing` row in `webhooks/clerk/route.ts:76-85`) STAYS — it's per-user, complementary to the per-event dedup.
- `createStore` already inserts `store_usage` (lines 80-86 of `lib/db/index.ts`). Adding a `placeholder` mode requires only an optional `onboarding_completed` flag — do NOT duplicate the function.

## Tasks

### Task 1: Extend `createStore` to support placeholder mode (C-3 prerequisite)

<read_first>
- campanha-ia/src/lib/db/index.ts (lines 18-89 — `CreateStoreInput` and `createStore` definition)
- campanha-ia/src/app/api/webhooks/clerk/route.ts (lines 88-97 — current bare-insert that we're replacing)
- .planning/phases/01-payments-webhook-integrity/01-RESEARCH.md (R-08)
</read_first>

<action>
Edit `campanha-ia/src/lib/db/index.ts`:

1. Add an optional `onboardingCompleted?: boolean` field to `CreateStoreInput` (default true to preserve current callers' behavior).
2. In the `.insert({...})` payload (line 59-69), replace the hard-coded `onboarding_completed: true` with `onboarding_completed: input.onboardingCompleted ?? true`.

Concrete diff:

```ts
export interface CreateStoreInput {
  clerkUserId: string;
  name: string;
  segmentPrimary: string;
  city?: string;
  state?: string;
  instagramHandle?: string;
  brandColor?: string;
  /** Phase 1 / C-3: when called from the Clerk user.created webhook, the user
   * has not completed the onboarding form yet. Default true preserves
   * backward-compat for the onboarding-completion call site. */
  onboardingCompleted?: boolean;
}

// Inside createStore, in the .insert payload:
//   onboarding_completed: input.onboardingCompleted ?? true,
```

Do NOT change the period_start/period_end calendar-month math here (that's the `addCreditsToStore` reconciliation in 01-05; `createStore` already aligns with what `getOrCreateCurrentUsage` self-heals to).
</action>

<acceptance_criteria>
- `CreateStoreInput` includes `onboardingCompleted?: boolean`
- `createStore` insert payload uses `input.onboardingCompleted ?? true` (no longer hard-coded `true`)
- Existing call site at `app/api/store/onboarding/route.ts` (the only current `createStore` caller) does NOT need changes — it relies on the default `true`
- TypeScript compile passes
</acceptance_criteria>

---

### Task 2: Clerk webhook routes through `createStore` with placeholder defaults (C-3)

<read_first>
- campanha-ia/src/app/api/webhooks/clerk/route.ts (full file)
- campanha-ia/src/lib/db/index.ts (createStore signature after Task 1)
- campanha-ia/src/lib/webhooks/dedup.ts (from 01-02)
</read_first>

<action>
Edit `campanha-ia/src/app/api/webhooks/clerk/route.ts`. Replace the bare insert (lines 87-97) with a `createStore` call that uses the placeholder defaults. Add `dedupWebhook("clerk", svixId, body)` AFTER signature validation, BEFORE the existing `existing` check.

The handler shape becomes:

```ts
import { createStore, getStoreByClerkId } from "@/lib/db";
import { dedupWebhook, markWebhookProcessed } from "@/lib/webhooks/dedup";

export async function POST(req: NextRequest) {
  try {
    const payload = await req.text();

    const svixId = req.headers.get("svix-id");
    const svixTimestamp = req.headers.get("svix-timestamp");
    const svixSignature = req.headers.get("svix-signature");

    if (!verifyClerkSignature(payload, svixId, svixTimestamp, svixSignature)) {
      logger.warn("clerk_webhook_invalid_signature", { svixId });
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }
    // svixId is non-null here because verifyClerkSignature would have rejected null.
    const eventId = svixId as string;

    const event = JSON.parse(payload) as { type: string; data: Record<string, unknown> };

    // D-06: dedup BEFORE business logic.
    const dedup = await dedupWebhook("clerk", eventId, event);
    if (dedup.duplicate) {
      logger.info("clerk_webhook_duplicate_short_circuit", { svixId });
      return NextResponse.json({ received: true, duplicate: true });
    }

    // Só processa user.created — outros eventos ignorados (200 OK para não retry).
    if (event.type !== "user.created") {
      await markWebhookProcessed("clerk", eventId);
      return NextResponse.json({ received: true, ignored: true });
    }

    const userId = event.data?.id as string | undefined;
    if (!userId) {
      return NextResponse.json({ error: "Missing user id" }, { status: 400 });
    }

    // Per-user idempotency (complementary to per-event dedup above).
    const existing = await getStoreByClerkId(userId);
    if (existing) {
      logger.info("clerk_user_created_store_exists", { user_id: userId });
      await markWebhookProcessed("clerk", eventId);
      return NextResponse.json({ received: true, existed: true });
    }

    const emailAddresses = (event.data?.email_addresses as Array<{ email_address: string }>) || [];
    const primaryEmail = emailAddresses[0]?.email_address || null;
    const placeholderName = primaryEmail ? primaryEmail.split("@")[0] : "Minha Loja";

    // C-3 fix: route through createStore so plan_id (free) and store_usage row
    // are populated atomically. Placeholder mode = onboarding not yet completed.
    const store = await createStore({
      clerkUserId: userId,
      name: placeholderName,
      segmentPrimary: "outro",
      onboardingCompleted: false,
    });

    logger.info("clerk_user_created_store_created", { user_id: userId, store_id: store.id });
    await markWebhookProcessed("clerk", eventId);
    return NextResponse.json({ received: true, created: true });
  } catch (e) {
    captureError(e, { route: "/api/webhooks/clerk" });
    return NextResponse.json({ received: true, error: true }, { status: 200 });
  }
}
```

Notes:
- The existing `createAdminClient()` call inside the handler (line 73) is no longer needed — `createStore` and `getStoreByClerkId` get their own admin client. Remove the `import { createAdminClient }` if no other reference remains.
- `getStoreByClerkId` returns `null` when no row exists — its existing `.single()` may throw on no-rows. If that's the current behaviour, replace it with `.maybeSingle()` in `lib/db/index.ts` lines 92-99. Verify; do NOT silently broaden the change.
</action>

<acceptance_criteria>
- Handler imports `createStore` and `getStoreByClerkId` from `@/lib/db` (or just `createStore` if `getStoreByClerkId` already exists and works for the existence check)
- Handler imports `dedupWebhook`, `markWebhookProcessed` from `@/lib/webhooks/dedup`
- The bare `supabase.from("stores").insert({ ... segment_primary: "outro", onboarding_completed: false ... })` is gone — replaced with a `createStore({ ... onboardingCompleted: false })` call
- `dedupWebhook("clerk", svixId, event)` is called AFTER signature validation, BEFORE the `existing` check
- On success path: `markWebhookProcessed("clerk", svixId)` is awaited before the 200 response
- Vitest: simulate a `user.created` event → assert `createStore` was called with `onboardingCompleted: false` and that the resulting store row has non-null `plan_id` (mock the supabase chain to return a store with `plan_id: 'free-uuid'`)
- Vitest: simulate the same event twice → second call short-circuits via dedup, `createStore` is invoked exactly once total
</acceptance_criteria>

---

### Task 3: Build SKU → plan slug mapping helper (prereq for C-1 fix)

<read_first>
- campanha-ia/src/app/api/billing/rtdn/route.ts (lines 200-240 — current `planFromSku` usage)
- campanha-ia/src/app/api/billing/verify/route.ts (any planFromSku reference)
- campanha-ia/src/lib/payments/ (browse the directory — find the existing planFromSku definition)
- campanha-ia/src/lib/plans.ts (PLANS object — confirm canonical plan names like "gratis", "pro", etc.)
</read_first>

<action>
Locate the existing `planFromSku()` function (likely in `lib/payments/sku-plan-mapping.ts` or similar — find it via `grep -rn "planFromSku" campanha-ia/src`). Verify it returns canonical `plans.name` slugs that exist in the DB.

If `planFromSku()`:
- Returns valid DB plan slugs (e.g., `"pro"`, `"plus"`) — KEEP IT, no changes here.
- Returns the literal string `"free"` for revoke/expire cases — change it to return `"gratis"` (the actual DB slug per baseline `plans` table). This is the "1-line fix to align with backfill in 01-01."
- Returns SKU-shaped strings like `"crialook_pro_monthly"` — add a `skuToPlanSlug(sku: string): string` mapper that translates to canonical DB slugs.

If `planFromSku` does not exist as a function (only as a string in the `route.ts` code), create `campanha-ia/src/lib/payments/sku-plan-mapping.ts` with:

```ts
/**
 * Phase 1 / C-1: canonical mapping from Play Store SKU IDs to internal
 * plans.name slugs. Used by /api/billing/rtdn and /api/billing/restore so
 * updateStorePlan(storeId, slug) gets a slug that exists in the plans table.
 *
 * Free plan slug is "gratis" (per baseline schema), NOT "free".
 */

export const FREE_PLAN_SLUG = "gratis";

export function skuToPlanSlug(sku: string | null | undefined): string {
  if (!sku) return FREE_PLAN_SLUG;
  // Map Play SKU → DB plan slug. Extend this table as new SKUs ship.
  const map: Record<string, string> = {
    crialook_pro_monthly: "pro",
    crialook_plus_monthly: "plus",
    // Add new SKUs here.
  };
  return map[sku] ?? FREE_PLAN_SLUG;
}
```

The exact content of the map depends on what SKUs the project ships. Inspect `app/api/billing/verify/route.ts` and `crialook-app/lib/billing.ts` (mobile side) to enumerate. If unclear, mark the task as `needs-research` and document the discovered SKUs in the plan output.
</action>

<acceptance_criteria>
- Either `planFromSku` is verified to already return canonical DB slugs (in which case task is no-op + a comment explaining), or `skuToPlanSlug` is created and exported from `lib/payments/sku-plan-mapping.ts`
- The constant `FREE_PLAN_SLUG = "gratis"` is exported (so route handlers don't hardcode the slug)
- `tsc --noEmit` passes
- A unit test in `lib/payments/sku-plan-mapping.test.ts` asserts: `skuToPlanSlug(null)` and `skuToPlanSlug("unknown_sku")` both return `"gratis"`; `skuToPlanSlug("crialook_pro_monthly")` returns `"pro"` (or whatever the project's canonical Pro slug is)
- If the SKU list is unclear, plan output flags `needs-research` with the question "What is the full list of Play Store SKUs the app ships?"
</acceptance_criteria>

---

### Task 4: Fix `/api/billing/restore` to use `updateStorePlan` (C-1)

<read_first>
- campanha-ia/src/app/api/billing/restore/route.ts (lines 100-150)
- campanha-ia/src/lib/db/index.ts (updateStorePlan signature after 01-03 task 1)
- campanha-ia/src/lib/payments/sku-plan-mapping.ts (from task 3 above) — for FREE_PLAN_SLUG and skuToPlanSlug
</read_first>

<action>
Edit `campanha-ia/src/app/api/billing/restore/route.ts`. Find the block at lines 127-132:

```ts
if (lastValidPlan) {
  await supabase
    .from("stores")
    .update({ plan: lastValidPlan })  // ← C-1 BUG: column "plan" does not exist
    .eq("clerk_user_id", userId);
}
```

Replace with:

```ts
import { skuToPlanSlug } from "@/lib/payments/sku-plan-mapping";
import { updateStorePlan, getStoreByClerkId } from "@/lib/db";

// ... inside the handler, after lastValidPlan is determined:

if (lastValidPlan) {
  const store = await getStoreByClerkId(userId);
  if (!store) {
    captureError(new Error("restore: store not found for clerk user"), {
      route: "POST /api/billing/restore",
      user_id: userId,
    });
  } else {
    const slug = skuToPlanSlug(lastValidPlan);
    // C-1 fix: route through updateStorePlan so plan_id (FK) is updated, not the
    // non-existent "plan" text column. Pass null for mpSubscriptionId since
    // restore is a Play-side recovery, not an MP subscription rebind.
    await updateStorePlan(store.id, slug, null);
  }
}
```

Note: passing `null` (not `undefined`) for `mpSubscriptionId` is correct here — restoring a Play subscription means the user does NOT have an active MP subscription on this store; clear the field. Cross-check with the project owner if Play and MP are mutually exclusive plan paths (likely yes — see `lib/payments/google-pubsub-auth.ts` posture).
</action>

<acceptance_criteria>
- `restore/route.ts` no longer contains `.update({ plan:` (the bug pattern)
- `restore/route.ts` calls `updateStorePlan(store.id, skuToPlanSlug(lastValidPlan), null)`
- `restore/route.ts` handles "store not found for this clerk_user_id" via `captureError` + skip (does NOT throw and does NOT silently no-op without logging)
- `tsc --noEmit` passes
- Vitest: simulate restore with `lastValidPlan = "crialook_pro_monthly"` → assert `updateStorePlan` was called with `(<store.id>, "pro", null)`
</acceptance_criteria>

---

### Task 5: Fix `/api/billing/rtdn` to use `updateStorePlan` + integrate dedupWebhook (C-1)

<read_first>
- campanha-ia/src/app/api/billing/rtdn/route.ts (full file — esp. lines 220-250 for the C-1 bug, and lines 110-160 for envelope parsing where messageId lives)
- campanha-ia/src/lib/payments/sku-plan-mapping.ts (FREE_PLAN_SLUG, skuToPlanSlug)
- campanha-ia/src/lib/webhooks/dedup.ts
</read_first>

<action>
Edit `campanha-ia/src/app/api/billing/rtdn/route.ts`:

**Part A — C-1 fix.** Find lines 228-240:

```ts
if (REVOKING_NOTIFICATIONS.has(sn.notificationType)) {
  await supabase
    .from("stores")
    .update({ plan: "free" })  // ← C-1 BUG #1: non-existent column AND wrong slug
    .eq("clerk_user_id", userId);
} else if ([1, 2, 4, 7].includes(sn.notificationType)) {
  await supabase
    .from("stores")
    .update({ plan: planFromSku(sku) })  // ← C-1 BUG #2: non-existent column
    .eq("clerk_user_id", userId);
}
```

Replace with:

```ts
import { skuToPlanSlug, FREE_PLAN_SLUG } from "@/lib/payments/sku-plan-mapping";
import { updateStorePlan, getStoreByClerkId } from "@/lib/db";

// ... inside handler, after auth check:
const store = await getStoreByClerkId(userId);
if (!store) {
  captureError(new Error("rtdn: store not found for clerk user"), {
    route: "POST /api/billing/rtdn",
    user_id: userId,
    notification_type: sn.notificationType,
  });
  return NextResponse.json({ error: "store_not_found" }, { status: 404 });
}

if (REVOKING_NOTIFICATIONS.has(sn.notificationType)) {
  // C-1 fix: route through updateStorePlan with the canonical free-plan slug.
  await updateStorePlan(store.id, FREE_PLAN_SLUG, null);
} else if ([1, 2, 4, 7].includes(sn.notificationType)) {
  // Recovered/Renewed/Purchased/Restarted: ensure plan_id matches SKU
  await updateStorePlan(store.id, skuToPlanSlug(sku), null);
}
```

**Part B — dedup integration.** At the top of the handler, after Pub/Sub JWT validation succeeds, extract the Pub/Sub `messageId` from the envelope and call `dedupWebhook("rtdn", messageId, body)`. Short-circuit on duplicate.

```ts
import { dedupWebhook, markWebhookProcessed } from "@/lib/webhooks/dedup";

// After JWT/audience validation passes and you have the parsed envelope:
const messageId = (envelope.message?.messageId as string | undefined)?.trim();
if (!messageId) {
  logger.warn("rtdn_webhook_missing_message_id");
  return NextResponse.json({ error: "missing messageId" }, { status: 400 });
}

const dedup = await dedupWebhook("rtdn", messageId, envelope);
if (dedup.duplicate) {
  logger.info("rtdn_webhook_duplicate_short_circuit", { messageId });
  return NextResponse.json({ received: true, duplicate: true }, { status: 200 });
}

// ... existing processing logic ...

await markWebhookProcessed("rtdn", messageId);
return NextResponse.json({ ok: true, state });
```

Note: RTDN currently returns 5xx on transient errors so Pub/Sub retries (per the existing comment "5xx faz Pub/Sub re-tentar"). Keep that behavior — only the dedup short-circuit and the `updateStorePlan` switch change.
</action>

<acceptance_criteria>
- `rtdn/route.ts` no longer contains `.update({ plan: "free" })` or `.update({ plan: planFromSku(`
- `rtdn/route.ts` calls `updateStorePlan(store.id, FREE_PLAN_SLUG, null)` for revoke/expire types
- `rtdn/route.ts` calls `updateStorePlan(store.id, skuToPlanSlug(sku), null)` for recover/renew/purchase/restart types
- `rtdn/route.ts` reads `envelope.message.messageId` and 400's on empty/missing
- `rtdn/route.ts` calls `dedupWebhook("rtdn", messageId, envelope)` after JWT validation, before `updateStorePlan`
- `markWebhookProcessed("rtdn", messageId)` is awaited on the success branch
- Vitest: a synthetic RTDN with `notificationType=12` and a mocked supabase chain results in `updateStorePlan` being called with `("rtdn-store-id", "gratis", null)`
- Vitest: the same RTDN message replayed (same messageId) short-circuits via dedup; `updateStorePlan` is invoked exactly once total
- Static check: `grep -n "stores.update.*plan:" campanha-ia/src/app/api/billing/` returns 0 matches
</acceptance_criteria>

---

## Verification

1. `npx tsc --noEmit` in `campanha-ia/` passes.
2. `npx vitest run src/app/api/webhooks/clerk src/app/api/billing src/lib/payments` exits 0.
3. Static check: `grep -rn 'stores.*\.update.*{\s*plan:' campanha-ia/src/` returns 0 matches.
4. Static check: every modified handler imports from `@/lib/webhooks/dedup` (3 files: clerk webhook, rtdn route, restore is dedup-optional since restore is user-initiated, not an event stream).
5. Manual smoke (post-deploy): create a fresh Clerk user → query `stores` and `store_usage` → assert both rows exist with non-null `plan_id`.

## must_haves

```yaml
truths:
  - clerk_webhook_uses_createstore
  - createstore_supports_onboarding_completed_flag
  - sku_to_plan_slug_helper_returns_canonical_db_slugs
  - free_plan_slug_constant_is_gratis_not_free
  - billing_restore_calls_updatestoreplan
  - billing_rtdn_calls_updatestoreplan_for_both_branches
  - rtdn_dedups_via_pubsub_messageid
acceptance:
  - tsc_noemit_passes
  - vitest_clerk_billing_tests_pass
  - no_bare_plan_column_writes_in_billing_paths
  - new_clerk_user_lands_with_plan_id_and_store_usage
```
