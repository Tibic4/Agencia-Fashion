/**
 * Teste Nano Banana 2 v2 — Com cenários e calçado
 * USO: npx tsx scripts/test-nano-banana.ts <foto-produto> [foto-closeup] [cenario]
 * Cenarios: estudio | boutique | urbano | natureza
 */
import * as dotenv from "dotenv";
import * as path from "path";
import * as fs from "fs";
import { GoogleGenAI } from "@google/genai";

dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

const GOOGLE_AI_API_KEY = process.env.GOOGLE_AI_API_KEY || "";
const MODEL = "gemini-3.1-flash-image-preview";

type BG = "estudio" | "boutique" | "urbano" | "natureza";

const BG_PROMPTS: Record<BG, string> = {
  estudio: "Clean white studio background with professional fashion ecommerce lighting, soft shadows.",
  boutique: "Elegant fashion boutique interior background with tasteful decor, soft warm lighting, clothing racks subtly blurred in background. The environment should look like a high-end Brazilian fashion store.",
  urbano: "Urban city street background, stylish neighborhood with modern architecture, natural daylight. The model appears to be casually walking on a clean sidewalk.",
  natureza: "Beautiful outdoor setting with soft natural light, lush green vegetation slightly blurred in background, golden hour lighting.",
};

async function main() {
  const args = process.argv.slice(2);
  const productPath = args[0] || path.resolve(__dirname, "../test-images/vestido-laranja-full.jpg");
  const closeUpPath = args[1] && !["estudio","boutique","urbano","natureza"].includes(args[1]) ? args[1] : null;
  const bgArg = (closeUpPath ? args[2] : args[1]) as BG || "estudio";
  const bg: BG = ["estudio","boutique","urbano","natureza"].includes(bgArg) ? bgArg : "estudio";

  const modelPath = path.resolve(__dirname, "../test-images/model-bank/plus_morena_clara.png");

  if (!GOOGLE_AI_API_KEY) { console.error("❌ GOOGLE_AI_API_KEY não configurada"); process.exit(1); }

  console.log("🍌 Nano Banana 2 — Teste de Geração");
  console.log(`📸 Produto: ${path.basename(productPath)}`);
  if (closeUpPath) console.log(`🔍 Close-up: ${path.basename(closeUpPath)}`);
  console.log(`🏠 Cenário: ${bg}`);
  console.log(`👤 Modelo: ${path.basename(modelPath)}\n`);

  const ai = new GoogleGenAI({ apiKey: GOOGLE_AI_API_KEY });
  const parts: any[] = [];

  // 1. Produto
  parts.push({ inlineData: { mimeType: "image/jpeg", data: fs.readFileSync(productPath).toString("base64") } });

  // 2. Close-up (opcional)
  const hasCloseUp = closeUpPath && fs.existsSync(closeUpPath);
  if (hasCloseUp) {
    parts.push({ inlineData: { mimeType: "image/jpeg", data: fs.readFileSync(closeUpPath).toString("base64") } });
  }

  // 3. Modelo referência
  parts.push({ inlineData: { mimeType: "image/png", data: fs.readFileSync(modelPath).toString("base64") } });

  // 4. Prompt
  const closeUpLine = hasCloseUp
    ? "\n- The SECOND image is a CLOSE-UP of the fabric texture. Use it to reproduce the EXACT same texture on the generated garment."
    : "";

  parts.push({ text: `You are a world-class fashion photography editor specializing in Brazilian e-commerce.

TASK: Generate a SINGLE photorealistic image of a real-looking Brazilian woman model wearing the EXACT garment shown in the product photos.

IMAGE INPUTS:
- The FIRST image is the FULL product on a mannequin — this is the garment to recreate EXACTLY.${closeUpLine}
- The LAST image (before this text) is the REFERENCE MODEL — match her body type, skin tone, hair, and face.

GARMENT RULES (CRITICAL):
1. PRESERVE the garment EXACTLY: same color, fabric texture, pattern, neckline, sleeves, length, and ALL details
2. The fabric texture must be IDENTICAL to the original product photo
3. DO NOT add, remove, or modify ANY garment detail
4. If the garment is a TOP (blouse, shirt, crop top), pair it with stylish high-waisted jeans or the bottom shown in the product photo

FOOTWEAR (MANDATORY):
5. The model must ALWAYS wear appropriate footwear — NEVER barefoot
6. Choose footwear that complements the outfit:
   - Casual: clean white sneakers or stylish sandals
   - Elegant: nude heels or strappy sandals
   - Bohemian: espadrilles or flat sandals

BACKGROUND:
7. ${BG_PROMPTS[bg]}

PHOTOGRAPHY:
8. Full body photo from head to feet INCLUDING SHOES, 9:16 vertical portrait
9. Natural confident pose, looking at camera with a natural smile
10. Professional fashion photography lighting
11. The model should look like a REAL person
12. Output ONLY the image, no text or watermarks` });

  console.log("⏳ Gerando...");
  const start = Date.now();

  try {
    const response = await ai.models.generateContent({
      model: MODEL,
      contents: [{ role: "user", parts }],
    });

    const elapsed = Date.now() - start;
    console.log(`⏱️ Tempo: ${(elapsed/1000).toFixed(1)}s`);

    if (response.candidates?.[0]?.content?.parts) {
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData?.data) {
          const buf = Buffer.from(part.inlineData.data, "base64");
          const baseName = path.basename(productPath, path.extname(productPath));
          const outName = `nano-${baseName}-${bg}.png`;
          const outPath = path.resolve(__dirname, "../test-images", outName);
          fs.writeFileSync(outPath, buf);
          console.log(`✅ Imagem: ${outPath}`);
          console.log(`📐 Tamanho: ${(buf.length / 1024).toFixed(0)}KB`);
          return;
        }
        if (part.text) console.log("📝 Texto:", part.text.slice(0, 200));
      }
    }
    console.error("❌ Sem imagem no response");
  } catch (err: any) {
    console.error(`❌ Erro: ${err.message}`);
  }
}

main().catch(console.error);
