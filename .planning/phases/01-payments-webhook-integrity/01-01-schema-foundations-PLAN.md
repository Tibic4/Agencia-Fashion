---
plan_id: 01-01
phase: 1
title: Schema Foundations — subscription_status ENUM, webhook_events, stores.updated_at trigger
wave: 1
depends_on: []
files_modified:
  - campanha-ia/supabase/migrations/20260503_180000_add_subscription_status_enum.sql
  - campanha-ia/supabase/migrations/20260503_180100_backfill_subscription_status.sql
  - campanha-ia/supabase/migrations/20260503_180200_add_stores_updated_at_trigger.sql
  - campanha-ia/supabase/migrations/20260503_180300_create_webhook_events.sql
autonomous: true
requirements: [C-1, C-2, C-3, C-4, H-7, H-10, H-11, M-11, M-12, M-18, L-11]
must_haves:
  truths:
    - "stores has subscription_status ENUM column with default 'active', NOT NULL after backfill"
    - "stores has BEFORE UPDATE trigger calling update_updated_at_column()"
    - "webhook_events table exists with PRIMARY KEY (provider, event_id) and RLS enabled (no policies)"
    - "All migrations are non-blocking (no full table rewrite, no long lock on stores)"
    - "Backfill is idempotent — re-running the UPDATE produces the same result"
  acceptance:
    - "supabase migration apply on a fresh DB succeeds with zero errors"
    - "After migration B, every row in stores has subscription_status IN ('active','cancelled','grace','expired')"
    - "webhook_events table rejects client (anon/authenticated) reads — only service_role can SELECT/INSERT"
---

# Plan 01-01: Schema Foundations

## Objective

Land the four non-blocking Postgres migrations that the rest of Phase 1 depends on:

1. `subscription_status` ENUM type + column on `stores` (D-01, D-03 step 1)
2. Backfill `subscription_status` from existing `mp_status` + `mercadopago_subscription_id` + `period_end` (D-02)
3. `BEFORE UPDATE` trigger on `stores` wiring `update_updated_at_column()` (R-02 — makes D-09 / D-10 robust)
4. `webhook_events` dedup table with service-role-only RLS posture (D-05)

This plan ships ONLY DDL — no application code. Wave 2 plans depend on these tables/columns existing.

## Truths the executor must respect

- Production has paying users — every migration MUST be metadata-only or row-level-fast. NO full ALTER TABLE rewrites.
- `mp_status` column STAYS (D-04). Do not drop it.
- ENUM type creation is wrapped in `DO $$ ... EXCEPTION WHEN duplicate_object THEN NULL; END $$;` for idempotent re-runs.
- New table `webhook_events` follows the `push_tokens` / `subscriptions` pattern: RLS enabled, no policies, comment documents service-role-only access.
- Migration filenames use the existing `YYYYMMDD_HHMMSS_<slug>.sql` convention. Use `20260503_180000`, `20260503_180100`, `20260503_180200`, `20260503_180300` as the timestamp progression.

## Tasks

### Task 1: Create `subscription_status` ENUM + add column on `stores`

<read_first>
- campanha-ia/supabase/migrations/00000000000000_baseline.sql (lines 1-50, lines 230-260 — stores schema)
- campanha-ia/supabase/migrations/20260424_harden_rpcs_and_constraints.sql (DDL conventions)
- .planning/phases/01-payments-webhook-integrity/01-CONTEXT.md (D-01, D-03)
</read_first>

<action>
Create file `campanha-ia/supabase/migrations/20260503_180000_add_subscription_status_enum.sql` with EXACTLY this content:

```sql
-- ═══════════════════════════════════════════════════════════
-- Phase 1 / 01-01 — D-01: subscription_status ENUM
-- Non-blocking: ENUM creation + ADD COLUMN with DEFAULT (metadata-only on PG 11+)
-- Migration B (20260503_180100) backfills; Migration A leaves NOT NULL DEFAULT 'active'
-- ═══════════════════════════════════════════════════════════

DO $$ BEGIN
  CREATE TYPE public.subscription_status AS ENUM ('active', 'cancelled', 'grace', 'expired');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.stores
  ADD COLUMN IF NOT EXISTS subscription_status public.subscription_status NOT NULL DEFAULT 'active';

COMMENT ON COLUMN public.stores.subscription_status IS
  'Phase 1 D-01: explicit billing state. Replaces "null sub_id on cancel" semantics. Values: active|cancelled|grace|expired. Backfilled by 20260503_180100. mp_status kept in parallel during transition (D-04, parking lot).';
```
</action>

