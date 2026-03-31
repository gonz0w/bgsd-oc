# Phase 155: JJ Execution Gate & Workspace Lifecycle - Research

**Researched:** 2026-03-29
**Domain:** JJ-backed execution gating and workspace lifecycle migration
**Confidence:** HIGH

## User Constraints

- Fail fast not only on execution starts, but also on execute-oriented init/context surfaces in Git-only repos. Read-only planning/help flows stay allowed.
- Hard-remove the old worktree command surface. Do not keep compatibility aliases or migration shims.
- Use a dedicated top-level `workspace` command family as the canonical lifecycle surface. Do not hide it under `execute:*`.
- Hard-reject legacy `worktree` config. Do not silently map or tolerate it.
- Make the supported local parallel story visibly JJ-first now, while leaving deeper wave semantics, stale-workspace recovery, and planner workspace-awareness to later phases.
- Use predictable phase/plan-derived workspace names and paths.
- Keep machine output structured. Keep default human output scan-friendly but richer than a terse one-line listing.

## Phase Requirements

| Requirement | What this phase must make true |
|-------------|--------------------------------|
| JJ-01 | Execution workflows and execution-oriented init surfaces fail clearly when the repo is not initialized for JJ-backed execution |
| JJ-02 | bGSD exposes JJ-native workspace lifecycle commands and removes Git worktree execution commands as the supported parallel backend |

## Summary

This phase is mostly a surface and contract migration, not a full execution-backend redesign. The current codebase still models parallel execution around Git worktrees: `src/commands/worktree.js` implements create/list/remove/cleanup/merge/check-overlap, `src/commands/init.js` injects `worktree_*` fields into `init:execute-phase`, `workflows/execute-phase.md` switches into a "Mode A: Worktree-based parallel" path, and help/discovery/router tables all advertise `execute:worktree`. Tests are equally worktree-shaped in `tests/worktree.test.cjs`. Planning should treat this as a coordinated rename-and-rewire effort across CLI routing, init context, workflow wording, config validation, and tests.

Official JJ behavior strongly supports the product direction. `jj` 0.39.0 has native `workspace add`, `workspace list`, `workspace forget`, `workspace root`, and `workspace update-stale` commands. JJ docs explicitly say Git `git-worktree` is not supported and that `jj workspace` is the native replacement. In a plain Git repo, `jj root` and `jj workspace list` fail with a useful hint: "There is no jj repo... Hint: It looks like this is a git repo. You can create a jj repo backed by it by running this: `jj git init`". That gives bGSD an authoritative supported setup path and a good default error shape for JJ-required gating.

The best planning posture is: add one shared JJ capability gate, replace worktree-shaped user surfaces with workspace-shaped ones everywhere users can start execution, and keep the first-phase workspace backend intentionally narrow. For this phase, prefer a minimal, deterministic workspace lifecycle wrapper over ambitious reconcile/recovery logic. Deeper stale handling, operation-log diagnostics, and richer parallel-wave semantics belong to Phase 156 by roadmap design.

**Primary recommendation:** Plan Phase 155 as a coordinated contract migration: shared JJ prerequisite detection + top-level `workspace` command family + execution/init/help/context rewiring + hard rejection of legacy `worktree` config + test replacement.

## Existing Codebase Reality

### Primary touchpoints

| Area | Current state | Planning implication |
|------|---------------|----------------------|
| `src/commands/worktree.js` | Full Git worktree CRUD, sync, branch naming, merge-tree dry-run, cleanup | Main replacement target for JJ workspace command wrappers |
| `src/commands/init.js` | Emits `worktree_enabled`, `worktree_config`, `worktree_active`, `file_overlaps` | Init contract must become JJ/workspace-first and enforce JJ gate |
| `workflows/execute-phase.md` | Describes `Mode A: Worktree-based parallel` and `execute:worktree ...` commands | Workflow text and orchestration contract must be renamed and re-shaped |
| `src/router.js`, `src/lib/constants.js`, `src/lib/command-help.js`, `src/lib/commandDiscovery.js` | Register and document `execute:worktree` | New top-level `workspace` family needs routing/help/discovery updates |
| `tests/worktree.test.cjs` | Large worktree-specific command and init coverage | Existing test investment should be ported, not discarded |
| `src/lib/constants.js` `CONFIG_SCHEMA` | No schema-backed worktree settings; current worktree config is ad hoc raw JSON | Legacy config rejection must be explicit and centrally validated |

