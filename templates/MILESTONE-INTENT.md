# MILESTONE-INTENT.md Reference

Reference for `.planning/MILESTONE-INTENT.md` — the active milestone's lightweight strategy layer. One active file per project, lives alongside ROADMAP.md and STATE.md.

## Purpose

`MILESTONE-INTENT.md` owns milestone-local direction:
- why this milestone matters now
- targeted outcomes from project intent that this milestone advances
- current priorities
- explicit non-goals

It does **not** replace `.planning/INTENT.md`.

- `.planning/INTENT.md` = enduring project north star
- `.planning/MILESTONE-INTENT.md` = temporary milestone strategy for the current slice of work

## Structure

Use concise markdown sections. Keep the file lightweight and readable.

**Recommended sections:**

| Section | Purpose |
|---------|---------|
| `# Milestone Intent: vX.Y [Name]` | Identify the active milestone |
| `## Why Now` | Why this milestone matters at this point in the project |
| `## Targeted Outcomes` | Which project outcomes this milestone advances |
| `## Priorities` | What to emphasize while planning and shipping |
| `## Non-Goals` | What this milestone is explicitly not trying to do |
| `## Notes` | Optional clarifications, constraints, or sequencing notes |

## Rules

1. **Single owner:** `/bgsd-new-milestone` creates or refreshes this file when milestone strategy changes.
2. **Project intent stays stable:** Do not rewrite `.planning/INTENT.md` just to capture milestone-local priorities.
3. **Compact, not exhaustive:** Summarize direction rather than duplicating requirements or roadmap text.
4. **Outcome-linked:** Prefer references to project outcome IDs where possible.
5. **Non-goals required:** Make milestone boundaries explicit so downstream planning stays focused.

## Example

```markdown
# Milestone Intent: v17.0 JJ Workspaces, Intent Cascade & Command Simplification

## Why Now

Execution already moved toward JJ-first behavior, but planning, help, and command surfaces still expose legacy assumptions. This milestone finishes the user-visible shift so execution, planning, and guidance all point to the same operating model.

## Targeted Outcomes

- DO-118 — JJ-first execution and recovery
- DO-119 — smaller canonical command surface
- DO-120 — cascading intent for planning alignment

## Priorities

- Make JJ-backed execution the clearly supported path
- Keep planning context compact and layered
- Reduce command sprawl without breaking existing entrypoints

## Non-Goals

- Dynamic model configuration
- Broad planning-system redesign outside this milestone
- Remote Git/GitHub workflow replacement

## Notes

- Prefer changes that improve guidance and execution safety together
- Preserve backward compatibility where feasible during migration
```

## Guidance for Downstream Workflows

- Planners and roadmappers should treat this file as the milestone-specific strategy source.
- Researchers and verifiers should use injected compact intent (`effective_intent`) on hot paths, not re-read this file by default.
- Read the full document directly only when a workflow is explicitly editing milestone strategy or needs to quote source text.
