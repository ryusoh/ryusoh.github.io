#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';
import { load as yamlLoad } from 'js-yaml';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '../../../..');

/**
 * Resolves gallery path from arguments.
 * Accepts: "p5", "5", "assets/img/p5", "assets/img/p5/index.md", etc.
 */
function resolveGalleryPath(arg) {
    if (!arg) {
        throw new Error(
            'Please provide a gallery identifier or path (e.g. "p5" or "assets/img/p5/index.md").'
        );
    }

    let clean = String(arg).trim();
    if (/^\d+$/.test(clean)) {
        clean = `p${clean}`;
    }

    if (/^p\d+$/i.test(clean)) {
        return {
            pageId: clean.toLowerCase(),
            dir: path.join(REPO_ROOT, 'assets', 'img', clean.toLowerCase()),
            mdPath: path.join(REPO_ROOT, 'assets', 'img', clean.toLowerCase(), 'index.md'),
        };
    }

    let resolvedPath = path.resolve(REPO_ROOT, clean);
    if (fs.existsSync(resolvedPath) && fs.statSync(resolvedPath).isDirectory()) {
        const mdCandidate = path.join(resolvedPath, 'index.md');
        const pageId = path.basename(resolvedPath).toLowerCase();
        return {
            pageId,
            dir: resolvedPath,
            mdPath: mdCandidate,
        };
    }

    if (fs.existsSync(resolvedPath) && fs.statSync(resolvedPath).isFile()) {
        const dir = path.dirname(resolvedPath);
        const pageId = path.basename(dir).toLowerCase();
        return {
            pageId,
            dir,
            mdPath: resolvedPath,
        };
    }

    // Default fallback attempt
    const pageId = clean.replace(/[^a-zA-Z0-9_-]/g, '').toLowerCase();
    return {
        pageId,
        dir: path.join(REPO_ROOT, 'assets', 'img', pageId),
        mdPath: path.join(REPO_ROOT, 'assets', 'img', pageId, 'index.md'),
    };
}

/**
 * Parse index.md to extract frontmatter, items (images, quotes), and layout structure.
 */
function parseGalleryMarkdown(mdPath) {
    if (!fs.existsSync(mdPath)) {
        return { frontmatter: {}, entries: [], rawQuotes: [] };
    }

    const content = fs.readFileSync(mdPath, 'utf8');
    let frontmatter = {};
    let body = content;

    const fmMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
    if (fmMatch) {
        try {
            frontmatter = yamlLoad(fmMatch[1]) || {};
        } catch {
            frontmatter = {};
        }
        body = fmMatch[2];
    }

    const lines = body.split(/\r?\n/);
    const entries = [];
    let currentQuote = [];

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();

        if (trimmed.startsWith('>')) {
            currentQuote.push(trimmed.replace(/^>\s?/, ''));
            continue;
        } else if (currentQuote.length > 0) {
            entries.push({
                type: 'quote',
                content: currentQuote.join('\n').trim(),
            });
            currentQuote = [];
        }

        if (!trimmed || trimmed === '---') {
            continue;
        }

        // Image line: e.g. "DSCF0001.jpg | caption"
        const [filename, ...captionParts] = trimmed.split('|');
        const cleanFilename = filename.trim();
        const caption = captionParts.join('|').trim();

        if (/\.(jpe?g|png|webp|avif)$/i.test(cleanFilename)) {
            entries.push({
                type: 'image',
                filename: cleanFilename,
                caption: caption || null,
            });
        }
    }

    if (currentQuote.length > 0) {
        entries.push({
            type: 'quote',
            content: currentQuote.join('\n').trim(),
        });
    }

    return { frontmatter, entries };
}

/**
 * Extract image metadata and color / luminance analysis.
 */
async function analyzeImage(imagePath) {
    if (!fs.existsSync(imagePath)) {
        return null;
    }

    try {
        const image = sharp(imagePath);
        const metadata = await image.metadata();
        const stats = await image.stats();

        const width = metadata.width || 0;
        const height = metadata.height || 0;
        const ratio = height > 0 ? (width / height).toFixed(2) : '1.00';
        let orientation = 'square';
        if (width > height * 1.05) orientation = 'landscape';
        else if (height > width * 1.05) orientation = 'portrait';

        // Luminance calculation: standard Rec. 709 weights
        const [rStat, gStat, bStat] = stats.channels;
        const avgR = rStat ? rStat.mean : 128;
        const avgG = gStat ? gStat.mean : 128;
        const avgB = bStat ? bStat.mean : 128;
        const luminance = Math.round(0.2126 * avgR + 0.7152 * avgG + 0.0722 * avgB);

        // Tonal & temperature character
        let tonalKey = 'mid-tone';
        if (luminance < 70) tonalKey = 'low-key (dark/moody)';
        else if (luminance > 165) tonalKey = 'high-key (bright/airy)';

        let temp = 'neutral';
        if (avgR > avgB + 15) temp = 'warm / golden / amber';
        else if (avgB > avgR + 15) temp = 'cool / blue / cyan';

        return {
            filename: path.basename(imagePath),
            width,
            height,
            aspectRatio: ratio,
            orientation,
            format: metadata.format,
            luminance,
            tonalKey,
            colorTemperature: temp,
            avgRGB: [Math.round(avgR), Math.round(avgG), Math.round(avgB)],
        };
    } catch {
        return null;
    }
}

