/**
 * Try-on: Conjunto moletinho marrom na modelo plus size
 */
import * as dotenv from "dotenv";
import * as path from "path";
import * as fs from "fs";

dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

const FASHN_API_URL = process.env.FASHN_API_URL || "https://api.fashn.ai/v1";
const FASHN_API_KEY = process.env.FASHN_API_KEY || "";

async function main() {
  // Imagens
  const garmentPath = path.resolve(__dirname, "../test-images/conjunto-moletinho.jpg");
  const modelPath = path.resolve(__dirname, "../test-images/model-bank/plus_size_negra_standing_confident.png");

  const garmentBase64 = `data:image/jpeg;base64,${fs.readFileSync(garmentPath).toString("base64")}`;
  const modelBase64 = `data:image/png;base64,${fs.readFileSync(modelPath).toString("base64")}`;

  console.log("👗 Try-On: Conjunto moletinho → Modelo plus size negra");
  console.log("📤 Enviando para Fashn...\n");

  // Submit try-on job
  const res = await fetch(`${FASHN_API_URL}/run`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${FASHN_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model_name: "tryon-max",
      inputs: {
        model_image: modelBase64,
        product_image: garmentBase64,
      },
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error(`❌ Submit error (${res.status}): ${err}`);
    process.exit(1);
  }

  const { id: jobId } = await res.json();
  console.log(`📋 Job ID: ${jobId}`);

  // Poll for result
  for (let i = 0; i < 60; i++) {
    await new Promise(r => setTimeout(r, 2000));
    process.stdout.write(".");

    const poll = await fetch(`${FASHN_API_URL}/status/${jobId}`, {
      headers: { Authorization: `Bearer ${FASHN_API_KEY}` },
    });
    const data = await poll.json();

    if (data.status === "completed" && data.output?.[0]) {
      const resultUrl = data.output[0];
      console.log(`\n\n✅ Try-on concluído!`);
      console.log(`🖼️ URL: ${resultUrl}`);

      // Download
      const imgRes = await fetch(resultUrl);
      const buffer = Buffer.from(await imgRes.arrayBuffer());
      const outPath = path.resolve(__dirname, "../test-images/tryon-conjunto-moletinho.png");
      fs.writeFileSync(outPath, buffer);
      console.log(`📁 Salvo: ${outPath}`);
      return;
    }

    if (data.status === "failed") {
      console.error(`\n❌ Falhou: ${JSON.stringify(data)}`);
      process.exit(1);
    }
  }

  console.error("\n❌ Timeout");
  process.exit(1);
}

main().catch(console.error);
