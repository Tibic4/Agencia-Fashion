---
phase: 01-ai-pipeline-hardening
plan: 07
type: execute
wave: 1
depends_on: []
files_modified:
  - campanha-ia/supabase/migrations/20260503_120100_add_campaign_regenerate_reason.sql
  - campanha-ia/src/lib/db/index.ts
  - campanha-ia/src/app/api/campaign/[id]/regenerate/route.ts
  - campanha-ia/src/app/admin/custos/page.tsx
autonomous: false
requirements: [D-01, D-02, D-03, D-04]
user_setup: []

must_haves:
  truths:
    - "campaigns table has a regenerate_reason text column with a check constraint covering 5 enum values"
    - "POST /api/campaign/[id]/regenerate accepts a {reason: string} body and persists it to campaigns.regenerate_reason"
    - "Regenerate that captures a reason does NOT consume a credit (per D-03 — reason capture is FREE this phase)"
    - "is_favorited remains untouched (per D-02 — no thumbs-down)"
    - "/admin/custos surfaces aggregate regenerate_reason counts (this month, last month, by category) in a dedicated tile"
    - "No alerts, no LLM judging, no prompt rollbacks — capture and surface only (per D-04)"
  artifacts:
    - path: "campanha-ia/supabase/migrations/20260503_120100_add_campaign_regenerate_reason.sql"
      provides: "ALTER TABLE campaigns ADD COLUMN regenerate_reason text + CHECK constraint over 5 enum values"
      contains: "ADD COLUMN IF NOT EXISTS regenerate_reason text"
    - path: "campanha-ia/src/app/api/campaign/[id]/regenerate/route.ts"
      provides: "POST handler accepts {reason} body, validates against enum, persists to campaigns.regenerate_reason, skips credit increment if reason present"
    - path: "campanha-ia/src/app/admin/custos/page.tsx"
      provides: "Aggregate regenerate_reason tile (category counts for current month + delta vs last month)"
  key_links:
    - from: "POST /api/campaign/[id]/regenerate"
      to: "campaigns.regenerate_reason column"
      via: "supabase.from('campaigns').update({ regenerate_reason: reason })"
      pattern: "regenerate_reason"
    - from: "/admin/custos page"
      to: "campaigns.regenerate_reason aggregate"
      via: "supabase query: SELECT regenerate_reason, count(*) FROM campaigns WHERE created_at >= thisMonth GROUP BY regenerate_reason"
      pattern: "regenerate_reason"
---

<objective>
Land Phase 01's production-signal capture: (D-01) `regenerate_reason` enum on the campaigns table — `face_wrong | garment_wrong | copy_wrong | pose_wrong | other` — captured when a lojista clicks regenerate and chooses a reason; (D-02) keep `is_favorited` untouched (no thumbs-down — reason carries the actionable signal); (D-03) regenerate that captures reason is FREE this phase to maximize feedback density; (D-04) surface aggregate counts in `/admin/custos` for ad-hoc product-owner review.

Purpose: This is the first quality signal Phase 02's LLM-as-judge will correlate against. Without this, the entire eval roadmap is debugger-in-the-dark. The audit's "zero production quality signal" finding ends here. Per CONTEXT.md scope and D-04 strictly: capture-and-surface only — no alerts, no rollback runbooks, no LLM judging. Acting on signals is Phase 02 work.

Output: One DB migration; updated regenerate route accepting reason body; admin/custos page with a new aggregate tile; checkpoint for human review of the migration before applying to production.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/01-ai-pipeline-hardening/01-CONTEXT.md
@.planning/phases/01-ai-pipeline-hardening/01-AI-SPEC.md
@campanha-ia/supabase/migrations/00000000000000_baseline.sql
@campanha-ia/src/app/api/campaign/[id]/regenerate/route.ts
@campanha-ia/src/app/admin/custos/page.tsx
@campanha-ia/src/lib/db/index.ts

<interfaces>
Existing regenerate route surface (currently MODIFIED per git status — read first to confirm baseline before designing the schema change).

