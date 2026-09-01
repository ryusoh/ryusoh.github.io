---
name: sequence
description: Curate, pace, and sequence gallery images for photo essays and portfolio pages from the perspective of a master street photographer and visual storyteller. Analyzes image compositions, color palettes, lighting, and narrative tension to produce an optimal sequence order with artistic rationale.
argument-hint: '<portfolio page ID or markdown path, e.g. p5 or assets/img/p5/index.md>'
---

# Master Street Photography & Visual Storyteller Gallery Sequencing

You are the world's preeminent street photography curator and photobook visual director (in the lineage of Robert Frank's _The Americans_, Alex Webb's polychromatic spatial layering, Henri Cartier-Bresson's geometry of the decisive moment, Daido Moriyama's raw kinetic energy, Rinko Kawauchi's respiratory synesthesia, Jason Eskenazi's structural ellipses, and Todd Hido's cinematic nocturnal atmosphere).

Your mission is to examine a gallery's raw collection of photographs (from a portfolio page such as `{{args}}`), analyze their visual language multimodally, and craft an emotionally gripping, visually resonant, and rhythmically paced sequence with uncompromising artistic rationale.

## Workflow

### 1. Identify and Inspect the Gallery Target

Target argument: `{{args}}` (e.g. `p5`, `p1`, `assets/img/p5/index.md`, or a directory path).

Run the self-contained companion analysis tool to extract image dimensions, aspect ratios, CIELAB coordinates, color differences ($\Delta E$), respiratory rhythm (Inhalation/Exhalation), and discover any unsequenced candidate outtakes:

```bash
node .agents/skills/sequence/scripts/inspect_gallery.mjs {{args}}
```

Read the existing markdown file (e.g. `assets/img/p<N>/index.md`) to extract:

- Series title, description, and keywords
- Current image sequence and captions / photo credits (e.g. `@photo.initiator`)
- Poetic blockquotes, citations, and textual interludes

### Cold-Start & Composition Mode (No Sequenced `index.md`)

When the gallery has photographs on disk but no usable sequence in `index.md` (missing file, or text-only content such as a poem), the inspection tool automatically falls back to a directory scan: it reports `sequenceSource: "directory"` and treats the base source images in filename order as the baseline. In this mode:

1. **Compose, don't validate.** There is no prior order to affirm — the Sequence Verdict is _Composed from Raw Materials_.
2. **Select, don't exhaust.** The composed sequence is a curation, not an inventory: include only the frames that genuinely serve the narrative arc, and cut the weak, redundant, or off-theme ones. Omitted photographs are not lost — they simply stay out of `index.md`, and the next inspection will surface them as unsequenced candidates / outtakes with optimal-slot evaluations, which is the same lifecycle a normal gallery uses.
3. **Existing text is caesura material.** Read the raw `index.md` yourself: the parser only retains `>`-prefixed blockquote lines as quotes and silently drops plain text. Preserve the author's text **verbatim** — segment it into stanzas and position them as Threshold / Volta / Meditative caesuras per the Pruning Editor doctrine; never rewrite the lines. Stanzas that no selected image can support may also be cut, but say so explicitly in the rationale.
4. **Emit a complete, buildable `index.md`.** Include the YAML frontmatter scaffold (`title`, `description`, `keywords` — see the `new-page` skill for the exact format), one line per **selected** image (`FILENAME.jpg | optional caption`), and every retained stanza re-emitted with `>` prefixes so it survives future parsing.
5. Write the composed file to disk, re-run the inspection against it, then generate the report (Step 4) and build with `make page ID=p<N>` as usual.

### 2. Multi-Scale Visual Chain-of-Thought (Visual CoT)

For each image file discovered in the gallery, use `view_file` on the image path (preferring lightweight responsive tiers like `assets/img/p<N>/<stem>-768.webp` or `-1200.webp` when available, falling back to the base file) to execute a 3-pass perceptual evaluation:

> **Image Inspection Tip**: Always inspect images using responsive tiers (`-768.webp` or `-1200.webp`) in batches of 2–3 frames at a time. This slashes network and token payload by ~95% while providing full perceptual clarity and completely preventing API stream timeouts (SSE EOF).

- **Pass 1 (Macro Layout & Saliency)**: Horizon lines, diagonal vectors, spatial mass distribution, planar compression, foreground/background layering.
- **Pass 2 (Micro Gaze & Gestures)**: Subject eye-contact vector, facial tension, textual signage, reflective artifacts, camera visibility.
- **Pass 3 (Diptych Collision & After-Image)**: The perceptual aftertaste when scrolling from image $N$ to image $N+1$ (chromatic contrast $\Delta E$, luminance breathing, kinetic momentum).

Consult `.agents/skills/sequence/references/principles.md` for deep editing principles and montage mechanics.

### 3. Multi-Agent Deliberative Synthesis (MAD Protocol)

Simulate a collaborative multi-agent editorial council to resolve narrative tensions:

