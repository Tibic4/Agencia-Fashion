/**
 * Teste batch — Fotos 3, 4 e 5
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

function parseJSON<T>(raw: string, step: string): T {
  let c = raw.trim();
  const m = c.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (m) c = m[1].trim();
  const f = c.indexOf("{"), l = c.lastIndexOf("}");
  if (f !== -1 && l !== -1) c = c.slice(f, l + 1);
  try { return JSON.parse(c) as T; }
  catch { console.error(`[${step}] JSON inválido:`, c.slice(0, 200)); throw new Error(`Parse falhou: ${step}`); }
}

const fotos = [
  {
    id: "foto3",
    nome: "Regata verde esmeralda + Saia midi bege com cinto fivela",
    loja: "Closet da Lu",
    preco: "99,90",
    objetivo: "Vender look completo verão",
    vision: {
      produto: { nome_generico: "Look regata verde esmeralda + saia midi bege com cinto de fivela redonda", categoria: "Looks Montados", subcategoria: "Midi" },
      segmento: "feminino",
      atributos_visuais: {
        cor_principal: "Verde esmeralda",
        cor_secundaria: "Bege areia",
        cores_complementares: ["Madeira (fivela do cinto)"],
        material_aparente: "Malha (regata) / Linho ou viscose (saia)",
        estampa: "Liso",
        detalhes: ["Regata sem manga cavada", "Saia midi evasê", "Cinto com fivela redonda de madeira/bambu", "Caimento fluido da saia"]
      },
      caimento: "solto",
      ocasiao_uso: ["casual", "passeio", "trabalho_criativo"],
      estacao: "primavera_verao",
      mood: ["feminino", "natural", "tropical", "elegante"],
      palavras_chave_venda: ["look montado", "saia midi", "verde esmeralda", "regata", "cinto fivela", "tendência 2026"]
    }
  },
  {
    id: "foto4",
    nome: "Macacão lilás com botões de madeira e amarração",
    loja: "Closet da Lu",
    preco: "129,90",
    objetivo: "Peça premium para ocasiões especiais",
    vision: {
      produto: { nome_generico: "Macacão feminino lilás/lavanda pantacourt com botões de madeira e amarração na cintura", categoria: "Macacões", subcategoria: "Pantacourt" },
      segmento: "feminino",
      atributos_visuais: {
        cor_principal: "Lilás lavanda",
        cor_secundaria: null,
        cores_complementares: ["Madeira (botões)"],
        material_aparente: "Linho ou viscolinho",
        estampa: "Liso",
        detalhes: ["Botões frontais de madeira", "Gola com colarinho", "Bolsos frontais funcionais", "Amarração na cintura com faixa", "Calça pantacourt (panturrilha)", "Sem manga"]
      },
      caimento: "semi-ajustado",
      ocasiao_uso: ["passeio", "trabalho", "evento_casual", "brunch"],
      estacao: "primavera_verao",
      mood: ["sofisticado", "feminino", "romântico", "tendência"],
      palavras_chave_venda: ["macacão feminino", "lilás lavanda", "botões madeira", "pantacourt", "peça única", "tendência 2026"]
    }
  },
  {
    id: "foto5",
    nome: "Cropped moletom caramelo + Short jeans bordado estrelas",
    loja: "Closet da Lu",
    preco: "119,90",
    objetivo: "Look jovem e descolado para redes sociais",
    vision: {
      produto: { nome_generico: "Look cropped moletom caramelo com pregas nas mangas + short jeans bordado de estrelas/flores", categoria: "Looks Montados", subcategoria: "Short" },
      segmento: "feminino",
      atributos_visuais: {
        cor_principal: "Caramelo/Marrom claro",
        cor_secundaria: "Azul jeans",
        cores_complementares: ["Branco (bordados)"],
        material_aparente: "Moletom (cropped) / Jeans (short)",
        estampa: "Liso (cropped) / Bordado estrelas (short)",
        detalhes: ["Cropped com gola alta/mock neck", "Mangas com pregas/franzidos", "Elástico na barra do cropped", "Short jeans com barra dobrada", "Bordados de estrelas/flores no short", "Botão e zíper frontal"]
      },
      caimento: "ajustado_cropped",
      ocasiao_uso: ["casual", "balada", "passeio", "encontro"],
      estacao: "meia_estacao",
      mood: ["jovem", "descolado", "urbano", "instagramável"],
      palavras_chave_venda: ["look montado", "cropped moletom", "short jeans bordado", "estrelas", "look instagram", "tendência 2026"]
    }
  }
];

async function runPipeline(foto: typeof fotos[0]) {
  const start = Date.now();
  console.log(`\n🔄 ${foto.id.toUpperCase()}: ${foto.nome}`);
  console.log(`   💰 R$ ${foto.preco} | 🎯 ${foto.objetivo}`);

  // Strategy
  process.stdout.write("   Step 2...");
  const stratRaw = await callClaude({ system: STRATEGY_SYSTEM, messages: [{ role: "user", content: buildStrategyPrompt({ produto: foto.vision.produto.nome_generico, preco: foto.preco, objetivo: foto.objetivo, atributos: JSON.stringify(foto.vision.atributos_visuais), segmento: foto.vision.segmento, mood: foto.vision.mood }) }], temperature: 0.8 });
  const strategy = parseJSON<any>(stratRaw, "Strategy");
  process.stdout.write(" ✅ Copy...");

  // Copy
  const copyRaw = await callClaude({ system: COPYWRITER_SYSTEM, messages: [{ role: "user", content: buildCopywriterPrompt({ produto: foto.vision.produto.nome_generico, preco: foto.preco, loja: foto.loja, estrategia: JSON.stringify(strategy), segmento: foto.vision.segmento, atributos: JSON.stringify(foto.vision.atributos_visuais) }) }], maxTokens: 3000, temperature: 0.85 });
  const copy = parseJSON<any>(copyRaw, "Copywriter");
  process.stdout.write(" ✅ Refine...");

  // Refine
  const refRaw = await callClaude({ system: REFINER_SYSTEM, messages: [{ role: "user", content: buildRefinerPrompt({ textos: JSON.stringify(copy), estrategia: JSON.stringify(strategy) }) }], maxTokens: 3000, temperature: 0.5 });
  const refined = parseJSON<any>(refRaw, "Refiner");
  const final = refined.textos_refinados || copy;
  process.stdout.write(" ✅ Score...");

  // Score
  const scoreRaw = await callClaude({ system: SCORER_SYSTEM, messages: [{ role: "user", content: buildScorerPrompt({ textos: JSON.stringify(final), estrategia: JSON.stringify(strategy), produto: foto.vision.produto.nome_generico, preco: foto.preco }) }], temperature: 0.3 });
  const score = parseJSON<any>(scoreRaw, "Scorer");

  const ms = Date.now() - start;
  console.log(` ✅ DONE! ${(ms/1000).toFixed(1)}s | Nota: ${score.nota_geral}/100`);

  return { visionResult: foto.vision, strategy, copyTexts: copy, refined: final, score, totalTimeMs: ms };
}

async function main() {
  console.log("\n╔══════════════════════════════════════════╗");
  console.log("║   🧪 Pipeline Batch — 3 FOTOS            ║");
  console.log("╚══════════════════════════════════════════╝");

  const allStart = Date.now();
  const results: Record<string, any> = {};

  for (const foto of fotos) {
    try {
      results[foto.id] = await runPipeline(foto);
    } catch (err) {
      console.error(`\n   ❌ ${foto.id} FALHOU:`, err);
      results[foto.id] = { error: String(err) };
    }
  }

  const totalSecs = ((Date.now() - allStart) / 1000).toFixed(1);

  // Summary
  console.log("\n\n═══════════════════════════════════");
  console.log("        📊 RESUMO BATCH");
  console.log("═══════════════════════════════════");
  for (const foto of fotos) {
    const r = results[foto.id];
    if (r.error) { console.log(`❌ ${foto.id}: ERRO`); continue; }
    console.log(`${foto.id} | ${r.score.nota_geral}/100 | Meta:${r.score.aprovacao_meta} | ${(r.totalTimeMs/1000).toFixed(0)}s | Risco:${r.score.nivel_risco}`);
  }
  console.log(`\n⏱ Total: ${totalSecs}s para 3 fotos`);

  // Save all
  const outFile = path.resolve(process.cwd(), `test-batch-${Date.now()}.json`);
  fs.writeFileSync(outFile, JSON.stringify(results, null, 2), "utf-8");
  console.log(`📁 ${outFile}`);
}

main().catch(console.error);
