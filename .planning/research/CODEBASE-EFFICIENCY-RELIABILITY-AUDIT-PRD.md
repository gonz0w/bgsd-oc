# Codebase Efficiency and Reliability Audit PRD

**Project:** bGSD Plugin
**Author:** OpenCode
**Date:** 2026-03-29
**Status:** Backlog
**Target window:** First foundation-hardening milestone after the current JJ workspace and command-surface work

## Problem

`bgsd-oc` has grown quickly across CLI, plugin, planning-state, and JJ workspace features. The product works, but the repo now shows a cluster of foundation issues that will get more expensive as future milestones add more parallel execution, richer planning state, and more repo-facing automation.

The audit found five recurring problem shapes:
- repeated subprocess, filesystem, and parsing work in hot paths
- lock-free state and memory updates that assume only one writer at a time
- duplicated parsing, cache, and config logic across command/plugin boundaries
- fragmented logging behavior with inconsistent flags and noisy default-path output
- workspace and handoff flows that scale poorly and have stale-snapshot / race hazards

These are not isolated paper cuts. Together they create avoidable latency, higher regression risk, and a larger surface for subtle state drift once multiple JJ workspaces and concurrent commands become more common.

## Goal

Harden the repo's operational foundation so bGSD can scale parallel JJ execution and future planning features without carrying avoidable inefficiency, coordination hazards, or contract drift.

The work should:
- remove the highest-impact repeated-work hotspots
- make state and memory mutations atomic and coordination-safe
- centralize duplicated parsing/config/storage contracts behind shared helpers
- make logging predictable, testable, and quiet by default
- keep workspace recovery and inventory fast enough for multi-wave execution

## Non-Goals

- Rewriting the whole architecture in one milestone
- Changing the user-facing JJ-first product direction
- Removing useful diagnostics entirely instead of routing them through a coherent logging contract
- Performing speculative micro-optimizations without evidence of repeated work or reliability risk
- Mixing this cleanup into the active milestone's required delivery scope

## User Need

As a maintainer of bGSD, I want the planning, execution, and plugin layers to stay fast and deterministic as the repo adds more parallel work and richer state, so future milestones do not keep paying a tax from duplicated logic, noisy diagnostics, and race-prone writes.

## Why This Belongs In Backlog Now

This audit surfaced real issues, but they are better handled as a dedicated follow-up milestone than as opportunistic fixes during the current roadmap work:
- the current milestone is focused on JJ workspaces, intent cascade, and command simplification, not broad foundation cleanup
- several findings cut across CLI, plugin, storage, and docs, so they need coordinated acceptance criteria rather than ad hoc edits
- concurrency and repeated-work fixes are high leverage, but they should land with explicit regression coverage and contract checks

## Current State Audit

### 1. Workspace inventory and recovery do N+1 JJ subprocess work

- `src/commands/workspace.js:99` shells out for each workspace root.
- `src/commands/workspace.js:104` shells out again for per-workspace log data.
- `src/commands/workspace.js:118` recomputes the current workspace root during each workspace inspection.
- `src/commands/workspace.js:127` maps the entire workspace list through that per-workspace inspection path.
- `src/lib/jj-workspace.js:131` and `src/lib/jj-workspace.js:156` add `jj status` and `jj op log` per workspace.

Result:
- `workspace list`, `workspace inspect`, and cleanup-oriented flows fan out into many subprocesses as workspace count grows.
- the code pays process-startup cost repeatedly even when only a lightweight inventory view is needed.

### 2. Several command paths repeat full scans instead of building one reusable index

- `src/commands/verify.js:1081` loops requirements and rescans `.planning/phases` for summary presence inside the loop.
- `src/commands/init.js:292` re-reads raw config and recomputes workspace metadata instead of consuming one canonical helper.
- `src/commands/features.js:22` uses its own `STATE.md` regex path instead of a shared parsed contract.
- audit evidence also found repeated full-plan scans inside intent and overlap analysis paths.

Result:
- verification and planning helpers do redundant directory reads, parsing, and overlap checks.
- more features now pay repeated-work cost because inventory and derived indexes are not shared.

### 3. State and memory writes are lock-free and non-atomic across stores

- `src/commands/state.js:574` writes SQLite first, then patches `STATE.md` via regex.
- `src/commands/state.js:652` repeats the same two-step write pattern for single-field updates.
- `src/commands/memory.js:395` reads an entire JSON store, mutates it in memory, and rewrites the file.
- `src/commands/memory.js:458` then performs best-effort SQLite dual-write after the file write.
- `src/lib/phase-handoff.js:373` writes a handoff artifact, then deletes sibling runs without any phase-level lock.

Result:
- concurrent commands can overwrite each other's file-backed state, leave markdown and SQLite out of sync, or erase concurrent handoff runs.
- JJ parallelism will expose this more often because the repo is explicitly moving toward more sibling execution.

### 4. Core contracts are duplicated across modules and runtime surfaces

- `src/lib/context.js:257` parses a simplified `STATE.md` shape using raw regexes.
- `src/commands/features.js:22` parses last-activity/session data with its own regexes.
- `src/commands/workspace.js:11` defines workspace defaults and config parsing locally.
- `src/lib/config.js:24` already has the canonical config-loading path.
- `src/lib/planning-cache.js:1062` and `src/plugin/lib/db-cache.js:701` each implement session-state storage APIs with near-duplicate logic.

