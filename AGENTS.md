# AGENTS.md

Canonical agent guidance for this repo — edit this file; `CLAUDE.md` only
imports it. Subsystem how-tos live in `docs/`. Skills live in `.agents/skills/`
(canonical; `.claude/skills` symlinks to it, `.claude/commands/` is generated
by `tools/sync_commands.py`, and `make sync-check` catches drift).

## Context

`ryusoh.github.io` is a static, vanilla-JS/CSS personal site served by GitHub
Pages — no framework, no build step, no bundler; pages load plain `<script>`
tags. Frontend code lives in `js/`, styles in `css/`, the service worker is
`sw.js`, and Jest tests live in `tests/js/`. There is no server, no Python data
pipeline, and no generated `data/`.

You are an interactive agent working with the user in chat; unattended
automation is limited to GitHub Actions workflows (the Jules routines were
retired in November 2026 — see `docs/gates.md`). Edit build files, Makefiles,
configs, and dependencies whenever the task calls for it.

Tooling is npm-based: `package-lock.json` is authoritative and `make`/CI run
via `./scripts/run-npx.sh`. A secondary `pnpm-lock.yaml` drifts out-of-band
between dependency bumps — leave it untouched outside dependency updates, and
expect large benign diffs when it is regenerated against `package.json`.

## How the user works

- Work on `master` in the shared checkout. The user reviews diffs in VSCode and
  commits accepted work themselves. If your edits vanish from `git status`
  between turns, run `git log --oneline -3` once — a fresh user commit means
  the work was accepted; continue from HEAD.
- Commit or push only when asked (or when a skill's workflow explicitly
  authorizes it). Branch off `master` for PRs.
- Preserve CSS values the user explicitly set (font size, position, spacing)
  unless asked to change them.
- On multi-step work (action-item sweeps, TDD loops, bug diagnosis), the
  progress ledger is disk-backed ground truth: `git status`, `git log`, and
  either `.agents/state/` (via `tools/task_harness.py`) or the governing
  findings doc. Re-anchor from them at each commit boundary and after
  resumption/compaction per the skill's `## Resume protocol`.

## Shared checkout

The user, other agents, and background sessions edit this tree concurrently.

- Stage only the files you changed by name (`git add <file>`). Uncommitted
  changes elsewhere belong to someone else — leave them in place.
- Destructive git commands (`git checkout -- <file>`, `git restore <file>`,
  `git reset --hard`, `git clean`, `git stash`) and `--no-verify` require
  explicit user confirmation.
- Keep concurrent agents on disjoint file sets; in a conflict, resolve only
  your own files. Note that `make precommit-fix` ends with `git add -u` (which
  stages all tracked edits), so use `make gate` when foreign uncommitted work
  sits in the tree.

## Quality bar for every change

1. **The CI gate is `make precommit-fix`** (Prettier, ESLint `--max-warnings=0`,
   Stylelint, `tsc`, `dependency-cruiser`, `thinking-check`, `sync-check`,
   `bot-pr-check`, and the full Jest suite + coverage). Use `make gate`
   (`check` + `test`, no auto-fix or staging) while iterating; open a PR only
   on a green `make precommit-fix`. A red gate on an unchanged tree stays red —
   change something before rerunning (`node scripts/gate-guard.js snapshot`,
   then `check <hash>`). Hook phase details: `docs/gates.md`.
2. **One concern, smallest diff,** inside the task's files. For self-chosen
   work, run `python3 tools/prior_prs.py` first so you pick something no open
   or recently closed PR already covers.
3. **Keep third-party/minified code untouched** (`js/vendor/`, `*.min.js`).
4. **Page-scoped changes stay on their page.** Portfolio pages (`p1/`–`p6/`)
   share `block-navigation`, `ambient`, and `page-transition` — verify changes
   for one page keep the others intact.
5. **Write down only what you ran.** Commands and examples in docs or code must
   have been executed this session.
6. **Code comments state facts about behaviour** — keep reasoning and stub test
   bodies out of diffs (`make thinking-check` enforces this).
7. **Publish a PR as one commit with a real diff.** Verify
   `git show --stat HEAD` before pushing; on revision, amend or squash and
   `git push --force-with-lease`. A goal the repo already satisfies is a no-op,
   not a PR. `make bot-pr-check` (`tools/check_bot_pr_hygiene.py`) enforces
   per-commit hygiene on bot-authored commits (`docs/gates.md`).
8. **Behaviour changes ship a test** that fails before and passes after; Jest
   runs `--coverage` against the whole-suite floor in `jest.config.cjs`.
   Refactors and dead-code removal need no new test — keep coverage
   un-regressed.
