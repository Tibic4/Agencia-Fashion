import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createCheckoutPreference, type PlanId } from "@/lib/payments/mercadopago";
import { getStoreByClerkId } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * POST /api/checkout
 * 
 * Body: { planId: "starter" | "pro" | "scale" }
 * 
 * Cria uma preferência de checkout no Mercado Pago e retorna a URL de pagamento.
 * Usa Clerk para obter userId e email reais da sessão.
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

    if (!planId || !["starter", "pro", "scale"].includes(planId)) {
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

    const result = await createCheckoutPreference({
      planId: planId as PlanId,
      userId: store.id, // Usar store.id como referência no external_reference
      userEmail,
    });

    return NextResponse.json({
      success: true,
      demo: false,
      data: {
        preferenceId: result.preferenceId,
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
