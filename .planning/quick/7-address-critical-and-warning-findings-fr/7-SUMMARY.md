---
phase: quick-7
plan: 01
subsystem: plugin-quality
tags: [audit, cleanup, deploy, documentation, agents]
dependency_graph:
  requires: [quick-6-review]
  provides: [clean-audit-findings]
  affects: [AGENTS.md, README.md, docs/commands.md, deploy.sh, build.js, commands/, agents/, workflows/]
tech_stack:
  added: []
  patterns: [thin-command-wrappers, workflow-extraction, tool-grant-standardization]
key_files:
  created:
    - workflows/debug.md
  modified:
    - AGENTS.md
    - README.md
    - docs/commands.md
    - deploy.sh
    - build.js
    - commands/bgsd-plan-phase.md
    - commands/bgsd-reapply-patches.md
    - commands/bgsd-debug.md
    - commands/bgsd-research-phase.md
    - agents/gsd-debugger.md
    - agents/gsd-phase-researcher.md
    - agents/gsd-project-researcher.md
    - workflows/research-phase.md
    - bin/manifest.json
    - bin/gsd-tools.cjs
decisions:
  - Remove bgsd-join-discord ghost command (no file exists) rather than create it
  - Remove agent frontmatter from bgsd-plan-phase.md (it's an orchestrator spawning multiple agents)
  - Use webfetch as tool grant name (matches MCP tool available in runtime)
  - Preserve CLI websearch references in agent bodies (gsd-tools.cjs subcommand, not OpenCode tool)
metrics:
  duration: 16 min
  completed: 2026-03-07
  tasks: 2
  files: 16
---

# Quick Task 7: Address Critical and Warning Findings Summary

Fix 2 critical and 5 warning findings from OpenCode best practices audit (6-REVIEW.md), bringing plugin into full compliance with OpenCode conventions.

## What Was Done

### Task 1: Fix critical issues and documentation references (cb788b7)

**Critical Finding 1.1 — Ghost command purged:**
- Removed `/bgsd-join-discord` from AGENTS.md (line 101), README.md (line 176), and docs/commands.md (lines 492-501)
- Updated command counts from 41 to 40 in AGENTS.md, README.md (2 locations), and docs/commands.md
- Renamed "Todo & Community" section to "Todo & Maintenance" in README.md

**Critical Finding 3.2 — Deploy directory naming fixed:**
- Changed `CMD_DIR` from singular `command` to plural `commands` in deploy.sh (line 27)
- Added backward migration logic: detects old `command/` directory, renames to `commands/` if new dir doesn't exist, otherwise warns

### Task 2: Fix warning-level findings (015b9c5)

**Finding 1.3 — Inconsistent agent frontmatter:**
- Removed `agent: gsd-planner` from bgsd-plan-phase.md frontmatter (it's an orchestrator that spawns both gsd-planner and gsd-plan-checker)

**Finding 1.7 — Inline process logic extracted to workflows:**
- bgsd-debug.md reduced from 157 lines to 28 lines (thin wrapper)
- Created new workflows/debug.md with extracted process logic (spawn templates, checkpoint handling, continuation logic)
- bgsd-research-phase.md reduced from 183 lines to 32 lines (thin wrapper)
- Updated workflows/research-phase.md with richer spawn templates, key_insight block, downstream_consumer section, and continuation logic from command file

**Finding 1.8 — Structural inconsistency:**
- Changed `<purpose>` to `<objective>` in bgsd-reapply-patches.md

**Finding 2.5 — Tool grant name:**
- Changed `websearch: true` to `webfetch: true` in 3 agent files (gsd-debugger, gsd-phase-researcher, gsd-project-researcher)
- Left CLI `gsd-tools.cjs websearch` references unchanged (correct CLI subcommand, not OpenCode tool)

**Finding 5.5 — Deploy manifest:**
- Removed `collectFiles('src', () => true)` from build.js
- Manifest now contains 0 src/ entries (was deploying all source files unnecessarily)
- Manifest reduced from ~180 files to 144 files

## Deviations from Plan

None — plan executed exactly as written.

## Verification Results

| Check | Result |
|-------|--------|
| No join-discord references | ✅ 0 matches in AGENTS.md, README.md, docs/commands.md |
| Command counts updated to 40 | ✅ All 4 locations updated |
| deploy.sh uses plural commands/ | ✅ CMD_DIR="/opencode/commands" |
| Migration logic added | ✅ OLD_CMD_DIR detection and rename |
| No agent: in bgsd-plan-phase.md | ✅ Removed |
| bgsd-debug.md thin wrapper | ✅ 28 lines |
| bgsd-research-phase.md thin wrapper | ✅ 32 lines |
| workflows/debug.md exists | ✅ Created |
| bgsd-reapply-patches.md uses objective | ✅ `<objective>` tag |
| webfetch: true in 3 agents | ✅ All 3 updated |
| No src/ in manifest | ✅ 0 entries |
| Build succeeds | ✅ 1163KB within 1500KB budget |
| Tests pass | ✅ 735/767 (32 pre-existing failures, 0 new) |

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | cb788b7 | fix: remove ghost bgsd-join-discord and fix deploy directory |
| 2 | 015b9c5 | refactor: fix warning-level audit findings |

## Self-Check: PASSED

- All created/modified files verified on disk
- Both commits (cb788b7, 015b9c5) found in git log
