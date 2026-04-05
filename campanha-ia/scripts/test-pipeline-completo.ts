/**
 * Pipeline Completo: Vision → Copy → Score → Nano Banana 2K
 * 
 * Roda o pipeline inteiro e entrega o resultado em um relatório.
 * USO: npx tsx scripts/test-pipeline-completo.ts <foto> [close-up] [cenario]
 */
import * as dotenv from "dotenv";
import * as path from "path";
import * as fs from "fs";
import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenAI } from "@google/genai";

dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY || "";
const GOOGLE_KEY = process.env.GOOGLE_AI_API_KEY || "";
const MODEL_NANO = "gemini-3.1-flash-image-preview";

function safeParseJSON(text: string): any {
  const cleaned = text.replace(/```json\n?/g, "").replace(/```/g, "").trim();
  try { return JSON.parse(cleaned); } catch { return { raw: cleaned }; }
}

type BG = "estudio" | "boutique" | "urbano" | "natureza";
type CampaignType = "instagram_feed" | "instagram_story" | "ecommerce" | "banner";

const CAMPAIGN_CONFIGS: Record<CampaignType, { aspectRatio: string; imageSize: string; label: string }> = {
  instagram_feed: { aspectRatio: "4:5", imageSize: "2K", label: "Instagram Feed (4:5)" },
  instagram_story: { aspectRatio: "9:16", imageSize: "2K", label: "Instagram Story (9:16)" },
  ecommerce: { aspectRatio: "3:4", imageSize: "2K", label: "E-commerce (3:4)" },
  banner: { aspectRatio: "16:9", imageSize: "2K", label: "Banner Web (16:9)" },
};

const BG_PROMPTS: Record<BG, string> = {
  estudio: "Clean white studio background with professional fashion ecommerce lighting, soft shadows.",
  boutique: "Elegant fashion boutique interior with tasteful decor, warm lighting, blurred clothing racks in background.",
  urbano: "Urban city street, stylish neighborhood with modern architecture, natural daylight.",
  natureza: "Beautiful outdoor setting with soft natural light, lush vegetation slightly blurred, golden hour lighting.",
};

// ════════════════════════════════════
// 1. VISION — Análise da peça com Claude
// ════════════════════════════════════
async function analyzeProduct(imgBase64: string, closeUpBase64?: string): Promise<string> {
  const claude = new Anthropic({ apiKey: ANTHROPIC_KEY });
  
  const images: Anthropic.ImageBlockParam[] = [
    { type: "image", source: { type: "base64", media_type: "image/jpeg", data: imgBase64 } },
  ];
  if (closeUpBase64) {
    images.push({ type: "image", source: { type: "base64", media_type: "image/jpeg", data: closeUpBase64 } });
  }

  const hasMultiple = !!closeUpBase64;
  const multiPhotoInstructions = hasMultiple
    ? `\nYou are receiving TWO photos of the same garment:
- Photo 1: Full product shot showing the complete garment shape, color, and styling
- Photo 2: Close-up macro of the fabric texture
Combine both views: use the full shot for overall shape/color and the close-up for precise material identification.`
    : "";

  const resp = await claude.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 800,
    messages: [{
      role: "user",
      content: [
        ...images,
        {
          type: "text",
          text: `You are a fashion product analyst for Brazilian e-commerce.${multiPhotoInstructions}

Analyze this garment and return a JSON object with these fields:
{
  "tipo": "vestido|blusa|saia|calca|short|macacao|conjunto|outro",
  "nome_peca": "nome descritivo em português (ex: Vestido Midi Canelado)",
  "cor_principal": "cor exata (ex: laranja vibrante, verde esmeralda)",
  "cor_secundaria": "se aplicável ou null",
  "material": "tipo de tecido identificado (ex: malha canelada, viscose lisa, jeans bordado)",
  "textura": "descrição visual da textura (ex: canelado vertical, liso, bordado com margaridas)",
  "detalhes": ["lista de detalhes importantes como argola, botões, bordado, elástico, pregas"],
  "modelagem": "justa|solta|oversized|ajustada",
  "comprimento": "mini|midi|longo|cropped",
  "decote": "V|redondo|quadrado|gola alta|outro",
  "manga": "curta|longa|sem manga|3/4|bufante",
  "ocasiao": "casual|festa|trabalho|praia|esporte",
  "publico": "feminino|masculino|unissex",
  "faixa_etaria": "jovem|adulto|maduro|todas",
  "estacao": "verão|inverno|meia-estação|todas",
  "complemento_sugerido": "calçado e acessórios ideais para combinar"
}

Return ONLY the JSON, no extra text.`
        }
      ]
    }]
  });

  const text = resp.content.find(c => c.type === "text");
  return text ? (text as any).text : "{}";
}

