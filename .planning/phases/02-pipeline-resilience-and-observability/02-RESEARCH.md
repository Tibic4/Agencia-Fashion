# Phase 2: Pipeline Resilience & Observability — Research

**Date:** 2026-05-03
**Mode:** Inline (orchestrator+researcher; gsd-sdk harness gap continued from Phase 1)

## Resolutions for flagged research items (R-01..R-03)

### R-01 — Logger module location and API

**Found:** `campanha-ia/src/lib/observability.ts` (114 lines).

**Public API consumed across the codebase:**

```ts
import { logger, captureError, identifyForSentry, captureSyntheticAlert } from "@/lib/observability";

logger.debug(msg, ctx?);   // suppressed in NODE_ENV=production
logger.info(msg, ctx?);
logger.warn(msg, ctx?);
logger.error(msg, ctx?);

captureError(err, ctx);    // Sentry.captureException + scope.setExtra(k,v) for each ctx field. Never throws.
identifyForSentry(userId, storeId);
captureSyntheticAlert(message, fingerprint, breadcrumbs); // Sentry.captureMessage warning + setFingerprint
```

**Implementation notes:**
- `Ctx = Record<string, unknown>` — flat object, no nesting expected.
- `captureError` writes the context as `scope.setExtra(k, v)` for each key (`observability.ts:43-46`). For D-11 structured tags (`route`, `step`, `model`, `store_id_hash`), use the same `Ctx` argument; setExtra surfaces them as searchable fields in Sentry.
- Logger writes ISO-8601 timestamp + `[level]` prefix + `JSON.stringify(ctx)` to `console.{log,warn,error}`. PM2 captures stdout, so no separate transport is needed.
- **Already imported in 11 routes** (per QUALITY.md inventory). The Phase 2 sweep adds the import at the top of `app/api/campaign/generate/route.ts` and replaces 42 `console.*` with structured `logger.*` calls.

**Decision:** Do NOT create a new logger module. Reuse `@/lib/observability`. The "structured tags" in D-11 are passed as the `Ctx` arg to `captureError` — the existing wrapper already routes them through `scope.setExtra`.

### R-02 — Inngest judge function name + payload shape

**Found:** `campanha-ia/src/lib/inngest/functions.ts:337-449` exports `judgeCampaignJob`.

**Event name (LOCKED, asserted by `judge.test.ts`):** `campaign/judge.requested`
**Function id:** `judge-campaign`
**Retries:** 2

**Event payload shape (`JudgeRequestEvent` interface at `functions.ts:315-326`):**

```ts
interface JudgeRequestEvent {
  campaignId: string;
  storeId: string;
  copyText: string;          // SonnetDicasPostagem.caption_sugerida (or stringified JSON)
  productImageUrl: string;
  modelImageUrl: string;
  generatedImageUrl: string;
  prompt_version: string;    // SHA from sonnet-copywriter prompt
}
```

**Producer site:** `campanha-ia/src/lib/ai/pipeline.ts:345-374` — `inngest.send({ name: "campaign/judge.requested", data: {...} }).catch(...)`. The producer currently swallows failures, which is the H-13 root cause.

**Inngest client:** `campanha-ia/src/lib/inngest/client.ts:11-14` — `new Inngest({ id: "crialook", eventKey: process.env.INNGEST_EVENT_KEY })`. Importing `inngest` from `./client` and calling `inngest.send({...})` is the canonical re-emit path.

**Re-emit pattern for the reconcile cron (D-17):**

```ts
import { inngest } from "@/lib/inngest/client";

await inngest.send({
  name: "campaign/judge.requested",
  data: {
    campaignId: row.id,
    storeId: row.store_id,
    copyText: row.judge_copy_text || "",     // persisted on judge_pending=true write
    productImageUrl: row.product_image_url,
    modelImageUrl: row.model_image_url,
    generatedImageUrl: row.generated_image_url,
    prompt_version: row.judge_prompt_version || "",
  },
});
```

**Open question:** the producer at `pipeline.ts:345-374` passes `copyText`, `prompt_version`, etc. that are NOT currently persisted on the campaign row. The reconcile cron needs them later. **Resolution in Plan 02-05:** the migration adds `judge_payload JSONB NULL` column to `campaigns` so the producer can stash the full event payload at emit time, and the cron simply re-sends `judge_payload` as `data`. This avoids re-deriving fields from joins.

### R-03 — `add_credits_atomic` RPC verification

**Status: PRE-EXISTING — not added by Phase 1.**

