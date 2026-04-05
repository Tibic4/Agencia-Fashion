/**
 * Try-on do vestido laranja em uma modelo plus size do banco
 * Envia as 2 fotos (full + close) como product_image combinado
 */
import * as dotenv from "dotenv";
import * as path from "path";
import * as fs from "fs";

dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

const FASHN_API_URL = process.env.FASHN_API_URL || "https://api.fashn.ai/v1";
const FASHN_API_KEY = process.env.FASHN_API_KEY || "";

async function main() {
  // Foto do vestido (visão completa)
  const productPath = path.resolve(__dirname, "../test-images/vestido-laranja-full.jpg");
  const productBase64 = `data:image/jpeg;base64,${fs.readFileSync(productPath).toString("base64")}`;

  // Modelo do banco (plus size morena clara)
  const modelPath = path.resolve(__dirname, "../test-images/model-bank/plus_morena_clara.png");
  const modelBase64 = `data:image/png;base64,${fs.readFileSync(modelPath).toString("base64")}`;

  console.log("👗 Try-on: Vestido laranja → Modelo plus morena clara");
  console.log("📡 Endpoint: tryon-max\n");

  // Submit
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
        product_image: productBase64,
      },
    }),
  });

  if (!res.ok) {
    console.error(`❌ Erro: ${res.status} ${await res.text()}`);
    return;
  }

  const { id: jobId } = await res.json();
  console.log(`Job: ${jobId}`);

  // Poll
  for (let i = 0; i < 60; i++) {
    await new Promise(r => setTimeout(r, 2000));
    process.stdout.write(".");
    const status = await fetch(`${FASHN_API_URL}/status/${jobId}`, {
      headers: { Authorization: `Bearer ${FASHN_API_KEY}` },
    });
    const data = await status.json();

    if (data.status === "completed" && data.output?.[0]) {
      const url = data.output[0];
      console.log(`\n✅ Gerada: ${url}`);

      const imgRes = await fetch(url);
      const buf = Buffer.from(await imgRes.arrayBuffer());
      const outPath = path.resolve(__dirname, "../test-images/tryon-vestido-laranja-2fotos.png");
      fs.writeFileSync(outPath, buf);
      console.log(`📁 Salva: ${outPath}`);
      return;
    }
    if (data.status === "failed") {
      console.error(`\n❌ Falhou: ${JSON.stringify(data)}`);
      return;
    }
  }
  console.error("\n❌ Timeout");
}

main().catch(console.error);
