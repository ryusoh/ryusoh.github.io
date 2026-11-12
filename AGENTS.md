# AGENTS.md

Single source of truth for agent guidance on this repo — **edit this file, not
`CLAUDE.md`** (that is a stub that imports this one). Slash-command workflows
live in `.agents/skills/<name>/SKILL.md` (canonical — the open Agent Skills
format); `.claude/commands/` is generated from it by `tools/sync_commands.py`,
`.claude/skills` is symlinked to `.agents/skills`, and the gate drift-checks it via `make sync-check`.

## Audience

Guidance here is for **interactive coding agents** (Claude Code, Kimi,
Antigravity, etc.) working directly with the user in a chat session. The Jules
routines (`.jules/` personas) were retired in November 2026 — see the retirement
note in `docs/gates.md`. Unattended automation is now limited to GitHub Actions
workflows. You may edit build files, Makefiles, configs, and dependencies, and
commit to `master` or open PRs as directed by the user. If the user asks you to
change something, change it.

This repo is `ryusoh.github.io`: a static, vanilla-JS/CSS personal site served by
GitHub Pages. **No framework, no build step, no bundler** — pages load plain
`<script>` tags. Frontend code lives in `js/`, styles in `css/`, the service
worker is `sw.js`, and Jest tests live in `tests/js/`. There is **no server, no
Python pipeline, no Cloudflare worker, and no generated `data/`.**

Tooling is **npm**-based: `package-lock.json` is authoritative and `make`/CI run
via `npx`. A `pnpm-lock.yaml` also exists but is secondary — it drifts from
`package.json` (dependency bumps update only `package-lock.json`) and is
regenerated out-of-band during dependency updates. Expect large-but-benign
`pnpm-lock.yaml` diffs when shipping those; confirm it matches `package.json`
rather than assuming a regression.

## Non-negotiables (apply to every change and PR)

1. **Open a PR only if `make precommit-fix` is green.** It runs the CI gate —
   Prettier, ESLint, Stylelint, the JS strict type check (`tsc`), and the full
   Jest suite + coverage — and must exit 0. Red = don't open it. And don't rerun
   a red gate on an unchanged tree — a failed gate over an untouched worktree
   cannot go green, so edit something first. `node scripts/gate-guard.js`
   enforces this: `snapshot` before the run, `check <hash>` before a retry
   (exit 1 = unchanged). (Hook phase details: `precommit-fix` auto-fixes,
   stages, then re-runs hooks check-only — see `docs/gates.md`.)
2. **One concern, smallest possible diff.** No drive-by edits, no scope creep.
   Diff size is inversely proportional to approval — keep it tiny.
3. **Keep file sets disjoint.** If concurrent agents or workflows touch the same
   files, one change gets clobbered or conflicts. Don't fix things outside your
   task scope.
4. **Branch off `master` for PRs.** Don't push to `master` unless the user
   directs it (see Working rules).
5. **Don't hand-edit third-party/minified code** (`js/vendor/` or any `*.min.js`).
   Its TODOs and complexity are not ours.
6. **Page-scoped changes must not leak to other pages.** The image-heavy portfolio
   pages (`p1/`–`p4/`) share components (block-navigation, ambient, page-transition);
   a change for one must not regress the others.
7. **Don't write a command/example you haven't actually run this session.** Verify
   behaviour; don't infer it from a name or a `case` label.
8. **Check open and recently-closed PRs before you start, and don't repeat them.**
   Run `python3 tools/prior_prs.py` (lists number, state, labels, title) and read
   the recent ones. A closed PR
   was closed for a reason; an open one already claims that work. Resubmitting
   similar work wastes the run and gets closed. Pick something new.
9. **No stream-of-consciousness in the diff.** Your reasoning stays out of
   committed code: no thinking-out-loud comments ("Wait, ...", "Ah, ..."), no
   abandoned stub test bodies. If an approach fails mid-write, delete the
   attempt — don't commit the trail. Code comments state facts about behaviour.
   Enforced by `make thinking-check` — see `docs/gates.md` for wiring.
