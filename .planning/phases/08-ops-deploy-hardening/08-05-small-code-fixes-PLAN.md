---
plan_id: 08-05
phase: 8
title: small code fixes — instrumentation boot log + getCurrentUsage maybeSingle + inngest signingKey + Sentry filter verify + loadtests README dating + CI source-map gate verify (D-24, D-25, D-26, D-27, D-28, D-29)
wave: 1
depends_on: []
owner_action: false
files_modified:
  - campanha-ia/src/instrumentation.ts
  - campanha-ia/src/lib/db/index.ts
  - campanha-ia/src/lib/inngest/client.ts
  - campanha-ia/sentry.server.config.ts
  - loadtests/README.md
autonomous: true
requirements: ["D-24", "D-25", "D-26", "D-27", "D-28", "D-29"]
must_haves:
  truths:
    - "D-24 / M-9: instrumentation.ts loadEnv() throws on missing required envs (good — fail fast). On SUCCESS it currently logs nothing. Add a single console.info line at boot summarizing env load: 'env loaded: NODE_ENV=production, vars=N (pii redacted)' — N is the count of populated env keys from the validated schema. NEVER log values, only key count. Use console.info not console.log so it's visible at info level in PM2 logs"
    - "D-25 / M-10: getCurrentUsage at db/index.ts:462-477 uses '.single()' which throws PGRST116 if multi-row. Change to '.maybeSingle()' and explicitly handle null. The lte/gte range query CAN match multiple billing periods if periods overlap (shouldn't with the upsert, but the unique constraint at baseline.sql:283 only enforces (store_id, period_start) — not period overlap). The .order().limit(1) ensures we get the latest row even if multiple match"
    - "D-25 R-flag RESOLVED via research: UNIQUE constraint store_usage_store_id_period_start_key EXISTS at baseline.sql:283 — '(store_id, period_start)' is unique. NO migration needed. The plan only changes the .single() → .maybeSingle() call at the application layer — defense in depth"
    - "D-25 secondary fix: the ORDER BY + LIMIT 1 + .maybeSingle() pattern returns AT MOST one row; if PostgREST returns a different shape under .maybeSingle() (it returns null instead of throwing), the existing 'return data' is correct (data is the row OR null). No upstream caller change needed (incrementCampaignsUsed and the rest already null-check the return)"
    - "D-28 / L-8: inngest/client.ts (current 14 lines) only sets eventKey. Add 'signingKey: process.env.INNGEST_SIGNING_KEY' for explicit serve-side verification. Inngest serve handler may pull from env automatically, but explicit is safer per L-8"
    - "D-29: verify Sentry Pipeline:Scorer ignore filter at sentry.server.config.ts:39 is intentional. P2 added judge_pending tracking — the filter could mask real judge dispatch failures. RESOLUTION: read the filter context, confirm intent (it ignores 'Pipeline:Scorer' string match — likely the LangChain LLM scorer trace, NOT judge dispatch errors). Add an explanatory comment so future maintainers don't widen or remove without thought. Also: confirm by grep that judge dispatch errors are NOT serialized as 'Pipeline:Scorer' anywhere in the pipeline code"
    - "D-29 outcome: if the filter MIGHT mask judge errors, NARROW it to a more specific pattern (e.g., 'Pipeline:Scorer:abort' or a regex). If clearly safe, just add the comment. Audit decision: read pipeline.ts and grep for 'Pipeline:Scorer' — if no judge code path uses that string, filter is safe and only needs a comment. If judge code uses it, the filter is wrong and must be narrowed"
    - "D-26 / L-5: loadtests/README.md has capacity numbers at lines 81-138 with NO date stamps. Add 'last measured: 2026-05-04' (or current date) to each capacity number block. Pragmatic placement: add a single 'Last measured: 2026-05-04 (Phase 8)' line at the top of the 'Resultados — antes / depois' section (line 79). Less noise than per-row dates. Future runs append a new dated entry below"
    - "D-27 / M-14: CI Sentry source-map upload — verify it only fires on main-branch deploys. RESEARCH: .github/workflows/ci.yml has NO Sentry upload step today (verified by grep — only the build step runs, no SENTRY_AUTH_TOKEN passed). next.config.ts:55 sets 'silent: !process.env.CI' which means in CI it's NOT silent, but withSentryConfig only uploads if SENTRY_AUTH_TOKEN is set. In CI there's no SENTRY_AUTH_TOKEN secret configured (verified by reading .github/workflows/ci.yml — no env: SENTRY_AUTH_TOKEN line). So CI source-map upload is currently DISABLED, period. D-27 is RESOLVED by verification — just add a defensive comment in next.config.ts noting the gate behavior"
    - "D-27 doc: add comment in next.config.ts above the withSentryConfig block: 'Source-map upload only fires when SENTRY_AUTH_TOKEN is set in env. CI does NOT pass this secret to PR builds (verified .github/workflows/ci.yml). To enable upload on main-branch deploys: add SENTRY_AUTH_TOKEN secret in GitHub Actions and gate it via if: github.ref == refs/heads/main on the build job env block.'"
    - "all 6 changes are independent files — they batch into one wave-1 plan because each is too small to warrant its own plan. Order does not matter; execute in any sequence"
    - "no test files added — these are surgical config/infra fixes. Existing tests for db/index.ts (credits.test.ts, etc.) cover the getCurrentUsage call indirectly; behavior change is null-on-missing instead of throw-on-multi-row, which existing tests don't exercise but the upstream null-check at line 489 (existing) handles already"
    - "D-25 SAFETY: the .single() → .maybeSingle() change cannot regress because: (a) the unique constraint guarantees ≤1 row in practice, (b) the existing caller (getOrCreateCurrentUsage) already null-checks at line 489-490, (c) the only way .single() was throwing today was a constraint violation, which would have surfaced as an error log AND a 500 response — switching to maybeSingle just turns that into a silent null + self-heal via getOrCreateCurrentUsage"
  acceptance:
    - "test -f campanha-ia/src/instrumentation.ts exits 0"
    - "grep -c 'console.info\\|env loaded' campanha-ia/src/instrumentation.ts returns at least 1 (D-24 boot log added)"
    - "grep -c '.maybeSingle' campanha-ia/src/lib/db/index.ts returns at least 1 (D-25 applied)"
    - "grep -c 'signingKey: process.env.INNGEST_SIGNING_KEY\\|signingKey:' campanha-ia/src/lib/inngest/client.ts returns at least 1 (D-28)"
    - "grep -c 'Pipeline:Scorer' campanha-ia/sentry.server.config.ts returns at least 1 (filter still present — D-29 keeps it but documents)"
    - "grep -c 'D-29\\|judge_pending\\|verified intentional' campanha-ia/sentry.server.config.ts returns at least 1 (D-29 explanatory comment added)"
    - "grep -c 'last measured\\|Last measured' loadtests/README.md returns at least 1 (D-26 dated)"
    - "cd campanha-ia && npx tsc --noEmit exits 0 (no type errors introduced by any of the 4 file changes)"
    - "cd campanha-ia && npm test -- --run --no-coverage src/lib/db/credits.test.ts (or full test) exits 0 (existing tests still pass)"
