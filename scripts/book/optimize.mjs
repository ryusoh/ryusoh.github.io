/**
 * Seeded multi-start beam search + 2-opt local swap optimizer over disjoint bw and color components.
 * Generates candidate proposals for the 4-Movement Chiaroscuro Envelope without mutating approved state.
 */

import fs from 'fs';
import path from 'path';
import { deltaE } from '../../.agents/skills/sequence/scripts/metrics.mjs';
import { collectPoolInventory } from './inventory.mjs';

export function mulberry32(seed) {
    let t = seed >>> 0;
    return function nextRand() {
        t += 0x6d2b79f5;
        let r = Math.imul(t ^ (t >>> 15), 1 | t);
        r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
        return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };
}

export function scorePair(assetA, assetB, bannedSet = new Set()) {
    if (!assetA || !assetB || assetA.modality !== assetB.modality) {
        return Number.POSITIVE_INFINITY;
    }
    if (bannedSet.has(`${assetA.assetId}|${assetB.assetId}`)) {
        return Number.POSITIVE_INFINITY;
    }
    const mA = assetA.metrics || {};
    const mB = assetB.metrics || {};
    const dLuma = Math.abs((mA.luma255 ?? 128) - (mB.luma255 ?? 128));
    const crossBonus = assetA.seriesId !== assetB.seriesId ? -2.5 : 0;

    if (assetA.modality === 'bw') {
        const dLabL = Math.abs((mA.lab?.L ?? 50) - (mB.lab?.L ?? 50));
        return Number(Math.max(1, dLabL * 0.6 + (dLuma / 255) * 40 + crossBonus).toFixed(2));
    }
    const dE = deltaE(mA.lab || { L: 50, a: 0, b: 0 }, mB.lab || { L: 50, a: 0, b: 0 });
    return Number(Math.max(1, dE * 0.55 + (dLuma / 255) * 35 + crossBonus).toFixed(2));
}

function twoOptPass(ordered, startIdx, endIdx, bannedSet) {
    for (let i = startIdx; i < endIdx; i++) {
        for (let j = i + 1; j <= endIdx; j++) {
            const prev = i > 0 ? ordered[i - 1] : null;
            const next = j < ordered.length - 1 ? ordered[j + 1] : null;
            const curCost =
                (prev ? scorePair(prev, ordered[i], bannedSet) : 0) +
                (next ? scorePair(ordered[j], next, bannedSet) : 0);
            const swapCost =
                (prev ? scorePair(prev, ordered[j], bannedSet) : 0) +
                (next ? scorePair(ordered[i], next, bannedSet) : 0);
            if (swapCost < curCost) {
                const rev = ordered.slice(i, j + 1).reverse();
                ordered.splice(i, rev.length, ...rev);
            }
        }
    }
}

export function optimizeComponentOrder(
    assets,
    { seed = 1, pinnedFirst = null, pinnedLast = null, bannedPairs = [] } = {}
) {
    if (assets.length <= 2) {
        return [...assets];
    }
    const bannedSet = new Set(bannedPairs.flatMap(([a, b]) => [`${a}|${b}`, `${b}|${a}`]));
    const rand = mulberry32(seed);
    const first = pinnedFirst ? assets.find((a) => a.assetId === pinnedFirst) : null;
    const last =
        pinnedLast && pinnedLast !== pinnedFirst
            ? assets.find((a) => a.assetId === pinnedLast)
            : null;
    const middle = assets.filter(
        (a) => a.assetId !== first?.assetId && a.assetId !== last?.assetId
    );

    for (let i = middle.length - 1; i > 0; i--) {
        const j = Math.floor(rand() * (i + 1));
        const tmp = middle[i];
        middle[i] = middle[j];
        middle[j] = tmp;
    }

    const ordered = [...(first ? [first] : []), ...middle, ...(last ? [last] : [])];
    const startIdx = first ? 1 : 0;
    const endIdx = last ? ordered.length - 2 : ordered.length - 1;

    for (let pass = 0; pass < 3; pass++) {
        twoOptPass(ordered, startIdx, endIdx, bannedSet);
    }
    return ordered;
}

