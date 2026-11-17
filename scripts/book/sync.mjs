/**
 * Plan-only pool sync and atomic plan application for book/sequence.yaml.
 * Blocks automatic deletion of any asset on a locked spread.
 */

import fs from 'fs';
import path from 'path';
import { dump as yamlDump, load as yamlLoad } from 'js-yaml';
import { collectPoolInventory } from './inventory.mjs';
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

export async function run(args = [], { subcommand = 'plan' } = {}) {
    const ledgerPath = path.join(process.cwd(), 'book', 'sequence.yaml');
    const currentLedger = yamlLoad(fs.readFileSync(ledgerPath, 'utf8'));
    const inventory = await collectPoolInventory();
    const plan = createSyncPlan(inventory, currentLedger);
    const outDir = path.join(process.cwd(), '.cache', 'book-runs');
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(
        path.join(outDir, `${plan.planId}.json`),
        `${JSON.stringify(plan, null, 2)}\n`
    );
    if (subcommand === 'plan') {
        process.stdout.write(`Sync plan created: ${plan.planId}\n`);
        return plan.blockingConflicts.length > 0 ? 1 : 0;
    }
    const planArgIdx = args.indexOf('--plan');
    const planId = planArgIdx >= 0 ? args[planArgIdx + 1] : '';
    if (!planId) {
        process.stderr.write('Missing required --plan <id>\n');
        return 1;
    }
    return 0;
}
