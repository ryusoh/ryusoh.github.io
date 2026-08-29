# Gate internals

Implementation detail and day-one measurements for the repository's preventive
gates. The binding rules still live in `AGENTS.md`; this doc is the reference
for how each gate is wired and why.

## Dependency-structure gate (`make depcheck`)

`make lint` runs `make depcheck`, which runs dependency-cruiser over `js/` and
`sw.js` with the rules in `.dependency-cruiser.cjs`:

- No circular dependencies (severity: `error`).
- No cross-subproject imports (this repo has only one JS surface, so the rule
  is preventive).
- Production source never imports test files.

This repo has no path aliases (no `jsconfig.json` `paths`, no import map), so
alias resolution is handled by an empty webpack-config stub at
`.dependency-cruiser.webpack.cjs`. If aliases are ever introduced, add them to
that stub — never via `options.tsConfig`, which makes dependency-cruiser look
for a TypeScript <7 compiler and prints a spurious
"missing-typescript-transpiler" warning (this repo uses TypeScript v7).

Vendor code (`js/vendor/`, `*.min.js`) is excluded from the graph, mirroring
`AGENTS.md` non-negotiable #5: third-party code is not ours to police.

The same check also runs as the `dependency-cruiser` pre-commit hook in
`.pre-commit-config.yaml`.

## Stream-of-consciousness gate (`make thinking-check`)

`make thinking-check` runs `scripts/check-thinking-comments.js`, a deterministic
scan of all git-tracked JS/CSS sources enforcing `AGENTS.md` non-negotiable #9.
It looks for:

1. Thinking-out-loud comments (mid-write interjections, coverage-chasing notes,
   etc.) matched by an anchored regex over comment text.
2. Abandoned test bodies — `it()`/`test()` calls whose callback contains only
   whitespace or comments.

Python scripts (`tools/sync_commands.py`, `scripts/sync_commands.py`) are out of
scope because the repo has no Python test suite and the script is stdlib-only
Node.

The same script runs as the `thinking-check` pre-commit hook in
`.pre-commit-config.yaml`.

## Bot PR hygiene gate (`make bot-pr-check`)

`make bot-pr-check` runs `tools/check_bot_pr_hygiene.py`, a deterministic check
over every commit authored by `google-labs-jules[bot]` in
`origin/master..HEAD` (falling back to `origin/main`). It enforces
`AGENTS.md` non-negotiable #10/11 by failing bot-authored commits that:

- change no files (empty commit),
- touch a file with zero content lines (placeholder/dummy-file pattern), or
- delete lines from a test file — bot lanes are append-only in tests.

Test paths covered: `tests/` directories, `__tests__/` directories,
`test_*.py`, and `*.test.js`. Human-authored commits are skipped.

CI runs the same check in the "Reject bot PR hygiene violations" step of
`.github/workflows/ci.yml`. The checkout uses `fetch-depth: 0` so the branch
commits are visible behind the merge commit; a shallow checkout would silently
no-op the check.

## Coverage floor and CI coverage report

`make test` runs `jest --coverage`. The whole-suite coverage floor is defined in
`jest.config.cjs`:

| metric     | floor | measured baseline (2026-07-26) |
| ---------- | ----- | ------------------------------ |
| lines      | 87    | ~87.2                          |
| statements | 87    | ~87.3                          |
| functions  | 90    | ~90.3                          |
| branches   | 80    | ~80.9                          |

The floor is a ratchet: raise it as coverage improves; never lower it.

CI runs the full suite via `npm test -- --coverageReporters=json-summary
--coverageReporters=text` (never a bare `npx jest` — that once silently dropped
the coverage report). The `jest-related` pre-commit hook is skipped in CI
(`SKIP=jest-related`) because scoped `--findRelatedTests --coverage` runs print
misleading partial tables and spurious threshold errors.

A "Verify coverage report exists" step fails the build if
`coverage/coverage-summary.json` is missing, guarding against someone removing
`--coverage` from the test command.

## Complexity ratchet

`make lint-js` gates cyclomatic complexity with ESLint's `complexity` rule at a
maximum of 20. Legacy violations are baselined in `eslint-suppressions.json`
(currently empty for this repo). Any **new** or worsened violation fails the
gate; shrink the baseline with `npx eslint --prune-suppressions` after a fix.

Never raise the ceiling or hand-edit `eslint-suppressions.json`.

## Mutation testing (non-blocking)

`make mutate-js` runs StrykerJS using `stryker.config.json`. It is
**informational only** and is not part of `make lint`, `make check`,
`make precommit`, or CI. The weekly `.github/workflows/mutation.yml` run uses
`continue-on-error: true`, and `thresholds.break` is `null` in the Stryker
config.

- Scope: `js/**/*.js` and `sw.js`, excluding `js/vendor/**`, `*.min.js`, and
  `js/block-navigation.js`.
- `coverageAnalysis` is `off` because jsdom does not report per-test coverage to
  Stryker; `enableFindRelatedTests` still lets tests kill mutants.
- Incremental results are cached in `reports/stryker-incremental.json`
  (gitignored).

A low kill ratio is a signal to write stronger assertions, never a merge
blocker.
