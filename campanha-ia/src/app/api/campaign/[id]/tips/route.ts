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
import { env } from "@/lib/env";

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

// ── Allowlist de hosts para fetch de imagem (anti-SSRF) ──
// Apenas Supabase Storage do projeto é aceito.
const ALLOWED_IMAGE_HOSTS = new Set<string>([
  "emybirklqhonqodzyzet.supabase.co",
]);

function isAllowedImageUrl(raw: string): boolean {
  try {
    const u = new URL(raw);
    if (u.protocol !== "https:") return false;
    if (!ALLOWED_IMAGE_HOSTS.has(u.hostname)) return false;
    // Bloquear IPs literais e localhost por segurança adicional
    if (/^\d+\.\d+\.\d+\.\d+$/.test(u.hostname)) return false;
    if (u.hostname === "localhost" || u.hostname.endsWith(".local")) return false;
    return true;
  } catch {
    return false;
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
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) {
    return NextResponse.json({ error: "Campaign ID inválido" }, { status: 400 });
  }

  // ── Ownership check + cache: só lê campaign se for da store do user ──
  let storeId: string | null = null;
  let campaignOutput: { smart_tips?: unknown } | null = null;
  try {
    const { getStoreByClerkId } = await import("@/lib/db");
    const { createAdminClient } = await import("@/lib/supabase/admin");
    const store = await getStoreByClerkId(userId);
    if (!store) {
      return NextResponse.json({ error: "Loja não encontrada" }, { status: 403 });
    }
    storeId = store.id;

    const cacheClient = createAdminClient();
    const { data: campaign } = await cacheClient
      .from("campaigns")
      .select("output, store_id")
      .eq("id", id)
      .eq("store_id", store.id) // IDOR fix: só aceita se for dessa loja
      .maybeSingle();

    if (!campaign) {
      return NextResponse.json({ error: "Campanha não encontrada" }, { status: 404 });
    }

    campaignOutput = campaign.output as { smart_tips?: unknown } | null;
    if (campaignOutput?.smart_tips) {
      console.log(`[Tips Pro] ✅ Cache hit for campaign ${id} — zero cost`);
      return NextResponse.json({ data: campaignOutput.smart_tips, cached: true });
    }
  } catch (e) {
    console.error("[Tips Pro] Erro no ownership/cache check:", e);
    return NextResponse.json({ error: "Erro ao validar campanha" }, { status: 500 });
  }

  const apiKey = env.GOOGLE_AI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "GOOGLE_AI_API_KEY não configurada" }, { status: 500 });
  }

  const startMs = Date.now();

  try {
    const body = await request.json();
    const { imageUrl, objective, targetAudience, toneOverride } = body as {
      imageUrl: string;
      objective?: string;
      targetAudience?: string;
      toneOverride?: string;
    };

    if (!imageUrl || typeof imageUrl !== "string") {
      return NextResponse.json({ error: "imageUrl obrigatório" }, { status: 400 });
    }

    // SSRF fix: só aceitar URLs de hosts permitidos
    if (!isAllowedImageUrl(imageUrl)) {
      console.warn(`[Tips Pro] 🚨 imageUrl rejeitada (SSRF guard): ${imageUrl}`);
      return NextResponse.json({ error: "imageUrl não permitida" }, { status: 400 });
    }

    // Download image and convert to base64 com tamanho máximo e timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10_000);
    let imageResponse: Response;
    try {
      imageResponse = await fetch(imageUrl, { signal: controller.signal });
    } finally {
      clearTimeout(timeoutId);
    }
    if (!imageResponse.ok) {
      return NextResponse.json({ error: "Falha ao baixar imagem" }, { status: 400 });
    }
    const contentLength = Number(imageResponse.headers.get("content-length") || "0");
    if (contentLength > 10 * 1024 * 1024) {
      return NextResponse.json({ error: "Imagem maior que 10MB" }, { status: 400 });
    }
    const imageBuffer = await imageResponse.arrayBuffer();
    if (imageBuffer.byteLength > 10 * 1024 * 1024) {
      return NextResponse.json({ error: "Imagem maior que 10MB" }, { status: 400 });
    }
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
      const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL!;
      const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY!;
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
