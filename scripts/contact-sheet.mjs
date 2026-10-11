#!/usr/bin/env node

/**
 * Contact-sheet ledger generator (phase A).
 *
 * Harvests one outing into a capture-ordered digital contact sheet:
 * per-frame EXIF, metrics (via the sequence skill's colorimetry), and a
 * selection trace inferred from Lightroom develop-settings XMP. Writes local
 * working material under gitignored contact-sheets/<slug>/ and a public,
 * privacy-filtered digest under contact-sheet-ledger/<slug>.json.
 *
 * Design: docs/contact-sheet-ledger-design.md
 *
 * Usage: node scripts/contact-sheet.mjs <dir> --slug <YYYY-MM-DD-slug>
 */

import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';
import sharp from 'sharp';
import { rgbToLab, deltaE } from '../.agents/skills/sequence/scripts/metrics.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const RAW_EXTENSIONS = new Set([
    '.raf',
    '.cr2',
    '.cr3',
    '.nef',
    '.arw',
    '.dng',
    '.orf',
    '.rw2',
    '.pef',
    '.raw',
]);
const JPEG_EXTENSIONS = new Set(['.jpg', '.jpeg']);
const EXIF_BATCH_ARGS = [
    '-json',
    '-G1',
    '-FocalLength',
    '-FNumber',
    '-ExposureTime',
    '-ISO',
    '-LensModel',
    '-DateTimeOriginal',
    '-XMP-crs:all',
];

const SLUG_RE = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

function runExiftool(args, { env, encoding, maxBuffer = 128 * 1024 * 1024 } = {}) {
    return execFileSync('exiftool', args, {
        env: { ...process.env, ...(env || {}) },
        encoding,
        maxBuffer,
    });
}

function ensureExiftool(env) {
    try {
        runExiftool(['-ver'], { env, encoding: 'utf8' });
    } catch {
        throw new Error(
            'contact-sheet: exiftool is required but was not found on PATH (install: brew install exiftool)'
        );
    }
}

/** Lists RAW + JPEG frames in a directory, sorted by file name. */
export function listFrames(dir) {
    return fs
        .readdirSync(dir, { withFileTypes: true })
        .filter((e) => e.isFile())
        .map((e) => {
            const ext = path.extname(e.name).toLowerCase();
            return { file: e.name, ext, isRaw: RAW_EXTENSIONS.has(ext) };
        })
        .filter((f) => f.isRaw || JPEG_EXTENSIONS.has(f.ext))
        .sort((a, b) => a.file.localeCompare(b.file, undefined, { numeric: true }));
}

