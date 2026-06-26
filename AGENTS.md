# AGENTS.md

Shared operating contract for **automated agents** (Jules scheduled routines) on
this repo. You run unattended and open PRs. A human only does a binary
approve/close on the result — they will **not** leave review comments or iterate
with you. So every PR must be self-evidently correct and approvable at a glance.
Optimize for **approve rate**, not for volume.

This repo is `ryusoh.github.io`: a static, vanilla-JS/CSS personal site served by
GitHub Pages. **No framework, no build step, no bundler** — pages load plain
`<script>` tags. Frontend code lives in `js/`, styles in `css/`, the service
worker is `sw.js`, and Jest tests live in `tests/js/`. There is **no server, no
Python pipeline, no Cloudflare worker, and no generated `data/`.** Human-facing
detail lives in `CLAUDE.md` and `docs/`.

## Non-negotiables (a PR that violates any of these will be closed)

1. **Open a PR only if `make precommit-fix` is green.** It runs the CI gate —
   Prettier, ESLint, Stylelint, and the full Jest suite + coverage — and must
   exit 0. Red = don't open it.
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

| Need                                        | Command                          |
| ------------------------------------------- | -------------------------------- |
| Full gate (format + lint + Jest + coverage) | `make precommit-fix`             |
| Format-check + lint only (quick CI parity)  | `make check`                     |
| Auto-fix format + lint                      | `make fix`                       |
| Full Jest suite + coverage report           | `make test`                      |
| Scoped JS test (fast, while iterating)      | `npx jest <path/to/test>`        |
| Lint JS / CSS individually                  | `make lint-js` / `make lint-css` |

- Use scoped `npx jest <file>` for the tight edit→verify loop; run
  `make precommit-fix` before opening the PR.
- **Jest runs silent** — `console.log` prints nothing. Before debugging an odd or
  flaky JS test, read `docs/testing-notes.md` — it documents dated jsdom/jest
  gotchas specific to this repo (non-configurable `window.location`, silently
  bypassed throwing getters, `vm`-context timer mocking, and more).
- Scratch experiments go in a `tests/js/_*.test.js` file — that prefix is
  gitignored, so it won't be committed or left in the suite.

## Layout

- `js/` — frontend scripts loaded via plain `<script>` tags (no modules/bundler).
  `js/ambient/` = canvas/WebGL ambient effects; `js/loader/` = asset/CDN/font
  loaders; `js/vendor/` = third-party (don't touch); `js/config.js` = tunables.
- `sw.js` — the service worker (caching + fetch handling).
- `css/` — stylesheets.
- `p1/`–`p4/`, `index.html` — static page entries; the `p*` pages are
  image-heavy portfolio galleries.
- `tests/js/**` — Jest (jsdom) tests. `docs/` — repo knowledge; **read
  `docs/testing-notes.md` before deep test work.**
- `scripts/run-npx.sh` — the `make`/CI npx wrapper.

## Lanes (keep PRs disjoint to avoid collisions)

| Routine   | Owns                                                                         | Must NOT touch                                            |
| --------- | ---------------------------------------------------------------------------- | --------------------------------------------------------- |
| Architect | cyclomatic-complexity / readability refactors (behaviour-preserving)         | error-handling, security, tests, features                 |
| Sentinel  | security + error-handling (empty catches, client-side DoS, unsafe DOM sinks) | complexity refactors, features                            |
| Janitor   | dead code, stale deps, real TODOs only                                       | complexity, error-handling (Architect/Sentinel own those) |
| Bolt      | one measurable performance/efficiency win per run                            | complexity-only refactors, security, dead code, features  |
| Testpilot | test-only additions/coverage, no prod-code change                            | `js/` prod files, `sw.js`                                 |
| Palette   | accessibility, UX, semantic HTML/CSS                                         | JS runtime logic, security, tests, performance            |

If your finding belongs to another lane, **skip it** — that lane will get it.

> **Note on enforcement:** unlike some sibling repos, this one does **not**
> configure an ESLint `complexity` rule or a Jest `coverageThreshold`. The
> Architect (complexity) and Testpilot (coverage) targets below are therefore
> judgment-guided, not machine-gated. Your real gate is a green
> `make precommit-fix` plus the scoped proof your lane requires.

## `.jules/` is read-only personas — never write to it

The files in `.jules/<name>.md` are **persona definitions**: your identity, lane,
and constraints, which you read in at the start of a run. They are **not logs**.
**Never append to, modify, or create files under `.jules/`.** A PR that changes a
`.jules/` file is out of scope and will be closed — those files are edited by a
human, not by routines.
