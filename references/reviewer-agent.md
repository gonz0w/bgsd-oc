# Code Reviewer Reference

<purpose>
Review code changes from a completed plan against project conventions
with fresh context (not the executor's spent context).
</purpose>

<review_protocol>

## 1. Load Review Context

```bash
REVIEW=$(node __OPENCODE_CONFIG__/get-shit-done/bin/gsd-tools.cjs verify:review {phase} {plan} --raw)
```

This provides: recent commits, diff summary, conventions data, changed files list.

Also load if available:
- `.planning/codebase/CONVENTIONS.md` — project conventions
- Plan's `must_haves` from PLAN.md frontmatter — what the plan was supposed to achieve

## 2. Review Dimensions

Check each changed file against these dimensions:

**Convention compliance:**
- Naming patterns (files, functions, variables) match project conventions
- Import ordering follows established patterns
- Error handling follows project patterns
- Code style (formatting, spacing) is consistent

**Architectural fit:**
- New code follows established module patterns (lazy loading, detector registry, etc.)
- Dependencies flow in correct direction (no circular imports)
- New exports are intentional and documented in COMMAND_HELP if CLI-facing

**Completeness:**
- Must-haves from plan are addressed (check against frontmatter truths)
- No TODO/FIXME/HACK left without justification
- Tests exist for new functionality
- Error paths handled (not just happy path)

**Bundle awareness:**
- New code additions are size-conscious (bundle budget: 1000KB)
- Lazy loading used for optional features
- No unnecessary dependencies introduced

## 3. Output Format

Produce a structured review:

```json
{
  "status": "approved|changes_requested|info_only",
  "findings": [
    {
      "severity": "blocker|warning|info",
      "file": "path/to/file.js",
      "line": 42,
      "dimension": "convention|architecture|completeness|bundle",
      "finding": "Description of the issue",
      "suggestion": "How to fix it"
    }
  ],
  "summary": "One-line review summary"
}
```

- **blocker:** Must fix before phase completion (convention violation, missing error handling, architectural issue)
- **warning:** Should fix but not blocking (naming nit, missing edge case test)
- **info:** FYI for future consideration (optimization opportunity, pattern suggestion)

## 4. Review Scope

ONLY review files changed in this plan's commits. Do NOT review:
- Files from prior plans
- Test files (unless test quality is a finding)
- Planning/documentation files (.planning/, *.md in project root)
- Generated files (bin/gsd-tools.cjs — it's a build artifact)

</review_protocol>

<anti_patterns>
- Do NOT rewrite the code — only identify issues with specific suggestions
- Do NOT review style preferences not backed by CONVENTIONS.md
- Do NOT block on info-level findings
- Do NOT review the same file twice in one review
- Do NOT suggest adding dependencies to save a few lines
</anti_patterns>
