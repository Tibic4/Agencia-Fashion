import { NextRequest, NextResponse } from "next/server";
import { getPaymentStatus, getSubscriptionStatus } from "@/lib/payments/mercadopago";
import { updateStorePlan, addCreditsToStore } from "@/lib/db";
import { createAdminClient } from "@/lib/supabase/admin";
import { createHmac } from "crypto";

export const dynamic = "force-dynamic";

/**
 * Valida assinatura HMAC do webhook Mercado Pago.
 * Header x-signature: ts=<timestamp>,v1=<hmac>
 * Header x-request-id: <request-id>
 */
function validateWebhookSignature(
  request: NextRequest,
  dataId: string,
): boolean {
  const secret = process.env.MERCADOPAGO_WEBHOOK_SECRET;
  if (!secret) {
    console.warn("[Webhook:MercadoPago] ⚠️ MERCADOPAGO_WEBHOOK_SECRET não configurado — pulando validação");
    return true;
  }

  const xSignature = request.headers.get("x-signature") || "";
  const xRequestId = request.headers.get("x-request-id") || "";

  const parts = Object.fromEntries(
    xSignature.split(",").map((part) => {
      const [key, ...val] = part.trim().split("=");
      return [key, val.join("=")];
    })
  );

  const ts = parts["ts"];
  const v1 = parts["v1"];

  if (!ts || !v1) {
    console.warn("[Webhook:MercadoPago] ⚠️ Header x-signature incompleto");
    return false;
  }

  const manifest = `id:${dataId};request-id:${xRequestId};ts:${ts};`;
  const hmac = createHmac("sha256", secret).update(manifest).digest("hex");

  return hmac === v1;
}

/**
 * POST /api/webhooks/mercadopago
 * 
 * Recebe notificações do Mercado Pago sobre:
 * 1. Pagamentos (type: "payment") — créditos avulsos + cobranças recorrentes
 * 2. Assinaturas (type: "subscription_preapproval") — status da assinatura
 * 
 * Formatos de external_reference:
 * - Plano:    "storeId|planId"
 * - Crédito:  "credit|storeId|type|quantity"
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    console.log("[Webhook:MercadoPago] Recebido:", JSON.stringify(body, null, 2));

    // ── Validar assinatura HMAC ──
    const dataId = body.data?.id ? String(body.data.id) : "";
    if (!validateWebhookSignature(request, dataId)) {
      console.error("[Webhook:MercadoPago] ❌ Assinatura inválida — rejeitando");
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    // ═══════════════════════════════════════
    // EVENTO: PAGAMENTO (pontual ou recorrente)
    // ═══════════════════════════════════════
    if (body.type === "payment" && body.data?.id) {
      await handlePaymentEvent(String(body.data.id));
    }

    // ═══════════════════════════════════════
    // EVENTO: ASSINATURA (PreApproval)
    // ═══════════════════════════════════════
    if (body.type === "subscription_preapproval" && body.data?.id) {
      await handleSubscriptionEvent(String(body.data.id));
    }

    // Mercado Pago espera 200 OK
    return NextResponse.json({ received: true }, { status: 200 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Erro desconhecido";
    console.error("[Webhook:MercadoPago] Erro:", message);
    // Retorna 200 mesmo em erro para evitar retries infinitos
    return NextResponse.json({ received: true, error: true }, { status: 200 });
  }
}

/**
 * Processa notificação de pagamento (pontual ou cobrança de assinatura)
 */
