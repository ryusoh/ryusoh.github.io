/**
 * Metrics & Colorimetry Module for Gallery Sequence Analysis
 * Implements CIELAB conversions, Delta E (CIE76), Hamiltonian pairwise tension, and Kawauchi respiratory rhythm.
 */

/**
 * Converts sRGB [0-255] to CIELAB { L, a, b } (D65 illuminant).
 * @param {number} r - Red channel [0, 255]
 * @param {number} g - Green channel [0, 255]
 * @param {number} b - Blue channel [0, 255]
 * @returns {{ L: number, a: number, b: number }}
 */
export function rgbToLab(r, g, b) {
    // 1. Convert to linear sRGB
    let rLinear = r / 255;
    let gLinear = g / 255;
    let bLinear = b / 255;

    rLinear = rLinear > 0.04045 ? Math.pow((rLinear + 0.055) / 1.055, 2.4) : rLinear / 12.92;
    gLinear = gLinear > 0.04045 ? Math.pow((gLinear + 0.055) / 1.055, 2.4) : gLinear / 12.92;
    bLinear = bLinear > 0.04045 ? Math.pow((bLinear + 0.055) / 1.055, 2.4) : bLinear / 12.92;

    // 2. Convert to XYZ (D65 standard)
    const x = (rLinear * 0.4124 + gLinear * 0.3576 + bLinear * 0.1805) / 0.95047;
    const y = (rLinear * 0.2126 + gLinear * 0.7152 + bLinear * 0.0722) / 1.0;
    const z = (rLinear * 0.0193 + gLinear * 0.1192 + bLinear * 0.9505) / 1.08883;

    // 3. Convert XYZ to CIELAB
    const f = (val) => (val > 0.008856 ? Math.cbrt(val) : 7.787 * val + 16 / 116);
    const fx = f(x);
    const fy = f(y);
    const fz = f(z);

    const L = Math.max(0, 116 * fy - 16);
    const a = 500 * (fx - fy);
    const bLab = 200 * (fy - fz);

    return {
        L: Number(L.toFixed(2)),
        a: Number(a.toFixed(2)),
        b: Number(bLab.toFixed(2)),
    };
}

/**
 * Computes CIELAB Delta E (CIE76 color difference).
 * @param {{ L: number, a: number, b: number }} lab1
 * @param {{ L: number, a: number, b: number }} lab2
 * @returns {number}
 */
export function deltaE(lab1, lab2) {
    if (!lab1 || !lab2) return 0;
    const dL = lab1.L - lab2.L;
    const da = lab1.a - lab2.a;
    const db = lab1.b - lab2.b;
    return Number(Math.sqrt(dL * dL + da * da + db * db).toFixed(2));
}

/**
 * Calculates pairwise transition cost between two images.
 * Evaluates chromatic bridge (Delta E), luminance contrast step, and aspect ratio shift.
 * @param {object} imgA
 * @param {object} imgB
 * @returns {object}
 */
export function calculateTransitionCost(imgA, imgB) {
    if (!imgA || !imgB || !imgA.analysis || !imgB.analysis) {
        return {
            totalCost: 0,
            deltaE: 0,
            deltaLum: 0,
            deltaAspect: 0,
        };
    }
    const a = imgA.analysis;
    const b = imgB.analysis;

    const dE = deltaE(a.lab, b.lab);
    const dLum = Math.abs(a.luminance - b.luminance);
    const aAspect = Number(a.aspectRatio) || 1.0;
    const bAspect = Number(b.aspectRatio) || 1.0;
    const dAspect = Math.abs(aAspect - bAspect);

    // Weighted cost normalized into 0-100 score
    const chromaticCost = Math.min(100, (dE / 80) * 100);
    const lumStepCost = (dLum / 255) * 100;
    const aspectCost = Math.min(100, (dAspect / 1.0) * 100);

    const chromaticComponent = Number((chromaticCost * 0.45).toFixed(1));
    const lumComponent = Number((lumStepCost * 0.35).toFixed(1));
    const aspectComponent = Number((aspectCost * 0.2).toFixed(1));

    const totalCost = Number(
        (chromaticCost * 0.45 + lumStepCost * 0.35 + aspectCost * 0.2).toFixed(1)
    );

    return {
        totalCost,
        deltaE: dE,
        deltaLum: dLum,
        deltaAspect: Number(dAspect.toFixed(2)),
        chromaticComponent,
        lumComponent,
        aspectComponent,
    };
}

/**
 * Calculates pairwise transitions across an image sequence.
 * @param {Array} images
 * @returns {Array}
 */
export function calculatePairwiseTransitions(images) {
    const transitions = [];
    for (let i = 0; i < images.length - 1; i++) {
        const trans = calculateTransitionCost(images[i], images[i + 1]);
        transitions.push({
            from: images[i].filename,
            to: images[i + 1].filename,
            ...trans,
        });
    }
    return transitions;
}

/**
 * Analyzes sequence respiratory rhythm (Kawauchi Inhalation / Exhalation breathing cycles).
 * @param {Array} images
 * @returns {object}
 */
