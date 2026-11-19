---
name: fix-precommit
description: Fix make precommit-fix / quality-gate failures (formatting, lint, Jest) and get the suite green
argument-hint: '[optional: a specific failing file or test name to focus on]'
---

Get the quality gate green: fix whatever is failing `make precommit-fix`,
`make gate`, `make check`, or the Jest suite. If `{{args}}` is non-empty, start
with that file or test.

## Gate signals

- `make gate` — CI parity (`make check` + `make test`), without auto-fix or
  staging (safe alongside foreign uncommitted work).
- `make check` — format-check + lint (ESLint/Stylelint/markdownlint/depcheck) +
  `tsc` + `sync-check` + `sync-pages-check` + `thinking-check` +
  `bot-pr-check`.
- `make test` — full Jest suite + coverage floor (`jest --coverage`).
- `make precommit-fix` — runs pre-commit auto-fixes, stages tracked files via
  `git add -u`, re-runs hooks check-only (`SKIP=jest-related`), then runs
  `npm test` (details: `docs/gates.md`).
- **CI pre-commit logs:** inspect `gh pr checks <N>` →
  `gh run view --job <id> --log` and anchor on the hook whose status line says
  `Failed` (the `jest-related` hook uses `--coverageThreshold="{}"` and
  `set -o pipefail`, so a non-zero exit is a real test failure).

## Steps

1. **Reproduce deterministically.** Run `make check` and capture `make test`
   (`make test > /tmp/t.log 2>&1`, then
   `grep -E "✕|●|FAIL |Cannot|TypeError|Tests:" /tmp/t.log`).
2. **Check known jsdom-26 / jest-30 traps (`docs/testing-notes.md`):**
    - `delete window.location`, `delete global.document`, or
      `Object.defineProperty` on `location`/`document`/`href` throws
      (non-configurable). Mock via `history.pushState`/`replaceState`,
      `location.hash`, or a `vm` context.
    - Assigning to `window.location.search` or `.href` logs a navigation "not
      implemented" error that floods output; use the History API instead.
    - Throwing getters on `window` are silently bypassed — inject errors via
      function-value mocks or setters.
    - Add a new dated entry to `docs/testing-notes.md` for any unlisted trap.
3. **Fix at the right altitude.**
    - Repair the test with the right jsdom pattern from step 2.
    - Remove a broken test that duplicates another test already covering the
      same branch (cite the equivalent test preserving coverage).
    - Expect benign `pnpm-lock.yaml` drift during dependency bumps — confirm it
      matches `package.json` (`package-lock.json` is authoritative per
      `AGENTS.md`).
4. **Separate flakes from bugs.** Re-run `make check` and `make test`. If a
   suite fails once and passes on 2–3 re-runs (e.g. a slow `block-navigation`
   run), report it as a flake rather than churning code.
5. **Confirm the gate.** End with `make gate` green (or `make precommit-fix`
   exit 0 with every hook `Passed` when no foreign uncommitted work is in the
   tree).
6. **Report and stop.** Summarize root cause, fix, and any flake. Commit only
   when explicitly asked (`AGENTS.md`).
