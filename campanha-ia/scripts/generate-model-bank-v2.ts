/**
 * Gera 19 modelos: 9 plus size + 10 normais
 * Corpo inteiro (head to feet), shorts preto, fundo branco
 * Gera UMA por vez e mostra o resultado
 */
import * as dotenv from "dotenv";
import * as path from "path";
import * as fs from "fs";

dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

const FASHN_API_URL = process.env.FASHN_API_URL || "https://api.fashn.ai/v1";
const FASHN_API_KEY = process.env.FASHN_API_KEY || "";
const OUT_DIR = path.resolve(__dirname, "../test-images/model-bank");

// ══════════════════════════════
// Definições das modelos
// ══════════════════════════════

interface ModelDef {
  filename: string;
  prompt: string;
}

const BASE_PROMPT = "standing relaxed, wearing plain white t-shirt and simple black cotton shorts, barefoot, showing full legs and feet, white studio background, fashion ecommerce photography, 9:16 vertical portrait";

const PLUS_SIZE: ModelDef[] = [
  { filename: "plus_morena_clara.png", prompt: `Full body photo from head to feet of a curvy plus size Brazilian woman, size 48-50, light brown skin, wavy dark brown hair, confident smile, ${BASE_PROMPT}` },
  { filename: "plus_negra_cacheada.png", prompt: `Full body photo from head to feet of a curvy plus size Black Brazilian woman, size 48-50, dark skin, natural curly afro hair, warm smile, ${BASE_PROMPT}` },
  { filename: "plus_loira.png", prompt: `Full body photo from head to feet of a curvy plus size Brazilian woman, size 48-50, fair skin, blonde wavy hair, friendly smile, ${BASE_PROMPT}` },
  { filename: "plus_ruiva.png", prompt: `Full body photo from head to feet of a curvy plus size Brazilian woman, size 48-50, fair skin with freckles, red wavy hair, confident pose, ${BASE_PROMPT}` },
  { filename: "plus_oriental.png", prompt: `Full body photo from head to feet of a curvy plus size East Asian Brazilian woman, size 48-50, light skin, straight black hair, gentle smile, ${BASE_PROMPT}` },
  { filename: "plus_morena_escura.png", prompt: `Full body photo from head to feet of a curvy plus size Brazilian woman, size 48-50, medium dark brown skin, long straight dark hair, elegant expression, ${BASE_PROMPT}` },
  { filename: "plus_mista_cabelo_curto.png", prompt: `Full body photo from head to feet of a curvy plus size mixed race Brazilian woman, size 48-50, caramel skin, short bob haircut, bright smile, ${BASE_PROMPT}` },
  { filename: "plus_negra_trancas.png", prompt: `Full body photo from head to feet of a curvy plus size Black Brazilian woman, size 48-50, dark skin, long braids hairstyle, confident smile, ${BASE_PROMPT}` },
  { filename: "plus_parda_ondulada.png", prompt: `Full body photo from head to feet of a curvy plus size Brazilian woman, size 48-50, olive brown skin, wavy medium brown hair, natural expression, ${BASE_PROMPT}` },
];

const NORMAL: ModelDef[] = [
  { filename: "normal_morena_clara.png", prompt: `Full body photo from head to feet of a slim Brazilian woman, size 36-38, light brown skin, wavy dark brown hair, confident smile, ${BASE_PROMPT}` },
  { filename: "normal_negra.png", prompt: `Full body photo from head to feet of a slim Black Brazilian woman, size 36-38, dark skin, natural curly hair, warm smile, ${BASE_PROMPT}` },
  { filename: "normal_loira.png", prompt: `Full body photo from head to feet of a slim Brazilian woman, size 36-38, fair skin, blonde straight hair, friendly expression, ${BASE_PROMPT}` },
  { filename: "normal_ruiva.png", prompt: `Full body photo from head to feet of a slim Brazilian woman, size 36-38, fair skin, red wavy hair, confident pose, ${BASE_PROMPT}` },
  { filename: "normal_oriental.png", prompt: `Full body photo from head to feet of a slim East Asian Brazilian woman, size 36-38, light skin, straight black hair, gentle smile, ${BASE_PROMPT}` },
  { filename: "normal_morena_escura.png", prompt: `Full body photo from head to feet of a slim Brazilian woman, size 36-38, medium dark brown skin, long wavy dark hair, elegant expression, ${BASE_PROMPT}` },
  { filename: "normal_mista_cabelo_curto.png", prompt: `Full body photo from head to feet of a slim mixed race Brazilian woman, size 36-38, caramel skin, pixie short haircut, bright smile, ${BASE_PROMPT}` },
  { filename: "normal_negra_lisa.png", prompt: `Full body photo from head to feet of a slim Black Brazilian woman, size 36-38, dark skin, long straight hair, confident smile, ${BASE_PROMPT}` },
  { filename: "normal_parda.png", prompt: `Full body photo from head to feet of a slim Brazilian woman, size 36-38, olive brown skin, wavy medium brown hair, natural expression, ${BASE_PROMPT}` },
  { filename: "normal_clara_alta.png", prompt: `Full body photo from head to feet of a tall slim Brazilian woman, size 38-40, light skin, long dark straight hair, professional model pose, ${BASE_PROMPT}` },
];

