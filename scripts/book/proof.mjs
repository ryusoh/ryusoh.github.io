/**
 * Generates spread raster proofs via Poppler pdftoppm and inspects font/image/catalog properties.
 */

import { execFileSync as defaultExecFileSync } from 'child_process';
import fs from 'fs';
import path from 'path';

export function rasterizePdfProofs(
    pdfPath,
    outDir,
    { dpi = 144, execRunner = defaultExecFileSync } = {}
) {
    fs.mkdirSync(outDir, { recursive: true });
    const prefix = path.join(outDir, 'page');
    execRunner('pdftoppm', ['-png', '-r', String(dpi), pdfPath, prefix], { stdio: 'pipe' });
    return { pdfPath, outDir, dpi };
}

export function inspectPdfArtifact(pdfPath, { execRunner = defaultExecFileSync } = {}) {
    const infoOut = execRunner('pdfinfo', [pdfPath], { encoding: 'utf8' });
    const fontsOut = execRunner('pdffonts', [pdfPath], { encoding: 'utf8' });
    const imagesOut = execRunner('pdfimages', ['-list', pdfPath], {
        encoding: 'utf8',
        maxBuffer: 16 * 1024 * 1024,
    });
    const catalogJson = JSON.parse(
        execRunner('qpdf', ['--json', '--json-key=qpdf', pdfPath], {
            encoding: 'utf8',
            maxBuffer: 64 * 1024 * 1024,
        })
    );
    const objects = catalogJson.qpdf[1];
    const rootCatalog = objects[`obj:${objects.trailer.value['/Root']}`]?.value || {};

    const fontLines = fontsOut.trim().split('\n').slice(2);
    const unembeddedFonts = fontLines.filter(
        (line) => line.trim() && !/\byes\s+(yes|no)\s+/.test(line)
    );
    const imageRows = imagesOut
        .trim()
        .split('\n')
        .slice(2)
        .filter((l) => l.trim());
    const minPpi = imageRows.reduce((min, line) => {
        const cols = line.trim().split(/\s+/);
        const xPpi = Number(cols[12]);
        const yPpi = Number(cols[13]);
        const ppi = Number.isFinite(xPpi) && Number.isFinite(yPpi) ? Math.min(xPpi, yPpi) : min;
        return Math.min(min, ppi);
    }, Infinity);
    const pagesMatch = infoOut.match(/^Pages:\s*(\d+)/m);
    const pages = pagesMatch ? Number(pagesMatch[1]) : 0;

    return {
        pages,
        hasTwoPageRight: rootCatalog['/PageLayout'] === '/TwoPageRight',
        hasUseOutlines: rootCatalog['/PageMode'] === '/UseOutlines',
        fontCount: fontLines.filter((l) => l.trim()).length,
        unembeddedFonts,
        imageCount: imageRows.length,
        minPpi: Number.isFinite(minPpi) ? minPpi : 0,
    };
}

export async function run(args = []) {
    const rootDir = process.cwd();
    const dpiIdx = args.indexOf('--dpi');
    const dpi = dpiIdx >= 0 && args[dpiIdx + 1] ? Number(args[dpiIdx + 1]) : 72;
    const targets = ['display', 'screen']
        .map((id) => ({ id, pdfPath: path.join(rootDir, 'dist', `infinite-systems-${id}.pdf`) }))
        .filter((t) => fs.existsSync(t.pdfPath));

    if (targets.length === 0) {
        process.stderr.write(
            'No built PDFs in dist/. Run `make book` or `node scripts/book.mjs render` first.\n'
        );
        return 1;
    }

    for (const target of targets) {
        const info = inspectPdfArtifact(target.pdfPath);
        const outDir = path.join(rootDir, '.cache', 'book-runs', 'proofs', target.id);
        fs.rmSync(outDir, { recursive: true, force: true });
        rasterizePdfProofs(target.pdfPath, outDir, { dpi });
        const pngCount = fs.readdirSync(outDir).filter((f) => f.endsWith('.png')).length;
        process.stdout.write(
            `Proofed ${target.id}: ${info.pages}p, ${info.imageCount} images (min ${info.minPpi} PPI), ${info.fontCount} fonts (${info.unembeddedFonts.length} unembedded), TwoPageRight=${info.hasTwoPageRight}, PNGs=${pngCount}\n`
        );
        if (info.unembeddedFonts.length > 0 || !info.hasTwoPageRight || !info.hasUseOutlines) {
            return 1;
        }
    }
    return 0;
}
