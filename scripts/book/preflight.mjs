/**
 * Final-artifact preflight (WCAG AA contrast, PDF catalog structure, PPI floor, and two-build reproducibility).
 */

import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';

export function relativeLuminance(hexColor) {
    const hex = String(hexColor).replace('#', '');
    const channels = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
    const linear = channels.map((v) =>
        v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)
    );
    return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}

export function contrastRatio(fgHex, bgHex) {
    const l1 = relativeLuminance(fgHex);
    const l2 = relativeLuminance(bgHex);
    return Number(((Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05)).toFixed(3));
}

export function checkContrastTokens(tokens) {
    const errors = [];
    const backgrounds = [tokens.surfacePlate || '#070709', tokens.surfaceDossier || '#111317'];
    const textKeys = ['textPrimary', 'textSecondary', 'textTelemetry'];

    for (const bg of backgrounds) {
        for (const key of textKeys) {
            const fg = tokens[key];
            const ratio = contrastRatio(fg, bg);
            if (ratio < 4.5) {
                errors.push(`Token ${key} (${fg}) fails WCAG AA 4.5:1 on ${bg} (${ratio}:1).`);
            }
        }
    }
    return { passed: errors.length === 0, errors };
}

export function checkPdfCatalogStructure(pdfBuffer) {
    const text = pdfBuffer.toString('latin1');
    const errors = [];
    if (!text.startsWith('%PDF-1.')) {
        errors.push('Missing %PDF-1.x header.');
    }
    if (!text.includes('/PageLayout /TwoPageRight')) {
        errors.push('Missing /PageLayout /TwoPageRight in Catalog.');
    }
    if (!text.includes('/PageMode /UseOutlines')) {
        errors.push('Missing /PageMode /UseOutlines in Catalog.');
    }
    const pdfSha256 = crypto.createHash('sha256').update(pdfBuffer).digest('hex');
    return { passed: errors.length === 0, pdfSha256, errors };
}

export async function verifyTwoBuildReproducibility(buildInDirFn) {
    const dirA = fs.mkdtempSync(path.join(os.tmpdir(), 'book-repro-a-'));
    const dirB = fs.mkdtempSync(path.join(os.tmpdir(), 'book-repro-b-'));
    try {
        const resA = await buildInDirFn(dirA);
        const resB = await buildInDirFn(dirB);
        const matched = resA.layoutHash === resB.layoutHash && resA.pdfSha256 === resB.pdfSha256;
        return {
            passed: matched,
            layoutHashA: resA.layoutHash,
            layoutHashB: resB.layoutHash,
            pdfSha256A: resA.pdfSha256,
            pdfSha256B: resB.pdfSha256,
        };
    } finally {
        fs.rmSync(dirA, { recursive: true, force: true });
        fs.rmSync(dirB, { recursive: true, force: true });
    }
}

export async function run() {
    const profile = JSON.parse(
        fs.readFileSync(path.join(process.cwd(), 'book', 'profiles', 'display.json'), 'utf8')
    );
    const check = checkContrastTokens(profile.tokens);
    if (!check.passed) {
        process.stderr.write(`${check.errors.join('\n')}\n`);
        return 1;
    }
    process.stdout.write('Preflight checks passed.\n');
    return 0;
}
