# Design action items — ranked, keep/ditch, delegation-ready

Companion to `docs/design-research.md` (read it first — it contains the _why_;
this file is the _what_). Hardboiled/tabloid/evidence-file aesthetic on a
Swiss-precise structure.

## How to use this file

- Every item is independent and checkboxed. **Keep = leave checked, ditch =
  delete the item (or its whole wave).** Items list their dependencies, so
  ditching one tells you what else falls.
- Items are executed in **wave order**; inside a wave, higher ratio first.
- Each item is sized to be **one self-contained delegation** to an
  implementation agent.

## Scales

- **Gain** 1–5: 5 = transformative for the premium/hardboiled goal.
- **Effort** 1–5: 1 = under an hour, 5 = multi-session.
- **Ratio** = gain ÷ effort. Do high ratios first.

## Standing instructions for the implementing agent (every item)

1. Read `AGENTS.md` first. Its interactive-agent rules apply: work on `master`,
   do NOT commit unless the user asks, keep diffs single-concern and minimal.
2. Never hand-edit `js/vendor/**` or `*.min.js`. Adding a _new_ vendored file
   (downloaded upstream release) is fine; modifying one is not.
3. Any change to runtime JS behavior must ship a test that fails before and
   passes after; the repo runs Jest with a coverage ratchet. Existing suites
   live in `tests/js/` — check for prior coverage before writing new tests
   (see `docs/testing-notes.md` for jsdom gotchas; `page-transition.test.js`
   uses a `loadInstrumentedScript()` rewriting pattern).
4. Verify with `npx jest <scoped test>` while iterating and `make
precommit-fix` (full gate: Prettier, ESLint, Stylelint, `tsc`, Jest +
   coverage) before reporting done. Red gate = not done.
5. Items marked **VISUAL** change what the site looks like; the agent cannot
   see rendered output. Report objective facts only (DOM attributes, computed
   styles, passing tests) and state "human visual review required."
6. Do not invent commands; run what you document.

## Owner decisions (resolved 2026-08-14)

- [x] **D1 — Type budget: FREE TIER (Syne).** Self-hosted Syne
      (`assets/fonts/syne-latin.woff2`, `syne-latin-ext.woff2`) adopted as the
      unified brand display & body face.
- [x] **D2 — P22 Underground: RETIRED.** Removed unused P22 font files, dead
      `css/fonts.css`, and `@font-face` blocks across all stylesheets.
- [x] **D3 — Dead lightbox assets: DELETE.** `js/viewer.min.js` +
      `css/viewer.min.css` go (A05). Exhibition mode (A21), if kept, is built
      custom or re-vendors stock viewer.js then.
- [x] **D4 — Hover preview: DELETE.** Remove `js/hover-preview.js` and its
      wiring (A23 became a deletion).
- [x] **D5 — Mouse parallax: DELETE.** Remove `js/mouse-parallax.js` (A24).

## Ranked summary

