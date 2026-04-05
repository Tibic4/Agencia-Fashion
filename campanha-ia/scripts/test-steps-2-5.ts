/**
 * Teste do pipeline - Steps 2-5 (Strategy → Copy → Refine → Score)
 * A análise visual (Step 1) foi feita manualmente baseado na foto do manequim.
 * 
 * Uso: npx tsx scripts/test-steps-2-5.ts
 */
import * as path from "path";
import * as fs from "fs";
import * as dotenv from "dotenv";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

import { callClaude } from "../src/lib/ai/anthropic";
import {
  STRATEGY_SYSTEM, buildStrategyPrompt,
  COPYWRITER_SYSTEM, buildCopywriterPrompt,
  REFINER_SYSTEM, buildRefinerPrompt,
  SCORER_SYSTEM, buildScorerPrompt,
} from "../src/lib/ai/prompts";

// ══════════════════════════════════════════
// STEP 1: Vision Analysis — feita manualmente
// baseado na foto do manequim com conjunto marrom/roxo
// ══════════════════════════════════════════
const visionResult = {
  produto: {
    nome_generico: "Conjunto feminino t-shirt cropped + saia midi com amarração",
    categoria: "Conjuntos",
    subcategoria: "Midi"
  },
  segmento: "feminino",
  atributos_visuais: {
    cor_principal: "Marrom rosado",
    cor_secundaria: "Roxo berinjela",
    cores_complementares: [],
    material_aparente: "Malha / Viscolycra",
    estampa: "Liso",
    detalhes: ["Amarração na cintura da saia", "Fenda frontal na saia", "T-shirt cropped de manga curta", "Gola redonda"]
  },
  caimento: "semi-ajustado",
  ocasiao_uso: ["casual", "trabalho", "dia_a_dia"],
  estacao: "meia_estação",
  qualidade_foto: {
    resolucao: "media",
    fundo: "ambiente",
    iluminacao: "media",
    necessita_tratamento: true
  },
  nicho_sensivel: false,
  mood: ["feminino", "confortável", "versátil", "elegante casual"],
  palavras_chave_venda: ["conjunto feminino", "saia midi", "look completo", "peça versátil", "confortável", "tendência 2026"]
};

function parseJSON<T>(raw: string, stepName: string): T {
  let cleaned = raw.trim();
  const jsonBlock = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonBlock) cleaned = jsonBlock[1].trim();
  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace !== -1 && firstBrace < lastBrace) {
    cleaned = cleaned.slice(firstBrace, lastBrace + 1);
  }
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    console.error(`[${stepName}] JSON inválido:`, cleaned.slice(0, 300));
    throw new Error(`Parse falhou em ${stepName}`);
  }
}

