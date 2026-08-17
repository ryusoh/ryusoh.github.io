# AGENTS.md

Single source of truth for agent guidance on this repo — **edit this file, not
`CLAUDE.md`** (that is a stub that imports this one). Slash-command workflows
live in `.agents/skills/<name>/SKILL.md` (canonical — the open Agent Skills
format); `.claude/commands/` is generated from it by `tools/sync_commands.py`,
and the gate drift-checks it via `make sync-check`.

## Two audiences (do not mix these up)

- **Unattended Jules routines** (`.jules/` personas): these bots run without a
  human in the loop and open PRs. A human only does a binary approve/close on the
  result — they will **not** leave review comments or iterate with you. So every
  PR must be self-evidently correct and approvable at a glance. Optimize for
  **approve rate**, not for volume. The sections from "Non-negotiables" through
  "Lanes" are binding on Jules routines.
- **Interactive coding agents** (Claude Code, Kimi, Antigravity, etc.): you work
  directly with the user in a chat session. The project conventions below still
  apply, but the Jules-only **PR/branch/lane restrictions do not**. You may edit
  build files, Makefiles, configs, dependencies, and even `.jules/` persona files
  (no explicit permission needed — the user reviews the result; see the editing
  rules below). You may commit to `master` or open PRs as directed by the
  user. Do not invent Jules-style lane boundaries for normal interactive
  work — if the user asks you to change something, change it.

This repo is `ryusoh.github.io`: a static, vanilla-JS/CSS personal site served by
GitHub Pages. **No framework, no build step, no bundler** — pages load plain
`<script>` tags. Frontend code lives in `js/`, styles in `css/`, the service
worker is `sw.js`, and Jest tests live in `tests/js/`. There is **no server, no
Python pipeline, no Cloudflare worker, and no generated `data/`.**

Tooling is **npm**-based: `package-lock.json` is authoritative and `make`/CI run
via `npx`. A `pnpm-lock.yaml` also exists but is secondary — it drifts from
`package.json` (dependency bumps update only `package-lock.json`) and is
regenerated out-of-band by Jules/bolt branches. Expect large-but-benign
`pnpm-lock.yaml` diffs when shipping those; confirm it matches `package.json`
rather than assuming a regression.

## Non-negotiables (a PR that violates any of these will be closed)

1. **Open a PR only if `make precommit-fix` is green.** It runs the CI gate —
   Prettier, ESLint, Stylelint, the JS strict type check (`tsc`), and the full
   Jest suite + coverage — and must exit 0. Red = don't open it. And don't rerun
   a red gate on an unchanged tree — a failed gate over an untouched worktree
   cannot go green, so edit something first. `node scripts/gate-guard.js`
   enforces this: `snapshot` before the run, `check <hash>` before a retry
   (exit 1 = unchanged).
2. **One concern, smallest possible diff.** No drive-by edits, no scope creep.
   Diff size is inversely proportional to approval — keep it tiny.
3. **Stay in your lane** (see "Lanes" below). If two routines touch the same files,
   one PR gets closed. Don't fix something another lane owns.
4. **Don't commit to `master`.** Branch off `master`, open a PR.
5. **Don't hand-edit third-party/minified code** (`js/vendor/` or any `*.min.js`).
   Its TODOs and complexity are not ours.
6. **Page-scoped changes must not leak to other pages.** The image-heavy portfolio
   pages (`p1/`–`p4/`) share components (block-navigation, ambient, page-transition);
   a change for one must not regress the others.
7. **Don't write a command/example you haven't actually run this session.** Verify
   behaviour; don't infer it from a name or a `case` label.
8. **Check open and recently-closed PRs before you start, and don't repeat them.**
   Run `gh pr list --state all --limit 30` (and read the recent ones). A closed PR
   was closed for a reason; an open one already claims that work. Resubmitting
   similar work wastes the run and gets closed. Pick something new.
9. **No stream-of-consciousness in the diff.** Your reasoning stays out of
   committed code: no thinking-out-loud comments ("Wait, ...", "Ah, ..."), no
   abandoned stub test bodies. If an approach fails mid-write, delete the
   attempt — don't commit the trail. Code comments state facts about behaviour.
   Enforced deterministically by `make thinking-check`
   (`scripts/check-thinking-comments.js`) over all tracked JS/CSS sources; also
   a blocking pre-commit hook.

