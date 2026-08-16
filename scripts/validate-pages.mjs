import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';
import { thumbHashToRGBA } from 'thumbhash';
import { getProjectPages } from './sync-pages.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

/**
 * Validates integrity of all portfolio pages.
 */
export async function validateAllPages() {
    const pages = getProjectPages();
    let errorCount = 0;

    console.log(`Validating ${pages.length} portfolio pages...`);

    for (const page of pages) {
        const htmlPath = path.join(ROOT_DIR, page, 'index.html');
        if (!fs.existsSync(htmlPath)) {
            console.error(`[${page}] Missing index.html file.`);
            errorCount++;
            continue;
        }

        const html = fs.readFileSync(htmlPath, 'utf8');

        // 1. Check title and heading
        if (!html.includes('<h1') || !html.includes('</title>')) {
            console.error(`[${page}] Missing <h1> or <title>.`);
            errorCount++;
        }

        // 2. Check aria-current="page"
        const currentMatch = html.match(/aria-current="page"/g);
        if (!currentMatch || currentMatch.length !== 1) {
            console.error(
                `[${page}] Expected exactly 1 aria-current="page", found ${currentMatch ? currentMatch.length : 0}.`
            );
            errorCount++;
        }

        // 3. Check Markdown source parity (ensure no blockquotes or prose are dropped)
        const mdPaths = [
            path.join(ROOT_DIR, 'assets', 'img', page, 'index.md'),
            path.join(ROOT_DIR, page, 'index.md'),
        ];
        const mdPath = mdPaths.find((p) => fs.existsSync(p));
        if (mdPath) {
            const mdContent = fs.readFileSync(mdPath, 'utf8');
            const mdQuotes = [...mdContent.matchAll(/^>(.*)$/gm)]
                .map((m) => m[1].replace(/<[^>]+>/g, '').trim())
                .filter((line) => line && !line.startsWith('<!--'));

            const cleanHtmlText = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
            for (const quoteLine of mdQuotes) {
                const cleanLine = quoteLine.replace(/\s+/g, ' ').trim();
                if (cleanLine && !cleanHtmlText.includes(cleanLine)) {
                    console.error(
                        `[${page}] Content dropped: markdown text "${cleanLine.slice(0, 50)}..." missing from rendered HTML.`
                    );
                    errorCount++;
                }
            }
        }

        // 4. Extract and check all <img> and <source> assets
        const imgSrcMatches = [...html.matchAll(/<img\s+([^>]*?)src="([^"]+?)"([^>]*?)\/?>/g)];
        let isFirstImg = true;

        for (const match of imgSrcMatches) {
            const fullImgTag = match[0];
            const src = match[2];

            if (fullImgTag.includes('mobile-banner')) continue;

            const relativeSrc = src.startsWith('/') ? src.slice(1) : src;
            const assetPath = path.join(ROOT_DIR, relativeSrc);

            // Asset existence
            if (!fs.existsSync(assetPath)) {
                console.error(`[${page}] 404 image asset not found on disk: ${src}`);
                errorCount++;
                continue;
            }

            // Dimension check
            const widthMatch = fullImgTag.match(/width="(\d+)"/);
            const heightMatch = fullImgTag.match(/height="(\d+)"/);
            if (!widthMatch || !heightMatch) {
                console.error(`[${page}] Image missing width or height attributes: ${src}`);
                errorCount++;
            } else {
                const htmlWidth = parseInt(widthMatch[1], 10);
                const htmlHeight = parseInt(heightMatch[1], 10);
                const meta = await sharp(assetPath).metadata();
                if (meta.width && meta.height) {
                    const htmlRatio = htmlWidth / htmlHeight;
                    const sharpRatio = meta.width / meta.height;
                    if (Math.abs(htmlRatio - sharpRatio) > 0.005) {
                        console.error(
                            `[${page}] Aspect ratio mismatch for ${src}: HTML ${htmlRatio.toFixed(3)} vs Sharp ${sharpRatio.toFixed(3)}`
                        );
                        errorCount++;
                    }
                }
            }

            // ThumbHash check
            const hashMatch = fullImgTag.match(/data-thumbhash="([^"]+?)"/);
            if (!hashMatch) {
                console.error(`[${page}] Image missing data-thumbhash attribute: ${src}`);
                errorCount++;
            } else {
                const hashBase64 = hashMatch[1];
                if (hashBase64.length !== 28) {
                    console.error(
                        `[${page}] Invalid ThumbHash length (${hashBase64.length}): ${hashBase64}`
                    );
                    errorCount++;
                } else {
                    try {
                        const hashBytes = Buffer.from(hashBase64, 'base64');
                        thumbHashToRGBA(hashBytes);
                    } catch (e) {
                        console.error(
                            `[${page}] Failed to decode ThumbHash for ${src}:`,
                            e.message
                        );
                        errorCount++;
                    }
                }
            }

            // Loading attribute check
            const hasLazy = fullImgTag.includes('loading="lazy"');
            if (isFirstImg && hasLazy) {
                console.error(`[${page}] First image should omit loading="lazy" for LCP: ${src}`);
                errorCount++;
            } else if (!isFirstImg && !hasLazy) {
                console.error(`[${page}] Non-first image missing loading="lazy": ${src}`);
                errorCount++;
            }
            isFirstImg = false;
        }
    }

    // 5. Validate sitemap.xml
    const sitemapPath = path.join(ROOT_DIR, 'sitemap.xml');
    if (!fs.existsSync(sitemapPath)) {
        console.error('Missing sitemap.xml.');
        errorCount++;
    } else {
        const sitemapContent = fs.readFileSync(sitemapPath, 'utf8');
        if (!sitemapContent.includes('<loc>https://www.lyeutsaon.com/</loc>')) {
            console.error('sitemap.xml is missing home root URL.');
            errorCount++;
        }
        for (const page of pages) {
            const pageUrl = `<loc>https://www.lyeutsaon.com/${page}/</loc>`;
            if (!sitemapContent.includes(pageUrl)) {
                console.error(`sitemap.xml is missing page entry: ${pageUrl}`);
                errorCount++;
            }
        }
    }

    if (errorCount > 0) {
        console.error(`\nValidation failed with ${errorCount} error(s).`);
        return 1;
    }

    console.log(`Validation passed! All ${pages.length} portfolio pages are valid.`);
    return 0;
}

// Direct CLI invocation
if (process.argv[1] === fileURLToPath(import.meta.url)) {
    validateAllPages()
        .then((code) => process.exit(code))
        .catch((err) => {
            console.error(err);
            process.exit(1);
        });
}
