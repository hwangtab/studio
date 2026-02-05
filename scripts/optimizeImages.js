const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const IMAGES_DIR = path.join(__dirname, '../public/images');
const METADATA_OUTPUT = path.join(__dirname, '../utils/imageMetadata.json');
const SUPPORTED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp'];
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
            const webpPath = filePath.replace(ext, '.webp');

            // Skip if webp already exists and is newer than source
            if (fs.existsSync(webpPath)) {
                const webpStats = fs.statSync(webpPath);
                if (webpStats.mtime > stats.mtime) {
                    continue;
                }
            }

            console.log(`Converting ${file} to WebP...`);
            try {
                await sharp(filePath)
                    .webp({ quality: 80 })
                    .toFile(webpPath);
            } catch (err) {
                console.error(`Error converting ${file}:`, err);
            }
        }
    }
}

optimizeImages(IMAGES_DIR)
    .then(() => {
        fs.writeFileSync(METADATA_OUTPUT, JSON.stringify(imageMetadata, null, 2));
        console.log('Image optimization complete!');
        console.log('Image metadata written to utils/imageMetadata.json');
    })
    .catch((err) => console.error('Image optimization failed:', err));
