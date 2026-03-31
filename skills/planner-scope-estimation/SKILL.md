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

<!-- section: parallelization_detection -->
### Parallelization Detection

Identify which plans can run simultaneously:

**1. File conflict analysis:**
- Same files modified = cannot parallelize
- Check `files_modified` in plan frontmatter
- If Plan A and B both modify `bin/bgsd-tools.cjs` → sequential required

**2. Resource conflict analysis:**
- Shared state: global variables, singletons, module-level caches
- Database: same table writes
- External services: rate limits, shared credentials

**3. Hybrid approach:**
- Analyze both file conflicts AND resource conflicts
- File conflicts are definitive (observable)
- Resource conflicts require domain knowledge

**CLI for conflict detection:**
```bash
bgsd-tools verify:verify plan-wave <phase-dir>
```

Shows file conflicts within each wave and warns about unsafe parallelization.
<!-- /section -->

<!-- section: wave_analysis -->
### Wave Analysis CLI

Use the CLI tool to validate wave assignments:

```bash
bgsd-tools verify:verify plan-wave <phase-dir>
```

**Output includes:**
- Phase identifier
- Wave assignments (which plans in each wave)
- File conflicts within waves
- Parallelization warnings with specific conflicts
- Safe-to-parallelize plan list

**Example output:**
```json
{
  "phase": "92",
  "waves": { "1": ["01", "02"], "2": ["03"] },
  "conflicts": [],
  "parallelization_warnings": [
    {
      "wave": 1,
      "reason": "Plans 01 and 02 both modify bin/bgsd-tools.cjs",
      "recommendation": "Run sequentially or merge into single plan"
    }
  ],
  "safe_to_parallelize": []
}
```

Run after structuring plans to validate parallel execution safety.
<!-- /section -->

<!-- section: vertical_slice -->
### Vertical Slice Checklist

Ensure plans are organized as features, not layers:

**Vertical slice principles:**
- [ ] Each plan is a complete feature, not a layer
- [ ] Model + API + UI for a feature in same plan
- [ ] Independent features can run in parallel
- [ ] Avoid: separate model/API/UI plans

**Anti-patterns (horizontal layers):**
- Plan 01: All models
- Plan 02: All APIs
- Plan 03: All UI
- Result: Fully sequential, no parallelism possible

**Preferred pattern (vertical slices):**
- Plan 01: User feature (model + API + UI)
- Plan 02: Product feature (model + API + UI)
- Result: Can run in parallel, independent features

**When horizontal is necessary:**
- Shared foundation (auth before protected routes)
- Genuine type dependencies (Type A depends on Type B)
- Infrastructure setup (DB migrations before app code)
<!-- /section -->

<!-- section: context_calculator -->
### Context Budget Calculator

Estimate context usage before execution:

**Formula:**
```
context_estimate = base_context + (files * complexity_factor) + (tasks * task_overhead)
```

**Default values:**
- base_context: 10%
- files: file count from `files_modified`
- complexity_factor: 5% per file (low), 10% (medium), 15% (high)
- task_overhead: 5% per task

**Target:** 50% max per plan

**Split triggers:**
- Estimated >40% with high complexity
- >5 files across >2 subsystems
- >3 tasks with cross-subsystem dependencies

**CLI reference:**
```bash
bgsd-tools util:estimate-scope <plan-path>
```
<!-- /section -->

## Examples

See planner agent's `<scope_estimation>` section for the original comprehensive reference.
