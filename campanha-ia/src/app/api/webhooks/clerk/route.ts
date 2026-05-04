import { NextRequest, NextResponse } from "next/server";
import { createStore, getStoreByClerkId } from "@/lib/db";
import { captureError, logger } from "@/lib/observability";
import { dedupWebhook, markWebhookProcessed } from "@/lib/webhooks/dedup";
import { createHmac, timingSafeEqual } from "crypto";

export const dynamic = "force-dynamic";

// D-24: Svix recommends ±5 minutes. We use 5min past + 30s future for clock drift.
const CLERK_SVIX_MAX_PAST_MS = 5 * 60 * 1000;     // 300_000
const CLERK_SVIX_MAX_FUTURE_MS = 30 * 1000;       // 30_000

/**
 * Webhook Clerk para criar store placeholder em user.created.
 *
 * Evita o gap: usuário completa sign-up → é redirecionado para /gerar →
 * middleware vê sem loja → redireciona /onboarding. Com esse webhook,
 * a loja placeholder já existe no banco e a UI pode tratar o estado pré-onboarding.
 *
 * Phase 1 / C-3: routes through createStore() so the row lands with
 * non-null plan_id (free plan) AND a matching store_usage row in one
 * logical operation. Previously the bare insert here created an orphan
 * stores row with plan_id=null and no store_usage — incrementCampaignsUsed
 * silently no-op'd because getOrCreateCurrentUsage's self-heal didn't trigger
 * on the first generation attempt for these accounts.
 *
 * Phase 1 / D-06: dedupWebhook(provider='clerk', svix-id) short-circuits
 * replays before business logic. Complementary to the per-user `existing`
 * check below (which catches re-signups by the same user).
 *
 * Valida assinatura Svix HMAC-SHA256 (padrão Clerk).
 * https://clerk.com/docs/integrations/webhooks/verify
 */

function verifyClerkSignature(
  payload: string,
  svixId: string | null,
  svixTimestamp: string | null,
  svixSignature: string | null,
): boolean {
  const secret = process.env.CLERK_WEBHOOK_SECRET;
  if (!secret || !svixId || !svixTimestamp || !svixSignature) return false;

  // Secret vem como "whsec_..."; tira o prefixo e faz base64-decode
  const secretBytes = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
  const signedPayload = `${svixId}.${svixTimestamp}.${payload}`;
  const expected = createHmac("sha256", secretBytes).update(signedPayload).digest("base64");

  // svixSignature pode conter múltiplas: "v1,<sig> v1,<sig2>"
  for (const part of svixSignature.split(" ")) {
    const [, sig] = part.split(",");
    if (!sig) continue;
    try {
      const a = Buffer.from(sig, "base64");
      const b = Buffer.from(expected, "base64");
      if (a.length === b.length && timingSafeEqual(a, b)) return true;
    } catch {
      continue;
    }
  }
  return false;
}

export async function POST(req: NextRequest) {
  try {
    const payload = await req.text();

    const svixId = req.headers.get("svix-id");
    const svixTimestamp = req.headers.get("svix-timestamp");
    const svixSignature = req.headers.get("svix-signature");

    if (!verifyClerkSignature(payload, svixId, svixTimestamp, svixSignature)) {
      logger.warn("clerk_webhook_invalid_signature", { svixId });
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }
    // svixId is non-null here because verifyClerkSignature would have rejected null.
    const eventId = svixId as string;

    // D-24: timestamp-skew check (replay defense).
    // svix-timestamp is unix seconds. Reject if too old or far in the future.
    const tsSec = svixTimestamp ? Number.parseInt(svixTimestamp, 10) : NaN;
    if (!Number.isFinite(tsSec)) {
      logger.warn("clerk_webhook_invalid_timestamp", { svixId, svixTimestamp });
      return NextResponse.json({ error: "Invalid timestamp" }, { status: 400 });
    }
    const tsMs = tsSec * 1000;
    const nowMs = Date.now();
    if (tsMs < nowMs - CLERK_SVIX_MAX_PAST_MS || tsMs > nowMs + CLERK_SVIX_MAX_FUTURE_MS) {
      logger.warn("clerk_webhook_timestamp_skew", {
        svixId,
        svixTimestamp,
        skew_ms: nowMs - tsMs,
      });
      return NextResponse.json({ error: "Timestamp out of range" }, { status: 401 });
    }

    const event = JSON.parse(payload) as { type: string; data: Record<string, unknown> };

    // D-06: dedup BEFORE business logic.
    let dedup;
    try {
      dedup = await dedupWebhook("clerk", eventId, event);
    } catch (e) {
      captureError(e, { route: "/api/webhooks/clerk", phase: "dedup" });
      // Cannot dedup — return 200 to avoid Clerk retry storm but capture for ops.
      return NextResponse.json({ received: true, error: "dedup_failed" }, { status: 200 });
    }
    if (dedup.duplicate) {
      logger.info("clerk_webhook_duplicate_short_circuit", { svixId });
      return NextResponse.json({ received: true, duplicate: true });
    }

    // Só processa user.created — outros eventos ignorados (200 OK para não retry).
    if (event.type !== "user.created") {
      await markWebhookProcessed("clerk", eventId);
      return NextResponse.json({ received: true, ignored: true });
    }

    const userId = event.data?.id as string | undefined;
    if (!userId) {
      return NextResponse.json({ error: "Missing user id" }, { status: 400 });
    }

    // Per-user idempotency (complementary to per-event dedup above).
    const existing = await getStoreByClerkId(userId);
    if (existing) {
      logger.info("clerk_user_created_store_exists", { user_id: userId });
      await markWebhookProcessed("clerk", eventId);
      return NextResponse.json({ received: true, existed: true });
    }

    const emailAddresses = (event.data?.email_addresses as Array<{ email_address: string }>) || [];
    const primaryEmail = emailAddresses[0]?.email_address || null;
    const placeholderName = primaryEmail ? primaryEmail.split("@")[0] : "Minha Loja";

    // C-3 fix: route through createStore so plan_id (free) and store_usage
    // are populated atomically. Placeholder mode = onboarding not yet completed.
    const store = await createStore({
      clerkUserId: userId,
      name: placeholderName,
      segmentPrimary: "outro",
      onboardingCompleted: false,
    });

    logger.info("clerk_user_created_store_created", { user_id: userId, store_id: store.id });
    await markWebhookProcessed("clerk", eventId);
    return NextResponse.json({ received: true, created: true });
  } catch (e) {
    captureError(e, { route: "/api/webhooks/clerk" });
    return NextResponse.json({ received: true, error: true }, { status: 200 });
  }
}
