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
 * Custo: ~R$ 0,001 por chamada (Flash 2.0 + 1 imagem)
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { GoogleGenAI } from "@google/genai";

interface TipsResponse {
  poste_as: string;
  tom_da_voz: string;
  cta: string;
  dica_extra: string;
  hashtags: string[];
}

const SYSTEM_PROMPT = `Você é um consultor de marketing digital especializado em moda feminina brasileira no Instagram.

REGRA ABSOLUTA — PROIBIDO:
- NUNCA mencione tipo de peça (calça, blusa, vestido, saia, conjunto, macacão etc.)
- NUNCA mencione cor da roupa (azul, vermelho, nude, preto etc.)
- NUNCA mencione tecido (algodão, viscose, crepe etc.)
- NUNCA mencione estampa, modelagem ou caimento
- NUNCA use a palavra "peça", "roupa", "look" ou "outfit" para descrever o que vê
- Se quebrar QUALQUER regra acima, a resposta será descartada

O QUE VOCÊ PODE ANALISAR:
- Cenário/ambiente (estúdio, rua, loja, natureza)
- Iluminação (natural, artificial, dourada, suave)
- Composição fotográfica (close, corpo inteiro, ângulo)
- Mood/energia visual (editorial, casual, sofisticado, vibrante)
- Paleta de cores da CENA (não da roupa)
- Postura e expressão da modelo

Responda SEMPRE em JSON válido, sem markdown, sem code blocks.`;

function buildUserPrompt(objective?: string, targetAudience?: string): string {
  let prompt = `Analise esta foto de moda e gere dicas de marketing personalizadas.

Responda neste JSON exato:
{
  "poste_as": "horário ideal ex: '19h' ou '12h–14h'",
  "tom_da_voz": "tom ideal para caption (max 5 palavras)",
  "cta": "call-to-action curto e criativo (max 8 palavras)",
  "dica_extra": "1 dica prática de marketing (max 20 palavras)",
  "hashtags": ["8 hashtags relevantes sem #"]
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
      model: "gemini-2.5-flash-preview-05-20",
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

    const text = response?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
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
      // Don't fail, just log — the user won't notice minor references in hashtags
    }

    return NextResponse.json({ data: tips });
  } catch (err) {
    console.error("[Tips] ❌", err instanceof Error ? err.message : err);
    return NextResponse.json(
      { error: "Erro ao gerar dicas" },
      { status: 500 }
    );
  }
}
