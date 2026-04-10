import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * GET /api/health
 * Health check endpoint para monitoramento e uptime
 * Verifica: DB connection, APIs configuradas, storage
 */
export async function GET() {
  const start = Date.now();
  const checks: Record<string, { status: "ok" | "error" | "warning"; ms?: number; detail?: string }> = {};

  // 1. Database
  try {
    const dbStart = Date.now();
    const supabase = createAdminClient();
    const { error } = await supabase.from("plans").select("id").limit(1);
    checks.database = error
      ? { status: "error", detail: error.message, ms: Date.now() - dbStart }
      : { status: "ok", ms: Date.now() - dbStart };
  } catch (e) {
    checks.database = { status: "error", detail: e instanceof Error ? e.message : "Unknown" };
  }

  // 2. API Keys configured
  checks.gemini = (process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY)
    ? { status: "ok" }
    : { status: "warning", detail: "GEMINI_API_KEY not set (demo mode)" };

  checks.clerk = process.env.CLERK_SECRET_KEY
    ? { status: "ok" }
    : { status: "error", detail: "CLERK_SECRET_KEY not set" };

  checks.mercadopago = process.env.MERCADOPAGO_ACCESS_TOKEN
    ? { status: "ok" }
    : { status: "warning", detail: "MERCADOPAGO_ACCESS_TOKEN not set" };

  checks.googleAi = process.env.GOOGLE_AI_API_KEY
    ? { status: "ok" }
    : { status: "warning", detail: "GOOGLE_AI_API_KEY not set (VTO disabled)" };

  checks.fal = process.env.FAL_KEY
    ? { status: "ok" }
    : { status: "warning", detail: "Optional: FAL_KEY not set" };

  // 3. Storage
  try {
    const supabase = createAdminClient();
    const { error } = await supabase.storage.from("product-photos").list("", { limit: 1 });
    checks.storage = error
      ? { status: "warning", detail: error.message }
      : { status: "ok" };
  } catch {
    checks.storage = { status: "warning", detail: "Storage check failed" };
  }

  // Overall status
  const hasError = Object.values(checks).some((c) => c.status === "error");
  const hasWarning = Object.values(checks).some((c) => c.status === "warning");
  const overall = hasError ? "unhealthy" : hasWarning ? "degraded" : "healthy";

  return NextResponse.json({
    status: overall,
    version: process.env.npm_package_version || "1.0.0",
    environment: process.env.NODE_ENV,
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    responseMs: Date.now() - start,
    checks,
  }, {
    status: hasError ? 503 : 200,
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate",
    },
  });
}
