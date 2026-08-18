#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';
import { load as yamlLoad } from 'js-yaml';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '../../../..');

/**
 * Converts sRGB [0-255] to CIELAB { L, a, b } (D65 illuminant).
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
    let x = (rLinear * 0.4124 + gLinear * 0.3576 + bLinear * 0.1805) / 0.95047;
    let y = (rLinear * 0.2126 + gLinear * 0.7152 + bLinear * 0.0722) / 1.0;
    let z = (rLinear * 0.0193 + gLinear * 0.1192 + bLinear * 0.9505) / 1.08883;

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
    const dAspect = Math.abs(Number(a.aspectRatio) - Number(b.aspectRatio));

    // Weighted cost normalized into 0-100 score
    const chromaticCost = Math.min(100, (dE / 80) * 100);
    const lumStepCost = (dLum / 255) * 100;
    const aspectCost = Math.min(100, (dAspect / 1.0) * 100);

    const totalCost = Number(
        (chromaticCost * 0.45 + lumStepCost * 0.35 + aspectCost * 0.2).toFixed(1)
    );

    return {
        totalCost,
        deltaE: dE,
        deltaLum: dLum,
        deltaAspect: Number(dAspect.toFixed(2)),
    };
}

/**
 * Calculates pairwise transitions across an image sequence.
 * @param {Array} images
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
 * Resolves gallery path from arguments.
 */
export function resolveGalleryPath(arg) {
    if (!arg) {
        throw new Error(
            'Please provide a gallery identifier or path (e.g. "p5" or "assets/img/p5/index.md").'
        );
    }

    let clean = String(arg).trim();
    if (/^\d+$/.test(clean)) {
        clean = `p${clean}`;
    }

    if (/^p\d+$/i.test(clean)) {
        return {
            pageId: clean.toLowerCase(),
            dir: path.join(REPO_ROOT, 'assets', 'img', clean.toLowerCase()),
            mdPath: path.join(REPO_ROOT, 'assets', 'img', clean.toLowerCase(), 'index.md'),
        };
    }

    let resolvedPath = path.resolve(REPO_ROOT, clean);
    if (fs.existsSync(resolvedPath) && fs.statSync(resolvedPath).isDirectory()) {
        const mdCandidate = path.join(resolvedPath, 'index.md');
        const pageId = path.basename(resolvedPath).toLowerCase();
        return {
            pageId,
            dir: resolvedPath,
            mdPath: mdCandidate,
        };
    }

    if (fs.existsSync(resolvedPath) && fs.statSync(resolvedPath).isFile()) {
        const dir = path.dirname(resolvedPath);
        const pageId = path.basename(dir).toLowerCase();
        return {
            pageId,
            dir,
            mdPath: resolvedPath,
        };
    }

    const pageId = clean.replace(/[^a-zA-Z0-9_-]/g, '').toLowerCase();
    return {
        pageId,
        dir: path.join(REPO_ROOT, 'assets', 'img', pageId),
        mdPath: path.join(REPO_ROOT, 'assets', 'img', pageId, 'index.md'),
    };
}

/**
 * Parse index.md to extract frontmatter, items (images, quotes), and layout structure.
 */
export function parseGalleryMarkdown(mdPath) {
    if (!fs.existsSync(mdPath)) {
        return { frontmatter: {}, entries: [] };
    }

    const content = fs.readFileSync(mdPath, 'utf8');
    let frontmatter = {};
    let body = content;

    const fmMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
    if (fmMatch) {
        try {
            frontmatter = yamlLoad(fmMatch[1]) || {};
        } catch {
            frontmatter = {};
        }
        body = fmMatch[2];
    }

    const lines = body.split(/\r?\n/);
    const entries = [];
    let currentQuote = [];

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();

        if (trimmed.startsWith('>')) {
            currentQuote.push(trimmed.replace(/^>\s?/, ''));
            continue;
        } else if (currentQuote.length > 0) {
            entries.push({
                type: 'quote',
                content: currentQuote.join('\n').trim(),
            });
            currentQuote = [];
        }

        if (!trimmed || trimmed === '---') {
            continue;
        }

        const [filename, ...captionParts] = trimmed.split('|');
        const cleanFilename = filename.trim();
        const caption = captionParts.join('|').trim();

        if (/\.(jpe?g|png|webp|avif)$/i.test(cleanFilename)) {
            entries.push({
                type: 'image',
                filename: cleanFilename,
                caption: caption || null,
            });
        }
    }

    if (currentQuote.length > 0) {
        entries.push({
            type: 'quote',
            content: currentQuote.join('\n').trim(),
        });
    }

    return { frontmatter, entries };
}

