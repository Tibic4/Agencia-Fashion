import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { timingSafeEqual } from "crypto";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function isDeepCheckAuthorized(req: NextRequest): boolean {
  const expected = process.env.HEALTH_CHECK_SECRET;
  if (!expected) return false;
  const provided = req.headers.get("x-health-secret");
  if (!provided) return false;
  try {
    const a = Buffer.from(expected);
    const b = Buffer.from(provided);
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

/**
 * GET /api/health
 *
 * Modo público (qualquer um): retorna apenas `{status, timestamp}`. Usado por
 * monitores de uptime externos (UptimeRobot, BetterStack).
 *
 * Modo deep (header `x-health-secret` batendo com HEALTH_CHECK_SECRET):
 * retorna status detalhado de DB, APIs e storage. Usado pelo painel interno.
 */
export async function GET(req: NextRequest) {
  const start = Date.now();

  // ── Shallow check: ping rápido ao DB só para dizer se está vivo ──
  let dbAlive = false;
  try {
    const supabase = createAdminClient();
    const { error } = await supabase.from("plans").select("id").limit(1);
    dbAlive = !error;
  } catch {
    dbAlive = false;
  }

  const shallow = {
    status: dbAlive ? "ok" : "down",
    timestamp: new Date().toISOString(),
  };

  if (!isDeepCheckAuthorized(req)) {
    return NextResponse.json(shallow, {
      status: dbAlive ? 200 : 503,
      headers: { "Cache-Control": "no-store" },
    });
  }

  // ── Deep check (autorizado) ──
  const checks: Record<string, { status: "ok" | "error" | "warning"; ms?: number; detail?: string }> = {};

  checks.database = dbAlive
    ? { status: "ok", ms: Date.now() - start }
    : { status: "error", detail: "db_unreachable" };

  checks.gemini = (process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY)
    ? { status: "ok" }
    : { status: "warning", detail: "not_configured" };

  checks.clerk = process.env.CLERK_SECRET_KEY
    ? { status: "ok" }
    : { status: "error", detail: "not_configured" };

  checks.mercadopago = process.env.MERCADOPAGO_ACCESS_TOKEN
    ? { status: "ok" }
    : { status: "warning", detail: "not_configured" };

  checks.googleAi = process.env.GOOGLE_AI_API_KEY
    ? { status: "ok" }
    : { status: "warning", detail: "not_configured" };

  try {
    const supabase = createAdminClient();
    const { error } = await supabase.storage.from("product-photos").list("", { limit: 1 });
    checks.storage = error ? { status: "warning", detail: "storage_error" } : { status: "ok" };
  } catch {
    checks.storage = { status: "warning", detail: "storage_error" };
  }

  const hasError = Object.values(checks).some((c) => c.status === "error");
  const hasWarning = Object.values(checks).some((c) => c.status === "warning");
  const overall = hasError ? "unhealthy" : hasWarning ? "degraded" : "healthy";

  return NextResponse.json(
    {
      status: overall,
      version: process.env.npm_package_version || "1.0.0",
      environment: process.env.NODE_ENV,
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      responseMs: Date.now() - start,
      checks,
    },
    {
      status: hasError ? 503 : 200,
      headers: { "Cache-Control": "no-store, no-cache, must-revalidate" },
    },
  );
}
