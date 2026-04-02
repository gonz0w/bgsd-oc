# Engineering Design Document: JJ-First UX and Bookmark-Based Branch Handling

**Document:** EDD-003
**Author:** Cam / OpenCode (collaborative)
**Status:** Draft — ready for milestone creation
**Scope:** bgsd-oc CLI, workflows, docs, and runtime guidance for JJ-first user experience and proper bookmark-based branch handling
**Date:** 2026-04-02
**Depends on:** v17.0 JJ Workspaces, Intent Cascade & Command Simplification; v19.0 Workspace Execution, cmux Coordination & Risk-Based Testing

---

## 1. Executive Summary

bGSD has already moved execution onto JJ workspaces, but the product experience is still split-brain.

- Execution surfaces use `jj workspace` and even create bookmarks in `workflows/execute-phase.md`.
- Many other commands, help surfaces, and internal checks still talk in Git terms: `util:git`, branch names, detached HEAD, stash, rebase, and tag-first release language.
- In colocated JJ repos, a detached Git HEAD is expected behavior, but parts of bGSD still treat it as an error condition or degraded state.

This creates a bad UX and a bad architecture at the same time:

1. Users are told bGSD is JJ-first, but many surfaces still teach or require Git mental models.
2. Repo health checks report "Detached HEAD" even when JJ is working normally.
3. Branch-oriented features are implemented with Git branches, while execution already prefers JJ bookmarks and JJ workspaces.

This EDD proposes a narrow, high-leverage change set:

1. Make the user-facing UX consistently JJ-first.
2. Treat **JJ bookmarks as the canonical branch abstraction**.
3. Stop treating Git detached HEAD as a primary error in colocated JJ workflows.
4. Keep Git as a compatibility backend for now, but hide it behind JJ-oriented concepts.

This does **not** attempt to solve tags, GitHub release semantics, native-JJ storage, or full Git removal. Those are deliberately deferred.

---

## 2. Problem Statement

### 2.1 Current split-brain UX

The codebase currently presents two competing models:

- **JJ model**
  - `src/lib/jj.js`
  - `src/lib/jj-workspace.js`
  - `src/commands/workspace.js`
  - `workflows/execute-phase.md` step `handle_branching` uses `jj bookmark create` / `jj bookmark set`

- **Git model**
  - `src/lib/git.js`
  - `src/commands/misc/git-helpers.js`
  - `src/commands/trajectory.js`
  - `src/lib/constants.js` exposes `util:git`
  - config keys still say `branching_strategy`, `phase_branch_template`, `milestone_branch_template` under a `git` section

The result is that users and agents have to guess which vocabulary is canonical in a given surface.

### 2.2 Detached HEAD is being interpreted incorrectly

JJ docs explicitly state that in colocated workspaces Git will often be in a detached HEAD state because JJ has no concept of an active or checked-out branch. That is normal, not broken.

But `src/commands/misc/git-helpers.js` still does this during pre-commit validation:

- `git symbolic-ref -q HEAD`
- if it fails, it records `Detached HEAD.` as a failure

That is the wrong default for a JJ-first system. In a colocated JJ repo, detached HEAD should be treated as expected unless a specific Git-only operation requires otherwise.

### 2.3 Branch handling is conceptually wrong for JJ

JJ's bookmark docs are clear:

- bookmarks are named pointers similar to Git branches
- there is no active/current/checked-out bookmark
- bookmark movement and remote tracking are the right primitives for branch-like behavior

Today bGSD mixes three incompatible ideas:

1. Git branch naming as if a checked-out branch is the unit of work
2. JJ bookmarks in execution workflow only
3. Git detached-HEAD checks that assume a branch must be checked out locally

That mismatch is why we keep seeing detached HEAD instead of a "branch": the system is using JJ, but some logic still expects Git semantics.

---

## 3. Goals and Non-Goals

### 3.1 Goals

1. Make bGSD's user-facing UX JJ-first across CLI help, workflows, prompts, and docs.
2. Define a canonical branch abstraction for bGSD: **bookmark**.
3. Ensure colocated JJ repos are treated as healthy even when Git reports detached HEAD.
4. Replace branch-handling decisions with bookmark-handling decisions where possible.
5. Preserve current milestone and execution velocity by minimizing scope and avoiding backend rewrites.

