---
description: Fully diagnose and repair a failed GitHub Actions workflow run, then automatically verify, commit, push, open and merge a PR, dispatch a fresh run, and confirm deployment or mirror recovery. Use when the user names or links a failed workflow run, reports a failing CI/Pages/scheduled/manual workflow, or asks for end-to-end Actions recovery without further confirmation.
argument-hint: '[workflow run number, run URL, or workflow name]'
---

Rescue this failed GitHub Actions workflow end to end: **$ARGUMENTS**

Invocation explicitly authorizes edits, tests, commits, pushes, PR creation,
squash merges, workflow dispatches/reruns, deployment/mirror verification, and
cleanup. Do not ask for further confirmation. Stop only for a real blocker such
as unavailable authentication, missing required secrets/credentials, or a change
requiring human visual review; report that blocker precisely.

## 1. Anchor the target and current state

Re-resolve the run from GitHub rather than trusting a stale page or run title.
A workflow `run_number` (for example #523) is not the API `run.id`.

```bash
git status --short
git branch --show-current
git log --oneline -3
```

- Record the workflow name/path, run number and ID, head SHA/branch, failing
  jobs/steps, conclusion, and HTML URL.
- Check recent runs to find the last success and first consecutive failure.
  Compare dependency/runtime versions and error signatures across that boundary.
- Read the workflow YAML and the subsystem docs governing the failing surface
  before editing: `docs/gates.md` for CI gates, `tools/check_bot_pr_hygiene.py`,
  coverage floor, and Stryker; `docs/china-image-mirror-plan.md` for
  `mirror-check.yml` and `scripts/sync-mirror.sh`;
  `docs/page-generation-pipeline.md` for `p*` shell sync;
  `docs/js-typing-strategy.md` for `tsc -p jsconfig.json`.
- Check open/recently closed PRs for overlapping work with
  `python3 tools/prior_prs.py`; if unauthenticated `gh` makes it fail, query
  the public pulls API instead.
- Create a todo list covering diagnosis, fix/regression tests, shipping, fresh
  workflow execution, and post-merge verification. Keep exactly one item in
  progress.

Use authenticated `gh` when available. Otherwise use public GitHub APIs for run
metadata and an authenticated browser for logs, PR creation/merge, and manual
dispatch. Never print credentials or place API keys in URLs.

## 2. Establish the failure before theorizing

Read the actual failing step log bottom-up. Capture the first actionable error,
final exit status, runtime/dependency versions, and which hook or step actually
reported `##[error]Process completed with exit code ...`. Do not mistake echoed
`run:` lines (printed in cyan) or earlier non-failing hook output for the root
error. A fast sub-minute failure on a PR usually comes from `ci.yml`'s early
guards (`Reject empty pull request` or `Reject bot PR hygiene violations`), not
the Jest suite.

Build the tightest deterministic loop that exercises this exact symptom:

1. scoped check or test at the real call site (`npx jest <path/to/test>`,
   `make lint-js`, `make lint-css`, `make type`, `make sync-check`,
   `make sync-pages-check`, or `python3 -m pytest tools/__tests__/`);
2. local CI-parity gate (`make check`, `make test`, `make gate`, or
   `SKIP=jest-related pre-commit run --all-files`);
3. isolated reproduction of resolved action/Node/npm/Python tool versions, or
   `make mirror-check` (`scripts/check-mirror.sh`) for `mirror-check.yml`, or
   `npx stryker run --mutate` for `mutation.yml`;
4. replay of a captured HTTP/HTML response or local synthetic fixture (`p99` /
   `p98` — never couple unit tests to production galleries `p1`–`p6`);
5. workflow rerun only when no local seam exists (for example, transient GitHub
   Pages backend rejections in `pages.yml` or secrets-gated Claude workflows).

Watch the loop fail before the fix and pass afterward. Keep scratch tests in
gitignored `tests/js/_*.test.js` or `tests/fixtures/sequence-scratch/` and
delete temporary diagnostic artifacts afterward. For a difficult diagnosis, rank
3–5 falsifiable hypotheses before probing (and consult `fix-precommit` for CI
gate, ESLint, or Jest failures). For a Jest/jsdom issue, read
`docs/testing-notes.md` before inventing a workaround (Jest runs silent, and
`window.location` is non-configurable).

Classify the result before changing files:

- **Repository defect:** fix the smallest root cause and add a regression test.
- **Runtime/dependency rollover:** correlate the first failure with resolved
  versions; pin a supported runtime/action or replace the incompatible
  dependency rather than hiding the error. Before bumping a workflow action pin,
  verify the major-version tag exists
  (`gh api repos/<owner>/<repo>/git/refs/tags/v<N>`).
- **External service / mirror / Pages drift (`mirror-check.yml`, `pages.yml`):**
  verify whether the live Pages site or the OSS fallback bucket
  (`scripts/sync-mirror.sh` / `make sync-mirror`) is stale or misconfigured per
  `docs/china-image-mirror-plan.md` before altering workflow probes; never weaken
  CSP, hotlink, or byte-parity checks.
- **Transient GitHub/infrastructure failure with no code defect:** rerun the
  failed jobs; do not invent a code change or open an empty PR.
- **Gate / hygiene rejection (`ci.yml`):** preserve the gate. Never weaken
  `jest.config.cjs` coverage thresholds, add `eslint-suppressions.json` entries,
  or bypass `thinking-check` / `bot-pr-check` to obtain green.

## 3. Fix and prove it

Make one concern-sized change on a branch off current `master`. Stage only
files owned by this rescue; concurrent agents and the user may share the
worktree. Never discard foreign changes or use destructive git cleanup.

- Never hand-edit `js/vendor/`, `*.min.js`, or generated `.claude/commands/`.
  If you edit any skill in `.agents/skills/`, run `python3 tools/sync_commands.py`
  so `.claude/commands/` stays in sync.
- Never regenerate `pnpm-lock.yaml`; `package-lock.json` is authoritative.
- If you edit `scripts/templates/portfolio-shell.html`, run `make sync-pages`.
- For workflow `run:` blocks using `set -o pipefail`, never pipe a writer into
  `grep -q` or `head`/`sed q` (SIGPIPE exits 141); use `<<< "$var"` and
  `awk 'NR==1'` instead, and rehearse the block locally with the same shell flags.

For each behavior fix, include a test that fails before and passes after. Prefer
structural prevention over prose: runtime pins, dependency removal, schema
checks, or validation. Avoid global version pins when a workflow-local pin
fixes the incompatibility with less collateral risk.

Exercise the real path, not just mocks. Run `make precommit-fix` on the
finished tree before opening a PR (if other uncommitted work sits in the tree,
run `make gate` + `make precommit` instead so `precommit-fix`'s trailing
`git add -u` does not stage foreign edits; if `tools/` or `.agents/skills/` were
changed, also run `python3 -m pytest tools/__tests__/`). If a local command
exceeds its execution cap, complete every remaining phase separately and report
exactly that—never claim a capped command returned green. Check the final diff
for formatter damage, scratch artifacts, and unrelated edits.

## 4. Ship without pausing

- Create one real conventional commit (`type(scope): summary`, lower-case scope,
  <= 72 chars); do not push empty/no-op commits.
- Push the branch and open a non-draft PR unless the change has a visual surface
  requiring human review (in that case open a draft PR and state "visual review
  required by a human").
- Use a conventional PR title and include **What & why**, **Verification**
  (exact command output), and **Visual?** (`no visual surface` or
  `visual — human review required (draft)`) in the PR body.
- Wait for all required checks (`CI` / `web-ci`, coverage floor, and hygiene
  checks). If red, inspect logs, fix on the same branch, rerun the gate,
  amend/squash, and force-push with lease.
- Squash-merge only after required checks pass. Confirm the merged SHA through
  GitHub rather than inferring success from a button click.
- Confirm the local tree is clean, switch to `master`, and run:

```bash
git pull --rebase origin master
```

Do not delete branches or worktrees while they contain unshipped or foreign work.

## 5. Execute the fixed workflow

Dispatch or observe the workflow on merged `master` (`ci.yml` and `pages.yml`
trigger on push to `master`; `mirror-check.yml`, `mutation.yml`, and
`pages.yml` support `workflow_dispatch`); do not treat rerunning the old failed
SHA as proof of the fix. Resolve and record the new run number and ID from its
head SHA. Monitor every material stage:

- `ci.yml`: empty-PR/bot-hygiene guards, pre-commit hooks, ESLint/`tsc`/Stylelint/Prettier,
  and full `npm test` + `coverage/coverage-summary.json` artifact upload.
- `pages.yml`: `sw.js` cache-name stamp, `upload-pages-artifact`, and
  `deploy-pages` (including the retry step if invoked).
- `mirror-check.yml`: live page `data-fallbacks` and CSP `img-src`, mirror HTTP
  200, byte-size parity with primary, hotlink 403, and missing-object 404.
- `mutation.yml`: incremental cache restore, `npx stryker run`, and
  `mutation-report` artifact upload (non-blocking by design).

If this run fails, return to step 2 with its new logs and continue automatically.
Respect external rate limits and use bounded backoff rather than tight polling
or retry loops. Do not weaken checks or manually mark a run successful.

## 6. Verify deployment, mirror state, and artifacts

Confirm the live or generated outputs produced by the fixed workflow:

- **GitHub Pages (`pages.yml`):** confirm the deploy run for the latest `master`
  SHA completed (note `cancel-in-progress: true` can cancel earlier deploys
  during rapid merges) and verify the deployed site serves the expected commit
  and stamped `sw.js` cache version.
- **OSS image fallback mirror (`mirror-check.yml`):** if the failure came from
  missing or stale derived `.avif`/`.webp` tiers on the OSS bucket rather than a
  workflow bug, sync them via `make sync-mirror` (`scripts/sync-mirror.sh`,
  which requires `aliyun` CLI and bucket credentials) before dispatching a fresh
  `mirror-check.yml` run; report missing credentials as a blocker rather than
  weakening probes.
- **Generated portfolio pages / artifacts:** if `scripts/templates/portfolio-shell.html`
  or `assets/img/p*/index.md` changed, confirm `make sync-pages-check` passed and
  the updated `p*/index.html` files landed in the merged commit; for
  `mutation.yml`, confirm the `mutation-report` artifact uploaded cleanly.

## 7. Finish only with evidence

The rescue is incomplete until the fixed workflow has actually succeeded on the
fixed ref and required deployment/mirror/artifact checks are verified. If an
external limitation or missing secret blocks part of recovery, report that exact
gap rather than claiming full recovery.

Respond with:

1. root cause and failing step;
2. code/config fix and regression evidence (commands and outputs);
3. PR number and merge commit on `master` (or transient rerun ID if no code change);
4. fresh run number/ID and result on merged `master`;
5. deployment, mirror, or artifact verification result;
6. any external limitation or unrecovered gap, without guarantees that every
   future third-party outage is impossible.

Clean up temporary worktrees/branches and diagnostic files. Update the todo list
and re-anchor from `git status` and `git log` before reporting completion.
