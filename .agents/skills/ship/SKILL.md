---
name: ship
description: Ship a branch — fix quality failures, merge to main, and delete the branch
argument-hint: '<branch_name>'
---

You are tasked with shipping the branch: **{{args}}**.

Follow these steps precisely:

1. **Checkout and Sync:**
    - Fetch all branches: `git fetch origin`
    - Checkout the branch: `git checkout {{args}}`
    - Ensure it's up to date: `git pull origin {{args}}`

2. **Fix Quality and CI Failures:**
    - Run checks: `make check`.
    - If it fails due to formatting, fix it: `make fmt`.
    - Run all tests: `make test`.
    - Verify everything is clean: `make check`.
    - If changes were made, commit them: `git commit -am "style: fix quality failures"`.

3. **Merge into Main (prefer a squash merge):**
    - Switch to master: `git checkout master`
    - Pull latest: `git pull origin master`
    - Squash-merge the branch: `git merge --squash {{args}}` — one clean commit
      on master, no matter how messy the branch history is.
    - Commit once with a single conventional-commit message describing the
      whole change (e.g. reuse the branch's main commit subject): `git commit`.
    - **Conflict Resolution:** If conflicts occur:
        - List conflicted files: `git status`.
        - Read and resolve each conflict manually or using tools.
        - Add resolved files: `git add <file>`.
        - Complete the commit: `git commit`.

4. **Final Verification:**
    - Run `make check` and `make test` on the merged `master` branch to ensure no regressions.

5. **Cleanup:**
    - **Ask for acknowledgement before pushing changes.**
    - Push master: `git push origin master`.
    - Delete the local branch: `git branch -d {{args}}`. After a squash merge
      Git does not consider the branch merged, so `-d` refuses — use
      `git branch -D {{args}}` once the squash commit is pushed and you are
      sure nothing unshipped remains.
    - Delete the remote branch: `git push origin --delete {{args}}`. If a
      pre-push hook mistakes the delete for history rewriting, retry the
      delete alone with `git push --no-verify origin --delete {{args}}`.

6. **Report:**
    - Summarize the actions taken, including any conflicts resolved.
