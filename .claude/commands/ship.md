---
description: Ship current work or a branch — pass quality gates, land on master, push, and clean up
argument-hint: '[branch_name]'
---

Ship `$ARGUMENTS` (or the current working-tree / branch work when `$ARGUMENTS` is empty) to `origin/master`. Invoking `/ship` is explicit user authorization to stage the task's named files, commit, push `origin master`, and clean up merged branches through to the end — pause only if you hit a merge conflict on foreign files or unexpected uncommitted edits belonging to someone else.

1. **Determine mode & sync remote:**
    - Run `git fetch origin` and `git status -sb`.
    - **Direct-on-`master` mode** (`$ARGUMENTS` is empty and current branch is `master`): fast-forward onto `origin/master` with `git merge --ff-only origin/master` (not `git pull`, which fails under `pull.rebase=true` when unstaged edits exist). If non-fast-forward or overlapping files exist, commit the task's named files first, then rebase onto `origin/master`.
    - **Branch mode** (`$ARGUMENTS` names a branch, or current branch is not `master`): check out that branch (or its existing worktree from `git worktree list`) and pull `origin/<branch>` if tracked.
2. **Pass quality gates:**
    - Run `make gate` (`make check` + `make test`, which avoids `git add -u` when foreign edits sit in the tree; apply scoped `prettier` / `eslint --fix` / `make sync-pages` if needed).
    - Stage only the task's changed files by explicit path (`git add <file> ...`) and commit with a compliant Conventional Commits subject + ~72-col body.
3. **Land on `master` (branch mode only):**
    - From the primary checkout (first entry in `git worktree list`): `git checkout master && git merge --ff-only origin/master && git merge --squash <branch>`.
    - Resolve any conflicts on your own files, commit once with a Conventional Commits subject, and re-run `make check` and `make test`.
4. **Push:**
    - Verify `git show --stat HEAD`, then `git push origin master`.
5. **Cleanup (branch mode only):**
    - Remove any linked worktree (`git worktree remove <path>`).
    - Delete the local branch (`git branch -D <branch>` after verifying everything is in `origin/master`).
    - Delete the remote branch if present (`git push origin --delete <branch>`; retry with `git push --no-verify origin --delete <branch>` if a pre-push hook misidentifies the delete).
6. **Report:** summarize commit hash, gate results, conflicts resolved (if any), and branches/worktrees cleaned up.