<acceptance_criteria>
- File exists at exact path `campanha-ia/supabase/migrations/20260503_180000_add_subscription_status_enum.sql`
- File contains `CREATE TYPE public.subscription_status AS ENUM` exactly once
- File contains `ADD COLUMN IF NOT EXISTS subscription_status public.subscription_status NOT NULL DEFAULT 'active'`
- File contains a `COMMENT ON COLUMN public.stores.subscription_status` line referencing D-01 and D-04
- File does NOT contain `DROP` or `ALTER TYPE` or `DELETE FROM`
- After running this migration, `\d public.stores` shows `subscription_status` column with type `subscription_status` and default `'active'::subscription_status`
</acceptance_criteria>

---

### Task 2: Backfill `subscription_status` from existing state

<read_first>
- .planning/phases/01-payments-webhook-integrity/01-RESEARCH.md (R-04 backfill SQL)
- .planning/phases/01-payments-webhook-integrity/01-CONTEXT.md (D-02)
- campanha-ia/src/app/api/cron/downgrade-expired/route.ts (existing downgrade logic — backfill must mirror it)
- campanha-ia/supabase/migrations/00000000000000_baseline.sql (plans table — confirm `name = 'gratis'` is the free plan slug)
</read_first>

<action>
Create file `campanha-ia/supabase/migrations/20260503_180100_backfill_subscription_status.sql` with EXACTLY this content:

```sql
-- ═══════════════════════════════════════════════════════════
-- Phase 1 / 01-01 — D-02: backfill subscription_status from mp_status + sub_id + period_end
-- Single SQL statement, idempotent (re-runnable). Mirrors cron/downgrade-expired logic.
-- ═══════════════════════════════════════════════════════════

UPDATE public.stores SET subscription_status = CASE
  -- Free plan or never subscribed → 'expired' (no premium to lose)
  WHEN plan_id = (SELECT id FROM public.plans WHERE name = 'gratis') THEN 'expired'::public.subscription_status
  -- Has active sub_id → 'active'
  WHEN mercadopago_subscription_id IS NOT NULL THEN 'active'::public.subscription_status
  -- No sub_id but premium plan with valid period → 'cancelled' (in grace/until-period_end)
  WHEN EXISTS (
    SELECT 1 FROM public.store_usage u
    WHERE u.store_id = stores.id
      AND u.period_end >= CURRENT_DATE
  ) THEN 'cancelled'::public.subscription_status
  -- Premium plan, no sub_id, period expired → 'expired'
  ELSE 'expired'::public.subscription_status
END
WHERE TRUE; -- explicit: backfill every row idempotently
```

Do NOT add an `ALTER COLUMN ... DROP DEFAULT` or `SET NOT NULL` here — both are already in place from migration A.
</action>

<acceptance_criteria>
- File exists at exact path `campanha-ia/supabase/migrations/20260503_180100_backfill_subscription_status.sql`
- File contains a single `UPDATE public.stores SET subscription_status = CASE ... END WHERE TRUE;` statement
- File CASE arm references `plans.name = 'gratis'` (matches existing free plan slug per baseline)
- File CASE arm references `store_usage` with `u.period_end >= CURRENT_DATE`
- File does NOT contain `ALTER TABLE`, `ALTER COLUMN`, `DROP`, `CREATE TYPE`
- After this migration runs, query `SELECT COUNT(*) FROM public.stores WHERE subscription_status IS NULL` returns 0
- Re-running the migration produces no change (idempotent — every CASE branch is deterministic from current state)
</acceptance_criteria>

---

### Task 3: Add `BEFORE UPDATE` trigger on `stores` for `updated_at`

<read_first>
- campanha-ia/supabase/migrations/00000000000000_baseline.sql (lines 576-586 — `update_updated_at_column` function definition exists, no trigger wired)
- campanha-ia/supabase/migrations/20260427_subscriptions.sql (line 54 — example pattern for a `set_updated_at` trigger)
- .planning/phases/01-payments-webhook-integrity/01-RESEARCH.md (R-02 — explains why this is needed)
- .planning/phases/01-payments-webhook-integrity/01-CONTEXT.md (D-09, D-10)
</read_first>