const ALL_MODELS = [...PLUS_SIZE, ...NORMAL];

// ══════════════════════════════
// Funções
// ══════════════════════════════

async function submitJob(productImage: string, prompt: string): Promise<string> {
  const res = await fetch(`${FASHN_API_URL}/run`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${FASHN_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model_name: "product-to-model",
      inputs: {
        product_image: productImage,
        prompt,
        aspect_ratio: "9:16",
      },
    }),
  });

  if (!res.ok) {
    throw new Error(`Submit error (${res.status}): ${await res.text()}`);
  }
  const { id } = await res.json();
  return id;
}

async function pollResult(jobId: string): Promise<string | null> {
  for (let i = 0; i < 60; i++) {
    await new Promise(r => setTimeout(r, 2000));
    process.stdout.write(".");
    const res = await fetch(`${FASHN_API_URL}/status/${jobId}`, {
      headers: { Authorization: `Bearer ${FASHN_API_KEY}` },
    });
    const data = await res.json();
    if (data.status === "completed" && data.output?.[0]) return data.output[0];
    if (data.status === "failed") throw new Error(`Job failed: ${JSON.stringify(data)}`);
  }
  throw new Error("Timeout");
}

async function downloadImage(url: string, filepath: string): Promise<void> {
  const res = await fetch(url);
  const buf = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(filepath, buf);
}

// ══════════════════════════════
// Main
// ══════════════════════════════

async function main() {
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

  // Imagem base (camiseta branca)
  const basePath = path.resolve(__dirname, "../test-images/white-tshirt-base.png");
  if (!fs.existsSync(basePath)) {
    console.error("❌ Falta a imagem base: test-images/white-tshirt-base.png");
    process.exit(1);
  }
  const baseImage = `data:image/png;base64,${fs.readFileSync(basePath).toString("base64")}`;

  // Verificar quais já existem (para retomar se interrompido)
  const pending = ALL_MODELS.filter(m => !fs.existsSync(path.join(OUT_DIR, m.filename)));
  
  console.log(`\n🏭 Gerando ${pending.length} modelos (${ALL_MODELS.length - pending.length} já existem)`);
  console.log(`   9 Plus Size + 10 Normais\n`);

  const results: { filename: string; ok: boolean }[] = [];

  for (let i = 0; i < pending.length; i++) {
    const model = pending[i];
    const outPath = path.join(OUT_DIR, model.filename);
    console.log(`\n[${i + 1}/${pending.length}] 📸 ${model.filename}`);

    try {
      const jobId = await submitJob(baseImage, model.prompt);
      console.log(`   Job: ${jobId}`);
      const resultUrl = await pollResult(jobId);
      if (!resultUrl) throw new Error("No output URL");
      await downloadImage(resultUrl, outPath);
      console.log(`\n   ✅ Salva: ${model.filename}`);
      results.push({ filename: model.filename, ok: true });
    } catch (err: any) {
      console.error(`\n   ❌ Falhou: ${err.message}`);
      results.push({ filename: model.filename, ok: false });
    }
  }

  // Resumo
  const ok = results.filter(r => r.ok).length;
  const fail = results.filter(r => !r.ok).length;
  console.log(`\n${"═".repeat(50)}`);
  console.log(`✅ Geradas: ${ok} | ❌ Falhas: ${fail}`);
  if (fail > 0) {
    console.log(`Modelos com falha:`);
    results.filter(r => !r.ok).forEach(r => console.log(`  - ${r.filename}`));
    console.log(`\n💡 Execute novamente para tentar as que falharam.`);
  }

  // Salvar JSON de resultados
  fs.writeFileSync(
    path.join(OUT_DIR, "generation-results-v2.json"),
    JSON.stringify({ generated: new Date().toISOString(), results }, null, 2)
  );
}

main().catch(console.error);
