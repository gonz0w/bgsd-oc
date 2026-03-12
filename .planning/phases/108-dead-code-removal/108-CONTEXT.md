# Phase 108: Dead Code Removal - Context

**Gathered:** 2026-03-12
**Status:** Ready for planning

<domain>
## Phase Boundary

Find and remove unreachable code paths from the bGSD plugin codebase (src/ and bin/).

This phase delivers:
- Static analysis to identify unreachable code paths
- Removal of confirmed dead code
- Verification that removal doesn't break runtime

**Scope:** Code cleanup in src/ directory. Depends on Phase 107 (Unused Exports Cleanup).

</domain>

<decisions>
## Implementation Decisions

### Detection Method
- **Decision:** Use AST-based static analysis with ESLint and custom AST traversal
- ESLint's `no-unreachable` rule catches obvious cases
- Custom AST analysis for complex control flow (loops with early returns, conditionals)
- Reference: Phase 107 learnings on unused exports can inform tool selection

### Scope of Analysis
- **Decision:** Focus on src/ directory primarily
- Include bin/bgsd-tools.cjs only if analysis shows clear benefits
- Start with high-confidence targets: code after unconditional returns, unreachable catch blocks

### Verification Approach
- **Decision:** Multi-layered verification
  1. Run full test suite before and after removal (`npm test`)
  2. Verify CLI commands still work (`node bin/bgsd-tools.cjs util:help`)
  3. Check for runtime errors in common workflows
- Conservative approach: if any doubt, leave code in place

### Handling Conditional Dead Code
- **Decision:** Conservative (leave it)
- Only remove code if definitively proven unreachable
- Code unreachable only in certain conditions (env, flags) should be left unless explicitly dead
- "When in doubt, leave it out" - safe refactoring

### Agent's Discretion
- Specific tool selection: Use your judgment on best approach (ESLint, custom scripts, etc.)
- Files to analyze first: Use Phase 107 learnings - start with similar patterns
- Threshold for "definitively proven": Require 2+ independent verification methods

</decisions>

<specific>
## Specific Ideas

Phase 107 analysis showed:
- Inventory files created in .planning/phases/107-unused-exports/
- One unused export found (used in tests, not removed)
- Phase 107 used knip for analysis - consider extending that approach

**References:**
- ESLint no-unreachable rule for basic detection
- knip unused-export analysis from Phase 107

</specific>

<deferred>
## Deferred Ideas

[None - discussion complete for this phase]

</deferred>

---

*Phase: 108-dead-code-removal*
*Context gathered: 2026-03-12*
*Updated: 2026-03-12 (resolved TBD items)*