**Evidence:**
- `campanha-ia/supabase/migrations/20260419_add_credits_atomic_rpc.sql` — original migration (pre-M1).
- `campanha-ia/supabase/migrations/20260424_harden_rpcs_and_constraints.sql:6-34` — Phase-pre-M1 hardening (column allowlist, qty 1-10000, REVOKE PUBLIC, GRANT service_role only).
- Already used in 3 production sites: `campanha-ia/src/lib/db/index.ts` (`addCreditsToStore`), `campanha-ia/src/app/api/campaign/generate/route.ts` (the very file P2 will modify), and `campanha-ia/src/lib/db/credits.test.ts` (covered by Phase 1's 7 vitest cases).

**Phase 1 commits inspected:** none of the 21 commits in `01-VERIFICATION.md` touch `add_credits_atomic` migration. Phase 1 added `webhook_events` (`20260503_180300_create_webhook_events.sql`) and `subscription_status` ENUM, not the credits RPC.

**RPC signature (from baseline + harden migrations):**

```sql
add_credits_atomic(p_store_id uuid, p_column text, p_quantity integer) returns integer
```

- `p_column` — must be one of `credit_campaigns | credit_models | credit_regenerations` (allowlist enforced inside RPC)
- `p_quantity` — clamped 1..10000
- Returns the new credit balance for the column

**Refund path call shape for D-03 (Plan 02-03):**

```ts
const { error } = await supabase.rpc("add_credits_atomic", {
  p_store_id: store.id,
  p_column: "credit_campaigns",
  p_quantity: 1,  // refund 1 avulso credit
});
if (error) {
  captureError(new Error(`refund failed: ${error.message}`), { route: "campaign.generate", step: "refund", store_id: hashStoreId(store.id) });
  // NB: do NOT throw — refund failure is logged but the SSE error response continues
}
```

This replaces the manual SELECT-then-UPDATE at `route.ts:798-808` (the H-11 cousin of the P1-fixed credit fallbacks).

## Phase 1 deliveries that Phase 2 inherits

Confirmed from `01-VERIFICATION.md`:

- **`webhook_events` table** (Plan 01-01) — Plan 02-05's HTTP-level webhook tests (`webhooks/mercadopago`, `billing/verify`, `billing/rtdn`) will exercise dedup. Test fixtures must mock the table or run against a clean test DB.
- **`add_credits_atomic` RPC** (PRE-EXISTING, used by P1) — Plan 02-03 refund path uses it.
- **`failCampaign` single-shot** (Plan 01-05, commit `132853b`) — Plan 02-03 callers don't need to add status guards; the function already enforces single-shot at the DB layer. P2 just re-uses the existing helper.
- **Demo mode skips quota** (Plan 01-05, commit `479e3be`) — M-11 from `02-CONTEXT` is a NO-OP for Phase 2 (already done). Plan 02-03 verification only needs to confirm the existing fix wasn't regressed.
- **Stripped read-modify-write fallbacks** (Plan 01-05, commits `14ac774`/`d6750c6`) — `incrementCampaignsUsed`, `consumeCredit`, `addCreditsToStore` no longer have race fallbacks. Plan 02-03 doesn't need to revisit them; the refund path at `route.ts:798-808` is the LAST manual read-modify-write in the route.

## Findings already addressed by Phase 1 — DO NOT DUPLICATE in Phase 2

| Finding | Status | Phase 1 commit |
|---|---|---|
| H-10 (failCampaign single-shot) | DONE | `132853b` |
| M-11 (demo mode skip) | DONE | `479e3be` |
| H-11 (read-modify-write fallback in incrementCampaignsUsed) | DONE | `14ac774` |
| H-6 (addCreditsToStore RPC fallback) | DONE | `14ac774` |

Phase 2's `02-CONTEXT.md` lists H-10 and M-11 in scope but flags them as Phase-1 cross-cuts. Plan 02-03 verification step asserts the existing fixes are still in place; no new code touches these sites.

## Critical findings discovered during research (not in CONTEXT.md but in scope of P2 findings list)

- **H-9 IDOR fallback** (`lib/db/index.ts:339-356`): the `incrementRegenCount` fallback path SELECTs `campaigns` by `id` only (line 346-350 — no `store_id` filter on SELECT). The UPDATE adds `.eq("store_id", storeId)` IF storeId is passed (line 353), but the SELECT leaks. Per CONTEXT.md scope-in: "Force `storeId` filter on `incrementRegenCount` SELECT path (close IDOR even though feature flag is off)" — Plan 02-02 owns this.

- **Refund branch line range** drift: CONTEXT references `route.ts:805-812`. Actual current location after P1 changes: `route.ts:798-808`. Same code, different line numbers (P1's edits to the route shifted offsets).

- **42 console.* count** is exact (verified by grep). After P1's M-11 fix (`479e3be`) which removed 10 lines from the route, the count remains 42 — the demo-mode console.log was preserved per the commit diff context.

- **api_cost_logs schema** has a `metadata JSONB` column (`20260503_120000_add_api_cost_logs_metadata.sql`). Plan 02-03's `upload_failed` and `client_disconnected` flags can ride inside `metadata` rather than requiring new columns. **Decision:** use `metadata.upload_failed = true` and `metadata.client_disconnected = true` — no migration needed for these flags. Avoids touching the schema for observability-only fields.

## Open coordination notes

- **Sentry hash helper:** D-11 requires `store_id` to be hashed (8-char sha256 prefix). Not yet present in observability.ts. Plan 02-04 adds a small `hashStoreId(uuid: string): string` utility next to `identifyForSentry` (or in `lib/utils/`).
- **`sideEffect` helper location:** CONTEXT D-15 says planner's discretion. Since `dryRun` is a pipeline-only concept, Plan 02-02 colocates `sideEffect` in `lib/ai/side-effect.ts` (next to pipeline) rather than `lib/utils/`.
- **Migration file naming:** follow Phase 1 convention `YYYYMMDD_HHMMSS_<description>.sql`. Use `20260503_190000_*` and onward for Phase 2 to ensure ordering after Phase 1's `20260503_180300_*` migrations.
- **Cron route pattern:** existing routes at `app/api/cron/{downgrade-expired,exchange-rate}/route.ts`. Plan 02-05's reconcile cron lives at `app/api/cron/judge-reconcile/route.ts` and follows the same shape (POST handler, `Authorization: Bearer ${CRON_SECRET}` check).

---

*Research complete. Ready for plan-write.*
