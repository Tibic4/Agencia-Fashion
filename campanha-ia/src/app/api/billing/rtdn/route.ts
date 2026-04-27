import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { captureError, logger } from "@/lib/observability";
import {
  isGooglePlayConfigured,
  isValidSku,
  planFromSku,
  type ValidSku,
} from "@/lib/payments/google-play";

export const dynamic = "force-dynamic";

/**
 * POST /api/billing/rtdn — Real-Time Developer Notifications.
 *
 * Webhook acionado pelo Google Pub/Sub a cada evento de assinatura
 * (renovação, cancelamento, hold, expiração, etc).
 *
 * IMPORTANTE — sem auth Clerk: o caller é o Google, não o usuário. A
 * autenticação é feita validando o JWT que o Pub/Sub anexa no header
 * Authorization (issuer = accounts.google.com, aud = a URL deste endpoint).
 *
 * Estado atual: 503 enquanto configuração não chega. Quando chegar:
 *  - GOOGLE_PUBSUB_AUDIENCE = URL pública deste endpoint
 *  - GOOGLE_PUBSUB_ALLOWED_SERVICE_ACCOUNT = email do SA do Pub/Sub
 *    (geralmente <project-number>-compute@developer.gserviceaccount.com)
 *  - GOOGLE_PLAY_PACKAGE_NAME para validar `packageName` do payload
 *
 * Estrutura do evento (após decodificar message.data base64):
 *   {
 *     version: "1.0",
 *     packageName: "com.crialook.app",
 *     eventTimeMillis: "1700000000000",
 *     subscriptionNotification?: {
 *       version: "1.0",
 *       notificationType: 1..13,
 *       purchaseToken: "abc...",
 *       subscriptionId: "pro_mensal"
 *     },
 *     // ou voidedPurchaseNotification, oneTimeProductNotification, testNotification
 *   }
 *
 * Tipos de notificação (notificationType):
 *   1  RECOVERED          — voltou após problema de pagamento
 *   2  RENEWED            — renovação normal
 *   3  CANCELED           — cancelada (mas ainda válida até expiry)
 *   4  PURCHASED          — primeira compra
 *   5  ON_HOLD            — pagamento falhou, em hold
 *   6  IN_GRACE_PERIOD    — em grace period
 *   7  RESTARTED          — voltou após cancel
 *   8  PRICE_CHANGE_CONFIRMED
 *   9  DEFERRED
 *   10 PAUSED
 *   11 PAUSE_SCHEDULE_CHANGED
 *   12 REVOKED            — refund/chargeback (desfazer benefícios)
 *   13 EXPIRED            — expirou de fato
 *
 * SLA: responder 200 OK em <10s ou Pub/Sub re-tenta com backoff
 * exponencial (até 7 dias). Errors 5xx fazem o evento ser re-entregue;
 * 4xx fazem dead-letter (conforme config do topic).
 */

interface PubSubEnvelope {
  message?: {
    data?: string;
    messageId?: string;
    publishTime?: string;
  };
  subscription?: string;
}

interface SubscriptionNotification {
  version: string;
  notificationType: number;
  purchaseToken: string;
  subscriptionId: string;
}

interface RtdnPayload {
  version: string;
  packageName: string;
  eventTimeMillis: string;
  subscriptionNotification?: SubscriptionNotification;
  testNotification?: { version: string };
  voidedPurchaseNotification?: {
    purchaseToken: string;
    orderId: string;
    productType: number;
    refundType: number;
  };
}

const NOTIFICATION_TYPE_TO_STATE: Record<number, string> = {
  1: "RECOVERED",
  2: "RENEWED",
  3: "CANCELED",
  4: "PURCHASED",
  5: "ON_HOLD",
  6: "IN_GRACE_PERIOD",
  7: "RESTARTED",
  8: "PRICE_CHANGE_CONFIRMED",
  9: "DEFERRED",
  10: "PAUSED",
  11: "PAUSE_SCHEDULE_CHANGED",
  12: "REVOKED",
  13: "EXPIRED",
};

/**
 * notificationTypes que cancelam acesso aos features pagos.
 * Quando chegamos num destes, fazemos rollback do `stores.plan`.
 */
const REVOKING_NOTIFICATIONS = new Set([12, 13]); // REVOKED, EXPIRED

