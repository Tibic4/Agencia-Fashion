/**
 * Teste pipeline - Foto 2: Conjunto verde oliva
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

function parseJSON<T>(raw: string, stepName: string): T {
  let cleaned = raw.trim();
  const jsonBlock = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonBlock) cleaned = jsonBlock[1].trim();
  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace !== -1 && firstBrace < lastBrace) {
    cleaned = cleaned.slice(firstBrace, lastBrace + 1);
  }
  try { return JSON.parse(cleaned) as T; }
  catch { console.error(`[${stepName}] JSON inválido:`, cleaned.slice(0, 300)); throw new Error(`Parse falhou em ${stepName}`); }
}

// Vision manual - foto 2: conjunto verde oliva
const visionResult = {
  produto: {
    nome_generico: "Conjunto feminino t-shirt cropped + saia midi com amarração e bolso frontal",
    categoria: "Conjuntos",
    subcategoria: "Midi"
  },
  segmento: "feminino",
  atributos_visuais: {
    cor_principal: "Verde oliva",
    cor_secundaria: null,
    cores_complementares: [],
    material_aparente: "Malha / Viscolycra",
    estampa: "Liso",
    detalhes: ["Amarração na cintura da saia", "Fenda frontal na saia", "Bolso frontal na saia", "T-shirt cropped manga curta", "Gola redonda", "Elástico na cintura"]
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
  mood: ["feminino", "natural", "prático", "elegante casual"],
  palavras_chave_venda: ["conjunto feminino", "saia midi", "verde oliva", "look completo", "confortável", "tendência 2026"]
};

async function main() {
  console.log("\n╔══════════════════════════════════════════╗");
  console.log("║   🧪 Pipeline Test — FOTO 2 (verde)      ║");
  console.log("╚══════════════════════════════════════════╝\n");

  const storeName = "Closet da Lu";
  const price = "79,90";
  const objective = "Atrair novas clientes com peça versátil";

  console.log(`📸 ${visionResult.produto.nome_generico}`);
  console.log(`🏪 ${storeName} | 💰 R$ ${price}\n`);

  const startAll = Date.now();

  // STEP 2
  console.log("═══ STEP 2: STRATEGY ═══");
  const strategyRaw = await callClaude({ system: STRATEGY_SYSTEM, messages: [{ role: "user", content: buildStrategyPrompt({ produto: visionResult.produto.nome_generico, preco: price, objetivo: objective, atributos: JSON.stringify(visionResult.atributos_visuais), segmento: visionResult.segmento, mood: visionResult.mood }) }], temperature: 0.8 });
  const strategy = parseJSON<any>(strategyRaw, "Strategy");
  console.log("✅ OK\n");

  // STEP 3
  console.log("═══ STEP 3: COPYWRITER ═══");
  const copyRaw = await callClaude({ system: COPYWRITER_SYSTEM, messages: [{ role: "user", content: buildCopywriterPrompt({ produto: visionResult.produto.nome_generico, preco: price, loja: storeName, estrategia: JSON.stringify(strategy), segmento: visionResult.segmento, atributos: JSON.stringify(visionResult.atributos_visuais) }) }], maxTokens: 3000, temperature: 0.85 });
  const copyTexts = parseJSON<any>(copyRaw, "Copywriter");
  console.log("✅ OK\n");

  // STEP 4
  console.log("═══ STEP 4: REFINER ═══");
  const refinerRaw = await callClaude({ system: REFINER_SYSTEM, messages: [{ role: "user", content: buildRefinerPrompt({ textos: JSON.stringify(copyTexts), estrategia: JSON.stringify(strategy) }) }], maxTokens: 3000, temperature: 0.5 });
  const refined = parseJSON<any>(refinerRaw, "Refiner");
  const finalTexts = refined.textos_refinados || copyTexts;
  console.log("✅ OK\n");

  // STEP 5
  console.log("═══ STEP 5: SCORER ═══");
  const scoreRaw = await callClaude({ system: SCORER_SYSTEM, messages: [{ role: "user", content: buildScorerPrompt({ textos: JSON.stringify(finalTexts), estrategia: JSON.stringify(strategy), produto: visionResult.produto.nome_generico, preco: price }) }], temperature: 0.3 });
  const score = parseJSON<any>(scoreRaw, "Scorer");
  console.log("✅ OK\n");

  const totalTime = ((Date.now() - startAll) / 1000).toFixed(1);

  // Salvar
  const result = { visionResult, strategy, copyTexts, refined: finalTexts, score, totalTimeMs: Date.now() - startAll };
  const outFile = path.resolve(process.cwd(), `test-result-foto2-${Date.now()}.json`);
  fs.writeFileSync(outFile, JSON.stringify(result, null, 2), "utf-8");
  console.log(`═══ TOTAL: ${totalTime}s | Nota: ${score.nota_geral}/100 ═══`);
  console.log(`📁 ${outFile}`);
}

main().catch(console.error);
