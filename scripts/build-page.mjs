#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';
import { load as yamlLoad } from 'js-yaml';
import { rgbaToThumbHash, thumbHashToDataURL } from 'thumbhash';
import prettier from 'prettier';
import {
    getProjectPages,
    getProjectTitle,
    getNavLabel,
    buildNavRows,
    renderProjectPage,
    syncIndexNav,
    formatHtml,
} from './sync-pages.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const TEMPLATE_PATH = path.join(ROOT_DIR, 'scripts', 'templates', 'portfolio-shell.html');
const SIZES_ATTR = '(max-width: 480px) 100vw, (max-width: 768px) 90vw, 900px';

/**
 * Parses an index.md file with frontmatter and body.
 */
export function parseMarkdownSource(mdPath) {
    const rawContent = fs.readFileSync(mdPath, 'utf8');

    let frontmatter = {};
    let body = rawContent;

    const fmMatch = rawContent.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
    if (fmMatch) {
        try {
            frontmatter = yamlLoad(fmMatch[1]) || {};
        } catch {
            frontmatter = {};
        }
        body = fmMatch[2];
    }

    return { frontmatter, body };
}

/**
 * Ensures responsive image tiers (AVIF, WebP, 768w, 1200w) exist for an image.
 */
export async function ensureImageVariants(dir, filename) {
    const inputPath = path.join(dir, filename);
    if (!fs.existsSync(inputPath)) {
        throw new Error(`Image not found on disk: ${inputPath}`);
    }

    const ext = path.extname(filename);
    const baseName = path.basename(filename, ext);

    const avifPath = path.join(dir, `${baseName}.avif`);
    const webpPath = path.join(dir, `${baseName}.webp`);
    const avif1200Path = path.join(dir, `${baseName}-1200.avif`);
    const webp1200Path = path.join(dir, `${baseName}-1200.webp`);
    const avif768Path = path.join(dir, `${baseName}-768.avif`);
    const webp768Path = path.join(dir, `${baseName}-768.webp`);

    const image = sharp(inputPath);
    const meta = await image.metadata();
    const width = meta.width || 2048;
    const height = meta.height || 1365;

    // Generate tiers if missing
    if (!fs.existsSync(avifPath)) {
        await sharp(inputPath).avif({ quality: 65, effort: 4 }).toFile(avifPath);
    }
    if (!fs.existsSync(webpPath)) {
        await sharp(inputPath).webp({ quality: 75, effort: 4 }).toFile(webpPath);
    }
    if (!fs.existsSync(avif1200Path)) {
        await sharp(inputPath)
            .resize({ width: 1200, withoutEnlargement: true })
            .avif({ quality: 65, effort: 4 })
            .toFile(avif1200Path);
    }
    if (!fs.existsSync(webp1200Path)) {
        await sharp(inputPath)
            .resize({ width: 1200, withoutEnlargement: true })
            .webp({ quality: 75, effort: 4 })
            .toFile(webp1200Path);
    }
    if (!fs.existsSync(avif768Path)) {
        await sharp(inputPath)
            .resize({ width: 768, withoutEnlargement: true })
            .avif({ quality: 65, effort: 4 })
            .toFile(avif768Path);
    }
    if (!fs.existsSync(webp768Path)) {
        await sharp(inputPath)
            .resize({ width: 768, withoutEnlargement: true })
            .webp({ quality: 75, effort: 4 })
            .toFile(webp768Path);
    }

    // Generate ThumbHash
    const { data: rawData, info: rawInfo } = await sharp(inputPath)
        .resize(100, 100, { fit: 'inside' })
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });

    const hash = rgbaToThumbHash(rawInfo.width, rawInfo.height, rawData);
    const hashBase64 = Buffer.from(hash).toString('base64');
    const dataUrl = thumbHashToDataURL(hash);

    return {
        baseName,
        width,
        height,
        hashBase64,
        dataUrl,
    };
}

/**
 * Builds HTML picture element markup for a gallery photo.
 */
