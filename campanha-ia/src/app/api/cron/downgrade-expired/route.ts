import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { captureError, logger } from "@/lib/observability";
import { timingSafeEqual } from "crypto";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * FASE F.1 — Cron diário para detectar lojas que deveriam ter sido rebaixadas
 * para "gratis" porque:
 *  - mercadopago_subscription_id é NULL (assinatura cancelada)
 *  - AND plan_id != plano 'gratis'
 *  - AND store_usage do mês atual tem period_end < hoje
 *
 * Protegido por Bearer token (`CRON_SECRET`). Rode via Inngest cron, Vercel Cron,
 * ou qualquer scheduler externo.
 */

function isAuthorized(req: NextRequest): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) return false;
  const header = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
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

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const supabase = createAdminClient();

    // 1. Encontra plano "gratis"
    const { data: freePlan } = await supabase
      .from("plans")
      .select("id")
      .eq("name", "gratis")
      .maybeSingle();

    if (!freePlan) {
      return NextResponse.json({ error: "Plano 'gratis' não configurado" }, { status: 500 });
    }

    // 2. Lojas candidatas a downgrade:
    // - subscription_id NULL (cancelada)
    // - plan_id != grátis
    const { data: candidates, error: candErr } = await supabase
      .from("stores")
      .select("id, plan_id, name")
      .is("mercadopago_subscription_id", null)
      .neq("plan_id", freePlan.id);

    if (candErr) throw candErr;
    if (!candidates || candidates.length === 0) {
      return NextResponse.json({ ok: true, downgraded: 0, message: "Nenhuma loja candidata" });
    }

    const today = new Date().toISOString().split("T")[0];
    let downgraded = 0;
    const errors: Array<{ storeId: string; error: string }> = [];

    for (const store of candidates) {
      // Só rebaixar se o período atual já expirou
      const { data: usage } = await supabase
        .from("store_usage")
        .select("period_end")
        .eq("store_id", store.id)
        .order("period_end", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!usage?.period_end || usage.period_end >= today) continue;

      try {
        await supabase
          .from("stores")
          .update({
            plan_id: freePlan.id,
            updated_at: new Date().toISOString(),
          })
          .eq("id", store.id);
        logger.info("store_downgraded_to_free", { store_id: store.id, name: store.name });
        downgraded++;
      } catch (e) {
        errors.push({
          storeId: store.id,
          error: e instanceof Error ? e.message : String(e),
        });
      }
    }

    return NextResponse.json({ ok: true, downgraded, errors: errors.length, candidates: candidates.length });
  } catch (e) {
    captureError(e, { route: "/api/cron/downgrade-expired" });
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

// Opcional: GET para health check do cron
export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  return NextResponse.json({ ok: true, endpoint: "downgrade-expired", method: "POST" });
}
