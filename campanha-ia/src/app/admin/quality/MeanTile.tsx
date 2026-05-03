/**
 * MeanTile — single-metric tile for /admin/quality dashboard.
 *
 * Extracted from page.tsx where 5 near-identical tiles (4 dimension + 1
 * nota_geral) duplicated the same JSX shape. Local-only by design — the
 * /admin/custos tiles each have unique sub-content (progress bar, no delta,
 * etc.) and a shared cross-page component would lose >half its props per
 * caller. See `.planning/phases/02-quality-loop/deferred-items.md` for the
 * cross-page consolidation rationale.
 */

interface MeanTileProps {
  label: string;
  value: number | null;
  delta: number | null;
  /** When true, renders the larger "headline" variant used for nota_geral. */
  headline?: boolean;
  /** Optional caption rendered below the delta line (e.g., "X válidas / Y rejeitadas"). */
  caption?: string;
}

function formatScore(v: number | null): string {
  return v === null ? "—" : v.toFixed(2);
}

function formatDelta(v: number | null): { text: string; color: string } {
  if (v === null) return { text: "— sem comparação", color: "text-gray-500" };
  if (v > 0.05) return { text: `↑ +${v.toFixed(2)}`, color: "text-emerald-400" };
  if (v < -0.05) return { text: `↓ ${v.toFixed(2)}`, color: "text-red-400" };
  return { text: `→ ${v.toFixed(2)}`, color: "text-gray-400" };
}

export function MeanTile({ label, value, delta, headline = false, caption }: MeanTileProps) {
  const d = formatDelta(delta);
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
      <p className="text-xs text-gray-400 mb-1">{label}</p>
      <p className={headline ? "text-3xl font-bold text-white" : "text-2xl font-bold text-white"}>
        {formatScore(value)}
      </p>
      <p className={`text-xs mt-1 ${d.color}`}>{d.text} vs semana anterior</p>
      {caption && <p className="text-xs text-gray-500 mt-2">{caption}</p>}
    </div>
  );
}