/** Converts an exiftool DateTimeOriginal ("YYYY:MM:DD HH:MM:SS[.ss]") to ISO-ish local time. */
export function exiftoolDateToIso(value) {
    const m = /^(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/.exec(String(value || ''));
    return m ? `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}` : null;
}

/** True when a develop-settings trace exists: crs namespace in a sidecar, or XMP-crs group keys from exiftool. */
export function hasDevelopTrace(sidecarText, exifEntry) {
    if (sidecarText && /crs:[A-Za-z]/.test(sidecarText)) return true;
    if (exifEntry && Object.keys(exifEntry).some((k) => k.startsWith('XMP-crs:'))) return true;
    return false;
}

/** Deterministic thumb file name for a frame, relative to the sheet directory. */
export function thumbName(file) {
    return `thumbs/${file}.jpg`;
}

function readSidecar(absPath) {
    try {
        return fs.readFileSync(`${absPath}.xmp`, 'utf8');
    } catch {
        return null;
    }
}

function extractPreview(frame, env) {
    if (!frame.isRaw) return fs.readFileSync(frame.absPath);
    for (const tag of ['-PreviewImage', '-JpgFromRaw']) {
        try {
            const buf = runExiftool(['-b', tag, frame.absPath], { env });
            if (buf && buf.length > 0) return buf;
        } catch {
            // fall through to the next preview tag
        }
    }
    return null;
}

async function meanRgb(buffer) {
    const { data, info } = await sharp(buffer)
        .rotate()
        .resize(48, 48, { fit: 'inside' })
        .raw()
        .toBuffer({ resolveWithObject: true });
    const stride = info.width * info.channels;
    let r = 0;
    let g = 0;
    let b = 0;
    for (let y = 0; y < info.height; y++) {
        for (let x = 0; x < info.width; x++) {
            const i = y * stride + x * info.channels;
            r += data[i];
            g += data[i + 1];
            b += data[i + 2];
        }
    }
    const n = info.width * info.height;
    return [r / n, g / n, b / n];
}

function round3(n) {
    return n === null || n === undefined ? null : Math.round(n * 1000) / 1000;
}

function normalizeBatchJson(raw) {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [parsed];
}

/**
 * Builds the sheet object for one outing directory.
 * Returns { sheet, thumbs } where thumbs is [{ file, buffer|null }] aligned
 * with sheet.frames.
 */
export async function buildSheet(dir, { slug, env, now } = {}) {
    if (!SLUG_RE.test(String(slug || ''))) {
        throw new Error(
            `contact-sheet: invalid slug "${slug}" (use YYYY-MM-DD-slug, path separators rejected)`
        );
    }
    const absDir = path.resolve(dir);
    if (!fs.existsSync(absDir) || !fs.statSync(absDir).isDirectory()) {
        throw new Error(`contact-sheet: not a directory: ${dir}`);
    }
    const frames = listFrames(absDir).map((f) => ({ ...f, absPath: path.join(absDir, f.file) }));
    if (frames.length === 0) {
        throw new Error(`contact-sheet: no RAW/JPEG frames found in ${dir}`);
    }
    ensureExiftool(env);

    const batch = normalizeBatchJson(
        runExiftool([...EXIF_BATCH_ARGS, ...frames.map((f) => f.absPath)], {
            env,
            encoding: 'utf8',
        })
    );
    const exifByPath = new Map(batch.map((e) => [path.resolve(e.SourceFile), e]));

    const intermediates = [];
    for (const frame of frames) {
        const entry = exifByPath.get(path.resolve(frame.absPath)) || {};
        const sidecar = readSidecar(frame.absPath);
        const selected = hasDevelopTrace(sidecar, entry);

        let thumbBuffer = null;
        let lab = null;
        const pixels = extractPreview(frame, env);
        if (pixels) {
            try {
                thumbBuffer = await sharp(pixels)
                    .rotate()
                    .resize({ width: 480 })
                    .jpeg({ quality: 72 })
                    .toBuffer();
                const [r, g, b] = await meanRgb(pixels);
                const c = rgbToLab(r, g, b);
                lab = { L: round3(c.L), a: round3(c.a), b: round3(c.b) };
            } catch {
                thumbBuffer = null;
                lab = null;
            }
        }

        intermediates.push({
            file: frame.file,
            captureTime: exiftoolDateToIso(entry['EXIF:DateTimeOriginal']),
            exif: {
                focalLength: entry['EXIF:FocalLength'] ?? null,
                aperture: entry['EXIF:FNumber'] ?? null,
                shutter: entry['EXIF:ExposureTime'] ?? null,
                iso: entry['EXIF:ISO'] ?? null,
                lens: entry['EXIF:LensModel'] ?? null,
            },
            selected,
            lab,
            thumbBuffer,
        });
    }

    intermediates.sort((a, b) => {
        const ta = a.captureTime || '~';
        const tb = b.captureTime || '~';
        return ta === tb
            ? a.file.localeCompare(b.file, undefined, { numeric: true })
            : ta < tb
              ? -1
              : 1;
    });

    let prevLab = null;
    const sheetFrames = intermediates.map((f) => {
        const deltaEPrev = f.lab && prevLab ? round3(deltaE(prevLab, f.lab)) : null;
        if (f.lab) prevLab = f.lab;
        return {
            file: f.file,
            captureTime: f.captureTime,
            exif: f.exif,
            selection: {
                decision: f.selected ? 'select' : 'pass',
                signal: f.selected ? 'xmp-develop' : null,
            },
            rationale: null,
            metrics: {
                luminance: f.lab ? f.lab.L : null,
                cielab: f.lab,
                deltaEPrev,
            },
            gaze: null,
            privateNote: null,
        };
    });

    const sheet = {
        schemaVersion: 1,
        slug,
        generatedAt: (now || new Date()).toISOString(),
        source: { dirBasename: path.basename(absDir), frameCount: sheetFrames.length },
        frames: sheetFrames,
    };
    return {
        sheet,
        thumbs: sheetFrames.map((f, i) => ({ file: f.file, buffer: intermediates[i].thumbBuffer })),
    };
}

function esc(s) {
    const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
    return String(s).replace(/[&<>"']/g, (c) => map[c]);
}

/** Renders a sheet object to a self-contained static HTML contact sheet. */
export function renderSheetHtml(sheet) {
    const cells = sheet.frames
        .map((f) => {
            const badge = f.selection.decision === 'select' ? 'SELECT' : 'PASS';
            const cls = f.selection.decision === 'select' ? 'select' : 'pass';
            const signal = f.selection.signal
                ? ` <small>via ${esc(f.selection.signal)}</small>`
                : '';
            const visual =
                f.metrics.cielab !== null
                    ? `<img src="${esc(thumbName(f.file))}" alt="${esc(f.file)}" loading="lazy">`
                    : '<div class="no-thumb">no preview</div>';
            const stats =
                f.metrics.cielab !== null
                    ? `L* ${f.metrics.luminance} · ΔE₇₆ ${f.metrics.deltaEPrev ?? '—'}`
                    : 'no metrics';
            const rationale = f.rationale ? `<p class="rationale">${esc(f.rationale)}</p>` : '';
            return (
                `<figure class="${cls}">${visual}<figcaption>` +
                `<strong>${esc(f.file)}</strong><span class="badge">${badge}${signal}</span>` +
                `<span class="stats">${stats}</span>${rationale}</figcaption></figure>`
            );
        })
        .join('\n');
    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Contact sheet — ${esc(sheet.slug)}</title>
<style>
body { background: #111; color: #ddd; font: 14px/1.4 system-ui, sans-serif; margin: 0; padding: 1.5rem; }
h1 { font-size: 1.2rem; margin: 0 0 .25rem; }
p.meta { color: #888; margin: 0 0 1.5rem; }
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 1rem; }
figure { margin: 0; background: #1b1b1b; border-radius: 6px; overflow: hidden; }
figure img { width: 100%; display: block; }
figure.select { outline: 2px solid #4caf50; }
.no-thumb { height: 120px; display: flex; align-items: center; justify-content: center; color: #666; }
figcaption { padding: .5rem .75rem; display: flex; flex-direction: column; gap: .2rem; }
.badge { color: #4caf50; font-weight: 600; font-size: .8rem; }
figure.pass .badge { color: #777; }
.badge small { color: #999; font-weight: 400; }
.stats { color: #999; font-size: .8rem; }
.rationale { margin: .25rem 0 0; font-style: italic; color: #bbb; }
</style>
</head>
<body>
<h1>${esc(sheet.slug)}</h1>
<p class="meta">${sheet.source.frameCount} frames · generated ${esc(sheet.generatedAt)}</p>
<main class="grid">
${cells}
</main>
</body>
</html>
`;
}

/** Writes local working material and the public digest. */
export function writeOutputs(sheet, thumbs, { repoRoot = REPO_ROOT } = {}) {
    const sheetDir = path.join(repoRoot, 'contact-sheets', sheet.slug);
    const thumbsDir = path.join(sheetDir, 'thumbs');
    fs.mkdirSync(thumbsDir, { recursive: true });
    for (const t of thumbs) {
        if (t.buffer) fs.writeFileSync(path.join(thumbsDir, `${t.file}.jpg`), t.buffer);
    }
    fs.writeFileSync(path.join(sheetDir, 'sheet.json'), `${JSON.stringify(sheet, null, 2)}\n`);

    const digest = {
        ...sheet,
        frames: sheet.frames.map(({ privateNote, ...rest }) => rest),
    };
    const ledgerDir = path.join(repoRoot, 'contact-sheet-ledger');
    fs.mkdirSync(ledgerDir, { recursive: true });
    fs.writeFileSync(
        path.join(ledgerDir, `${sheet.slug}.json`),
        `${JSON.stringify(digest, null, 2)}\n`
    );

    fs.writeFileSync(path.join(sheetDir, 'index.html'), renderSheetHtml(sheet));
}

// Direct CLI invocation
if (process.argv[1] === fileURLToPath(import.meta.url)) {
    const args = process.argv.slice(2);
    const slugIdx = args.indexOf('--slug') + 1;
    const slug = slugIdx > 0 ? args[slugIdx] : null;
    const dirArg = args.find((a) => !a.startsWith('--'));
    if (args.includes('--help') || args.includes('-h') || !dirArg || !slug) {
        console.error('Usage: node scripts/contact-sheet.mjs <dir> --slug <YYYY-MM-DD-slug>');
        process.exit(args.includes('--help') || args.includes('-h') ? 0 : 1);
    }
    buildSheet(dirArg, { slug })
        .then(({ sheet, thumbs }) => {
            writeOutputs(sheet, thumbs);
            console.log(
                `contact-sheet: ${sheet.source.frameCount} frames → contact-sheets/${sheet.slug}/ + contact-sheet-ledger/${sheet.slug}.json`
            );
        })
        .catch((err) => {
            console.error(err.message || err);
            process.exit(1);
        });
}
