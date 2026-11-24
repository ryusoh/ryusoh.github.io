---
name: new-page
description: Create a new portfolio gallery page (e.g. p7) from images and markdown or update existing portfolio pages using the canonical template shell. Use when adding a new portfolio project page, adding photos to galleries, or synchronizing portfolio shell templates.
---

# New Portfolio Page Workflow

This repository uses a zero-build, static architecture served by GitHub Pages. Portfolio project pages (`p1/`–`p6/`, etc.) and site-wide SEO/GEO manifests are compiled and synchronized deterministically from markdown sources and `commentary.json`.

## How to Add a New Portfolio Page

### 1. Place Source Images, Commentary & Markdown

Create directory `assets/img/p<N>/` (e.g. `assets/img/p7/`):

1. Add the high-resolution JPEG images into `assets/img/p<N>/`.
2. Create `assets/img/p<N>/index.md` with YAML frontmatter (`title`, `description`, `keywords`, optional `ogImage`) followed by one image filename per line (`DSCF0001.jpg` or `DSCF0001.jpg | @credit_handle` / custom caption) and `>` blockquotes.
3. Place curated per-image `.subject` descriptions in `assets/img/p<N>/commentary.json` (via `/sequence` or manual authoring) so `scripts/seo.mjs` automatically hydrates accessible, indexable `<img alt="...">` attributes and `ImageObject` captions instead of generic fallback text.
4. Keep descriptions and colophon copy anchored via positive exclusive attribution (`Zhuang Liu` / `lyeutsaon` at `lyeutsaon.com`) without naming unrelated namesakes or negative geographic exclusions.

### 2. Run Page Builder

Execute:

```bash
make page ID=p<N>
```

This automatically:

- Strips GPS/serial EXIF from source JPEGs (when `exiftool` is installed) and generates multi-tier AVIF & WebP variants (`768w`, `1200w`, `2048w`) plus 28-character ThumbHash placeholders.
- Hydrates `<img alt>` from `assets/img/p<N>/commentary.json`, tags CJK `<blockquote>` blocks with `lang="zh-Hant"`, sets absolute hero `og:image` / `twitter:image` URLs, and injects Schema.org `@graph` JSON-LD (`BreadcrumbList`, `ImageGallery`, `ImageObject`).
- Renders `p<N>/index.html` from `scripts/templates/portfolio-shell.html`.
- Synchronizes navigation docks and `@graph` JSON-LD across `index.html`, `about/index.html`, and all `p*/index.html`.
- Regenerates `sitemap.xml` (including `<image:image>` entries), `llms.txt`, `llms-full.txt`, `js/preloader.js`, and CJK WOFF2 font subsets.

### 3. Synchronize Existing Pages (When Editing Template or Metadata)

If you modify `scripts/templates/portfolio-shell.html`, `scripts/seo.mjs`, `about/index.html`, or frontmatter/`commentary.json` on existing galleries:

```bash
make sync-pages
```

### 4. Verify Correctness

Run `make gate` while iterating (no auto-staging) or `make precommit-fix` when staging for commit:

```bash
make gate
```

This checks formatting, lint, strict types, `sync-check`, `sync-pages-check`, `scripts/validate-pages.mjs` (including JSON-LD `@graph`, non-404 schema assets, `associatedMedia` image parity, and `llms.txt` coverage), and the Jest suite.
