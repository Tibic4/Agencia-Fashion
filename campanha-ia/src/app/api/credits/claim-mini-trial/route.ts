import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStoreByClerkId } from "@/lib/db";
import { captureError, logger } from "@/lib/observability";

export const dynamic = "force-dynamic";

/**
 * POST /api/credits/claim-mini-trial
 *
 * Reivindica 1 campanha completa grátis (Beta de 50 vagas).
 * Regras:
 *  - Apenas usuário autenticado (Clerk)
 *  - 1 trial por clerk_user_id (não por store)
 *  - Limite global de MINI_TRIAL_TOTAL_SLOTS (default 50)
 *  - Killswitch via env (MINI_TRIAL_KILLSWITCH=true rejeita imediatamente)
 *
 * Retorna:
 *  - 200 { granted: true, remaining: N }
 *  - 200 { granted: false, reason: "already_used" | "slots_full" | "killswitch" }
 *  - 401 não autenticado
 */
export async function POST() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    if (process.env.MINI_TRIAL_KILLSWITCH === "true") {
      return NextResponse.json({ granted: false, reason: "killswitch" });
    }

    const totalSlots = parseInt(process.env.MINI_TRIAL_TOTAL_SLOTS ?? "50", 10);
    if (!Number.isFinite(totalSlots) || totalSlots <= 0) {
      return NextResponse.json({ granted: false, reason: "killswitch" });
    }

    const store = await getStoreByClerkId(userId);
    if (!store) {
      return NextResponse.json(
        { granted: false, reason: "no_store", message: "Complete o onboarding primeiro" },
        { status: 400 },
      );
    }

    const supabase = createAdminClient();
    const { data, error } = await supabase.rpc("claim_mini_trial", {
      p_clerk_user_id: userId,
      p_store_id: store.id,
      p_total_slots: totalSlots,
    });

    if (error) {
      captureError(error, { route: "/api/credits/claim-mini-trial", user_id: userId });
      return NextResponse.json(
        { granted: false, reason: "internal_error" },
        { status: 500 },
      );
    }

    const result = data as {
      granted: boolean;
      reason?: string;
      remaining?: number;
      total_used?: number;
      total_slots?: number;
    };

    if (result.granted) {
      logger.info("mini_trial_granted", {
        user_id: userId,
        store_id: store.id,
        remaining: result.remaining,
      });
    } else {
      logger.info("mini_trial_denied", {
        user_id: userId,
        reason: result.reason,
      });
    }

    return NextResponse.json(result);
  } catch (e) {
    captureError(e, { route: "/api/credits/claim-mini-trial" });
    return NextResponse.json(
      { granted: false, reason: "internal_error" },
      { status: 500 },
    );
  }
}
