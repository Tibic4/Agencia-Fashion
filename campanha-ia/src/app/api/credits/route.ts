import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getStoreByClerkId } from "@/lib/db";
import { MercadoPagoConfig, Preference } from "mercadopago";
import { ALL_CREDIT_PACKAGES, type CreditPackageId } from "@/lib/plans";
import { checkLoginRateLimit } from "@/lib/rate-limit";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";

/**
 * Pacotes de créditos — importados de @/lib/plans.ts (fonte centralizada)
 */
const CREDIT_PACKAGES = ALL_CREDIT_PACKAGES;

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
      campaigns: packages.filter(p => (p.type as string) === "campaigns"),
      models: packages.filter(p => (p.type as string) === "models"),
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

    // rate-limit por user (anti-abuso de Preference creation)
    const rl = checkLoginRateLimit({
      key: `credits:${session.userId}`,
      maxAttempts: 10,
      windowMs: 15 * 60 * 1000,
      blockDurationMs: 60 * 60 * 1000,
    });
    if (!rl.allowed) {
      return NextResponse.json(
        { error: "Muitas tentativas. Aguarde um momento.", code: "RATE_LIMITED" },
        { status: 429, headers: { "Retry-After": String(Math.ceil((rl.retryAfterMs ?? 0) / 1000)) } },
      );
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

    // Trial pago saiu — agora o trial é o mini-trial gratuito gerenciado
    // pelos endpoints `/api/credits/{claim,}-mini-trial`. Sem branch
    // especial aqui: o frontend não envia mais `packageId === "trial"` e
    // a key foi removida de ALL_CREDIT_PACKAGES.

    const userEmail = (session.sessionClaims as Record<string, unknown>)?.email as string || `${session.userId}@crialook.app`;
    const appUrl = env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

    if (!env.MERCADOPAGO_ACCESS_TOKEN) {
      return NextResponse.json({
        success: true,
        demo: true,
        data: { checkoutUrl: `${appUrl}/plano?credits=demo` },
      });
    }

    const client = new MercadoPagoConfig({
      accessToken: env.MERCADOPAGO_ACCESS_TOKEN,
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