export function buildPictureElement(pageId, filename, altText, meta, isFirst) {
    const loadingAttr = isFirst ? '' : ' loading="lazy"';
    const avifSrcset = `/assets/img/${pageId}/${meta.baseName}-768.avif 768w, /assets/img/${pageId}/${meta.baseName}-1200.avif 1200w, /assets/img/${pageId}/${meta.baseName}.avif 2048w`;
    const webpSrcset = `/assets/img/${pageId}/${meta.baseName}-768.webp 768w, /assets/img/${pageId}/${meta.baseName}-1200.webp 1200w, /assets/img/${pageId}/${meta.baseName}.webp 2048w`;

    return `<div align="center">
    <picture>
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
        <img
            data-thumbhash="${meta.hashBase64}"
            style="background-image: url('${meta.dataUrl}'); background-size: cover; background-position: center;"
            src="/assets/img/${pageId}/${filename}"
            alt="${altText}"${loadingAttr}
            width="${meta.width}"
            height="${meta.height}"
            decoding="async"
        />
    </picture>
</div>`;
}

/**
 * Updates js/preloader.js to include the given project page's images.
 */
export function updatePreloader(pageId, imageFilenames) {
    const preloaderPath = path.join(ROOT_DIR, 'js', 'preloader.js');
    if (!fs.existsSync(preloaderPath)) return;

    let content = fs.readFileSync(preloaderPath, 'utf8');

    // 1. Update imageDirectories
    const dirRegex = /(this\.imageDirectories\s*=\s*\{)([\s\S]*?)(\};)/;
    if (dirRegex.test(content) && !content.includes(`${pageId}: '/assets/img/${pageId}/'`)) {
        content = content.replace(
            dirRegex,
            `$1$2    ${pageId}: '/assets/img/${pageId}/',\n            $3`
        );
    }

    // 2. Update assetSets
    const assetListStr = imageFilenames
        .map((f) => `                    '/assets/img/${pageId}/${f}',`)
        .join('\n');
    const assetBlockStr = `                ${pageId}: [\n${assetListStr}\n                ],`;

    const setRegex = new RegExp(`(${pageId}\\s*:\\s*\\[[\\s\\S]*?\\],?)`, 'm');
    if (setRegex.test(content)) {
        content = content.replace(setRegex, assetBlockStr);
    } else {
        const setsBlockRegex = /(this\.assetSets\s*=\s*\{)([\s\S]*?)(\n\s*\}\s*;)/;
        if (setsBlockRegex.test(content)) {
            content = content.replace(setsBlockRegex, `$1$2\n${assetBlockStr}$3`);
        }
    }

    fs.writeFileSync(preloaderPath, content, 'utf8');
}

/**
 * Builds a single portfolio page from markdown.
 * @param {string} pageId e.g. 'p5'
 */