| ID  | Item                                          | Gain | Effort | Ratio | Wave | Visual? | Status  |
| --- | --------------------------------------------- | ---- | ------ | ----- | ---- | ------- | ------- |
| A02 | Font serving: `font-display`, dedupe, preload | 3    | 1      | 3.0   | 1    | no      | done    |
| A01 | Fix preloader omitting p4                     | 2    | 1      | 2.0   | 1    | no      | done    |
| A03 | Remove Lobster                                | 2    | 1      | 2.0   | 1    | yes     | done    |
| A25 | Tiered ambient layers (index both)            | 2    | 1      | 2.0   | 4    | yes     | done    |
| A04 | `width`/`height`/`decoding` on all `<img>`    | 3    | 2      | 1.5   | 1    | no      | done    |
| A26 | Optimize homepage background images           | 3    | 2      | 1.5   | 1    | no      | done    |
| A08 | Hardboiled color tokens                       | 3    | 2      | 1.5   | 2    | yes     | done    |
| A11 | CSS grain overlay                             | 3    | 2      | 1.5   | 2    | yes     | done    |
| A09 | Hardboiled type system (Syne, per D1)         | 4    | 3      | 1.33  | 2    | yes     | done    |
| A06 | Responsive AVIF/WebP + `<picture>` pipeline   | 5    | 4      | 1.25  | 1    | no      | done    |
| A05 | Remove dead viewer assets + `zoom-in` (D3)    | 1    | 1      | 1.0   | 1    | yes     | done    |
| A23 | Delete hover-preview (D4)                     | 1    | 1      | 1.0   | 1    | no      | done    |
| A24 | Delete mouse-parallax (D5)                    | 1    | 1      | 1.0   | 1    | no      | done    |
| A13 | Remove Bootstrap 3 + jQuery + IE shims        | 3    | 3      | 1.0   | 1    | no      | done    |
| A16 | Vendor Lenis, wire smooth scroll              | 3    | 3      | 1.0   | 3    | yes     | pending |
| A17 | GSAP 3.13 + SplitText headline reveals        | 3    | 3      | 1.0   | 3    | yes     | pending |
| A19 | Hard-cut View Transitions                     | 3    | 3      | 1.0   | 3    | yes     | pending |
| A20 | Viewfinder cursor state                       | 3    | 3      | 1.0   | 3    | yes     | pending |
| A07 | ThumbHash blur-up (dep A06)                   | 3    | 3      | 1.0   | 1    | no      | pending |
| A14 | EXIF evidence captions                        | 3    | 3      | 1.0   | 2    | yes     | pending |
| A12 | Tabloid editorial grids, p1–p4                | 5    | 5      | 1.0   | 2    | yes     | pending |
| A15 | Contact-sheet home/index rework               | 4    | 4      | 1.0   | 2    | yes     | pending |
| A10 | Retire P22 entirely (D2)                      | 2    | 2      | 1.0   | 2    | yes     | done    |
| A21 | Exhibition mode (custom build; D3 deleted)    | 4    | 5      | 0.8   | 4    | yes     | pending |
| A22 | WebGL grain + flash post-process (OGL)        | 4    | 5      | 0.8   | 4    | yes     | pending |

---

## Wave 1 — Foundation (no visual risk)

### A01 — Fix the preloader's missing p4

- Gain 2 / Effort 1 — ratio 2.0 — no visual surface.
- **Why:** `js/preloader.js` builds idle-time preload lists from a `pages` map
  that has keys `p1`, `p2`, `p3` only — p4's ~20 images are never preloaded.
- **Files:** `js/preloader.js`, `tests/js/preloader.test.js`.
- **Steps:** add the `p4` entry (`/assets/img/p4/`) with its image list (take
  the exact `src` values from `p4/index.html`; mind mixed `.jpg`/`.JPG` case —
  GitHub Pages is case-sensitive). Extend `tests/js/preloader.test.js` to
  cover the p4 list.
- **Verify:** `npx jest tests/js/preloader.test.js`, then `make precommit-fix`.

### A02 — Font serving: `font-display`, dedupe, preload ✅

- Gain 3 / Effort 1 — ratio 3.0 — no visual surface.
- **Done:** Superseded by the migration to self-hosted Syne
  (`assets/fonts/syne-latin.woff2`). Deleted dead P22 font declarations and
  files.
- **Verify:** `make lint-css`, `make precommit-fix`.

### A03 — Remove Lobster

- Gain 2 / Effort 1 — ratio 2.0 — VISUAL (removes the script display font from
  the home page).
- **Why:** a script face is off-concept for hardboiled street photography; it
  is loaded via `js/loader/vendorLoader.js` with a fonts.bunny.net fallback.
- **Files:** `js/loader/vendorLoader.js`, possibly `tests/js/loader/` suites
  referencing it, plus any CSS selecting Lobster (`grep -ri lobster css js
tests` first).
- **Verify:** `npx jest tests/js/loader`, `make precommit-fix`.

### A04 — `width`/`height`/`decoding` on all ~74 gallery images ✅

- Gain 3 / Effort 2 — ratio 1.5 — no visual surface (kills CLS).
- **Why:** no `<img>` on p1–p4 carried dimensions or `decoding`; layout shifts
  were masked only by the scroll-reveal flow.
