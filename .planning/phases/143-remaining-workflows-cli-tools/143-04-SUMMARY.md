---
phase: 143-remaining-workflows-cli-tools
plan: "04"
subsystem: infra
tags: [question-template, workflow-migration, questions-js, cli-tools]

# Dependency graph
requires:
  - phase: 143-02
    provides: Workflow audit identifying 6 workflows needing migration
provides:
  - 5 workflows migrated to questionTemplate() calls
  - 6 new question templates added to questions.js
affects: [settings.md, new-project.md, transition.md]

# Tech tracking
tech-stack:
  added: []
  patterns: [questionTemplate() calls replace inline question arrays]

key-files:
  created: []
  modified:
    - src/lib/questions.js
    - workflows/check-todos.md
    - workflows/add-todo.md
    - workflows/update.md
    - workflows/cleanup.md
    - workflows/complete-milestone.md

key-decisions:
  - "questionTemplate() calls use OPTIONS from template, PRESERVE question text inline"
  - "BINARY type for 2-option templates (update-proceed, cleanup-proceed, complete-milestone-push)"
  - "SINGLE_CHOICE type for 4-option templates (check-todos-roadmap-action, check-todos-general-action)"
  - "SINGLE_CHOICE type for 3-option template (add-todo-duplicate-action)"

patterns-established:
  - "Inline question arrays replaced with questionTemplate('template-id') calls"

requirements-completed: [MIGRATE-08]
one-liner: "Migrated 5 workflows to questionTemplate() calls, added 6 templates to questions.js"

# Metrics
duration: 2min
completed: 2026-03-20
---

# Phase 143: Remaining Workflows & CLI Tools Summary

**Migrated 5 workflows to questionTemplate() calls, added 6 templates to questions.js**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-20T05:19:01Z
- **Completed:** 2026-03-20T05:21:XXZ
- **Tasks:** 5
- **Files modified:** 6

## Accomplishments
- check-todos.md: 2 questionTemplate() calls (check-todos-roadmap-action, check-todos-general-action)
- add-todo.md: 1 questionTemplate() call (add-todo-duplicate-action)
- update.md: 1 questionTemplate() call (update-proceed)
- cleanup.md: 1 questionTemplate() call (cleanup-proceed)
- complete-milestone.md: 1 questionTemplate() call (complete-milestone-push)
- questions.js: 6 new templates added

## Task Commits

Each task was committed atomically:

1. **docs(143-04): migrate 5 workflows to questionTemplate()** - `8fdffec` (docs)

**Plan metadata:** `8fdffec` (docs: complete plan)

## Files Created/Modified
- `src/lib/questions.js` - Added 6 question templates (check-todos-roadmap-action, check-todos-general-action, add-todo-duplicate-action, update-proceed, cleanup-proceed, complete-milestone-push)
- `workflows/check-todos.md` - Replaced 2 inline `Use question:` blocks with questionTemplate() calls
- `workflows/add-todo.md` - Replaced 1 inline `Use question:` block with questionTemplate() call
- `workflows/update.md` - Replaced 1 inline `Use question:` block with questionTemplate() call
- `workflows/cleanup.md` - Replaced 1 inline question block with questionTemplate() call
- `workflows/complete-milestone.md` - Replaced 1 inline `Ask:` block with questionTemplate() call

## Decisions Made
- "questionTemplate() calls preserve question text inline, only options from template" — ensures consistent option handling while keeping context-specific question text
- "BINARY typeHint for yes/no templates, SINGLE_CHOICE for multi-option templates" — matches TAXONOMY enum usage

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## Questions Audit Results

After migration, questions:audit shows 90.5% compliance (38 template references, 4 inline questions remaining in settings.md, new-project.md, transition.md - handled by plan 143-03).

| Workflow | Templates | Inline |
|----------|----------|--------|
| check-todos.md | 2 | 0 |
| add-todo.md | 1 | 0 |
| update.md | 1 | 0 |
| cleanup.md | 1 | 0 |
| complete-milestone.md | 1 | 0 |

## Next Phase Readiness
- Question template infrastructure complete for 5 more workflows
- settings.md, new-project.md, transition.md still need migration (plan 143-03)

---
*Phase: 143-remaining-workflows-cli-tools*
*Completed: 2026-03-20*
