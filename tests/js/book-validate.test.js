'use strict';

const path = require('path');
const { execFileSync } = require('child_process');

const ROOT_DIR = path.resolve(__dirname, '../..');

function runValidate(ledgerObj) {
    const code = `
        import { validateLedgerObject } from './scripts/book/validate.mjs';
        console.log(JSON.stringify(validateLedgerObject(${JSON.stringify(ledgerObj)})));
    `;
    return JSON.parse(
        execFileSync('node', ['--input-type=module', '-e', code], {
            cwd: ROOT_DIR,
            encoding: 'utf8',
        }).trim()
    );
}

function makeValidFixture() {
    const h = 'a'.repeat(64);
    return {
        schemaVersion: 1,
        editionId: 'infinite-systems',
        title: 'INFINITE SYSTEMS',
        subtitle: 'Photographs 2021–2026',
        author: 'Zhuang Liu',
        revision: 1,
        parentRevision: null,
        sourceFingerprint: h,
        approval: { proposalId: 'p1', reviewer: 'Zhuang Liu', approvedAt: '2026-11-17' },
        includeCommentaryAppendix: true,
        assets: [
            {
                assetId: 'p1-a',
                source: 'assets/img/p1/a.jpg',
                sourceSha256: h,
                modality: 'bw',
                derivativeRecipe: 'passthrough-or-downsample-2048',
                rightsStatus: 'approved',
                altText: 'A',
            },
            {
                assetId: 'p2-b',
                source: 'assets/img/p2/b.jpg',
                sourceSha256: h,
                modality: 'color',
                derivativeRecipe: 'passthrough-or-downsample-2048',
                rightsStatus: 'approved',
                altText: 'B',
            },
            {
                assetId: 'p4-c',
                source: 'assets/img/p4/c.jpg',
                sourceSha256: h,
                modality: 'color',
                derivativeRecipe: 'passthrough-or-downsample-2048',
                rightsStatus: 'approved',
                altText: 'C',
            },
            {
                assetId: 'p6-d',
                source: 'assets/img/p6/d.jpg',
                sourceSha256: h,
                modality: 'bw',
                derivativeRecipe: 'passthrough-or-downsample-2048',
                rightsStatus: 'approved',
                altText: 'D',
            },
        ],
        fragments: [],
        constraints: {
            strictModalitySeparation: true,
            requireCompletePool: true,
            pinnedOpenerAssetId: 'p1-a',
            pinnedCloserAssetId: 'p6-d',
            bannedAssetPairs: [['p2-b', 'p4-c']],
        },
        movements: [
            {
                movementId: 'SYS.01',
                title: 'THRESHOLD',
                modality: 'bw',
                spreads: [
                    {
                        spreadId: 's01',
                        layout: 'monolith',
                        locked: true,
                        verso: null,
                        recto: { assetId: 'p1-a', scale: 'full-bleed' },
                    },
                ],
            },
            {
                movementId: 'SYS.02',
                title: 'KINEMATICS',
                modality: 'color',
                spreads: [
                    {
                        spreadId: 's02',
                        layout: 'monolith',
                        locked: false,
                        verso: null,
                        recto: { assetId: 'p2-b', scale: 'inset-82' },
                    },
                ],
            },
            {
                movementId: 'SYS.03',
                title: 'PHANTOM',
                modality: 'color',
                spreads: [
                    {
                        spreadId: 's03',
                        layout: 'monolith',
                        locked: false,
                        verso: null,
                        recto: { assetId: 'p4-c', scale: 'inset-82' },
                    },
                ],
            },
            {
                movementId: 'SYS.04',
                title: 'SINGULARITY',
                modality: 'bw',
                spreads: [
                    {
                        spreadId: 's04',
                        layout: 'monolith',
                        locked: false,
                        verso: null,
                        recto: { assetId: 'p6-d', scale: 'full-bleed' },
                    },
                ],
            },
        ],
    };
}

describe('scripts/book/validate.mjs', () => {
    test('accepts a valid 4-movement Chiaroscuro Envelope ledger', () => {
        const res = runValidate(makeValidFixture());
        expect(res).toEqual({ valid: true, errors: [] });
    });

    test('rejects mixing B&W and Color assets in the same movement', () => {
        const bad = makeValidFixture();
        bad.movements[0].spreads[0].verso = { assetId: 'p2-b', scale: 'inset-55' };
        const res = runValidate(bad);
        expect(res.valid).toBe(false);
        expect(res.errors.join(' ')).toContain('Modality violation');
    });

    test('rejects banned asset pairs and path traversal', () => {
        const bad = makeValidFixture();
        bad.assets[0].source = 'assets/img/../secret.jpg';
        bad.movements[1].spreads[0] = {
            spreadId: 's02',
            layout: 'symmetric-diptych',
            locked: false,
            verso: { assetId: 'p2-b', scale: 'inset-74' },
            recto: { assetId: 'p4-c', scale: 'inset-74' },
        };
        const res = runValidate(bad);
        expect(res.valid).toBe(false);
        expect(res.errors.join(' ')).toContain('Unsafe or invalid asset source path');
        expect(res.errors.join(' ')).toContain('Banned pair violation');
    });
});