/**
 * Extract image metadata, color histogram, CIELAB coordinates, and luminance.
 */
export async function analyzeImage(imagePath) {
    if (!fs.existsSync(imagePath)) {
        return null;
    }

    try {
        const image = sharp(imagePath);
        const metadata = await image.metadata();
        const stats = await image.stats();

        const width = metadata.width || 0;
        const height = metadata.height || 0;
        const ratio = height > 0 ? (width / height).toFixed(2) : '1.00';
        let orientation = 'square';
        if (width > height * 1.05) orientation = 'landscape';
        else if (height > width * 1.05) orientation = 'portrait';

        const [rStat, gStat, bStat] = stats.channels;
        const avgR = rStat ? Math.round(rStat.mean) : 128;
        const avgG = gStat ? Math.round(gStat.mean) : avgR;
        const avgB = bStat ? Math.round(bStat.mean) : avgR;
        const luminance = Math.round(0.2126 * avgR + 0.7152 * avgG + 0.0722 * avgB);

        const lab = rgbToLab(avgR, avgG, avgB);

        let tonalKey = 'mid-tone';
        let breathType = 'Neutral';
        if (luminance < 75) {
            tonalKey = 'low-key (dark/moody)';
            breathType = 'Exhalation';
        } else if (luminance > 135) {
            tonalKey = 'high-key (bright/airy)';
            breathType = 'Inhalation';
        }

        let temp = 'neutral';
        if (avgR > avgB + 15) temp = 'warm / golden / amber';
        else if (avgB > avgR + 15) temp = 'cool / blue / cyan';

        return {
            filename: path.basename(imagePath),
            width,
            height,
            aspectRatio: ratio,
            orientation,
            format: metadata.format,
            luminance,
            tonalKey,
            breathType,
            colorTemperature: temp,
            avgRGB: [avgR, avgG, avgB],
            lab,
        };
    } catch {
        return null;
    }
}

/**
 * Inspects a gallery and computes all metrics.
 * @param {string} pageArg
 */
