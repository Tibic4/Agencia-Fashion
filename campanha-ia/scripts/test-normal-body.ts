import * as dotenv from "dotenv";
import * as path from "path";
import * as fs from "fs";
import { GoogleGenAI } from "@google/genai";

dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

async function main() {
  const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_AI_API_KEY! });
  const product = fs.readFileSync("test-images/conjunto-moletom-jeans.jpg").toString("base64");
  const model = fs.readFileSync("test-images/model-bank/normal_morena_clara.png").toString("base64");
  
  const parts: any[] = [
    { inlineData: { mimeType: "image/jpeg", data: product } },
    { inlineData: { mimeType: "image/png", data: model } },
    { text: `You are a world-class fashion photography editor specializing in Brazilian e-commerce.

TASK: Generate a SINGLE photorealistic image of a Brazilian woman model wearing the EXACT outfit from the first image (mannequin photo).

MODEL BODY TYPE (CRITICAL):
- STANDARD/SLIM body type (Brazilian P/M sizing, US size 4-8). Slim, athletic build.
- Match the REFERENCE MODEL (second image) skin tone, hair style, and face.

GARMENT RULES — OBSERVE THE MANNEQUIN PHOTO CAREFULLY:

TOP — Cropped Sweatshirt:
1. Color: olive/dark bege (exact shade from the photo)
2. Tight ribbed elastic waistband at the bottom — must look gathered/tight
3. THREE horizontal pleat lines on each sleeve (count them in the photo)
4. Round neckline with subtle ribbed collar
5. Cropped length: ends right at the waistband of the shorts
6. Loose/relaxed fit through the body

BOTTOM — Denim Shorts:
7. Medium blue denim wash — preserve this EXACT shade
8. EMBROIDERY: The shorts have EXACTLY 5-6 small white starburst/star shapes SPARSELY scattered across the front. DO NOT add more stars than what appears in the original. The pattern is SPARSE, not dense.
9. Folded/cuffed hem showing lighter denim on the inside
10. Front button closure (white/silver button)
11. Classic 5-pocket styling

FOOTWEAR (MANDATORY — NEVER barefoot):
12. Clean white sneakers

BACKGROUND: Clean white studio with professional fashion photography lighting.

PHOTOGRAPHY:
13. Full body photo from head to feet INCLUDING shoes
14. 4:5 vertical portrait orientation
15. Natural confident pose, relaxed hands
16. Professional soft lighting with subtle shadows
17. The model should look like a REAL person
18. Output ONLY the image — no text, no watermarks` }
  ];

  console.log("🍌 Gerando v2: bodyType=NORMAL + menos estrelas...");
  const start = Date.now();
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
        fs.writeFileSync("test-images/pipeline-moletom-NORMAL-v2.png", buf);
        console.log(`✅ ${((Date.now() - start) / 1000).toFixed(1)}s | ${(buf.length / 1024).toFixed(0)}KB`);
        try {
          const sharp = (await import("sharp")).default;
          const meta = await sharp("test-images/pipeline-moletom-NORMAL-v2.png").metadata();
          console.log(`📏 ${meta.width}x${meta.height}`);
        } catch {}
        return;
      }
    }
  }
  console.log("❌ Sem imagem");
}
main().catch(console.error);