<action>
Create file `campanha-ia/supabase/migrations/20260503_180200_add_stores_updated_at_trigger.sql` with EXACTLY this content:

```sql
-- ═══════════════════════════════════════════════════════════
-- Phase 1 / 01-01 — R-02: wire update_updated_at_column() to stores
-- Makes D-09 (optimistic lock via updated_at) robust without auditing every writer.
-- The function exists in baseline (line 576-586) but no trigger wires it to stores.
-- Today some paths (consumeCredit fallback, addCreditsToStore fallback, generate refund branch)
-- update stores without setting updated_at manually — the trigger closes that gap.
-- ═══════════════════════════════════════════════════════════

DROP TRIGGER IF EXISTS stores_set_updated_at ON public.stores;
CREATE TRIGGER stores_set_updated_at
  BEFORE UPDATE ON public.stores
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
```
</action>

<acceptance_criteria>
- File exists at exact path `campanha-ia/supabase/migrations/20260503_180200_add_stores_updated_at_trigger.sql`
- File contains `DROP TRIGGER IF EXISTS stores_set_updated_at ON public.stores;`
- File contains `CREATE TRIGGER stores_set_updated_at BEFORE UPDATE ON public.stores FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();`
- After migration runs: `SELECT tgname FROM pg_trigger WHERE tgrelid = 'public.stores'::regclass` returns a row with `tgname = 'stores_set_updated_at'`
- Test (psql or RPC): `UPDATE public.stores SET name = name WHERE id = '<some-id>'` — select `updated_at` before+after, asserts after > before
</acceptance_criteria>

---

### Task 4: Create `webhook_events` dedup table

<read_first>
- .planning/phases/01-payments-webhook-integrity/01-CONTEXT.md (D-05, D-06, D-07, D-08)
- .planning/phases/01-payments-webhook-integrity/01-RESEARCH.md (R-03)
- campanha-ia/supabase/migrations/20260427_push_tokens.sql (RLS-enabled-no-policies pattern)
- campanha-ia/supabase/migrations/20260424_add_plan_payments_applied.sql (similar dedup table pattern — see RLS shape)
</read_first>

<action>
Create file `campanha-ia/supabase/migrations/20260503_180300_create_webhook_events.sql` with EXACTLY this content:

```sql
-- ═══════════════════════════════════════════════════════════
-- Phase 1 / 01-01 — D-05/D-06/D-07/D-08: webhook_events dedup table
-- Provider+event_id PK gives crash-safe dedup for MP, Clerk, Google Play RTDN.
-- Pattern: handler INSERTs first; ON CONFLICT (PK violation 23505) → duplicate, return 200.
-- payload kept JSONB for forensics (D-08; retention is parking-lot, not M1).
-- RLS enabled with NO policies → only service_role bypass-RLS can read/write.
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.webhook_events (
  provider     TEXT NOT NULL,
  event_id     TEXT NOT NULL,
  received_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  payload      JSONB,
  processed_at TIMESTAMPTZ,
  PRIMARY KEY (provider, event_id)
);

ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;
-- INTENTIONAL: no policies created. Service-role bypasses RLS; anon/authenticated get zero access.
-- Matches push_tokens / subscriptions pattern (20260427_*.sql).

CREATE INDEX IF NOT EXISTS idx_webhook_events_received_at
  ON public.webhook_events (received_at DESC);

COMMENT ON TABLE public.webhook_events IS
  'Phase 1 D-05: provider+event_id dedup for MP / Clerk / Google Play RTDN. Service-role-only writes; anon/authenticated have zero access (RLS enabled, no policies). Retention policy: parking-lot (not M1).';
```
</action>

