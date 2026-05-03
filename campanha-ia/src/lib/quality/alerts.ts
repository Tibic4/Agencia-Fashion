/**
 * Phase 02 D-07/D-08/D-10 — alert thresholds + queries.
 *
 * Why git-versioned constants (not Sentry UI rules) per D-10:
 * thresholds change on PR review, not in a console; rationale lives
 * in the comment block adjacent to each constant; reverting a bad
 * threshold change is `git revert`, not click-archaeology.
 *
 * Sentry rule itself is just "fire on any synthetic issue with a
 * fingerprint matching face_wrong_spike_* or nivel_risco_alto_spike_*".
 * That rule is configured ONCE in Sentry UI and never edited again.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * D-07 thresholds — LOCKED. Cron fires when BOTH conditions are true:
 *   thisWeekPct > FACE_WRONG_THRESHOLD_PCT AND deltaPp > FACE_WRONG_WOW_DELTA_PP.
 *
 * Two-condition gate avoids false alarms in low-volume weeks: a single
 * face_wrong out of 10 campaigns reads as 10% but isn't a real spike if
 * last week was 9%. The +1pp delta filters that out.
 */
export const FACE_WRONG_THRESHOLD_PCT = 5;
export const FACE_WRONG_WOW_DELTA_PP  = 1;

/**
 * D-08 threshold — LOCKED. Rolling 7-day window.
 *
 * 1% of judge-graded campaigns flagged 'alto' is the alarm point: at
 * baseline production volume that means a handful of forbidden-token
 * outputs slipped past the regex pre-filter — almost certainly a
 * prompt-edit regression, never normal noise.
 */
export const NIVEL_RISCO_ALTO_THRESHOLD_PCT = 1;

/** Sample size for breadcrumb arrays. PII guard — never include full payload. */
const TOP_PROMPT_VERSIONS_BREADCRUMB_LIMIT = 3;
const SAMPLE_CAMPAIGN_IDS_BREADCRUMB_LIMIT = 5;

// ─── D-07: face_wrong WoW spike query ───────────────────────────────────────

export interface FaceWrongRateResult {
  thisWeekPct: number;
  lastWeekPct: number;
  deltaPp: number;
  /** Top SHAs by face_wrong count this week (≤3). Empty if no face_wrong rows. */
  topPromptVersions: string[];
  sampleSize: { thisWeek: number; lastWeek: number };
}

/**
 * Compute face_wrong rate this-week vs last-week from `campaigns.regenerate_reason`.
 * Enriches the breadcrumb with up to 3 prompt_version SHAs from `api_cost_logs`
 * for whichever prompt was used to generate the face_wrong campaigns.
 *
 * Caller (the cron) compares against thresholds + emits the alert.
 */
export async function queryFaceWrongRate(
  // Loose typing: the test mock doesn't implement the full SupabaseClient generics.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient | any,
  now: Date = new Date(),
): Promise<FaceWrongRateResult> {
  const sevenDaysAgo  = new Date(now.getTime() -  7 * 24 * 60 * 60 * 1000);
  const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

  // This week (last 7 days)
  const { data: thisWeek } = await supabase
    .from("campaigns")
    .select("id, regenerate_reason")
    .gte("created_at", sevenDaysAgo.toISOString());

  // Last week (the 7 days BEFORE that)
  const { data: lastWeek } = await supabase
    .from("campaigns")
    .select("id, regenerate_reason")
    .gte("created_at", fourteenDaysAgo.toISOString())
    .lt("created_at", sevenDaysAgo.toISOString());

  const thisWeekRows = (thisWeek ?? []) as Array<{ id: string; regenerate_reason: string | null }>;
  const lastWeekRows = (lastWeek ?? []) as Array<{ id: string; regenerate_reason: string | null }>;

  const thisFW = thisWeekRows.filter((r) => r.regenerate_reason === "face_wrong").length;
  const lastFW = lastWeekRows.filter((r) => r.regenerate_reason === "face_wrong").length;

  const thisWeekPct = thisWeekRows.length > 0 ? (thisFW / thisWeekRows.length) * 100 : 0;
  const lastWeekPct = lastWeekRows.length > 0 ? (lastFW / lastWeekRows.length) * 100 : 0;
  const deltaPp = thisWeekPct - lastWeekPct;

  // Enrich breadcrumb with top-3 prompt_version SHAs by face_wrong count.
  // PII-safe: SHAs are git commit hashes, not user data.
  const faceWrongCampaignIds = thisWeekRows
    .filter((r) => r.regenerate_reason === "face_wrong")
    .map((r) => r.id);

  let topPromptVersions: string[] = [];
  if (faceWrongCampaignIds.length > 0) {
    const { data: logs } = await supabase
      .from("api_cost_logs")
      .select("metadata, campaign_id")
      .in("campaign_id", faceWrongCampaignIds)
      .eq("action", "sonnet_copywriter")
      .limit(500);

    const counts = new Map<string, number>();
    for (const log of (logs ?? []) as Array<{ metadata: { prompt_version?: string } | null }>) {
      const pv = log.metadata?.prompt_version;
      if (pv) counts.set(pv, (counts.get(pv) ?? 0) + 1);
    }
    topPromptVersions = Array.from(counts.entries())
      .sort(([, a], [, b]) => b - a)
      .slice(0, TOP_PROMPT_VERSIONS_BREADCRUMB_LIMIT)
      .map(([pv]) => pv);
  }

  return {
    thisWeekPct,
    lastWeekPct,
    deltaPp,
    topPromptVersions,
    sampleSize: { thisWeek: thisWeekRows.length, lastWeek: lastWeekRows.length },
  };
}

