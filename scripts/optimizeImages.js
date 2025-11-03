#!/usr/bin/env node

/**
 * Generate responsive image variants for assets in public/images.
 * Produces WebP and fallback formats across multiple widths.
 */

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const SOURCE_DIR = path.join(__dirname, '..', 'public', 'images');
const OUTPUT_DIR = path.join(SOURCE_DIR, 'optimized');
const TARGET_WIDTHS = [480, 960, 1440];
const SUPPORTED_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png']);

const ensureDir = async (dirPath) => {
  await fs.promises.mkdir(dirPath, { recursive: true });
};

const getAllImageFiles = async (dir) => {
  const entries = await fs.promises.readdir(dir, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const entryPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        const relative = path.relative(SOURCE_DIR, entryPath);
        if (!relative || relative.startsWith('optimized')) {
          return [];
        }
        return getAllImageFiles(entryPath);
      }
      const ext = path.extname(entry.name).toLowerCase();
      if (SUPPORTED_EXTENSIONS.has(ext)) {
        return entryPath;
      }
      return null;
    })
  );

  return files.flat().filter(Boolean);
};

const needsUpdate = async (sourcePath, outputPath) => {
  try {
    const [sourceStat, outputStat] = await Promise.all([
      fs.promises.stat(sourcePath),
      fs.promises.stat(outputPath),
    ]);
    return outputStat.mtimeMs < sourceStat.mtimeMs;
  } catch (error) {
    if (error.code === 'ENOENT') {
      return true;
    }
    throw error;
  }
};

const buildWidthSet = (metadataWidth) => {
  const widthSet = new Set();
  TARGET_WIDTHS.forEach((width) => {
    widthSet.add(Math.min(width, metadataWidth));
  });
  widthSet.add(metadataWidth);
  return Array.from(widthSet).sort((a, b) => a - b);
};

const optimizeImage = async (filePath) => {
  const relativePath = path.relative(SOURCE_DIR, filePath);
  const parsed = path.parse(relativePath);
  const metadata = await sharp(filePath).metadata();
  const widthVariants = buildWidthSet(metadata.width || TARGET_WIDTHS[TARGET_WIDTHS.length - 1]);
  const outputDir = path.join(OUTPUT_DIR, parsed.dir);

  await ensureDir(outputDir);

  const fallbackExt = parsed.ext.toLowerCase() === '.png' ? '.png' : '.jpg';
  for (const width of widthVariants) {
    const webpOutput = path.join(outputDir, `${parsed.name}-${width}w.webp`);
    const fallbackOutput = path.join(outputDir, `${parsed.name}-${width}w${fallbackExt}`);

    if (await needsUpdate(filePath, webpOutput)) {
      await sharp(filePath)
        .resize({ width, withoutEnlargement: true })
        .webp({ quality: 80 })
        .toFile(webpOutput);
      console.log(`Generated ${webpOutput}`);
    }

    if (await needsUpdate(filePath, fallbackOutput)) {
      const fallbackPipeline = sharp(filePath).resize({ width, withoutEnlargement: true });
      if (fallbackExt === '.png') {
        await fallbackPipeline
          .png({ compressionLevel: 9, adaptiveFiltering: true })
          .toFile(fallbackOutput);
      } else {
        await fallbackPipeline
          .jpeg({ quality: 82, progressive: true, chromaSubsampling: '4:4:4' })
          .toFile(fallbackOutput);
      }
      console.log(`Generated ${fallbackOutput}`);
    }
  }
};

const run = async () => {
  try {
    await ensureDir(OUTPUT_DIR);
    const files = await getAllImageFiles(SOURCE_DIR);
    if (!files.length) {
      console.warn('No supported images found under public/images');
      return;
    }

    console.log(`Optimizing ${files.length} image(s) from ${SOURCE_DIR}`);
    for (const file of files) {
      await optimizeImage(file);
    }

    console.log('Image optimization completed.');
  } catch (error) {
    console.error('Image optimization failed:', error);
    process.exitCode = 1;
  }
};

run();
