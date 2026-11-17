/**
 * Schema and semantic invariant validator for book/sequence.yaml.
 * Enforces strict bw/color modality separation, pool completeness, safe paths, and banned pairs.
 */

import fs from 'fs';
import path from 'path';
import { load as yamlLoad } from 'js-yaml';

const EXPECTED_MOVEMENTS = Object.freeze([
    { id: 'SYS.01', title: 'THRESHOLD', modality: 'bw' },
    { id: 'SYS.02', title: 'KINEMATICS', modality: 'color' },
    { id: 'SYS.03', title: 'PHANTOM', modality: 'color' },
    { id: 'SYS.04', title: 'SINGULARITY', modality: 'bw' },
]);

const VALID_LAYOUTS = new Set([
    'monolith',
    'monolith-epigraph',
    'asymmetric-diptych',
    'symmetric-diptych',
    'diagonal-offset',
    'phase-divider',
]);

const SAFE_SOURCE_RE = /^assets\/img\/p[1-9][0-9]*\/[^/]+\.(?:jpe?g|JPG)$/;
const HEX64_RE = /^[a-f0-9]{64}$/;

function validateEnvelope(ledger, errors) {
    if (!ledger || typeof ledger !== 'object') {
        errors.push('Ledger must be a non-null object.');
        return;
    }
    if (ledger.schemaVersion !== 1) {
        errors.push('schemaVersion must be 1.');
    }
    if (ledger.editionId !== 'infinite-systems') {
        errors.push('editionId must be "infinite-systems".');
    }
    if (ledger.title !== 'INFINITE SYSTEMS') {
        errors.push('title must be "INFINITE SYSTEMS".');
    }
    if (!Number.isInteger(ledger.revision) || ledger.revision < 1) {
        errors.push('revision must be a positive integer.');
    }
    if (!HEX64_RE.test(String(ledger.sourceFingerprint || ''))) {
        errors.push('sourceFingerprint must be a 64-character hex SHA-256 string.');
    }
    if (ledger.constraints?.strictModalitySeparation !== true) {
        errors.push('constraints.strictModalitySeparation must be true.');
    }
    if (ledger.constraints?.requireCompletePool !== true) {
        errors.push('constraints.requireCompletePool must be true.');
    }
}

function validateAssetsAndFragments(ledger, errors) {
    const assetMap = new Map();
    for (const asset of ledger.assets || []) {
        if (assetMap.has(asset.assetId)) {
            errors.push(`Duplicate assetId: ${asset.assetId}`);
        }
        if (
            !SAFE_SOURCE_RE.test(String(asset.source || '')) ||
            String(asset.source).includes('..')
        ) {
            errors.push(`Unsafe or invalid asset source path: ${asset.source}`);
        }
        if (!['bw', 'color'].includes(asset.modality)) {
            errors.push(`Invalid modality for ${asset.assetId}: ${asset.modality}`);
        }
        if (!HEX64_RE.test(String(asset.sourceSha256 || ''))) {
            errors.push(`Invalid sourceSha256 for ${asset.assetId}`);
        }
        if (!asset.altText || typeof asset.altText !== 'string') {
            errors.push(`Missing altText for ${asset.assetId}`);
        }
        assetMap.set(asset.assetId, asset);
    }

    const fragmentMap = new Map();
    for (const frag of ledger.fragments || []) {
        if (fragmentMap.has(frag.fragmentId)) {
            errors.push(`Duplicate fragmentId: ${frag.fragmentId}`);
        }
        if (frag.excerptPolicy !== 'verbatim-only') {
            errors.push(`Fragment ${frag.fragmentId} must have excerptPolicy "verbatim-only".`);
        }
        if (frag.originality === 'third-party' && !frag.attribution) {
            errors.push(`Third-party fragment ${frag.fragmentId} requires attribution.`);
        }
        fragmentMap.set(frag.fragmentId, frag);
    }
    return { assetMap, fragmentMap };
}

