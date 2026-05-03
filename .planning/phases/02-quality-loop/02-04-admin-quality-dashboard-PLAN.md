---
phase: 02-quality-loop
plan: 04
type: execute
wave: 3
depends_on: [03]
files_modified:
  - campanha-ia/src/app/admin/quality/page.tsx
  - campanha-ia/src/app/admin/quality/page.test.tsx
autonomous: true
requirements: [D-21]

must_haves:
  truths:
    - "Admin can navigate to /admin/quality and see a dashboard companion to /admin/custos"
    - "Dashboard renders a 4-tile grid (mirroring /admin/custos card pattern) with 7-day rolling means for naturalidade, conversao, clareza, aprovacao_meta + WoW delta arrows"
    - "Page renders empty-state cleanly when campaign_scores has 0 rows (no judge data yet) — does NOT crash"
    - "Per-prompt_version aggregate table shows top 10 prompt SHAs by row count, with mean per dimension, sortable by any dimension"
    - "Top 10 worst-rated last 7 days table shows campaign IDs + judge justificativa snippets (truncated to 100 chars)"
    - "prompt_version × regenerate_reason correlation matrix renders (heatmap-style) — reads from vw_prompt_version_regen_correlation if present, falls back to inline JOIN if view does not exist yet"
    - "All admin auth/redirect rules from /admin/custos preserved (requireAdmin → redirect /gerar)"
  artifacts:
    - path: "campanha-ia/src/app/admin/quality/page.tsx"
      provides: "Server component rendering the 4-section dashboard"
      contains: "/admin/quality"
    - path: "campanha-ia/src/app/admin/quality/page.test.tsx"
      provides: "Vitest test asserting the page renders empty-state when campaign_scores is empty"
  key_links:
    - from: "campanha-ia/src/app/admin/quality/page.tsx"
      to: "Supabase campaign_scores table"
      via: "supabase.from('campaign_scores').select('*').gte('created_at', sevenDaysAgo)"
      pattern: "campaign_scores"
    - from: "campanha-ia/src/app/admin/quality/page.tsx"
      to: "Supabase api_cost_logs.metadata.prompt_version"
      via: "supabase.from('api_cost_logs').select('campaign_id, metadata').eq('action', 'judge_quality')"
      pattern: "metadata->>?'prompt_version'|api_cost_logs"
    - from: "campanha-ia/src/app/admin/quality/page.tsx"
      to: "vw_prompt_version_regen_correlation (Plan 02-05)"
      via: "supabase.from('vw_prompt_version_regen_correlation').select('*') with try/catch fallback"
      pattern: "vw_prompt_version_regen_correlation"
---

<objective>
Build the `/admin/quality` companion page to `/admin/custos`. Phase 01 surfaced cost + regenerate_reason aggregates at `/admin/custos`; Phase 02 surfaces the LLM-as-judge output (6 dimensions × 7-day rolling mean × per-prompt_version drift) at `/admin/quality`. Implements D-21.

Visual contract: MIRROR `/admin/custos` (gray-900 palette, 4-card grid pattern). NO redesign — replace cost values with dimension means; replace regenerate_reason tile with per-prompt_version drift table. The user already learned the layout once; reusing it costs zero cognitive overhead.

Purpose: Make prompt-version × quality drift legible at-a-glance.
Output: New `/admin/quality/page.tsx` server component; basic empty-state test. Renders today even with zero campaign_scores rows (judge wiring just shipped — production data accumulates over hours, not seconds).
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/02-quality-loop/02-CONTEXT.md
@.planning/phases/02-quality-loop/02-03-SUMMARY.md

<interfaces>
<!-- The visual + structural template the new page mirrors -->

