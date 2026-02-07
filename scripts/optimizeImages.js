const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const IMAGES_DIR = path.join(__dirname, '../public/images');
const METADATA_OUTPUT = path.join(__dirname, '../utils/imageMetadata.json');
const SUPPORTED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp'];

// AVIF 생성 여부 (더 작지만 인코딩 느림)
const GENERATE_AVIF = true; // true로 변경시 AVIF 생성

const imageMetadata = {};

const toPublicPath = (filePath) => {
    const relativePath = path.relative(IMAGES_DIR, filePath).split(path.sep).join('/');
    return `/images/${relativePath}`;
};

const captureMetadata = async (filePath) => {
    const ext = path.extname(filePath).toLowerCase();
    if (!SUPPORTED_EXTENSIONS.includes(ext)) {
        return;
    }

    try {
        const metadata = await sharp(filePath).metadata();
        if (metadata.width && metadata.height) {
            imageMetadata[toPublicPath(filePath)] = {
                width: metadata.width,
                height: metadata.height,
            };
        }
    } catch (err) {
        console.error(`Error reading metadata for ${filePath}:`, err);
    }
};

const isNewer = (targetPath, sourcePath) => {
    if (!fs.existsSync(targetPath)) return false;
    const targetStats = fs.statSync(targetPath);
    const sourceStats = fs.statSync(sourcePath);
    return targetStats.mtime > sourceStats.mtime;
};

async function optimizeImages(directory) {
    const files = fs.readdirSync(directory);

    for (const file of files) {
        const filePath = path.join(directory, file);
        const stats = fs.statSync(filePath);

        if (stats.isDirectory()) {
            await optimizeImages(filePath);
            continue;
        }

        const ext = path.extname(file).toLowerCase();
        await captureMetadata(filePath);

        if (['.jpg', '.jpeg', '.png'].includes(ext)) {
            const basePath = filePath.replace(ext, '');
            const webpPath = `${basePath}.webp`;

            // WebP 생성
            if (!isNewer(webpPath, filePath)) {
                console.log(`Converting ${file} to WebP...`);
                try {
                    await sharp(filePath)
                        .webp({ quality: 80 })
                        .toFile(webpPath);
                } catch (err) {
                    console.error(`Error converting ${file} to WebP:`, err);
                }
            }

            // AVIF 생성 (옵션)
            if (GENERATE_AVIF) {
                const avifPath = `${basePath}.avif`;
                if (!isNewer(avifPath, filePath)) {
                    console.log(`Converting ${file} to AVIF...`);
                    try {
                        await sharp(filePath)
                            .avif({ quality: 65 })
                            .toFile(avifPath);
                    } catch (err) {
                        console.error(`Error converting ${file} to AVIF:`, err);
                    }
                }
            }
        }
    }
}

optimizeImages(IMAGES_DIR)
    .then(() => {
        fs.writeFileSync(METADATA_OUTPUT, JSON.stringify(imageMetadata, null, 2));
        console.log('Image optimization complete!');
        console.log('Image metadata written to utils/imageMetadata.json');
        console.log(`Processed ${Object.keys(imageMetadata).length} images.`);
    })
    .catch((err) => console.error('Image optimization failed:', err));
