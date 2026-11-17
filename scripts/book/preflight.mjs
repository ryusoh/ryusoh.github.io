/**
 * Final-artifact preflight (WCAG AA contrast, PDF catalog structure, PPI floor, and two-build reproducibility).
 */

import { execFileSync } from 'child_process';
import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { load as yamlLoad } from 'js-yaml';
import { verifyBookFonts } from './assets.mjs';
import { loadCachedAssetMetrics, compileLayoutIr } from './layout.mjs';
import { buildProfileArtifact } from './render.mjs';
import { validateLedgerObject } from './validate.mjs';

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

async function runRepro(rootDir) {
    const ledgerPath = path.join(rootDir, 'book', 'sequence.yaml');
    if (!fs.existsSync(ledgerPath)) {
        process.stderr.write(`Missing approved ledger: ${ledgerPath}\n`);
        return 1;
    }
    const ledger = yamlLoad(fs.readFileSync(ledgerPath, 'utf8'));
    const profile = JSON.parse(
        fs.readFileSync(path.join(rootDir, 'book', 'profiles', 'display.json'), 'utf8')
    );
    const assetMetrics = loadCachedAssetMetrics(rootDir);
    const sandboxDir = path.join(rootDir, '.cache', 'book-runs', 'repro-sandbox');
    const repro = await verifyTwoBuildReproducibility(async () => {
        fs.rmSync(sandboxDir, { recursive: true, force: true });
        try {
            return await buildProfileArtifact(ledger, profile, {
                rootDir,
                cacheDir: path.join(sandboxDir, 'img'),
                runsDir: path.join(sandboxDir, 'runs'),
                outDir: path.join(sandboxDir, 'dist'),
                assetMetrics,
            });
        } finally {
            fs.rmSync(sandboxDir, { recursive: true, force: true });
        }
    });
    if (!repro.passed) {
        process.stderr.write(
            `Reproducibility check FAILED: layout(${repro.layoutHashA.slice(0, 8)} vs ${repro.layoutHashB.slice(0, 8)}), pdf(${repro.pdfSha256A.slice(0, 8)} vs ${repro.pdfSha256B.slice(0, 8)})\n`
        );
        return 1;
    }
    process.stdout.write(
        `Reproducibility check PASSED: layout=${repro.layoutHashA.slice(0, 12)}, pdf=${repro.pdfSha256A.slice(0, 12)}\n`
    );
    return 0;
}

function checkMinPpi(ir, errors) {
    const lowPpi = [];
    for (const pg of ir.pages) {
        if (pg.slot?.kind === 'plate' && pg.slot.effectivePpi < 150) {
            lowPpi.push(`${pg.slot.assetId} (${pg.slot.effectivePpi} PPI at ${pg.slot.scale})`);
        }
    }
    if (lowPpi.length > 0) {
        errors.push(`PPI floor (<150) failed: ${lowPpi.join(', ')}`);
    }
}

function checkBuiltPdfs(rootDir, profileIds, errors) {
    for (const pid of profileIds) {
        const pdfPath = path.join(rootDir, 'dist', `infinite-systems-${pid}.pdf`);
        if (!fs.existsSync(pdfPath)) {
            continue;
        }
        const cat = checkPdfCatalogStructure(fs.readFileSync(pdfPath));
        if (!cat.passed) {
            errors.push(...cat.errors.map((e) => `${pid}: ${e}`));
        }
        try {
            execFileSync('qpdf', ['--check', pdfPath], { stdio: 'pipe' });
        } catch (err) {
            errors.push(`${pid}: qpdf --check failed (${err.message})`);
        }
    }
}

export async function run(_args = [], { subcommand = 'preflight' } = {}) {
    const rootDir = process.cwd();
    if (subcommand === 'repro') {
        return runRepro(rootDir);
    }

    const errors = [];
    const profileIds = ['display', 'screen'];
    const profiles = {};
    for (const pid of profileIds) {
        const profile = JSON.parse(
            fs.readFileSync(path.join(rootDir, 'book', 'profiles', `${pid}.json`), 'utf8')
        );
        profiles[pid] = profile;
        const cCheck = checkContrastTokens(profile.tokens);
        if (!cCheck.passed) {
            errors.push(...cCheck.errors.map((e) => `${pid}: ${e}`));
        }
    }

    const ledgerPath = path.join(rootDir, 'book', 'sequence.yaml');
    if (fs.existsSync(ledgerPath)) {
        const ledger = yamlLoad(fs.readFileSync(ledgerPath, 'utf8'));
        const vCheck = validateLedgerObject(ledger);
        if (!vCheck.valid) {
            errors.push(...vCheck.errors);
        }
        const fonts = verifyBookFonts(path.join(rootDir, 'assets', 'fonts', 'book'));
        if (!fonts.valid) {
            errors.push(`Missing book fonts: ${fonts.missing.join(', ')}`);
        }
        const assetMetrics = loadCachedAssetMetrics(rootDir);
        const ir = compileLayoutIr(ledger, profiles.display, { assetMetrics, rootDir });
        checkMinPpi(ir, errors);
        checkBuiltPdfs(rootDir, profileIds, errors);
    }

    if (errors.length > 0) {
        process.stderr.write(`${errors.join('\n')}\n`);
        return 1;
    }
    process.stdout.write('Preflight checks passed.\n');
    return 0;
}
