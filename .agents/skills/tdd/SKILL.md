---
name: tdd
description: Test-driven development. Use when the user wants to build features or fix bugs test-first, mentions "red-green-refactor", or wants integration/acceptance tests.
---

# Test-Driven Development

Goal: a red → green loop that leaves behind tests worth keeping — tests that
read like a specification and survive refactors. Read `docs/testing-notes.md`
first so test names, jsdom seams, and domain vocabulary match this repo.

## Where TDD pays off here

Strongest on **frontend logic**, **loader/asset handling**, **service worker
caching (`sw.js`)**, and **acceptance flows** (`tests/js/acceptance/`):
deterministic input → output with clean seams. For visual work (canvas/WebGL
ambient effects in `js/ambient/`, page transitions, cursors, layout styling), a
green test is necessary but not sufficient — follow `AGENTS.md` "Visual
changes".

Watch jsdom/Jest blind spots (`docs/testing-notes.md`): `window.location` is
non-configurable, `vm`-context timer mocking differs, and throwing getters on
`window` are silently bypassed.

Loop with `npx jest <path/to/test>` (fast, silent) and `make type`
(`npx tsc -p jsconfig.json` on whitelisted files); use `tests/js/_*.test.js`
(gitignored) for scratch experiments; finish with `make test` and `make gate` /
`make precommit-fix`.

## Good tests

- Assert observable output through public interfaces — a DOM attribute, event
  emission, returned state, or service worker cache response.
- Take expected values from an independent source of truth (a worked example, a
  known-good literal, the spec), so the test can disagree with the code.
- Mock at the system boundary; prefer real fixtures (captured HTML/JSON stubs,
  synthetic gallery `p99`) for collaborators the repo owns.

## Seams

A seam is the public boundary you test at. Before writing tests, propose the
seams under test and agree them with the user ("What's the public interface,
and which seams matter?") so effort lands on critical paths. Acceptance tests
(`tests/js/acceptance/**`) exercise only the public surface: real events in,
observable page effects out, with no internal hooks or source rewriting.

## The loop

Work in vertical slices: one seam → one failing test → the minimal code that
passes it → repeat. Each slice is a tracer bullet; writing all tests up front
verifies imagined behaviour. Refactoring happens in review (`/code-review`)
after the loop.

Smells to correct: tests that break on a refactor with unchanged behaviour
(coupled to internals), and assertions that recompute the expected value the
way the code does (tautological).

## Resume protocol

After an interruption or compaction: `git status --short`,
`git log -n 3 --oneline`, and the scoped test run show the real state. State
the current slice, its failing assertion, and the minimal implementation target
before editing.
