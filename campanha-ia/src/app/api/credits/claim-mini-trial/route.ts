import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStoreByClerkId } from "@/lib/db";
import { consumeTokenBucket } from "@/lib/rate-limit-pg";
import { captureError, logger } from "@/lib/observability";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";

/**
 * POST /api/credits/claim-mini-trial
 *
 * Reivindica 1 campanha completa grátis (Beta de 50 vagas).
 * Regras:
 *  - Apenas usuário autenticado (Clerk) com email_verified === true (D-22)
 *  - 1 trial por clerk_user_id (não por store)
 *  - Throttle Postgres bucket: 3 attempts / hora por user (D-22)
 *  - Limite global de MINI_TRIAL_TOTAL_SLOTS (default 50)
 *  - Killswitch via env (MINI_TRIAL_KILLSWITCH=true rejeita imediatamente)
 *
 * Retorna:
 *  - 200 { granted: true, remaining: N }
 *  - 200 { granted: false, reason: "already_used" | "slots_full" | "killswitch" | "email_not_verified" }
 *  - 429 { granted: false, reason: "throttled" }
 *  - 401 não autenticado
 */
export async function POST() {
  try {
    const session = await auth();
    const userId = session.userId;
    if (!userId) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    // D-22: require email_verified === true. Read from sessionClaims (JWT). Some
    // Clerk JWT templates put it at the root, others under publicMetadata. Check both.
    const claims = session.sessionClaims as Record<string, unknown> | null | undefined;
    const publicMetadata = claims?.publicMetadata as { email_verified?: unknown } | undefined;
    const rootVerified = claims?.email_verified;
    const metaVerified = publicMetadata?.email_verified;
    const emailVerified = rootVerified === true || metaVerified === true;
    if (!emailVerified) {
      logger.info("mini_trial_email_unverified", { user_id: userId });
      return NextResponse.json({ granted: false, reason: "email_not_verified" });
    }

    // D-22: throttle via Postgres bucket (per-user; trials are 1 per clerk_user_id anyway).
    // 3 attempts / hour: capacity=3, refill 1 token / 3600s.
    const bucket = await consumeTokenBucket(`mini-trial:user:${userId}`, 3, 1, 3600);
    if (!bucket.allowed) {
      const retryAfterSec = Math.ceil(bucket.retryAfterMs / 1000);
      return NextResponse.json(
        { granted: false, reason: "throttled" },
        {
          status: 429,
          headers: { "Retry-After": String(retryAfterSec) },
        },
      );
    }

    if (env.MINI_TRIAL_KILLSWITCH === "true") {
      return NextResponse.json({ granted: false, reason: "killswitch" });
    }

    const totalSlots = env.MINI_TRIAL_TOTAL_SLOTS ?? 50;
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