### Scope boundary to preserve

- Do not plan stale-workspace recovery, operation-log wrappers, or planner workspace-awareness here; roadmap assigns those to later phases.
- Do not keep any user-facing Git worktree fallback. Sequential execution remains allowed, but the advertised parallel path must be JJ-first.
- Do not widen this phase into generic JJ adoption across all commands. The gate is for execution and execution-oriented init flows.

## Standard Stack

### Core

| Library / Tool | Version | Purpose | Why Standard |
|----------------|---------|---------|--------------|
| Jujutsu CLI (`jj`) | 0.39.x observed locally | Repo detection, workspace lifecycle, future stale recovery | Official native backend for multi-workspace local execution |
| Node.js single-file CLI (`src/` -> `bin/bgsd-tools.cjs`) | repo standard | Command routing, init payloads, config validation | Existing bGSD architecture requires all changes to fit this CLI |
| Git-backed JJ repo / colocation | current JJ model | Underlying storage and remote interoperability | JJ docs position Git as backing/interoperability layer, not local execution orchestration |

### Supporting

| Library / Tool | Version | Purpose | When to Use |
|----------------|---------|---------|-------------|
| `jj root` / `jj workspace list` | 0.39.x | Detect whether cwd is JJ-backed | Use for execution gating instead of filesystem heuristics |
| `jj git init` | 0.39.x | Supported setup path for Git-only repos | Reference in JJ-required failure guidance |
| `jj workspace add` | 0.39.x | Create isolated execution workspace | Use for create/add flow |
| `jj workspace list` | 0.39.x | Inspect tracked workspaces | Use for human + JSON inspect/list output |
| `jj workspace forget` | 0.39.x | Stop tracking workspace metadata | Use for forget/cleanup lifecycle; pair with disk deletion in bGSD wrapper |
| `jj workspace root --name <name>` | 0.39.x | Resolve path for named workspace | Use when bGSD needs exact path lookup |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Shared JJ gate via `jj root`/`jj workspace list` | Filesystem checks for `.jj/` | More brittle; misses JJ's own supported error/hint behavior |
| Top-level `workspace` command family | Keep `execute:worktree` or hide under `execute:workspace` | Violates locked command-surface reset and keeps the old model mentally alive |
| Hard rejection of legacy `worktree` config | Silent mapping to new config | Easier short term, but violates explicit JJ-first contract and hides unsupported states |
| Narrow phase-155 workspace wrapper | Full stale-recovery + op-log UX now | Reopens Phase 156 scope and increases planner risk |

## Architecture Patterns

### Recommended Project Structure

- Add a shared JJ execution-capability helper in `src/lib/` or `src/commands/` that answers: `jj_installed`, `jj_repo`, `git_only_repo`, `setup_hint`.
- Replace `src/commands/worktree.js` with a JJ-native workspace command module rather than layering new behavior on top of Git worktree code.
- Rename execution init/context fields to `workspace_*`-style names so workflows and help stop teaching the old backend.
- Update router/help/discovery tables in one slice so `/help`, aliases, and command discovery all flip together.
- Port `tests/worktree.test.cjs` into a workspace-focused test file using real temp repos and real `jj` commands, preserving the current level of lifecycle coverage.

### Pattern 1: Shared JJ Prerequisite Gate

Use one helper that runs a cheap authoritative JJ command and classifies the repo state:

- `jj` missing -> execution blocked with install/setup guidance.
- `jj` installed but cwd is Git-only -> execution blocked with JJ-required guidance and `jj git init` setup hint.
- JJ-backed repo -> execution/init may continue.

Apply that helper to:

- `init:execute-phase`
- execution-oriented quick/init surfaces if they lead directly into execution
- any workflow bootstrap that currently assumes execution can start from plain Git

Do not apply it to planning, roadmap, help, or read-only inspection commands.

### Pattern 2: bGSD `workspace` Wrapper Over Native JJ Commands

Expose a bGSD top-level `workspace` family that mirrors JJ-native concepts instead of worktree concepts:

- `workspace add <plan-id>` -> wraps `jj workspace add`
- `workspace list` -> wraps `jj workspace list`
- `workspace forget <plan-id|name>` -> wraps `jj workspace forget`
- `workspace cleanup` -> bGSD convenience wrapper: forget tracked execution workspaces and remove their directories from disk
- `workspace reconcile <plan-id|name>` -> bGSD wrapper for the minimal phase-155 integration path, documented as the supported first-pass integrate step

Recommended naming rule: use stable workspace names derived from phase/plan, and keep a deterministic mapping to on-disk paths under a JJ-focused base directory.

### Pattern 3: Narrow First-Pass Reconcile Contract

For this phase, choose one simple integration story and document it clearly. Recommended default: create sibling execution workspaces from the same parent topology, then reconcile in deterministic order with JJ-native revision/bookmark operations through one bGSD wrapper. Avoid trying to solve stale workspaces, divergent rewrites, or multiple reconcile strategies here.

The planner should prefer a wrapper contract that can be strengthened in Phase 156 without renaming it.

### Pattern 4: Rich-by-Default Inspect Output

Human output should include enough debugging context to avoid dumping raw JJ internals. Recommended default fields:

- workspace name
- plan id
- filesystem path
- current change/revision short ID
- first-line description
- whether the workspace is the current/default one

JSON output should preserve machine-friendly fields for later orchestration and tests.

### Anti-Patterns to Avoid

- Keeping `execute:worktree` as an alias, hidden alias, or internal help reference.
- Detecting JJ readiness only by checking for `.jj/` on disk.
- Leaving old `worktree_*` context fields in user-facing workflows after the surface reset.
- Modeling JJ workspaces as Git branches with a new label.
- Mixing phase-155 command-surface migration with phase-156 stale recovery and op-log UX.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| JJ repo detection | `.jj` path sniffing or Git-only heuristics | `jj root` / `jj workspace list` exit status and stderr hint | Official behavior already distinguishes Git-only repos and suggests `jj git init` |
| Workspace lifecycle | Manual directory copy / custom checkout logic | `jj workspace add`, `jj workspace list`, `jj workspace forget`, `jj workspace root` | Native JJ semantics already model shared-repo multiple working copies |
| Setup guidance | Custom guessed bootstrap instructions | JJ's own supported path: `jj git init` | Matches actual CLI hint shown in Git-only repos |
| Parallel backend naming | New "worktree but actually JJ" vocabulary | Explicit `workspace` terminology | Product goal is a visible JJ-first reset |
| Future stale handling | Ad hoc stale heuristics in this phase | Later use `jj workspace update-stale` and op-log tools in Phase 156 | JJ already has native stale concepts; roadmap defers full UX |

## Common Pitfalls

### Pitfall 1: Gating only `/bgsd-execute-phase`

**What goes wrong:** Users can still enter execution-oriented flows from Git-only repos and only fail later.
**Why it happens:** Implementers gate the obvious command but forget hot init/context entrypoints.
**How to avoid:** Identify every execution bootstrap that prepares execution state, and apply the same shared JJ gate there.
**Warning signs:** `init:execute-phase` or quick-execution bootstraps still succeed in a plain Git temp repo.

### Pitfall 2: Replacing the backend but leaving worktree words everywhere

**What goes wrong:** Help, workflow text, context keys, and tests still teach the old model.
**Why it happens:** Only command code changes, while discovery/help/workflow assets are missed.
**How to avoid:** Plan one explicit surface-audit task across router, constants, command discovery, workflows, and tests.
**Warning signs:** `execute:worktree` still appears in help output or `worktree_enabled` still appears in init JSON.

### Pitfall 3: Assuming `forget` deletes workspace files

**What goes wrong:** Tracked workspace metadata disappears but directories remain on disk.
**Why it happens:** JJ `workspace forget` intentionally only stops tracking the workspace.
**How to avoid:** Make bGSD `workspace cleanup` a two-step wrapper: forget in JJ, then remove the filesystem directory.
**Warning signs:** `workspace list` is empty but old execution directories remain under the base path.

### Pitfall 4: Hiding legacy `worktree` config instead of rejecting it

**What goes wrong:** Users think old config still works, but runtime behavior becomes ambiguous.
**Why it happens:** Silent migration feels convenient during implementation.
**How to avoid:** Validate config early and fail with a clear migration error if `worktree` is present.
**Warning signs:** Repos with `worktree.enabled` continue to run without any migration message.

### Pitfall 5: Letting Phase 155 absorb Phase 156 scope

