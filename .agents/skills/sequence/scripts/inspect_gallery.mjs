#!/usr/bin/env node

/**
 * Frontier Gallery Sequence Inspection & Curation CLI
 * Master module re-exporting colorimetry metrics, markdown parser, IEEE charts,
 * and markdown report generators.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Re-export all sub-modules for seamless backward compatibility
export * from './metrics.mjs';
export * from './parser.mjs';
export * from './charts.mjs';
export * from './report.mjs';

import { resolveGalleryPath, inspectGallery, REPO_ROOT } from './parser.mjs';
import { generateVisualReport } from './report.mjs';

/**
 * Command-line runner for interactive terminal output and report generation.
 */
async function main() {
    const args = process.argv.slice(2);
    const hasHelp = args.includes('--help') || args.includes('-h');
    const pageArg = args.find((a) => !a.startsWith('--'));

    if (hasHelp || !pageArg) {
        console.log(`
Usage: node inspect_gallery.mjs <pageId> [options]

Arguments:
  <pageId>                 Gallery identifier (e.g. "p5", "5", "assets/img/p5/index.md")

Options:
  --json                   Output structured JSON with complete colorimetry and metrics
  --report [outputPath]   Generate visual Markdown report embedding photographs
  --commentary <path>      JSON file mapping filenames to custom curatorial commentary
  --help, -h               Show this help message
`);
        process.exit(hasHelp ? 0 : 1);
    }

    const jsonOutput = args.includes('--json');
    const reportOutput = args.includes('--report');
    const reportPathIndex = args.indexOf('--report') + 1;
    const customReportPath =
        reportPathIndex > 0 && args[reportPathIndex] && !args[reportPathIndex].startsWith('--')
            ? args[reportPathIndex]
            : null;

    const commIdx = args.indexOf('--commentary') + 1;
    let commentaryMap = {};
    if (commIdx > 0 && args[commIdx] && !args[commIdx].startsWith('--')) {
        const commPath = path.resolve(REPO_ROOT, args[commIdx]);
        if (fs.existsSync(commPath)) {
            try {
                commentaryMap = JSON.parse(fs.readFileSync(commPath, 'utf8'));
            } catch (err) {
                console.error(`Failed to parse commentary file: ${commPath}`, err);
            }
        }
    }

    const { pageId, dir } = resolveGalleryPath(pageArg);
    if (!fs.existsSync(dir)) {
        console.error(`Gallery directory not found: ${dir}`);
        process.exit(1);
    }

    if (reportOutput) {
        const result = await generateVisualReport(pageId, {
            outputPath: customReportPath || undefined,
            commentaryMap,
        });
        console.log(`\n[SUCCESS] Generated Visual Sequence Report for ${pageId.toUpperCase()}:`);
        console.log(`   ${result.outputPath}\n`);
        return;
    }

    const outputData = await inspectGallery(pageId);
    const {
        images: sequencedImages,
        quotes,
        outtakes,
        transitions,
        respiratoryRhythm: respiratory,
    } = outputData;

    if (jsonOutput) {
        console.log(JSON.stringify(outputData, null, 2));
        return;
    }

    // Formatted CLI report
    console.log(`\n======================================================================`);
    console.log(
        `  FRONTIER GALLERY SEQUENCE INSPECTION: ${pageId.toUpperCase()} - "${outputData.gallery.title}"`
    );
    console.log(`======================================================================`);
    console.log(`Directory:   ${outputData.gallery.directory}`);
    console.log(`Markdown:    ${outputData.gallery.markdownPath}`);
    console.log(
        `Images:      ${outputData.gallery.totalImages} active | ${outtakes.length} outtakes`
    );
    console.log(`Quotes:      ${quotes.length} interludes`);
    console.log(
        `Respiratory: Rhythm Score: ${respiratory.rhythmScore}/100 (${respiratory.anomalies.length} cadence warnings)`
    );
    console.log(`----------------------------------------------------------------------\n`);

    console.log(`CURRENT SEQUENCE ORDER, CIELAB TONALITY & RESPIRATORY BREATH:`);
    for (let i = 0; i < sequencedImages.length; i++) {
        const img = sequencedImages[i];
        const a = img.analysis;
        if (!img.exists) {
            console.log(
                ` [${String(img.sequenceOrder).padStart(2, ' ')}] [MISSING]: ${img.filename}`
            );
            continue;
        }

        const orientBadge = a.orientation.toUpperCase().padEnd(9, ' ');
        const dimStr = `${a.width}x${a.height} (${a.aspectRatio})`.padEnd(17, ' ');
        const breathBadge = `[${a.breathType}]`.padEnd(13, ' ');
        const lumStr = `Lum: ${String(a.luminance).padStart(3, ' ')}`.padEnd(9, ' ');
        const labStr = `Lab: (${a.lab.L}, ${a.lab.a}, ${a.lab.b})`.padEnd(25, ' ');

        console.log(
            ` [${String(img.sequenceOrder).padStart(2, ' ')}] ${img.filename.padEnd(28, ' ')} | ${orientBadge} | ${dimStr} | ${breathBadge} | ${lumStr} | ${labStr}`
        );

        if (img.caption) {
            console.log(`      ↳ Caption: ${img.caption}`);
        }

        // Print transition delta to next image
        if (i < transitions.length) {
            const t = transitions[i];
            console.log(
                `      ↳ Transition to #${i + 2}: ΔE: ${t.deltaE} (Color) | ΔLum: ${t.deltaLum} | Cost: ${t.totalCost}`
            );
        }

        // Print quotes that appear after this image
        const matchingQuotes = quotes.filter((q) => q.afterImageIndex === img.sequenceOrder);
        for (const q of matchingQuotes) {
            const preview = q.content.replace(/\n/g, ' / ').slice(0, 75);
            console.log(`      [Caesura Interlude]: "${preview}..."`);
        }
    }

    if (respiratory.anomalies.length > 0) {
        console.log(`\n----------------------------------------------------------------------`);
        console.log(`RESPIRATORY RHYTHM WARNINGS:`);
        for (const anom of respiratory.anomalies) {
            console.log(
                ` [WARNING] [Frame #${anom.index} - ${anom.filename}] ${anom.type}: ${anom.detail}`
            );
        }
    }

    if (outtakes.length > 0) {
        console.log(`\n----------------------------------------------------------------------`);
        console.log(
            `UNSEQUENCED CANDIDATES & AUTOMATED INSERTION SIMULATION (${outtakes.length}):`
        );
        for (const out of outtakes) {
            const a = out.analysis;
            if (a) {
                console.log(
                    ` - ${out.filename.padEnd(28, ' ')} | ${a.orientation.toUpperCase().padEnd(9, ' ')} | ${String(a.width + 'x' + a.height).padEnd(11, ' ')} | Lum: ${String(a.luminance).padStart(3, ' ')} (${a.breathType})`
                );
            } else {
                console.log(` - ${out.filename}`);
            }

            const evalMatch = outputData.candidateEvaluations?.find(
                (e) => e.candidate === out.filename
            );
            if (evalMatch && evalMatch.bestSlot) {
                const b = evalMatch.bestSlot;
                const prev = b.prevNeighbor
                    ? `#${b.slotPosition - 1} (${b.prevNeighbor})`
                    : '[OPENING]';
                const next = b.nextNeighbor ? `#${b.slotPosition} (${b.nextNeighbor})` : '[FINALE]';
                console.log(
                    `      ↳ Optimal Slot: Position #${b.slotPosition} (between ${prev} and ${next})`
                );
                console.log(
                    `      ↳ Transition Friction: Step Cost ${b.localStepCost} | ΔTotal: ${b.costDelta > 0 ? '+' : ''}${b.costDelta} | Pacing Score: ${b.rhythmScore}/100`
                );
                console.log(`      ↳ Recommendation: ${evalMatch.curatorialRationale}`);
            }
        }
    }
    console.log(`\n======================================================================\n`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    main().catch((err) => {
        console.error('Error inspecting gallery:', err);
        process.exit(1);
    });
}
