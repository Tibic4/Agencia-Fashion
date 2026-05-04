import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createHash } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { captureError, logger } from "@/lib/observability";
import { getStoreByClerkId, updateStorePlan } from "@/lib/db";
import { consumeTokenBucket } from "@/lib/rate-limit-pg";
import {
  GooglePlayNotConfiguredError,
  PACKAGE_NAME,
  acknowledgeSubscription,
  isGooglePlayConfigured,
  isValidSku,
  planFromSku,
  verifySubscription,
  type ValidSku,
} from "@/lib/payments/google-play";

export const dynamic = "force-dynamic";

/**
 * M2 Phase 1 — compensating control 3 (hash-bound purchase verification).
 *
 * Mirror of `crialook-app/lib/billing.ts` `hashUserIdForBilling`: SHA-256 of
 * the Clerk user id, hex-encoded, first 64 chars (Google Play caps the
 * obfuscated id at 64 chars). Mobile sets this on `requestPurchase.google
 * .obfuscatedAccountIdAndroid`; Google Play returns it on the
 * SubscriptionPurchase as `obfuscatedExternalAccountId`. If the two don't
 * match, a captured purchaseToken is being replayed by another user → 403.
 */
function expectedObfuscatedAccountId(userId: string): string {
  return createHash("sha256").update(userId).digest("hex").slice(0, 64);
}