async function handlePaymentEvent(paymentId: string) {
  const payment = await getPaymentStatus(paymentId);

  console.log("[Webhook:MercadoPago] Pagamento:", {
    status: payment.status,
    amount: payment.transactionAmount,
    ref: payment.externalReference,
  });

  const ref = payment.externalReference || "";

  if (payment.status === "approved") {
    // ── CRÉDITOS AVULSOS (format: credit|storeId|type|quantity) ──
    if (ref.startsWith("credit|")) {
      const [, storeId, creditType, quantityStr] = ref.split("|");
      const quantity = parseInt(quantityStr, 10);

      if (storeId && creditType && quantity > 0) {
        const validTypes = ["campaigns", "models", "regenerations"];
        if (validTypes.includes(creditType)) {
          console.log(`[Webhook:MercadoPago] ✅ Crédito aprovado! Store: ${storeId}, Tipo: ${creditType}, Qtd: ${quantity}`);

          await addCreditsToStore(
            storeId,
            creditType as "campaigns" | "models" | "regenerations",
            quantity,
            payment.transactionAmount || 0,
            paymentId
          );

          console.log(`[Webhook:MercadoPago] ✅ Créditos adicionados com sucesso`);
        } else {
          console.error(`[Webhook:MercadoPago] ❌ Tipo de crédito inválido: ${creditType}`);
        }
      }
    }
    // ── PLANO via pagamento recorrente (format: storeId|planId) ──
    else {
      const [storeId, planId] = ref.split("|");

      if (storeId && planId) {
        console.log(`[Webhook:MercadoPago] ✅ Pagamento recorrente aprovado! Store: ${storeId}, Plano: ${planId}`);

        // Atualizar plano + resetar quotas do mês
        await updateStorePlan(storeId, planId, paymentId);

        // Salvar customer ID do Mercado Pago
        const supabase = createAdminClient();
        await supabase.from("stores").update({
          mercadopago_customer_id: (payment.payer as Record<string, unknown>)?.id?.toString() || null,
          updated_at: new Date().toISOString(),
        }).eq("id", storeId);

        console.log(`[Webhook:MercadoPago] ✅ Plano renovado para "${planId}"`);
      }
    }
  }

  if (payment.status === "rejected") {
    console.log(`[Webhook:MercadoPago] ❌ Pagamento rejeitado. Ref: ${ref}`);
    // O MP retenta automaticamente até 4x — não precisa downgrade aqui
  }

  if (payment.status === "pending") {
    console.log(`[Webhook:MercadoPago] ⏳ Pagamento pendente (PIX/boleto). Ref: ${ref}`);
  }
}

/**
 * Processa notificação de assinatura (PreApproval)
 * Eventos: authorized, paused, cancelled
 */
async function handleSubscriptionEvent(subscriptionId: string) {
  try {
    const subscription = await getSubscriptionStatus(subscriptionId);

    console.log("[Webhook:MercadoPago] Assinatura:", {
      id: subscription.id,
      status: subscription.status,
      ref: subscription.externalReference,
    });

    const ref = subscription.externalReference || "";
    const [storeId, planId] = ref.split("|");

    if (!storeId || !planId) {
      console.warn("[Webhook:MercadoPago] ⚠️ external_reference da assinatura inválido:", ref);
      return;
    }

    const supabase = createAdminClient();

    switch (subscription.status) {
      case "authorized":
        // Assinatura ativada com sucesso — plano será ativado pelo webhook de payment
        console.log(`[Webhook:MercadoPago] ✅ Assinatura autorizada! Store: ${storeId}, Plano: ${planId}`);

        // Salvar subscription ID na loja para gerenciamento futuro
        await supabase.from("stores").update({
          mercadopago_subscription_id: subscriptionId,
          updated_at: new Date().toISOString(),
        }).eq("id", storeId);
        break;

      case "paused":
        console.log(`[Webhook:MercadoPago] ⏸️ Assinatura pausada. Store: ${storeId}`);
        break;

      case "cancelled":
        console.log(`[Webhook:MercadoPago] ❌ Assinatura cancelada. Store: ${storeId} — Downgrade para free`);

        // Downgrade: remover plano da loja
        await supabase.from("stores").update({
          plan_id: null,
          mercadopago_subscription_id: null,
          updated_at: new Date().toISOString(),
        }).eq("id", storeId);
        break;

      default:
        console.log(`[Webhook:MercadoPago] 📋 Status assinatura: ${subscription.status}. Store: ${storeId}`);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro desconhecido";
    console.error(`[Webhook:MercadoPago] Erro ao processar assinatura ${subscriptionId}:`, msg);
  }
}
