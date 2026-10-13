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
import os from 'os';
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

export function resolveExiftoolEnv(customEnv) {
    const env = { ...process.env, ...(customEnv || {}) };
    if (customEnv && customEnv.PATH !== undefined) {
        return env;
    }
    if (process.platform === 'darwin') {
        const standard = ['/opt/homebrew/bin', '/usr/local/bin'];
        const existing = (env.PATH || '').split(path.delimiter);
        const missing = standard.filter((p) => !existing.includes(p) && fs.existsSync(p));
        if (missing.length > 0) {
            env.PATH = `${env.PATH ? env.PATH + path.delimiter : ''}${missing.join(path.delimiter)}`;
        }
    }
    return env;
}

function runExiftool(args, { env, encoding, maxBuffer = 128 * 1024 * 1024 } = {}) {
    return execFileSync('exiftool', args, {
        env: resolveExiftoolEnv(env),
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
        .filter((e) => e.isFile() && !e.name.startsWith('.'))
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
 * Reads a tag from a -G1 exiftool entry regardless of which group reported it
 * (ExifIFD on RAF/JPEG, EXIF or XMP-exif elsewhere), preferring EXIF-family
 * groups over fallbacks like Composite.
 */
function tagValue(entry, tag) {
    if (!entry) return null;
    for (const group of ['ExifIFD', 'EXIF', 'XMP-exif']) {
        const key = `${group}:${tag}`;
        if (entry[key] !== undefined) return entry[key];
    }
    for (const key of Object.keys(entry)) {
        if (key === tag || key.endsWith(`:${tag}`)) return entry[key];
    }
    return null;
}

/** Parses numeric exiftool values, tolerating unit suffixes ("18.0 mm"). */
function parseNumber(v) {
    if (v === null || v === undefined) return null;
    if (typeof v === 'number') return v;
    const m = /^-?[\d.]+/.exec(String(v));
    return m ? Number(m[0]) : null;
}

function stringOrNull(v) {
    return v === null || v === undefined ? null : String(v);
}

/**
 * Reads a directory of frames: EXIF batch, selection traces, preview pixels,
 * thumbnails, and per-frame colorimetry. Returns unsorted intermediate records
 * plus the resolved directory.
 */
async function harvestFrameRecords(dir, env) {
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

    const records = [];
    let done = 0;
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

        records.push({
            file: frame.file,
            captureTime: exiftoolDateToIso(tagValue(entry, 'DateTimeOriginal')),
            exif: {
                focalLength: parseNumber(tagValue(entry, 'FocalLength')),
                aperture: parseNumber(tagValue(entry, 'FNumber')),
                shutter: stringOrNull(tagValue(entry, 'ExposureTime')),
                iso: parseNumber(tagValue(entry, 'ISO')),
                lens: stringOrNull(tagValue(entry, 'LensModel')),
            },
            selected,
            lab,
            thumbBuffer,
        });
        done++;
        if (done % 50 === 0) {
            console.error(`contact-sheet: ${done}/${frames.length} frames`);
        }
    }
    return { absDir, records };
}

function sortRecords(records) {
    records.sort((a, b) => {
        const ta = a.captureTime || '~';
        const tb = b.captureTime || '~';
        return ta === tb
            ? a.file.localeCompare(b.file, undefined, { numeric: true })
            : ta < tb
              ? -1
              : 1;
    });
}

/**
 * Assembles a sheet object from intermediate records.
 * Returns { sheet, thumbs } where thumbs is [{ file, buffer|null }] aligned
 * with sheet.frames.
 */
function assembleSheet(absDir, records, { slug, now } = {}) {
    if (!SLUG_RE.test(String(slug || ''))) {
        throw new Error(
            `contact-sheet: invalid slug "${slug}" (use YYYY-MM-DD-slug, path separators rejected)`
        );
    }
    sortRecords(records);

    let prevLab = null;
    const sheetFrames = records.map((f) => {
        const deltaEPrev = f.lab && prevLab ? round3(deltaE(prevLab, f.lab)) : null;
        if (f.lab) prevLab = f.lab;
        return {
            file: f.file,
            captureTime: f.captureTime,
            exif: f.exif,
            selection: {
                decision: f.selected ? 'select' : 'pass',
                signal: f.selected ? 'xmp-develop' : null,
                exported: false,
                published: null,
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
        thumbs: sheetFrames.map((f, i) => ({ file: f.file, buffer: records[i].thumbBuffer })),
    };
}

/** Builds the sheet object for one outing directory. */
export async function buildSheet(dir, { slug, env, now } = {}) {
    // Validate before any I/O: a bad slug must fail fast (and identically on
    // machines without exiftool, e.g. CI).
    if (!SLUG_RE.test(String(slug || ''))) {
        throw new Error(
            `contact-sheet: invalid slug "${slug}" (use YYYY-MM-DD-slug, path separators rejected)`
        );
    }
    const { absDir, records } = await harvestFrameRecords(dir, env);
    return assembleSheet(absDir, records, { slug, now });
}

/**
 * Splits a multi-outing directory into per-day sheets (one calendar day = one
 * outing, in camera-local time). Frames without capture time group under
 * "undated". Returns [{ sheet, thumbs }] sorted by day.
 */
export async function buildOutingSheets(dir, { env, now } = {}) {
    const { absDir, records } = await harvestFrameRecords(dir, env);
    const byDay = new Map();
    for (const r of records) {
        if (!r.captureTime) {
            console.error(
                `contact-sheet: warning: ${r.file} has no capture time; grouped under "undated"`
            );
        }
        const day = r.captureTime ? r.captureTime.slice(0, 10) : 'undated';
        if (!byDay.has(day)) byDay.set(day, []);
        byDay.get(day).push(r);
    }
    return [...byDay.keys()]
        .sort()
        .map((day) => assembleSheet(absDir, byDay.get(day), { slug: day, now }));
}

function esc(s) {
    const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
    return String(s).replace(/[&<>"']/g, (c) => map[c]);
}

const EXPORTED_JPEG_RE = /\.jpe?g$/i;

function walkExportedJpegs(dir) {
    const out = [];
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        if (e.name.startsWith('.')) continue;
        const p = path.join(dir, e.name);
        if (e.isDirectory()) out.push(...walkExportedJpegs(p));
        else if (e.isFile() && EXPORTED_JPEG_RE.test(e.name)) out.push(p);
    }
    return out;
}

function stripVariantSuffix(stem) {
    return stem.replace(/-\d+$/, '');
}

/** Match key shared by digests and exports: variant-stripped stem + capture time. */
function frameMatchKey(file, captureTime) {
    if (!captureTime) return null;
    const stem = stripVariantSuffix(path.basename(file, path.extname(file)));
    return `${stem}|${captureTime}`;
}

/**
 * Applies markFrame to every frame of every ledger digest (and the matching
 * local sheet, re-rendering its HTML). markFrame returns true when it changed
 * the frame. Returns rewrite statistics.
 */
function rewriteMarkedDigests(repoRoot, markFrame) {
    const ledgerDir = path.join(repoRoot, 'contact-sheet-ledger');
    const digestFiles = fs.existsSync(ledgerDir)
        ? fs.readdirSync(ledgerDir).filter((f) => f.endsWith('.json'))
        : [];
    let digestsUpdated = 0;
    let framesMarked = 0;
    for (const f of digestFiles) {
        const digestPath = path.join(ledgerDir, f);
        const digest = JSON.parse(fs.readFileSync(digestPath, 'utf8'));
        const marked = digest.frames.filter(markFrame).length;
        if (marked === 0) continue;
        framesMarked += marked;
        digestsUpdated++;
        fs.writeFileSync(digestPath, `${JSON.stringify(digest, null, 2)}\n`);

        const localSheetPath = path.join(repoRoot, 'contact-sheets', digest.slug, 'sheet.json');
        if (fs.existsSync(localSheetPath)) {
            const local = JSON.parse(fs.readFileSync(localSheetPath, 'utf8'));
            local.frames.forEach(markFrame);
            fs.writeFileSync(localSheetPath, `${JSON.stringify(local, null, 2)}\n`);
            fs.writeFileSync(
                path.join(repoRoot, 'contact-sheets', digest.slug, 'index.html'),
                renderSheetHtml(local)
            );
        }
    }
    return { digestsScanned: digestFiles.length, digestsUpdated, framesMarked };
}

/**
 * Marks frames whose exports are found in exportDir (Lightroom export folder,
 * walked recursively). Matching is stem + capture time, so DSCF counter resets
 * across cards cannot cross-match. Sets selection.exported and upgrades
 * pass → select with signal 'exported'. Rewrites both the public digest and
 * the local sheet (re-rendering HTML) when they exist.
 */
export async function reconcileExports(exportDir, { env, repoRoot = REPO_ROOT } = {}) {
    const absExportDir = path.resolve(exportDir);
    if (!fs.existsSync(absExportDir) || !fs.statSync(absExportDir).isDirectory()) {
        throw new Error(`contact-sheet: not a directory: ${exportDir}`);
    }
    const jpegs = walkExportedJpegs(absExportDir);
    if (jpegs.length === 0) {
        throw new Error(`contact-sheet: no exported JPEGs found in ${exportDir}`);
    }
    ensureExiftool(env);
    const batch = normalizeBatchJson(
        runExiftool(['-json', '-G1', '-DateTimeOriginal', ...jpegs], { env, encoding: 'utf8' })
    );
    const exported = new Set();
    for (const e of batch) {
        const key = frameMatchKey(
            e.SourceFile ? path.basename(e.SourceFile) : '',
            exiftoolDateToIso(tagValue(e, 'DateTimeOriginal'))
        );
        if (key) exported.add(key);
    }

    const stats = rewriteMarkedDigests(repoRoot, (frame) => {
        const key = frameMatchKey(frame.file, frame.captureTime);
        if (!key || !exported.has(key)) return false;
        const changed = !frame.selection.exported;
        frame.selection.exported = true;
        if (frame.selection.decision === 'pass') {
            frame.selection.decision = 'select';
            frame.selection.signal = 'exported';
        }
        return changed;
    });
    return { exportsScanned: jpegs.length, ...stats };
}

/**
 * Marks frames that appear in published galleries (galleryRoot walked
 * recursively; source JPEGs only — responsive tiers are avif/webp). Matching
 * is by capture time alone, which survives Lightroom's UUID renames; the
 * frame's selection.published records the gallery id (p1, p2, ...). Published
 * implies exported, and upgrades pass → select with signal 'published'.
 */
export async function reconcileGalleries(
    galleryRoot = path.join(REPO_ROOT, 'assets', 'img'),
    { env, repoRoot = REPO_ROOT } = {}
) {
    const absRoot = path.resolve(galleryRoot);
    if (!fs.existsSync(absRoot) || !fs.statSync(absRoot).isDirectory()) {
        throw new Error(`contact-sheet: not a directory: ${galleryRoot}`);
    }
    const jpegs = walkExportedJpegs(absRoot);
    if (jpegs.length === 0) {
        throw new Error(`contact-sheet: no gallery JPEGs found in ${galleryRoot}`);
    }
    ensureExiftool(env);
    const batch = normalizeBatchJson(
        runExiftool(['-json', '-G1', '-DateTimeOriginal', ...jpegs], { env, encoding: 'utf8' })
    );
    const publishedByTime = new Map();
    for (const e of batch) {
        const t = exiftoolDateToIso(tagValue(e, 'DateTimeOriginal'));
        if (!t || !e.SourceFile) continue;
        const firstSegment = path.relative(absRoot, e.SourceFile).split(path.sep)[0];
        if (!/^p\d+$/.test(firstSegment)) continue;
        if (publishedByTime.has(t)) {
            console.error(
                `contact-sheet: warning: gallery capture-time collision at ${t}; keeping ${publishedByTime.get(t)}`
            );
            continue;
        }
        publishedByTime.set(t, firstSegment);
    }

    const stats = rewriteMarkedDigests(repoRoot, (frame) => {
        const galleryId = frame.captureTime ? publishedByTime.get(frame.captureTime) : undefined;
        if (!galleryId) return false;
        const changed = frame.selection.published !== galleryId;
        frame.selection.published = galleryId;
        frame.selection.exported = true;
        if (frame.selection.decision === 'pass') {
            frame.selection.decision = 'select';
            frame.selection.signal = 'published';
        }
        return changed;
    });
    return { galleriesScanned: jpegs.length, ...stats };
}

function validateSlug(slug) {
    if (!SLUG_RE.test(String(slug || ''))) {
        throw new Error(`contact-sheet: invalid slug "${slug}"`);
    }
}

function localSheetPath(repoRoot, slug) {
    return path.join(repoRoot, 'contact-sheets', slug, 'sheet.json');
}

function loadLocalSheet(repoRoot, slug) {
    validateSlug(slug);
    const p = localSheetPath(repoRoot, slug);
    if (!fs.existsSync(p)) {
        throw new Error(`contact-sheet: no local sheet for slug "${slug}" (run --sync first)`);
    }
    return JSON.parse(fs.readFileSync(p, 'utf8'));
}

/** Rewrites the ledger digest from a local sheet (privateNote stripped) and re-renders its HTML. */
function persistLocalSheet(repoRoot, sheet) {
    fs.writeFileSync(localSheetPath(repoRoot, sheet.slug), `${JSON.stringify(sheet, null, 2)}\n`);
    const digest = { ...sheet, frames: sheet.frames.map(({ privateNote, ...rest }) => rest) };
    const ledgerDir = path.join(repoRoot, 'contact-sheet-ledger');
    fs.mkdirSync(ledgerDir, { recursive: true });
    fs.writeFileSync(
        path.join(ledgerDir, `${sheet.slug}.json`),
        `${JSON.stringify(digest, null, 2)}\n`
    );
    fs.writeFileSync(
        path.join(repoRoot, 'contact-sheets', sheet.slug, 'index.html'),
        renderSheetHtml(sheet)
    );
}

/** Sets the rationale (craft note) on one frame of a local sheet; null clears it. */
export function annotateSheet(slug, file, note, { repoRoot = REPO_ROOT } = {}) {
    const sheet = loadLocalSheet(repoRoot, slug);
    const frame = sheet.frames.find((f) => f.file === file);
    if (!frame) {
        throw new Error(`contact-sheet: no frame "${file}" in sheet "${slug}"`);
    }
    frame.rationale = note || null;
    persistLocalSheet(repoRoot, sheet);
    return { slug, file };
}

/** Self-reported day fields (phase 3): deliberate-practice condition variables EXIF cannot supply. */
const DAY_FIELD_KEYS = ['mood', 'hours', 'location'];

/** Merges self-reported day fields onto a local sheet; persists digest + HTML. */
export function annotateDay(slug, fields, { repoRoot = REPO_ROOT } = {}) {
    const sheet = loadLocalSheet(repoRoot, slug);
    const day = { ...(sheet.day || {}) };
    for (const key of DAY_FIELD_KEYS) {
        if (fields[key] === undefined || fields[key] === null) continue;
        if (key === 'hours') {
            const hours = Number(fields.hours);
            if (!Number.isFinite(hours) || hours < 0) {
                throw new Error('contact-sheet: --hours must be a non-negative number');
            }
            day.hours = hours;
        } else {
            day[key] = String(fields[key]);
        }
    }
    sheet.day = day;
    persistLocalSheet(repoRoot, sheet);
    return { slug, day };
}

/** Re-renders a local sheet's HTML from its sheet.json (after hand edits). */
export function renderLocalSheet(slug, { repoRoot = REPO_ROOT } = {}) {
    const sheet = loadLocalSheet(repoRoot, slug);
    fs.writeFileSync(
        path.join(repoRoot, 'contact-sheets', sheet.slug, 'index.html'),
        renderSheetHtml(sheet)
    );
    return { slug: sheet.slug };
}

/** Aggregates digests into per-day rows plus totals; optional year filter. */
export function computeStats(digests, { year } = {}) {
    const rows = [];
    const totals = { outings: 0, frames: 0, selects: 0, exported: 0, published: 0 };
    for (const d of digests) {
        if (year && !d.slug.startsWith(`${year}-`)) continue;
        const selects = d.frames.filter((f) => f.selection.decision === 'select').length;
        const exported = d.frames.filter((f) => f.selection.exported).length;
        const published = d.frames.filter((f) => f.selection.published).length;
        rows.push({ slug: d.slug, frames: d.frames.length, selects, exported, published });
        totals.outings++;
        totals.frames += d.frames.length;
        totals.selects += selects;
        totals.exported += exported;
        totals.published += published;
    }
    return { rows, totals };
}

/** Loads every digest in the ledger, sorted by slug. */
export function loadDigests({ repoRoot = REPO_ROOT } = {}) {
    const ledgerDir = path.join(repoRoot, 'contact-sheet-ledger');
    if (!fs.existsSync(ledgerDir)) return [];
    return fs
        .readdirSync(ledgerDir)
        .filter((f) => f.endsWith('.json'))
        .sort()
        .map((f) => JSON.parse(fs.readFileSync(path.join(ledgerDir, f), 'utf8')));
}

/**
 * Phase 3: working-the-scene depth. Consecutive frames with captureTime form
 * one scene; a gap larger than SCENE_GAP_MS starts a new scene. Frames without
 * captureTime are excluded from scene math.
 */
export const SCENE_GAP_MS = 120 * 1000;

export function sceneCount(frames) {
    const timed = frames
        .filter((f) => f.captureTime)
        .sort((a, b) => (a.captureTime < b.captureTime ? -1 : 1));
    let scenes = 0;
    let prev = null;
    for (const f of timed) {
        const t = Date.parse(f.captureTime);
        if (prev === null || t - prev > SCENE_GAP_MS) scenes++;
        prev = t;
    }
    return scenes;
}

/** Month bucket for a slug: YYYY-MM prefix, or "undated" for non-date slugs. */
function monthOf(slug) {
    return /^\d{4}-\d{2}/.test(slug) ? slug.slice(0, 7) : 'undated';
}

/**
 * Phase 3: cross-outing aggregation (WO 5). Per calendar month: funnel counts,
 * keep rate, frames-per-scene depth, focal-length and hour-of-day histograms.
 * Optional year filter matches slug prefix. Pure function over loaded digests.
 */
export function computeLongitudinal(digests, { year } = {}) {
    const months = new Map();
    for (const d of digests) {
        if (year && !d.slug.startsWith(`${year}-`)) continue;
        const key = monthOf(d.slug);
        if (!months.has(key)) {
            months.set(key, {
                month: key,
                outings: 0,
                frames: 0,
                timedFrames: 0,
                selects: 0,
                exported: 0,
                published: 0,
                scenes: 0,
                focal: new Map(),
                hours: new Map(),
            });
        }
        const agg = months.get(key);
        agg.outings++;
        const timed = d.frames.filter((f) => f.captureTime);
        agg.timedFrames += timed.length;
        agg.scenes += sceneCount(timed);
        for (const f of d.frames) {
            agg.frames++;
            if (f.selection.decision === 'select') agg.selects++;
            if (f.selection.exported) agg.exported++;
            if (f.selection.published) agg.published++;
            const fl = f.exif ? f.exif.focalLength : null;
            if (fl !== null && fl !== undefined) {
                agg.focal.set(fl, (agg.focal.get(fl) || 0) + 1);
            }
            const hour = f.captureTime ? f.captureTime.slice(11, 13) : null;
            if (hour) agg.hours.set(hour, (agg.hours.get(hour) || 0) + 1);
        }
    }
    const rows = [...months.keys()].sort().map((key) => {
        const agg = months.get(key);
        return {
            month: agg.month,
            outings: agg.outings,
            frames: agg.frames,
            selects: agg.selects,
            exported: agg.exported,
            published: agg.published,
            keepRate: agg.frames ? round3(agg.selects / agg.frames) : null,
            framesPerScene: agg.scenes ? round3(agg.timedFrames / agg.scenes) : null,
            scenes: agg.scenes,
            focal: [...agg.focal.entries()]
                .sort((a, b) => b[1] - a[1])
                .map(([focalLength, frames]) => ({ focalLength, frames })),
            hours: [...agg.hours.entries()].sort().map(([hour, frames]) => ({ hour, frames })),
        };
    });
    const totals = rows.reduce(
        (acc, r) => ({
            months: acc.months + 1,
            outings: acc.outings + r.outings,
            frames: acc.frames + r.frames,
            selects: acc.selects + r.selects,
            exported: acc.exported + r.exported,
            published: acc.published + r.published,
        }),
        { months: 0, outings: 0, frames: 0, selects: 0, exported: 0, published: 0 }
    );
    return { rows, totals };
}

/** Renders the longitudinal aggregate as a monthly markdown report. */
export function renderLongitudinalMd({ rows, totals }) {
    const pct = (n, d) => (d ? `${round3((n / d) * 100)}%` : '—');
    const lines = [
        '# Longitudinal shoot report',
        '',
        '| Month | Outings | Frames | Selects | Keep rate | Exported | Published | Frames/scene |',
        '| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |',
    ];
    for (const r of rows) {
        lines.push(
            `| ${r.month} | ${r.outings} | ${r.frames} | ${r.selects} | ${pct(r.selects, r.frames)} | ${r.exported} | ${r.published} | ${r.framesPerScene ?? '—'} |`
        );
    }
    lines.push(
        `| **total** | ${totals.outings} | ${totals.frames} | ${totals.selects} | ${pct(totals.selects, totals.frames)} | ${totals.exported} | ${totals.published} | — |`
    );
    for (const r of rows) {
        lines.push('', `## ${r.month}`, '');
        const focal = r.focal.map((f) => `${f.focalLength}mm ×${f.frames}`).join(', ');
        const hours = r.hours.map((h) => `${h.hour}:00 ×${h.frames}`).join(', ');
        lines.push(`- Focal lengths: ${focal || '—'}`);
        lines.push(`- Hours: ${hours || '—'}`);
        if (r.framesPerScene !== null) {
            lines.push(`- Scenes: ${r.scenes} (avg ${r.framesPerScene} frames/scene)`);
        }
    }
    return `${lines.join('\n')}\n`;
}

/**
 * WO 4 layer 1 (docs/critique-calibration-design.md D3): the montage critic is
 * agent-driven, not an API call — the session model is the VLM, consistent with
 * the /sequence council pattern. This tool's part is mechanical: tile a sheet's
 * thumbs into labeled grid pages under contact-sheets/<slug>/montage/ (private)
 * for the agent to review. Frames without thumbs are skipped and reported.
 */
const MONTAGE_CELL_W = 480;
const MONTAGE_CELL_H = 320;
const MONTAGE_LABEL_H = 24;
const MONTAGE_COLS = 3;
const MONTAGE_ROWS = 4;

function montageLabelSvg(text) {
    const svg =
        `<svg width="${MONTAGE_CELL_W}" height="${MONTAGE_LABEL_H}">` +
        '<rect width="100%" height="100%" fill="#000"/>' +
        `<text x="6" y="17" font-family="monospace" font-size="13" fill="#fff">${esc(text)}</text>` +
        '</svg>';
    return Buffer.from(svg);
}

export async function buildMontage(slug, { repoRoot = REPO_ROOT } = {}) {
    const sheet = loadLocalSheet(repoRoot, slug);
    const sheetDir = path.join(repoRoot, 'contact-sheets', slug);
    const cells = [];
    for (const frame of sheet.frames) {
        const thumbPath = path.join(sheetDir, thumbName(frame.file));
        if (fs.existsSync(thumbPath)) cells.push({ file: frame.file, thumbPath });
    }
    if (cells.length === 0) {
        throw new Error(`contact-sheet: no thumbs for slug "${slug}" (run --sync first)`);
    }
    const montageDir = path.join(sheetDir, 'montage');
    fs.rmSync(montageDir, { recursive: true, force: true });
    fs.mkdirSync(montageDir, { recursive: true });
    const perPage = MONTAGE_COLS * MONTAGE_ROWS;
    let pages = 0;
    for (let p = 0; p * perPage < cells.length; p++) {
        const pageCells = cells.slice(p * perPage, (p + 1) * perPage);
        const composites = [];
        for (let i = 0; i < pageCells.length; i++) {
            const x = (i % MONTAGE_COLS) * MONTAGE_CELL_W;
            const y = Math.floor(i / MONTAGE_COLS) * (MONTAGE_CELL_H + MONTAGE_LABEL_H);
            composites.push({
                input: await sharp(pageCells[i].thumbPath)
                    .resize(MONTAGE_CELL_W, MONTAGE_CELL_H, {
                        fit: 'contain',
                        background: '#111',
                    })
                    .toBuffer(),
                left: x,
                top: y,
            });
            composites.push({
                input: montageLabelSvg(pageCells[i].file),
                left: x,
                top: y + MONTAGE_CELL_H,
            });
        }
        await sharp({
            create: {
                width: MONTAGE_COLS * MONTAGE_CELL_W,
                height: MONTAGE_ROWS * (MONTAGE_CELL_H + MONTAGE_LABEL_H),
                channels: 3,
                background: '#000',
            },
        })
            .composite(composites)
            .jpeg({ quality: 85 })
            .toFile(path.join(montageDir, `page-${p + 1}.jpg`));
        pages++;
    }
    return { slug, pages, cells: cells.length, skipped: sheet.frames.length - cells.length };
}

/** Loads and validates a layer-1 verdicts file: { "<file>": { verdict: "keep"|"cut", evidence?: [...] } }. */
function loadVerdicts(verdictsPath) {
    let parsed;
    try {
        parsed = JSON.parse(fs.readFileSync(verdictsPath, 'utf8'));
    } catch {
        throw new Error(`contact-sheet: cannot read verdicts file: ${verdictsPath}`);
    }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error('contact-sheet: verdicts file must be a JSON object keyed by file name');
    }
    for (const [file, v] of Object.entries(parsed)) {
        if (!v || (v.verdict !== 'keep' && v.verdict !== 'cut')) {
            throw new Error(`contact-sheet: verdicts["${file}"] needs verdict "keep" or "cut"`);
        }
    }
    return parsed;
}

/**
 * WO 4, layer 0 (docs/critique-calibration-design.md D3): the default machine
 * critic is digest heuristics only — no model calls. A frame with gaze eye
 * contact is argued "keep" (the strongest nomination signal the deterministic
 * pipeline produces); everything else is "cut". Layer 1 supplies verdicts via
 * `verdicts` (agent-reviewed montage); the injectable `critic` parameter is the
 * seam for any future automated critic.
 */
export function defaultCritic(frame) {
    const eyeContact = frame.gaze ? frame.gaze.eyeContactCount : 0;
    if (eyeContact > 0) {
        return { verdict: 'keep', evidence: ['gaze:eye-contact'] };
    }
    return { verdict: 'cut', evidence: [] };
}

function calibrationLogPath(repoRoot) {
    return path.join(repoRoot, 'contact-sheet-ledger', 'calibration.jsonl');
}

/**
 * WO 4: runs the machine critic over one ledger digest after the human edit
 * (blinding — critique-calibration design D1) and appends only the
 * disagreements to the private calibration.jsonl (D5). `source` records the
 * direction: a kept select the critic rejects is a `select-audit`; a passed
 * frame the critic would keep is a `nomination`.
 *
 * Critic precedence: `verdicts` (layer-1 agent montage review; frames without
 * a verdict are skipped — no layer-0 fallback) > injected `critic` >
 * layer-0 `defaultCritic`.
 */
export function critiqueSheet(slug, { repoRoot = REPO_ROOT, critic, verdicts, now } = {}) {
    validateSlug(slug);
    const digestPath = path.join(repoRoot, 'contact-sheet-ledger', `${slug}.json`);
    if (!fs.existsSync(digestPath)) {
        throw new Error(`contact-sheet: no ledger digest for slug "${slug}"`);
    }
    const digest = JSON.parse(fs.readFileSync(digestPath, 'utf8'));
    let activeCritic = critic || defaultCritic;
    if (verdicts) {
        const known = new Set(digest.frames.map((f) => f.file));
        const unknown = Object.keys(verdicts).filter((f) => !known.has(f));
        if (unknown.length > 0) {
            throw new Error(
                `contact-sheet: verdicts reference unknown frames: ${unknown.join(', ')}`
            );
        }
        activeCritic = (frame) => {
            const v = verdicts[frame.file];
            if (!v) return null;
            return { verdict: v.verdict, evidence: Array.isArray(v.evidence) ? v.evidence : [] };
        };
    }
    const ts = (now || new Date()).toISOString();
    const records = [];
    for (const frame of digest.frames) {
        const human = frame.selection.decision === 'select' ? 'keep' : 'cut';
        const res = activeCritic(frame);
        if (!res) continue;
        const { verdict, evidence } = res;
        if (verdict === human) continue;
        records.push({
            ts,
            slug,
            file: frame.file,
            machine: verdict,
            human,
            evidence,
            humanReason: null,
            source: human === 'keep' ? 'select-audit' : 'nomination',
        });
    }
    if (records.length > 0) {
        fs.appendFileSync(
            calibrationLogPath(repoRoot),
            `${records.map((r) => JSON.stringify(r)).join('\n')}\n`
        );
    }
    return { slug, disagreements: records.length };
}

/** Backfills the human's reason onto every calibration record for one frame. */
export function resolveCalibration(slug, file, reason, { repoRoot = REPO_ROOT } = {}) {
    validateSlug(slug);
    const logPath = calibrationLogPath(repoRoot);
    if (!fs.existsSync(logPath)) {
        throw new Error(`contact-sheet: no calibration log at ${logPath} (run --critique first)`);
    }
    const lines = fs.readFileSync(logPath, 'utf8').split('\n').filter(Boolean);
    let resolved = 0;
    const updated = lines.map((line) => {
        const rec = JSON.parse(line);
        if (rec.slug === slug && rec.file === file) {
            rec.humanReason = reason || null;
            resolved++;
        }
        return JSON.stringify(rec);
    });
    if (resolved === 0) {
        throw new Error(`contact-sheet: no calibration record for "${file}" in "${slug}"`);
    }
    fs.writeFileSync(logPath, `${updated.join('\n')}\n`);
    return { slug, file, resolved };
}

async function defaultGazeRuntime() {
    const gaze = await import('../.agents/skills/sequence/scripts/gaze.mjs');
    const sessions = await gaze.createSessions();
    return { sessions, estimate: (p, s) => gaze.estimateGazeForImage(p, s) };
}

/**
 * Phase 2: fills the reserved gaze slot per frame by running the two-stage
 * ONNX gaze pipeline over the sheet's thumbs, then persists and re-renders.
 * slugOrAll is a slug or "all". The runtime is injectable for tests.
 */
export async function fillGaze(slugOrAll, { repoRoot = REPO_ROOT, gazeRuntime } = {}) {
    const sheetsDir = path.join(repoRoot, 'contact-sheets');
    const slugs =
        slugOrAll === 'all'
            ? fs
                  .readdirSync(sheetsDir, { withFileTypes: true })
                  .filter((e) => e.isDirectory() && fs.existsSync(localSheetPath(repoRoot, e.name)))
                  .map((e) => e.name)
                  .sort()
            : [slugOrAll];
    if (slugs.length === 0) {
        throw new Error('contact-sheet: no local sheets found (run --sync first)');
    }
    const runtime = gazeRuntime || (await defaultGazeRuntime());
    let framesScored = 0;
    for (const slug of slugs) {
        const sheet = loadLocalSheet(repoRoot, slug);
        for (const frame of sheet.frames) {
            const thumb = path.join(sheetsDir, slug, 'thumbs', `${frame.file}.jpg`);
            if (!fs.existsSync(thumb)) continue;
            const result = await runtime.estimate(thumb, runtime.sessions);
            frame.gaze = {
                modelVersion: result.modelVersion,
                faceCount: result.faces.length,
                eyeContactCount: result.faces.filter((f) => f.eyeContact).length,
                faces: result.faces,
            };
            framesScored++;
            if (framesScored % 25 === 0) {
                console.error(`contact-sheet: gaze ${framesScored} frames`);
            }
        }
        persistLocalSheet(repoRoot, sheet);
    }
    return { sheets: slugs.length, framesScored };
}

/**
 * The full ritual in one call: split a folder into per-day outings, write all
 * outputs, then reconcile against the Lightroom export folder and published
 * galleries. Returns { sheets, exports, galleries }.
 */
export async function syncLedger(
    dir,
    { env, now, repoRoot = REPO_ROOT, exportDir, galleryRoot } = {}
) {
    const sheets = await buildOutingSheets(dir, { env, now });
    for (const { sheet, thumbs } of sheets) {
        writeOutputs(sheet, thumbs, { repoRoot });
    }
    const exportsStats = await reconcileExports(
        exportDir || path.join(os.homedir(), 'Desktop', 'Export'),
        { env, repoRoot }
    );
    const galleriesStats = await reconcileGalleries(galleryRoot, { env, repoRoot });
    return { sheets, exports: exportsStats, galleries: galleriesStats };
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
            const statsParts = [
                f.metrics.cielab !== null
                    ? `L* ${f.metrics.luminance} · ΔE₇₆ ${f.metrics.deltaEPrev ?? '—'}`
                    : 'no metrics',
            ];
            if (f.gaze) {
                statsParts.push(
                    `faces ${f.gaze.faceCount} · eye contact ${f.gaze.eyeContactCount}`
                );
            }
            const stats = statsParts.join(' · ');
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
    const flagValue = (flag) => {
        const i = args.indexOf(flag);
        return i >= 0 && args[i + 1] !== undefined ? args[i + 1] : null;
    };
    const slug = flagValue('--slug');
    const reconcileDir = flagValue('--reconcile');
    const galleriesRequested = args.includes('--reconcile-galleries');
    const galleriesDir =
        galleriesRequested &&
        args[args.indexOf('--reconcile-galleries') + 1] &&
        !args[args.indexOf('--reconcile-galleries') + 1].startsWith('--')
            ? args[args.indexOf('--reconcile-galleries') + 1]
            : undefined;
    const split = args.includes('--split');
    const syncRequested = args.includes('--sync');
    const exportDir = flagValue('--export-dir') || undefined;
    const galleryRoot = flagValue('--gallery-root') || undefined;
    const annotateSlug = flagValue('--annotate');
    const annotateFile = flagValue('--file');
    const annotateNote = flagValue('--note');
    const renderSlug = flagValue('--render');
    const gazeSlug = flagValue('--gaze');
    const statsRequested = args.includes('--stats');
    const year = flagValue('--year');
    const annotateDaySlug = flagValue('--annotate-day');
    const dayMood = flagValue('--mood');
    const dayHours = flagValue('--hours');
    const dayLocation = flagValue('--location');
    const longitudinalRequested = args.includes('--longitudinal');
    const critiqueSlug = flagValue('--critique');
    const resolveSlug = flagValue('--resolve');
    const resolveReason = flagValue('--reason');
    const montageSlug = flagValue('--montage');
    const verdictsPath = flagValue('--verdicts');
    const valueFlags = new Set([
        '--slug',
        '--reconcile',
        '--export-dir',
        '--gallery-root',
        '--annotate',
        '--file',
        '--note',
        '--render',
        '--gaze',
        '--year',
        '--annotate-day',
        '--mood',
        '--hours',
        '--location',
        '--critique',
        '--resolve',
        '--reason',
        '--montage',
        '--verdicts',
    ]);
    const positionals = args.filter((a, i) => !a.startsWith('--') && !valueFlags.has(args[i - 1]));
    const dirArg = positionals[0];
    const help = args.includes('--help') || args.includes('-h');
    const usage =
        'Usage: node scripts/contact-sheet.mjs <dir> (--slug <YYYY-MM-DD-slug> | --split)\n' +
        '       node scripts/contact-sheet.mjs --sync <dir> [--export-dir <path>] [--gallery-root <path>]\n' +
        '       node scripts/contact-sheet.mjs --reconcile <exportDir>\n' +
        '       node scripts/contact-sheet.mjs --reconcile-galleries [galleryRoot]\n' +
        '       node scripts/contact-sheet.mjs --annotate <slug> --file <name> --note <text>\n' +
        '       node scripts/contact-sheet.mjs --annotate-day <slug> [--mood <t>] [--hours <n>] [--location <t>]\n' +
        '       node scripts/contact-sheet.mjs --render <slug>\n' +
        '       node scripts/contact-sheet.mjs --gaze <slug|all>\n' +
        '       node scripts/contact-sheet.mjs --stats [--year YYYY]\n' +
        '       node scripts/contact-sheet.mjs --longitudinal [--year YYYY]\n' +
        '       node scripts/contact-sheet.mjs --montage <slug>\n' +
        '       node scripts/contact-sheet.mjs --critique <slug> [--verdicts <file.json>]\n' +
        '       node scripts/contact-sheet.mjs --resolve <slug> --file <name> --reason <text>';
    const buildValid =
        Boolean(dirArg) &&
        !syncRequested &&
        !reconcileDir &&
        !galleriesRequested &&
        !annotateSlug &&
        !renderSlug &&
        !gazeSlug &&
        !statsRequested &&
        !annotateDaySlug &&
        !longitudinalRequested &&
        !critiqueSlug &&
        !resolveSlug &&
        !montageSlug &&
        Boolean(slug) !== split;
    const syncValid =
        syncRequested && Boolean(dirArg) && !slug && !split && !reconcileDir && !galleriesRequested;
    const utilityCount = [
        Boolean(reconcileDir),
        galleriesRequested,
        Boolean(annotateSlug),
        Boolean(renderSlug),
        Boolean(gazeSlug),
        statsRequested,
        longitudinalRequested,
        Boolean(critiqueSlug),
        Boolean(resolveSlug),
        Boolean(montageSlug),
    ].filter(Boolean).length;
    const annotateValid = Boolean(annotateSlug && annotateFile) && annotateNote !== null;
    const annotateDayValid =
        Boolean(annotateDaySlug) &&
        (dayMood !== null || dayHours !== null || dayLocation !== null) &&
        !annotateSlug;
    const resolveValid = Boolean(resolveSlug && annotateFile) && resolveReason !== null;
    const verdictsMisplaced = Boolean(verdictsPath) && !critiqueSlug;
    const valid =
        !verdictsMisplaced &&
        (buildValid ||
            syncValid ||
            (utilityCount === 1 &&
                (!annotateSlug || annotateValid) &&
                !annotateDaySlug &&
                (!resolveSlug || resolveValid)) ||
            (annotateDayValid && utilityCount === 0));
    if (help || !valid) {
        console.error(usage);
        process.exit(help ? 0 : 1);
    }
    (async () => {
        if (montageSlug) {
            const r = await buildMontage(montageSlug);
            console.log(
                `contact-sheet: montage ${montageSlug}: ${r.pages} page(s), ${r.cells} cells` +
                    (r.skipped ? ` (${r.skipped} skipped, no thumb)` : '')
            );
            return;
        }
        if (critiqueSlug) {
            const r = critiqueSheet(critiqueSlug, {
                verdicts: verdictsPath ? loadVerdicts(verdictsPath) : undefined,
            });
            console.log(
                `contact-sheet: critique on ${critiqueSlug}: ${r.disagreements} disagreement(s) appended to calibration.jsonl`
            );
            return;
        }
        if (resolveSlug) {
            const r = resolveCalibration(resolveSlug, annotateFile, resolveReason);
            console.log(
                `contact-sheet: resolved ${r.resolved} calibration record(s) for ${annotateFile} in ${resolveSlug}`
            );
            return;
        }
        if (annotateDaySlug) {
            annotateDay(annotateDaySlug, { mood: dayMood, hours: dayHours, location: dayLocation });
            console.log(`contact-sheet: annotated day fields on ${annotateDaySlug}`);
            return;
        }
        if (longitudinalRequested) {
            process.stdout.write(
                renderLongitudinalMd(
                    computeLongitudinal(loadDigests(), { year: year || undefined })
                )
            );
            return;
        }
        if (statsRequested) {
            const { rows, totals } = computeStats(loadDigests(), { year: year || undefined });
            for (const r of rows) {
                console.log(
                    `${r.slug} | frames: ${r.frames} | select: ${r.selects} | exported: ${r.exported} | published: ${r.published}`
                );
            }
            console.log(
                `TOTAL | outings: ${totals.outings} | frames: ${totals.frames} | select: ${totals.selects} | exported: ${totals.exported} | published: ${totals.published}`
            );
            return;
        }
        if (annotateSlug) {
            annotateSheet(annotateSlug, annotateFile, annotateNote);
            console.log(`contact-sheet: annotated ${annotateFile} in ${annotateSlug}`);
            return;
        }
        if (renderSlug) {
            renderLocalSheet(renderSlug);
            console.log(`contact-sheet: re-rendered contact-sheets/${renderSlug}/index.html`);
            return;
        }
        if (gazeSlug) {
            const r = await fillGaze(gazeSlug);
            console.log(
                `contact-sheet: gaze scored ${r.framesScored} frames across ${r.sheets} sheet(s)`
            );
            return;
        }
        if (reconcileDir) {
            const r = await reconcileExports(reconcileDir);
            console.log(
                `contact-sheet: reconciled ${r.exportsScanned} exports against ${r.digestsScanned} digests (${r.digestsUpdated} updated, ${r.framesMarked} frames marked)`
            );
            return;
        }
        if (galleriesRequested) {
            const r = await reconcileGalleries(galleriesDir);
            console.log(
                `contact-sheet: reconciled ${r.galleriesScanned} gallery images against ${r.digestsScanned} digests (${r.digestsUpdated} updated, ${r.framesMarked} frames marked)`
            );
            return;
        }
        if (syncRequested) {
            const r = await syncLedger(dirArg, { exportDir, galleryRoot });
            for (const { sheet } of r.sheets) {
                console.log(`contact-sheet: ${sheet.slug}: ${sheet.source.frameCount} frames`);
            }
            console.log(
                `contact-sheet: ${r.sheets.length} outings ledgered; exports: ${r.exports.framesMarked} marked; galleries: ${r.galleries.framesMarked} marked`
            );
            return;
        }
        if (split) {
            const sheets = await buildOutingSheets(dirArg);
            for (const { sheet, thumbs } of sheets) {
                writeOutputs(sheet, thumbs);
                console.log(`contact-sheet: ${sheet.slug}: ${sheet.source.frameCount} frames`);
            }
            console.log(
                `contact-sheet: ${sheets.length} outings → contact-sheets/<day>/ + contact-sheet-ledger/<day>.json`
            );
            return;
        }
        const { sheet, thumbs } = await buildSheet(dirArg, { slug });
        writeOutputs(sheet, thumbs);
        console.log(
            `contact-sheet: ${sheet.source.frameCount} frames → contact-sheets/${sheet.slug}/ + contact-sheet-ledger/${sheet.slug}.json`
        );
    })().catch((err) => {
        console.error(err.message || err);
        process.exit(1);
    });
}