10. **Never open an empty PR.** If the run produces no diff (zero changed
    files), end the run with no PR — an empty PR can't be merged and costs the
    reviewer a manual close. This includes when your task's goal turns out to be
    already satisfied by the current repo state (e.g. a stale task description):
    a satisfied goal is a no-op, not a PR.
    **The same holds mid-PR: never push an empty or no-op commit** — including
    add-then-remove placeholder files (`dummy_file.txt`). Before every push,
    `git show --stat HEAD` must show a real diff that matches the commit
    message and, when responding to review feedback, actually addresses it.
    If you have nothing real to push, push nothing.
    **Publish bot work as a single commit by default.** Commit the finished
    change once, run `make precommit-fix` on that exact tree, then push; on any
    revision, amend or squash and force-push so the branch stays one commit
    (squash: `git reset --soft` to the merge-base with `origin/master`,
    recommit, then `git push --force-with-lease`). The
    gate is **per-commit, not net-diff**: a violation reverted by a later commit
    still fails, and pushing revert commits only adds new violations. Every
    per-commit failure mode (empty "finalize" pushes, add-then-remove
    placeholders, stray artifacts like a 474-line `verify_output.txt` —
    fund#692) is impossible on a one-commit branch, and **staging by name**
    (`git add <file>`, never `git add -A`) keeps run scratch out of the commit.
    Machine-enforced by
    `make bot-pr-check` (fails on empty commits, zero-content files, test line
    deletions, stray bot artifacts like `pr_body.txt` / `*.log` /
    `*_output.txt` / `*_out.json` (fund#695's eslint scratch), or unauthorized
    `eslint-suppressions.json` modifications) — see `docs/gates.md` for wiring.
11. **Absolute ban on destructive git commands.** Never run `git checkout -- <file>`,
    `git restore <file>`, `git reset --hard`, or `git clean` without explicit user
    confirmation. Multiple agents, background routines, and the human share this
    repository concurrently. Uncommitted modifications in the working tree or index
    often belong to a concurrent agent or user session in another window. Discarding
    changes or assuming diffs outside your immediate task scope are "stray debris"
    destroys active work. Stage only files you own (`git add <file>`), never revert
    foreign files, and never assume exclusive ownership of the working tree.

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
- **Verification** — the exact command(s) you ran and their result, pasted:
    - `make precommit-fix` → green, or
    - the scoped proof for your change (e.g. a before/after measurement; coverage on
      file X went 72% → 100%).
- **Visual?** — "no visual surface" or "visual — human review required (draft)."

A PR with no pasted verification output reads as unverified and will be closed.

## Changed lines must be covered

The repo targets high (ideally 100%) coverage and Jest runs with `--coverage`.
There is no machine diff-coverage gate, so this is on your honour:

- If your change adds or alters runtime behaviour (a bug fix, a security fix, a
  behavioural change), **ship a test that fails before and passes after**, covering
  the changed lines. Bot commits must be **append-only in tests** (never edit or delete
  existing test lines; always append new test or describe blocks).
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
  `Sentinel:`, no `⚡`) — keep the subject clean.
- **Body** (when the change isn't self-evident): wrap at ~72 cols, explain _what
  and why_, not how. State severity, metrics, or measurements here — not in the
  subject.
- One logical change per commit.

Examples: `perf(ambient): hoist metrics() out of the rAF loop` ·
`refactor(loader): extract helpers to cut initLoader complexity` ·
`test(page-transition): cover navigate() control-character paths`.

## Command interface — prefer `make` (matches CI)

| Need                                               | Command                                            |
| -------------------------------------------------- | -------------------------------------------------- |
| Full gate (format + lint + type + Jest + coverage) | `make precommit-fix`                               |
| CI parity without auto-fix/stage                   | `make gate`                                        |
| Format-check + lint + type only (quick CI parity)  | `make check`                                       |
| Auto-fix format + lint                             | `make fix`                                         |
| Full Jest suite + coverage report                  | `make test`                                        |
| Scoped JS test (fast, while iterating)             | `npx jest <path/to/test>`                          |
| Lint JS / CSS individually                         | `make lint-js` / `make lint-css`                   |
| JS strict type check (whitelist)                   | `make type` / `npx tsc -p jsconfig.json`           |
| Generated-commands freshness check                 | `make sync-check`                                  |
| Dependency-structure gate (no circular imports)    | `make depcheck`                                    |
| Stream-of-consciousness scan (comments, tests)     | `make thinking-check`                              |
| Bot commit hygiene gate                            | `make bot-pr-check`                                |
| Mutation testing (non-blocking; not in any gate)   | `make mutate-js`                                   |
| Synchronize portfolio pages from shell template    | `make sync-pages`                                  |
| Check portfolio pages template synchronization     | `make sync-pages-check`                            |
| Build/compile a portfolio page from markdown       | `make page ID=pN`                                  |
| Contact-sheet ledger (private practice tooling)    | `make ledger-stats` / `make ledger-sync DIR=<dir>` |
| Build responsive AVIF/WebP gallery tiers           | `make images`                                      |
| Generate ThumbHash blur-up placeholders            | `make thumbhashes`                                 |
| Extract CJK characters and generate WOFF2 subset   | `make fonts`                                       |

- Use scoped `npx jest <file>` for the tight edit→verify loop; use
  `make gate` for a faster CI-parity check (check + test, no auto-fix/stage).
  Run `make precommit-fix` once before opening the PR.
- **Workflow action versions** — when bumping a GitHub Actions pin in
  `.github/workflows/`, verify the major-version tag exists
  (`gh api repos/<owner>/<repo>/git/refs/tags/v<N>`). Major-version tags are
  not guaranteed for every action; a missing tag breaks CI.
- **Workflow `run:` blocks with `set -o pipefail`** — never write
  `producer | grep -q pat` (or pipe into `head`/`sed q`): `grep -q` exits on
  first match, the writer dies with SIGPIPE, and pipefail reports 141 even on
  success. Use `grep -q pat <<< "$var"` and `awk 'NR==1'` (reads all input)
  instead. Rehearse the block locally with the same flags before committing.
- **Complexity ratchet** — `make lint-js` gates ESLint `complexity` above 20 with
  `eslint-suppressions.json` baselining legacy violations. All legacy violations
  have been eliminated (`{}`); the baseline is now frozen at 0. Any new suppression
  or count increase fails `bot-pr-check`. Details: `docs/gates.md`.
- **Coverage ratchet** — `make test` enforces the whole-suite floor in
  `jest.config.cjs`; CI also verifies `coverage/coverage-summary.json` exists.
  Details: `docs/gates.md`.
- **Dependency-structure gate** — `make lint` runs `make depcheck`
  (dependency-cruiser over `js/` and `sw.js`). Details: `docs/gates.md`.
- **Mutation testing** — `make mutate-js` is informational only and not part of
  any gate. Details: `docs/gates.md`.
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
- **Never write tests asserting on production portfolio galleries (`p1`–`p6`)** —
  production galleries are living content; adding, deleting, or reordering photos
  breaks tests. Use the canonical synthetic fixture `p99` (`assets/img/p99/`) for
  tests requiring gallery assets, or `p98` for ephemeral builder workspaces.
  Details: `docs/testing-notes.md`.

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
- `p1/`–`p6/`, `index.html` — static page entries; the `p*` pages are
  image-heavy portfolio galleries generated from `assets/img/p*/index.md`
  via canonical template `scripts/templates/portfolio-shell.html`.
- `assets/img/p99/` — canonical static fixture for sequence and gaze tests
  (never touch during normal runs; never assert against production galleries
  `p1`–`p6` in tests).
- `contact-sheet-ledger/` — gitignored per-shoot edit digests produced by
  `scripts/contact-sheet.mjs` (schema: `docs/contact-sheet-ledger-design.md`);
  local-first by design, public only via deliberately curated aggregates.
- `scripts/templates/portfolio-shell.html` — canonical shell for all `p*/index.html`
  galleries. Any added scripts, styles, or header/dock changes must be made
  here, followed by `make sync-pages`.
- `tests/js/**` — Jest (jsdom) tests. `tests/js/acceptance/**` — the acceptance
  stream: user-facing behaviours phrased in domain language, exercised only
  through the public surface (real events in, observable page effects out; no
  internal hooks, no source rewriting). `docs/` — repo knowledge; **read
  `docs/testing-notes.md` before deep test work.**
- **Security, error-handling, and dead-code removal** →
  `docs/security-and-cleanup-pitfalls.md`.
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
- **Self-contained skill bundles:** Each skill is a directory containing its
  `SKILL.md`, plus any skill-scoped helper scripts (`scripts/`) or prompt/data
  references (`references/`). Keep skill-specific logic bundled within its skill
  directory rather than placing one-off scripts in global `scripts/` or `tools/`.
- **Progressive disclosure** — only the frontmatter `name` + `description` are
  always loaded into an agent's context; the body is read on demand once the
  skill triggers. So the `description` is the only always-loaded surface: write
  it as a discriminative trigger ("Use when ..."), and don't contort the body to
  save prompt space — length there is free until the skill fires.
- **Never put a `---` horizontal rule in a skill body** — the generator's
  frontmatter parser is a naive `content.split("---", 2)`, so a `---` line in
  the body mangles the generated command.
- **`.claude/skills` is symlinked to `../.agents/skills`** for autonomous agent
  discovery across tools (Claude Code, Antigravity, Kimi, etc.).
- **`.claude/commands/<name>.md` is generated** from the skills by
  `tools/sync_commands.py` for Claude Code. Never edit the generated files by
  hand — run `python3 tools/sync_commands.py` after editing a skill, and note
  that `make sync-check` (wired into `make precommit`/`precommit-fix`) fails if
  regeneration is not a no-op.
- **Skill schema validation:** `tests/js/skills.test.js` (and `tools/__tests__/test_skills.py`,
  run by Jest / pytest) enforces schema validity, non-empty descriptions,
  directory-name matching, standard `{{args}}` placeholders, and symlink resolution across all skills.

## Working rules (interactive agents)

- **NEVER run destructive discard commands (`git checkout -- <file>`, `git restore <file>`, `git reset --hard`, `git clean`).**
  Multiple agents or the human operate concurrently in this repository. Never
  assume that an uncommitted diff in `git status` is debris from your own command
  — it belongs to active work from another session. Discarding changes on files
  outside your assigned task scope destroys uncommitted work. If unexpected diffs
  appear, do not touch them; report them or ask the user.
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
- **Externalized state & transaction boundaries (State-Oriented Architecture & SDN Control Plane).**
  On multi-step workflows (action-item sweeps, TDD loops, bug diagnosis), never rely on
  conversation memory as an execution ledger ($P = p^N$ failure). Follow Arista EOS's
  SysDB design and Google Orion's SDN control plane: the disk-backed state ledger
  (`.agents/state/` via `tools/task_harness.py` or governing findings doc) is the single
  source of truth; worker agents are ephemeral, stateless transforms ($O(1)$ context)
  reading only their active gate slice with dynamically routed toolsets (Jupiter OCS model).
  At each transaction boundary (after commits or gate checks) and on session resumption,
  follow the skill's `## Resume protocol`: re-anchor working memory directly from
  authoritative ground truth (`git status`, `git log`, state file) before dispatching tools.
- **Concurrent agents sharing one worktree.** When you run parallel subagents
  (swarms, background agents) in this checkout: stage only files you changed
  (`git add <specific-files>`, never `git add -A`), never `git stash`,
  `git reset --hard`, `git checkout -- <file>`, `git restore <file>`, or
  `git commit --no-verify` — a sibling agent's work may be sitting in the same
  tree. Never discard changes on files outside your assigned task/page scope;
  uncommitted edits in other directories belong to concurrent work streams or
  the user in another window. Keep concurrent agents on disjoint file sets; if
  a rebase/conflict lands mid-run, resolve only files your task owns. Note that
  `make precommit-fix` itself ends with `git add -u`, which stages **all**
  tracked modifications including a sibling's — another reason to keep file
  sets disjoint.
- **Tests must be hermetic: never write temp artifacts into production asset
  directories.** For example, sequence-skill reports/SVGs/JSON scratch files go
  in `tests/fixtures/sequence-scratch/` (gitignored), not `assets/img/pN/`.
  Production side effects that are normally desirable — such as auto-syncing
  `pN/README.md` when a report is regenerated — must be gated to the canonical
  production path so tests cannot corrupt tracked files.
