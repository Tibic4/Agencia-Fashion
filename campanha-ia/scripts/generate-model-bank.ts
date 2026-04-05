/**
 * Script para gerar as 20 modelos do banco (10 plus + 10 normais)
 * 
 * Uso: npx tsx scripts/generate-model-bank.ts
 * 
 * Custo estimado: 20 × R$ 0,15 = R$ 3,00 (ÚNICO)
 * 
 * O script gera as modelos via Fashn product-to-model com prompts
 * específicos para cada variação de corpo/pele/pose, salva as URLs
 * e insere no Supabase.
 */

import * as dotenv from "dotenv";
import * as path from "path";
import * as fs from "fs";

// Carregar .env.local
dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

const FASHN_API_URL = process.env.FASHN_API_URL || "https://api.fashn.ai/v1";
const FASHN_API_KEY = process.env.FASHN_API_KEY || "";
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

if (!FASHN_API_KEY) {
  console.error("❌ FASHN_API_KEY não encontrada no .env.local");
  process.exit(1);
}

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error("❌ SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY não encontradas");
  process.exit(1);
}

// ═══════════════════════════════════════
// Definição das 20 modelos
// ═══════════════════════════════════════

interface ModelSpec {
  name: string;
  bodyType: "plus_size" | "normal";
  skinTone: string;
  pose: string;
  prompt: string;
}

