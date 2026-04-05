/**
 * Teste de geração de 1 modelo com prompt otimizado para corpo inteiro
 */
import * as dotenv from "dotenv";
import * as path from "path";
import * as fs from "fs";

dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

const FASHN_API_URL = process.env.FASHN_API_URL || "https://api.fashn.ai/v1";
const FASHN_API_KEY = process.env.FASHN_API_KEY || "";

async function main() {
  const basePath = path.resolve(__dirname, "../test-images/white-tshirt-base.png");
  const baseBuffer = fs.readFileSync(basePath);
  const baseImage = `data:image/png;base64,${baseBuffer.toString("base64")}`;

  // Prompt otimizado: corpo inteiro, pés visíveis, shorts básico
  const prompt = "Full body photo from head to feet of a curvy plus size Brazilian woman, size 48-50, light brown skin, wavy dark hair, confident smile, standing relaxed, wearing plain white t-shirt and simple black cotton shorts, barefoot, showing full legs and feet, white studio background, fashion ecommerce photography, 9:16 vertical portrait";

  console.log("🧪 Teste: 1 modelo com prompt otimizado");
  console.log(`📝 Prompt: ${prompt.slice(0, 80)}...`);

  // Submit
  const res = await fetch(`${FASHN_API_URL}/run`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${FASHN_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model_name: "product-to-model",
      inputs: {
        product_image: baseImage,
        prompt,
        aspect_ratio: "9:16",
      },
    }),
  });

  if (!res.ok) {
    console.error(`❌ Erro: ${await res.text()}`);
    process.exit(1);
  }

  const { id: jobId } = await res.json();
  console.log(`📋 Job: ${jobId}`);

  // Poll
  for (let i = 0; i < 60; i++) {
    await new Promise(r => setTimeout(r, 2000));
    process.stdout.write(".");
    const poll = await fetch(`${FASHN_API_URL}/status/${jobId}`, {
      headers: { Authorization: `Bearer ${FASHN_API_KEY}` },
    });
    const data = await poll.json();

    if (data.status === "completed" && data.output?.[0]) {
      const url = data.output[0];
      console.log(`\n✅ Gerada: ${url}`);
      const imgRes = await fetch(url);
      const buf = Buffer.from(await imgRes.arrayBuffer());
      const out = path.resolve(__dirname, "../test-images/model-bank/teste-modelo-v2.png");
      if (!fs.existsSync(path.dirname(out))) fs.mkdirSync(path.dirname(out), { recursive: true });
      fs.writeFileSync(out, buf);
      console.log(`📁 Salva: ${out}`);
      return;
    }
    if (data.status === "failed") {
      console.error(`\n❌ Falhou: ${JSON.stringify(data)}`);
      process.exit(1);
    }
  }
}

main().catch(console.error);
