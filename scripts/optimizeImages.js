const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const IMAGES_DIR = path.join(__dirname, '../public/images');

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
    .then(() => console.log('Image optimization complete!'))
    .catch((err) => console.error('Image optimization failed:', err));
