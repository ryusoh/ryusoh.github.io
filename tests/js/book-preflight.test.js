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

describe('scripts/book/preflight.mjs', () => {
    test('verifies WCAG AA contrast tokens, PDF catalog preferences, and two-build reproducibility', () => {
        const res = runEsm(`
            const fs = (await import('fs')).default;
            const { Buffer } = await import('buffer');
            const {
                checkContrastTokens,
                checkPdfCatalogStructure,
                verifyTwoBuildReproducibility,
            } = await import('./scripts/book/preflight.mjs');
            const display = JSON.parse(fs.readFileSync('./book/profiles/display.json', 'utf8'));
            const goodContrast = checkContrastTokens(display.tokens);
            const badContrast = checkContrastTokens({ ...display.tokens, textTelemetry: '#6E737B' });
            const pdfCheck = checkPdfCatalogStructure(
                Buffer.from('%PDF-1.7\\n<< /Type /Catalog /PageLayout /TwoPageRight /PageMode /UseOutlines >>')
            );
            const repro = await verifyTwoBuildReproducibility(async () => ({
                layoutHash: 'abc123',
                pdfSha256: 'def456',
            }));
            return { goodContrast, badContrast, pdfCheck, repro };
        `);

        expect(res.goodContrast.passed).toBe(true);
        expect(res.badContrast.passed).toBe(false);
        expect(res.pdfCheck.passed).toBe(true);
        expect(res.repro.passed).toBe(true);
    });
});
