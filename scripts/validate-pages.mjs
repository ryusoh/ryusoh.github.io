import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';
import { thumbHashToRGBA } from 'thumbhash';
import { getProjectPages } from './sync-pages.mjs';
import { GENERIC_IMAGE_ALT, SITE_ORIGIN, loadCommentaryMap } from './seo.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

/**
 * Validates JSON-LD script blocks on a given HTML page and verifies local image URLs exist on disk.
 * @param {string} label
 * @param {string} html
 * @param {string[]} requiredGraphTypes
 * @returns {number} error count
 */
function validateStructuredData(label, html, requiredGraphTypes) {
    let errors = 0;
    const ldMatch = html.match(/<script\s+type="application\/ld\+json">([\s\S]*?)<\/script>/i);
    if (!ldMatch) {
        console.error(`[${label}] Missing <script type="application/ld+json"> structured data.`);
        return 1;
    }

    let parsed;
    try {
        parsed = JSON.parse(ldMatch[1]);
    } catch (e) {
        console.error(`[${label}] Invalid JSON-LD syntax:`, e.message);
        return 1;
    }

    const graph = Array.isArray(parsed['@graph']) ? parsed['@graph'] : [parsed];
    const presentTypes = new Set(graph.map((n) => n && n['@type']).filter(Boolean));
    for (const reqType of requiredGraphTypes) {
        if (!presentTypes.has(reqType)) {
            console.error(`[${label}] JSON-LD @graph missing required entity @type="${reqType}".`);
            errors++;
        }
    }

    const rawJson = ldMatch[1];
    const localUrlMatches = [
        ...rawJson.matchAll(/https:\/\/www\.lyeutsaon\.com\/(assets\/[^"\\]+)/g),
    ];
    for (const m of localUrlMatches) {
        const diskPath = path.join(ROOT_DIR, m[1]);
        if (!fs.existsSync(diskPath)) {
            console.error(`[${label}] JSON-LD references missing 404 asset on disk: ${m[0]}`);
            errors++;
        }
    }

    return errors;
}

/**
 * Validates OG/Twitter absolute URLs and structured data on a project page.
 * @param {string} page
 * @param {string} html
 * @returns {number}
 */
function validateProjectSeoHead(page, html) {
    let errors = 0;
    const ogImageMatch = html.match(/<meta\s+property="og:image"\s+content="([^"]+)"/i);
    const twImageMatch = html.match(/<meta\s+name="twitter:image"\s+content="([^"]+)"/i);

    if (!ogImageMatch || !ogImageMatch[1].startsWith(`${SITE_ORIGIN}/`)) {
        console.error(`[${page}] og:image must be an absolute ${SITE_ORIGIN}/ URL.`);
        errors++;
    }
    if (!twImageMatch || !twImageMatch[1].startsWith(`${SITE_ORIGIN}/`)) {
        console.error(`[${page}] twitter:image must be an absolute ${SITE_ORIGIN}/ URL.`);
        errors++;
    }

    errors += validateStructuredData(page, html, ['BreadcrumbList', 'ImageGallery']);
    return errors;
}

/**
 * Validates a single <img> tag inside a project page.
 */
async function validateGalleryImgTag(page, fullImgTag, src, isFirstImg, commentaryMap) {
    let errors = 0;
    const relativeSrc = src.startsWith('/') ? src.slice(1) : src;
    const assetPath = path.join(ROOT_DIR, relativeSrc);

    if (!fs.existsSync(assetPath)) {
        console.error(`[${page}] 404 image asset not found on disk: ${src}`);
        return 1;
    }

    const filename = path.basename(src);
    const altMatch = fullImgTag.match(/\balt="([^"]*)"/);
    if (!altMatch || !altMatch[1].trim()) {
        console.error(`[${page}] Image missing non-empty alt attribute: ${src}`);
        errors++;
    } else if (altMatch[1] === GENERIC_IMAGE_ALT && commentaryMap[filename]?.subject) {
        console.error(
            `[${page}] Image still uses generic placeholder alt despite commentary.json entry: ${src}`
        );
        errors++;
    }

    const widthMatch = fullImgTag.match(/width="(\d+)"/);
    const heightMatch = fullImgTag.match(/height="(\d+)"/);
    if (!widthMatch || !heightMatch) {
        console.error(`[${page}] Image missing width or height attributes: ${src}`);
        errors++;
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
                errors++;
            }
        }
    }

    const hashMatch = fullImgTag.match(/data-thumbhash="([^"]+?)"/);
    if (!hashMatch) {
        console.error(`[${page}] Image missing data-thumbhash attribute: ${src}`);
        errors++;
    } else {
        const hashBase64 = hashMatch[1];
        if (hashBase64.length !== 28) {
            console.error(
                `[${page}] Invalid ThumbHash length (${hashBase64.length}): ${hashBase64}`
            );
            errors++;
        } else {
            try {
                const hashBytes = Buffer.from(hashBase64, 'base64');
                thumbHashToRGBA(hashBytes);
            } catch (e) {
                console.error(`[${page}] Failed to decode ThumbHash for ${src}:`, e.message);
                errors++;
            }
        }
    }

    const hasLazy = fullImgTag.includes('loading="lazy"');
    if (isFirstImg && hasLazy) {
        console.error(`[${page}] First image should omit loading="lazy" for LCP: ${src}`);
        errors++;
    } else if (!isFirstImg && !hasLazy) {
        console.error(`[${page}] Non-first image missing loading="lazy": ${src}`);
        errors++;
    }

    return errors;
}

