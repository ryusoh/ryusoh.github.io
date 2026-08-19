/**
 * IEEE / Nature Academic SVG Visualization Engine for Sequence Curation
 * Generates standalone vector graphics for Luminance Waveforms, Transition Tension,
 * and Colorimetric Spectra.
 */

/**
 * Escapes XML special characters for SVG content.
 * @param {string} unsafe
 * @returns {string}
 */
export function escapeXml(unsafe) {
    if (typeof unsafe !== 'string') return String(unsafe ?? '');
    return unsafe
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

/**
 * Generates standalone Figure 1: Photometric Luminance Waveform & Respiratory Rhythm SVG (IEEE Publication Standard).
 * @param {object} params
 * @param {object} [params.gallery]
 * @param {Array} [params.images]
 * @param {object} [params.respiratory]
 * @param {Array} [params.quotes]
 * @returns {string} Standalone SVG XML string
 */
export function generateLuminanceWaveformSvg({
    gallery = {},
    images = [],
    respiratory = {},
    quotes = [],
}) {
    const width = 880;
    const height = 280;
    const leftMargin = 68;
    const rightMargin = 740;
    const plotWidth = rightMargin - leftMargin; // 672px
    const plotTop = 32;
    const plotBottom = 224;
    const plotHeight = plotBottom - plotTop; // 192px

    let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="100%" height="100%">\n`;
    svg += `  <style>\n`;
    svg += `    .paper-bg { fill: #ffffff; }\n`;
    svg += `    .spine-box { fill: #ffffff; stroke: #0f172a; stroke-width: 0.85; }\n`;
    svg += `    .academic-grid { stroke: #f1f5f9; stroke-width: 0.6; stroke-dasharray: 2 3; }\n`;
    svg += `    .tick-line { stroke: #0f172a; stroke-width: 0.85; }\n`;
    svg += `    .fig-heading { fill: #0f172a; font-family: "Times New Roman", Times, "Nimbus Roman No9 L", "Liberation Serif", serif; font-size: 12.5px; font-weight: bold; letter-spacing: 0.2px; }\n`;
    svg += `    .axis-title { fill: #334155; font-family: "Times New Roman", Times, "Nimbus Roman No9 L", "Liberation Serif", serif; font-size: 10.5px; font-style: italic; }\n`;
    svg += `    .tick-label { fill: #334155; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; font-size: 9px; font-variant-numeric: tabular-nums; }\n`;
    svg += `    .threshold-label { fill: #475569; font-family: "Times New Roman", Times, "Nimbus Roman No9 L", "Liberation Serif", serif; font-size: 8.5px; font-style: italic; }\n`;
    svg += `  </style>\n\n`;

    svg += `  <rect width="${width}" height="${height}" class="paper-bg" />\n\n`;
    svg += `  <text x="${leftMargin}" y="20" class="fig-heading">Figure 1: Photometric Luminance Waveform L*(t) ∈ [0, 255] and Respiratory Rhythm</text>\n`;
    svg += `  <rect x="${leftMargin}" y="${plotTop}" width="${plotWidth}" height="${plotHeight}" class="spine-box" />\n`;

    const yZoneInhale = plotBottom - (135 / 255) * plotHeight;
    const yZoneGround = plotBottom - (75 / 255) * plotHeight;

    // Academic publication shaded zones with subtle boundary borders
    svg += `  <rect x="${leftMargin}" y="${plotTop}" width="${plotWidth}" height="${yZoneInhale - plotTop}" fill="#f0f7ff" stroke="none" />\n`;
    svg += `  <rect x="${leftMargin}" y="${yZoneGround}" width="${plotWidth}" height="${plotBottom - yZoneGround}" fill="#f8fafc" stroke="none" />\n`;

    svg += `  <line x1="${leftMargin}" y1="${yZoneInhale}" x2="${rightMargin}" y2="${yZoneInhale}" stroke="#93c5fd" stroke-width="0.75" stroke-dasharray="3 3" />\n`;
    svg += `  <text x="${rightMargin + 8}" y="${yZoneInhale + 3}" class="threshold-label" fill="#2b5c8f" text-anchor="start">Inhalation (L* ≥ 135)</text>\n`;

    svg += `  <line x1="${leftMargin}" y1="${yZoneGround}" x2="${rightMargin}" y2="${yZoneGround}" stroke="#cbd5e1" stroke-width="0.75" stroke-dasharray="3 3" />\n`;
    svg += `  <text x="${rightMargin + 8}" y="${yZoneGround + 3}" class="threshold-label" fill="#475569" text-anchor="start">Exhalation (L* ≤ 75)</text>\n`;

    svg += `  <text transform="translate(24, ${plotTop + plotHeight / 2}) rotate(-90)" class="axis-title" text-anchor="middle">Luminance L* ∈ [0, 255]</text>\n`;

    const lumTicks = [
        { val: 255, y: plotTop },
        { val: 135, y: yZoneInhale },
        { val: 75, y: yZoneGround },
        { val: 0, y: plotBottom },
    ];

    for (const t of lumTicks) {
        svg += `  <line x1="${leftMargin}" y1="${t.y}" x2="${rightMargin}" y2="${t.y}" class="academic-grid" />\n`;
        // Inward tick marks on left and right borders
        svg += `  <line x1="${leftMargin}" y1="${t.y}" x2="${leftMargin + 4.5}" y2="${t.y}" class="tick-line" />\n`;
        svg += `  <line x1="${rightMargin - 4.5}" y1="${t.y}" x2="${rightMargin}" y2="${t.y}" class="tick-line" />\n`;
        svg += `  <text x="${leftMargin - 6}" y="${t.y + 3}" class="tick-label" text-anchor="end">${t.val}</text>\n`;
    }

    const numImages = images.length;
    const f1Coords = [];
    for (let i = 0; i < numImages; i++) {
        const x =
            numImages > 1
                ? leftMargin + 20 + (i * (plotWidth - 40)) / (numImages - 1)
                : leftMargin + plotWidth / 2;
        const lum = Math.min(255, Math.max(0, images[i]?.analysis?.luminance ?? 128));
        const y = plotBottom - (lum / 255) * plotHeight;
        f1Coords.push({ x, y, lum, order: i + 1, filename: images[i]?.filename || `img_${i + 1}` });
    }

    if (f1Coords.length > 1) {
        let linePath = `M ${f1Coords[0].x} ${f1Coords[0].y}`;
        for (let i = 1; i < f1Coords.length; i++) {
            linePath += ` L ${f1Coords[i].x} ${f1Coords[i].y}`;
        }
        // Refined academic slate-navy stroke with subtle 1.4px line weight
        svg += `  <path d="${linePath}" fill="none" stroke="#2b5c8f" stroke-width="1.4" stroke-linejoin="round" stroke-linecap="round" />\n`;
    }

    for (const q of quotes) {
        const afterIdx = q.afterImageIndex;
        if (afterIdx >= 1 && afterIdx <= numImages) {
            let caesuraX;
            if (afterIdx < numImages && f1Coords[afterIdx - 1] && f1Coords[afterIdx]) {
                caesuraX = (f1Coords[afterIdx - 1].x + f1Coords[afterIdx].x) / 2;
            } else if (f1Coords[afterIdx - 1]) {
                caesuraX = Math.min(rightMargin - 15, f1Coords[afterIdx - 1].x + 15);
            }
            if (caesuraX !== undefined) {
                // Strictly mathematically contained inside spine box [plotTop, plotBottom] with clean label badge
                svg += `  <line x1="${caesuraX}" y1="${plotTop}" x2="${caesuraX}" y2="${plotBottom}" stroke="#475569" stroke-width="0.75" stroke-dasharray="3 3" />\n`;
                svg += `  <rect x="${caesuraX - 22}" y="${plotTop + 4}" width="44" height="13" fill="#ffffff" stroke="#cbd5e1" stroke-width="0.5" rx="2" />\n`;
                svg += `  <text x="${caesuraX}" y="${plotTop + 13}" class="threshold-label" fill="#334155" text-anchor="middle">Caesura</text>\n`;
            }
        }
    }

    for (const pt of f1Coords) {
        svg += `  <circle cx="${pt.x}" cy="${pt.y}" r="3.0" fill="#2b5c8f" stroke="#ffffff" stroke-width="1.0" />\n`;
        svg += `  <line x1="${pt.x}" y1="${plotBottom - 4.5}" x2="${pt.x}" y2="${plotBottom}" class="tick-line" />\n`;
        svg += `  <text x="${pt.x}" y="${plotBottom + 14}" class="tick-label" text-anchor="middle">${pt.order}</text>\n`;
    }

    svg += `  <text x="${leftMargin + plotWidth / 2}" y="${plotBottom + 34}" class="axis-title" text-anchor="middle">Sequence Frame Index (i)</text>\n`;
    svg += `</svg>\n`;
    return svg;
}

/**
 * Generates standalone Figure 2: Hamiltonian Pairwise Transition Tension SVG (IEEE Publication Standard).
 * @param {object} params
 * @param {object} [params.gallery]
 * @param {Array} [params.transitions]
 * @returns {string} Standalone SVG XML string
 */
export function generateTransitionTensionSvg({ gallery = {}, transitions = [] }) {
    const width = 880;
    const height = 280;
    const leftMargin = 68;
    const rightMargin = 740;
    const plotWidth = rightMargin - leftMargin; // 672px
    const plotTop = 32;
    const plotBottom = 224;
    const plotHeight = plotBottom - plotTop; // 192px

    let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="100%" height="100%">\n`;
    svg += `  <style>\n`;
    svg += `    .paper-bg { fill: #ffffff; }\n`;
    svg += `    .spine-box { fill: #ffffff; stroke: #0f172a; stroke-width: 0.85; }\n`;
    svg += `    .academic-grid { stroke: #f1f5f9; stroke-width: 0.6; stroke-dasharray: 2 3; }\n`;
    svg += `    .tick-line { stroke: #0f172a; stroke-width: 0.85; }\n`;
    svg += `    .fig-heading { fill: #0f172a; font-family: "Times New Roman", Times, "Nimbus Roman No9 L", "Liberation Serif", serif; font-size: 12.5px; font-weight: bold; letter-spacing: 0.2px; }\n`;
    svg += `    .axis-title { fill: #334155; font-family: "Times New Roman", Times, "Nimbus Roman No9 L", "Liberation Serif", serif; font-size: 10.5px; font-style: italic; }\n`;
    svg += `    .tick-label { fill: #334155; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; font-size: 9px; font-variant-numeric: tabular-nums; }\n`;
    svg += `    .threshold-label { fill: #475569; font-family: "Times New Roman", Times, "Nimbus Roman No9 L", "Liberation Serif", serif; font-size: 8.5px; font-style: italic; }\n`;
    svg += `    .legend-text { fill: #1e293b; font-family: "Times New Roman", Times, "Nimbus Roman No9 L", "Liberation Serif", serif; font-size: 8.5px; }\n`;
    svg += `  </style>\n\n`;

    svg += `  <rect width="${width}" height="${height}" class="paper-bg" />\n\n`;

    // Figure Heading: Clean single line above spine
    svg += `  <text x="${leftMargin}" y="20" class="fig-heading">Figure 2: Pairwise Hamiltonian Transition Tension Decomposition</text>\n`;
    svg += `  <rect x="${leftMargin}" y="${plotTop}" width="${plotWidth}" height="${plotHeight}" class="spine-box" />\n`;
    svg += `  <text transform="translate(24, ${plotTop + plotHeight / 2}) rotate(-90)" class="axis-title" text-anchor="middle">Transition Tension C(i, i+1) ∈ [0, 100]</text>\n`;

    const yShock = plotBottom - 0.5 * plotHeight;
    const yHarmonic = plotBottom - 0.25 * plotHeight;

    const costTicks = [
        { val: 100, y: plotTop },
        { val: 75, y: plotTop + plotHeight * 0.25 },
        {
            val: 50,
            y: yShock,
            dash: true,
            stroke: '#991b1b',
            label: 'Montage shock (C = 50)',
        },
        {
            val: 25,
            y: yHarmonic,
            dash: true,
            stroke: '#15803d',
            label: 'Harmonic baseline (C = 25)',
        },
        { val: 0, y: plotBottom },
    ];

    for (const t of costTicks) {
        if (t.dash) {
            svg += `  <line x1="${leftMargin}" y1="${t.y}" x2="${rightMargin}" y2="${t.y}" stroke="${t.stroke}" stroke-width="0.75" stroke-dasharray="3 3" />\n`;
            if (t.label) {
                // Threshold labels anchored in right margin gutter OUTSIDE the plot spine
                svg += `  <text x="${rightMargin + 8}" y="${t.y + 3}" class="threshold-label" fill="${t.stroke}" text-anchor="start">${t.label}</text>\n`;
            }
        } else {
            svg += `  <line x1="${leftMargin}" y1="${t.y}" x2="${rightMargin}" y2="${t.y}" class="academic-grid" />\n`;
        }
        svg += `  <line x1="${leftMargin}" y1="${t.y}" x2="${leftMargin + 4.5}" y2="${t.y}" class="tick-line" />\n`;
        svg += `  <line x1="${rightMargin - 4.5}" y1="${t.y}" x2="${rightMargin}" y2="${t.y}" class="tick-line" />\n`;
        svg += `  <text x="${leftMargin - 6}" y="${t.y + 3}" class="tick-label" text-anchor="end">${t.val}</text>\n`;
    }

    const numTrans = transitions.length;
    if (numTrans > 0) {
        const slotWidth = plotWidth / numTrans;
        const barWidth = Math.min(32, slotWidth * 0.58);

        for (let j = 0; j < numTrans; j++) {
            const t = transitions[j];
            const xCenter = leftMargin + (j + 0.5) * slotWidth;
            const xLeft = xCenter - barWidth / 2;

            const chromComp =
                t.chromaticComponent ??
                Number((Math.min(100, (t.deltaE / 80) * 100) * 0.45).toFixed(1));
            const lumComp = t.lumComponent ?? Number(((t.deltaLum / 255) * 100 * 0.35).toFixed(1));
            const aspComp =
                t.aspectComponent ??
                Number((Math.min(100, ((t.deltaAspect || 0) / 1.0) * 100) * 0.2).toFixed(1));
            const total = t.totalCost ?? Number((chromComp + lumComp + aspComp).toFixed(1));

            const hChrom = (chromComp / 100) * plotHeight;
            const hLum = (lumComp / 100) * plotHeight;
            const hAsp = (aspComp / 100) * plotHeight;
            const hTotal = (total / 100) * plotHeight;

            let currentY = plotBottom;

            if (hChrom > 0) {
                currentY -= hChrom;
                svg += `  <rect x="${xLeft}" y="${currentY}" width="${barWidth}" height="${hChrom}" fill="#2b5c8f" stroke="#0f172a" stroke-width="0.5" />\n`;
            }

            if (hLum > 0) {
                currentY -= hLum;
                svg += `  <rect x="${xLeft}" y="${currentY}" width="${barWidth}" height="${hLum}" fill="#c25925" stroke="#0f172a" stroke-width="0.5" />\n`;
            }

            if (hAsp > 0) {
                currentY -= hAsp;
                svg += `  <rect x="${xLeft}" y="${currentY}" width="${barWidth}" height="${hAsp}" fill="#2a7e58" stroke="#0f172a" stroke-width="0.5" />\n`;
            }

            const topY = Math.max(plotTop - 3, plotBottom - hTotal - 4);
            svg += `  <text x="${xCenter}" y="${topY}" class="tick-label" font-weight="600" text-anchor="middle">${total.toFixed(1)}</text>\n`;

            svg += `  <line x1="${xCenter}" y1="${plotBottom - 4.5}" x2="${xCenter}" y2="${plotBottom}" class="tick-line" />\n`;
            svg += `  <text x="${xCenter}" y="${plotBottom + 14}" class="tick-label" text-anchor="middle">${j + 1}→${j + 2}</text>\n`;
        }
    }

    // Publication-grade IEEE Inset Legend in upper-right quadrant inside plot spine
    const legendX = rightMargin - 148;
    const legendY = plotTop + 8;
    svg += `  <g transform="translate(${legendX}, ${legendY})">\n`;
    svg += `    <rect x="0" y="0" width="140" height="52" fill="#ffffff" fill-opacity="0.92" stroke="#cbd5e1" stroke-width="0.6" rx="2" />\n`;
    svg += `    <rect x="8" y="7" width="7" height="7" fill="#2b5c8f" stroke="#0f172a" stroke-width="0.5" />\n`;
    svg += `    <text x="20" y="13.5" class="legend-text">Chromatic ΔE (45%)</text>\n`;
    svg += `    <rect x="8" y="22" width="7" height="7" fill="#c25925" stroke="#0f172a" stroke-width="0.5" />\n`;
    svg += `    <text x="20" y="28.5" class="legend-text">Luminance ΔLum (35%)</text>\n`;
    svg += `    <rect x="8" y="37" width="7" height="7" fill="#2a7e58" stroke="#0f172a" stroke-width="0.5" />\n`;
    svg += `    <text x="20" y="43.5" class="legend-text">Aspect Shift (20%)</text>\n`;
    svg += `  </g>\n\n`;

    svg += `  <text x="${leftMargin + plotWidth / 2}" y="${plotBottom + 34}" class="axis-title" text-anchor="middle">Pairwise Transition (i → i+1)</text>\n`;
    svg += `</svg>\n`;
    return svg;
}

/**
 * Generates standalone Figure 3: CIELAB Colorimetric Spectrum & Metric Aspect Cadence SVG (IEEE Publication Standard).
 * @param {object} params
 * @param {object} [params.gallery]
 * @param {Array} [params.images]
 * @returns {string} Standalone SVG XML string
 */
export function generateColorimetrySpectrumSvg({ gallery = {}, images = [] }) {
    const width = 880;
    const height = 210;
    const leftMargin = 68;
    const rightMargin = 845;
    const plotWidth = rightMargin - leftMargin; // 777px
    const boxTop = 22;
    const boxBottom = 192;
    const boxHeight = boxBottom - boxTop; // 170px

    let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="100%" height="100%">\n`;
    svg += `  <style>\n`;
    svg += `    .paper-bg { fill: #ffffff; }\n`;
    svg += `    .spine-box { fill: #ffffff; stroke: #0f172a; stroke-width: 0.85; }\n`;
    svg += `    .tick-line { stroke: #0f172a; stroke-width: 0.85; }\n`;
    svg += `    .fig-heading { fill: #0f172a; font-family: "Times New Roman", Times, "Nimbus Roman No9 L", "Liberation Serif", serif; font-size: 12.5px; font-weight: bold; letter-spacing: 0.2px; }\n`;
    svg += `    .axis-title { fill: #334155; font-family: "Times New Roman", Times, "Nimbus Roman No9 L", "Liberation Serif", serif; font-size: 10.5px; font-style: italic; }\n`;
    svg += `    .tick-label { fill: #334155; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; font-size: 9px; font-variant-numeric: tabular-nums; }\n`;
    svg += `    .threshold-label { fill: #475569; font-family: "Times New Roman", Times, "Nimbus Roman No9 L", "Liberation Serif", serif; font-size: 8.5px; font-style: italic; }\n`;
    svg += `  </style>\n\n`;

    svg += `  <rect width="${width}" height="${height}" class="paper-bg" />\n\n`;
    svg += `  <text x="${leftMargin}" y="17" class="fig-heading">Figure 3: Colorimetric CIELAB Spectrum (L*, a*, b*) and Metric Aspect Cadence</text>\n`;
    svg += `  <rect x="${leftMargin}" y="${boxTop}" width="${plotWidth}" height="${boxHeight}" class="spine-box" />\n`;
    svg += `  <text transform="translate(24, ${boxTop + boxHeight / 2}) rotate(-90)" class="axis-title" text-anchor="middle">CIELAB &amp; Aspect</text>\n`;

    const numImages = images.length;
    if (numImages > 0) {
        const slotWidth = plotWidth / numImages;
        const swatchWidth = Math.max(16, slotWidth - 6);
        const swatchY = boxTop + 6;
        // Substantial, elongated color bars filling ~54% of plot height
        const swatchHeight = 92;

        // If slot width is compact (< 55px), display header legend for metric rows and breath abbreviations
        if (slotWidth < 55) {
            svg += `  <text x="${rightMargin}" y="17" class="threshold-label" text-anchor="end">Breath: [INH] Inhale · [EXH] Exhale · [GRD] Ground</text>\n`;
        }

        // Left margin row headers for clear metric identification
        svg += `  <text x="${leftMargin - 6}" y="${swatchY + swatchHeight + 13}" class="threshold-label" font-weight="bold" text-anchor="end">L*</text>\n`;
        svg += `  <text x="${leftMargin - 6}" y="${swatchY + swatchHeight + 25}" class="threshold-label" text-anchor="end">a*,b*</text>\n`;
        svg += `  <text x="${leftMargin - 6}" y="${swatchY + swatchHeight + 38}" class="threshold-label" text-anchor="end">Asp</text>\n`;
        svg += `  <text x="${leftMargin - 6}" y="${swatchY + swatchHeight + 50}" class="threshold-label" text-anchor="end">Tag</text>\n`;

        for (let i = 0; i < numImages; i++) {
            const img = images[i];
            const a = img?.analysis;
            const xLeft = leftMargin + i * slotWidth + (slotWidth - swatchWidth) / 2;
            const xCenter = xLeft + swatchWidth / 2;

            const rgb = a?.avgRGB || [128, 128, 128];
            const hexColor = `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
            const rawLabL =
                a?.lab?.L ?? (a?.luminance ? Number(((a.luminance / 255) * 100).toFixed(1)) : 50);
            const labA = a?.lab?.a ?? 0;
            const labB = a?.lab?.b ?? 0;
            const orient = (a?.orientation || 'land').substring(0, 1).toUpperCase();
            const aspect = a?.aspectRatio || '1.50';

            // Deterministic adaptive label formatting mathematically scaled to slot width:
            // Glyphs are ~5.2px wide; slotWidth must guarantee at least 4px padding between labels.
            let labLStr = `L*=${rawLabL.toFixed(1)}`;
            if (slotWidth < 55 && slotWidth >= 44) {
                labLStr = `L*=${Math.round(rawLabL)}`;
            } else if (slotWidth < 44) {
                labLStr = `${Math.round(rawLabL)}`;
            }

            let abStr = `(${labA.toFixed(1)}, ${labB.toFixed(1)})`;
            if (slotWidth < 65 && slotWidth >= 34) {
                abStr = `(${Math.round(labA)}, ${Math.round(labB)})`;
            } else if (slotWidth < 34) {
                abStr = `${Math.round(labA)},${Math.round(labB)}`;
            }

            let aspectStr = `${aspect} ${orient}`;
            if (slotWidth < 34) {
                aspectStr = `${aspect}`;
            }

            let breathTag = '[GROUNDING]';
            let breathColor = '#475569';
            if (a?.breathType === 'Inhalation') {
                breathTag = slotWidth >= 55 ? '[INHALATION]' : slotWidth >= 28 ? '[INH]' : '[I]';
                breathColor = '#1d4ed8';
            } else if (a?.breathType === 'Exhalation') {
                breathTag = slotWidth >= 55 ? '[EXHALATION]' : slotWidth >= 28 ? '[EXH]' : '[E]';
                breathColor = '#b91c1c';
            } else {
                breathTag = slotWidth >= 55 ? '[GROUNDING]' : slotWidth >= 28 ? '[GRD]' : '[G]';
                breathColor = '#475569';
            }

            svg += `  <rect x="${xLeft}" y="${swatchY}" width="${swatchWidth}" height="${swatchHeight}" fill="${hexColor}" stroke="#0f172a" stroke-width="0.75" rx="1.5" />\n`;

            const textFill = rawLabL > 55 ? '#0f172a' : '#ffffff';
            svg += `  <text x="${xCenter}" y="${swatchY + 16}" fill="${textFill}" font-family="-apple-system, sans-serif" font-size="10px" font-weight="bold" text-anchor="middle">${i + 1}</text>\n`;

            svg += `  <text x="${xCenter}" y="${swatchY + swatchHeight + 13}" class="tick-label" font-weight="600" text-anchor="middle">${labLStr}</text>\n`;
            svg += `  <text x="${xCenter}" y="${swatchY + swatchHeight + 25}" class="threshold-label" text-anchor="middle">${abStr}</text>\n`;
            svg += `  <text x="${xCenter}" y="${swatchY + swatchHeight + 38}" class="tick-label" font-weight="bold" text-anchor="middle">${aspectStr}</text>\n`;
            svg += `  <text x="${xCenter}" y="${swatchY + swatchHeight + 50}" class="threshold-label" fill="${breathColor}" font-size="7.5px" font-weight="bold" text-anchor="middle">${breathTag}</text>\n`;

            svg += `  <line x1="${xCenter}" y1="${boxBottom - 4.5}" x2="${xCenter}" y2="${boxBottom}" class="tick-line" />\n`;
        }
    }

    svg += `</svg>\n`;
    return svg;
}

/**
 * Generates an academic publication-standard (arXiv / IEEE style) composite SVG visualization.
 * Uses clean white paper background, classical serif and scientific typography,
 * precision inward tick spines, muted publication palettes, and academic captions.
 *
 * @param {object} params
 * @param {object} [params.gallery]
 * @param {Array} [params.images]
 * @param {Array} [params.transitions]
 * @param {object} [params.respiratory]
 * @param {Array} [params.quotes]
 * @param {string} [params.archetype]
 * @returns {string} Standalone SVG XML string
 */
export function generateSequenceChartsSvg({
    gallery = {},
    images = [],
    transitions = [],
    respiratory = {},
    quotes = [],
    archetype = 'Polyphonic Street Symphony / Lyrical Arc',
}) {
    const totalHamiltonianEnergy = transitions.reduce((sum, t) => sum + (t.totalCost || 0), 0);
    const avgCost =
        transitions.length > 0 ? (totalHamiltonianEnergy / transitions.length).toFixed(1) : '0.0';
    const rhythmScore = respiratory.rhythmScore ?? 100;
    const galleryTitle = gallery.title || gallery.pageId || 'GALLERY';

    const width = 940;
    const height = 700;
    const leftMargin = 72;

    let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="100%" height="100%">\n`;
    svg += `  <style>\n`;
    svg += `    .paper-bg { fill: #ffffff; }\n`;
    svg += `    .fig-heading { fill: #111827; font-family: "Times New Roman", Times, "Nimbus Roman", "DejaVu Serif", serif; font-size: 13px; font-weight: bold; }\n`;
    svg += `    .fig-meta { fill: #4b5563; font-family: "Times New Roman", Times, "Nimbus Roman", "DejaVu Serif", serif; font-size: 10px; font-style: italic; }\n`;
    svg += `    .caption-text { fill: #374151; font-family: "Times New Roman", Times, "Nimbus Roman", "DejaVu Serif", serif; font-size: 9.5px; }\n`;
    svg += `  </style>\n\n`;

    svg += `  <rect width="${width}" height="${height}" class="paper-bg" />\n\n`;
    svg += `  <text x="${leftMargin}" y="24" class="fig-heading">Figure 1: Quantitative Sequence Dynamics &amp; Photometric Trajectories (${escapeXml(galleryTitle)})</text>\n`;
    svg += `  <text x="${leftMargin}" y="38" class="fig-meta">Archetype: ${escapeXml(archetype)} | Hamiltonian Sequence Energy: ${totalHamiltonianEnergy.toFixed(1)} (Mean: ${avgCost}) | Respiratory Pacing: ${rhythmScore}/100</text>\n\n`;

    // Embed sub-figures
    const f1 = generateLuminanceWaveformSvg({ gallery, images, respiratory, quotes });
    const f2 = generateTransitionTensionSvg({ gallery, transitions });
    const f3 = generateColorimetrySpectrumSvg({ gallery, images });

    // Extract SVG guts and translate
    const extractGuts = (s) =>
        s
            .replace(/.*<style>[\s\S]*?<\/style>/, '')
            .replace(/<\/?svg.*?>/g, '')
            .trim();

    svg += `  <g transform="translate(-10, 40) scale(0.95)">${extractGuts(f1)}</g>\n`;
    svg += `  <g transform="translate(-10, 220) scale(0.95)">${extractGuts(f2)}</g>\n`;
    svg += `  <g transform="translate(-10, 420) scale(0.95)">${extractGuts(f3)}</g>\n`;

    svg += `  <text x="${leftMargin}" y="675" class="caption-text"><tspan font-weight="bold">Figure 1.</tspan> Quantitative sequence dynamics and photometric transition models. <tspan font-weight="bold">(a)</tspan> Luminance waveform with Inhalation (L* ≥ 135) and</text>\n`;
    svg += `  <text x="${leftMargin}" y="689" class="caption-text">Exhalation (L* ≤ 75) bounds; <tspan font-weight="bold">(b)</tspan> Pairwise transition energy decomposed into chromatic, luminance, and aspect components; <tspan font-weight="bold">(c)</tspan> Primary colorimetric progression.</text>\n`;

    svg += `</svg>\n`;
    return svg;
}
