---
description: Propagate a tooling/gate improvement from this repo to the sibling repos (fund, anki, networking) — adapt, don't copy
argument-hint: "[what to sync, e.g. 'the complexity gate' or 'depcheck']"
---

Propagate an improvement made in this repo (`~/dev/ryusoh.github.io`) to the
sibling repos. This repo: static vanilla-JS/CSS personal site on GitHub Pages,
no build step, plain `<script>` tags (no ES modules), npm-based
(`package-lock.json` authoritative; `pnpm-lock.yaml` drifts by convention —
don't regenerate it). CI-parity gate = `make precommit-fix` (runs
`.pre-commit-config.yaml` hooks incl. eslint `--max-warnings=0`, sync-check,
full Jest + coverage).

Sibling profiles:

- `~/dev/fund` — static vanilla-JS/CSS dashboard + Python data pipeline; CI
  gate = `make precommit-fix` (web-ci: format + lint + JS/Python tests);
  `make verify` (lint + type + sec + test) is NOT a superset — it misses the
  pre-commit eslint `--max-warnings=0` hook. Import
  aliases via import map (`@js/*`); `data/` is pipeline-generated, never
  hand-edit; complexity ratchet via `eslint-suppressions.json` + Python
  `xenon`. Gotcha: the PR diff-coverage workflow only
  collects from `js/**/*.js`, so `scripts/*.mjs` never enters lcov. Heavy
  images are CSS `background:` sites, not `<img>` — adapt responsive patterns
  via `image-set()` there, not `<picture>`. sharp is a devDependency.
- `~/dev/anki` — JS + Python (Anki addons); **no** `.pre-commit-config.yaml`;
  CI gate = `make precommit SKIP=1` (fmt-check lint typecheck-js quality-py
  check sync-check); aliases via package.json `imports` (`#js/*`, `#ui/*`);
  Python addon dirs are REAL packages (`__init__.py` present) — import-linter
  works here. Beware: `precommit-fix`'s `YOLO=1`/`MSG=` commit step runs
  `git add -A`. Tooling lives in `tools/` (snake_case `.mjs`, node:test tests
  alongside) — `scripts/` is empty/untracked. GitHub Pages site: heavy images
  are CSS backgrounds (`assets/backgrounds/*`, `mobile_bg.jpg`); addon-dir
  PNGs ship to the desktop app and are never web-served. sharp is a
  devDependency. Pre-existing dead CSS refs exist (e.g. `css/base.css` →
  nonexistent `position_background.jpg`) — don't "fix" unrelated ones.
- `~/dev/networking` — JS + Python; **no** `.pre-commit-config.yaml`; CI runs
  `make precommit` (check-only) — use `make precommit-fix` while iterating,
  `make precommit` before the PR; `make precommit-docker` gives macOS/CI
  parity (`Dockerfile.precommit` pip-installs `requirements-dev.txt` and runs
  `npm ci`). `make precommit` exits 0 even when the log looks alarming — judge
  by exit code plus reading the tail, not vibes. jest is pinned to v29 (its
  non-negotiable #5); its non-negotiable #6 forbids JULES ROUTINES from
  touching build/lint config — interactive agents acting on explicit user
  direction are exempt, note it in the PR body. Its `ci.yml` has a "Reject
  empty pull request" step that hard-fails empty PRs, and its AGENTS.md Lanes
  table lists Sentinel although `.jules/` has no sentinel persona (stale).
  **No web-hosting surface at
  all** (no CNAME/\_config.yml/Pages workflow; only first-party HTML is
  chrome-extension pages) — web-serving tooling patterns don't apply; see its
  `docs/tiered-image-serving.md` for the evaluation. Gotcha: a leftover
  gitignored `.stryker-tmp/sandbox-*` makes `make precommit` fail with
  confusing jest "must contain at least one test" errors — delete it freely.

Verify these facts against each repo's current AGENTS.md/Makefile before
relying on them — they drift.

## Process

Delegate one subagent per repo, in parallel. Brief each with:

1. **The reference implementation** — point at the concrete files in THIS repo
   that carry the pattern (config, Makefile target, hook, doc status block).
2. **Adapt, don't copy.** Every rule/ceiling must map to the target repo's own
   structure and stated beliefs (its AGENTS.md non-negotiables), measured
   against its code — not this repo's. Precedent: fund's `no-cross-page-imports`
   rule was correctly dropped in both JS siblings (no `js/pages/` there), and
   fund's Python import-linter skip was correctly REVERSED in anki (real
   packages, real edges). A rule that fires zero times AND maps to nothing the
   repo believes is decorative; a rule that fires on an accepted pattern is
   false — measure first, then decide.
