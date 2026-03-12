# Phase 109: Duplicate Code Merge - Context

**Gathered:** 2026-03-12
**Status:** Ready for planning

<domain>
## Phase Boundary

Find and consolidate duplicate code patterns across the bGSD plugin source code (src/ directory). This is a code quality/refactoring phase that follows Phase 108 (Dead Code Removal).

**Not in scope:** New functionality, bug fixes, or feature work.

</domain>

<decisions>
## Implementation Decisions

### Detection Approach
- Use automated tool-based detection (jscpd or similar) as primary method
- Supplement with manual review for edge cases
- Target exact and near-duplicate patterns

### Similarity Threshold
- Focus on substantial duplicates (>70% similarity) to avoid over-optimization
- Don't chase minor variations that improve readability

### Consolidation Strategy
- Extract to shared utilities when pattern is clearly reusable
- Keep separate when differences are intentional or improve clarity
- Prioritize readability over DRY purity

### Scope Priority
- Priority 1: lib/ directory (shared utilities)
- Priority 2: commands/ directory (command handlers)
- Priority 3: plugin/ directory (plugin infrastructure)

### Agent's Discretion
- Agent may skip consolidation if it reduces clarity
- Agent may create new utility modules if beneficial
- Agent handles test verification after any changes

</decisions>

<specifics>
## Specific Ideas

- Look for repeated error handling patterns that could be consolidated
- Look for repeated file parsing/validation logic
- Look for repeated string manipulation utilities
- Use jscpd or similar tool for automated detection
- Verify all existing tests pass after consolidation

</specifics>

<deferred>
## Deferred Ideas

None - this discussion stayed within phase scope.

</deferred>

---

*Phase: 109-duplicate-code-merge*
*Context gathered: 2026-03-12*
