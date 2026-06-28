---
name: ship
description: Ship a branch — fix quality failures, merge to main, and delete the branch
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

3. **Merge into Main:**
    - Switch to master: `git checkout master`
    - Pull latest: `git pull origin master`
    - Merge the branch: `git merge {{args}}`
    - **Conflict Resolution:** If conflicts occur:
        - List conflicted files: `git status`.
        - Read and resolve each conflict manually or using tools.
        - Add resolved files: `git add <file>`.
        - Complete the merge: `git commit`.

4. **Final Verification:**
    - Run `make check` and `make test` on the merged `master` branch to ensure no regressions.

5. **Cleanup:**
    - **Ask for acknowledgement before pushing changes.**
    - Push master: `git push origin master`.
    - Delete the local branch: `git branch -d {{args}}`.
    - Delete the remote branch: `git push origin --delete {{args}}`.

6. **Report:**
    - Summarize the actions taken, including any conflicts resolved.
