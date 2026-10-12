/**
 * Tests for the contact-sheet ledger CLI (scripts/contact-sheet.mjs):
 * frame discovery, EXIF/XMP trace harvest, digest schema, local/public
 * privacy split, and the JSON→HTML renderer. Exiftool is shimmed via PATH
 * so the suite runs without the binary installed (CI parity).
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const { Buffer } = require('buffer');
const sharp = require('sharp');

const ROOT_DIR = path.resolve(__dirname, '../../');
const SCRIPT_PATH = path.join(ROOT_DIR, 'scripts', 'contact-sheet.mjs');

/** Runs code in a child ESM context with the module under test imported as `m`. */
function runModule(code) {
    const full = `import * as m from './scripts/contact-sheet.mjs';\n${code}`;
    return execFileSync('node', ['--input-type=module', '-e', full], {
        cwd: ROOT_DIR,
        encoding: 'utf8',
        // Pipe stderr so expected-failure tests (fail-closed exiftool check,
        // usage errors) don't leak alarming stacks into jest/commit output;
        // err.stderr remains available for assertions when the child throws.
        stdio: ['ignore', 'pipe', 'pipe'],
    });
}

/** Runs an expression in the child context and returns its awaited JSON value. */
function runJson(expr) {
    return JSON.parse(
        runModule(
            `(async () => { return ${expr}; })().then((v) => console.log(JSON.stringify(v)));`
        )
    );
}