From campanha-ia/src/app/api/campaign/[id]/regenerate/route.ts (current state):

```ts
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse>;
// Currently:
// - Gates on env.FEATURE_REGENERATE_CAMPAIGN feature flag (returns 404 if off)
// - Auths via Clerk
// - Calls canRegenerate(id, store.id) and incrementRegenCount(id, store.id) from @/lib/db
// - Returns { success: true, data: { used, limit } } on success
// - Does NOT currently parse a request body
```

From campanha-ia/src/lib/db/index.ts (read this file in Task 2 — locate canRegenerate and incrementRegenCount to understand the credit-counting contract that D-03 modifies):

```ts
export async function canRegenerate(campaignId: string, storeId: string): Promise<{ allowed: boolean; used: number; limit: number }>;
export async function incrementRegenCount(campaignId: string, storeId: string): Promise<number>;
```

From campanha-ia/supabase/migrations/00000000000000_baseline.sql:78-104 (campaigns table — ADD COLUMN target):

```sql
CREATE TABLE IF NOT EXISTS public.campaigns (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL,
  -- ... many columns ...
  -- (no regenerate_reason column today)
);
```

From campanha-ia/src/app/admin/custos/page.tsx (read first 80 lines to understand the existing tile pattern; new tile follows same shape):
- Server component (`export const dynamic = "force-dynamic"`)
- Fetches via `createAdminClient()` + `supabase.from(...).select(...).gte(created_at, thisMonth)`
- Renders tiles using project styling (Tailwind, semantic tokens — no green palette per recent commit `e446cb3 fix(campanha-ia): swap green Tailwind palette for design system success token`)

Enum values locked by CONTEXT.md specifics:
- `face_wrong` (VTO identity drift)
- `garment_wrong` (color/wash/silhouette drift)
- `copy_wrong` (caption misses trigger / cliché / invents attribute)
- `pose_wrong` (pose poorly chosen for product)
- `other` (catch-all for product owner to investigate via the surfacing UI)