- **Files:** `p1/index.html` … `p4/index.html`. Dimensions were read from the
  actual image files with macOS `sips` and injected via a one-off script that
  was not committed.
- **Done:** added `width`, `height`, `decoding="async"` to every gallery
  `<img>` while keeping the existing first-image-eager /
  rest-`loading="lazy"` pattern. Also applied the same attributes to the
  mobile banner on `index.html`.
- **Verify:** pages render unchanged (human check), `make precommit-fix`.

### A05 — Remove dead viewer assets and the `zoom-in` lie (D3: delete)

- Gain 1 / Effort 1 — ratio 1.0 — VISUAL (cursor no longer suggests zoom).
- **Why:** `js/viewer.min.js` + `css/viewer.min.css` are loaded nowhere, while
  `css/style.css:189` sets `cursor: zoom-in` on images with no lightbox
  wired. Owner decided (D3): delete both.
- **Steps:** remove both files and the `zoom-in` rule (or repoint it to
  `default`); grep to confirm no other references (`grep -rn 'viewer' css js
p1 p2 p3 p4 index.html`).
- **Verify:** `make precommit-fix`.

### A23 — Delete hover-preview (D4) ✅

- Gain 1 / Effort 1 — ratio 1.0 — no visual surface (it is disabled).
- **What:** owner decided (D4): delete. Removed `js/hover-preview.js`,
  `tests/js/hover-preview.test.js`, the `enableHoverPreview` flag in
  `js/config.js` (+ `tests/js/config.test.js` expectations), the `<script>`
  tag(s) loading it in `index.html`, and any related CSS. With A24 also
  shipping, `window.PortfolioConfig` became empty, so `js/config.js`, its
  script tag, and `tests/js/config.test.js` were deleted too.
- **Verify:** `make precommit-fix`.

### A24 — Delete mouse-parallax (D5) ✅

- Gain 1 / Effort 1 — ratio 1.0 — no visual surface (it is disabled).
- **What:** owner decided (D5): delete. Removed `js/mouse-parallax.js`,
  `tests/js/mouse-parallax.test.js`, the `enableMouseParallax` flag in
  `js/config.js` + `tests/js/config.test.js`, its `<script>` tag in
  `index.html`, the `PortfolioConfig` type in `js/types/globals.d.ts`, and
  both `js/config.js` and `js/mouse-parallax.js` entries from
  `jsconfig.json`. Since A23 already emptied `js/config.js`, it was deleted
  entirely.
- **Verify:** `make precommit-fix`.

### A13 — Remove Bootstrap 3 + jQuery + IE shims from project pages ✅

- Gain 3 / Effort 3 — ratio 1.0 — no intended visual change (layout parity
  required), unblocks A12.
- **Why:** Bootstrap 3 + jQuery + html5shiv + respond.js (IE8-era, loaded from
  cdnjs) power only a centered column. Verified: no first-party JS uses
  jQuery or Bootstrap JS (only the dead `js/viewer.min.js` references
  jQuery).
- **Files:** `p1/index.html` … `p4/index.html` (script/link tags and grid
  classes), `css/style.css` (replace the used grid rules —
  `col-lg-8 col-lg-offset-2` etc. — with ~50 lines of modern CSS: a centered
  `max-width` container). Then delete `assets/vendor/bootstrap/` and
  `assets/vendor/jquery/` if nothing else references them (`grep -r bootstrap
--include='*.html' .` first).
- **Done:** Replaced the Bootstrap grid with `.container-narrow` in p1–p4,
  removed Bootstrap CSS/JS, jQuery, html5shiv, and respond.js tags, and
  deleted `assets/vendor/bootstrap/` and `assets/vendor/jquery/`. CSS
  selectors `article .container .row *` were retargeted to
  `article .container-narrow *`.
- **Watch out:** re-verify jQuery usage yourself (`grep -rn 'jQuery\|\$(' js
--include='*.js' | grep -v vendor`) before deleting.
- **Verify:** `make precommit-fix`; human visual parity check on p1–p4.

