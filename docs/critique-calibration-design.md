# Adversarial critique + calibration log — design

**Status:** layer 0 (digest-heuristic critic + private calibration log +
`--resolve` backfill) landed 2026-10-12 (`scripts/contact-sheet.mjs`,
`--critique` / `--resolve`); the VLM montage layer (D3 layer 1) and per-frame
deep critique (layer 2) remain open.
**Parent:** `docs/photography-growth-infrastructure-research.md` §2 Proposal 3,
§6 WO 4. Consumes the ledger output convention in
`docs/contact-sheet-ledger-design.md`.

## Purpose

Extend the `/sequence` dual-layer architecture one step earlier: an adversarial
critic over a shoot's contact sheet, plus an append-only calibration log of
human↔machine disagreements — the artist's taste made measurable over decades.
Barthes supplies the frame: the machine can only ever assess the _studium_
(the culturally coded, legible content); the log of where the human overrules it
is a long-horizon empirical map of the _punctum_.

## Decisions (from the 2026-10-12 design discussion)

### D1 — Timing: critique after the fact, never at import

- The critic runs **after** the human's edit, over a ledger slug whose
  selection is already settled. Two reasons:
    1. **Cost** — street volume is mostly clear junk; paying a model to argue
       why junk is junk is waste.
    2. **Blinding** — critiquing before selection contaminates the human
       verdict. The log must record independent judgments, or it measures
       suggestion-compliance instead of taste. Same independent-judgments
       methodology as the deferred gaze calibration agenda
       (`docs/gaze-vector-action-items.md` §6).
- Backlog-friendly: runs over the existing ledger slugs immediately.

### D2 — Two directions, both logged

- **Audit the selects** — for each human select, the critic argues the case
  against it. Logs `human-kept / machine-cuts`.
- **Nominate from the rejects** — surface frames the human cut that deserve a
  second look. Logs `machine-keeps / human-cut`. Without this direction the
  system can only flatter the edit, never reveal blind spots.

### D3 — Cost protocol: deterministic first, one VLM call per outing

- **Layer 0 (free):** the ledger digest (metrics, gaze, EXIF) nominates
  outliers — e.g. eye contact in a frame the human cut.
- **Layer 1 (cheap):** one composite grid montage per outing (a flat JPEG tile
  of the sheet thumbs, akin to `--render` output) plus the digest JSON → a
  single VLM call: "which ≤3 rejected frames deserve a second look; which
  selects are weakest?" Budget: ~1–2 calls per outing.
- **Layer 2 (on demand only):** per-frame full-resolution critique of specific
  selects the human wants stress-tested.

### D4 — Critic prompt: reuse the personas, not the protocol

- Ground the critic in the sequence skill's council personas (the Pruning
  Critic is the natural seed) and the `principles.md` taxonomy, so the critique
  speaks the same formal vocabulary as the rest of the system.
- Do **not** reuse the deliberation protocol: the sequence council prunes to
  serve a sequence; this critic audits taste. One adversarial pass is the right
  shape.

### D5 — Calibration log: private, append-only JSONL

- Lives in the private nested repo as `contact-sheet-ledger/calibration.jsonl`.
  Never in this public repo (same rationale as contact-sheet D3: the failures
  are the data; Goodhart distortion; activity-pattern leakage).
- Record sketch (additive, consumers ignore unknown keys):

    ```json
    {
        "ts": "<ISO-8601>",
        "slug": "2026-10-06",
        "file": "DSCF0123.RAF",
        "machine": "keep",
        "human": "cut",
        "evidence": ["gaze:eye-contact"],
        "humanReason": null,
        "source": "nomination"
    }
    ```

- `source` ∈ `select-audit` | `nomination`. Only disagreements are logged —
  agreements carry no calibration signal and would dominate volume.
- `humanReason` is nullable and backfilled through the existing `--annotate`
  flow when the human reviews the disagreements.

## Open questions

- VLM choice for layer 1 (needs vision). Whether the layer-0 digest alone is a
  strong enough nominator is empirical: measure nomination yield over the
  backlog before tuning.
- Whether layer-2 deep critique belongs in this tool or inside the `/sequence`
  skill proper.
