# Project guide for AI agents

Static site (vanilla JS, no framework/modules). Frontend code lives in `js/`,
styles in `css/`, Jest tests in `tests/js/` (jest-environment-jsdom 30).

Tooling is **npm**-based: `package-lock.json` is authoritative and `make`/CI run via
`npx`. A `pnpm-lock.yaml` also exists but is secondary — it drifts from `package.json`
(dependency bumps update only `package-lock.json`) and is regenerated out-of-band by
Jules/bolt branches. Expect large-but-benign `pnpm-lock.yaml` diffs when shipping those;
confirm it matches `package.json` rather than assuming a regression.

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
instead. `.jules/` is excluded from our Prettier and markdownlint gates
(`.prettierignore`, `.markdownlintignore`), so a format/lint failure in a `.jules/`
file is expected — never "fix" it by editing the file.

Jules PRs occasionally commit **root-level scratch scripts** (e.g. `patch_*.js`,
`run_*.sh`) that it used to mutate test files in place. These fail eslint
(`require`/`no-undef` under the browser config) and break CI. When shipping a
Jules PR, drop them and keep only the genuine artifact (e.g. the new test file).

## Agent commands

Slash/custom commands are tracked under `.claude/commands/` (Claude) and
`.gemini/commands/` (Gemini). The rest of `.claude/` is gitignored.