### 3.2 Non-Goals

1. Removing Git from storage or remote interop.
2. Replacing Git tags or release semantics.
3. Rewriting every Git-backed utility in this phase.
4. Solving full GitHub PR/release/bookmark automation end-to-end.
5. Converting all historical metadata fields away from git hashes in this phase.

---

## 4. External Ground Truth

### 4.1 JJ bookmarks, not checked-out branches

JJ bookmark docs define bookmarks as named pointers to revisions, analogous to branches, but explicitly state there is **no concept of an active/current/checked-out bookmark**.

Implication for bGSD:

- We should not require a checked-out branch as proof of healthy branch state.
- We should model planning and execution ownership as bookmark presence and movement, not Git branch checkout state.

### 4.2 Detached HEAD is normal in colocated JJ workspaces

JJ's GitHub and Git compatibility docs explicitly note that colocated JJ/Git workspaces commonly leave Git in detached HEAD because JJ does not use the Git branch-as-current-workspace model.

Implication for bGSD:

- "Detached HEAD" is not a universal failure.
- Any health check that blocks on detached HEAD in a JJ-backed repo is conceptually wrong unless the operation is explicitly Git-only.

### 4.3 Remote branch interop still maps through bookmarks

JJ maps bookmarks to Git branches when pushing and fetching.

Implication for bGSD:

- We can keep Git compatibility while presenting bookmark-first UX.
- The correct user-facing language is "bookmark" locally and "remote branch/bookmark mapping" only when talking about push/fetch interop.

---

## 5. Current State in bGSD

### 5.1 Good: execution already has a JJ-shaped model

`workflows/execute-phase.md` already creates or updates a bookmark during `handle_branching`:

```bash
jj bookmark create "$BRANCH_NAME" -r @ 2>/dev/null || jj bookmark set "$BRANCH_NAME" -r @
```

`workspace add`, `workspace prove`, and `workspace reconcile` all use JJ-native workspace semantics.

This is the right direction.

### 5.2 Bad: commit and status surfaces are still Git-first

`src/commands/misc/git-helpers.js`:

- performs shallow clone checks via Git
- blocks on detached HEAD via Git
- stages files with `git add`
- commits with `git commit`
- uses JJ only as a fallback when Git repo state is considered bad

This makes JJ feel like the exception path instead of the primary path.

### 5.3 Bad: user-facing command surface still advertises Git as canonical

`src/lib/constants.js` still exposes:

- `util:git log`
- `util:git diff-summary`
- `util:git blame`
- `util:git branch-info`
- `util:git rewind`
- `util:git trajectory-branch`

`execute:commit` help text still says:

- `Commit planning documents to git.`

That language directly conflicts with the current JJ execution story.

### 5.4 Bad: trajectory engineering is implemented as Git branch engineering

`src/commands/trajectory.js` currently creates named Git branches like:

- `trajectory/<scope>/<name>/attempt-N`

This is a Git-native implementation of what should conceptually be bookmark-based checkpointing in a JJ-first repo.

---

## 6. Proposed Product Model

### 6.1 Canonical vocabulary

bGSD should adopt this vocabulary everywhere user-facing:

- **bookmark**: the local named pointer for a line of work
- **tracked bookmark**: bookmark associated with a remote bookmark
- **workspace**: JJ working copy for isolated execution
- **change/commit**: revision history unit
- **branch**: compatibility term used only when describing Git remote interop

Rules:

1. Use `bookmark` for local ownership and routing.
2. Use `branch` only when discussing GitHub/Git remote mapping.
3. Never require a checked-out branch as a health invariant in JJ-backed repos.

### 6.2 Canonical branch abstraction

bGSD should define an internal concept called **logical branch** with this mapping:

- logical branch = JJ bookmark name
- remote branch = exported Git branch corresponding to that bookmark

This keeps the external concept understandable while making the implementation JJ-native.

### 6.3 Health model for JJ-backed repos

For any JJ-backed repo:

- `jj root` succeeding is the first health check
- `jj status` and bookmark/workspace state are primary diagnostics
- Git detached HEAD is **informational**, not blocking

Only Git-only surfaces may care about checked-out branch state, and those cases must say so explicitly.

---

## 7. Proposed Changes

### 7.1 Phase A: JJ-first UX normalization