Result:
- harmless format or schema changes can break one consumer while others keep working.
- CLI and plugin storage behavior can drift because fixes must be applied twice.

### 5. Logging is fragmented, noisy, and not governed by one verbosity contract

- `src/lib/output.js:190` uses `BGSD_DEBUG` for stderr debug logging.
- `src/plugin/command-enricher.js:558` emits per-command debug output on `BGSD_DEBUG` or `NODE_ENV=development`.
- `src/plugin/validation/adapter.js:108` uses `GSD_DEBUG` instead of `BGSD_DEBUG`.
- `src/lib/runtime-capabilities.js:99` emits unconditional warnings on invalid env values.
- `src/plugin/safe-hook.js:111` logs hook failures through the plugin logger and then prints additional console lines.

Result:
- diagnostics are hard to predict or suppress.
- some hot paths produce per-command debug chatter.
- some failures are both noisy and semantically under-surfaced because logging and error handling are mixed together.

## Product Decision

Treat this as a foundation-hardening milestone, not a grab-bag cleanup.

The milestone should prioritize correctness and shared contracts first, then remove the most expensive repeated-work hotspots, then normalize logging and operator ergonomics. The goal is not a broad rewrite; it is to establish a smaller set of canonical execution, state, and diagnostics paths that future milestones can safely build on.

## Proposed Epics

### Epic 1: Atomic state and memory mutation model

Backlog focus:
- add per-project locking for state, memory, workspace-mutation, and handoff writes
- replace lock-free whole-file rewrite paths with atomic temp-file + rename flows where file output remains required
- ensure markdown and SQLite updates happen through one transactional mutation path

Done when:
- concurrent state or memory updates do not lose entries
- handoff writes do not delete sibling runs opportunistically
- markdown and SQLite session views cannot drift on normal mutation paths

### Epic 2: Shared planning and workspace indexes

Backlog focus:
- pre-index phase summaries, plan overlap data, and intent-plan relationships once per command
- batch JJ workspace inventory and defer expensive inspection until needed
- reuse shared changed-file and planning snapshots across `verify:*` style analyzers

Done when:
- verification and workspace commands avoid per-item rescans where one index pass is enough
- workspace inventory cost grows closer to one inventory pass plus targeted probes
- repeated analyzers share the same derived state instead of rebuilding it independently

### Epic 3: Canonical parser/config/storage contracts

Backlog focus:
- create one shared `STATE.md` parser/formatter contract
- centralize workspace config/default resolution behind `src/lib/config.js` or a dedicated helper
- remove duplicated session-state storage logic between CLI and plugin layers

Done when:
- command and plugin surfaces consume one state/config contract
- session-state storage behavior is implemented in one shared core
- future schema changes require one code-path update, not several regex patches

### Epic 4: Logging contract and noise reduction

Backlog focus:
- define one debug/trace contract and one canonical logger interface
- normalize env flags and output channels across CLI and plugin surfaces
- demote routine warnings and hot-path timing output out of default user flows
- make hook/deploy/install failures preserve one clear root-cause diagnostic

Done when:
- stdout remains clean for payloads
- stderr diagnostics follow one flag/verbosity model
- hot-path debug logging is off by default and explicitly opt-in
- failure paths emit one clear actionable diagnostic instead of duplicate lines

### Epic 5: Module-boundary and responsibility cleanup

Backlog focus:
- split oversized command modules by bounded context
- isolate handoff/resume flow behind a smaller explicit state machine
- reduce hidden coupling between planning-state, resume, workspace, and plugin cache layers

Done when:
- major command files have clearer ownership boundaries
- resume and handoff behavior is easier to reason about and test
- architecture no longer depends on multiple near-duplicate implementations of the same contract

## Acceptance Criteria

- Concurrent state, memory, and handoff writes are coordinated and covered by regression tests.
- Workspace inventory and recovery commands no longer perform unnecessary per-workspace subprocess fan-out for simple listing paths.
- `verify`-style planning scans reuse shared indexes instead of rescanning the same directories per requirement or analyzer.
- `STATE.md`, workspace config, and session-state storage each have one canonical contract consumed across CLI and plugin paths.
- Logging behavior is documented and tested around one debug flag / verbosity model with clean stdout semantics.
- Build and test suites pass after the cleanup.

## Risks and Mitigations

### Risk: Cleanup changes hidden contracts relied on by current workflows

Mitigation:
- keep contract tests for CLI output, state parsing, and plugin enrichment behavior
- land shared helpers first, then migrate callers incrementally

### Risk: Concurrency fixes overcomplicate a mostly local CLI

Mitigation:
- focus on the specific shared artifacts already touched by parallel JJ execution and plugin background activity
- prefer small explicit locks and transactional wrappers over broad infrastructure changes

### Risk: Logging cleanup removes useful diagnostics

Mitigation:
- move diagnostics behind explicit verbosity levels rather than deleting them
- keep stderr for diagnostics and stdout for payloads as the tested contract

## Suggested Milestone Sequence

1. Introduce shared state/config/storage contracts
2. Add locking and atomic mutation paths
3. Batch or cache repeated workspace/planning scans
4. Normalize logging and failure surfacing
5. Split remaining oversized or duplicated modules

## Suggested Acceptance Guidance For The Milestone Planner

- Start with correctness-critical race and drift issues before performance polish.
- Treat duplicated parser/storage contracts as product risk, not code-style cleanup.
- Require before/after evidence for any hotspot optimization so the milestone ships measurable improvement rather than speculative cleanup.