// ─── D-08: nivel_risco='alto' rolling-7d spike query ────────────────────────

export interface NivelRiscoAltoResult {
  pct: number;
  altoCount: number;
  /** Excludes 'falha_judge' sentinel rows (D-02 — judge failure ≠ low quality). */
  validTotal: number;
  /** Up to 5 campaign UUIDs (PII-safe: opaque internal IDs, not user data). */
  sampleCampaignIds: string[];
}

export async function queryNivelRiscoAltoRate(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient | any,
  now: Date = new Date(),
): Promise<NivelRiscoAltoResult> {
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const { data } = await supabase
    .from("campaign_scores")
    .select("campaign_id, nivel_risco")
    .gte("created_at", sevenDaysAgo.toISOString());

  const rows = (data ?? []) as Array<{ campaign_id: string; nivel_risco: string }>;

  // Exclude falha_judge sentinel from the denominator (D-02 from Plan 02-03).
  // A judge transport failure is NOT a low-quality outcome.
  const valid = rows.filter((r) => r.nivel_risco !== "falha_judge");
  const altoRows = valid.filter((r) => r.nivel_risco === "alto");
  const pct = valid.length > 0 ? (altoRows.length / valid.length) * 100 : 0;

  return {
    pct,
    altoCount: altoRows.length,
    validTotal: valid.length,
    sampleCampaignIds: altoRows
      .slice(0, SAMPLE_CAMPAIGN_IDS_BREADCRUMB_LIMIT)
      .map((r) => r.campaign_id),
  };
}

// ─── Fingerprint builders ───────────────────────────────────────────────────

/**
 * D-07 fingerprint — bucketed by Monday-of-week (UTC) so all 7 days of the
 * same ISO week dedup to a single Sentry issue. ISO week starts on Monday.
 *
 *   buildFaceWrongFingerprint(2026-05-04 Mon) → 'face_wrong_spike_20260504'
 *   buildFaceWrongFingerprint(2026-05-07 Thu) → 'face_wrong_spike_20260504'  (same week)
 *   buildFaceWrongFingerprint(2026-05-11 Mon) → 'face_wrong_spike_20260511'  (next week)
 */
export function buildFaceWrongFingerprint(d: Date): string {
  const monday = new Date(d);
  const day = monday.getUTCDay(); // 0 Sun, 1 Mon, ..., 6 Sat
  const diff = day === 0 ? -6 : 1 - day; // shift back to Monday
  monday.setUTCDate(monday.getUTCDate() + diff);
  monday.setUTCHours(0, 0, 0, 0);
  const yyyy = monday.getUTCFullYear().toString().padStart(4, "0");
  const mm   = (monday.getUTCMonth() + 1).toString().padStart(2, "0");
  const dd   = monday.getUTCDate().toString().padStart(2, "0");
  return `face_wrong_spike_${yyyy}${mm}${dd}`;
}

/**
 * D-08 fingerprint — bucketed daily (UTC). Each day gets its own Sentry issue
 * if the spike persists, so the on-call team sees day-by-day persistence.
 */
export function buildNivelRiscoAltoFingerprint(d: Date): string {
  const yyyy = d.getUTCFullYear().toString().padStart(4, "0");
  const mm   = (d.getUTCMonth() + 1).toString().padStart(2, "0");
  const dd   = d.getUTCDate().toString().padStart(2, "0");
  return `nivel_risco_alto_spike_${yyyy}${mm}${dd}`;
}
