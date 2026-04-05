/**
 * Script de teste do Fashn.ai Virtual Try-On
 * Uso: npx tsx scripts/test-fashn-tryon-real.ts <caminho-da-foto-roupa>
 * 
 * Pega a foto da roupa, envia para Fashn.ai com um modelo padrão e salva o resultado.
 */
import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const FASHN_API_URL = process.env.FASHN_API_URL || "https://api.fashn.ai/v1";
const FASHN_API_KEY = process.env.FASHN_API_KEY || "";

// Modelo feminina full-body para try-on (foto corpo inteiro, pose neutra)
const DEFAULT_MODEL_IMAGE = "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=768&h=1024&fit=crop&crop=top";

async function main() {
  const imagePath = process.argv[2];

  if (!imagePath) {
    console.error("❌ Uso: npx tsx scripts/test-fashn-tryon-real.ts <foto-roupa.jpg>");
    process.exit(1);
  }

  if (!FASHN_API_KEY) {
    console.error("❌ FASHN_API_KEY não encontrada no .env.local");
    process.exit(1);
  }

  const fullPath = path.resolve(imagePath);
  if (!fs.existsSync(fullPath)) {
    console.error(`❌ Arquivo não encontrado: ${fullPath}`);
    process.exit(1);
  }

  // Lê imagem e converte para base64 data URI
  const imageBuffer = fs.readFileSync(fullPath);
  const ext = path.extname(fullPath).toLowerCase();
  const mimeType = ext === ".png" ? "image/png" : ext === ".webp" ? "image/webp" : "image/jpeg";
  const garmentBase64 = `data:${mimeType};base64,${imageBuffer.toString("base64")}`;

  console.log("\n╔══════════════════════════════════════╗");
  console.log("║  👗 Fashn.ai — Virtual Try-On Test   ║");
  console.log("╚══════════════════════════════════════╝\n");
  console.log(`📸 Roupa: ${path.basename(fullPath)} (${(imageBuffer.length / 1024).toFixed(0)}KB)`);
  console.log(`🧍 Modelo: Stock model (Unsplash)`);
  console.log(`🔑 API Key: ${FASHN_API_KEY.substring(0, 10)}...`);
  console.log("\n⏳ Enviando para Fashn.ai...\n");

  const startTime = Date.now();

  try {
    // 1. Criar job de try-on
    const createRes = await fetch(`${FASHN_API_URL}/run`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${FASHN_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model_name: "product-to-model",
        inputs: {
          product_image: garmentBase64,
        },
        return_base64: true,
      }),
    });

    if (!createRes.ok) {
      const errText = await createRes.text();
      console.error(`❌ Erro ao criar job: ${createRes.status}`);
      console.error(errText);
      process.exit(1);
    }

    const job = await createRes.json();
    console.log(`✅ Job criado: ${job.id}`);
    console.log("⏳ Aguardando processamento...\n");

    // 2. Polling
    const maxAttempts = 60;
    for (let i = 0; i < maxAttempts; i++) {
      await new Promise((r) => setTimeout(r, 2000));

      const statusRes = await fetch(`${FASHN_API_URL}/status/${job.id}`, {
        headers: { Authorization: `Bearer ${FASHN_API_KEY}` },
      });

      if (!statusRes.ok) {
        process.stdout.write(".");
        continue;
      }

      const status = await statusRes.json();
      process.stdout.write(`\r  Status: ${status.status} (${((i + 1) * 2)}s)`);

      if (status.status === "completed") {
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        console.log(`\n\n✅ CONCLUÍDO em ${elapsed}s!\n`);

        // Salvar resultado
        const outputData = status.output?.[0] || status.output_url || status.output;
        
        if (outputData && typeof outputData === "string") {
          if (outputData.startsWith("data:")) {
            // Base64 output - salvar como imagem
            const base64Data = outputData.split(",")[1];
            const outputPath = fullPath.replace(/\.\w+$/, "-tryon.png");
            fs.writeFileSync(outputPath, Buffer.from(base64Data, "base64"));
            console.log(`📁 Imagem salva: ${outputPath}`);
            
            // Copiar para artifacts
            const artifactPath = path.resolve(
              "C:/Users/bicag/.gemini/antigravity/brain/f711445c-5a4a-4db7-8f30-6f0b5961d00c",
              `tryon_${path.basename(fullPath, path.extname(fullPath))}.png`
            );
            fs.writeFileSync(artifactPath, Buffer.from(base64Data, "base64"));
            console.log(`📁 Artifact: ${artifactPath}`);
          } else if (outputData.startsWith("http")) {
            // URL output - download
            console.log(`🔗 URL resultado: ${outputData}`);
            const imgRes = await fetch(outputData);
            if (imgRes.ok) {
              const imgBuffer = Buffer.from(await imgRes.arrayBuffer());
              const outputPath = fullPath.replace(/\.\w+$/, "-tryon.png");
              fs.writeFileSync(outputPath, imgBuffer);
              console.log(`📁 Imagem salva: ${outputPath}`);
              
              // Copiar para artifacts
              const artifactPath = path.resolve(
                "C:/Users/bicag/.gemini/antigravity/brain/f711445c-5a4a-4db7-8f30-6f0b5961d00c",
                `tryon_${path.basename(fullPath, path.extname(fullPath))}.png`
              );
              fs.writeFileSync(artifactPath, imgBuffer);
              console.log(`📁 Artifact: ${artifactPath}`);
            }
          }
        } else {
          console.log("📄 Response completa:");
          console.log(JSON.stringify(status, null, 2));
        }
        
        process.exit(0);
      }

      if (status.status === "failed") {
        console.log("\n\n❌ FALHOU!");
        console.log(JSON.stringify(status, null, 2));
        process.exit(1);
      }
    }

    console.log("\n\n⏰ TIMEOUT — job ainda processando");
    process.exit(1);

  } catch (error) {
    console.error("\n❌ ERRO:", error);
    process.exit(1);
  }
}

main();