9. **Keep tests hermetic and decoupled from production galleries.** Write
   scratch tests to `tests/js/_*.test.js` and sequence scratch artifacts to
   `tests/fixtures/sequence-scratch/` (both gitignored), keeping
   `assets/img/p1..p6/` clean. Assert gallery tests against the synthetic
   fixture `p99` (`assets/img/p99/`) or ephemeral `p98` rather than living
   production galleries `p1`–`p6` (`docs/testing-notes.md`).

## Visual changes

Unit tests cannot see colour, transparent edges, alignment, canvas/WebGL
ambient effects, cursors, animations, or layout. Report objectively verifiable
facts (an `aria-label`, contrast ratio, DOM attribute, passing test) and leave
aesthetic judgment to the human. Open any PR whose payoff is visual as a
**draft** stating "visual review required by a human."

## Commits and PRs

- **Conventional Commits:** `type(scope): summary` with type ∈ `feat`, `fix`,
  `refactor`, `perf`, `test`, `docs`, `chore`, `build`, `ci`; optional
  lower-case scope (`ambient`, `nav`, `sw`, `transition`, `a11y`, `deps`, …);
  imperative lower-case summary ≤ 72 chars, no trailing period, no emoji or
  routine prefix. Wrap the body at ~72 cols explaining what and why. Squash
  merges use the PR title as the commit subject, so keep PR titles compliant
  too. Examples: `perf(ambient): hoist metrics() out of the rAF loop` ·
  `refactor(loader): extract helpers to cut initLoader complexity`.
- **PR body:** what & why (1–2 sentences); verification — exact commands and
  pasted results; visual — "no visual surface" or "visual — human review
  required (draft)".

## Commands — prefer `make` (matches CI)

| Need                                           | Command                                            |
| ---------------------------------------------- | -------------------------------------------------- |
| Full CI gate (fix, stage, check, Jest + cov)   | `make precommit-fix`                               |
| CI parity without auto-fix/stage               | `make gate`                                        |
| Format-check + lint + type + sync checks       | `make check`                                       |
| Auto-fix format + lint + sync pages            | `make fix`                                         |
| Full Jest suite + coverage report              | `make test`                                        |
| Scoped JS test (fast, while iterating)         | `npx jest <path/to/test>`                          |
| Lint JS / CSS / Markdown                       | `make lint-js` / `make lint-css` / `make lint-md`  |
| Auto-fix Markdown boxes, LaTeX, and lint rules | `make markdownlint-fix`                            |
| JS strict type check (whitelist)               | `make type` / `npx tsc -p jsconfig.json`           |
| Generated-commands freshness check             | `make sync-check`                                  |
| Dependency-structure gate (no circular deps)   | `make depcheck`                                    |
| Stream-of-consciousness scan                   | `make thinking-check`                              |
| Bot commit hygiene gate                        | `make bot-pr-check`                                |
| Mutation testing (informational, non-blocking) | `make mutate-js`                                   |
| Synchronize / check portfolio shell templates  | `make sync-pages` / `make sync-pages-check`        |
| Build a portfolio page from markdown           | `make page ID=pN`                                  |
| Contact-sheet ledger (private tooling)         | `make ledger-stats` / `make ledger-sync DIR=<dir>` |
| Probe live origin/ECH/mirror / CN reachability | `make mirror-check` / `make china-probe`           |
| Build responsive AVIF/WebP tiers / ThumbHash   | `make images` / `make thumbhashes`                 |
| Extract CJK glyphs and build WOFF2 subset      | `make fonts`                                       |

- **Workflow action pins:** before bumping an action in `.github/workflows/`,
  verify the major-version tag exists
  (`gh api repos/<owner>/<repo>/git/refs/tags/v<N>`).
- **Workflow `run:` blocks with `set -o pipefail`:** use
  `grep -q pat <<< "$var"` and `awk 'NR==1'` instead of piping writers into
  `grep -q`, `head`, or `sed q` (early reader exit triggers SIGPIPE 141);
  rehearse the block locally with the same flags.
- **Gates (`docs/gates.md`):** `make lint-js` caps ESLint `complexity` at 20
  (`eslint-suppressions.json` is frozen at `{}`); `make test` enforces the
  coverage floor in `jest.config.cjs`; `make lint` runs `make depcheck`;
  `make mutate-js` is informational only.
