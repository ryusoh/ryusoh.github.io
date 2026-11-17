/**
 * Compiles an approved ledger + output profile into renderer-neutral canonical layout IR.
 * Enforces profile page geometry (default 210x260mm monograph portrait), recto/verso parity,
 * silent modality-switch buffer spreads, and effective PPI calculations.
 */

import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { load as yamlLoad } from 'js-yaml';
import { ensureCoverDerivative } from './assets.mjs';

const SCALE_FACTORS = Object.freeze({
    'full-bleed': 1.0,
    'inset-82': 0.82,
    'inset-74': 0.74,
    'inset-55': 0.55,
    'inset-40': 0.4,
});

function toTypstAssetPath(rawPath, rootDir) {
    if (!rawPath || !rootDir) {
        return rawPath || '';
    }
    const abs = path.isAbsolute(rawPath) ? rawPath : path.resolve(rootDir, rawPath);
    const rel = path.relative(rootDir, abs);
    if (!rel.startsWith('..') && !path.isAbsolute(rel)) {
        return `/${rel.split(path.sep).join('/')}`;
    }
    return rawPath;
}

export function computeEffectivePpi(widthPx, heightPx, placedWidthMm, placedHeightMm) {
    const ppiW = widthPx / (placedWidthMm / 25.4);
    const ppiH = heightPx / (placedHeightMm / 25.4);
    return Number(Math.min(ppiW, ppiH).toFixed(3));
}

function buildPlateSlot(
    slot,
    assetMap,
    { derivativeMap, assetMetrics, rootDir, pageWidthMm, includeFolios = true },
    plateCounter
) {
    if (!slot || !slot.assetId) {
        return null;
    }
    const asset = assetMap.get(slot.assetId);
    const deriv = derivativeMap[slot.assetId] || {};
    const invMeta = assetMetrics[slot.assetId] || {};
    const scale = slot.scale || 'inset-74';
    const factor = SCALE_FACTORS[scale] ?? 0.74;
    const placedWidthMm = Number((pageWidthMm * factor).toFixed(2));
    const widthPx = deriv.width || asset?.metrics?.width || invMeta.width || 2048;
    const heightPx = deriv.height || asset?.metrics?.height || invMeta.height || 1365;
    const placedHeightMm =
        widthPx >= heightPx
            ? Number(((placedWidthMm * 2) / 3).toFixed(2))
            : Number((placedWidthMm * (heightPx / widthPx)).toFixed(2));
    const plateNum = plateCounter.next();
    const rawPath = deriv.outputPath || asset?.source || '';

    const seriesMatch = String(slot.assetId).match(/^(p[0-9]+)-/);
    const luma255 = Number(asset?.metrics?.luma255 ?? invMeta.luma255 ?? 48);
    const labL = Number((asset?.metrics?.lab?.L ?? invMeta.lab?.L ?? 20).toFixed(1));

    return {
        kind: 'plate',
        plateNumber: plateNum,
        plateLabel: String(plateNum).padStart(3, '0'),
        assetId: slot.assetId,
        seriesId: (asset?.seriesId || seriesMatch?.[1] || 'p1').toUpperCase(),
        path: toTypstAssetPath(rawPath, rootDir),
        altText: asset?.altText || '',
        shortCaption: truncateCaption(asset?.altText, 62),
        modality: asset?.modality || 'bw',
        luma255,
        labL,
        scale,
        placedWidthMm,
        placedHeightMm,
        effectivePpi: computeEffectivePpi(widthPx, heightPx, placedWidthMm, placedHeightMm),
        showFolio: includeFolios && scale !== 'full-bleed',
    };
}

const ROMAN_NUMERALS = Object.freeze(['I', 'II', 'III', 'IV']);
const INDEX_PAGE_SIZE = 32;

function truncateCaption(rawText, maxLen = 62) {
    const clean = String(rawText || '').trim();
    if (clean.length <= maxLen) {
        return clean;
    }
    const cut = clean.slice(0, maxLen).replace(/\s+\S*$/, '');
    return `${cut || clean.slice(0, maxLen)}…`;
}

function buildEpigraphSlot(verso, fragmentMap) {
    const frag = fragmentMap.get(verso.fragmentId);
    return {
        kind: 'epigraph',
        fragmentId: verso.fragmentId,
        text: frag?.text || '',
        attribution: frag?.attribution || null,
        language: frag?.language || 'en',
    };
}

