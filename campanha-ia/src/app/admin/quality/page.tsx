/**
 * /admin/quality — Phase 02 D-21
 *
 * Companion to /admin/custos. Surfaces LLM-as-judge output (campaign_scores,
 * written by judgeCampaignJob from Plan 02-03) over the last 7 days, plus
 * WoW deltas from the prior 7-day window for drift visibility.
 *
 * Sections:
 *   1. 4-tile mean grid (naturalidade / conversao / clareza / aprovacao_meta)
 *      + bonus full-width nota_geral tile, all with WoW delta arrows.
 *   2. Per-prompt_version aggregate table (top 10 by row count) — the
 *      drift-detection surface. JOINs api_cost_logs.metadata.prompt_version
 *      (action='judge_quality') with campaign_scores by campaign_id.
 *   3. Top 10 worst-rated last 7 days (by nota_geral asc) with truncated
 *      justificativa snippets.
 *   4. prompt_version × regenerate_reason correlation matrix — reads from
 *      vw_prompt_version_regen_correlation if the Plan 02-05 migration has
 *      been applied; renders a graceful placeholder if the view is absent.
 *
 * Visual contract: MIRROR /admin/custos (gray-900 palette, 2x4 / 4-card
 * grid, rounded-2xl tiles, emerald/amber/red delta colors). NO redesign.
 *
 * Empty-state discipline: judge wiring just shipped, so production
 * campaign_scores may be empty for hours after deploy. Page MUST render
 * cleanly with zero rows — surfaces a yellow "aguardando" banner rather
 * than crashing.
 *
 * Sentinel filtering: D-02 from Plan 02-03 — when the Inngest judge job
 * fails after retries, an `nivel_risco='falha_judge'` row is inserted with
 * neutral 1s in numeric columns. Including those in numeric aggregates
 * would bias means toward 1; we filter them and surface the failure count
 * separately as a banner.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/admin/guard";
import { redirect } from "next/navigation";
import { MeanTile } from "./MeanTile";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// ── Dimension catalog ──────────────────────────────────────────────────
type Dim = "naturalidade" | "conversao" | "clareza" | "aprovacao_meta" | "nota_geral";
const DIMS: Dim[] = ["naturalidade", "conversao", "clareza", "aprovacao_meta", "nota_geral"];
const TILE_DIMS: ReadonlyArray<Exclude<Dim, "nota_geral">> = [
  "naturalidade",
  "conversao",
  "clareza",
  "aprovacao_meta",
];
const DIM_LABELS: Record<Dim, string> = {
  naturalidade: "Naturalidade",
  conversao: "Conversão",
  clareza: "Clareza",
  aprovacao_meta: "Aprovação Meta",
  nota_geral: "Nota Geral",
};

// ── Row shape from supabase (Postgres smallint → number) ───────────────
interface ScoreRow {
  campaign_id: string;
  naturalidade: number;
  conversao: number;
  clareza: number;
  aprovacao_meta: number;
  nota_geral: number;
  nivel_risco: string;
  melhorias: Record<string, string> | null;
  created_at: string;
}

interface PromptVersionRow {
  prompt_version: string;
  count: number;
  means: Record<Dim, number>;
}

interface WorstRow {
  campaign_id: string;
  nota_geral: number;
  nivel_risco: string;
  justificativa_snippet: string;
}

export interface QualityData {
  means7d: Record<Dim, number | null>;
  wowDelta: Record<Dim, number | null>;
  promptVersionTable: PromptVersionRow[];
  worstRated: WorstRow[];
  correlation: Array<Record<string, unknown>> | null;
  totalRows: number;
  validCount: number;
  failureCount: number;
}

// ── Server-side data loader (named export so page.test.tsx can call it
//    directly without rendering the full React tree). Next.js permits
//    named exports from server components alongside the default export. ─
export async function getQualityData(): Promise<QualityData> {
  const admin = await requireAdmin();
  if (!admin.isAdmin) redirect("/gerar");

  const supabase = createAdminClient();
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString();

  // All 4 supabase queries in parallel. The correlation query (#4) is
  // wrapped in .then(ok, fail) so a missing view (Plan 02-05 not yet
  // migrated) does not reject the Promise.all and crash the page.
  const [
    scores7dRes,
    scores14dRes,
    judgeCostLogsRes,
    correlationRes,
  ] = await Promise.all([
    supabase
      .from("campaign_scores")
      .select("campaign_id, naturalidade, conversao, clareza, aprovacao_meta, nota_geral, nivel_risco, melhorias, created_at")
      .gte("created_at", sevenDaysAgo)
      .order("created_at", { ascending: false }),
    supabase
      .from("campaign_scores")
      .select("campaign_id, naturalidade, conversao, clareza, aprovacao_meta, nota_geral, nivel_risco, melhorias, created_at")
      .gte("created_at", fourteenDaysAgo)
      .lt("created_at", sevenDaysAgo),
    supabase
      .from("api_cost_logs")
      .select("campaign_id, metadata")
      .eq("action", "judge_quality")
      .gte("created_at", sevenDaysAgo)
      .limit(1000),
    // Plan 02-05 view tolerance: catch arm fires if the view does not
    // exist yet (PostgrestError code 42P01) — return null so the UI can
    // render the "view not yet created" placeholder.
    supabase
      .from("vw_prompt_version_regen_correlation")
      .select("*")
      .limit(50)
      .then(
        (r) => r,
        () => ({ data: null, error: { message: "view not present" } }),
      ),
  ]);

  const scores7d: ScoreRow[] = (scores7dRes.data ?? []) as ScoreRow[];
  const scores14d: ScoreRow[] = (scores14dRes.data ?? []) as ScoreRow[];
  const judgeCostLogs = (judgeCostLogsRes.data ?? []) as Array<{
    campaign_id: string | null;
    metadata: { prompt_version?: string } | null;
  }>;
  const correlation = correlationRes.data as Array<Record<string, unknown>> | null;

  // D-02: exclude falha_judge sentinels from numeric aggregates so means
  // are not pulled toward 1 by failed judge rows (which carry neutral 1s
  // by setCampaignScores convention).
  const valid7d = scores7d.filter((r) => r.nivel_risco !== "falha_judge");
  const valid14d = scores14d.filter((r) => r.nivel_risco !== "falha_judge");

  const meanForDim = (rows: ScoreRow[], dim: Dim): number | null => {
    if (rows.length === 0) return null;
    const sum = rows.reduce((s, r) => s + (r[dim] as number), 0);
    return sum / rows.length;
  };

  const means7d = Object.fromEntries(
    DIMS.map((d) => [d, meanForDim(valid7d, d)]),
  ) as Record<Dim, number | null>;
  const meansPrev7d = Object.fromEntries(
    DIMS.map((d) => [d, meanForDim(valid14d, d)]),
  ) as Record<Dim, number | null>;
  const wowDelta = Object.fromEntries(
    DIMS.map((d) => {
      const cur = means7d[d];
      const prev = meansPrev7d[d];
      return [d, cur !== null && prev !== null ? cur - prev : null];
    }),
  ) as Record<Dim, number | null>;

  // Per-prompt_version aggregate (top 10 by row count). The campaigns
  // table doesn't store prompt_version directly; we walk the judge cost
  // logs (action='judge_quality') and join by campaign_id.
  const promptVersionByCampaign = new Map<string, string>();
  for (const log of judgeCostLogs) {
    const pv = log.metadata?.prompt_version;
    if (log.campaign_id && pv) promptVersionByCampaign.set(log.campaign_id, pv);
  }

  const promptVersionStats = new Map<
    string,
    { count: number; sums: Record<Dim, number> }
  >();
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
  const promptVersionTable: PromptVersionRow[] = Array.from(promptVersionStats.entries())
    .map(([pv, { count, sums }]) => ({
      prompt_version: pv,
      count,
      means: Object.fromEntries(DIMS.map((d) => [d, sums[d] / count])) as Record<Dim, number>,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  // Top 10 worst-rated last 7 days (asc by nota_geral). The judge writes
  // PT-BR justificativa per dimension into melhorias JSONB (per Plan
  // 02-03 setCampaignScores); we surface nota_geral's snippet truncated
  // to 100 chars to avoid layout blow-up.
  const worstRated: WorstRow[] = [...valid7d]
    .sort((a, b) => a.nota_geral - b.nota_geral)
    .slice(0, 10)
    .map((r) => ({
      campaign_id: r.campaign_id,
      nota_geral: r.nota_geral,
      nivel_risco: r.nivel_risco,
      justificativa_snippet: (r.melhorias?.nota_geral ?? "").slice(0, 100),
    }));

  const totalRows = scores7d.length;
  const failureCount = totalRows - valid7d.length;

  return {
    means7d,
    wowDelta,
    promptVersionTable,
    worstRated,
    correlation,
    totalRows,
    validCount: valid7d.length,
    failureCount,
  };
}

// Tile formatting helpers moved into ./MeanTile.tsx — local component
// extracted to DRY the 5 near-identical tile invocations below.

// ── Heatmap helpers (Section 4) ────────────────────────────────────────
const REGEN_REASONS = ["face_wrong", "garment_wrong", "copy_wrong", "pose_wrong", "other"] as const;
type RegenReason = typeof REGEN_REASONS[number];
const REASON_LABELS: Record<RegenReason, string> = {
  face_wrong: "Rosto",
  garment_wrong: "Peça",
  copy_wrong: "Copy",
  pose_wrong: "Pose",
  other: "Outro",
};

interface HeatmapCell {
  prompt_version: string;
  rows: Record<RegenReason, number>;
  total: number;
}

/**
 * Aggregate per-row correlation (one row per campaign) into a matrix where
 * each cell counts campaigns that share (prompt_version, regenerate_reason).
 * Returns top-N prompt_versions by total count + the global max so the
 * caller can normalize cell colors.
 */