/**
 * POST /api/billing/verify
 *
 * Chamado pelo app mobile após `requestSubscription`.
 *
 * Body: { sku: string, purchaseToken: string }
 * Auth: Clerk Bearer (via `auth()`).
 *
 * Fluxo:
 *  1. Validar SKU contra lista whitelisted (não confiar no client)
 *  2. GET androidpublisher subscriptions/{sku}/tokens/{token}
 *  3. Validar paymentState === 1 && expiry > now
 *  4. Acknowledge se ainda não acked (obrigatório em <3 dias, senão Google reembolsa)
 *  5. Upsert na tabela `subscriptions` (PK clerk_user_id)
 *  6. Atualizar `stores.plan` para refletir
 *  7. Retornar { plan, expiresAt } pro app mostrar UI atualizada
 *
 * Estado atual: 503 enquanto Google Play API não está configurada
 * (ver `lib/payments/google-play.ts`).
 */
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    // M2 Phase 1 — compensating control 2: per-user rate limit. 30 reqs / 5min
    // generous for legitimate re-tries after Play Store hiccups, but caps brute
    // force on stolen purchase tokens. Bucket key namespaced by route.
    {
      const bucket = await consumeTokenBucket(
        `billing.verify:${userId}`,
        30,
        30,
        300,
      );
      if (!bucket.allowed) {
        const retryAfterSec = Math.max(1, Math.ceil(bucket.retryAfterMs / 1000));
        return NextResponse.json(
          { error: "Muitas tentativas. Aguarde alguns minutos.", code: "RATE_LIMITED" },
          { status: 429, headers: { "Retry-After": String(retryAfterSec) } },
        );
      }
    }

    if (!isGooglePlayConfigured()) {
      logger.warn("billing_verify_not_configured", { user_id: userId });
      return NextResponse.json(
        {
          error: "Billing temporariamente indisponível",
          code: "BILLING_NOT_CONFIGURED",
        },
        { status: 503 },
      );
    }

    const body = (await req.json().catch(() => ({}))) as {
      sku?: unknown;
      purchaseToken?: unknown;
    };

    if (!isValidSku(body.sku)) {
      return NextResponse.json({ error: "SKU inválido" }, { status: 400 });
    }
    if (typeof body.purchaseToken !== "string" || body.purchaseToken.length < 10) {
      return NextResponse.json({ error: "purchaseToken inválido" }, { status: 400 });
    }

    const sku: ValidSku = body.sku;
    const purchaseToken = body.purchaseToken;

    // 1. Verifica com a Google Play API
    const status = await verifySubscription(sku, purchaseToken);

    // M2 Phase 1 — compensating control 3: hash-bound purchase verification.
    // Without this, a leaked purchaseToken could be replayed by an attacker
    // logged in as a different Clerk user. The mobile produces the hash at
    // purchase time (`crialook-app/lib/billing.ts` `hashUserIdForBilling`)
    // and Google Play echoes it back as `obfuscatedExternalAccountId`. Any
    // mismatch — including missing field — must reject with 403, because we
    // never want to grant a plan based on "trust the client was authed" alone.
    const expectedHash = expectedObfuscatedAccountId(userId);
    const actualHash = status.obfuscatedExternalAccountId;
    if (!actualHash || actualHash !== expectedHash) {
      captureError(new Error("billing_verify_obfuscated_mismatch"), {
        route: "POST /api/billing/verify",
        phase: "obfuscated_check",
        "billing.obfuscated_mismatch": true,
        user_id: userId,
        sku,
        // Don't log the actual hash — could correlate to a leaked token's
        // legitimate owner. Just note presence + length.
        actual_present: typeof actualHash === "string",
        actual_length: typeof actualHash === "string" ? actualHash.length : 0,
      });
      return NextResponse.json(
        {
          error: "Compra não pertence a este usuário",
          code: "OBFUSCATED_ID_MISMATCH",
        },
        { status: 403 },
      );
    }

    // Validações do estado retornado
    const expiryMs = Number(status.expiryTimeMillis);
    if (!Number.isFinite(expiryMs)) {
      return NextResponse.json({ error: "Resposta inválida do Play" }, { status: 502 });
    }
    if (expiryMs <= Date.now()) {
      return NextResponse.json({ error: "Assinatura expirada" }, { status: 410 });
    }
    if (status.paymentState !== 1) {
      return NextResponse.json({ error: "Pagamento pendente" }, { status: 402 });
    }

    // 2. Acknowledge se ainda não acked (idempotente do lado da Google)
    if (status.acknowledgementState === 0) {
      await acknowledgeSubscription(sku, purchaseToken);
    }

    // 3. Upsert no DB
    const plan = planFromSku(sku);
    const supabase = createAdminClient();
    const expiresAt = new Date(expiryMs).toISOString();

    const { error: upsertErr } = await supabase.from("subscriptions").upsert(
      {
        clerk_user_id: userId,
        sku,
        plan,
        purchase_token: purchaseToken,
        expiry_time: expiresAt,
        state: "PURCHASED",
        auto_renewing: status.autoRenewing,
        acknowledged: true,
        linked_purchase_token: status.linkedPurchaseToken ?? null,
        last_verified_at: new Date().toISOString(),
      },
      { onConflict: "clerk_user_id" },
    );

    if (upsertErr) {
      captureError(upsertErr, { route: "POST /api/billing/verify", phase: "upsert" });
      return NextResponse.json({ error: "Erro ao salvar assinatura" }, { status: 500 });
    }

    // 4. Atualiza stores.plan_id pelo nome do plano. A versão antiga
    // tentava setar uma coluna `plan` que não existe — update silencioso
    // não falhava mas também não fazia nada, e /api/store/usage continuava
    // lendo o plan_id antigo. updateStorePlan resolve plan_id pelo nome
    // e também garante que store_usage esteja consistente com o novo plano.
    const store = await getStoreByClerkId(userId);
    if (store) {
      try {
        await updateStorePlan(store.id, plan);
      } catch (e) {
        // Não vamos derrubar o verify por causa do update de plano —
        // a subscription já está gravada. Logamos pra Sentry e seguimos.
        captureError(e, { route: "POST /api/billing/verify", phase: "updateStorePlan" });
      }
    }

    logger.info("subscription_verified", {
      user_id: userId,
      sku,
      plan,
      expires_at: expiresAt,
      package: PACKAGE_NAME,
    });

    return NextResponse.json({ plan: sku, expiresAt });
  } catch (e) {
    if (e instanceof GooglePlayNotConfiguredError) {
      return NextResponse.json(
        { error: "Billing temporariamente indisponível", code: "BILLING_NOT_CONFIGURED" },
        { status: 503 },
      );
    }
    captureError(e, { route: "POST /api/billing/verify" });
    return NextResponse.json({ error: "Erro ao verificar compra" }, { status: 500 });
  }
}
