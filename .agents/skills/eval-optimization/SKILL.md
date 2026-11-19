---
name: eval-optimization
description: Evaluate whether a historical bot-recorded optimization is actually worth keeping
argument-hint: '<optimization slug or id, e.g. bolt/optimize-hover-preview-mouse-tracking-1539…>'
---

Judge whether a historical bot-recorded optimization (`{{args}}`) is **worth
keeping** — strictly from the real code rather than its comment. Evaluation
only: leave app code untouched unless explicitly asked to change it.

Work through these steps:

1. **Locate the entry.** The slug is `<tool>/<description>-<bigid>` (e.g.
   `bolt/…`). The numeric ID rarely appears in the repo — search by description
   keywords across inline comments (`Bolt Optimization:`) or historical persona
   notes (`git show c6fc301:.jules/<tool>.md`), and read its **Learning** and
   **Action**.
2. **Read the actual code it touches.** Open the source file and exact lines
   plus any inline `Bolt Optimization:` comment, and judge the diff on its
   merits.
3. **Test the premise: is this genuinely a hot path?** Specify firing frequency:
    - **High-frequency:** `mousemove`, `scroll`, `resize`, or a
      self-rescheduling `requestAnimationFrame` loop.
    - **Low-frequency (common false positive):** `IntersectionObserver`
      callbacks (fire only on intersection transitions, browser-coalesced),
      setup/init code, or `mouseenter`-style one-shots.
4. **Check correctness and edge cases.** Verify cached/persisted state stays
   valid (`lastRenderX/Y` across hover sessions, cached
   `getBoundingClientRect` across scroll/resize, dirty-checks on the first
   frame) with no stale-value or skipped-update bugs.
5. **Scrutinize the comment's technical claims:**
    - **"Layout thrashing"** requires _interleaved DOM reads and writes_
      forcing synchronous layout. A write-only loop (`transform`/`quickSetter`)
      is at most redundant style writes.
    - **`.forEach` → `for` "to avoid closure allocation":** one short-lived
      closure per call is negligible for V8's generational GC outside genuinely
      hot loops; `for...of` over a `Set` still allocates an iterator.
    - **Writing an unchanged composited style** usually skips layout and paint,
      so CPU/battery savings are typically tiny.
6. **Weigh cost vs. benefit in absolute terms.** Note actual call frequency and
   whether a higher-leverage alternative exists (e.g. stopping the rAF loop on
   idle instead of gating writes, or writing directly in `mousemove`).
7. **Deliver a verdict:** **keep** (cheap, correct, real or harmless), **keep
   but overstated** (fine to leave; specify how the comment's framing is
   inaccurate), or **revert / not worth it** (no real benefit, added complexity,
   or bug risk). Back the verdict with the reasoning above and confirm no files
   were changed.

Guiding test: _would this survive a senior review asking "is this path actually
hot, is the claim physically true, and does the win justify the line?"_
