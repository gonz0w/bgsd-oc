# Phase 92: Planning Intelligence - Context

**Gathered:** 2026-03-10
**Status:** Ready for planning

<domain>
## Phase Boundary

This phase delivers improved task decomposition capabilities for the planner agent. The goal is to make the planner produce better-structured execution plans with automatic dependency detection, task sizing, and parallelization awareness.

**Scope:** Enhancements to the planner's internal logic — not user-facing features.

</domain>

<decisions>
## Implementation Decisions

### Dependency Detection
- **Approach:** File-level + pattern-based combined
- File-level: Track which files each task reads/writes, infer dependencies from overlaps
- Pattern-based: Recognize common patterns (tests depend on source, configs depend on schemas)
- Use confidence weighting: file-level is authoritative, pattern-based supplements

### Task Sizing
- **Approach:** During breakdown with execution feedback
- Sizing applied during initial task breakdown (planner sizes as it creates tasks)
- Track actual execution time and provide feedback to improve future sizing accuracy
- 15-60 minute target remains the heuristic

### Parallelization
- **Approach:** Hybrid with resource conflict analysis
- Analyze file ownership: tasks reading/writing same files cannot run in parallel
- Group by wave number: all Wave 1 tasks (no deps) run first, Wave 2 after, etc.
- Within each wave, analyze resource conflicts and warn if parallelization unsafe

### Output Format
- **Approach:** Wave numbers + depends_on arrays in frontmatter
- Each plan has `wave` number (1, 2, 3...) indicating execution order
- Each plan has `depends_on` array listing prerequisite plan IDs
- Human-readable summary in docs with visual wave structure

### Agent's Discretion
- Implementation details of the detection algorithms (exact patterns to recognize, weighting factors)
- Specific file conflict detection heuristics
- Feedback loop implementation details

</decisions>

<specifics>
## Specific Ideas

- Create new skill files: `planner-dependency-graph`, `planner-task-breakdown`, `planner-scope-estimation`
- Extend PLAN.md frontmatter with `wave` and `depends_on` fields
- Add validation to ensure no circular dependencies
- Include parallelization warnings in plan output

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 92-planning-intelligence*
*Context gathered: 2026-03-10*