// ════════════════════════════════════
// 2. COPY — Textos para campanha com Claude
// ════════════════════════════════════
async function generateCopy(analysis: any): Promise<any> {
  const claude = new Anthropic({ apiKey: ANTHROPIC_KEY });

  const resp = await claude.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 800,
    messages: [{
      role: "user",
      content: `Você é uma copywriter especializada em moda brasileira plus size.

Com base nesta análise de produto:
${JSON.stringify(analysis, null, 2)}

Gere um JSON com textos para campanha:
{
  "headline": "frase curta e impactante (máx 8 palavras)",
  "descricao": "descrição para e-commerce (2-3 frases)",
  "hashtags": ["lista de 8-10 hashtags relevantes"],
  "caption_instagram": "legenda para Instagram (engajante, com emojis, 2-3 parágrafos curtos)",
  "cta": "call to action curto",
  "nome_campanha": "nome criativo para a campanha"
}

REGRAS:
- Tom: empoderador, inclusivo, moderno
- Linguagem: português brasileiro coloquial
- Foco: como a peça faz a mulher se sentir
- Nunca usar "plus size" de forma pejorativa
Return ONLY JSON.`
    }]
  });

  const text = resp.content.find(c => c.type === "text");
  return text ? safeParseJSON((text as any).text) : {};
}

// ════════════════════════════════════
// 3. SCORE — Avaliação de qualidade com Claude
// ════════════════════════════════════
async function scoreResults(analysis: any, copy: any): Promise<any> {
  const claude = new Anthropic({ apiKey: ANTHROPIC_KEY });

  const resp = await claude.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 500,
    messages: [{
      role: "user",
      content: `Avalie a qualidade desta campanha de moda:

ANÁLISE DO PRODUTO:
${JSON.stringify(analysis, null, 2)}

TEXTOS DA CAMPANHA:
${JSON.stringify(copy, null, 2)}

Dê scores de 0-10 em JSON:
{
  "score_total": 0-10,
  "analise_produto": { "score": 0-10, "feedback": "..." },
  "copy_qualidade": { "score": 0-10, "feedback": "..." },
  "adequacao_publico": { "score": 0-10, "feedback": "..." },
  "potencial_engajamento": { "score": 0-10, "feedback": "..." },
  "sugestoes_melhoria": ["lista de sugestões"]
}
Return ONLY JSON.`
    }]
  });

  const text = resp.content.find(c => c.type === "text");
  return text ? safeParseJSON((text as any).text) : {};
}

// ════════════════════════════════════
// 4. NANO BANANA 2K — Geração da foto
// ════════════════════════════════════
async function generateImage(
  productBase64: string,
  closeUpBase64: string | null,
  modelBase64: string,
  analysis: any,
  bg: BG,
  campaign: CampaignType,
): Promise<{ imageBase64: string; resolution: string; elapsed: number } | null> {
  const ai = new GoogleGenAI({ apiKey: GOOGLE_KEY });
  const config = CAMPAIGN_CONFIGS[campaign];
  const parts: any[] = [];

  // 1. Produto
  parts.push({ inlineData: { mimeType: "image/jpeg", data: productBase64 } });

  // 2. Close-up
  const hasCloseUp = !!closeUpBase64;
  if (hasCloseUp) {
    parts.push({ inlineData: { mimeType: "image/jpeg", data: closeUpBase64 } });
  }

  // 3. Modelo referência
  parts.push({ inlineData: { mimeType: "image/png", data: modelBase64 } });

  // 4. Prompt com cores precisas
  const closeUpLine = hasCloseUp
    ? "\n- The SECOND image is a CLOSE-UP of the fabric texture. Reproduce the EXACT texture on the generated garment."
    : "";

  // Destaque especial para cor do jeans quando presente
  const jeansColorNote = analysis.material?.toLowerCase().includes("jeans") || analysis.tipo === "short"
    ? `\nCRITICAL COLOR NOTE: The jeans/denim piece has a specific shade of blue: "${analysis.cor_principal}". You MUST reproduce this EXACT shade of blue denim — not darker, not lighter. Match the wash level precisely.`
    : "";

  parts.push({
    text: `You are a world-class fashion photography editor specializing in Brazilian e-commerce.

TASK: Generate a SINGLE photorealistic image of a real-looking Brazilian woman model wearing the EXACT outfit shown in the product photos.

IMAGE INPUTS:
- The FIRST image shows the FULL outfit on a mannequin — recreate it EXACTLY.${closeUpLine}
- The image just before this text is the REFERENCE MODEL — match her body type, skin tone, hair, and face.

GARMENT RULES (CRITICAL):
1. PRESERVE the garment EXACTLY: same color "${analysis.cor_principal}", fabric "${analysis.material}", texture "${analysis.textura}", and ALL details: ${(analysis.detalhes || []).join(", ")}
2. The fabric texture must be IDENTICAL to the original product
3. DO NOT add, remove, or modify ANY garment detail${jeansColorNote}

FOOTWEAR (MANDATORY — NEVER barefoot):
4. ${analysis.complemento_sugerido || "Stylish white sneakers or sandals that complement the outfit"}

BACKGROUND:
5. ${BG_PROMPTS[bg]}

PHOTOGRAPHY:
6. Full body photo from head to feet INCLUDING SHOES
7. ${config.aspectRatio} aspect ratio, professional fashion photography
8. Natural confident pose, looking at camera with a natural smile
9. The model should look like a REAL person, not AI-generated
10. Output ONLY the image, absolutely no text or watermarks`
  });

  console.log(`  📐 Resolução: ${config.imageSize} | Aspecto: ${config.aspectRatio}`);
  const start = Date.now();

  const response = await ai.models.generateContent({
    model: MODEL_NANO,
    contents: [{ role: "user", parts }],
    config: {
      responseModalities: ["TEXT", "IMAGE"],
      imageConfig: {
        aspectRatio: config.aspectRatio,
        imageSize: config.imageSize,
      },
    } as any,
  });

  const elapsed = Date.now() - start;

  if (response.candidates?.[0]?.content?.parts) {
    for (const part of response.candidates[0].content.parts) {
      if (part.inlineData?.data) {
        return { imageBase64: part.inlineData.data, resolution: `${config.imageSize} ${config.aspectRatio}`, elapsed };
      }
    }
  }
  return null;
}

