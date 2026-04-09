import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getStoreByClerkId, getCampaignById } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * GET /api/campaigns/[id]
 *
 * Retorna dados de uma campanha específica.
 * Verifica que a campanha pertence à loja do usuário.
 */
export async function GET(
  _req: NextRequest,
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

    const { id } = await params;
    const campaign = await getCampaignById(id);

    if (!campaign) {
      return NextResponse.json({ error: "Campanha não encontrada" }, { status: 404 });
    }

    // Verify campaign belongs to user's store
    if (campaign.store_id !== store.id) {
      return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
    }

    // ── v3 pipeline output (new format) ──
    const v3Output = campaign.output as Record<string, unknown> | null;
    const scores = campaign.campaign_scores?.[0];

    if (v3Output && v3Output.version === "v3") {
      // Build images array from stored URLs
      const imageUrls = (v3Output.image_urls as (string | null)[]) || [];
      const images = imageUrls.map((url) =>
        url && url !== "pending"
          ? { imageUrl: url, mimeType: "image/png", prompt: "", durationMs: 0 }
          : null
      );

      const dicas = v3Output.dicas_postagem as Record<string, unknown> | null;
      const analise = v3Output.analise as Record<string, unknown> | null;

      // ── Map Gemini Analyzer's dicas_postagem → UI format ──
      // Gemini generates: { melhor_dia, melhor_horario, sequencia_sugerida, legendas[] }
      // UI expects:       { melhor_horario, caption_sugerida, tom_legenda, cta, hashtags[] }
      let mappedDicas: Record<string, unknown> = {
        melhor_horario: "Entre 18h–21h",
        hashtags: [],
        cta: "Chama no direct!",
        tom_legenda: "Descontraído e acolhedor",
        caption_sugerida: "",
      };

      if (dicas) {
        const legendas = (dicas.legendas as Array<Record<string, unknown>>) || [];
        const firstLegenda = legendas[0] || {};
        const allHashtags = legendas.flatMap(
          (l) => (l.hashtags as string[]) || []
        );
        // Deduplicate hashtags
        const uniqueHashtags = [...new Set(allHashtags)];

        mappedDicas = {
          melhor_horario: dicas.melhor_horario || mappedDicas.melhor_horario,
          melhor_dia: dicas.melhor_dia || undefined,
          sequencia_sugerida: dicas.sequencia_sugerida || undefined,
          caption_sugerida:
            (dicas.caption_sugerida as string) ||
            (firstLegenda.legenda as string) ||
            "",
          tom_legenda:
            (dicas.tom_legenda as string) ||
            (firstLegenda.dica as string) ||
            "Descontraído e acolhedor",
          cta:
            (dicas.cta as string) ||
            "Chama no direct!",
          hashtags: uniqueHashtags.length > 0
            ? uniqueHashtags
            : (dicas.hashtags as string[]) || [],
          // Preserve all legendas for expanded view
          legendas: legendas.length > 0 ? legendas : undefined,
        };

        // ── Sanitize: strip clothing-specific terms that leak through ──
        const forbidden = /\b(calça|blusa|vestido|saia|conjunto|macacão|camisa|camiseta|short|bermuda|regata|jaqueta|casaco|moletom|sapato|tênis|sandália|bota|chinelo|scarpin|sapatilha|bolsa|cinto|algodão|seda|linho|couro|jeans|denim|poliéster|lycra|renda|crochê|tricô|veludo|cetim|chiffon|preto|preta|branco|branca|vermelho|vermelha|azul|rosa|verde|amarelo|amarela|roxo|roxa|marrom|bege|cinza|laranja|lilás|vinho|nude|dourado|dourada|prateado|prateada|estampado|estampada|listrado|listrada|xadrez|floral|liso|lisa)\b/gi;
        const sanitize = (text: unknown, fallback: string): string => {
          if (typeof text !== "string" || !text) return fallback;
          return forbidden.test(text) ? fallback : text;
        };

        mappedDicas.caption_sugerida = sanitize(mappedDicas.caption_sugerida, "✨ Novidade que você vai amar! Confira no nosso perfil 💕");
        mappedDicas.tom_legenda = sanitize(mappedDicas.tom_legenda, "Descontraído e acolhedor");
        mappedDicas.cta = sanitize(mappedDicas.cta, "Chama no direct!");
        mappedDicas.sequencia_sugerida = sanitize(mappedDicas.sequencia_sugerida, undefined as unknown as string);

        // Also sanitize hashtags
        if (Array.isArray(mappedDicas.hashtags)) {
          mappedDicas.hashtags = (mappedDicas.hashtags as string[]).filter(
            (tag) => !forbidden.test(tag)
          );
        }
      }

      return NextResponse.json({
        success: true,
        data: {
          success: true,
          campaignId: campaign.id,
          data: {
            analise: analise || null,
            images,
            prompts: (v3Output.prompts as unknown[]) || [],
            dicas_postagem: mappedDicas,
            durationMs: campaign.pipeline_duration_ms || 0,
            successCount: v3Output.success_count || images.filter(Boolean).length,
          },
          score: scores || null,
          status: campaign.status,
          createdAt: campaign.created_at,
          objective: campaign.objective || null,
          targetAudience: campaign.target_audience || null,
        },
      });
    }

    // ── v2 legacy fallback ──
    const outputs = campaign.campaign_outputs?.[0];

    return NextResponse.json({
      success: true,
      data: {
        success: true,
        campaignId: campaign.id,
        data: {
          analise: outputs?.vision_analysis || null,
          images: [],
          prompts: [],
          dicas_postagem: {
            melhor_horario: "Entre 18h–21h",
            hashtags: outputs?.hashtags || [],
            cta: "Chama no direct!",
            tom_legenda: "Descontraído e acolhedor",
            caption_sugerida: outputs?.instagram_feed || "",
          },
          durationMs: campaign.pipeline_duration_ms || 0,
          successCount: 0,
        },
        score: scores || null,
        headline: outputs?.headline_principal || null,
        status: campaign.status,
        createdAt: campaign.created_at,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Erro desconhecido";
    console.error("[API:campaigns/id] Error:", message);
    return NextResponse.json({ error: "Erro ao buscar campanha" }, { status: 500 });
  }
}