## You cannot see the rendered page

Unit tests **cannot** observe a color, a transparent edge, a misaligned element,
an animation, or a layout. The ambient canvas/WebGL effects, cursor, and
page transitions are **purely visual**. Therefore:

- **Never claim visual parity, "matches/exceeds," or that something "looks good."**
  You have no eyes. Aesthetic quality is the human's call, not yours.
- For any change whose payoff is visual (animation, lighting, spacing, color,
  cursor, transitions), either (a) restrict yourself to **objectively verifiable**
  facts (an `aria-label` present, a contrast ratio, a DOM attribute, a passing
  test), or (b) open the PR as **draft** and state plainly "visual review required
  by a human."

## The PR body must carry its own proof

Make the approve decision take ten seconds. Every PR description must include:

- **What & why** — one or two sentences.
- **Lane** — which routine/lane this is.
- **Verification** — the exact command(s) you ran and their result, pasted:
    - `make precommit-fix` → green, or
    - the scoped proof for your lane (e.g. a before/after measurement; coverage on
      file X went 72% → 100%).
- **Visual?** — "no visual surface" or "visual — human review required (draft)."

A PR with no pasted verification output reads as unverified and will be closed.

## Changed lines must be covered

The repo targets high (ideally 100%) coverage and Jest runs with `--coverage`.
There is no machine diff-coverage gate, so this is on your honour:

- If your change adds or alters runtime behaviour (a bug fix, a security fix, a
  behavioural change), **ship a test that fails before and passes after**, covering
  the changed lines.
- Behaviour-preserving changes (refactors, dead-code removal) need no new test —
  keep the existing suite green and coverage un-regressed.

## Commit and PR-title conventions

Commits follow **Conventional Commits**, matching this repo's existing history.
The squash-merge uses the PR title as the commit subject, so the **PR title must
also be a valid Conventional Commit subject**.

- Format: `type(scope): summary`
    - **type** ∈ `feat`, `fix`, `refactor`, `perf`, `test`, `docs`, `chore`,
      `build`, `ci`.
    - **scope** — optional, lower-case, the affected area (`ambient`, `nav`,
      `sw`, `transition`, `a11y`, `deps`, …).
    - **summary** — imperative mood, lower-case, no trailing period, ≤ 72 chars.
- **No emoji, and no routine-name prefix in the subject** (no `Bolt:`,
  `Sentinel:`, no `⚡`). Routine attribution rides on the
  `Co-authored-by: google-labs-jules[bot]` trailer — keep the subject clean.
