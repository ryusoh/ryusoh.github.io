# Research: Photobook eBook (PDF) Generation & Long-Term Management Architecture

**Status:** research findings (2026-11-17)
**Scope:** End-to-end architecture, agentic orchestration (Rich Sutton's _The Bitter Lesson_), monochrome vs. color modality partitioning, visual design & spread layout specification for _Infinite Systems_, rendering toolchain evaluation, color/resolution physics, and long-term editorial maintenance for compiling the sequenced photographic materials of `ryusoh.github.io` (`p1`–`p6`) into a publication-grade PDF photobook.

---

## 1. Research Question

If we build an eBook photobook titled _**Infinite Systems**_ (outputting a PDF file) from the photographic materials in `ryusoh.github.io`—without being forced to preserve the 6 web pages (`p1`–`p6`) as 6 rigid chapters or reuse their web layout verbatim, following Rich Sutton's _The Bitter Lesson_ to let an agentic system orchestrate the book across the 127 sequenced photographs while enforcing a strict separation between black-and-white (B&W) and color photographs—what is the best way to design, generate, and manage it over the long term (including future photo additions, deletions, sequence adjustments, and visual/layout refinements)?

---

## 2. Executive Summary & Recommended Architecture

### 2.1 The Short Answer

**Retain the editorial direction and Typst-centered renderer, but build governance before optimization.** The durable system is a human-approved, file-based editorial state machine surrounded by proposal-generating agents—not an autonomous book-writing pipeline.

1. **Pool Eligibility & Modality Partition Rule — Strictly the 127 Sequenced Photos, Split into Disjoint B&W (`51`) and Color (`76`) Sub-Pools:**
    - **Gatekeeping (`index.md` authority):** Only the **127 photographs actively sequenced in `assets/img/p1/index.md` through `assets/img/p6/index.md`** enter the photobook candidate pool (`201.0 MB` total; `127/127` landscape `3:2` orientation; `82.7%` low-key chiaroscuro or mid-tone twilight). The **12 unsequenced orphan files** sitting on disk (`1` in `p3`, `11` in `p6`) are deliberate editorial outtakes and **must be strictly ignored**.
    - **Strict B&W vs. Color Separation:** Pixel-level chroma analysis (`sharp` 95th-percentile RGB channel delta $P_{95}(\max(|R-G|, |G-B|, |R-B|))$) across the 127 eligible photos reveals two disjoint visual modalities: **51 B&W** (`18` in `p1`, `32` in `p6`, and one tinted monochrome frame in `p5`) and **76 Color** (`21` in `p2`, `23` in `p3`, `20` in `p4`, and `12` in `p5`).
    - **Never mix B&W and Color on the same spread or within the same movement:** The orchestrator partitions the search into two disjoint graph components. They contain **1,275 total B&W pairs** and **2,850 total Color pairs**, separated at the macro-book level by an explicit **Phase Transition Divider** spread. These are not all cross-series pairs: after subtracting intra-series pairs, the actual cross-series counts are **626 B&W** and **2,131 Color**.
2. **Apply Rich Sutton's _The Bitter Lesson_ to Visual Curation & 2D Spread Search — Not to Free-Form AI Poetry or Autonomous Editorial Approval:**
    - **Dissolve the 6 web-folder silos within each modality component:** Pooling creates **4,125 valid same-modality pairs**, of which **2,757 cross a former web-series boundary**. Separating B&W from Color also avoids a metric blind spot in CIELAB CIE76 $\Delta E$: a dark low-saturation color photo can have near-zero color distance to a dark B&W photo even though their editorial modalities differ.
    - **Version every metric:** Breath thresholds `75` and `135` belong to weighted sRGB **`luma255`** on a 0–255 scale, not CIELAB **`lab.L`** on a 0–100 scale. Color search can use CIE76 chromatic distance, `lab.L` contrast, and gaze/vector geometry; B&W search emphasizes luminance, tonal entropy/grain, and composition without assuming that a tinted monochrome source has exactly zero chroma.
    - **Generate proposals, not approved edits:** Start with seeded multi-start beam search and local swaps/relocations. Emit several Pareto-diverse candidates with score deltas and before/after proofs. Locks, bans, rights failures, parity, and modality are hard constraints; aesthetic scores only rank otherwise valid candidates.
    - **Forbid unconstrained LLM-generated interstitial poetry:** Preserve **visual silence (~90% of spreads)**, retrieve only from the closed authentic corpus, and route AI analytical commentary to the back-of-book appendix. Fragment placement defaults to verbatim text. Any excerpt is a separately reviewable proposal with exact source ranges and retained attribution; “authentic” does not imply author-original or cleared for arbitrary trimming.
3. **Persist Approved Editorial State in a Versioned Ledger (`book/sequence.yaml`):**
    - The ledger records stable movement, spread, page, asset, and fragment IDs; asset source revisions; output-independent editorial decisions; locks/bans/pins; and proposal provenance. A logical `assetId` survives re-export, while `sourceSha256` identifies a particular byte revision.
    - Optimizers and `book-sync` write **candidate proposals only**. Human approval promotes a specific proposal against a specific parent ledger revision. New photos become unplaced candidates; deletion from a locked spread is a human-resolution conflict, never an automatic repair. Application requires an explicit plan/proposal ID, full validation, and atomic replacement.
4. **Visual Identity for _Infinite Systems_ (“Obsidian Darkroom + Telemetry Red”), with an Explicit Resolution Decision:**
    - The proposed **`300 mm × 200 mm`** page preserves the common 3:2 frame without cropping, but a `2048 × 1365 px` source provides only **173.355 PPI** at trim size and **168.306 PPI** with 3 mm bleed. The first implementation must therefore choose a screen/display edition, a smaller/lower-PPI physical proof, or high-resolution press sources; it must not call the web-export build press-ready.
    - Scale monotony is prevented via **five modular spread archetypes** on a 12-column × 8-row Swiss grid with `Syne`, `Glow Sans SC`, and tabular monospace telemetry. On `#070709`, `#6E737B` (**4.218:1**), `#4A4E54` (**2.405:1**), and `#CE2323` (**3.727:1**) cannot carry meaningful small text; reserve them for decoration, large text, or non-text accents and introduce accessible semantic text tokens.
5. **Render via Typst + Content-Addressed `sharp` Derivatives + Destination-Specific Output Profiles:**
    - **Primary renderer — Typst (`v0.15.1`, Apache-2.0):** structured JSON/YAML input, JPEG `/DCTDecode` passthrough, embedded ICC preservation, CJK/Latin typography, custom page geometry and bleed, PDF/A and PDF/UA targets, and timestamp controls. Reproducibility additionally requires pinned fonts/tools/ICC inputs, stable input order, locale/timezone capture, optimizer configuration, and deterministic post-processing; `SOURCE_DATE_EPOCH` alone is not a guarantee.
    - **Output profiles:** `screen` for portable viewing, `display` for high-quality screen output, `archive-pdfa` for a declared and validated archival target, and printer-specific `press` only after a print contract exists. PDF/A does not imply high resolution or press readiness, and PDF/X requires a printer-specific output intent and proofing policy.
    - **Release evidence:** QPDF structural checks, Poppler inspection/rasterization, effective-PPI/page-box/font/glyph checks, final-artifact reproducibility, and veraPDF when PDF/A or PDF/UA is declared. `/PageLayout /TwoPageRight` is only an initial viewer preference, not print imposition. Semantic accessibility and human visual/assistive-technology review remain mandatory.

### 2.2 Authority Boundaries and End-to-End Architecture

Source photographs, authentic text, rights information, and human taste decisions are authoritative. A deterministic inventory derives observations without modifying them. Candidate generation proposes sequences and layouts; only human approval changes the approved ledger. The approved ledger then flows through canonical layout IR, deterministic renderers, release gates, and a signed-off edition. LLMs may explain or propose inside the candidate stage, but no LLM call belongs in deterministic inventory, validation, layout, rendering, or preflight.

![Authority boundaries in the ebook orchestration system](assets/photobook-ebook-review/orchestration-boundaries.png)

| Boundary                  | May write                                                               | Must never do                                                                |
| ------------------------- | ----------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Source ingest / inventory | Disposable inventory JSON, hashes, metrics, candidate-pool observations | Overwrite originals, trim text, or silently import an asset into an edition  |
| Candidate agent           | Versioned proposal, rationale, and proof diff                           | Write the approved ledger or promote its own candidate                       |
| Human decision            | Approval/rejection and a new reviewed ledger revision                   | Delegate final editorial or rights approval to a score                       |
| Deterministic compiler    | Layout IR, renderer source, derivatives, and output manifest            | Invoke an LLM, discover new edition members implicitly, or relax constraints |
| Release gate              | Final preflight and sign-off record                                     | Declare visual, accessibility, or press approval without human evidence      |

Approved state is reviewed and versioned; derived state is disposable and reproducible. Candidate runs belong under a gitignored run directory such as `.cache/book-runs/<runId>/`, while the approved ledger and explicit editorial decisions remain Git-tracked. The existing web builder's `ensureImageVariants()` sanitizes source JPEG metadata and must not be reused by the book pipeline. Only non-mutating parser/metric components from the sequence tooling are candidates for reuse.

---

## 3. Primary Sources Consulted

1. **Repository Source Code & Governing Documentation (`ryusoh.github.io`)**
    - [`scripts/build-page.mjs`](file:///Users/lz/dev/ryusoh.github.io/scripts/build-page.mjs): `parseMarkdownSource()` (lines 63–80), `ensureImageVariants()` (lines 85–164), `buildPage()` (lines 308–420).
    - [`.agents/skills/sequence/SKILL.md`](file:///Users/lz/dev/ryusoh.github.io/.agents/skills/sequence/SKILL.md) and [`docs/sequence-skill-architecture.md`](file:///Users/lz/dev/ryusoh.github.io/docs/sequence-skill-architecture.md): Sequence authority rules, Eisenstein/Webb/Kawauchi/Eskenazi montage theory, CIELAB waveform/transition metrics, and target-aware transition schema.
    - [`docs/design-research.md`](file:///Users/lz/dev/ryusoh.github.io/docs/design-research.md): Hardboiled noir/evidence-file aesthetic direction, Swiss grid discipline, true-black chiaroscuro surface rules, and `#ce2323` safelight/evidence accent (lines 50–160).
    - [`docs/critique-calibration-design.md`](file:///Users/lz/dev/ryusoh.github.io/docs/critique-calibration-design.md): Roland Barthes's _studium_ vs. _punctum_ distinction (lines 15–17) and human-machine taste calibration log.
    - [`docs/page-generation-pipeline.md`](file:///Users/lz/dev/ryusoh.github.io/docs/page-generation-pipeline.md): 3-tier hybrid architecture separating editorial markdown from deterministic compilation.
    - [`docs/archive-protocol.md`](file:///Users/lz/dev/ryusoh.github.io/docs/archive-protocol.md) and [`docs/contact-sheet-ledger-design.md`](file:///Users/lz/dev/ryusoh.github.io/docs/contact-sheet-ledger-design.md): RAW/JPEG master archive protocol and XMP/Lightroom ingest pipeline.
    - [`tools/subset_fonts.py`](file:///Users/lz/dev/ryusoh.github.io/tools/subset_fonts.py): CJK character extraction and `GlowSansSC-Extended-Bold.otf` source path resolution (lines 17–68).
2. **Agentic Search Theory**
    - **Rich Sutton (2019), _The Bitter Lesson_**: [incompleteideas.net/IncIdeas/BitterLesson.html](http://www.incompleteideas.net/IncIdeas/BitterLesson.html) — establishes that general methods leveraging **search** and **learning** that scale with computation reliably outperform human-engineered domain priors and rigid handcrafted decompositions.
3. **Typst Official Documentation & Compiler Source Code (`v0.15.1`, released 2026-07-17)**
    - Typst Reference: [`image`](https://typst.app/docs/reference/visualize/image/), [`page`](https://typst.app/docs/reference/layout/page/), [`pdf`](https://typst.app/docs/reference/pdf/), [`document`](https://typst.app/docs/reference/model/document/), [`text`](https://typst.app/docs/reference/text/text/), [`heading`](https://typst.app/docs/reference/model/heading/), [`json`](https://typst.app/docs/reference/data-loading/json/), [`yaml`](https://typst.app/docs/reference/data-loading/yaml/), and [Changelogs `0.12.0`–`0.15.1`](https://typst.app/docs/changelog/0.15.1/).
    - `typst-pdf` crate source (`v0.15.1`): [`crates/typst-pdf/src/image.rs`](https://github.com/typst/typst/blob/v0.15.1/crates/typst-pdf/src/image.rs) (lines 164–230) and [`crates/typst-cli/src/args.rs`](https://github.com/typst/typst/blob/v0.15.1/crates/typst-cli/src/args.rs) (lines 346–490).
    - `krilla` PDF generation engine (`v0.8.2`, used by `typst-pdf`): [`crates/krilla/src/graphics/image/mod.rs`](https://github.com/LaurenzV/krilla/blob/main/crates/krilla/src/graphics/image/mod.rs) (lines 259–285, 416–560, 708–736).
    - `fontdb` font loader (`RazrFalcon/fontdb`, used by `typst-kit`): [`src/lib.rs`](https://github.com/RazrFalcon/fontdb/blob/master/src/lib.rs) (line 301).
4. **Chromium / Skia PDF Backend, Puppeteer, and W3C CSS Paged Media**
    - Skia PDF JPEG serialization source: [`src/pdf/SkPDFBitmap.cpp`](https://skia.googlesource.com/skia/+/refs/heads/main/src/pdf/SkPDFBitmap.cpp) (`write_icc_profile()` lines 172–193, `do_jpeg()` lines 287–350, `serialize_image()` lines 375–405).
    - Chrome Developer Documentation: [Add content to the margins of web pages when printed using CSS (Chrome 131)](https://developer.chrome.com/blog/print-margins) and [Chrome Platform Status #5195769732923392 (`@page` margin boxes, milestone 131)](https://chromestatus.com/feature/5195769732923392) / [#5173237715566592 (Named pages, milestone 85)](https://chromestatus.com/feature/5173237715566592).
    - Puppeteer API Reference: [`PDFOptions`](https://github.com/puppeteer/puppeteer/blob/main/docs/api/puppeteer.pdfoptions.md).
    - Paged.js repository & registry metadata: [`github.com/pagedjs/pagedjs`](https://github.com/pagedjs/pagedjs) and `registry.npmjs.org/pagedjs` (`v0.4.3`).
5. **WeasyPrint & Prince XML Documentation and Source Code**
    - WeasyPrint (`v70.0`) documentation ([API Reference](https://doc.courtbouillon.org/weasyprint/stable/api_reference.html), [Common Use Cases](https://doc.courtbouillon.org/weasyprint/stable/common_use_cases.html)) and source code [`weasyprint/images.py`](https://github.com/Kozea/WeasyPrint/blob/main/weasyprint/images.py) (lines 36–160) & [`weasyprint/pdf/stream.py`](https://github.com/Kozea/WeasyPrint/blob/main/weasyprint/pdf/stream.py) (lines 325–345).
    - Prince XML documentation: [PDF Output Options](https://www.princexml.com/doc/prince-output/), [Graphics & Color Management](https://www.princexml.com/doc/graphics/), [Command-Line Reference](https://www.princexml.com/doc/command-line/), and [Purchase / Licensing](https://www.princexml.com/purchase/).
6. **ISO PDF Standards & Print Production Specifications**
    - **ISO 32000-1:2008 (PDF 1.7 Specification)**: [Clause 7.7.2 _Document Catalog_ (Table 28: `PageLayout` and `PageMode`)](https://opensource.adobe.com/dc-acrobat-sdk-docs/pdfstandards/PDF32000_2008.pdf), Clause 8.4.5 _Graphics State Parameter Dictionaries_, Clause 8.6.5.5 _ICCBased Colour Spaces_, and Clause 14.11.2 _Page Boundaries_ (`MediaBox`, `CropBox`, `BleedBox`, `TrimBox`, `ArtBox`).
    - **Blurb Print Specifications**: [Image Quality & Resolution Checklist (300 PPI standard)](https://www.blurb.com/blog/image-quality-checklist/) and [A Brief Note on Color Management (PDF/X-3, CMYK vs. sRGB workflow)](https://www.blurb.com/downloads/pdf_to_book/BriefNoteColor.pdf).
7. **Validation, Accessibility, Asset, and Reproducibility Contracts**
    - [Typst accessibility guide](kimi-cite://web?url=https%3A%2F%2Ftypst.app%2Fdocs%2Fguides%2Faccessibility%2F 'citation'), [veraPDF CLI validation](kimi-cite://web?url=https%3A%2F%2Fdocs.verapdf.org%2Fcli%2Fvalidation%2F 'citation'), and [W3C fixed-layout EPUB accessibility](kimi-cite://web?url=https%3A%2F%2Fwww.w3.org%2FTR%2Fepub-fxl-a11y%2F 'citation').
    - [QPDF CLI documentation](kimi-cite://web?url=https%3A%2F%2Fqpdf.readthedocs.io%2Fen%2Fstable%2Fcli.html 'citation'), [Sharp output documentation](kimi-cite://web?url=https%3A%2F%2Fsharp.pixelplumbing.com%2Fapi-output%2F 'citation'), and [Ajv JSON Schema documentation](kimi-cite://web?url=https%3A%2F%2Fajv.js.org%2Fjson-schema.html 'citation').
    - [Reproducible build environment](kimi-cite://web?url=https%3A%2F%2Freproducible-builds.org%2Fdocs%2Fperimeter%2F 'citation') and [SOURCE_DATE_EPOCH specification](kimi-cite://web?url=https%3A%2F%2Freproducible-builds.org%2Fspecs%2Fsource-date-epoch%2F 'citation').
    - [OR-Tools CP-SAT documentation](kimi-cite://web?url=https%3A%2F%2For-tools.github.io%2Fdocs%2Fpdoc%2Fortools%2Fsat%2Fpython%2Fcp_model.html 'citation'), [pymoo minimize interface](kimi-cite://web?url=https%3A%2F%2Fpymoo.org%2Finterface%2Fminimize.html 'citation'), and [Ghostscript PDF documentation](kimi-cite://web?url=https%3A%2F%2Fghostscript.readthedocs.io%2F_%2Fdownloads%2Fen%2Flatest%2Fpdf%2F 'citation').

---

## 4. Claim-by-Claim Evidence & Technical Analysis

### 4.1 Audit of Eligible Repository Materials (`assets/img/p1`–`p6`)

An audit of `assets/img/p1` through `assets/img/p6` using `sips`, `exiftool`, `sharp` pixel-level RGB channel-delta inspection, `sequence-report.md`, and `scripts/build-page.mjs` established the exact inventory of sequenced photographs eligible for the eBook pool versus unsequenced disk outtakes (which are excluded):

| Series  | Title (`index.md` Frontmatter)                         | Eligible JPEGs | Excluded Orphans | Modality (`B&W / Color`) | Breath (`Inh / Exh / Grd`) | `>` Quote Lines | CJK Lines | Sequenced Display P3 | Sequenced Payload |
| :------ | :----------------------------------------------------- | -------------: | ---------------: | :----------------------: | :------------------------: | --------------: | --------: | -------------------: | ----------------: |
| `p1`    | _I TEAR UP THE BAY WHEN I COME THROUGH_                |             18 |                0 |         `18 / 0`         |        `2 / 11 / 5`        |              17 |         0 |                    2 |           35.0 MB |
| `p2`    | _I DO NOT CARE IF WE GO DOWN IN HISTORY AS BARBARIANS_ |             21 |                0 |         `0 / 21`         |        `3 / 6 / 12`        |               5 |         0 |                    2 |           28.1 MB |
| `p3`    | _AEROBATIC ACTIVITIES_                                 |             23 |                1 |         `0 / 23`         |        `7 / 3 / 13`        |               4 |         0 |                    0 |           60.4 MB |
| `p4`    | _DAS GESPENST_                                         |             20 |                0 |         `0 / 20`         |        `3 / 2 / 15`        |               9 |         0 |                    1 |           21.6 MB |
| `p5`    | _SELF PORTRAITS AND BEHIND THE SCENES_                 |             13 |                0 |        `1* / 12`         |        `3 / 5 / 5`         |              17 |         0 |                    3 |           23.9 MB |
| `p6`    | _HYPERSTARS SUCKED INTO THE HYPERMASSIVE_              |             32 |               11 |         `32 / 0`         |       `4 / 11 / 17`        |              70 |        43 |                    2 |           32.0 MB |
| **All** | **Unified Eligible Pool (`p1`–`p6` `index.md`)**       |        **127** | **12 (Ignored)** |      **`51 / 76`**       |     **`22 / 38 / 67`**     |         **122** |    **43** |               **10** |      **201.0 MB** |

_(`*Note on p5`: 12 of 13 sequenced frames in `p5` are color, while 1 frame—`assets/img/p5/DSCF9004-3.jpg`, the opener self-portrait in a white helmet—is a warm-tinted monochrome image with 95th-percentile RGB channel delta $P_{95} = 11$ and mean channel delta $6.1$, documented in `assets/img/p5/commentary.json` as `"Monochrome, high-grain self-portrait"`.)\_

#### Key Material Findings (127 Eligible Pool Photographs)

1. **Strict Pool Boundary (`index.md` Gatekeeping)**:
    - Only the **127 JPEG filenames explicitly listed in `assets/img/p1..p6/index.md`** are ingested into the photobook pool.
    - The 12 unsequenced JPEGs on disk (`p3/DSCF2056-2.jpg` and 11 files in `p6/`) are outtakes rejected during gallery curation and are **strictly ignored** by the book pipeline.
2. **Disjoint Modality Partition: 51 Black-and-White (`40.2%`) vs. 76 Color (`59.8%`)**:
    - Measuring per-pixel RGB channel spread $\Delta_{\text{RGB}} = \max(|R-G|, |G-B|, |R-B|)$ across a `160 × 160` downsample of each eligible image via `sharp` partitions the current 127-photo pool. The classifier must record its metric version and confidence and permit human override; neutralizing the tinted monochrome frame is an output-profile derivative decision, not a destructive source edit.
        - **Pure B&W (`50` frames, $P\_{95}(\Delta\_{\text{RGB}}) \le 3$):** All `18` frames in `p1` and all `32` frames in `p6`. These grayscale files are stored as 3-channel RGB JPEGs, including 4 with Display P3 ICC tags.
        - **Tinted / Warm Monochrome (`1` frame, $3 < P\_{95}(\Delta\_{\text{RGB}}) \le 12$):** `p5/DSCF9004-3.jpg` ($P_{95} = 11$). Its slight warm cast means the optimizer must not assume exactly zero chroma for every member of the B&W component.
        - **Color (`76` frames, $P\_{95}(\Delta\_{\text{RGB}}) > 12$):** All `21` frames in `p2`, all `23` in `p3`, all `20` in `p4`, and `12` in `p5`.
    - The graph components are **disjoint**, not bipartite. A verso/recto assignment model could be bipartite, but that would be a separate mathematical construction. Pair counts must distinguish all permissible pairs from cross-series pairs:

    | Modality | Web-series groups   | All same-modality pairs | Intra-series pairs | Actual cross-series pairs |
    | -------- | ------------------- | ----------------------: | -----------------: | ------------------------: |
    | B&W      | `18 / 32 / 1`       |               **1,275** |                649 |                   **626** |
    | Color    | `21 / 23 / 20 / 12` |               **2,850** |                719 |                 **2,131** |
    | Combined | 127 frames          |               **4,125** |              1,368 |                 **2,757** |

3. **Uniform 3:2 Landscape Orientation & Photometric Chiaroscuro Distribution**:
    - **100% (`127 / 127`) of the eligible photographs are Landscape (`width > height`, 3:2 aspect ratio)**. There are zero portrait-orientation photographs in the sequenced pool.
    - Across the 127 frames, **38 are Exhalations** (`luma255 ≤ 75`), **67 are Grounding** (`75 < luma255 < 135`), and only **22 are Inhalations** (`luma255 ≥ 135`). Thus **82.7% (`105 / 127`)** operates in low-key shadow or mid-tone atmospheric density. These thresholds use the existing parser's weighted sRGB luma on a **0–255** scale. CIELAB lightness remains a separate versioned field, `lab.L`, on a **0–100** scale; the current chromatic transition metric is explicitly **CIE76**, not a generic modern perceptual difference.
4. **Pixel dimensions & effective print resolution**:
    - **114 of 127 eligible JPEGs** have a long edge of **`2048 px`** (`109` at `2048 × 1365` and `5` at `2048 × 1364`), i.e., standard 3:2 aspect ratio exported at `240 DPI` metadata tag. That metadata tag does not determine effective PPI; effective PPI is source pixels divided by placed physical dimensions.
    - **5 of 127 JPEGs** are higher-resolution exports (`p3`: `6240 × 4160` at 28.9 MB and `4675 × 3117` at 8.5 MB; `p5`: `3840 × 2560` at 5.6 MB, `3475 × 2268` at 4.9 MB, and `3079 × 2045` at 2.9 MB). **8** are lower-resolution crops, so preflight must be per placement rather than a pool-wide average.
    - At the proposed **300 × 200 mm** trim, `2048 × 1365 px` yields **173.355 PPI**; at **306 × 206 mm** including 3 mm bleed, it yields **168.306 PPI**. Its maximum widths at 200 / 240 / 300 PPI are **260.096 / 216.747 / 173.397 mm**, respectively. For screen/display viewing, the export remains useful without upscaling; for a physical edition, reduce page/placement size, explicitly accept and physically proof a lower-PPI artist's edition, or map the same logical `assetId` to full-resolution archive sources.

    ![Effective resolution of 2048 × 1365 px sources at candidate page sizes](assets/photobook-ebook-review/effective-resolution.png)

    | Required output geometry     |            200 PPI |            240 PPI |            300 PPI |
    | ---------------------------- | -----------------: | -----------------: | -----------------: |
    | 300 × 200 mm trim            | **2363 × 1575 px** | **2835 × 1890 px** | **3544 × 2363 px** |
    | 306 × 206 mm including bleed |                  — |                  — | **3615 × 2434 px** |

    Blurb's production checklist recommends 300 PPI, bleed checks, 200% inspection, calibrated soft proofing, and a physical proof; archival PDF/A status does not alter any of these pixel requirements. [Blurb image-quality checklist](kimi-cite://web?url=https%3A%2F%2Fwww.blurb.com%2Fblog%2Fimage-quality-checklist%2F 'citation') The arithmetic in this subsection is reproducible with `python docs/assets/photobook-ebook-review/calculate_metrics.py`.

5. **Mixed ICC Color Profiles (`sRGB` + `Display P3`)**:
    - Among the 127 eligible JPEGs, **117 carry `sRGB IEC61966-2.1`** and **10 carry Apple `Display P3` ICC profiles** (`p1`: 2, `p2`: 2, `p4`: 1, `p5`: 3, `p6`: 2). Any PDF generator that strips ICC profiles and tags images as uncalibrated `/DeviceRGB` will cause the Display P3 color images to appear desaturated or hue-shifted in color-managed PDF viewers.
6. **Multilingual Typography (`Latin` + `Simplified Chinese`)**:
    - `assets/img/p6/index.md` contains 43 lines of Simplified Chinese verse interleaved with English stanzas.
    - While `assets/fonts/` stores web-only `.woff2` subsets (`syne-latin.woff2`, `syne-latin-ext.woff2`, `glowsans-sc-extended-bold.subset.woff2`), verification of `/Users/lz/Library/Fonts/` and [`tools/subset_fonts.py`](file:///Users/lz/dev/ryusoh.github.io/tools/subset_fonts.py#L17-L22) confirmed that all 18 full OpenType weights/widths of `GlowSansSC` (`GlowSansSC-Extended-*.otf` and `GlowSansSC-Wide-*.otf`) are installed locally on this machine.

---

### 4.2 Toolchain Evaluation Against Primary Sources

#### 1. Typst (`v0.15.1`) — Primary Recommended Engine

- **Lossless JPEG Passthrough & ICC Profile Preservation**:
    - In [`crates/typst-pdf/src/image.rs`](https://github.com/typst/typst/blob/v0.15.1/crates/typst-pdf/src/image.rs#L194-L230), `convert_raster()` checks `if let RasterFormat::Exchange(ExchangeFormat::Jpg) = raster.format()` and invokes `krilla::image::Image::from_jpeg_with_icc()`, passing the raw file buffer (`raster.data()`) and extracted ICC profile (`raster.icc()`).
    - A code comment in `exif_transform()` (`crates/typst-pdf/src/image.rs:219-221`) explicitly notes: `"For JPEGs, we want to apply the EXIF orientation as a transformation because we don't recode them."`
    - In `krilla` (`v0.8.2`), [`crates/krilla/src/graphics/image/mod.rs`](https://github.com/LaurenzV/krilla/blob/main/crates/krilla/src/graphics/image/mod.rs#L517-L545) serializes `Repr::Jpeg` via `FilterStreamBuilder::new_from_jpeg_data(j.data.as_ref())` with `/Filter /DCTDecode` and attaches the `ICCBasedColorSpace` object reference (`image_x_object.pair(Name(b"ColorSpace"), icc_ref)`).
    - In Typst's [`image` function reference](https://typst.app/docs/reference/visualize/image/#parameters-icc), the `icc` parameter defaults to `auto`: `"When set to auto, Typst will try to extract an ICC profile from the image."`
- **Page Geometry, Bleed, and TrimBox**:
    - Typst's [`page` setup](https://typst.app/docs/reference/layout/page/) supports arbitrary `width`, `height`, `margin` (including `inside` and `outside` for bound spreads), `binding` (`left` or `right`), and—added in Typst `0.15.0` ([0.15.0 Changelog](https://typst.app/docs/changelog/0.15.0/))—`bleed`: `"In PDF export, if the bleed is non-zero, a TrimBox is defined for the page."`
- **Data-Driven Authoring (`json()` / `yaml()`)**:
    - Typst natively loads structured files via [`json("path.json")`](https://typst.app/docs/reference/data-loading/json/) and [`yaml("path.yaml")`](https://typst.app/docs/reference/data-loading/yaml/), allowing `book/photobook.typ` to render directly from `yaml("sequence.yaml")`.
- **Typography, CJK Support, and Font Format Constraints**:
    - Typst's [`text` element](https://typst.app/docs/reference/text/text/#parameters-font) accepts a priority fallback array `#set text(font: ("Syne", "Glow Sans SC Extended"), cjk-latin-spacing: auto)` and supports `covers: "latin-in-cjk"`.
    - Font loading in `typst-kit` delegates to `fontdb` ([`RazrFalcon/fontdb/src/lib.rs:301`](https://github.com/RazrFalcon/fontdb/blob/master/src/lib.rs#L301)): `"Will load ttf, otf, ttc and otc fonts."` Typst **does not load `.woff2` web fonts**. Although `GlowSansSC-*.otf` is installed locally and `Syne` exists in the repo as `.woff2`, a reproducible book build must vendor and hash-pin the exact static `.ttf`/`.otf` Latin and CJK font files and their license notices rather than depending on system fonts.
- **PDF Standards, Outlines, and Reproducibility**:
    - Per the [Typst PDF Reference](https://typst.app/docs/reference/pdf/), `--pdf-standard` supports `1.4`, `1.5`, `1.6`, `1.7` (default), `2.0`, `a-1b`, `a-1a`, `a-2b`, `a-2u`, `a-2a`, `a-3b`, `a-3u`, `a-3a`, `a-4`, `a-4f`, `a-4e`, and `ua-1`. **PDF/X (`pdf/x-1a`, `pdf/x-4`) is not yet natively supported by Typst `0.15.1`.**
    - Headings with `bookmarked: true` (or `outlined: true` by default) automatically populate the PDF bookmark outline tree ([`heading.bookmarked`](https://typst.app/docs/reference/model/heading/#parameters-bookmarked)).
    - Typst provides timestamp inputs through `--creation-timestamp <UNIX_TIMESTAMP>` or `SOURCE_DATE_EPOCH` ([`crates/typst-cli/src/args.rs:425-429`](https://github.com/typst/typst/blob/v0.15.1/crates/typst-cli/src/args.rs#L425-L429)) and isolated font loading through `--ignore-system-fonts --font-path assets/fonts`. These are necessary controls, not a complete reproducibility guarantee; §8.2 defines the remaining environment and final-artifact requirements.

#### 2. Headless Chrome (`v157.0.8103.79`) + CSS Paged Media — Zero-Install Alternative

- **Empirical Verification of Lossless JPEG & Display P3 ICC Passthrough**:
    - Inspection of Chromium's Skia PDF backend ([`src/pdf/SkPDFBitmap.cpp:287-395`](https://skia.googlesource.com/skia/+/refs/heads/main/src/pdf/SkPDFBitmap.cpp)) shows that `serialize_image()` calls `do_jpeg()` on `img->refEncodedData()`. When the JPEG uses standard 3-channel YUV (`kYUV_Color`) or 1-channel Gray (`kGray_Color`) and top-left EXIF orientation (`kTopLeft_SkEncodedOrigin`), Skia streams the encoded JPEG bytes directly into a `/DCTDecode` XObject and writes the embedded ICC profile via `write_icc_profile()` as an `/ICCBased` stream.
    - We verified this experimentally on this machine using `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome --headless --no-pdf-header-footer --print-to-pdf` with `assets/img/p1/DSCF4775.jpg` (`sRGB`, `430,056 bytes`, SHA-256 `998b853567fd...`) and `assets/img/p1/DSCF4402-8.jpg` (`Display P3`, `706,239 bytes`, SHA-256 `d805255e0ee0...`), as well as `assets/img/p4/DSCF6872-5.jpg` (`Display P3`, `1,299,992 bytes`) styled with `object-fit: cover`.
    - Result: Chrome (`Producer: Skia/PDF m157`) embedded the **exact original byte streams** (`SHA-256` identical to the source files on disk) as `/Filter /DCTDecode` objects and attached both the `3,144-byte` `sRGB IEC61966-2.1` and `536-byte` `Display P3` (`acspAPPL`) `/ICCBased` color space streams.
- **CSS Paged Media Support in Modern Chrome**:
    - Starting in **Chrome 131** ([Chrome Developer Blog](https://developer.chrome.com/blog/print-margins), [ChromeStatus #5195769732923392](https://chromestatus.com/feature/5195769732923392)), Chromium natively supports all **16 CSS `@page` margin boxes** (`@top-left`, `@bottom-right`, etc.) and page counters (`counter(page)`, `counter(pages)`), eliminating the historical need for the Paged.js polyfill (`v0.4.3`, last published to npm in July 2023) for running headers and folios.
    - Chrome 85+ supports CSS named pages (`@page chapter { ... }`, [ChromeStatus #5173237715566592](https://chromestatus.com/feature/5173237715566592)), and Chrome 157 CLI `--generate-pdf-document-outline` (or Puppeteer `PDFOptions.outline: true`) was verified on this machine to generate native PDF `/Outlines` from HTML `<h1>`–`<h6>` headings.
- **Limitations Relative to Typst**:
    - Always outputs PDF 1.4 (`Skia/PDF`); no native PDF/A or PDF/X conformance, no `/TrimBox` or `/BleedBox` emission for commercial print bleed, and no `SOURCE_DATE_EPOCH` flag for bit-identical reproducible builds.

#### 3. Other Evaluated Toolchains (WeasyPrint, Prince, LaTeX, Lightroom, InDesign)

- **WeasyPrint (`v70.0`, BSD License)**:
    - Supports `--pdf-variant` for both PDF/A (`pdf/a-1b` through `pdf/a-4u`) and **PDF/X (`pdf/x-1a`, `pdf/x-3`, `pdf/x-4`, `pdf/x-5g`)** ([WeasyPrint API Reference](https://doc.courtbouillon.org/weasyprint/stable/api_reference.html)).
    - However, source inspection of [`weasyprint/images.py:134-158`](https://github.com/Kozea/WeasyPrint/blob/main/weasyprint/images.py#L134-L158) revealed a critical color-management defect for this repo: `RasterImage.draw()` hardcodes `color_space = '/DeviceRGB'` on every RGB image XObject and never extracts per-image embedded ICC profiles from Pillow (`pillow_image.info.get('icc_profile')`). Thus, the Display P3 photographs in `p1`–`p6` would have their wide-gamut pixel values misinterpreted as uncalibrated `/DeviceRGB`.
- **Prince XML (`v16`, Commercial)**:
    - Full support for CSS Paged Media, JPEG passthrough, ICC profiles, PDF/A, PDF/X-4 (`--pdf-profile=PDF/X-4 --pdf-output-intent=...`), and CSS viewer preferences (`@prince-pdf { -prince-pdf-page-layout: two-page-right; }`, [Prince Output Docs](https://www.princexml.com/doc/prince-output/)).
    - Disqualified as primary recommendation due to proprietary licensing ($495 desktop / $2,000+ server license; free license injects a promotional watermark on the document).
- **Adobe Lightroom CC vs. Lightroom Classic**:
    - This machine has **Adobe Lightroom CC** (`/Applications/Adobe Lightroom CC`), the cloud-centric desktop client. The **Book Module** (Blurb integration and multi-page PDF book export) exists **exclusively in Adobe Lightroom Classic** ([Adobe Helpx: Create photo books in Lightroom Classic](https://helpx.adobe.com/lightroom-classic/help/create-photo-books.html)), not in Lightroom CC.
    - Even in Lightroom Classic, book layouts are locked inside a binary SQLite `.lrcat` catalog outside Git, cannot parse `assets/img/p<N>/index.md` or `commentary.json`, and restrict page dimensions to fixed Blurb trim templates.

### 4.3 Toolchain Comparison Matrix

| Capability / Criterion                  | **Typst (`v0.15.1`)** (Recommended)              | **Headless Chrome (`m157`)** (Zero-Install)       | **WeasyPrint (`v70.0`)**                         | **Prince XML (`v16`)**                       | **LaTeX (`LuaLaTeX`)**                | **InDesign / Affinity / LrC**        |
| :-------------------------------------- | :----------------------------------------------- | :------------------------------------------------ | :----------------------------------------------- | :------------------------------------------- | :------------------------------------ | :----------------------------------- |
| **Driven directly from YAML/JSON**      | Native (`json()`, `yaml()`)                      | Via Node HTML generator                           | Via Node/Python HTML generator                   | Via Node HTML generator                      | Requires TeX escaping & codegen       | Manual GUI import (breaks Git sync)  |
| **Lossless JPEG `/DCTDecode` embed**    | Yes (`krilla::Image::from_jpeg_with_icc`)        | Yes (verified in `SkPDFBitmap.cpp` & locally)     | Yes (when `optimize` & `jpeg_quality` unset)     | Yes (unless `-prince-image-magic` set)       | Yes                                   | Re-encodes at export quality setting |
| **Per-image Display P3 ICC preserved**  | **Yes** (`icc: auto` extracts embedded ICC)      | **Yes** (verified 536-byte P3 `/ICCBased` stream) | **No** (hardcodes `/DeviceRGB` in `images.py`)   | **Yes**                                      | Requires manual `/ColorSpace` objekts | Converts to single export space      |
| **CJK (`p6`) + Latin (`Syne`) layout**  | Native fallback list + `cjk-latin-spacing: auto` | Native browser font fallback + `.woff2` support   | Pango font fallback                              | Native CSS font fallback                     | `luatexja` package (complex setup)    | Manual style mapping                 |
| **Font formats accepted**               | `.ttf`, `.otf`, `.ttc`, `.otc` (no `.woff2`)     | `.woff2`, `.ttf`, `.otf`                          | `.woff2`, `.ttf`, `.otf`                         | `.woff2`, `.ttf`, `.otf`                     | `.ttf`, `.otf`                        | `.ttf`, `.otf`                       |
| **Print bleed & `/TrimBox` support**    | **Yes** (`#set page(bleed: 3mm)` in `0.15+`)     | No (`/MediaBox` only)                             | Yes (`@page { bleed: 3mm }`)                     | Yes (`@page { prince-bleed: 3mm }`)          | Via `geometry` / `crop` packages      | Yes                                  |
| **PDF/A & PDF/X standards**             | PDF/A-1..4, PDF/UA-1 (no PDF/X yet)              | None (PDF 1.4 only)                               | PDF/A-1..4, PDF/UA-1..2, PDF/X-1a/3/4            | PDF/A-1..3, PDF/UA-1, PDF/X-1a/3/4           | Via `pdfx` / LaTeX PDF management     | PDF/X-1a, PDF/X-3, PDF/X-4           |
| **Deterministic (`SOURCE_DATE_EPOCH`)** | **Yes** (`--creation-timestamp`)                 | No (`CreateDate` changes every run)               | Partially                                        | No                                           | Yes (`FORCE_SOURCE_DATE=1`)           | No                                   |
| **Install & License footprint**         | `brew install typst` (~15 MB single binary, OSS) | **Already installed** (`Google Chrome.app`)       | `brew install weasyprint` (Python + Cairo/Pango) | Proprietary ($495–$2,000+, free watermarked) | `brew install --cask mactex` (4+ GB)  | Proprietary GUI apps                 |

---

## 5. Global Agentic Orchestration ("The Bitter Lesson") & Long-Term Lifecycle

### 5.1 Applying Rich Sutton's _The Bitter Lesson_ to Photobook Curation

In _The Bitter Lesson_ ([Sutton, 2019](http://www.incompleteideas.net/IncIdeas/BitterLesson.html)), Sutton argues for general methods that leverage search and learning as computation scales. Applied here, the useful insight is to explore more visual arrangements rather than encoding only web-folder adjacency. It does **not** supply an objective verifier for photographic meaning or literary quality. The machine can compute colorimetry, geometry, gaze, and semantic motifs—the Barthesian **_studium_**—while the human author supplies the **_punctum_**, lived biographical truth, and final editorial judgment. Search therefore expands the candidate space; it never becomes an autonomous acceptance oracle.

The initial optimizer should be modest, deterministic, and inspectable: **seeded multi-start beam search followed by local moves** such as swaps, relocations, bounded reversals, and alternative approved spread archetypes. It should emit several Pareto-diverse proposals—one emphasizing cross-series montage, another tonal breathing, another geometric continuity, and another preservation of the current order—each with a structured diff and per-objective score deltas. A candidate is valid only if it satisfies every hard constraint. A locked spread, banned pair, rights failure, modality violation, missing required placement, or recto/verso parity error cannot be traded away against a better aesthetic score.

| Search layer           | Initial implementation                                                      | Later option only if measurements justify it                  |
| ---------------------- | --------------------------------------------------------------------------- | ------------------------------------------------------------- |
| Candidate construction | Seeded multi-start beam search with bounded candidate lists                 | CP-SAT for tightly constrained global subproblems             |
| Local improvement      | Swaps, relocations, bounded reversals, archetype alternatives               | Simulated annealing or larger-neighborhood search             |
| Editorial diversity    | Several seeded candidates with explicit objective weights                   | Multi-objective Pareto optimization with stored history       |
| Hard constraints       | Predicate validation before scoring                                         | Circuit constraints for a Hamiltonian-path/cycle formulation  |
| Explanation            | Per-move reason, score delta, constraint checks, before/after contact sheet | Natural-language summary grounded only in the structured diff |
| Acceptance             | Human approval against a specific parent ledger revision                    | No autonomous acceptance tier                                 |

Within the disjoint B&W and Color components, all **4,125 same-modality pairs** remain available, including same-series transitions; the **2,757 cross-series pairs** can receive their own explicitly named objective. The color component can use CIE76 chromatic distance, `lab.L` contrast, `luma255` respiratory cycles, and gaze/vector momentum. The B&W component emphasizes luminance steps, local tonal entropy/grain, and compositional geometry without assuming that its tinted member has exactly zero chroma. Macro-editing may propose a **75–100 frame monograph cut** or retain all 127 frames, but omissions remain reviewable proposals. Each spread is evaluated as a unified verso/recto composition using the archetypes in §6.3, not inferred from the PDF viewer's `/TwoPageRight` preference.

The text policy remains **silence, verbatim retrieval, and appendix**. Most spreads contain no body text. The closed Authentic Text Pool consists of human-curated stanzas and optional author-supplied fragments, but each fragment needs a stable `fragmentId`, exact source range, verbatim text, language, author/attribution, originality status, rights/review status, and excerpt policy. Selecting and placing a complete fragment can be automated as a proposal. Abridgement requires a separate excerpt-range proposal and human approval; third-party footer/citation attribution can never be dropped. AI analytical commentary belongs in the back-of-book Plate Index/System Colophon, not as synthetic poetry between plates. A small deterministic index or direct model-assisted retrieval is sufficient for roughly 122 fragments; a vector database is unnecessary at this scale.

### 5.2 Versioned State Ledger, Text Provenance, and Long-Term Maintenance

In accordance with the repository's **State-Oriented Architecture**, approved book structure lives in `book/sequence.yaml`; candidate proposals and derived inventories live elsewhere. The ledger uses stable logical IDs rather than array positions or filenames as identity. A photograph retains its `assetId` after a crop/color re-export, while `sourceSha256` identifies the new byte revision. Every proposal records its parent ledger revision, source fingerprint, generator version, random seed, objective configuration hash, and metric versions. Approval applies only when the parent revision still matches, and schema migrations are explicit and tested.

The following is an **illustrative contract, not an implemented file**. Output-specific dimensions, ICC operations, and rendering options belong in versioned output profiles; the editorial ledger records only the selected profile reference and output-independent decisions.

```yaml
schemaVersion: 1
editionId: 'infinite-systems'
revision: 1
parentRevision: null
sourceFingerprint: '<canonical-source-set-hash>'
approval:
    proposalId: 'manual-seed-001'
    reviewer: 'Zhuang Liu'
    approvedAt: '2026-11-17T00:00:00+08:00'
outputProfile: 'display-v1'
includeCommentaryAppendix: true

assets:
    - assetId: 'p1-dscf4775'
      source: 'assets/img/p1/DSCF4775.jpg'
      sourceSha256: '<64-hex-source-revision>'
      modality: 'bw'
      rightsStatus: 'approved'
      altText: 'A diagonal shaft of light crosses a dark transit car.'
    - assetId: 'p5-dscf9004-3'
      source: 'assets/img/p5/DSCF9004-3.jpg'
      sourceSha256: '<64-hex-source-revision>'
      modality: 'bw'
      rightsStatus: 'approved'
      altText: 'A high-grain self-portrait in a white helmet.'

fragments:
    - fragmentId: 'p1-lines-15-17'
      source: 'assets/img/p1/index.md'
      sourceRange: { startLine: 15, endLine: 17 }
      language: 'en'
      text: "The sun goes down\nI feel the light betray me"
      attribution: '<required-verbatim-attribution>'
      originality: 'third-party'
      rightsStatus: 'review-required'
      excerptPolicy: 'verbatim-only'

constraints:
    strictModalitySeparation: true
    pinnedOpenerAssetId: 'p1-dscf4775'
    pinnedCloserAssetId: 'p6-dscf0167-2'
    bannedAssetPairs:
        - ['p2-dscf8739', 'p4-dscf6872-5']

movements:
    - movementId: 'SYS.01'
      title: 'SINGULARITY'
      modality: 'bw'
      spreads:
          - spreadId: 's01'
            layout: 'monolith-epigraph'
            locked: true
            verso: { fragmentId: 'p1-lines-15-17' }
            recto: { assetId: 'p1-dscf4775', scale: 'full-bleed' }
```

| Contract area           | Required fields or semantic invariants                                                                                                  |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Envelope                | `schemaVersion`, edition/revision IDs, parent revision, canonical source fingerprint, approval provenance                               |
| Assets                  | Stable `assetId`, logical source path, `sourceSha256`, modality, rights status, alternative text or decorative designation              |
| Movements/spreads/pages | Stable IDs, ordered relationships, verso/recto parity, archetype, locks, pins, omissions                                                |
| Text fragments          | Exact source range, verbatim text, language, attribution, originality, rights/review status, excerpt policy                             |
| Constraints             | Locked spreads, banned pairs, pinned opener/closer, required/forbidden placements; all are hard constraints                             |
| Proposal                | Proposal ID, parent revision, generator/config/metric versions, seed, structured change reasons                                         |
| Output manifest         | Final page order, asset revisions and derivative recipes, effective PPI, ICC actions, font/tool/ICC hashes, page boxes, post-processing |
| Release evidence        | Final artifact and preflight hashes, two-build result, human visual/accessibility/print sign-offs where applicable                      |

#### How Long-Term Operations Work (`Add`, `Delete`, `Adjust`, `Resequence`)

`book-sync` is **plan-only by default**. A separate `book-apply --plan <id>` operation validates the approved plan and atomically replaces the ledger; it never chooses an autonomous repair. A new source revision invalidates derivatives and triggers revalidation of affected placements without changing the photograph's logical identity. Derived caches are content-addressed by source hash plus the complete canonical recipe, not by modification time and size.

| Editorial action                               | Inventory/plan behavior                                                                 | Approved-ledger behavior                                                |
| ---------------------------------------------- | --------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| Add a sequenced photo                          | Classify it with a versioned metric and add it to the **unplaced candidate pool**       | No automatic insertion; only an approved proposal may place it          |
| Drop an unsequenced file into `p<N>/`          | Ignore it, as with the current 12 outtakes                                              | No effect                                                               |
| Delete an unplaced photo                       | Remove it from future candidate pools                                                   | No effect                                                               |
| Delete a photo used by an unlocked spread      | Emit a deletion/repair proposal with affected pages and alternatives                    | Apply only after human review                                           |
| Delete a photo used by a **locked** spread     | Emit a blocking human-resolution conflict                                               | Never auto-delete or substitute                                         |
| Re-export a crop/color under the same filename | Preserve `assetId`; update `sourceSha256`; invalidate the source+recipe cache           | Retain placement, but require affected PPI/visual checks before release |
| Approve/reject a candidate spread              | Record locks, bans, or taste decisions as editorial input                               | Future proposals treat them as hard constraints                         |
| Re-orchestrate an edition                      | Generate a fresh candidate against the current approved revision and source fingerprint | Never overwrite the current edition directly                            |

### 5.3 Output Profiles, Content-Addressed Derivatives, and the 201 MB Payload

The 127 eligible JPEGs total **201.0 MB**, including several large exports and 50 pure-B&W photographs stored as 3-channel RGB JPEGs. Sharp is already a repository dependency, but the book must not reuse `ensureImageVariants()` from the web builder because that routine sanitizes source JPEG metadata. Book derivatives are written only under `.cache/book-img/`; originals remain read-only. Prior payload reductions are **estimates to be measured on the built artifact**, not guaranteed output sizes.

Output names must describe destinations rather than implying unrelated guarantees. A PDF can be small, archival, high-resolution, accessible, or press-ready independently of the other properties.

| Profile        | Purpose                               | Minimum contract                                                                                                                |
| -------------- | ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `screen`       | Portable electronic distribution      | Explicit sRGB conversion for transformed color assets, quality/size measurement, navigation and accessibility metadata          |
| `display`      | Higher-quality screen/display edition | Lossless JPEG passthrough where eligible or documented high-quality derivatives; no press-readiness claim                       |
| `archive-pdfa` | Long-term archival target             | A declared PDF/A level validated by veraPDF on the final post-processed file; resolution reported independently                 |
| `press`        | A specific physical printer/process   | High-resolution source mapping, trim/bleed/page boxes, effective-PPI gate, printer output intent, soft proof and physical proof |

Every derivative cache key is the hash of **`sourceSha256` + canonical recipe + Sharp/libvips version + ICC profile bytes**. The recipe records resize geometry, resampling, compression, grayscale/neutralization, and ICC behavior. Modification time and size are diagnostics only. Untouched JPEG passthrough and color-managed transformed derivatives are separate recipe classes. Sharp removes processed-output metadata by default, so ICC preservation or conversion must be deliberate and tested rather than inferred from the input. [Sharp output documentation](kimi-cite://web?url=https%3A%2F%2Fsharp.pixelplumbing.com%2Fapi-output%2F 'citation')

The tinted B&W frame may be neutralized only as an approved derivative recipe, while its source and logical asset identity remain unchanged. B&W screen derivatives may use one-channel grayscale after visual review. A future `press` profile maps the same `assetId` to sufficiently large archive exports and measures effective PPI from the actual placed bleed dimensions. Upscaling, if ever chosen, is an explicit reviewed recipe and does not make the underlying source genuinely higher resolution. PDF/X conversion is printer-specific: Ghostscript output-intent settings and every post-processing operation must be captured and validated, not replaced by a generic conversion command. [Ghostscript PDF documentation](kimi-cite://web?url=https%3A%2F%2Fghostscript.readthedocs.io%2F_%2Fdownloads%2Fen%2Flatest%2Fpdf%2F 'citation')

### 5.4 Setting Two-Page Spread View (`/PageLayout /TwoPageRight`)

Per **ISO 32000-1:2008 §7.7.2 (_Document Catalog_, Table 28)** ([PDF 32000-1:2008 Specification](https://opensource.adobe.com/dc-acrobat-sdk-docs/pdfstandards/PDF32000_2008.pdf)):

- `/PageLayout /TwoPageRight`: `"Display the pages two at a time, with odd-numbered pages on the right."` This is the standard photobook layout: Page 1 (the front cover) appears alone on the right-hand side, and subsequent even/odd pairs (`2–3`, `4–5`, ...) appear as facing spreads.
- `/PageMode /UseOutlines`: Opens the PDF with the movement bookmark sidebar visible.

`/TwoPageRight` is an **initial viewer preference**, not printer imposition and not a guarantee of reader behavior. Page order, recto/verso parity, and page boxes must be validated independently. If catalog finalization is required, the build script may set `/PageLayout /TwoPageRight` and `/PageMode /UseOutlines` without re-encoding image streams, then rerun every structural and standards check on the final artifact. QPDF provides structural/JSON inspection and `--deterministic-id`, but its documentation does not promise identical output across different QPDF versions; the post-processor version therefore belongs in the build manifest and two-build test. [QPDF CLI documentation](kimi-cite://web?url=https%3A%2F%2Fqpdf.readthedocs.io%2Fen%2Fstable%2Fcli.html 'citation')

---

## 6. Visual Design, Cover & Spread Layout Specification (_Infinite Systems_)

### 6.1 Conceptual Premise & Macro-Hemisphere Structure of _Infinite Systems_

The title _**Infinite Systems**_ unifies the subject matter of the photographs with the computational architecture that curates them:

1. **Thematic Layer (Within the Frames):** Across `p1`–`p6`, solitary human figures are caught inside vast, impersonal urban, transit, historical, and physical systems—BART transit cars, concrete overpasses, fogged glass, neon grids, state history (`p2`), spectral urban surveillance (`p4`), and gravitational collapse (`p6`).
2. **Methodological Layer (The Book Engine):** The monograph itself is an emergent trajectory through a modality-partitioned combinatorial state space (`1,275` B&W pairs + `2,850` Color pairs) governed by CIELAB colorimetry, respiratory luminance cycles, gaze vectors, and Hamiltonian transition energy.
3. **Macro-Book Architecture Driven by the `51 B&W / 76 Color` Split:**
    - Because mixing B&W and Color frames within a sequence breaks perceptual immersion, the `51 B&W` (`40.2%`) and `76 Color` (`59.8%`) split gives _**Infinite Systems**_ a natural macro-architecture. Two macro-structures are supported by `book/sequence.yaml`:
        - **Macro-Structure A — _The Chiaroscuro Envelope_ (`B&W Overture` $\to$ `Chromatic Core` $\to$ `B&W Singularity Coda`, Recommended):** Opens in austere B&W chiaroscuro (drawn from `p1` + `p5/DSCF9004-3.jpg`), crosses a full-spread **Chromatic Ignition Phase Boundary** into the 76-frame Color core (`p2`, `p3`, `p4`, `p5`—moving from daylight kinetic street choreography into nocturnal sodium/neon), and collapses back across an **Event Horizon Phase Boundary** into pure B&W for the final cosmic/subterranean movement (`p6`).
        - **Macro-Structure B — _The Biphasic Monograph_ (`Book I: Monochrome [51 Pool]` $\to$ `Book II: Chromatic [76 Pool]`):** Concentrates all B&W frames (`p1` + `p6` + `p5/DSCF9004-3.jpg`) into the first half of the book and all Color frames (`p2` + `p3` + `p4` + `p5-color`) into the second half, separated by a two-page `#070709` architectural reset spread.

Following [`docs/design-research.md`](file:///Users/lz/dev/ryusoh.github.io/docs/design-research.md#L58-L62), the visual direction is **Swiss-precise structural control framing hardboiled nocturnal photography**: razor-sharp grid geometry and restrained monospace telemetry acting as a quiet frame so the photographs carry 100% of the emotional violence.

### 6.2 Color Scheme & Surface Physics: "Obsidian Darkroom + Telemetry Red"

Because **82.7% (`105 / 127`)** of the eligible photographs are low-key Exhalations (`luma255 ≤ 75`) or mid-tone Grounding frames (`75 < luma255 < 135`), a white digital canvas can create distracting luminance contrast with the plates. A neutral `#070709` obsidian canvas unifies the B&W and Color movements while respecting their editorial separation. This screen-oriented surface requires a **separate print soft-proof strategy**: digital near-black does not translate directly to printable rich black, shadow detail, or total ink behavior.

Contrast ratios below were calculated against `#070709` using WCAG relative luminance. Meaningful small text requires at least **4.5:1**; decorative folios may be PDF artifacts, but plate numbers, telemetry, and colophon text that convey information cannot be made exempt merely by calling them decorative.

| Surface / token role            | Hex code                              | Contrast on obsidian | Permitted role                                                                   |
| ------------------------------- | ------------------------------------- | -------------------: | -------------------------------------------------------------------------------- |
| Primary Plate Canvas            | `#070709`                             |                    — | Obsidian page surface                                                            |
| Appendix / Dossier Canvas       | `#111317` or print-specific `#EAE6DF` |  Measure per pairing | Endmatter surface                                                                |
| Primary Display & Epigraph Text | `#E6E4DF`                             |         **15.840:1** | Primary text                                                                     |
| Secondary Epigraph Text         | `#D8D5CE`                             |         **13.733:1** | Secondary text                                                                   |
| Tungsten Grey                   | `#6E737B`                             |          **4.218:1** | Decorative only at small sizes; lighten for meaningful text                      |
| Dark Folio Grey                 | `#4A4E54`                             |          **2.405:1** | Non-text decoration only                                                         |
| Safelight / Telemetry Red       | `#CE2323`                             |          **3.727:1** | Large text or non-text accent; introduce a lighter red for small meaningful text |

The red accent remains restricted to movement phase-divider rules, waveform markers, and non-text cover telemetry, and is never placed on B&W plate spreads. The arithmetic is reproducible with `python docs/assets/photobook-ebook-review/calculate_metrics.py`.

### 6.3 Page Geometry (`300 × 200 mm`) & The Five Spread Layout Archetypes

#### 1. Trim Size: Exact `3:2` Landscape (`300 mm × 200 mm` Page / `600 mm × 200 mm` Open Spread)

- Because **100% (`127 / 127`) of the eligible photographs have a 3:2 landscape aspect ratio**, setting the single-page trim size to **`300 mm × 200 mm`** (`1.5 : 1` page ratio; `600 mm × 200 mm` / `3 : 1` panoramic dual-page spread in `TwoPageRight` view) guarantees that:
    - Any **full-bleed single-page plate** fills **100.0% of the page (`300 × 200 mm`) with zero cropping** of the original 3:2 camera frame.
    - Any **inset plate** maintains uniform, harmonic margins across top, bottom, and outer edges.

This is a **geometric** guarantee only. A common web export provides **168.306 PPI** when extended over the 306 × 206 mm bleed geometry, so this trim size is suitable for the display concept but is not a press-resolution decision. The output profile must either reduce placed dimensions, document and physically proof a lower-PPI choice, or substitute high-resolution sources while retaining the same `assetId`.

#### 2. The Five Spread Layout Archetypes (Preventing 3:2 Scale Monotony)

When every photograph shares the same 3:2 aspect ratio, placing identically sized centered rectangles on every page induces visual fatigue. To enforce Eisensteinian **Metric Montage** ([`docs/sequence-skill-architecture.md`](file:///Users/lz/dev/ryusoh.github.io/docs/sequence-skill-architecture.md#L66)), the layout engine maps each spread to one of five archetypes on a **12-column × 8-row Swiss modular grid**:

```text
+-----------------------+-----------------------+   +-----------------------+-----------------------+
|                       |                       |   |                       |  +-----------------+  |
|                       |  +-----------------+  |   |  FULL-BLEED PLATE     |  |  SMALL INSET    |  |
|     [VOID VERSO]      |  |  LARGE PLATE    |  |   |  (300 x 200 mm,       |  |  ECHO PLATE     |  |
|   or tiny epigraph    |  |  (82% width)    |  |   |   0mm margin)         |  |  (55% width)    |  |
|   at lower-left       |  +-----------------+  |   |                       |  +-----------------+  |
|                       |                       |   |                       |                       |
+-----------------------+-----------------------+   +-----------------------+-----------------------+
  1. THE MONOLITH (Slow / High Gravity)               2. ASYMMETRIC WEIGHT DIPTYCH (Call & Response)

+-----------------------+-----------------------+   +-----------------------+-----------------------+
|  +-----------------+  |  +-----------------+  |   |  +--------------+     |                       |
|  |                 |  |  |                 |  |   |  | UPPER-LEFT   |     |     +--------------+  |
|  |  VERSO PLATE    |  |  |  RECTO PLATE    |  |   |  | DRIFT PLATE  |     |     | LOWER-RIGHT  |  |
|  |  (74% width)    |  |  |  (74% width)    |  |   |  +--------------+     |     | DRIFT PLATE  |  |
|  +-----------------+  |  +-----------------+  |   |                       |     +--------------+  |
+-----------------------+-----------------------+   +-----------------------+-----------------------+
  3. SYMMETRIC COLLISION (Direct Slant Rhyme)         4. DIAGONAL MODULAR OFFSET (Kinetic Counterpoint)
```

1. **Archetype 1 — `The Monolith` (`monolith` / `monolith-epigraph`, ~30% of spreads):**
    - Left page (`verso`) is pure `#070709` negative space (or carries a 2-line retrieved authentic epigraph anchored at the lower-left grid intersection); right page (`recto`) holds a single full-bleed (`100%`) or large inset (`82%` width) plate. Used for movement openers, deep Exhalations (`luma255 ≤ 75`), and emotional climaxes.
2. **Archetype 2 — `Asymmetric Weight Diptych` (`asymmetric-diptych`, ~25% of spreads):**
    - One page is `100%` full-bleed (`0 mm` margin, visceral primary impact); the facing page holds a smaller `55%`-width inset plate of the **same modality (`bw` or `color`)** surrounded by deep obsidian margin, acting as an observational echo or psychological afterimage.
3. **Archetype 3 — `Symmetric Collision Diptych` (`symmetric-diptych`, ~30% of spreads):**
    - Matched `74%`-width same-modality plates on both verso and recto (`18 mm` outer margin, `14 mm` inner spine margin) for direct Webb-style slant rhymes, opposing gaze vectors, or luminance/chromatic collisions across the gutter.
4. **Archetype 4 — `Diagonal Modular Offset` (`diagonal-offset`, ~10% of spreads):**
    - Verso plate anchored to the upper-left grid rows; recto plate anchored to the lower-right grid rows. Used for kinetic sequences (such as the street choreography frames in `p3`) to drive diagonal eye momentum across the spread.
5. **Archetype 5 — `System Phase Divider` (`phase-divider`, 4–5 spreads total):**
    - Marks emergent macro-movements and **B&W $\leftrightarrow$ Color phase boundaries** (`SYS.01 // SINGULARITY [MONOCHROME]`, `SYS.02 // KINEMATICS [CHROMATIC]`, `SYS.03 // PHANTOM [CHROMATIC]`, `SYS.04 // EVENT HORIZON [MONOCHROME]`). When transitioning between B&W and Color hemispheres, the divider inserts an additional silent `#070709` buffer spread so the viewer's chromatic adaptation resets cleanly before the new modality begins.

### 6.4 Typography System & Micro-Layout Rules

| Typographic Voice               | Typeface & Source Path                                                     | Scale, Tracking & Role                                                                                                                                                                               |
| :------------------------------ | :------------------------------------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **1. Display / Architectural**  | **`Syne`** (`ExtraBold 800` / `Bold 700`, `assets/fonts/`)                 | Book title (`28 pt`, tracking `+0.12em` uppercase) and movement headers (`14 pt`, tracking `+0.16em`).                                                                                               |
| **2. Bilingual Epigraph Verse** | **`Syne Regular`** (Latin) + **`GlowSansSC-Extended-Light/Regular`** (CJK) | Retrieved stanzas on `monolith-epigraph` and `phase-divider` spreads (`10 pt`, line-height `1.75`, color `#D8D5CE`, `cjk-latin-spacing: auto`).                                                      |
| **3. System Telemetry / Folio** | **Tabular Monospace** (`JetBrains Mono` / `SF Mono` / `DejaVu Sans Mono`)  | Outer-corner plate numbers (`7.5 pt`, `tabular-nums`, `#D8D5CE` when meaningful), movement coordinates, and back-of-book CIELAB / EXIF tables (`8 pt`). `#4A4E54` is restricted to decorative marks. |

- **Zero Captions on Plate Spreads:** Never print filenames, titles, dates, or AI commentary beneath photographs on plate pages. Only a minimal `7.5 pt` tabular-monospace plate index (`042`) appears in the bottom outer margin (`10 mm` from trim) on inset pages, and is suppressed entirely on full-bleed pages. If the number conveys navigation information, it uses an accessible text token and has a nonvisual semantic equivalent.
- **Achromatic Purity on B&W Plate Spreads:** On all spreads within a `modality: 'bw'` movement, zero chromatic elements (`#CE2323` or otherwise) may appear. Meaningful folio numbers use neutral `#D8D5CE`; `#4A4E54` is decorative only; epigraph text uses neutral `#D8D5CE` so the viewer remains in monochrome adaptation.

### 6.5 Cover Design Concepts for _Infinite Systems_

```text
+-------------------------------------------------------------------+
|  SYS // 2021–2026                                      ZHUANG LIU |
|  ---------------------------------------------------------------  | <- 0.5pt #CE2323 rule
|  INFINITE SYSTEMS                                                 | <- Syne ExtraBold 800, tracked
|                                                                   |
|                                   +----------------------------+  |
|                                   |                            |  |
|                                   |   [Hero Chiaroscuro Frame  |  |
|                                   |    e.g. p1/DSCF4775.jpg    |  |
|                                   |    shaft of light in dark] |  |
|                                   |                            |  |
|  /\    /\  /\      /\             +----------------------------+  |
| /  \  /  \/  \  /\/  \___/\                                       | <- Hairline L*(t) luminance
| ---------------------------                                       |    waveform of the book
|  127 STATES · 51 MONO / 76 CHROMA                        [PDF.01] |
+-------------------------------------------------------------------+
```

1. **Option A (Recommended) — _The Cybernetic Monolith_ (MACK / Lars Müller Systems Aesthetic):**
    - Sets `INFINITE SYSTEMS` in `Syne ExtraBold` across the upper Swiss grid above a `0.5 pt` `#CE2323` rule on `#070709` Obsidian Void.
    - Anchors an asymmetric inset chiaroscuro photograph (such as `p1/DSCF4775.jpg`, the diagonal shaft of sunlight piercing the dark transit car) on the right grid columns, balanced on the lower-left by the actual **Photometric Luminance Waveform `luma255(t)`** of the compiled book rendered as a razor-sharp vector trace and the system spec line `127 STATES · 51 MONO / 76 CHROMA`.
2. **Option B — _Full-Bleed Nocturne with Negative-Space Typography_ (Steidl / Moriyama Style):**
    - Uses a full-bleed `300 × 200 mm` nocturnal photograph with expansive natural shadow (`p1/DSCF4775.jpg` or `p6/DSCF8985-2.JPG`), placing `INFINITE SYSTEMS` (`18 pt` `Syne Bold`, tracking `+0.18em`, `#E6E4DF`) and `ZHUANG LIU` (`9 pt` monospace) directly inside the dark negative space of the image with zero boxes or borders.
3. **Option C — _The State-Space Matrix_ (Contact-Sheet Dossier Cover):**
    - Renders a Swiss contact-sheet matrix of all 127 colorimetric CIELAB `(lab.L, lab.a, lab.b)` swatches on `#070709`—visually revealing the 51 achromatic grayscale swatches alongside the 76 chromatic swatches—with a `#CE2323` crosshair highlighting the opener state and `INFINITE SYSTEMS` spanning the upper grid.

### 6.6 Back-of-Book "System Colophon & Plate Index"

Because the monograph is titled _**Infinite Systems**_ and is orchestrated by an agentic neuro-symbolic pipeline, the final 6–8 pages of the PDF make the underlying system visible as part of the artwork:

1. **System Telemetry Spread:** Embeds the full-book **Photometric Luminance Waveform `luma255(t)`** (showing the B&W and Color phase regions) and **Hamiltonian Pairwise Transition Energy Graph** (generated by [`.agents/skills/sequence/scripts/charts.mjs`](file:///Users/lz/dev/ryusoh.github.io/.agents/skills/sequence/scripts/charts.mjs)) across a double-page spread. CIELAB telemetry is reported separately as `lab.L`, `lab.a`, and `lab.b`.
2. **Illustrated Plate Index & Curatorial Notes:** A structured contact-sheet index (`[001]`–`[N]`) pairing miniature thumbnails with their source coordinates (`p1`–`p6`), modality tag (`MONO` vs. `CHROMA`), CIELAB values (`L*, a*, b*`), and the curatorial critique from `assets/img/p1..p6/commentary.json`.

### 6.7 Accessibility, Reading Order, and Font Provenance

Accessibility is a semantic and review requirement, not a compiler flag. Typst's accessibility guidance requires meaningful semantic elements, explicit reading order, alternative text for meaningful images, language and region, a document title, and both automated and manual testing. [Typst accessibility guide](kimi-cite://web?url=https%3A%2F%2Ftypst.app%2Fdocs%2Fguides%2Faccessibility%2F 'citation') The ledger therefore needs alternative text or an explicitly decorative designation for each placement, language metadata for mixed Latin/CJK fragments, movement and heading semantics, and a reading-order policy for asymmetric spreads. PDF/UA validation, when claimed, applies to the final post-processed file and does not replace assistive-technology review.

Fonts must be self-contained, hash-pinned, and distributed with their license notices. Typst does not load the repository's `.woff2` files, so the build needs pinned `.ttf`/`.otf` binaries for both Latin and CJK rather than relying on `/Users/lz/Library/Fonts`. Syne is licensed under SIL OFL 1.1; the exact font files and license text used by the book still need to be versioned. [Syne license](kimi-cite://web?url=https%3A%2F%2Fraw.githubusercontent.com%2Fgoogle%2Ffonts%2Fmain%2Fofl%2Fsyne%2FOFL.txt 'citation') Font preflight must inspect embedding/subsetting and missing glyphs, including CJK punctuation.

EPUB is not an implied output of the PDF pipeline. If fixed-layout EPUB later becomes a target, it needs a separate profile covering alternative descriptions, reading order, navigation, and small-screen legibility, plus EPUBCheck validation pinned at implementation time. [W3C fixed-layout EPUB accessibility](kimi-cite://web?url=https%3A%2F%2Fwww.w3.org%2FTR%2Fepub-fxl-a11y%2F 'citation')

---

## 7. Concrete Implementation Blueprint (When Ready to Build)

### 7.1 Directory Layout and Required Scripts

The implementation should use the repository's existing Node.js tooling and a single `scripts/book.mjs` dispatcher with focused modules under `scripts/book/`. Command names must expose the authority boundary: `inventory` observes, `optimize` proposes, `sync` plans, `apply` promotes an approved plan, and `render` consumes only an approved ledger revision. None of these scripts or Make targets exists yet; the names below are the proposed interface, not commands verified in this research session.

| Proposed file                | Responsibility                                                                                                                       | Default output and safety behavior                                     |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------- |
| `scripts/book/inventory.mjs` | Read explicitly listed photographs/text; hash bytes; inspect dimensions/ICC; compute versioned metrics; identify unplaced candidates | Disposable inventory JSON; **read-only toward all sources**            |
| `scripts/book/validate.mjs`  | JSON Schema plus semantic invariants, path safety, provenance, locks, parity, and output profiles                                    | Structured errors/warnings; no automatic repair                        |
| `scripts/book/assets.mjs`    | Content-addressed derivatives with explicit ICC behavior                                                                             | Writes only to `.cache/book-img/`; never mutates source images         |
| `scripts/book/optimize.mjs`  | Seeded, constraint-valid sequence/layout candidates                                                                                  | Proposal JSON and rationale; cannot write the approved ledger          |
| `scripts/book/sync.mjs`      | Diff inventory against approved state; detect additions, revisions, deletions, locked conflicts                                      | Plan by default; explicit apply requires plan ID and atomic validation |
| `scripts/book/layout.mjs`    | Approved ledger + output profile → renderer-neutral canonical layout IR                                                              | Deterministic JSON with stable ordering and effective-PPI annotations  |
| `scripts/book/render.mjs`    | Compile layout IR with Typst and perform pinned finalization                                                                         | Selected output profile, final manifest, post-processing record        |
| `scripts/book/proof.mjs`     | Rasterize final PDF spreads; generate contact sheets and candidate before/after diffs                                                | Review evidence, never approval                                        |
| `scripts/book/preflight.mjs` | Structural, geometry, image, font, metadata, standards, accessibility, reproducibility checks                                        | Machine-readable report; nonzero exit on required failures             |

The canonical data files are `book/sequence.yaml` for approved editorial state, versioned schemas under `book/schema/`, destination definitions under `book/profiles/`, optional authentic additions in `book/fragments.md`, and `book/photobook.typ` for the renderer. Candidate runs, layout IR, caches, proofs, and preflight output remain derived and gitignored. The approved ledger must not contain volatile absolute paths or unversioned metric output.

Proposed Make targets are `book-inventory`, `book-validate`, `book-plan`, `book-apply`, `book-orchestrate`, `book`, `book-proof`, `book-preflight`, and `book-repro`. `book-orchestrate` stops at candidate generation; `book` renders only approved state; `book-apply` requires a plan/proposal ID whose parent revision still matches; and `book-repro` builds the final post-processed artifact twice in clean temporary directories. These targets should not be documented as runnable examples until their implementations have actually been exercised.

### 7.2 Required Skill and External Tools

Add one canonical **`.agents/skills/photobook/SKILL.md`**, not a separate skill for every script. It should define edition lifecycle, strict source non-mutation, proposal/approval protocol, allowed file sets, artifact locations, locked-conflict behavior, and a resume protocol anchored in `git status`, approved ledger revision, and the active run manifest. The existing web-focused `sequence` skill offers reusable non-mutating low-level parsing and image analysis, but its plain-text extraction is not yet sufficient for book provenance. Share neutral metric code only when both consumers need the same versioned contract. A separate `book-release` or `print-handoff` skill is justified only when printer-specific work becomes recurrent. After adding the skill, regenerate commands with `python3 tools/sync_commands.py` and verify `make sync-check` as part of that implementation.

| Capability                     | Tool or skill               | Priority                        | Observed status / implementation note                                                                                                                                                       |
| ------------------------------ | --------------------------- | ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Editorial orchestration        | New `photobook` skill       | **MVP**                         | Proposal-only automation, explicit approval, disk-backed resume state                                                                                                                       |
| Schema validation              | **Ajv** + custom invariants | **MVP**                         | Not currently a dependency; use JSON Schema draft 2020-12 and machine-readable diagnostics. [Ajv documentation](kimi-cite://web?url=https%3A%2F%2Fajv.js.org%2Fjson-schema.html 'citation') |
| PDF compilation                | **Typst**                   | **MVP**                         | Not currently installed; pin compiler and self-contained fonts before build claims                                                                                                          |
| Structural PDF checks          | **QPDF**                    | **MVP**                         | Not currently installed; use structural checks, JSON inspection, deterministic finalization where appropriate                                                                               |
| PDF inspection/raster proofs   | **Poppler**                 | **MVP**                         | Not currently installed; inspect fonts/page data and rasterize the final artifact                                                                                                           |
| PDF/A or PDF/UA declaration    | **veraPDF**                 | **Before claiming conformance** | Not currently installed; validate the final file with the declared profile. [veraPDF CLI validation](kimi-cite://web?url=https%3A%2F%2Fdocs.verapdf.org%2Fcli%2Fvalidation%2F 'citation')   |
| Source/color inspection        | **Sharp, ExifTool**         | Existing / **MVP**              | Preserve originals; make ICC transformations explicit                                                                                                                                       |
| Optional PDF post-processing   | **Ghostscript, QPDF**       | Profile-dependent               | Ghostscript is installed; record every operation and avoid generic PDF/X recipes                                                                                                            |
| Browser renderer fallback      | Existing Headless Chrome    | Experimental alternative        | Useful for comparison, not the primary reproducible/standards pipeline                                                                                                                      |
| Constraint/global optimization | OR-Tools CP-SAT or pymoo    | Optional later                  | Add only after baseline proposals and objective benchmarks exist                                                                                                                            |
| Fixed-layout EPUB              | EPUBCheck                   | Only if EPUB is commissioned    | PDF support does not imply EPUB support                                                                                                                                                     |

Advanced solvers are not MVP dependencies. OR-Tools CP-SAT provides circuit constraints suitable for a later Hamiltonian formulation, while pymoo offers seeded multi-objective optimization and history. [OR-Tools CP-SAT documentation](kimi-cite://web?url=https%3A%2F%2For-tools.github.io%2Fdocs%2Fpdoc%2Fortools%2Fsat%2Fpython%2Fcp_model.html 'citation') [pymoo minimize interface](kimi-cite://web?url=https%3A%2F%2Fpymoo.org%2Finterface%2Fminimize.html 'citation') Neither addresses editorial authority, and introducing a Python optimization core before the JavaScript inventory and ledger contracts would add complexity without reducing the main risks. Likewise, avoid a general agent framework, a vector database for roughly 122 fragments, Paged.js as a second pagination engine, or another PDF library without a demonstrated missing capability.

---

## 8. Validation, Reproducibility, and Release Gates

### 8.1 Test Layers and Final-Artifact Preflight

Validation must occur at several layers because schema validation cannot establish editorial or PDF correctness. Automated tests use synthetic `p99`/`p98` fixtures and hermetic scratch paths, never production `p1`–`p6` membership, counts, or filenames. Behavioral changes require tests that fail before and pass after; no test may write into production asset directories.

| Test layer                 | Required cases                                                                                 | Release evidence                               |
| -------------------------- | ---------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| Schema and migration       | Old/new schema fixtures, unknown fields, invalid enums, migration idempotence                  | Validation report with no required errors      |
| Identity and path safety   | Duplicate IDs, missing assets, renamed paths, revised hashes, traversal attempts               | Structured diagnostics; no out-of-scope writes |
| Editorial constraints      | Locks, bans, pins, recto/verso parity, modality, required omissions                            | Constraint report for every candidate          |
| Text governance            | Verbatim ranges, attribution retention, third-party rights, excerpt approval                   | Fragment/provenance report                     |
| Derivative cache           | Source-byte, recipe, ICC, and tool-version changes; valid cache reuse                          | Content-addressed cache tests and manifest     |
| Optimizer                  | Same-seed reproducibility, distinct-seed diversity, invalid-move rejection, score explanations | Proposal JSON plus before/after proof          |
| PDF structure and geometry | QPDF check, page count, Media/Crop/Trim/Bleed boxes, catalog preferences                       | Final-artifact structural report               |
| Images and fonts           | Effective PPI, ICC actions, font embedding/subsetting, missing glyphs                          | Per-page image/font report                     |
| Standards/accessibility    | Declared veraPDF profile, title/language, alt text, reading order, contrast policy             | Automated report plus manual review record     |
| Reproducibility            | Two clean final builds with identical inputs and pinned environment                            | Hash comparison and semantic diff where needed |

Preflight runs on the **final post-processed PDF**, not just the Typst intermediate. QPDF checks structure and supports JSON inspection; Poppler supplies independent page/font inspection and raster proofs; custom checks calculate effective PPI from placed dimensions and assert page boxes, metadata, outlines, ICC actions, and font/glyph expectations. When PDF/A or PDF/UA is declared, veraPDF supplies machine-readable validation for that profile. These tools complement rather than replace one another.

### 8.2 Reproducible Build Perimeter

`SOURCE_DATE_EPOCH` standardizes a timestamp input, but reproducibility also depends on compiler and post-processor versions, OS/architecture where relevant, Sharp/libvips, exact fonts and licenses, ICC profiles, locale, timezone, input ordering, optimizer seed/configuration, metric versions, and every finalization step. [SOURCE_DATE_EPOCH specification](kimi-cite://web?url=https%3A%2F%2Freproducible-builds.org%2Fspecs%2Fsource-date-epoch%2F 'citation') Record this environment in the output manifest rather than claiming that one flag guarantees identical bytes. [Reproducible build environment](kimi-cite://web?url=https%3A%2F%2Freproducible-builds.org%2Fdocs%2Fperimeter%2F 'citation')

The release test compares two final artifacts produced in clean temporary directories. Byte comparison is desirable where the pinned toolchain supports it. If bytes differ, compare canonical layout IR and semantic PDF features—page order/boxes, text, image streams and ICC objects, fonts, outlines, and metadata—to locate the nondeterministic layer. QPDF's deterministic-ID option can remove one source of variation, but QPDF itself must be version-pinned. No release claim is based solely on an intermediate PDF or a single build.

### 8.3 Human Review That Cannot Be Automated Away

Editorial review judges sequence, omissions, fragment placement, and treatment of third-party text. Visual review inspects rasterized spreads at fit-to-screen and high magnification, including shadow detail, crop behavior, gutter safety, font fallback, CJK punctuation, and phase dividers. Accessibility review exercises reading order and alternative text with assistive technology rather than treating PDF/UA validation as proof of usability. Print review requires calibrated soft proofing and a physical artifact before press readiness is claimed. `/PageLayout /TwoPageRight` remains a viewer preference, not evidence of spread correctness or printer imposition. [Adobe PDF 1.7 specification](kimi-cite://web?url=https%3A%2F%2Fopensource.adobe.com%2Fdc-acrobat-sdk-docs%2Fpdfstandards%2FPDF32000_2008.pdf 'citation')

The release record references the exact final artifact hash and records the appropriate human approvals. Automated preflight can prove structural and measurable properties; it cannot certify artistic quality, visual parity, reading experience, or physical print quality.

---

## 9. Phased Implementation Roadmap

The roadmap delivers a trustworthy vertical slice before search sophistication. The first optimizer is not a prerequisite for the first trustworthy PDF: a manually approved miniature ledger can exercise layout, rendering, and release while candidate generation remains under development.

| Phase                              | Deliverables                                                                                                                                 | Acceptance gate                                                                              |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| **0. Correct and decide**          | Corrected pair/metric/graph terminology; trim/bleed/PPI policy; initial destination profile                                                  | Quantitative examples match this document; one initial output profile is explicitly selected |
| **1. Trusted state**               | Versioned ledger/proposal schemas, Ajv validator, semantic invariants, stable asset/fragment IDs, read-only inventory and source fingerprint | Synthetic valid/invalid fixtures pass/fail correctly; source bytes remain unchanged          |
| **2. Safe proposals**              | Plan-only sync, seeded baseline optimizer, proposal provenance, approval/apply protocol, atomic ledger writes                                | New assets remain unplaced; locked deletions block; stale proposals cannot apply             |
| **3. Deterministic display build** | Content-addressed assets, canonical layout IR, Typst renderer, display manifest, contact sheets, QPDF/Poppler preflight                      | Approved fixture renders without network/LLM calls; page/image/font geometry is verified     |
| **4. Release quality**             | Two-build reproducibility, semantic PDF diff, alt text/language/reading order, contrast remediation, veraPDF where claimed                   | Final artifact passes automated gates and human review is recorded                           |
| **5. Print handoff**               | High-resolution source mapping, printer-specific press profile, output intent, calibrated soft proof, physical proof record                  | Effective PPI and printer contract pass; no press-ready claim before physical approval       |
| **Optional extensions**            | CP-SAT/pymoo experiments, EPUB/EPUBCheck, separate release skill                                                                             | Added only after a measured optimization need or real delivery requirement                   |

The smallest valuable first milestone is **schema + read-only inventory + validation CLI**. It establishes the vocabulary and authority boundaries required by every later optimizer and renderer without making autonomous edits. In parallel, the destination decision must be made explicitly: screen/display using current web exports, a smaller or lower-PPI physical proof, or full-size print using high-resolution archive sources. That choice changes output profiles and evidence requirements, not the stable editorial asset identities.

---

## 10. Open Questions & What Could Not Be Verified

1. **Initial destination and physical-resolution policy**:
    - The common `2048 × 1365 px` source does not meet 200/240/300 PPI at the proposed full-page 300 × 200 mm geometry. The first implementation must choose screen/display, a smaller or explicitly lower-PPI proof, or high-resolution press inputs. No physical-print quality claim is made by this research.
2. **Availability of high-resolution master exports outside the repo**:
    - The external 3-2-1 archive is outside the workspace. Whether all 127 sequenced frames have suitable print masters could not be verified. The press design therefore maps stable `assetId` values to alternative source revisions rather than assuming their existence.
3. **Local renderer and validation binaries**:
    - Typst, QPDF, Poppler utilities, and veraPDF were not installed in the observed environment; no new packages were installed during this review. Typst claims were checked against official documentation/source, while Chrome PDF passthrough was previously verified locally. Actual Typst output, deterministic finalization, and standards conformance remain unverified until those tools are installed and exercised.
4. **Native PDF/X-4 support and printer requirements**:
    - Typst `0.15.1` does not natively provide PDF/X-4. A printer requiring PDF/X must supply its output-intent and proofing contract; Ghostscript or another renderer cannot be declared sufficient through a generic command. Any conversion and subsequent conformance/appearance checks remain future implementation work.
5. **Real accessibility and visual behavior**:
    - Alternative-text quality, asymmetric-spread reading order, font fallback, CJK glyph coverage, shadow detail, and spread aesthetics require generated artifacts and human review. No visual parity, accessibility conformance, or press-readiness claim is established by this document alone.
