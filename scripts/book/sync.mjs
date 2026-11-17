/**
 * Plan-only pool sync and atomic plan application for book/sequence.yaml.
 * Blocks automatic deletion of any asset on a locked spread.
 */

import fs from 'fs';
import path from 'path';
import { dump as yamlDump, load as yamlLoad } from 'js-yaml';
import { collectPoolInventory, parseSeriesArg } from './inventory.mjs';
import { validateLedgerObject } from './validate.mjs';

export function createSyncPlan(inventory, currentLedger) {
    const currentMap = new Map((currentLedger.assets || []).map((a) => [a.assetId, a]));
    const invMap = new Map((inventory.assets || []).map((a) => [a.assetId, a]));

    const addedAssets = inventory.assets.filter((a) => !currentMap.has(a.assetId));
    const deletedAssets = (currentLedger.assets || []).filter((a) => !invMap.has(a.assetId));
    const updatedRevisions = inventory.assets.filter((a) => {
        const prev = currentMap.get(a.assetId);
        return prev && prev.sourceSha256 !== a.sourceSha256;
    });

    const lockedAssetIds = new Set();
    for (const mov of currentLedger.movements || []) {
        for (const sp of mov.spreads || []) {
            if (sp.locked) {
                if (sp.verso?.assetId) {
                    lockedAssetIds.add(sp.verso.assetId);
                }
                if (sp.recto?.assetId) {
                    lockedAssetIds.add(sp.recto.assetId);
                }
            }
        }
    }

    const blockingConflicts = deletedAssets
        .filter((a) => lockedAssetIds.has(a.assetId))
        .map((a) => ({
            type: 'locked-spread-deletion',
            assetId: a.assetId,
            message: `Asset ${a.assetId} is used by a locked spread and cannot be auto-deleted.`,
        }));

    return {
        planId: `plan-rev-${currentLedger.revision}-${inventory.sourceFingerprint.slice(0, 8)}`,
        parentRevision: currentLedger.revision,
        targetSourceFingerprint: inventory.sourceFingerprint,
        addedAssets: addedAssets.map((a) => ({ assetId: a.assetId, modality: a.modality })),
        deletedAssets: deletedAssets.map((a) => ({ assetId: a.assetId, modality: a.modality })),
        updatedRevisions: updatedRevisions.map((a) => ({
            assetId: a.assetId,
            newSha256: a.sourceSha256,
        })),
        blockingConflicts,
    };
}

export function applySyncPlan(plan, currentLedger, nextLedgerCandidate, { ledgerPath } = {}) {
    if (plan.parentRevision !== currentLedger.revision) {
        throw new Error(
            `Stale plan: parentRevision ${plan.parentRevision} !== current revision ${currentLedger.revision}`
        );
    }
    if (plan.blockingConflicts && plan.blockingConflicts.length > 0) {
        throw new Error(
            `Cannot apply plan with blocking conflicts: ${plan.blockingConflicts[0].message}`
        );
    }
    const nextLedger = {
        ...nextLedgerCandidate,
        revision: currentLedger.revision + 1,
        parentRevision: currentLedger.revision,
    };
    const check = validateLedgerObject(nextLedger);
    if (!check.valid) {
        throw new Error(`Invalid target ledger: ${check.errors.join('; ')}`);
    }
    if (ledgerPath) {
        const tmpPath = `${ledgerPath}.tmp`;
        fs.writeFileSync(tmpPath, yamlDump(nextLedger, { lineWidth: 100 }), 'utf8');
        fs.renameSync(tmpPath, ledgerPath);
    }
    return nextLedger;
}

async function formatLedgerYaml(ledger, rootDir = process.cwd()) {
    const rawYaml = yamlDump(ledger, { indent: 4, lineWidth: 100 });
    try {
        const prettier = (await import('prettier')).default;
        const cfg = await prettier.resolveConfig(path.join(rootDir, '.prettierrc.cjs'));
        return await prettier.format(rawYaml, { ...(cfg || {}), parser: 'yaml' });
    } catch {
        return rawYaml;
    }
}

function extractPlanId(args) {
    const idx = args.indexOf('--plan');
    if (idx >= 0 && args[idx + 1]) {
        return args[idx + 1];
    }
    const eqArg = args.find((a) => a.startsWith('--plan='));
    if (eqArg) {
        return eqArg.slice('--plan='.length);
    }
    return args.find((a) => !a.startsWith('-')) || '';
}

