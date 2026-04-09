/**
 * POST /api/campaign/[id]/tips
 *
 * Gemini Flash Vision — Dicas de postagem personalizadas baseadas na foto.
 * 
 * REGRA: NUNCA menciona cor, tipo de peça, tecido ou qualquer detalhe do vestuário.
 * Analisa APENAS: cenário, iluminação, composição, mood visual.
 * 
 * Input:  { imageUrl: string, objective?: string, targetAudience?: string }
 * Output: { poste_as, tom_da_voz, cta, dica_extra, hashtags }
 * 
 * Custo: ~R$ 0,001 por chamada (Flash 3.0 + 1 imagem)
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { GoogleGenAI } from "@google/genai";

const TIPS_MODEL = "gemini-3-flash-preview";

interface TipsResponse {
  poste_as: string;
  tom_da_voz: string;
  cta: string;
  dica_extra: string;
  hashtags: string[];
}

const SYSTEM_PROMPT = `Você é um consultor sênior de marketing digital para moda feminina brasileira no Instagram.
Você recebe fotos de campanha e dá dicas ESPECÍFICAS e ACIONÁVEIS baseadas no que vê.

REGRA ABSOLUTA — PROIBIDO:
- NUNCA mencione tipo de peça (calça, blusa, vestido, saia etc.)
- NUNCA mencione cor/tecido/estampa da roupa
- NUNCA use "peça", "roupa", "look" ou "outfit"

O QUE VOCÊ ANALISA para personalizar as dicas:
- Cenário (estúdio branco? rua urbana? loja? natureza?)
- Iluminação (natural dourada? flash? suave? dramática?)
- Mood visual (editorial minimalista? casual vibrante? sofisticado? jovem?)
- Postura da modelo (confiança? movimento? olhar direto?)
- Composição (corpo inteiro? meio corpo? close?)

SEJA ESPECÍFICO — não dê dicas genéricas como "poste entre 18h-21h".
Baseie tudo no que VÊ na foto. Ex: se o cenário é urbano e jovem, sugira horário de pico jovem (21h-23h).
Se é sofisticado em estúdio, sugira tom elegante.

Responda SEMPRE em JSON válido puro, sem markdown, sem \`\`\`.`;

function buildUserPrompt(objective?: string, targetAudience?: string): string {
  let prompt = `Olhe esta foto de campanha de moda e me dê dicas PERSONALIZADAS para essa imagem específica.

Responda neste JSON exato:
{
  "poste_as": "horário específico (ex: '21h' ou '12h às 14h') — justifique brevemente pelo mood da foto",
  "tom_da_voz": "tom da caption em 3-5 palavras que COMBINE com a energia da foto",
  "cta": "call-to-action criativo e curto (max 8 palavras) que conecte com a vibe da imagem",
  "dica_extra": "1 dica prática e específica de marketing baseada no que você vê na foto (max 25 palavras)",
  "hashtags": ["8 hashtags relevantes sem # — mix de alcance e nicho"]
}`;

  if (objective) {
    const objMap: Record<string, string> = {
      venda_imediata: "venda direta / conversão rápida",
      lancamento: "lançamento de novidade / criar desire",
      promocao: "promoção / urgência / escassez",
      engajamento: "engajamento / salvar / compartilhar",
    };
    prompt += `\n\nObjetivo da campanha: ${objMap[objective] || objective}`;
  }

  if (targetAudience) {
    prompt += `\nPúblico-alvo: ${targetAudience}`;
  }

  const hour = new Date().getHours();
  const dayOfWeek = new Date().toLocaleDateString("pt-BR", { weekday: "long" });
  prompt += `\nDia: ${dayOfWeek}, ${hour}h`;

  return prompt;
}

/**
 * Log custo da chamada Flash no admin (fire-and-forget)
 */