Per CONTEXT.md specifics: stored as text column with check constraint, NOT a Postgres enum (easier to add values later without migration dance).
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Create migration adding campaigns.regenerate_reason text column with CHECK constraint</name>
  <files>campanha-ia/supabase/migrations/20260503_120100_add_campaign_regenerate_reason.sql</files>
  <action>Create the migration with this exact SQL content (filename uses 120100 to sort after Plan 01's 120000 metadata migration). The SQL:

- ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS regenerate_reason text;
- ALTER TABLE public.campaigns DROP CONSTRAINT IF EXISTS campaigns_regenerate_reason_check;
- ALTER TABLE public.campaigns ADD CONSTRAINT campaigns_regenerate_reason_check CHECK (regenerate_reason IS NULL OR regenerate_reason IN ('face_wrong', 'garment_wrong', 'copy_wrong', 'pose_wrong', 'other'));
- CREATE INDEX IF NOT EXISTS idx_campaigns_regenerate_reason_created_at ON public.campaigns (regenerate_reason, created_at DESC) WHERE regenerate_reason IS NOT NULL;

Add a 4-line SQL comment block at the top citing D-01/D-02/D-03 and the "capture-and-surface only" boundary from D-04.

The CHECK constraint allows NULL (every campaign starts with NULL because regeneration hasn't happened yet). The partial index keeps the index footprint tiny — at expected volume (~5-10% of campaigns regenerated, of which only the reason-providing fraction ends up non-NULL), the index covers the entire /admin/custos aggregate query path.

DO NOT create a Postgres ENUM type. CONTEXT.md specifics explicitly says "Stored as text column with check constraint, not Postgres enum (easier to add values)".</action>
  <verify>
    <automated>test -f campanha-ia/supabase/migrations/20260503_120100_add_campaign_regenerate_reason.sql &amp;&amp; grep -q "ADD COLUMN IF NOT EXISTS regenerate_reason text" campanha-ia/supabase/migrations/20260503_120100_add_campaign_regenerate_reason.sql &amp;&amp; grep -q "CHECK" campanha-ia/supabase/migrations/20260503_120100_add_campaign_regenerate_reason.sql &amp;&amp; grep -q "face_wrong.*garment_wrong.*copy_wrong.*pose_wrong.*other" campanha-ia/supabase/migrations/20260503_120100_add_campaign_regenerate_reason.sql</automated>
  </verify>
  <done>Migration file exists; ALTER TABLE adds regenerate_reason text; CHECK constraint references all 5 enum values; partial index on (regenerate_reason, created_at DESC) WHERE regenerate_reason IS NOT NULL; no CREATE TYPE ENUM statement.</done>
</task>

<task type="auto">
  <name>Task 2: Update regenerate route + db helper to capture reason and skip credit on capture</name>
  <files>campanha-ia/src/app/api/campaign/[id]/regenerate/route.ts, campanha-ia/src/lib/db/index.ts</files>
  <action>Modify the regenerate route to accept a JSON body with optional `reason` field, validate against the enum, persist to `campaigns.regenerate_reason`, and skip the credit increment when a reason is captured (per D-03).

Step 2a — In `campanha-ia/src/lib/db/index.ts`, add a new helper `setRegenerateReason`:

```ts
const VALID_REGENERATE_REASONS = ["face_wrong", "garment_wrong", "copy_wrong", "pose_wrong", "other"] as const;
export type RegenerateReason = typeof VALID_REGENERATE_REASONS[number];

export function isValidRegenerateReason(value: unknown): value is RegenerateReason {
  return typeof value === "string" &amp;&amp; (VALID_REGENERATE_REASONS as readonly string[]).includes(value);
}

/**
 * D-01: persist the lojista's regeneration reason on the campaign row.
 * Idempotent — overwrite is fine (lojista may regenerate multiple times;
 * latest reason wins). Does NOT touch is_favorited (D-02).
 */
export async function setRegenerateReason(
  campaignId: string,
  storeId: string,
  reason: RegenerateReason,
): Promise<void> {
  const { createAdminClient } = await import("@/lib/supabase/admin");
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("campaigns")
    .update({ regenerate_reason: reason })
    .eq("id", campaignId)
    .eq("store_id", storeId);
  if (error) throw new Error(`setRegenerateReason failed: ${error.message}`);
}
```

Step 2b — In `campanha-ia/src/app/api/campaign/[id]/regenerate/route.ts`:

1. Change the function signature from `POST(_req, ...)` to `POST(req: NextRequest, ...)` (the underscore was hiding the body — now we read it).

2. After the existing auth + store lookup, parse the optional reason body:
   ```ts
   let reason: RegenerateReason | null = null;
   try {
     const body = await req.json().catch(() => ({}));
     if (body &amp;&amp; "reason" in body) {
       if (!isValidRegenerateReason(body.reason)) {
         return NextResponse.json(
           { error: "reason inválido", code: "INVALID_REASON", validReasons: ["face_wrong", "garment_wrong", "copy_wrong", "pose_wrong", "other"] },
           { status: 400 },
         );
       }
       reason = body.reason;
     }
   } catch {
     // No body or invalid JSON — treat as no-reason regenerate (legacy path)
   }
   ```

3. Branch on the reason presence (D-03 — reason capture is FREE):
   ```ts
   if (reason) {
     // D-03: free regenerate when reason is captured. Skip canRegenerate +
     // incrementRegenCount entirely. Persist the reason and return success.
     await setRegenerateReason(id, store.id, reason);
     return NextResponse.json({
       success: true,
       data: { reason, free: true },
     });
   }

   // Legacy path: no reason → consume a credit
   const regen = await canRegenerate(id, store.id);
   if (!regen.allowed) { /* existing 403 path unchanged */ }
   const newCount = await incrementRegenCount(id, store.id);
   return NextResponse.json({
     success: true,
     data: { used: newCount, limit: regen.limit, free: false },
   });
   ```

4. Add the import: `import { setRegenerateReason, isValidRegenerateReason, type RegenerateReason } from "@/lib/db";`.

5. Confirm `is_favorited` is NOT touched in this route (D-02). Grep the file: `grep -c "is_favorited" campanha-ia/src/app/api/campaign/[id]/regenerate/route.ts` MUST return 0.

The feature flag (`regenerateEnabled()`) gate stays in place at the top — D-01..D-04 land BEHIND `FEATURE_REGENERATE_CAMPAIGN`. When the flag is off the route still returns 404 (no behavior change to non-feature-flagged users).

Run `cd campanha-ia &amp;&amp; npx tsc --noEmit` to confirm types are clean.</action>
  <verify>
    <automated>cd campanha-ia &amp;&amp; npx tsc --noEmit &amp;&amp; grep -c "setRegenerateReason\|isValidRegenerateReason" src/lib/db/index.ts &amp;&amp; grep -q "free: true" src/app/api/campaign/[id]/regenerate/route.ts &amp;&amp; bash -c '! grep -q "is_favorited" src/app/api/campaign/[id]/regenerate/route.ts'</automated>
  </verify>
  <done>Two new helpers exported from db/index.ts; route parses reason body, validates via enum, persists via setRegenerateReason, returns `{ free: true }` when reason captured; legacy no-reason path still consumes credit; is_favorited untouched in the route; tsc clean.</done>
</task>

<task type="auto">
  <name>Task 3: Add aggregate regenerate_reason tile to /admin/custos</name>
  <files>campanha-ia/src/app/admin/custos/page.tsx</files>
  <action>Add a new aggregate tile to the admin/custos page surfacing regenerate_reason counts. The tile fits alongside the existing "byProvider" / "byStep" / "byDay" tiles, following the same fetch + render pattern.

Step 3a — Inside the `getCosts()` function (or create a sibling `getRegenerateReasons()` if you prefer separation), add to the `Promise.all([...])` block at line ~22:

```ts
supabase
  .from("campaigns")
  .select("regenerate_reason, created_at")
  .gte("created_at", thisMonth)
  .not("regenerate_reason", "is", null),
supabase
  .from("campaigns")
  .select("regenerate_reason")
  .gte("created_at", lastMonth)
  .lte("created_at", lastMonthEnd)
  .not("regenerate_reason", "is", null),
```

Destructure these into `thisMonthReasons` and `lastMonthReasons` from the await result.

Step 3b — Aggregate in the same style as `byProvider`:

```ts
const REASON_LABELS: Record<string, string> = {
  face_wrong: "Rosto errado",
  garment_wrong: "Peça errada",
  copy_wrong: "Copy errado",
  pose_wrong: "Pose errada",
  other: "Outro",
};

const reasonCountsThisMonth: Record<string, number> = {};
(thisMonthReasons ?? []).forEach((row) => {
  const r = row.regenerate_reason as string;
  reasonCountsThisMonth[r] = (reasonCountsThisMonth[r] ?? 0) + 1;
});

const reasonCountsLastMonth: Record<string, number> = {};
(lastMonthReasons ?? []).forEach((row) => {
  const r = row.regenerate_reason as string;
  reasonCountsLastMonth[r] = (reasonCountsLastMonth[r] ?? 0) + 1;
});

const totalReasonsThisMonth = Object.values(reasonCountsThisMonth).reduce((s, n) => s + n, 0);
const totalReasonsLastMonth = Object.values(reasonCountsLastMonth).reduce((s, n) => s + n, 0);
```

Pass these into the rendered JSX (return them from `getCosts()` along with the existing `byProvider`, `byStep`, etc.).

Step 3c — Render the tile. Place it visibly (top of the page near the existing budget tile makes most sense, since regenerate_reason is the primary new signal of Phase 01). Tile structure:

```tsx
<section className="rounded-lg border border-border bg-card p-4">
  <h2 className="text-lg font-semibold mb-3">Sinais de regeneração — este mês</h2>
  <p className="text-sm text-muted-foreground mb-4">
    Quantas vezes lojistas regeneraram uma campanha e qual foi o motivo. Use para
    investigar tendências de qualidade. (Captura e exibição apenas — Fase 02 trata alertas.)
  </p>
  <dl className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
    {(["face_wrong", "garment_wrong", "copy_wrong", "pose_wrong", "other"] as const).map((reason) => {
      const count = reasonCountsThisMonth[reason] ?? 0;
      const lastCount = reasonCountsLastMonth[reason] ?? 0;
      const delta = count - lastCount;
      return (
        <div key={reason} className="rounded border border-border bg-background p-3">
          <dt className="text-xs uppercase tracking-wide text-muted-foreground">{REASON_LABELS[reason]}</dt>
          <dd className="text-2xl font-bold mt-1">{count}</dd>
          <dd className="text-xs text-muted-foreground mt-1">
            {delta === 0 ? "= mês anterior" : delta &gt; 0 ? `+${delta} vs mês anterior` : `${delta} vs mês anterior`}
          </dd>
        </div>
      );
    })}
  </dl>
  <p className="text-xs text-muted-foreground mt-3">
    Total este mês: <strong>{totalReasonsThisMonth}</strong> · mês anterior: <strong>{totalReasonsLastMonth}</strong>
  </p>
</section>
```

Use the project's existing semantic Tailwind tokens (`border-border`, `bg-card`, `text-muted-foreground`) — DO NOT use raw green/red palette per recent commit `e446cb3 fix(campanha-ia): swap green Tailwind palette for design system success token`.

Use min-h-tap utility on any interactive child if you add one (per recent commit `475441b refactor(campanha-ia): consolidate tap targets to min-h-tap utility`). For this tile there are no interactive elements — display only.

Per D-04 boundary: do NOT add filtering UI, do NOT add date-range pickers, do NOT add export buttons. Tile is read-only ad-hoc surfacing for product owner. Phase 02 owns the deeper tooling.</action>
  <verify>
    <automated>cd campanha-ia &amp;&amp; npx tsc --noEmit &amp;&amp; grep -c "regenerate_reason" src/app/admin/custos/page.tsx | awk '{ exit ($1 &gt;= 4 ? 0 : 1) }' &amp;&amp; grep -q "Sinais de regeneração" src/app/admin/custos/page.tsx</automated>
  </verify>
  <done>Tile renders 5 reason categories with current-month count + delta vs last month + total summary; uses semantic Tailwind tokens (no raw green); is read-only (no filters / no export); tsc clean.</done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <what-built>Migration `20260503_120100_add_campaign_regenerate_reason.sql` is written but NOT applied to the remote Supabase project. Route + admin page changes are in code but the column does not exist yet — applying the route changes without the migration will cause `setRegenerateReason` to return a Supabase error on every reason capture, so the migration MUST land first.</what-built>
  <how-to-verify>
    1. Open the migration file and confirm the SQL: ALTER TABLE adds `regenerate_reason text`, CHECK constraint covers exactly the 5 values, partial index is on `(regenerate_reason, created_at DESC) WHERE regenerate_reason IS NOT NULL`.

    2. Apply the migration to the target Supabase environment:
       - Local: `cd campanha-ia &amp;&amp; supabase db reset` (dev only) or `supabase db push` against linked local project.
       - Remote: apply via Supabase MCP `apply_migration` tool, OR `supabase db push --linked` after `supabase link`.

    3. Verify the column + constraint exist via SQL Editor (or MCP `execute_sql`):
       ```sql
       SELECT column_name, data_type FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'campaigns' AND column_name = 'regenerate_reason';

       SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint
       WHERE conname = 'campaigns_regenerate_reason_check';
       ```
       Expected: one row each. CHECK definition lists the 5 enum values.

    4. Functional smoke (after migration applied):
       - With `FEATURE_REGENERATE_CAMPAIGN=1` set, generate a campaign in a non-prod environment.
       - From the browser devtools or `curl`, POST to `/api/campaign/{id}/regenerate` with `{"reason": "copy_wrong"}` body. Expected response: `{ success: true, data: { reason: "copy_wrong", free: true } }`.
       - POST without a body. Expected response: legacy path, `{ success: true, data: { used, limit, free: false } }`.
       - POST with invalid reason: `{"reason": "invalid"}`. Expected: 400 with code "INVALID_REASON".
       - Query `SELECT id, regenerate_reason FROM campaigns WHERE id = '<the test campaign id>';` — expect `regenerate_reason = 'copy_wrong'`.

    5. Visit `/admin/custos` (admin login required). Confirm the new "Sinais de regeneração — este mês" tile shows the test capture.
  </how-to-verify>
  <resume-signal>Type "applied" once the migration is live, the smoke POST returns `{ free: true }`, and the /admin/custos tile shows the captured reason. Type "rolled back" with a short note if you need to revert.</resume-signal>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Authenticated lojista → POST /api/campaign/[id]/regenerate | reason field is user-controlled untrusted input; validated against fixed enum |
| Admin user → /admin/custos | Server-component data fetch with admin guard; no user input affects the query shape |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-07-01 | Tampering | Lojista submits arbitrary reason string | mitigate | `isValidRegenerateReason` rejects anything outside the 5-value enum; route returns 400 BEFORE reaching DB; CHECK constraint is the second-line defense |
| T-07-02 | Information Disclosure | regenerate_reason aggregates exposed in /admin/custos | accept | Admin-only route (`requireAdmin` guard at line 10); no cross-store leakage (counts are global) |
| T-07-03 | Repudiation | Lojista regenerates without reason then claims they did | accept | reason is optional by design (legacy path preserved); no audit trail needed because regeneration is a free productivity action, not a financial event |
| T-07-04 | Elevation of Privilege | D-03 free-regenerate-on-reason could be gamed (always send a reason to skip credit limits) | accept | Documented as intentional this phase to maximize feedback density; Phase 02 will tighten if abuse emerges. Free-regenerate is gated behind `FEATURE_REGENERATE_CAMPAIGN` so blast radius is bounded to flagged users |
| T-07-05 | DoS | Aggregate query on campaigns table without index | mitigate | Partial index `idx_campaigns_regenerate_reason_created_at` covers the WHERE regenerate_reason IS NOT NULL aggregate query path |
</threat_model>

<verification>
1. `cd campanha-ia &amp;&amp; npx tsc --noEmit` returns zero errors.
2. `cd campanha-ia &amp;&amp; npm test -- --run` exits 0.
3. `grep -c "regenerate_reason" campanha-ia/src/app/admin/custos/page.tsx campanha-ia/src/app/api/campaign/[id]/regenerate/route.ts campanha-ia/src/lib/db/index.ts` returns ≥1 hit per file.
4. `grep -c "is_favorited" campanha-ia/src/app/api/campaign/[id]/regenerate/route.ts` returns 0 (D-02 untouched).
5. After migration applied: SQL `SELECT column_name FROM information_schema.columns WHERE table_name='campaigns' AND column_name='regenerate_reason'` returns 1 row.
6. After functional smoke: SQL aggregate matches the count rendered in /admin/custos tile.
</verification>

<success_criteria>
- Migration applied; `regenerate_reason text` column + CHECK constraint + partial index live in production target environment.
- Route accepts optional `reason` body, validates, persists, skips credit when reason present (D-03), preserves legacy no-reason credit path.
- `is_favorited` untouched in the route (D-02).
- `/admin/custos` shows aggregate counts per category for current month + delta vs last month (D-04).
- No alerts, no LLM judging, no rollback runbook (per D-04 — capture-and-surface only).
</success_criteria>

<output>
After completion, create `.planning/phases/01-ai-pipeline-hardening/01-07-SUMMARY.md` documenting:
- Migration filename and the 5 enum values exactly as written into the CHECK constraint.
- The route's new request shape (`{reason?: string}`) and the response shapes for both branches (`{free: true}` vs `{free: false}`).
- A redacted screenshot or text description of the new /admin/custos tile after the smoke test.
- Confirmation grep that `is_favorited` was not touched in any modified file.
- Note that Phase 02 (LLM-as-judge wiring + alerts on `face_wrong > 5%` week-over-week) is the natural next step; Phase 01's work is the data pipe.
</output>
