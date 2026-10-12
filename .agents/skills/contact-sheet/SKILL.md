---
name: contact-sheet
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

The shoot directory comes from `{{args}}` — if empty, ask the user for it
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

1. Print the funnel table (verified command):

    ```sh
    node -e "
    const fs = require('fs');
    const files = fs.readdirSync('contact-sheet-ledger').filter((f) => f.endsWith('.json')).sort();
    for (const f of files) {
        const d = JSON.parse(fs.readFileSync('contact-sheet-ledger/' + f, 'utf8'));
        const selects = d.frames.filter((x) => x.selection.decision === 'select').length;
        const exported = d.frames.filter((x) => x.selection.exported).length;
        const published = d.frames.filter((x) => x.selection.published).map((x) => x.selection.published);
        console.log(d.slug, '| frames:', d.frames.length, '| select:', selects, '| exported:', exported, '| published:', published.length ? published.join(',') : '-');
    }
    "
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

Re-running any step is idempotent — sheets and digests are regenerated from
scratch, reconcile marks are only counted when they change.

## Troubleshooting

| Symptom                        | Meaning                                        | Action                                      |
| ------------------------------ | ---------------------------------------------- | ------------------------------------------- |
| `exiftool is required` error   | binary missing from PATH                       | `brew install exiftool`                     |
| all frames PASS                | no Lightroom edits on these files (or XMP off) | expected for card-only shoots; export first |
| `undated` warnings             | frames with no EXIF capture time               | report the count; usually corrupt files     |
| `no preview` cells in the HTML | RAW embedded-preview extraction failed         | report the camera model                     |
