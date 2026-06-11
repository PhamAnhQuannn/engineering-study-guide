# Git Deep — Knowledge / Study Notes

> Topic: Rebase, bisect, conflict resolution, workflows.

[← Topic overview](../README.md)

> **🛒 Where we are in building ShopFast** — Last topic we enforced [clean-code standards](../../../06-code-quality-and-architecture/05-clean-code/01-knowledge/README.md) so the codebase is readable and reviewable. Now we need a shared version-control workflow so the 4-person ShopFast team can collaborate without stepping on each other, track every change, and recover from mistakes. **Next:** once we have a branch strategy, we wire it to [CI/CD (Continuous Integration / Continuous Delivery)](../../02-cicd/01-knowledge/README.md) so every push is automatically tested and deployed.

---

## Teaching arc: version-controlling ShopFast

### What it is

**Git** is a distributed version-control system — it tracks every snapshot of your project so you can collaborate, branch, and undo without fear.

Analogy: think of Git as a ledger in a law firm. Every entry is **immutable and signed** (the SHA-1 / SHA-256 hash). You can never erase an old entry — you can only add a new one that says "this reverses that". Multiple clerks (engineers) keep full copies of the ledger; they sync changes in batches. The ledger's history is your safety net: as long as it was ever committed, it is recoverable.

### Why we use it

Without Git (or with Git used badly) a 4-person team hits these problems:

- **"It worked on my machine"** — no shared history, so nobody knows whose change broke the build.
- **"I overwrite your fix"** — two people edit the same file; the last `cp` wins.
- **"We can't roll back"** — a bad deploy has no known-good checkpoint to return to.
- **"Who changed this and why?"** — `git log` and `git blame` answer instantly; ad-hoc folders do not.

Git solves all four by making every change a first-class, traceable, reversible object.

### What it looks like

The three commands every engineer runs every day:

```bash
# 1. Create a feature branch (never commit straight to main)
git checkout -b feat/add-product-search

# 2. Make changes, stage them, commit with a clear message
git add src/catalog/search.ts
git commit -m "feat(catalog): add full-text search endpoint"

# 3. Keep the branch current to reduce merge pain
git fetch origin
git rebase origin/main   # replay your commits on top of latest main
```

Recovering from a broken rebase in under 30 seconds:

```bash
git rebase --abort          # bail out mid-rebase, back to where you were
git reflog                  # show every position HEAD has been in ~90 days
git reset --hard HEAD@{3}   # jump back to a specific reflog entry
```

### ShopFast setup

ShopFast's 4-person team uses **GitHub Flow** (simpler than Git flow, correct for a continuously-deployed web service):

```
main  ← always deployable; protected branch; direct push blocked
  └── feat/catalog-search     (1 engineer, <2 days)
  └── fix/cart-race-condition  (1 engineer, <1 day)
  └── chore/upgrade-postgres   (1 engineer, <1 day)
```

Branch-protection rules on `main`:

```yaml
# .github/branch-protection (conceptual — set in GitHub UI)
required_status_checks:
  - ci/build-and-test          # must pass before merge
  - ci/lint
required_reviews: 1            # at least one teammate approval
dismiss_stale_reviews: true    # new push invalidates old approvals
enforce_admins: true           # no bypassing, even for the tech lead
```

**PR (Pull Request) merge strategy:** **squash-merge** onto `main`. One tidy commit per feature keeps `git bisect` fast and `git log --oneline` readable.

**Tagging releases:** every production deploy gets an annotated tag:

```bash
git tag -a v1.4.2 -m "Release v1.4.2: product search + cart fix"
git push origin v1.4.2
```

This lets the on-call engineer run `git bisect good v1.4.1 bad HEAD` when a regression appears, and converge in `O(log n)` steps.

### Common failures & how to debug