### A06 — Responsive image pipeline: AVIF/WebP + `srcset` + `<picture>` ✅

- Gain 5 / Effort 4 — ratio 1.25 — no visual surface.
- **Done:**
    1. Added `sharp` as devDependency and created `scripts/build-images.mjs`.
    2. Generated `.avif` (quality 65) and `.webp` (quality 75) derivatives for
       all 74 gallery photos across `p1`–`p4`, cutting total payload from 123.4
       MB down to 42.7 MB (65.4% reduction for AVIF) and 42.1 MB (65.9%
       reduction for WebP).
    3. Rewrote gallery `<img>` elements across `p1/index.html`–`p4/index.html` to
       use `<picture>` with AVIF and WebP `<source>` elements, falling back to
       the original JPEG.
    4. Updated `sw.js` and `tests/js/sw.test.js` to treat `.avif` and `.webp` as
       cache-first immutable assets.
- **Verify:** `make precommit-fix`.

### A07 — ThumbHash blur-up placeholders (dep A06)

- Gain 3 / Effort 3 — ratio 1.0 — perceived-performance; near-instant blurred
  previews while full images stream.
- **Why:** ~28-byte inline hashes beat empty black rectangles; pairs with the
  strobe reveal (A18) later — the blur "develops" like a print.
- **Files:** extend `scripts/build-images.mjs` to emit a hash per image;
  `p*/index.html` (`data-thumbhash` attributes); new small
  `js/thumbhash-init.js` decoder (vendor the ~5KB ThumbHash JS from the
  official repo — new vendored file, unmodified); CSS to swap placeholder →
  image on load.
- **Verify:** test the decoder wiring in `tests/js/` (attribute → background
  style); `make precommit-fix`.

---

## Wave 2 — Design system (VISUAL; human review per item)

### A08 — Hardboiled color tokens ✅

- Gain 3 / Effort 2 — ratio 1.5 — VISUAL.
- **What:** defined CSS custom properties in `:root` (`--bg-color: #000`,
  `--text-color: #f2f2f2`, `--text-color-rgb`, `--text-muted: #aaa`,
  `--text-muted-rgb`, `--accent-color: #ce2323`, `--accent-color-rgb`) and
  replaced the literal home-page colors in `css/main_style.css` with the
  tokens. Ran `scripts/apply-color-tokens.js` (now deleted) to do the same
  across `css/style.css` and `css/base.css`, protecting the `.sr-only-focusable`
  accessibility block so its literal `#fff/#000` remain unchanged. The
  `prefers-color-scheme: dark` media query in `css/style.css` now maps to the
  same tokens.
- **Verify:** `make lint-css`, `make precommit-fix`; visual review.

### A09 — Hardboiled type system (Syne, per D1) ✅

- Gain 4 / Effort 3 — ratio 1.33 — VISUAL.
- **Done:** Adopted Syne as the unified brand typeface across headings,
  navigation, and body, self-hosted via `assets/fonts/syne-latin.woff2` and
  `syne-latin-ext.woff2`.
- **Verify:** `make precommit-fix`; visual review of all five pages.

### A10 — Retire P22 Underground entirely (D2) ✅

- Gain 2 / Effort 2 — ratio 1.0 — VISUAL.
- **Done:** Removed all P22 font files and dead `@font-face` blocks from
  `css/base.css`, `css/main_style.css`, and `css/style.css`.
- **Verify:** `make precommit-fix`.

### A11 — CSS grain overlay ✅

- Gain 3 / Effort 2 — ratio 1.5 — VISUAL.
- **What:** created `css/grain.css` with a fixed full-viewport `body::before`
  overlay (`pointer-events: none`, `z-index: 9999`, opacity `0.06`) using a
  64×64 grayscale noise PNG inlined as base64 (~5.6 KB). Added a 10-keyframe
  `grain` animation driven by `background-position` with `steps(6)` timing,
  and disabled it under `@media (prefers-reduced-motion: reduce)`. Wired the
  stylesheet into `index.html` and `p1/index.html`–`p4/index.html`.
