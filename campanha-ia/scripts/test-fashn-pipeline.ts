import * as dotenv from "dotenv";
import * as path from "path";
import * as fs from "fs";

dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

const FASHN_API_URL = process.env.FASHN_API_URL || "https://api.fashn.ai/v1";
const FASHN_API_KEY = process.env.FASHN_API_KEY || "";

async function submitJob(modelName: string, inputs: Record<string, unknown>): Promise<string> {
  const res = await fetch(`${FASHN_API_URL}/run`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${FASHN_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model_name: modelName, inputs }),
  });

  if (!res.ok) {
    const error = await res.text();
    throw new Error(`Fashn ${modelName} error (${res.status}): ${error}`);
  }

  const job = await res.json();
  console.log(`  📋 Job ID: ${job.id}`);
  return job.id;
}

async function pollResult(jobId: string, maxSeconds = 180): Promise<{ status: string; outputUrl: string | null }> {
  const maxAttempts = Math.floor(maxSeconds / 3);

  for (let i = 0; i < maxAttempts; i++) {
    await new Promise((r) => setTimeout(r, 3000));

    const res = await fetch(`${FASHN_API_URL}/status/${jobId}`, {
      headers: { Authorization: `Bearer ${FASHN_API_KEY}` },
    });

    if (!res.ok) continue;
    const data = await res.json();

    if (i % 5 === 0) console.log(`  ⏳ ${data.status}... (${i * 3}s)`);

    if (data.status === "completed") {
      return { status: "completed", outputUrl: data.output?.[0] || data.output_url || null };
    }
    if (data.status === "failed") {
      console.error(`  ❌ Failed:`, data.error);
      return { status: "failed", outputUrl: null };
    }
  }
  return { status: "timeout", outputUrl: null };
}

async function downloadImage(url: string, outputPath: string): Promise<void> {
  const res = await fetch(url);
  const buf = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(outputPath, buf);
  console.log(`  💾 Salvo: ${outputPath} (${(buf.length / 1024).toFixed(0)}KB)`);
}

async function main() {
  if (!FASHN_API_KEY) {
    console.error("❌ FASHN_API_KEY não configurada no .env.local");
    return;
  }

  console.log("🔧 Fashn Pipeline Test — Moletom + Short Jeans Bordado");
  console.log("=" .repeat(55));

  // Converter imagem para base64 data URI
  const imgBuf = fs.readFileSync("test-images/conjunto-moletom-jeans.jpg");
  const base64 = imgBuf.toString("base64");
  const dataUri = `data:image/jpeg;base64,${base64}`;
  console.log(`📸 Imagem carregada: ${(imgBuf.length / 1024).toFixed(0)}KB`);

  const startTime = Date.now();

  // ═══════════════════════════════════════
  // ETAPA 1: Product-to-Model
  // ═══════════════════════════════════════
  console.log("\n🧍 ETAPA 1: product-to-model (gerar modelo vestindo a peça)...");
  const step1Start = Date.now();

  const jobId1 = await submitJob("product-to-model", {
    product_image: dataUri,
    prompt: `Full body photo from head to feet of a Slim/standard Brazilian woman (P/M sizing, US 4-8). Slim athletic build. DO NOT generate plus-size body. Confident natural smile, relaxed standing pose. White studio background, fashion e-commerce photography. CRITICAL: Reproduce the garment EXACTLY as shown — preserve every detail: embroidery count and spacing (EXACTLY 5-6 star embroideries on the shorts, SPARSE not dense), fabric texture, elastic bands, smocking, ruffles, buttons, tags, folded hems, ribbed cuffs with 3 pleats on the sweatshirt sleeves. Do NOT add or remove any decorative elements. Must be wearing stylish white sneakers (NEVER barefoot).`,
    aspect_ratio: "9:16",
  });

  const result1 = await pollResult(jobId1);
  console.log(`  ✅ Step 1: ${((Date.now() - step1Start) / 1000).toFixed(1)}s — ${result1.status}`);

  if (result1.status !== "completed" || !result1.outputUrl) {
    console.error("❌ Falha na etapa 1");
    return;
  }

  await downloadImage(result1.outputUrl, "test-images/fashn-step1-model.png");

  // ═══════════════════════════════════════
  // ETAPA 2: Edit (alisar + fundo branco)
  // ═══════════════════════════════════════
  console.log("\n✨ ETAPA 2: edit (alisar roupa + fundo profissional)...");
  const step2Start = Date.now();

  const jobId2 = await submitJob("edit", {
    image: result1.outputUrl,
    prompt: "Professional fashion e-commerce photo in clean white studio. CRITICAL: Preserve ALL garment details exactly — embroidery count (keep EXACTLY the same number of star embroideries), fabric texture, elastic bands, ribbed cuffs, folded hems, buttons, tags. Smooth fabric without unnatural wrinkles. Remove any mannequin parts, stands, poles, or dark artifacts completely. Clean natural skin on legs and arms with consistent skin tone. Soft studio lighting with subtle shadows. Full body visible from head to feet including shoes.",
  });

  const result2 = await pollResult(jobId2);
  console.log(`  ✅ Step 2: ${((Date.now() - step2Start) / 1000).toFixed(1)}s — ${result2.status}`);

  if (result2.status !== "completed" || !result2.outputUrl) {
    console.error("❌ Falha na etapa 2");
    return;
  }

  await downloadImage(result2.outputUrl, "test-images/fashn-step2-final.png");

  const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n🎯 PIPELINE FASHN COMPLETO!`);
  console.log(`⏱️ Total: ${totalTime}s`);
  console.log(`📁 Step 1: test-images/fashn-step1-model.png`);
  console.log(`📁 Step 2: test-images/fashn-step2-final.png`);
}

main().catch(console.error);