describe('contact-sheet.mjs phase A', () => {
    let tmp;
    let srcDir;
    let outRoot;
    let shimEnv;
    let syncSrc;
    let syncExportDir;
    let syncGalleryRoot;

    beforeAll(async () => {
        tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'contact-sheet-'));
        srcDir = path.join(tmp, 'outing');
        outRoot = path.join(tmp, 'out');
        fs.mkdirSync(srcDir);

        const colors = [
            [255, 0, 0],
            [0, 255, 0],
            [0, 0, 255],
        ];
        const names = ['IMG_0001.JPG', 'IMG_0002.JPG', 'IMG_0003.JPG'];
        for (let i = 0; i < names.length; i++) {
            await sharp({
                create: {
                    width: 64,
                    height: 64,
                    channels: 3,
                    background: { r: colors[i][0], g: colors[i][1], b: colors[i][2] },
                },
            })
                .jpeg()
                .toFile(path.join(srcDir, names[i]));
        }
        fs.writeFileSync(path.join(srcDir, 'IMG_0004.RAF'), Buffer.from('FAKERAW-4'));
        fs.writeFileSync(
            path.join(srcDir, 'IMG_0004.RAF.xmp'),
            '<x:xmpmeta xmlns:crs="http://ns.adobe.com/camera-raw-settings/1.0/" crs:Contrast="0"/>'
        );
        fs.writeFileSync(path.join(srcDir, 'IMG_0005.RAF'), Buffer.from('FAKERAW-5'));
        fs.writeFileSync(
            path.join(srcDir, 'IMG_0005.RAF.xmp'),
            '<x:xmpmeta xmlns:x="adobe:ns:meta/"><xmp:Rating>0</xmp:Rating></xmpmeta>'
        );
        // macOS AppleDouble junk as found on FAT32 SD cards — must be ignored.
        fs.writeFileSync(path.join(srcDir, '._DSCF0009.RAF'), Buffer.from('JUNK'));

        // Second fixture: a fresh outing for the --sync full-ritual test.
        syncSrc = path.join(tmp, 'sync-outing');
        fs.mkdirSync(syncSrc);
        for (const [name, background] of [
            ['IMG_0010.JPG', { r: 200, g: 100, b: 50 }],
            ['IMG_0011.JPG', { r: 50, g: 100, b: 200 }],
        ]) {
            await sharp({ create: { width: 48, height: 48, channels: 3, background } })
                .jpeg()
                .toFile(path.join(syncSrc, name));
        }
        syncExportDir = path.join(tmp, 'sync-export');
        fs.mkdirSync(syncExportDir);
        fs.writeFileSync(path.join(syncExportDir, 'IMG_0010.jpg'), 'x');
        syncGalleryRoot = path.join(tmp, 'sync-galleries');
        fs.mkdirSync(path.join(syncGalleryRoot, 'p3'), { recursive: true });
        fs.writeFileSync(path.join(syncGalleryRoot, 'p3', 'IMG_0011.jpg'), 'x');

        const previewPath = path.join(tmp, 'preview.jpg');
        await sharp({
            create: { width: 32, height: 32, channels: 3, background: { r: 255, g: 255, b: 0 } },
        })
            .jpeg()
            .toFile(previewPath);

        const binDir = path.join(tmp, 'bin');
        fs.mkdirSync(binDir);
        const shim = [
            '#!/usr/bin/env node',
            "const fs = require('fs');",
            'const args = process.argv.slice(2);',
            "const files = args.filter((a) => !a.startsWith('-'));",
            "if (args.includes('-ver')) { console.log('13.00'); process.exit(0); }",
            "if (args.includes('-json')) {",
            '  const out = files.map((f) => {',
            "    const base = f.split('/').pop();",
            "    let n = parseInt((base.match(/(\\d+)/) || [0, '0'])[1], 10);",
            "    if (base.indexOf('UUIDNAME') === 0) n = 1;",
            '    const entry = {',
            '      SourceFile: f,',
            "      'ExifIFD:FocalLength': '18.0 mm',",
            "      'ExifIFD:FNumber': 5.6,",
            "      'ExifIFD:ExposureTime': '1/250',",
            "      'ExifIFD:ISO': 400,",
            "      'ExifIFD:LensModel': 'XF35mmF2 R WR',",
            "      'ExifIFD:DateTimeOriginal': (n >= 4 ? '2026:10:12' : '2026:10:11') + ' 21:03:' + String(40 + n).padStart(2, '0'),",
            '    };',
            "    if (base === 'IMG_0002.JPG') entry['XMP-crs:Contrast'] = 0;",
            '    return entry;',
            '  });',
            '  console.log(JSON.stringify(out));',
            '  process.exit(0);',
            '}',
            "if (args.includes('-PreviewImage')) {",
            '  fs.writeSync(1, fs.readFileSync(process.env.SHIM_PREVIEW));',
            '  process.exit(0);',
            '}',
            'process.exit(1);',
            '',
        ].join('\n');
        fs.writeFileSync(path.join(binDir, 'exiftool'), shim);
        fs.chmodSync(path.join(binDir, 'exiftool'), 0o755);

        shimEnv = {
            PATH: `${binDir}:${process.env.PATH}`,
            SHIM_PREVIEW: previewPath,
        };
    });

    afterAll(() => {
        fs.rmSync(tmp, { recursive: true, force: true });
    });

    test('module exposes the phase-A API', () => {
        const keys = runJson('Object.keys(m)');
        for (const k of [
            'buildSheet',
            'buildOutingSheets',
            'reconcileExports',
            'reconcileGalleries',
            'syncLedger',
            'annotateSheet',
            'renderLocalSheet',
            'computeStats',
            'loadDigests',
            'fillGaze',
            'writeOutputs',
            'renderSheetHtml',
            'listFrames',
            'hasDevelopTrace',
            'thumbName',
            'exiftoolDateToIso',
        ]) {
            expect(keys).toContain(k);
        }
    });

    test('hasDevelopTrace reads crs from sidecar text or group-prefixed EXIF keys', () => {
        const got = runJson(`[
            m.hasDevelopTrace('<x:xmpmeta xmlns:crs="http://ns.adobe.com/camera-raw-settings/1.0/" crs:Contrast="0"/>', null),
            m.hasDevelopTrace('<x:xmpmeta xmlns:x="adobe:ns:meta/"><xmp:Rating>0</xmp:Rating></xmpmeta>', null),
            m.hasDevelopTrace(null, { 'EXIF:ISO': 100, 'XMP-crs:Contrast': 0 }),
            m.hasDevelopTrace(null, { 'EXIF:ISO': 100 }),
        ]`);
        expect(got).toEqual([true, false, true, false]);
    });

    test('exiftoolDateToIso converts DateTimeOriginal, null otherwise', () => {
        const got = runJson(`[
            m.exiftoolDateToIso('2026:10:11 21:03:44'),
            m.exiftoolDateToIso('2026:10:11 21:03:44.55'),
            m.exiftoolDateToIso('garbage'),
            m.exiftoolDateToIso(undefined),
        ]`);
        expect(got).toEqual(['2026-10-11T21:03:44', '2026-10-11T21:03:44', null, null]);
    });

    test('renderSheetHtml escapes file names and rationales, renders badges', () => {
        const html = runJson(`m.renderSheetHtml({
            schemaVersion: 1,
            slug: 'x',
            generatedAt: 't',
            source: { dirBasename: 'd', frameCount: 2 },
            frames: [
                {
                    file: '<img src=x>.JPG',
                    captureTime: null,
                    exif: { focalLength: null, aperture: null, shutter: null, iso: null, lens: null },
                    selection: { decision: 'select', signal: 'manual' },
                    rationale: '<script>alert(1)</script>',
                    metrics: { luminance: null, cielab: null, deltaEPrev: null },
                    gaze: null,
                },
                {
                    file: 'b.JPG',
                    captureTime: null,
                    exif: { focalLength: null, aperture: null, shutter: null, iso: null, lens: null },
                    selection: { decision: 'pass', signal: null },
                    rationale: null,
                    metrics: { luminance: null, cielab: null, deltaEPrev: null },
                    gaze: null,
                },
            ],
        })`);
        expect(html).toContain('&lt;img src=x&gt;.JPG');
        expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
        expect(html).not.toContain('<script>alert');
        expect(html).toContain('SELECT');
        expect(html).toContain('PASS');
    });

    test('E2E: buildSheet + writeOutputs produce local sheet, public digest, thumbs, HTML', async () => {
        const sheetJson = runModule(`(async () => {
            const { sheet, thumbs } = await m.buildSheet(${JSON.stringify(srcDir)}, {
                slug: '2026-10-11-test',
                env: ${JSON.stringify(shimEnv)},
            });
            m.writeOutputs(sheet, thumbs, { repoRoot: ${JSON.stringify(outRoot)} });
            console.log(JSON.stringify(sheet));
        })();`);
        const sheet = JSON.parse(sheetJson);

        expect(sheet.schemaVersion).toBe(1);
        expect(sheet.slug).toBe('2026-10-11-test');
        expect(sheet.source.dirBasename).toBe('outing');
        expect(sheet.source.frameCount).toBe(5);
        expect(sheet.frames.map((f) => f.file)).toEqual([
            'IMG_0001.JPG',
            'IMG_0002.JPG',
            'IMG_0003.JPG',
            'IMG_0004.RAF',
            'IMG_0005.RAF',
        ]);
        expect(sheet.frames[0].captureTime).toBe('2026-10-11T21:03:41');
        expect(sheet.frames[0].exif).toEqual({
            focalLength: 18,
            aperture: 5.6,
            shutter: '1/250',
            iso: 400,
            lens: 'XF35mmF2 R WR',
        });

        // Selection inference: shim XMP-crs key (JPEG), crs sidecar (RAW),
        // plain non-crs sidecar must stay pass.
        expect(sheet.frames[1].selection).toEqual({
            decision: 'select',
            signal: 'xmp-develop',
            exported: false,
            published: null,
        });
        expect(sheet.frames[3].selection).toEqual({
            decision: 'select',
            signal: 'xmp-develop',
            exported: false,
            published: null,
        });
        expect(sheet.frames[4].selection).toEqual({
            decision: 'pass',
            signal: null,
            exported: false,
            published: null,
        });
        expect(sheet.frames[0].selection).toEqual({
            decision: 'pass',
            signal: null,
            exported: false,
            published: null,
        });

        // Metrics over extracted previews: red is dark in L*, green is bright,
        // and the second frame carries a ΔE to its predecessor.
        expect(sheet.frames[0].metrics.luminance).toBeGreaterThan(45);
        expect(sheet.frames[0].metrics.luminance).toBeLessThan(60);
        expect(sheet.frames[1].metrics.luminance).toBeGreaterThan(80);
        expect(sheet.frames[0].metrics.deltaEPrev).toBeNull();
        expect(sheet.frames[1].metrics.deltaEPrev).toBeGreaterThan(30);
        expect(sheet.frames[3].gaze).toBeNull();
        expect(sheet.frames[0].rationale).toBeNull();

        // Local material under contact-sheets/, public digest under contact-sheet-ledger/.
        const localSheet = JSON.parse(
            fs.readFileSync(
                path.join(outRoot, 'contact-sheets', '2026-10-11-test', 'sheet.json'),
                'utf8'
            )
        );
        expect(localSheet.frames[0]).toHaveProperty('privateNote', null);

        const digestPath = path.join(outRoot, 'contact-sheet-ledger', '2026-10-11-test.json');
        const digestRaw = fs.readFileSync(digestPath, 'utf8');
        expect(digestRaw).not.toContain('privateNote');
        const digest = JSON.parse(digestRaw);
        expect(digest.frames).toHaveLength(5);
        expect(digest.frames[0]).not.toHaveProperty('privateNote');

        const thumbsDir = path.join(outRoot, 'contact-sheets', '2026-10-11-test', 'thumbs');
        expect(fs.readdirSync(thumbsDir).sort()).toEqual([
            'IMG_0001.JPG.jpg',
            'IMG_0002.JPG.jpg',
            'IMG_0003.JPG.jpg',
            'IMG_0004.RAF.jpg',
            'IMG_0005.RAF.jpg',
        ]);

        const html = fs.readFileSync(
            path.join(outRoot, 'contact-sheets', '2026-10-11-test', 'index.html'),
            'utf8'
        );
        expect(html).toContain('IMG_0004.RAF');
        expect(html).toContain('SELECT');
        expect(html).toContain('PASS');
    });

    test('buildSheet fails closed when exiftool is missing from PATH', () => {
        let err;
        try {
            runModule(`(async () => {
                await m.buildSheet(${JSON.stringify(srcDir)}, {
                    slug: '2026-10-11-test',
                    env: { PATH: ${JSON.stringify(path.join(tmp, 'empty-bin'))} },
                });
            })();`);
        } catch (e) {
            err = e;
        }
        expect(err).toBeDefined();
        expect(String(err.stderr || err.message)).toContain('exiftool');
    });

    test('buildSheet rejects path-traversal slugs', () => {
        const msg = runJson(`(async () => {
            try {
                await m.buildSheet(${JSON.stringify(srcDir)}, { slug: '../evil' });
                return 'no-throw';
            } catch (e) {
                return e.message;
            }
        })()`);
        expect(msg).toContain('slug');
    });

    test('buildOutingSheets splits a folder into per-day outings', () => {
        const out = runModule(`(async () => {
            const sheets = await m.buildOutingSheets(${JSON.stringify(srcDir)}, { env: ${JSON.stringify(shimEnv)} });
            for (const { sheet, thumbs } of sheets) {
                m.writeOutputs(sheet, thumbs, { repoRoot: ${JSON.stringify(outRoot)} });
            }
            console.log(JSON.stringify(sheets.map(({ sheet }) => ({
                slug: sheet.slug,
                n: sheet.source.frameCount,
                files: sheet.frames.map((f) => f.file),
            }))));
        })();`);
        const summaries = JSON.parse(out);
        expect(summaries.map((s) => s.slug)).toEqual(['2026-10-11', '2026-10-12']);
        expect(summaries[0].n).toBe(3);
        expect(summaries[1].n).toBe(2);
        expect(summaries[1].files).toEqual(['IMG_0004.RAF', 'IMG_0005.RAF']);
        expect(fs.existsSync(path.join(outRoot, 'contact-sheet-ledger', '2026-10-11.json'))).toBe(
            true
        );
        expect(fs.existsSync(path.join(outRoot, 'contact-sheet-ledger', '2026-10-12.json'))).toBe(
            true
        );
    });

    test('reconcileExports marks exported frames across digests and local sheets', () => {
        const exportDir = path.join(tmp, 'Export');
        fs.mkdirSync(path.join(exportDir, 'sub'), { recursive: true });
        fs.writeFileSync(path.join(exportDir, 'IMG_0002.jpg'), 'x');
        fs.writeFileSync(path.join(exportDir, 'sub', 'IMG_0004-2.jpg'), 'x');
        fs.writeFileSync(path.join(exportDir, 'IMG_0005.jpg'), 'x');
        fs.writeFileSync(path.join(exportDir, 'MISC0007.jpg'), 'x');
        const out = runJson(`(async () => {
            return await m.reconcileExports(${JSON.stringify(exportDir)}, {
                env: ${JSON.stringify(shimEnv)},
                repoRoot: ${JSON.stringify(outRoot)},
            });
        })()`);
        expect(out).toEqual({
            exportsScanned: 4,
            digestsScanned: 3,
            digestsUpdated: 3,
            framesMarked: 6,
        });

        const d12 = JSON.parse(
            fs.readFileSync(path.join(outRoot, 'contact-sheet-ledger', '2026-10-12.json'), 'utf8')
        );
        // pass → select upgrade via the export signal
        expect(d12.frames.find((f) => f.file === 'IMG_0005.RAF').selection).toEqual({
            decision: 'select',
            signal: 'exported',
            exported: true,
            published: null,
        });
        // already-select frames keep their original signal
        expect(d12.frames.find((f) => f.file === 'IMG_0004.RAF').selection).toEqual({
            decision: 'select',
            signal: 'xmp-develop',
            exported: true,
            published: null,
        });
        // untouched frames stay pass
        expect(d12.frames.find((f) => f.file === 'IMG_0001.JPG')).toBeUndefined();

        // local sheet updated and HTML re-rendered
        const local = JSON.parse(
            fs.readFileSync(
                path.join(outRoot, 'contact-sheets', '2026-10-12', 'sheet.json'),
                'utf8'
            )
        );
        expect(local.frames.find((f) => f.file === 'IMG_0005.RAF').selection.decision).toBe(
            'select'
        );
        const html = fs.readFileSync(
            path.join(outRoot, 'contact-sheets', '2026-10-12', 'index.html'),
            'utf8'
        );
        expect(html).toContain('SELECT');
    });

    test('reconcileGalleries marks published frames by capture time, recording the gallery id', () => {
        const galleryRoot = path.join(tmp, 'galleries');
        fs.mkdirSync(path.join(galleryRoot, 'p1'), { recursive: true });
        fs.mkdirSync(path.join(galleryRoot, 'p2'), { recursive: true });
        // DSCF-style name matches frame IMG_0003 (n=3 → 2026-10-11T21:03:43);
        // UUID-style name (shim override n=1) matches IMG_0001 — capture-time
        // matching must survive renames.
        fs.writeFileSync(path.join(galleryRoot, 'p1', 'IMG_0003.jpg'), 'x');
        fs.writeFileSync(path.join(galleryRoot, 'p2', 'UUIDNAME-9F88.jpg'), 'x');
        const out = runJson(`(async () => {
            return await m.reconcileGalleries(${JSON.stringify(galleryRoot)}, {
                env: ${JSON.stringify(shimEnv)},
                repoRoot: ${JSON.stringify(outRoot)},
            });
        })()`);
        expect(out).toEqual({
            galleriesScanned: 2,
            digestsScanned: 3,
            digestsUpdated: 2,
            framesMarked: 4,
        });

        const d11 = JSON.parse(
            fs.readFileSync(path.join(outRoot, 'contact-sheet-ledger', '2026-10-11.json'), 'utf8')
        );
        // pass → select upgrade, published implies exported
        expect(d11.frames.find((f) => f.file === 'IMG_0001.JPG').selection).toEqual({
            decision: 'select',
            signal: 'published',
            exported: true,
            published: 'p2',
        });
        expect(d11.frames.find((f) => f.file === 'IMG_0003.JPG').selection).toEqual({
            decision: 'select',
            signal: 'published',
            exported: true,
            published: 'p1',
        });
        // export-selected frame untouched (no gallery match), published stays null
        expect(d11.frames.find((f) => f.file === 'IMG_0002.JPG').selection.published).toBeNull();

        // untouched day digest unchanged
        const d12 = JSON.parse(
            fs.readFileSync(path.join(outRoot, 'contact-sheet-ledger', '2026-10-12.json'), 'utf8')
        );
        expect(d12.frames.every((f) => f.selection.published === null)).toBe(true);

        // local sheet re-rendered with the published upgrade
        const local = JSON.parse(
            fs.readFileSync(
                path.join(outRoot, 'contact-sheets', '2026-10-11', 'sheet.json'),
                'utf8'
            )
        );
        expect(local.frames.find((f) => f.file === 'IMG_0001.JPG').selection.published).toBe('p2');
    });

    test('syncLedger runs the full ritual: split, write, reconcile exports + galleries', () => {
        const out = runJson(`(async () => {
            const r = await m.syncLedger(${JSON.stringify(syncSrc)}, {
                env: ${JSON.stringify(shimEnv)},
                repoRoot: ${JSON.stringify(outRoot)},
                exportDir: ${JSON.stringify(syncExportDir)},
                galleryRoot: ${JSON.stringify(syncGalleryRoot)},
            });
            return {
                outings: r.sheets.map(({ sheet }) => ({ slug: sheet.slug, n: sheet.source.frameCount })),
                exportMarks: r.exports.framesMarked,
                galleryMarks: r.galleries.framesMarked,
            };
        })()`);
        expect(out.outings).toEqual([{ slug: '2026-10-12', n: 2 }]);
        expect(out.exportMarks).toBe(1);
        expect(out.galleryMarks).toBe(1);
        const digest = JSON.parse(
            fs.readFileSync(path.join(outRoot, 'contact-sheet-ledger', '2026-10-12.json'), 'utf8')
        );
        expect(digest.frames.map((f) => f.file)).toEqual(['IMG_0010.JPG', 'IMG_0011.JPG']);
        expect(digest.frames[0].selection).toEqual({
            decision: 'select',
            signal: 'exported',
            exported: true,
            published: null,
        });
        expect(digest.frames[1].selection).toEqual({
            decision: 'select',
            signal: 'published',
            exported: true,
            published: 'p3',
        });
    });

    test('computeStats aggregates digests with optional year filter', () => {
        const got = runJson(`(() => {
            const digests = [
                { slug: '2026-01-01', frames: [
                    { selection: { decision: 'select', exported: true, published: 'p1' } },
                    { selection: { decision: 'pass', exported: false, published: null } },
                ] },
                { slug: '2025-12-31', frames: [
                    { selection: { decision: 'pass', exported: false, published: null } },
                ] },
            ];
            return { all: m.computeStats(digests), y2026: m.computeStats(digests, { year: 2026 }) };
        })()`);
        expect(got.all.totals).toEqual({
            outings: 2,
            frames: 3,
            selects: 1,
            exported: 1,
            published: 1,
        });
        expect(got.all.rows).toHaveLength(2);
        expect(got.y2026.rows.map((r) => r.slug)).toEqual(['2026-01-01']);
        expect(got.y2026.totals.frames).toBe(2);
    });

    test('annotateSheet sets a rationale on one frame and persists to local sheet, digest, HTML', () => {
        const out = runJson(
            `m.annotateSheet('2026-10-12', 'IMG_0010.JPG', 'near miss: horizon cuts the subject', { repoRoot: ${JSON.stringify(outRoot)} })`
        );
        expect(out).toEqual({ slug: '2026-10-12', file: 'IMG_0010.JPG' });
        const local = JSON.parse(
            fs.readFileSync(
                path.join(outRoot, 'contact-sheets', '2026-10-12', 'sheet.json'),
                'utf8'
            )
        );
        expect(local.frames.find((f) => f.file === 'IMG_0010.JPG').rationale).toBe(
            'near miss: horizon cuts the subject'
        );
        const digestRaw = fs.readFileSync(
            path.join(outRoot, 'contact-sheet-ledger', '2026-10-12.json'),
            'utf8'
        );
        expect(digestRaw).not.toContain('privateNote');
        const digest = JSON.parse(digestRaw);
        expect(digest.frames.find((f) => f.file === 'IMG_0010.JPG').rationale).toBe(
            'near miss: horizon cuts the subject'
        );
        const html = fs.readFileSync(
            path.join(outRoot, 'contact-sheets', '2026-10-12', 'index.html'),
            'utf8'
        );
        expect(html).toContain('near miss: horizon cuts the subject');
    });

    test('annotateSheet rejects unknown frames and path-traversal slugs', () => {
        const got = runJson(`[
            (() => { try { m.annotateSheet('2026-10-12', 'NOPE.JPG', 'x', { repoRoot: ${JSON.stringify(outRoot)} }); return 'no-throw'; } catch (e) { return e.message; } })(),
            (() => { try { m.annotateSheet('../evil', 'IMG_0010.JPG', 'x', { repoRoot: ${JSON.stringify(outRoot)} }); return 'no-throw'; } catch (e) { return e.message; } })(),
        ]`);
        expect(got[0]).toContain('no frame');
        expect(got[1]).toContain('invalid slug');
    });

    test('renderLocalSheet re-renders HTML from sheet.json', () => {
        const out = runJson(
            `m.renderLocalSheet('2026-10-12', { repoRoot: ${JSON.stringify(outRoot)} })`
        );
        expect(out).toEqual({ slug: '2026-10-12' });
        const html = fs.readFileSync(
            path.join(outRoot, 'contact-sheets', '2026-10-12', 'index.html'),
            'utf8'
        );
        expect(html).toContain('IMG_0010.JPG');
    });

    test('fillGaze fills the reserved gaze slot and persists to digest + HTML', () => {
        const out = runJson(`(async () => {
            const gazeRuntime = {
                sessions: {},
                estimate: async () => ({
                    modelVersion: 'fake-v0',
                    faces: [{ eyeContact: true }, { eyeContact: false }],
                }),
            };
            return await m.fillGaze('2026-10-12', { repoRoot: ${JSON.stringify(outRoot)}, gazeRuntime });
        })()`);
        expect(out).toEqual({ sheets: 1, framesScored: 2 });
        const digest = JSON.parse(
            fs.readFileSync(path.join(outRoot, 'contact-sheet-ledger', '2026-10-12.json'), 'utf8')
        );
        expect(digest.frames[0].gaze.faceCount).toBe(2);
        expect(digest.frames[0].gaze.eyeContactCount).toBe(1);
        expect(digest.frames[0].gaze.modelVersion).toBe('fake-v0');
        const html = fs.readFileSync(
            path.join(outRoot, 'contact-sheets', '2026-10-12', 'index.html'),
            'utf8'
        );
        expect(html).toContain('faces 2 · eye contact 1');
    });

    test('CLI rejects --slug together with --split', () => {
        let err;
        try {
            execFileSync('node', [SCRIPT_PATH, srcDir, '--slug', 'x', '--split'], {
                cwd: ROOT_DIR,
                encoding: 'utf8',
                stdio: ['ignore', 'pipe', 'pipe'],
            });
        } catch (e) {
            err = e;
        }
        expect(err).toBeDefined();
        expect(String(err.stderr)).toContain('Usage:');
    });

    test('CLI prints usage without arguments', () => {
        let err;
        try {
            execFileSync('node', [SCRIPT_PATH], {
                cwd: ROOT_DIR,
                encoding: 'utf8',
                stdio: ['ignore', 'pipe', 'pipe'],
            });
        } catch (e) {
            err = e;
        }
        expect(err).toBeDefined();
        expect(String(err.stderr)).toContain('Usage:');
    });
});