function checkSpreadSlot(slot, movement, assetMap, placedAssetIds, errors) {
    if (!slot || !slot.assetId) {
        return null;
    }
    const asset = assetMap.get(slot.assetId);
    if (!asset) {
        errors.push(`Unknown assetId ${slot.assetId} in ${movement.movementId}`);
        return null;
    }
    if (asset.modality !== movement.modality) {
        errors.push(
            `Modality violation: asset ${asset.assetId} (${asset.modality}) placed in ${movement.movementId} (${movement.modality})`
        );
    }
    if (placedAssetIds.has(asset.assetId)) {
        errors.push(`Duplicate placement of assetId: ${asset.assetId}`);
    }
    placedAssetIds.add(asset.assetId);
    return asset.assetId;
}

function validateMovements(ledger, assetMap, errors) {
    const movements = ledger.movements || [];
    if (movements.length !== 4) {
        errors.push('Ledger must contain exactly 4 movements (SYS.01..SYS.04).');
        return [];
    }

    const bannedSet = new Set(
        (ledger.constraints?.bannedAssetPairs || []).flatMap(([a, b]) => [`${a}|${b}`, `${b}|${a}`])
    );
    const placedList = [];
    const placedSet = new Set();

    for (let i = 0; i < EXPECTED_MOVEMENTS.length; i++) {
        const exp = EXPECTED_MOVEMENTS[i];
        const mov = movements[i];
        if (mov.movementId !== exp.id || mov.title !== exp.title || mov.modality !== exp.modality) {
            errors.push(`Movement ${i + 1} must be ${exp.id} // ${exp.title} (${exp.modality}).`);
        }
        for (const spread of mov.spreads || []) {
            if (!VALID_LAYOUTS.has(spread.layout)) {
                errors.push(`Invalid spread layout ${spread.layout} in ${spread.spreadId}`);
            }
            const vId = checkSpreadSlot(spread.verso, mov, assetMap, placedSet, errors);
            const rId = checkSpreadSlot(spread.recto, mov, assetMap, placedSet, errors);
            if (vId) {
                placedList.push(vId);
            }
            if (rId) {
                placedList.push(rId);
            }
            if (vId && rId && bannedSet.has(`${vId}|${rId}`)) {
                errors.push(`Banned pair violation in ${spread.spreadId}: ${vId} + ${rId}`);
            }
        }
    }
    return placedList;
}

export function validateLedgerObject(ledger, { expectedPoolAssetIds = null } = {}) {
    const errors = [];
    validateEnvelope(ledger, errors);
    if (errors.length > 0 && (!ledger || typeof ledger !== 'object')) {
        return { valid: false, errors };
    }

    const { assetMap } = validateAssetsAndFragments(ledger, errors);
    const placedList = validateMovements(ledger, assetMap, errors);

    if (placedList.length > 0) {
        const opener = ledger.constraints?.pinnedOpenerAssetId;
        const closer = ledger.constraints?.pinnedCloserAssetId;
        if (opener && placedList[0] !== opener) {
            errors.push(
                `First placed asset (${placedList[0]}) does not match pinnedOpenerAssetId (${opener}).`
            );
        }
        if (closer && placedList[placedList.length - 1] !== closer) {
            errors.push(
                `Last placed asset (${placedList[placedList.length - 1]}) does not match pinnedCloserAssetId (${closer}).`
            );
        }
    }

    const targetIds = expectedPoolAssetIds || [...assetMap.keys()];
    if (ledger.constraints?.requireCompletePool === true && placedList.length > 0) {
        for (const id of targetIds) {
            if (!placedList.includes(id)) {
                errors.push(`Incomplete pool: asset ${id} is not placed in any spread.`);
            }
        }
    }

    return { valid: errors.length === 0, errors };
}

export function validateLedgerFile(ledgerPath, options = {}) {
    const raw = fs.readFileSync(ledgerPath, 'utf8');
    const parsed = yamlLoad(raw);
    return validateLedgerObject(parsed, options);
}

export async function run(args = []) {
    const ledgerPath =
        args.find((a) => !a.startsWith('-')) || path.join(process.cwd(), 'book', 'sequence.yaml');
    if (!fs.existsSync(ledgerPath)) {
        process.stderr.write(`Ledger file not found: ${ledgerPath}\n`);
        return 1;
    }
    const res = validateLedgerFile(ledgerPath);
    if (!res.valid) {
        process.stderr.write(`Validation failed:\n${res.errors.join('\n')}\n`);
        return 1;
    }
    process.stdout.write('Ledger validation passed.\n');
    return 0;
}