This phase changes terminology and surfaced guidance without large backend risk.

#### 7.1.1 Replace Git-first guidance in help and workflows

Update user-facing help and workflow text so that:

- `util:git` is deprecated in docs/help in favor of a new neutral or JJ-first namespace later
- `execute:commit` no longer says "commit planning documents to git"
- workflow instructions say "create/update bookmark" instead of "create branch" where local ownership is meant
- detached-HEAD warnings are removed from generic guidance for JJ-backed repos

#### 7.1.2 Clarify colocated detached HEAD in docs

Add explicit guidance to bGSD docs and runtime help:

- in a colocated JJ repo, Git detached HEAD is expected
- users should inspect `jj bookmark list`, `jj status`, and `jj log`, not `git branch`, to understand current state

#### 7.1.3 Rename configuration semantics at the UX layer

Current config names can remain for compatibility in this phase, but surfaced language should change:

- `branching_strategy` -> displayed as `bookmark_strategy`
- `phase_branch_template` -> displayed as `phase_bookmark_template`
- `milestone_branch_template` -> displayed as `milestone_bookmark_template`

No config migration is required in this phase; only the presentation layer changes.

### 7.2 Phase B: Bookmark-first branch handling

This phase changes decision and runtime behavior.

#### 7.2.1 Add bookmark status/intel helper

Introduce a JJ-native helper surface, likely `src/lib/jj.js` expansion or a new `src/lib/jj-bookmarks.js`, that can answer:

- is this a JJ-backed repo?
- what local bookmarks exist?
- does bookmark `{name}` exist?
- is bookmark `{name}` tracked?
- what revision does bookmark `{name}` point to?
- is bookmark `{name}` conflicted?

This replaces the need to infer health from `git branch` or `git symbolic-ref`.

#### 7.2.2 Replace detached-HEAD blocking in `execute:commit`

`src/commands/misc/git-helpers.js` should change from:

- detached HEAD = failure

to:

- detached HEAD in JJ-backed repo = allowed
- detached HEAD in pure Git repo = existing behavior can remain

This is the single most important correctness fix for the branch-state UX.

#### 7.2.3 Define bookmark lifecycle for phase and milestone work

When `handle_branching` decides a logical branch is needed, the system should:

1. Compute canonical bookmark name
2. `jj bookmark create <name> -r @` if absent
3. `jj bookmark set <name> -r @` if present
4. optionally mark it tracked when remote participation is intended

The existence and health of that bookmark, not Git checkout state, become the invariant.

#### 7.2.4 Add bookmark-oriented branch decision output

Existing decision outputs like `branch_name` should evolve to include:

```json
{
  "bookmark_name": "bgsd/phase-184-deterministic-finalize",
  "bookmark_action": "create|set|reuse|skip",
  "tracked_remote": "origin|null",
  "git_branch_mapping": "same-as-bookmark-name"
}
```

This lets workflows stay explicit about what is local JJ truth versus exported Git compatibility.

### 7.3 Phase C: Trajectory and branch-heavy features move to bookmarks

`src/commands/trajectory.js` should stop creating Git branches directly for checkpoints.

Instead:

1. Checkpoint attempts become bookmarks in a dedicated namespace.
2. Archived attempts can remain a later design problem.
3. User-facing output talks about checkpoint bookmarks, not checkpoint branches.

Suggested naming:

- `trajectory/<scope>/<name>/attempt-N`

The name can stay; only the primitive changes from Git branch to JJ bookmark.

---

## 8. Technical Design

### 8.1 Repo mode classification

Add an explicit repo mode classifier with three states:

1. `git-only`
2. `jj-backed-colocated`
3. `jj-backed-non-colocated`

Behavioral rules:

- `git-only`: existing Git assumptions allowed
- `jj-backed-*`: bookmark/workspace semantics are primary; detached HEAD is not blocking

### 8.2 Bookmark API surface

Proposed minimal helper API:

```js
getRepoMode(cwd)
listBookmarks(cwd, { all = false, tracked = false })
getBookmark(cwd, name)
ensureBookmarkAtWorkingCopy(cwd, name)
moveBookmark(cwd, name, revset)
trackBookmark(cwd, name, remote)
bookmarkHealth(cwd, name)
```

These helpers should wrap `jj bookmark list/create/set/move/track` and normalize output for workflows.

