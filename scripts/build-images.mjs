import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

const pages = ['p1', 'p2', 'p3', 'p4'];

async function processImages() {
    let totalOriginalBytes = 0;
    let totalAvifBytes = 0;
    let totalWebpBytes = 0;
    let count = 0;

    for (const page of pages) {
        const dir = path.join('assets', 'img', page);
        if (!fs.existsSync(dir)) continue;

        const files = fs.readdirSync(dir).filter(f => /\.(jpe?g)$/i.test(f));

        for (const file of files) {
            const inputPath = path.join(dir, file);
            const ext = path.extname(file);
            const baseName = path.basename(file, ext);

            const avifPath = path.join(dir, `${baseName}.avif`);
            const webpPath = path.join(dir, `${baseName}.webp`);

            const origStat = fs.statSync(inputPath);
            totalOriginalBytes += origStat.size;

            // Generate AVIF
            await sharp(inputPath)
                .avif({ quality: 65, effort: 4 })
                .toFile(avifPath);

            // Generate WebP
            await sharp(inputPath)
                .webp({ quality: 75, effort: 4 })
                .toFile(webpPath);

            const avifStat = fs.statSync(avifPath);
            const webpStat = fs.statSync(webpPath);

            totalAvifBytes += avifStat.size;
            totalWebpBytes += webpStat.size;
            count++;
            console.log(`[${count}/74] Processed ${file}: orig ${(origStat.size / 1024).toFixed(1)}KB -> avif ${(avifStat.size / 1024).toFixed(1)}KB, webp ${(webpStat.size / 1024).toFixed(1)}KB`);
        }
    }

    console.log('\n=== Summary ===');
    console.log(`Processed ${count} images.`);
    console.log(`Original: ${(totalOriginalBytes / (1024 * 1024)).toFixed(2)} MB`);
    console.log(`AVIF:     ${(totalAvifBytes / (1024 * 1024)).toFixed(2)} MB (${((1 - totalAvifBytes / totalOriginalBytes) * 100).toFixed(1)}% reduction)`);
    console.log(`WebP:     ${(totalWebpBytes / (1024 * 1024)).toFixed(2)} MB (${((1 - totalWebpBytes / totalOriginalBytes) * 100).toFixed(1)}% reduction)`);
}

processImages().catch(err => {
    console.error(err);
    process.exit(1);
});