function buildHeatmap(
  correlation: Array<Record<string, unknown>>,
  topN = 8,
): { cells: HeatmapCell[]; max: number } {
  const byPrompt = new Map<string, HeatmapCell>();
  for (const row of correlation) {
    const pv = (row.prompt_version as string | null) ?? "(sem versão)";
    const reason = row.regenerate_reason as RegenReason | null;
    if (!reason || !(REGEN_REASONS as readonly string[]).includes(reason)) continue;
    let entry = byPrompt.get(pv);
    if (!entry) {
      entry = {
        prompt_version: pv,
        rows: { face_wrong: 0, garment_wrong: 0, copy_wrong: 0, pose_wrong: 0, other: 0 },
        total: 0,
      };
      byPrompt.set(pv, entry);
    }
    entry.rows[reason] += 1;
    entry.total += 1;
  }
  const cells = Array.from(byPrompt.values())
    .sort((a, b) => b.total - a.total)
    .slice(0, topN);
  const max = cells.reduce(
    (m, c) => Math.max(m, ...REGEN_REASONS.map((r) => c.rows[r])),
    0,
  );
  return { cells, max };
}

function heatColor(count: number, max: number): string {
  if (count === 0 || max === 0) return "bg-gray-900 text-gray-600";
  const ratio = count / max;
  // 5-step ramp on bg-red — readable on the dark dashboard palette.
  if (ratio > 0.8) return "bg-red-500/80 text-white";
  if (ratio > 0.6) return "bg-red-500/60 text-white";
  if (ratio > 0.4) return "bg-red-500/40 text-red-50";
  if (ratio > 0.2) return "bg-red-500/25 text-red-100";
  return "bg-red-500/10 text-red-200";
}

