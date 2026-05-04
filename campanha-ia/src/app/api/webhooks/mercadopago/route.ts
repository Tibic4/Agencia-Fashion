import { NextRequest, NextResponse } from "next/server";
import { getPaymentStatus, getSubscriptionStatus } from "@/lib/payments/mercadopago";
import { updateStorePlan, addCreditsToStore } from "@/lib/db";
import { createAdminClient } from "@/lib/supabase/admin";
import { PLANS, type PlanId, ALL_CREDIT_PACKAGES } from "@/lib/plans";
import { captureError, logger } from "@/lib/observability";
import { validateMpSignature } from "@/lib/mp-signature";
import { dedupWebhook, markWebhookProcessed } from "@/lib/webhooks/dedup";

// Tolerância de 1 centavo para diferenças de arredondamento do MP
const PRICE_TOLERANCE_BRL = 0.01;

function amountMatches(paidAmount: number | null | undefined, expectedPrice: number): boolean {
  if (paidAmount == null) return false;
  return Math.abs(paidAmount - expectedPrice) <= PRICE_TOLERANCE_BRL;
}

export const dynamic = "force-dynamic";

/**
 * Valida assinatura HMAC do webhook Mercado Pago.
 * Header x-signature: ts=<timestamp>,v1=<hmac>
 * Header x-request-id: <request-id>
 */