// ════════════════════════════════════
// MAIN
// ════════════════════════════════════
async function main() {
  const args = process.argv.slice(2);
  const productPath = args[0] || "test-images/conjunto-moletom-jeans.jpg";
  const closeUpPath = args[1] && !["estudio","boutique","urbano","natureza"].includes(args[1]) ? args[1] : null;
  const bgArg = (closeUpPath ? args[2] : args[1]) as BG || "estudio";
  const bg: BG = ["estudio","boutique","urbano","natureza"].includes(bgArg) ? bgArg : "estudio";
  const campaign: CampaignType = "instagram_feed"; // Default
  const modelPath = "test-images/model-bank/plus_morena_clara.png";

  console.log("═══════════════════════════════════════════");
  console.log("🍌 PIPELINE COMPLETO — CriaLook + Nano Banana 2K");
  console.log("═══════════════════════════════════════════");
  console.log(`📸 Produto: ${path.basename(productPath)}`);
  if (closeUpPath) console.log(`🔍 Close-up: ${path.basename(closeUpPath)}`);
  console.log(`🏠 Cenário: ${bg}`);
  console.log(`📱 Campanha: ${CAMPAIGN_CONFIGS[campaign].label}`);
  console.log(`👤 Modelo: ${path.basename(modelPath)}`);
  console.log("═══════════════════════════════════════════\n");

  const productBase64 = fs.readFileSync(productPath).toString("base64");
  const closeUpBase64 = closeUpPath && fs.existsSync(closeUpPath) ? fs.readFileSync(closeUpPath).toString("base64") : null;
  const modelBase64 = fs.readFileSync(modelPath).toString("base64");

  // ── STEP 1: Vision ──
  console.log("🔍 STEP 1: Análise de Produto (Claude Vision)...");
  const t1 = Date.now();
  const analysisRaw = await analyzeProduct(productBase64, closeUpBase64 || undefined);
  let analysis: any;
  try {
    analysis = JSON.parse(analysisRaw.replace(/```json\n?/g, "").replace(/```/g, "").trim());
  } catch {
    analysis = { raw: analysisRaw };
  }
  console.log(`  ⏱️ ${((Date.now() - t1) / 1000).toFixed(1)}s`);
  console.log(`  👗 ${analysis.nome_peca || "?"} | 🎨 ${analysis.cor_principal || "?"} | 🧵 ${analysis.material || "?"}`);
  console.log(`  📋 Detalhes: ${(analysis.detalhes || []).join(", ")}`);
  console.log(`  👟 Sugestão calçado: ${analysis.complemento_sugerido || "N/A"}\n`);

  // ── STEP 2: Copy ──
  console.log("✍️ STEP 2: Geração de Textos (Claude)...");
  const t2 = Date.now();
  const copy = await generateCopy(analysis);
  console.log(`  ⏱️ ${((Date.now() - t2) / 1000).toFixed(1)}s`);
  console.log(`  🔥 "${copy.headline || ""}"`);
  console.log(`  📝 ${(copy.descricao || "").slice(0, 100)}...`);
  console.log(`  📣 CTA: ${copy.cta || ""}\n`);

  // ── STEP 3: Score ──
  console.log("⭐ STEP 3: Score de Qualidade (Claude)...");
  const t3 = Date.now();
  const score = await scoreResults(analysis, copy);
  console.log(`  ⏱️ ${((Date.now() - t3) / 1000).toFixed(1)}s`);
  console.log(`  🏆 Score Total: ${score.score_total}/10`);
  console.log(`  📊 Produto: ${score.analise_produto?.score}/10 | Copy: ${score.copy_qualidade?.score}/10`);
  console.log(`  👥 Público: ${score.adequacao_publico?.score}/10 | Engajamento: ${score.potencial_engajamento?.score}/10\n`);

  // ── STEP 4: Nano Banana 2K Image ──
  console.log("🍌 STEP 4: Geração de Imagem 2K (Nano Banana 2)...");
  const imgResult = await generateImage(productBase64, closeUpBase64, modelBase64, analysis, bg, campaign);

  if (imgResult) {
    const baseName = path.basename(productPath, path.extname(productPath));
    const outName = `pipeline-${baseName}-${bg}-2k.png`;
    const outPath = path.resolve("test-images", outName);
    const buf = Buffer.from(imgResult.imageBase64, "base64");
    fs.writeFileSync(outPath, buf);
    console.log(`  ⏱️ ${(imgResult.elapsed / 1000).toFixed(1)}s`);
    console.log(`  📐 ${imgResult.resolution}`);
    console.log(`  💾 ${(buf.length / 1024).toFixed(0)}KB`);
    console.log(`  ✅ ${outPath}\n`);

    // Verificar resolução real
    try {
      const sharp = (await import("sharp")).default;
      const meta = await sharp(outPath).metadata();
      console.log(`  📏 Resolução real: ${meta.width}x${meta.height}`);
    } catch {}

    // ── RELATÓRIO FINAL ──
    const report = `# 🎬 Pipeline Completo — ${analysis.nome_peca || "Produto"}

## 📸 Análise do Produto
| Campo | Valor |
|---|---|
| Peça | ${analysis.nome_peca || "N/A"} |
| Tipo | ${analysis.tipo || "N/A"} |
| Cor Principal | ${analysis.cor_principal || "N/A"} |
| Material | ${analysis.material || "N/A"} |
| Textura | ${analysis.textura || "N/A"} |
| Modelagem | ${analysis.modelagem || "N/A"} |
| Comprimento | ${analysis.comprimento || "N/A"} |
| Decote | ${analysis.decote || "N/A"} |
| Manga | ${analysis.manga || "N/A"} |
| Detalhes | ${(analysis.detalhes || []).join(", ")} |
| Calçado sugerido | ${analysis.complemento_sugerido || "N/A"} |

## ✍️ Copy da Campanha
| Campo | Valor |
|---|---|
| Nome | ${copy.nome_campanha || "N/A"} |
| Headline | ${copy.headline || "N/A"} |
| CTA | ${copy.cta || "N/A"} |

**Descrição:** ${copy.descricao || "N/A"}

**Caption Instagram:**
${copy.caption_instagram || "N/A"}

**Hashtags:** ${(copy.hashtags || []).join(" ")}

## ⭐ Score de Qualidade
| Critério | Score |
|---|---|
| **TOTAL** | **${score.score_total}/10** |
| Análise Produto | ${score.analise_produto?.score}/10 |
| Copy | ${score.copy_qualidade?.score}/10 |
| Público | ${score.adequacao_publico?.score}/10 |
| Engajamento | ${score.potencial_engajamento?.score}/10 |

**Sugestões:** ${(score.sugestoes_melhoria || []).join(" | ")}

## 🍌 Imagem Gerada
| Config | Valor |
|---|---|
| Provider | Google Nano Banana 2 |
| Resolução | ${imgResult.resolution} |
| Cenário | ${bg} |
| Tempo | ${(imgResult.elapsed / 1000).toFixed(1)}s |
| Arquivo | ${outPath} |
`;

    const reportPath = path.resolve("test-images", `pipeline-${baseName}-report.md`);
    fs.writeFileSync(reportPath, report);
    console.log(`\n📋 Relatório: ${reportPath}`);
  } else {
    console.error("  ❌ Falha na geração de imagem");
  }

  console.log("\n═══════════════════════════════════════════");
  console.log("✅ Pipeline completo!");
  console.log("═══════════════════════════════════════════");
}

main().catch(console.error);