/**
 * Validates sitemap.xml and llms.txt / llms-full.txt discovery files.
 */
function validateDiscoveryManifests(pages) {
    let errors = 0;
    const sitemapPath = path.join(ROOT_DIR, 'sitemap.xml');
    if (!fs.existsSync(sitemapPath)) {
        console.error('Missing sitemap.xml.');
        errors++;
    } else {
        const sitemapContent = fs.readFileSync(sitemapPath, 'utf8');
        if (!sitemapContent.includes(`<loc>${SITE_ORIGIN}/</loc>`)) {
            console.error('sitemap.xml is missing home root URL.');
            errors++;
        }
        if (
            !sitemapContent.includes(
                'xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"'
            )
        ) {
            console.error('sitemap.xml is missing Google Image Sitemap namespace.');
            errors++;
        }
        for (const page of pages) {
            const pageUrl = `<loc>${SITE_ORIGIN}/${page}/</loc>`;
            if (!sitemapContent.includes(pageUrl)) {
                console.error(`sitemap.xml is missing page entry: ${pageUrl}`);
                errors++;
            }
        }
    }

    for (const manifestName of ['llms.txt', 'llms-full.txt']) {
        const manifestPath = path.join(ROOT_DIR, manifestName);
        if (!fs.existsSync(manifestPath)) {
            console.error(`Missing ${manifestName}.`);
            errors++;
            continue;
        }
        const content = fs.readFileSync(manifestPath, 'utf8');
        for (const page of pages) {
            if (!content.includes(`${SITE_ORIGIN}/${page}/`)) {
                console.error(`${manifestName} is missing canonical link for ${page}.`);
                errors++;
            }
        }
    }

    return errors;
}

/**
 * Validates integrity of all portfolio pages and site-wide SEO/GEO artifacts.
 */
export async function validateAllPages() {
    const pages = getProjectPages();
    let errorCount = 0;

    console.log(`Validating ${pages.length} portfolio pages...`);

    const indexHtmlPath = path.join(ROOT_DIR, 'index.html');
    if (fs.existsSync(indexHtmlPath)) {
        const indexHtml = fs.readFileSync(indexHtmlPath, 'utf8');
        errorCount += validateStructuredData('index.html', indexHtml, [
            'Person',
            'WebSite',
            'CollectionPage',
        ]);
    }

    const aboutHtmlPath = path.join(ROOT_DIR, 'about', 'index.html');
    if (fs.existsSync(aboutHtmlPath)) {
        const aboutHtml = fs.readFileSync(aboutHtmlPath, 'utf8');
        errorCount += validateStructuredData('about/index.html', aboutHtml, [
            'BreadcrumbList',
            'ProfilePage',
            'Person',
            'WebSite',
        ]);
    }

    for (const page of pages) {
        const htmlPath = path.join(ROOT_DIR, page, 'index.html');
        if (!fs.existsSync(htmlPath)) {
            console.error(`[${page}] Missing index.html file.`);
            errorCount++;
            continue;
        }

        const html = fs.readFileSync(htmlPath, 'utf8');
        const commentaryMap = loadCommentaryMap(ROOT_DIR, page);

        if (!html.includes('<h1') || !html.includes('</title>')) {
            console.error(`[${page}] Missing <h1> or <title>.`);
            errorCount++;
        }

        const currentMatch = html.match(/aria-current="page"/g);
        if (!currentMatch || currentMatch.length !== 1) {
            console.error(
                `[${page}] Expected exactly 1 aria-current="page", found ${currentMatch ? currentMatch.length : 0}.`
            );
            errorCount++;
        }

        errorCount += validateProjectSeoHead(page, html);

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

        const imgSrcMatches = [...html.matchAll(/<img\s+([^>]*?)src="([^"]+?)"([^>]*?)\/?>/g)];
        let isFirstImg = true;

        for (const match of imgSrcMatches) {
            const fullImgTag = match[0];
            const src = match[2];
            if (fullImgTag.includes('mobile-banner')) continue;

            errorCount += await validateGalleryImgTag(
                page,
                fullImgTag,
                src,
                isFirstImg,
                commentaryMap
            );
            isFirstImg = false;
        }
    }

    errorCount += validateDiscoveryManifests(pages);

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
