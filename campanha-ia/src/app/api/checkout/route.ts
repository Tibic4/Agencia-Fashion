import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createSubscription, cancelSubscription, type PlanId } from "@/lib/payments/mercadopago";
import { getStoreByClerkId } from "@/lib/db";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/**
 * POST /api/checkout
 * 
 * Body: { planId: "essencial" | "pro" | "business" }
 * 
 * Cria uma assinatura recorrente (PreApproval) no Mercado Pago.
 * O cliente é redirecionado para o checkout do MP para autorizar o cartão.
 * Cobranças mensais automáticas são feitas pelo MP.
 */
export async function POST(request: NextRequest) {
  try {
    // Autenticação via Clerk
    const session = await auth();
    if (!session.userId) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    const body = await request.json();
    const { planId } = body;

    if (!planId || !["essencial", "pro", "business"].includes(planId)) {
      return NextResponse.json(
        { error: "Plano inválido", code: "INVALID_PLAN" },
        { status: 400 }
      );
    }

    // Buscar loja do usuário
    const store = await getStoreByClerkId(session.userId);
    if (!store) {
      return NextResponse.json(
        { error: "Complete o onboarding antes de assinar um plano", code: "NO_STORE" },
        { status: 400 }
      );
    }

    // Buscar email do Clerk (via sessionClaims)
    const userEmail = (session.sessionClaims as Record<string, unknown>)?.email as string || `${session.userId}@crialook.app`;

    if (!process.env.MERCADOPAGO_ACCESS_TOKEN) {
      // Demo mode — retorna URL fake
      return NextResponse.json({
        success: true,
        demo: true,
        data: {
          preferenceId: "demo-preference-id",
          checkoutUrl: `https://www.mercadopago.com.br/checkout/v1/redirect?pref_id=demo`,
        },
      });
    }

    // Cancelar assinatura antiga antes de criar nova (evita cobrança dupla)
    const supabase = createAdminClient();
    const { data: storeData } = await supabase
      .from("stores")
      .select("mercadopago_subscription_id")
      .eq("id", store.id)
      .single();

    if (storeData?.mercadopago_subscription_id) {
      try {
        await cancelSubscription(storeData.mercadopago_subscription_id);
        await supabase.from("stores").update({
          mercadopago_subscription_id: null,
          updated_at: new Date().toISOString(),
        }).eq("id", store.id);
        console.log(`[API:checkout] 🔄 Assinatura anterior cancelada: ${storeData.mercadopago_subscription_id}`);
      } catch (cancelErr) {
        console.warn(`[API:checkout] ⚠️ Falha ao cancelar assinatura anterior (continuando):`, cancelErr instanceof Error ? cancelErr.message : cancelErr);
      }
    }

    // Criar nova assinatura recorrente via PreApproval
    const result = await createSubscription({
      planId: planId as PlanId,
      storeId: store.id,
      userEmail,
    });

    console.log(`[API:checkout] ✅ Assinatura criada: ${result.subscriptionId} — Plano: ${planId}`);

    return NextResponse.json({
      success: true,
      demo: false,
      data: {
        subscriptionId: result.subscriptionId,
        checkoutUrl: result.initPoint,
        sandboxUrl: result.sandboxInitPoint,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Erro desconhecido";
    console.error("[API:checkout] Error:", message);
    return NextResponse.json(
      {
        error: "Erro ao criar checkout",
        code: "CHECKOUT_ERROR",
        details: process.env.NODE_ENV === "development" ? message : undefined,
      },
      { status: 500 }
    );
  }
}
