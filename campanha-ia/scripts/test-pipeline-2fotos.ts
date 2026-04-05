/**
 * Teste do pipeline com 2 fotos: visão geral + close-up tecido
 * Vestido laranja canelado
 */
import * as dotenv from "dotenv";
import * as path from "path";
import * as fs from "fs";

dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

import { runCampaignPipeline } from "../src/lib/ai/pipeline";

async function main() {
  // Foto 1: visão geral do vestido
  const fullPath = path.resolve(__dirname, "../test-images/vestido-laranja-full.jpg");
  // Foto 2: close-up do tecido
  const closePath = path.resolve(__dirname, "../test-images/vestido-laranja-close.jpg");

  const fullBase64 = fs.readFileSync(fullPath).toString("base64");
  const closeBase64 = fs.readFileSync(closePath).toString("base64");

  console.log("🧪 Pipeline com 2 FOTOS: visão geral + close-up tecido");
  console.log("📸 Vestido laranja canelado com argola\n");

  const result = await runCampaignPipeline(
    {
      imageBase64: fullBase64,
      mediaType: "image/jpeg",
      extraImages: [
        { base64: closeBase64, mediaType: "image/jpeg" },
      ],
      price: "R$ 89,90",
      objective: "vender_mais",
      storeName: "Moda Fashion Store",
      productType: "vestido",
      // SEM material - queremos que a IA identifique sozinha com a foto close-up
    },
    (step, label, progress) => {
      console.log(`  [${progress}%] ${step}: ${label}`);
    },
  );

  // Output completo
  console.log("\n═══════════════════════════════════════");
  console.log("📊 RESULTADO COMPLETO");
  console.log("═══════════════════════════════════════\n");

  // Vision
  console.log("🔍 VISION:");
  console.log(`  Produto: ${result.vision?.produto?.nome_generico}`);
  console.log(`  Material: ${result.vision?.atributos_visuais?.material_aparente}`);
  console.log(`  Cor: ${result.vision?.atributos_visuais?.cor_principal}`);
  console.log(`  Estampa: ${result.vision?.atributos_visuais?.estampa}`);
  console.log(`  Detalhes: ${JSON.stringify(result.vision?.atributos_visuais?.detalhes)}`);

  // Copy
  console.log("\n📝 COPY:");
  console.log(`  Headline: ${result.output?.headline}`);
  console.log(`  Legenda: ${result.output?.legenda?.slice(0, 200)}...`);

  // Score
  console.log("\n⭐ SCORE:");
  console.log(`  Total: ${result.score?.nota_geral}/10`);

  console.log(`\n⏱️ Tempo: ${result.durationMs}ms`);

  // Salvar JSON completo
  const outPath = path.resolve(__dirname, "../test-images/pipeline-vestido-laranja-2fotos.json");
  fs.writeFileSync(outPath, JSON.stringify(result, null, 2));
  console.log(`📁 JSON salvo: ${outPath}`);
}

main().catch(console.error);
