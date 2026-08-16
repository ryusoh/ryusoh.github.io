---
description: Create a new portfolio gallery page (e.g. p5) from images and markdown or update existing portfolio pages using the canonical template shell. Use when adding a new portfolio project page, adding photos to galleries, or synchronizing portfolio shell templates.
---

# New Portfolio Page Workflow

This repository uses a zero-build, static architecture served by GitHub Pages. Portfolio project pages (`p1/`, `p2/`, `p3/`, `p4/`, `p5/`, etc.) are compiled and synchronized automatically from markdown sources.

## How to Add a New Portfolio Page

### 1. Place Source Images & Markdown

Create directory `assets/img/p<N>/` (e.g. `assets/img/p5/`):

1. Add the high-resolution JPEG images into `assets/img/p<N>/`.
2. Create `assets/img/p<N>/index.md` with YAML frontmatter and image list:

```markdown
---
title: 'TITLE OF THE PROJECT'
description: 'A street photography series by Zhuang Liu capturing ...'
keywords:
    - 'San Francisco'
    - 'urban culture'
---

DSCF0001.jpg | Optional custom description

> Optional blockquote or poem excerpt
>
> Second line of quote

DSCF0002.jpg
DSCF0003.jpg

---

DSCF0004.jpg
```

### 2. Run Page Builder

Execute:

```bash
make page ID=p<N>
```

This automatically:

- Generates multi-tier AVIF & WebP responsive variants (`768w`, `1200w`, `2048w`).
- Calculates dimensions and generates 28-character ThumbHash placeholders.
- Renders `p<N>/index.html` from `scripts/templates/portfolio-shell.html`.
- Updates navigation links in `index.html` and across all `p*/index.html`.
- Registers image assets in `js/preloader.js`.

### 3. Synchronize Existing Pages (When Editing Template)

If you modify `scripts/templates/portfolio-shell.html` or add components/effects:

```bash
make sync-pages
```

This re-applies the template shell across all active `p*/index.html` pages preserving their unique body contents and metadata.

### 4. Verify Correctness

Run the automated verification gate:

```bash
make precommit-fix
```

This checks format, lint, strict types, Jest tests, and runs `scripts/validate-pages.mjs` and `sync-pages-check`.
