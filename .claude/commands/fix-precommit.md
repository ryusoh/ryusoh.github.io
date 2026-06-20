---
description: Fix make precommit-fix / quality-gate failures (formatting, lint, Jest) and get the suite green
argument-hint: '[optional: a specific failing file or test name to focus on]'
---

Get the commit gate green: fix whatever is making `make precommit-fix`, `make check`,
or the Jest suite fail. If `$ARGUMENTS` is non-empty, start with that file/test.

**Key gotcha first:** `make precommit-fix` ends with `|| true` and `git add -u`, so it
**always exits 0** and auto-stages — a clean-looking run can still hide failures. Do not
trust its exit code. The real signals are:

- `make check` — format-check + lint (prettier + eslint + stylelint). Deterministic.
- `make test` — the **full** Jest suite + coverage (`jest --coverage`). This is what
  catches test failures the gate's per-file `--findRelatedTests` hook misses.
- `make precommit` — the strict, no-`|| true` run of every hook across all files.

Work through these steps:

1. **Reproduce, don't guess.** Run `make check` and `make test`; capture output to a
   file (`make test > /tmp/t.log 2>&1`) so you can grep it. Note the failing suites and
   the exact error lines (`grep -E "✕|●|FAIL |Cannot|TypeError|Tests:" /tmp/t.log`).

2. **Diagnose against the known jsdom-26 / jest-30 traps** — these are the usual cause,
   and they are documented in `docs/testing-notes.md` (read it before inventing a fix):
    - `delete window.location`, `delete global.document`, or `Object.defineProperty` on
      `location` / `document` / `href` **throws** (they are non-configurable). Mock via
      `history.pushState` / `replaceState`, a long `location.hash`, or a `vm` context.
    - Assigning to `window.location.search` or `.href` emits a navigation "not
      implemented" console error; in a `beforeEach` it floods output and looks like
      a failure even when tests pass. Use the History API instead.
    - Throwing **getters** on `window` are silently bypassed — inject errors via
      function-value mocks or setters.

    Add a new dated entry to `docs/testing-notes.md` if you hit a trap not listed there.

3. **Fix at the right altitude.**
    - Prefer repairing the test with the correct pattern from step 2.
    - If a test is **broken _and_ redundant** with another that already covers the same
      branch (common when an agent adds a "without vm" variant of a guard test), delete
      the broken one — note the equivalent test that preserves coverage.
    - **Never edit `.jules/`** (read-only, Jules-owned; see `CLAUDE.md`). If a failure is
      a format/lint issue inside `.jules/`, it should already be excluded via
      `.prettierignore` / `.markdownlintignore` — fix the exclusion, not the file.
    - A giant `pnpm-lock.yaml` diff is usually benign drift, not a regression (see
      `CLAUDE.md`); confirm it matches `package.json` rather than reverting it.

4. **Re-verify, and don't chase ghosts.** Re-run `make check` and `make test`. If a suite
   fails once but passes on re-run (e.g. a slow `block-navigation` run), it's a **flake**,
   not your bug — run `make test` 2–3× to confirm before spending tokens on it; report it
   as a heads-up rather than "fixing" it.

5. **Confirm the gate.** End on `make precommit-fix` exit 0 with every hook `Passed`, a
   clean `make check`, and a green full `make test`.

6. **Report & stop.** Summarize the root cause, the fix, and any flake/heads-up. **Do not
   commit** unless explicitly asked (project rule in `CLAUDE.md`); leave changes staged
   and say so.
