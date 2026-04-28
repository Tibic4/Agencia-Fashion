#!/usr/bin/env node
/**
 * Compress assets/images/bg/*.png down to thumbnail-sized WebP.
 * These backgrounds are rendered as 56x56 selectors, so 256px @ q70 is plenty.
 *
 * Usage: npm run compress:bg
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const SRC_DIR = path.resolve(__dirname, '..', 'assets', 'images', 'bg');
const TARGET_WIDTH = 256;
const QUALITY = 70;

async function run() {
  const files = fs.readdirSync(SRC_DIR).filter(f => /\.png$/i.test(f));
  if (files.length === 0) {
    console.log('No PNGs found in', SRC_DIR);
    return;
  }

  let totalBefore = 0;
  let totalAfter = 0;

  for (const f of files) {
    const src = path.join(SRC_DIR, f);
    const dst = path.join(SRC_DIR, f.replace(/\.png$/i, '.webp'));
    const before = fs.statSync(src).size;
    totalBefore += before;

    await sharp(src)
      .resize({ width: TARGET_WIDTH, withoutEnlargement: true })
      .webp({ quality: QUALITY })
      .toFile(dst);

    const after = fs.statSync(dst).size;
    totalAfter += after;
    fs.unlinkSync(src);

    console.log(
      `${f.padEnd(20)} ${(before / 1024).toFixed(0).padStart(5)} KB -> ${(after / 1024).toFixed(0).padStart(4)} KB`,
    );
  }

  const saved = ((totalBefore - totalAfter) / 1024 / 1024).toFixed(2);
  console.log(`\nTotal: ${(totalBefore / 1024 / 1024).toFixed(2)} MB -> ${(totalAfter / 1024 / 1024).toFixed(2)} MB (saved ${saved} MB)`);
  console.log('\nNext step: update require() paths in app/(tabs)/gerar/index.tsx from .png to .webp');
}

run().catch(e => {
  console.error(e);
  process.exit(1);
});
