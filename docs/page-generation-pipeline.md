# Page Generation & Template Synchronization Pipeline

Design specification for automated, deterministic, and AI-assisted generation
and maintenance of portfolio pages (`p1/`–`p4/`, `p5/`, etc.) from minimal
markdown and raw photos in an AI-native repository.

---

## 1. Context & Motivation

### The Existing Architecture

This repository (`ryusoh.github.io`) is a zero-build, static vanilla JS/CSS site
served by GitHub Pages. Pages (`p1/`–`p4/`) are static HTML entries loaded
directly by the browser.

### The Problem with Raw HTML Authoring

Each portfolio page is ~900 lines of HTML, of which ~90% is repetitive
infrastructure:

- **100+ lines of `<head>` boilerplate**: Content Security Policy (CSP),
  canonical tags, Open Graph, Twitter cards, custom typography links, and
  pre-init loaders.
- **Image metadata complexity**: Every photo requires exact pixel dimensions
  (`width` and `height` to prevent layout shift), multi-tier responsive
  `<source>` sets for AVIF/WebP (768w, 1200w, 2048w), `decoding="async"`, and
  `loading="lazy"`.
- **ThumbHash placeholders**: Every `<img>` requires a 28-character ThumbHash
  string and an inline base64 data-URI blur-up background.
- **Global multi-page synchronization**: Adding a new project (`p5`) requires
  updating the navigation table across **every single page** (`index.html`,
  `p1/index.html`–`p4/index.html`), updating `js/preloader.js`, and updating
  regex matches in `js/hover-preview.js`.

### Why Pure LLM Generation Fails

Asking an AI model to hallucinate 900 lines of raw HTML from scratch leads to:

1. Incorrect image dimensions and broken aspect ratios.
2. Inability to compute mathematical binary digests (ThumbHash base64 strings)
   in-context.
3. Inconsistent DOM structure that violates acceptance tests and CSP rules.

---

## 2. System Architecture: The 3-Tier Hybrid

To achieve a frictionless, zero-error workflow, the system separates
**creative editorial authoring** from **deterministic computation**:

```text
+-------------------------------------------------------------+
| 1. Creative Layer (Human or AI Agent)                       |
|    - Raw photos in assets/img/p5/                           |
|    - Editorial content in assets/img/p5/index.md or         |
|      p5/index.md (or generated via AI prompt)               |
+-------------------------------------------------------------+
                              │
                              ▼
+-------------------------------------------------------------+
| 2. Deterministic Engine (scripts/build-page.mjs)            |
|    - Sharp: reads image dimensions                          |
|    - Sharp: generates AVIF / WebP tiers (768w, 1200w, full) |
|    - ThumbHash: computes hash and base64 blur-up            |
|    - Template: compiles canonical HTML (p5/index.html)      |
|    - Global Sync: updates nav in index.html & p1..p5        |
|    - Global Sync: updates js/preloader.js assetSets         |
+-------------------------------------------------------------+
                              │
                              ▼
+-------------------------------------------------------------+
| 3. Quality Gate (CI Parity)                                 |
|    - make precommit-fix (ESLint, Prettier, Jest tests)      |
+-------------------------------------------------------------+
```

---

## 3. Content Specification (`index.md`)

### 3.1 File Discovery & Location

The compiler searches for the page source in the following order of
precedence:

1. `assets/img/p<N>/index.md` (recommended: keeps markdown alongside source
   photos)
2. `p<N>/index.md`

### 3.2 Schema & Syntax

The authoring file uses standard YAML frontmatter followed by an interleaved
sequence of image filenames, optional custom alt captions, blockquotes, and
dividers:

```markdown
---
title: 'AEROBATIC ACTIVITIES'
description: 'A street photography series by Zhuang Liu exploring West Coast street culture.'
keywords:
    - 'Zhuang Liu'
    - 'street photography'
    - 'West Coast'
ogImage: 'DSCF7765.jpg'
---

DSCF7765.jpg | A lone skater suspended in twilight over San Francisco asphalt

> The street photography series Aerobatic Activities presents a sophisticated
> visual ethnography, dedicated to delineating the vibrant choreographies of
> West Coast street culture.

DSCF7728.jpg
DSCF7753-3.jpg
DSCF7186-2.jpg

---

> I've been laying
> Waiting for your next mistake

---

DSCF5719-3.jpg | Neon reflections pooling on rain-slicked pavement
```

### 3.3 Parsing Rules