function validateWebhookSignature(
  request: NextRequest,
  dataId: string,
  xRequestId: string,
): boolean {
  const secret = process.env.MERCADOPAGO_WEBHOOK_SECRET;
  if (!secret) {
    console.error("[Webhook:MercadoPago] ❌ MERCADOPAGO_WEBHOOK_SECRET não configurado — rejeitando webhook");
    return false;
  }
  return validateMpSignature({
    secret,
    xSignatureHeader: request.headers.get("x-signature") || "",
    xRequestId,
    dataId,
  });
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
  // H-14: defense-in-depth — empty x-request-id is invalid per MP docs and
  // would also break dedup contract (provider+event_id PK). Reject 400
  // BEFORE signature validation or dedup so MP doesn't perpetually retry.
  const xRequestId = request.headers.get("x-request-id")?.trim() || "";
  if (!xRequestId) {
    logger.warn("mp_webhook_missing_request_id");
    return NextResponse.json({ error: "missing x-request-id" }, { status: 400 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    logger.warn("mp_webhook_invalid_json", { xRequestId });
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  // não loga body inteiro (PII: payer.email, cpf, cnpj).
  // Apenas metadados seguros.
  logger.info("mp_webhook_received", {
    type: body?.type,
    action: body?.action,
    dataId: (body?.data as Record<string, unknown>)?.id,
    liveMode: body?.live_mode,
    xRequestId,
  });

  // ── Validar assinatura HMAC ──
  const dataId = (body?.data as Record<string, unknown>)?.id
    ? String((body.data as Record<string, unknown>).id)
    : "";
  if (!validateWebhookSignature(request, dataId, xRequestId)) {
    logger.warn("mp_webhook_invalid_signature", { xRequestId });
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  // D-06: dedup BEFORE business logic. webhook_events PK (provider, event_id) is the truth.
  let dedup;
  try {
    dedup = await dedupWebhook("mp", xRequestId, body);
  } catch (e) {
    captureError(e, { route: "/api/webhooks/mercadopago", phase: "dedup" });
    // Cannot dedup — fail closed by returning 200 (avoid MP retry loop) but capture for ops.
    return NextResponse.json({ received: true, error: "dedup_failed" }, { status: 200 });
  }
  if (dedup.duplicate) {
    logger.info("mp_webhook_duplicate_short_circuit", { xRequestId });
    return NextResponse.json({ received: true, duplicate: true }, { status: 200 });
  }

  try {
    // ═══════════════════════════════════════
    // EVENTO: PAGAMENTO (pontual ou recorrente)
    // ═══════════════════════════════════════
    if (body.type === "payment" && (body.data as Record<string, unknown>)?.id) {
      await handlePaymentEvent(String((body.data as Record<string, unknown>).id));
    }

    // ═══════════════════════════════════════
    // EVENTO: ASSINATURA (PreApproval)
    // ═══════════════════════════════════════
    if (body.type === "subscription_preapproval" && (body.data as Record<string, unknown>)?.id) {
      await handleSubscriptionEvent(String((body.data as Record<string, unknown>).id));
    }

    await markWebhookProcessed("mp", xRequestId);
    // Mercado Pago espera 200 OK
    return NextResponse.json({ received: true }, { status: 200 });
  } catch (error: unknown) {
    captureError(error, { route: "/api/webhooks/mercadopago", xRequestId });
    // Do NOT markWebhookProcessed — the row stays unprocessed for ops reconcile.
    // Retorna 200 para erros de PROCESSAMENTO (evitar retries infinitos do MP).
    return NextResponse.json({ received: true, error: true }, { status: 200 });
  }
}

/**
 * Processa notificação de pagamento (pontual ou cobrança de assinatura)
 */
async function handlePaymentEvent(paymentId: string) {
  let payment;
  try {
    payment = await getPaymentStatus(paymentId);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro desconhecido";
    console.error(`[Webhook:MercadoPago] ❌ Falha ao consultar pagamento ${paymentId}:`, msg);
    throw err; // re-throw para o outer catch retornar 200 (evitar retry infinito)
  }

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
          // ── FRAUD GATE: validar valor pago vs preço esperado do pacote ──
          // Encontra o pacote que casa type+quantity. Se não houver match, rejeita.
          const matchingPkg = Object.values(ALL_CREDIT_PACKAGES).find(
            (p) => p.type === creditType && p.quantity === quantity,
          );
          if (!matchingPkg) {
            console.error(
              `[Webhook:MercadoPago] 🚨 Rejeitado: nenhum pacote conhecido com type=${creditType} qty=${quantity} — possível forja de external_reference (paymentId=${paymentId})`,
            );
            return;
          }
          const paidAmount = payment.transactionAmount;
          if (!amountMatches(paidAmount, matchingPkg.price)) {
            console.error(
              `[Webhook:MercadoPago] 🚨 Fraude detectada: pacote ${creditType}/${quantity} custa R$${matchingPkg.price} mas foi pago R$${paidAmount} (paymentId=${paymentId}) — REJEITADO`,
            );
            return;
          }
          // ── Idempotência: verificar se este pagamento já foi processado ──
          const supabase = createAdminClient();
          const { count: existingCount } = await supabase
            .from("credit_purchases")
            .select("id", { count: "exact", head: true })
            .eq("mercadopago_payment_id", paymentId);

          if ((existingCount ?? 0) > 0) {
            console.log(`[Webhook:MercadoPago] ⚠️ Pagamento ${paymentId} já processado — ignorando duplicata`);
            return;
          }

          console.log(`[Webhook:MercadoPago] ✅ Crédito aprovado! Store: ${storeId}, Tipo: ${creditType}, Qtd: ${quantity}`);

          await addCreditsToStore(
            storeId,
            creditType as "campaigns" | "models" | "regenerations",
            quantity,
            payment.transactionAmount || 0,
            paymentId
          );

          // Trial bonus: se o external_reference contém bonusModels, creditar modelos também
          // Format estendido: credit|storeId|type|quantity|bonusModels:N
          // cap de bonusModels para evitar que bug futuro credite 9999
          const MAX_BONUS_MODELS = 10;
          const parts = ref.split("|");
          const bonusPart = parts.find(p => p.startsWith("bonusModels:"));
          if (bonusPart) {
            const rawBonus = parseInt(bonusPart.split(":")[1], 10);
            const bonusQty = Math.min(Math.max(0, Number.isFinite(rawBonus) ? rawBonus : 0), MAX_BONUS_MODELS);
            if (bonusQty > 0) {
              await addCreditsToStore(storeId, "models", bonusQty, 0, paymentId);
              console.log(`[Webhook:MercadoPago] 🎁 Bônus trial: +${bonusQty} modelo(s) para store ${storeId}`);
            }
          }

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
        // ── FRAUD GATE: planId deve existir em PLANS e valor pago deve bater ──
        const planDef = PLANS[planId as PlanId];
        if (!planDef) {
          console.error(
            `[Webhook:MercadoPago] 🚨 Rejeitado: planId desconhecido "${planId}" (paymentId=${paymentId})`,
          );
          return;
        }
        const paidAmount = payment.transactionAmount;
        if (!amountMatches(paidAmount, planDef.price)) {
          console.error(
            `[Webhook:MercadoPago] 🚨 Fraude detectada: plano ${planId} custa R$${planDef.price} mas foi pago R$${paidAmount} (paymentId=${paymentId}) — REJEITADO`,
          );
          return;
        }

        // ── Idempotência: verificar se este payment já renovou este plano ──
        const supabaseIdem = createAdminClient();
        const { count: planAppliedCount } = await supabaseIdem
          .from("plan_payments_applied")
          .select("payment_id", { count: "exact", head: true })
          .eq("payment_id", paymentId);
        if ((planAppliedCount ?? 0) > 0) {
          console.log(`[Webhook:MercadoPago] ⚠️ Pagamento de plano ${paymentId} já aplicado — ignorando duplicata`);
          return;
        }

        console.log(`[Webhook:MercadoPago] ✅ Pagamento recorrente aprovado! Store: ${storeId}, Plano: ${planId}`);

        // Atualizar plano + resetar quotas do mês.
        // Não passar paymentId como 3º argumento — esse campo é mpSubscriptionId,
        // já salvo corretamente pelo evento subscription_preapproval (handleSubscriptionEvent).
        await updateStorePlan(storeId, planId);

        // Registrar pagamento aplicado (idempotência)
        await supabaseIdem.from("plan_payments_applied").insert({
          payment_id: paymentId,
          store_id: storeId,
          plan_id: planId,
          applied_at: new Date().toISOString(),
        });

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
        console.log(`[Webhook:MercadoPago] ❌ Assinatura cancelada. Store: ${storeId}`);

        // Marcar que a assinatura foi cancelada, mas MANTER o plano ativo
        // até o fim do período já pago (period_end do store_usage atual).
        // O downgrade para grátis acontece naturalmente quando o período expira
        // e nenhum novo pagamento chega (updateStorePlan não é chamado).
        await supabase.from("stores").update({
          mercadopago_subscription_id: null,
          updated_at: new Date().toISOString(),
        }).eq("id", storeId);

        console.log(`[Webhook:MercadoPago] ✅ Store ${storeId}: assinatura removida, plano mantido até fim do período`);
        break;

      default:
        console.log(`[Webhook:MercadoPago] 📋 Status assinatura: ${subscription.status}. Store: ${storeId}`);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro desconhecido";
    console.error(`[Webhook:MercadoPago] Erro ao processar assinatura ${subscriptionId}:`, msg);
  }
}
