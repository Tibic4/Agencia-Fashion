/**
 * Pipeline Completo CriaLook — Teste E2E
 * 
 * Roda o pipeline inteiro como o SaaS faria:
 * 1. Vision Analyzer (análise da imagem)
 * 2. Estrategista (plano de campanha)
 * 3. Copywriter (textos para cada canal)
 * 4. Refinador (polimento)
 * 5. Scorer (nota 0-100)
 * 6. Fashn product-to-model (modelo vestindo a peça)
 * 7. Fashn edit (alisar + fundo profissional)
 */

import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";

// Carregar .env.local
dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

import Anthropic from "@anthropic-ai/sdk";

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY!;
const FASHN_API_KEY = process.env.FASHN_API_KEY!;

const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

// ═══════════════════════════════════════
// Configuração da "loja" simulada
// ═══════════════════════════════════════
const STORE = {
  name: "Moda Elegance",
  segment: "moda_feminina",
  price: "R$ 149,90",
  objective: "venda_imediata",
  targetAudience: "Mulheres 25-45 anos, classe B/C, que buscam peças versáteis para o dia a dia",
  tone: "sofisticado e acessível",
};

// ═══════════════════════════════════════
// Helpers
// ═══════════════════════════════════════

async function callClaude(system: string, prompt: string, model = "claude-sonnet-4-20250514"): Promise<string> {
  const start = Date.now();
  const res = await anthropic.messages.create({
    model,
    max_tokens: 2000,
    system,
    messages: [{ role: "user", content: prompt }],
  });
  const text = res.content[0].type === "text" ? res.content[0].text : "";
  console.log(`  ⏱️  ${Date.now() - start}ms | tokens: ${res.usage.input_tokens}/${res.usage.output_tokens}`);
  return text;
}

async function callClaudeVision(system: string, prompt: string, imageBase64: string, mediaType: string): Promise<string> {
  const start = Date.now();
  const res = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 2000,
    system,
    messages: [{
      role: "user",
      content: [
        { type: "image", source: { type: "base64", media_type: mediaType as any, data: imageBase64 } },
        { type: "text", text: prompt },
      ],
    }],
  });
  const text = res.content[0].type === "text" ? res.content[0].text : "";
  console.log(`  ⏱️  ${Date.now() - start}ms | tokens: ${res.usage.input_tokens}/${res.usage.output_tokens}`);
  return text;
}

async function fashnRun(modelName: string, inputs: Record<string, unknown>): Promise<any> {
  const res = await fetch("https://api.fashn.ai/v1/run", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${FASHN_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model_name: modelName, inputs }),
  });
  if (!res.ok) throw new Error(`Fashn ${modelName}: ${res.status} ${await res.text()}`);
  return res.json();
}

async function fashnPoll(jobId: string, maxSeconds = 120): Promise<any> {
  for (let i = 0; i < maxSeconds / 2; i++) {
    await new Promise(r => setTimeout(r, 2000));
    const res = await fetch(`https://api.fashn.ai/v1/status/${jobId}`, {
      headers: { Authorization: `Bearer ${FASHN_API_KEY}` },
    });
    if (!res.ok) continue;
    const data = await res.json();
    if (data.status === "completed") return data;
    if (data.status === "failed") throw new Error(`Job failed: ${JSON.stringify(data.error)}`);
    process.stdout.write(".");
  }
  throw new Error("Timeout");
}

// ═══════════════════════════════════════
// Pipeline
// ═══════════════════════════════════════

