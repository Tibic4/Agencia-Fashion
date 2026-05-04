---
plan_id: 08-03
phase: 8
title: /api/health deep check — fix DB latency timer to start immediately before Supabase call (D-21)
wave: 1
depends_on: []
owner_action: false
files_modified:
  - campanha-ia/src/app/api/health/route.ts
autonomous: true
requirements: ["D-21"]
must_haves:
  truths:
    - "the existing /api/health handler at campanha-ia/src/app/api/health/route.ts starts a timer with 'const start = Date.now()' at line 36, BEFORE the auth check (line 38) and before any DB work (line 49-55) — so checks.database.ms (line 58) currently includes route overhead, not pure DB latency"
    - "fix per D-21 / M-7: introduce a separate 'dbStart' timer immediately before the supabase.from(...).select() call (currently line 51) and use it for checks.database.ms"
    - "preserve the outer 'start' timer for the response-level 'responseMs' field (line 96 — that's intentional total-handler latency for monitoring; the handler total is still meaningful)"
    - "preserve every other invariant of the handler: timing-safe header check (lines 8-21), shallow public path (lines 38-43), all 6 checks (database, gemini, clerk, mercadopago, googleAi, storage), the overall status logic (lines 85-87), the 503-vs-200 distinction (line 100), Cache-Control: no-store on both branches"
    - "the storage check (lines 77-83) is a SECOND DB-ish call (supabase.storage.list); per D-21's spirit it should ALSO have its own dedicated timer if the storage check exposes 'ms'. Currently it doesn't (storage check only sets status + detail, no ms). Add 'ms' to storage check using the same pattern as DB — it makes the deep-check report symmetric and gives ops a second latency signal"
    - "use 'const dbStart = Date.now()' (NOT reassigning 'start') to make the rename intent obvious in code review and prevent accidental shadowing"
    - "verify TypeScript still compiles after the change (no new types introduced; just timer reordering)"
    - "no test file change needed — the existing /api/health route is tested via the deep-check authorization path (timing-safe equality); this plan does NOT change behavior of the unauthorized branch, only the deep-check internals"
    - "keep checks.database structure ({ status, ms } on success; { status, detail } on error) consistent with existing shape — do NOT introduce new fields"
  acceptance:
    - "test -f campanha-ia/src/app/api/health/route.ts exits 0"
    - "grep -c 'const dbStart\\|dbStart = Date.now' campanha-ia/src/app/api/health/route.ts returns at least 1"
    - "grep -c 'const start = Date.now' campanha-ia/src/app/api/health/route.ts returns at least 1 (outer timer preserved for responseMs)"
    - "grep -c 'Date.now() - dbStart' campanha-ia/src/app/api/health/route.ts returns at least 1 (DB latency uses dbStart)"
    - "grep -c 'Date.now() - start' campanha-ia/src/app/api/health/route.ts returns at least 1 (responseMs uses outer start)"
    - "grep -c 'storage' campanha-ia/src/app/api/health/route.ts returns at least 3 (preserved storage check)"
    - "cd campanha-ia && npx tsc --noEmit src/app/api/health/route.ts (or full noEmit) exits 0 (no type errors introduced)"
    - "node -e \"const c=require('fs').readFileSync('campanha-ia/src/app/api/health/route.ts','utf8'); const dbStartIdx=c.indexOf('dbStart'); const supabaseIdx=c.indexOf('supabase.from'); if(dbStartIdx<0||supabaseIdx<0||dbStartIdx>supabaseIdx)process.exit(1); console.log('dbStart precedes supabase.from — OK')\" exits 0 (proves the timer is BEFORE the call, not after)"
---

# Plan 08-03: /api/health DB-latency timer fix

## Objective

Per D-21 / M-7: the deep-check `/api/health` handler currently reports `checks.database.ms` as `Date.now() - start`, where `start` was captured at the very top of the handler — BEFORE the auth check, JSON parsing, and admin-client construction. The "DB latency" metric therefore lies; it includes route-level overhead.

Fix: introduce a dedicated `dbStart = Date.now()` timer immediately before the Supabase call, and use it for `checks.database.ms`. Keep the outer `start` timer for `responseMs` (the total-handler latency, which is intentionally end-to-end).

This is a 2-line edit. Bonus: apply the same symmetric treatment to the storage check (currently has no `ms` field) so ops has a second latency signal in the deep-check report.

## Truths the executor must respect

- **Don't break the shallow path.** Lines 38-43 return `{status: "ok", timestamp}` instantly with no DB touch. The shallow path is what `ops/health-check.sh` hits (no `x-health-secret` header), and CONCERNS §10 + D-23 explicitly require it stays DB-free. Don't add timing or DB calls to the shallow branch.
- **Preserve `responseMs`.** Line 96 reports total handler time using the outer `start` timer. That's the right metric for response-time monitoring. Don't conflate it with DB latency.
- **Don't restructure.** The handler has a clear shape: shallow gate → 6 checks (database, gemini, clerk, mercadopago, googleAi, storage) → overall status → response. Surgical edits only.
- **Storage check ms is a bonus.** Currently `checks.storage` has `{ status, detail? }` — no `ms`. Adding `ms` makes the deep-check report symmetric. If the executor finds this scope-creep, it can defer to a follow-up; D-21 strictly only requires the DB timer fix. But adding it is ~3 lines and high signal.

## Tasks

### Task 1: Move DB timer to immediately before the Supabase call

<read_first>
- campanha-ia/src/app/api/health/route.ts (FULL FILE — 105 lines)
- .planning/phases/08-ops-deploy-hardening/08-CONTEXT.md (D-21)
- .planning/audits/MONOREPO-BUG-BASH.md M-7 (the diagnosis behind this fix)
</read_first>

