/**
 * Renders canonical layout IR via Typst and stamps /PageLayout /TwoPageRight + /PageMode /UseOutlines via QPDF.
 */

import { execFileSync as defaultExecFileSync } from 'child_process';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { load as yamlLoad } from 'js-yaml';
import { ensureBookDerivative, ensureCoverDerivative, verifyBookFonts } from './assets.mjs';
import { collectPoolInventory } from './inventory.mjs';
import { compileLayoutIr } from './layout.mjs';

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

export function stampCatalogWithQpdf(pdfPath, execRunner = defaultExecFileSync) {
    const jsonRaw = execRunner('qpdf', ['--json', '--json-key=qpdf', pdfPath], {
        encoding: 'utf8',
        maxBuffer: 64 * 1024 * 1024,
    });
    const parsed = JSON.parse(jsonRaw);
    const header = parsed.qpdf[0];
    const objects = parsed.qpdf[1];
    const rootKey = `obj:${objects.trailer.value['/Root']}`;
    const patch = {
        qpdf: [
            header,
            {
                [rootKey]: {
                    value: {
                        ...objects[rootKey].value,
                        '/PageLayout': '/TwoPageRight',
                        '/PageMode': '/UseOutlines',
                    },
                },
            },
        ],
    };
    const patchPath = `${pdfPath}.catalog.json`;
    const stampedPath = `${pdfPath}.qpdf.pdf`;
    fs.writeFileSync(patchPath, JSON.stringify(patch), 'utf8');
    try {
        execRunner(
            'qpdf',
            [
                '--deterministic-id',
                '--object-streams=disable',
                `--update-from-json=${patchPath}`,
                pdfPath,
                stampedPath,
            ],
            { stdio: 'pipe' }
        );
        fs.renameSync(stampedPath, pdfPath);
    } finally {
        fs.rmSync(patchPath, { force: true });
        fs.rmSync(stampedPath, { force: true });
    }
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
        useQpdf = execRunner === defaultExecFileSync,
    } = {}
) {
    fs.mkdirSync(path.dirname(irJsonPath), { recursive: true });
    fs.mkdirSync(path.dirname(outPdfPath), { recursive: true });
    fs.writeFileSync(irJsonPath, `${JSON.stringify(layoutIr, null, 2)}\n`, 'utf8');

    const relIr = path.relative(rootDir, irJsonPath).split(path.sep).join('/');
    const typstIrInput = relIr.startsWith('..') ? irJsonPath : `/${relIr}`;
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
        `ir=${typstIrInput}`,
        path.join(rootDir, 'book', 'photobook.typ'),
        outPdfPath,
    ];

    execRunner('typst', typstArgs, { cwd: rootDir, stdio: 'pipe' });

    if (useQpdf) {
        stampCatalogWithQpdf(outPdfPath, execRunner);
    } else {
        const rawPdf = fs.readFileSync(outPdfPath);
        fs.writeFileSync(outPdfPath, stampTwoPageRightCatalog(rawPdf));
    }

    const finalPdf = fs.readFileSync(outPdfPath);
    const pdfSha256 = crypto.createHash('sha256').update(finalPdf).digest('hex');
    return {
        profileId: profile.profileId,
        outPdfPath,
        layoutHash: layoutIr.layoutHash,
        pdfSha256,
        bytes: finalPdf.length,
    };
}

export async function buildProfileArtifact(
    ledger,
    profile,
    {
        rootDir = process.cwd(),
        cacheDir = path.join(rootDir, '.cache', 'book-img'),
        runsDir = path.join(rootDir, '.cache', 'book-runs'),
        outDir = path.join(rootDir, 'dist'),
        assetMetrics = {},
        sourceDateEpoch = '1763337600',
    } = {}
) {
    const derivativeMap = {};
    for (const asset of ledger.assets || []) {
        derivativeMap[asset.assetId] = await ensureBookDerivative(asset, profile, {
            rootDir,
            cacheDir,
        });
    }
    const coverImage = await ensureCoverDerivative({
        rootDir,
        profileId: profile.profileId,
        cacheDir,
    });
    const layoutIr = compileLayoutIr(ledger, profile, {
        derivativeMap,
        assetMetrics,
        rootDir,
        coverImage,
    });
    const outPdfPath = path.join(outDir, profile.artifactName);
    const irJsonPath = path.join(runsDir, `layout-ir-${profile.profileId}.json`);
    const rendered = renderBookPdf(layoutIr, profile, {
        rootDir,
        outPdfPath,
        irJsonPath,
        sourceDateEpoch,
    });
    return { ...rendered, totalPages: layoutIr.totalPages, totalPlates: layoutIr.totalPlates };
}

function checkRequiredTools(rootDir) {
    const fonts = verifyBookFonts(path.join(rootDir, 'assets', 'fonts', 'book'));
    if (!fonts.valid) {
        return `Missing required book font(s): ${fonts.missing.join(', ')}`;
    }
    for (const bin of ['typst', 'qpdf']) {
        try {
            defaultExecFileSync(bin, ['--version'], { stdio: 'pipe' });
        } catch {
            return `Missing required binary "${bin}". Install via: brew install typst qpdf poppler`;
        }
    }
    return null;
}

export async function run(args = []) {
    const rootDir = process.cwd();
    const ledgerPath = path.join(rootDir, 'book', 'sequence.yaml');
    if (!fs.existsSync(ledgerPath)) {
        process.stderr.write(`Missing approved ledger: ${ledgerPath}\n`);
        return 1;
    }
    const toolErr = checkRequiredTools(rootDir);
    if (toolErr) {
        process.stderr.write(`${toolErr}\n`);
        return 1;
    }

    const profileFlagIdx = args.indexOf('--profile');
    const selected = profileFlagIdx >= 0 ? args[profileFlagIdx + 1] : null;
    const profileIds = selected ? [selected] : ['display', 'screen'];
    const ledger = yamlLoad(fs.readFileSync(ledgerPath, 'utf8'));
    const inventory = await collectPoolInventory({ rootDir });
    const assetMetrics = Object.fromEntries(inventory.assets.map((a) => [a.assetId, a.metrics]));

    const results = [];
    for (const pid of profileIds) {
        const profilePath = path.join(rootDir, 'book', 'profiles', `${pid}.json`);
        if (!fs.existsSync(profilePath)) {
            process.stderr.write(`Unknown profile: ${pid}\n`);
            return 1;
        }
        const profile = JSON.parse(fs.readFileSync(profilePath, 'utf8'));
        const res = await buildProfileArtifact(ledger, profile, { rootDir, assetMetrics });
        results.push(res);
        process.stdout.write(
            `Rendered ${res.profileId}: ${path.relative(rootDir, res.outPdfPath)} (${res.totalPages}p, ${res.totalPlates} plates, ${res.bytes} bytes, sha256=${res.pdfSha256.slice(0, 12)})\n`
        );
    }

    const manifestPath = path.join(rootDir, '.cache', 'book-runs', 'render-manifest.json');
    fs.writeFileSync(manifestPath, `${JSON.stringify({ results }, null, 2)}\n`, 'utf8');
    return 0;
}
