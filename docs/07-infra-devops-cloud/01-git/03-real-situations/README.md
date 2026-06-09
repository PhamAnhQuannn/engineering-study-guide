# Git Deep — Real-World Situations

> Topic: Rebase, bisect, conflict resolution, workflows.

[← Topic overview](../README.md)

On-the-job Git scenarios. Each follows: **approach → diagnose with data → communicate → root-cause fix → prevention.**

---

### Situation 1 — A teammate force-pushed and erased a day of commits on a shared branch

**Approach:** Don't panic; force-push destroys *refs*, not *objects*. The lost commits are still in the object store and in someone's local reflog.

**Diagnose:** On the machine that had the work (or any clone that fetched it), run `git reflog` and `git reflog show origin/feature`. Identify the SHA the branch pointed at before the bad push. If no local clone has it, check `git fsck --lost-found` on the server or any CI runner that checked it out.

**Communicate:** Immediately tell the team to *stop pushing* to that branch so you don't race. State the recovery SHA you found.

**Root-cause fix:** `git branch -f feature <good-sha>` then `git push --force-with-lease` to restore. Verify CI/diff matches expectation.

**Prevention:** Protect shared branches (require PRs, block force-push, require reviews). Enforce `--force-with-lease` over `--force` in team norms. Enable server-side reflogs / branch protection on the host (GitHub/GitLab).

---

### Situation 2 — A long-running feature branch has 200 conflicting files against `main`

**Approach:** The branch drifted because it lived too long. Rather than one giant merge, rebase incrementally and let Git's tooling do the repetitive work.

**Diagnose:** `git merge-base main feature` to see how far it diverged; `git log --oneline main..feature` and `feature..main` to gauge both sides.

**Communicate:** Tell stakeholders the branch needs an integration day and propose splitting it into smaller mergeable chunks going forward.

**Root-cause fix:** Enable `git rerere` so repeated conflict resolutions are remembered. Rebase onto `main` (or merge if the branch is shared), resolving with `zdiff3` conflict style to see the base. If many conflicts are the same pattern, fix once and `rerere` replays them.

**Prevention:** Keep branches short-lived; merge `main` into the branch (or rebase) daily. Move toward trunk-based development with feature flags so big-bang merges don't happen.

---

### Situation 3 — "It worked last release" — a regression with no obvious cause across 1,500 commits

**Approach:** Binary search beats reading diffs.

**Diagnose:** Reproduce the bug deterministically in a script (`exit 0` good / `exit 1` bad / `exit 125` un-testable). `git bisect start; git bisect bad; git bisect good <last-good-tag>; git bisect run ./repro.sh`. ~11 automated steps pinpoint the first bad commit.

**Communicate:** Share the offending commit, author, and PR with the team — blameless. The commit message + diff usually reveal intent.

**Root-cause fix:** Patch forward with a fix + regression test (don't just revert if other work depends on the commit). If the commit is isolated, `git revert` it.

**Prevention:** Add the failing case to the test suite so CI catches it next time. Investigate why review/tests missed it.

---

### Situation 4 — Secrets (an API key) were committed and pushed to the remote

**Approach:** Treat the secret as **compromised the moment it was pushed** — removing it from history does not un-leak it.

**Diagnose:** `git log -p -S '<key-fragment>'` to find when/where it entered. Check whether the repo is public and whether the key was scraped (provider audit logs).

**Communicate:** Notify security/owner immediately; rotate first, scrub second.

**Root-cause fix:** 1) **Rotate the credential now.** 2) Purge from history with `git filter-repo` (preferred over `filter-branch`) or BFG, then force-push and have everyone re-clone. 3) Invalidate caches/forks where possible.

**Prevention:** Pre-commit secret scanning (gitleaks, trufflehog), server-side push protection, `.gitignore` for env files, and load secrets from a vault/CI secrets store — never from source.

---

### Situation 5 — A bad migration commit needs to come out of `main`, but later commits depend on its files

**Approach:** A plain revert may itself conflict because later commits touched the same files.

**Diagnose:** `git revert <sha>` and inspect conflicts; `git log --oneline <sha>..HEAD -- <paths>` shows what touched those files since.

**Communicate:** Coordinate with whoever owns the dependent commits before rewriting anything.

**Root-cause fix:** Revert and resolve the conflicts to keep the dependent work intact, or craft a targeted forward fix. Avoid `reset` on `main` (shared). Add a test proving the bad behavior is gone.

**Prevention:** Smaller, independently-revertable commits; feature-flag risky migrations; require migration review.

---

### Situation 6 — CI is red because of an accidental merge commit polluting a "linear history" repo

**Approach:** The repo policy is linear history; someone merged instead of rebasing.

**Diagnose:** `git log --graph --oneline` reveals the merge node. Confirm the branch protection rule (squash/rebase-only) was bypassed.

**Communicate:** Note the policy gap to the team rather than blaming the author.

**Root-cause fix:** If unpushed, `git rebase` to flatten. If already on `main`, decide between living with it or a coordinated history fix (rarely worth it on `main`). Often the cleaner path is to enforce the rule going forward.

**Prevention:** Set the host's merge method to "rebase" or "squash" only; enable "require linear history" branch protection so merges are rejected at the gate.

---

### Situation 7 — Two engineers committed the same logical change; one branch is now duplicated after merge

**Approach:** Duplicate commits arise when a cherry-picked or rebased commit later gets merged "normally" too.

**Diagnose:** `git log --oneline` shows two commits with identical diffs; `git cherry main feature` reports which commits are already upstream (marked `-`).

**Communicate:** Agree which copy is canonical.

**Root-cause fix:** Drop the duplicate via interactive rebase (if local) or revert the redundant one (if pushed). Usually one is a no-op diff after the other applied, so it can be safely removed.

**Prevention:** Prefer merging over cherry-picking when possible; if backporting, track it so the same change isn't independently merged. Use `git cherry`/`git patch-id` awareness in process.
