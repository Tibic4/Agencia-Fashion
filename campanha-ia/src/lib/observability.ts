/**
 * Observability — logger estruturado + wrapper do Sentry.
 *
 * Uso:
 *   import { logger, captureError } from "@/lib/observability";
 *   try { ... } catch (e) { captureError(e, { route: "checkout", userId }); throw e; }
 *   logger.info("payment_received", { amount, plan });
 */
import * as Sentry from "@sentry/nextjs";
import { createHash } from "node:crypto";

type Ctx = Record<string, unknown>;

function log(level: "debug" | "info" | "warn" | "error", msg: string, ctx?: Ctx) {
  // Em produção, reduz verbosidade de debug
  if (level === "debug" && process.env.NODE_ENV === "production") return;
  const timestamp = new Date().toISOString();
  const line = ctx ? `${timestamp} [${level}] ${msg}  ${JSON.stringify(ctx)}` : `${timestamp} [${level}] ${msg}`;
  switch (level) {
    case "error":
      console.error(line);
      break;
    case "warn":
      console.warn(line);
      break;
    default:
      console.log(line);
  }
}

export const logger = {
  debug: (msg: string, ctx?: Ctx) => log("debug", msg, ctx),
  info: (msg: string, ctx?: Ctx) => log("info", msg, ctx),
  warn: (msg: string, ctx?: Ctx) => log("warn", msg, ctx),
  error: (msg: string, ctx?: Ctx) => log("error", msg, ctx),
};

/**
 * Captura uma exception no Sentry com contexto extra.
 * Chame em catches de operações críticas (webhook, checkout, campaign/generate).
 */
export function captureError(err: unknown, ctx: Ctx = {}): void {
  try {
    Sentry.withScope((scope) => {
      for (const [k, v] of Object.entries(ctx)) {
        scope.setExtra(k, v);
      }
      if (err instanceof Error) {
        Sentry.captureException(err);
      } else {
        Sentry.captureException(new Error(String(err)));
      }
    });
  } catch {
    // Nunca deixar o logger quebrar a app
  }
  // Também loga no console para debug local
  logger.error(err instanceof Error ? err.message : String(err), ctx);
}

/**
 * Atribui identidade do usuário ao scope do Sentry (para filtrar erros por user).
 * NÃO passar email — só userId (Clerk) + storeId.
 */
export function identifyForSentry(userId: string | null, storeId?: string | null): void {
  try {
    if (userId) {
      Sentry.setUser({ id: userId, store_id: storeId ?? undefined });
    } else {
      Sentry.setUser(null);
    }
  } catch {
    /* noop */
  }
}

/**
 * Phase 02 D-10 — emit a synthetic Sentry warning with a STABLE fingerprint.
 *
 * Use case: scheduled crons that detect threshold breaches (face_wrong rate
 * spike, nivel_risco='alto' rate spike). Unlike captureError, there is no
 * thrown exception — we synthesize a warning so Sentry's existing alert
 * routing fires.
 *
 * Why fingerprint and not setExtra alone: setExtra creates a NEW Sentry issue
 * per call. Fingerprint groups identical values into ONE issue across calls.
 * A weekly cron that re-detects the same spike must dedup to one issue per
 * spike-window, not 7 issues in a week.
 *
 * Date-bucketed fingerprints (caller's responsibility — see lib/quality/alerts.ts):
 *   face_wrong_spike_<YYYYMMDD>      — bucket by Monday-of-week (D-07)
 *   nivel_risco_alto_spike_<YYYYMMDD> — bucket daily (D-08)
 *   promptfoo_regression_pr_<PR_NUMBER> — emitted from GitHub Action (Plan 02-02), not here (D-09)
 *
 * Never throws — observability must not break the cron.
 */
export function captureSyntheticAlert(
  message: string,
  fingerprint: string,
  breadcrumbs: Ctx = {},
): void {
  try {
    Sentry.withScope((scope) => {
      scope.setLevel("warning");
      scope.setFingerprint([fingerprint]);
      scope.setExtra("breadcrumbs", breadcrumbs);
      scope.setExtra("alert_kind", "synthetic_threshold_breach");
      Sentry.captureMessage(message, "warning");
    });
  } catch {
    // Never let observability break the cron.
  }
  logger.warn(`[synthetic_alert] ${message}`, { fingerprint, ...breadcrumbs });
}

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
  return createHash("sha256").update(storeId).digest("hex").slice(0, 8);
}
