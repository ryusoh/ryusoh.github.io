# Research: Photobook eBook (PDF) Generation & Long-Term Management Architecture

**Status:** research findings (2026-11-17)
**Scope:** End-to-end architecture, rendering toolchain evaluation, color/resolution physics, and long-term editorial maintenance for compiling the photographic materials of `ryusoh.github.io` (`p1`–`p6`) into a publication-grade PDF photobook.

---

## 1. Research Question

If we build an eBook photobook (outputting a PDF file) from the existing photographic series and editorial materials in `ryusoh.github.io`, what is the best way to generate it and manage it over the long term—including future photo additions, deletions, sequence adjustments, and text/layout refinements?

---

## 2. Executive Summary & Recommended Architecture

### 2.1 The Short Answer

1. **Keep `assets/img/p<N>/index.md` as the single editorial authority.** Never maintain a separate GUI project file (InDesign `.indd`, Affinity `.afpub`, or Lightroom `.lrcat`) as the source of truth. The existing markdown files (`assets/img/p1/index.md`–`assets/img/p6/index.md`) and curatorial sidecars (`assets/img/p<N>/commentary.json`) already encode sequence order, titles, captions/credits, poetic caesuras (`>`), and structural act breaks (`---`), parsed deterministically by `parseMarkdownSource()` in [`scripts/build-page.mjs`](file:///Users/lz/dev/ryusoh.github.io/scripts/build-page.mjs#L63-L80).
2. **Use a 3-tier declarative pipeline (`index.md` $\to$ Node/Sharp Manifest & Asset Normalizer $\to$ Typst `v0.15.1` Compiler + PDF Catalog Post-Processor).**
    - **Primary Recommended Renderer — Typst (`v0.15.1`, Apache-2.0):** Reads structured JSON/YAML directly (`json()`, `yaml()`), embeds JPEG streams losslessly via `/DCTDecode` without re-encoding (`crates/typst-pdf/src/image.rs`), preserves per-image embedded ICC profiles (including the 13 Display P3 images in `p1`–`p6`), natively handles mixed Latin (`Syne`) + Simplified Chinese (`Glow Sans SC`) typography with automatic CJK-Latin spacing and font subsetting, supports custom page geometry and print bleed (`#set page(bleed: ...)`), emits PDF/A archival standards (`--pdf-standard a-2b` / `a-4`), and guarantees bit-for-bit reproducible builds via `--creation-timestamp` / `SOURCE_DATE_EPOCH`.
    - **Zero-Install Immediate Alternative — Headless Chrome (`Skia/PDF m157`, already installed) + CSS Paged Media (`@page`):** Empirically verified on this machine to pass through original sRGB and Display P3 JPEG streams byte-for-byte without re-compression when EXIF orientation is top-left (`src/pdf/SkPDFBitmap.cpp`), while supporting CSS `@page` sizes, named pages, the 16 CSS `@page` margin boxes (shipped in Chrome 131), existing `.woff2` web fonts, and PDF document outlines (`--generate-pdf-document-outline`).
3. **Emit two gitignored PDF build profiles (`master` vs. `screen`) from the same source:**
    - Because lossless JPEG passthrough embeds original byte streams verbatim, a raw passthrough of all 127 sequenced photos across `p1`–`p6` totals **201.0 MB** (with a single `6240 × 4160` outlier `assets/img/p3/DSCF7318-3.jpg` consuming **28.9 MB**).
    - A small Node/Sharp pre-stage (`scripts/build-book.mjs`, reusing `sharp` from `package.json`) should normalize images into a gitignored `.cache/book-img/` directory for two targets:
        - **Archival / 4K Display Master (`dist/photobook-master.pdf`)**: Lossless passthrough for all `2048px` JPEGs (preserving Display P3 and sRGB ICC profiles) while downsampling only the 5 oversized `>2048px` frames in `p3`/`p5` to `2048px` (`~155 MB` full anthology; `~15–35 MB` per single-series monograph).
        - **Portable Reader Edition (`dist/photobook-screen.pdf`)**: Normalized via `sharp` (`2048px` long edge, sRGB, MozJPEG `quality: 82`, `chromaSubsampling: '4:2:0'`) to **~45–55 MB** for the full 127-photo anthology (`~6–12 MB` per series monograph) with negligible visual difference on tablet/laptop screens.
4. **Stamp `/PageLayout /TwoPageRight` in the PDF Document Catalog.** Photobooks are experienced as facing recto/verso spreads where Page 1 (the cover) stands alone on the right and Pages 2–3, 4–5 open side-by-side (ISO 32000-1:2008 §7.7.2, Table 28). A lightweight post-processing step using Ghostscript `pdfmark` (already installed at `/opt/homebrew/bin/gs`) or `qpdf` sets `/PageLayout /TwoPageRight` and `/PageMode /UseOutlines` so Apple Preview, Adobe Acrobat, and tablet readers open the PDF in two-page book view automatically.

### 2.2 End-to-End Architecture Diagram

```mermaid
flowchart TD
    subgraph Source ["1. Canonical Repo Sources (Git-Tracked)"]
        MD["assets/img/p1..p6/index.md<br/>(Sequence, Captions, > Caesuras, --- Breaks)"]
        COMM["assets/img/p1..p6/commentary.json<br/>(Roles, Critiques, Target-Aware Transitions)"]
        BOOK["book/book.yaml<br/>(Book Metadata, Series Order, Optional Layout Hints)"]
        IMGS["assets/img/p1..p6/*.jpg<br/>(127 Sequenced JPEGs: sRGB + Display P3)"]
    end

    subgraph Engine ["2. Deterministic Build Pipeline (Node.js + Sharp + Typst)"]
        PARSE["Manifest Builder (Node.js)<br/>Reuses parseMarkdownSource() & inspect_gallery.mjs"]
        SHARP["Sharp Asset Normalizer (.cache/book-img/)<br/>Master tier (passthrough) vs. Screen tier (q82 MozJPEG)"]
        TYPST["Typst Compiler (book/photobook.typ)<br/>#set page, #image(icc: auto), CJK/Latin Fonts, Outlines"]
        POST["PDF Catalog Finisher (gs pdfmark / qpdf)<br/>Sets /PageLayout /TwoPageRight & /PageMode /UseOutlines"]
    end

    subgraph Output ["3. Derived Artifacts (Gitignored dist/)"]
        PDF_FULL["dist/photobook-master.pdf & photobook-screen.pdf<br/>(Complete 6-Series Anthology)"]
        PDF_MONO["dist/p1-book.pdf .. dist/p6-book.pdf<br/>(Per-Series Monographs)"]
    end

    MD --> PARSE
    COMM --> PARSE
    BOOK --> PARSE
    IMGS --> SHARP
    PARSE --> TYPST
    SHARP --> TYPST
    TYPST --> POST
    POST --> PDF_FULL
    POST --> PDF_MONO
```

---

## 3. Primary Sources Consulted

1. **Repository Source Code & Governing Documentation (`ryusoh.github.io`)**
    - [`scripts/build-page.mjs`](file:///Users/lz/dev/ryusoh.github.io/scripts/build-page.mjs): `parseMarkdownSource()` (lines 63–80), `ensureImageVariants()` (lines 85–164), `buildPage()` (lines 308–420).
    - [`.agents/skills/sequence/SKILL.md`](file:///Users/lz/dev/ryusoh.github.io/.agents/skills/sequence/SKILL.md) and [`docs/sequence-skill-architecture.md`](file:///Users/lz/dev/ryusoh.github.io/docs/sequence-skill-architecture.md): Sequence authority rules, CIELAB waveform/transition metrics, and target-aware transition schema (`"transition": { "to": "NEXT.jpg", "text": "..." }`).
    - [`docs/page-generation-pipeline.md`](file:///Users/lz/dev/ryusoh.github.io/docs/page-generation-pipeline.md): 3-tier hybrid architecture separating editorial markdown from deterministic compilation.
    - [`docs/archive-protocol.md`](file:///Users/lz/dev/ryusoh.github.io/docs/archive-protocol.md) and [`docs/contact-sheet-ledger-design.md`](file:///Users/lz/dev/ryusoh.github.io/docs/contact-sheet-ledger-design.md): RAW/JPEG master archive protocol and XMP/Lightroom ingest pipeline.
    - [`tools/subset_fonts.py`](file:///Users/lz/dev/ryusoh.github.io/tools/subset_fonts.py): CJK character extraction and `GlowSansSC-Extended-Bold.otf` source path resolution (lines 17–68).
2. **Typst Official Documentation & Compiler Source Code (`v0.15.1`, released 2026-07-17)**
    - Typst Reference: [`image`](https://typst.app/docs/reference/visualize/image/), [`page`](https://typst.app/docs/reference/layout/page/), [`pdf`](https://typst.app/docs/reference/pdf/), [`document`](https://typst.app/docs/reference/model/document/), [`text`](https://typst.app/docs/reference/text/text/), [`heading`](https://typst.app/docs/reference/model/heading/), [`json`](https://typst.app/docs/reference/data-loading/json/), [`yaml`](https://typst.app/docs/reference/data-loading/yaml/), and [Changelogs `0.12.0`–`0.15.1`](https://typst.app/docs/changelog/0.15.1/).
    - `typst-pdf` crate source (`v0.15.1`): [`crates/typst-pdf/src/image.rs`](https://github.com/typst/typst/blob/v0.15.1/crates/typst-pdf/src/image.rs) (lines 164–230) and [`crates/typst-cli/src/args.rs`](https://github.com/typst/typst/blob/v0.15.1/crates/typst-cli/src/args.rs) (lines 346–490).
    - `krilla` PDF generation engine (`v0.8.2`, used by `typst-pdf`): [`crates/krilla/src/graphics/image/mod.rs`](https://github.com/LaurenzV/krilla/blob/main/crates/krilla/src/graphics/image/mod.rs) (lines 259–285, 416–560, 708–736).
    - `fontdb` font loader (`RazrFalcon/fontdb`, used by `typst-kit`): [`src/lib.rs`](https://github.com/RazrFalcon/fontdb/blob/master/src/lib.rs) (line 301).
3. **Chromium / Skia PDF Backend, Puppeteer, and W3C CSS Paged Media**
    - Skia PDF JPEG serialization source: [`src/pdf/SkPDFBitmap.cpp`](https://skia.googlesource.com/skia/+/refs/heads/main/src/pdf/SkPDFBitmap.cpp) (`write_icc_profile()` lines 172–193, `do_jpeg()` lines 287–350, `serialize_image()` lines 375–405).
    - Chrome Developer Documentation: [Add content to the margins of web pages when printed using CSS (Chrome 131)](https://developer.chrome.com/blog/print-margins) and [Chrome Platform Status #5195769732923392 (`@page` margin boxes, milestone 131)](https://chromestatus.com/feature/5195769732923392) / [#5173237715566592 (Named pages, milestone 85)](https://chromestatus.com/feature/5173237715566592).
    - Puppeteer API Reference: [`PDFOptions`](https://github.com/puppeteer/puppeteer/blob/main/docs/api/puppeteer.pdfoptions.md).
    - Paged.js repository & registry metadata: [`github.com/pagedjs/pagedjs`](https://github.com/pagedjs/pagedjs) and `registry.npmjs.org/pagedjs` (`v0.4.3`).
4. **WeasyPrint & Prince XML Documentation and Source Code**
    - WeasyPrint (`v70.0`) documentation ([API Reference](https://doc.courtbouillon.org/weasyprint/stable/api_reference.html), [Common Use Cases](https://doc.courtbouillon.org/weasyprint/stable/common_use_cases.html)) and source code [`weasyprint/images.py`](https://github.com/Kozea/WeasyPrint/blob/main/weasyprint/images.py) (lines 36–160) & [`weasyprint/pdf/stream.py`](https://github.com/Kozea/WeasyPrint/blob/main/weasyprint/pdf/stream.py) (lines 325–345).
    - Prince XML documentation: [PDF Output Options](https://www.princexml.com/doc/prince-output/), [Graphics & Color Management](https://www.princexml.com/doc/graphics/), [Command-Line Reference](https://www.princexml.com/doc/command-line/), and [Purchase / Licensing](https://www.princexml.com/purchase/).
5. **ISO PDF Standards & Print Production Specifications**
    - **ISO 32000-1:2008 (PDF 1.7 Specification)**: [Clause 7.7.2 _Document Catalog_ (Table 28: `PageLayout` and `PageMode`)](https://opensource.adobe.com/dc-acrobat-sdk-docs/pdfstandards/PDF32000_2008.pdf), Clause 8.4.5 _Graphics State Parameter Dictionaries_, Clause 8.6.5.5 _ICCBased Colour Spaces_, and Clause 14.11.2 _Page Boundaries_ (`MediaBox`, `CropBox`, `BleedBox`, `TrimBox`, `ArtBox`).
    - **Blurb Print Specifications**: [Image Quality & Resolution Checklist (300 PPI standard)](https://www.blurb.com/blog/image-quality-checklist/) and [A Brief Note on Color Management (PDF/X-3, CMYK vs. sRGB workflow)](https://www.blurb.com/downloads/pdf_to_book/BriefNoteColor.pdf).

---

## 4. Claim-by-Claim Evidence & Technical Analysis

### 4.1 Audit of Repository Materials (`assets/img/p1`–`p6`)

An audit of `assets/img/p1` through `assets/img/p6` using `sips`, `exiftool`, and `scripts/build-page.mjs` established the exact inventory of materials available for the eBook:

| Series  | Title (`index.md` Frontmatter)                         | Sequenced JPEGs | Unsequenced Orphans | `>` Quote Lines | `---` Breaks | CJK Lines | Display P3 JPEGs | Sequenced JPEG Payload |
| :------ | :----------------------------------------------------- | --------------: | ------------------: | --------------: | -----------: | --------: | ---------------: | ---------------------: |
| `p1`    | _I TEAR UP THE BAY WHEN I COME THROUGH_                |              18 |                   0 |              17 |            2 |         0 |                2 |                35.0 MB |
| `p2`    | _I DO NOT CARE IF WE GO DOWN IN HISTORY AS BARBARIANS_ |              21 |                   0 |               5 |            2 |         0 |                2 |                28.1 MB |
| `p3`    | _AEROBATIC ACTIVITIES_                                 |              23 |                   1 |               4 |            2 |         0 |                0 |                60.4 MB |
| `p4`    | _DAS GESPENST_                                         |              20 |                   0 |               9 |            2 |         0 |                1 |                21.6 MB |
| `p5`    | _SELF PORTRAITS AND BEHIND THE SCENES_                 |              13 |                   0 |              17 |            2 |         0 |                3 |                23.9 MB |
| `p6`    | _HYPERSTARS SUCKED INTO THE HYPERMASSIVE_              |              32 |                  11 |              70 |            2 |        43 |                4 |                32.0 MB |
| **All** | **6 Portfolio Series (`p1`–`p6`)**                     |         **127** |              **12** |         **122** |       **12** |    **43** |           **12** |           **201.0 MB** |

_(Note: 1 additional Display P3 JPEG exists among the 12 unsequenced orphan files—`assets/img/p3/DSCF2056-2.jpg`—bringing total disk JPEGs across `p1`–`p6` to 139 files / 213.5 MB, with 126 sRGB and 13 Display P3 files.)_

#### Key Material Findings

1. **Pixel dimensions & effective print resolution**:
    - **118 of 139 JPEGs** have a long edge of **`2048 px`** and short edge of **`1365 px`** (or `1364 px`), i.e., standard 3:2 aspect ratio exported at `240 DPI` metadata tag (`sips -g pixelWidth -g pixelHeight -g dpiWidth`).
    - **5 JPEGs** are higher-resolution exports (`p3`: `6240 × 4160` at 28.9 MB and `4675 × 3117` at 8.5 MB; `p5`: `3840 × 2560` at 5.6 MB, `3475 × 2268` at 4.9 MB, and `3079 × 2045` at 2.9 MB).
    - **6 JPEGs** are lower-resolution crops (`p2`: `1860 × 1240`, `1676 × 1117`; `p3`: `1363 × 907`; `p4`: `1364 × 908`, `910 × 607`; `p5`: `1960 × 1306`, `1946 × 1297`, `1937 × 1291`).
    - Per Blurb's print resolution specification ([Blurb Image Quality Checklist](https://www.blurb.com/blog/image-quality-checklist/)), print production targets **300 PPI** at 100% scale (with 150–200 PPI as the acceptable floor). A `2048 × 1365 px` image supports:
        - **At 300 PPI (fine-press standard)**: up to **`6.83 × 4.55 in` (`173.4 × 115.6 mm`)**.
        - **At 240 PPI (native Lightroom tag)**: up to **`8.53 × 5.69 in` (`216.7 × 144.5 mm`)**.
        - **At 200 PPI (viewing-distance floor)**: up to **`10.24 × 6.83 in` (`260.1 × 173.4 mm`)**.
        - **For screen/eBook PDF viewing**: `2048 × 1365 px` is ideal for Retina/4K tablet and laptop displays without upscaling. If a large-format physical print edition (`10 × 8 in` or `13 × 11 in` at 300 PPI $\approx 3900 \times 3300\text{ px}$) is later desired, full-resolution JPEG/TIFF masters from the personal archive ([`docs/archive-protocol.md`](file:///Users/lz/dev/ryusoh.github.io/docs/archive-protocol.md)) must be substituted into the build directory while keeping `index.md` unchanged.
2. **Mixed ICC Color Profiles (`sRGB` + `Display P3`)**:
    - While 126 JPEGs carry `sRGB IEC61966-2.1`, **13 JPEGs carry Apple `Display P3` ICC profiles**. Any PDF generator that strips ICC profiles and tags images as uncalibrated `/DeviceRGB` will cause those 13 Display P3 images to appear desaturated or hue-shifted in color-managed PDF viewers.
3. **Multilingual Typography (`Latin` + `Simplified Chinese`)**:
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
    - Typst natively loads structured files via [`json("path.json")`](https://typst.app/docs/reference/data-loading/json/) and [`yaml("path.yaml")`](https://typst.app/docs/reference/data-loading/yaml/). Because `assets/img/p<N>/index.md` combines YAML frontmatter with a custom line-oriented body syntax (`FILENAME.jpg | caption`, `>` quotes, `---`), a tiny Node script importing `parseMarkdownSource()` from `scripts/build-page.mjs` can emit a unified `book-manifest.json` consumed directly by `#let book = json("book-manifest.json")`.
- **Typography, CJK Support, and Font Format Constraints**:
    - Typst's [`text` element](https://typst.app/docs/reference/text/text/#parameters-font) accepts a priority fallback array `#set text(font: ("Syne", "Glow Sans SC Extended"), cjk-latin-spacing: auto)` and supports `covers: "latin-in-cjk"`.
    - Font loading in `typst-kit` delegates to `fontdb` ([`RazrFalcon/fontdb/src/lib.rs:301`](https://github.com/RazrFalcon/fontdb/blob/master/src/lib.rs#L301)): `"Will load ttf, otf, ttc and otc fonts."` Typst **does not load `.woff2` web fonts**. While `GlowSansSC-*.otf` is already in `~/Library/Fonts/`, `Syne` is currently stored in the repo only as `.woff2` (`assets/fonts/syne-latin.woff2`), so a static `.ttf` or `.otf` file for `Syne` must be placed in `assets/fonts/` (or decompressed from `syne-latin.woff2` via `fontTools.ttLib.woff2.decompress`) when using Typst.
- **PDF Standards, Outlines, and Reproducibility**:
    - Per the [Typst PDF Reference](https://typst.app/docs/reference/pdf/), `--pdf-standard` supports `1.4`, `1.5`, `1.6`, `1.7` (default), `2.0`, `a-1b`, `a-1a`, `a-2b`, `a-2u`, `a-2a`, `a-3b`, `a-3u`, `a-3a`, `a-4`, `a-4f`, `a-4e`, and `ua-1`. **PDF/X (`pdf/x-1a`, `pdf/x-4`) is not yet natively supported by Typst `0.15.1`.**
    - Headings with `bookmarked: true` (or `outlined: true` by default) automatically populate the PDF bookmark outline tree ([`heading.bookmarked`](https://typst.app/docs/reference/model/heading/#parameters-bookmarked)).
    - Reproducible builds are enforced via `--creation-timestamp <UNIX_TIMESTAMP>` or `SOURCE_DATE_EPOCH` ([`crates/typst-cli/src/args.rs:425-429`](https://github.com/typst/typst/blob/v0.15.1/crates/typst-cli/src/args.rs#L425-L429)) combined with `--ignore-system-fonts --font-path assets/fonts`.

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
    - However, source inspection of [`weasyprint/images.py:134-158`](https://github.com/Kozea/WeasyPrint/blob/main/weasyprint/images.py#L134-L158) revealed a critical color-management defect for this repo: `RasterImage.draw()` hardcodes `color_space = '/DeviceRGB'` on every RGB image XObject and never extracts per-image embedded ICC profiles from Pillow (`pillow_image.info.get('icc_profile')`). Thus, the 13 Display P3 photographs in `p1`–`p6` would have their wide-gamut pixel values misinterpreted as uncalibrated `/DeviceRGB`.
- **Prince XML (`v16`, Commercial)**:
    - Full support for CSS Paged Media, JPEG passthrough, ICC profiles, PDF/A, PDF/X-4 (`--pdf-profile=PDF/X-4 --pdf-output-intent=...`), and CSS viewer preferences (`@prince-pdf { -prince-pdf-page-layout: two-page-right; }`, [Prince Output Docs](https://www.princexml.com/doc/prince-output/)).
    - Disqualified as primary recommendation due to proprietary licensing ($495 desktop / $2,000+ server license; free license injects a promotional watermark on the document).
- **Adobe Lightroom CC vs. Lightroom Classic**:
    - This machine has **Adobe Lightroom CC** (`/Applications/Adobe Lightroom CC`), the cloud-centric desktop client. The **Book Module** (Blurb integration and multi-page PDF book export) exists **exclusively in Adobe Lightroom Classic** ([Adobe Helpx: Create photo books in Lightroom Classic](https://helpx.adobe.com/lightroom-classic/help/create-photo-books.html)), not in Lightroom CC.
    - Even in Lightroom Classic, book layouts are locked inside a binary SQLite `.lrcat` catalog outside Git, cannot parse `assets/img/p<N>/index.md` or `commentary.json`, and restrict page dimensions to fixed Blurb trim templates.

### 4.3 Toolchain Comparison Matrix

| Capability / Criterion                   | **Typst (`v0.15.1`)** (Recommended)              | **Headless Chrome (`m157`)** (Zero-Install)       | **WeasyPrint (`v70.0`)**                         | **Prince XML (`v16`)**                       | **LaTeX (`LuaLaTeX`)**                | **InDesign / Affinity / LrC**        |
| :--------------------------------------- | :----------------------------------------------- | :------------------------------------------------ | :----------------------------------------------- | :------------------------------------------- | :------------------------------------ | :----------------------------------- |
| **Driven directly from `index.md`/JSON** | Native (`json()`, `yaml()`)                      | Via Node HTML generator                           | Via Node/Python HTML generator                   | Via Node HTML generator                      | Requires TeX escaping & codegen       | Manual GUI import (breaks Git sync)  |
| **Lossless JPEG `/DCTDecode` embed**     | Yes (`krilla::Image::from_jpeg_with_icc`)        | Yes (verified in `SkPDFBitmap.cpp` & locally)     | Yes (when `optimize` & `jpeg_quality` unset)     | Yes (unless `-prince-image-magic` set)       | Yes                                   | Re-encodes at export quality setting |
| **Per-image Display P3 ICC preserved**   | **Yes** (`icc: auto` extracts embedded ICC)      | **Yes** (verified 536-byte P3 `/ICCBased` stream) | **No** (hardcodes `/DeviceRGB` in `images.py`)   | **Yes**                                      | Requires manual `/ColorSpace` objekts | Converts to single export space      |
| **CJK (`p6`) + Latin (`Syne`) layout**   | Native fallback list + `cjk-latin-spacing: auto` | Native browser font fallback + `.woff2` support   | Pango font fallback                              | Native CSS font fallback                     | `luatexja` package (complex setup)    | Manual style mapping                 |
| **Font formats accepted**                | `.ttf`, `.otf`, `.ttc`, `.otc` (no `.woff2`)     | `.woff2`, `.ttf`, `.otf`                          | `.woff2`, `.ttf`, `.otf`                         | `.woff2`, `.ttf`, `.otf`                     | `.ttf`, `.otf`                        | `.ttf`, `.otf`                       |
| **Print bleed & `/TrimBox` support**     | **Yes** (`#set page(bleed: 3mm)` in `0.15+`)     | No (`/MediaBox` only)                             | Yes (`@page { bleed: 3mm }`)                     | Yes (`@page { prince-bleed: 3mm }`)          | Via `geometry` / `crop` packages      | Yes                                  |
| **PDF/A & PDF/X standards**              | PDF/A-1..4, PDF/UA-1 (no PDF/X yet)              | None (PDF 1.4 only)                               | PDF/A-1..4, PDF/UA-1..2, PDF/X-1a/3/4            | PDF/A-1..3, PDF/UA-1, PDF/X-1a/3/4           | Via `pdfx` / LaTeX PDF management     | PDF/X-1a, PDF/X-3, PDF/X-4           |
| **Deterministic (`SOURCE_DATE_EPOCH`)**  | **Yes** (`--creation-timestamp`)                 | No (`CreateDate` changes every run)               | Partially                                        | No                                           | Yes (`FORCE_SOURCE_DATE=1`)           | No                                   |
| **Install & License footprint**          | `brew install typst` (~15 MB single binary, OSS) | **Already installed** (`Google Chrome.app`)       | `brew install weasyprint` (Python + Cairo/Pango) | Proprietary ($495–$2,000+, free watermarked) | `brew install --cask mactex` (4+ GB)  | Proprietary GUI apps                 |

---

## 5. Long-Term Management & Editorial Lifecycle Design

### 5.1 Single Source of Truth: Zero-Duplication Editorial Workflow

The defining requirement for long-term maintenance is that **adding, deleting, or reordering a photo—or editing a poetic stanza—must happen in one place (`assets/img/p<N>/index.md`) and propagate automatically to both the website and the PDF photobook.**

| Editorial Action                  | How You Do It (Long-Term Ritual)                                                                                               | Web Effect (`make page ID=p<N>`)                | Photobook Effect (`make book`)                                                      |
| :-------------------------------- | :----------------------------------------------------------------------------------------------------------------------------- | :---------------------------------------------- | :---------------------------------------------------------------------------------- |
| **Add a photo**                   | Drop `NEW.jpg` into `assets/img/p<N>/` and insert `NEW.jpg \| optional caption` at the desired line in `index.md`.             | Generates AVIF/WebP tiers, ThumbHash, HTML DOM. | Inserts a new plate page at that exact position in the chapter sequence.            |
| **Delete a photo**                | Remove or comment out the `FILENAME.jpg` line in `assets/img/p<N>/index.md` (file can stay on disk as an unsequenced outtake). | Removes `<picture>` from `p<N>/index.html`.     | Removes the plate page; subsequent pages and TOC page numbers reflow automatically. |
| **Reorder photos**                | Reorder lines in `index.md` (by hand or via `/sequence p<N>`).                                                                 | Rebuilds gallery DOM in new sequence.           | Re-renders plates and updates target-aware commentary transitions automatically.    |
| **Adjust image crop / color**     | Re-export `FILENAME.jpg` from Lightroom to `assets/img/p<N>/FILENAME.jpg` with the same filename.                              | `build-page.mjs` refreshes responsive variants. | Next `make book` embeds the updated JPEG stream in place.                           |
| **Add/edit poetic caesura (`>`)** | Edit `>` blockquote stanzas or `---` section breaks in `index.md`.                                                             | Updates `<blockquote>` / `<hr />` in HTML.      | Updates epigraph / caesura pages or section pauses in the PDF.                      |
| **Add a whole new series (`p7`)** | Create `assets/img/p7/index.md` + photos, add `p7` to `book/book.yaml`.                                                        | Adds `p7/` to site nav and preloader.           | Adds Chapter VII and updates book Table of Contents & PDF Outlines.                 |

### 5.2 Mapping `index.md` Primitives to Photobook Page Archetypes

Because `118 of 139` photographs share a uniform **3:2 landscape aspect ratio (`2048 × 1365`)**, the natural page geometry for an eBook photobook is a **landscape page** (e.g., **`300 mm × 200 mm`** or **`11 in × 8.5 in` / `297 mm × 210 mm` A4 landscape**) where each page corresponds to one screen view, or a **two-page spread (`PageLayout /TwoPageRight`)** when viewed in a desktop PDF reader.

Every construct already parsed by [`scripts/build-page.mjs`](file:///Users/lz/dev/ryusoh.github.io/scripts/build-page.mjs#L334-L420) maps cleanly to a photobook layout archetype without altering the existing `index.md` syntax:

1. **YAML Frontmatter (`title`, `description`, `keywords`, `ogImage`)** $\to$ **Chapter Recto Opener**:
    - Starts on a fresh recto (odd) page (`pagebreak(to: "odd")` in Typst or `break-before: right` in CSS).
    - Renders the chapter numeral (`I`–`VI`), series `title` in `Syne` 800 uppercase, `description` subtitle, and optional `ogImage` frontispiece.
2. **Poetic Caesura (`> ...` Blockquote)** $\to$ **Interlude / Epigraph Page (or Facing Verso)**:
    - Preserves the Kawauchi/Eskenazi "elliptical white space" documented in [`docs/sequence-skill-architecture.md`](file:///Users/lz/dev/ryusoh.github.io/docs/sequence-skill-architecture.md#L79-L95): renders centered or lower-third verse on a high-margin breathing page (using `Syne` for Latin and `Glow Sans SC` for `p6` Chinese stanzas).
    - When a blockquote immediately precedes an image, the template can optionally place the verse on the **left (verso) page** and the photograph on the **facing right (recto) page**, creating a classic Aperture/Mack photobook spread.
3. **Horizontal Rule (`---`)** $\to$ **Act Break / Silent Pause**:
    - Inserts a structural pause (blank verso or minimalist asterism divider) between movements.
4. **Image Line (`FILENAME.jpg | caption` or `(by @handle)`)** $\to$ **Photographic Plate**:
    - Default **Museum Plate**: Generous white or deep-charcoal (`#0d0d0d`, matching the site's dark theme) border (`margin: 14mm`) using `fit: "contain"` so the full 3:2 frame is never cropped.
    - Optional **Full-Bleed Plate**: Margin `0mm` (`fit: "cover"`) for high-impact horizon/chiaroscuro openers.
    - Optional **Curatorial Notes Appendix (`commentary.json`)**: Because `assets/img/p1..p6/commentary.json` already stores per-frame `role`, `subject`, `thematicMeaning`, `vectors`, and target-aware `transition` objects, the book compiler can automatically generate an **Illustrated Plate Index / Curatorial Appendix** at the back of the PDF (similar to Robert Frank's _The Americans_ or Magnum contact-sheet endmatter) without cluttering the photographic plates themselves.

### 5.3 Optional Non-Invasive Book Configuration (`book/book.yaml`)

To avoid polluting `assets/img/p<N>/index.md` with PDF-only settings that `scripts/build-page.mjs` does not know about, book-wide configuration and optional per-frame layout overrides should live in a small declarative `book/book.yaml` file:

```yaml
title: 'SELECTED WORKS'
subtitle: 'Street Photography & Visual Essays, 2021–2026'
author: 'Zhuang Liu'
theme: 'dark' # "dark" (#0d0d0d screen theme) or "paper" (#faf8f5 warm print theme)
pageSize:
    width: '300mm'
    height: '200mm'
    bleed: '0mm' # Set to "3mm" when exporting for print
includeCommentaryAppendix: true
series:
    - id: p1
      overrides:
          DSCF4775.jpg: { layout: 'full-bleed' }
    - id: p2
    - id: p3
    - id: p4
    - id: p5
    - id: p6
```

If a photo is added or deleted in `assets/img/p1/index.md`, `book/book.yaml` needs **zero edits** unless you want a special layout override (such as `full-bleed`) on a specific frame.

### 5.4 Solving the 201 MB Payload Problem: Dual-Tier Asset Normalization

Our audit in §4.1 showed that the 127 sequenced JPEGs across `p1`–`p6` total **201.0 MB** because several files are uncompressed high-bit-depth exports (notably `assets/img/p3/DSCF7318-3.jpg` at `6240 × 4160` / **28.9 MB** and `assets/img/p3/DSCF5759-5.jpg` at `4675 × 3117` / **8.5 MB**, while the median JPEG across the repo is **1.20 MB**).

Because `sharp` (`^0.35.5`) is already a first-class dependency in [`package.json`](file:///Users/lz/dev/ryusoh.github.io/package.json#L38), the book build script should normalize images into `.cache/book-img/<tier>/` (cached by file `mtime` + size, just like `ensureImageVariants()` in `scripts/build-page.mjs:85-164`):

1. **`--tier master` (Archival / 4K Display Master)**:
    - Any JPEG with `max(width, height) <= 2048` and file size `<= 3 MB` is symlinked/copied **untouched** (100% lossless `/DCTDecode` passthrough, preserving embedded Display P3 and sRGB ICC profiles).
    - Only the 5 oversized `>2048px` frames in `p3`/`p5` are resized via `sharp(input).resize(2048, 2048, { fit: 'inside', withoutEnlargement: true }).keepIccProfile().jpeg({ quality: 92, mozjpeg: true })`, cutting ~42 MB of bloat from those 5 files alone.
2. **`--tier screen` (Lightweight Distributable eBook)**:
    - Runs `sharp(input).resize(2048, 2048, { fit: 'inside', withoutEnlargement: true }).toColorspace('srgb').jpeg({ quality: 82, mozjpeg: true, chromaSubsampling: '4:2:0' })`.
    - Reduces average per-image size from `1.58 MB` to `~380 KB`, bringing the complete 127-photo anthology PDF down from **201 MB $\to$ ~48 MB** (and individual series monographs `p1`–`p6` to **~6–12 MB** each).

### 5.5 Setting Two-Page Spread View (`/PageLayout /TwoPageRight`)

Per **ISO 32000-1:2008 §7.7.2 (_Document Catalog_, Table 28)** ([PDF 32000-1:2008 Specification](https://opensource.adobe.com/dc-acrobat-sdk-docs/pdfstandards/PDF32000_2008.pdf)):

- `/PageLayout /TwoPageRight`: `"Display the pages two at a time, with odd-numbered pages on the right."` This is the standard photobook layout: Page 1 (the front cover) appears alone on the right-hand side, and subsequent even/odd pairs (`2–3`, `4–5`, ...) appear as facing spreads.
- `/PageMode /UseOutlines`: Opens the PDF with the series/chapter bookmark sidebar visible.

Because neither Typst `0.15.1` (`crates/typst-pdf/src/convert.rs`) nor Headless Chrome (`SkPDFDocument`) exposes a CLI flag for `/PageLayout /TwoPageRight`, the build script can stamp it using `qpdf` or a small Node/Python catalog patch (or Ghostscript `pdfmark` when re-distilling). Notably, `qpdf --Linearize` or a 15-line Node buffer replacement on the `/Type /Catalog` dictionary inserts `/PageLayout /TwoPageRight /PageMode /UseOutlines` **without touching or re-encoding any `/DCTDecode` image stream**.

---

## 6. Concrete Implementation Blueprint (When Ready to Build)

To keep the repository clean and aligned with `AGENTS.md` and `docs/page-generation-pipeline.md`:

1. **One-Time Environment Setup**:
    - Install Typst (`brew install typst`) or use existing Headless Chrome (`/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`).
    - Place a static `.ttf` or `.otf` copy of `Syne` (`Syne-Bold.ttf`, `Syne-Regular.ttf`) in `assets/fonts/` alongside the existing `.woff2` files (or decompress `assets/fonts/syne-latin.woff2` via Python `fontTools`), while referencing `/Users/lz/Library/Fonts/GlowSansSC-Extended-Bold.otf` and `GlowSansSC-Extended-Regular.otf` for CJK text.
2. **Directory & File Layout**:
    - `book/book.yaml` — Declarative anthology order, cover/colophon metadata, and optional per-image layout overrides.
    - `book/photobook.typ` — Canonical Typst template reading `.cache/book-manifest.json`.
    - `scripts/build-book.mjs` — Node.js orchestrator that imports `parseMarkdownSource()` from `scripts/build-page.mjs`, reads `assets/img/p<N>/index.md` and `commentary.json`, normalizes images via `sharp` into `.cache/book-img/`, invokes `typst compile`, and stamps `/PageLayout /TwoPageRight` into `dist/*.pdf` (which is already gitignored via `dist/` in [`.gitignore`](file:///Users/lz/dev/ryusoh.github.io/.gitignore#L9)).
3. **Makefile Interface**:
    - `make book` $\to$ Builds `dist/photobook-screen.pdf` and `dist/photobook-master.pdf`.
    - `make book ID=p1` $\to$ Builds a single-series monograph `dist/p1-book.pdf` for rapid previewing while sequencing `p1`.

---

## 7. Open Questions & What Could Not Be Verified

1. **Local `typst` binary execution on this machine**:
    - `typst` is not currently installed in `/opt/homebrew/bin` on this machine (`which typst` returned `not found`), and per research session constraints no new packages were installed. All Typst `v0.15.1` claims were verified directly against the official `v0.15.1` Rust source code (`crates/typst-pdf/src/image.rs`, `crates/typst-cli/src/args.rs`, `LaurenzV/krilla/src/graphics/image/mod.rs`) and `typst.app/docs` reference documentation. (By contrast, the Headless Chrome `m157` PDF passthrough and ICC profile preservation claims were executed and verified locally on this machine.)
2. **Availability of High-Resolution (`>2048px`) Master Exports Outside the Repo**:
    - In this repository, 118 of 139 JPEGs are `2048 × 1365 px` web masters. While `docs/archive-protocol.md` and `docs/contact-sheet-ledger-design.md` document that RAW + full-resolution JPEG masters exist in the external 3-2-1 archive, those external drives are outside the workspace. Consequently, whether all 127 sequenced frames have `>=3600px` print masters ready for a large-format (`12 × 8 in` @ 300 PPI) physical press run could not be verified from the repo alone.
3. **Native PDF/X-4 Support Timeline in Typst**:
    - While Typst `0.15.1` supports PDF/A (`a-1` through `a-4`) and PDF/UA-1, native `PDF/X-4` (`ISO 15930-7`) export for commercial CMYK offset printing is not yet in a released Typst version. If a commercial offset printer strictly requires a validated `PDF/X-4` file with a CMYK Output Intent before Typst ships PDF/X support, Ghostscript (`gs -dPDFX ...`, `v10.07.1` installed locally) or WeasyPrint (`--pdf-variant pdf/x-4`, after pre-converting the 13 Display P3 images to sRGB/CMYK via `sharp`) would be required for the final print-press handoff.
