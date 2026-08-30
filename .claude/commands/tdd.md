---
description: Test-driven development. Use when the user wants to build features or fix bugs test-first, mentions "red-green-refactor", or wants integration/acceptance tests.
---

# Test-Driven Development

TDD is the red → green loop. This skill is the reference that makes that loop
produce tests worth keeping: what a good test is, where tests go, the
anti-patterns, and the rules of the loop. Consult it before and during the loop.

Before exploring, read `docs/testing-notes.md` so test names, jsdom gotchas, and
interface vocabulary match this repo's domain language.

## Where this fits in `ryusoh.github.io` — and where it does NOT

TDD earns its keep on **frontend logic**, **loader/asset handling**, **service worker caching (`sw.js`)**, and **acceptance flows** (`tests/js/acceptance/`) — deterministic input→output code with clean seams.

It is **weak on this repo's visual surfaces.** Canvas/WebGL ambient effects (`js/ambient/`), page transitions, cursors, and layout styling are purely visual. Unit tests cannot observe visual color, smooth movement, or CSS layout correctness. Don't write a passing Jest test and claim a visual change works. A passing test is necessary, not sufficient, here.

Watch the **jsdom/jest blind spots**: `window.location` is non-configurable in jsdom, timer mocking can behave differently under `vm` contexts, and throwing getters can be silently bypassed. Read `docs/testing-notes.md` before debugging tricky Jest test failures.

## Test runners

- Scoped JS, tight edit→verify loop: `npx jest <path/to/test>` (silent, fast).
- Whitelisted strict type check: `make type` or `npx tsc -p jsconfig.json`.
- Full suite before declaring done: `make test` (full Jest + coverage); `make precommit-fix` for the full CI gate.
- Scratch experiments: use a `tests/js/_*.test.js` file (gitignored).

## What a good test is

Tests verify behavior through public interfaces, not implementation details. Code
can change entirely; tests shouldn't. A good test reads like a specification —
"navigates to portfolio page on block click" — and survives refactors. In practice here:

- **Assert on observable output**, not internal structure: a DOM attribute, event emission, returned state, or service worker cache response — not a private helper.
- **Expected values come from an independent source of truth** — a worked example, a known-good literal, the spec — never recomputed the way the code computes them.
- **Mock at the boundary, not the internals.** Prefer real fixtures (e.g. captured HTML/JSON stubs) over mocking a collaborator you own.

## Seams — where tests go

A **seam** is the public boundary you test at: where you observe behavior without
reaching inside. **Test only at pre-agreed seams.** Before writing any test, write
down the seams under test and confirm them with the user — you can't test
everything, and agreeing seams up front is how effort lands on critical paths and
complex logic. Ask: "What's the public interface, and which seams should we test?"

For acceptance tests (`tests/js/acceptance/**`), test through the public surface (real events in, observable page effects out; no internal hooks, no source rewriting).

## Anti-patterns

- **Implementation-coupled** — mocks internal collaborators, tests private methods, or verifies through a side channel. Tell: breaks on refactor though behavior is unchanged.
- **Tautological** — the assertion recomputes the expected value the way the code does (`expect(calc(a,b)).toBe(a+b)`, a hand-derived snapshot), so it can never disagree with the code.
- **Horizontal slicing** — all tests first, then all implementation. Bulk tests verify _imagined_ behavior and go insensitive to real changes. Work in **vertical slices**: one test → one implementation → repeat, each a tracer bullet.

## Rules of the loop

- **Red before green.** Failing test first, then only enough code to pass it. No speculative features.
- **One slice at a time.** One seam, one test, one minimal implementation per cycle.
- **Refactoring is not part of the loop.** It belongs to review — run `/code-review` after the red → green cycle, not during it.

## Resume protocol

When resuming an in-progress TDD loop or recovering from context compaction:

1. **Never trust conversation memory** for slice progress.
2. **Inspect authoritative state**:
    - Run `git status --short` and `git log -n 3 --oneline`.
    - Run the scoped test suite to observe red/green status directly.
3. **Re-anchor the loop**: State the current slice, active failing test assertion, and minimal implementation target before editing code.
