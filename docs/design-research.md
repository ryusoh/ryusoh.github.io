# Design research: taking ryusoh.github.io from "good dark portfolio" to premium

Research compiled 2026-08-14. Goal: premium, professional, high-end visual
upgrades — aesthetic and technological — with reasoning, tailored to this repo's
constraints (static GitHub Pages site, vanilla JS/CSS, plain `<script>` tags, no
build step, vendored libraries).

**Art direction premise:** Every
aesthetic recommendation below is tuned to that hardboiled register —
tabloid/evidence-file/film-noir — rather than the polite gallery default.

**Implementation:** the ranked, keep/ditch-able, delegation-ready action list
lives in `docs/design-action-items.md`.

## Part 1 — Current baseline (honest assessment)

Already strong:

- A real motion identity: the `--brand-ease: cubic-bezier(0.65, 0.05, 0, 1)`
  token used consistently, a custom GSAP-lerped difference-blend cursor
  (`js/vendor/cursor.js`), magnetic nav icons (`js/magnetic-nav.js`), staggered
  entrances (`js/load-animations.js`).
- Restraint infrastructure: ambient effects gated behind viewport width,
  `prefers-reduced-motion`, and `saveData` (`js/ambient/loader.js`).
- Self-hosted signature type (P22 Underground Pro Thin), dark-always palette,
  service worker (`sw.js`) + idle preloader (`js/preloader.js`).

What currently reads as _not_ premium:

1. **Photos are served like it's 2012.** Plain `<img>`, JPEG-only, no
   `srcset`/`sizes`/AVIF/WebP, no `width`/`height`, and **16–61 MB per project
   page** (p3 is ~61 MB). Nothing destroys a high-end feeling faster than
   watching a hero image paint in over seconds.
2. **Project pages are a narrow Bootstrap 3 + jQuery column (~750px).** Street
   photography — scale, grain, presence — shown at thumbnail-adjacent width in
   a generic blog layout. The single biggest aesthetic gap.
3. **`cursor: zoom-in` with no lightbox wired.** `viewer.min.js` /
   `viewer.min.css` exist in the repo but are loaded nowhere (dead assets). A
   promise the UI doesn't keep reads as unfinished.
4. **The red `#ce2323` accent** on project pages reads "default dark template,"
   not "photographer."
5. **Dead/disabled experiments:** hover-preview and mouse-parallax are built
   but flagged off in `js/config.js`; the `?__pt=1` page-transition hack exists
   while `<meta name="view-transition">` is set but unused.
6. **Typography fragility:** P22 Underground _Thin_ at small sizes with 2.5px
   letter-spacing on body text is the classic "cool in the mockup, unreadable
   in production" pattern. The home page also loads Lobster via the vendor
   loader, which fights the street-photography mood.

## Part 2 — Aesthetic direction (the anti-slop part)

AI-generated portfolios all converge on the same look: bento grids, gradient
meshes, glassmorphism cards, floating blobs, Inter at 600 weight. The fix isn't
more effects — it's a **concept**. And the concept is already decided by the
work itself. The design register is therefore **hardboiled**: tabloid,
evidence file, film noir — not the polite white-glove gallery.

The discipline that keeps hardboiled from becoming costume: **the structure
stays Swiss-precise; the content and texture carry the aggression.** A strict
grid, exact spacing, and one type system acting as the quiet, controlled frame
— so the violent imagery detonates inside it. Premium here means _controlled
brutality_, not softness.

### A. Build the identity around hardboiled photographic artifacts

- **Contact-sheet / evidence-file thinking.** Series index referencing a
  contact sheet: frame numbers (`01 / 24`), sprocket-like spacing rhythm,
  grease-pencil-style selection marks. Captions phrased like case-file entries
  — location, date, frame number — Weegee's stamped "PHOTO BY WEEGEE" energy.
- **EXIF as testimony.** Camera, lens, ƒ-stop, shutter, ISO, film stock — set
  in a typewriter mono as stamped evidence, not polished metadata.
- **Red = evidence marker.** The existing `#ce2323` earns its place only if it
  reads as evidence-tag / darkroom-safelight red: one job (index numbers or
  hover states), never decoration.
