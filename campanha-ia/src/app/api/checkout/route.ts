import { NextRequest, NextResponse } from "next/server";
import { createCheckoutPreference, type PlanId } from "@/lib/payments/mercadopago";

export const dynamic = "force-dynamic";

/**
 * POST /api/checkout
 * 
 * Body: { planId: "starter" | "pro" | "scale" }
 * 
 * Cria uma preferência de checkout no Mercado Pago e retorna a URL de pagamento.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { planId } = body;

    if (!planId || !["starter", "pro", "scale"].includes(planId)) {
      return NextResponse.json(
        { error: "Plano inválido", code: "INVALID_PLAN" },
        { status: 400 }
      );
    }

    // TODO: quando Clerk estiver configurado, pegar userId e email reais
    const userId = body.userId || "demo-user";
    const userEmail = body.userEmail || "demo@crialook.com.br";

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
      userId,
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
  } catch (error: any) {
    console.error("[API:checkout] Error:", error);
    return NextResponse.json(
      {
        error: "Erro ao criar checkout",
        code: "CHECKOUT_ERROR",
        details: process.env.NODE_ENV === "development" ? error.message : undefined,
      },
      { status: 500 }
    );
  }
}
