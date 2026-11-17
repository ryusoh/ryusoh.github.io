/**
 * Renders canonical layout IR via Typst and stamps /PageLayout /TwoPageRight + /PageMode /UseOutlines.
 */

import { execFileSync as defaultExecFileSync } from 'child_process';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

export function stampTwoPageRightCatalog(pdfBuffer) {
    const text = pdfBuffer.toString('latin1');
    if (text.includes('/PageLayout /TwoPageRight') && text.includes('/PageMode /UseOutlines')) {
        return pdfBuffer;
    }
    const updated = text.replace(
        /\/Type\s*\/Catalog\b/,
        '/Type /Catalog /PageLayout /TwoPageRight /PageMode /UseOutlines'
    );
    return Buffer.from(updated, 'latin1');
}

export function renderBookPdf(
    layoutIr,
    profile,
    {
        rootDir = process.cwd(),
        outPdfPath,
        irJsonPath,
        sourceDateEpoch = '1763337600',
        execRunner = defaultExecFileSync,
    } = {}
) {
    fs.mkdirSync(path.dirname(irJsonPath), { recursive: true });
    fs.mkdirSync(path.dirname(outPdfPath), { recursive: true });
    fs.writeFileSync(irJsonPath, `${JSON.stringify(layoutIr, null, 2)}\n`, 'utf8');

    const typstArgs = [
        'compile',
        '--root',
        rootDir,
        '--ignore-system-fonts',
        '--font-path',
        path.join(rootDir, 'assets', 'fonts', 'book'),
        '--creation-timestamp',
        String(sourceDateEpoch),
        '--pdf-standard',
        profile.pdfStandard || '1.7',
        '--input',
        `ir=${path.relative(rootDir, irJsonPath)}`,
        path.join(rootDir, 'book', 'photobook.typ'),
        outPdfPath,
    ];

    execRunner('typst', typstArgs, { cwd: rootDir, stdio: 'pipe' });

    const rawPdf = fs.readFileSync(outPdfPath);
    const stampedPdf = stampTwoPageRightCatalog(rawPdf);
    fs.writeFileSync(outPdfPath, stampedPdf);

    const pdfSha256 = crypto.createHash('sha256').update(stampedPdf).digest('hex');
    return {
        profileId: profile.profileId,
        outPdfPath,
        layoutHash: layoutIr.layoutHash,
        pdfSha256,
    };
}

export async function run() {
    process.stdout.write('Render module ready (requires approved book/sequence.yaml and typst).\n');
    return 0;
}
