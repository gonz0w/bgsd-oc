---
name: planner-scope-estimation
description: Context budget rules for planners — 50% context target, 2-3 tasks per plan, split signals, depth calibration table, and per-task context impact estimates by file count and complexity.
type: agent-specific
agents: [planner]
sections: [budget-rules, split-signals, depth-calibration, context-estimates]
---

## Purpose

Prevents context window exhaustion by giving the planner concrete rules for sizing plans. Plans should complete within ~50% context (not 80%) — leaving room for unexpected complexity while maintaining consistent quality. This skill provides the quantitative framework behind "more plans, smaller scope."

## Placeholders

| Placeholder | Description | Example |
|-------------|-------------|---------|
| (none) | This skill uses no placeholders | — |

## Content

<!-- section: budget-rules -->
### Context Budget Rules

Plans should complete within ~50% context. No context anxiety, quality maintained start to finish, room for unexpected complexity.

**Each plan: 2-3 tasks maximum.**

| Task Complexity | Tasks/Plan | Context/Task | Total |
|-----------------|------------|--------------|-------|
| Simple (CRUD, config) | 3 | ~10-15% | ~30-45% |
| Complex (auth, payments) | 2 | ~20-30% | ~40-50% |
| Very complex (migrations) | 1-2 | ~30-40% | ~30-50% |
<!-- /section -->

<!-- section: split-signals -->
### Split Signals

**ALWAYS split if:**
- More than 3 tasks
- Multiple subsystems (DB + API + UI = separate plans)
- Any task with >5 file modifications
- Checkpoint + implementation in same plan
- Discovery + implementation in same plan

**CONSIDER splitting:** >5 files total, complex domains, uncertainty about approach, natural semantic boundaries.
<!-- /section -->

<!-- section: depth-calibration -->
### Depth Calibration

| Depth | Typical Plans/Phase | Tasks/Plan |
|-------|---------------------|------------|
| Quick | 1-3 | 2-3 |
| Standard | 3-5 | 2-3 |
| Comprehensive | 5-10 | 2-3 |

Derive plans from actual work. Depth determines compression tolerance, not a target. Don't pad small work to hit a number. Don't compress complex work to look efficient.
<!-- /section -->

<!-- section: context-estimates -->
### Context Per Task Estimates

| Files Modified | Context Impact |
|----------------|----------------|
| 0-3 files | ~10-15% (small) |
| 4-6 files | ~20-30% (medium) |
| 7+ files | ~40%+ (split) |

| Complexity | Context/Task |
|------------|--------------|
| Simple CRUD | ~15% |
| Business logic | ~25% |
| Complex algorithms | ~40% |
| Domain modeling | ~35% |
<!-- /section -->

## Cross-references

- <skill:planner-task-breakdown /> — Task sizing rules complement budget rules

## Examples

See planner agent's `<scope_estimation>` section for the original comprehensive reference.