function appendColophonPages(
    pages,
    pushPage,
    { ledger, profile, placedPlates, movementSummaries }
) {
    if (!ledger.includeCommentaryAppendix) {
        return;
    }
    const surface = profile.tokens?.surfaceDossier || '#111317';
    pushPage('verso', {
        pageType: 'colophon-telemetry',
        surface,
        sourceFingerprintShort: String(ledger.sourceFingerprint || '').slice(0, 16),
        movementSummaries,
    });
    const chunks = [];
    for (let i = 0; i < placedPlates.length; i += INDEX_PAGE_SIZE) {
        chunks.push(placedPlates.slice(i, i + INDEX_PAGE_SIZE));
    }
    if (chunks.length === 0) {
        chunks.push([]);
    }
    chunks.forEach((entries, idx) => {
        const side = idx % 2 === 0 ? 'recto' : 'verso';
        const rangeStart = entries[0]?.plateLabel || '001';
        const rangeEnd = entries[entries.length - 1]?.plateLabel || rangeStart;
        pushPage(side, {
            pageType: 'colophon-index',
            surface,
            indexPageNumber: idx + 1,
            indexPageCount: chunks.length,
            rangeLabel: `${rangeStart}–${rangeEnd}`,
            totalPlates: placedPlates.length,
            entries,
        });
    });
}

export function compileLayoutIr(
    ledger,
    profile,
    { derivativeMap = {}, assetMetrics = {}, rootDir = null, coverImage = null } = {}
) {
    const assetMap = new Map((ledger.assets || []).map((a) => [a.assetId, a]));
    const fragmentMap = new Map((ledger.fragments || []).map((f) => [f.fragmentId, f]));
    let pCount = 0;
    const plateCounter = { next: () => ++pCount };
    const pageSize = profile?.pageSize || { widthMm: 210, heightMm: 260, bleedMm: 0 };
    const includeFolios = ledger.includeFolios !== false;
    const includeDividers = ledger.includeMovementDividers !== false;
    const slotOpts = {
        derivativeMap,
        assetMetrics,
        rootDir,
        pageWidthMm: pageSize.widthMm,
        includeFolios,
    };
    const pages = [];
    const placedPlates = [];
    const movementSummaries = [];
    const allAssets = ledger.assets || [];
    const bwTotal = allAssets.filter((a) => a.modality === 'bw').length;
    const colorTotal = allAssets.length - bwTotal;
    const totalMovements = (ledger.movements || []).length || 1;

    const pushPage = (side, content) => {
        const entry = { pageNumber: pages.length + 1, side, ...content };
        pages.push(entry);
        return entry;
    };

    pushPage('recto', {
        pageType: 'cover',
        title: ledger.title,
        subtitle: ledger.subtitle,
        author: ledger.author,
        coverImagePath: coverImage?.path ? toTypstAssetPath(coverImage.path, rootDir) : null,
        heroAssetId: ledger.constraints?.pinnedOpenerAssetId || 'p1-dscf4775',
        signature: `${allAssets.length} STATES · ${bwTotal} MONO / ${colorTotal} CHROMA`,
    });

    let prevModality = null;
    (ledger.movements || []).forEach((mov, movIdx) => {
        if (prevModality && prevModality !== mov.modality) {
            pushPage('verso', { pageType: 'phase-reset-void', modality: mov.modality });
            pushPage('recto', { pageType: 'phase-reset-void', modality: mov.modality });
        }
        prevModality = mov.modality;

        let dividerPage = null;
        if (includeDividers) {
            pushPage('verso', { pageType: 'void', modality: mov.modality });
            dividerPage = pushPage('recto', {
                pageType: 'phase-divider',
                movementId: mov.movementId,
                movementRoman: ROMAN_NUMERALS[movIdx] || String(movIdx + 1),
                movementIndexLabel: `0${movIdx + 1} / 0${totalMovements}`,
                title: mov.title,
                modality: mov.modality,
                modalityLabel: mov.modality === 'bw' ? 'Achromatic Silver' : 'Chromatic',
                plateRange: '001–001',
                plateCount: 0,
                meanLuma: 0,
                waveformSlice: [],
            });
        }
        const movPlates = [];

        for (const sp of mov.spreads || []) {
            let versoSlot = null;
            if (sp.verso?.fragmentId) {
                versoSlot = buildEpigraphSlot(sp.verso, fragmentMap);
            } else if (sp.verso?.assetId) {
                versoSlot = buildPlateSlot(sp.verso, assetMap, slotOpts, plateCounter);
                if (versoSlot) {
                    placedPlates.push(versoSlot);
                    movPlates.push(versoSlot);
                }
            }
            const rectoSlot = buildPlateSlot(sp.recto, assetMap, slotOpts, plateCounter);
            if (rectoSlot) {
                placedPlates.push(rectoSlot);
                movPlates.push(rectoSlot);
            }

            pushPage('verso', {
                pageType: 'spread-verso',
                spreadId: sp.spreadId,
                layout: sp.layout,
                modality: mov.modality,
                slot: versoSlot,
            });
            pushPage('recto', {
                pageType: 'spread-recto',
                spreadId: sp.spreadId,
                layout: sp.layout,
                modality: mov.modality,
                slot: rectoSlot,
            });
        }

        const firstLbl = movPlates[0]?.plateLabel || '001';
        const lastLbl = movPlates[movPlates.length - 1]?.plateLabel || firstLbl;
        const sumLuma = movPlates.reduce((acc, p) => acc + p.luma255, 0);
        const plateRange = `${firstLbl}–${lastLbl}`;
        const meanLuma = movPlates.length ? Number((sumLuma / movPlates.length).toFixed(1)) : 0;
        const movRoman = ROMAN_NUMERALS[movIdx] || String(movIdx + 1);
        const modLabel = mov.modality === 'bw' ? 'Achromatic Silver' : 'Chromatic';
        if (dividerPage) {
            dividerPage.plateRange = plateRange;
            dividerPage.plateCount = movPlates.length;
            dividerPage.meanLuma = meanLuma;
            dividerPage.waveformSlice = movPlates.map((p) => ({
                plateNumber: p.plateNumber,
                luma255: p.luma255,
            }));
        }
        movementSummaries.push({
            movementId: mov.movementId,
            movementRoman: movRoman,
            title: mov.title,
            modalityLabel: modLabel,
            plateRange,
            plateCount: movPlates.length,
            meanLuma,
        });
    });

    appendColophonPages(pages, pushPage, { ledger, profile, placedPlates, movementSummaries });

    const canonicalPayload = JSON.stringify({
        editionId: ledger.editionId,
        revision: ledger.revision,
        profileId: profile.profileId,
        pages,
    });
    const layoutHash = crypto.createHash('sha256').update(canonicalPayload).digest('hex');

    return {
        editionId: ledger.editionId,
        revision: ledger.revision,
        profileId: profile.profileId,
        pageSize,
        tokens: profile.tokens,
        totalPages: pages.length,
        totalPlates: pCount,
        waveform: placedPlates.map((p) => ({
            plateNumber: p.plateNumber,
            luma255: p.luma255,
            labL: p.labL,
            modality: p.modality,
        })),
        layoutHash,
        pages,
    };
}

