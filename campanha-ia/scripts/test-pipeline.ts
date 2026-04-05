/**
 * Script de teste do pipeline de IA
 * Uso: npx tsx scripts/test-pipeline.ts <caminho-da-imagem>
 * 
 * Testa o pipeline completo com dados aleatórios de loja.
 */
import * as fs from "fs";
import * as path from "path";

// Dados aleatórios para simular entrada real
const LOJAS = [
  "Bella Donna Fashion", "Maria Elegance", "Closet da Lu",
  "Estilo Único", "Boutique Sabrina", "Espaço Fashion",
  "Ana Paula Modas", "Vitrine Feminina", "Look Perfeito",
];

const OBJETIVOS = [
  "Vender rápido esta peça", "Lançar coleção nova",
  "Queimar estoque parado", "Atrair novas clientes",
  "Promover peça-chave da semana", "Campanha de Dia das Mães",
];

const PRECOS = [
  "39,90", "49,90", "69,90", "89,90", "99,90",
  "119,90", "149,90", "179,90", "199,90", "249,90",
];

const PUBLICOS = [
  "Mulheres 25-40, classe B/C, compram pelo Instagram",
  "Mulheres 18-30, universitárias, moda acessível",
  "Mulheres 35-55, classe B, elegância no dia a dia",
  undefined, // auto-detectar
];

const SEGMENTOS = [
  "Moda feminina", "Plus size", "Moda casual", undefined,
];

function random<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

