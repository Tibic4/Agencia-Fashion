/**
 * Converte imagens gigantes de /public para WebP (80% qualidade, max 1600px).
 * Reduz bundle de ~15MB para ~2MB.
 *
 * Uso: npx tsx scripts/optimize-public-images.ts
 */
import { readFileSync, writeFileSync, statSync } from "node:fs";
import sharp from "sharp";
import path from "node:path";

const TARGETS = [
  "public/demo-2.png",
  "public/demo-3.png",
  "public/demo-4.png",
  "public/demo-after.png",
  "public/demo-before.png",
  "public/demo-after.jpg",
  "public/demo-before.jpg",
  "public/demo-download.jpg",
  "public/logo.png",
  "public/zap-buton.png",
];

async function convert(file: string) {
  const full = path.resolve(file);
  try {
    const before = statSync(full).size;
    const buf = readFileSync(full);
    const out = await sharp(buf)
      .resize(1600, 1600, { fit: "inside", withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer();
    const outPath = full.replace(/\.(png|jpg|jpeg)$/i, ".webp");
    writeFileSync(outPath, out);
    const after = out.length;
    const savings = ((1 - after / before) * 100).toFixed(0);
    console.log(`  ✓ ${file} → ${path.basename(outPath)}  (${(before / 1024).toFixed(0)}KB → ${(after / 1024).toFixed(0)}KB, -${savings}%)`);
  } catch (e) {
    console.warn(`  ⚠️ ${file} falhou: ${e instanceof Error ? e.message : e}`);
  }
}

async function main() {
  console.log("🖼️  Otimizando imagens públicas...\n");
  for (const t of TARGETS) await convert(t);
  console.log("\n✅ Pronto. Atualize as referências nos componentes para .webp.");
}
main();