export function loadCachedAssetMetrics(rootDir) {
    const invPath = path.join(rootDir, '.cache', 'book-runs', 'inventory.json');
    if (!fs.existsSync(invPath)) {
        return {};
    }
    const inv = JSON.parse(fs.readFileSync(invPath, 'utf8'));
    const metrics = {};
    for (const a of inv.assets || []) {
        if (a.metrics) {
            metrics[a.assetId] = a.metrics;
        }
    }
    return metrics;
}

export async function run(args = []) {
    const profileId = args.includes('screen') ? 'screen' : 'display';
    const rootDir = process.cwd();
    const ledgerPath = path.join(rootDir, 'book', 'sequence.yaml');
    const profilePath = path.join(rootDir, 'book', 'profiles', `${profileId}.json`);
    if (!fs.existsSync(ledgerPath)) {
        process.stderr.write(`Missing approved ledger: ${ledgerPath}\n`);
        return 1;
    }
    const ledger = yamlLoad(fs.readFileSync(ledgerPath, 'utf8'));
    const profile = JSON.parse(fs.readFileSync(profilePath, 'utf8'));
    const assetMetrics = loadCachedAssetMetrics(rootDir);
    const coverImage = await ensureCoverDerivative({ rootDir, profileId });
    const ir = compileLayoutIr(ledger, profile, { assetMetrics, rootDir, coverImage });
    const outPath = path.join(rootDir, '.cache', 'book-runs', `layout-ir-${profileId}.json`);
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, `${JSON.stringify(ir, null, 2)}\n`, 'utf8');
    process.stdout.write(`Layout IR written (${ir.totalPages} pages, ${ir.totalPlates} plates)\n`);
    return 0;
}
