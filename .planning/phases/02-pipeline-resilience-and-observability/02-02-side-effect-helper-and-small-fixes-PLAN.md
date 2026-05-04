---
plan_id: 02-02
phase: 2
title: sideEffect dryRun helper + IDOR SELECT fix + 1×1 fallback teaser skip + hashStoreId util (M-15, H-9, H-12)
wave: 1
depends_on: []
files_modified:
  - campanha-ia/src/lib/ai/side-effect.ts (new)
  - campanha-ia/src/lib/ai/side-effect.test.ts (new)
  - campanha-ia/src/lib/observability.ts (add hashStoreId helper)
  - campanha-ia/src/lib/observability.test.ts (extend)
  - campanha-ia/src/lib/db/index.ts (incrementRegenCount fallback SELECT — H-9)
  - campanha-ia/src/app/api/campaign/generate/route.ts (1×1 teaser skip — H-12)
autonomous: true
requirements: [M-15, H-9, H-12]
must_haves:
  truths:
    - "sideEffect(input, fn) helper lives at lib/ai/side-effect.ts. Signature: async function sideEffect<T>({ dryRun?: boolean }, fn: () => Promise<T>): Promise<T | null>. Returns null and skips fn() under dryRun (M-15)"
    - "incrementRegenCount fallback SELECT path adds .eq('store_id', storeId) when storeId is provided (H-9). The legacy single-arg overload remains untouched — that's a separate Phase 4 deprecation"
    - "Teaser branch skips entirely when modelImageBase64 is the 1×1 fallback. Detection via a boolean flag set at the fallback site, NOT by re-reading the buffer (H-12)"
    - "hashStoreId(uuid: string): string returns the first 8 chars of sha256(uuid) as hex — used by D-11 Sentry tags. Pure function, exported from lib/observability.ts"
  acceptance:
    - "sideEffect helper has unit tests covering: dryRun=true → fn not called, dryRun=false → fn called and result returned, fn throws → throw propagates (no swallowing)"
    - "hashStoreId test asserts deterministic output for known input + length 8"
    - "Static check: grep -n 'campaigns.*regen_count' campanha-ia/src/lib/db/index.ts shows the SELECT now includes .eq('store_id', storeId)"
    - "Manual trace of generate/route.ts confirms a `usingFallbackModel` boolean is set true where the 1×1 PNG is assigned, and the teaser branch checks `!usingFallbackModel` before running"
    - "vitest run lib/ai lib/observability lib/db passes (additions don't break existing 184-pass baseline)"
---

# Plan 02-02: dryRun sideEffect helper, IDOR fix, teaser skip, hash util

## Objective

Knock out four small but compounding issues that the bigger plans depend on:

- **M-15** — Centralize `dryRun` gating via a `sideEffect(input, fn)` helper. Reduces drift surface across pipeline + gemini-vto-generator.
- **H-9** — Close the IDOR window in `incrementRegenCount` fallback SELECT (FEATURE_REGENERATE_CAMPAIGN is off, but the fix is cheap).
- **H-12** — Skip the trial teaser entirely when `modelImageBase64` is the 1×1 fallback (Sharp errors swallowed today).
- **D-11 prereq** — Add `hashStoreId` helper to `observability.ts` so Plan 02-03 / 02-04 can tag Sentry events with `store_id=<sha256:8>` instead of raw UUIDs (PII safety).

## Truths the executor must respect

- `sideEffect` is a THIN helper. No retry, no logging, no Sentry. Just `if (input.dryRun) return null; return await fn();`. Pipeline already has 5+ manual `if (!input.dryRun)` gates — the helper consolidates them.
- The migration to use `sideEffect` is OUT of this plan's scope (existing manual gates stay). This plan only ADDS the helper + tests so Plan 02-03 (pipeline resilience refactor) can adopt it inline.
- `hashStoreId` uses Node's built-in `crypto.createHash('sha256').update(uuid).digest('hex').slice(0, 8)`. No new deps.
- For H-9: only modify the fallback SELECT (line 346-350). Do NOT touch the legacy single-arg RPC overload — that's Phase 4 scope ("Drop legacy single-arg `increment_regen_count(uuid)` overload" per PHASE-DETAILS).
- For H-12: the 1×1 fallback PNG is assigned around `route.ts:476-480` (per CONTEXT code_context). Set a flag `let usingFallbackModel = false;` near that site, flip to `true` in the fallback branch, and check it at the teaser branch entry (around `route.ts:681-741`).

