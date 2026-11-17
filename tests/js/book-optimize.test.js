'use strict';

const path = require('path');
const { execFileSync } = require('child_process');

const ROOT_DIR = path.resolve(__dirname, '../..');

function runEsm(code) {
    const script = `(async () => { ${code} })().then((v) => console.log(JSON.stringify(v)));`;
    return JSON.parse(
        execFileSync('node', ['--input-type=module', '-e', script], {
            cwd: ROOT_DIR,
            encoding: 'utf8',
        }).trim()
    );
}

describe('scripts/book/optimize.mjs & sync.mjs', () => {
    const h = 'b'.repeat(64);
    const mockInventory = {
        sourceFingerprint: h,
        fragments: [
            {
                fragmentId: 'p1-lines-1-2',
                source: 'assets/img/p1/index.md',
                sourceRange: { startLine: 1, endLine: 2 },
                language: 'en',
                text: 'Test verse',
                attribution: null,
                originality: 'series-epigraph',
                rightsStatus: 'approved',
                excerptPolicy: 'verbatim-only',
            },
        ],
        assets: [
            {
                assetId: 'p1-a',
                seriesId: 'p1',
                source: 'assets/img/p1/a.jpg',
                sourceSha256: h,
                modality: 'bw',
                derivativeRecipe: 'passthrough-or-downsample-2048',
                rightsStatus: 'approved',
                altText: 'A',
                metrics: { luma255: 40, lab: { L: 20, a: 0, b: 0 } },
            },
            {
                assetId: 'p6-b',
                seriesId: 'p6',
                source: 'assets/img/p6/b.jpg',
                sourceSha256: h,
                modality: 'bw',
                derivativeRecipe: 'passthrough-or-downsample-2048',
                rightsStatus: 'approved',
                altText: 'B',
                metrics: { luma255: 80, lab: { L: 35, a: 0, b: 0 } },
            },
            {
                assetId: 'p2-c',
                seriesId: 'p2',
                source: 'assets/img/p2/c.jpg',
                sourceSha256: h,
                modality: 'color',
                derivativeRecipe: 'passthrough-or-downsample-2048',
                rightsStatus: 'approved',
                altText: 'C',
                metrics: { luma255: 140, lab: { L: 60, a: 12, b: 20 } },
            },
            {
                assetId: 'p4-d',
                seriesId: 'p4',
                source: 'assets/img/p4/d.jpg',
                sourceSha256: h,
                modality: 'color',
                derivativeRecipe: 'passthrough-or-downsample-2048',
                rightsStatus: 'approved',
                altText: 'D',
                metrics: { luma255: 50, lab: { L: 25, a: -4, b: -10 } },
            },
        ],
    };

    test('builds a valid, deterministic 4-movement ledger and blocks locked-spread deletions', () => {
        const res = runEsm(`
            const { buildCandidateLedger } = await import('./scripts/book/optimize.mjs');
            const { validateLedgerObject } = await import('./scripts/book/validate.mjs');
            const { createSyncPlan } = await import('./scripts/book/sync.mjs');

            const inv = ${JSON.stringify(mockInventory)};
            const c1 = buildCandidateLedger(inv, { seed: 7 });
            const c2 = buildCandidateLedger(inv, { seed: 7 });
            const valid = validateLedgerObject(c1);

            const reducedInv = { ...inv, assets: inv.assets.slice(1) };
            const plan = createSyncPlan(reducedInv, c1);
            return { sameSeedEqual: JSON.stringify(c1) === JSON.stringify(c2), valid, plan };
        `);

        expect(res.sameSeedEqual).toBe(true);
        expect(res.valid).toEqual({ valid: true, errors: [] });
        expect(res.plan.blockingConflicts).toHaveLength(1);
        expect(res.plan.blockingConflicts[0].type).toBe('locked-spread-deletion');
    });
});