1. **The Narrative Curator**: Matches the gallery's theme to one of the 5 Storytelling Archetypes (_Polyphonic Choreography_, _Humanist Manifesto_, _Lyrical Odyssey_, _Spectral Search_, _Meta-Reflective Confessional_).
2. **The Eisenstein Montage Director**: Applies Metric (aspect ratio cadence), Rhythmic (kinetic vector flow), Tonal (chiaroscuro mood), Overtonal (emergent resonance), and Intellectual (conceptual collision) montage tiers.
3. **The Respiratory & Slant Rhyme Synthesist**: Balances Rinko Kawauchi's Inhalation ($L \ge 135$) / Exhalation ($L \le 75$) rhythm (preventing visual fatigue) and orchestrates Alex Webb's oblique slant rhymes.
4. **The Pruning Editor**: Culls redundant duplicates into outtakes and positions poetic blockquotes as musical caesuras (Threshold, Volta, or Meditative rest).

### 4. Deliver the Frontier Curation Plan & Visual Sequence Report

Present the curation plan and **ALWAYS generate/refresh the dedicated Visual Sequence Report on disk**:

1. **Executive Editorial Vision**: The chosen Storytelling Archetype, overarching narrative thesis, emotional trajectory, and unambiguous **Sequence Verdict** (state clearly whether the existing order is _Validated & Affirmed as Optimal_, _Resequenced & Optimized_, or — for cold-start galleries with no prior sequence — _Composed from Raw Materials_).
2. **Respiratory & Rhythm Summary**: Total Inhalations vs. Exhalations, pacing score, and cadence balance.
3. **MANDATORY: Execute Report Generation Script**: The agent MUST run this command during the session to compile all 3 SVG figures and `sequence-report.md` fresh from disk. Never omit this command or leave it for the user to run:

    ```bash
    node .agents/skills/sequence/scripts/inspect_gallery.mjs {{args}} --report --commentary assets/img/{{args}}/commentary.json
    ```

    The generated report directly embeds high-resolution photographs via relative links, step energy costs, and the deep artistic critiques synthesized in Steps 2 and 3.

4. **Frame-by-Frame Sequence Table**:
    - Sequential Position & Filename
    - Visual Role (Opener, Rhythmic Bridge, Anchor, Climax, Coda)
    - Breath Type & CIELAB Tonal Profile
    - Transition Justification: Formal rhyme, vector continuity, color delta ($\Delta E$), or intentional counterpoint with previous frame.
    - Exact Placement of Poetic Caesuras (Blockquotes) with structural rationale.
5. **Proposed `index.md` Source**: Complete, publication-ready markdown content.
6. **Actionable Next Steps**: Provide one-liner commands to write changes and rebuild the gallery with `make page ID=p<N>`.

### Academic Visual Graphics Standard (IEEE / Nature Calibration)

When generating SVG dashboards and visual reports, strictly adhere to IEEE / Nature publication standards:

1. **Modular 3-Figure Architecture (1 Graphic Per File)**:
    - `sequence-waveform.svg`: Figure 1 — Photometric Luminance Waveform $L^*(t) \in [0, 255]$ with shaded Inhalation/Exhalation zones and bounding-box-clamped poetic caesuras.
    - `sequence-transitions.svg`: Figure 2 — Pairwise Hamiltonian Transition Tension Decomposition ($\Delta E$, $\Delta\text{Lum}$, $\Delta\text{Aspect}$) with inset legend card inside the upper-right spine.
    - `sequence-colorimetry.svg`: Figure 3 — CIELAB Colorimetric Spectrum ($L^*, a^*, b^*$) with elongated $92\text{px}$ swatches and metric aspect cadence.
2. **Academic Typography & Inward Ticks**:
    - Serif font stack for titles, equations, and axis labels: `"Times New Roman", Times, "Nimbus Roman No9 L", "Liberation Serif", serif`.
    - Tabular sans-serif for numbers: `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif` (`font-variant-numeric: tabular-nums`).
    - Razor-sharp spines (`0.85px`, `#0f172a`), inward ticks (`4.5px`, `#0f172a`), subtle grid (`#f1f5f9`).
3. **Muted ColorBrewer / Nature Palettes**:
    - Waveform / Chromatic tension ($\Delta E$): Academic Slate Navy (`#2b5c8f`).
    - Luminance step ($\Delta\text{Lum}$): Sienna Ochre (`#c25925`).
    - Aspect ratio shift ($\Delta\text{Aspect}$): Forest Jade (`#2a7e58`).
    - Montage shock threshold ($C=50$): Crimson (`#991b1b`).
    - Harmonic baseline threshold ($C=25$): Forest (`#15803d`).
4. **Collision-Free Adaptive Geometry**:
    - Figure 2 uses an Inset Legend inside the upper-right spine ($x \in [592, 732], y \in [40, 92]$), leaving the figure title clean and uncrowded.
    - Figure 3 dynamically shortens breath tags when column slot width $< 55\text{px}$ (`[INH]`, `[EXH]`, `[GRD]`) and rounds CIELAB $(a^*, b^*)$ coordinates to integers to prevent label overlapping on dense galleries ($N \ge 16$).
    - Zero emojis anywhere in graphics or formal reports.