- **Frontmatter**:
    - `title`: Populates `<title>`, `<h1>`, `og:title`, and `twitter:title`.
    - `description`: Populates `<meta name="description">`, `og:description`, and
      `twitter:description`.
    - `keywords`: Injected as comma-separated meta keywords.
    - `ogImage` (optional): Default OG image for social previews (falls back to
      first photo or site default).
- **Image Lines**:
    - Syntax: `<filename> [| <optional custom alt text>]`
    - Supported extensions: `.jpg`, `.JPG`, `.jpeg`, `.png`, `.webp`, `.avif`.
    - Alt text fallback: If pipe `|` is omitted, defaults to
      `"Street photography by Zhuang Liu"`.
    - Dimensions: Extracted directly from the source image file via `sharp`.
    - Loading attribute: The first photo omits `loading="lazy"` (for optimal LCP);
      all subsequent photos include `loading="lazy"`.
    - Output markup:

        ```html
        <div align="center">
            <picture>
                <source
                    type="image/avif"
                    srcset="
                        /assets/img/p3/DSCF7765-768.avif   768w,
                        /assets/img/p3/DSCF7765-1200.avif 1200w,
                        /assets/img/p3/DSCF7765.avif      2048w
                    "
                    sizes="(max-width: 480px) 100vw, (max-width: 768px) 90vw, 900px"
                />
                <source
                    type="image/webp"
                    srcset="
                        /assets/img/p3/DSCF7765-768.webp   768w,
                        /assets/img/p3/DSCF7765-1200.webp 1200w,
                        /assets/img/p3/DSCF7765.webp      2048w
                    "
                    sizes="(max-width: 480px) 100vw, (max-width: 768px) 90vw, 900px"
                />
                <img
                    data-thumbhash="IggKDYJfh5tOU3eId5dnZia0T0Cq"
                    style="background-image: url('data:image/png;base64,...'); background-size: cover; background-position: center;"
                    src="/assets/img/p3/DSCF7765.jpg"
                    alt="A lone skater suspended in twilight over San Francisco asphalt"
                    width="2048"
                    height="1365"
                    decoding="async"
                />
            </picture>
        </div>
        ```

- **Markdown Blockquotes (`>`)**: Rendered as `<blockquote><p>...</p></blockquote>`.
- **Markdown Horizontal Rules (`---`)**: Rendered as `<hr />`.

---

## 4. Pipeline Engine Components

### 4.1 Image & Placeholder Generation (`sharp` + `thumbhash`)

For each image referenced in `index.md`:

1. Read source image metadata (`width`, `height`).
2. Generate multi-tier assets if missing or outdated:
    - Full resolution: `.avif` (q65, effort 4), `.webp` (q75, effort 4)
    - 1200w tier: `-1200.avif`, `-1200.webp` (resize width 1200 without enlargement)
    - 768w tier: `-768.avif`, `-768.webp` (resize width 768 without enlargement)
3. Generate ThumbHash:
    - Resize to 100x100 box with `{ fit: 'inside' }`, `.ensureAlpha()`, raw RGBA.
    - Compute ThumbHash binary hash, 28-character base64 hash, and base64 PNG data-URI background.

### 4.2 HTML Templating (`scripts/build-page.mjs`)

Compiles `p<N>/index.html` using the canonical portfolio shell template
(`scripts/templates/portfolio-shell.html`):

- Inserts sanitized metadata and OpenGraph tags into `<head>`.
- Injects header dock navigation with `aria-current="page"` on the current project.
- Renders the post content container with responsive `<picture>` blocks and typography.
- Injects standard footer banner, Instagram reveal link, and deferred runtime
  scripts (`page-transition.js`, `block-navigation.js`, `lenis-init.js`,
  `cursor-init.js`, etc.).

### 4.3 Global Multi-Page Navigation Sync

When a new page `p<N>` is generated or synchronized:

1. Discover all active portfolio pages (`p1`, `p2`, ..., `p<N>`).
2. Read the project title for each page from its `index.md` or `index.html`.
3. Re-render the `<nav aria-label="Portfolio projects">` table consistently
   across:
    - `index.html`
    - `p1/index.html`, `p2/index.html`, `p3/index.html`, `p4/index.html`,
      `p<N>/index.html`
4. Update `this.assetSets` and `this.imageDirectories` in `js/preloader.js`.

---

## 5. Frontend Evolution & Preventing Template Drift

A critical challenge in static multi-page sites is **template drift**: when new
JS effects, styles, analytics, or shaders are added to existing pages, hardcoded
generator templates or individual pages fall out of sync.

### 5.1 Component Slot Architecture

