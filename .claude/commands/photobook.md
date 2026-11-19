---
description: Orchestrate, validate, preview, and compile the Infinite Systems PDF eBook photobook from the 127 sequenced portfolio photographs. Use when building, syncing, previewing, or re-sequencing the photobook PDF.
argument-hint: '[subcommand, e.g. inventory | validate | plan | orchestrate | render | preview | preflight]'
---

# Infinite Systems Photobook Orchestrator

Manage the _Infinite Systems_ digital eBook photobook
(`dist/infinite-systems-display.pdf` and `dist/infinite-systems-screen.pdf`) via
`scripts/book.mjs` and the governing specification in
`docs/photobook-ebook-research.md`.

## Authority & Safety Invariants

1. **Pool Gatekeeping (`127` Sequenced Photos Only):** Only photographs listed
   in `assets/img/p1/index.md` through `assets/img/p6/index.md` enter the pool;
   the 12 unsequenced disk orphans stay excluded.
2. **Source Immutability:** Keep source JPEGs under `assets/img/p1..p6/`
   untouched and generate book derivatives exclusively under `.cache/book-img/`
   (outside `ensureImageVariants()` in `scripts/build-page.mjs`).
3. **Strict Modality Separation (`51 bw` vs. `76 color`):** Keep B&W and Color
   photographs strictly separated per spread and movement (`SYS.01` and
   `SYS.04` are `bw`; `SYS.02` and `SYS.03` are `color`).
4. **Proposal-Only Automation:** `node scripts/book.mjs plan` and
   `node scripts/book.mjs orchestrate` write proposals to `.cache/book-runs/`.
   Only `node scripts/book.mjs apply --plan <id>` updates `book/sequence.yaml`
   after human approval.

## Command Interface

Target argument: `$ARGUMENTS`

```bash
node scripts/book.mjs $ARGUMENTS
```

## Resume Protocol

When resuming a photobook task:

1. Run `git status --short` and `git log -n 3 --oneline`.
2. Inspect `book/sequence.yaml` (`revision` and `sourceFingerprint`) and
   `.cache/book-runs/` before dispatching tools.
