/**
 * Read-only pool inventory and sharp pixel-chroma modality classifier (bw vs. color).
 * Strictly ingests only sequenced images from assets/img/p<N>/index.md and ignores disk orphans.
 */

import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { parseMarkdownSource } from '../build-page.mjs';
import { rgbToLab } from '../../.agents/skills/sequence/scripts/metrics.mjs';

export const DEFAULT_SERIES = Object.freeze(['p1', 'p2', 'p3', 'p4', 'p5', 'p6']);
export const METRIC_VERSION = 'v1';

export function toAssetId(seriesId, filename) {
    const stem = path
        .parse(filename)
        .name.toLowerCase()
        .replace(/[^a-z0-9_-]/g, '-');
    return `${String(seriesId).toLowerCase()}-${stem}`;
}

export function sha256Buffer(buf) {
    return crypto.createHash('sha256').update(buf).digest('hex');
}

export async function classifyImageModality(imagePath) {
    const img = sharp(imagePath);
    const meta = await img.metadata();
    const { data, info } = await img
        .clone()
        .resize(160, 160, { fit: 'inside' })
        .raw()
        .toBuffer({ resolveWithObject: true });

    const diffs = [];
    let sumR = 0;
    let sumG = 0;
    let sumB = 0;
    const pixels = Math.max(1, Math.floor(data.length / info.channels));

    for (let i = 0; i < data.length; i += info.channels) {
        const r = data[i];
        const g = info.channels > 1 ? data[i + 1] : r;
        const b = info.channels > 2 ? data[i + 2] : r;
        sumR += r;
        sumG += g;
        sumB += b;
        diffs.push(Math.max(Math.abs(r - g), Math.abs(g - b), Math.abs(r - b)));
    }

    diffs.sort((a, b) => a - b);
    const p95 = diffs[Math.floor(diffs.length * 0.95)] || 0;
    const avgR = Math.round(sumR / pixels);
    const avgG = Math.round(sumG / pixels);
    const avgB = Math.round(sumB / pixels);
    const luma255 = Math.round(0.2126 * avgR + 0.7152 * avgG + 0.0722 * avgB);
    const lab = rgbToLab(avgR, avgG, avgB);

    let subtype = 'color';
    if (p95 <= 3) {
        subtype = 'pure-bw';
    } else if (p95 <= 12) {
        subtype = 'tinted-bw';
    }
    const modality = subtype === 'color' ? 'color' : 'bw';
    const derivativeRecipe =
        subtype === 'tinted-bw' ? 'neutralize-grayscale-2048' : 'passthrough-or-downsample-2048';

    return {
        width: meta.width || 0,
        height: meta.height || 0,
        p95DeltaRgb: p95,
        subtype,
        modality,
        derivativeRecipe,
        luma255,
        lab,
    };
}

