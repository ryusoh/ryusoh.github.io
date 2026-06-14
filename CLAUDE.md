# Project guide for AI agents

Static site (vanilla JS, no framework/modules). Frontend code lives in `js/`,
styles in `css/`, Jest tests in `tests/js/` (jest-environment-jsdom 29).

## Verify before committing

- `make precommit-fix` — auto-fixes formatting/lint and runs the full Jest suite + coverage. Run this before every commit; it must exit 0.
- `make check` — format-check + lint only (no tests). `make fix` — format + lint-fix.
- `npx jest <path>` — run a single suite while iterating.
- Do not commit unless explicitly asked.

## Writing/debugging Jest tests

Read `docs/testing-notes.md` first — dated jsdom/jest gotchas specific to this repo,
and add an entry when you hit a new one. Notably: throwing **getters** defined on
`window` are silently bypassed in this jsdom version — inject errors via
function-value mocks or setters instead.

(`.jules/testpilot.md` also contains test learnings, but it is auto-managed by the
Jules agent — read it for reference, do not hand-edit it.)

## Agent commands

Slash/custom commands are tracked under `.claude/commands/` (Claude) and
`.gemini/commands/` (Gemini). The rest of `.claude/` is gitignored.