// ── Page component ─────────────────────────────────────────────────────
export default async function AdminQualityPage() {
  const data = await getQualityData();
  const heatmap =
    data.correlation && data.correlation.length > 0
      ? buildHeatmap(data.correlation)
      : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Qualidade — Últimos 7 dias</h1>
        <p className="text-gray-400 mt-1">
          Companheiro de <span className="font-mono text-xs">/admin/custos</span>. Scores do
          LLM-as-judge sobre as legendas geradas (Phase 02 D-21).
        </p>
      </div>

      {/* Empty / failure banners — production data builds up over hours */}
      {data.totalRows === 0 && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4">
          <p className="text-sm font-medium text-amber-400">
            Aguardando primeiros scores do judge nos últimos 7 dias. O job é assíncrono via
            Inngest (~30s após cada geração) — verifique o dashboard do Inngest se nada chegar
            depois de gerar uma campanha.
          </p>
        </div>
      )}
      {data.failureCount > 0 && (
        <div className="bg-orange-500/10 border border-orange-500/30 rounded-xl p-4">
          <p className="text-sm font-medium text-orange-400">
            ⚠ {data.failureCount} rodada(s) do judge falharam (nivel_risco=&quot;falha_judge&quot;).
            Veja o Sentry para causa raiz. Linhas excluídas das médias abaixo.
          </p>
        </div>
      )}

      {/* SECTION 1 — Means tile grid + WoW deltas (mirrors /admin/custos
          4-card budget grid). Tile JSX extracted to <MeanTile /> for DRY. */}
      <section>
        <h2 className="text-sm font-semibold text-white mb-4">Médias 7 dias</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {TILE_DIMS.map((dim) => (
            <MeanTile
              key={dim}
              label={DIM_LABELS[dim]}
              value={data.means7d[dim]}
              delta={data.wowDelta[dim]}
            />
          ))}
        </div>

        {/* nota_geral as the "headline" tile — the judge computes this with
            its own weighting per Plan 02-03 D-04, NOT a server-side average */}
        <div className="mt-4">
          <MeanTile
            label={DIM_LABELS.nota_geral}
            value={data.means7d.nota_geral}
            delta={data.wowDelta.nota_geral}
            headline
            caption={`${data.validCount} campanha(s) válida(s) · ${data.failureCount} rejeitada(s)`}
          />
        </div>
      </section>

      {/* SECTION 2 — Per-prompt_version aggregate table */}
      <section className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
        <h2 className="text-sm font-semibold text-white mb-1">
          Por versão do prompt (top 10)
        </h2>
        <p className="text-xs text-gray-400 mb-4">
          Quebra das médias por SHA do prompt do copywriter. Use para detectar drift
          quando uma nova versão estiver subindo/descendo as notas.
        </p>
        {data.promptVersionTable.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-4">
            Sem dados de prompt_version ainda. (Sem judge logs cruzando com campaign_scores
            nos últimos 7 dias.)
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800">
                  <th
                    scope="col"
                    className="text-left px-3 py-2 text-xs font-semibold text-gray-400 uppercase"
                  >
                    Prompt SHA
                  </th>
                  <th
                    scope="col"
                    className="text-right px-3 py-2 text-xs font-semibold text-gray-400 uppercase"
                  >
                    N
                  </th>
                  {DIMS.map((d) => (
                    <th
                      key={d}
                      scope="col"
                      className="text-right px-3 py-2 text-xs font-semibold text-gray-400 uppercase"
                    >
                      {DIM_LABELS[d]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {data.promptVersionTable.map((row) => (
                  <tr key={row.prompt_version} className="hover:bg-gray-800/30 transition">
                    <td className="px-3 py-2 font-mono text-xs text-gray-200">
                      {row.prompt_version}
                    </td>
                    <td className="px-3 py-2 text-right text-gray-400">{row.count}</td>
                    {DIMS.map((d) => (
                      <td key={d} className="px-3 py-2 text-right text-emerald-400 font-medium">
                        {row.means[d].toFixed(2)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* SECTION 3 — Worst-rated last 7d */}
      <section className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
        <h2 className="text-sm font-semibold text-white mb-1">
          10 piores nos últimos 7 dias
        </h2>
        <p className="text-xs text-gray-400 mb-4">
          Ordenadas por nota_geral ascendente. Justificativas vêm do campo melhorias.nota_geral
          (PT-BR) gravado pelo judge.
        </p>
        {data.worstRated.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-4">Sem dados.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800">
                  <th
                    scope="col"
                    className="text-left px-3 py-2 text-xs font-semibold text-gray-400 uppercase"
                  >
                    Campaign ID
                  </th>
                  <th
                    scope="col"
                    className="text-right px-3 py-2 text-xs font-semibold text-gray-400 uppercase"
                  >
                    Nota geral
                  </th>
                  <th
                    scope="col"
                    className="text-left px-3 py-2 text-xs font-semibold text-gray-400 uppercase"
                  >
                    Risco
                  </th>
                  <th
                    scope="col"
                    className="text-left px-3 py-2 text-xs font-semibold text-gray-400 uppercase"
                  >
                    Justificativa
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {data.worstRated.map((row) => (
                  <tr key={row.campaign_id} className="hover:bg-gray-800/30 transition">
                    <td className="px-3 py-2 font-mono text-xs text-gray-300">
                      {row.campaign_id.slice(0, 8)}…
                    </td>
                    <td className="px-3 py-2 text-right text-red-400 font-medium">
                      {row.nota_geral}
                    </td>
                    <td className="px-3 py-2 text-gray-300 capitalize">{row.nivel_risco}</td>
                    <td className="px-3 py-2 text-xs text-gray-400">
                      {row.justificativa_snippet || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* SECTION 4 — Correlation matrix (Plan 02-05 view) */}
      <section className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
        <h2 className="text-sm font-semibold text-white mb-1">
          Correlação prompt × motivo de regeneração
        </h2>
        <p className="text-xs text-gray-400 mb-4">
          Cruzamento de prompt_version com campaigns.regenerate_reason. Ajuda a apontar
          a versão de prompt responsável por cada categoria de erro reportada por lojistas.
        </p>
        {data.correlation === null ? (
          <p className="text-sm text-gray-500 text-center py-4">
            Visão de correlação ainda não foi aplicada. Rode a migração do Plan 02-05
            (<span className="font-mono">vw_prompt_version_regen_correlation</span>) para
            popular esta seção.
          </p>
        ) : !heatmap || heatmap.cells.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-4">
            View existe mas sem regenerações registradas ainda.
          </p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-separate border-spacing-1">
                <thead>
                  <tr>
                    <th
                      scope="col"
                      className="text-left px-2 py-2 text-xs font-semibold text-gray-400 uppercase"
                    >
                      Prompt SHA
                    </th>
                    {REGEN_REASONS.map((r) => (
                      <th
                        key={r}
                        scope="col"
                        className="text-center px-2 py-2 text-xs font-semibold text-gray-400 uppercase"
                      >
                        {REASON_LABELS[r]}
                      </th>
                    ))}
                    <th
                      scope="col"
                      className="text-right px-2 py-2 text-xs font-semibold text-gray-400 uppercase"
                    >
                      Total
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {heatmap.cells.map((cell) => (
                    <tr key={cell.prompt_version}>
                      <td className="px-2 py-2 font-mono text-xs text-gray-200">
                        {cell.prompt_version}
                      </td>
                      {REGEN_REASONS.map((r) => (
                        <td
                          key={r}
                          className={`text-center text-xs font-medium tabular-nums rounded-md ${heatColor(cell.rows[r], heatmap.max)}`}
                          aria-label={`${REASON_LABELS[r]}: ${cell.rows[r]} regeneração(ões)`}
                        >
                          {cell.rows[r]}
                        </td>
                      ))}
                      <td className="px-2 py-2 text-right text-gray-400 tabular-nums">
                        {cell.total}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-gray-500 mt-3">
              Intensidade do vermelho = contagem relativa ao máximo da matriz ({heatmap.max}).
              Top 8 versões por total de regenerações.
            </p>
          </>
        )}
      </section>
    </div>
  );
}
