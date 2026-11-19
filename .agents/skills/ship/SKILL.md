---
name: ship
description: Ship a branch — fix quality failures, squash-merge to master, and delete the branch
argument-hint: '<branch_name>'
---

Ship branch **{{args}}** into `master`:

1. **Sync:** `git fetch origin`, check out `{{args}}` (or use its existing
   worktree from `git worktree list`), and pull `origin/{{args}}` if tracked.
2. **Pass quality checks on the branch:** run `make check` (apply `make fmt` /
   `make fix` if formatting or lint fails) and `make test`. Commit any fixes
   with a descriptive Conventional Commits subject.
3. **Squash-merge into `master`** from the primary checkout (first entry in
   `git worktree list`):
    - `git checkout master && git pull origin master`
    - `git merge --squash {{args}}`
    - Resolve any conflicts (`git status`, edit, `git add <file>`), then commit
      once with a single Conventional Commits subject describing the whole
      change.
4. **Final verification on `master`:** run `make check` and `make test`.
5. **Confirm and push:** ask the user for acknowledgement before pushing, then
   `git push origin master`.
6. **Cleanup:**
    - Remove any linked worktree for the branch (`git worktree remove <path>`).
    - Delete the local branch: `git branch -d {{args}}` (after a squash merge,
      use `git branch -D {{args}}` once pushed and nothing unshipped remains).
    - Delete the remote branch if it exists:
      `git push origin --delete {{args}}` (if a pre-push hook mistakes the
      delete for history rewriting, retry alone with
      `git push --no-verify origin --delete {{args}}`).
7. **Report:** summarize commits created, gate results, conflicts resolved, and
   branches/worktrees cleaned up.
