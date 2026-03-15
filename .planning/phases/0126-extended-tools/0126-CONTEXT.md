# Phase 126: Extended Tools - Context

**Gathered:** 2026-03-15
**Status:** Ready for planning

<domain>
## Phase Boundary

Integrate yq, bat, and GitHub CLI (gh) into bgsd workflows. yq handles YAML configuration management, bat provides syntax-highlighted code and diff display, and gh enables GitHub operations (PR creation, merge, issue management). All three build on the tool detection infrastructure from Phase 124.

</domain>

<decisions>
## Implementation Decisions

### Fallback Messaging
- **Silent fallback for yq and bat:** When these tools are missing and JS equivalents are used, produce no user-facing message. The workflow just works with the fallback — users don't need to know.
- **Tool availability in health check:** Include tool availability status in `/bgsd-health` output, alongside `detect:tools`. These are the two discovery points for missing tools.
- **gh CLI: clear error and stop:** When gh is missing or unauthenticated, display a clear error explaining what's missing and how to fix it, then abort the workflow. No partial completion — GitHub operations have no JS fallback.
- **gh version constraint is hard:** If gh version matches the bad version (2.88.0), treat it as if gh is not installed. Refuse to use it. Same error-and-stop behavior as missing gh.

### Agent's Discretion
- yq usage scope — which YAML operations use yq vs JavaScript fallback, and pipeline complexity
- bat display styling — theme, line numbers, diff coloring choices
- General integration patterns for all three tools

</decisions>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches for yq/bat/gh integration patterns.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 0126-extended-tools*
*Context gathered: 2026-03-15*
