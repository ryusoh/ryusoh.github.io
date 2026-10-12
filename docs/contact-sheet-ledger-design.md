# Contact-sheet ledger — design

**Status:** phase A landed 2026-10-11 (`scripts/contact-sheet.mjs`,
`tests/js/contact-sheet.test.js`); phases B and 2 pending.
**Date:** 2026-10-11
**Parent:** `docs/photography-growth-infrastructure-research.md` §2 Proposal 1,
§6 WO 2. Unblocks §6 WO 4 (critique mode consumes this output convention).

## Purpose

Turn every shoot into a reviewable practice artifact: a capture-ordered digital
contact sheet with per-frame decisions (select/pass), rationales, metrics, and
EXIF — the Magnum grease-pencil markup, digitized. The JSON digest is the
source of truth; every other surface (HTML sheet, future critique tooling) is a
derived, re-renderable view.

## Decisions (from the 2026-10-11 design discussion)

### D1 — Input: arbitrary directory, RAW-first

- CLI takes a directory path and a slug:
  `node scripts/contact-sheet.mjs <dir> --slug <YYYY-MM-DD-slug>`.
- Photographer shoots RAW-only (sometimes RAW+JPEG). RAW frames get embedded
  previews extracted via `exiftool -b -PreviewImage`; JPEGs are read directly.
- exiftool is **required** here (fail-closed with an actionable error), unlike
  `scripts/build-page.mjs:36` (`sanitizeImageMetadata`) where it is optional —
  preview extraction is core, not cosmetic.
- The tool reads in place and writes only derivatives; it never mutates the
  source directory. Master storage remains the archive protocol's concern
  (`docs/archive-protocol.md`).
- Cards are offloaded infrequently, so a folder may span months of outings.
  `--split` segments such a folder **by calendar day** (one day = one outing,
  in camera-local time), emitting one sheet + digest per day with the date as
  slug; frames with no capture time group under `undated` with a warning.
  Explicit `--slug` keeps single-sheet behavior for per-outing folders.
  (Settled 2026-10-12 after testing against a real 920-frame card folder.)
- Dotfiles are ignored — macOS AppleDouble `._*.RAF` files on FAT32 cards must
  never be counted as frames (found during the same 920-frame test).

### D2 — Selection: harvest first (phase A), marking UI second (phase B)

- Actual culling flow (street-photography shaped): most frames are clear passes
  that earn no mark at all; the only positive act is Bridge's "Open in
  Lightroom" on the few frames (typically fewer than 5 per session) worth
  seeing edited. No ratings, no labels — so the harvest reads _traces_, not
  marks.
- The trace: with Lightroom's _Catalog Settings → Metadata → Automatically
  write changes into XMP_ enabled, any frame he edits gets an XMP sidecar
  carrying develop settings (`crs:*` namespace). Frames are opened in Lightroom
  precisely to see the edited effect, so **XMP sidecar with develop settings ⇒
  selected**; everything else defaults to `pass`. The setting is a one-time
  workflow prerequisite, also required by the archive protocol's
  metadata-at-ingest policy.
- `pass` is the default state, not a rejection judgment: at street volume the
  base rate is pass. The schema has no `reject`/`unrated` distinction.
- **Phase A (v1):** no new UI; the tool infers `select` from the XMP trace.
- **Phase B (v1.5):** only if wanted — keyboard select/pass marking inside the
  generated HTML sheet (localStorage + export), merged back into the digest.
  Builds on phase A's renderer; adds no new data model.
- Known miss: a frame opened in Lightroom but never edited writes no XMP and
  reads as `pass`. Accepted — an explicit pick in Lightroom would close the
  gap, but nothing in the flow requires it.

### D3 — Output: split local material from public digest

- `contact-sheets/<slug>/` (gitignored, WO 1): `thumbs/`, `index.html`, and a
  full local `sheet.json` — working material, disposable.
- `contact-sheet-ledger/<slug>.json` (tracked, public): the long-term digest —
  small text, diffable across decades ("how did my eye change" as a diff of
  digests), cross-machine durable via git.
- Public-by-default is deliberate: the repo already publishes
  `sequence-report.md` curatorial reasoning; the ledger extends that
  proof-of-process to the full edit.
- **Privacy filter at digest-write time:** strip GPS, all serial numbers, and
  any location fields (same field policy as `sanitizeImageMetadata`).
  `captureTime` stays (the site already treats EXIF as testimony).
- **Rationales are public and permanent** (git history). Write them as craft
  notes. A `privateNote` field is reserved in the schema, kept only in the
  gitignored local `sheet.json`, for anything else.

### D4 — Schema versioning and additive phases

- `schemaVersion: 1` on every digest; migrations are explicit, never silent.
- `gaze: null` is reserved in the frame schema from day one, so the phase-2
  gaze pass (`gaze.mjs`) is purely additive.
- HTML is always re-rendered from JSON, never hand-maintained — adding fields
  later means re-running the renderer, not editing pages.

## Digest schema (v1)

```json
{
    "schemaVersion": 1,
    "slug": "2026-10-11-example",
    "generatedAt": "<ISO-8601>",
    "source": { "dirBasename": "example", "frameCount": 0 },
    "frames": [
        {
            "file": "<basename.ext>",
            "captureTime": "<ISO-8601 or null>",
            "exif": {
                "focalLength": null,
                "aperture": null,
                "shutter": null,
                "iso": null,
                "lens": null
            },
            "selection": { "decision": "pass", "signal": null },
            "rationale": null,
            "metrics": { "luminance": null, "cielab": null, "deltaEPrev": null },
            "gaze": null
        }
    ]
}
```

Field rules:

- `selection.decision` ∈ `select` | `pass`; `pass` is the default for every
  frame with no selection trace (see D2 — pass is a base rate, not a verdict).
  `selection.signal` records how a `select` was inferred (`xmp-develop` in v1;
  `manual` once phase B exists).
- `metrics` reuses the sequence skill's `metrics.mjs` (CIELAB, luminance,
  ΔE₇₆ to previous frame) computed over extracted previews.
- Unknown future fields must be additive; consumers ignore unknown keys.

## Phases and verification

- **Phase A (v1): landed 2026-10-11** — CLI (`scripts/contact-sheet.mjs`) +
  privacy filter + digest writer + JSON→HTML renderer, covered by
  `tests/js/contact-sheet.test.js` on synthetic fixtures (exiftool shimmed via
  PATH, CI-safe). `contact-sheet-ledger/` added to the `AGENTS.md` layout list.
- **Phase B (v1.5):** marking UI + merge-back command. Deferred until wanted.
- **Phase 2:** gaze scoring fills the reserved `gaze` slot; re-render HTML.

## Open questions

- The select → published lineage (digest `select` → membership in a published
  `pN` gallery) is a later join, not v1.
- Frames opened in Lightroom but never edited write no XMP and read as `pass`
  (accepted miss; see D2). Historical shoots predate the XMP auto-write
  setting, so their digests will be all-`pass`.
