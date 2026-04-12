/**
 * @deprecated — Esta rota NÃO é mais chamada pelo frontend.
 * O copy de Instagram agora é gerado diretamente pelo Analyzer (gemini-analyzer.ts)
 * dentro da pipeline de geração. Mantida apenas para compatibilidade com logs antigos.
 * 
 * POST /api/campaign/[id]/tips
 *
 * Gemini 3.1 Pro — Copywriter profissional para Instagram.
 * Gera copy pronto para colar + dicas de marketing baseadas na foto.
 * 
 * REGRA: NUNCA menciona cor, tipo de peça, tecido ou qualquer detalhe do vestuário.
 * Analisa APENAS: cenário, iluminação, composição, mood visual.
 * 
 * Input:  { imageUrl: string, objective?: string, targetAudience?: string, toneOverride?: string }
 * Output: { caption, caption_alternativa, poste_as, tom_da_voz, cta, dica_extra, story_idea, hashtags }
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { GoogleGenAI } from "@google/genai";

// Gemini 3.1 Pro — melhor raciocínio criativo, ideal para copywriting
const TIPS_MODEL = "gemini-3.1-pro-preview";

interface TipsResponse {
  caption: string;
  caption_alternativa: string;
  poste_as: string;
  tom_da_voz: string;
  cta: string;
  dica_extra: string;
  story_idea: string;
  hashtags: string[];
}

// ═══════════════════════════════════════
// Prompt Engineering (social-content + vto-expert skills)
// ═══════════════════════════════════════

const SYSTEM_PROMPT = `Você é uma copywriter sênior de Instagram especializada em moda feminina brasileira.
Você escreve captions magnéticas que geram salvamentos, compartilhamentos e vendas.

SUA MISSÃO: Olhar a foto da campanha e criar COPY PRONTA PARA COLAR no Instagram.

═══ REGRA ABSOLUTA — PROIBIDO ═══
- NUNCA mencione tipo de peça (calça, blusa, vestido, saia, conjunto, macacão etc.)
- NUNCA mencione cor, tecido, estampa ou material da roupa
- NUNCA use "peça", "roupa", "look", "outfit" ou "produção"
- Se você quebrar essa regra, o output é INÚTIL

═══ O QUE VOCÊ ANALISA DA FOTO ═══
- Cenário (estúdio? rua? loja? natureza? café?)
- Iluminação (golden hour? flash? suave? dramática?)
- Mood visual (editorial? casual vibrante? sofisticado? jovem?)
- Postura da modelo (confiança? movimento? olhar direto? relaxada?)
- Composição (corpo inteiro? meio corpo? close? ângulo?)

═══ TÉCNICAS DE COPY QUE VOCÊ USA ═══

1. HOOK FIRST: A primeira frase PARA o scroll. Use uma dessas fórmulas:
   - Curiosidade: "Tem algo nessa foto que ninguém percebe…"
   - Emoção: "Aquela sensação de se sentir incrível ✨"
   - Pergunta: "Quem mais acorda querendo se sentir assim?"
   - Contrarian: "Todo mundo fala X, mas a verdade é Y"

2. SHORT. BREATHE. LAND:
   - Uma ideia por frase
   - Quebre linhas
   - Deixe os pontos importantes respirarem
   - Crie ritmo: curto, curto, explicação

3. SPECIFIC > VAGUE:
   - ❌ "Poste no melhor horário"
   - ✅ "21h de terça — quando seu público abre o Insta no sofá"

4. WRITE FROM EMOTION:
   - Comece pelo sentimento, não pela ação
   - Use palavras emocionais: confiança, brilho, poder, liberdade

5. CTA QUE CONVERTE:
   - Pergunta: "O que vocês acham?"
   - Salvar: "Salva pra quando precisar de inspiração 📌"
   - Compartilhar: "Marca quem precisa ver isso"
   - DM: "Manda 'QUERO' nos stories"

═══ FORMATO DE RESPOSTA ═══
Responda SEMPRE em JSON puro válido. Sem markdown, sem \`\`\`, sem explicações.
Apenas o JSON.`;

function buildUserPrompt(objective?: string, targetAudience?: string, toneOverride?: string): string {
  let prompt = `Olhe esta foto de campanha e me entregue COPY PROFISSIONAL pronto para colar.

Responda neste JSON exato:
{
  "caption": "Caption completa para o feed do Instagram (150-250 caracteres, com emojis, hook na primeira frase, CTA no final). NÃO mencione roupas.",
  "caption_alternativa": "Segunda opção com tom DIFERENTE — se a primeira é descontraída, esta é sofisticada e vice-versa. Mesmas regras.",
  "poste_as": "horário específico + dia ideal (ex: 'Terça às 21h — seu público está relaxando no sofá'). Justifique pelo mood da foto.",
  "tom_da_voz": "tom da caption em 3-5 palavras que COMBINE com a energia da foto",
  "cta": "call-to-action criativo e curto (max 8 palavras) que gere ação IMEDIATA",
  "dica_extra": "1 dica prática de marketing para ESSA foto específica (max 30 palavras). Baseada no que você VÊ.",
  "story_idea": "Ideia criativa para um Story complementar usando essa mesma foto (max 30 palavras). Ex: enquete, antes/depois, countdown etc.",
  "hashtags": ["10-12 hashtags sem # — mix estratégico: 3 de alto alcance, 4 de nicho moda, 3 locais/tendência, 2 de comunidade"]
}`;

  if (objective) {
    const objMap: Record<string, string> = {
      venda_imediata: "venda direta / conversão rápida — caption deve criar urgência sutil",
      lancamento: "lançamento de novidade / criar desejo — caption deve gerar FOMO e curiosidade",
      promocao: "promoção / urgência / escassez — caption deve ter gatilho de tempo limitado",
      engajamento: "engajamento / salvar / compartilhar — caption deve fazer pergunta ou pedir opinião",
    };
    prompt += `\n\nObjetivo da campanha: ${objMap[objective] || objective}`;
  }

  if (targetAudience) {
    prompt += `\nPúblico-alvo: ${targetAudience}`;
  }

  if (toneOverride) {
    const toneMap: Record<string, string> = {
      casual_energetico: "Casual e energético — linguagem jovem, emojis, ritmo acelerado",
      sofisticado: "Sofisticado e elegante — vocabulário refinado, sem gírias, luxo sutil",
      urgente: "Urgente e direto — escassez, FOMO, gatilhos de tempo limitado",
      acolhedor: "Acolhedor e afetuoso — como uma amiga dando dica, linguagem abraçante",
      divertido: "Divertido e leve — humor, trocadilhos, energia boa",
    };
    prompt += `\nTom de voz obrigatório: ${toneMap[toneOverride] || toneOverride}`;
  }

  const hour = new Date().getHours();
  const dayOfWeek = new Date().toLocaleDateString("pt-BR", { weekday: "long" });
  prompt += `\nContexto temporal: ${dayOfWeek}, ${hour}h`;

  return prompt;
}

/**
 * Log custo da chamada Pro no admin (fire-and-forget)
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

    let costUsd = 0.005; // fallback estimado Pro (~R$ 0,03)
    const inputTokens = usage?.inputTokens || 0;
    const outputTokens = usage?.outputTokens || 0;

    if (inputTokens > 0 || outputTokens > 0) {
      const pricing = await getModelPricing();
      const modelPrice = pricing[TIPS_MODEL] || pricing["gemini-3.1-pro-preview"] || { inputPerMTok: 2.00, outputPerMTok: 12.00 };
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

    console.log(`[Tips Pro] 💰 Custo: R$ ${costBrl.toFixed(4)} (${inputTokens}+${outputTokens} tokens, ${durationMs}ms)`);
  } catch (e) {
    console.warn("[Tips Pro] ⚠️ Erro ao logar custo:", e);
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

  // ── Server-side cache: check if tips already exist in campaign output ──
  try {
    const { createClient } = await import("@supabase/supabase-js");
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const cacheClient = createClient(supabaseUrl, supabaseKey);
    
    const { data: campaign } = await cacheClient
      .from("campaigns")
      .select("output")
      .eq("id", id)
      .single();
    
    if (campaign?.output?.smart_tips) {
      console.log(`[Tips Pro] ✅ Cache hit for campaign ${id} — zero cost`);
      return NextResponse.json({ data: campaign.output.smart_tips, cached: true });
    }
  } catch {
    // Non-fatal — proceed to generate
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
    const { imageUrl, objective, targetAudience, toneOverride } = body as {
      imageUrl: string;
      objective?: string;
      targetAudience?: string;
      toneOverride?: string;
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

    // Call Gemini 3.1 Pro — Copywriter mode
    const ai = new GoogleGenAI({ apiKey });

    const response = await ai.models.generateContent({
      model: TIPS_MODEL,
      config: {
        temperature: 0.9, // mais criatividade para copywriting
        maxOutputTokens: 1200, // copy completo + variações
        systemInstruction: SYSTEM_PROMPT,
      },
      contents: [
        {
          role: "user",
          parts: [
            { inlineData: { mimeType, data: base64 } },
            { text: buildUserPrompt(objective, targetAudience, toneOverride) },
          ],
        },
      ],
    });

    const durationMs = Date.now() - startMs;

    // Extract real token usage for cost tracking
    const usageMetadata = (response as unknown as Record<string, unknown>).usageMetadata as Record<string, number> | undefined;
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
    let tips: TipsResponse;
    try {
      tips = JSON.parse(cleaned);
    } catch {
      // Tentar reparar JSON truncado (raro com structured output)
      console.warn("[Tips Pro] ⚠️ JSON inválido, tentando reparar...");
      try {
        let repaired = cleaned;
        const first = repaired.indexOf("{");
        const last = repaired.lastIndexOf("}");
        if (first !== -1 && last > first) repaired = repaired.slice(first, last + 1);
        // Fix unclosed strings/brackets
        const quotes = (repaired.match(/(?<!\\)"/g) || []).length;
        if (quotes % 2 !== 0) repaired += '"';
        const opens = (repaired.match(/[{\[]/g) || []).length;
        const closes = (repaired.match(/[}\]]/g) || []).length;
        for (let i = 0; i < opens - closes; i++) {
          const lastOpen = Math.max(repaired.lastIndexOf("{"), repaired.lastIndexOf("["));
          repaired += repaired[lastOpen] === "{" ? "}" : "]";
        }
        tips = JSON.parse(repaired);
      } catch {
        logTipsCost(durationMs, id, storeId, usage).catch(() => {});
        return NextResponse.json({ error: "Resposta da IA veio incompleta. Tente novamente." }, { status: 500 });
      }
    }

    // Validate no clothing references leaked through
    const forbidden = /calça|blusa|vestido|saia|conjunto|macacão|camisa|short|bermuda|regata|peça|roupa|look|outfit|produção/i;
    const allText = `${tips.caption} ${tips.caption_alternativa} ${tips.poste_as} ${tips.tom_da_voz} ${tips.cta} ${tips.dica_extra} ${tips.story_idea} ${tips.hashtags.join(" ")}`;
    if (forbidden.test(allText)) {
      console.warn("[Tips Pro] ⚠️ Clothing reference leaked, sanitizing...");
      // Could implement auto-sanitization here in the future
    }

    // Log cost (fire-and-forget)
    logTipsCost(durationMs, id, storeId, usage).catch(() => {});

    // ── Save tips to campaign output for server-side cache (fire-and-forget) ──
    try {
      const { createClient } = await import("@supabase/supabase-js");
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
      const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
      const saveClient = createClient(supabaseUrl, supabaseKey);
      
      // Read current output and merge smart_tips into it
      const { data: current } = await saveClient
        .from("campaigns")
        .select("output")
        .eq("id", id)
        .single();
      
      const updatedOutput = { ...(current?.output || {}), smart_tips: tips };
      await saveClient
        .from("campaigns")
        .update({ output: updatedOutput })
        .eq("id", id);
      
      console.log(`[Tips Pro] 💾 Cached tips for campaign ${id}`);
    } catch (e) {
      console.warn("[Tips Pro] ⚠️ Failed to cache tips:", e);
    }

    return NextResponse.json({ data: tips });
  } catch (err) {
    const durationMs = Date.now() - startMs;
    logTipsCost(durationMs, id, storeId).catch(() => {});
    console.error("[Tips Pro] ❌", err instanceof Error ? err.message : err);
    return NextResponse.json(
      { error: "Erro ao gerar dicas" },
      { status: 500 }
    );
  }
}