Every portfolio page is decomposed into two distinct layers:

```text
+-------------------------------------------------------------+
| 1. Shared Global Shell (Identical across p1..pN)            |
|    - <head> (CSP, stylesheets, pre-init loaders)            |
|    - #cont Header Nav Dock & Social Icons Dock              |
|    - .project-footer (mobile banner + instagram reveal link)|
|    - Trailing deferred <script> tags (GSAP, Lenis, SW, etc.)|
+-------------------------------------------------------------+
| 2. Page-Specific Content (Unique to each page)              |
|    - Meta title / description / keywords / canonical        |
|    - <h1> project heading                                   |
|    - <div class="post-content"> picture blocks & quotes     |
+-------------------------------------------------------------+
```

The canonical shell is maintained in a central template
(`scripts/templates/portfolio-shell.html`) with explicit slot boundaries:

- `<!-- SLOT:META -->`
- `<!-- SLOT:NAV -->`
- `<!-- SLOT:HEADING -->`
- `<!-- SLOT:POST_CONTENT -->`

### 5.2 Cross-Page Sync (`make sync-pages`)

Whenever a new global JS effect or stylesheet is added, updated, or removed:

1. The change is made in the canonical shell template
   (`scripts/templates/portfolio-shell.html`).
2. Running `make sync-pages` (or `node scripts/sync-pages.mjs`) parses every
   existing page (`p1/index.html`–`p<N>/index.html`), extracts each page's
   unique content slots, and re-wraps them in the updated shell.
3. This guarantees that `p1` through `p<N>` always share 100% identical script
   tags, CSS links, and DOM wrappers.

---

## 6. AI-Native Autonomous Governance (Zero Human Overhead)

Because this repository is 100% maintained and coded by AI agents, template
synchronization must happen automatically without requiring manual instructions
from the user.

```text
+-------------------------------------------------------------------------+
| 1. AGENTS.md Rule (Agent Context)                                       |
|    Tells any agent (Claude, Antigravity, Kimi, Jules) how portfolio     |
|    pages work: update scripts/templates/portfolio-shell.html and run    |
|    make sync-pages.                                                     |
+-------------------------------------------------------------------------+
                                     │
                                     ▼
+-------------------------------------------------------------------------+
| 2. make precommit-fix & Drift Gate (Deterministic Guardrail)            |
|    - make sync-pages is hooked into make precommit-fix.                 |
|    - If an agent touches a script in p1, make precommit-fix auto-syncs  |
|      p2..pN and the shell template before allowing a commit.            |
+-------------------------------------------------------------------------+
                                     │
                                     ▼
+-------------------------------------------------------------------------+
| 3. Acceptance Tests (CI Ratchet)                                        |
|    project-scripts-consistency.acceptance.test.js fails CI if any       |
|    page's <head> or trailing <script> tags ever diverge.                |
+-------------------------------------------------------------------------+
```

### 6.1 AGENTS.md Working Rule

An explicit rule in `AGENTS.md` instructs all coding agents:

> **Portfolio Page Infrastructure (`p1`–`p<N>`):**
> All portfolio pages share a single canonical template shell
> (`scripts/templates/portfolio-shell.html`). When adding or modifying global
> scripts, styles, or header/footer elements on portfolio pages: **always update
> `scripts/templates/portfolio-shell.html` and run `make sync-pages`**. Never
> hand-edit the global shell in an individual `p*/index.html` file in isolation.

### 6.2 Pre-Commit Auto-Healer (`make precommit-fix`)

`make sync-pages` is wired directly into `make precommit-fix` and `make check`
(matching the precedent set by `sync-check` for agent commands):

```makefile
sync-pages-check:
    @node scripts/sync-pages.mjs --check

precommit-fix: hooks sync-check sync-pages-check
```

If an agent adds a new JS effect and runs `make precommit-fix`, the precommit
harness automatically detects drift, updates all other portfolio pages, and
stages the updated files.

### 6.3 Automated Drift-Guard Acceptance Gate

An acceptance test
(`tests/js/acceptance/project-scripts-consistency.acceptance.test.js`) gates the
CI pipeline:

- Scans all `p*/index.html` files.
- Asserts that all `<link rel="stylesheet">` tags, head scripts, dock
  structures, and trailing `<script>` tags match identically across all
  portfolio pages.
- Fails loudly if a script is added to `p1` but omitted in `p2`–`p<N>`.

---

## 7. Agent Skill Interface (`/new-page`)

To create an entirely AI-native workflow, a dedicated agent skill
(`.agents/skills/new-page/SKILL.md`) will encapsulate the workflow:

1. **User action**: Drops raw photos into `assets/img/p5/` and provides a prompt
   (e.g., _"Create p5 with title 'Night Vectors' and an intro about Tokyo street
   lights"_).
2. **Agent execution**:
    - Inspects the images in `assets/img/p5/`.
    - Writes `assets/img/p5/index.md` (curating the photo sequence, writing SEO
      tags and poetic quotes).
    - Executes `make page ID=p5` (or `node scripts/build-page.mjs p5`).
    - Runs `make precommit-fix` and verifies the test suite.
    - Reports the generated page diff and confirmation to the user.

---

## 8. Implementation Roadmap (For Long-Running Goal Task)

When executing the task to build this pipeline, the implementing agent should
follow these phased steps:

### Phase 1: Codebase Generalization & Decoupling

1. Update `scripts/build-images.mjs` and `scripts/generate-thumbhashes.mjs` to
   dynamically discover all directories matching `assets/img/p*`.
2. Update `js/hover-preview.js` line 44 to match `/p\d+/i`.
3. Update `tests/js/acceptance/article-banner-consistency.acceptance.test.js` and
   all acceptance tests to dynamically discover active `p*/index.html` files.

### Phase 2: Canonical Shell & Synchronizer

1. Create `scripts/templates/portfolio-shell.html` extracted from current
   `p1/index.html`.
2. Create `scripts/sync-pages.mjs` (supporting `--check` and `--fix` / default
   sync mode).
3. Create `tests/js/acceptance/project-scripts-consistency.acceptance.test.js`.
4. Add `sync-pages` and `sync-pages-check` targets to `Makefile`, and wire into
   `make check` / `make precommit-fix`.

### Phase 3: Bootstrap Existing Pages (`p1`, `p2`, `p4`)

1. Create `assets/img/p1/index.md`, `assets/img/p2/index.md`,
   `assets/img/p4/index.md` extracted from their respective live HTML pages.
2. Verify that running `make sync-pages` produces a clean zero-drift diff on
   `p1`–`p4`.

### Phase 4: Page Builder Script (`scripts/build-page.mjs`)

1. Implement markdown parser supporting frontmatter, pipe alt captions, quotes,
   and horizontal rules.
2. Implement Sharp/ThumbHash asset pipeline with multi-tier encoding.
3. Implement HTML assembly using `portfolio-shell.html`.
4. Implement automatic global navigation injection across `index.html` and
   `p1..p<N>`.
5. Implement automatic `js/preloader.js` asset set registration.
6. Add `page` target to `Makefile` (`make page ID=p<N>`).

### Phase 5: Automated Verification Suite

1. Implement Golden Master roundtrip test verifying zero-drift regression across
   `p1`–`p4`.
2. Implement Synthetic Test Page E2E Jest suite.
3. Implement Asset & DOM Integrity Validator (`scripts/validate-pages.mjs`).
4. Wire all verification suites into `make test` and `make check`.

### Phase 6: Agent Skill & Governance

1. Create `.agents/skills/new-page/SKILL.md`.
2. Run `python3 tools/sync_commands.py` to generate `.claude/commands/new-page.md`.
3. Update `AGENTS.md` working rules with portfolio page infrastructure guidance.
4. Run full `make precommit-fix` and test suite to verify 100% green gate.

---

## 9. Automated Verification & "Absolute Correctness" Testing Strategy

Because an autonomous agent works without human visual eyes (see `AGENTS.md`
rule: _"You cannot see the rendered page"_), correctness must be proved
**mathematically, structurally, and deterministically** across 5 distinct test
layers:

```text
+-------------------------------------------------------------------------+
| Layer 1: Golden Master Roundtrip Test (Zero-Drift Regression)           |
| Regenerate p1..p4 from markdown; assert git diff --exit-code is 0.      |
+-------------------------------------------------------------------------+
                                     │
                                     ▼
+-------------------------------------------------------------------------+
| Layer 2: Ephemeral Synthetic E2E Test (Jest Sandbox)                    |
| Generate temporary p_test/ from fixture images; verify full lifecycle.  |
+-------------------------------------------------------------------------+
                                     │
                                     ▼
+-------------------------------------------------------------------------+
| Layer 3: Asset & Dimension Integrity Validator (Zero 404s & Zero CLS)   |
| Verify every file exists on disk; assert image width/height match sharp.|
+-------------------------------------------------------------------------+
                                     │
                                     ▼
+-------------------------------------------------------------------------+
| Layer 4: ThumbHash Digest & Color Math Validation                       |
| Decode all data-thumbhash strings into RGBA buffers; verify non-null.   |
+-------------------------------------------------------------------------+
                                     │
                                     ▼
+-------------------------------------------------------------------------+
| Layer 5: Headless DOM & Interactive Acceptance Testing (jsdom)          |
| Mount page in jsdom; dispatch keyboard & scroll events; assert zero errs|
+-------------------------------------------------------------------------+
```

### 9.1 Layer 1: Golden Master (Zero-Drift) Roundtrip Test

**Purpose**: Mathematically prove that the new generator produces 100% identical
HTML to the existing hand-crafted pages with zero regressions.

**Mechanism**:

1. Run `node scripts/build-page.mjs p1 && node scripts/build-page.mjs p2 && node scripts/build-page.mjs p3 && node scripts/build-page.mjs p4`.
2. Execute `git diff --exit-code p1/index.html p2/index.html p3/index.html p4/index.html`.
3. **Success condition**: The diff must be completely empty (`exit code 0`). If
   a single closing tag, attribute order, or whitespace collapses, the test fails
   immediately.

### 9.2 Layer 2: Ephemeral Synthetic E2E Test (`tests/js/page-builder.test.js`)

**Purpose**: Test the full compilation and asset pipeline for a brand new page
without leaving permanent garbage in git.

**Mechanism**:

1. Create a temporary project directory `p_test/` and `assets/img/p_test/`.
2. Generate 3 dummy JPG fixture images with known dimensions (e.g. 800x600,
   1200x800).
3. Write a synthetic `index.md` with frontmatter, custom pipe alt captions, and
   blockquotes.
4. Execute the build engine programmatically.
5. Assertions:
    - Generated `p_test/index.html` exists and contains valid HTML structure.
    - Generated `.avif`, `.webp`, `-768.avif`, `-1200.webp` files exist on disk.
    - `index.html` `<nav>` table contains the new `p_test` link.
    - `js/preloader.js` contains the `p_test` image set.
6. Teardown: Automatically remove `p_test/` and restore `index.html` / `preloader.js`.

### 9.3 Layer 3: Asset & Dimension Integrity Validator (`scripts/validate-pages.mjs`)

**Purpose**: Ensure zero 404 broken images and zero Cumulative Layout Shift (CLS).

**Mechanism** (wired into `make check`):

1. **Disk Existence**: For every `<img src="...">` and `<source srcset="...">`
   URL across all `p*/index.html` pages, assert that the exact file exists on the
   filesystem.
2. **Dimension Fidelity**: Read the underlying source image on disk with `sharp`.
   Assert:
   $$\left|\frac{\text{HTML width}}{\text{HTML height}} - \frac{\text{Sharp width}}{\text{Sharp height}}\right| < 0.001$$
   This guarantees that no image is distorted or causes layout shift during
   render.
3. **Responsive Source Syntax**: Verify that every `<picture>` has matching AVIF
   and WebP `<source>` elements with `768w`, `1200w`, and `2048w` srcset tiers.

### 9.4 Layer 4: ThumbHash Digest & Color Math Validation

**Purpose**: Ensure no corrupted or malformed placeholder blur-ups.

**Mechanism**:

1. Read every `data-thumbhash="..."` string in all HTML files.
2. Assert string length is exactly 28 base64 characters.
3. Pass the string to `thumbHashToDataURL` and `thumbHashToRGBA` in `thumbhash`.
4. Assert:
    - Decoding does not throw.
    - The returned data URI matches the inline `style="background-image: url('data:image/png;base64,...')"` exactly.

### 9.5 Layer 5: Headless DOM & Navigation State Acceptance Tests

**Purpose**: Verify runtime accessibility and interactive script contracts.

**Mechanism**:

1. Mount the compiled HTML in Jest (`jsdom`).
2. Assert strict structural contracts:
    - Exactly one `<main id="main">` with `tabindex="-1"`.
    - Exactly one `<h1>` inside `.post-heading`.
    - The active project has `aria-current="page"` on its own link and no others.
    - The home link has `aria-label="Home"` and `data-destination="home"`.
    - Footer contains `.mobile-banner` and `.scroll-reveal-instagram`.
    - All `<img>` carry `decoding="async"`, and all except the first carry
      `loading="lazy"`.
3. Load `block-navigation.js` and `mobile-dock.js` into the DOM and simulate
   keyboard navigation (`ArrowDown`, `ArrowUp`, `Escape`) to assert zero console
   errors.
