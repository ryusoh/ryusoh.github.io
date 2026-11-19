---
name: gh-action-rescue
description: Fully diagnose and repair a failed GitHub Actions workflow run, then automatically verify, commit, push, open and merge a PR, dispatch a fresh run, and confirm deployment or mirror recovery. Use when the user names or links a failed workflow run, reports a failing CI/Pages/scheduled/manual workflow, or asks for end-to-end Actions recovery without further confirmation.
argument-hint: '[workflow run number, run URL, or workflow name]'
---

Rescue this failed GitHub Actions workflow end to end: **{{args}}**

Invocation authorizes the full loop — edits, tests, commits, pushes, PR
creation, squash merge, workflow dispatch/rerun, deployment/mirror
verification, and cleanup — without pausing for confirmation. Stop only on a
real blocker (missing auth or secrets, or a change requiring human visual
review) and report it precisely.

## 1. Anchor target and state

Resolve the run live from GitHub (`run_number` like `#523` differs from the
API `run.id`). Use authenticated `gh` when available, or public GitHub APIs
for metadata plus an authenticated browser for logs, PRs, and manual dispatch;
keep credentials out of command output and URLs.

- Run `git status --short`, `git branch --show-current`, and
  `git log --oneline -3`.
- Record workflow path, run number/ID, head SHA/branch, failing jobs/steps,
  and URL. Compare recent runs across the last-success → first-failure
  boundary (runtime/dependency versions and error signatures).
- Read the workflow YAML and governing subsystem docs: `docs/gates.md` (CI
  gates, coverage floor, Stryker), `docs/china-image-mirror-plan.md`
  (`mirror-check.yml`, `scripts/sync-mirror.sh`),
  `docs/page-generation-pipeline.md` (`p*` shell sync), and
  `docs/js-typing-strategy.md` (`tsc -p jsconfig.json`).
- Check overlapping PRs with `python3 tools/prior_prs.py` (or the public pulls
  API if `gh` is unauthenticated).

## 2. Reproduce before theorizing

Read the failing step log bottom-up: Actions echoes every shell line (even
untaken `if` branches), so anchor on the step ending in
`##[error]Process completed with exit code ...`. A fast sub-minute PR failure
usually comes from `ci.yml`'s early guards (`Reject empty pull request` or
`Reject bot PR hygiene violations`), before Jest runs.

Build the tightest deterministic local loop (watch it fail before the fix,
pass after):

1. Scoped check or test (`npx jest <path/to/test>`, `make lint-js`,
   `make lint-css`, `make type`, `make sync-check`, `make sync-pages-check`,
   or `python3 -m pytest tools/__tests__/`).
2. Local CI-parity gate (`make check`, `make test`, `make gate`, or
   `SKIP=jest-related pre-commit run --all-files`).
3. Isolated version reproduction, `make mirror-check` (`scripts/check-mirror.sh`)
   for `mirror-check.yml`, or `npx stryker run --mutate` for `mutation.yml`.
4. Replay of a captured HTTP/HTML response or synthetic fixture `p99` / `p98`
   (keep tests decoupled from living galleries `p1`–`p6`).
5. Workflow rerun only when no local seam exists (e.g. transient Pages backend
   errors in `pages.yml` or secrets-gated Claude workflows).

Put scratch tests in gitignored `tests/js/_*.test.js` or
`tests/fixtures/sequence-scratch/` and clean them up afterward. For Jest/jsdom
failures, read `docs/testing-notes.md` (and consult `fix-precommit`).

Classify before editing:

- **Repository defect:** minimal root-cause fix + regression test.
- **Runtime/dependency rollover:** correlate versions at the failure boundary;
  pin a supported runtime/action (workflow-local over global when sufficient)
  after confirming the major tag exists
  (`gh api repos/<owner>/<repo>/git/refs/tags/v<N>`).
- **Mirror / Pages drift (`mirror-check.yml`, `pages.yml`):** verify live
  Pages and OSS fallback bucket state (`scripts/sync-mirror.sh` /
  `make sync-mirror`) per `docs/china-image-mirror-plan.md`, keeping CSP,
  hotlink, and byte-parity checks intact.
- **Transient GitHub/infra failure:** rerun the failed jobs; skip creating a
  code change or empty PR.