3. **Find the REAL gate first.** Read `.github/workflows`, Makefile
   `precommit*` targets, and `.pre-commit-config.yaml` BEFORE designing —
   `make verify`-green is not CI-green (fund learned this the hard way: the
   eslint pre-commit hook ran `--max-warnings=0`). Wire the new check into the
   path CI actually executes.
4. **Baselines and ratchets.** If the new check fires on legacy code: prefer
   error-severity + a baseline file (ESLint bulk suppressions model) over
   warning budgets; the baseline only ratchets down. If it fires zero times,
   ship it baseline-free as a preventive gate — that's a fine outcome.
5. **Probe protocol.** Append the probe to a TRACKED file → gate must fail →
   `git restore` → gate must pass → `git status` clean. Never create new files
   for probes; never mask backup/restore errors with `|| true`.
6. **Resolution proof for dependency tooling.** When wiring alias resolution
   for dependency-cruiser: use a webpack-config stub, NEVER `options.tsConfig`
   (typescript v7 repos get a spurious "missing-typescript-transpiler"
   warning); `enhancedResolveOptions` rejects alias keys. Prove resolution by
   comparing "N modules, M dependencies" with and without alias config —
   dependency count must be identical and module count must match the
   tsConfig-route count; an inflated module count means unresolved aliases are
   fake external nodes and path-based rules silently don't match them. If the
   repo has no aliases at all, ship an empty-alias stub with a comment, or no
   stub — don't add decorative config.
7. **Python import-linter check.** grimp has no PEP 420 namespace-package
   support. Check `__init__.py` presence and whether the interesting import
   edges are visible to grimp before wiring a contract; if the graph is
   invisible or empty, document the skip WITH the measurement evidence and the
   unblock condition (fund §3 model). Beware: `python -m importlinter.cli`
   silently no-ops — call the click entry point; grimp writes `.grimp_cache/`
   into the repo root (add to .gitignore or delete).
8. **Finish per repo:** run prettier/fmt over new config files, run the repo's
   own full CI-parity gate green, update its AGENTS.md (command table + short
   note), update the `.jules/` persona whose lane owns the new metric (if
   any). **Never commit** — leave changes uncommitted and report: violation
   counts, resolution proof, files changed, probe exit codes, gate result,
   skip decisions with evidence.

## After the sync

Update this skill's repo profiles above with anything the run learned that
contradicts them, and record the sync in each repo's own docs (they each keep
their own AGENTS.md/tooling docs — the knowledge lives in the repo it
concerns, not here).

## Fleet resilience (learned running 5 parallel sync agents)

A provider quota/error event can kill background agents mid-flight (4 of 5
died at once in the 2026-07 run). Recovery pattern that worked cleanly:
`Agent(resume=...)` retains the agent's full context — resume each failed
agent with "audit what you already did (git status / git log), then
continue"; commits it made are fine, uncommitted partial work gets assessed
before it proceeds. The per-repo isolation of this skill's delegation pattern
is what makes partial failure cheap: one dead agent never poisons another
repo's tree.

Parallel agents that touch THIS repo share one worktree — follow AGENTS.md
"Concurrent agents sharing one worktree": stage only files you changed, never
`git add -A` / `git stash` / `git reset --hard`, keep file sets disjoint. Note
`make precommit-fix` itself ends with `git add -u`, which stages a sibling's
tracked edits too.