export function parseSequencedItems(rawMarkdown, seriesId) {
    const { body } = parseMarkdownSourceContent(rawMarkdown);
    const allLines = rawMarkdown.split(/\r?\n/);
    const fmEndIdx = findFrontmatterEndLine(allLines);
    const images = [];
    const fragments = [];
    let quoteLines = [];
    let quoteStartLine = 0;

    const flushQuote = (endLine) => {
        if (quoteLines.length === 0) {
            return;
        }
        const rawText = quoteLines.join('\n').trim();
        quoteLines = [];
        if (!rawText) {
            return;
        }
        const citeMatch = rawText.match(/<cite>([\s\S]*?)<\/cite>/i);
        const attribution = citeMatch ? citeMatch[1].trim() : null;
        const text = rawText
            .replace(/<footer[\s\S]*?<\/footer>/gi, '')
            .replace(/<br\s*\/?>/gi, '')
            .replace(/<[^>]+>/g, '')
            .split('\n')
            .map((line) => line.trim())
            .filter(Boolean)
            .join('\n')
            .trim();
        if (!text) {
            return;
        }
        const hasCjk = /[\u4e00-\u9fff]/.test(text);
        fragments.push({
            fragmentId: `${seriesId}-lines-${quoteStartLine}-${endLine}`,
            source: `assets/img/${seriesId}/index.md`,
            sourceRange: { startLine: quoteStartLine, endLine },
            language: hasCjk ? 'zh-Hans' : 'en',
            text,
            attribution,
            originality: 'series-epigraph',
            rightsStatus: 'approved',
            excerptPolicy: 'verbatim-only',
        });
    };

    const bodyLines = body.split(/\r?\n/);
    for (let i = 0; i < bodyLines.length; i++) {
        const lineNum = fmEndIdx + i + 1;
        const trimmed = bodyLines[i].trim();
        if (trimmed.startsWith('>')) {
            if (quoteLines.length === 0) {
                quoteStartLine = lineNum;
            }
            quoteLines.push(trimmed.replace(/^>\s?/, ''));
        } else {
            flushQuote(lineNum - 1);
            const imgMatch = trimmed.match(
                /^([^\s|()#>]+\.(?:jpe?g|JPG))(?:\s*\|\s*(.*)|\s*\((.*?)\))?$/
            );
            if (imgMatch) {
                images.push({
                    filename: imgMatch[1].trim(),
                    caption: (imgMatch[2] || imgMatch[3] || '').trim() || null,
                });
            }
        }
    }
    flushQuote(fmEndIdx + bodyLines.length);
    return { images, fragments };
}

function parseMarkdownSourceContent(rawContent) {
    const fmMatch = rawContent.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
    if (fmMatch) {
        return { body: fmMatch[2] };
    }
    return { body: rawContent };
}

function findFrontmatterEndLine(lines) {
    if (lines[0]?.trim() !== '---') {
        return 0;
    }
    for (let i = 1; i < lines.length; i++) {
        if (lines[i].trim() === '---') {
            return i + 1;
        }
    }
    return 0;
}

export async function collectPoolInventory({
    rootDir = process.cwd(),
    seriesIds = DEFAULT_SERIES,
} = {}) {
    const assets = [];
    const fragments = [];

    for (const seriesId of seriesIds) {
        const dir = path.join(rootDir, 'assets', 'img', seriesId);
        const mdPath = path.join(dir, 'index.md');
        if (!fs.existsSync(mdPath)) {
            continue;
        }
        parseMarkdownSource(mdPath);
        const rawMd = fs.readFileSync(mdPath, 'utf8');
        const parsed = parseSequencedItems(rawMd, seriesId);
        fragments.push(...parsed.fragments);

        const commPath = path.join(dir, 'commentary.json');
        const comm = fs.existsSync(commPath) ? JSON.parse(fs.readFileSync(commPath, 'utf8')) : {};

        for (const item of parsed.images) {
            const absPath = path.join(dir, item.filename);
            const fileBytes = fs.readFileSync(absPath);
            const sourceSha256 = sha256Buffer(fileBytes);
            const metrics = await classifyImageModality(absPath);
            const entryComm = comm[item.filename] || {};
            const altText =
                entryComm.subject ||
                item.caption ||
                `Photograph ${item.filename} from series ${seriesId}.`;

            assets.push({
                assetId: toAssetId(seriesId, item.filename),
                seriesId,
                filename: item.filename,
                source: `assets/img/${seriesId}/${item.filename}`,
                sourceSha256,
                modality: metrics.modality,
                subtype: metrics.subtype,
                derivativeRecipe: metrics.derivativeRecipe,
                rightsStatus: 'approved',
                altText,
                metrics: {
                    metricVersion: METRIC_VERSION,
                    width: metrics.width,
                    height: metrics.height,
                    p95DeltaRgb: metrics.p95DeltaRgb,
                    luma255: metrics.luma255,
                    lab: metrics.lab,
                },
            });
        }
    }

    const fingerprintInput = assets
        .map((a) => `${a.assetId}:${a.sourceSha256}`)
        .sort()
        .join('|');
    const sourceFingerprint = sha256Buffer(Buffer.from(fingerprintInput, 'utf8'));
    const bwCount = assets.filter((a) => a.modality === 'bw').length;
    const colorCount = assets.filter((a) => a.modality === 'color').length;

    return {
        metricVersion: METRIC_VERSION,
        sourceFingerprint,
        totalAssets: assets.length,
        bwCount,
        colorCount,
        assets,
        fragments,
    };
}

export function parseSeriesArg(args = []) {
    const idx = args.indexOf('--series');
    const raw =
        idx >= 0 && args[idx + 1]
            ? args[idx + 1]
            : (args.find((a) => a.startsWith('--series=')) || '').slice('--series='.length);
    if (!raw) {
        return DEFAULT_SERIES;
    }
    const list = raw
        .split(',')
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean);
    return list.length > 0 ? list : DEFAULT_SERIES;
}

export async function run(args = []) {
    const seriesIds = parseSeriesArg(args);
    const inventory = await collectPoolInventory({ seriesIds });
    const outDir = path.join(process.cwd(), '.cache', 'book-runs');
    fs.mkdirSync(outDir, { recursive: true });
    const outPath = path.join(outDir, 'inventory.json');
    fs.writeFileSync(outPath, `${JSON.stringify(inventory, null, 2)}\n`, 'utf8');
    if (args.includes('--json')) {
        process.stdout.write(`${JSON.stringify(inventory)}\n`);
    } else {
        process.stdout.write(
            `Inventory complete: ${inventory.totalAssets} assets (${inventory.bwCount} bw, ${inventory.colorCount} color)\n`
        );
    }
    return 0;
}