export async function buildPage(pageId) {
    const cleanId = pageId.toLowerCase().trim();
    console.log(`\nBuilding portfolio page ${cleanId}...`);

    // 1. Locate markdown
    const mdPaths = [
        path.join(ROOT_DIR, 'assets', 'img', cleanId, 'index.md'),
        path.join(ROOT_DIR, cleanId, 'index.md'),
    ];
    let mdPath = mdPaths.find((p) => fs.existsSync(p));

    if (!mdPath) {
        throw new Error(
            `Source markdown file not found for ${cleanId}. Create ${mdPaths[0]} or ${mdPaths[1]}.`
        );
    }

    const { frontmatter, body } = parseMarkdownSource(mdPath);
    const imgDir = path.join(ROOT_DIR, 'assets', 'img', cleanId);
    if (!fs.existsSync(imgDir)) {
        fs.mkdirSync(imgDir, { recursive: true });
    }

    const lines = body.split('\n');
    const contentBlocks = [];
    const imageFilenames = [];
    let currentQuoteLines = [];
    let isFirstImage = true;

    async function flushQuote() {
        if (currentQuoteLines.length === 0) return;
        const rawQuote = currentQuoteLines.join('\n').trim();
        currentQuoteLines = [];

        // Separate footer / attribution HTML if present
        let footerHtml = '';
        let quoteBody = rawQuote;

        const footerMatch = quoteBody.match(
            /(<!--[\s\S]*?-->\s*)?(<footer[\s\S]*?<\/footer>)/i
        );
        if (footerMatch) {
            footerHtml = footerMatch[2].trim();
            quoteBody = quoteBody.replace(footerMatch[0], '').trim();
        }

        // Parse paragraphs
        const paragraphs = quoteBody
            .split(/\n\s*\n/)
            .filter((p) => p.trim())
            .map((p) => {
                const text = p.trim();
                if (text.startsWith('<p>') && text.endsWith('</p>')) {
                    return text;
                }
                return `<p>${text}</p>`;
            })
            .join('\n');

        const parts = [paragraphs, footerHtml].filter(Boolean);
        contentBlocks.push(`<blockquote>\n    ${parts.join('\n    ')}\n</blockquote>`);
    }

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();

        if (!line) {
            if (currentQuoteLines.length > 0) {
                currentQuoteLines.push('');
            }
            continue;
        }

        // Horizontal rule
        if (line === '---' || line === '***') {
            await flushQuote();
            contentBlocks.push('<hr />');
            continue;
        }

        // Image line: filename.ext [| custom alt text]
        const imgMatch = line.match(/^([^\s|]+\.(?:jpe?g|JPG|png|webp|avif))(?:\s*\|\s*(.*))?$/i);
        if (imgMatch) {
            await flushQuote();
            const filename = imgMatch[1].trim();
            const customAlt = imgMatch[2] ? imgMatch[2].trim() : null;
            imageFilenames.push(filename);

            const meta = await ensureImageVariants(imgDir, filename);
            const pictureHtml = buildPictureElement(
                cleanId,
                filename,
                customAlt || 'Street photography by Zhuang Liu',
                meta,
                isFirstImage
            );
            contentBlocks.push(pictureHtml);
            isFirstImage = false;
            continue;
        }

        // Blockquote
        if (line.startsWith('>')) {
            currentQuoteLines.push(line.replace(/^>\s?/, ''));
            continue;
        }

        // Continuation line inside blockquote
        if (currentQuoteLines.length > 0) {
            currentQuoteLines.push(line);
            continue;
        }

        // Raw HTML or paragraph
        await flushQuote();
        contentBlocks.push(line);
    }

    await flushQuote();

    const postContent = contentBlocks.join('\n\n');

    // 2. Prepare metadata
    const title = frontmatter.title || getProjectTitle(cleanId);
    const heading = title.toUpperCase();
    const pageTitle = heading;
    const description =
        frontmatter.description ||
        `${title} - A street photography series by Zhuang Liu capturing West Coast street culture.`;
    const BASE_KEYWORDS = [
        'Zhuang Liu',
        'Zhuang Liu photographer',
        'Zhuang Liu photography',
        'street photography',
    ];
    const extraKeywords = Array.isArray(frontmatter.keywords) ? frontmatter.keywords : [];
    const keywordsList = Array.from(new Set([...BASE_KEYWORDS, ...extraKeywords]));
    const keywords = keywordsList.join(', ');
    const canonical = `https://www.lyeutsaon.com/${cleanId}/`;
    const metaTitle = `${title} | Zhuang Liu Photography`;
    const metaDesc = description;
    const ogImage = frontmatter.ogImage
        ? frontmatter.ogImage.startsWith('.') || frontmatter.ogImage.startsWith('/')
            ? frontmatter.ogImage
            : `/assets/img/${cleanId}/${frontmatter.ogImage}`
        : '../assets/img/og-image.png';

    const pageData = {
        pageTitle,
        description,
        keywords,
        canonical,
        metaTitle,
        metaDesc,
        ogImage,
        heading,
        postContent,
    };

    // 3. Ensure target directory
    const pageDir = path.join(ROOT_DIR, cleanId);
    if (!fs.existsSync(pageDir)) {
        fs.mkdirSync(pageDir, { recursive: true });
    }

    // 4. Render HTML from canonical shell template
    const template = fs.readFileSync(TEMPLATE_PATH, 'utf8');
    const allPages = getProjectPages();
    if (!allPages.includes(cleanId)) {
        allPages.push(cleanId);
        allPages.sort((a, b) => parseInt(a.slice(1), 10) - parseInt(b.slice(1), 10));
    }

    const rawHtml = renderProjectPage(cleanId, pageData, allPages, template);
    const htmlPath = path.join(pageDir, 'index.html');
    const formattedHtml = await formatHtml(rawHtml, htmlPath);

    fs.writeFileSync(htmlPath, formattedHtml, 'utf8');
    console.log(`Generated ${htmlPath}`);

    // 5. Update index.html navigation
    await syncIndexNav(allPages);

    // 6. Update preloader
    updatePreloader(cleanId, imageFilenames);

    return {
        htmlPath,
        imageCount: imageFilenames.length,
    };
}

// Direct CLI invocation
if (process.argv[1] === fileURLToPath(import.meta.url)) {
    const pageId = process.argv[2];
    if (!pageId) {
        console.error('Usage: node scripts/build-page.mjs <pageId> (e.g. p5)');
        process.exit(1);
    }

    buildPage(pageId)
        .then(() => {
            console.log('Build completed successfully.');
            process.exit(0);
        })
        .catch((err) => {
            console.error('Build failed:', err);
            process.exit(1);
        });
}
