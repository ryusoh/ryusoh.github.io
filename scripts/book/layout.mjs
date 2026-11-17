/**
 * Compiles an approved ledger + output profile into renderer-neutral canonical layout IR.
 * Enforces 300x200mm geometry, recto/verso parity, silent modality-switch buffer spreads, and effective PPI calculations.
 */

import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { load as yamlLoad } from 'js-yaml';

const SCALE_TO_WIDTH_MM = Object.freeze({
    'full-bleed': 300,
    'inset-82': 246,
    'inset-74': 222,
    'inset-55': 165,
});

export function computeEffectivePpi(widthPx, heightPx, placedWidthMm, placedHeightMm) {
    const ppiW = widthPx / (placedWidthMm / 25.4);
    const ppiH = heightPx / (placedHeightMm / 25.4);
    return Number(Math.min(ppiW, ppiH).toFixed(3));
}

function buildPlateSlot(slot, assetMap, derivativeMap, plateCounter) {
    if (!slot || !slot.assetId) {
        return null;
    }
    const asset = assetMap.get(slot.assetId);
    const deriv = derivativeMap[slot.assetId] || {};
    const scale = slot.scale || 'inset-74';
    const placedWidthMm = SCALE_TO_WIDTH_MM[scale] || 222;
    const placedHeightMm = Number(((placedWidthMm * 2) / 3).toFixed(2));
    const widthPx = deriv.width || asset?.metrics?.width || 2048;
    const heightPx = deriv.height || asset?.metrics?.height || 1365;
    const plateNum = plateCounter.next();

    return {
        kind: 'plate',
        plateNumber: plateNum,
        plateLabel: String(plateNum).padStart(3, '0'),
        assetId: slot.assetId,
        path: deriv.outputPath || asset?.source || '',
        altText: asset?.altText || '',
        modality: asset?.modality || 'bw',
        scale,
        placedWidthMm,
        placedHeightMm,
        effectivePpi: computeEffectivePpi(widthPx, heightPx, placedWidthMm, placedHeightMm),
        showFolio: scale !== 'full-bleed',
    };
}

export function compileLayoutIr(ledger, profile, { derivativeMap = {} } = {}) {
    const assetMap = new Map((ledger.assets || []).map((a) => [a.assetId, a]));
    const fragmentMap = new Map((ledger.fragments || []).map((f) => [f.fragmentId, f]));
    let pCount = 0;
    const plateCounter = { next: () => ++pCount };
    const pages = [];

    const pushPage = (side, content) => {
        pages.push({ pageNumber: pages.length + 1, side, ...content });
    };

    // Page 1 (Recto): Canonical Cover — The Cybernetic Monolith
    pushPage('recto', {
        pageType: 'cover',
        title: ledger.title,
        subtitle: ledger.subtitle,
        author: ledger.author,
        heroAssetId: ledger.constraints?.pinnedOpenerAssetId || 'p1-dscf4775',
        signature: '127 STATES · 51 MONO / 76 CHROMA',
    });

    let prevModality = null;
    for (const mov of ledger.movements || []) {
        if (prevModality && prevModality !== mov.modality) {
            pushPage('verso', { pageType: 'phase-reset-void', modality: mov.modality });
            pushPage('recto', { pageType: 'phase-reset-void', modality: mov.modality });
        }
        prevModality = mov.modality;

        pushPage('verso', { pageType: 'void', modality: mov.modality });
        pushPage('recto', {
            pageType: 'phase-divider',
            movementId: mov.movementId,
            title: mov.title,
            modality: mov.modality,
        });

        for (const sp of mov.spreads || []) {
            let versoSlot = null;
            if (sp.verso?.fragmentId) {
                const frag = fragmentMap.get(sp.verso.fragmentId);
                versoSlot = {
                    kind: 'epigraph',
                    fragmentId: sp.verso.fragmentId,
                    text: frag?.text || '',
                    language: frag?.language || 'en',
                };
            } else if (sp.verso?.assetId) {
                versoSlot = buildPlateSlot(sp.verso, assetMap, derivativeMap, plateCounter);
            }
            const rectoSlot = buildPlateSlot(sp.recto, assetMap, derivativeMap, plateCounter);

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
    }

    if (ledger.includeCommentaryAppendix) {
        pushPage('verso', {
            pageType: 'colophon-telemetry',
            surface: profile.tokens?.surfaceDossier || '#111317',
        });
        pushPage('recto', {
            pageType: 'colophon-index',
            surface: profile.tokens?.surfaceDossier || '#111317',
            totalPlates: pCount,
        });
    }

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
        pageSize: profile.pageSize || { widthMm: 300, heightMm: 200, bleedMm: 0 },
        tokens: profile.tokens,
        totalPages: pages.length,
        totalPlates: pCount,
        layoutHash,
        pages,
    };
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
    const ir = compileLayoutIr(ledger, profile);
    const outPath = path.join(rootDir, '.cache', 'book-runs', `layout-ir-${profileId}.json`);
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, `${JSON.stringify(ir, null, 2)}\n`, 'utf8');
    process.stdout.write(`Layout IR written (${ir.totalPages} pages, ${ir.totalPlates} plates)\n`);
    return 0;
}