/**
 * Main execution.
 */
async function main() {
    const args = process.argv.slice(2);
    const jsonOutput = args.includes('--json');
    const targetArg = args.find((a) => !a.startsWith('--')) || 'p5';

    const { pageId, dir, mdPath } = resolveGalleryPath(targetArg);

    if (!fs.existsSync(dir)) {
        console.error(`Gallery directory not found: ${dir}`);
        process.exit(1);
    }

    const { frontmatter, entries } = parseGalleryMarkdown(mdPath);

    // Analyze images referenced in markdown
    const sequencedImages = [];
    const quotes = [];
    let sequenceIndex = 1;

    for (const item of entries) {
        if (item.type === 'quote') {
            quotes.push({
                afterImageIndex: sequencedImages.length,
                content: item.content,
            });
        } else if (item.type === 'image') {
            const imgPath = path.join(dir, item.filename);
            const analysis = await analyzeImage(imgPath);
            sequencedImages.push({
                sequenceOrder: sequenceIndex++,
                filename: item.filename,
                caption: item.caption,
                exists: !!analysis,
                analysis: analysis || { filename: item.filename, error: 'File missing on disk' },
            });
        }
    }

    // Scan directory for all image files to detect unreferenced outtakes
    const allFiles = fs.readdirSync(dir);
    const candidateExts = /\.(jpe?g|png)$/i;
    const isBaseSource = (f) =>
        candidateExts.test(f) && !f.includes('-768') && !f.includes('-1200');

    const sourceImagesOnDisk = allFiles.filter(isBaseSource);
    const sequencedFilenames = new Set(sequencedImages.map((img) => img.filename.toLowerCase()));

    const outtakes = [];
    for (const f of sourceImagesOnDisk) {
        if (!sequencedFilenames.has(f.toLowerCase())) {
            const analysis = await analyzeImage(path.join(dir, f));
            outtakes.push({
                filename: f,
                analysis,
            });
        }
    }

    const outputData = {
        gallery: {
            pageId,
            directory: path.relative(REPO_ROOT, dir),
            markdownPath: path.relative(REPO_ROOT, mdPath),
            title: frontmatter.title || 'Untitled',
            description: frontmatter.description || '',
            totalImages: sequencedImages.length,
            totalOuttakes: outtakes.length,
            totalQuotes: quotes.length,
        },
        images: sequencedImages,
        quotes,
        outtakes,
    };

    if (jsonOutput) {
        console.log(JSON.stringify(outputData, null, 2));
        return;
    }

    // Human-readable formatted terminal output
    console.log(`\n======================================================================`);
    console.log(
        `  GALLERY SEQUENCE INSPECTION: ${pageId.toUpperCase()} - "${outputData.gallery.title}"`
    );
    console.log(`======================================================================`);
    console.log(`Directory:   ${outputData.gallery.directory}`);
    console.log(`Markdown:    ${outputData.gallery.markdownPath}`);
    console.log(
        `Images:      ${outputData.gallery.totalImages} active | ${outtakes.length} outtakes`
    );
    console.log(`Quotes:      ${quotes.length} interludes`);
    console.log(`----------------------------------------------------------------------\n`);

    console.log(`CURRENT SEQUENCE ORDER & VISUAL SIGNATURES:`);
    for (const img of sequencedImages) {
        const a = img.analysis;
        if (!img.exists) {
            console.log(
                ` [${String(img.sequenceOrder).padStart(2, ' ')}] ❌ MISSING: ${img.filename}`
            );
            continue;
        }

        const orientBadge = a.orientation.toUpperCase().padEnd(9, ' ');
        const dimStr = `${a.width}x${a.height} (${a.aspectRatio})`.padEnd(17, ' ');
        const lumStr = `Lum: ${String(a.luminance).padStart(3, ' ')} (${a.tonalKey})`.padEnd(
            28,
            ' '
        );
        const tempStr = `Temp: ${a.colorTemperature}`;

        console.log(
            ` [${String(img.sequenceOrder).padStart(2, ' ')}] ${img.filename.padEnd(28, ' ')} | ${orientBadge} | ${dimStr} | ${lumStr} | ${tempStr}`
        );
        if (img.caption) {
            console.log(`      ↳ Caption: ${img.caption}`);
        }

        // Print quotes that appear after this image
        const matchingQuotes = quotes.filter((q) => q.afterImageIndex === img.sequenceOrder);
        for (const q of matchingQuotes) {
            const preview = q.content.replace(/\n/g, ' / ').slice(0, 75);
            console.log(`      📜 [Interlude Quote]: "${preview}..."`);
        }
    }

    if (outtakes.length > 0) {
        console.log(`\n----------------------------------------------------------------------`);
        console.log(`UNSEQUENCED CANDIDATES / OUTTAKES IN DIRECTORY (${outtakes.length}):`);
        for (const out of outtakes) {
            const a = out.analysis;
            if (a) {
                console.log(
                    ` • ${out.filename.padEnd(28, ' ')} | ${a.orientation.toUpperCase()} | ${a.width}x${a.height} | Lum: ${a.luminance} (${a.tonalKey})`
                );
            } else {
                console.log(` • ${out.filename}`);
            }
        }
    }
    console.log(`\n======================================================================\n`);
}

main().catch((err) => {
    console.error('Error inspecting gallery:', err);
    process.exit(1);
});