<action>
Find the current DB check block (lines 47-59):
```typescript
  // ── Deep check (autorizado): testa DB, storage e presença de chaves ──
  const checks: Record<string, { status: "ok" | "error" | "warning"; ms?: number; detail?: string }> = {};

  let dbAlive = false;
  try {
    const supabase = createAdminClient();
    const { error } = await supabase.from("plans").select("id").limit(1);
    dbAlive = !error;
  } catch {
    dbAlive = false;
  }

  checks.database = dbAlive
    ? { status: "ok", ms: Date.now() - start }
    : { status: "error", detail: "db_unreachable" };
```

Replace with:
```typescript
  // ── Deep check (autorizado): testa DB, storage e presença de chaves ──
  const checks: Record<string, { status: "ok" | "error" | "warning"; ms?: number; detail?: string }> = {};

  // D-21 / M-7: dbStart is captured IMMEDIATELY before the Supabase call so
  // checks.database.ms reflects pure DB latency, not route-handler overhead
  // (auth check, JSON parsing, admin client construction). The outer `start`
  // is preserved for responseMs (line ~96) which intentionally reports
  // total-handler time.
  let dbAlive = false;
  let dbMs = 0;
  try {
    const supabase = createAdminClient();
    const dbStart = Date.now();
    const { error } = await supabase.from("plans").select("id").limit(1);
    dbMs = Date.now() - dbStart;
    dbAlive = !error;
  } catch {
    dbAlive = false;
  }

  checks.database = dbAlive
    ? { status: "ok", ms: dbMs }
    : { status: "error", detail: "db_unreachable" };
```

Reasoning:
- `dbStart` is declared inside the `try` (right before the call), so it's always captured fresh. If the call throws, `dbMs` stays 0 and we report `{ status: "error" }` (no `ms` field, matching existing behavior on error).
- `dbMs` is hoisted to the outer scope so the `checks.database = ...` ternary can read it.
- The outer `start` (line 36) is unchanged — `responseMs` (line 96) still reads `Date.now() - start`.
</action>

<verify>
```bash
grep -c 'const dbStart' campanha-ia/src/app/api/health/route.ts   # expect 1
grep -c 'dbMs' campanha-ia/src/app/api/health/route.ts             # expect ≥ 3 (declaration + assignment + read)
grep -c 'Date.now() - dbStart' campanha-ia/src/app/api/health/route.ts  # expect 1
grep -c 'Date.now() - start' campanha-ia/src/app/api/health/route.ts    # expect 1 (responseMs unchanged)

# Order check: dbStart MUST appear before the supabase.from() call in source order
node -e "const c=require('fs').readFileSync('campanha-ia/src/app/api/health/route.ts','utf8'); const a=c.indexOf('const dbStart'); const b=c.indexOf('supabase.from'); if(a<0||b<0||a>b){console.error('order wrong: dbStart='+a+' supabase.from='+b);process.exit(1)} else console.log('OK: dbStart at '+a+', supabase.from at '+b)"

cd campanha-ia && npx tsc --noEmit && echo TYPECHECK_OK
```
</verify>

### Task 2 (BONUS — D-21 spirit): symmetric ms timer for storage check

<read_first>
- campanha-ia/src/app/api/health/route.ts (lines 77-83 — the storage check)
</read_first>

<action>
Find the current storage check (lines 77-83):
```typescript
  try {
    const supabase = createAdminClient();
    const { error } = await supabase.storage.from("product-photos").list("", { limit: 1 });
    checks.storage = error ? { status: "warning", detail: "storage_error" } : { status: "ok" };
  } catch {
    checks.storage = { status: "warning", detail: "storage_error" };
  }
```

Replace with:
```typescript
  // D-21: symmetric latency timer for storage check (matches DB pattern above).
  // ops dashboards can graph DB ms vs storage ms to spot regressions independently.
  let storageMs = 0;
  try {
    const supabase = createAdminClient();
    const storageStart = Date.now();
    const { error } = await supabase.storage.from("product-photos").list("", { limit: 1 });
    storageMs = Date.now() - storageStart;
    checks.storage = error ? { status: "warning", detail: "storage_error" } : { status: "ok", ms: storageMs };
  } catch {
    checks.storage = { status: "warning", detail: "storage_error" };
  }
```

Reasoning:
- Mirrors the DB pattern from Task 1 exactly (declare `storageMs = 0` outside try, capture `storageStart` inside, write to checks).
- On warning (Supabase storage returned an error but didn't throw), we keep `detail: "storage_error"` and OMIT `ms` to match the existing failure shape.
- On success, we add `ms: storageMs` — the bonus signal.
- `checks` type already permits `ms?: number` (line 48: `Record<string, { status: ..., ms?: number, detail?: string }>`), so no type change needed.
</action>

<verify>
```bash
grep -c 'storageMs\|storageStart' campanha-ia/src/app/api/health/route.ts   # expect ≥ 3
grep -c 'ms: storageMs' campanha-ia/src/app/api/health/route.ts             # expect 1

cd campanha-ia && npx tsc --noEmit && echo TYPECHECK_OK
```
</verify>

## Files modified

- `campanha-ia/src/app/api/health/route.ts` — DB latency timer moved to immediately before the Supabase call (Task 1); storage check gets symmetric ms timer (Task 2 — bonus aligned with D-21 spirit)

## Why this matters (risk if skipped)

The deep-check `/api/health` is consumed by the internal admin panel (per the file's docstring) and by future ops dashboards. The current `checks.database.ms` is a lie — a 50ms DB query reports as 200ms because the timer started before auth + admin-client construction. When ops sees DB latency spike, they currently can't tell whether DB is actually slow or whether the route handler is slow. Fix is 2 lines + a comment; the bonus storage timer adds another high-value signal for ~3 lines.