From campanha-ia/src/app/admin/custos/page.tsx (THE template — read in full before editing this plan's files):

Server-component shape (lines 1-25):
```typescript
import { createAdminClient } from "@/lib/supabase/admin";
import { formatDateTimeBR } from "@/lib/admin/format";
import { requireAdmin } from "@/lib/admin/guard";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";
export const revalidate = 0;

async function getCosts() {
  const admin = await requireAdmin();
  if (!admin.isAdmin) redirect("/gerar");
  const supabase = createAdminClient();
  // ...Promise.all of 5 supabase queries...
}
```

The 4-card grid pattern (read the JSX in /admin/custos for the exact Tailwind classes — typically `grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4`).

The regenerate_reason aggregate tile (post-D-04 of Phase 01) is the closest visual analog to what the new page renders. Mirror its layout (count + label + delta arrow).

From campanha-ia/supabase/migrations/00000000000000_baseline.sql lines 60-76 — campaign_scores schema (the read source). All 6 numeric columns are smallint NOT NULL in [1,5]; nivel_risco is text; melhorias is JSONB containing the 6 PT-BR justificativa_* strings (per Plan 02-03 setCampaignScores).

From Plan 02-03 SUMMARY (just completed):
- `setCampaignScores` writes to campaign_scores with `urgencia: 3` neutral midpoint (legacy column; ignore in dashboard).
- `nivel_risco='falha_judge'` is a sentinel — dashboard MUST exclude these rows from numeric aggregates (otherwise means are biased toward 1).

From Plan 02-05 (Wave 3, parallel — may or may not have landed by the time this page runs):
- `vw_prompt_version_regen_correlation` view JOINs api_cost_logs.metadata->>'prompt_version' WITH campaigns.regenerate_reason. If absent, this page's correlation matrix renders a "view not yet created" placeholder.
</interfaces>

@campanha-ia/src/app/admin/custos/page.tsx
@campanha-ia/src/lib/supabase/admin.ts
@campanha-ia/src/lib/admin/guard.ts
@campanha-ia/src/lib/admin/format.ts
@campanha-ia/supabase/migrations/00000000000000_baseline.sql
</context>

<tasks>

<task type="auto" tdd="false">
  <name>Task 1: Create /admin/quality/page.tsx (4-section server component, mirrors /admin/custos)</name>
  <files>campanha-ia/src/app/admin/quality/page.tsx</files>
  <read_first>
    - campanha-ia/src/app/admin/custos/page.tsx in FULL (the visual template — palette, grid classes, tile structure, Promise.all query pattern, alertLevel coloring)
    - campanha-ia/src/lib/admin/guard.ts (requireAdmin contract)
    - campanha-ia/src/lib/admin/format.ts (formatDateTimeBR + any number formatter for means)
    - campanha-ia/src/lib/supabase/admin.ts (createAdminClient signature)
    - .planning/phases/02-quality-loop/02-CONTEXT.md decision D-21 (4 sections enumerated)
    - .planning/phases/02-quality-loop/02-03-SUMMARY.md (where setCampaignScores wrote what; falha_judge sentinel handling)
    - campanha-ia/supabase/migrations/00000000000000_baseline.sql lines 60-76 (campaign_scores columns)
  </read_first>
  <action>
    Create `campanha-ia/src/app/admin/quality/page.tsx` as a server component. Structure mirrors `/admin/custos/page.tsx`:

    ```typescript
    import { createAdminClient } from "@/lib/supabase/admin";
    import { requireAdmin } from "@/lib/admin/guard";
    import { redirect } from "next/navigation";

    export const dynamic = "force-dynamic";
    export const revalidate = 0;

    type Dim = "naturalidade" | "conversao" | "clareza" | "aprovacao_meta" | "nota_geral";
    const DIMS: Dim[] = ["naturalidade", "conversao", "clareza", "aprovacao_meta", "nota_geral"];
    const DIM_LABELS: Record<Dim, string> = {
      naturalidade:   "Naturalidade",
      conversao:      "Conversão",
      clareza:        "Clareza",
      aprovacao_meta: "Aprovação Meta",
      nota_geral:     "Nota Geral",
    };

    async function getQualityData() {
      const admin = await requireAdmin();
      if (!admin.isAdmin) redirect("/gerar");

      const supabase = createAdminClient();
      const now = new Date();
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString();

      // Run all 4 queries in parallel.
      const [
        { data: scores7d },
        { data: scores14d },
        { data: judgeCostLogs },
        { data: correlation },
      ] = await Promise.all([
        // 1. Last 7 days of judge scores (for current means + worst-rated table)
        supabase
          .from("campaign_scores")
          .select("campaign_id, naturalidade, conversao, clareza, aprovacao_meta, nota_geral, nivel_risco, melhorias, created_at")
          .gte("created_at", sevenDaysAgo)
          .order("created_at", { ascending: false }),
        // 2. Last 14 days (for WoW delta — first 7 days = last week's baseline)
        supabase
          .from("campaign_scores")
          .select("naturalidade, conversao, clareza, aprovacao_meta, nota_geral, nivel_risco, created_at")
          .gte("created_at", fourteenDaysAgo)
          .lt("created_at", sevenDaysAgo),
        // 3. Judge cost logs for prompt_version aggregation
        supabase
          .from("api_cost_logs")
          .select("campaign_id, metadata")
          .eq("action", "judge_quality")
          .gte("created_at", sevenDaysAgo)
          .limit(1000),
        // 4. Correlation view (Plan 02-05) — try/catch fallback so page doesn't crash if view absent
        supabase
          .from("vw_prompt_version_regen_correlation")
          .select("*")
          .limit(50)
          .then((r) => r, () => ({ data: null, error: { message: "view not present" } })),
      ]);

      // Filter out falha_judge sentinel from numeric aggregates (D-02 from Plan 02-03)
      const valid7d = (scores7d ?? []).filter((r) => r.nivel_risco !== "falha_judge");
      const valid14d = (scores14d ?? []).filter((r) => r.nivel_risco !== "falha_judge");

      // Compute per-dimension 7-day means
      const meanForDim = (rows: typeof valid7d, dim: Dim): number | null => {
        if (rows.length === 0) return null;
        return rows.reduce((s, r) => s + (r[dim] as number), 0) / rows.length;
      };
      const means7d: Record<Dim, number | null> = Object.fromEntries(
        DIMS.map((d) => [d, meanForDim(valid7d, d)]),
      ) as Record<Dim, number | null>;
      const meansPrev7d: Record<Dim, number | null> = Object.fromEntries(
        DIMS.map((d) => [d, meanForDim(valid14d, d)]),
      ) as Record<Dim, number | null>;
      const wowDelta: Record<Dim, number | null> = Object.fromEntries(
        DIMS.map((d) => {
          const cur = means7d[d];
          const prev = meansPrev7d[d];
          return [d, cur !== null && prev !== null ? cur - prev : null];
        }),
      ) as Record<Dim, number | null>;

      // Per-prompt_version aggregate (top 10 by row count)
      // Join campaign_id from judgeCostLogs.metadata.prompt_version → scores7d
      const promptVersionByCampaign = new Map<string, string>();
      for (const log of judgeCostLogs ?? []) {
        const pv = (log.metadata as { prompt_version?: string } | null)?.prompt_version;
        if (log.campaign_id && pv) promptVersionByCampaign.set(log.campaign_id, pv);
      }
      const promptVersionStats = new Map<string, { count: number; sums: Record<Dim, number> }>();
      for (const r of valid7d) {
        const pv = promptVersionByCampaign.get(r.campaign_id);
        if (!pv) continue;
        const entry = promptVersionStats.get(pv) ?? {
          count: 0,
          sums: { naturalidade: 0, conversao: 0, clareza: 0, aprovacao_meta: 0, nota_geral: 0 },
        };
        entry.count += 1;
        for (const d of DIMS) entry.sums[d] += r[d] as number;
        promptVersionStats.set(pv, entry);
      }
      const promptVersionTable = Array.from(promptVersionStats.entries())
        .map(([pv, { count, sums }]) => ({
          prompt_version: pv,
          count,
          means: Object.fromEntries(DIMS.map((d) => [d, sums[d] / count])) as Record<Dim, number>,
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      // Top 10 worst-rated last 7 days (by nota_geral asc)
      const worstRated = [...valid7d]
        .sort((a, b) => (a.nota_geral as number) - (b.nota_geral as number))
        .slice(0, 10)
        .map((r) => ({
          campaign_id: r.campaign_id,
          nota_geral: r.nota_geral,
          nivel_risco: r.nivel_risco,
          // melhorias was set by setCampaignScores to { naturalidade, conversao, ... } PT-BR strings
          justificativa_snippet: ((r.melhorias as Record<string, string> | null)?.nota_geral ?? "").slice(0, 100),
        }));

      // Failure-mode counter (falha_judge separate so user can see "judge broken N times")
      const totalRows = (scores7d ?? []).length;
      const failureCount = totalRows - valid7d.length;

      return {
        means7d,
        wowDelta,
        promptVersionTable,
        worstRated,
        correlation: correlation as Array<Record<string, unknown>> | null,
        totalRows,
        validCount: valid7d.length,
        failureCount,
      };
    }

    function formatScore(v: number | null): string {
      return v === null ? "—" : v.toFixed(2);
    }

    function formatDelta(v: number | null): { text: string; color: string } {
      if (v === null) return { text: "—", color: "text-gray-500" };
      if (v > 0.05) return { text: `▲ +${v.toFixed(2)}`, color: "text-green-400" };
      if (v < -0.05) return { text: `▼ ${v.toFixed(2)}`, color: "text-red-400" };
      return { text: `→ ${v.toFixed(2)}`, color: "text-gray-400" };
    }

    export default async function QualityDashboardPage() {
      const data = await getQualityData();

      return (
        <div className="min-h-screen bg-gray-900 text-gray-100 p-6">
          <header className="mb-6">
            <h1 className="text-2xl font-bold">Qualidade — Últimos 7 dias</h1>
            <p className="text-sm text-gray-400 mt-1">
              Companheiro de /admin/custos. Scores do LLM-as-judge sobre as legendas geradas.
            </p>
            {data.totalRows === 0 && (
              <p className="mt-3 text-sm text-yellow-400">
                Nenhum score do judge nos últimos 7 dias. Aguarde o pipeline rodar (judge é assíncrono via Inngest, ~30s após a geração) ou verifique o dashboard do Inngest se nada chegar.
              </p>
            )}
            {data.failureCount > 0 && (
              <p className="mt-2 text-sm text-orange-400">
                ⚠ {data.failureCount} rodadas do judge falharam (nivel_risco='falha_judge'). Veja Sentry para causa.
              </p>
            )}
          </header>

          {/* SECTION 1 — 4-tile grid: 7-day mean per dimension + WoW delta */}
          <section className="mb-8">
            <h2 className="text-lg font-semibold mb-3">Médias 7 dias</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {(["naturalidade", "conversao", "clareza", "aprovacao_meta"] as const).map((dim) => {
                const delta = formatDelta(data.wowDelta[dim]);
                return (
                  <div key={dim} className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                    <p className="text-xs uppercase tracking-wide text-gray-400">{DIM_LABELS[dim]}</p>
                    <p className="text-3xl font-bold mt-2">{formatScore(data.means7d[dim])}</p>
                    <p className={`text-sm mt-1 ${delta.color}`}>{delta.text} vs semana anterior</p>
                  </div>
                );
              })}
            </div>
            {/* Bonus: nota_geral as a wider full-width tile */}
            <div className="mt-4 bg-gray-800 rounded-lg p-4 border border-gray-700">
              <p className="text-xs uppercase tracking-wide text-gray-400">{DIM_LABELS.nota_geral}</p>
              <p className="text-3xl font-bold mt-2">{formatScore(data.means7d.nota_geral)}</p>
              <p className={`text-sm mt-1 ${formatDelta(data.wowDelta.nota_geral).color}`}>
                {formatDelta(data.wowDelta.nota_geral).text} vs semana anterior
              </p>
              <p className="text-xs text-gray-500 mt-2">
                {data.validCount} campanhas válidas (rejeitadas: {data.failureCount})
              </p>
            </div>
          </section>

          {/* SECTION 2 — Per-prompt_version aggregate table */}
          <section className="mb-8">
            <h2 className="text-lg font-semibold mb-3">Por versão do prompt (top 10)</h2>
            {data.promptVersionTable.length === 0 ? (
              <p className="text-sm text-gray-500">Sem dados de prompt_version ainda.</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="text-left text-gray-400 border-b border-gray-700">
                  <tr>
                    <th className="py-2">Prompt SHA</th>
                    <th>N</th>
                    {DIMS.map((d) => (
                      <th key={d}>{DIM_LABELS[d]}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.promptVersionTable.map((row) => (
                    <tr key={row.prompt_version} className="border-b border-gray-800">
                      <td className="py-2 font-mono">{row.prompt_version}</td>
                      <td>{row.count}</td>
                      {DIMS.map((d) => (
                        <td key={d}>{row.means[d].toFixed(2)}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          {/* SECTION 3 — Top 10 worst-rated last 7 days */}
          <section className="mb-8">
            <h2 className="text-lg font-semibold mb-3">10 piores nos últimos 7 dias</h2>
            {data.worstRated.length === 0 ? (
              <p className="text-sm text-gray-500">Sem dados.</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="text-left text-gray-400 border-b border-gray-700">
                  <tr>
                    <th className="py-2">Campaign ID</th>
                    <th>Nota geral</th>
                    <th>Risco</th>
                    <th>Justificativa</th>
                  </tr>
                </thead>
                <tbody>
                  {data.worstRated.map((row) => (
                    <tr key={row.campaign_id} className="border-b border-gray-800">
                      <td className="py-2 font-mono text-xs">{row.campaign_id.slice(0, 8)}…</td>
                      <td>{row.nota_geral}</td>
                      <td>{row.nivel_risco}</td>
                      <td className="text-xs text-gray-300">{row.justificativa_snippet}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          {/* SECTION 4 — prompt_version × regenerate_reason correlation matrix */}
          <section>
            <h2 className="text-lg font-semibold mb-3">Correlação prompt × motivo de regeneração</h2>
            {data.correlation === null ? (
              <p className="text-sm text-gray-500">
                View `vw_prompt_version_regen_correlation` ainda não existe (Plan 02-05 cria via migração).
              </p>
            ) : data.correlation.length === 0 ? (
              <p className="text-sm text-gray-500">View existe mas sem dados ainda.</p>
            ) : (
              <pre className="bg-gray-800 rounded p-4 text-xs overflow-x-auto">
                {JSON.stringify(data.correlation, null, 2)}
              </pre>
            )}
          </section>
        </div>
      );
    }
    ```

    NO new dependencies. NO redesign of /admin/custos. Mirror its palette + spacing + admin-guard pattern.

    The Section 4 placeholder JSON dump is intentional in Phase 02 — a proper heatmap UI is a polish item that requires the view's actual columns to exist + be inspected. Since Plan 02-05 lands in the same wave, the dashboard executor can iterate this section AFTER 02-05's SUMMARY is written; OR ship the JSON-dump now and file a deferred-items.md entry for "/admin/quality correlation heatmap UI".
  </action>
  <acceptance_criteria>
    - File `campanha-ia/src/app/admin/quality/page.tsx` exists.
    - `grep -nE "requireAdmin\\(\\)|redirect\\(\"/gerar\"\\)" campanha-ia/src/app/admin/quality/page.tsx | wc -l` ≥ 2 (admin guard mirrors /admin/custos).
    - `grep -c "campaign_scores" campanha-ia/src/app/admin/quality/page.tsx` ≥ 2 (queried in 2+ places: 7d + 14d).
    - `grep -c "vw_prompt_version_regen_correlation" campanha-ia/src/app/admin/quality/page.tsx` ≥ 1.
    - `grep -c "falha_judge" campanha-ia/src/app/admin/quality/page.tsx` ≥ 2 (filter + UI display).
    - `grep -E "Naturalidade|Conversão|Clareza|Aprovação Meta|Nota Geral" campanha-ia/src/app/admin/quality/page.tsx | wc -l` ≥ 5 (all 5 dimension labels present).
    - `cd campanha-ia && npx tsc --noEmit` clean.
    - `cd campanha-ia && npm run build` succeeds (route compiles).
  </acceptance_criteria>
  <verify>
    <automated>cd campanha-ia && npx tsc --noEmit && npm run build 2>&1 | grep -E "admin/quality|Compiled successfully" | head -5</automated>
  </verify>
  <done>/admin/quality renders 4 sections; mirrors /admin/custos visual; tolerates empty data + missing view; tsc + build clean.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Empty-state test for /admin/quality (no campaign_scores rows)</name>
  <files>campanha-ia/src/app/admin/quality/page.test.tsx</files>
  <read_first>
    - campanha-ia/src/app/admin/quality/page.tsx (just created in Task 1)
    - Existing component-test pattern in campanha-ia (search: `grep -rln "renderToString\\|@testing-library/react" campanha-ia/src --include='*.test.*'`). If no existing pattern, default to the lighter approach below.
  </read_first>
  <behavior>
    - Test 1: When all 4 supabase queries return empty data, calling `getQualityData()` (extract this helper to a named export OR call the page render and assert on output) returns `{ totalRows: 0, validCount: 0, failureCount: 0, means7d: {all null}, promptVersionTable: [], worstRated: [], correlation: null }` — does not throw.
    - Test 2: When `vw_prompt_version_regen_correlation` query rejects (catch arm in the Promise.all chain hits), `correlation` is `null` — does not throw.
    - Test 3: When campaign_scores has 1 row with `nivel_risco='falha_judge'`, `validCount === 0` and `failureCount === 1` (sentinel filtering works).
  </behavior>
  <action>
    1. **Refactor `getQualityData()` to be exportable**: in `campanha-ia/src/app/admin/quality/page.tsx`, add `export` in front of `async function getQualityData()` so the test can call it directly. (Server-component page.tsx files in Next.js can export named helpers without breaking the route.)

    2. **Create `campanha-ia/src/app/admin/quality/page.test.tsx`**:

       ```typescript
       import { describe, expect, it, vi, beforeEach } from "vitest";

       // Hoisted mock state — vitest's vi.mock factories can't reference outer
       // variables, so we expose mutators on the module object.
       let mockScores7d: any[] = [];
       let mockScores14d: any[] = [];
       let mockJudgeCostLogs: any[] = [];
       let mockCorrelationRejects = false;

       vi.mock("@/lib/admin/guard", () => ({
         requireAdmin: vi.fn().mockResolvedValue({ isAdmin: true }),
       }));

       vi.mock("next/navigation", () => ({
         redirect: vi.fn(),
       }));

       vi.mock("@/lib/supabase/admin", () => ({
         createAdminClient: () => {
           const make = (data: any) => {
             const builder: any = {
               select: () => builder,
               eq: () => builder,
               gte: () => builder,
               lt: () => builder,
               order: () => builder,
               limit: () => builder,
               then: (resolve: any) => Promise.resolve({ data, error: null }).then(resolve),
             };
             return builder;
           };
           const correlation: any = {
             select: () => correlation,
             limit: () => correlation,
             then: (resolve: any, reject: any) =>
               mockCorrelationRejects
                 ? Promise.reject(new Error("view absent")).then(resolve, reject)
                 : Promise.resolve({ data: [], error: null }).then(resolve),
           };
           return {
             from: (table: string) => {
               if (table === "campaign_scores") {
                 // Dispatch on whether the .lt() filter is applied — first call is 7d, second is 14d.
                 // Simpler: return a builder that resolves to whichever fixture has data.
                 // For test purposes, return scores7d for the first call and scores14d for the second.
                 // Use a counter:
                 const i = ++(globalThis as any).__campaignScoresCallCount;
                 return make(i === 1 ? mockScores7d : mockScores14d);
               }
               if (table === "api_cost_logs") return make(mockJudgeCostLogs);
               if (table === "vw_prompt_version_regen_correlation") return correlation;
               return make([]);
             },
           };
         },
       }));

       import { getQualityData } from "./page";

       beforeEach(() => {
         (globalThis as any).__campaignScoresCallCount = 0;
         mockScores7d = [];
         mockScores14d = [];
         mockJudgeCostLogs = [];
         mockCorrelationRejects = false;
       });

       describe("getQualityData", () => {
         it("renders empty state when there is no data", async () => {
           const data = await getQualityData();
           expect(data.totalRows).toBe(0);
           expect(data.validCount).toBe(0);
           expect(data.failureCount).toBe(0);
           expect(data.means7d.naturalidade).toBeNull();
           expect(data.promptVersionTable).toEqual([]);
           expect(data.worstRated).toEqual([]);
         });

         it("survives a missing correlation view (Plan 02-05 not yet applied)", async () => {
           mockCorrelationRejects = true;
           const data = await getQualityData();
           expect(data.correlation).toBeNull();
         });

         it("filters falha_judge sentinel rows from numeric aggregates (D-02)", async () => {
           mockScores7d = [{
             campaign_id: "c1",
             naturalidade: 1, conversao: 1, clareza: 1, aprovacao_meta: 1, nota_geral: 1,
             nivel_risco: "falha_judge",
             melhorias: null,
             created_at: new Date().toISOString(),
           }];
           const data = await getQualityData();
           expect(data.totalRows).toBe(1);
           expect(data.validCount).toBe(0);
           expect(data.failureCount).toBe(1);
           expect(data.means7d.naturalidade).toBeNull();
         });
       });
       ```

       Note: the supabase mock builder above is intentionally minimal. If the project already has a richer supabase test-helper (search via `grep -rln "createAdminClient" campanha-ia/src/**/*.test.*`), use that instead and adapt the test.
  </action>
  <acceptance_criteria>
    - `cd campanha-ia && npx vitest run src/app/admin/quality/page.test.tsx` passes all 3 tests.
    - `grep -c "export async function getQualityData" campanha-ia/src/app/admin/quality/page.tsx` returns 1 (helper now exported for testability).
    - `cd campanha-ia && npx tsc --noEmit` clean.
  </acceptance_criteria>
  <verify>
    <automated>cd campanha-ia && npx vitest run src/app/admin/quality/page.test.tsx && npx tsc --noEmit</automated>
  </verify>
  <done>3 empty-state / sentinel-filter / missing-view tests green; getQualityData is testable as a pure function.</done>
</task>

</tasks>

<verification>
End-to-end smoke:
1. `cd campanha-ia && npm run dev` → navigate to http://localhost:3000/admin/quality → page renders without crash even if campaign_scores is empty.
2. With Plan 02-03 deployed and at least 1 campaign generated → wait ~30s for Inngest judge job → reload page → 4 tiles populate with means.
3. Verify the warning banner "Nenhum score do judge nos últimos 7 dias" disappears once data exists.
4. Visual diff against /admin/custos: same gray-900 palette, same 4-card grid pattern, same admin-guard redirect to /gerar for non-admins.

Automated:
- `cd campanha-ia && npx vitest run src/app/admin/quality/page.test.tsx`
- `cd campanha-ia && npm run build` (route appears in build output)
</verification>

<success_criteria>
- `/admin/quality` route exists and renders 4 sections (means tile grid, per-prompt_version table, worst-rated table, correlation matrix or placeholder).
- Mirrors /admin/custos visual exactly (NO redesign).
- Empty state renders cleanly (zero crash) when campaign_scores has 0 rows.
- falha_judge sentinel filtered from numeric aggregates per D-02.
- Correlation view absent → graceful "view not yet created" placeholder (no 500).
- Admin auth guard preserved (non-admin → /gerar).
- 3 tests green; tsc + build clean.
</success_criteria>

<output>
After completion, create `.planning/phases/02-quality-loop/02-04-SUMMARY.md` documenting:
- Files created
- Whether the correlation Section 4 was upgraded from JSON-dump to a heatmap UI (probably no — file deferred-items.md entry for the polish work)
- Visual notes: which exact Tailwind classes were borrowed from /admin/custos (so a future restyle of /custos can find /quality and re-sync)
- Whether any helper extraction (e.g. shared `MeanTile` component between /custos and /quality) was deferred — note for Phase 03 dashboard polish
</output>
