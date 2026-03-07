---
phase: quick-6
plan: 01
subsystem: plugin-audit
tags: [audit, best-practices, opencode, plugin-review]
dependency_graph:
  requires: []
  provides: [opencode-best-practices-audit]
  affects: [deploy.sh, commands/, agents/, AGENTS.md, README.md]
tech_stack:
  added: []
  patterns: [plugin-audit-methodology]
key_files:
  created:
    - .planning/quick/6-review-plugin-and-ensure-it-follows-best/6-REVIEW.md
  modified: []
decisions:
  - "bGSD's CLI-through-bash architecture is a strength, not a gap vs plugin API"
  - "Hybrid approach recommended: keep markdown commands/agents, add thin npm plugin for bootstrapping"
  - "deploy.sh should use plural commands/ directory per OpenCode convention"
metrics:
  duration: 3 min
  completed: 2026-03-07
  tasks: 1
  files: 1
---

# Quick Task 6: bGSD Plugin OpenCode Best Practices Audit Summary

Comprehensive 347-line audit report covering 5 plugin surface areas with 17 severity-rated findings, 8 documented strengths, and prioritized action items for aligning bGSD with OpenCode's evolving plugin ecosystem.

## What Was Done

### Task 1: Audit plugin structure against OpenCode best practices

**Commit:** `655639d`

Performed full audit across 5 areas:

1. **Commands (40 files):** All have required `description` frontmatter. Found ghost `bgsd-join-discord` command referenced in docs but missing file (critical). Only 1/40 uses `agent` frontmatter. Two commands embed inline logic instead of referencing workflows.

2. **Agents (9 files):** All compliant with `mode: subagent`, `description`, and `color`. Tool grant `websearch` may be non-standard (should be `web_search`). No agents declare `model` defaults.

3. **Configuration:** No `opencode.json` exists. Deploy target uses deprecated singular `command/` instead of plural `commands/` (critical). Symlink workaround for auth mangling is well-documented and effective.

4. **Plugin API:** bGSD's file-copy deployment is fundamentally different from OpenCode's `@opencode-ai/plugin` system. Hybrid approach recommended — keep markdown architecture, add thin bootstrapping plugin for `session.created` and compaction hooks.

5. **Deployment:** Manifest-based deployment with rollback is robust. Source files (`src/`) deployed unnecessarily. No npm distribution path exists.

## Findings Summary

| Severity | Count |
|----------|-------|
| Critical | 2 |
| Warning | 8 |
| Info | 7 |

**Critical items:**
- Missing `commands/bgsd-join-discord.md` (referenced in AGENTS.md and README.md)
- `deploy.sh` uses singular `command/` directory instead of plural `commands/`

## Decisions Made

1. bGSD's CLI-first architecture (gsd-tools.cjs invoked via bash) is a portable strength — no change to plugin API model recommended
2. Hybrid approach is the recommended evolution path: keep markdown agents/commands, add thin npm plugin for session bootstrapping
3. `deploy.sh` should immediately update to plural `commands/` directory

## Deviations from Plan

None — plan executed exactly as written.

## Output

- **Review report:** `.planning/quick/6-review-plugin-and-ensure-it-follows-best/6-REVIEW.md` (347 lines)

## Self-Check: PASSED

- [x] 6-REVIEW.md exists (347 lines, above 100 minimum)
- [x] Commit 655639d verified in git log
- [x] All 5 audit areas covered
- [x] 17 findings (above 10 minimum), each with severity + recommendation
- [x] Executive summary with counts
- [x] Strengths section (8 items)
- [x] Prioritized action items