### 8.3 Commit helper behavior

`execute:commit` should become mode-aware:

- In `git-only` repos, current Git path can remain.
- In `jj-backed-*` repos, JJ should be the default path.
- Git can remain the backend for hash lookup or compatibility metadata if needed, but not the primary mental model.

That means current fallback logic should be inverted:

- today: Git primary, JJ fallback
- target: JJ primary, Git compatibility fallback only when needed

### 8.4 Command surface evolution

Recommended progression:

1. Add `util:jj` or `util:vcs`
2. Keep `util:git` as compatibility alias for one milestone
3. Change help, workflows, and docs to prefer the new surface immediately
4. Later remove or narrow `util:git`

This avoids a flag day while fixing the UX now.

---

## 9. UX Rules

### 9.1 What users should see

Users should see guidance like:

- `jj status`
- `jj bookmark list`
- `jj log -r 'bookmarks() | @'`
- `jj workspace list`

Users should not routinely see guidance like:

- `git branch`
- `git checkout <branch>`
- `Detached HEAD` as a generic warning in JJ-backed repos

### 9.2 What agents should say

Agents should describe work like this:

- "Created bookmark `bgsd/phase-184-deterministic-finalize`"
- "Updated bookmark to the current change"
- "Workspace proof failed; downgraded to sequential execution"

Agents should avoid:

- "Checked out branch"
- "You are detached from a branch"
- "Create a Git branch" unless the task is explicitly remote/Git interop

---

## 10. Migration Plan

### Wave 1: Correctness and messaging

1. Remove detached-HEAD blocking for JJ-backed repos in `src/commands/misc/git-helpers.js`
2. Update help text and workflow wording to say bookmark/JJ-first
3. Add explicit colocated-detached-HEAD explanation to docs and guidance

### Wave 2: Decision and helper layer

1. Add bookmark helper API
2. Extend init payloads and decisions with bookmark-aware fields
3. Switch branch handling logic to consume bookmark fields as canonical

### Wave 3: Branch-heavy feature migration

1. Move trajectory checkpointing from Git branches to JJ bookmarks
2. Introduce `util:jj` or `util:vcs`
3. De-emphasize `util:git` in all surfaced docs

---

## 11. Risks

### 11.1 User confusion during transition

Risk:

- some users still think in Git branch terms

Mitigation:

- use language like "bookmark (JJ's branch-like pointer)" for one milestone

### 11.2 Compatibility drift between JJ truth and Git exports

Risk:

- a bookmark exists locally but remote export state is unclear

Mitigation:

- make remote tracking explicit in diagnostics
- keep remote-interaction commands clearly separated from local ownership commands

### 11.3 Partial migration creates more inconsistency

Risk:

- some surfaces say bookmark while others still say branch

Mitigation:

- prioritize user-facing help/workflow/docs changes first
- keep a checklist of all surfaced branch terms and convert them in one milestone

---

## 12. Acceptance Criteria

This EDD is satisfied when all of the following are true:

1. In a JJ-backed colocated repo, `execute:commit` no longer blocks solely because Git is in detached HEAD.
2. User-facing execution and planning guidance consistently use JJ/bookmark language for local ownership.
3. `handle_branching` and related decision payloads treat bookmark names as canonical local branch state.
4. bGSD docs explicitly explain that detached HEAD is expected in colocated JJ repos.
5. At least one branch-heavy feature currently implemented with Git branches has been migrated to bookmarks or has an approved follow-up design ready.

---

## 13. Recommended Milestone Shape

This should be implemented as a small milestone with 2-3 plans:

1. **JJ repo-state correctness**
   Fix detached-HEAD handling and invert JJ/Git commit-path priority for JJ-backed repos.

2. **JJ-first UX normalization**
   Update help text, workflow wording, init surfaces, and docs to use bookmark-first language.

3. **Bookmark helper and trajectory migration**
   Add bookmark-intel helpers and migrate the first branch-heavy feature away from Git branches.

---

## 14. Deferred Topics

These are intentionally deferred:

- full removal of Git CLI usage
- release/tag redesign
- native JJ storage without Git backend
- full replacement of git-hash metadata fields
- GitHub PR flow redesign

Those can be handled in a later EDD once JJ-first UX and bookmark semantics are stable.