async function main() {
  const imagePath = process.argv[2] || "test-images/foto3-loja.jpg";
  console.log(`\n🚀 CriaLook Pipeline Completo — ${new Date().toISOString()}`);
  console.log(`📸 Imagem: ${imagePath}\n`);

  const imageBuffer = fs.readFileSync(imagePath);
  const imageBase64 = imageBuffer.toString("base64");
  const ext = path.extname(imagePath).toLowerCase();
  const mediaType = ext === ".png" ? "image/png" : "image/jpeg";

  const startTotal = Date.now();
  const results: any = {};

  // ─── Etapa 1: Vision Analyzer ───
  console.log("🔍 Etapa 1/5: Vision Analyzer (análise da foto)...");
  const visionResult = await callClaudeVision(
    `Você é um expert em moda brasileira. Analise a foto do produto e retorne um JSON com: tipo_peca, cor_principal, cores_secundarias, tecido_provavel, ocasiao, estilo, estacao, detalhes_especiais, qualidade_foto (1-10), sugestao_melhoria_foto.`,
    `Analise este produto de moda. O segmento é ${STORE.segment}. Preço: ${STORE.price}. Retorne APENAS o JSON, sem markdown.`,
    imageBase64,
    mediaType
  );
  results.vision = visionResult;
  console.log(`  ✅ Vision:`, visionResult.substring(0, 200), "...\n");

  // ─── Etapa 2: Estrategista ───
  console.log("🎯 Etapa 2/5: Estrategista (plano de campanha)...");
  const strategyResult = await callClaude(
    `Você é um estrategista de marketing digital para varejo de moda brasileiro. Crie uma estratégia de campanha baseada na análise visual do produto.`,
    `Loja: ${STORE.name} | Segmento: ${STORE.segment} | Preço: ${STORE.price}
Objetivo: ${STORE.objective} | Público: ${STORE.targetAudience}
Tom: ${STORE.tone}

Análise do produto:
${visionResult}

Crie uma estratégia com: angulo_principal, gatilhos_mentais (3), tom_recomendado, hook_principal, cta_principal, hashtags_sugeridas (5).
Retorne APENAS JSON.`
  );
  results.strategy = strategyResult;
  console.log(`  ✅ Estratégia:`, strategyResult.substring(0, 200), "...\n");

  // ─── Etapa 3: Copywriter ───
  console.log("✍️  Etapa 3/5: Copywriter (textos para 4 canais)...");
  const copyResult = await callClaude(
    `Você é um copywriter especialista em moda brasileira. Crie textos persuasivos para cada canal.`,
    `Loja: ${STORE.name} | Preço: ${STORE.price} | Tom: ${STORE.tone}
Público: ${STORE.targetAudience}

Análise: ${visionResult}
Estratégia: ${strategyResult}

Crie textos para TODOS os canais. Retorne JSON com:
- headline_principal
- headline_variacao_1
- headline_variacao_2
- instagram_feed (legenda completa com emojis e hashtags)
- instagram_stories (objeto com: texto_slide_1, texto_slide_2, texto_slide_3, cta)
- whatsapp (mensagem casual para lista de transmissão)
- meta_ads (objeto com: headline, description, primary_text)
- hashtags (array de 10)`
  );
  results.copy = copyResult;
  console.log(`  ✅ Copy:`, copyResult.substring(0, 300), "...\n");

  // ─── Etapa 4: Refinador ───
  console.log("💎 Etapa 4/5: Refinador (polimento)...");
  const refineResult = await callClaude(
    `Você é um editor sênior de copy para moda. Refine os textos mantendo o tom e corrigindo qualquer erro.`,
    `Revise estes textos de campanha. Corrija erros, melhore fluidez, garanta que esteja adequado para o público ${STORE.targetAudience}. Mantenha o JSON no mesmo formato:

${copyResult}`,
    "claude-sonnet-4-20250514"
  );
  results.refined = refineResult;
  console.log(`  ✅ Refinado:`, refineResult.substring(0, 200), "...\n");

  // ─── Etapa 5: Scorer ───
  console.log("📊 Etapa 5/5: Scorer (nota da campanha)...");
  const scoreResult = await callClaude(
    `Você avalia campanhas de marketing de moda. Dê notas objetivas de 0-100.`,
    `Avalie esta campanha:

Textos: ${refineResult}

Retorne JSON com: nota_geral (0-100), conversao (0-100), clareza (0-100), urgencia (0-100), naturalidade (0-100), aprovacao_meta (0-100), nivel_risco ("baixo"|"medio"|"alto"), resumo (1 frase), pontos_fortes (array 3), melhorias (array 3).`,
    "claude-sonnet-4-20250514"
  );
  results.score = scoreResult;
  console.log(`  ✅ Score:`, scoreResult.substring(0, 300), "...\n");

  // ─── Etapa 6: Fashn Product-to-Model ───
  console.log("👗 Etapa 6/7: Fashn Product-to-Model (gerando modelo vestindo a peça)...");
  const dataUri = `data:${mediaType};base64,${imageBase64}`;
  try {
    const job = await fashnRun("product-to-model", { product_image: dataUri });
    console.log(`  📡 Job ID: ${job.id}`);
    process.stdout.write("  Aguardando");
    const ptmResult = await fashnPoll(job.id);
    console.log(`\n  ✅ Modelo gerado: ${ptmResult.output?.[0] || ptmResult.output_url}`);
    results.modelImageUrl = ptmResult.output?.[0] || ptmResult.output_url;

    // ─── Etapa 7: Fashn Edit (alisar + fundo) ───
    if (results.modelImageUrl) {
      console.log("\n🎨 Etapa 7/7: Fashn Edit (alisar roupa + fundo profissional)...");
      const editJob = await fashnRun("edit", {
        image: results.modelImageUrl,
        prompt: "Professional fashion photo, smooth fabric without wrinkles, clean white studio background, soft studio lighting",
      });
      console.log(`  📡 Edit Job ID: ${editJob.id}`);
      process.stdout.write("  Aguardando");
      const editResult = await fashnPoll(editJob.id);
      console.log(`\n  ✅ Imagem final: ${editResult.output?.[0] || editResult.output_url}`);
      results.finalImageUrl = editResult.output?.[0] || editResult.output_url;
    }
  } catch (err: any) {
    console.log(`  ⚠️ Fashn: ${err.message}`);
    results.fashnError = err.message;
  }

  const totalMs = Date.now() - startTotal;

  // ─── Resultado Final ───
  console.log("\n" + "═".repeat(60));
  console.log("🏁 PIPELINE COMPLETO!");
  console.log("═".repeat(60));
  console.log(`⏱️  Tempo total: ${(totalMs / 1000).toFixed(1)}s`);
  console.log(`💰 Custo estimado: ~R$ 0,58`);
  console.log("═".repeat(60));

  // Salvar resultado
  const outputPath = `test-images/pipeline-result-${Date.now()}.json`;
  fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
  console.log(`\n💾 Resultado salvo em: ${outputPath}`);
}

main().catch(console.error);
