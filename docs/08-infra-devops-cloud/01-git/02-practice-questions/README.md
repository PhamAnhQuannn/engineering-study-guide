# Git Deep — Practice Questions

> Topic: Rebase, bisect, conflict resolution, workflows.

[← Topic overview](../README.md)

A mix of recall, "explain to a junior", and multiple-choice. Try to answer before expanding the reasoning.

---

### Q1. What is the difference between `git merge` and `git rebase`, and when would you choose each?

**Answer:** `merge` creates a new commit with two parents that joins both histories — it preserves exactly what happened and produces a non-linear graph. `rebase` replays your commits one-by-one onto a new base, producing brand-new commits (new SHAs) and a linear history; the originals become orphaned (recoverable via reflog).

Choose **rebase** to clean up *local, un-pushed* work before review, or to keep a feature branch up to date with `main` linearly. Choose **merge** to integrate a finished branch into `main` while preserving history, and **always** on shared/public branches. The Golden Rule: never rebase commits others have already pulled.

---

### Q2. Explain `git reset --soft`, `--mixed`, and `--hard` to a junior.

**Answer:** All three move your current branch pointer to a target commit. They differ in what they do to the staging area (index) and your working files:
- `--soft`: moves the pointer only. Staged + working changes are untouched — everything from the discarded commits is now staged, ready to recommit. Use to "redo the last commit message/contents".
- `--mixed` (default): moves the pointer and resets the index, but keeps working files. Your changes become *unstaged* edits. Use to "unstage but keep my work".
- `--hard`: moves the pointer and overwrites both index and working tree. **Uncommitted changes are gone.** Use only to throw work away.

Mnemonic: soft = pointer, mixed = pointer + index, hard = pointer + index + files.

---

### Q3. You pushed a broken commit to `main` an hour ago and others have pulled it. How do you undo it?

**Answer:** Use `git revert <sha>`, which creates a *new* commit that inverts the change, then push that. It's safe because it doesn't rewrite history others already have. Do **not** `git reset` + force-push on a shared branch — that rewrites public history and forces everyone into recovery. If it was a merge commit, `git revert -m 1 <sha>` to pick the mainline parent, and remember re-merging that branch later needs care.

---

### Q4. A bug shipped sometime in the last 800 commits. How do you find which commit introduced it?

**Answer:** `git bisect` — a binary search. `git bisect start`, mark the current commit `bad` and a known-good tag `good`; Git checks out the midpoint, you test and mark good/bad, repeating ~`log2(800) ≈ 10` times. Better: write a script that exits 0 for good / non-zero for bad and run `git bisect run ./test.sh` to fully automate it. Use `git bisect skip` for commits that don't build. `git bisect reset` when done.

---

### Q5. What does `git reflog` do and why is it your safety net?

**Answer:** It records every position `HEAD` has pointed at — across commits, resets, rebases, amends, checkouts — for roughly 90 days. Commits orphaned by a bad rebase or `reset --hard` are still in the object store and reachable through the reflog. To recover: `git reflog`, find the SHA from before the mistake, then `git reset --hard <sha>` or `git branch rescue <sha>`. Objects only vanish when `git gc` prunes unreachable ones.

---

### Q6. Why does rebasing change commit SHAs but a fast-forward merge does not?

**Answer:** A commit's SHA is a hash of its content: its tree, its parent SHA(s), author/committer, timestamps, and message. Rebase gives each replayed commit a *new parent*, so its hash necessarily changes, cascading to all descendants. A fast-forward merge creates no new commits at all — it just advances the branch pointer to an existing commit — so nothing is rehashed.

---

### Q7. What is `--force-with-lease` and why prefer it over `--force`?

**Answer:** Both let you push a rewritten history. `--force` overwrites the remote branch unconditionally — if a teammate pushed in the meantime, you silently destroy their commits. `--force-with-lease` first checks that the remote ref is still at the SHA you last observed; if someone else pushed, it aborts. It's the safe way to publish a rebased/amended branch you own.

---

### Q8. Explain the three-way merge and conflict markers to a junior.

**Answer:** When merging, Git finds the common ancestor (merge base) of the two branches and compares each side against it. Where both sides changed the *same region* differently, Git can't decide and emits a conflict with markers: `<<<<<<<` (ours/HEAD), `=======`, `>>>>>>>` (theirs). You edit to the correct combined result, delete the markers, `git add` the file, then `git merge --continue`. Turning on `merge.conflictStyle=zdiff3` shows the original base text too, which makes intent much clearer than the default two-way view.

---

### Q9 (MCQ). Which command creates a commit that inverts a previous commit without rewriting history?

A. `git reset --hard`  B. `git revert`  C. `git rebase -i`  D. `git checkout`

**Answer: B.** `git revert` appends a new inverse commit — safe on shared branches. A and C rewrite history; D just moves HEAD.

---

### Q10 (MCQ). During an interactive rebase, which action combines a commit into the previous one but *discards* its commit message?

A. `squash`  B. `reword`  C. `fixup`  D. `edit`

**Answer: C.** `fixup` merges the change into the prior commit and drops its message. `squash` keeps and lets you edit both messages; `reword` only edits a message; `edit` pauses to amend.

---

### Q11 (MCQ). What is the time complexity of `git bisect` over N commits?

A. O(N)  B. O(N log N)  C. O(log N)  D. O(1)

**Answer: C.** It binary-searches the commit range, halving it each step → about log2(N) tests.

---

### Q12 (MCQ). Adding a path to `.gitignore` for a file that is **already tracked** will:

A. Immediately stop tracking and delete it  
B. Have no effect on the already-tracked file  
C. Unstage it but keep it in the working tree  
D. Cause a merge conflict

**Answer: B.** `.gitignore` only affects *untracked* files. To stop tracking, run `git rm --cached <file>` and commit; the gitignore then keeps it from being re-added.

---

### Q13. What does `git cherry-pick` do, and name a real use case.

**Answer:** It applies the *diff introduced by a specific commit* onto your current branch as a new commit (new SHA). Use case: a critical bug is fixed on `main` and you need to backport just that fix onto a `release/1.4` branch without bringing everything else on `main`. Watch for conflicts and for duplicating a change that later gets merged normally.

---

### Q14. Why is reverting a merge commit tricky?

**Answer:** A merge commit has two parents; `git revert` needs `-m 1` (or `-m 2`) to know which parent is the "mainline" to revert toward. The revert undoes the merged changes, but Git still records that the branch *was* merged. So if you later fix the feature branch and try to merge it again, Git sees those commits as already merged and won't re-apply them — you have to revert-the-revert or rebase. This catches many teams off guard.
