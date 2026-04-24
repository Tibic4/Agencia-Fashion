import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { captureError, logger } from "@/lib/observability";
import { createHmac, timingSafeEqual } from "crypto";

export const dynamic = "force-dynamic";

/**
 * FASE F.2 — Webhook Clerk para criar store placeholder em user.created.
 *
 * Evita o gap: usuário completa sign-up → é redirecionado para /gerar →
 * middleware vê sem loja → redireciona /onboarding. Com esse webhook,
 * a loja placeholder já existe no banco e a UI pode tratar o estado pré-onboarding.
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

    const event = JSON.parse(payload) as { type: string; data: Record<string, unknown> };

    // Só processa user.created — outros eventos ignorados (200 OK para não retry).
    if (event.type !== "user.created") {
      return NextResponse.json({ received: true, ignored: true });
    }

    const userId = event.data?.id as string | undefined;
    if (!userId) {
      return NextResponse.json({ error: "Missing user id" }, { status: 400 });
    }

    const supabase = createAdminClient();

    // Checa se já existe (idempotência)
    const { data: existing } = await supabase
      .from("stores")
      .select("id")
      .eq("clerk_user_id", userId)
      .maybeSingle();

    if (existing) {
      logger.info("clerk_user_created_store_exists", { user_id: userId });
      return NextResponse.json({ received: true, existed: true });
    }

    // Cria store placeholder (onboarding_completed = false)
    const emailAddresses = (event.data?.email_addresses as Array<{ email_address: string }>) || [];
    const primaryEmail = emailAddresses[0]?.email_address || null;
    const placeholderName = primaryEmail ? primaryEmail.split("@")[0] : "Minha Loja";

    await supabase.from("stores").insert({
      clerk_user_id: userId,
      name: placeholderName,
      segment_primary: "outro",
      onboarding_completed: false,
    });

    logger.info("clerk_user_created_store_created", { user_id: userId });
    return NextResponse.json({ received: true, created: true });
  } catch (e) {
    captureError(e, { route: "/api/webhooks/clerk" });
    return NextResponse.json({ received: true, error: true }, { status: 200 });
  }
}
