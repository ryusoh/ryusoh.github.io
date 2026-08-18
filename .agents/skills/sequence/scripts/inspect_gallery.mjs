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
 * Converts sRGB [0-255] to CIELAB { L, a, b } (D65 illuminant).
 */
export function rgbToLab(r, g, b) {
    // 1. Convert to linear sRGB
    let rLinear = r / 255;
    let gLinear = g / 255;
    let bLinear = b / 255;

    rLinear = rLinear > 0.04045 ? Math.pow((rLinear + 0.055) / 1.055, 2.4) : rLinear / 12.92;
    gLinear = gLinear > 0.04045 ? Math.pow((gLinear + 0.055) / 1.055, 2.4) : gLinear / 12.92;
    bLinear = bLinear > 0.04045 ? Math.pow((bLinear + 0.055) / 1.055, 2.4) : bLinear / 12.92;

    // 2. Convert to XYZ (D65 standard)
    let x = (rLinear * 0.4124 + gLinear * 0.3576 + bLinear * 0.1805) / 0.95047;
    let y = (rLinear * 0.2126 + gLinear * 0.7152 + bLinear * 0.0722) / 1.0;
    let z = (rLinear * 0.0193 + gLinear * 0.1192 + bLinear * 0.9505) / 1.08883;

    // 3. Convert XYZ to CIELAB
    const f = (val) => (val > 0.008856 ? Math.cbrt(val) : 7.787 * val + 16 / 116);
    const fx = f(x);
    const fy = f(y);
    const fz = f(z);

    const L = Math.max(0, 116 * fy - 16);
    const a = 500 * (fx - fy);
    const bLab = 200 * (fy - fz);

    return {
        L: Number(L.toFixed(2)),
        a: Number(a.toFixed(2)),
        b: Number(bLab.toFixed(2)),
    };
}

/**
 * Computes CIELAB Delta E (CIE76 color difference).
 */
export function deltaE(lab1, lab2) {
    if (!lab1 || !lab2) return 0;
    const dL = lab1.L - lab2.L;
    const da = lab1.a - lab2.a;
    const db = lab1.b - lab2.b;
    return Number(Math.sqrt(dL * dL + da * da + db * db).toFixed(2));
}

/**
 * Calculates pairwise transition cost between two images.
 * Evaluates chromatic bridge (Delta E), luminance contrast step, and aspect ratio shift.
 */
export function calculateTransitionCost(imgA, imgB) {
    if (!imgA || !imgB || !imgA.analysis || !imgB.analysis) {
        return {
            totalCost: 0,
            deltaE: 0,
            deltaLum: 0,
            deltaAspect: 0,
        };
    }
    const a = imgA.analysis;
    const b = imgB.analysis;

    const dE = deltaE(a.lab, b.lab);
    const dLum = Math.abs(a.luminance - b.luminance);
    const aAspect = Number(a.aspectRatio) || 1.0;
    const bAspect = Number(b.aspectRatio) || 1.0;
    const dAspect = Math.abs(aAspect - bAspect);

    // Weighted cost normalized into 0-100 score
    const chromaticCost = Math.min(100, (dE / 80) * 100);
    const lumStepCost = (dLum / 255) * 100;
    const aspectCost = Math.min(100, (dAspect / 1.0) * 100);

    const chromaticComponent = Number((chromaticCost * 0.45).toFixed(1));
    const lumComponent = Number((lumStepCost * 0.35).toFixed(1));
    const aspectComponent = Number((aspectCost * 0.2).toFixed(1));

    const totalCost = Number(
        (chromaticCost * 0.45 + lumStepCost * 0.35 + aspectCost * 0.2).toFixed(1)
    );

    return {
        totalCost,
        deltaE: dE,
        deltaLum: dLum,
        deltaAspect: Number(dAspect.toFixed(2)),
        chromaticComponent,
        lumComponent,
        aspectComponent,
    };
}

/**
 * Calculates pairwise transitions across an image sequence.
 * @param {Array} images
 */
export function calculatePairwiseTransitions(images) {
    const transitions = [];
    for (let i = 0; i < images.length - 1; i++) {
        const trans = calculateTransitionCost(images[i], images[i + 1]);
        transitions.push({
            from: images[i].filename,
            to: images[i + 1].filename,
            ...trans,
        });
    }
    return transitions;
}

/**
 * Analyzes sequence respiratory rhythm (Kawauchi Inhalation / Exhalation breathing cycles).
 */
export function analyzeRespiratoryRhythm(images) {
    const sequence = [];
    let consecutiveInhalations = 0;
    let consecutiveExhalations = 0;
    const anomalies = [];

    for (let i = 0; i < images.length; i++) {
        const img = images[i];
        const lum = img.analysis?.luminance ?? 128;
        let breath = 'Neutral (Grounding)';

        if (lum >= 135) {
            breath = 'Inhalation (Luminous/Expansive)';
            consecutiveInhalations++;
            consecutiveExhalations = 0;
        } else if (lum <= 75) {
            breath = 'Exhalation (Low-key/Dense)';
            consecutiveExhalations++;
            consecutiveInhalations = 0;
        } else {
            consecutiveInhalations = 0;
            consecutiveExhalations = 0;
        }

        if (consecutiveInhalations >= 3) {
            anomalies.push({
                index: i + 1,
                filename: img.filename,
                type: 'Hyperventilation',
                detail: `${consecutiveInhalations} consecutive high-key inhalation frames—consider a darker grounding anchor.`,
            });
        }
        if (consecutiveExhalations >= 3) {
            anomalies.push({
                index: i + 1,
                filename: img.filename,
                type: 'Suffocating Weight',
                detail: `${consecutiveExhalations} consecutive low-key exhalation frames—consider an open luminous interlude.`,
            });
        }

        sequence.push({
            order: i + 1,
            filename: img.filename,
            luminance: lum,
            breath,
        });
    }

    let inhalations = 0;
    let exhalations = 0;
    let neutrals = 0;
    for (const s of sequence) {
        if (s.breath.startsWith('Inhalation')) inhalations++;
        else if (s.breath.startsWith('Exhalation')) exhalations++;
        else neutrals++;
    }

    return {
        sequence,
        anomalies,
        rhythmScore: Math.max(0, 100 - anomalies.length * 15),
        inhalations,
        exhalations,
        neutrals,
    };
}

/**
 * Resolves gallery path from arguments.
 */