| Failure | Symptom | Diagnosis command |
|---|---|---|
| Force-push clobbered a teammate's commit | Their work disappeared from `main` | `git log --oneline origin/main` vs `git reflog origin/main` |
| Rebase created duplicates | Double commits in PR history | `git log --oneline --graph` — look for cherries appearing twice |
| `git pull` made a merge commit on a feature branch | Tangled history | `git log --oneline --graph origin/main..HEAD` |
| "diverged" error on push | Local and remote have incompatible histories | `git fetch && git rebase origin/main` |
| Deleted file didn't free space | Not a Git issue — open FD (see Linux topic) | `lsof \| grep deleted` |
| "Nothing to commit" after `git add` | File is in `.gitignore` | `git check-ignore -v <file>` |
| Lost work after `reset --hard` | Panic | `git reflog` → find SHA → `git checkout -b rescue <sha>` |

Critical gotcha: **`--force-with-lease` not `--force`**. `--force` silently clobbers whatever is on the remote; `--force-with-lease` refuses if the remote has moved since you last fetched — it's the only safe way to force-push a rebased branch.

```bash
# safe force-push after rebase
git push --force-with-lease origin feat/catalog-search
```

### Types & differences

| Workflow | Shape | Reach for it when |
|---|---|---|
| **Trunk-based** | Everyone commits to `main` (or very short-lived branches) | High-velocity CD teams; feature flags handle incomplete work |
| **GitHub Flow** | Feature branch → PR → merge to `main` | Continuous-delivery web services (**ShopFast's choice**) |
| **Git flow** | `develop` + `main` + `release/*` + `hotfix/*` | Scheduled/versioned releases (installed software, mobile apps) |
| **Forking workflow** | Contributors fork, PR from fork | Open source (contributors lack push access) |

| Merge strategy | History | Reach for it when |
|---|---|---|
| **Squash merge** | One commit per PR, clean `main` | Default for small teams; `bisect`-friendly |
| **Merge commit (`--no-ff`)** | Preserves all PR commits + merge node | Need to see intra-PR granularity; easy revert of entire feature |
| **Rebase merge** | Linear, no merge node, rewrites SHAs | Want linear history without squashing; careful — rewrites SHAs |

---

Git is a content-addressable filesystem with a VCS UI bolted on top. To reason about rebase, bisect, conflicts, and recovery at a senior level you have to understand the object model underneath the porcelain commands.

---

## 1. The object model (the thing that explains everything)

Git stores four object types, each addressed by the SHA-1 (or SHA-256 in newer repos) of its contents:

- **blob** — file contents (no name, no mode).
- **tree** — a directory listing: names → (mode, blob/tree SHA). Trees give files their names.
- **commit** — a snapshot pointer: one root tree SHA, zero-or-more **parent** commit SHAs, author/committer, message.
- **tag** (annotated) — a named, signed pointer to an object.

Key consequences:

- A commit is a **full snapshot** (via its tree), not a diff. Diffs are *computed* between two trees on demand. This is why `git log -p` and `git show` are computations, not stored data.
- **Identical content de-duplicates.** Two files with the same bytes share one blob. A revert that restores old content reuses the old blob.
- **A commit's SHA depends on its parent(s), tree, message, author, and timestamps.** Change any of them and you get a *new* commit with a new SHA — this is why rebase/amend "rewrite history": they produce new commits, they never mutate existing ones.

**Refs** are just files (or packed entries) containing a SHA: `refs/heads/main`, `refs/tags/v1`, `refs/remotes/origin/main`. `HEAD` is usually a symbolic ref pointing at a branch. A **branch is a movable pointer**, nothing more. "Detached HEAD" = HEAD points directly at a commit, not a branch.

The **index** (a.k.a. staging area / cache) is a binary file (`.git/index`) holding the proposed *next* tree. `git add` writes blobs and updates the index; `git commit` snapshots the index into a tree + commit.

```
working tree --add--> index (staging) --commit--> commit object
```

---

## 2. Merge vs rebase (the central tradeoff)

**Merge** creates a new commit with **two parents**, joining histories. History is preserved exactly as it happened; it becomes non-linear ("railroad tracks" in `git log --graph`).

**Rebase** *replays* your commits onto a new base, producing **brand-new commits** (new SHAs) with a linear history. The original commits become unreferenced (recoverable via reflog until GC).

| Axis | Merge | Rebase |
|---|---|---|
| History shape | Non-linear, true | Linear, idealized |
| SHAs | Preserved | Rewritten |
| Conflict resolution | Once, at the merge | Potentially per-replayed-commit |
| Safe on shared branches | Yes | **No** (rewrites history others have) |
| `git bisect` / blame | Noisier graph | Clean, bisect-friendly |

**The Golden Rule of rebase:** never rebase commits that have been pushed and that others may have based work on. Rewriting public history forces everyone else into painful recovery. Rebasing your *local, un-pushed* work is fine and encouraged.

`git pull --rebase` replays your local commits on top of the fetched upstream instead of creating a merge commit — keeps feature branches clean. `git pull.rebase=true` + `git pull.ff=only` is a common sane default.

### Interactive rebase (`git rebase -i`)
Lets you `pick / reword / edit / squash / fixup / drop / reorder` commits. Used to curate a messy local branch into a clean, reviewable series before opening/merging a PR (Pull Request). `git commit --fixup=<sha>` + `git rebase -i --autosquash` automates squashing fixups into their targets.

### `--no-ff` merges
A fast-forward merge just moves the pointer (no merge commit) when the branch is strictly ahead. `--no-ff` forces a merge commit so the feature's existence is recorded as a unit — useful for release auditing and easy single-commit reverts of an entire feature.

---

## 3. Conflict resolution

A conflict occurs when the **three-way merge** (base = common ancestor, "ours", "theirs") can't reconcile overlapping changes to the same hunk. Git inserts conflict markers:

```
<<<<<<< HEAD (ours)
current branch change
=======
incoming change
>>>>>>> feature (theirs)
```

Mental model for resolving well:
1. Find the **merge base**: `git merge-base A B`. The conflict is about *divergent edits relative to that base*, not about the two tips in isolation.
2. Decide intent per hunk — not blind "take ours/theirs". Often the correct resolution is *both* changes combined.
3. `git checkout --conflict=diff3` (or `merge.conflictStyle=zdiff3`) shows the **base** too, which is far more informative than the 2-way default.
4. `git add` the resolved file, then `git merge --continue` / `git rebase --continue`.
5. **`git rerere`** ("reuse recorded resolution") memorizes how you resolved a conflict so repeated identical conflicts (common during long rebases or recurring merges) auto-resolve. Enable globally for any long-lived branch work.

During a rebase, "ours"/"theirs" are **swapped** relative to a merge (because you're replaying *their* commits onto *your* base), a classic gotcha.

---

## 4. `git bisect` — binary search for a bad commit

Given a known-good and known-bad commit, bisect checks out the midpoint; you test and mark `good`/`bad`; it halves the range each step → `O(log n)` tests to find the first bad commit.

```bash
git bisect start
git bisect bad                 # current is broken
git bisect good v1.4.0         # this tag worked
# git checks out a midpoint; you test:
git bisect bad   # or good / skip
...
git bisect reset               # done; restores original HEAD
```

**Automate it** with a script that exits 0 (good) / 1–124 (bad) / 125 (skip/untestable):
```bash
git bisect run ./test.sh
```
This is the single most powerful debugging tool for "it worked last week" regressions across thousands of commits. `git bisect skip` handles commits that don't build.

---

## 5. Undo / recovery toolbox (know exactly what each does)

| Command | What it changes | Mutates history? | Use case |
|---|---|---|---|
| `git reset --soft <c>` | Moves branch ptr; keeps index + WT | Local only | Re-commit differently |
| `git reset --mixed <c>` (default) | Moves ptr; resets index; keeps WT | Local only | Unstage, keep edits |
| `git reset --hard <c>` | Moves ptr; resets index + WT | Local only; **discards WT** | Nuke local changes |
| `git revert <c>` | New commit that inverts `<c>` | **No** (safe on shared) | Undo a pushed commit |
| `git restore <file>` | Restores file from index/commit | No | Discard file edits |
| `git checkout <c>` | Moves HEAD (detaches) | No | Inspect old state |
| `git commit --amend` | Replaces tip commit | Rewrites tip | Fix last commit |
| `git cherry-pick <c>` | Copies a commit onto current branch | New commit | Backport a fix |

**`git reflog` is the safety net.** It records every position HEAD has held (resets, rebases, amends, checkouts) for ~90 days. Almost any "I destroyed my work" is recoverable: `git reflog`, find the SHA, `git reset --hard <sha>` or `git branch rescue <sha>`. Orphaned commits survive until `git gc` prunes unreachable objects.

**Revert vs reset for *pushed* commits:** use `revert`. Reset + force-push rewrites shared history. Reverting a *merge commit* needs `-m 1` to pick the mainline parent, and re-merging that branch later is tricky (the revert "remembers" the merge as done).

---

## 6. Workflows

- **Trunk-based development** — everyone commits to `main` (or very short-lived branches), behind feature flags, with CI gating. Favors continuous delivery, minimizes merge hell. Dominant at high-velocity orgs.
- **GitHub/GitLab flow** — feature branch → PR (Pull Request) / MR (Merge Request) → review → merge to `main`; `main` is always deployable.
- **Git flow** — `develop` + `main` + `release/*` + `hotfix/*` + `feature/*`. Heavy; suited to scheduled, versioned releases (e.g., installed software), overkill for web services with CD (Continuous Deployment).
- **Forking workflow** — contributors fork, PR from their fork; standard for open source where most contributors lack push access.

**Squash vs merge vs rebase merge on PR:**
- *Squash merge*: one tidy commit per PR; clean `main` history, loses intra-PR granularity.
- *Merge commit*: preserves all commits + a merge node; full history, noisier.
- *Rebase merge*: linear history without a merge node; rewrites PR SHAs.

---

## 7. Plumbing worth knowing

- `git cat-file -p <sha>` / `-t <sha>` — inspect any object's content/type. Great for teaching the model.
- `git rev-parse HEAD~2` — resolve a revision to a SHA. `~` = first-parent ancestor, `^` = specific parent (`HEAD^2` = second parent of a merge).
- `git reflog`, `git fsck --lost-found` — recovery.
- **Packfiles** — Git compresses loose objects into packs with delta encoding; `git gc` runs this. Explains why repo size ≠ sum of file sizes.
- **`.gitignore` doesn't untrack already-tracked files** — use `git rm --cached`.
- `git worktree add` — multiple working trees from one repo (review a PR while keeping your WIP).

---

## Common pitfalls & misconceptions

- "Commits store diffs." They store snapshots; diffs are computed.
- "Rebase is dangerous." Only on *shared* history; locally it's the right tool.
- "`reset --hard` after a bad rebase loses everything." Reflog usually saves you.
- "A branch is heavyweight." It's a 40-byte file.
- Force-pushing with `--force` can clobber teammates' pushes; use **`--force-with-lease`**, which refuses if the remote moved since you last fetched.
- Reverting a merge commit then re-merging silently drops the changes — a recurring production-grade footgun.
- `git pull` defaulting to merge surprises people; configure rebase explicitly.

---

## What interviewers probe

- Can you explain *why* rebase rewrites SHAs (from the object model)?
- Reset `--soft/--mixed/--hard` differences and when each is correct.
- Revert vs reset for **already-pushed** mistakes.
- How you'd find a regression across 2,000 commits (bisect, ideally `bisect run`).
- Recovering a "lost" commit (reflog).
- `--force` vs `--force-with-lease`.
- Merge vs rebase tradeoffs and the Golden Rule.
- Reverting a merge commit and its consequences.

---

## Quick-reference summary

- **Objects:** blob (content) → tree (names) → commit (snapshot + parents) → tag. SHA = identity.
- **Branch = movable pointer; HEAD = where you are.** Detached HEAD = pointing at a commit.
- **Merge** preserves history (2-parent commit); **rebase** rewrites it into a line (new SHAs). Never rebase shared history.
- **Conflicts** = 3-way merge failures; use `diff3`/`zdiff3` and `rerere`.
- **Bisect** = `O(log n)` binary search for the first bad commit; automate with `bisect run`.
- **Undo:** `reset` (local, moves ptr), `revert` (safe, new inverse commit), `reflog` (recover anything ~90 days).
- **Force-push safely** with `--force-with-lease`.
