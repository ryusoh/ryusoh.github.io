# Research: Forensic Critique of `book/photobook.typ` & Frontier Industrial-Grade Photobook Design

**Date:** 2026-11-17
**Scope:** Visual and editorial design audit of [`book/photobook.typ`](file:///Users/lz/dev/ryusoh.github.io/book/photobook.typ), [`scripts/book/layout.mjs`](file:///Users/lz/dev/ryusoh.github.io/scripts/book/layout.mjs), [`scripts/book/optimize.mjs`](file:///Users/lz/dev/ryusoh.github.io/scripts/book/optimize.mjs), and `.cache/book-runs/proofs/display/page-001.png`–`page-157.png`, paired with primary-source research into museum-tier contemporary photobook design (**MACK**, **Steidl**, **VOID**, **Fw:Books**, **Akio Nagasawa / Super Labo**, **Chose Commune**, **Loose Joints**) and **Typst `v0.15.1`** vector/grid primitives.

---

## 1. Research Question

1. **Why does the current visual output of [`book/photobook.typ`](file:///Users/lz/dev/ryusoh.github.io/book/photobook.typ) read as "AI-made slop" and a student template rather than an industrial-grade photography monograph?**
2. **What are the authoritative design principles, spatial geometries, typographic rules, and structural conventions used by the world's premier avant-garde photobook publishers (MACK, Steidl, VOID, Fw:Books, Super Labo, Irma Boom), and how should they be engineered in Typst (`v0.15.1`) for _Infinite Systems_?**

---

## 2. Executive Summary & The Unvarnished Roast of `book/photobook.typ`

An inspection of [`book/photobook.typ`](file:///Users/lz/dev/ryusoh.github.io/book/photobook.typ) (118 lines), [`scripts/book/layout.mjs`](file:///Users/lz/dev/ryusoh.github.io/scripts/book/layout.mjs), [`scripts/book/optimize.mjs`](file:///Users/lz/dev/ryusoh.github.io/scripts/book/optimize.mjs), [`.cache/book-runs/layout-ir-display.json`](file:///Users/lz/dev/ryusoh.github.io/.cache/book-runs/layout-ir-display.json), and the rasterized proof pages ([`.cache/book-runs/proofs/display/page-001.png`](file:///Users/lz/dev/ryusoh.github.io/.cache/book-runs/proofs/display/page-001.png) through [`page-157.png`](file:///Users/lz/dev/ryusoh.github.io/.cache/book-runs/proofs/display/page-157.png)) shows that while the underlying **data pipeline** (content-addressed `sharp` derivatives, Hamiltonian sequence optimization, QPDF `/TwoPageRight` stamping, and reproducibility gates) is solid, **the visual presentation layer in `book/photobook.typ` is an amateurish 118-line stub dressed in cliché "AI sci-fi dashboard" tropes.**

Specifically, seven visual and structural failures make the current PDF look like an AI-generated pitch deck rather than a fine-art monograph:

### 2.1 The Seven Visual Sins of `book/photobook.typ`

1. **Sin #1 — The "AI Cyber-Terminal" Costume (`SYS //`, `#CE2323` Red Laser Lines, Raw JSON Enum Leaks, and Stretched Display Caps):**
    - Whenever an LLM is told to design something titled _"Infinite Systems"_, it defaults to a 2022 cyberpunk dashboard starter pack: double-slash code comments (`SYS // 2021–2026` at [`book/photobook.typ:24`](file:///Users/lz/dev/ryusoh.github.io/book/photobook.typ#L24), `SYS.01 // BW` at [`line 45`](file:///Users/lz/dev/ryusoh.github.io/book/photobook.typ#L45)), aプログラミング IDE font (`JetBrains Mono`) used for the author's name and literary subtitles, and a bright `#CE2323` red horizontal underline bar under every single heading ([`lines 28, 47, 100`](file:///Users/lz/dev/ryusoh.github.io/book/photobook.typ#L28)).
    - Worse, [`book/photobook.typ:45`](file:///Users/lz/dev/ryusoh.github.io/book/photobook.typ#L45) and [`line 97`](file:///Users/lz/dev/ryusoh.github.io/book/photobook.typ#L97) print **raw internal JSON schema enums** directly onto the page: `#upper(pg.modality)` prints literal `SYS.01 // BW` and `SYS.02 // COLOR` ([`page-003.png`](file:///Users/lz/dev/ryusoh.github.io/.cache/book-runs/proofs/display/page-003.png), [`page-029.png`](file:///Users/lz/dev/ryusoh.github.io/.cache/book-runs/proofs/display/page-029.png)), and `#upper(pg.pageType)` prints literal **`SYSTEM COLOPHON // COLOPHON-TELEMETRY`** and **`SYSTEM COLOPHON // COLOPHON-INDEX`** ([`page-156.png`](file:///Users/lz/dev/ryusoh.github.io/.cache/book-runs/proofs/display/page-156.png), [`page-157.png`](file:///Users/lz/dev/ryusoh.github.io/.cache/book-runs/proofs/display/page-157.png)). No human book designer has ever printed a kebab-case JSON discriminator (`COLOPHON-TELEMETRY`) as a book heading.
    - Pairing `JetBrains Mono` and `#CE2323` red lines with `Syne ExtraBold` in all-caps at `+2.2pt` tracking ([`book/photobook.typ:30`](file:///Users/lz/dev/ryusoh.github.io/book/photobook.typ#L30)) compounds the problem: `Syne ExtraBold`'s ultra-expanded `S`, `M`, and `O` glyphs (originally commissioned for a French cultural web banner) stretched across a red line look like a gaming hardware box, violating [`docs/design-research.md:40,58-62`](file:///Users/lz/dev/ryusoh.github.io/docs/design-research.md#L40) (_"The red `#ce2323` accent... reads 'default dark template,' not 'photographer'"_).

2. **Sin #2 — The Cover (`page-001.png`) Is a Broken Word-Processor Flyer with Fighting Margins:**
    - The cover image ([`assets/img/book/cover.jpg`](file:///Users/lz/dev/ryusoh.github.io/assets/img/book/cover.jpg)) is a ferocious, high-contrast chiaroscuro close-up portrait in the lineage of Daido Moriyama and Richard Avedon.
    - Instead of letting that portrait command the physical object, [`book/photobook.typ:20-41`](file:///Users/lz/dev/ryusoh.github.io/book/photobook.typ#L20-L41) shrinks it into a polite **`146 × 173 mm` centered rectangle** floating in the middle of the `210 × 260 mm` page underneath four stacked rows of text and a full-width red line ([`page-001.png`](file:///Users/lz/dev/ryusoh.github.io/.cache/book-runs/proofs/display/page-001.png)).
    - Because the outer block uses `inset: (x: 18mm)` while the image is `146mm` wide and `#align(center)`ed, the text and red line start at **`x = 18 mm`** while the photograph starts at **`x = 32 mm`** (`(210 - 146) / 2 = 32 mm`). Having two disconnected vertical edges (`18 mm` vs. `32 mm`) on a single cover violates the most fundamental rule of Swiss grid typography (Müller-Brockmann, _Grid Systems in Graphic Design_, 1981).

3. **Sin #3 — Complete Absence of Frontmatter Pacing:**
    - In [`scripts/book/layout.mjs:96-122`](file:///Users/lz/dev/ryusoh.github.io/scripts/book/layout.mjs#L96-L122), Page 1 is the Exterior Cover (`page-001.png`), Page 2 is a blank black page (`page-002.png`), and Page 3 immediately launches `SYS.01 // BW — THRESHOLD` (`page-003.png`).
    - Every serious monograph (**Steidl**, **MACK**, **VOID**, **Chose Commune**) separates the **exterior cover object** from the **interior title architecture** via an architectural frontmatter sequence: Front Cover $\to$ Endpaper void $\to$ Half-Title / Frontispiece $\to$ Full Title & Curatorial Score Spread $\to$ Movement I Opener. Because `book/photobook.typ` lacks a Title Page, it dumps all title, subtitle, author, and state-count strings onto the Front Cover.

4. **Sin #4 — Saggy Mathematical Centering (`horizon`), Broken `full-bleed` Inset, and Unmoored Folios (`page-005.png`–`page-010.png`):**
    - Across all 127 plate pages in [`.cache/book-runs/layout-ir-display.json`](file:///Users/lz/dev/ryusoh.github.io/.cache/book-runs/layout-ir-display.json), `100%` of the photographs are `3:2` landscape placed on `210 × 260 mm` portrait pages, covering **`30.84%`** of the page area on average (**`69.16%` empty `#070709` void**).
    - Placing `3:2` horizontal frames on a `210 × 260 mm` portrait page is a classic photobook format (_The Americans_, _Waffenruhe_, VOID monographs)—**but only when governed by an upper optical hang-line (_Hängelinie_) and intentional gutter/fore-edge tension.**
    - Instead, [`book/photobook.typ:64-77`](file:///Users/lz/dev/ryusoh.github.io/book/photobook.typ#L64-L77) centers plates at mathematical `horizon` with an arbitrary `(bottom: 12mm)` inset—which is accidentally applied **even when `pg.slot.scale == "full-bleed"`** ([`line 76`](file:///Users/lz/dev/ryusoh.github.io/book/photobook.typ#L76)), shifting full-bleed plates off-center (`54 mm` top bar, `66 mm` bottom bar).
    - Worse, on `symmetric-diptych` pages (`112 / 127` plates = `88.19%`), the plate is pushed to `12 mm` from the inner spine (`right: 12mm` on verso, `left: 12mm` on recto), placing the outer edge of the photograph at **`42.6 mm`** from the page trim—while [`book/photobook.typ:84-91`](file:///Users/lz/dev/ryusoh.github.io/book/photobook.typ#L84-L91) places the `7.5pt` folio numeral (`002`, `003`) at **`18 mm`** from the outer trim and `16 mm` from the bottom ([`page-006.png`](file:///Users/lz/dev/ryusoh.github.io/.cache/book-runs/proofs/display/page-006.png), [`page-007.png`](file:///Users/lz/dev/ryusoh.github.io/.cache/book-runs/proofs/display/page-007.png)). The folio hangs `24.6 mm` outside the photograph's left/right rail and `68.2 mm` below its bottom edge, completely detached from the grid.

5. **Sin #5 — Flattening of Spatial Rhythm into `88.2%` Identical Stamps:**
    - In [`book/sequence.yaml`](file:///Users/lz/dev/ryusoh.github.io/book/sequence.yaml) and [`scripts/book/optimize.mjs:103-157`](file:///Users/lz/dev/ryusoh.github.io/scripts/book/optimize.mjs#L103-L157), `56` of `71` content spreads (`78.87%`, containing `112` of `127` plates = **`88.19%`**) use the exact same `symmetric-diptych` layout at `inset-74` (`155.4 × 103.6 mm`), while `asymmetric-diptych` (`0%`), `diagonal-offset` (`0%`), and `inset-55` (`0%`) were eliminated because their previous naive corner-pinning (`left + top` / `right + bottom` at `18mm` in [`book/photobook.typ:66-75`](file:///Users/lz/dev/ryusoh.github.io/book/photobook.typ#L66-L75)) looked broken.
    - Without **spine-kissing panoramic diptychs**, **fore-edge bleeds**, **top-aligned asymmetric call-and-response spreads**, and **breathing cabinet plates**, flipping 157 pages of identical vertically centered boxes induces immediate visual fatigue.

6. **Sin #6 — Bilingual Epigraph Starvation (`1` Epigraph in 157 Pages, `0` Chinese Characters Rendered, Raw `<br />` Tags):**
    - Although [`.cache/book-runs/inventory.json`](file:///Users/lz/dev/ryusoh.github.io/.cache/book-runs/inventory.json) contains **30 authentic literary fragments** (14 English in `p1`–`p5` and 16 Simplified Chinese `zh-Hans` stanzas in `p6/index.md`), [`scripts/book/optimize.mjs:214`](file:///Users/lz/dev/ryusoh.github.io/scripts/book/optimize.mjs#L214) slices only the first 8 (`inventory.fragments.slice(0, 8)`) and lines `185–188` pass `null` for movements `SYS.02`, `SYS.03`, and `SYS.04`.
    - Result: **Only 1 epigraph renders in the entire 157-page book** ([`page-004.png`](file:///Users/lz/dev/ryusoh.github.io/.cache/book-runs/proofs/display/page-004.png)), **zero Simplified Chinese (`zh-Hans`) stanzas appear anywhere**, `pdffonts dist/infinite-systems-display.pdf` confirms **`GlowSansSC-Extended` is not even embedded in the compiled PDF**, and [`book/sequence.yaml:1357`](file:///Users/lz/dev/ryusoh.github.io/book/sequence.yaml#L1357) still contains unstripped HTML `<br />` literals.

7. **Sin #7 — The 2-Page Colophon Stub (`page-156.png` & `page-157.png`):**
    - [`docs/photobook-ebook-research.md:458-464`](file:///Users/lz/dev/ryusoh.github.io/docs/photobook-ebook-research.md#L458-L464) specified an archival back-of-book section with a full-book Photometric Luminance Waveform, Hamiltonian Transition Energy chart, and an **Illustrated Plate Index (`[001]`–`[127]`)** with miniature thumbnails and curatorial notes.
    - [`book/photobook.typ:94-117`](file:///Users/lz/dev/ryusoh.github.io/book/photobook.typ#L94-L117) actually renders **six lines of key-value text** on page 156 (`95%` empty page, [`page-156.png`](file:///Users/lz/dev/ryusoh.github.io/.cache/book-runs/proofs/display/page-156.png)) and **one single sentence** on page 157 (`97%` empty page, [`page-157.png`](file:///Users/lz/dev/ryusoh.github.io/.cache/book-runs/proofs/display/page-157.png)). It looks like an unfinished homework placeholder.

---

## 3. Primary Sources & Reference Canon Consulted

### 3.1 Repository Codebase & Compiled Artifacts (First-Party)

- [`book/photobook.typ`](file:///Users/lz/dev/ryusoh.github.io/book/photobook.typ) (lines 1–118) — Current Typst template.
- [`scripts/book/layout.mjs`](file:///Users/lz/dev/ryusoh.github.io/scripts/book/layout.mjs) (lines 1–222) — Layout IR generator and scale calculator.
- [`scripts/book/optimize.mjs`](file:///Users/lz/dev/ryusoh.github.io/scripts/book/optimize.mjs) (lines 103–225) — Spread packing and fragment allocation.
- [`scripts/book/assets.mjs`](file:///Users/lz/dev/ryusoh.github.io/scripts/book/assets.mjs) (lines 58–89) — Cover derivative crop pipeline (`assets/img/book/cover.jpg`).
- [`book/profiles/display.json`](file:///Users/lz/dev/ryusoh.github.io/book/profiles/display.json) & [`book/profiles/screen.json`](file:///Users/lz/dev/ryusoh.github.io/book/profiles/screen.json) — Output profile geometry and color tokens.
- [`.cache/book-runs/layout-ir-display.json`](file:///Users/lz/dev/ryusoh.github.io/.cache/book-runs/layout-ir-display.json) & [`.cache/book-runs/proofs/display/page-001.png`](file:///Users/lz/dev/ryusoh.github.io/.cache/book-runs/proofs/display/page-001.png)–[`page-157.png`](file:///Users/lz/dev/ryusoh.github.io/.cache/book-runs/proofs/display/page-157.png) — Compiled 157-page IR and Poppler proof renders.
- [`docs/design-research.md`](file:///Users/lz/dev/ryusoh.github.io/docs/design-research.md) & [`docs/photobook-ebook-research.md`](file:///Users/lz/dev/ryusoh.github.io/docs/photobook-ebook-research.md) — Governing aesthetic and architecture specifications.

### 3.2 Authoritative Book Design, Typography & Photobook Canon

- **Josef Müller-Brockmann**, _Grid Systems in Graphic Design / Rastersysteme für die visuelle Gestaltung_ (Verlag Niggli, 1981) — Mathematical modular grids, gutter-to-fore-edge ratios, and hang-line alignment.
- **Jost Hochuli & Robin Kinross**, _Designing Books: Practice and Theory_ (Hyphen Press, 1996) & **Jost Hochuli**, _Detail in Typography_ (Hyphen Press, 2008) — Optical center vs. geometric center, spread symmetry/asymmetry, and micro-typography.
- **Robert Bringhurst**, _The Elements of Typographic Style_ (4th ed., Hartley & Marks, 2012, Ch. 2 _"Rhythm & Proportion"_ & Ch. 8 _"Shaping the Page"_) — Verse measure, leading, tabular numerals, and page proportion harmonies.
- **MACK Books** ([mackbooks.co.uk](https://mackbooks.co.uk/)) — Design language of Michael Mack & Morgan Crowcroft-Brown across Paul Graham (_The Present_, _A Shimmer of Possibility_), Gregory Halpern (_ZZYZX_), and Michael Schmidt (_Waffenruhe_, _Ein-heit_): portrait monographs housing 35mm horizontal plates, tactile paper/ground shifts, and whisper-quiet colophon indexes.
- **VOID** ([void.photo](https://void.photo/), Athens — Myrto Steirou & João Linneu) — Contemporary vanguard of dark-ground, nocturnal, full-bleed chiaroscuro photobooks where images emerge from deep obsidian matte grounds without decorative UI chrome.
- **Fw:Books** ([fw-books.nl](https://fw-books.nl/), Amsterdam — Hans Gremmen) — The global benchmark for **systems, archival, and forensic photography books**: turning metadata, photometric telemetry, and contact-sheet indexes into austere Swiss conceptual art rather than sci-fi costume.
- **Akio Nagasawa Publishing & Super Labo** (Tokyo — Daido Moriyama _Record_ / _Kagero_, Takuma Nakahira _For a Language to Come_) — _Provoke_-lineage high-contrast B&W sequencing, full-bleed gutter collisions, and bilingual Japanese/English colophon architecture.
- **Typst `v0.15.1` Official Documentation** — [`curve`](https://typst.app/docs/reference/visualize/curve/), [`grid`](https://typst.app/docs/reference/layout/grid/), [`place`](https://typst.app/docs/reference/layout/place/), [`par`](https://typst.app/docs/reference/model/par/), and [PDF Accessibility](https://typst.app/docs/guides/accessibility/).

---

## 4. Claim-by-Claim Forensic & Design Evidence

### 4.1 Quantitative Audit of Current Geometry ([`.cache/book-runs/layout-ir-display.json`](file:///Users/lz/dev/ryusoh.github.io/.cache/book-runs/layout-ir-display.json))

In the compiled `210 × 260 mm` portrait layout (`54,600 mm²` per page, `157` pages, `127` plates), the distribution of plate scales and page coverage is:

| Scale Tier & Layout              |  Plate Count (`%`) | Placed Size (`W × H mm`) | Page Coverage (`%`) | Empty Void (`%`) | Horizontal Margins (`Inner / Outer mm`) | Vertical Margins (`Top / Bottom mm`) | Defect in [`book/photobook.typ`](file:///Users/lz/dev/ryusoh.github.io/book/photobook.typ)                                |
| :------------------------------- | -----------------: | :----------------------: | ------------------: | ---------------: | :-------------------------------------: | :----------------------------------: | :------------------------------------------------------------------------------------------------------------------------ |
| `full-bleed` (`monolith`)        |      `4` (`3.15%`) |     `210.0 × 140.0`      |            `53.85%` |         `46.15%` |               `0.0 / 0.0`               |            `54.0 / 66.0`             | [`line 76`](file:///Users/lz/dev/ryusoh.github.io/book/photobook.typ#L76) applies `(bottom: 12mm)` inset to `full-bleed`! |
| `inset-82` (`monolith`)          |     `11` (`8.66%`) |     `172.2 × 114.8`      |            `36.21%` |         `63.79%` |              `18.9 / 18.9`              |            `66.6 / 78.6`             | Folio at `x = 18mm` nearly collides with `18.9mm` plate edge.                                                             |
| `inset-74` (`symmetric-diptych`) |   `112` (`88.19%`) |     `155.4 × 103.6`      |            `29.49%` |         `70.51%` |              `12.0 / 42.6`              |            `72.2 / 84.2`             | Folio at `x = 18mm` is `24.6mm` outside the `42.6mm` plate rail; `88.2%` identical boxes.                                 |
| **Total / Weighted Mean**        | **`127` (`100%`)** |            —             |        **`30.84%`** |     **`69.16%`** |                    —                    |                  —                   | **Zero `asymmetric-diptych`, zero `diagonal-offset`, zero `inset-55`.**                                                   |

### 4.2 How World-Class Portrait Monographs (`210 × 260 mm`) Master `3:2` Horizontal Photographs

Keeping the **`210 × 260 mm` portrait monograph format** (commit `9c6a4de`) is completely aligned with museum-grade photobook publishing (**MACK**, **Steidl**, **VOID**, **Chose Commune**), **provided the page layout uses portrait-monograph spatial mechanics rather than dropping centered thumbnails into a vertical box.**

In **Jost Hochuli & Robin Kinross** (_Designing Books_, 1996) and **Josef Müller-Brockmann** (_Grid Systems_, 1981), placing horizontal plates on a vertical page relies on five architectural mechanisms:

```text
  CURRENT (AI-SLOP HORIZON BOXES)                   FRONTIER MONOGRAPH (MACK / VOID / FW:BOOKS)
+----------------+----------------+               +----------------+----------------+
|                |                |               |   Hang-line    |                |
|                |                |               |  +----------+  | +------------+ | <- Shared Upper Optical
|   +--------+   |   +--------+   |               |  |  VERSO   |  | |   RECTO    | |    Hang-Line (top: 46mm)
|   |  74%   |   |   |  74%   |   | <- Saggy      |  |  PLATE   |  | |   PLATE    | |
|   +--------+   |   +--------+   |    50% center |  +----------+  | +------------+ |
|                |                |               |  002           |            003 | <- Folios locked to
| 002            |            003 | <- Unaligned  |                |                |    exact plate rail!
+----------------+----------------+               +----------------+----------------+
  112/127 pages look identical                      1. OPTICAL HANG-LINE & LOCKED RAIL FOLIOS

+----------------+----------------+               +----------------+----------------+
|                |                |               |                |                |
|  +-------------+-------------+  |               |+--------------+|                |
|  |   VERSO     |    RECTO    |  | <- Zero-gap   ||  FORE-EDGE   ||   +--------+   | <- Top-aligned
|  |   PLATE     |    PLATE    |  |    Gutter     ||  BLEED (86%) ||   |  ECHO  |   |    Asymmetric
|  +-------------+-------------+  |    Bridge!    |+--------------+|   +--------+   |    Call & Response
|                |                |               |                |                |
|  014           |          015   |               |                |         019    |
+----------------+----------------+               +----------------+----------------+
  2. SPINE-KISSING GUTTER BRIDGE                    3. FORE-EDGE BLEED + CABINET ECHO
```

1. **The Museum Optical Hang-Line (_Hängelinie_) vs. Mathematical `horizon`:**
    - As Jost Hochuli documents in _Designing Books_, the human eye perceives the mathematical center of a vertical page (`50%` height = `130 mm` on a `260 mm` page) as visually sagging below center.
    - Furthermore, when a `260 mm`-tall page holds a `103.6 mm`–`140 mm`-tall horizontal plate, anchoring the **top edge of the plate to a fixed Upper Optical Hang-Line** (e.g., `top: 48 mm` on standard plates, placing the plate's vertical center at `~100 mm`–`110 mm` from the top edge—a `1 : 1.55` head-to-foot margin ratio) gives the lower half of the page architectural gravity, just like hanging framed prints in a gallery at a constant eye-level datum.
    - Even better: when an **Asymmetric Diptych** pairs a larger plate (`inset-82` or `full-bleed`) on one page with a smaller cabinet echo (`inset-55`) on the facing page, locking both plates to the **same `48 mm` top hang-line** makes the scale shift look surgically intentional rather than misaligned.

2. **Spine-Kissing / Gutter-Bridging Diptychs (`gutter-bridge` / `symmetric-diptych`):**
    - One of the most powerful devices in **Akio Nagasawa (Daido Moriyama)**, **VOID**, and **MACK** portrait monographs is pulling facing plates inward toward the spine gutter (`inner: 0mm` or `4mm`) so two `3:2` frames collide across the central fold, forming a continuous **`310 mm × 103.6 mm` (`3:1`) panoramic cinema strip** across the open `420 × 260 mm` spread, surrounded by generous outer margins (`54.6 mm`) and deep lower void.
    - Contrast this with standard gallery diptychs (`inner: 18mm`, `outer: 36.6mm`), where each plate sits within its own balanced frame on the page. Alternating between **balanced gallery diptychs** (`inner: 18mm`) and **spine-kissing collision diptychs** (`inner: 2mm` or `0mm` for high-affinity slant rhymes) creates kinetic tension across the gutter.

3. **Fore-Edge Bleeds & True `full-bleed` Horizon Bands (`0mm` Outer Trim):**
    - On `monolith` spreads and `asymmetric-diptych` spreads, a `full-bleed` plate (`210 × 140 mm`) spans `100%` of the page width from the central spine to the outer fore-edge (`left: 0mm, right: 0mm`), positioned at the upper optical hang-line (`top: 44mm`, `bottom: 76mm`) rather than mathematical center with a buggy `bottom: 12mm` inset.
    - On `asymmetric-diptych` spreads, an `inset-82` (`172.2 × 114.8 mm`) plate on the verso can **bleed off the left fore-edge** (`left: 0mm`, `right: 37.8mm` spine margin) while the facing recto holds a quiet `inset-55` (`115.5 × 77.0 mm`) cabinet plate anchored at `left: 28mm, top: 48mm`.

4. **Strict Rail-Locked Folios (Caption-by-Proximity vs. Corner Litter):**
    - In Swiss grid design (Müller-Brockmann, 1981) and **Fw:Books / Steidl** monographs, a plate number is never dropped in a distant corner (`x = 18mm, y = 244mm`) `24.6 mm` outside the photograph's vertical edge and `68 mm` below it.
    - Instead, the folio numeral (`002`) is **locked to the exact outer vertical rail of the plate** (`x = outerMargin` of that plate, placed either `6 mm` below the plate's bottom-outer corner or at a constant baseline `y = 236 mm` aligned with the plate's outer edge), set at **`6.5 pt`** in `JetBrains Mono` (`#8A9099`, `6.26:1` WCAG AA contrast).

---

### 4.3 Typography: Replacing "Sci-Fi Terminal Slop" with Swiss Archival Brutalism (**Fw:Books / MACK / Steidl**)

Why does the current typography look cheap? Because it treats `JetBrains Mono` and `Syne ExtraBold` like a futuristic HUD (`SYS // 2021–2026`, `SYS.01 // BW`, `SYSTEM COLOPHON // COLOPHON-TELEMETRY`).

To achieve an **industrial-grade, museum-tier aesthetic** using the repository's hash-pinned, SIL OFL-licensed font stack (`Syne-Regular.ttf`, `Syne-Bold.ttf`, `Syne-ExtraBold.ttf`, `GlowSansSC-Extended-Regular.otf`, `GlowSansSC-Extended-Bold.otf`, `JetBrainsMono-Regular.ttf`):

| Element                                    | Current "AI Slop" Implementation in `book/photobook.typ`                                                                                                                       | Industrial-Grade Monograph Standard (**Fw:Books / MACK / VOID**)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| :----------------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Syntax & Delimiters**                    | `SYS // 2021–2026`, `SYS.01 // BW`, `SYSTEM COLOPHON // COLOPHON-TELEMETRY` (double slashes `//` and raw JSON schema enums).                                                   | **Ban `//` and raw enums completely.** Use archival typographic delimiters: middle dot `·`, hair-spaced em-dash `—`, or Swiss tabular columns (`I`, `THRESHOLD`, `Monochrome · Plates 001–019`).                                                                                                                                                                                                                                                                                                                                                                     |
| **Decorative Red Lines (`#CE2323`)**       | `0.5pt` `#CE2323` red line under the header on Cover (`line 28`), all 4 Phase Dividers (`line 47`, even B&W movements!), and both Colophon pages (`line 100`).                 | **Remove all `#CE2323` header underline bars.** Structural rules—when used at all—are `0.25pt–0.35pt` muted graphite (`#2A2D34`). Reserve `#CE2323` **exclusively** for functional photometric data marks (e.g., the inhalation threshold datum or chroma phase markers inside the vector waveform chart).                                                                                                                                                                                                                                                           |
| **Display Titles (`Syne`)**                | `Syne ExtraBold` (`800`) in ALL CAPS with huge `+2.0pt–2.2pt` tracking (`INFINITE SYSTEMS`, `THRESHOLD`), which exaggerates `Syne`'s quirky wide glyphs into a cartoon banner. | Use **`Syne Bold` (`700`) or `Syne Regular` (`400`)** with restrained architectural tracking (`+0.04em` to `+0.08em`) or clean **Title Case / Uppercase `Glow Sans SC Extended`** for razor-sharp, neutral Swiss neo-grotesque geometry!Wait—notice that **`GlowSansSC-Extended-Regular.otf` and `GlowSansSC-Extended-Bold.otf`** are already vendored in `assets/fonts/book/`! Its Latin glyphs are derived from **IBM Plex Sans / Source Han Sans Extended**—a crisp, serious, industrial Swiss neo-grotesque without `Syne ExtraBold`'s eccentric display curves! |
| **Bilingual Epigraphs (`en` & `zh-Hans`)** | Only 1 epigraph in 157 pages (`page-004.png`), set in `10pt Syne Regular` with default leading, zero measure cap, and zero Chinese stanzas rendered.                           | Set all English and Simplified Chinese (`zh-Hans`) epigraphs in **`Glow Sans SC Extended` (`9.5pt`, weight `Regular`, `leading: 1.05em`, constrained measure `width: 115mm`)**, anchored at the optical hang-line (`top: 88mm, left: 36mm`) with a subtle `6.5pt` coordinate index above it. Distribute authentic epigraphs across all 4 movements, including the Chinese stanzas from `p6/index.md` in `SYS.04 // SINGULARITY`.                                                                                                                                     |
| **Telemetry & Folios (`JetBrains Mono`)**  | Used at `8pt–9.5pt` for author names, subtitles, and section headers.                                                                                                          | Restricted strictly to **micro-scale archival indices (`6.5pt–7pt`)**: plate numbers (`001`–`127`), CIELAB `L*` coordinates, and tabular colophon matrices.                                                                                                                                                                                                                                                                                                                                                                                                          |

> **Key Typographic Discovery (`Glow Sans SC Extended` vs. `Syne ExtraBold`):**
> Why did `INFINITE SYSTEMS` and `THRESHOLD` in `page-001.png` and `page-003.png` look so weird and "AI-slop"? Because `Syne` (especially at `Bold` and `ExtraBold` in all-caps) has theatrical, bulbous, wide Art-Nouveau/psychedelic display proportions (`O`, `S`, `M`, `E`, `W`). Meanwhile, the repository **already vendors `GlowSansSC-Extended-Regular.otf` and `GlowSansSC-Extended-Bold.otf`** in `assets/fonts/book/`! Using `Glow Sans SC Extended` as the primary Swiss neo-grotesque voice (with `Syne` used sparingly or paired cleanly, and `JetBrains Mono` at `6.5pt–7pt` for tabular data) immediately gives both Latin and CJK typography the cold, surgical **MACK / Steidl / Fw:Books** neo-grotesque authority.

---

### 4.4 Cover & Frontmatter Architecture: _The Nocturnal Object_

Look at why [`page-001.png`](file:///Users/lz/dev/ryusoh.github.io/.cache/book-runs/proofs/display/page-001.png) fails: it tries to be a Front Cover, a Title Page, and a Colophon simultaneously, resulting in a cramped `146 × 173 mm` centered image with mismatched `18mm` vs `32mm` margins.

In industrial-grade photobook design (**VOID**, **MACK**, **Akio Nagasawa**), the Cover and Frontmatter are structured as a **two-stage architectural threshold**:

```text
  PAGE 1 (RECTO): EXTERIOR COVER                     PAGE 2 (VERSO) + PAGE 3 (RECTO): TITLE & SCORE SPREAD
+------------------------------------+             +------------------------------------+------------------------------------+
| 01 · MONOGRAPH          ZHUANG LIU | <- 6.5pt    |                                    | INFINITE SYSTEMS                   |
|                                    |    grid     |  INFINITE SYSTEMS                  | Photographs 2021–2026              |
| INFINITE SYSTEMS                   | <- Crisp    |  Photographs by Zhuang Liu         |                                    |
|                                    |    Swiss    |  2021–2026                         | I   · THRESHOLD     001–019  MONO  |
| +--------------------------------+ |    lock     |                                    | II  · KINEMATICS    020–066  CHROMA|
| |                                | |    (18mm)   |  +------------------------------+  | III · PHANTOM       067–095  CHROMA|
| |  [Hero Chiaroscuro Portrait    | |             |  | /\    /\  /\      /\         |  | IV  · SINGULARITY   096–127  MONO  |
| |   assets/img/book/cover.jpg    | |             |  |/  \__/  \/  \  /\/  \___/\   |  |                                    |
| |   Locked to 18mm Swiss Rails   | |             |  +------------------------------+  | "The sun goes down                 |
| |   174mm x 206mm OR Full-Bleed] | |             |  Photometric Luminance Trace       |  I feel the light betray me"       |
| |                                | |             |  127 States · L*(t) ∈ [3.1, 83.4]  |                                    |
| +--------------------------------+ |             +------------------------------------+------------------------------------+
```

1. **Page 1 (Recto) — The Exterior Cover:**
    - **Zero `#CE2323` red line. Zero `SYS //` slashes.**
    - **Strict 12-Column Swiss Rail Alignment (`inset: 18mm`):** The cover portrait (`assets/img/book/cover.jpg`) spans the **exact full width of the `174 mm` inner grid** (`210 - 2×18 = 174 mm` wide × `206 mm` tall, or bleeds full-width `210 mm` across the bottom three edges) so the left and right edges of the portrait lock with `0.0 mm` error to the left edge of `INFINITE SYSTEMS` and the right edge of `ZHUANG LIU`.
    - Top archival datum (`6.5pt`, `#8A9099`, tracked `+0.08em`): `ZHUANG LIU` on the left, `2021–2026` on the right.
    - Title (`INFINITE SYSTEMS`): Set flush-left at the `18 mm` rail in clean Swiss neo-grotesque (`Glow Sans SC Extended` Bold or restrained `Syne Bold` at `16pt–18pt`, `#E6E4DF`), separated from the portrait by a tense `6 mm` gap so the subject's illuminated eyes command the entire plane.

2. **Movement Phase Dividers (`pageType: "phase-divider"`):**
    - Instead of `SYS.01 // BW` + red bar + `THRESHOLD` floating in an empty room ([`page-003.png`](file:///Users/lz/dev/ryusoh.github.io/.cache/book-runs/proofs/display/page-003.png)), each Phase Divider is a **Swiss Architectural Dossier Page** anchored to a 3-column grid:
        - **Top Datum (`y = 48mm`, the book's optical hang-line):** A `0.3pt` `#2A2D34` graphite hairline spanning the `166 mm` grid (`22 mm` margins), with Roman/archival index `MOVEMENT 01 / 04` on the left and modality classification `ACHROMATIC SILVER · PLATES 001–019` (or `CHROMATIC · PLATES 020–066`) on the right—never raw `BW` or `COLOR`.
        - **Movement Title (`y = 62mm`):** `THRESHOLD` / `KINEMATICS` / `PHANTOM` / `SINGULARITY` set cleanly at `15pt` with `+0.10em` tracking.
        - **Movement Photometric Sparkline & Epigraph (`y = 148mm`):** Displays the movement's plate count, mean luminance (`Mean L*`), and the movement's native Typst vector **Luminance Sparkline (`#curve`)**, paired with an authentic movement epigraph stanza (English in `SYS.01`–`SYS.03`, Simplified Chinese `zh-Hans` from `p6` in `SYS.04`).

---

### 4.5 Restoring Multi-Scale Spatial Rhythm & Bilingual Epigraphs (`scripts/book/optimize.mjs` & `book/photobook.typ`)

To eliminate the `88.2%` identical-box monotony while preserving strict visual discipline on the `210 × 260 mm` portrait canvas:

1. **Five Portrait-Tuned Spread Archetypes on a Shared `48 mm` Optical Hang-Line:**
    - **`monolith` (`full-bleed` `210 × 140 mm` or `inset-82` `172.2 × 114.8 mm`):** Verso is pure `#070709` negative space; recto plate hangs from `top: 48 mm` (`full-bleed` has `x: 0mm` so it bleeds edge-to-edge horizontally across the recto page; `inset-82` has `x: 18.9mm`).
    - **`monolith-epigraph` (`verso` bilingual verse + `recto` `inset-82` / `full-bleed` plate):** Verso renders a clean literary stanza (stripped of `<br />` tags, constrained to `110 mm` measure, `leading: 1.05em`, using Simplified Chinese `zh-Hans` stanzas from `p6` in `SYS.04` and English stanzas from `p1`–`p5` in `SYS.01`–`SYS.03`) at the optical hang-line (`top: 86 mm, left: 32 mm`); recto renders the facing plate.
    - **`symmetric-diptych` (Balanced Gallery Diptych, `inset-74` `155.4 × 103.6 mm`):** Both plates hang from `top: 52 mm`, with `inner: 16 mm` spine margin and `outer: 38.6 mm` fore-edge margin. Folios lock to `x = 38.6 mm` (the exact outer edge of each plate!).
    - **`asymmetric-diptych` (Top-Locked Call & Response, `inset-82` `172.2 × 114.8 mm` + `inset-55` `115.5 × 77.0 mm`):** Both plates lock their **top edges** to `top: 52 mm`! The dominant `inset-82` plate sits on the verso (`right: 16mm, left: 21.8mm`) while the intimate `inset-55` echo plate sits on the recto (`left: 24mm, right: 70.5mm`), creating a classic **MACK / Paul Graham** scale dialogue without vertical jitter.
    - **`diagonal-offset` (Controlled Swiss Step Counterpoint, `inset-74`):** Instead of shoving plates to `18 mm` top-left and bottom-right corners, verso hangs at the upper grid datum (`top: 40 mm, left: 26 mm`) and recto steps down to the lower grid datum (`top: 96 mm, right: 26 mm`)—a controlled `56 mm` vertical step across the spread that preserves generous margins and locks folios to the `26 mm` outer rail.

---

### 4.6 Industrial-Grade Back-of-Book: _The Fw:Books / Steidl Archival Index & Telemetry Dossier_

Look at [`page-156.png`](file:///Users/lz/dev/ryusoh.github.io/.cache/book-runs/proofs/display/page-156.png) and [`page-157.png`](file:///Users/lz/dev/ryusoh.github.io/.cache/book-runs/proofs/display/page-157.png): 95% empty dark-gray pages with 6 lines of text.

In **Fw:Books (Hans Gremmen)**, **Steidl**, and **MACK** monographs, the back-of-book archival apparatus is a jewel of Swiss information design:

```text
  COLOPHON PAGE A (VERSO): PHOTOMETRIC SCORE & COLOPHON      COLOPHON PAGES B..E: ILLUSTRATED CONTACT-SHEET INDEX (001–127)
+------------------------------------------------------+   +------------------------------------------------------+
| ARCHIVAL COLOPHON & PHOTOMETRIC TELEMETRY            |   | PLATE INDEX & CURATORIAL REGISTER · PLATES 001–032   |
| ---------------------------------------------------- |   | ---------------------------------------------------- |
| EDITION       Infinite Systems (Rev. 1)              |   | +------+ 001 · P1 · MONO    +------+ 002 · P1 · MONO |
| ARCHITECTURE  4 Movements · 127 Plates · 160 Pages   |   | |THUMB | DSCF4775 · L* 13   |THUMB | DSCF9004 · L* 7 |
|                                                      |   | +------+ Inside a dimly...  +------+ Self-portrait...|
| PHOTOMETRIC LUMINANCE WAVEFORM · LUMA255(t) [001–127]|   |                                                      |
| +--------------------------------------------------+ |   | +------+ 003 · P1 · MONO    +------+ 004 · P1 · MONO |
| |   /\    /\  /\      /\    /\      /\             | |   | |THUMB | DSCF2441 · L* 15   |THUMB | R0002885 · L* 7 |
| |  /  \__/  \/  \  /\/  \__/  \____/  \___/\       | |   | +------+ Street performer.. +------+ Sutro Tower...  |
| +--------------------------------------------------+ |   |   ... (32 thumbnail contact entries per page         |
| SYS.01 (001–019) · SYS.02 (020–066) · SYS.03 · SYS.04|   |        across 4 index pages = all 127 plates!)       |
+------------------------------------------------------+   +------------------------------------------------------+
```

1. **Page A (`colophon-telemetry`):**
    - Header: `ARCHIVAL COLOPHON & PHOTOMETRIC TELEMETRY` (human editorial language, zero `// COLOPHON-TELEMETRY`).
    - **Full-Book 127-Frame Photometric Luminance Waveform `luma255(t)` & Hamiltonian Step Trace:** Rendered natively in Typst `v0.15.1` using `#curve(...)` and `#line(...)` inside `#pdf.artifact(...)`, plotting the exact `luma255` trajectory of all 127 plates in sequence order with movement boundary ticks (`SYS.01`–`SYS.04`) and respiratory threshold lines (`luma = 75` Exhalation, `luma = 135` Inhalation).
    - **Movement Architecture Matrix:** A 4-row Swiss table listing `I. Threshold`, `II. Kinematics`, `III. Phantom`, and `IV. Singularity` with exact plate ranges, frame counts, modality, and mean `luma255` / `L*`.
    - **Production & Provenance Colophon:** Complete specification of the Typst `0.15.1` + `sharp` + QPDF `/TwoPageRight` pipeline, ICC color contract (`Display`: native ICC / `PDF/A-2b`; `Screen`: sRGB / `DeviceGray`), source SHA-256 fingerprint, and SIL OFL 1.1 typography provenance.

2. **Pages B–E (`colophon-index`, 4 explicit IR pages × up to 32 plates/page = 127 plates):**
    - Renders a **4-column × 8-row Miniature Contact-Sheet Index** of all 127 sequenced photographs!
    - Each cell contains:
        - Miniature contact-sheet thumbnail (`#image(entry.path, width: 14mm, height: 9.3mm, fit: "cover")`).
        - Tabular header: **`001 · P1 · MONO`** (`6pt JetBrains Mono`, `#E6E4DF`) and **`L* 13 · 248 PPI`** (`5.5pt`, `#8A9099`).
        - Concise 2-line curatorial description truncated cleanly from `altText` (`5.5pt Glow Sans SC Extended`, `#D8D5CE`).
    - Because [`scripts/book/render.mjs:164`](file:///Users/lz/dev/ryusoh.github.io/scripts/book/render.mjs#L164) and [`scripts/book/proof.mjs:52`](file:///Users/lz/dev/ryusoh.github.io/scripts/book/proof.mjs#L52) enforce a 1-to-1 correspondence between `ir.pages` entries and PDF pages (`layoutIr.totalPages === pdfPageCount`), `scripts/book/layout.mjs` chunks the 127 plate index entries into **4 explicit `colophon-index` page objects** (`chunkSize = 32`, yielding `32 + 32 + 32 + 31 = 127` plates) so every page is deterministically bounded to `height: 100%` without overflow or page-count drift.

---

## 5. Concrete Typst (`v0.15.1`) & IR Engineering Blueprint

### 5.1 Native Vector Waveform Rendering in Typst `v0.15.1` (`#curve`)

Verified against local `typst 0.15.1`: Typst's native `curve` function (`curve.move`, `curve.line`) draws resolution-independent PDF vector paths directly from IR data arrays without external SVGs:

```typst
#let renderLuminanceWaveform(waveform, widthMm: 166, heightMm: 28) = pdf.artifact(
  box(
    width: widthMm * 1mm,
    height: heightMm * 1mm,
    stroke: 0.25pt + rgb("#2A2D34"),
    inset: 0mm,
  )[
    #let yExhale = (1 - 75 / 255) * heightMm * 1mm
    #let yInhale = (1 - 135 / 255) * heightMm * 1mm
    #place(top + left, dy: yExhale, line(length: 100%, stroke: (paint: rgb("#2A2D34"), thickness: 0.3pt, dash: "densely-dotted")))
    #place(top + left, dy: yInhale, line(length: 100%, stroke: (paint: rgb("#CE2323"), thickness: 0.3pt, dash: "densely-dotted")))
    #if waveform.len() > 1 [
      #let stepX = widthMm / (waveform.len() - 1)
      #let pts = waveform.enumerate().map(((i, w)) => {
        let x = (i * stepX) * 1mm
        let y = ((1 - calc.clamp(w.luma255, 0, 255) / 255) * heightMm) * 1mm
        if i == 0 { curve.move((x, y)) } else { curve.line((x, y)) }
      })
      #place(top + left, curve(stroke: 0.45pt + rgb("#E6E4DF"), ..pts))
    ]
  ]
)
```

### 5.2 Summary of Subsystem Changes Required (When Ready to Implement)

1. **[`scripts/book/inventory.mjs`](file:///Users/lz/dev/ryusoh.github.io/scripts/book/inventory.mjs):** Strip literal `<br />` / `<br>` tags from extracted markdown text fragments and filter out multi-paragraph prose essays (>240 chars) from poetic verse fragments.
2. **[`scripts/book/optimize.mjs`](file:///Users/lz/dev/ryusoh.github.io/scripts/book/optimize.mjs) & [`book/sequence.yaml`](file:///Users/lz/dev/ryusoh.github.io/book/sequence.yaml):**
    - Include all authentic poetic fragments in the ledger (preserving `p6` Simplified Chinese `zh-Hans` stanzas) and assign movement-appropriate epigraphs across all 4 movements (`SYS.01`–`SYS.04`).
    - Restore balanced multi-archetype spread rhythm (`symmetric-diptych`, `asymmetric-diptych` with `inset-82` + `inset-55`, `diagonal-offset`, `monolith`, `monolith-epigraph`).
3. **[`scripts/book/layout.mjs`](file:///Users/lz/dev/ryusoh.github.io/scripts/book/layout.mjs):**
    - Enrich `phase-divider` pages with movement plate ranges (`startPlate`–`endPlate`), frame counts, mean `luma255`, movement waveform slice, and movement epigraph.
    - Enrich `colophon-telemetry` with the 127-point `waveform` array and `movementSummaries` table.
    - Emit paginated `colophon-index` pages (32 plates per page × 4 pages = 127 plates) carrying miniature thumbnail path, plate label, series ID, modality, `luma255`, `effectivePpi`, and concise caption.
4. **[`book/photobook.typ`](file:///Users/lz/dev/ryusoh.github.io/book/photobook.typ):**
    - Replace all `SYS //`, `// BW`, `// COLOPHON-*`, and `#CE2323` red header underlines with the **Fw:Books / MACK / VOID** Swiss grid architecture.
    - Lock the Cover portrait (`174 × 206 mm`) to the exact `18 mm` Swiss typographic rails with micro-telemetry and luminance waveform.
    - Anchor all plate spreads to the **Upper Optical Hang-Line (`48 mm–52 mm`)**, fix `full-bleed` `0 mm` horizontal margins, and lock every folio numeral (`6.5pt`) to the exact outer vertical rail of its plate.
    - Render the native `#curve` photometric waveform and the 127-thumbnail Contact-Sheet Plate Index in the Colophon.

---

## 6. Open Questions & What Could Not Be Verified

1. **Cover Portrait Architecture — Option A (`18 mm` Swiss Rail-Locked Tipped-In Plate, `174 × 206.5 mm`) vs. Option B (`48 mm` Hang-Line 3-Edge Full-Bleed, `210 × 212 mm`):**
    - Both eliminate the broken dual-margin flyer layout of `page-001.png` (`18 mm` text vs. `32 mm` image). Option A emulates a **MACK / Steidl** cloth hardcover with a recessed photographic plate framed by a `0.25pt #1C1E24` deboss hairline; Option B emulates a **VOID / Akio Nagasawa (_Provoke_)** full-bleed object where the portrait's top edge establishes the `48 mm` optical hang-line of the book and the silver neck chain bleeds off the bottom trim edge. Work Order `WO-04` below defaults to **Option B (with Option A as a 1-flag toggle)** pending human visual confirmation.

---

## 7. Action Items (Mechanical Work Orders)

### 7.1 Preamble — Rules for the Implementing Agent

1. **One work order per commit:** Execute work orders sequentially (`WO-01` $\to$ `WO-05`). Stage only the files touched by that work order (`git add <file>`) and commit after each item once its scoped verification passes, **when authorized by the user** — **never push**.
2. **Exact anchors (`Find`):** Every `Find` block below is verified against the current repository state. If an anchor does not match verbatim, **STOP and report** rather than guessing. Line numbers are approximate and may drift after earlier edits.
3. **Protected paths:** Never edit `js/vendor/`, any `*.min.js`, or source JPEGs under `assets/img/p1..p6/`.
4. **Post-edit formatting & linting:** After editing JS/JSON/YAML/MD files, run `./scripts/run-npx.sh prettier --write <files>` and `./scripts/run-npx.sh eslint <js-files>`.

---

### 7.2 Ranked Work Orders

#### WO-01 `[low]` — Sanitize HTML `<br />` and `<footer><cite>` markup in `scripts/book/inventory.mjs`

- **File:** [`scripts/book/inventory.mjs`](file:///Users/lz/dev/ryusoh.github.io/scripts/book/inventory.mjs#L92-L113)
- **Why:** Twenty-one fragments in `assets/img/p2..p6/index.md` contain raw `<br />` tags and `<footer class="quote-attribution"><cite>…</cite></footer>` HTML tags that currently leak verbatim into `book/sequence.yaml` and Typst output.
- **Find** (`scripts/book/inventory.mjs`, lines 92–113):

    ```js
    const flushQuote = (endLine) => {
        if (quoteLines.length === 0) {
            return;
        }
        const text = quoteLines.join('\n').trim();
        quoteLines = [];
        if (!text) {
            return;
        }
        const hasCjk = /[\u4e00-\u9fff]/.test(text);
        fragments.push({
            fragmentId: `${seriesId}-lines-${quoteStartLine}-${endLine}`,
            source: `assets/img/${seriesId}/index.md`,
            sourceRange: { startLine: quoteStartLine, endLine },
            language: hasCjk ? 'zh-Hans' : 'en',
            text,
            attribution: null,
            originality: 'series-epigraph',
            rightsStatus: 'approved',
            excerptPolicy: 'verbatim-only',
        });
    };
    ```

- **Change:** Extract `<cite>…</cite>` into `attribution`, strip `<br />` and remaining HTML tags cleanly, and collapse excess blank lines:

    ```js
    const flushQuote = (endLine) => {
        if (quoteLines.length === 0) {
            return;
        }
        const rawText = quoteLines.join('\n').trim();
        quoteLines = [];
        if (!rawText) {
            return;
        }
        const citeMatch = rawText.match(/<cite>([\s\S]*?)<\/cite>/i);
        const attribution = citeMatch ? citeMatch[1].trim() : null;
        const text = rawText
            .replace(/<footer[\s\S]*?<\/footer>/gi, '')
            .replace(/<br\s*\/?>/gi, '')
            .replace(/<[^>]+>/g, '')
            .split('\n')
            .map((line) => line.trim())
            .filter(Boolean)
            .join('\n')
            .trim();
        if (!text) {
            return;
        }
        const hasCjk = /[\u4e00-\u9fff]/.test(text);
        fragments.push({
            fragmentId: `${seriesId}-lines-${quoteStartLine}-${endLine}`,
            source: `assets/img/${seriesId}/index.md`,
            sourceRange: { startLine: quoteStartLine, endLine },
            language: hasCjk ? 'zh-Hans' : 'en',
            text,
            attribution,
            originality: 'series-epigraph',
            rightsStatus: 'approved',
            excerptPolicy: 'verbatim-only',
        });
    };
    ```

- **Guardrail:** Keep `sourceRange` and `excerptPolicy: 'verbatim-only'` unchanged so `tests/js/book-inventory.test.js` and `validate.mjs` pass without modification.
- **Verify:**

    ```bash
    ./scripts/run-npx.sh prettier --write scripts/book/inventory.mjs && ./scripts/run-npx.sh eslint scripts/book/inventory.mjs && ./scripts/run-npx.sh jest tests/js/book-inventory.test.js
    ```

---

#### WO-02 `[low]` — Restore multi-archetype spread rhythm and bilingual epigraph distribution in `scripts/book/optimize.mjs`

- **File:** [`scripts/book/optimize.mjs`](file:///Users/lz/dev/ryusoh.github.io/scripts/book/optimize.mjs#L103-L216)
- **Why:** `optimize.mjs` currently drops 22 of 30 fragments (`slice(0, 8)`), passes `null` epigraphs to `SYS.02`–`SYS.04` (rendering zero CJK glyphs in the book), and packs `88.2%` of plates into identical `symmetric-diptych` `inset-74` boxes.
- **Find** (`scripts/book/optimize.mjs`, lines 103–157):

    ```js
    function packSpreads(assets, startSpreadIndex, epigraphFragment = null) {
        const spreads = [];
        let idx = 0;
        let sNum = startSpreadIndex;
        let diptychRun = 0;

        while (idx < assets.length) {
            const spreadId = `s${String(sNum++).padStart(2, '0')}`;
            if (idx === 0 && epigraphFragment) {
                const rAsset = assets[idx++];
                spreads.push({
                    spreadId,
                    layout: 'monolith-epigraph',
                    locked: sNum === 2,
                    verso: { fragmentId: epigraphFragment.fragmentId },
                    recto: { assetId: rAsset.assetId, scale: pickSafeScale(rAsset, 'full-bleed') },
                });
                continue;
            }
            if (idx === 0) {
                const rAsset = assets[idx++];
                spreads.push({
                    spreadId,
                    layout: 'monolith',
                    locked: false,
                    verso: null,
                    recto: { assetId: rAsset.assetId, scale: pickSafeScale(rAsset, 'full-bleed') },
                });
                continue;
            }
            if (idx === assets.length - 1 || (diptychRun > 0 && diptychRun % 5 === 0)) {
                diptychRun = 0;
                const rAsset = assets[idx++];
                spreads.push({
                    spreadId,
                    layout: 'monolith',
                    locked: false,
                    verso: null,
                    recto: { assetId: rAsset.assetId, scale: pickSafeScale(rAsset, 'inset-82') },
                });
                continue;
            }
            diptychRun++;
            const vAsset = assets[idx++];
            const rAsset = assets[idx++];
            spreads.push({
                spreadId,
                layout: 'symmetric-diptych',
                locked: false,
                verso: { assetId: vAsset.assetId, scale: pickSafeScale(vAsset, 'inset-74') },
                recto: { assetId: rAsset.assetId, scale: pickSafeScale(rAsset, 'inset-74') },
            });
        }
        return { spreads, nextSpreadIndex: sNum };
    }
    ```

- **Change (Part A — `packSpreads`):** Support an array of movement `epigraphFragments` and cycle diptychs cleanly through `symmetric-diptych` (`inset-74` + `inset-74`), `asymmetric-diptych` (`inset-82` + `inset-55`), and `diagonal-offset` (`inset-74` + `inset-74`), with periodic `monolith` / `monolith-epigraph` breathers:

    ```js
    function buildDiptychSpread(spreadId, vAsset, rAsset, diptychRun) {
        if (diptychRun % 4 === 2) {
            return {
                spreadId,
                layout: 'asymmetric-diptych',
                locked: false,
                verso: { assetId: vAsset.assetId, scale: pickSafeScale(vAsset, 'inset-82') },
                recto: { assetId: rAsset.assetId, scale: 'inset-55' },
            };
        }
        if (diptychRun % 6 === 0) {
            return {
                spreadId,
                layout: 'diagonal-offset',
                locked: false,
                verso: { assetId: vAsset.assetId, scale: pickSafeScale(vAsset, 'inset-74') },
                recto: { assetId: rAsset.assetId, scale: pickSafeScale(rAsset, 'inset-74') },
            };
        }
        return {
            spreadId,
            layout: 'symmetric-diptych',
            locked: false,
            verso: { assetId: vAsset.assetId, scale: pickSafeScale(vAsset, 'inset-74') },
            recto: { assetId: rAsset.assetId, scale: pickSafeScale(rAsset, 'inset-74') },
        };
    }

    function packSpreads(assets, startSpreadIndex, epigraphFragments = []) {
        const frags = Array.isArray(epigraphFragments)
            ? epigraphFragments.filter(Boolean)
            : [epigraphFragments].filter(Boolean);
        let fragIdx = 0;
        const spreads = [];
        let idx = 0;
        let sNum = startSpreadIndex;
        let diptychRun = 0;

        while (idx < assets.length) {
            const spreadId = `s${String(sNum++).padStart(2, '0')}`;
            if (idx === 0) {
                const rAsset = assets[idx++];
                const openerFrag = frags[fragIdx++] || null;
                spreads.push({
                    spreadId,
                    layout: openerFrag ? 'monolith-epigraph' : 'monolith',
                    locked: sNum === 2 && Boolean(openerFrag),
                    verso: openerFrag ? { fragmentId: openerFrag.fragmentId } : null,
                    recto: { assetId: rAsset.assetId, scale: pickSafeScale(rAsset, 'full-bleed') },
                });
                continue;
            }
            if (idx === assets.length - 1 || (diptychRun > 0 && diptychRun % 4 === 0)) {
                diptychRun = 0;
                const rAsset = assets[idx++];
                const midFrag = idx < assets.length && frags[fragIdx] ? frags[fragIdx++] : null;
                spreads.push({
                    spreadId,
                    layout: midFrag ? 'monolith-epigraph' : 'monolith',
                    locked: false,
                    verso: midFrag ? { fragmentId: midFrag.fragmentId } : null,
                    recto: { assetId: rAsset.assetId, scale: pickSafeScale(rAsset, 'inset-82') },
                });
                continue;
            }
            diptychRun++;
            const vAsset = assets[idx++];
            const rAsset = assets[idx++];
            spreads.push(buildDiptychSpread(spreadId, vAsset, rAsset, diptychRun));
        }
        return { spreads, nextSpreadIndex: sNum };
    }
    ```

- **Find (Part B — `buildCandidateLedger` in `scripts/book/optimize.mjs`, lines 185–215):**

    ```js
    const s1 = packSpreads(m1Assets, 1, inventory.fragments[0] || null);
    const s2 = packSpreads(m2Assets, s1.nextSpreadIndex, null);
    const s3 = packSpreads(m3Assets, s2.nextSpreadIndex, null);
    const s4 = packSpreads(m4Assets, s3.nextSpreadIndex, null);
    ```

    and

    ```js
            fragments: inventory.fragments.slice(0, 8),
    ```

- **Change (Part B):** Select verse fragments (`text.length <= 240`) and route English `p1` stanzas to `SYS.01`, `p2`/`p3` stanzas to `SYS.02`, `p4`/`p5` stanzas to `SYS.03`, and Simplified/Traditional Chinese (`zh-Hans`) `p6` stanzas to `SYS.04`:

    ```js
    const verseFragments = (inventory.fragments || []).filter((f) => f.text.length <= 240);
    const byPrefix = (prefixes) =>
        verseFragments.filter((f) => prefixes.some((p) => f.fragmentId.startsWith(`${p}-`)));
    const f1 = byPrefix(['p1']).slice(0, 2);
    const f2 = byPrefix(['p2', 'p3']).slice(0, 2);
    const f3 = byPrefix(['p4', 'p5']).slice(0, 2);
    const f4 = verseFragments.filter((f) => f.language === 'zh-Hans').slice(0, 3);

    const s1 = packSpreads(m1Assets, 1, f1.length > 0 ? f1 : verseFragments.slice(0, 1));
    const s2 = packSpreads(m2Assets, s1.nextSpreadIndex, f2);
    const s3 = packSpreads(m3Assets, s2.nextSpreadIndex, f3);
    const s4 = packSpreads(m4Assets, s3.nextSpreadIndex, f4);
    ```

    and replace `fragments: inventory.fragments.slice(0, 8),` with:

    ```js
            fragments: verseFragments,
    ```

- **Guardrail:** Keep ESLint complexity of `packSpreads` and `buildCandidateLedger` well below 20 by delegating diptych selection to `buildDiptychSpread`.
- **Verify:**

    ```bash
    ./scripts/run-npx.sh prettier --write scripts/book/optimize.mjs && ./scripts/run-npx.sh eslint scripts/book/optimize.mjs && ./scripts/run-npx.sh jest tests/js/book-optimize.test.js
    ```

---

#### WO-03 `[low]` — Enrich `scripts/book/layout.mjs` IR with native waveform arrays, movement telemetry, and 4-page paginated Contact-Sheet Plate Index

- **File:** [`scripts/book/layout.mjs`](file:///Users/lz/dev/ryusoh.github.io/scripts/book/layout.mjs#L63-L186)
- **Why:** `book/photobook.typ` cannot render the 127-frame `luma255(t)` vector waveform, movement plate ranges (`001–019`), epigraph attributions, or the 127-thumbnail Contact-Sheet Plate Index unless `compileLayoutIr` supplies those fields in the IR and paginates `colophon-index` in 32-plate chunks (`layoutIr.totalPages === pdfPageCount`).
- **Find** (`scripts/book/layout.mjs`, lines 63–166):

    ```js
        return {
            kind: 'plate',
            plateNumber: plateNum,
            plateLabel: String(plateNum).padStart(3, '0'),
            assetId: slot.assetId,
            path: toTypstAssetPath(rawPath, rootDir),
            altText: asset?.altText || '',
            modality: asset?.modality || 'bw',
            scale,
            placedWidthMm,
            placedHeightMm,
            effectivePpi: computeEffectivePpi(widthPx, heightPx, placedWidthMm, placedHeightMm),
            showFolio: scale !== 'full-bleed',
        };
    }

    export function compileLayoutIr(
        ledger,
        profile,
        { derivativeMap = {}, assetMetrics = {}, rootDir = null, coverImage = null } = {}
    ) {
        const assetMap = new Map((ledger.assets || []).map((a) => [a.assetId, a]));
        const fragmentMap = new Map((ledger.fragments || []).map((f) => [f.fragmentId, f]));
        let pCount = 0;
        const plateCounter = { next: () => ++pCount };
        const pageSize = profile?.pageSize || { widthMm: 210, heightMm: 260, bleedMm: 0 };
        const slotOpts = { derivativeMap, assetMetrics, rootDir, pageWidthMm: pageSize.widthMm };
        const pages = [];

        const pushPage = (side, content) => {
            pages.push({ pageNumber: pages.length + 1, side, ...content });
        };

        // Page 1 (Recto): Canonical Cover — The Cybernetic Monolith
        pushPage('recto', {
            pageType: 'cover',
            title: ledger.title,
            subtitle: ledger.subtitle,
            author: ledger.author,
            coverImagePath: coverImage?.path ? toTypstAssetPath(coverImage.path, rootDir) : null,
            heroAssetId: ledger.constraints?.pinnedOpenerAssetId || 'p1-dscf4775',
            signature: '127 STATES · 51 MONO / 76 CHROMA',
        });

        let prevModality = null;
        for (const mov of ledger.movements || []) {
            if (prevModality && prevModality !== mov.modality) {
                pushPage('verso', { pageType: 'phase-reset-void', modality: mov.modality });
                pushPage('recto', { pageType: 'phase-reset-void', modality: mov.modality });
            }
            prevModality = mov.modality;

            pushPage('verso', { pageType: 'void', modality: mov.modality });
            pushPage('recto', {
                pageType: 'phase-divider',
                movementId: mov.movementId,
                title: mov.title,
                modality: mov.modality,
            });

            for (const sp of mov.spreads || []) {
                let versoSlot = null;
                if (sp.verso?.fragmentId) {
                    const frag = fragmentMap.get(sp.verso.fragmentId);
                    versoSlot = {
                        kind: 'epigraph',
                        fragmentId: sp.verso.fragmentId,
                        text: frag?.text || '',
                        language: frag?.language || 'en',
                    };
                } else if (sp.verso?.assetId) {
                    versoSlot = buildPlateSlot(sp.verso, assetMap, slotOpts, plateCounter);
                }
                const rectoSlot = buildPlateSlot(sp.recto, assetMap, slotOpts, plateCounter);

                pushPage('verso', {
                    pageType: 'spread-verso',
                    spreadId: sp.spreadId,
                    layout: sp.layout,
                    modality: mov.modality,
                    slot: versoSlot,
                });
                pushPage('recto', {
                    pageType: 'spread-recto',
                    spreadId: sp.spreadId,
                    layout: sp.layout,
                    modality: mov.modality,
                    slot: rectoSlot,
                });
            }
        }

        if (ledger.includeCommentaryAppendix) {
            pushPage('verso', {
                pageType: 'colophon-telemetry',
                surface: profile.tokens?.surfaceDossier || '#111317',
            });
            pushPage('recto', {
                pageType: 'colophon-index',
                surface: profile.tokens?.surfaceDossier || '#111317',
                totalPlates: pCount,
            });
        }
    ```

- **Change:** Include `seriesId`, `luma255`, `labL`, and `attribution` on slots; compute `waveform` and `movementSummaries`; and paginate `colophon-index` in deterministic chunks of 32 plates per page:

    ```js
        const seriesMatch = String(slot.assetId).match(/^(p[0-9]+)-/);
        const luma255 = Number(asset?.metrics?.luma255 ?? invMeta.luma255 ?? 48);
        const labL = Number((asset?.metrics?.lab?.L ?? invMeta.lab?.L ?? 20).toFixed(1));

        return {
            kind: 'plate',
            plateNumber: plateNum,
            plateLabel: String(plateNum).padStart(3, '0'),
            assetId: slot.assetId,
            seriesId: (asset?.seriesId || seriesMatch?.[1] || 'p1').toUpperCase(),
            path: toTypstAssetPath(rawPath, rootDir),
            altText: asset?.altText || '',
            shortCaption: String(asset?.altText || '').slice(0, 68),
            modality: asset?.modality || 'bw',
            luma255,
            labL,
            scale,
            placedWidthMm,
            placedHeightMm,
            effectivePpi: computeEffectivePpi(widthPx, heightPx, placedWidthMm, placedHeightMm),
            showFolio: scale !== 'full-bleed',
        };
    }

    const ROMAN_NUMERALS = Object.freeze(['I', 'II', 'III', 'IV']);
    const INDEX_PAGE_SIZE = 32;

    function buildEpigraphSlot(verso, fragmentMap) {
        const frag = fragmentMap.get(verso.fragmentId);
        return {
            kind: 'epigraph',
            fragmentId: verso.fragmentId,
            text: frag?.text || '',
            attribution: frag?.attribution || null,
            language: frag?.language || 'en',
        };
    }

    function appendColophonPages(pages, pushPage, { ledger, profile, placedPlates, movementSummaries }) {
        if (!ledger.includeCommentaryAppendix) {
            return;
        }
        const surface = profile.tokens?.surfaceDossier || '#111317';
        pushPage('verso', {
            pageType: 'colophon-telemetry',
            surface,
            sourceFingerprintShort: String(ledger.sourceFingerprint || '').slice(0, 16),
            movementSummaries,
        });
        const chunks = [];
        for (let i = 0; i < placedPlates.length; i += INDEX_PAGE_SIZE) {
            chunks.push(placedPlates.slice(i, i + INDEX_PAGE_SIZE));
        }
        if (chunks.length === 0) {
            chunks.push([]);
        }
        chunks.forEach((entries, idx) => {
            const side = idx % 2 === 0 ? 'recto' : 'verso';
            const rangeStart = entries[0]?.plateLabel || '001';
            const rangeEnd = entries[entries.length - 1]?.plateLabel || rangeStart;
            pushPage(side, {
                pageType: 'colophon-index',
                surface,
                indexPageNumber: idx + 1,
                indexPageCount: chunks.length,
                rangeLabel: `${rangeStart}–${rangeEnd}`,
                totalPlates: placedPlates.length,
                entries,
            });
        });
    }

    export function compileLayoutIr(
        ledger,
        profile,
        { derivativeMap = {}, assetMetrics = {}, rootDir = null, coverImage = null } = {}
    ) {
        const assetMap = new Map((ledger.assets || []).map((a) => [a.assetId, a]));
        const fragmentMap = new Map((ledger.fragments || []).map((f) => [f.fragmentId, f]));
        let pCount = 0;
        const plateCounter = { next: () => ++pCount };
        const pageSize = profile?.pageSize || { widthMm: 210, heightMm: 260, bleedMm: 0 };
        const slotOpts = { derivativeMap, assetMetrics, rootDir, pageWidthMm: pageSize.widthMm };
        const pages = [];
        const placedPlates = [];
        const movementSummaries = [];

        const pushPage = (side, content) => {
            pages.push({ pageNumber: pages.length + 1, side, ...content });
        };

        pushPage('recto', {
            pageType: 'cover',
            title: ledger.title,
            subtitle: ledger.subtitle,
            author: ledger.author,
            coverImagePath: coverImage?.path ? toTypstAssetPath(coverImage.path, rootDir) : null,
            heroAssetId: ledger.constraints?.pinnedOpenerAssetId || 'p1-dscf4775',
            signature: '127 STATES · 51 MONO / 76 CHROMA',
        });

        let prevModality = null;
        (ledger.movements || []).forEach((mov, movIdx) => {
            if (prevModality && prevModality !== mov.modality) {
                pushPage('verso', { pageType: 'phase-reset-void', modality: mov.modality });
                pushPage('recto', { pageType: 'phase-reset-void', modality: mov.modality });
            }
            prevModality = mov.modality;

            pushPage('verso', { pageType: 'void', modality: mov.modality });
            const dividerPage = {
                pageType: 'phase-divider',
                movementId: mov.movementId,
                movementRoman: ROMAN_NUMERALS[movIdx] || String(movIdx + 1),
                movementIndexLabel: `0${movIdx + 1} / 04`,
                title: mov.title,
                modality: mov.modality,
                modalityLabel: mov.modality === 'bw' ? 'Achromatic Silver' : 'Chromatic',
                plateRange: '001–001',
                plateCount: 0,
                meanLuma: 0,
                waveformSlice: [],
            };
            pushPage('recto', dividerPage);
            const movPlates = [];

            for (const sp of mov.spreads || []) {
                let versoSlot = null;
                if (sp.verso?.fragmentId) {
                    versoSlot = buildEpigraphSlot(sp.verso, fragmentMap);
                } else if (sp.verso?.assetId) {
                    versoSlot = buildPlateSlot(sp.verso, assetMap, slotOpts, plateCounter);
                    if (versoSlot) {
                        placedPlates.push(versoSlot);
                        movPlates.push(versoSlot);
                    }
                }
                const rectoSlot = buildPlateSlot(sp.recto, assetMap, slotOpts, plateCounter);
                if (rectoSlot) {
                    placedPlates.push(rectoSlot);
                    movPlates.push(rectoSlot);
                }

                pushPage('verso', {
                    pageType: 'spread-verso',
                    spreadId: sp.spreadId,
                    layout: sp.layout,
                    modality: mov.modality,
                    slot: versoSlot,
                });
                pushPage('recto', {
                    pageType: 'spread-recto',
                    spreadId: sp.spreadId,
                    layout: sp.layout,
                    modality: mov.modality,
                    slot: rectoSlot,
                });
            }

            const firstLbl = movPlates[0]?.plateLabel || '001';
            const lastLbl = movPlates[movPlates.length - 1]?.plateLabel || firstLbl;
            const sumLuma = movPlates.reduce((acc, p) => acc + p.luma255, 0);
            dividerPage.plateRange = `${firstLbl}–${lastLbl}`;
            dividerPage.plateCount = movPlates.length;
            dividerPage.meanLuma = movPlates.length ? Number((sumLuma / movPlates.length).toFixed(1)) : 0;
            dividerPage.waveformSlice = movPlates.map((p) => ({
                plateNumber: p.plateNumber,
                luma255: p.luma255,
            }));
            movementSummaries.push({
                movementId: mov.movementId,
                movementRoman: dividerPage.movementRoman,
                title: mov.title,
                modalityLabel: dividerPage.modalityLabel,
                plateRange: dividerPage.plateRange,
                plateCount: dividerPage.plateCount,
                meanLuma: dividerPage.meanLuma,
            });
        });

        appendColophonPages(pages, pushPage, { ledger, profile, placedPlates, movementSummaries });
    ```

- **Find (Part B — return object of `compileLayoutIr` in `scripts/book/layout.mjs`, lines 175–185):**

    ```js
    return {
        editionId: ledger.editionId,
        revision: ledger.revision,
        profileId: profile.profileId,
        pageSize,
        tokens: profile.tokens,
        totalPages: pages.length,
        totalPlates: pCount,
        layoutHash,
        pages,
    };
    ```

- **Change (Part B):** Include root `waveform` array on the returned IR object:

    ```js
    return {
        editionId: ledger.editionId,
        revision: ledger.revision,
        profileId: profile.profileId,
        pageSize,
        tokens: profile.tokens,
        totalPages: pages.length,
        totalPlates: pCount,
        waveform: placedPlates.map((p) => ({
            plateNumber: p.plateNumber,
            luma255: p.luma255,
            labL: p.labL,
            modality: p.modality,
        })),
        layoutHash,
        pages,
    };
    ```

- **Verify:**

    ```bash
    ./scripts/run-npx.sh prettier --write scripts/book/layout.mjs && ./scripts/run-npx.sh eslint scripts/book/layout.mjs && ./scripts/run-npx.sh jest tests/js/book-render.test.js tests/js/book-preflight.test.js
    ```

---

#### WO-04 `[low] [visual]` — Overhaul `book/photobook.typ` to the Fw:Books × VOID × MACK Swiss Monograph Architecture

- **File:** [`book/photobook.typ`](file:///Users/lz/dev/ryusoh.github.io/book/photobook.typ#L1-L118)
- **Why:** Eliminates all seven visual sins (`SYS //` slashes, `#CE2323` red header underlines, raw `BW`/`COLOPHON-TELEMETRY` enum leaks, stretched `Syne ExtraBold` banners, Cover `18mm` vs `32mm` margin clash, saggy `horizon` centering with broken `full-bleed` bottom inset, unaligned folios, and 2-page colophon stub).
- **Find:** Entire contents of [`book/photobook.typ`](file:///Users/lz/dev/ryusoh.github.io/book/photobook.typ#L1-L118) (lines 1–118).
- **Change:** Replace `book/photobook.typ` with the Swiss Archival Monograph template using `Glow Sans SC Extended` as primary neo-grotesque voice, `48mm` Upper Optical Hang-Line (`Hängelinie`), rail-locked `6.5pt` folios, native `#curve` vector photometric waveforms, and the 4-column × 8-row Contact-Sheet Plate Index:

    ```typst
    // Canonical Typst template for INFINITE SYSTEMS (Fw:Books × VOID × MACK Portrait Monograph)
    #let ir = json(sys.inputs.at("ir", default: "layout-ir.json"))
    #let wf = ir.at("waveform", default: ())

    #let renderWaveform(points, widthMm: 166, heightMm: 22, showAccent: false) = pdf.artifact(
      box(
        width: widthMm * 1mm,
        height: heightMm * 1mm,
        stroke: (bottom: 0.3pt + rgb("#2A2D34"), top: 0.3pt + rgb("#2A2D34")),
        inset: 0mm,
      )[
        #let yExhale = (1 - 75 / 255) * heightMm * 1mm
        #let yInhale = (1 - 135 / 255) * heightMm * 1mm
        #place(top + left, dy: yExhale, line(length: 100%, stroke: (paint: rgb("#2A2D34"), thickness: 0.25pt, dash: "densely-dotted")))
        #if showAccent [
          #place(top + left, dy: yInhale, line(length: 100%, stroke: (paint: rgb("#CE2323"), thickness: 0.3pt, dash: "densely-dotted")))
        ]
        #if points.len() > 1 [
          #let stepX = widthMm / (points.len() - 1)
          #let cmds = points.enumerate().map(((i, pt)) => {
            let x = (i * stepX) * 1mm
            let y = ((1 - calc.clamp(pt.luma255, 0, 255) / 255) * heightMm) * 1mm
            if i == 0 { curve.move((x, y)) } else { curve.line((x, y)) }
          })
          #place(top + left, curve(stroke: 0.45pt + rgb("#E6E4DF"), ..cmds))
        ]
      ]
    )

    #set document(title: "INFINITE SYSTEMS", author: "Zhuang Liu")
    #set page(
      width: ir.pageSize.widthMm * 1mm,
      height: ir.pageSize.heightMm * 1mm,
      margin: 0mm,
      fill: rgb("#070709"),
    )
    #set text(
      font: ("Glow Sans SC Extended", "Syne"),
      fill: rgb("#E6E4DF"),
      size: 9.5pt,
      cjk-latin-spacing: auto,
      overhang: true,
    )

    #for (idx, pg) in ir.pages.enumerate() [
      #if idx > 0 [ #pagebreak() ]
      #if pg.pageType == "cover" [
        #block(width: 100%, height: 100%)[
          #block(width: 100%, height: 48mm, inset: (x: 18mm, top: 14mm, bottom: 0mm))[
            #grid(
              columns: (1fr, auto),
              text(font: "JetBrains Mono", size: 6.5pt, tracking: 1.2pt, fill: rgb("#8A9099"))[ZHUANG LIU · MONOGRAPH],
              text(font: "JetBrains Mono", size: 6.5pt, tracking: 1.0pt, fill: rgb("#8A9099"))[2021–2026],
            )
            #v(4.5mm)
            #heading(level: 1, bookmarked: true)[
              #text(font: ("Glow Sans SC Extended", "Syne"), weight: "bold", size: 17pt, tracking: 2.4pt, fill: rgb("#E6E4DF"))[INFINITE SYSTEMS]
            ]
          ]
          #if pg.at("coverImagePath", default: none) != none [
            #place(
              bottom + center,
              block(width: 210mm, height: 212mm, clip: true)[
                #image(pg.coverImagePath, width: 210mm, height: 212mm, fit: "cover", alt: "Monochrome close-up portrait cover photograph")
              ]
            )
          ]
          #place(
            bottom + left,
            dx: 18mm,
            dy: -10mm,
            text(font: "JetBrains Mono", size: 6.5pt, tracking: 0.8pt, fill: rgb("#8A9099"))[#pg.signature],
          )
        ]
      ] else if pg.pageType == "phase-divider" [
        #let mRoman = pg.at("movementRoman", default: "I")
        #let mIdxLbl = pg.at("movementIndexLabel", default: pg.movementId)
        #let mModLbl = pg.at("modalityLabel", default: upper(pg.modality))
        #let mRange = pg.at("plateRange", default: "001")
        #let mCount = pg.at("plateCount", default: 0)
        #let mLuma = pg.at("meanLuma", default: 0)
        #let mWf = pg.at("waveformSlice", default: ())
        #block(width: 100%, height: 100%, inset: (x: 24mm, top: 48mm, bottom: 24mm))[
          #pdf.artifact(line(length: 100%, stroke: 0.3pt + rgb("#2A2D34")))
          #v(3.5mm)
          #grid(
            columns: (1fr, auto),
            text(font: "JetBrains Mono", size: 6.5pt, tracking: 1.0pt, fill: rgb("#8A9099"))[MOVEMENT #mIdxLbl · #upper(mModLbl)],
            text(font: "JetBrains Mono", size: 6.5pt, tracking: 1.0pt, fill: rgb("#8A9099"))[PLATES #mRange],
          )
          #v(14mm)
          #text(font: "JetBrains Mono", size: 8pt, tracking: 1.5pt, fill: rgb("#8A9099"))[#mRoman]
          #v(2.5mm)
          #heading(level: 1, bookmarked: true)[
            #text(font: ("Glow Sans SC Extended", "Syne"), weight: "bold", size: 15pt, tracking: 2.2pt, fill: rgb("#E6E4DF"))[#pg.title]
          ]
          #v(1fr)
          #if mWf.len() > 1 [
            #renderWaveform(mWf, widthMm: 162, heightMm: 16, showAccent: pg.modality == "color")
            #v(3mm)
          ]
          #grid(
            columns: (1fr, auto),
            text(font: "JetBrains Mono", size: 6.5pt, fill: rgb("#8A9099"))[#mCount PLATES · MEAN LUMA #mLuma],
            text(font: "JetBrains Mono", size: 6.5pt, fill: rgb("#8A9099"))[#pg.movementId],
          )
        ]
      ] else if pg.pageType == "spread-verso" or pg.pageType == "spread-recto" [
        #if pg.slot != none and pg.slot.kind == "epigraph" [
          #let epigraphLang = if pg.slot.language == "zh-Hans" { "zh" } else { "en" }
          #let epigraphScript = if pg.slot.language == "zh-Hans" { "hans" } else { auto }
          #let attr = pg.slot.at("attribution", default: none)
          #block(width: 100%, height: 100%, inset: (left: 32mm, right: 48mm, top: 82mm, bottom: 32mm))[
            #pdf.artifact(line(length: 14mm, stroke: 0.3pt + rgb("#2A2D34")))
            #v(5mm)
            #set par(leading: 1.05em, spacing: 1.5em, justify: false)
            #set text(
              font: ("Glow Sans SC Extended", "Syne"),
              lang: epigraphLang,
              script: epigraphScript,
              fill: rgb("#D8D5CE"),
              size: 9.5pt,
            )
            #pg.slot.text
            #if attr != none [
              #v(4mm)
              #text(font: "JetBrains Mono", size: 6.5pt, fill: rgb("#8A9099"))[— #attr]
            ]
          ]
        ] else if pg.slot != none and pg.slot.kind == "plate" [
          #let isFull = pg.slot.scale == "full-bleed"
          #let isSym = pg.layout == "symmetric-diptych" and not isFull
          #let isAsym = pg.layout == "asymmetric-diptych" and not isFull
          #let isDiag = pg.layout == "diagonal-offset" and not isFull
          #let topHang = if isFull { 44mm } else if isDiag and pg.side == "recto" { 96mm } else if isDiag { 40mm } else { 50mm }
          #let outerRail = if isFull {
            0mm
          } else if isSym {
            38.6mm
          } else if isAsym {
            if pg.side == "verso" { 21.8mm } else { 70.5mm }
          } else if isDiag {
            26mm
          } else {
            (210mm - pg.slot.placedWidthMm * 1mm) / 2
          }
          #let plateInset = if isFull {
            (top: topHang, left: 0mm, right: 0mm)
          } else if isSym {
            if pg.side == "verso" { (top: topHang, right: 16mm) } else { (top: topHang, left: 16mm) }
          } else if isAsym {
            if pg.side == "verso" { (top: topHang, right: 16mm) } else { (top: topHang, left: 24mm) }
          } else if isDiag {
            if pg.side == "verso" { (top: topHang, left: 26mm) } else { (top: topHang, right: 26mm) }
          } else {
            (top: topHang)
          }
          #let plateAlign = if isFull {
            top + center
          } else if isSym or isAsym {
            if pg.side == "verso" { top + right } else { top + left }
          } else if isDiag {
            if pg.side == "verso" { top + left } else { top + right }
          } else {
            top + center
          }
          #block(width: 100%, height: 100%)[
            #block(width: 100%, height: 100%, inset: plateInset)[
              #align(plateAlign)[
                #image(pg.slot.path, width: pg.slot.placedWidthMm * 1mm, height: pg.slot.placedHeightMm * 1mm, fit: "contain", alt: pg.slot.altText)
              ]
            ]
            #if pg.slot.showFolio [
              #place(
                if pg.side == "verso" { bottom + left } else { bottom + right },
                dx: if pg.side == "verso" { outerRail } else { -outerRail },
                dy: -18mm,
                text(font: "JetBrains Mono", size: 6.5pt, tracking: 0.6pt, fill: rgb("#8A9099"))[#pg.slot.plateLabel],
              )
            ]
          ]
        ]
      ] else if pg.pageType == "colophon-telemetry" [
        #let summaries = pg.at("movementSummaries", default: ())
        #let fpShort = pg.at("sourceFingerprintShort", default: "9d2901560132539d")
        #block(width: 100%, height: 100%, fill: rgb("#111317"), inset: (x: 20mm, top: 22mm, bottom: 18mm))[
          #grid(
            columns: (1fr, auto),
            heading(level: 1, bookmarked: true)[
              #text(font: "JetBrains Mono", size: 7.5pt, tracking: 1.2pt, fill: rgb("#E6E4DF"))[ARCHIVAL COLOPHON & PHOTOMETRIC TELEMETRY]
            ],
            text(font: "JetBrains Mono", size: 6.5pt, fill: rgb("#8A9099"))[REV. #ir.revision · #upper(ir.profileId)],
          )
          #v(3mm)
          #pdf.artifact(line(length: 100%, stroke: 0.3pt + rgb("#2A2D34")))
          #v(6mm)
          #text(font: "JetBrains Mono", size: 6.5pt, tracking: 0.8pt, fill: rgb("#8A9099"))[
            PHOTOMETRIC LUMINANCE TRAJECTORY · LUMA255(t) ACROSS #ir.totalPlates PLATES
          ]
          #v(2.5mm)
          #renderWaveform(wf, widthMm: 170, heightMm: 26, showAccent: true)
          #v(6mm)
          #text(font: "JetBrains Mono", size: 6.5pt, tracking: 0.8pt, fill: rgb("#8A9099"))[MOVEMENT ARCHITECTURE]
          #v(2.5mm)
          #for m in summaries [
            #pdf.artifact(line(length: 100%, stroke: 0.25pt + rgb("#2A2D34")))
            #v(1.8mm)
            #grid(
              columns: (18mm, 34mm, 38mm, 28mm, 1fr),
              text(font: "JetBrains Mono", size: 6.5pt, fill: rgb("#8A9099"))[#m.movementId],
              text(font: ("Glow Sans SC Extended", "Syne"), weight: "bold", size: 7pt, fill: rgb("#E6E4DF"))[#m.title],
              text(font: "JetBrains Mono", size: 6.5pt, fill: rgb("#D8D5CE"))[#m.modalityLabel],
              text(font: "JetBrains Mono", size: 6.5pt, fill: rgb("#8A9099"))[PLATES #m.plateRange],
              align(right, text(font: "JetBrains Mono", size: 6.5pt, fill: rgb("#8A9099"))[#m.plateCount FRAMES · L #m.meanLuma]),
            )
            #v(1.8mm)
          ]
          #pdf.artifact(line(length: 100%, stroke: 0.25pt + rgb("#2A2D34")))
          #v(1fr)
          #grid(
            columns: (1fr, 1fr),
            column-gutter: 10mm,
            text(font: "JetBrains Mono", size: 6.5pt, fill: rgb("#8A9099"))[
              EDITION: #upper(ir.editionId) \
              AUTHOR: ZHUANG LIU \
              TRIM: #ir.pageSize.widthMm × #ir.pageSize.heightMm MM \
              EXTENT: #ir.totalPages PAGES · #ir.totalPlates PLATES
            ],
            text(font: "JetBrains Mono", size: 6.5pt, fill: rgb("#8A9099"))[
              PROFILE: #upper(ir.profileId) \
              VIEW: TWOPAGERIGHT SPREADS \
              TYPESET: GLOW SANS SC · SYNE · JETBRAINS MONO \
              POOL SHA256: #fpShort
            ],
          )
        ]
      ] else if pg.pageType == "colophon-index" [
        #let entries = pg.at("entries", default: ())
        #let rangeLbl = pg.at("rangeLabel", default: "001–127")
        #let idxPg = pg.at("indexPageNumber", default: 1)
        #let idxTotal = pg.at("indexPageCount", default: 1)
        #block(width: 100%, height: 100%, fill: rgb("#111317"), inset: (x: 16mm, top: 20mm, bottom: 16mm))[
          #grid(
            columns: (1fr, auto),
            heading(level: 1, bookmarked: idxPg == 1)[
              #text(font: "JetBrains Mono", size: 7.5pt, tracking: 1.0pt, fill: rgb("#E6E4DF"))[ILLUSTRATED PLATE INDEX · #rangeLbl]
            ],
            text(font: "JetBrains Mono", size: 6.5pt, fill: rgb("#8A9099"))[INDEX #idxPg / #idxTotal],
          )
          #v(2.5mm)
          #pdf.artifact(line(length: 100%, stroke: 0.3pt + rgb("#2A2D34")))
          #v(4mm)
          #if entries.len() > 0 [
            #grid(
              columns: (1fr, 1fr, 1fr, 1fr),
              column-gutter: 4.5mm,
              row-gutter: 4.5mm,
              ..entries.map(e => block(width: 100%, height: 22.5mm, clip: true)[
                #grid(
                  columns: (14mm, 1fr),
                  column-gutter: 2.2mm,
                  block(width: 14mm, height: 9.5mm, fill: rgb("#070709"))[
                    #if e.path != "" [
                      #image(e.path, width: 14mm, height: 9.5mm, fit: "cover")
                    ]
                  ],
                  block(width: 100%)[
                    #text(font: "JetBrains Mono", size: 5.8pt, fill: rgb("#E6E4DF"))[#e.plateLabel · #e.seriesId]
                    #linebreak()
                    #text(font: "JetBrains Mono", size: 5.2pt, fill: rgb("#8A9099"))[#upper(e.modality) · L* #e.labL]
                  ],
                )
                #v(1.2mm)
                #set par(leading: 0.45em)
                #text(font: ("Glow Sans SC Extended", "Syne"), size: 5.2pt, fill: rgb("#D8D5CE"))[#e.shortCaption]
              ])
            )
          ] else [
            #text(font: "JetBrains Mono", size: 7.5pt, fill: rgb("#8A9099"))[
              All #ir.totalPlates photographs sequenced with strict monochrome / chroma movement separation.
            ]
          ]
        ]
      ]
    ]
    ```

- **Guardrail:** Keep `#if e.path != ""` around thumbnail `#image(e.path, ...)` so unit tests (`tests/js/book-render.test.js`) that mock `execRunner` or pass uncached paths never fail inside Typst.
- **Verify:**

    ```bash
    ./scripts/run-npx.sh jest tests/js/book-render.test.js tests/js/book-preflight.test.js
    ```

---

#### WO-05 `[low] [visual]` — Regenerate inventory, proposals, sequence ledger, compiled PDFs, and Poppler proof images, then run `preflight` and `repro`

- **Files:** [`book/sequence.yaml`](file:///Users/lz/dev/ryusoh.github.io/book/sequence.yaml), `dist/infinite-systems-display.pdf`, `dist/infinite-systems-screen.pdf`
- **Change:** Run the full photobook pipeline so `book/sequence.yaml` picks up the sanitized bilingual fragments and multi-archetype spread rhythm, then render both PDF profiles, generate proof PNGs, and run preflight/reproducibility checks:

    ```bash
    node scripts/book.mjs inventory && node scripts/book.mjs orchestrate && node scripts/book.mjs plan && node scripts/book.mjs apply --plan seed-1 && node scripts/book.mjs render && node scripts/book.mjs proof && node scripts/book.mjs preflight && node scripts/book.mjs repro
    ```

- **Guardrail:** Verify via `pdffonts dist/infinite-systems-display.pdf` that `GlowSansSC-Extended`, `JetBrainsMono-Regular`, and `Syne` are embedded and that `node scripts/book.mjs preflight` and `node scripts/book.mjs repro` exit `0`.
- **Verify:**

    ```bash
    ./scripts/run-npx.sh jest tests/js/book-inventory.test.js tests/js/book-validate.test.js tests/js/book-optimize.test.js tests/js/book-assets.test.js tests/js/book-render.test.js tests/js/book-preview.test.js tests/js/book-preflight.test.js
    ```
