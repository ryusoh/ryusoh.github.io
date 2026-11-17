/**
 * Content-addressed derivative builder for display and screen output profiles.
 * Writes exclusively under .cache/book-img/; never mutates source JPEGs.
 */

import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

export const REQUIRED_BOOK_FONTS = Object.freeze([
    'Syne-ExtraBold.ttf',
    'Syne-Bold.ttf',
    'Syne-Regular.ttf',
    'GlowSansSC-Extended-Regular.otf',
    'GlowSansSC-Extended-Bold.otf',
    'JetBrainsMono-Regular.ttf',
]);

export function verifyBookFonts(fontDir) {
    const missing = [];
    const hasStaticSyne = ['Syne-ExtraBold.ttf', 'Syne-Bold.ttf', 'Syne-Regular.ttf'].every((f) =>
        fs.existsSync(path.join(fontDir, f))
    );
    const hasVariableSyne = fs.existsSync(path.join(fontDir, 'Syne-Variable.ttf'));
    if (!hasStaticSyne && !hasVariableSyne) {
        missing.push('Syne-Variable.ttf (or Syne-{Regular,Bold,ExtraBold}.ttf)');
    }
    for (const file of [
        'GlowSansSC-Extended-Regular.otf',
        'GlowSansSC-Extended-Bold.otf',
        'JetBrainsMono-Regular.ttf',
    ]) {
        if (!fs.existsSync(path.join(fontDir, file))) {
            missing.push(file);
        }
    }
    return { valid: missing.length === 0, missing };
}

export function computeDerivativeKey({
    sourceSha256,
    profileId,
    modality,
    derivativeRecipe,
    sharpVersion = sharp.versions?.sharp || '0.35.5',
}) {
    const payload = JSON.stringify({
        sourceSha256,
        profileId,
        modality,
        derivativeRecipe,
        sharpVersion,
    });
    return crypto.createHash('sha256').update(payload).digest('hex');
}

export const DEFAULT_COVER_SOURCE = 'assets/img/book/cover.jpg';

export async function ensureCoverDerivative({
    rootDir = process.cwd(),
    profileId = 'display',
    cacheDir = path.join(rootDir, '.cache', 'book-img'),
    coverSource = DEFAULT_COVER_SOURCE,
} = {}) {
    const srcPath = path.isAbsolute(coverSource) ? coverSource : path.join(rootDir, coverSource);
    if (!fs.existsSync(srcPath)) {
        return null;
    }
    const srcHash = crypto.createHash('sha256').update(fs.readFileSync(srcPath)).digest('hex');
    const crop = { left: 430, top: 0, width: 1150, height: 1365 };
    const key = computeDerivativeKey({
        sourceSha256: `${srcHash}-crop-${crop.left}x${crop.width}`,
        profileId,
        modality: 'bw',
        derivativeRecipe: 'cover-portrait-b-w',
    });
    const outDir = path.join(cacheDir, profileId);
    fs.mkdirSync(outDir, { recursive: true });
    const outPath = path.join(outDir, `cover-dscf5076-2-${key.slice(0, 16)}.jpg`);
    if (!fs.existsSync(outPath)) {
        await sharp(srcPath)
            .extract(crop)
            .toColorspace('b-w')
            .jpeg({ quality: profileId === 'display' ? 92 : 84, mozjpeg: true })
            .toFile(outPath);
    }
    return { path: outPath, width: crop.width, height: crop.height };
}

export async function ensureBookDerivative(
    asset,
    profile,
    { rootDir = process.cwd(), cacheDir = path.join(rootDir, '.cache', 'book-img') } = {}
) {
    const key = computeDerivativeKey({
        sourceSha256: asset.sourceSha256,
        profileId: profile.profileId,
        modality: asset.modality,
        derivativeRecipe: asset.derivativeRecipe,
    });

    const profileDir = path.join(cacheDir, profile.profileId);
    fs.mkdirSync(profileDir, { recursive: true });
    const outPath = path.join(profileDir, `${asset.assetId}-${key.slice(0, 16)}.jpg`);
    const metaPath = `${outPath}.meta.json`;

    if (fs.existsSync(outPath) && fs.existsSync(metaPath)) {
        return JSON.parse(fs.readFileSync(metaPath, 'utf8'));
    }

    const srcPath = path.join(rootDir, asset.source);
    const srcMeta = await sharp(srcPath).metadata();
    const isOversized = Math.max(srcMeta.width || 0, srcMeta.height || 0) > 2048;
    let action = 'passthrough';

    if (profile.profileId === 'display') {
        if (asset.modality === 'bw' && asset.derivativeRecipe === 'neutralize-grayscale-2048') {
            await sharp(srcPath)
                .resize(2048, 2048, { fit: 'inside', withoutEnlargement: true })
                .toColorspace('b-w')
                .jpeg({ quality: 92, mozjpeg: true })
                .toFile(outPath);
            action = 'neutralize-grayscale-q92';
        } else if (!isOversized) {
            fs.copyFileSync(srcPath, outPath);
            action = 'passthrough-dct';
        } else {
            await sharp(srcPath)
                .resize(2048, 2048, { fit: 'inside', withoutEnlargement: true })
                .keepIccProfile()
                .jpeg({ quality: 92, mozjpeg: true })
                .toFile(outPath);
            action = 'downsample-2048-keep-icc-q92';
        }
    } else if (asset.modality === 'bw') {
        await sharp(srcPath)
            .resize(2048, 2048, { fit: 'inside', withoutEnlargement: true })
            .toColorspace('b-w')
            .jpeg({ quality: 84, mozjpeg: true })
            .toFile(outPath);
        action = 'device-gray-1ch-q84';
    } else {
        await sharp(srcPath)
            .resize(2048, 2048, { fit: 'inside', withoutEnlargement: true })
            .toColorspace('srgb')
            .jpeg({ quality: 82, mozjpeg: true, chromaSubsampling: '4:2:0' })
            .toFile(outPath);
        action = 'srgb-q82-420';
    }

    const outMeta = await sharp(outPath).metadata();
    const record = {
        assetId: asset.assetId,
        cacheKey: key,
        outputPath: outPath,
        action,
        width: outMeta.width || 0,
        height: outMeta.height || 0,
        channels: outMeta.channels || 3,
        space: outMeta.space || 'srgb',
    };
    fs.writeFileSync(metaPath, `${JSON.stringify(record, null, 2)}\n`, 'utf8');
    return record;
}
