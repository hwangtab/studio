const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const AUDIO_DIR = path.join(__dirname, '../public/audio');

function optimizeAudio(directory) {
    const files = fs.readdirSync(directory);

    for (const file of files) {
        const filePath = path.join(directory, file);
        const stats = fs.statSync(filePath);

        if (stats.isDirectory()) {
            optimizeAudio(filePath);
            continue;
        }

        const ext = path.extname(file).toLowerCase();
        if (ext === '.mp3') {
            const tempPath = filePath.replace('.mp3', '_temp.mp3');
            console.log(`Optimizing ${file}...`);
            try {
                // -b:a 128k sets bitrate to 128kbps
                // -y overwrites output
                // -map_metadata 0 preserves id3 tags
                execSync(`ffmpeg -i "${filePath}" -b:a 128k -map_metadata 0 -y "${tempPath}"`);
                fs.renameSync(tempPath, filePath);
                console.log(`Successfully optimized ${file}`);
            } catch (err) {
                console.error(`Error optimizing ${file}:`, err.message);
                if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
            }
        }
    }
}

try {
    execSync('ffmpeg -version');
    optimizeAudio(AUDIO_DIR);
    console.log('Audio optimization complete!');
} catch (err) {
    console.error('Error: ffmpeg is not installed or failed to run.');
    console.log('Skipping audio optimization. Please install ffmpeg to use this script.');
}
