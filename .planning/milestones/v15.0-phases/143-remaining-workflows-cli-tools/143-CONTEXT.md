# Phase 143: Remaining Workflows & CLI Tools - Context

**Gathered:** 2026-03-19
**Status:** Ready for planning

<domain>
## Phase Boundary
Audit remaining ~40 workflows in workflows/, migrate all to question() template references, remove deprecated/utility workflows (with reference check), and add questions:audit/list/validate CLI commands.
</domain>

<decisions>
## Implementation Decisions

### Audit Scope
- Audit ALL workflows in workflows/ directory — full coverage
- Flag deprecated/utility workflows for removal
- Before removing: verify no references in commands/, agents/, hooks/
- Remove deprecated workflows as part of Phase 143 (not deferred)

### CLI Output Format
- Default: human-readable Markdown output
- --json flag: machine-readable JSON for CI pipeline integration
- JSON schema is implementation detail (no semver stability guarantees)
- CI teams should pin bgsd-tools version for schema stability

### Migration Priority
- Systematic sweep — all workflows migrated with equal priority
- No ranking by usage/question count — consistency matters
- No priority given to user-facing vs backend workflows

### Template Reuse
- Case-by-case decision on reuse vs new template
- Similarity judged by same structure (question type + similar options)
- Template variants use parameterized approach (e.g., discuss-scope, phase=x)
- Avoids template ID fragmentation

### Validation Strictness
- Phase 143: warn-only mode (non-compliant templates reported, not blocked)
- After Phase 143 complete: auto-flip to fail CI mode
- questions:validate --strict flag not needed (auto-transition)
</decisions>

<specifics>
## Specific Ideas
- No specific requirements — open to standard approaches
- CLI should integrate with existing bgsd-tools.cjs CLI structure
- Audit should inventory: workflow name, question count, template compliance, deprecation status
</specifics>

<stress_tested>
## Stress-Tested Decisions
All decisions held up under stress testing — no revisions needed:
- Phase scope (audit + remove + CLI) is manageable
- Git history + reference check provides safety for deletions
- JSON as implementation detail is acceptable (CI pins version)
- Systematic sweep is appropriate given Phase 141 infrastructure has tests
- Parameterized templates acceptable with documentation
</stress_tested>

<deferred>
## Deferred Ideas
None — discussion stayed within phase scope
</deferred>

---
*Phase: 143-remaining-workflows-cli-tools*
*Context gathered: 2026-03-19*
