import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getStoreByClerkId } from "@/lib/db";
import { MercadoPagoConfig, Preference } from "mercadopago";

export const dynamic = "force-dynamic";

/**
 * Pacotes de créditos avulsos
 */
const CREDIT_PACKAGES = {
  // ── Trial (landing page) ──
  "trial": {
    type: "campaigns" as const,
    quantity: 5,
    price: 9.90,
    title: "Teste na Prática",
    description: "5 campanhas completas com modelo virtual + 1 modelo incluso",
    trial: true,
    bonusModels: 1,
  },
  // Campanhas avulso
  "5_campanhas": {
    type: "campaigns" as const,
    quantity: 5,
    price: 19.90,
    title: "+5 Campanhas",
    description: "5 campanhas completas com modelo virtual (R$ 3,98/cada)",
    trial: false,
    bonusModels: 0,
  },
  "15_campanhas": {
    type: "campaigns" as const,
    quantity: 15,
    price: 49.90,
    title: "+15 Campanhas",
    description: "15 campanhas completas com modelo virtual (R$ 3,33/cada)",
    trial: false,
    bonusModels: 0,
  },
  "30_campanhas": {
    type: "campaigns" as const,
    quantity: 30,
    price: 89.90,
    title: "+30 Campanhas",
    description: "30 campanhas completas com modelo virtual (R$ 3,00/cada)",
    trial: false,
    bonusModels: 0,
  },
  // Modelos virtuais
  "3_modelos": {
    type: "models" as const,
    quantity: 3,
    price: 9.90,
    title: "+3 Modelos Virtuais",
    description: "3 modelos virtuais para suas campanhas",
    trial: false,
    bonusModels: 0,
  },
  "5_modelos": {
    type: "models" as const,
    quantity: 5,
    price: 14.90,
    title: "+5 Modelos Virtuais",
    description: "5 modelos virtuais para suas campanhas",
    trial: false,
    bonusModels: 0,
  },
} as const;

export type CreditPackageId = keyof typeof CREDIT_PACKAGES;

/**
 * GET /api/credits
 * Lista pacotes de créditos disponíveis
 */
export async function GET() {
  const packages = Object.entries(CREDIT_PACKAGES).map(([id, pkg]) => ({
    id,
    ...pkg,
    priceFormatted: `R$ ${pkg.price.toFixed(2).replace(".", ",")}`,
    unitPrice: (pkg.price / pkg.quantity).toFixed(2),
  }));

  return NextResponse.json({
    success: true,
    data: {
      campaigns: packages.filter(p => p.type === "campaigns"),
      models: packages.filter(p => p.type === "models"),
    },
  });
}

/**
 * POST /api/credits
 * Cria checkout para compra de créditos avulsos
 * Body: { packageId: string }
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session.userId) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    const { packageId } = await request.json();

    if (!packageId || !(packageId in CREDIT_PACKAGES)) {
      return NextResponse.json(
        { error: "Pacote inválido", packages: Object.keys(CREDIT_PACKAGES) },
        { status: 400 }
      );
    }

    const store = await getStoreByClerkId(session.userId);
    if (!store) {
      return NextResponse.json({ error: "Complete o onboarding primeiro" }, { status: 400 });
    }

    const pkg = CREDIT_PACKAGES[packageId as CreditPackageId];
    const userEmail = (session.sessionClaims as Record<string, unknown>)?.email as string || `${session.userId}@crialook.app`;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

    if (!process.env.MERCADOPAGO_ACCESS_TOKEN) {
      return NextResponse.json({
        success: true,
        demo: true,
        data: { checkoutUrl: `${appUrl}/plano?credits=demo` },
      });
    }

    const client = new MercadoPagoConfig({
      accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN,
    });

    const preferenceClient = new Preference(client);

    const preference = await preferenceClient.create({
      body: {
        items: [
          {
            id: packageId,
            title: `CriaLook — ${pkg.title}`,
            description: pkg.description,
            quantity: 1,
            currency_id: "BRL",
            unit_price: pkg.price,
          },
        ],
        payer: { email: userEmail },
        back_urls: {
          success: `${appUrl}/plano?credits=approved&pkg=${packageId}`,
          failure: `${appUrl}/plano?credits=rejected`,
          pending: `${appUrl}/plano?credits=pending`,
        },
        auto_return: "approved",
        // Format: credit|storeId|packageType|quantity[|bonusModels:N]
        external_reference: `credit|${store.id}|${pkg.type}|${pkg.quantity}${pkg.bonusModels > 0 ? `|bonusModels:${pkg.bonusModels}` : ""}`,
        notification_url: `${appUrl}/api/webhooks/mercadopago`,
        statement_descriptor: "CRIALOOK",
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        checkoutUrl: preference.init_point,
        sandboxUrl: preference.sandbox_init_point,
        package: pkg,
      },
    });
  } catch (error) {
    console.error("[API:credits] Error:", error);
    return NextResponse.json({ error: "Erro ao criar checkout de créditos" }, { status: 500 });
  }
}
