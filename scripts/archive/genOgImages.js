const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const SOURCES = [
  'room5.webp', 'room7.webp',
  'hardware1.webp', 'hardware2.webp', 'hardware3.webp', 'hardware5.webp',
  'lesson1.webp',
  'studio1.webp', 'studio2.webp',
  'recording1.webp', 'recording3.webp', 'recording15.webp',
];

const outDir = 'public/images';

(async () => {
  for (const src of SOURCES) {
    const srcPath = path.join(outDir, src);
    if (!fs.existsSync(srcPath)) {
      console.log(`MISSING: ${src}`);
      continue;
    }
    const outName = `og-${src}`;
    const outPath = path.join(outDir, outName);
    if (fs.existsSync(outPath)) {
      console.log(`SKIP (exists): ${outName}`);
      continue;
    }
    await sharp(srcPath)
      .resize(1200, 630, { fit: 'cover', position: 'center' })
      .webp({ quality: 85 })
      .toFile(outPath);
    const meta = await sharp(outPath).metadata();
    console.log(`GENERATED: ${outName} (${meta.width}x${meta.height}, ${fs.statSync(outPath).size} bytes)`);
  }
})();
