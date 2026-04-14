import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getStoreByClerkId } from "@/lib/db";
import { canRegenerateBackdrop } from "@/lib/ai/backdrop-generator";
import { inngest } from "@/lib/inngest/client";

export const dynamic = "force-dynamic";

/**
 * POST /api/store/backdrop
 *
 * Dispara geração (ou regeneração) do backdrop via Inngest.
 * Body: { brandColor?: string } — se não informado, usa brand_colors.primary
 *
 * Rate limit: 1 regeneração a cada 30 dias (exceto 1ª vez ou troca de cor).
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session.userId) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    const store = await getStoreByClerkId(session.userId);
    if (!store) {
      return NextResponse.json(
        { error: "Loja não encontrada", code: "NO_STORE" },
        { status: 404 }
      );
    }

    // Determine target color
    const body = await request.json().catch(() => ({}));
    const brandColor =
      body.brandColor ||
      (store.brand_colors as { primary?: string } | null)?.primary;

    if (!brandColor) {
      return NextResponse.json(
        { error: "Cor da marca não definida. Configure nas configurações.", code: "NO_COLOR" },
        { status: 400 }
      );
    }

    // Validate hex
    const hexRegex = /^#?[0-9A-Fa-f]{6}$/;
    if (!hexRegex.test(brandColor)) {
      return NextResponse.json(
        { error: "Cor inválida. Use formato hex (ex: #7B2EBF)", code: "INVALID_COLOR" },
        { status: 400 }
      );
    }

    // Rate limit check
    const rateCheck = await canRegenerateBackdrop(store.id, brandColor);
    if (!rateCheck.allowed) {
      const nextDate = rateCheck.nextAvailableDate
        ? new Date(rateCheck.nextAvailableDate).toLocaleDateString("pt-BR")
        : "em breve";

      return NextResponse.json(
        {
          error: `Estúdio já atualizado recentemente. Próxima troca disponível em ${nextDate}.`,
          code: "RATE_LIMITED",
          nextAvailableDate: rateCheck.nextAvailableDate,
        },
        { status: 429 }
      );
    }

    // Dispatch via Inngest (fire-and-forget)
    await inngest.send({
      name: "store/backdrop.requested",
      data: {
        storeId: store.id,
        brandColor: brandColor.startsWith("#") ? brandColor : `#${brandColor}`,
      },
    });

    console.log(`[API:store/backdrop] 🚀 Backdrop disparado via Inngest para store ${store.id} (${brandColor})`);

    return NextResponse.json({
      success: true,
      message: "Estúdio sendo gerado em segundo plano...",
      data: {
        status: "generating",
        color: brandColor,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Erro desconhecido";
    console.error("[API:store/backdrop] Error:", message);
    return NextResponse.json(
      { error: message || "Erro ao gerar estúdio" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/store/backdrop
 *
 * Retorna status do backdrop da loja (URL, cor, data).
 */
export async function GET() {
  try {
    const session = await auth();
    if (!session.userId) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    const store = await getStoreByClerkId(session.userId);
    if (!store) {
      return NextResponse.json(
        { error: "Loja não encontrada", code: "NO_STORE" },
        { status: 404 }
      );
    }

    // Check rate limit for UI
    const brandColor =
      (store.brand_colors as { primary?: string } | null)?.primary || "";
    const rateCheck = brandColor
      ? await canRegenerateBackdrop(store.id, brandColor)
      : { allowed: true };

    return NextResponse.json({
      success: true,
      data: {
        url: store.backdrop_ref_url || null,
        color: store.backdrop_color || null,
        updatedAt: store.backdrop_updated_at || null,
        canRegenerate: rateCheck.allowed,
        nextAvailableDate: rateCheck.nextAvailableDate || null,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Erro desconhecido";
    console.error("[API:store/backdrop] GET Error:", message);
    return NextResponse.json(
      { error: "Erro ao buscar estúdio" },
      { status: 500 }
    );
  }
}
