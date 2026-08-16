# AI-Native Page Generation Pipeline

Design specification for automated, deterministic, and AI-assisted generation
of portfolio pages (`p1/`–`p4/`, `p5/`, etc.) from minimal markdown and raw
photos.

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
|    - Editorial content in assets/img/p5/index.md (or prompt) |
+-------------------------------------------------------------+
                              |
                              v
+-------------------------------------------------------------+
| 2. Deterministic Engine (scripts/build-page.mjs)            |
|    - Sharp: reads image dimensions                          |
|    - Sharp: generates AVIF / WebP tiers (768w, 1200w, full) |
|    - ThumbHash: computes hash and base64 blur-up            |
|    - Template: compiles canonical HTML (p5/index.html)      |
|    - Global Sync: updates nav in index.html & p1..p5        |
|    - Global Sync: updates js/preloader.js assetSets         |
+-------------------------------------------------------------+
                              |
                              v
+-------------------------------------------------------------+
| 3. Quality Gate (CI Parity)                                 |
|    - make precommit-fix (ESLint, Prettier, Jest tests)      |
+-------------------------------------------------------------+
```

---

## 3. Specification

### 3.1 Content Source of Truth (`assets/img/p<N>/index.md`)

The authoring file uses standard YAML frontmatter followed by an interleaved
sequence of image filenames, blockquotes, and dividers:

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

DSCF7765.jpg

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

DSCF5719-3.jpg
```

### 3.2 Parsing Rules

- **Frontmatter**:
    - `title`: Populates `<title>`, `<h1>`, `og:title`, and `twitter:title`.
    - `description`: Populates `<meta name="description">`, `og:description`, and
      `twitter:description`.
    - `keywords`: Injected as comma-separated meta keywords.
    - `ogImage` (optional): Default OG image for social previews (falls back to
      first photo or site default).
- **Body Lines**:
    - Filenames matching `/\.(jpe?g|JPG|png)$/i`: Rendered as responsive
      `<picture>` blocks containing AVIF/WebP sources, dimensions, ThumbHash,
      `decoding="async"`, and `alt="Street photography by Zhuang Liu"`. The first
      photo omits `loading="lazy"`; subsequent photos include `loading="lazy"`.
    - Markdown Blockquotes (`>`): Rendered as `<blockquote><p>...</p></blockquote>`.
    - Markdown Horizontal Rules (`---`): Rendered as `<hr />`.

---

## 4. Pipeline Engine Components

### 4.1 Image & Placeholder Generation (`sharp` + `thumbhash`)

For each image listed in `index.md`:

1. Read source image metadata (`width`, `height`).
2. Generate multi-tier assets:
    - Full resolution: `.avif` (q65), `.webp` (q75)
    - 1200w tier: `-1200.avif`, `-1200.webp`
    - 768w tier: `-768.avif`, `-768.webp`
3. Generate ThumbHash:
    - Resize to 100x100 box, compute RGBA ThumbHash.
    - Encode 28-character base64 hash and base64 PNG data-URI background.

### 4.2 HTML Templating

Compiles `p<N>/index.html` using the canonical portfolio page template:

- Inserts sanitized metadata and OpenGraph tags into `<head>`.
- Injects header dock navigation with `aria-current="page"` for the current page.
- Renders the post content container with `<picture>` blocks and typography.
- Injects standard footer banner, Instagram reveal link, and deferred runtime
  scripts (`page-transition.js`, `block-navigation.js`, `lenis-init.js`,
  `cursor-init.js`, etc.).

### 4.3 Global Multi-Page Navigation Sync

When a new page `p<N>` is generated:

1. Discover all active portfolio pages (`p1`, `p2`, ..., `p<N>`).
2. Read the project title for each page from its `index.md` or `index.html`.
3. Re-render the `<nav aria-label="Portfolio projects">` table consistently
   across:
    - `index.html`
    - `p1/index.html`, `p2/index.html`, `p3/index.html`, `p4/index.html`,
      `p<N>/index.html`
4. Update `this.assetSets` and `this.imageDirectories` in `js/preloader.js`.

---

## 5. Agent Skill Interface (`/new-page`)

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

## 6. Required Codebase Generalizations

Before adding `p5`, the following hardcoded `p1`–`p4` limits must be
generalized to dynamic discovery:

1. **`scripts/build-images.mjs` & `scripts/generate-thumbhashes.mjs`**:
    - Replace `const pages = ['p1', 'p2', 'p3', 'p4'];` with dynamic directory
      discovery `fs.readdirSync('assets/img').filter(d => /^p\d+$/.test(d))`.
2. **`js/hover-preview.js`**:
    - Update line 44 `href.match(/p[1-4]/i)` to `href.match(/p\d+/i)`.
3. **Acceptance Tests**:
    - Update `tests/js/acceptance/article-banner-consistency.acceptance.test.js`
      and related tests to scan all discovered `p*/index.html` directories.
