import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStoreByClerkId } from "@/lib/db";

/**
 * PATCH /api/campaign/[id]/favorite
 *
 * Toggle: marca/desmarca campanha como favorita.
 * Campanhas favoritas ficam protegidas do expurgo automático (GC 25 dias).
 *
 * Body JSON: { "favorited": true | false }
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session.userId) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    const store = await getStoreByClerkId(session.userId);
    if (!store) {
      return NextResponse.json({ error: "Loja não encontrada" }, { status: 404 });
    }

    const { id: campaignId } = await params;
    const body = await request.json();
    const favorited = Boolean(body.favorited);

    const supabase = createAdminClient();

    // Verificar se a campanha pertence à loja
    const { data: campaign, error: fetchError } = await supabase
      .from("campaigns")
      .select("id, store_id")
      .eq("id", campaignId)
      .eq("store_id", store.id)
      .single();

    if (fetchError || !campaign) {
      return NextResponse.json({ error: "Campanha não encontrada" }, { status: 404 });
    }

    // Atualizar flag
    const { error: updateError } = await supabase
      .from("campaigns")
      .update({ is_favorited: favorited })
      .eq("id", campaignId);

    if (updateError) {
      return NextResponse.json({ error: "Erro ao atualizar favorito" }, { status: 500 });
    }

    console.log(`[Favorite] ${favorited ? "⭐" : "☆"} Campanha ${campaignId} — favorited=${favorited}`);

    return NextResponse.json({
      success: true,
      campaignId,
      is_favorited: favorited,
    });
  } catch (error: unknown) {
    console.error("[Favorite] Erro:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
