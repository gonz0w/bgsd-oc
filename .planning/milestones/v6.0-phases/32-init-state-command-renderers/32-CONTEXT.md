# Phase 32: Init & State Command Renderers — Context

## Decisions

- **User-facing commands only**: Only format commands humans actually see. Agent-consumed commands stay efficient JSON — no formatting overhead.
- **User-facing init commands**: `init progress` (the main one — shown after every session)
- **User-facing state commands**: `state show`, `state update-progress`
- **All other init/state commands**: Leave as-is with `output(result, raw)` legacy pattern — agents need detailed JSON, not pretty output
- **Brand**: Use `bGSD` branding consistently in all formatted output

## Deferred Ideas

- Formatting agent-consumed commands (init execute-phase, init plan-phase, init new-project, state patch, state advance-plan, etc.)
- Interactive/scrollable output

## Agent's Discretion

- Specific layout choices for init progress (table vs list for phase display, progress bar placement)
- How much detail to show in state show formatted output
- Whether state update-progress shows a confirmation message or a mini state card