async function main() {
  console.log("\n╔══════════════════════════════════════════╗");
  console.log("║   🧪 CriaLook — Pipeline Test (foto 1)   ║");
  console.log("╚══════════════════════════════════════════╝\n");

  // Dados simulados da loja
  const storeName = "Bella Donna Fashion";
  const price = "89,90";
  const objective = "Vender rápido esta peça nova";
  const targetAudience = "Mulheres 25-45, classe B/C, compram pelo Instagram";

  console.log(`🏪 Loja: ${storeName}`);
  console.log(`💰 Preço: R$ ${price}`);
  console.log(`🎯 Objetivo: ${objective}`);
  console.log(`👥 Público: ${targetAudience}`);
  console.log(`📸 Produto: ${visionResult.produto.nome_generico}`);
  console.log("\n═══ STEP 1: VISION (manual) ═══");
  console.log(JSON.stringify(visionResult, null, 2));

  const startAll = Date.now();

  // ── STEP 2: STRATEGY ─────────────────
  console.log("\n═══ STEP 2: STRATEGY ═══");
  const s2Start = Date.now();
  const strategyRaw = await callClaude({
    system: STRATEGY_SYSTEM,
    messages: [{
      role: "user",
      content: buildStrategyPrompt({
        produto: visionResult.produto.nome_generico,
        preco: price,
        objetivo: objective,
        atributos: JSON.stringify(visionResult.atributos_visuais),
        segmento: visionResult.segmento,
        mood: visionResult.mood,
        publicoAlvo: targetAudience,
      }),
    }],
    temperature: 0.8,
  });
  const strategy = parseJSON<any>(strategyRaw, "Strategy");
  console.log(`⏱  ${((Date.now() - s2Start) / 1000).toFixed(1)}s`);
  console.log(JSON.stringify(strategy, null, 2));

  // ── STEP 3: COPYWRITER ───────────────
  console.log("\n═══ STEP 3: COPYWRITER ═══");
  const s3Start = Date.now();
  const copyRaw = await callClaude({
    system: COPYWRITER_SYSTEM,
    messages: [{
      role: "user",
      content: buildCopywriterPrompt({
        produto: visionResult.produto.nome_generico,
        preco: price,
        loja: storeName,
        estrategia: JSON.stringify(strategy),
        segmento: visionResult.segmento,
        atributos: JSON.stringify(visionResult.atributos_visuais),
      }),
    }],
    maxTokens: 3000,
    temperature: 0.85,
  });
  const copyTexts = parseJSON<any>(copyRaw, "Copywriter");
  console.log(`⏱  ${((Date.now() - s3Start) / 1000).toFixed(1)}s`);
  
  console.log("\n─── Headline ───");
  console.log(copyTexts.headline_principal);
  console.log("Var 1:", copyTexts.headline_variacao_1);
  console.log("Var 2:", copyTexts.headline_variacao_2);
  
  console.log("\n─── Instagram Feed ───");
  console.log(copyTexts.instagram_feed);
  
  console.log("\n─── Stories ───");
  if (copyTexts.instagram_stories) {
    console.log("  1:", copyTexts.instagram_stories.slide_1);
    console.log("  2:", copyTexts.instagram_stories.slide_2);
    console.log("  3:", copyTexts.instagram_stories.slide_3);
    console.log("  CTA:", copyTexts.instagram_stories.cta_final);
  }
  
  console.log("\n─── WhatsApp ───");
  console.log(copyTexts.whatsapp);
  
  console.log("\n─── Meta Ads ───");
  if (copyTexts.meta_ads) {
    console.log("  Título:", copyTexts.meta_ads.titulo);
    console.log("  Texto:", copyTexts.meta_ads.texto_principal);
    console.log("  Desc:", copyTexts.meta_ads.descricao);
    console.log("  CTA:", copyTexts.meta_ads.cta_button);
  }
  
  console.log("\n─── Hashtags ───");
  console.log((copyTexts.hashtags || []).map((h: string) => `#${h}`).join(" "));

  // ── STEP 4: REFINER ──────────────────
  console.log("\n═══ STEP 4: REFINER ═══");
  const s4Start = Date.now();
  const refinerRaw = await callClaude({
    system: REFINER_SYSTEM,
    messages: [{
      role: "user",
      content: buildRefinerPrompt({
        textos: JSON.stringify(copyTexts),
        estrategia: JSON.stringify(strategy),
      }),
    }],
    maxTokens: 3000,
    temperature: 0.5,
  });
  const refined = parseJSON<any>(refinerRaw, "Refiner");
  console.log(`⏱  ${((Date.now() - s4Start) / 1000).toFixed(1)}s`);
  
  if (refined.refinements?.length) {
    console.log("\n🔄 Refinamentos:");
    refined.refinements.forEach((r: any) => {
      console.log(`  • ${r.campo}: "${r.antes}" → "${r.depois}"`);
      console.log(`    Motivo: ${r.motivo}`);
    });
  } else {
    console.log("  ✅ Sem refinamentos necessários");
  }

  const finalTexts = refined.textos_refinados || copyTexts;

  // ── STEP 5: SCORER ───────────────────
  console.log("\n═══ STEP 5: SCORER ═══");
  const s5Start = Date.now();
  const scoreRaw = await callClaude({
    system: SCORER_SYSTEM,
    messages: [{
      role: "user",
      content: buildScorerPrompt({
        textos: JSON.stringify(finalTexts),
        estrategia: JSON.stringify(strategy),
        produto: visionResult.produto.nome_generico,
        preco: price,
      }),
    }],
    temperature: 0.3,
  });
  const score = parseJSON<any>(scoreRaw, "Scorer");
  console.log(`⏱  ${((Date.now() - s5Start) / 1000).toFixed(1)}s`);

  console.log("\n╔══════════════════════════════════════╗");
  console.log("║          ⭐ SCORE FINAL              ║");
  console.log("╚══════════════════════════════════════╝");
  console.log(`  📊 Nota Geral:     ${score.nota_geral}/100`);
  console.log(`  🎯 Conversão:      ${score.conversao}/100`);
  console.log(`  💡 Clareza:        ${score.clareza}/100`);
  console.log(`  ⚡ Urgência:       ${score.urgencia}/100`);
  console.log(`  🗣  Naturalidade:   ${score.naturalidade}/100`);
  console.log(`  📢 Aprovação Meta: ${score.aprovacao_meta}/100`);
  console.log(`  🎨 Criatividade:   ${score.criatividade}/100`);
  console.log(`  🔒 Risco:          ${score.nivel_risco}`);
  console.log(`  📈 Engajamento:    ${score.previsao_engajamento}`);
  console.log(`\n  📋 ${score.resumo}`);

  if (score.pontos_fortes?.length) {
    console.log("\n  ✅ Pontos fortes:");
    score.pontos_fortes.forEach((p: string) => console.log(`     • ${p}`));
  }
  if (score.melhorias?.length) {
    console.log("\n  🔧 Melhorias:");
    (score.melhorias as any[]).forEach((m: any) =>
      console.log(`     • [${m.impacto}] ${m.campo}: ${m.sugestao}`)
    );
  }
  if (score.alertas_meta?.length) {
    console.log("\n  ⚠️ Alertas Meta:");
    (score.alertas_meta as any[]).forEach((a: any) =>
      console.log(`     • [${a.nivel}] "${a.trecho}" → ${a.correcao}`)
    );
  }

  const totalTime = ((Date.now() - startAll) / 1000).toFixed(1);
  console.log(`\n\n═══ TOTAL: ${totalTime}s ═══\n`);

  // Salvar tudo
  const result = { visionResult, strategy, copyTexts, refined: finalTexts, score, totalTimeMs: Date.now() - startAll };
  const outFile = path.resolve(process.cwd(), `test-result-foto1-${Date.now()}.json`);
  fs.writeFileSync(outFile, JSON.stringify(result, null, 2), "utf-8");
  console.log(`📁 Resultado salvo: ${outFile}`);
}

main().catch(console.error);