- **Gate / hygiene rejection (`ci.yml`):** keep `jest.config.cjs` coverage
  floors, `eslint-suppressions.json` (`{}`), `thinking-check`, and
  `bot-pr-check` intact; fix the underlying code.
- **Red PR check:** checks reading PR metadata from the event payload replay
  stale values on `gh run rerun` — retrigger with a fresh event (force-push,
  or close + reopen). When `gh pr edit` hits GraphQL `read:org` scope errors,
  retitle via `gh api -X PATCH repos/<owner>/<repo>/pulls/<N> -f title="..."`
  (this repo has no automated `pr-title` gate, so verify Conventional Commits
  format against `AGENTS.md`). For a Dependabot bump failing on an existing
  file, reproduce with `npm ci` on the PR lockfile in a worktree, then accept
  the fixer output or exclude the file citing the upstream issue; push an
  additive commit so Dependabot's signed commit stays intact.

## 3. Fix, prove, and ship

Follow `AGENTS.md` (shared checkout, single concern on a branch off `master`,
one conventional commit, PR body with What & why / Verification / Visual).

- Keep `js/vendor/`, `*.min.js`, and `pnpm-lock.yaml` untouched
  (`package-lock.json` is authoritative). After editing `.agents/skills/`, run
  `python3 tools/sync_commands.py`; after editing
  `scripts/templates/portfolio-shell.html`, run `make sync-pages`.
- In workflow `run:` blocks with `set -o pipefail`, use `grep -q pat <<< "$var"`
  and `awk 'NR==1'` instead of piping writers into `grep -q`/`head`/`sed q`
  (SIGPIPE 141), and rehearse locally with the same flags.
- Prefer structural prevention (pins, schema checks, validation) over prose.
- Run `make precommit-fix` on the finished tree (or `make gate` +
  `make precommit` if foreign uncommitted work sits in the tree so `git add -u`
  stays safe; also run `python3 -m pytest tools/__tests__/` if `tools/` or
  `.agents/skills/` changed). If a local command hits a timeout, finish every
  remaining phase separately and report that explicitly.
- Push, open a PR (draft only if visual review is needed), wait for required
  checks (amend + `--force-with-lease` on fixes), squash-merge, confirm the
  merged SHA on GitHub, and return to a clean `master`
  (`git pull --rebase origin master`).

## 4. Execute on merged `master` and verify outputs

Dispatch or observe the workflow on merged `master` (`ci.yml` and `pages.yml`
trigger on push to `master`; `mirror-check.yml`, `mutation.yml`, and
`pages.yml` support `workflow_dispatch`), resolve the new run number/ID from
its head SHA, and monitor with bounded backoff:

- **`ci.yml`:** early guards, pre-commit hooks, lint/type, full `npm test`,
  and `coverage/coverage-summary.json` upload.
- **`pages.yml`:** `sw.js` cache-name stamp, `upload-pages-artifact`, and
  `deploy-pages` (note `cancel-in-progress: true` during rapid merges); verify
  the live site serves the merged commit and stamped `sw.js`.
- **`mirror-check.yml`:** live `data-fallbacks` and CSP `img-src`, mirror HTTP
  200, byte-size parity, hotlink 403, missing-object 404. If derived
  `.avif`/`.webp` tiers are stale on OSS, run `make sync-mirror` (requires
  `aliyun` CLI and credentials; report missing credentials as a blocker) before
  re-dispatching.
- **`mutation.yml`:** incremental cache restore, `npx stryker run`, and
  `mutation-report` artifact upload (non-blocking).
- **Generated pages:** if `scripts/templates/portfolio-shell.html` or
  `assets/img/p*/index.md` changed, confirm `make sync-pages-check` passed and
  updated `p*/index.html` landed on `master`.

If the fresh run fails, loop back to step 2 automatically.

## 5. Evidence report

The rescue finishes only when the fixed workflow succeeds on merged `master`
and required outputs are verified (report any external blocker or missing
secret explicitly). Clean up temporary worktrees/branches and diagnostic files,
re-anchor with `git status` and `git log`, and report:

1. Root cause and failing step.
2. Code/config fix and regression evidence (commands and outputs).
3. PR number and merge commit on `master` (or transient rerun ID).
4. Fresh run number/ID and result on merged `master`.
5. Deployment, mirror, or artifact verification result.
6. Any external limitation or unrecovered gap.
