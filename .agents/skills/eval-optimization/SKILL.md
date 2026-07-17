---
name: eval-optimization
description: Evaluate whether a Jules-recorded optimization (e.g. a bolt/… entry) is actually worth it
argument-hint: '<optimization slug or id, e.g. bolt/optimize-hover-preview-mouse-tracking-1539…>'
---

Judge whether a specific optimization recorded by the Jules agent is **worth keeping** —
honestly, from the real code, not from the self-congratulatory comment. The slug to
evaluate is `{{args}}`.

The `.jules/` directory is **read-only for us** (owned by the Jules agent) and you are
only evaluating — do **not** edit `.jules/`, and do **not** touch the app code unless I
explicitly ask. The deliverable is a verdict, not a change.

Work through these steps:

1. **Locate the entry.** The slug is `<tool>/<description>-<bigid>` (e.g. `bolt/…`).
   The numeric id almost never appears in the repo — don't grep for it and give up.
   Instead map the description to a dated `##` heading in the matching `.jules/<tool>.md`
   (`bolt.md`, `janitor.md`, etc.) by keyword. Read that entry's **Learning** and
   **Action**.

2. **Read the actual code it touches — always.** Open the real source file and the
   exact lines, plus the inline `Bolt Optimization:` comment block if present. Judge the
   diff on its merits; the learning blurb routinely oversells what the code does.

3. **Test the premise: is this genuinely a hot path?** This is where most of these
   entries fall down. Be specific about firing frequency:
    - **Genuinely high-frequency:** `mousemove`, `scroll`, `resize`, a self-rescheduling
      `requestAnimationFrame` loop. Per-frame work here is real.
    - **NOT high-frequency (common false positive):** `IntersectionObserver` callbacks
      fire only when intersection state _changes_ and are coalesced by the browser —
      not per scroll frame. Setup/init code, `mouseenter`-style one-shots, etc.
      If the "hot path" isn't actually hot, the optimization is solving a non-problem.

4. **Check correctness and edge cases.** Does cached/persisted state stay correct?
   (e.g. `lastRenderX/Y` persisting across hover sessions, a cached `getBoundingClientRect`
   going stale on scroll/resize, a dirty-check that's secretly always true on the first
   frame). Confirm the change can't introduce a stale-value or skipped-update bug.

5. **Scrutinize the comment's claims — they're often technically wrong even when the
   change is fine:**
    - **"layout thrashing"** requires _interleaved DOM reads and writes_ forcing
      synchronous layout. A loop that only _writes_ (e.g. `transform`/`quickSetter`) with
      no reads is at most redundant style writes — not thrashing.
    - **`.forEach` → `for` "to avoid closure allocation":** one short-lived closure per
      call is negligible for V8's generational GC. Real only on truly hot paths, and even
      then marginal. `for...of` over a `Set` still allocates an iterator each call, so it
      doesn't cleanly "eliminate allocation" either.
    - **Writing an unchanged composited style** usually triggers no layout/paint, so
      "battery/CPU" savings are typically tiny.

6. **Weigh cost vs. benefit in absolute terms.** Two int compares + two cached vars is
   near-free, so a harmless micro-opt is fine to keep. But ask how often the path even
   runs (a hover preview over ~4 nav links has near-zero stakes either way), and whether a
   **higher-leverage alternative** exists (e.g. stop the rAF loop on idle instead of
   gating writes; drop the loop and write directly in `mousemove`).

7. **Deliver a clear verdict.** One of: **keep** (cheap, correct, real or harmless),
   **keep but overstated** (fine to leave; the comment's framing is inaccurate — say how),
   or **revert / not worth it** (no real benefit, adds complexity, or risks a bug). Back it
   with the concrete reasoning above. State explicitly that you changed nothing and why
   (`.jules/` is read-only; evaluation only).

Guiding test: _would this survive a senior review that asks "is this path actually hot,
is the claim physically true, and does the win justify the line?"_ — answer that, not
whether the optimization "sounds" reasonable.
