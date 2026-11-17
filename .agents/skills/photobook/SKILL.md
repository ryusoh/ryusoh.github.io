---
name: photobook
description: Orchestrate, validate, preview, and compile the Infinite Systems PDF eBook photobook from the 127 sequenced portfolio photographs. Use when building, syncing, previewing, or re-sequencing the photobook PDF.
argument-hint: '[subcommand, e.g. inventory | validate | plan | orchestrate | render | preview | preflight]'
---

# Infinite Systems Photobook Orchestrator

Manage the _Infinite Systems_ digital eBook photobook (`dist/infinite-systems-display.pdf` and `dist/infinite-systems-screen.pdf`) via `scripts/book.mjs` and the governing specification in `docs/photobook-ebook-research.md`.

## Authority & Safety Rules

1. **Pool Gatekeeping (`127` Sequenced Photos Only):** Only photographs listed in `assets/img/p1/index.md` through `assets/img/p6/index.md` enter the pool. The 12 unsequenced disk orphans are strictly ignored.
2. **Source Non-Mutation:** Never modify source JPEGs under `assets/img/p1..p6/` and never call `ensureImageVariants()` from `scripts/build-page.mjs`. All derivatives live under `.cache/book-img/`.
3. **Strict Modality Separation (`51 bw` vs. `76 color`):** Never mix B&W and Color photographs on the same spread or within the same movement (`SYS.01` and `SYS.04` are `bw`; `SYS.02` and `SYS.03` are `color`).
4. **Proposal-Only Automation:** `node scripts/book.mjs plan` and `node scripts/book.mjs orchestrate` write proposals to `.cache/book-runs/`. Only `node scripts/book.mjs apply --plan <id>` updates `book/sequence.yaml` after human approval.

## Command Interface

Target argument: `{{args}}`

```bash
node scripts/book.mjs {{args}}
```

## Resume Protocol

When resuming a photobook task:

1. Run `git status --short` and `git log -n 3 --oneline`.
2. Inspect `book/sequence.yaml` (`revision` and `sourceFingerprint`) and `.cache/book-runs/` before dispatching tools.