**What goes wrong:** Planning balloons into stale recovery, op-log wrappers, and advanced reconcile logic.
**Why it happens:** JJ workspaces naturally lead into those topics.
**How to avoid:** Treat this phase as gate + command surface + first-pass workspace lifecycle only.
**Warning signs:** Plan tasks start mentioning `jj operation log`, stale recovery UX, or planner workspace-awareness.

## Code Examples

Verified patterns from official sources and local CLI behavior.

### Detect JJ-backed repo with authoritative CLI behavior

```bash
jj root
```

In a Git-only repo, JJ currently returns:

```text
Error: There is no jj repo in "..."
Hint: It looks like this is a git repo. You can create a jj repo backed by it by running this:
jj git init
```

### Create an execution workspace with an explicit name

```bash
jj workspace add "/path/to/workspaces/155-01" --name "155-01"
```

### List tracked workspaces

```bash
jj workspace list
```

Example shape observed locally:

```text
default: uzpssmsn 69f9897a (empty) (no description set)
155-01: nzvrxpmu 77f99422 (empty) (no description set)
```

### Forget a workspace when finished

```bash
jj workspace forget 155-01
```

### Recover a stale workspace later (deferred to Phase 156)

```bash
jj workspace update-stale
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Git worktree CRUD + branch naming + merge-back | JJ workspace lifecycle (`add`, `list`, `forget`, `update-stale`) | Available in current JJ docs / CLI 0.39.x | bGSD should stop modeling local execution as Git branch/worktree management |
| Filesystem/config heuristics for backend assumptions | CLI-level JJ detection with useful Git-only hint | Current JJ behavior | Lets bGSD fail clearly and point to `jj git init` |
| Worktree cleanup means remove branch + path | JJ forget separates metadata from disk cleanup | Current JJ behavior | bGSD needs an explicit cleanup wrapper, not a one-command assumption |

## Assertions Assessment

No `.planning/ASSERTIONS.md` file exists, so there are no pre-existing assertions for JJ-01 or JJ-02.

Planner implication: Phase 155 should likely end with assertions that prove at least:

- execution/init surfaces fail in a Git-only repo with JJ-required guidance
- old `execute:worktree` help/routing is gone
- new `workspace` commands create/list/forget/cleanup successfully in a JJ-backed temp repo
- legacy `worktree` config is rejected explicitly

## Open Questions

- Which exact execution-oriented init surfaces besides `init:execute-phase` should be gated in Phase 155 versus Phase 156? `quick` is the main boundary to decide explicitly during planning.
- What exact new config key shape should replace legacy `worktree`? Recommendation: choose one JJ-first block and validate it centrally in this phase.
- How much of `workspace reconcile` should be executable in Phase 155 versus documented/narrow wrapper behavior pending Phase 156?

## Sources

### Primary (HIGH confidence)

- Local codebase: `src/commands/worktree.js`, `src/commands/init.js`, `src/router.js`, `src/lib/constants.js`, `src/lib/command-help.js`, `workflows/execute-phase.md`, `tests/worktree.test.cjs`
- Local JJ CLI 0.39.0 help: `jj help workspace`, `jj help workspace add`, `jj help workspace list`, `jj help workspace forget`, `jj help workspace root`, `jj help workspace update-stale`
- JJ official CLI reference: https://jj-vcs.github.io/jj/latest/cli-reference/
- JJ official Git compatibility docs: https://jj-vcs.github.io/jj/latest/git-compatibility/
- JJ official working copy docs: https://jj-vcs.github.io/jj/latest/working-copy/

### Secondary (MEDIUM confidence)

- JJ official tutorial: https://jj-vcs.github.io/jj/latest/tutorial/
- JJ official install/setup docs: https://jj-vcs.github.io/jj/latest/install-and-setup/
- Product intent doc: `.planning/research/jj-workspace-execution-prd.md`

### Tertiary (LOW confidence)

- None needed for core recommendations.

## Metadata

**Confidence breakdown:** HIGH for JJ command surface, Git-only failure shape, and current bGSD touchpoints; MEDIUM for exact best `workspace reconcile` contract because roadmap intentionally defers deeper semantics to Phase 156.  
**Research date:** 2026-03-29  
**Valid until:** Re-check if JJ major/minor command semantics change or if Phase 156 lands first and alters the intended reconcile contract.