async function main() {
  const imagePath = process.argv[2];
  
  if (!imagePath) {
    console.error("❌ Uso: npx tsx scripts/test-pipeline.ts <caminho-da-imagem>");
    console.error("   Exemplo: npx tsx scripts/test-pipeline.ts ./fotos/vestido.jpg");
    process.exit(1);
  }

  // Verifica se imagem existe
  const fullPath = path.resolve(imagePath);
  if (!fs.existsSync(fullPath)) {
    console.error(`❌ Arquivo não encontrado: ${fullPath}`);
    process.exit(1);
  }

  // Verifica API key
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("❌ ANTHROPIC_API_KEY não encontrada no .env.local");
    console.error("   Configure: echo ANTHROPIC_API_KEY=sk-ant-... >> .env.local");
    process.exit(1);
  }

  // Lê e converte imagem
  const imageBuffer = fs.readFileSync(fullPath);
  const imageBase64 = imageBuffer.toString("base64");
  const ext = path.extname(fullPath).toLowerCase();
  const mediaType = ext === ".png" ? "image/png"
    : ext === ".webp" ? "image/webp"
    : "image/jpeg";

  // Dados aleatórios para teste
  const input = {
    imageBase64,
    mediaType: mediaType as "image/jpeg" | "image/png" | "image/webp",
    price: random(PRECOS),
    objective: random(OBJETIVOS),
    storeName: random(LOJAS),
    targetAudience: random(PUBLICOS),
    storeSegment: random(SEGMENTOS),
  };

  console.log("\n╔══════════════════════════════════════╗");
  console.log("║   🧪 CriaLook — Teste do Pipeline    ║");
  console.log("╚══════════════════════════════════════╝\n");
  console.log(`📸 Imagem: ${path.basename(fullPath)} (${(imageBuffer.length / 1024).toFixed(0)}KB)`);
  console.log(`🏪 Loja: ${input.storeName}`);
  console.log(`💰 Preço: R$ ${input.price}`);
  console.log(`🎯 Objetivo: ${input.objective}`);
  console.log(`👥 Público: ${input.targetAudience || "auto-detectar"}`);
  console.log(`📦 Segmento: ${input.storeSegment || "auto-detectar"}`);
  console.log("\n─────────────────────────────────────────\n");

  // Importa pipeline (precisa de dotenv para pegar ANTHROPIC_API_KEY)
  const dotenv = await import("dotenv");
  dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

  const { runCampaignPipeline } = await import("../src/lib/ai/pipeline");

  const startTime = Date.now();

  try {
    const result = await runCampaignPipeline(input, (step, label, progress) => {
      const bar = "█".repeat(Math.floor(progress / 5)) + "░".repeat(20 - Math.floor(progress / 5));
      process.stdout.write(`\r  [${bar}] ${progress}% — ${label}`);
    });

    console.log("\n\n═══════════════════════════════════════");
    console.log("  ✅ PIPELINE CONCLUÍDO");
    console.log(`  ⏱  ${(result.durationMs / 1000).toFixed(1)}s`);
    console.log(`  💰 Custo: R$ ${result.costBreakdown.reduce((s, c) => s + c.estimatedCostBrl, 0).toFixed(2)}`);
    console.log("═══════════════════════════════════════\n");

    // 1. Vision
    console.log("📸 VISION ANALYSIS:");
    console.log(JSON.stringify(result.vision, null, 2));

    // 2. Strategy
    console.log("\n🎯 STRATEGY:");
    console.log(JSON.stringify(result.strategy, null, 2));

    // 3. Output (textos)
    console.log("\n📝 TEXTOS GERADOS:");
    console.log("─ Headline:", result.output.headline_principal);
    if (result.output.headline_variacao_1) console.log("─ Variação 1:", result.output.headline_variacao_1);
    if (result.output.headline_variacao_2) console.log("─ Variação 2:", result.output.headline_variacao_2);
    console.log("\n─── Instagram Feed ───");
    console.log(result.output.instagram_feed);
    console.log("\n─── Instagram Stories ───");
    const stories = result.output.instagram_stories as any;
    if (stories) {
      console.log("  Slide 1:", stories.slide_1);
      console.log("  Slide 2:", stories.slide_2);
      console.log("  Slide 3:", stories.slide_3);
      console.log("  CTA:", stories.cta_final);
    }
    console.log("\n─── WhatsApp ───");
    console.log(result.output.whatsapp);
    console.log("\n─── Meta Ads ───");
    const ads = result.output.meta_ads as any;
    if (ads) {
      console.log("  Título:", ads.titulo);
      console.log("  Texto:", ads.texto_principal);
      console.log("  Descrição:", ads.descricao);
      console.log("  CTA Button:", ads.cta_button);
    }
    console.log("\n─── Hashtags ───");
    console.log((result.output.hashtags || []).map((h: string) => `#${h}`).join(" "));

    // 4. Score
    console.log("\n\n⭐ SCORE:");
    const sc = result.score as any;
    console.log(`  Nota Geral: ${sc.nota_geral}/100`);
    console.log(`  Conversão: ${sc.conversao}/100`);
    console.log(`  Clareza: ${sc.clareza}/100`);
    console.log(`  Urgência: ${sc.urgencia}/100`);
    console.log(`  Naturalidade: ${sc.naturalidade}/100`);
    console.log(`  Aprovação Meta: ${sc.aprovacao_meta}/100`);
    if (sc.criatividade) console.log(`  Criatividade: ${sc.criatividade}/100`);
    console.log(`  Risco: ${sc.nivel_risco}`);
    if (sc.previsao_engajamento) console.log(`  Engajamento: ${sc.previsao_engajamento}`);
    console.log(`\n  📋 Resumo: ${sc.resumo}`);

    if (result.score.pontos_fortes?.length) {
      console.log("\n  ✅ Pontos fortes:");
      result.score.pontos_fortes.forEach((p: string) => console.log(`     • ${p}`));
    }

    if (result.score.melhorias?.length) {
      console.log("\n  🔧 Melhorias sugeridas:");
      (result.score.melhorias as any[]).forEach((m: any) =>
        console.log(`     • [${m.impacto}] ${m.campo}: ${m.sugestao}`)
      );
    }

    if (result.score.alertas_meta?.length) {
      console.log("\n  ⚠️ Alertas Meta Ads:");
      (result.score.alertas_meta as any[]).forEach((a: any) =>
        console.log(`     • [${a.nivel}] "${a.trecho}" → ${a.correcao}`)
      );
    }

    // 5. Refinamentos
    if (result.output.refinements?.length) {
      console.log("\n\n🔄 REFINAMENTOS APLICADOS:");
      result.output.refinements.forEach((r: any) =>
        console.log(`  • ${r.campo}: ${r.motivo}`)
      );
    }

    // 6. Custos por etapa
    console.log("\n\n💰 CUSTOS POR ETAPA:");
    result.costBreakdown.forEach((c) => {
      console.log(`  ${c.step}: R$ ${c.estimatedCostBrl.toFixed(2)} (${c.model}, ${(c.durationMs / 1000).toFixed(1)}s)`);
    });

    // Salvar resultado em arquivo
    const outputFile = path.resolve(process.cwd(), `test-result-${Date.now()}.json`);
    fs.writeFileSync(outputFile, JSON.stringify(result, null, 2), "utf-8");
    console.log(`\n📁 Resultado salvo em: ${outputFile}`);

  } catch (error) {
    console.error("\n\n❌ PIPELINE FALHOU:");
    console.error(error);
    process.exit(1);
  }
}

main();
