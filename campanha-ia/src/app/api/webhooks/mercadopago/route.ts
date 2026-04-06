import { NextRequest, NextResponse } from "next/server";
import { getPaymentStatus } from "@/lib/payments/mercadopago";
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
    return true; // Aceitar se não configurou secret (compatibilidade)
  }

  const xSignature = request.headers.get("x-signature") || "";
  const xRequestId = request.headers.get("x-request-id") || "";

  // Extrair ts e v1 do header
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

  // Montar template: id:{data.id};request-id:{x-request-id};ts:{ts};
  const manifest = `id:${dataId};request-id:${xRequestId};ts:${ts};`;
  const hmac = createHmac("sha256", secret).update(manifest).digest("hex");

  return hmac === v1;
}

/**
 * POST /api/webhooks/mercadopago
 * 
 * Recebe notificações do Mercado Pago sobre pagamentos.
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

    // Verificar tipo de notificação
    if (body.type === "payment" && body.data?.id) {
      const paymentId = String(body.data.id);

      // Buscar detalhes do pagamento
      const payment = await getPaymentStatus(paymentId);

      console.log("[Webhook:MercadoPago] Pagamento:", {
        status: payment.status,
        amount: payment.transactionAmount,
        ref: payment.externalReference,
      });

      const ref = payment.externalReference || "";

      if (payment.status === "approved") {
        // ═══════════════════════════════════════
        // CRÉDITOS AVULSOS (format: credit|storeId|type|quantity)
        // ═══════════════════════════════════════
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
        // ═══════════════════════════════════════
        // ASSINATURA DE PLANO (format: storeId|planId)
        // ═══════════════════════════════════════
        else {
          const [storeId, planId] = ref.split("|");

          if (storeId && planId) {
            console.log(`[Webhook:MercadoPago] ✅ Pagamento aprovado! Store: ${storeId}, Plano: ${planId}`);

            // 1. Atualizar plano da loja + resetar store_usage
            await updateStorePlan(storeId, planId, paymentId);

            // 2. Salvar customer ID do Mercado Pago
            const supabase = createAdminClient();
            await supabase.from("stores").update({
              mercadopago_customer_id: (payment.payer as Record<string, unknown>)?.id?.toString() || null,
              updated_at: new Date().toISOString(),
            }).eq("id", storeId);

            console.log(`[Webhook:MercadoPago] ✅ Plano atualizado para "${planId}"`);
          }
        }
      }

      if (payment.status === "rejected") {
        console.log(`[Webhook:MercadoPago] ❌ Pagamento rejeitado. Ref: ${ref}`);
      }

      if (payment.status === "pending") {
        console.log(`[Webhook:MercadoPago] ⏳ Pagamento pendente (PIX/boleto). Ref: ${ref}`);
      }
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
