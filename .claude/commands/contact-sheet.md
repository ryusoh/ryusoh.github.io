---
description: Ledger new shoots into per-day contact sheets and reconcile selects, Lightroom exports, and published galleries into the private funnel ledger. Use after offloading an SD card or photo folder, after exporting from Lightroom, or when the user asks to update the contact-sheet ledger.
---

# Contact-sheet ledger ritual

Design and schema: `docs/contact-sheet-ledger-design.md`. Tool:
`scripts/contact-sheet.mjs`. Everything produced is **private**:
`contact-sheets/` and `contact-sheet-ledger/` are gitignored — never commit
anything under either (design doc D3: local-first, public only via curated
aggregates).

## Prerequisites (one-time)

- `exiftool` on PATH (`brew install exiftool`); the tool fails closed without
  it.
- Lightroom Classic → Catalog Settings → Metadata → **Automatically write
  changes into XMP** — this makes edited frames detectable as selects. For
  shoots culled before enabling it: select the photos in Library, then
  Metadata → Save Metadata to Files.

## The ritual (one command)

The shoot directory comes from `$ARGUMENTS` — if empty, ask the user for it
(e.g. `/Volumes/Untitled/DCIM/131_FUJI` straight off the SD card; no copying
or reorganizing needed).

Run from the repo root, as a background task for large folders (920 frames ≈
10 minutes; progress prints every 50 frames):

```sh
node scripts/contact-sheet.mjs --sync "<dir>"
```

This splits the folder into per-day outings (one calendar day = one outing, in
camera-local time), writes `contact-sheets/<day>/` (thumbs + HTML + local
sheet) and `contact-sheet-ledger/<day>.json`, then reconciles against the
Lightroom export folder (`~/Desktop/Export`; override with `--export-dir`) and
published galleries (`assets/img`; override with `--gallery-root`), marking
`selection.exported` / `selection.published` and upgrading passes to selects
where the evidence exists.

## After it runs

1. Print the funnel table:

    ```sh
    node scripts/contact-sheet.mjs --stats
    ```

2. Point the user at the sheets to eyeball (`open contact-sheets/<day>/index.html`)
   — badge correctness is a human visual check. Report any frames that show
   "no preview" or landed in `undated`.
3. Commit nothing from the two output directories.

## Individual steps (when not using --sync)

- Single-outing folder with a chosen slug:
  `node scripts/contact-sheet.mjs <dir> --slug <YYYY-MM-DD-slug>`
- Per-day split only: `node scripts/contact-sheet.mjs <dir> --split`
- After exporting from Lightroom:
  `node scripts/contact-sheet.mjs --reconcile ~/Desktop/Export`
- After a gallery ships: `node scripts/contact-sheet.mjs --reconcile-galleries`
- Jot a craft note on a frame (near-miss autopsy, why a select worked):
  `node scripts/contact-sheet.mjs --annotate <day> --file DSCF1234.RAF --note "…"`
- Re-render a sheet after hand-editing its `sheet.json`:
  `node scripts/contact-sheet.mjs --render <day>`
- Fill gaze scores (face/eye-contact per frame) over one sheet or all:
  `node scripts/contact-sheet.mjs --gaze <day>` / `--gaze all`
- Funnel table, optionally one year:
  `node scripts/contact-sheet.mjs --stats [--year 2026]`
- Longitudinal report across outings (monthly funnel, keep-rate trend,
  focal-length and hour-of-day histograms, frames-per-scene depth):
  `node scripts/contact-sheet.mjs --longitudinal [--year 2026]`
- Self-reported day fields (mood, hours walked, location — mergeable):
  `node scripts/contact-sheet.mjs --annotate-day <day> [--mood "…"] [--hours 4] [--location "…"]`

## Critique loop (WO 4)

Run only after the human edit is settled in the ledger (never before — the
log must record independent judgments, see `docs/critique-calibration-design.md`):

1. `node scripts/contact-sheet.mjs --montage <day>` — tiles the sheet thumbs
   into labeled grid pages at `contact-sheets/<day>/montage/page-N.jpg`.
2. Review the montage pages plus the digest; write a verdicts file
   `{ "<file>": { "verdict": "keep" | "cut", "evidence": ["…"] } }` — only for
   frames worth challenging (weak selects) or nominating (overlooked rejects).
3. `node scripts/contact-sheet.mjs --critique <day> --verdicts <file.json>` —
   appends only human↔machine disagreements (`select-audit` / `nomination`) to
   the private `contact-sheet-ledger/calibration.jsonl`. Without `--verdicts`
   the layer-0 heuristic critic runs instead (gaze eye contact ⇒ keep).
4. Eyeball the disagreements, then backfill the reason:
   `node scripts/contact-sheet.mjs --resolve <day> --file DSCF1234.RAF --reason "kept for the gesture"`

Re-running any step is idempotent — sheets and digests are regenerated from
scratch, reconcile marks are only counted when they change.

## Troubleshooting

| Symptom                        | Meaning                                        | Action                                      |
| ------------------------------ | ---------------------------------------------- | ------------------------------------------- |
| `exiftool is required` error   | binary missing from PATH                       | `brew install exiftool`                     |
| all frames PASS                | no Lightroom edits on these files (or XMP off) | expected for card-only shoots; export first |
| `undated` warnings             | frames with no EXIF capture time               | report the count; usually corrupt files     |
| `no preview` cells in the HTML | RAW embedded-preview extraction failed         | report the camera model                     |