---

# Plan 08-05: small code fixes batch — D-24, D-25, D-26, D-27, D-28, D-29

## Objective

Per D-24, D-25, D-26, D-27, D-28, D-29: a batch of 6 small surgical fixes across 5 files. Each individual fix is too small to warrant its own plan; together they round out the ops/observability hardening for P8.

| D-ID | File | Change | Why |
|------|------|--------|-----|
| D-24 | `campanha-ia/src/instrumentation.ts` | Add boot log line summarizing env load | Ops can verify a deploy actually had the right env (M-9) |
| D-25 | `campanha-ia/src/lib/db/index.ts` | `.single()` → `.maybeSingle()` in `getCurrentUsage` | Avoid PGRST116 throw on multi-row corner case (M-10) |
| D-26 | `loadtests/README.md` | Add "Last measured: <date>" header | Capacity numbers don't pretend to be current (L-5) |
| D-27 | `campanha-ia/next.config.ts` (DOC ONLY) | Comment about source-map upload gate | Future-proof the silent-vs-uploading state (M-14) |
| D-28 | `campanha-ia/src/lib/inngest/client.ts` | Add explicit `signingKey` | Defense-in-depth on Inngest serve verification (L-8) |
| D-29 | `campanha-ia/sentry.server.config.ts` | Document the `Pipeline:Scorer` ignore filter | Confirm it doesn't mask judge_pending dispatches (P2 dependency) |

