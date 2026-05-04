import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/observability";
import * as Sentry from "@sentry/nextjs";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * POST /api/csp-report
 *
 * Receives CSP violation reports from browsers (Report-Only mode initially per
 * D-09; flipped to enforced after 14-day zero-violation gate per ops/csp-rollout.md).
 * Forwards each violation to Sentry as a warning-level message with structured
 * tags so ops can filter the Sentry UI by directive, blocked host, etc.
 *
 * Browsers send POST requests with one of three content-types:
 *   - application/csp-report           (legacy CSP-1)
 *   - application/reports+json         (modern Reporting API)
 *   - application/json                 (fallback some browsers use)
 *
 * Two payload shapes:
 *   - Legacy: { "csp-report": { "document-uri", "violated-directive", "blocked-uri", ... } }
 *   - Modern: [ { "type": "csp-violation", "body": { "documentURL", "blockedURL", "effectiveDirective", ... } } ]
 *
 * Always returns 204. Parse errors swallow silently (don't 400 — browsers retry,
 * and we don't want retry storms). DSN comes from SENTRY_DSN env, already
 * loaded by instrumentation.ts.
 *
 * D-08 / Phase 8 plan 08-06.
 */

type LegacyCspReport = {
  "csp-report"?: {
    "document-uri"?: string;
    "violated-directive"?: string;
    "effective-directive"?: string;
    "blocked-uri"?: string;
    "original-policy"?: string;
    "source-file"?: string;
    "line-number"?: number;
    "column-number"?: number;
    "status-code"?: number;
    referrer?: string;
  };
};

type ModernCspReport = {
  type: string;
  body?: {
    documentURL?: string;
    referrer?: string;
    blockedURL?: string;
    effectiveDirective?: string;
    originalPolicy?: string;
    sourceFile?: string;
    lineNumber?: number;
    columnNumber?: number;
    statusCode?: number;
    disposition?: "enforce" | "report";
  };
};

function hostOf(uri: string | undefined | null): string {
  if (!uri) return "unknown";
  try {
    return new URL(uri).host || "unknown";
  } catch {
    // blocked-uri can be 'inline', 'eval', 'data', 'self', or other non-URL keywords
    return uri.length > 100 ? uri.slice(0, 100) + "..." : uri;
  }
}

function reportLegacyToSentry(report: LegacyCspReport["csp-report"]): void {
  if (!report) return;
  const directive = report["effective-directive"] || report["violated-directive"] || "unknown";
  const blocked = hostOf(report["blocked-uri"]);
  const document = hostOf(report["document-uri"]);
  logger.info(
    `[csp-report] violation: directive=${directive} blocked=${blocked} document=${document}`,
  );
  Sentry.captureMessage(`CSP violation: ${directive}`, {
    level: "warning",
    tags: {
      csp_violation: "true",
      directive,
      blocked,
    },
    extra: { ...report },
  });
}

function reportModernToSentry(report: ModernCspReport): void {
  const body = report.body;
  if (!body) return;
  const directive = body.effectiveDirective || "unknown";
  const blocked = hostOf(body.blockedURL);
  const document = hostOf(body.documentURL);
  logger.info(
    `[csp-report] violation (modern): directive=${directive} blocked=${blocked} document=${document} disposition=${body.disposition ?? "report"}`,
  );
  Sentry.captureMessage(`CSP violation: ${directive}`, {
    level: "warning",
    tags: {
      csp_violation: "true",
      directive,
      blocked,
      disposition: body.disposition ?? "report",
    },
    extra: { ...body },
  });
}

export async function POST(req: NextRequest) {
  try {
    const text = await req.text();
    if (!text) {
      return new NextResponse(null, { status: 204 });
    }
    const parsed: unknown = JSON.parse(text);

    if (Array.isArray(parsed)) {
      // Modern Reporting API — array of report objects
      for (const item of parsed) {
        const report = item as ModernCspReport;
        if (report?.type === "csp-violation") {
          reportModernToSentry(report);
        }
      }
    } else if (parsed && typeof parsed === "object" && "csp-report" in parsed) {
      // Legacy CSP-1 — single object with "csp-report" wrapper
      reportLegacyToSentry((parsed as LegacyCspReport)["csp-report"]);
    }
    // Anything else: silently ignore (don't crash on shapes we don't recognize)
  } catch (err) {
    // Defensive: malformed body, JSON parse error, Sentry call failure.
    // Log warn + return 204 anyway — never 4xx/5xx to a browser-driven report POST.
    const msg = err instanceof Error ? err.message : String(err);
    logger.warn(`[csp-report] parse error (swallowed): ${msg}`);
  }

  return new NextResponse(null, { status: 204 });
}

export async function GET() {
  return new NextResponse(null, { status: 405, headers: { Allow: "POST" } });
}