- **Grain, heavy.** Not tasteful 5% texture — Moriyama-grade animated grain on
  the chrome and dark areas (never degrading the photos themselves), CSS-only
  base64 noise with a stepped position animation ([reference
  technique](https://www.squarestylist.com/squarespace/squarespace-film-grain-texture-overlay)),
  gated by the existing reduced-motion infrastructure.
- **Flash falloff as a layout motif.** Vignettes, hard edges, subjects lit
  against void-black — the page chrome should feel like the unlit margin of a
  night frame.

### B. Tabloid density on a strict grid, not a blog column

Replace the single centered Bootstrap column on p1–p4 with a **mixed-rhythm
editorial grid tuned confrontational**:

- Full-bleed (100vw) hero frames that hit like a flash going off; inset frames
  cropped tight and pushed to grid edges; occasional diptychs that read like
  facing contact-sheet pairs.
- Whitespace is present but _tense_ — tabloid density, not gallery serenity.
  Think newspaper page or evidence board laid out by a Swiss typographer.
- p2's essay becomes a hardboiled dispatch: news-serif measure (~65ch),
  pull-quotes set like headlines, dateline treatment.

Virtually no awarded site in the [Awwwards photography
category](https://www.awwwards.com/websites/photography-sites/) uses a uniform
narrow column. Each series can have its own rhythm as a "signature system" — a
small set of repeated visual rules, which [2026 trend
analysis](https://coalitiontechnologies.com/blog/2026-web-design-trends)
identifies as what creates brand memory.

### C. Typography — the hardboiled system, no legacy constraints

The register: tabloid headline + news-column body + typewritten evidence
label. Three voices again — but recast for noir, not the museum.

**The absolute-best pick (paid): Knockout + Mercury Text + Courier Prime.**

- **Display — Knockout (Hoefler&Co).** A full family of American vernacular
  gothics drawn from 19th-century poster and tabloid wood type — _the_
  hardboiled headline face: boxing posters, crime tabloids, WANTED bills.
  Compressed weights at oversized scale with tight tracking will make series
  titles ("I Tear Up the Bay…") hit like a front page. Runners-up: Trade
  Gothic Condensed, Acropolis, Druk (Commercial Type — colder, more fashion).
- **Body — Mercury Text (Hoefler&Co).** Engineered literally for newspapers:
  tough, legible, unglamorous in the right way. The correct voice for p2's
  essay — a dispatch, not a literary magazine. Runner-up: Tiempos (Klim) if
  the essay ever wants more polish.
- **Evidence voice — Courier Prime.** Typewriter mono for EXIF, frame numbers,
  dates, locations. Police-report cadence; free (OFL) even in the paid system.

**The best free pick (OFL): Archivo + Newsreader + Courier Prime.**

- **Archivo** (its Condensed/Expanded variable cuts) covers the tabloid-gothic
  display job — heavy weights get 80% of Knockout's punch for $0. (Anton is the
  one-weight shortcut; acceptable, but Archivo's range ages better.)
- **Newsreader** (Production Type) is newspaper-native and free — arguably a
  _better_ hardboiled body face than several paid options.
- **Courier Prime** again for the evidence voice.

**The counter-argument, stated honestly:** with imagery this aggressive, some
art directors would keep ALL type neutral (a Swiss grotesque like Söhne) so the
photos supply 100% of the violence — that is how many of Gilden's own books are
set. The recommendation above takes the matching-energy route but confines
hardboiled type to display + captions, keeping UI chrome in the neutral
grotesque register. If the result ever feels like costume, the fallback is
Söhne + Tiempos + Söhne Mono (Klim, ~USD 300–600 in web licenses) with zero
layout changes.

**What this means for P22 Underground:** no sacred cows. Thin geometric caps
are gallery-noir at best and fight the tabloid register; it survives only as
the name wordmark on the home panel, if at all. Everywhere else it is retired.
Lobster goes, unconditionally — a script face is unforgivable in this
aesthetic.

Serving rules regardless of choice: woff2 only, subset to used glyphs,
`font-display: swap`, preload the one critical face, and declare each family
under a single name (P22 is currently declared under two).

### D. Color & surface — flash-lit, not gallery-lit

- **Embrace true black.** The earlier instinct to soften `#000` was
  gallery-thinking; harsh-flash night photography _lives_ at true black —
  flash falloff leaves the margins void. Keep `#000`, pair it with hard
  near-white (`#f2f2f2`) text. The drama is the contrast, same as the work.
- Grays exist only for the metadata layer (evidence labels), never for
  anything that should hit.
- One red, one job (Section A). Everything else monochrome — the photos carry
  what little color exists.

### E. Motion language — the signature move is THE FLASH

- **Strobe reveal:** each image enters with a single brief overexposure pop —
  a ~80–120ms white/overexposed frame that settles into full contrast, like a
  strobe firing and the exposure recovering. Used everywhere, once per image,
  it becomes the site's unmistakable signature and it is _thematically exact_:
  the viewer experiences what Gilden's subjects experience. Accessibility
  rules: one flash only, never repeating, well under WCAG's
  three-flashes-per-second threshold, and swapped for a plain fade under
  `prefers-reduced-motion` (the gating infrastructure already exists in
  `js/ambient/loader.js`'s pattern).
- **Hard cuts for page changes.** Filmic, tabloid-urgent; soft crossfades read
  romance. Keep them fast (~150ms).
- Everything else stays still. One WebGL signature on top (Part 3, item 5).
- **Cursor → viewfinder.** Over images the ring becomes four corner brackets
  that snap onto the frame like a focus lock; the difference-blend ring stays
  for chrome. Thematic, and it costs little — `js/vendor/cursor.js` already
  lerps and scales.

## Part 3 — Technology recommendations (with reasons)

Ordered by impact-per-effort. All respect: no build step, plain script tags,
GitHub Pages, vendored libs.

### 1. Image pipeline — the non-negotiable first move

- Generate **AVIF (+ WebP fallback) at 3–4 widths** per image, wire `<picture>`
  with `srcset`/`sizes`, add `width`/`height` and `decoding="async"`. A one-off
  local Node script using `sharp`, output committed like today's JPEGs — no
  runtime build needed. Expect p3 to drop from ~61 MB to low single-digit MB on
  mobile.
- **ThumbHash placeholders** (~28 bytes inline, ~5KB decoder) for blur-up —
  beats BlurHash on color accuracy and encodes aspect ratio
  ([comparison](https://evanw.github.io/thumbhash/), [PicLab
  guide](https://piclab.click/en/articles/image-placeholder-techniques/)).
  Blur-up into the clip-path reveal = instantly premium loading feel.
- **Why first:** perceived performance _is_ the aesthetic for a photo site. No
  shader compensates for a 61 MB page.

### 2. Decommission Bootstrap 3 + jQuery on project pages

Only a dozen or so of its rules are actually used. ~50 lines of modern CSS
(grid + custom properties) replaces them, removes two legacy vendor files, and
unblocks the editorial layout in Part 2. Pure win.

### 3. Lenis + GSAP ScrollTrigger — the scroll feel

- **[Lenis](https://github.com/darkroomengineering/lenis)** (~9KB, vendorable)
  is the smooth-scroll layer under most Awwwards sites; integrates natively
  with ScrollTrigger.
- **GSAP is now 100% free including all former Club plugins** (SplitText,
  ScrollSmoother, MorphSVG) since April 2025 after the Webflow acquisition
  ([Webflow announcement](https://webflow.com/blog/gsap-becomes-free),
  [release analysis](https://artofstyleframe.com/blog/gsap-2026-free-license-whats-new/)).
  The repo already vendors GSAP core — upgrading to 3.13 + vendoring
  ScrollTrigger/SplitText is a drop-in with no licensing concern. SplitText is
  the difference between "fade in the title" and masked per-line reveals.
- **Why:** current transitions are page-level; scroll-linked motion (parallax,
  scrubbed reveals, velocity-aware effects) is the missing layer, and this is
  the mature, documented path to it.

### 4. Cross-document View Transitions — replace the `?__pt=1` hack

Native API covers Chrome 126+ and Safari 18.2+ ([CSS-Tricks on cross-document
view transitions](https://css-tricks.com/cross-document-view-transitions-part-1/),
[support status](https://www.testmuai.com/learning-hub/view-transitions-api-browser-support/));
unsupported browsers just navigate normally — today's behavior anyway. The site
already ships `<meta name="view-transition" content="same-origin">`. Pure
progressive enhancement: shared-element transitions (an index thumbnail
_becoming_ the project hero) with zero JS. Arguably the most premium-feeling
navigation pattern available on an MPA today.

### 5. WebGL: one signature effect, with restraint

Three.js already runs the ambient quantum particles
(`js/ambient/quantum_particles.js`). For the gallery, the highest-value
hardboiled-appropriate effects, all with public tutorials:

- **Shader grain + flash post-process** — the most thematic option: real-time
  animated film grain and the strobe-pop reveal done in GLSL rather than CSS,
  giving true control over grain size, contrast curves, and exposure recovery
  ([Codrops: distortion & grain on scroll](https://tympanus.net/codrops/hub/tag/glsl/)).
  The CSS grain of Part 2A is the cheap version; this is the art-directed one.
- **Scroll-velocity distortion** — image planes subtly skew/bend proportional
  to scroll velocity, settling back at rest. Tactile, and it makes scrolling
  itself feel expensive; plays well with the flash reveal as long as only ONE
  of the two is the headline effect.
- **Displacement-map transitions** between two images — ink/cloud maps read
  organic and photographic
  ([guide](https://www.hontran.dev/blog/webgl-image-displacement-hover-effect));
  a good fit for an exhibition-mode slideshow if it ever goes fullscreen.
- **Infinite draggable gallery** for a horizontal contact-sheet index
  ([Codrops OGL tutorial](https://tympanus.net/codrops/2021/01/05/creating-an-infinite-auto-scrolling-gallery-using-webgl-with-ogl-and-glsl-shaders/)).

**Library advice:** for full-screen shader effects like these, **OGL (~5KB,
ESM, zero deps)** fits better than Three.js — no scene-graph tax when all you
need is textured planes + GLSL
([comparison](https://aidxn.com/blog/ogl-minimal-webgl-library-vs-threejs/)).
Keep Three.js for the ambient particle field; add OGL for image-plane work.
Both vendor cleanly as ES modules via the existing dynamic-`import()` pattern.

**Restraint rule:** pick ONE. Award juries reward a single art-directed effect;
five shader effects reads as a demo reel.

### 6. Skip WebGPU for now

Baseline as of 2026 (Chrome 113+, Safari 26+, Firefox 141+, ~70–82% global
coverage — [status roundup](https://www.utsubo.com/blog/frontier-web-apis-2026-production-ready)),
but everything wanted here (image distortion, grain, particles) is trivially
within WebGL2's envelope, and WebGPU demands a WebGL fallback path anyway.
Revisit only for GPGPU particle counts in the hundreds of thousands.

### 7. Housekeeping that reads as polish

- Re-enable `enableHoverPreview` (built and good — a floating preview with
  clip-path reveal is a legitimately premium index interaction) or delete it.
  Same for `mouse-parallax.js`. Dormant flags are debt.
- Wire the orphaned `viewer.min.js` lightbox or remove `cursor: zoom-in`.
  Better: a fullscreen **"exhibition mode"** — arrow-key/drag slideshow, EXIF
  caption, grain on, UI fades after 2s idle. `js/block-navigation.js` already
  has the arrow-key infrastructure to build on.
- Fix the preloader's asset list (it omits p4 entirely).
- Add `font-display: swap` + preload the critical woff2; subset whichever
  faces survive the Part 2C decision.

## Part 4 — Suggested phasing

1. **Phase 1 — Foundation (invisible but transformative):** image pipeline
   (AVIF/srcset/ThumbHash), font-display fix, Bootstrap/jQuery removal,
   lightbox-or-remove decision, preloader p4 fix. Zero visual risk, biggest
   quality jump.
2. **Phase 2 — Design system:** hardboiled color/type system, tabloid-grid
   layouts for p1–p4, CSS grain overlay, case-file EXIF captions.
3. **Phase 3 — Motion:** strobe-flash image reveals, Lenis + ScrollTrigger +
   SplitText, hard-cut View Transitions, viewfinder cursor state.
4. **Phase 4 — Signature:** one WebGL effect (recommended: GLSL grain + flash
   post-process via OGL; scroll-velocity distortion as the alternate).

Each phase ships independently with a green `make precommit-fix`; phases 2–4
are visual-surface changes that require human visual review before shipping.

## Sources

- [Awwwards — photography category](https://www.awwwards.com/websites/photography-sites/)
- [Codrops GLSL/WebGL demo hub](https://tympanus.net/codrops/hub/tag/glsl/)
- [GSAP goes free (Webflow)](https://webflow.com/blog/gsap-becomes-free)
- [Lenis](https://github.com/darkroomengineering/lenis)
- [OGL](https://oframe.github.io/ogl/)
- [ThumbHash](https://evanw.github.io/thumbhash/)
- [CSS-Tricks: cross-document View Transitions](https://css-tricks.com/cross-document-view-transitions-part-1/)
- [Plinth: premium fonts 2026](https://plinthstudio.dev/blog/best-fonts-startup-websites)
- [Line25: web design trends 2026](https://line25.com/articles/web-design-trends-2026/)
