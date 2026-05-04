import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { captureError, logger } from "@/lib/observability";
import {
  GooglePlayNotConfiguredError,
  acknowledgeSubscription,
  isGooglePlayConfigured,
  isValidSku,
  planFromSku,
  verifySubscription,
  type ValidSku,
} from "@/lib/payments/google-play";
import { skuToPlanSlug } from "@/lib/payments/sku-plan-mapping";
import { updateStorePlan, getStoreByClerkId } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * POST /api/billing/restore
 *
 * Acionado pelo botão "Restaurar compras" no app (Plano screen).
 *
 * Body: { purchases: [{ sku, token }] }
 *   — vem direto de `getAvailablePurchases()` no react-native-iap
 *
 * Para cada compra:
 *  - Validar SKU (whitelisted)
 *  - GET status na Google Play API
 *  - Se válida e não-expirada, salvar/atualizar em `subscriptions`
 *  - Se for a primeira válida do user, atualizar `stores.plan`
 *
 * Retorna { restored: number } — quantas foram efetivamente recuperadas.
 *
 * Por que processar tudo em sequência (não paralelo)?
 *   No caller comum, `purchases` tem 0-1 itens (assinatura ativa).
 *   Em casos de upgrade/downgrade, no máximo 2. Paralelizar não vale a
 *   complexidade adicional de tratar erros parciais.
 */
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    if (!isGooglePlayConfigured()) {
      logger.warn("billing_restore_not_configured", { user_id: userId });
      return NextResponse.json(
        { error: "Billing temporariamente indisponível", code: "BILLING_NOT_CONFIGURED" },
        { status: 503 },
      );
    }

    const body = (await req.json().catch(() => ({}))) as {
      purchases?: unknown;
    };
    if (!Array.isArray(body.purchases)) {
      return NextResponse.json({ error: "purchases deve ser array" }, { status: 400 });
    }

    type RawPurchase = { sku?: unknown; token?: unknown };
    const valid: { sku: ValidSku; token: string }[] = [];
    for (const raw of body.purchases as RawPurchase[]) {
      if (
        isValidSku(raw?.sku) &&
        typeof raw?.token === "string" &&
        raw.token.length >= 10
      ) {
        valid.push({ sku: raw.sku, token: raw.token });
      }
    }

    if (valid.length === 0) {
      return NextResponse.json({ restored: 0 });
    }

    const supabase = createAdminClient();
    let restored = 0;
    let lastValidPlan: ReturnType<typeof planFromSku> | null = null;
    const now = Date.now();

    for (const { sku, token } of valid) {
      try {
        const status = await verifySubscription(sku, token);
        const expiryMs = Number(status.expiryTimeMillis);
        if (!Number.isFinite(expiryMs) || expiryMs <= now) continue;
        if (status.paymentState !== 1) continue;

        if (status.acknowledgementState === 0) {
          await acknowledgeSubscription(sku, token).catch(() => {
            /* não-fatal: pode ack na próxima sync */
          });
        }

        const plan = planFromSku(sku);
        const { error } = await supabase.from("subscriptions").upsert(
          {
            clerk_user_id: userId,
            sku,
            plan,
            purchase_token: token,
            expiry_time: new Date(expiryMs).toISOString(),
            state: "RESTORED",
            auto_renewing: status.autoRenewing,
            acknowledged: true,
            linked_purchase_token: status.linkedPurchaseToken ?? null,
            last_verified_at: new Date().toISOString(),
          },
          { onConflict: "clerk_user_id" },
        );

        if (!error) {
          restored++;
          lastValidPlan = plan;
        } else {
          captureError(error, {
            route: "POST /api/billing/restore",
            phase: "upsert",
            sku,
          });
        }
      } catch (innerErr) {
        if (innerErr instanceof GooglePlayNotConfiguredError) throw innerErr;
        captureError(innerErr, { route: "POST /api/billing/restore", sku });
      }
    }

    if (lastValidPlan) {
      // C-1 fix: route through updateStorePlan so plan_id (FK) is updated, not
      // the non-existent "plan" text column. Pass null for mpSubscriptionId
      // since restore is a Play-side recovery, not an MP subscription rebind.
      const store = await getStoreByClerkId(userId);
      if (!store) {
        captureError(new Error("restore: store not found for clerk user"), {
          route: "POST /api/billing/restore",
          user_id: userId,
        });
      } else {
        const slug = skuToPlanSlug(lastValidPlan);
        await updateStorePlan(store.id, slug, null);
      }
    }

    logger.info("subscription_restored", {
      user_id: userId,
      submitted: valid.length,
      restored,
    });

    return NextResponse.json({ restored });
  } catch (e) {
    if (e instanceof GooglePlayNotConfiguredError) {
      return NextResponse.json(
        { error: "Billing temporariamente indisponível", code: "BILLING_NOT_CONFIGURED" },
        { status: 503 },
      );
    }
    captureError(e, { route: "POST /api/billing/restore" });
    return NextResponse.json({ error: "Erro ao restaurar compras" }, { status: 500 });
  }
}