<acceptance_criteria>
- File exists at exact path `campanha-ia/supabase/migrations/20260503_180300_create_webhook_events.sql`
- File contains `CREATE TABLE IF NOT EXISTS public.webhook_events`
- File defines columns: `provider TEXT NOT NULL`, `event_id TEXT NOT NULL`, `received_at TIMESTAMPTZ NOT NULL DEFAULT now()`, `payload JSONB`, `processed_at TIMESTAMPTZ`
- File contains `PRIMARY KEY (provider, event_id)` exactly once
- File contains `ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;`
- File does NOT contain `CREATE POLICY` (intentional — service-role-only access)
- After migration runs: `SELECT count(*) FROM pg_policies WHERE tablename = 'webhook_events'` returns 0
- After migration runs: `INSERT INTO public.webhook_events (provider, event_id, payload) VALUES ('test', 't1', '{}'::jsonb)` succeeds the first time, raises 23505 unique_violation the second time
</acceptance_criteria>

---

### Task 5: [BLOCKING] Schema push to remote Supabase

<read_first>
- .planning/PROJECT.md (production with paying users — confirms why this is blocking)
- .planning/phases/01-payments-webhook-integrity/01-RESEARCH.md (R-10 — workflow §5.7 schema push gate)
- campanha-ia/supabase/config.toml (if exists — Supabase project linkage)
</read_first>

<action>
Run the Supabase schema push to apply migrations 20260503_180000, 20260503_180100, 20260503_180200, and 20260503_180300 to the remote database.

Command (non-TTY):
```bash
cd campanha-ia
SUPABASE_ACCESS_TOKEN=$SUPABASE_ACCESS_TOKEN supabase db push
```

If the Supabase MCP is wired (per project memory), prefer:
- `mcp__supabase__list_migrations` — confirm pending list shows the four new files
- `mcp__supabase__apply_migration` — apply each in order (20260503_180000 → 20260503_180100 → 20260503_180200 → 20260503_180300)

Expected ordering: A → B → C → D (created table for D depends on nothing other than baseline).

Verify post-push state:
- `SELECT typname FROM pg_type WHERE typname = 'subscription_status'` → 1 row
- `SELECT column_name FROM information_schema.columns WHERE table_name = 'stores' AND column_name = 'subscription_status'` → 1 row
- `SELECT tgname FROM pg_trigger WHERE tgrelid = 'public.stores'::regclass AND tgname = 'stores_set_updated_at'` → 1 row
- `SELECT to_regclass('public.webhook_events')` → not null
- `SELECT COUNT(*) FROM public.stores WHERE subscription_status IS NULL` → 0
</action>

<acceptance_criteria>
- All four migration files apply cleanly (no error in supabase db push output)
- Post-push, `subscription_status` ENUM type exists (psql `\dT subscription_status` shows ENUM with 4 labels)
- Post-push, `stores.subscription_status` column exists and every row is non-NULL
- Post-push, `stores_set_updated_at` trigger exists on `public.stores`
- Post-push, `public.webhook_events` table exists with 0 rows and 0 policies
- Migration is non-blocking: monitoring during push shows no long lock on `public.stores` (column ADD with DEFAULT and CREATE TRIGGER are metadata-only)
- If the executor cannot push (auth missing, env not set), the task is marked `autonomous: false` for manual operator intervention — DO NOT skip; downstream waves are blocked without these objects in prod
</acceptance_criteria>

---

## Verification

After all 5 tasks complete:

1. Migration files lint cleanly: `for f in campanha-ia/supabase/migrations/20260503_18*.sql; do psql --dry-run -f "$f"; done` (or use Supabase's parser).
2. Apply to a fresh local supabase (`supabase db reset`) — all migrations apply with zero errors.
3. Backfill verification: query `SELECT subscription_status, COUNT(*) FROM public.stores GROUP BY 1` shows reasonable distribution (not 100% in one bucket unless DB is fresh).
4. Trigger verification: manually `UPDATE public.stores SET name = name WHERE id = (SELECT id FROM public.stores LIMIT 1) RETURNING updated_at` — observe `updated_at` increased.
5. Dedup verification: insert the same `(provider, event_id)` twice — second insert fails with PostgreSQL error code 23505.

## must_haves

```yaml
truths:
  - subscription_status_enum_exists
  - stores_subscription_status_column_present_not_null
  - stores_updated_at_trigger_wired
  - webhook_events_table_exists_with_rls_no_policies
  - all_migrations_non_blocking_on_production
acceptance:
  - supabase_db_push_succeeds
  - backfill_no_null_rows
  - duplicate_webhook_event_insert_raises_23505
  - update_stores_bumps_updated_at_via_trigger
```
