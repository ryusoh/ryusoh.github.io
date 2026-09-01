/**
 * Gallery & Markdown Parser Module for Sequence Inspection
 * Resolves gallery directories, parses index.md markdown and frontmatter,
 * and analyzes images via Sharp.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';
import { load as yamlLoad } from 'js-yaml';
import {
    rgbToLab,
    calculatePairwiseTransitions,
    analyzeRespiratoryRhythm,
    evaluateCandidatePlacements,
} from './metrics.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
export const REPO_ROOT = path.resolve(__dirname, '../../../..');

/**
 * Resolves gallery path from arguments.
 * @param {string} arg - e.g. "p5", "5", "assets/img/p5/index.md"
 * @returns {{ pageId: string, dir: string, mdPath: string }}
 */
export function resolveGalleryPath(arg) {
    if (!arg) {
        throw new Error(
            'Please provide a gallery identifier or path (e.g. "p5" or "assets/img/p5/index.md").'
        );
    }

    let clean = String(arg).trim();

    // Check if the argument contains a pN pattern (e.g. "p2", "2", "p2/index.html", "assets/img/p2/index.md")
    const pMatch = clean.match(/(?:^|\/)(p\d+)(?:\/|\.|$)/i) || clean.match(/^(\d+)$/);
    if (pMatch) {
        const num =
            pMatch[1].startsWith('p') || pMatch[1].startsWith('P') ? pMatch[1] : `p${pMatch[1]}`;
        const pageId = num.toLowerCase();
        return {
            pageId,
            dir: path.join(REPO_ROOT, 'assets', 'img', pageId),
            mdPath: path.join(REPO_ROOT, 'assets', 'img', pageId, 'index.md'),
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

    const pageId = clean.replace(/[^a-zA-Z0-9_-]/g, '').toLowerCase();
    return {
        pageId,
        dir: path.join(REPO_ROOT, 'assets', 'img', pageId),
        mdPath: path.join(REPO_ROOT, 'assets', 'img', pageId, 'index.md'),
    };
}

/**
 * Parse index.md to extract frontmatter, items (images, quotes), and layout structure.
 * @param {string} mdPath
 * @returns {{ frontmatter: object, entries: Array }}
 */
export function parseGalleryMarkdown(mdPath) {
    if (!fs.existsSync(mdPath)) {
        return { frontmatter: {}, entries: [] };
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
 * Extract image metadata, color histogram, CIELAB coordinates, and luminance.
 * @param {string} imagePath
 * @returns {Promise<object|null>}
 */
export async function analyzeImage(imagePath) {
    if (!fs.existsSync(imagePath)) {
        return null;
    }

    try {
        const image = sharp(imagePath);
        const metadata = await image.metadata();
        // Downscale before stats() so colorimetry is computed on a tiny thumbnail
        // instead of the full-resolution file. Width/height remain original.
        const stats = await image.clone().resize(64, 64, { fit: 'inside' }).stats();

        const width = metadata.width || 0;
        const height = metadata.height || 0;
        const ratio = height > 0 ? (width / height).toFixed(2) : '1.00';
        let orientation = 'square';
        if (width > height * 1.05) orientation = 'landscape';
        else if (height > width * 1.05) orientation = 'portrait';

        const [rStat, gStat, bStat] = stats.channels;
        const avgR = rStat ? Math.round(rStat.mean) : 128;
        const avgG = gStat ? Math.round(gStat.mean) : avgR;
        const avgB = bStat ? Math.round(bStat.mean) : avgR;
        const luminance = Math.round(0.2126 * avgR + 0.7152 * avgG + 0.0722 * avgB);

        const lab = rgbToLab(avgR, avgG, avgB);

        let tonalKey = 'mid-tone';
        let breathType = 'Neutral';
        if (luminance < 75) {
            tonalKey = 'low-key (dark/moody)';
            breathType = 'Exhalation';
        } else if (luminance > 135) {
            tonalKey = 'high-key (bright/airy)';
            breathType = 'Inhalation';
        }

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
            breathType,
            colorTemperature: temp,
            avgRGB: [avgR, avgG, avgB],
            lab,
        };
    } catch {
        return null;
    }
}

/**
 * Resolves the optimal lightweight preview image filename (e.g. -768.webp or -1200.webp)
 * to keep Markdown report file size minimal and compatible with mobile/iOS webviews.
 * @param {string} dir
 * @param {string} baseFilename
 * @returns {string}
 */
export function resolvePreviewFilename(dir, baseFilename) {
    if (!baseFilename) return baseFilename;
    const { name: stem } = path.parse(baseFilename);
    const candidates = [
        `${stem}-768.webp`,
        `${stem}-768.jpg`,
        `${stem}-1200.webp`,
        `${stem}-1200.jpg`,
        baseFilename,
    ];
    for (const cand of candidates) {
        if (fs.existsSync(path.join(dir, cand))) {
            return cand;
        }
    }
    return baseFilename;
}

/**
 * Inspects a gallery and computes all metrics.
 * @param {string} pageArg
 * @returns {Promise<object>}
 */
export async function inspectGallery(pageArg) {
    const { pageId, dir, mdPath } = resolveGalleryPath(pageArg);

    if (!fs.existsSync(dir)) {
        throw new Error(`Gallery directory not found: ${dir}`);
    }

    const { frontmatter, entries } = parseGalleryMarkdown(mdPath);

    // Scan directory for base source images (responsive tiers excluded); used both
    // for the cold-start fallback below and for unreferenced outtake detection.
    const allFiles = fs.readdirSync(dir);
    const candidateExts = /\.(jpe?g|png)$/i;
    const isBaseSource = (f) =>
        candidateExts.test(f) && !f.includes('-768') && !f.includes('-1200');

    const sourceImagesOnDisk = allFiles.filter(isBaseSource).sort();

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

    // Cold-start fallback: index.md is missing or references no images (e.g. a
    // text-only poem), so treat the on-disk base sources in filename order as the
    // baseline sequence to analyze.
    const sequenceSource = sequencedImages.length === 0 ? 'directory' : 'markdown';
    if (sequenceSource === 'directory') {
        for (const f of sourceImagesOnDisk) {
            const analysis = await analyzeImage(path.join(dir, f));
            sequencedImages.push({
                sequenceOrder: sequenceIndex++,
                filename: f,
                caption: null,
                exists: !!analysis,
                analysis: analysis || { filename: f, error: 'File missing on disk' },
            });
        }
    }

    // Pairwise transition analysis across current sequence
    const transitions = calculatePairwiseTransitions(sequencedImages);

    // Respiratory Rhythm (Inhalation / Exhalation) with Caesura interlude awareness
    const respiratory = analyzeRespiratoryRhythm(sequencedImages, quotes);

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

    const candidateEvaluations = evaluateCandidatePlacements(sequencedImages, outtakes, quotes);

    const outputData = {
        gallery: {
            pageId,
            directory: path.relative(REPO_ROOT, dir),
            markdownPath: path.relative(REPO_ROOT, mdPath),
            title: frontmatter.title || 'Untitled',
            description: frontmatter.description || '',
            sequenceSource,
            totalImages: sequencedImages.length,
            totalOuttakes: outtakes.length,
            totalQuotes: quotes.length,
        },
        respiratoryRhythm: respiratory,
        transitions,
        images: sequencedImages,
        quotes,
        outtakes,
        candidateEvaluations,
    };

    return outputData;
}
