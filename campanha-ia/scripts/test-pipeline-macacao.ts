/**
 * Teste do pipeline completo com foto real
 * 
 * Testa: Vision → Strategy → Copy → Refiner → Scorer + Fashn product-to-model
 * 
 * Uso: npx tsx scripts/test-pipeline-macacao.ts
 */

import * as dotenv from "dotenv";
import * as path from "path";
import * as fs from "fs";

dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || "";
const FASHN_API_KEY = process.env.FASHN_API_KEY || "";

if (!ANTHROPIC_API_KEY) {
  console.error("❌ ANTHROPIC_API_KEY não encontrada");
  process.exit(1);
}

// ── Buscar a imagem (argumento ou imagem de teste) ──
const imagePath = process.argv[2] || path.resolve(__dirname, "../test-images/macacao-lilas.jpg");

if (!fs.existsSync(imagePath)) {
  console.error(`❌ Imagem não encontrada: ${imagePath}`);
  console.log("Coloque a foto em test-images/macacao-lilas.jpg ou passe o caminho como argumento");
  process.exit(1);
}

const imageBuffer = fs.readFileSync(imagePath);
const imageBase64 = imageBuffer.toString("base64");
const ext = path.extname(imagePath).replace(".", "");
const mediaType = `image/${ext === "jpg" ? "jpeg" : ext}` as "image/jpeg" | "image/png" | "image/webp";

console.log("🎯 Teste Pipeline Completo — Macacão Lilás");
console.log(`📁 Imagem: ${imagePath} (${(imageBuffer.length / 1024).toFixed(0)} KB)`);
console.log(`🔑 Anthropic: ${ANTHROPIC_API_KEY ? "✅" : "❌"}`);
console.log(`🔑 Fashn: ${FASHN_API_KEY ? "✅" : "❌"}`);
console.log("");

async function main() {
  const startTime = Date.now();

  // ═══════════════════════════════════════
  // 1. PIPELINE IA (Vision → Strategy → Copy → Refiner → Scorer)
  // ═══════════════════════════════════════
  console.log("═══════════════════════════════════════");
  console.log("🧠 PIPELINE IA");
  console.log("═══════════════════════════════════════");

  try {
    // Importar dinamicamente para pegar o env
    const { runCampaignPipeline } = await import("../src/lib/ai/pipeline");

    const result = await runCampaignPipeline(
      {
        imageBase64,
        mediaType,
        price: "129,90",
        objective: "venda_imediata",
        storeName: "Moda Bella Plus",
        targetAudience: "mulheres_25_45",
        storeSegment: "moda_feminina",
        bodyType: "plus_size",
        productType: "conjunto",
      },
      (step, label, progress) => {
        console.log(`  [${progress}%] ${step}: ${label}`);
      }
    );

    console.log("\n✅ Pipeline completo!");
    console.log(`⏱️ Duração: ${(result.durationMs / 1000).toFixed(1)}s`);

    // Exibir results
    console.log("\n── VISÃO ──");
    console.log(JSON.stringify(result.vision, null, 2).slice(0, 500));

    console.log("\n── ESTRATÉGIA ──");
    console.log(JSON.stringify(result.strategy, null, 2).slice(0, 500));

    console.log("\n── COPY (OUTPUT) ──");
    const output = result.output as any;
    if (output?.instagram) {
      console.log(`  📸 Caption: ${output.instagram.caption?.slice(0, 150)}...`);
      console.log(`  #️⃣ Hashtags: ${output.instagram.hashtags?.slice(0, 100)}...`);
    }
    if (output?.whatsapp) {
      console.log(`  💬 WhatsApp: ${output.whatsapp.message?.slice(0, 150)}...`);
    }

    console.log("\n── SCORE ──");
    console.log(JSON.stringify(result.score, null, 2).slice(0, 300));

    // Salvar resultado completo
    const outputDir = path.resolve(__dirname, "../test-images");
    fs.writeFileSync(
      path.join(outputDir, "pipeline-macacao-result.json"),
      JSON.stringify(result, null, 2)
    );
    console.log(`\n💾 Resultado salvo em test-images/pipeline-macacao-result.json`);

  } catch (err) {
    console.error("❌ Pipeline falhou:", err);
  }

  // ═══════════════════════════════════════
  // 2. FASHN (Product-to-Model + Edit)
  // ═══════════════════════════════════════
  if (FASHN_API_KEY) {
    console.log("\n\n═══════════════════════════════════════");
    console.log("👗 FASHN — Product-to-Model + Edit");
    console.log("═══════════════════════════════════════");

    try {
      const { generateModelImage } = await import("../src/lib/fashn/client");

      // Converter para data URI
      const dataUri = `data:${mediaType};base64,${imageBase64}`;
      console.log("  📤 Enviando para Fashn (product-to-model)...");
      const fashnStart = Date.now();

      const result = await generateModelImage(dataUri, "branco");
      const fashnDuration = ((Date.now() - fashnStart) / 1000).toFixed(1);

      console.log(`  ⏱️ Duração Fashn: ${fashnDuration}s`);
      console.log(`  Status: ${result.status}`);

      if (result.status === "completed" && result.outputUrl) {
        console.log(`  ✅ Imagem gerada: ${result.outputUrl}`);

        // Download da imagem
        try {
          const imgRes = await fetch(result.outputUrl);
          const imgBuf = Buffer.from(await imgRes.arrayBuffer());
          const outPath = path.resolve(__dirname, "../test-images/macacao-modelo-gerada.png");
          fs.writeFileSync(outPath, imgBuf);
          console.log(`  📁 Salva em: test-images/macacao-modelo-gerada.png`);
        } catch {
          console.warn("  ⚠️ Falha ao baixar imagem");
        }
      } else {
        console.log(`  ❌ Falhou: ${result.error || "Status: " + result.status}`);
      }
    } catch (err) {
      console.error("  ❌ Fashn falhou:", err);
    }
  }

  const totalDuration = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n\n🏁 Teste completo em ${totalDuration}s`);
}

main().catch(console.error);
