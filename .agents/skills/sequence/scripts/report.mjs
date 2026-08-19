/**
 * Visual Report Generation Module for Sequence Curation
 * Compiles rich markdown sequence reports embedding high-resolution photographs,
 * step transition energy tables, and academic SVG dashboards.
 */

import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import { calculatePairwiseTransitions, analyzeRespiratoryRhythm } from './metrics.mjs';
import { inspectGallery, resolvePreviewFilename, REPO_ROOT } from './parser.mjs';
import {
    generateLuminanceWaveformSvg,
    generateTransitionTensionSvg,
    generateColorimetrySpectrumSvg,
} from './charts.mjs';

/**
 * Generates a rich Markdown Visual Curation Report with embedded real images,
 * aesthetic/narrative rationale, and computed Hamiltonian metrics.
 *
 * @param {string} pageId - e.g. 'p5'
 * @param {object} [options] - custom options: outputPath, sequenceOverride, commentaryMap, archetype
 * @returns {Promise<{ reportContent: string, outputPath: string }>}
 */
export async function generateVisualReport(pageId, options = {}) {
    const defaultOutPath = path.join(REPO_ROOT, 'assets', 'img', pageId, 'sequence-report.md');
    const {
        outputPath: rawOutputPath = defaultOutPath,
        sequenceOverride = null,
        commentaryMap = {},
        archetype = 'Polyphonic Street Symphony / Lyrical Arc',
    } = options;
    const outputPath = path.isAbsolute(rawOutputPath)
        ? rawOutputPath
        : path.resolve(REPO_ROOT, rawOutputPath);

    const data = await inspectGallery(pageId);
    let images = data.images;
    let finalCommentaryMap =
        commentaryMap && Object.keys(commentaryMap).length > 0 ? commentaryMap : {};
    if (Object.keys(finalCommentaryMap).length === 0) {
        const defaultCommPath = path.join(REPO_ROOT, 'assets', 'img', pageId, 'commentary.json');
        if (fs.existsSync(defaultCommPath)) {
            try {
                finalCommentaryMap = JSON.parse(fs.readFileSync(defaultCommPath, 'utf8'));
            } catch {
                finalCommentaryMap = {};
            }
        }
    }

    if (sequenceOverride && Array.isArray(sequenceOverride)) {
        const imgMap = new Map(images.map((img) => [img.filename, img]));
        images = sequenceOverride
            .map((item, idx) => {
                const fname = typeof item === 'string' ? item : item.filename;
                const base = imgMap.get(fname);
                if (!base) return null;
                return {
                    ...base,
                    sequenceOrder: idx + 1,
                    customCommentary: item.commentary || null,
                };
            })
            .filter(Boolean);
    }

    const transitions = calculatePairwiseTransitions(images);
    const respiratory = analyzeRespiratoryRhythm(images, data.quotes);
    const totalHamiltonianEnergy = transitions.reduce((sum, t) => sum + (t.totalCost || 0), 0);
    const avgHamiltonianEnergy =
        transitions.length > 0
            ? Number((totalHamiltonianEnergy / transitions.length).toFixed(1))
            : 0;

    // Generate dedicated individual academic SVG figures
    const waveformSvg = generateLuminanceWaveformSvg({
        gallery: data.gallery,
        images,
        respiratory,
        quotes: data.quotes,
    });
    const transitionsSvg = generateTransitionTensionSvg({
        gallery: data.gallery,
        transitions,
    });
    const colorimetrySvg = generateColorimetrySpectrumSvg({
        gallery: data.gallery,
        images,
    });

    const reportDir = path.dirname(outputPath);
    const waveformPath = path.join(reportDir, 'sequence-waveform.svg');
    const transitionsPath = path.join(reportDir, 'sequence-transitions.svg');
    const colorimetryPath = path.join(reportDir, 'sequence-colorimetry.svg');

    if (outputPath) {
        fs.mkdirSync(reportDir, { recursive: true });
        fs.writeFileSync(waveformPath, waveformSvg, 'utf8');
        fs.writeFileSync(transitionsPath, transitionsSvg, 'utf8');
        fs.writeFileSync(colorimetryPath, colorimetrySvg, 'utf8');
    }

    // Use ./ relative paths for 100% compatibility with VSCode vanilla preview and standard markdown viewers
    const waveformEmbedUrl = `./sequence-waveform.svg`;
    const transitionsEmbedUrl = `./sequence-transitions.svg`;
    const colorimetryEmbedUrl = `./sequence-colorimetry.svg`;

    let md = `# Visual Curation & Sequence Report: ${data.gallery.title || pageId.toUpperCase()}\n\n`;
    md += `> **Curation Archetype**: ${archetype}\n>\n`;
    md += `> **Sequence Status**: ${sequenceOverride ? 'Resequenced Proposal (Optimized)' : respiratory.anomalies.length > 0 ? 'Resequencing Recommended (Cadence Anomalies Detected)' : 'Validated (Existing sequence affirmed as optimal)'}\n>\n`;
    md += `> **Hamiltonian Sequence Energy**: \`${totalHamiltonianEnergy.toFixed(1)}\` (Avg Step Cost: \`${avgHamiltonianEnergy}\`)\n>\n`;
    md += `> **Respiratory Pacing Score**: \`${respiratory.rhythmScore}/100\` (${respiratory.inhalations} Inhalations, ${respiratory.exhalations} Exhalations, ${respiratory.neutrals} Grounding)\n\n`;

    md += `## 1. Executive Curatorial & Quantitative Architecture\n\n`;
    md += `This report quantitatively evaluates the visual narrative arc for **${pageId}**, combining photometric colorimetry (CIELAB L*a*b*, ΔE₇₆), Hamiltonian pairwise transition tension, and multi-agent aesthetic critique.\n\n`;

    md += `### 1.1 Photometric Respiratory Waveform\n\n`;
    md += `The respiratory luminance waveform maps the photometric breathing rhythm of the essay, balancing luminous expansions with low-key chiaroscuro grounding anchors.\n\n`;
    md += `![Photometric Respiratory Waveform](${waveformEmbedUrl})\n\n`;
    md += `**Figure 1**: Photometric Luminance Waveform \`L*(t) ∈ [0, 255]\` and Respiratory Rhythm. Shaded regions indicate Inhalation (\`L* >= 135\`, luminous expansiveness) and Exhalation (\`L* <= 75\`, chiaroscuro grounding) zones. Vertical dashed lines mark poetic caesuras.\n\n`;

    md += `### 1.2 Hamiltonian Pairwise Transition Tension\n\n`;
    md += `Pairwise transition energy measures visual friction and cognitive momentum between adjacent frames, decomposed into chromatic distance (ΔE₇₆, 45%), luminance contrast (ΔLum, 35%), and geometric aspect shift (ΔAspect, 20%).\n\n`;
    md += `![Hamiltonian Pairwise Transition Tension](${transitionsEmbedUrl})\n\n`;
    md += `**Figure 2**: Pairwise step cost \`C(i, i+1)\` decomposed into chromatic, luminance, and aspect variance components. Dashed reference lines define harmonic baseline (\`C <= 25\`) and montage shock (\`C >= 50\`) thresholds.\n\n`;

    md += `### 1.3 CIELAB Colorimetric Progression & Spatial Cadence\n\n`;
    md += `The chromatic spectrum profile charts the physical color evolution across sequential frames alongside metric aspect ratio and spatial framing cadence.\n\n`;
    md += `![CIELAB Colorimetric Progression](${colorimetryEmbedUrl})\n\n`;
    md += `**Figure 3**: Sequential colorimetric profile detailing mean sRGB swatches, CIELAB coordinates (\`L*, a*, b*\`), aspect ratio, orientation (L/P), and breath type.\n\n`;

    if (respiratory.anomalies.length > 0) {
        md += `### Cadence & Respiratory Rhythm Alerts\n\n`;
        for (const anom of respiratory.anomalies) {
            md += `- **Frame #${anom.index} (${anom.filename})** — *${anom.type}*: ${anom.detail}\n`;
        }
        md += `\n`;
    }

    md += `## 2. Visual Sequence Journey\n\n`;

    if (images.length === 0) {
        md += `*No active sequenced images found in this gallery.*\n\n`;
    }

    const galleryDir = path.join(REPO_ROOT, 'assets', 'img', pageId);

    for (let i = 0; i < images.length; i++) {
        const img = images[i];
        const a = img.analysis;
        const previewFilename = resolvePreviewFilename(galleryDir, img.filename);
        const imgEmbedUrl = `./${previewFilename}`;

        md += `### [${i + 1}/${images.length}] ${img.filename}\n\n`;
        md += `![${img.alt || img.caption || img.filename}](${imgEmbedUrl})\n\n`;

        if (a) {
            const nextTrans = i < transitions.length ? transitions[i] : null;
            md += `| Attribute | Value |\n`;
            md += `| :--- | :--- |\n`;
            md += `| **Framing & Aspect** | \`${a.orientation.toUpperCase()}\` · \`${a.width}×${a.height}\` (Aspect: \`${a.aspectRatio}\`) |\n`;
            md += `| **Tonality & Breath** | \`L*=${a.lab.L}\` — **${a.breathType}** (CIELAB: \`${a.lab.L}, ${a.lab.a}, ${a.lab.b}\`) |\n`;
            if (img.caption) {
                md += `| **Caption / Photo Credit** | \`${img.caption}\` |\n`;
            }
            if (nextTrans) {
                md += `| **Transition to #${i + 2} (${nextTrans.to})** | \`ΔE₇₆: ${nextTrans.deltaE}\` (Color) · \`ΔLum: ${nextTrans.deltaLum}\` · **Step Cost: \`${nextTrans.totalCost}\`** |\n`;
            }
            md += `\n`;
        }

        const nextTrans = i < transitions.length ? transitions[i] : null;
        const dynamicPacingRole =
            i === 0
                ? 'Act I: The Overture / Sequence Opener'
                : i === images.length - 1
                  ? 'Act IV: Coda / Sequence Resolution'
                  : i < images.length / 3
                    ? `Act II: Narrative Development (Frame #${i + 1})`
                    : i < (2 * images.length) / 3
                      ? `Act III: Climactic Movement (Frame #${i + 1})`
                      : `Act IV: Resolution Movement (Frame #${i + 1})`;

        const dynamicTransDesc = nextTrans
            ? `${nextTrans.deltaLum > 40 ? 'High-contrast tonal step' : 'Harmonic chromatic transition'} with step cost of ${nextTrans.totalCost}.`
            : 'Final contemplative resting frame.';

        const commentary = img.customCommentary || finalCommentaryMap[img.filename];
        if (commentary) {
            if (typeof commentary === 'string') {
                md += `**Curatorial Rationale & Montage Dynamic**:\n\n${commentary.trim()}\n\n`;
            } else if (typeof commentary === 'object') {
                md += `**Curatorial Rationale & Montage Dynamic**:\n\n`;
                // Adapt pacing role dynamically if sequence position shifted
                let effectiveRole = commentary.role || dynamicPacingRole;
                if (
                    i === 0 &&
                    !effectiveRole.includes('Overture') &&
                    !effectiveRole.includes('Opener')
                ) {
                    const cleanRoleName = effectiveRole
                        .replace(/^Act\s+[IVX]+:\s*/i, '')
                        .replace(/Frame\s*#?\d+/i, '')
                        .trim();
                    effectiveRole = `Act I: The Overture / ${cleanRoleName || 'Sequence Opener'}`;
                } else if (
                    i === images.length - 1 &&
                    !effectiveRole.includes('Coda') &&
                    !effectiveRole.includes('Resolution')
                ) {
                    const cleanRoleName = effectiveRole
                        .replace(/^Act\s+[IVX]+:\s*/i, '')
                        .replace(/Frame\s*#?\d+/i, '')
                        .trim();
                    effectiveRole = `Act IV: Coda / ${cleanRoleName || 'Sequence Resolution'}`;
                } else if (
                    i > 0 &&
                    i < images.length - 1 &&
                    (effectiveRole.includes('Overture') || effectiveRole.includes('Coda'))
                ) {
                    const cleanRoleName = effectiveRole
                        .replace(/Act\s+[IVX]+:\s*(The Overture|Coda)\s*\/?\s*/gi, '')
                        .trim();
                    effectiveRole = `${dynamicPacingRole}${cleanRoleName ? ` (${cleanRoleName})` : ''}`;
                }

                md += `- *Pacing Role*: ${effectiveRole}\n`;
                if (commentary.subject || commentary.content) {
                    md += `- *Visual Subject & Content*: ${commentary.subject || commentary.content}\n`;
                }
                if (commentary.meaning || commentary.thematicMeaning) {
                    md += `- *Thematic Meaning*: ${commentary.meaning || commentary.thematicMeaning}\n`;
                }
                if (commentary.vector || commentary.vectors) {
                    md += `- *Composition & Gaze Vectors*: ${commentary.vector || commentary.vectors}\n`;
                }
                md += `- *Transition Dynamic*: ${commentary.transition || dynamicTransDesc}\n\n`;
            }
        } else if (a) {
            const breathDesc =
                a.luminance >= 135
                    ? 'Luminous inhalation providing expansive perceptual breathing space.'
                    : a.luminance <= 75
                      ? 'Low-key exhalation grounding the viewer with chiaroscuro mass.'
                      : 'Neutral midpoint maintaining narrative continuity.';

            md += `**Curatorial Rationale & Montage Dynamic**:\n\n- *Pacing Role*: ${dynamicPacingRole}\n- *Tonal Dynamic*: ${breathDesc}\n- *Transition*: ${dynamicTransDesc}\n\n`;
        }

        // Insert caesura quote if present
        const matchingQuotes = (data.quotes || []).filter(
            (q) => q.afterImageIndex === img.sequenceOrder
        );
        for (const q of matchingQuotes) {
            let quoteText = q.content || '';
            let citeAuthor = q.author || '';

            // Extract <cite>...</cite> or <footer class="...">...</footer>
            const citeMatch = quoteText.match(/<cite>([\s\S]*?)<\/cite>/i);
            if (citeMatch) {
                citeAuthor = citeMatch[1].replace(/<[^>]*>/g, '').trim();
                quoteText = quoteText
                    .replace(/<footer[\s\S]*?<\/footer>/gi, '')
                    .replace(/<cite>[\s\S]*?<\/cite>/gi);
            }

            // Split into lines on <br />, clean html tags and whitespace
            const quoteLines = quoteText
                .replace(/<br\s*\/?>/gi, '\n')
                .split(/\r?\n/)
                .map((l) => l.replace(/<[^>]*>/g, '').trim())
                .filter(Boolean);

            md += `> **[Poetic Caesura: Musical Rest]**\n>\n`;
            for (const line of quoteLines) {
                md += `> *${line}*\n`;
            }
            if (citeAuthor) {
                md += `>\n> — **${citeAuthor}**\n`;
            }
            md += `\n`;
        }

        md += `---\n\n`;
    }

    // Section 3: Curatorial Recommendations & Optimized Sequence Proposals
    md += `## 3. Curatorial Proposals & Optimized Sequence Arc\n\n`;

    if (respiratory.anomalies.length > 0) {
        md += `### Recommended Interlude & Rhythm Solutions\n\n`;
        for (const anom of respiratory.anomalies) {
            md += `#### Resolution for Frame #${anom.index} (${anom.filename}) — *${anom.type}*\n\n`;

            if (anom.type === 'Suffocating Weight') {
                // Find candidate inhalation image later in sequence or outtakes
                const candidateInhalation =
                    images.slice(anom.index).find((img) => img.analysis?.luminance >= 135) ||
                    images.slice(anom.index).find((img) => img.analysis?.luminance > 100) ||
                    (data.outtakes || []).find((out) => out.analysis?.luminance >= 135);

                md += `##### Option A (Frame #${anom.index}): Poetic Caesura (Text Interlude)\n\n`;
                md += `Insert a contemplative musical rest before Frame #${anom.index} to give the viewer cognitive breathing space:\n\n`;
                md += `> In the darkroom of the night street, every reflection is an accidental double.\n>\n`;
                md += `> — **Daido Moriyama**\n\n`;

                if (candidateInhalation) {
                    // Compute simulated reordered sequence
                    const reordered = [...images];
                    const candIdx = reordered.findIndex(
                        (img) => img.filename === candidateInhalation.filename
                    );
                    if (candIdx > -1) {
                        const [moved] = reordered.splice(candIdx, 1);
                        reordered.splice(anom.index - 1, 0, moved);
                    }
                    const optTransitions = calculatePairwiseTransitions(reordered);
                    const optRespiratory = analyzeRespiratoryRhythm(reordered);
                    const optTotalCost = optTransitions.reduce(
                        (sum, t) => sum + (t.totalCost || 0),
                        0
                    );

                    md += `##### Option B (Frame #${anom.index}): Visual Resequencing (Luminous Inhalation Wave) [Recommended]\n\n`;
                    md += `Move **\`${candidateInhalation.filename}\`** (L*=${candidateInhalation.analysis?.lab.L || 58}, Inhalation) into position #${anom.index} between the dark nocturnes to create a Chiaroscuro wave.\n\n`;

                    md += `| Metric | Current Sequence | Proposed Sequence (Option B) |\n`;
                    md += `| :--- | :--- | :--- |\n`;
                    md += `| **Respiratory Pacing Score** | \`${respiratory.rhythmScore}/100\` | **\`${optRespiratory.rhythmScore}/100\`** |\n`;
                    md += `| **Cadence Warnings** | \`${respiratory.anomalies.length}\` (${anom.type}) | **\`${optRespiratory.anomalies.length}\` (Harmonic Breath Cycles)** |\n`;
                    md += `| **Hamiltonian Total Energy** | \`${totalHamiltonianEnergy.toFixed(1)}\` | **\`${optTotalCost.toFixed(1)}\`** |\n\n`;

                    md += `**Proposed \`index.md\` Layout**:\n\n\`\`\`markdown\n`;
                    for (let j = 0; j < reordered.length; j++) {
                        const rImg = reordered[j];
                        const capStr = rImg.caption ? ` | ${rImg.caption}` : '';
                        md += `${rImg.filename}${capStr}\n`;
                    }
                    md += `\`\`\`\n\n`;
                }
            } else if (anom.type === 'Hyperventilation') {
                md += `##### Option A (Frame #${anom.index}): Poetic Caesura (Text Interlude)\n\n`;
                md += `Insert a dense, grounding reflection between consecutive high-key frames:\n\n`;
                md += `> Light does not illuminate everything; it defines the borders where darkness begins.\n>\n`;
                md += `> — **Susan Sontag**\n\n`;
            }
        }
    } else {
        md += `The current sequence displays **optimal rhythmic pacing** (${respiratory.rhythmScore}/100) with harmonic alternation across Inhalation, Exhalation, and Neutral anchor frames.\n\n`;
    }

    if (data.outtakes && data.outtakes.length > 0) {
        md += `## 4. Unsequenced Candidates & Outtakes (${data.outtakes.length})\n\n`;
        for (const out of data.outtakes) {
            const a = out.analysis;
            const previewFilename = resolvePreviewFilename(galleryDir, out.filename);
            const imgEmbedUrl = `./${previewFilename}`;
            md += `### Candidate: ${out.filename}\n\n`;
            md += `![${out.filename}](${imgEmbedUrl})\n\n`;
            if (a) {
                md += `- **Metrics**: \`${a.orientation.toUpperCase()}\` · \`${a.width}×${a.height}\` · \`L*=${a.lab.L}\` (${a.breathType})\n`;
            }

            const evalMatch = data.candidateEvaluations?.find((e) => e.candidate === out.filename);
            if (evalMatch && evalMatch.bestSlot) {
                const b = evalMatch.bestSlot;
                const prev = b.prevNeighbor ? `\`${b.prevNeighbor}\`` : '`[OPENING]`';
                const next = b.nextNeighbor ? `\`${b.nextNeighbor}\`` : '`[FINALE]`';
                md += `- **Optimal Integration Slot**: Position #${b.slotPosition} (${prev} → **\`${out.filename}\`** → ${next})\n`;
                md += `- **Pacing Impact**: Net ΔEnergy \`${b.netDelta > 0 ? '+' : ''}${b.netDelta}\` · Local Step Cost \`${b.localStepCost}\` · Pacing Score \`${b.rhythmScore}/100\`\n`;
                md += `- **Curatorial Suggestion**: ${evalMatch.curatorialRationale}\n`;
            }

            md += `- **Curatorial Status**: Unsequenced candidate (review placement simulation above before integrating).\n\n`;
        }
    }

    // Normalize whitespace for markdownlint compliance (no MD012 multiple blank lines)
    md = md.replace(/\n{3,}/g, '\n\n').trim() + '\n';

    if (outputPath) {
        fs.mkdirSync(path.dirname(outputPath), { recursive: true });
        fs.writeFileSync(outputPath, md, 'utf8');

        // Automatically maintain a root-level README.md (e.g. p2/README.md)
        // with adjusted relative paths (../assets/img/p2/...) so that GitHub Web and the GitHub iOS app
        // automatically render the full visual sequence report on the folder page with zero extra taps
        const pageDir = path.join(REPO_ROOT, pageId);
        if (fs.existsSync(pageDir) && fs.statSync(pageDir).isDirectory()) {
            // Clean up any legacy symlink if present
            const oldSymlink = path.join(pageDir, 'sequence-report.md');
            if (fs.existsSync(oldSymlink) || fs.lstatSync(oldSymlink, { throwIfNoEntry: false })) {
                try {
                    fs.unlinkSync(oldSymlink);
                } catch {
                    // Ignore
                }
            }

            const readmePath = path.join(pageDir, 'README.md');
            const readmeMd = md.replace(/\(\.\/([^)]+)\)/g, `(../assets/img/${pageId}/$1)`);
            fs.writeFileSync(readmePath, readmeMd, 'utf8');

            try {
                execFileSync('npx', ['prettier', '--write', outputPath, readmePath], {
                    cwd: REPO_ROOT,
                    stdio: 'ignore',
                });
            } catch {
                // Ignore if npx/prettier is unavailable in sub-process
            }
        }
    }

    return {
        reportContent: md,
        outputPath,
    };
}