export function resolveGalleryPath(arg) {
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
 */
export async function analyzeImage(imagePath) {
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
 * Inspects a gallery and computes all metrics.
 * @param {string} pageArg
 */
export async function inspectGallery(pageArg) {
    const { pageId, dir, mdPath } = resolveGalleryPath(pageArg);

    if (!fs.existsSync(dir)) {
        throw new Error(`Gallery directory not found: ${dir}`);
    }

    const { frontmatter, entries } = parseGalleryMarkdown(mdPath);

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

    // Pairwise transition analysis across current sequence
    const transitions = calculatePairwiseTransitions(sequencedImages);

    // Respiratory Rhythm (Inhalation / Exhalation)
    const respiratory = analyzeRespiratoryRhythm(sequencedImages);

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
        respiratoryRhythm: respiratory,
        transitions,
        images: sequencedImages,
        quotes,
        outtakes,
    };

    return outputData;
}

/**
 * Resolves the optimal lightweight preview image filename (e.g. -768.webp or -1200.webp)
 * to keep Markdown report file size minimal and compatible with mobile/iOS webviews.
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
 * Escapes XML special characters for SVG content.
 */
export function escapeXml(unsafe) {
    if (typeof unsafe !== 'string') return String(unsafe ?? '');
    return unsafe
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

/**
 * Generates an academic publication-standard (arXiv / IEEE style) SVG visualization.
 * Uses clean white paper background, classical serif and scientific typography,
 * precision inward tick spines, muted publication palettes, and academic captions.
 *
 * @param {object} params
 * @param {object} params.gallery
 * @param {Array} params.images
 * @param {Array} params.transitions
 * @param {object} params.respiratory
 * @param {Array} params.quotes
 * @param {string} [params.archetype]
 * @returns {string} Standalone SVG XML string
 */
/**
 * Generates standalone Figure 1: Photometric Luminance Waveform & Respiratory Rhythm SVG (IEEE Publication Standard).
 */
export function generateLuminanceWaveformSvg({
    gallery = {},
    images = [],
    respiratory = {},
    quotes = [],
}) {
    const width = 880;
    const height = 280;
    const leftMargin = 68;
    const rightMargin = 740;
    const plotWidth = rightMargin - leftMargin; // 672px
    const plotTop = 32;
    const plotBottom = 224;
    const plotHeight = plotBottom - plotTop; // 192px

    let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="100%" height="100%">\n`;
    svg += `  <style>\n`;
    svg += `    .paper-bg { fill: #ffffff; }\n`;
    svg += `    .spine-box { fill: #ffffff; stroke: #0f172a; stroke-width: 0.85; }\n`;
    svg += `    .academic-grid { stroke: #f1f5f9; stroke-width: 0.6; stroke-dasharray: 2 3; }\n`;
    svg += `    .tick-line { stroke: #0f172a; stroke-width: 0.85; }\n`;
    svg += `    .fig-heading { fill: #0f172a; font-family: "Times New Roman", Times, "Nimbus Roman No9 L", "Liberation Serif", serif; font-size: 12.5px; font-weight: bold; letter-spacing: 0.2px; }\n`;
    svg += `    .axis-title { fill: #334155; font-family: "Times New Roman", Times, "Nimbus Roman No9 L", "Liberation Serif", serif; font-size: 10.5px; font-style: italic; }\n`;
    svg += `    .tick-label { fill: #334155; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; font-size: 9px; font-variant-numeric: tabular-nums; }\n`;
    svg += `    .threshold-label { fill: #475569; font-family: "Times New Roman", Times, "Nimbus Roman No9 L", "Liberation Serif", serif; font-size: 8.5px; font-style: italic; }\n`;
    svg += `  </style>\n\n`;

    svg += `  <rect width="${width}" height="${height}" class="paper-bg" />\n\n`;
    svg += `  <text x="${leftMargin}" y="20" class="fig-heading">Figure 1: Photometric Luminance Waveform L*(t) ∈ [0, 255] and Respiratory Rhythm</text>\n`;
    svg += `  <rect x="${leftMargin}" y="${plotTop}" width="${plotWidth}" height="${plotHeight}" class="spine-box" />\n`;

    const yZoneInhale = plotBottom - (135 / 255) * plotHeight;
    const yZoneGround = plotBottom - (75 / 255) * plotHeight;

    // Academic publication shaded zones with subtle boundary borders
    svg += `  <rect x="${leftMargin}" y="${plotTop}" width="${plotWidth}" height="${yZoneInhale - plotTop}" fill="#f0f7ff" stroke="none" />\n`;
    svg += `  <rect x="${leftMargin}" y="${yZoneGround}" width="${plotWidth}" height="${plotBottom - yZoneGround}" fill="#f8fafc" stroke="none" />\n`;

    svg += `  <line x1="${leftMargin}" y1="${yZoneInhale}" x2="${rightMargin}" y2="${yZoneInhale}" stroke="#93c5fd" stroke-width="0.75" stroke-dasharray="3 3" />\n`;
    svg += `  <text x="${rightMargin + 8}" y="${yZoneInhale + 3}" class="threshold-label" fill="#2b5c8f" text-anchor="start">Inhalation (L* ≥ 135)</text>\n`;

    svg += `  <line x1="${leftMargin}" y1="${yZoneGround}" x2="${rightMargin}" y2="${yZoneGround}" stroke="#cbd5e1" stroke-width="0.75" stroke-dasharray="3 3" />\n`;
    svg += `  <text x="${rightMargin + 8}" y="${yZoneGround + 3}" class="threshold-label" fill="#475569" text-anchor="start">Exhalation (L* ≤ 75)</text>\n`;

    svg += `  <text transform="translate(24, ${plotTop + plotHeight / 2}) rotate(-90)" class="axis-title" text-anchor="middle">Luminance L* ∈ [0, 255]</text>\n`;

    const lumTicks = [
        { val: 255, y: plotTop },
        { val: 135, y: yZoneInhale },
        { val: 75, y: yZoneGround },
        { val: 0, y: plotBottom },
    ];

    for (const t of lumTicks) {
        svg += `  <line x1="${leftMargin}" y1="${t.y}" x2="${rightMargin}" y2="${t.y}" class="academic-grid" />\n`;
        // Inward tick marks on left and right borders
        svg += `  <line x1="${leftMargin}" y1="${t.y}" x2="${leftMargin + 4.5}" y2="${t.y}" class="tick-line" />\n`;
        svg += `  <line x1="${rightMargin - 4.5}" y1="${t.y}" x2="${rightMargin}" y2="${t.y}" class="tick-line" />\n`;
        svg += `  <text x="${leftMargin - 6}" y="${t.y + 3}" class="tick-label" text-anchor="end">${t.val}</text>\n`;
    }

    const numImages = images.length;
    const f1Coords = [];
    for (let i = 0; i < numImages; i++) {
        const x =
            numImages > 1
                ? leftMargin + 20 + (i * (plotWidth - 40)) / (numImages - 1)
                : leftMargin + plotWidth / 2;
        const lum = Math.min(255, Math.max(0, images[i]?.analysis?.luminance ?? 128));
        const y = plotBottom - (lum / 255) * plotHeight;
        f1Coords.push({ x, y, lum, order: i + 1, filename: images[i]?.filename || `img_${i + 1}` });
    }

    if (f1Coords.length > 1) {
        let linePath = `M ${f1Coords[0].x} ${f1Coords[0].y}`;
        for (let i = 1; i < f1Coords.length; i++) {
            linePath += ` L ${f1Coords[i].x} ${f1Coords[i].y}`;
        }
        // Refined academic slate-navy stroke with subtle 1.4px line weight
        svg += `  <path d="${linePath}" fill="none" stroke="#2b5c8f" stroke-width="1.4" stroke-linejoin="round" stroke-linecap="round" />\n`;
    }

    for (const q of quotes) {
        const afterIdx = q.afterImageIndex;
        if (afterIdx >= 1 && afterIdx <= numImages) {
            let caesuraX;
            if (afterIdx < numImages && f1Coords[afterIdx - 1] && f1Coords[afterIdx]) {
                caesuraX = (f1Coords[afterIdx - 1].x + f1Coords[afterIdx].x) / 2;
            } else if (f1Coords[afterIdx - 1]) {
                caesuraX = Math.min(rightMargin - 15, f1Coords[afterIdx - 1].x + 15);
            }
            if (caesuraX !== undefined) {
                // Strictly mathematically contained inside spine box [plotTop, plotBottom] with clean label badge
                svg += `  <line x1="${caesuraX}" y1="${plotTop}" x2="${caesuraX}" y2="${plotBottom}" stroke="#475569" stroke-width="0.75" stroke-dasharray="3 3" />\n`;
                svg += `  <rect x="${caesuraX - 22}" y="${plotTop + 4}" width="44" height="13" fill="#ffffff" stroke="#cbd5e1" stroke-width="0.5" rx="2" />\n`;
                svg += `  <text x="${caesuraX}" y="${plotTop + 13}" class="threshold-label" fill="#334155" text-anchor="middle">Caesura</text>\n`;
            }
        }
    }

    for (const pt of f1Coords) {
        svg += `  <circle cx="${pt.x}" cy="${pt.y}" r="3.0" fill="#2b5c8f" stroke="#ffffff" stroke-width="1.0" />\n`;
        svg += `  <line x1="${pt.x}" y1="${plotBottom - 4.5}" x2="${pt.x}" y2="${plotBottom}" class="tick-line" />\n`;
        svg += `  <text x="${pt.x}" y="${plotBottom + 14}" class="tick-label" text-anchor="middle">${pt.order}</text>\n`;
    }

    svg += `  <text x="${leftMargin + plotWidth / 2}" y="${plotBottom + 34}" class="axis-title" text-anchor="middle">Sequence Frame Index (i)</text>\n`;
    svg += `</svg>\n`;
    return svg;
}

/**
 * Generates standalone Figure 2: Hamiltonian Pairwise Transition Tension SVG (IEEE Publication Standard).
 */
export function generateTransitionTensionSvg({ gallery = {}, transitions = [] }) {
    const width = 880;
    const height = 280;
    const leftMargin = 68;
    const rightMargin = 740;
    const plotWidth = rightMargin - leftMargin; // 672px
    const plotTop = 32;
    const plotBottom = 224;
    const plotHeight = plotBottom - plotTop; // 192px

    let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="100%" height="100%">\n`;
    svg += `  <style>\n`;
    svg += `    .paper-bg { fill: #ffffff; }\n`;
    svg += `    .spine-box { fill: #ffffff; stroke: #0f172a; stroke-width: 0.85; }\n`;
    svg += `    .academic-grid { stroke: #f1f5f9; stroke-width: 0.6; stroke-dasharray: 2 3; }\n`;
    svg += `    .tick-line { stroke: #0f172a; stroke-width: 0.85; }\n`;
    svg += `    .fig-heading { fill: #0f172a; font-family: "Times New Roman", Times, "Nimbus Roman No9 L", "Liberation Serif", serif; font-size: 12.5px; font-weight: bold; letter-spacing: 0.2px; }\n`;
    svg += `    .axis-title { fill: #334155; font-family: "Times New Roman", Times, "Nimbus Roman No9 L", "Liberation Serif", serif; font-size: 10.5px; font-style: italic; }\n`;
    svg += `    .tick-label { fill: #334155; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; font-size: 9px; font-variant-numeric: tabular-nums; }\n`;
    svg += `    .threshold-label { fill: #475569; font-family: "Times New Roman", Times, "Nimbus Roman No9 L", "Liberation Serif", serif; font-size: 8.5px; font-style: italic; }\n`;
    svg += `    .legend-text { fill: #1e293b; font-family: "Times New Roman", Times, "Nimbus Roman No9 L", "Liberation Serif", serif; font-size: 8.5px; }\n`;
    svg += `  </style>\n\n`;

    svg += `  <rect width="${width}" height="${height}" class="paper-bg" />\n\n`;

    // Figure Heading: Clean single line above spine
    svg += `  <text x="${leftMargin}" y="20" class="fig-heading">Figure 2: Pairwise Hamiltonian Transition Tension Decomposition</text>\n`;
    svg += `  <rect x="${leftMargin}" y="${plotTop}" width="${plotWidth}" height="${plotHeight}" class="spine-box" />\n`;
    svg += `  <text transform="translate(24, ${plotTop + plotHeight / 2}) rotate(-90)" class="axis-title" text-anchor="middle">Transition Tension C(i, i+1) ∈ [0, 100]</text>\n`;

    const yShock = plotBottom - 0.5 * plotHeight;
    const yHarmonic = plotBottom - 0.25 * plotHeight;

    const costTicks = [
        { val: 100, y: plotTop },
        { val: 75, y: plotTop + plotHeight * 0.25 },
        {
            val: 50,
            y: yShock,
            dash: true,
            stroke: '#991b1b',
            label: 'Montage shock (C = 50)',
        },
        {
            val: 25,
            y: yHarmonic,
            dash: true,
            stroke: '#15803d',
            label: 'Harmonic baseline (C = 25)',
        },
        { val: 0, y: plotBottom },
    ];

    for (const t of costTicks) {
        if (t.dash) {
            svg += `  <line x1="${leftMargin}" y1="${t.y}" x2="${rightMargin}" y2="${t.y}" stroke="${t.stroke}" stroke-width="0.75" stroke-dasharray="3 3" />\n`;
            if (t.label) {
                // Threshold labels anchored in right margin gutter OUTSIDE the plot spine
                svg += `  <text x="${rightMargin + 8}" y="${t.y + 3}" class="threshold-label" fill="${t.stroke}" text-anchor="start">${t.label}</text>\n`;
            }
        } else {
            svg += `  <line x1="${leftMargin}" y1="${t.y}" x2="${rightMargin}" y2="${t.y}" class="academic-grid" />\n`;
        }
        svg += `  <line x1="${leftMargin}" y1="${t.y}" x2="${leftMargin + 4.5}" y2="${t.y}" class="tick-line" />\n`;
        svg += `  <line x1="${rightMargin - 4.5}" y1="${t.y}" x2="${rightMargin}" y2="${t.y}" class="tick-line" />\n`;
        svg += `  <text x="${leftMargin - 6}" y="${t.y + 3}" class="tick-label" text-anchor="end">${t.val}</text>\n`;
    }

    const numTrans = transitions.length;
    if (numTrans > 0) {
        const slotWidth = plotWidth / numTrans;
        const barWidth = Math.min(32, slotWidth * 0.58);

        for (let j = 0; j < numTrans; j++) {
            const t = transitions[j];
            const xCenter = leftMargin + (j + 0.5) * slotWidth;
            const xLeft = xCenter - barWidth / 2;

            const chromComp =
                t.chromaticComponent ??
                Number((Math.min(100, (t.deltaE / 80) * 100) * 0.45).toFixed(1));
            const lumComp = t.lumComponent ?? Number(((t.deltaLum / 255) * 100 * 0.35).toFixed(1));
            const aspComp =
                t.aspectComponent ??
                Number((Math.min(100, ((t.deltaAspect || 0) / 1.0) * 100) * 0.2).toFixed(1));
            const total = t.totalCost ?? Number((chromComp + lumComp + aspComp).toFixed(1));

            const hChrom = (chromComp / 100) * plotHeight;
            const hLum = (lumComp / 100) * plotHeight;
            const hAsp = (aspComp / 100) * plotHeight;
            const hTotal = (total / 100) * plotHeight;

            let currentY = plotBottom;

            if (hChrom > 0) {
                currentY -= hChrom;
                svg += `  <rect x="${xLeft}" y="${currentY}" width="${barWidth}" height="${hChrom}" fill="#2b5c8f" stroke="#0f172a" stroke-width="0.5" />\n`;
            }

            if (hLum > 0) {
                currentY -= hLum;
                svg += `  <rect x="${xLeft}" y="${currentY}" width="${barWidth}" height="${hLum}" fill="#c25925" stroke="#0f172a" stroke-width="0.5" />\n`;
            }

            if (hAsp > 0) {
                currentY -= hAsp;
                svg += `  <rect x="${xLeft}" y="${currentY}" width="${barWidth}" height="${hAsp}" fill="#2a7e58" stroke="#0f172a" stroke-width="0.5" />\n`;
            }

            const topY = Math.max(plotTop - 3, plotBottom - hTotal - 4);
            svg += `  <text x="${xCenter}" y="${topY}" class="tick-label" font-weight="600" text-anchor="middle">${total.toFixed(1)}</text>\n`;

            svg += `  <line x1="${xCenter}" y1="${plotBottom - 4.5}" x2="${xCenter}" y2="${plotBottom}" class="tick-line" />\n`;
            svg += `  <text x="${xCenter}" y="${plotBottom + 14}" class="tick-label" text-anchor="middle">${j + 1}→${j + 2}</text>\n`;
        }
    }

    // Publication-grade IEEE Inset Legend in upper-right quadrant inside plot spine
    const legendX = rightMargin - 148;
    const legendY = plotTop + 8;
    svg += `  <g transform="translate(${legendX}, ${legendY})">\n`;
    svg += `    <rect x="0" y="0" width="140" height="52" fill="#ffffff" fill-opacity="0.92" stroke="#cbd5e1" stroke-width="0.6" rx="2" />\n`;
    svg += `    <rect x="8" y="7" width="7" height="7" fill="#2b5c8f" stroke="#0f172a" stroke-width="0.5" />\n`;
    svg += `    <text x="20" y="13.5" class="legend-text">Chromatic ΔE (45%)</text>\n`;
    svg += `    <rect x="8" y="22" width="7" height="7" fill="#c25925" stroke="#0f172a" stroke-width="0.5" />\n`;
    svg += `    <text x="20" y="28.5" class="legend-text">Luminance ΔLum (35%)</text>\n`;
    svg += `    <rect x="8" y="37" width="7" height="7" fill="#2a7e58" stroke="#0f172a" stroke-width="0.5" />\n`;
    svg += `    <text x="20" y="43.5" class="legend-text">Aspect Shift (20%)</text>\n`;
    svg += `  </g>\n\n`;

    svg += `  <text x="${leftMargin + plotWidth / 2}" y="${plotBottom + 34}" class="axis-title" text-anchor="middle">Pairwise Transition (i → i+1)</text>\n`;
    svg += `</svg>\n`;
    return svg;
}

/**
 * Generates standalone Figure 3: CIELAB Colorimetric Spectrum & Metric Aspect Cadence SVG (IEEE Publication Standard).
 */
export function generateColorimetrySpectrumSvg({ gallery = {}, images = [] }) {
    const width = 880;
    const height = 210;
    const leftMargin = 68;
    const rightMargin = 845;
    const plotWidth = rightMargin - leftMargin; // 777px
    const boxTop = 22;
    const boxBottom = 192;
    const boxHeight = boxBottom - boxTop; // 170px

    let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="100%" height="100%">\n`;
    svg += `  <style>\n`;
    svg += `    .paper-bg { fill: #ffffff; }\n`;
    svg += `    .spine-box { fill: #ffffff; stroke: #0f172a; stroke-width: 0.85; }\n`;
    svg += `    .tick-line { stroke: #0f172a; stroke-width: 0.85; }\n`;
    svg += `    .fig-heading { fill: #0f172a; font-family: "Times New Roman", Times, "Nimbus Roman No9 L", "Liberation Serif", serif; font-size: 12.5px; font-weight: bold; letter-spacing: 0.2px; }\n`;
    svg += `    .axis-title { fill: #334155; font-family: "Times New Roman", Times, "Nimbus Roman No9 L", "Liberation Serif", serif; font-size: 10.5px; font-style: italic; }\n`;
    svg += `    .tick-label { fill: #334155; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; font-size: 9px; font-variant-numeric: tabular-nums; }\n`;
    svg += `    .threshold-label { fill: #475569; font-family: "Times New Roman", Times, "Nimbus Roman No9 L", "Liberation Serif", serif; font-size: 8.5px; font-style: italic; }\n`;
    svg += `  </style>\n\n`;

    svg += `  <rect width="${width}" height="${height}" class="paper-bg" />\n\n`;
    svg += `  <text x="${leftMargin}" y="17" class="fig-heading">Figure 3: Colorimetric CIELAB Spectrum (L*, a*, b*) and Metric Aspect Cadence</text>\n`;
    svg += `  <rect x="${leftMargin}" y="${boxTop}" width="${plotWidth}" height="${boxHeight}" class="spine-box" />\n`;
    svg += `  <text transform="translate(24, ${boxTop + boxHeight / 2}) rotate(-90)" class="axis-title" text-anchor="middle">CIELAB &amp; Aspect</text>\n`;

    const numImages = images.length;
    if (numImages > 0) {
        const slotWidth = plotWidth / numImages;
        const swatchWidth = Math.max(16, slotWidth - 6);
        const swatchY = boxTop + 6;
        // Substantial, elongated color bars filling ~54% of plot height
        const swatchHeight = 92;

        // If slot width is compact (< 55px), display header legend for breath abbreviations
        if (slotWidth < 55) {
            svg += `  <text x="${rightMargin}" y="17" class="threshold-label" text-anchor="end">Breath: [INH] Inhale · [EXH] Exhale · [GRD] Ground</text>\n`;
        }

        for (let i = 0; i < numImages; i++) {
            const img = images[i];
            const a = img?.analysis;
            const xLeft = leftMargin + i * slotWidth + (slotWidth - swatchWidth) / 2;
            const xCenter = xLeft + swatchWidth / 2;

            const rgb = a?.avgRGB || [128, 128, 128];
            const hexColor = `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
            const rawLabL =
                a?.lab?.L ?? (a?.luminance ? Number(((a.luminance / 255) * 100).toFixed(1)) : 50);
            const labA = a?.lab?.a ?? 0;
            const labB = a?.lab?.b ?? 0;
            const orient = (a?.orientation || 'land').substring(0, 1).toUpperCase();
            const aspect = a?.aspectRatio || '1.50';

            // Adaptive label formatting to prevent overlapping in dense galleries (e.g. N >= 16)
            let labLStr = `L*=${rawLabL}`;
            if (slotWidth < 36) {
                labLStr = `L*=${Math.round(rawLabL)}`;
            }

            let abStr = `(${labA}, ${labB})`;
            if (slotWidth < 55) {
                abStr = `(${Math.round(labA)}, ${Math.round(labB)})`;
            }

            let breathTag = '[GROUNDING]';
            let breathColor = '#475569';
            if (a?.breathType === 'Inhalation') {
                breathTag = slotWidth >= 55 ? '[INHALATION]' : slotWidth >= 28 ? '[INH]' : '[I]';
                breathColor = '#1d4ed8';
            } else if (a?.breathType === 'Exhalation') {
                breathTag = slotWidth >= 55 ? '[EXHALATION]' : slotWidth >= 28 ? '[EXH]' : '[E]';
                breathColor = '#b91c1c';
            } else {
                breathTag = slotWidth >= 55 ? '[GROUNDING]' : slotWidth >= 28 ? '[GRD]' : '[G]';
                breathColor = '#475569';
            }

            svg += `  <rect x="${xLeft}" y="${swatchY}" width="${swatchWidth}" height="${swatchHeight}" fill="${hexColor}" stroke="#0f172a" stroke-width="0.75" rx="1.5" />\n`;

            const textFill = rawLabL > 55 ? '#0f172a' : '#ffffff';
            svg += `  <text x="${xCenter}" y="${swatchY + 16}" fill="${textFill}" font-family="-apple-system, sans-serif" font-size="10px" font-weight="bold" text-anchor="middle">${i + 1}</text>\n`;

            svg += `  <text x="${xCenter}" y="${swatchY + swatchHeight + 13}" class="tick-label" font-weight="600" text-anchor="middle">${labLStr}</text>\n`;
            svg += `  <text x="${xCenter}" y="${swatchY + swatchHeight + 25}" class="threshold-label" text-anchor="middle">${abStr}</text>\n`;
            svg += `  <text x="${xCenter}" y="${swatchY + swatchHeight + 38}" class="tick-label" font-weight="bold" text-anchor="middle">${aspect} ${orient}</text>\n`;
            svg += `  <text x="${xCenter}" y="${swatchY + swatchHeight + 50}" class="threshold-label" fill="${breathColor}" font-size="7.5px" font-weight="bold" text-anchor="middle">${breathTag}</text>\n`;

            svg += `  <line x1="${xCenter}" y1="${boxBottom - 4.5}" x2="${xCenter}" y2="${boxBottom}" class="tick-line" />\n`;
        }
    }

    svg += `</svg>\n`;
    return svg;
}

/**
 * Generates an academic publication-standard (arXiv / IEEE style) composite SVG visualization.
 * Uses clean white paper background, classical serif and scientific typography,
 * precision inward tick spines, muted publication palettes, and academic captions.
 *
 * @param {object} params
 * @param {object} params.gallery
 * @param {Array} params.images
 * @param {Array} params.transitions
 * @param {object} params.respiratory
 * @param {Array} params.quotes
 * @param {string} [params.archetype]
 * @returns {string} Standalone SVG XML string
 */
export function generateSequenceChartsSvg({
    gallery = {},
    images = [],
    transitions = [],
    respiratory = {},
    quotes = [],
    archetype = 'Polyphonic Street Symphony / Lyrical Arc',
}) {
    const totalHamiltonianEnergy = transitions.reduce((sum, t) => sum + (t.totalCost || 0), 0);
    const avgCost =
        transitions.length > 0 ? (totalHamiltonianEnergy / transitions.length).toFixed(1) : '0.0';
    const rhythmScore = respiratory.rhythmScore ?? 100;
    const galleryTitle = gallery.title || gallery.pageId || 'GALLERY';

    const width = 940;
    const height = 700;
    const leftMargin = 72;
    const rightMargin = 895;
    const plotWidth = rightMargin - leftMargin; // 823px

    let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="100%" height="100%">\n`;
    svg += `  <style>\n`;
    svg += `    .paper-bg { fill: #ffffff; }\n`;
    svg += `    .fig-heading { fill: #111827; font-family: "Times New Roman", Times, "Nimbus Roman", "DejaVu Serif", serif; font-size: 13px; font-weight: bold; }\n`;
    svg += `    .fig-meta { fill: #4b5563; font-family: "Times New Roman", Times, "Nimbus Roman", "DejaVu Serif", serif; font-size: 10px; font-style: italic; }\n`;
    svg += `    .caption-text { fill: #374151; font-family: "Times New Roman", Times, "Nimbus Roman", "DejaVu Serif", serif; font-size: 9.5px; }\n`;
    svg += `  </style>\n\n`;

    svg += `  <rect width="${width}" height="${height}" class="paper-bg" />\n\n`;
    svg += `  <text x="${leftMargin}" y="24" class="fig-heading">Figure 1: Quantitative Sequence Dynamics &amp; Photometric Trajectories (${escapeXml(galleryTitle)})</text>\n`;
    svg += `  <text x="${leftMargin}" y="38" class="fig-meta">Archetype: ${escapeXml(archetype)} | Hamiltonian Sequence Energy: ${totalHamiltonianEnergy.toFixed(1)} (Mean: ${avgCost}) | Respiratory Pacing: ${rhythmScore}/100</text>\n\n`;

    // Embed sub-figures
    const f1 = generateLuminanceWaveformSvg({ gallery, images, respiratory, quotes });
    const f2 = generateTransitionTensionSvg({ gallery, transitions });
    const f3 = generateColorimetrySpectrumSvg({ gallery, images });

    // Extract SVG guts and translate
    const extractGuts = (s) =>
        s
            .replace(/.*<style>[\s\S]*?<\/style>/, '')
            .replace(/<\/?svg.*?>/g, '')
            .trim();

    svg += `  <g transform="translate(-10, 40) scale(0.95)">${extractGuts(f1)}</g>\n`;
    svg += `  <g transform="translate(-10, 220) scale(0.95)">${extractGuts(f2)}</g>\n`;
    svg += `  <g transform="translate(-10, 420) scale(0.95)">${extractGuts(f3)}</g>\n`;

    svg += `  <text x="${leftMargin}" y="675" class="caption-text"><tspan font-weight="bold">Figure 1.</tspan> Quantitative sequence dynamics and photometric transition models. <tspan font-weight="bold">(a)</tspan> Luminance waveform with Inhalation (L* ≥ 135) and</text>\n`;
    svg += `  <text x="${leftMargin}" y="689" class="caption-text">Exhalation (L* ≤ 75) bounds; <tspan font-weight="bold">(b)</tspan> Pairwise transition energy decomposed into chromatic, luminance, and aspect components; <tspan font-weight="bold">(c)</tspan> Primary colorimetric progression.</text>\n`;

    svg += `</svg>\n`;
    return svg;
}

/**
 * Generates a rich Markdown Visual Curation Report with embedded real images,
 * aesthetic/narrative rationale, and computed Hamiltonian metrics.
 *
 * @param {string} pageId - e.g. 'p5'
 * @param {object} [options] - custom options: outputPath, sequenceOverride, commentaryMap, archetype
 * @returns {Promise<{ reportContent: string, outputPath: string }>}
 */
export async function generateVisualReport(pageId, options = {}) {
    const defaultOutPath = path.join(REPO_ROOT, 'assets', 'img', pageId, 'sequence-report.md');
    const {
        outputPath: rawOutputPath = defaultOutPath,
        sequenceOverride = null,
        commentaryMap = {},
        archetype = 'Polyphonic Street Symphony / Lyrical Arc',
    } = options;
    const outputPath = path.isAbsolute(rawOutputPath)
        ? rawOutputPath
        : path.resolve(REPO_ROOT, rawOutputPath);

    const data = await inspectGallery(pageId);
    let images = data.images;
    let finalCommentaryMap =
        commentaryMap && Object.keys(commentaryMap).length > 0 ? commentaryMap : {};
    if (Object.keys(finalCommentaryMap).length === 0) {
        const defaultCommPath = path.join(REPO_ROOT, 'assets', 'img', pageId, 'commentary.json');
        if (fs.existsSync(defaultCommPath)) {
            try {
                finalCommentaryMap = JSON.parse(fs.readFileSync(defaultCommPath, 'utf8'));
            } catch {
                finalCommentaryMap = {};
            }
        }
    }

    if (sequenceOverride && Array.isArray(sequenceOverride)) {
        const imgMap = new Map(images.map((img) => [img.filename, img]));
        images = sequenceOverride
            .map((item, idx) => {
                const fname = typeof item === 'string' ? item : item.filename;
                const base = imgMap.get(fname);
                if (!base) return null;
                return {
                    ...base,
                    sequenceOrder: idx + 1,
                    customCommentary: item.commentary || null,
                };
            })
            .filter(Boolean);
    }

    const transitions = calculatePairwiseTransitions(images);
    const respiratory = analyzeRespiratoryRhythm(images);
    const totalHamiltonianEnergy = transitions.reduce((sum, t) => sum + (t.totalCost || 0), 0);
    const avgHamiltonianEnergy =
        transitions.length > 0
            ? Number((totalHamiltonianEnergy / transitions.length).toFixed(1))
            : 0;

    // Generate dedicated individual academic SVG figures
    const waveformSvg = generateLuminanceWaveformSvg({
        gallery: data.gallery,
        images,
        respiratory,
        quotes: data.quotes,
    });
    const transitionsSvg = generateTransitionTensionSvg({
        gallery: data.gallery,
        transitions,
    });
    const colorimetrySvg = generateColorimetrySpectrumSvg({
        gallery: data.gallery,
        images,
    });

    const reportDir = path.dirname(outputPath);
    const waveformPath = path.join(reportDir, 'sequence-waveform.svg');
    const transitionsPath = path.join(reportDir, 'sequence-transitions.svg');
    const colorimetryPath = path.join(reportDir, 'sequence-colorimetry.svg');

    if (outputPath) {
        fs.mkdirSync(reportDir, { recursive: true });
        fs.writeFileSync(waveformPath, waveformSvg, 'utf8');
        fs.writeFileSync(transitionsPath, transitionsSvg, 'utf8');
        fs.writeFileSync(colorimetryPath, colorimetrySvg, 'utf8');
    }

    const relWaveform = path.relative(reportDir, waveformPath);
    const relTransitions = path.relative(reportDir, transitionsPath);
    const relColorimetry = path.relative(reportDir, colorimetryPath);

    const waveformEmbedUrl = relWaveform.startsWith('.') ? relWaveform : `./${relWaveform}`;
    const transitionsEmbedUrl = relTransitions.startsWith('.')
        ? relTransitions
        : `./${relTransitions}`;
    const colorimetryEmbedUrl = relColorimetry.startsWith('.')
        ? relColorimetry
        : `./${relColorimetry}`;

    let md = `# Visual Curation & Sequence Report: ${data.gallery.title || pageId.toUpperCase()}\n\n`;
    md += `> **Curation Archetype**: ${archetype}\n>\n`;
    md += `> **Sequence Status**: ${sequenceOverride ? 'Resequenced Proposal (Optimized)' : respiratory.anomalies.length > 0 ? 'Resequencing Recommended (Cadence Anomalies Detected)' : 'Validated (Existing sequence affirmed as optimal)'}\n>\n`;
    md += `> **Hamiltonian Sequence Energy**: \`${totalHamiltonianEnergy.toFixed(1)}\` (Avg Step Cost: \`${avgHamiltonianEnergy}\`)\n>\n`;
    md += `> **Respiratory Pacing Score**: \`${respiratory.rhythmScore}/100\` (${respiratory.inhalations} Inhalations, ${respiratory.exhalations} Exhalations, ${respiratory.neutrals} Grounding)\n\n`;

    md += `## 1. Executive Curatorial & Quantitative Architecture\n\n`;
    md += `This report quantitatively evaluates the visual narrative arc for **${pageId}**, combining photometric colorimetry (CIELAB L*a*b*, ΔE₇₆), Hamiltonian pairwise transition tension, and multi-agent aesthetic critique.\n\n`;

    md += `### 1.1 Photometric Respiratory Waveform\n\n`;
    md += `The respiratory luminance waveform maps the photometric breathing rhythm of the essay, balancing luminous expansions with low-key chiaroscuro grounding anchors.\n\n`;
    md += `![Photometric Respiratory Waveform](${waveformEmbedUrl})\n\n`;
    md += `**Figure 1**: Photometric Luminance Waveform \`L*(t) ∈ [0, 255]\` and Respiratory Rhythm. Shaded regions indicate Inhalation (\`L* >= 135\`, luminous expansiveness) and Exhalation (\`L* <= 75\`, chiaroscuro grounding) zones. Vertical dashed lines mark poetic caesuras.\n\n`;

    md += `### 1.2 Hamiltonian Pairwise Transition Tension\n\n`;
    md += `Pairwise transition energy measures visual friction and cognitive momentum between adjacent frames, decomposed into chromatic distance (ΔE₇₆, 45%), luminance contrast (ΔLum, 35%), and geometric aspect shift (ΔAspect, 20%).\n\n`;
    md += `![Hamiltonian Pairwise Transition Tension](${transitionsEmbedUrl})\n\n`;
    md += `**Figure 2**: Pairwise step cost \`C(i, i+1)\` decomposed into chromatic, luminance, and aspect variance components. Dashed reference lines define harmonic baseline (\`C <= 25\`) and montage shock (\`C >= 50\`) thresholds.\n\n`;

    md += `### 1.3 CIELAB Colorimetric Progression & Spatial Cadence\n\n`;
    md += `The chromatic spectrum profile charts the physical color evolution across sequential frames alongside metric aspect ratio and spatial framing cadence.\n\n`;
    md += `![CIELAB Colorimetric Progression](${colorimetryEmbedUrl})\n\n`;
    md += `**Figure 3**: Sequential colorimetric profile detailing mean sRGB swatches, CIELAB coordinates (\`L*, a*, b*\`), aspect ratio, orientation (L/P), and breath type.\n\n`;

    if (respiratory.anomalies.length > 0) {
        md += `### Cadence & Respiratory Rhythm Alerts\n\n`;
        for (const anom of respiratory.anomalies) {
            md += `- **Frame #${anom.index} (${anom.filename})** — *${anom.type}*: ${anom.detail}\n`;
        }
        md += `\n`;
    }

    md += `## 2. Visual Sequence Journey\n\n`;

    if (images.length === 0) {
        md += `*No active sequenced images found in this gallery.*\n\n`;
    }

    const galleryDir = path.join(REPO_ROOT, 'assets', 'img', pageId);

    for (let i = 0; i < images.length; i++) {
        const img = images[i];
        const a = img.analysis;
        const previewFilename = resolvePreviewFilename(galleryDir, img.filename);
        const imgAbsPath = path.join(galleryDir, previewFilename);
        const relImgPath = path.relative(path.dirname(outputPath), imgAbsPath);
        const imgEmbedUrl = relImgPath.startsWith('.') ? relImgPath : `./${relImgPath}`;

        md += `### [${i + 1}/${images.length}] ${img.filename}\n\n`;
        md += `![${img.alt || img.caption || img.filename}](${imgEmbedUrl})\n\n`;

        if (a) {
            const nextTrans = i < transitions.length ? transitions[i] : null;
            md += `| Attribute | Value |\n`;
            md += `| :--- | :--- |\n`;
            md += `| **Framing & Aspect** | \`${a.orientation.toUpperCase()}\` · \`${a.width}×${a.height}\` (Aspect: \`${a.aspectRatio}\`) |\n`;
            md += `| **Tonality & Breath** | \`L*=${a.lab.L}\` — **${a.breathType}** (CIELAB: \`${a.lab.L}, ${a.lab.a}, ${a.lab.b}\`) |\n`;
            if (img.caption) {
                md += `| **Caption / Photo Credit** | \`${img.caption}\` |\n`;
            }
            if (nextTrans) {
                md += `| **Transition to #${i + 2} (${nextTrans.to})** | \`ΔE₇₆: ${nextTrans.deltaE}\` (Color) · \`ΔLum: ${nextTrans.deltaLum}\` · **Step Cost: \`${nextTrans.totalCost}\`** |\n`;
            }
            md += `\n`;
        }

        const nextTrans = i < transitions.length ? transitions[i] : null;
        const dynamicPacingRole =
            i === 0
                ? 'Act I: The Overture / Sequence Opener'
                : i === images.length - 1
                  ? 'Act IV: Coda / Sequence Resolution'
                  : i < images.length / 3
                    ? `Act II: Narrative Development (Frame #${i + 1})`
                    : i < (2 * images.length) / 3
                      ? `Act III: Climactic Movement (Frame #${i + 1})`
                      : `Act IV: Resolution Movement (Frame #${i + 1})`;

        const dynamicTransDesc = nextTrans
            ? `${nextTrans.deltaLum > 40 ? 'High-contrast tonal step' : 'Harmonic chromatic transition'} with step cost of ${nextTrans.totalCost}.`
            : 'Final contemplative resting frame.';

        const commentary = img.customCommentary || finalCommentaryMap[img.filename];
        if (commentary) {
            if (typeof commentary === 'string') {
                md += `**Curatorial Rationale & Montage Dynamic**:\n\n${commentary.trim()}\n\n`;
            } else if (typeof commentary === 'object') {
                md += `**Curatorial Rationale & Montage Dynamic**:\n\n`;
                // Adapt pacing role dynamically if sequence position shifted
                let effectiveRole = commentary.role || dynamicPacingRole;
                if (
                    i === 0 &&
                    !effectiveRole.includes('Overture') &&
                    !effectiveRole.includes('Opener')
                ) {
                    const cleanRoleName = effectiveRole
                        .replace(/^Act\s+[IVX]+:\s*/i, '')
                        .replace(/Frame\s*#?\d+/i, '')
                        .trim();
                    effectiveRole = `Act I: The Overture / ${cleanRoleName || 'Sequence Opener'}`;
                } else if (
                    i === images.length - 1 &&
                    !effectiveRole.includes('Coda') &&
                    !effectiveRole.includes('Resolution')
                ) {
                    const cleanRoleName = effectiveRole
                        .replace(/^Act\s+[IVX]+:\s*/i, '')
                        .replace(/Frame\s*#?\d+/i, '')
                        .trim();
                    effectiveRole = `Act IV: Coda / ${cleanRoleName || 'Sequence Resolution'}`;
                } else if (
                    i > 0 &&
                    i < images.length - 1 &&
                    (effectiveRole.includes('Overture') || effectiveRole.includes('Coda'))
                ) {
                    const cleanRoleName = effectiveRole
                        .replace(/Act\s+[IVX]+:\s*(The Overture|Coda)\s*\/?\s*/gi, '')
                        .trim();
                    effectiveRole = `${dynamicPacingRole}${cleanRoleName ? ` (${cleanRoleName})` : ''}`;
                }

                md += `- *Pacing Role*: ${effectiveRole}\n`;
                if (commentary.subject || commentary.content) {
                    md += `- *Visual Subject & Content*: ${commentary.subject || commentary.content}\n`;
                }
                if (commentary.meaning || commentary.thematicMeaning) {
                    md += `- *Thematic Meaning*: ${commentary.meaning || commentary.thematicMeaning}\n`;
                }
                if (commentary.vector || commentary.vectors) {
                    md += `- *Composition & Gaze Vectors*: ${commentary.vector || commentary.vectors}\n`;
                }
                md += `- *Transition Dynamic*: ${commentary.transition || dynamicTransDesc}\n\n`;
            }
        } else if (a) {
            const breathDesc =
                a.luminance >= 135
                    ? 'Luminous inhalation providing expansive perceptual breathing space.'
                    : a.luminance <= 75
                      ? 'Low-key exhalation grounding the viewer with chiaroscuro mass.'
                      : 'Neutral midpoint maintaining narrative continuity.';

            md += `**Curatorial Rationale & Montage Dynamic**:\n\n- *Pacing Role*: ${dynamicPacingRole}\n- *Tonal Dynamic*: ${breathDesc}\n- *Transition*: ${dynamicTransDesc}\n\n`;
        }

        // Insert caesura quote if present
        const matchingQuotes = (data.quotes || []).filter(
            (q) => q.afterImageIndex === img.sequenceOrder
        );
        for (const q of matchingQuotes) {
            let quoteText = q.content || '';
            let citeAuthor = q.author || '';

            // Extract <cite>...</cite> or <footer class="...">...</footer>
            const citeMatch = quoteText.match(/<cite>([\s\S]*?)<\/cite>/i);
            if (citeMatch) {
                citeAuthor = citeMatch[1].replace(/<[^>]*>/g, '').trim();
                quoteText = quoteText
                    .replace(/<footer[\s\S]*?<\/footer>/gi, '')
                    .replace(/<cite>[\s\S]*?<\/cite>/gi);
            }

            // Split into lines on <br />, clean html tags and whitespace
            const quoteLines = quoteText
                .replace(/<br\s*\/?>/gi, '\n')
                .split(/\r?\n/)
                .map((l) => l.replace(/<[^>]*>/g, '').trim())
                .filter(Boolean);

            md += `> **[Poetic Caesura: Musical Rest]**\n>\n`;
            for (const line of quoteLines) {
                md += `> *${line}*\n`;
            }
            if (citeAuthor) {
                md += `>\n> — **${citeAuthor}**\n`;
            }
            md += `\n`;
        }

        md += `---\n\n`;
    }

    // Section 3: Curatorial Recommendations & Optimized Sequence Proposals
    md += `## 3. Curatorial Proposals & Optimized Sequence Arc\n\n`;

    if (respiratory.anomalies.length > 0) {
        md += `### Recommended Interlude & Rhythm Solutions\n\n`;
        for (const anom of respiratory.anomalies) {
            md += `#### Resolution for Frame #${anom.index} (${anom.filename}) — *${anom.type}*\n\n`;

            if (anom.type === 'Suffocating Weight') {
                // Find candidate inhalation image later in sequence or outtakes
                const candidateInhalation =
                    images.slice(anom.index).find((img) => img.analysis?.luminance >= 135) ||
                    images.slice(anom.index).find((img) => img.analysis?.luminance > 100) ||
                    (data.outtakes || []).find((out) => out.analysis?.luminance >= 135);

                md += `##### Option A (Frame #${anom.index}): Poetic Caesura (Text Interlude)\n\n`;
                md += `Insert a contemplative musical rest before Frame #${anom.index} to give the viewer cognitive breathing space:\n\n`;
                md += `> In the darkroom of the night street, every reflection is an accidental double.\n>\n`;
                md += `> — **Daido Moriyama**\n\n`;

                if (candidateInhalation) {
                    // Compute simulated reordered sequence
                    const reordered = [...images];
                    const candIdx = reordered.findIndex(
                        (img) => img.filename === candidateInhalation.filename
                    );
                    if (candIdx > -1) {
                        const [moved] = reordered.splice(candIdx, 1);
                        reordered.splice(anom.index - 1, 0, moved);
                    }
                    const optTransitions = calculatePairwiseTransitions(reordered);
                    const optRespiratory = analyzeRespiratoryRhythm(reordered);
                    const optTotalCost = optTransitions.reduce(
                        (sum, t) => sum + (t.totalCost || 0),
                        0
                    );

                    md += `##### Option B (Frame #${anom.index}): Visual Resequencing (Luminous Inhalation Wave) [Recommended]\n\n`;
                    md += `Move **\`${candidateInhalation.filename}\`** (L*=${candidateInhalation.analysis?.lab.L || 58}, Inhalation) into position #${anom.index} between the dark nocturnes to create a Chiaroscuro wave.\n\n`;

                    md += `| Metric | Current Sequence | Proposed Sequence (Option B) |\n`;
                    md += `| :--- | :--- | :--- |\n`;
                    md += `| **Respiratory Pacing Score** | \`${respiratory.rhythmScore}/100\` | **\`${optRespiratory.rhythmScore}/100\`** |\n`;
                    md += `| **Cadence Warnings** | \`${respiratory.anomalies.length}\` (${anom.type}) | **\`${optRespiratory.anomalies.length}\` (Harmonic Breath Cycles)** |\n`;
                    md += `| **Hamiltonian Total Energy** | \`${totalHamiltonianEnergy.toFixed(1)}\` | **\`${optTotalCost.toFixed(1)}\`** |\n\n`;

                    md += `**Proposed \`index.md\` Layout**:\n\n\`\`\`markdown\n`;
                    for (let j = 0; j < reordered.length; j++) {
                        const rImg = reordered[j];
                        const capStr = rImg.caption ? ` | ${rImg.caption}` : '';
                        md += `${rImg.filename}${capStr}\n`;
                    }
                    md += `\`\`\`\n\n`;
                }
            } else if (anom.type === 'Hyperventilation') {
                md += `##### Option A (Frame #${anom.index}): Poetic Caesura (Text Interlude)\n\n`;
                md += `Insert a dense, grounding reflection between consecutive high-key frames:\n\n`;
                md += `> Light does not illuminate everything; it defines the borders where darkness begins.\n>\n`;
                md += `> — **Susan Sontag**\n\n`;
            }
        }
    } else {
        md += `The current sequence displays **optimal rhythmic pacing** (${respiratory.rhythmScore}/100) with harmonic alternation across Inhalation, Exhalation, and Neutral anchor frames.\n\n`;
    }

    if (data.outtakes && data.outtakes.length > 0) {
        md += `## 4. Unsequenced Candidates & Outtakes (${data.outtakes.length})\n\n`;
        for (const out of data.outtakes) {
            const a = out.analysis;
            const previewFilename = resolvePreviewFilename(galleryDir, out.filename);
            const imgAbsPath = path.join(galleryDir, previewFilename);
            const relImgPath = path.relative(path.dirname(outputPath), imgAbsPath);
            const imgEmbedUrl = relImgPath.startsWith('.') ? relImgPath : `./${relImgPath}`;
            md += `#### Candidate: ${out.filename}\n\n`;
            md += `![${out.filename}](${imgEmbedUrl})\n\n`;
            if (a) {
                md += `- **Metrics**: \`${a.orientation.toUpperCase()}\` · \`${a.width}×${a.height}\` · \`L*=${a.lab.L}\` (${a.breathType})\n`;
            }
            md += `- **Curatorial Exclusion Rationale**: Excluded to maintain narrative tension, prevent chromatic friction, or avoid eye-vector redundancy.\n\n`;
        }
    }

    // Normalize whitespace for markdownlint compliance (no MD012 multiple blank lines)
    md = md.replace(/\n{3,}/g, '\n\n').trim() + '\n';

    if (outputPath) {
        fs.mkdirSync(path.dirname(outputPath), { recursive: true });
        fs.writeFileSync(outputPath, md, 'utf8');
    }

    return {
        reportContent: md,
        outputPath,
    };
}

async function main() {
    const args = process.argv.slice(2);
    const hasHelp = args.includes('--help') || args.includes('-h');
    const pageArg = args.find((a) => !a.startsWith('--'));

    if (hasHelp || !pageArg) {
        console.log(`
Usage: node inspect_gallery.mjs <pageId> [options]

Arguments:
  <pageId>                 Gallery identifier (e.g. "p5", "5", "assets/img/p5/index.md")

Options:
  --json                   Output structured JSON with complete colorimetry and metrics
  --report [outputPath]   Generate visual Markdown report embedding photographs
  --help, -h               Show this help message
`);
        process.exit(hasHelp ? 0 : 1);
    }

    const jsonOutput = args.includes('--json');
    const reportOutput = args.includes('--report');
    const reportPathIndex = args.indexOf('--report') + 1;
    const customReportPath =
        reportPathIndex > 0 && args[reportPathIndex] && !args[reportPathIndex].startsWith('--')
            ? args[reportPathIndex]
            : null;

    const commIdx = args.indexOf('--commentary') + 1;
    let commentaryMap = {};
    if (commIdx > 0 && args[commIdx] && !args[commIdx].startsWith('--')) {
        const commPath = path.resolve(REPO_ROOT, args[commIdx]);
        if (fs.existsSync(commPath)) {
            try {
                commentaryMap = JSON.parse(fs.readFileSync(commPath, 'utf8'));
            } catch (err) {
                console.error(`Failed to parse commentary file: ${commPath}`, err);
            }
        }
    }

    const { pageId, dir, mdPath } = resolveGalleryPath(pageArg);
    if (!fs.existsSync(dir)) {
        console.error(`Gallery directory not found: ${dir}`);
        process.exit(1);
    }

    if (reportOutput) {
        const result = await generateVisualReport(pageId, {
            outputPath: customReportPath || undefined,
            commentaryMap,
        });
        console.log(`\n[SUCCESS] Generated Visual Sequence Report for ${pageId.toUpperCase()}:`);
        console.log(`   ${result.outputPath}\n`);
        return;
    }

    const outputData = await inspectGallery(pageId);
    const {
        images: sequencedImages,
        quotes,
        outtakes,
        transitions,
        respiratoryRhythm: respiratory,
    } = outputData;

    if (jsonOutput) {
        console.log(JSON.stringify(outputData, null, 2));
        return;
    }

    // Formatted CLI report
    console.log(`\n======================================================================`);
    console.log(
        `  FRONTIER GALLERY SEQUENCE INSPECTION: ${pageId.toUpperCase()} - "${outputData.gallery.title}"`
    );
    console.log(`======================================================================`);
    console.log(`Directory:   ${outputData.gallery.directory}`);
    console.log(`Markdown:    ${outputData.gallery.markdownPath}`);
    console.log(
        `Images:      ${outputData.gallery.totalImages} active | ${outtakes.length} outtakes`
    );
    console.log(`Quotes:      ${quotes.length} interludes`);
    console.log(
        `Respiratory: Rhythm Score: ${respiratory.rhythmScore}/100 (${respiratory.anomalies.length} cadence warnings)`
    );
    console.log(`----------------------------------------------------------------------\n`);

    console.log(`CURRENT SEQUENCE ORDER, CIELAB TONALITY & RESPIRATORY BREATH:`);
    for (let i = 0; i < sequencedImages.length; i++) {
        const img = sequencedImages[i];
        const a = img.analysis;
        if (!img.exists) {
            console.log(
                ` [${String(img.sequenceOrder).padStart(2, ' ')}] [MISSING]: ${img.filename}`
            );
            continue;
        }

        const orientBadge = a.orientation.toUpperCase().padEnd(9, ' ');
        const dimStr = `${a.width}x${a.height} (${a.aspectRatio})`.padEnd(17, ' ');
        const breathBadge = `[${a.breathType}]`.padEnd(13, ' ');
        const lumStr = `Lum: ${String(a.luminance).padStart(3, ' ')}`.padEnd(9, ' ');
        const labStr = `Lab: (${a.lab.L}, ${a.lab.a}, ${a.lab.b})`.padEnd(25, ' ');

        console.log(
            ` [${String(img.sequenceOrder).padStart(2, ' ')}] ${img.filename.padEnd(28, ' ')} | ${orientBadge} | ${dimStr} | ${breathBadge} | ${lumStr} | ${labStr}`
        );

        if (img.caption) {
            console.log(`      ↳ Caption: ${img.caption}`);
        }

        // Print transition delta to next image
        if (i < transitions.length) {
            const t = transitions[i];
            console.log(
                `      ↳ Transition to #${i + 2}: ΔE: ${t.deltaE} (Color) | ΔLum: ${t.deltaLum} | Cost: ${t.totalCost}`
            );
        }

        // Print quotes that appear after this image
        const matchingQuotes = quotes.filter((q) => q.afterImageIndex === img.sequenceOrder);
        for (const q of matchingQuotes) {
            const preview = q.content.replace(/\n/g, ' / ').slice(0, 75);
            console.log(`      [Caesura Interlude]: "${preview}..."`);
        }
    }

    if (respiratory.anomalies.length > 0) {
        console.log(`\n----------------------------------------------------------------------`);
        console.log(`RESPIRATORY RHYTHM WARNINGS:`);
        for (const anom of respiratory.anomalies) {
            console.log(
                ` [WARNING] [Frame #${anom.index} - ${anom.filename}] ${anom.type}: ${anom.detail}`
            );
        }
    }

    if (outtakes.length > 0) {
        console.log(`\n----------------------------------------------------------------------`);
        console.log(`UNSEQUENCED CANDIDATES / OUTTAKES IN DIRECTORY (${outtakes.length}):`);
        for (const out of outtakes) {
            const a = out.analysis;
            if (a) {
                console.log(
                    ` - ${out.filename.padEnd(28, ' ')} | ${a.orientation.toUpperCase()} | ${a.width}x${a.height} | Lum: ${a.luminance} (${a.breathType})`
                );
            } else {
                console.log(` - ${out.filename}`);
            }
        }
    }
    console.log(`\n======================================================================\n`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    main().catch((err) => {
        console.error('Error inspecting gallery:', err);
        process.exit(1);
    });
}
