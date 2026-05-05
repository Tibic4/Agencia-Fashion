import { NextResponse } from "next/server";
import { logger } from "@/lib/observability";
import { refreshExchangeRate } from "@/lib/pricing";
import { env } from "@/lib/env";
import { timingSafeEqual } from "crypto";

export const dynamic = "force-dynamic";
export const maxDuration = 10;

/**
 * GET /api/cron/exchange-rate
 *
 * Atualiza a taxa de câmbio USD→BRL via AwesomeAPI.
 * Será chamada automaticamente pelo Inngest ou Vercel Cron 1x/dia.
 * Também pode ser chamada manualmente pelo admin.
 *
 * Proteção: verifica CRON_SECRET via Authorization: Bearer (D-23).
 */
function isAuthorized(request: Request): boolean {
  const expected = env.CRON_SECRET;
  if (!expected) return false;
  const header = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!header) return false;
  try {
    const a = Buffer.from(expected);
    const b = Buffer.from(header);
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export async function GET(request: Request) {
  // D-23: ?secret= query-string path removed (leaks via referrer / proxy logs).
  // Authorization header only, timing-safe (paridade com downgrade-expired/judge-reconcile).
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await refreshExchangeRate();

    return NextResponse.json({
      success: true,
      rate: result.rate,
      source: result.source,
      timestamp: new Date().toISOString(),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Erro desconhecido";
    logger.error("[Cron:ExchangeRate] ❌ Falha:", message);
    return NextResponse.json(
      { error: "Falha ao atualizar câmbio", details: message },
      { status: 500 }
    );
  }
}
