# Phase 01 — Deferred Items

Issues discovered during execution that are out of scope for the plan that found them.

---

## From Plan 01-02 (gemini-timeout)

### Pre-existing tsc error: `prompt-version.test.ts` references missing module

**Discovered during:** Plan 01-02, Task 2 verification (`tsc --noEmit`)

**Error:**
```
src/lib/ai/prompt-version.test.ts(10,38): error TS2307:
  Cannot find module './prompt-version' or its corresponding type declarations.
```

**Why deferred:** The test file is from concurrent Wave 1 plan **01-01** (prompt-version
metadata). Plan 01-01 owns both the test and the missing `prompt-version.ts` module —
01-02 must NOT touch either file (per concurrency rules: do not race on same lines).

**Resolution:** Plan 01-01 will create `prompt-version.ts` and the tsc error will resolve
itself once 01-01 lands. If 01-01 lands AFTER 01-02 in commit order, this transient
red state is expected and not a 01-02 regression.

**Status (post-execution):** RESOLVED. Plan 01-01 landed `prompt-version.ts` mid-execution
of 01-02 (true concurrent execution). Final `npx tsc --noEmit` returns exit 0.

**Action required from 01-02:** None.

---

## From Plan 01-07 (production-signal)

### Pre-existing tsc errors: `pipeline.ts` cost-logger calls have wrong arity

**Discovered during:** Plan 01-07, Task 3 verification (`npx tsc --noEmit`)

**Errors:**
```
src/lib/ai/pipeline.ts(169,5): error TS2554: Expected 6 arguments, but got 5.
src/lib/ai/pipeline.ts(204,7): error TS2554: Expected 6 arguments, but got 5.
```

**Why deferred:** Both call sites are inside `pipeline.ts` invoking the cost-logger
helpers (`logAnalyzerCost` / `logSonnetCost`) whose signatures were changed in flight
by concurrent Wave 1 plan **01-01** (D-15 added a 6th `metadata` parameter for
`prompt_version`). Plan 01-07 must NOT touch `pipeline.ts` or the loggers — those are
01-01's territory.

**Files Plan 01-07 owns/touches:**
- `campanha-ia/supabase/migrations/20260503_120100_add_campaign_regenerate_reason.sql`
- `campanha-ia/src/lib/db/index.ts` (added `setRegenerateReason` + helpers)
- `campanha-ia/src/app/api/campaign/[id]/regenerate/route.ts`
- `campanha-ia/src/app/admin/custos/page.tsx`

None of those four files appear in the tsc error output → errors are unrelated to
01-07's diff. Confirmed by checkpoint of `git diff main...HEAD` against 01-07's commits.

**Resolution:** Plan 01-01 will fix the call sites when it consolidates per D-18
(`logModelCost` rollout) or by passing the 6th `metadata` arg at both call sites. If
01-01 lands after 01-07 in commit order, this transient red state will resolve there.

**Action required from 01-07:** None. 01-07's own files compile cleanly in isolation.