- **Testing gotchas (`docs/testing-notes.md`):** Jest runs silent
  (`console.log` prints nothing), `window.location` is non-configurable in
  jsdom, throwing getters are silently bypassed, and `vm`-context timers behave
  differently. Before adding tests to a large suite (e.g.
  `page-transition.test.js`), grep for the function/branch first — existing
  helpers like `loadInstrumentedScript()` often already handle jsdom seams.
- **Strict JS typing (`docs/js-typing-strategy.md`):** `make type` runs
  `tsc -p jsconfig.json` strictly on the whitelisted `include` set; files
  outside it are unchecked.
- **Fast text search:** use `git grep -I` instead of raw `grep -r` so binary
  tiers in `assets/` and gitignored worktrees in `.agents/state/` are skipped.

## Layout & invariants

- `js/` — frontend scripts loaded via plain `<script>` tags: `js/ambient/`
  (canvas/WebGL), `js/loader/` (asset/CDN/font), `js/vendor/` (third-party),
  `js/config.js` (tunables), `js/types/*.d.ts` (type-only ambient declarations
  for `tsc --checkJs`). `sw.js` — service worker. `jsconfig.json` — `tsc`
  whitelist. `css/` — stylesheets.
- `p1/`–`p6/`, `index.html`, `about/index.html` — static pages; `p*` galleries
  are generated from `assets/img/p*/index.md` + `commentary.json` via
  `scripts/templates/portfolio-shell.html` and `scripts/seo.mjs` (edit the
  template or SEO module, then run `make sync-pages` to refresh `p*`,
  `index.html`, `about/index.html`, `sitemap.xml`, `llms.txt`, and
  `llms-full.txt`).
- **Typography & attribution:** all pages (including `/about/`) set display and
  body text in `'Syne'` with the `GlowSansSC-Extended` CJK fallback; keep artist
  and SEO/GEO attribution positive (`Zhuang Liu` / `lyeutsaon` at
  `lyeutsaon.com`) without naming external namesakes or negative city lists.
- `assets/img/p99/` — canonical synthetic fixture for sequence/gaze/gallery
  tests. `contact-sheet-ledger/` — gitignored local-first shoot digests from
  `scripts/contact-sheet.mjs` (`docs/contact-sheet-ledger-design.md`).
- `tests/js/**` — Jest (jsdom) tests. `tests/js/acceptance/**` — public-surface
  acceptance tests (real events in, observable page effects out, no internal
  hooks or source rewriting).
- `docs/` — subsystem references: read `docs/testing-notes.md` before deep test
  work, `docs/gates.md` for CI gates, `docs/security-and-cleanup-pitfalls.md`
  for security/cleanup traps, `docs/page-generation-pipeline.md` for gallery
  builds, and `docs/china-image-mirror-plan.md` for the OSS fallback mirror.
- `scripts/` & `tools/` — repository tooling (`scripts/run-npx.sh`,
  `scripts/gate-guard.js`, `scripts/check-thinking-comments.js`,
  `scripts/coverage-rank.js`, `scripts/seo.mjs`, `scripts/validate-pages.mjs`,
  `tools/sync_commands.py`, `tools/prior_prs.py`, `tools/task_harness.py`,
  `tools/check_md_boxes.py`, `tools/check_md_latex.py`, page builders).
  `tests/js/doc-tool-references.test.js` verifies that scripts referenced in
  agent docs and skills exist on disk.
- **Top-right social dock:** `.social-icons-desktop` is fixed at viewport
  top-right across desktop and mobile with safe-area insets; mobile `#main h1`
  carries right padding so "Zhuang Liu" clears the dock on narrow screens.
- **Gallery vertical spacing (`--gallery-block-gap`):** centralized in `:root`
  in `css/style.css`. Keep vertical margins on outer block containers
  (`.post-content > div[align='center']`, `.image-container`,
  `article blockquote`, `.post-content p`) and `0` margin on inner
  `<picture>`/`<img>` so margin collapsing stays uniform under
  `content-visibility: auto`.

## Skills and slash commands

- Author skills in `.agents/skills/<name>/SKILL.md` (with any skill-scoped
  helpers under `scripts/` or `references/` inside that skill directory). Only
  frontmatter `name` + `description` are always loaded ("Use when ..."); bodies
  load on demand.
- Omit `---` horizontal rules in skill bodies (`tools/sync_commands.py` splits
  frontmatter with `content.split("---", 2)`).
- `.claude/skills` symlinks to `../.agents/skills`; `.claude/commands/<name>.md`
  is generated by `python3 tools/sync_commands.py`. Run it after any skill edit
  (`make sync-check` gates drift; `tests/js/skills.test.js` and
  `tools/__tests__/test_skills.py` validate frontmatter, `{{args}}`, and
  symlinks).