- **Verify:** `make precommit-fix`; visual review; confirm the overlay never
  intercepts clicks.

### A14 — EXIF evidence captions

- Gain 3 / Effort 3 — ratio 1.0 — VISUAL.
- **What:** stamped case-file captions under/on gallery images: location,
  date, frame number, camera/film. Source EXIF from the JPEGs at build time
  (extend `scripts/build-images.mjs` — `sharp` exposes metadata) or hand-write
  them; style in Courier Prime (A09) per research doc Part 2A. Where EXIF is
  missing, fall back to frame numbers only — never invent data.
- **Verify:** `make precommit-fix`; visual review.

### A12 — Tabloid editorial grids for p1–p4 (dep A13)

- Gain 5 / Effort 5 — ratio 1.0 — VISUAL. The core aesthetic payoff.
- **What:** replace the uniform centered column with the mixed-rhythm grid of
  research doc Part 2B: full-bleed (100vw) hero frames, inset frames offset
  left/right at 60–70% width, occasional diptychs; tense tabloid whitespace;
  p2's essay set as a hardboiled dispatch (~65ch measure, headline-style pull
  quotes). Give each series its own rhythm.
- **Approach:** one shared CSS grid system in `css/style.css` (a few modifier
  classes: `.frame--bleed`, `.frame--inset-left`, `.frame--diptych`, …), then
  per-page class assignments in the HTML. Do p1 first as the pattern, get
  human sign-off, then replicate.
- **Verify:** `make precommit-fix` after each page; visual review per page;
  confirm `js/block-navigation.js` and `js/scroll-reveal.js` still find their
  targets (they key off block elements inside `.post-content`).

### A15 — Contact-sheet home/index rework

- Gain 4 / Effort 4 — ratio 1.0 — VISUAL.
- **What:** bring the contact-sheet/evidence motif to the home nav: frame
  numbers (`01`–`04`), evidence-tag red used per A08, nav rows styled like
  contact-sheet strips. Keep the existing structure (`#cont` panel, `#nav`)
  — this is a restyle, not a rebuild.
- **Verify:** `make precommit-fix`; visual review.

---

## Wave 3 — Motion (VISUAL; a11y-sensitive)

### A16 — Vendor Lenis and wire smooth scroll

- Gain 3 / Effort 3 — ratio 1.0 — VISUAL (feel).
- **What:** download the official Lenis build into `js/vendor/` (new file,
  unmodified), init in a small first-party module, integrate with the existing
  scroll-reveal IntersectionObservers (Lenis does not break IO, but verify),
  and gate like the ambient loader (reduced-motion, mobile).
- **Watch out:** `js/block-navigation.js` smooth-scrolls programmatically —
  route it through Lenis or confirm native smooth scroll still lands
  correctly; its test suite (`tests/js/block-navigation.test.js`) must stay
  green.
- **Verify:** `npx jest tests/js/block-navigation.test.js
tests/js/scroll-reveal.test.js`; `make precommit-fix`.

### A17 — GSAP 3.13 upgrade + SplitText headline reveals

- Gain 3 / Effort 3 — ratio 1.0 — VISUAL.
- **What:** replace `js/vendor/gsap.min.js` with the current 3.13 release
  (fully free since April 2025, incl. SplitText — download from the official
  GSAP npm/CDN), add `js/vendor/SplitText.min.js`; masked per-line reveals on
  series titles. Tests mock `window.gsap` (`tests/js/cursor-init.test.js`,
  `load-animations.test.js`, `magnetic-nav.test.js`) — keep the global
  contract intact.
- **Verify:** those three suites + `make precommit-fix`; visual review.

### A19 — Hard-cut View Transitions

- Gain 3 / Effort 3 — ratio 1.0 — VISUAL.
- **What:** activate the already-present
  `<meta name="view-transition" content="same-origin">` with CSS
  `@view-transition` rules for a fast hard cut (~150ms) between pages;
  simplify `js/page-transition.js`'s `?__pt=1` choreography so it defers to
  the native API where supported and keeps current behavior as fallback.