function resolveCandidateFile(rootDir, planId) {
    const runsDir = path.join(rootDir, '.cache', 'book-runs');
    const candidates = [
        path.resolve(rootDir, planId),
        path.join(runsDir, `${planId}.json`),
        path.join(runsDir, `proposal-${planId}.json`),
    ];
    return candidates.find((p) => fs.existsSync(p)) || null;
}

export async function run(args = [], { subcommand = 'plan' } = {}) {
    const rootDir = process.cwd();
    const ledgerPath = path.join(rootDir, 'book', 'sequence.yaml');
    const hasLedger = fs.existsSync(ledgerPath);
    const currentLedger = hasLedger
        ? yamlLoad(fs.readFileSync(ledgerPath, 'utf8'))
        : { revision: 0, assets: [], movements: [] };
    const explicitSeries = args.includes('--series') || args.some((a) => a.startsWith('--series='));
    const planId = subcommand === 'apply' ? extractPlanId(args) : '';
    const candidatePath = planId ? resolveCandidateFile(rootDir, planId) : null;
    const candidatePreview =
        candidatePath && fs.existsSync(candidatePath)
            ? JSON.parse(fs.readFileSync(candidatePath, 'utf8'))
            : null;
    const seriesIds = explicitSeries
        ? parseSeriesArg(args)
        : candidatePreview?.constraints?.seriesIds ||
          currentLedger?.constraints?.seriesIds ||
          undefined;
    const inventory = await collectPoolInventory({ rootDir, seriesIds });
    const plan = createSyncPlan(inventory, currentLedger);
    const outDir = path.join(rootDir, '.cache', 'book-runs');
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(
        path.join(outDir, `${plan.planId}.json`),
        `${JSON.stringify(plan, null, 2)}\n`
    );

    if (subcommand === 'plan') {
        const proposals = fs.readdirSync(outDir).filter((f) => f.startsWith('proposal-'));
        process.stdout.write(
            `Sync plan created: ${plan.planId} (added=${plan.addedAssets.length}, deleted=${plan.deletedAssets.length}, updated=${plan.updatedRevisions.length})\n`
        );
        if (!hasLedger && proposals.length > 0) {
            process.stdout.write(`Available candidate proposals: ${proposals.join(', ')}\n`);
        }
        return plan.blockingConflicts.length > 0 ? 1 : 0;
    }

    if (!planId) {
        process.stderr.write('Missing required --plan <id>\n');
        return 1;
    }
    if (!candidatePath) {
        process.stderr.write(`Candidate plan not found: ${planId}\n`);
        return 1;
    }
    const candidate = candidatePreview;
    if (!candidate || !Array.isArray(candidate.movements)) {
        process.stderr.write(`Plan file ${candidatePath} is not an applyable sequence ledger.\n`);
        return 1;
    }

    const expectedPoolAssetIds = inventory.assets.map((a) => a.assetId);
    if (!hasLedger) {
        const initialLedger = { ...candidate, revision: 1, parentRevision: null };
        const check = validateLedgerObject(initialLedger, { expectedPoolAssetIds });
        if (!check.valid) {
            process.stderr.write(`Invalid initial ledger: ${check.errors.join('; ')}\n`);
            return 1;
        }
        fs.mkdirSync(path.dirname(ledgerPath), { recursive: true });
        const tmpPath = `${ledgerPath}.tmp`;
        fs.writeFileSync(tmpPath, await formatLedgerYaml(initialLedger, rootDir), 'utf8');
        fs.renameSync(tmpPath, ledgerPath);
        process.stdout.write(`Initialized ${ledgerPath} at revision 1 from ${planId}\n`);
        return 0;
    }

    const nextLedger = applySyncPlan(plan, currentLedger, candidate);
    const tmpPath = `${ledgerPath}.tmp`;
    fs.writeFileSync(tmpPath, await formatLedgerYaml(nextLedger, rootDir), 'utf8');
    fs.renameSync(tmpPath, ledgerPath);
    process.stdout.write(`Applied ${planId}: revision ${nextLedger.revision}\n`);
    return 0;
}
