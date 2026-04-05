/**
 * Teste Fashn.ai — Virtual Try-On
 * Pega a foto do produto + foto de modelo genérica e testa o try-on
 * 
 * Uso: npx tsx scripts/test-fashn-tryon.ts <caminho-da-foto>
 */
import * as path from "path";
import * as fs from "fs";
import * as dotenv from "dotenv";
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const FASHN_API_KEY = process.env.FASHN_API_KEY || "";
const FASHN_API_URL = process.env.FASHN_API_URL || "https://api.fashn.ai/v1";

// Modelo genérica pública para teste (mulher de corpo inteiro, fundo branco)
const MODEL_IMAGE_URL = "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=512&h=768&fit=crop";

async function uploadToTmpHost(filePath: string): Promise<string> {
  // Use tmpfiles.org como host temporário grátis
  const form = new FormData();
  const fileBuffer = fs.readFileSync(filePath);
  const blob = new Blob([fileBuffer], { type: "image/jpeg" });
  form.append("file", blob, path.basename(filePath));

  const res = await fetch("https://tmpfiles.org/api/v1/upload", {
    method: "POST",
    body: form,
  });
  
  if (!res.ok) throw new Error(`Upload falhou: ${res.status}`);
  const data = await res.json();
  // tmpfiles.org retorna URL como https://tmpfiles.org/XXXXX/file.jpg
  // Para download direto, trocar por https://tmpfiles.org/dl/XXXXX/file.jpg
  const url = data.data?.url?.replace("tmpfiles.org/", "tmpfiles.org/dl/") || data.data?.url;
  return url;
}

async function main() {
  const imagePath = process.argv[2];
  
  if (!imagePath) {
    console.error("❌ Uso: npx tsx scripts/test-fashn-tryon.ts <foto-do-produto>");
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

  console.log("\n╔══════════════════════════════════════════╗");
  console.log("║   👗 CriaLook — Teste Virtual Try-On     ║");
  console.log("╚══════════════════════════════════════════╝\n");

  // 1. Upload da foto para URL pública temporária
  console.log("📤 Fazendo upload da foto...");
  let garmentUrl: string;
  try {
    garmentUrl = await uploadToTmpHost(fullPath);
    console.log(`✅ Upload OK: ${garmentUrl}\n`);
  } catch (err) {
    console.error("❌ Falha no upload:", err);
    process.exit(1);
  }

  // 2. Chamar Fashn.ai Try-On
  console.log("🧪 Iniciando Virtual Try-On via Fashn.ai...");
  console.log(`  📸 Garment: ${garmentUrl}`);
  console.log(`  🧑 Model: ${MODEL_IMAGE_URL}\n`);

  const createRes = await fetch(`${FASHN_API_URL}/run`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${FASHN_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model_image: MODEL_IMAGE_URL,
      garment_image: garmentUrl,
      category: "one-pieces", // conjunto = one-piece
    }),
  });

  if (!createRes.ok) {
    const err = await createRes.text();
    console.error(`❌ Fashn.ai erro: ${createRes.status}\n${err}`);
    process.exit(1);
  }

  const job = await createRes.json();
  console.log(`✅ Job criado: ${job.id}`);

  // 3. Polling
  console.log("⏳ Aguardando resultado...");
  const maxAttempts = 60;
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise(r => setTimeout(r, 3000));
    process.stdout.write(`\r  Tentativa ${i + 1}/${maxAttempts}...`);

    const statusRes = await fetch(`${FASHN_API_URL}/status/${job.id}`, {
      headers: { Authorization: `Bearer ${FASHN_API_KEY}` },
    });

    if (!statusRes.ok) continue;
    const status = await statusRes.json();

    if (status.status === "completed") {
      const outputUrl = status.output?.[0] || status.output_url;
      console.log(`\n\n✅ TRY-ON COMPLETO!`);
      console.log(`📸 Resultado: ${outputUrl}`);

      // Download do resultado
      if (outputUrl) {
        const imgRes = await fetch(outputUrl);
        const imgBuffer = Buffer.from(await imgRes.arrayBuffer());
        const outputPath = path.resolve(process.cwd(), `tryon-result-${Date.now()}.png`);
        fs.writeFileSync(outputPath, imgBuffer);
        console.log(`💾 Salvo em: ${outputPath}`);
      }
      return;
    }

    if (status.status === "failed") {
      console.log(`\n\n❌ TRY-ON FALHOU`);
      console.log(JSON.stringify(status, null, 2));
      return;
    }
  }

  console.log("\n⚠️ Timeout — job ainda processando");
}

main().catch(console.error);
