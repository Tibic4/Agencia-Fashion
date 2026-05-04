import { NextResponse } from "next/server";
import { refreshExchangeRate } from "@/lib/pricing";
import { env } from "@/lib/env";

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
export async function GET(request: Request) {
  // D-23: ?secret= query-string path removed (leaks via referrer / proxy logs).
  // Authorization header only.
  const authHeader = request.headers.get("authorization");
  const cronSecret = env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
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
    console.error("[Cron:ExchangeRate] ❌ Falha:", message);
    return NextResponse.json(
      { error: "Falha ao atualizar câmbio", details: message },
      { status: 500 }
    );
  }
}