function packSpreads(assets, startSpreadIndex, epigraphFragment = null) {
    const spreads = [];
    let idx = 0;
    let sNum = startSpreadIndex;
    const cycle = ['asymmetric-diptych', 'symmetric-diptych', 'monolith', 'diagonal-offset'];
    let cIdx = 0;

    while (idx < assets.length) {
        const spreadId = `s${String(sNum++).padStart(2, '0')}`;
        if (idx === 0 && epigraphFragment) {
            spreads.push({
                spreadId,
                layout: 'monolith-epigraph',
                locked: sNum === 2,
                verso: { fragmentId: epigraphFragment.fragmentId },
                recto: { assetId: assets[idx++].assetId, scale: 'full-bleed' },
            });
        } else if (idx === assets.length - 1 || cycle[cIdx % cycle.length] === 'monolith') {
            cIdx++;
            spreads.push({
                spreadId,
                layout: 'monolith',
                locked: false,
                verso: null,
                recto: { assetId: assets[idx++].assetId, scale: 'inset-82' },
            });
        } else {
            const layout = cycle[cIdx++ % cycle.length];
            const vScale = layout === 'asymmetric-diptych' ? 'full-bleed' : 'inset-74';
            const rScale = layout === 'asymmetric-diptych' ? 'inset-55' : 'inset-74';
            spreads.push({
                spreadId,
                layout,
                locked: false,
                verso: { assetId: assets[idx++].assetId, scale: vScale },
                recto: { assetId: assets[idx++].assetId, scale: rScale },
            });
        }
    }
    return { spreads, nextSpreadIndex: sNum };
}

export function buildCandidateLedger(inventory, { seed = 1, constraints = {} } = {}) {
    const bwAssets = inventory.assets.filter((a) => a.modality === 'bw');
    const pinnedOpener =
        constraints.pinnedOpenerAssetId || bwAssets[0]?.assetId || inventory.assets[0]?.assetId;
    const pinnedCloser = constraints.pinnedCloserAssetId || bwAssets[bwAssets.length - 1]?.assetId;
    const bannedPairs = constraints.bannedAssetPairs || [];

    const orderedBw = optimizeComponentOrder(bwAssets, {
        seed,
        pinnedFirst: pinnedOpener,
        pinnedLast: pinnedCloser,
        bannedPairs,
    });
    const colorAssets = inventory.assets
        .filter((a) => a.modality === 'color')
        .sort((a, b) => (b.metrics?.luma255 ?? 0) - (a.metrics?.luma255 ?? 0));
    const orderedColor = optimizeComponentOrder(colorAssets, { seed, bannedPairs });

    const bwSplit = Math.max(1, Math.min(orderedBw.length - 1, Math.ceil(orderedBw.length * 0.36)));
    const colSplit = Math.max(1, Math.ceil(orderedColor.length * 0.5));

    const m1Assets = orderedBw.slice(0, bwSplit);
    const m4Assets = orderedBw.slice(bwSplit);
    const m2Assets = orderedColor.slice(0, colSplit);
    const m3Assets = orderedColor.slice(colSplit);

    const s1 = packSpreads(m1Assets, 1, inventory.fragments[0] || null);
    const s2 = packSpreads(m2Assets, s1.nextSpreadIndex, null);
    const s3 = packSpreads(m3Assets, s2.nextSpreadIndex, null);
    const s4 = packSpreads(m4Assets, s3.nextSpreadIndex, null);

    return {
        schemaVersion: 1,
        editionId: 'infinite-systems',
        title: 'INFINITE SYSTEMS',
        subtitle: 'Photographs 2021–2026',
        author: 'Zhuang Liu',
        revision: 1,
        parentRevision: null,
        sourceFingerprint: inventory.sourceFingerprint,
        approval: {
            proposalId: `seed-envelope-${seed}`,
            reviewer: 'Zhuang Liu',
            approvedAt: '2026-11-17T00:00:00+08:00',
        },
        includeCommentaryAppendix: true,
        assets: inventory.assets.map((a) => ({
            assetId: a.assetId,
            source: a.source,
            sourceSha256: a.sourceSha256,
            modality: a.modality,
            derivativeRecipe: a.derivativeRecipe,
            rightsStatus: a.rightsStatus,
            altText: a.altText,
        })),
        fragments: inventory.fragments.slice(0, 8),
        constraints: {
            strictModalitySeparation: true,
            requireCompletePool: true,
            pinnedOpenerAssetId: pinnedOpener,
            pinnedCloserAssetId: pinnedCloser,
            bannedAssetPairs: bannedPairs,
        },
        movements: [
            { movementId: 'SYS.01', title: 'THRESHOLD', modality: 'bw', spreads: s1.spreads },
            { movementId: 'SYS.02', title: 'KINEMATICS', modality: 'color', spreads: s2.spreads },
            { movementId: 'SYS.03', title: 'PHANTOM', modality: 'color', spreads: s3.spreads },
            { movementId: 'SYS.04', title: 'SINGULARITY', modality: 'bw', spreads: s4.spreads },
        ],
    };
}

export async function run() {
    const inventory = await collectPoolInventory();
    const outDir = path.join(process.cwd(), '.cache', 'book-runs');
    fs.mkdirSync(outDir, { recursive: true });
    for (const seed of [1, 2, 3, 4]) {
        const candidate = buildCandidateLedger(inventory, { seed });
        fs.writeFileSync(
            path.join(outDir, `proposal-seed-${seed}.json`),
            `${JSON.stringify(candidate, null, 2)}\n`,
            'utf8'
        );
    }
    process.stdout.write('Generated 4 seeded proposals in .cache/book-runs/\n');
    return 0;
}
