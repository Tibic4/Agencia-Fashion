import * as dotenv from "dotenv";
import * as path from "path";
import * as fs from "fs";
import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenAI } from "@google/genai";

dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

function safeParseJSON(text: string): any {
  let cleaned = text.trim();
  cleaned = cleaned.replace(/```json\s*/g, "").replace(/```\s*/g, "");
  return JSON.parse(cleaned);
}

async function main() {
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
  const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_AI_API_KEY! });

  // 1. Carregar imagens
  console.log("📸 Carregando imagens do vestido azul...");
  const productBase64 = fs.readFileSync("test-images/vestido-azul-manequim.jpg").toString("base64");
  const closeUpBase64 = fs.readFileSync("test-images/vestido-azul-closeup.jpg").toString("base64");
  const modelBase64 = fs.readFileSync("test-images/model-bank/normal_morena_clara.png").toString("base64");

  // 2. Claude Vision — Análise
  console.log("\n🔍 ETAPA 1: Claude Vision analisando peça...");
  const visionStart = Date.now();
  const visionResponse = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1500,
    messages: [{
      role: "user",
      content: [
        { type: "image", source: { type: "base64", media_type: "image/jpeg", data: productBase64 } },
        { type: "image", source: { type: "base64", media_type: "image/jpeg", data: closeUpBase64 } },
        { type: "text", text: `Analise esta peça de roupa feminina para e-commerce brasileiro.
Primeira foto: peça completa no manequim. Segunda foto: close-up do tecido/textura.

Retorne APENAS um JSON com:
{
  "tipo_peca": "tipo da peça (vestido, blusa, saia, etc)",
  "cor_principal": "cor principal exata",
  "cor_secundaria": "cor secundária se houver, senão null",
  "material": "tipo de tecido/material",
  "textura": "descrição detalhada da textura do tecido",
  "detalhes": "todos os detalhes construtivos: alças, decote, comprimento, franzido, babado, botões, etc",
  "estilo": "casual, elegante, boho, esportivo, etc",
  "ocasiao": "onde seria usado",
  "calcado_sugerido": "tipo de calçado ideal",
  "descricao_completa": "descrição completa da peça em 2-3 frases para uso no prompt de geração de imagem"
}` }
      ]
    }]
  });

  const visionText = (visionResponse.content[0] as any).text;
  const analysis = safeParseJSON(visionText);
  console.log(`✅ Vision: ${((Date.now() - visionStart) / 1000).toFixed(1)}s`);
  console.log(JSON.stringify(analysis, null, 2));

  // 3. Nano Banana — Geração 2K
  console.log("\n🍌 ETAPA 2: Nano Banana gerando modelo com vestido (2K)...");
  const genStart = Date.now();

  const parts: any[] = [
    { inlineData: { mimeType: "image/jpeg", data: productBase64 } },
    { inlineData: { mimeType: "image/jpeg", data: closeUpBase64 } },
    { inlineData: { mimeType: "image/png", data: modelBase64 } },
    { text: `You are a world-class fashion photography editor specializing in Brazilian e-commerce.

TASK: Generate a SINGLE photorealistic image of a Brazilian woman model wearing the EXACT garment from the product photos.

IMAGE INPUTS:
- FIRST image: Full product on mannequin — recreate this garment EXACTLY
- SECOND image: CLOSE-UP of fabric texture — use to reproduce the EXACT same texture
- THIRD image: REFERENCE MODEL — match her skin tone, hair style, and face

MODEL BODY TYPE (CRITICAL):
- STANDARD/SLIM body type (Brazilian P/M sizing, US size 4-8). Slim, athletic build.
- DO NOT generate plus-size body.

GARMENT DETAILS (from AI analysis):
- Type: ${analysis.tipo_peca}
- Color: ${analysis.cor_principal} — preserve this EXACT shade
- Material: ${analysis.material}
- Texture: ${analysis.textura}
- Construction details: ${analysis.detalhes}
- Full description: ${analysis.descricao_completa}

GARMENT RULES (CRITICAL):
1. PRESERVE the garment EXACTLY as shown on the mannequin
2. The fabric texture must be IDENTICAL — use the close-up image as reference
3. PAY SPECIAL ATTENTION to: smocking/shirring, ruffles, elastic gathering, tie straps
4. Reproduce the EXACT SAME density and pattern of any textural elements
5. DO NOT add, remove, or modify ANY detail

FOOTWEAR (MANDATORY — NEVER barefoot):
6. ${analysis.calcado_sugerido || "Stylish sandals appropriate for the look"}

BACKGROUND: Clean white studio with professional fashion photography lighting.

PHOTOGRAPHY:
7. Full body photo from head to feet INCLUDING shoes
8. 4:5 vertical portrait orientation
9. Natural confident pose, relaxed and approachable
10. Professional soft lighting with subtle shadows
11. The model should look like a REAL person
12. Output ONLY the image — no text, no watermarks` }
  ];

  const response = await ai.models.generateContent({
    model: "gemini-3.1-flash-image-preview",
    contents: [{ role: "user", parts }],
    config: {
      responseModalities: ["TEXT", "IMAGE"],
      imageConfig: { aspectRatio: "4:5", imageSize: "2K" },
    } as any,
  });

  if (response.candidates?.[0]?.content?.parts) {
    for (const part of response.candidates[0].content.parts) {
      if (part.inlineData?.data) {
        const buf = Buffer.from(part.inlineData.data, "base64");
        const outputPath = "test-images/pipeline-vestido-azul-2k.png";
        fs.writeFileSync(outputPath, buf);
        const genTime = ((Date.now() - genStart) / 1000).toFixed(1);
        console.log(`✅ Geração: ${genTime}s | ${(buf.length / 1024).toFixed(0)}KB`);
        
        try {
          const sharp = (await import("sharp")).default;
          const meta = await sharp(outputPath).metadata();
          console.log(`📏 Resolução: ${meta.width}x${meta.height}`);
        } catch {}

        console.log(`\n🎯 PIPELINE COMPLETO!`);
        console.log(`📁 ${outputPath}`);
        console.log(`⏱️ Total: ${((Date.now() - visionStart) / 1000).toFixed(1)}s`);
        return;
      }
    }
  }
  console.log("❌ Sem imagem gerada");
}

main().catch(console.error);