export async function POST(req: NextRequest) {
  try {
    if (!isGooglePlayConfigured()) {
      logger.warn("billing_rtdn_not_configured");
      // 503 faz o Pub/Sub re-tentar — desejado: quando configurarmos,
      // eventos perdidos ainda chegam.
      return NextResponse.json(
        { error: "Billing not configured", code: "BILLING_NOT_CONFIGURED" },
        { status: 503 },
      );
    }

    // ─── 1. Validar JWT do Pub/Sub ────────────────────────────────────
    // TODO quando a config chegar: validar header Authorization Bearer JWT
    // contra GOOGLE_PUBSUB_ALLOWED_SERVICE_ACCOUNT + GOOGLE_PUBSUB_AUDIENCE
    // (issuer accounts.google.com, aud = nossa URL, email = SA esperado).
    // Sem essa validação, qualquer um pode forjar eventos via curl.
    const authHeader = req.headers.get("authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Missing token" }, { status: 401 });
    }

    // ─── 2. Parse do envelope Pub/Sub ─────────────────────────────────
    const envelope = (await req.json().catch(() => ({}))) as PubSubEnvelope;
    if (!envelope.message?.data) {
      return NextResponse.json({ error: "Invalid envelope" }, { status: 400 });
    }

    let payload: RtdnPayload;
    try {
      const decoded = Buffer.from(envelope.message.data, "base64").toString("utf-8");
      payload = JSON.parse(decoded);
    } catch (parseErr) {
      captureError(parseErr, { route: "POST /api/billing/rtdn", phase: "decode" });
      return NextResponse.json({ error: "Invalid base64/json" }, { status: 400 });
    }

    // Valida package name (anti-forge)
    const expectedPackage = process.env.GOOGLE_PLAY_PACKAGE_NAME ?? "com.crialook.app";
    if (payload.packageName !== expectedPackage) {
      logger.warn("billing_rtdn_wrong_package", {
        got: payload.packageName,
        expected: expectedPackage,
      });
      return NextResponse.json({ error: "Wrong package" }, { status: 400 });
    }

    // ─── 3. Test notifications: ack e sai ─────────────────────────────
    if (payload.testNotification) {
      logger.info("billing_rtdn_test", { version: payload.testNotification.version });
      return NextResponse.json({ ok: true, kind: "test" });
    }

    // ─── 4. Subscription notifications ────────────────────────────────
    const sn = payload.subscriptionNotification;
    if (!sn) {
      // Outros tipos (voided, oneTime) não são relevantes pro nosso modelo
      // de subscription. Ack OK pra Pub/Sub não re-tentar.
      return NextResponse.json({ ok: true, kind: "ignored" });
    }

    if (!isValidSku(sn.subscriptionId)) {
      logger.warn("billing_rtdn_unknown_sku", { sku: sn.subscriptionId });
      return NextResponse.json({ ok: true, kind: "unknown_sku" });
    }

    const sku: ValidSku = sn.subscriptionId;
    const state = NOTIFICATION_TYPE_TO_STATE[sn.notificationType] ?? `UNKNOWN_${sn.notificationType}`;
    const supabase = createAdminClient();

    // Acha o user pelo purchase_token (UNIQUE, foi gravado no /verify)
    const { data: existing } = await supabase
      .from("subscriptions")
      .select("clerk_user_id")
      .eq("purchase_token", sn.purchaseToken)
      .maybeSingle();

    if (!existing?.clerk_user_id) {
      // Token desconhecido — talvez purchase ainda não passou pelo /verify.
      // Logamos e ack OK (re-tentar não vai resolver).
      logger.warn("billing_rtdn_unknown_token", {
        token_prefix: sn.purchaseToken.slice(0, 12),
        type: sn.notificationType,
      });
      return NextResponse.json({ ok: true, kind: "unknown_token" });
    }

    const userId = existing.clerk_user_id;

    // Update do estado
    const { error: updateErr } = await supabase
      .from("subscriptions")
      .update({
        state,
        last_verified_at: new Date().toISOString(),
        // PURCHASED/RENEWED/RECOVERED/RESTARTED reativam auto_renewing;
        // CANCELED desativa. Os outros mantêm.
        ...(sn.notificationType === 3 ? { auto_renewing: false } : {}),
        ...([1, 2, 4, 7].includes(sn.notificationType) ? { auto_renewing: true } : {}),
      })
      .eq("purchase_token", sn.purchaseToken);

    if (updateErr) {
      captureError(updateErr, {
        route: "POST /api/billing/rtdn",
        phase: "update_state",
      });
      return NextResponse.json({ error: "DB error" }, { status: 500 });
    }

    // Rollback do plano em caso de revogação/expiração
    if (REVOKING_NOTIFICATIONS.has(sn.notificationType)) {
      await supabase
        .from("stores")
        .update({ plan: "free" })
        .eq("clerk_user_id", userId);
    } else if ([1, 2, 4, 7].includes(sn.notificationType)) {
      // Recovered/Renewed/Purchased/Restarted: garantir plano correto
      await supabase
        .from("stores")
        .update({ plan: planFromSku(sku) })
        .eq("clerk_user_id", userId);
    }

    logger.info("billing_rtdn_processed", {
      user_id: userId,
      sku,
      type: sn.notificationType,
      state,
    });

    return NextResponse.json({ ok: true, state });
  } catch (e) {
    captureError(e, { route: "POST /api/billing/rtdn" });
    // 5xx faz Pub/Sub re-tentar. Bom para erros transientes (DB down etc).
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
