'use strict';

const fs = require('fs');
const os = require('os');
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

describe('scripts/book/layout.mjs & render.mjs', () => {
    test('compiles layout IR with silent modality-switch buffers, exact PPI, and stamps TwoPageRight catalog', () => {
        const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'book-render-'));
        try {
            const res = runEsm(`
                const fs = (await import('fs')).default;
                const { compileLayoutIr } = await import('./scripts/book/layout.mjs');
                const { renderBookPdf } = await import('./scripts/book/render.mjs');
                const profile = JSON.parse(fs.readFileSync('./book/profiles/display.json', 'utf8'));
                const ledger = {
                    editionId: 'infinite-systems',
                    title: 'INFINITE SYSTEMS',
                    subtitle: 'Sub',
                    author: 'Zhuang Liu',
                    revision: 1,
                    includeCommentaryAppendix: true,
                    constraints: { pinnedOpenerAssetId: 'p1-a' },
                    assets: [
                        { assetId: 'p1-a', source: 'assets/img/p1/a.jpg', modality: 'bw', altText: 'A', metrics: { width: 2048, height: 1365 } },
                        { assetId: 'p2-b', source: 'assets/img/p2/b.jpg', modality: 'color', altText: 'B', metrics: { width: 2048, height: 1365 } },
                    ],
                    fragments: [],
                    movements: [
                        { movementId: 'SYS.01', title: 'THRESHOLD', modality: 'bw', spreads: [{ spreadId: 's01', layout: 'monolith', locked: true, verso: null, recto: { assetId: 'p1-a', scale: 'full-bleed' } }] },
                        { movementId: 'SYS.02', title: 'KINEMATICS', modality: 'color', spreads: [{ spreadId: 's02', layout: 'monolith', locked: false, verso: null, recto: { assetId: 'p2-b', scale: 'inset-74' } }] },
                    ],
                };
                const ir = compileLayoutIr(ledger, profile);
                const outPdfPath = ${JSON.stringify(path.join(tmpDir, 'out.pdf'))};
                const irJsonPath = ${JSON.stringify(path.join(tmpDir, 'ir.json'))};
                const rendered = renderBookPdf(ir, profile, {
                    rootDir: process.cwd(),
                    outPdfPath,
                    irJsonPath,
                    execRunner: () => {
                        fs.writeFileSync(outPdfPath, '%PDF-1.7\\n1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\\n');
                    },
                });
                const pdfText = fs.readFileSync(outPdfPath, 'latin1');
                return { ir, rendered, hasTwoPageRight: pdfText.includes('/PageLayout /TwoPageRight') };
            `);

            expect(res.ir.pages[0].side).toBe('recto');
            expect(res.ir.pages[0].pageType).toBe('cover');
            expect(res.ir.pages.some((p) => p.pageType === 'phase-reset-void')).toBe(true);
            const fullBleedPlate = res.ir.pages.find((p) => p.slot?.assetId === 'p1-a').slot;
            expect(fullBleedPlate.effectivePpi).toBe(173.355);
            expect(fullBleedPlate.showFolio).toBe(false);
            expect(res.hasTwoPageRight).toBe(true);
        } finally {
            fs.rmSync(tmpDir, { recursive: true, force: true });
        }
    });
});
