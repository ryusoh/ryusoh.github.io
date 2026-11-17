/**
 * Generates spread raster proofs via Poppler pdftoppm and records review evidence.
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

export async function run() {
    process.stdout.write('Proof module ready.\n');
    return 0;
}
