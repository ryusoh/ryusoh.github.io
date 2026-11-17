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

describe('scripts/book/preview.mjs', () => {
    test('rejects stale out-of-order renders (A -> B -> C) and gates export on matching preflight hash', () => {
        const res = runEsm(`
            const fs = (await import('fs')).default;
            const { createPreviewSession } = await import('./scripts/book/preview.mjs');
            const profile = JSON.parse(fs.readFileSync('./book/profiles/display.json', 'utf8'));
            const baseLedger = {
                editionId: 'infinite-systems',
                title: 'INFINITE SYSTEMS',
                subtitle: 'Sub',
                author: 'Zhuang Liu',
                revision: 1,
                includeCommentaryAppendix: false,
                constraints: { pinnedOpenerAssetId: 'p1-a' },
                assets: [{ assetId: 'p1-a', source: 'assets/img/p1/a.jpg', modality: 'bw', altText: 'A', metrics: { width: 2048, height: 1365 } }],
                fragments: [],
                movements: [{ movementId: 'SYS.01', title: 'THRESHOLD', modality: 'bw', spreads: [] }],
            };
            const resolvers = {};
            const session = createPreviewSession(baseLedger, profile, {
                renderFn: ({ revision }) => new Promise((resolve) => {
                    resolvers[revision] = () => resolve({ pdfSha256: 'hash-rev-' + revision });
                }),
            });
            const pA = session.triggerAuthoritativeRender();
            session.updateCandidate((l) => ({ ...l, subtitle: 'Edit B' }));
            const pB = session.triggerAuthoritativeRender();
            session.updateCandidate((l) => ({ ...l, subtitle: 'Edit C' }));
            const pC = session.triggerAuthoritativeRender();
            resolvers[3]();
            await pC;
            resolvers[2]();
            await pB;
            resolvers[1]();
            await pA;
            const finalState = session.getState();
            const staleExportOk = session.canExport({ passed: true, pdfSha256: 'hash-rev-2' });
            const validExportOk = session.canExport({ passed: true, pdfSha256: 'hash-rev-3' });
            return { finalState, staleExportOk, validExportOk };
        `);

        expect(res.finalState.candidateRevision).toBe(3);
        expect(res.finalState.latestRendered.revision).toBe(3);
        expect(res.finalState.latestRendered.pdfSha256).toBe('hash-rev-3');
        expect(res.finalState.badge).toBe('PDF preview revision 3');
        expect(res.staleExportOk).toBe(false);
        expect(res.validExportOk).toBe(true);
    });
});