const MODELS: ModelSpec[] = [
  // ── PLUS SIZE (10) ──────────────────────
  {
    name: "Plus Clara 01",
    bodyType: "plus_size",
    skinTone: "clara",
    pose: "standing_relaxed",
    prompt: "Full body fashion photo of a curvy plus size woman, fair/light skin, relaxed standing pose, size 46-48 Brazilian, natural body proportions, wearing a simple plain white t-shirt and dark jeans, white studio background, professional lighting, looking at camera, confident expression",
  },
  {
    name: "Plus Clara 02",
    bodyType: "plus_size",
    skinTone: "clara",
    pose: "hands_on_hip",
    prompt: "Full body fashion photo of a curvy plus size woman, fair skin, hands on hips pose, size 46 Brazilian, wearing a plain white tank top and dark pants, white studio background, professional lighting, confident smile",
  },
  {
    name: "Plus Morena 01",
    bodyType: "plus_size",
    skinTone: "morena",
    pose: "standing_relaxed",
    prompt: "Full body fashion photo of a curvy plus size woman, olive/tan Brazilian skin, morena, relaxed standing pose, size 46-48, wearing a plain white t-shirt and dark jeans, white studio background, professional lighting, warm smile",
  },
  {
    name: "Plus Morena 02",
    bodyType: "plus_size",
    skinTone: "morena",
    pose: "casual",
    prompt: "Full body fashion photo of a curvy plus size woman, medium tan Latin skin, casual pose slightly turned, size 46, wearing simple white blouse and neutral pants, white studio background, natural lighting",
  },
  {
    name: "Plus Negra 01",
    bodyType: "plus_size",
    skinTone: "negra",
    pose: "standing_confident",
    prompt: "Full body fashion photo of a curvy plus size Black woman, dark skin, confident standing pose, size 46-48, wearing a plain white t-shirt and dark jeans, white studio background, professional lighting, radiant expression",
  },
  {
    name: "Plus Negra 02",
    bodyType: "plus_size",
    skinTone: "negra",
    pose: "hands_on_hip",
    prompt: "Full body fashion photo of a curvy plus size Black woman, rich dark skin, hands on one hip, size 46, wearing simple white tank top and pants, white studio background, elegant pose",
  },
  {
    name: "Plus Oriental 01",
    bodyType: "plus_size",
    skinTone: "oriental",
    pose: "standing_relaxed",
    prompt: "Full body fashion photo of a curvy plus size Asian woman, light olive skin, relaxed standing pose, size 46, wearing plain white t-shirt and dark jeans, white studio background, professional lighting, gentle smile",
  },
  {
    name: "Plus Mista 01",
    bodyType: "plus_size",
    skinTone: "mista",
    pose: "casual",
    prompt: "Full body fashion photo of a curvy plus size mixed-race woman, caramel skin, casual pose, size 46-48, wearing white basic t-shirt and jeans, white studio background, natural confident look",
  },
  {
    name: "Plus Mista 02",
    bodyType: "plus_size",
    skinTone: "ruiva",
    pose: "fashion",
    prompt: "Full body fashion photo of a curvy plus size woman, light skin with red hair, fashion pose slightly angled, size 46, wearing simple white blouse and dark pants, white studio background, professional lighting",
  },
  {
    name: "Plus Mista 03",
    bodyType: "plus_size",
    skinTone: "morena_clara",
    pose: "standing_elegant",
    prompt: "Full body fashion photo of a curvy plus size woman, light brown skin, elegant standing pose, size 46-48, wearing plain white t-shirt and neutral pants, white studio background, sophisticated look",
  },

  // ── NORMAIS (10) ──────────────────────
  {
    name: "Normal Clara 01",
    bodyType: "normal",
    skinTone: "clara",
    pose: "standing_relaxed",
    prompt: "Full body fashion photo of a slim woman, fair/light skin, relaxed standing pose, size 38-40 Brazilian, wearing a simple plain white t-shirt and dark jeans, white studio background, professional lighting, natural smile",
  },
  {
    name: "Normal Clara 02",
    bodyType: "normal",
    skinTone: "clara",
    pose: "hands_on_hip",
    prompt: "Full body fashion photo of a slim woman, fair skin, hands on hips, size 38, wearing plain white tank top and dark pants, white studio background, professional lighting, confident look",
  },
  {
    name: "Normal Morena 01",
    bodyType: "normal",
    skinTone: "morena",
    pose: "standing_relaxed",
    prompt: "Full body fashion photo of a slim woman, olive/tan Brazilian skin, morena, relaxed standing, size 38-40, wearing plain white t-shirt and jeans, white studio background, professional lighting, warm expression",
  },
  {
    name: "Normal Morena 02",
    bodyType: "normal",
    skinTone: "morena",
    pose: "fashion",
    prompt: "Full body fashion photo of a slim woman, medium tan Latin skin, fashion pose, size 38, wearing simple white blouse and neutral pants, white studio background, stylish look",
  },
  {
    name: "Normal Negra 01",
    bodyType: "normal",
    skinTone: "negra",
    pose: "standing_confident",
    prompt: "Full body fashion photo of a slim Black woman, dark skin, confident standing, size 38-40, wearing plain white t-shirt and dark jeans, white studio background, professional lighting, vibrant expression",
  },
  {
    name: "Normal Negra 02",
    bodyType: "normal",
    skinTone: "negra",
    pose: "elegant",
    prompt: "Full body fashion photo of a slim Black woman, rich dark skin, elegant pose, size 38, wearing simple white tank top and pants, white studio background, graceful posture",
  },
  {
    name: "Normal Oriental 01",
    bodyType: "normal",
    skinTone: "oriental",
    pose: "standing_relaxed",
    prompt: "Full body fashion photo of a slim Asian woman, light olive skin, relaxed standing, size 38, wearing plain white t-shirt and jeans, white studio background, professional lighting, gentle smile",
  },
  {
    name: "Normal Mista 01",
    bodyType: "normal",
    skinTone: "mista",
    pose: "casual",
    prompt: "Full body fashion photo of a slim mixed-race woman, caramel skin, casual standing, size 38-40, wearing white basic t-shirt and dark jeans, white studio background, natural beauty",
  },
  {
    name: "Normal Mista 02",
    bodyType: "normal",
    skinTone: "loira",
    pose: "fashion",
    prompt: "Full body fashion photo of a slim woman, light skin blonde hair, fashion pose, size 38, wearing simple white blouse and dark pants, white studio background, professional styling",
  },
  {
    name: "Normal Mista 03",
    bodyType: "normal",
    skinTone: "morena_clara",
    pose: "standing_elegant",
    prompt: "Full body fashion photo of a slim woman, light brown skin, elegant standing, size 38-40, wearing plain white t-shirt and neutral pants, white studio background, refined look",
  },
];

// ═══════════════════════════════════════
// Fashn API helpers
// ═══════════════════════════════════════

