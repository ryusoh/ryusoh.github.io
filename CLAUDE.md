# Project guide for AI agents

Static site (vanilla JS, no framework/modules). Frontend code lives in `js/`,
styles in `css/`, Jest tests in `tests/js/` (jest-environment-jsdom 30).

## Verify before committing

- `make precommit-fix` — auto-fixes formatting/lint and runs the full Jest suite + coverage. Run this before every commit; it must exit 0.
- `make check` — format-check + lint only (no tests). `make fix` — format + lint-fix.
- `make test` — full Jest suite + coverage table on demand (same report as `npm test`).
- `npx jest <path>` — run a single suite while iterating.
- Do not commit unless explicitly asked.

## Writing/debugging Jest tests

Read `docs/testing-notes.md` first — dated jsdom/jest gotchas specific to this repo,
and add an entry when you hit a new one. The two that bite most: `window.location`,
`window.document`, and `location.href` are **non-configurable** under jsdom 26
(`delete`/`Object.defineProperty` throw) — mock via `history.pushState`, a long
`location.hash`, or a `vm` context; and throwing **getters** on `window` are
silently bypassed — inject errors via function-value mocks or setters instead.

Scratch experiments: `npx jest` only discovers tests under the repo (a `/tmp`
path matches nothing), so probe jsdom behavior with a temp `tests/js/_*.test.js`
file — that prefix is gitignored, so it won't be committed or left in the suite.

## Do not hand-edit `.jules/`

The entire `.jules/` directory (`architect.md`, `bolt.md`, `janitor.md`,
`palette.md`, `sentinel.md`, `testpilot.md`) is owned and auto-recorded by the
Jules agent (a separate Google tool). It is tracked in git but **read-only for us** —
read it for reference, never write to it. Capture our own learnings in `docs/`
instead.

## Agent commands

Slash/custom commands are tracked under `.claude/commands/` (Claude) and
`.gemini/commands/` (Gemini). The rest of `.claude/` is gitignored.