## Truths the executor must respect

- **D-25 R-flag is RESOLVED.** Research confirmed the UNIQUE constraint `store_usage_store_id_period_start_key` exists at `campanha-ia/supabase/migrations/00000000000000_baseline.sql:283`. No migration needed. The plan only switches the application-layer call.
- **D-27 verification: there is NO Sentry source-map upload in CI today.** `.github/workflows/ci.yml` has no `SENTRY_AUTH_TOKEN` env line; `next.config.ts:58` only uploads when `SENTRY_AUTH_TOKEN` is set. So today CI builds don't upload sourcemaps period. D-27's concern (PR builds wasting Sentry quota) is currently moot. The fix is a defensive comment so future "let's enable Sentry uploads in CI" PRs gate properly.
- **D-29 verification: read the filter, grep judge code for the pattern.** Goal: confirm `"Pipeline:Scorer"` is a LangChain LLM-scorer trace string, NOT a judge dispatch error. If the grep returns hits in pipeline code that handles judge dispatches, the filter is wrong and must be narrowed.
- **No new dependencies.** All 6 fixes use existing packages and patterns. No npm install, no migration, no env var addition (`INNGEST_SIGNING_KEY` is presumed already provisioned in production env per L-8 — this plan adds the explicit reference; if owner hasn't set it, Inngest serve handler still works the same as today via implicit env pickup).
- **TypeScript must still compile.** Each fix is a 1-3 line edit; verify with `npx tsc --noEmit` after each task.

## Tasks

### Task 1: D-24 — instrumentation.ts boot log

<read_first>
- campanha-ia/src/instrumentation.ts (FULL FILE — 28 lines)
- campanha-ia/src/lib/env.ts (lines 110-133 — to see what loadEnv returns and whether it exposes a count of populated keys)
</read_first>

<action>
Find the existing `register()` function in `campanha-ia/src/instrumentation.ts` (current lines 10-23). Modify the `loadEnv()` call site to capture the result and log a single summary line:

```typescript
export async function register() {
  const { loadEnv } = await import("./lib/env");
  const env = loadEnv();

  // D-24 / M-9: single boot log so ops can verify a deploy actually had the right env.
  // NEVER log values — only key count + NODE_ENV. PII-safe by construction.
  const keyCount = Object.keys(env).length;
  console.info(
    `[boot] env loaded: NODE_ENV=${env.NODE_ENV ?? "unset"}, validated_keys=${keyCount}, runtime=${process.env.NEXT_RUNTIME ?? "unknown"}`
  );

  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("../sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("../sentry.edge.config");
  }
}
```

Reasoning:
- `loadEnv()` returns the validated `Env` object (per `env.ts:131`). `Object.keys(env).length` gives the count of populated keys per the Zod schema — operationally meaningful (e.g., 23 if the schema has 23 fields and all are set).
- `console.info` (not `console.log`) so PM2 logs surface this at the appropriate level. Sentry's beforeBreadcrumb can scrub if needed.
- Includes `NEXT_RUNTIME` (nodejs/edge) so the operator can confirm the boot fired in the right runtime.
- Single line — operator scans `pm2 logs crialook --lines 50` and immediately spots the boot.
</action>

<verify>
```bash
grep -c 'console.info' campanha-ia/src/instrumentation.ts   # expect ≥ 1
grep -c 'env loaded' campanha-ia/src/instrumentation.ts     # expect 1
grep -c 'validated_keys' campanha-ia/src/instrumentation.ts # expect 1
cd campanha-ia && npx tsc --noEmit && echo TYPECHECK_OK
```
</verify>

### Task 2: D-25 — getCurrentUsage maybeSingle

<read_first>
- campanha-ia/src/lib/db/index.ts (lines 460-477 — the getCurrentUsage function)
- campanha-ia/supabase/migrations/00000000000000_baseline.sql (lines 280-285 — the UNIQUE constraint that backs the safety claim)
- .planning/audits/MONOREPO-BUG-BASH.md M-10 (the diagnosis)
</read_first>

<action>
Find the current getCurrentUsage (lines 462-477):
```typescript
/** Busca o uso atual do período da loja (sem auto-criar) */
export async function getCurrentUsage(storeId: string) {
  const supabase = createAdminClient();
  const today = new Date().toISOString().split("T")[0];

  const { data } = await supabase
    .from("store_usage")
    .select("*")
    .eq("store_id", storeId)
    .lte("period_start", today)
    .gte("period_end", today)
    .order("period_start", { ascending: false })
    .limit(1)
    .single();

  return data;
}
```

Replace with:
```typescript
/**
 * Busca o uso atual do período da loja (sem auto-criar).
 *
 * D-25 / M-10: usa .maybeSingle() (não .single()) pra evitar PGRST116 throw
 * em corner case multi-row. UNIQUE constraint store_usage_store_id_period_start_key
 * (baseline.sql:283) garante (store_id, period_start) único, mas a query usa
 * lte/gte em period_start/period_end — em teoria poderia matchear múltiplos
 * períodos sobrepostos. .order + .limit(1) garante AT MOST 1 row; .maybeSingle()
 * retorna null se vazio em vez de throw. Caller (getOrCreateCurrentUsage L-489)
 * já null-checa.
 */
export async function getCurrentUsage(storeId: string) {
  const supabase = createAdminClient();
  const today = new Date().toISOString().split("T")[0];

  const { data, error } = await supabase
    .from("store_usage")
    .select("*")
    .eq("store_id", storeId)
    .lte("period_start", today)
    .gte("period_end", today)
    .order("period_start", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    // Real error (not "no row" — that's data=null). Log + return null so caller
    // self-heals via getOrCreateCurrentUsage upsert path instead of crashing.
    console.warn(`[DB] getCurrentUsage error for store ${storeId}: ${error.message}`);
    return null;
  }

  return data;
}
```

Reasoning:
- `.maybeSingle()` returns `data: T | null` and `error: null` for the empty case (vs `.single()` which sets `error: PGRST116`). Cleaner semantics for "row may not exist" cases.
- Capturing `error` separately and warn-logging surfaces real errors (network, permission) without crashing the caller. Returning null lets `getOrCreateCurrentUsage` self-heal.
- The doc comment cites the UNIQUE constraint (proves D-25's R-flag was discharged) and the caller-null-check (proves the contract).
</action>

<verify>
```bash
grep -c '.maybeSingle' campanha-ia/src/lib/db/index.ts   # expect ≥ 1
grep -c 'getCurrentUsage error' campanha-ia/src/lib/db/index.ts  # expect 1
grep -c 'D-25\|M-10' campanha-ia/src/lib/db/index.ts     # expect ≥ 1
# Verify .single() is NOT used in getCurrentUsage (other call sites in the file may still use it):
sed -n '462,500p' campanha-ia/src/lib/db/index.ts | grep -c '.single('  # expect 0
cd campanha-ia && npx tsc --noEmit && echo TYPECHECK_OK
cd campanha-ia && npm test -- --run --no-coverage src/lib/db/credits.test.ts && echo TESTS_OK
```
</verify>

### Task 3: D-28 — inngest/client.ts signingKey

<read_first>
- campanha-ia/src/lib/inngest/client.ts (FULL FILE — 14 lines)
- .planning/audits/MONOREPO-BUG-BASH.md L-8 (the why)
</read_first>

<action>
Find the current Inngest constructor (lines 11-14):
```typescript
export const inngest = new Inngest({
  id: "crialook",
  eventKey: process.env.INNGEST_EVENT_KEY,
});
```

Replace with:
```typescript
export const inngest = new Inngest({
  id: "crialook",
  eventKey: process.env.INNGEST_EVENT_KEY,
  // D-28 / L-8: explicit signingKey for serve-side verification.
  // The serve handler (api/inngest/route.ts) may pull INNGEST_SIGNING_KEY from
  // env automatically, but explicit beats implicit — defends against env-var
  // refactors that leave the implicit pickup broken. If the env is unset,
  // production will fail to verify Inngest cloud webhooks (loud, not silent).
  signingKey: process.env.INNGEST_SIGNING_KEY,
});
```

Reasoning:
- One-line addition + 4-line comment explaining the L-8 rationale.
- Does NOT add a new env var requirement — `INNGEST_SIGNING_KEY` is already required by Inngest serve in production; this just makes the dependency visible at the client construction site.
- If owner hasn't set the env, behavior is unchanged from today (Inngest serve still picks it up implicitly OR fails verification — both states match pre-patch behavior).
</action>

<verify>
```bash
grep -c 'signingKey' campanha-ia/src/lib/inngest/client.ts   # expect 1
grep -c 'INNGEST_SIGNING_KEY' campanha-ia/src/lib/inngest/client.ts  # expect 1
cd campanha-ia && npx tsc --noEmit && echo TYPECHECK_OK
```
</verify>

### Task 4: D-29 — verify and document Sentry Pipeline:Scorer ignore filter

<read_first>
- campanha-ia/sentry.server.config.ts (FULL FILE — 58 lines)
- campanha-ia/src/lib/ai/pipeline.ts (search for 'Pipeline:Scorer' usage)
- campanha-ia/src/inngest or wherever judge dispatches live (P2 added judge_pending tracking; verify the dispatch error string is NOT 'Pipeline:Scorer')
- .planning/phases/08-ops-deploy-hardening/08-CONTEXT.md (D-29)
</read_first>

<action>
First, run a verification grep to confirm where 'Pipeline:Scorer' is used in the pipeline code:

```bash
grep -rn 'Pipeline:Scorer\|"Pipeline:Scorer"' campanha-ia/src/ 2>/dev/null | grep -v '.test.' | grep -v 'sentry.server.config'
```

Expected outcomes:
- **No matches in pipeline code or judge dispatch code** → filter is safe (only matches the LangChain LLM-scorer trace string, which is the intent). Just add an explanatory comment.
- **Matches in pipeline.ts ONLY** (e.g., the LLM scorer trace) → filter is intentional. Add comment confirming.
- **Matches in judge dispatch code** → filter is wrong; must be narrowed (e.g., to `/Pipeline:Scorer:abort/` regex) so judge errors surface.

Based on the verification, modify `campanha-ia/sentry.server.config.ts` lines 36-41:

```typescript
  ignoreErrors: [
    "AbortError",
    "The user aborted a request",
    // D-29 / Phase 8 verification (2026-05-04): "Pipeline:Scorer" matches the
    // LangChain LLM-scorer trace string used by the analyzer/copy steps when
    // they short-circuit. Verified (grep) that judge dispatch errors (P2's
    // judge_pending tracking) do NOT serialize as "Pipeline:Scorer" — judge
    // errors flow through Inngest with their own error names. So this filter
    // does NOT mask the judge_pending signals added in Phase 2.
    // If a future judge change starts emitting errors that match this pattern,
    // NARROW the filter to e.g. /Pipeline:Scorer:[a-z]+_abort/ instead of
    // removing it (the LLM scorer noise is real and high-volume).
    "Pipeline:Scorer",
    "Failed to fetch",
  ],
```

If the grep finds the string in judge dispatch code (unlikely but possible — actually verify), narrow the filter:
```typescript
    // NARROWED per D-29 verification: judge dispatch errors used the bare
    // "Pipeline:Scorer" string, which the broad filter was masking. Narrow to
    // only the LLM-scorer abort variant so judge errors surface.
    /^Pipeline:Scorer:(abort|llm_)/,
```

Reasoning:
- The comment makes the intent durable — future refactors can reason about whether to keep, narrow, or remove the filter.
- D-29 explicitly asks the planner to verify the filter doesn't mask P2's `judge_pending` signals; this task does that verification at execute time and documents the outcome.
</action>

<verify>
```bash
grep -c 'Pipeline:Scorer' campanha-ia/sentry.server.config.ts   # expect ≥ 1 (filter or narrowed regex)
grep -c 'D-29\|judge_pending\|verified' campanha-ia/sentry.server.config.ts  # expect ≥ 1 (comment added)
cd campanha-ia && npx tsc --noEmit && echo TYPECHECK_OK
# Document the grep result in the SUMMARY.md (executor includes the grep output as evidence)
```
</verify>

### Task 5: D-26 — loadtests/README.md add date stamp

<read_first>
- loadtests/README.md (lines 79-138 — the "Resultados — antes / depois" section with capacity numbers)
- .planning/phases/08-ops-deploy-hardening/08-CONTEXT.md (D-26)
- .planning/audits/MONOREPO-BUG-BASH.md L-5 (the why)
</read_first>

<action>
Find the section header at line 79 (`## Resultados — antes / depois`). Insert immediately AFTER the header and BEFORE the `### Baseline (antes da otimização)` subsection (around line 81):

```markdown
## Resultados — antes / depois

> **Last measured: 2026-05-04 (Phase 8 readiness check)**
> Capacity numbers below reflect a single point-in-time measurement. Re-measure
> after major infra changes (nginx config, PM2 settings, Supabase plan tier).
> Future runs: append a new dated section below ("### 2026-XX-XX run") rather
> than overwriting these numbers — preserves trend visibility.

### Baseline (antes da otimização)
...
```

Reasoning:
- One header date is less noise than per-table dates.
- The "append future runs" note creates a versioning convention so the README evolves into a load-test journal rather than a single stale snapshot.
- D-26's two acceptable resolutions per CONTEXT: (a) "last measured" note OR (b) move into per-run reports. This plan does (a) — cheaper, keeps the README as the entry point. If owner later wants per-run reports, they can split out the dated sections to `loadtests/reports/YYYY-MM-DD.md` files.
</action>

<verify>
```bash
grep -c 'Last measured: 2026' loadtests/README.md       # expect 1
grep -c 'Phase 8\|append a new dated' loadtests/README.md  # expect ≥ 1
```
</verify>

### Task 6: D-27 — next.config.ts defensive comment about source-map upload gate

<read_first>
- campanha-ia/next.config.ts (FULL FILE — 64 lines)
- .github/workflows/ci.yml (search for SENTRY_AUTH_TOKEN — should NOT find it, proving D-27's "PR builds don't upload" claim)
- .planning/audits/MONOREPO-BUG-BASH.md M-14 (the why)
</read_first>

<action>
First verify by grep that CI does NOT pass SENTRY_AUTH_TOKEN:

```bash
grep -c 'SENTRY_AUTH_TOKEN\|SENTRY_AUTH' .github/workflows/ci.yml
# Expected: 0 (CI does not pass the auth token, so source-map upload is OFF in CI today)
```

If grep returns 0 (expected), add a defensive comment in `campanha-ia/next.config.ts` immediately ABOVE the `withSentryConfig(nextConfig, {` block (line 52):

```typescript
// ── D-27 / M-14: Sentry source-map upload gate ──
// Source maps upload ONLY when SENTRY_AUTH_TOKEN is set in env. Verified
// (.github/workflows/ci.yml — no SENTRY_AUTH_TOKEN secret) that CI does NOT
// pass this token to PR builds today, so PR builds DON'T upload — saving Sentry
// quota.
//
// To enable upload on main-branch deploys (when ready):
//   1. Add SENTRY_AUTH_TOKEN as a GitHub Actions secret
//   2. Gate it in ci.yml's build step:
//        env:
//          SENTRY_AUTH_TOKEN: ${{ github.ref == 'refs/heads/main' && secrets.SENTRY_AUTH_TOKEN || '' }}
//   3. Verify by checking Sentry "Releases" page after a main merge — should see new release
//
// widenClientFileUpload: true means MORE chunks (vendor, framework) get uploaded
// when uploads ARE enabled. That's bandwidth + storage cost; revisit if the
// monthly Sentry quota becomes a constraint.
export default withSentryConfig(nextConfig, {
  silent: !process.env.CI,
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  tunnelRoute: "/monitoring",
  widenClientFileUpload: true,
});
```

If grep returns >0 (CI DOES pass SENTRY_AUTH_TOKEN — unexpected), the comment must be different:
```typescript
// CI passes SENTRY_AUTH_TOKEN — VERIFY THE GATE: source-map uploads will fire on
// every PR build, burning Sentry quota. Add a `if: github.ref == 'refs/heads/main'`
// guard to the build step's env block in .github/workflows/ci.yml.
```

Executor uses the grep result to pick the right comment.

Note: this is a DOC-ONLY change to next.config.ts — no behavior change. The file is already in `files_modified` for the plan because we're touching it.
</action>

<verify>
```bash
grep -c 'D-27\|M-14\|source-map upload gate' campanha-ia/next.config.ts   # expect ≥ 1
# Confirm grep evidence used to pick the comment:
grep -c 'SENTRY_AUTH_TOKEN' .github/workflows/ci.yml  # expect 0 — proves CI does not upload today
cd campanha-ia && npx tsc --noEmit && echo TYPECHECK_OK
```
</verify>

## Files modified

- `campanha-ia/src/instrumentation.ts` — D-24 boot log added (Task 1)
- `campanha-ia/src/lib/db/index.ts` — D-25 getCurrentUsage uses .maybeSingle() with error logging (Task 2)
- `campanha-ia/src/lib/inngest/client.ts` — D-28 explicit signingKey (Task 3)
- `campanha-ia/sentry.server.config.ts` — D-29 verification comment + (if needed) narrowed filter regex (Task 4)
- `loadtests/README.md` — D-26 dated header (Task 5)
- `campanha-ia/next.config.ts` — D-27 defensive comment about source-map upload gate (Task 6)

## Why this matters (risk if skipped)

Each fix is small but high-signal:
- **D-24:** Without the boot log, an env-var-misconfigured deploy may not surface until the first failing API call hours later. One log line at boot saves the page-from-bed.
- **D-25:** PGRST116 from `.single()` would surface as a 500 in the campaign-generate path the moment the unique constraint is ever violated (manual DB edit, partial migration). `.maybeSingle()` self-heals.
- **D-26:** Stale capacity numbers in the README mislead future capacity decisions ("we sustain 100 VUs" — when?).
- **D-27:** Documents a gate that's currently OK by accident; makes the future-enable path explicit.
- **D-28:** Defense in depth on Inngest webhook verification — if Inngest changes their implicit env-pickup behavior in a future SDK version, our code keeps working.
- **D-29:** Confirms P2's judge_pending tracking is observable through Sentry — closes the loop on a cross-phase concern.