export function analyzeRespiratoryRhythm(images) {
    const sequence = [];
    let consecutiveInhalations = 0;
    let consecutiveExhalations = 0;
    const anomalies = [];

    for (let i = 0; i < images.length; i++) {
        const img = images[i];
        const lum = img.analysis?.luminance ?? 128;
        let breath = 'Neutral (Grounding)';

        if (lum >= 135) {
            breath = 'Inhalation (Luminous/Expansive)';
            consecutiveInhalations++;
            consecutiveExhalations = 0;
        } else if (lum <= 75) {
            breath = 'Exhalation (Low-key/Dense)';
            consecutiveExhalations++;
            consecutiveInhalations = 0;
        } else {
            consecutiveInhalations = 0;
            consecutiveExhalations = 0;
        }

        if (consecutiveInhalations >= 3) {
            anomalies.push({
                index: i + 1,
                filename: img.filename,
                type: 'Hyperventilation',
                detail: `${consecutiveInhalations} consecutive high-key inhalation frames—consider a darker grounding anchor.`,
            });
        }
        if (consecutiveExhalations >= 3) {
            anomalies.push({
                index: i + 1,
                filename: img.filename,
                type: 'Suffocating Weight',
                detail: `${consecutiveExhalations} consecutive low-key exhalation frames—consider an open luminous interlude.`,
            });
        }

        sequence.push({
            order: i + 1,
            filename: img.filename,
            luminance: lum,
            breath,
        });
    }

    let inhalations = 0;
    let exhalations = 0;
    let neutrals = 0;
    for (const s of sequence) {
        if (s.breath.startsWith('Inhalation')) inhalations++;
        else if (s.breath.startsWith('Exhalation')) exhalations++;
        else neutrals++;
    }

    return {
        sequence,
        anomalies,
        rhythmScore: Math.max(0, 100 - anomalies.length * 15),
        inhalations,
        exhalations,
        neutrals,
    };
}

/**
 * Evaluates optimal insertion slots and impact for candidate outtake images into an existing sequence.
 * @param {Array} activeImages Current sequenced images
 * @param {Array} candidateImages Outtakes or newly added images
 * @returns {Array<object>} Evaluation results per candidate
 */
export function evaluateCandidatePlacements(activeImages, candidateImages) {
    if (
        !activeImages ||
        activeImages.length === 0 ||
        !candidateImages ||
        candidateImages.length === 0
    ) {
        return [];
    }

    const baselineTransitions = calculatePairwiseTransitions(activeImages);
    const baselineTotalCost = baselineTransitions.reduce((s, t) => s + (t.totalCost || 0), 0);
    const baselineRhythm = analyzeRespiratoryRhythm(activeImages);

    const evaluations = [];

    for (const cand of candidateImages) {
        if (!cand.analysis || cand.analysis.error) continue;

        const slotRankings = [];

        // Test inserting at every position from 0 (opening) to activeImages.length (finale)
        for (let pos = 0; pos <= activeImages.length; pos++) {
            const trialImages = [...activeImages.slice(0, pos), cand, ...activeImages.slice(pos)];
            const trialTransitions = calculatePairwiseTransitions(trialImages);
            const trialCost = trialTransitions.reduce((s, t) => s + (t.totalCost || 0), 0);
            const trialRhythm = analyzeRespiratoryRhythm(trialImages);

            // Compute local transition cost with immediate neighbors
            let localStepCost = 0;
            if (pos > 0) {
                const prev = activeImages[pos - 1];
                if (prev.analysis && cand.analysis) {
                    localStepCost += calculateTransitionCost(
                        prev.analysis,
                        cand.analysis
                    ).totalCost;
                }
            }
            if (pos < activeImages.length) {
                const next = activeImages[pos];
                if (cand.analysis && next.analysis) {
                    localStepCost += calculateTransitionCost(
                        cand.analysis,
                        next.analysis
                    ).totalCost;
                }
            }

            const costDelta = trialCost - baselineTotalCost;
            const rhythmDelta = trialRhythm.rhythmScore - baselineRhythm.rhythmScore;

            // Combined score: lower step friction + higher respiratory rhythm score
            const combinedScore = 100 - localStepCost + trialRhythm.rhythmScore;

            slotRankings.push({
                slotIndex: pos,
                slotPosition: pos + 1,
                prevNeighbor: pos > 0 ? activeImages[pos - 1].filename : null,
                nextNeighbor: pos < activeImages.length ? activeImages[pos].filename : null,
                trialTotalCost: Math.round(trialCost * 10) / 10,
                costDelta: Math.round(costDelta * 10) / 10,
                localStepCost: Math.round(localStepCost * 10) / 10,
                rhythmScore: trialRhythm.rhythmScore,
                rhythmDelta,
                newAnomalies: trialRhythm.anomalies.length,
                resolvedAnomalies: Math.max(
                    0,
                    baselineRhythm.anomalies.length - trialRhythm.anomalies.length
                ),
                combinedScore,
            });
        }

        // Sort by best score
        slotRankings.sort((a, b) => b.combinedScore - a.combinedScore);
        const bestSlot = slotRankings[0];

        // Curatorial placement rationale
        let rationale = '';
        if (bestSlot.prevNeighbor && bestSlot.nextNeighbor) {
            rationale = `Integrates smoothly between #${bestSlot.slotPosition - 1} (${bestSlot.prevNeighbor}) and #${bestSlot.slotPosition} (${bestSlot.nextNeighbor})`;
        } else if (!bestSlot.prevNeighbor) {
            rationale = `Serves as a powerful opening establishing frame before #${bestSlot.slotPosition} (${bestSlot.nextNeighbor})`;
        } else {
            rationale = `Acts as a resonant concluding coda frame after #${bestSlot.slotPosition - 1} (${bestSlot.prevNeighbor})`;
        }

        if (bestSlot.resolvedAnomalies > 0) {
            rationale += `; resolves ${bestSlot.resolvedAnomalies} cadence warning(s)`;
        }

        evaluations.push({
            candidate: cand.filename,
            analysis: cand.analysis,
            bestSlot,
            alternativeSlots: slotRankings.slice(1, 3),
            curatorialRationale: rationale,
        });
    }

    return evaluations;
}
