import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";
export const revalidate = 60; // cache 60s no Next/edge

/**
 * GET /api/credits/mini-trial-status
 *
 * PÚBLICO (não requer auth) — usado pelo contador da landing.
 * Retorna:
 *  {
 *    enabled: boolean,           // false se killswitch ativo
 *    total_slots: number,
 *    total_used: number,
 *    remaining: number,
 *    eligible: boolean | null,   // se autenticado: true se ainda pode reivindicar
 *    already_used: boolean       // se autenticado: true se já reivindicou
 *  }
 */
export async function GET() {
  if (env.MINI_TRIAL_KILLSWITCH === "true") {
    return NextResponse.json({
      enabled: false,
      total_slots: 0,
      total_used: 0,
      remaining: 0,
      eligible: null,
      already_used: false,
    });
  }

  const totalSlots = env.MINI_TRIAL_TOTAL_SLOTS ?? 50;

  const supabase = createAdminClient();
  const { count: totalUsed } = await supabase
    .from("mini_trial_uses")
    .select("clerk_user_id", { count: "exact", head: true });

  const used = totalUsed ?? 0;
  const remaining = Math.max(0, totalSlots - used);

  // Se autenticado, retorna se já reivindicou
  let alreadyUsed = false;
  let eligible: boolean | null = null;

  try {
    const { userId } = await auth();
    if (userId) {
      const { count } = await supabase
        .from("mini_trial_uses")
        .select("clerk_user_id", { count: "exact", head: true })
        .eq("clerk_user_id", userId);
      alreadyUsed = (count ?? 0) > 0;
      eligible = !alreadyUsed && remaining > 0;
    }
  } catch {
    /* anônimo, ignora */
  }

  return NextResponse.json({
    enabled: true,
    total_slots: totalSlots,
    total_used: used,
    remaining,
    eligible,
    already_used: alreadyUsed,
  });
}