## Tasks

### Task 1: sideEffect helper (M-15)

<read_first>
- campanha-ia/src/lib/ai/pipeline.ts:189, 233, 316, 345 (existing dryRun gates — don't modify, just understand the call shape)
- campanha-ia/src/lib/ai/gemini-vto-generator.ts:69, 453 (more existing gates)
- .planning/audits/MONOREPO-BUG-BASH.md M-15 (rationale)
- .planning/phases/02-pipeline-resilience-and-observability/02-CONTEXT.md (Claude's Discretion: "sideEffect helper lives in lib/utils/ or co-located with pipeline code" — RESEARCH chose lib/ai/)
</read_first>

<action>
Create file `campanha-ia/src/lib/ai/side-effect.ts`:

```ts
/**
 * Phase 02 M-15: Centralized dryRun gating for pipeline side effects.
 *
 * Pipeline code (pipeline.ts + gemini-vto-generator.ts) currently has 5+
 * `if (!input.dryRun) { ... }` gates around DB writes and cost logs. A new
 * fire-and-forget side effect added later can easily skip the gate and leak
 * under dryRun, breaking evals/run.ts which uses dryRun=true to drive the
 * pipeline against golden-set entries.
 *
 * This helper consolidates the gate. Callers wrap any side-effecting block:
 *
 *   await sideEffect(input, async () => {
 *     await supabase.from("api_cost_logs").insert({ ... });
 *   });
 *
 * Under dryRun, returns null and skips fn() entirely. Otherwise, awaits and
 * returns fn()'s value.
 *
 * Intentionally minimal — no retry, no logging, no Sentry. Those concerns
 * are owned by the helpers being wrapped (logModelCost, captureError, etc.).
 *
 * Migration to use this helper is gradual — Plan 02-03 adopts it inside the
 * pipeline-resilience refactor; existing manual gates are not rewritten in
 * a single sweep (low value, high diff churn).
 */

export interface DryRunFlag {
  dryRun?: boolean;
}

export async function sideEffect<T>(
  input: DryRunFlag,
  fn: () => Promise<T>,
): Promise<T | null> {
  if (input.dryRun) return null;
  return await fn();
}
```

Then create `campanha-ia/src/lib/ai/side-effect.test.ts`:

```ts
import { describe, it, expect, vi } from "vitest";
import { sideEffect } from "./side-effect";

describe("sideEffect", () => {
  it("does NOT call fn when dryRun is true", async () => {
    const fn = vi.fn(async () => "ran");
    const result = await sideEffect({ dryRun: true }, fn);
    expect(fn).not.toHaveBeenCalled();
    expect(result).toBeNull();
  });

  it("calls fn and returns its value when dryRun is false", async () => {
    const fn = vi.fn(async () => "ran");
    const result = await sideEffect({ dryRun: false }, fn);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(result).toBe("ran");
  });

  it("calls fn and returns its value when dryRun is undefined", async () => {
    const fn = vi.fn(async () => 42);
    const result = await sideEffect({}, fn);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(result).toBe(42);
  });

  it("propagates fn errors (does not swallow)", async () => {
    const fn = vi.fn(async () => {
      throw new Error("boom");
    });
    await expect(sideEffect({ dryRun: false }, fn)).rejects.toThrow("boom");
  });

  it("does NOT propagate errors when dryRun is true (fn never runs)", async () => {
    const fn = vi.fn(async () => {
      throw new Error("boom");
    });
    await expect(sideEffect({ dryRun: true }, fn)).resolves.toBeNull();
    expect(fn).not.toHaveBeenCalled();
  });
});
```
</action>

<acceptance_criteria>
- File `campanha-ia/src/lib/ai/side-effect.ts` exists with single exported `sideEffect` function + `DryRunFlag` interface
- File `campanha-ia/src/lib/ai/side-effect.test.ts` exists with 5 vitest cases (dryRun true / false / undefined / error propagation / dryRun-skips-error)
- All 5 tests pass
- `sideEffect` does NOT import Sentry, logger, or anything besides the type
- `tsc --noEmit` passes
</acceptance_criteria>

---

### Task 2: hashStoreId utility (D-11 prereq)

<read_first>
- campanha-ia/src/lib/observability.ts (full file — pattern to follow for the addition)
- campanha-ia/src/lib/observability.test.ts (existing test file to extend)
- .planning/phases/02-pipeline-resilience-and-observability/02-CONTEXT.md (D-11, D-13 — "Hash store_id (8 chars sha256 prefix) — never raw UUID")
</read_first>

<action>
Edit `campanha-ia/src/lib/observability.ts`. Add the helper at the bottom of the file:

```ts
/**
 * Phase 02 D-11/D-13: derive a non-PII identifier from a store UUID for
 * Sentry tags. Raw UUIDs are PII-adjacent (correlate to Clerk user, payment
 * records, etc.). The first 8 chars of sha256(uuid) preserve cardinality
 * for grouping while not leaking the original ID.
 *
 * Use case: every captureError in /api/campaign/generate (and other AI
 * pipeline sites) tags `store_id=<8-char hash>` so Sentry dashboards can
 * group by store without storing raw UUIDs.
 *
 * Deterministic: same UUID always hashes to same 8-char prefix.
 * Pure function: no I/O, no async.
 */
export function hashStoreId(storeId: string): string {
  // Local require to avoid pulling node:crypto into edge bundles unintentionally.
  // observability.ts is server-only (already imports @sentry/nextjs), so this is safe.
  // Use dynamic require pattern that bundlers preserve:
  const crypto = require("node:crypto") as typeof import("node:crypto");
  return crypto.createHash("sha256").update(storeId).digest("hex").slice(0, 8);
}
```

If the executor finds that `require()` triggers an ESLint warning (likely — flat config has TS rules), use the `import` form at the top of the file instead:

```ts
import { createHash } from "node:crypto";
// ...
export function hashStoreId(storeId: string): string {
  return createHash("sha256").update(storeId).digest("hex").slice(0, 8);
}
```

Pick the import form by default. The dynamic require is only a fallback if there's a circular-import concern (there isn't — observability.ts has no other imports of node:crypto).

Then extend `campanha-ia/src/lib/observability.test.ts` with:

```ts
import { describe, it, expect } from "vitest";
import { hashStoreId } from "./observability";

describe("hashStoreId", () => {
  it("returns 8 hex chars", () => {
    const result = hashStoreId("00000000-0000-0000-0000-000000000001");
    expect(result).toMatch(/^[0-9a-f]{8}$/);
  });

  it("is deterministic for the same input", () => {
    const id = "abc-def-123";
    expect(hashStoreId(id)).toBe(hashStoreId(id));
  });

  it("differs for different inputs", () => {
    const a = hashStoreId("store-a");
    const b = hashStoreId("store-b");
    expect(a).not.toBe(b);
  });

  it("handles empty string without throwing", () => {
    expect(() => hashStoreId("")).not.toThrow();
    expect(hashStoreId("")).toMatch(/^[0-9a-f]{8}$/);
  });
});
```
</action>

<acceptance_criteria>
- `campanha-ia/src/lib/observability.ts` exports a new `hashStoreId(storeId: string): string` function
- The function uses `node:crypto`'s `createHash("sha256")` and returns the first 8 hex chars
- 4 new vitest cases pass under `lib/observability.test.ts`
- `tsc --noEmit` passes
- The function is exported (not internal) so Plan 02-03 / 02-04 can import it
- Static check: `grep -n "export function hashStoreId" campanha-ia/src/lib/observability.ts` returns 1 match
</acceptance_criteria>

---

### Task 3: H-9 — Close IDOR in incrementRegenCount fallback SELECT

<read_first>
- campanha-ia/src/lib/db/index.ts:326-359 (full incrementRegenCount function — verify line numbers haven't drifted)
- .planning/audits/MONOREPO-BUG-BASH.md H-9 (the IDOR rationale)
- .planning/phases/02-pipeline-resilience-and-observability/02-CONTEXT.md (scope-in: "Force `storeId` filter on `incrementRegenCount` SELECT path (close IDOR even though feature flag is off)")
</read_first>

<action>
Edit `campanha-ia/src/lib/db/index.ts`, function `incrementRegenCount` (currently lines 326-359). The fallback path's SELECT currently reads:

```ts
const { data: campaign } = await supabase
  .from("campaigns")
  .select("regen_count")
  .eq("id", campaignId)
  .single();
```

Change to require storeId on the SELECT when storeId is provided:

```ts
// H-9 fix: close IDOR — fallback SELECT was leaking cross-store reads.
// If storeId is provided (which it is in the production code path — only
// the legacy compat call sites pass undefined), require it on the SELECT
// so a leaked campaignId can't be used to read another store's regen_count.
let campaignQuery = supabase
  .from("campaigns")
  .select("regen_count")
  .eq("id", campaignId);
if (storeId) {
  campaignQuery = campaignQuery.eq("store_id", storeId);
}
const { data: campaign } = await campaignQuery.single();
```

The downstream UPDATE already has the storeId guard (current line 353); leave it as-is. Do NOT modify the legacy single-arg RPC overload — that's Phase 4 scope.

Also ensure the `incrementRegenCount` function does NOT silently swallow the case where the SELECT returns nothing (campaign not found OR cross-store SELECT blocked). Current code does `(campaign?.regen_count || 0) + 1` which would silently increment from 0 — meaning a leaked campaignId hitting the fallback would CREATE a counter where none should exist. Defend against this:

```ts
if (!campaign) {
  // Fallback SELECT returned no row — either the campaign doesn't exist OR
  // the storeId filter blocked it (IDOR attempt). Either way, fail loud.
  captureError(
    new Error(`incrementRegenCount fallback: campaign not found or cross-store access blocked (campaign=${campaignId}, store=${storeId ?? "n/a"})`),
    { function: "incrementRegenCount", campaignId, storeId },
  );
  throw new Error(`Campaign not found: ${campaignId}`);
}
```

Place this RIGHT AFTER the `.single()` resolves and BEFORE the `newCount` calculation. Verify `captureError` is imported at the top of `lib/db/index.ts` (it should be from Phase 1's edits — if not, add the import from `@/lib/observability`).
</action>

<acceptance_criteria>
- `incrementRegenCount` fallback path SELECT includes `.eq("store_id", storeId)` when storeId is provided
- Fallback path checks `if (!campaign)` and throws with `captureError` when SELECT returns nothing
- Legacy RPC overload is UNTOUCHED (no changes to the `if (storeId) { ... }` block above)
- `tsc --noEmit` passes
- Static check: `grep -A 8 "Tentativa 2: RPC legada" campanha-ia/src/lib/db/index.ts` shows the new `.eq("store_id", storeId)` on the SELECT (the part below the legacy RPC call)
- Static check: `grep -c "captureError.*incrementRegenCount" campanha-ia/src/lib/db/index.ts` returns ≥ 1
- Vitest (new test in `lib/db/index.test.ts` or a new `lib/db/regen-count.test.ts`): mock RPC failure → mock supabase fallback to return `data: null` → assert `incrementRegenCount("camp", "store")` throws with "Campaign not found"
</acceptance_criteria>

---

### Task 4: H-12 — Skip teaser when modelImageBase64 is the 1×1 fallback

<read_first>
- campanha-ia/src/app/api/campaign/generate/route.ts:476-480 (the fallback assignment site — verify exact lines)
- campanha-ia/src/app/api/campaign/generate/route.ts:681-741 (the teaser branch — entry point to gate)
- .planning/audits/MONOREPO-BUG-BASH.md H-12 (1×1 fallback teaser detail)
</read_first>

<action>
Edit `campanha-ia/src/app/api/campaign/generate/route.ts`. Two changes:

**4a:** Around the fallback PNG assignment (CONTEXT cites lines 476-480 — verify by grepping for the 1x1 PNG base64 literal or the comment that flags it as fallback). Add a flag declaration in the broader scope (likely outside the IIFE, in the request handler scope where `modelImageBase64` lives):

```ts
let usingFallbackModel = false;  // H-12: track if the 1×1 fallback was assigned
```

In the branch that assigns the 1×1 fallback PNG to `modelImageBase64`, set the flag:

```ts
usingFallbackModel = true;
```

**4b:** At the teaser branch entry (lines 681-741), gate the entire branch:

```ts
// H-12: skip teaser entirely if the model image is the 1×1 fallback.
// Sharp would error on the 70%-tall × 400×600 resize, the catch swallows it,
// and ops sees a confusing log line every trial run with no model.
if (usingFallbackModel) {
  logger.info("teaser_skipped_fallback_model", { reason: "1x1_fallback_no_model_available" });
} else {
  // ... existing teaser code ...
}
```

If `logger` is not yet imported at the top of `route.ts`, add the import:

```ts
import { logger } from "@/lib/observability";
```

(Plan 02-04 will do the broader logger sweep — but Plan 02-02 is allowed to add the import for this one site.)

Note: the executor must verify the exact location of the fallback assignment by reading the file, not by trusting the line number — line numbers may have shifted slightly since CONTEXT was written.
</action>

<acceptance_criteria>
- `let usingFallbackModel = false;` declared in the request-handler scope before the model-image fetch logic
- `usingFallbackModel = true;` is set inside the 1×1 PNG fallback branch
- Teaser branch (currently around line 681-741) is wrapped in `if (usingFallbackModel) { logger.info(...); } else { /* existing teaser code */ }`
- `import { logger } from "@/lib/observability";` is present at the top of `route.ts` (if not already)
- `tsc --noEmit` passes
- Static check: `grep -n "usingFallbackModel" campanha-ia/src/app/api/campaign/generate/route.ts` returns ≥ 3 matches (declaration + assign + check)
- Manual trace: a campaign request with no available model image (forces fallback branch) does NOT enter the teaser code path
</acceptance_criteria>

---

## Verification

1. `npx tsc --noEmit` in `campanha-ia/` exits 0.
2. `npx vitest run src/lib/ai/side-effect src/lib/observability src/lib/db` exits 0 (existing baseline 184 + new tests pass).
3. Static check: `grep -c "store_id.*storeId" campanha-ia/src/lib/db/index.ts` shows the H-9 fix landed.
4. Static check: `grep -n "usingFallbackModel" campanha-ia/src/app/api/campaign/generate/route.ts` returns ≥ 3.
5. Static check: `grep -n "export function hashStoreId" campanha-ia/src/lib/observability.ts` returns 1.
6. Static check: `grep -n "export function sideEffect" campanha-ia/src/lib/ai/side-effect.ts` returns 1.

## Cross-cutting must_haves

```yaml
truths:
  - sideeffect_helper_in_lib_ai_not_lib_utils
  - hashstoreid_returns_8_hex_chars_via_sha256
  - incrementregen_fallback_select_filters_by_store_id_when_provided
  - teaser_branch_gated_on_usingfallbackmodel_flag
  - legacy_increment_regen_count_overload_untouched_phase4_scope
acceptance:
  - tsc_passes
  - all_new_vitest_cases_pass
  - existing_184_pass_baseline_preserved
```