async function submitProductToModel(prompt: string): Promise<string> {
  // Para gerar modelos "base", usamos uma foto simples de camiseta branca
  // O prompt controla o corpo/pele/pose da modelo gerada
  const productImageUrl = "https://upload.wikimedia.org/wikipedia/commons/thumb/7/7e/Plain_white_t-shirt.jpg/800px-Plain_white_t-shirt.jpg";

  const res = await fetch(`${FASHN_API_URL}/run`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${FASHN_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model_name: "product-to-model",
      inputs: {
        product_image: productImageUrl,
        prompt,
        aspect_ratio: "9:16",
      },
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Fashn submit error (${res.status}): ${err}`);
  }

  const data = await res.json();
  return data.id;
}

async function pollJob(jobId: string): Promise<string | null> {
  const maxAttempts = 60; // 2min
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise(r => setTimeout(r, 2000));

    const res = await fetch(`${FASHN_API_URL}/status/${jobId}`, {
      headers: { Authorization: `Bearer ${FASHN_API_KEY}` },
    });
    if (!res.ok) continue;

    const data = await res.json();
    if (data.status === "completed") {
      return data.output?.[0] || data.output_url || null;
    }
    if (data.status === "failed") {
      console.error(`  ❌ Job ${jobId} falhou:`, data.error);
      return null;
    }
    process.stdout.write(".");
  }
  return null;
}

// ═══════════════════════════════════════
// Supabase insert
// ═══════════════════════════════════════

async function insertModel(spec: ModelSpec, imageUrl: string, jobId: string) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/model_bank`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify({
      name: spec.name,
      body_type: spec.bodyType,
      skin_tone: spec.skinTone,
      pose: spec.pose,
      image_url: imageUrl,
      fashn_job_id: jobId,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error(`  ❌ Supabase insert error: ${err}`);
    return null;
  }
  return await res.json();
}

// ═══════════════════════════════════════
// Main
// ═══════════════════════════════════════

async function main() {
  console.log("🏦 Gerando Banco de Modelos CriaLook");
  console.log(`📊 Total: ${MODELS.length} modelos (${MODELS.filter(m => m.bodyType === "plus_size").length} plus + ${MODELS.filter(m => m.bodyType === "normal").length} normais)`);
  console.log(`💰 Custo estimado: R$ ${(MODELS.length * 0.15).toFixed(2)}\n`);

  const results: { name: string; status: string; url?: string }[] = [];
  const outputDir = path.resolve(__dirname, "../test-images/model-bank");
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  for (let i = 0; i < MODELS.length; i++) {
    const spec = MODELS[i];
    console.log(`\n[${i + 1}/${MODELS.length}] 🧑‍🦱 Gerando ${spec.name} (${spec.bodyType}, ${spec.skinTone})...`);

    try {
      const jobId = await submitProductToModel(spec.prompt);
      console.log(`  📤 Job ${jobId} enviado`);

      process.stdout.write("  ⏳ Aguardando");
      const imageUrl = await pollJob(jobId);

      if (imageUrl) {
        console.log(`\n  ✅ Imagem gerada: ${imageUrl.slice(0, 80)}...`);

        // Inserir no Supabase
        await insertModel(spec, imageUrl, jobId);
        console.log(`  💾 Salvo no banco`);

        // Download local para backup
        try {
          const imgRes = await fetch(imageUrl);
          const buffer = Buffer.from(await imgRes.arrayBuffer());
          const filename = `${spec.bodyType}_${spec.skinTone}_${spec.pose}.png`;
          fs.writeFileSync(path.join(outputDir, filename), buffer);
          console.log(`  📁 Backup local: model-bank/${filename}`);
        } catch {
          console.warn("  ⚠️ Falha ao salvar backup local");
        }

        results.push({ name: spec.name, status: "✅", url: imageUrl });
      } else {
        console.log(`\n  ❌ Falha na geração`);
        results.push({ name: spec.name, status: "❌" });
      }
    } catch (err) {
      console.error(`  ❌ Erro: ${err}`);
      results.push({ name: spec.name, status: "❌" });
    }

    // Delay entre requests (rate limit)
    if (i < MODELS.length - 1) {
      console.log("  ⏸️ Aguardando 3s antes do próximo...");
      await new Promise(r => setTimeout(r, 3000));
    }
  }

  // ── Resumo ──
  console.log("\n\n═══════════════════════════════════════");
  console.log("📊 RESUMO DO BANCO DE MODELOS");
  console.log("═══════════════════════════════════════");
  const success = results.filter(r => r.status === "✅").length;
  const failed = results.filter(r => r.status === "❌").length;
  console.log(`✅ Sucesso: ${success}`);
  console.log(`❌ Falha: ${failed}`);
  console.log(`💰 Custo total: ~R$ ${(success * 0.15).toFixed(2)}`);
  results.forEach(r => console.log(`  ${r.status} ${r.name}`));

  // Salvar JSON com resultados
  fs.writeFileSync(
    path.join(outputDir, "generation-results.json"),
    JSON.stringify(results, null, 2),
  );
  console.log(`\n📁 Resultados salvos em test-images/model-bank/generation-results.json`);
}

main().catch(console.error);
