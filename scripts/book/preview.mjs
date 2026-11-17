/**
 * Two-tier live preview coordinator over canonical layout IR.
 * Enforces monotonic revision gating so out-of-order renders (A -> B -> C) never overwrite newer state.
 */

import { compileLayoutIr } from './layout.mjs';

export function createPreviewSession(initialLedger, profile, { renderFn } = {}) {
    let candidateRevision = 1;
    let candidateLedger = structuredClone(initialLedger);
    let currentIr = compileLayoutIr(candidateLedger, profile);
    let latestRendered = null;
    let inFlightRevision = 0;

    function getState() {
        let badge = 'Interactive estimate';
        if (inFlightRevision === candidateRevision) {
            badge = `Rendering revision ${candidateRevision}`;
        } else if (
            latestRendered &&
            latestRendered.revision === candidateRevision &&
            latestRendered.layoutHash === currentIr.layoutHash
        ) {
            badge = `PDF preview revision ${candidateRevision}`;
        } else if (latestRendered) {
            badge = 'Stale / preflight required';
        }
        return {
            candidateRevision,
            layoutHash: currentIr.layoutHash,
            badge,
            latestRendered,
        };
    }

    function updateCandidate(mutatorFn) {
        candidateRevision += 1;
        candidateLedger = mutatorFn(structuredClone(candidateLedger));
        currentIr = compileLayoutIr(candidateLedger, profile);
        return getState();
    }

    async function triggerAuthoritativeRender() {
        const snapRev = candidateRevision;
        const snapIr = structuredClone(currentIr);
        inFlightRevision = Math.max(inFlightRevision, snapRev);

        const result = await renderFn({
            revision: snapRev,
            layoutIr: snapIr,
            layoutHash: snapIr.layoutHash,
        });

        if (
            snapRev === candidateRevision &&
            (!latestRendered || snapRev > latestRendered.revision)
        ) {
            latestRendered = {
                revision: snapRev,
                layoutHash: snapIr.layoutHash,
                pdfSha256: result.pdfSha256,
            };
        }
        if (inFlightRevision === snapRev) {
            inFlightRevision = 0;
        }
        return getState();
    }

    function canExport(preflightReport) {
        if (!latestRendered || !preflightReport || preflightReport.passed !== true) {
            return false;
        }
        return (
            latestRendered.revision === candidateRevision &&
            latestRendered.layoutHash === currentIr.layoutHash &&
            preflightReport.pdfSha256 === latestRendered.pdfSha256
        );
    }

    return {
        getState,
        updateCandidate,
        triggerAuthoritativeRender,
        canExport,
    };
}

export async function run() {
    process.stdout.write('Preview session coordinator ready.\n');
    return 0;
}
