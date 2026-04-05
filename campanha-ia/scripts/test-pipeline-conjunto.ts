/**
 * Teste pipeline completo — Conjunto moletinho marrom
 * Com material informado pelo usuário
 */
import * as dotenv from "dotenv";
import * as path from "path";
import * as fs from "fs";

dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

import { runCampaignPipeline } from "../src/lib/ai/pipeline";

async function main() {
  const imagePath = path.resolve(__dirname, "../test-images/conjunto-moletinho.jpg");
  if (!fs.existsSync(imagePath)) {
    console.error("❌ Imagem não encontrada:", imagePath);
    process.exit(1);
  }

  const imageBuffer = fs.readFileSync(imagePath);
  const imageBase64 = imageBuffer.toString("base64");

  console.log("🎯 Teste Pipeline Completo — Conjunto Moletinho");
  console.log(`📸 Imagem: conjunto-moletinho.jpg (${(imageBuffer.length / 1024).toFixed(0)}KB)`);
  console.log("📦 Tipo: conjunto | Material: moletinho\n");

  const result = await runCampaignPipeline(
    {
      imageBase64,
      mediaType: "image/jpeg",
      price: "119,90",
      objective: "venda_imediata",
      storeName: "Moda Plus Bella",
      storeSegment: "plus_size",
      bodyType: "plus_size",
      productType: "conjunto",
      material: "moletinho",
    },
    (step, label, progress) => {
      process.stdout.write(`\r  [${progress}%] ${step}: ${label}`.padEnd(60));
    }
  );

  console.log("\n\n✅ Pipeline concluído!\n");

  // Salvar resultado
  const outputPath = path.resolve(__dirname, "../test-images/pipeline-conjunto-result.json");
  fs.writeFileSync(outputPath, JSON.stringify(result, null, 2));
  console.log(`📁 Resultado salvo: ${outputPath}`);

  // Resumo
  console.log("\n═══════════════════════════════════════");
  console.log("📊 RESUMO");
  console.log("═══════════════════════════════════════");
  console.log(`Produto: ${result.vision?.produto?.nome_generico}`);
  console.log(`Cor: ${result.vision?.atributos_visuais?.cor_principal}`);
  console.log(`Material: ${result.vision?.atributos_visuais?.material_aparente}`);
  console.log(`Score: ${result.score?.nota_geral}/100`);
  console.log(`Duração: ${(result.durationMs / 1000).toFixed(1)}s`);
  console.log(`Custo: R$ ${result.costBreakdown?.reduce((a: number, c: { estimatedCostBrl: number }) => a + c.estimatedCostBrl, 0).toFixed(2)}`);
}

main().catch(console.error);