export async function inspectGallery(pageArg) {
    const { pageId, dir, mdPath } = resolveGalleryPath(pageArg);

    if (!fs.existsSync(dir)) {
        throw new Error(`Gallery directory not found: ${dir}`);
    }

    const { frontmatter, entries } = parseGalleryMarkdown(mdPath);

    const sequencedImages = [];
    const quotes = [];
    let sequenceIndex = 1;

    for (const item of entries) {
        if (item.type === 'quote') {
            quotes.push({
                afterImageIndex: sequencedImages.length,
                content: item.content,
            });
        } else if (item.type === 'image') {
            const imgPath = path.join(dir, item.filename);
            const analysis = await analyzeImage(imgPath);
            sequencedImages.push({
                sequenceOrder: sequenceIndex++,
                filename: item.filename,
                caption: item.caption,
                exists: !!analysis,
                analysis: analysis || { filename: item.filename, error: 'File missing on disk' },
            });
        }
    }

    // Pairwise transition analysis across current sequence
    const transitions = calculatePairwiseTransitions(sequencedImages);

    // Respiratory Rhythm (Inhalation / Exhalation)
    const respiratory = analyzeRespiratoryRhythm(sequencedImages);

    // Scan directory for all image files to detect unreferenced outtakes
    const allFiles = fs.readdirSync(dir);
    const candidateExts = /\.(jpe?g|png)$/i;
    const isBaseSource = (f) =>
        candidateExts.test(f) && !f.includes('-768') && !f.includes('-1200');

    const sourceImagesOnDisk = allFiles.filter(isBaseSource);
    const sequencedFilenames = new Set(sequencedImages.map((img) => img.filename.toLowerCase()));

    const outtakes = [];
    for (const f of sourceImagesOnDisk) {
        if (!sequencedFilenames.has(f.toLowerCase())) {
            const analysis = await analyzeImage(path.join(dir, f));
            outtakes.push({
                filename: f,
                analysis,
            });
        }
    }

    const outputData = {
        gallery: {
            pageId,
            directory: path.relative(REPO_ROOT, dir),
            markdownPath: path.relative(REPO_ROOT, mdPath),
            title: frontmatter.title || 'Untitled',
            description: frontmatter.description || '',
            totalImages: sequencedImages.length,
            totalOuttakes: outtakes.length,
            totalQuotes: quotes.length,
        },
        respiratoryRhythm: respiratory,
        transitions,
        images: sequencedImages,
        quotes,
        outtakes,
    };

    return outputData;
}

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
    const respiratory = analyzeRespiratoryRhythm(images);
    const totalHamiltonianEnergy = transitions.reduce((sum, t) => sum + (t.totalCost || 0), 0);
    const avgHamiltonianEnergy =
        transitions.length > 0
            ? Number((totalHamiltonianEnergy / transitions.length).toFixed(1))
            : 0;

    let md = `# Visual Curation & Sequence Report: ${data.gallery.title || pageId.toUpperCase()}\n\n`;
    md += `> **Curation Archetype**: ${archetype}\n>\n`;
    md += `> **Hamiltonian Sequence Energy**: \`${totalHamiltonianEnergy.toFixed(1)}\` (Avg Step Cost: \`${avgHamiltonianEnergy}\`)\n>\n`;
    md += `> **Respiratory Pacing Score**: \`${respiratory.rhythmScore}/100\` (${respiratory.inhalations} Inhalations, ${respiratory.exhalations} Exhalations, ${respiratory.neutrals} Grounding)\n\n`;

    md += `## 1. Executive Curatorial Architecture\n\n`;
    md += `This report visually illustrates the recommended image sequence for **${pageId}**, embedding high-resolution photographs directly in markdown alongside technical colorimetry (CIELAB L*a*b*, ΔE₇₆), respiratory pacing waveforms, and multi-agent aesthetic rationale.\n\n`;

    if (respiratory.anomalies.length > 0) {
        md += `### ⚠️ Respiratory Rhythm Alerts\n\n`;
        for (const anom of respiratory.anomalies) {
            md += `- **Frame #${anom.index} (${anom.filename})** — *${anom.type}*: ${anom.detail}\n`;
        }
        md += `\n`;
    }

    md += `## 2. Visual Sequence Journey\n\n`;

    if (images.length === 0) {
        md += `*No active sequenced images found in this gallery.*\n\n`;
    }

    for (let i = 0; i < images.length; i++) {
        const img = images[i];
        const a = img.analysis;
        const imgAbsPath = path.join(REPO_ROOT, 'assets', 'img', pageId, img.filename);
        const relImgPath = path.relative(path.dirname(outputPath), imgAbsPath);
        const imgEmbedUrl = relImgPath.startsWith('.') ? relImgPath : `./${relImgPath}`;

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

        const commentary = img.customCommentary || commentaryMap[img.filename];
        if (commentary) {
            md += `**Curatorial Rationale & Montage Dynamic**:\n${commentary}\n\n`;
        } else if (a) {
            const nextTrans = i < transitions.length ? transitions[i] : null;
            const pacingRole =
                i === 0
                    ? 'Act I: The Overture / Sequence Opener'
                    : i === images.length - 1
                      ? 'Act IV: Coda / Sequence Resolution'
                      : `Sequence Movement (Frame #${i + 1})`;
            const breathDesc =
                a.luminance >= 135
                    ? 'Luminous inhalation providing expansive perceptual breathing space.'
                    : a.luminance <= 75
                      ? 'Low-key exhalation grounding the viewer with chiaroscuro mass.'
                      : 'Neutral midpoint maintaining narrative continuity.';
            const transDesc = nextTrans
                ? `${nextTrans.deltaLum > 40 ? 'High-contrast tonal step' : 'Harmonic chromatic transition'} with step cost of ${nextTrans.totalCost}.`
                : 'Final contemplative resting frame.';

            md += `**Curatorial Rationale & Montage Dynamic**:\n\n- *Pacing Role*: ${pacingRole}\n- *Tonal Dynamic*: ${breathDesc}\n- *Transition*: ${transDesc}\n\n`;
        }

        // Insert caesura quote if present
        const matchingQuotes = (data.quotes || []).filter(
            (q) => q.afterImageIndex === img.sequenceOrder
        );
        for (const q of matchingQuotes) {
            const cleanQuote = (q.content || '')
                .replace(/<[^>]*>/g, ' ')
                .replace(/\n/g, ' ')
                .trim();
            md += `> 💬 **[Poetic Caesura / Musical Rest]**\n>\n`;
            md += `> *"${cleanQuote.replace(/^"|"$/g, '')}"*\n`;
            if (q.author) md += `>\n> — **${q.author}**\n`;
            md += `\n`;
        }

        md += `---\n\n`;
    }

    // Section 3: Curatorial Recommendations & Optimized Sequence Proposals
    md += `## 3. Curatorial Proposals & Optimized Sequence Arc\n\n`;

    if (respiratory.anomalies.length > 0) {
        md += `### 💡 Recommended Interlude & Rhythm Solutions\n\n`;
        for (const anom of respiratory.anomalies) {
            md += `#### ⚡ Resolving Frame #${anom.index} (${anom.filename}) — *${anom.type}*\n\n`;

            if (anom.type === 'Suffocating Weight') {
                // Find candidate inhalation image later in sequence or outtakes
                const candidateInhalation =
                    images.slice(anom.index).find((img) => img.analysis?.luminance >= 135) ||
                    images.slice(anom.index).find((img) => img.analysis?.luminance > 100) ||
                    (data.outtakes || []).find((out) => out.analysis?.luminance >= 135);

                md += `##### Option A: Poetic Caesura (Text Interlude)\n\n`;
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

                    md += `##### Option B: Visual Resequencing (Luminous Inhalation Wave) [Recommended]\n\n`;
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
                md += `**Option A: Poetic Caesura (Text Interlude)**  \n`;
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
            const imgAbsPath = path.join(REPO_ROOT, 'assets', 'img', pageId, out.filename);
            const relImgPath = path.relative(path.dirname(outputPath), imgAbsPath);
            const imgEmbedUrl = relImgPath.startsWith('.') ? relImgPath : `./${relImgPath}`;
            md += `#### ✕ ${out.filename}\n\n`;
            md += `![${out.filename}](${imgEmbedUrl})\n\n`;
            if (a) {
                md += `- **Metrics**: \`${a.orientation.toUpperCase()}\` · \`${a.width}×${a.height}\` · \`L*=${a.lab.L}\` (${a.breathType})\n`;
            }
            md += `- **Curatorial Exclusion Rationale**: Excluded to maintain narrative tension, prevent chromatic friction, or avoid eye-vector redundancy.\n\n`;
        }
    }

    // Normalize whitespace for markdownlint compliance (no MD012 multiple blank lines)
    md = md.replace(/\n{3,}/g, '\n\n').trim() + '\n';

    if (outputPath) {
        fs.mkdirSync(path.dirname(outputPath), { recursive: true });
        fs.writeFileSync(outputPath, md, 'utf8');
    }

    return {
        reportContent: md,
        outputPath,
    };
}

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

    const { pageId, dir, mdPath } = resolveGalleryPath(pageArg);
    if (!fs.existsSync(dir)) {
        console.error(`Gallery directory not found: ${dir}`);
        process.exit(1);
    }

    if (reportOutput) {
        const result = await generateVisualReport(pageId, {
            outputPath: customReportPath || undefined,
        });
        console.log(`\n✅ Generated Visual Sequence Report for ${pageId.toUpperCase()}:`);
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
                ` [${String(img.sequenceOrder).padStart(2, ' ')}] ❌ MISSING: ${img.filename}`
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
                `      ↳ ⚡ Transition to #${i + 2}: ΔE: ${t.deltaE} (Color) | ΔLum: ${t.deltaLum} | Cost: ${t.totalCost}`
            );
        }

        // Print quotes that appear after this image
        const matchingQuotes = quotes.filter((q) => q.afterImageIndex === img.sequenceOrder);
        for (const q of matchingQuotes) {
            const preview = q.content.replace(/\n/g, ' / ').slice(0, 75);
            console.log(`      📜 [Caesura Interlude]: "${preview}..."`);
        }
    }

    if (respiratory.anomalies.length > 0) {
        console.log(`\n----------------------------------------------------------------------`);
        console.log(`RESPIRATORY RHYTHM WARNINGS:`);
        for (const anom of respiratory.anomalies) {
            console.log(
                ` ⚠️ [Frame #${anom.index} - ${anom.filename}] ${anom.type}: ${anom.detail}`
            );
        }
    }

    if (outtakes.length > 0) {
        console.log(`\n----------------------------------------------------------------------`);
        console.log(`UNSEQUENCED CANDIDATES / OUTTAKES IN DIRECTORY (${outtakes.length}):`);
        for (const out of outtakes) {
            const a = out.analysis;
            if (a) {
                console.log(
                    ` • ${out.filename.padEnd(28, ' ')} | ${a.orientation.toUpperCase()} | ${a.width}x${a.height} | Lum: ${a.luminance} (${a.breathType})`
                );
            } else {
                console.log(` • ${out.filename}`);
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