- **Watch out:** `tests/js/page-transition.test.js` is a 100+-test suite with
  a `loadInstrumentedScript()` rewriting pattern — read it before touching
  the module; keep the suite green.
- **Verify:** `npx jest tests/js/page-transition.test.js`; `make
precommit-fix`; manual navigation check in Chrome and Safari.

### A20 — Viewfinder cursor state

- Gain 3 / Effort 3 — ratio 1.0 — VISUAL.
- **What:** over gallery images, the difference-blend ring becomes four
  corner brackets that snap to the image edges ("focus lock"). Inspect
  `js/vendor/cursor.js` first: if it is effectively repo-maintained (check
  its header), extend it directly with tests; if it is third-party, implement
  the bracket state in `js/cursor-init.js` as a wrapper instead.
- **Verify:** `npx jest tests/js/cursor-init.test.js`; `make precommit-fix`;
  visual review.

---

## Wave 4 — Signature / optional

### A21 — Exhibition mode (fullscreen viewer; custom build)

- Gain 4 / Effort 5 — ratio 0.8 — VISUAL.
- **What:** fullscreen slideshow per series: arrow-key/drag navigation (build
  on `js/block-navigation.js` idioms), EXIF caption (A14), UI auto-hides
  after ~2s idle, Esc exits. D3 deleted the stock viewer.js assets, so this
  is a small first-party module (or re-vendor stock viewer.js at that point —
  it is re-downloadable). If this ships, restore a `zoom-in`-style affordance
  on gallery images (A05 removed the unwired one).
- **Verify:** new tests in `tests/js/`; `make precommit-fix`; visual review.

### A22 — WebGL grain + flash post-process via OGL

- Gain 4 / Effort 5 — ratio 0.8 — VISUAL. Phase-4 art-directed upgrade of
  A11/A18: real-time GLSL grain with controlled grain size/contrast and the
  strobe exposure-recovery done in a shader. Vendor OGL (~5KB ESM, new file),
  load via the existing dynamic-`import()` pattern used by
  `js/ambient/quantum_particles.js`; CSS versions remain the fallback.
- **Verify:** `make precommit-fix`; visual review; confirm fallback path.

### A25 — Tiered ambient layers (revised)

- Gain 2 / Effort 1 — ratio 2.0 — VISUAL/perf.
- **What:** instead of consolidating to one layer everywhere, tier them by
  page type. On the index page (`data-page-type="home"`) load both the
  sketch.js 2D particle drift and the Three.js point cloud. On project
  pages (`data-page-type="project"`) load only the WebGL point cloud. All
  other pages skip ambient. This keeps the landing-page impact maximal
  without doubling the perf cost on the image-heavy portfolio pages.
- **Verify:** `npx jest tests/js/ambient`; `make precommit-fix`; visual
  review.

### A26 — Optimize homepage background images ✅

- Gain 3 / Effort 2 — ratio 1.5 — no visual surface.
- **Why:** `assets/img/desktop_background.jpg` was ~903 KB and
  `mobile_background.jpg` was ~1.9 MB, both still carried EXIF metadata, and
  they were loaded via CSS `background-image` so the browser discovered them
  late. The mobile file in particular was oversized for a background.
- **Done:**
    1. Generated AVIF and WebP variants:
        - `desktop_background.avif` (~384 KB), `desktop_background.webp`
          (~376 KB).
        - `mobile_background.avif` (~636 KB), `mobile_background.webp`
          (~737 KB).
    2. Served them via CSS `image-set()` in `css/main_style.css`, with the
       JPEG as the final fallback.
    3. Added `<link rel="preload" as="image" href="..." media="..." />`
       in `index.html` for the active JPEG background.
    4. Stripped EXIF (kept ICC color profile) from the fallback JPEGs using
       `exiftool -EXIF=`.
- **Scope:** index/home page only. Done standalone; does not block A06.
- **Verify:** Lighthouse/Media panel shows the smaller format loading;
  `make precommit-fix`; visual parity check.