async function logTipsCost(
  durationMs: number,
  campaignId: string,
  storeId: string | null,
  usage?: { inputTokens: number; outputTokens: number },
) {
  try {
    const { createAdminClient } = await import("@/lib/supabase/admin");
    const supabase = createAdminClient();
    const { getExchangeRate, getModelPricing } = await import("@/lib/pricing");
    const exchangeRate = await getExchangeRate();

    let costUsd = 0.0005; // fallback estimado (~R$ 0,003)
    const inputTokens = usage?.inputTokens || 0;
    const outputTokens = usage?.outputTokens || 0;

    if (inputTokens > 0 || outputTokens > 0) {
      const pricing = await getModelPricing();
      const modelPrice = pricing[TIPS_MODEL] || pricing["gemini-3-flash-preview"] || { inputPerMTok: 0.50, outputPerMTok: 3.00 };
      costUsd = (inputTokens * modelPrice.inputPerMTok) / 1_000_000
              + (outputTokens * modelPrice.outputPerMTok) / 1_000_000;
    }

    const costBrl = costUsd * exchangeRate;

    await supabase.from("api_cost_logs").insert({
      store_id: storeId,
      campaign_id: campaignId,
      provider: "google",
      model_used: TIPS_MODEL,
      action: "smart_tips",
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      tokens_used: inputTokens + outputTokens,
      cost_usd: costUsd,
      cost_brl: costBrl,
      response_time_ms: durationMs,
    });

    console.log(`[Tips] 💰 Custo: R$ ${costBrl.toFixed(4)} (${inputTokens}+${outputTokens} tokens, ${durationMs}ms)`);
  } catch (e) {
    console.warn("[Tips] ⚠️ Erro ao logar custo:", e);
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "Campaign ID obrigatório" }, { status: 400 });
  }

  const apiKey = process.env.GOOGLE_AI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "GOOGLE_AI_API_KEY não configurada" }, { status: 500 });
  }

  // Resolve store_id for cost attribution
  let storeId: string | null = null;
  try {
    const { getStoreByClerkId } = await import("@/lib/db");
    const store = await getStoreByClerkId(userId);
    storeId = store?.id || null;
  } catch { /* non-fatal */ }

  const startMs = Date.now();

  try {
    const body = await request.json();
    const { imageUrl, objective, targetAudience } = body as {
      imageUrl: string;
      objective?: string;
      targetAudience?: string;
    };

    if (!imageUrl) {
      return NextResponse.json({ error: "imageUrl obrigatório" }, { status: 400 });
    }

    // Download image and convert to base64
    const imageResponse = await fetch(imageUrl);
    if (!imageResponse.ok) {
      return NextResponse.json({ error: "Falha ao baixar imagem" }, { status: 400 });
    }
    const imageBuffer = await imageResponse.arrayBuffer();
    const base64 = Buffer.from(imageBuffer).toString("base64");
    const mimeType = imageResponse.headers.get("content-type") || "image/jpeg";

    // Call Gemini Flash
    const ai = new GoogleGenAI({ apiKey });

    const response = await ai.models.generateContent({
      model: TIPS_MODEL,
      config: {
        temperature: 0.8,
        maxOutputTokens: 500,
        systemInstruction: SYSTEM_PROMPT,
      },
      contents: [
        {
          role: "user",
          parts: [
            { inlineData: { mimeType, data: base64 } },
            { text: buildUserPrompt(objective, targetAudience) },
          ],
        },
      ],
    });

    const durationMs = Date.now() - startMs;

    // Extract real token usage for cost tracking
    const usageMetadata = (response as any).usageMetadata;
    const usage = usageMetadata ? {
      inputTokens: usageMetadata.promptTokenCount || usageMetadata.inputTokens || 0,
      outputTokens: usageMetadata.candidatesTokenCount || usageMetadata.outputTokens || 0,
    } : undefined;

    const text = response?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      logTipsCost(durationMs, id, storeId, usage).catch(() => {});
      return NextResponse.json({ error: "Sem resposta do modelo" }, { status: 500 });
    }

    // Parse JSON — clean markdown code blocks if any
    const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const tips: TipsResponse = JSON.parse(cleaned);

    // Validate no clothing references leaked through
    const forbidden = /calça|blusa|vestido|saia|conjunto|macacão|camisa|short|bermuda|regata/i;
    const allText = `${tips.poste_as} ${tips.tom_da_voz} ${tips.cta} ${tips.dica_extra} ${tips.hashtags.join(" ")}`;
    if (forbidden.test(allText)) {
      console.warn("[Tips] ⚠️ Clothing reference leaked, sanitizing...");
    }

    // Log cost (fire-and-forget)
    logTipsCost(durationMs, id, storeId, usage).catch(() => {});

    return NextResponse.json({ data: tips });
  } catch (err) {
    const durationMs = Date.now() - startMs;
    logTipsCost(durationMs, id, storeId).catch(() => {});
    console.error("[Tips] ❌", err instanceof Error ? err.message : err);
    return NextResponse.json(
      { error: "Erro ao gerar dicas" },
      { status: 500 }
    );
  }
}

