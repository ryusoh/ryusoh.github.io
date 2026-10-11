# Contact-sheet ledger — design

**Status:** design (nothing built yet)
**Date:** 2026-10-11
**Parent:** `docs/photography-growth-infrastructure-research.md` §2 Proposal 1,
§6 WO 2. Unblocks §6 WO 4 (critique mode consumes this output convention).

## Purpose

Turn every shoot into a reviewable practice artifact: a capture-ordered digital
contact sheet with per-frame decisions (keep/reject), rationales, metrics, and
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

### D2 — Selection: harvest first (phase A), marking UI second (phase B)

- Existing culling flow: Bridge (first pass) → Lightroom (edited-effect check) →
  second cull. Ratings/labels live in XMP sidecars (Bridge default) and in
  Lightroom **only if** _Catalog Settings → Metadata → Automatically write
  changes into XMP_ is enabled — a one-time workflow prerequisite, also required
  by the archive protocol's metadata-at-ingest policy.
- **Phase A (v1):** no new UI. The tool harvests XMP rating/label per frame.
- **Phase B (v1.5):** only if the photographer reaches for it — keyboard
  keep/reject marking inside the generated HTML sheet (localStorage + export),
  with a merge command writing back to the digest. Builds on phase A's
  renderer; adds no new data model.
- The two-stage cull is recorded as data: `firstPass` (Bridge) vs `final`
  (post-Lightroom). Over years this answers whether seeing the edit improves
  selections or merely changes them.

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
            "firstPass": { "rating": null, "label": null },
            "final": { "decision": "unrated", "rating": null },
            "rationale": null,
            "metrics": { "luminance": null, "cielab": null, "deltaEPrev": null },
            "gaze": null
        }
    ]
}
```

Field rules:

- `final.decision` ∈ `keep` | `reject` | `unrated`; derived from XMP
  rating/label with a documented mapping (rejects and unrated are distinct —
  an unexamined frame is not a rejected one).
- `metrics` reuses the sequence skill's `metrics.mjs` (CIELAB, luminance,
  ΔE₇₆ to previous frame) computed over extracted previews.
- Unknown future fields must be additive; consumers ignore unknown keys.

## Phases and verification

- **Phase A (v1):** CLI + privacy filter + digest writer + JSON→HTML renderer.
  Ships with `tests/js/` coverage on synthetic fixtures only (p99 discipline —
  never write into production asset dirs; scratch under gitignored paths).
  Adds `contact-sheet-ledger/` to the `AGENTS.md` layout list when it lands.
- **Phase B (v1.5):** marking UI + merge-back command. Deferred until wanted.
- **Phase 2:** gaze scoring fills the reserved `gaze` slot; re-render HTML.

## Open questions

- Rating/label → keep/reject mapping (e.g. does Bridge "red label" mean reject
  or select?) is the photographer's convention; record it here once chosen.
- Whether `firstPass` is populated from Bridge XMP in practice depends on the
  XMP auto-write setting above being enabled from here on — historical shoots
  will have `firstPass: null`.
