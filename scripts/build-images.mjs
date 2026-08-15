import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

const pages = ['p1', 'p2', 'p3', 'p4'];
const SIZES_ATTR = '(max-width: 480px) 100vw, (max-width: 768px) 90vw, 900px';

async function processImages() {
    let totalOriginalBytes = 0;
    let totalAvifFullBytes = 0;
    let totalAvif768Bytes = 0;
    let count = 0;

    for (const page of pages) {
        const dir = path.join('assets', 'img', page);
        if (!fs.existsSync(dir)) continue;

        const files = fs.readdirSync(dir).filter(f => /\.(jpe?g|JPG)$/i.test(f));

        for (const file of files) {
            const inputPath = path.join(dir, file);
            const ext = path.extname(file);
            const baseName = path.basename(file, ext);

            const avifPath = path.join(dir, `${baseName}.avif`);
            const webpPath = path.join(dir, `${baseName}.webp`);
            const avif1200Path = path.join(dir, `${baseName}-1200.avif`);
            const webp1200Path = path.join(dir, `${baseName}-1200.webp`);
            const avif768Path = path.join(dir, `${baseName}-768.avif`);
            const webp768Path = path.join(dir, `${baseName}-768.webp`);

            const origStat = fs.statSync(inputPath);
            totalOriginalBytes += origStat.size;

            const pipeline = sharp(inputPath);
            const meta = await pipeline.metadata();

            // 1. Full-res AVIF & WebP
            await sharp(inputPath)
                .avif({ quality: 65, effort: 4 })
                .toFile(avifPath);
            await sharp(inputPath)
                .webp({ quality: 75, effort: 4 })
                .toFile(webpPath);

            // 2. 1200w variants (Super Retina / Tablet)
            await sharp(inputPath)
                .resize({ width: 1200, withoutEnlargement: true })
                .avif({ quality: 65, effort: 4 })
                .toFile(avif1200Path);
            await sharp(inputPath)
                .resize({ width: 1200, withoutEnlargement: true })
                .webp({ quality: 75, effort: 4 })
                .toFile(webp1200Path);

            // 3. 768w variants (Mobile 2x)
            await sharp(inputPath)
                .resize({ width: 768, withoutEnlargement: true })
                .avif({ quality: 65, effort: 4 })
                .toFile(avif768Path);
            await sharp(inputPath)
                .resize({ width: 768, withoutEnlargement: true })
                .webp({ quality: 75, effort: 4 })
                .toFile(webp768Path);

            const avifFullStat = fs.statSync(avifPath);
            const avif768Stat = fs.statSync(avif768Path);

            totalAvifFullBytes += avifFullStat.size;
            totalAvif768Bytes += avif768Stat.size;
            count++;

            console.log(`[${count}/74] ${file}: orig ${(origStat.size / 1024).toFixed(1)}KB -> avif full ${(avifFullStat.size / 1024).toFixed(1)}KB, 768w ${(avif768Stat.size / 1024).toFixed(1)}KB`);
        }
    }

    console.log('\n=== Image Generation Summary ===');
    console.log(`Processed ${count} images.`);
    console.log(`Original total:       ${(totalOriginalBytes / (1024 * 1024)).toFixed(2)} MB`);
    console.log(`AVIF full (desktop):  ${(totalAvifFullBytes / (1024 * 1024)).toFixed(2)} MB (${((1 - totalAvifFullBytes / totalOriginalBytes) * 100).toFixed(1)}% reduction)`);
    console.log(`AVIF 768w (mobile):   ${(totalAvif768Bytes / (1024 * 1024)).toFixed(2)} MB (${((1 - totalAvif768Bytes / totalOriginalBytes) * 100).toFixed(1)}% reduction)`);

    // Now update HTML files with responsive srcset + sizes
    console.log('\nUpdating HTML picture tags...');
    for (const page of pages) {
        const htmlPath = path.join(page, 'index.html');
        let html = fs.readFileSync(htmlPath, 'utf8');

        // Replace <picture> blocks or <img> tags
        const pictureOrImgRegex = /<picture>\s*<source[^>]+>\s*<source[^>]+>\s*(<img\s+[^>]*?src="\/assets\/img\/(p\d)\/([^"]+?\.(jpe?g|JPG))"([^>]*?)\/?>)\s*<\/picture>|<img\s+([^>]*?src="\/assets\/img\/(p\d)\/([^"]+?\.(jpe?g|JPG))"([^>]*?))\s*\/?>/gs;

        html = html.replace(pictureOrImgRegex, (match, imgTag1, pageDir1, file1, ext1, rest1, imgGroup2, pageDir2, file2, ext2, rest2) => {
            if (match.includes('mobile-banner')) {
                return match;
            }
            const pageDir = pageDir1 || pageDir2;
            const file = file1 || file2;
            const imgTag = imgTag1 || `<img ${imgGroup2.trim()} />`;

            const baseName = path.basename(file, path.extname(file));

            const avifSrcset = `/assets/img/${pageDir}/${baseName}-768.avif 768w, /assets/img/${pageDir}/${baseName}-1200.avif 1200w, /assets/img/${pageDir}/${baseName}.avif 2048w`;
            const webpSrcset = `/assets/img/${pageDir}/${baseName}-768.webp 768w, /assets/img/${pageDir}/${baseName}-1200.webp 1200w, /assets/img/${pageDir}/${baseName}.webp 2048w`;

            return `<picture>
            <source
                type="image/avif"
                srcset="${avifSrcset}"
                sizes="${SIZES_ATTR}"
            />
            <source
                type="image/webp"
                srcset="${webpSrcset}"
                sizes="${SIZES_ATTR}"
            />
            ${imgTag.trim()}
        </picture>`;
        });

        fs.writeFileSync(htmlPath, html, 'utf8');
        console.log(`Updated ${htmlPath}`);
    }
}

processImages().catch(err => {
    console.error(err);
    process.exit(1);
});
