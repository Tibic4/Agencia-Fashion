import { NextResponse } from "next/server";
import { refreshExchangeRate } from "@/lib/pricing";

export const dynamic = "force-dynamic";
export const maxDuration = 10;

/**
 * GET /api/cron/exchange-rate
 *
 * Atualiza a taxa de câmbio USD→BRL via AwesomeAPI.
 * Será chamada automaticamente pelo Inngest ou Vercel Cron 1x/dia.
 * Também pode ser chamada manualmente pelo admin.
 *
 * Proteção: verifica CRON_SECRET header ou query param para evitar abuso.
 */
export async function GET(request: Request) {
  // Proteção simples: o Vercel Cron envia Authorization com CRON_SECRET
  const authHeader = request.headers.get("authorization");
  const url = new URL(request.url);
  const secret = url.searchParams.get("secret");
  const cronSecret = process.env.CRON_SECRET;

  // Em produção, exigir secret. Em dev, permitir sem.
  if (cronSecret && authHeader !== `Bearer ${cronSecret}` && secret !== cronSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await refreshExchangeRate();

  return NextResponse.json({
    success: true,
    rate: result.rate,
    source: result.source,
    timestamp: new Date().toISOString(),
  });
}