- **Body** (when the change isn't self-evident): wrap at ~72 cols, explain _what
  and why_, not how. State severity, metrics, or measurements here — not in the
  subject.
- One logical change per commit.

Examples: `perf(ambient): hoist metrics() out of the rAF loop` ·
`refactor(loader): extract helpers to cut initLoader complexity` ·
`test(page-transition): cover navigate() control-character paths`.

## Command interface — prefer `make` (matches CI)

| Need                                               | Command                                  |
| -------------------------------------------------- | ---------------------------------------- |
| Full gate (format + lint + type + Jest + coverage) | `make precommit-fix`                     |
| Format-check + lint + type only (quick CI parity)  | `make check`                             |
| Auto-fix format + lint                             | `make fix`                               |
| Full Jest suite + coverage report                  | `make test`                              |
| Scoped JS test (fast, while iterating)             | `npx jest <path/to/test>`                |
| Lint JS / CSS individually                         | `make lint-js` / `make lint-css`         |
| JS strict type check (whitelist)                   | `make type` / `npx tsc -p jsconfig.json` |
| Generated-commands freshness check                 | `make sync-check`                        |
| Dependency-structure gate (no circular imports)    | `make depcheck`                          |
| Stream-of-consciousness scan (comments, tests)     | `make thinking-check`                    |
| Mutation testing (non-blocking; not in any gate)   | `make mutate-js`                         |
| Synchronize portfolio pages from shell template    | `make sync-pages`                        |
| Check portfolio pages template synchronization     | `make sync-pages-check`                  |
| Build/compile a portfolio page from markdown       | `make page ID=pN`                        |
| Build responsive AVIF/WebP gallery tiers           | `make images`                            |
| Generate ThumbHash blur-up placeholders            | `make thumbhashes`                       |

- Use scoped `npx jest <file>` for the tight edit→verify loop; run
  `make precommit-fix` before opening the PR.
- **Workflow action versions** — when bumping a GitHub Actions pin in
  `.github/workflows/`, verify the major-version tag exists
  (`gh api repos/<owner>/<repo>/git/refs/tags/v<N>`). Major-version tags are
  not guaranteed for every action; a missing tag breaks CI.
- **Complexity ratchet** — `make lint-js` also gates cyclomatic complexity:
  ESLint `complexity` errors above 20 with `eslint-suppressions.json`
  baselining the legacy violations (any NEW or worsened one fails; shrink the
  baseline with `npx eslint --prune-suppressions`). Never raise the ceiling or
  hand-edit the suppressions file.
- **Coverage floor (ratchet)** — `make test` fails when whole-suite coverage
  drops below `coverageThreshold.global` in `jest.config.cjs`. Raise the floor
  as coverage improves; never lower it.
- **CI coverage report is guarded** — web-ci's "Run Jest tests" step runs the
  full suite via `npm test` (never a bare `npx jest` — that once silently
  dropped the report), and a "Verify coverage report exists" step fails the
  build if `coverage/coverage-summary.json` is missing. The `jest-related`
  pre-commit hook is skipped in CI (`SKIP=jest-related`): scoped
  `--findRelatedTests --coverage` runs print misleading partial tables
  (unexecuted files at 0%) and spurious threshold errors.
- **Dependency-structure gate** — `make lint` also runs `make depcheck`
  (dependency-cruiser): circular imports fail as errors. Rules live in
  `.dependency-cruiser.cjs`. If import aliases are ever introduced
  (`jsconfig.json` `paths` or an import map), resolve them in
  `.dependency-cruiser.webpack.cjs`, never `options.tsConfig` — the repo has
  typescript v7 and the tsConfig route prints a spurious
  "missing-typescript-transpiler" warning on every run.
- **Mutation testing is deliberately non-blocking** — `make mutate-js`
  (StrykerJS, incremental, cache in gitignored `reports/`) measures assertion
  strength but is **not** in `make lint`/`check`/`precommit` or the CI gate;
  `thresholds.break` is `null` in `stryker.config.json` and the weekly
  `.github/workflows/mutation.yml` run is `continue-on-error`. A low kill
  ratio is a signal to write stronger assertions, never a merge blocker.
- **Jest runs silent** — `console.log` prints nothing. Before debugging an odd or
  flaky JS test, read `docs/testing-notes.md` — it documents dated jsdom/jest
  gotchas specific to this repo (non-configurable `window.location`, silently
  bypassed throwing getters, `vm`-context timer mocking, and more).
- `make type` runs `tsc -p jsconfig.json` strictly over a small, incrementally
  growing whitelist (`include` in `jsconfig.json`) — see
  `docs/js-typing-strategy.md`. It's blocking, but only for whitelisted files;
  everything outside the whitelist is unchecked.
- Scratch experiments go in a `tests/js/_*.test.js` file — that prefix is
  gitignored, so it won't be committed or left in the suite.
- Before touching or adding a test in a large suite (e.g.
  `page-transition.test.js`, 100+ tests), `grep` the file for the
  function/branch name first. These suites often already cover the path you're
  about to test, sometimes via a non-obvious pattern — e.g.
  `loadInstrumentedScript()` in `page-transition.test.js` rewrites
  `location.assign` calls to a mockable stub at load time instead of fighting
  jsdom's non-configurable `Location`. Finding that pattern up front beats
  rediscovering it after a few failed mocking attempts.

## Layout

- `js/` — frontend scripts loaded via plain `<script>` tags (no modules/bundler).
  `js/ambient/` = canvas/WebGL ambient effects; `js/loader/` = asset/CDN/font
  loaders; `js/vendor/` = third-party (don't touch); `js/config.js` = tunables;
  `js/types/*.d.ts` = type-only ambient declarations for `tsc --checkJs`
  (never shipped).
- `sw.js` — the service worker (caching + fetch handling).
- `jsconfig.json` — the `tsc --checkJs` strict-mode whitelist; see
  `docs/js-typing-strategy.md` before touching it.
- `css/` — stylesheets.
- `p1/`–`p4/`, `index.html` — static page entries; the `p*` pages are
  image-heavy portfolio galleries generated from `assets/img/p*/index.md`
  via canonical template `scripts/templates/portfolio-shell.html`.
- `scripts/templates/portfolio-shell.html` — canonical shell for all `p*/index.html`
  galleries. Any added scripts, styles, or header/dock changes must be made
  here, followed by `make sync-pages`.
- `tests/js/**` — Jest (jsdom) tests. `tests/js/acceptance/**` — the acceptance
  stream: user-facing behaviours phrased in domain language, exercised only
  through the public surface (real events in, observable page effects out; no
  internal hooks, no source rewriting). `docs/` — repo knowledge; **read
  `docs/testing-notes.md` before deep test work.**
- `scripts/run-npx.sh` — the `make`/CI npx wrapper. `tools/sync_commands.py` —
  skill/command sync (see "Skills and slash commands" below).
- `scripts/` & `tools/` — shared repository tooling (`scripts/gate-guard.js`,
  `scripts/check-thinking-comments.js`, `scripts/coverage-rank.js`,
  `tools/sync_commands.py`, page generators). Standalone CLI tools and scripts
  referenced across agent docs and skills are verified by Jest tests
  (`tests/js/doc-tool-references.test.js`).

## Skills and slash commands

- **`.agents/skills/<name>/SKILL.md` is canonical** — the open Agent Skills
  format: YAML frontmatter declaring `name` and `description` (used for
  triggering), instructions in the markdown body. Edit skills there.
- **Progressive disclosure** — only the frontmatter `name` + `description` are
  always loaded into an agent's context; the body is read on demand once the
  skill triggers. So the `description` is the only always-loaded surface: write
  it as a discriminative trigger ("Use when ..."), and don't contort the body to
  save prompt space — length there is free until the skill fires.
- **`.claude/commands/<name>.md` is generated** from the skills by
  `tools/sync_commands.py` for Claude Code. Never edit the generated files by
  hand — run `python3 tools/sync_commands.py` after editing a skill, and note
  that `make sync-check` (wired into `make precommit`/`precommit-fix`) fails if
  regeneration is not a no-op.
- **Jules scheduled routines (unattended)** are a separate system from the
  interactive skills above: their shared contract is this file and their
  per-routine personas live in `.jules/<name>.md`.

## Lanes (keep PRs disjoint to avoid collisions)

| Routine   | Owns                                                                         | Must NOT touch                                                                                                                                                                              |
| --------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Architect | cyclomatic-complexity / readability refactors (behaviour-preserving)         | error-handling, security, tests, features                                                                                                                                                   |
| Sentinel  | security + error-handling (empty catches, client-side DoS, unsafe DOM sinks) | complexity refactors, features                                                                                                                                                              |
| Janitor   | dead code, stale deps, real TODOs only                                       | complexity, error-handling (Architect/Sentinel own those); shared tooling and agent infrastructure (`scripts/`, `tools/`, `bin/`, `.agents/`, `.jules/`, `.github/`, root docs, `Makefile`) |
| Bolt      | one measurable performance/efficiency win per run                            | complexity-only refactors, security, dead code, features                                                                                                                                    |
| Testpilot | test-only additions/coverage, no prod-code change                            | `js/` prod files, `sw.js`                                                                                                                                                                   |
| Palette   | accessibility, UX, semantic HTML/CSS                                         | JS runtime logic, security, tests, performance                                                                                                                                              |
| Typist    | JS strict-type annotations (JSDoc) + whitelist expansion, no logic change    | runtime behaviour                                                                                                                                                                           |

If your finding belongs to another lane, **skip it** — that lane will get it.

> **Note on enforcement:** cyclomatic complexity is machine-gated — ESLint's
> `complexity` rule errors above 20, with `eslint-suppressions.json`
> baselining the legacy violations (see "Complexity ratchet" above). Coverage
> has a **whole-suite floor** — the `coverageThreshold.global` ratchet in
> `jest.config.cjs` (raise it as coverage improves, never lower it) — but no
> per-diff gate, so Testpilot's targets beyond the floor remain
> judgment-guided: your real gate there is a green `make precommit-fix` plus
> the scoped proof your lane requires.

## `.jules/` personas — editing rules

The files in `.jules/<name>.md` are **persona definitions** for the unattended
Jules routines: they encode identity, lane, and constraints, read at the start of
an unattended run. They are **not logs**.

- **Unattended Jules routines** must treat `.jules/` as read-only. They may **not**
  append to, modify, or create files under `.jules/`. A PR from a Jules routine
  that changes a `.jules/` file is out of scope and will be closed.
- **Interactive coding agents** (Claude Code, Kimi, Antigravity, etc.) **may**
  edit `.jules/` persona files whenever they spot a harness bug or unclear
  guidance — no explicit user direction needed; the user reviews the result.
  The change must still be a single-concern PR or direct commit with a green
  `make precommit-fix`, and the agent must note in the commit/PR body that the
  edit is to a persona file.

Capture durable learnings in this file or `docs/` instead of leaving the persona
files as the only source of truth. `AGENTS.md` itself **is** gated, so keep it
Prettier/markdownlint-clean (mind `**`-glob/bold collisions inside backticks).

Jules PRs occasionally commit **root-level scratch scripts** (e.g. `patch_*.js`,
`run_*.sh`) that it used to mutate test files in place. These fail eslint
(`require`/`no-undef` under the browser config) and break CI. When shipping a
Jules PR, drop them and keep only the genuine artifact (e.g. the new test file).

## Working rules (interactive agents)

- Work directly on `master`. **Commit/push only when explicitly asked.**
- **Don't write a command or example into docs/code that you haven't actually
  run this session.** Verify it first — don't infer behaviour from a name or a
  `case` label.
- **The user commits reviewed changes themselves.** The user's work pattern is:
  back-and-forth in chat → they review the diff in VSCode → they commit it
  themselves and move on. So if your edits vanish from `git status` between
  turns, run `git log --oneline -3` FIRST — a fresh user commit containing them
  means the work was accepted. Don't re-verify, re-explain, or dig into "where
  did my changes go"; check the log once and continue from HEAD.
- **Don't revert a CSS value the user has explicitly set** (font size, position,
  spacing) to match a reference or an earlier state unless the user asks. If
  they change it by hand, keep their value.
- The social icons dock (`.social-icons-desktop`) is fixed at the viewport
  top-right across both desktop and mobile using safe-area insets. On mobile,
  `#main h1` has right padding to ensure "Zhuang Liu" never collides with the
  dock on narrow screens.
- **Gallery vertical spacing (`--gallery-block-gap`)**: Gallery spacing across
  images, blockquotes, and content blocks is centralized in `:root` via
  `--gallery-block-gap` in `css/style.css`. Always keep margins on the outer
  block containers (`.post-content > div[align='center']`, `.image-container`,
  `article blockquote`, `.post-content p`) with `0` margin on inner `<picture>`
  / `<img>` elements so that CSS margin collapsing remains uniform across
  elements with `content-visibility: auto` containment.
- **Concurrent agents sharing one worktree.** When you run parallel subagents
  (swarms, background agents) in this checkout: stage only files you changed
  (`git add <specific-files>`, never `git add -A`), never `git stash`,
  `git reset --hard`, or `git commit --no-verify` — a sibling agent's work may
  be sitting in the same tree. Keep concurrent agents on disjoint file sets; if
  a rebase/conflict lands mid-run, resolve only files your task owns. Note that
  `make precommit-fix` itself ends with `git add -u`, which stages **all**
  tracked modifications including a sibling's — another reason to keep file
  sets disjoint.
