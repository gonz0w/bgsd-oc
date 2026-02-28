# Phase 34: Feature & Intent Command Renderers — Context

## Decisions

- **User-facing commands only**: Only format commands humans actually see. Agent-consumed commands stay efficient JSON.
- **User-facing feature commands**: `velocity`, `quick-summary`
- **User-facing intent commands**: `intent show`, `intent validate`, `intent drift`
- **All other feature/intent commands**: Leave as-is — agents consume session-diff, context-budget, test-run, search-decisions, search-lessons, rollback-info, trace-requirement, etc. as JSON
- **Brand**: Use `bGSD` branding consistently

## Deferred Ideas

- Formatting agent-consumed feature commands (session-diff, context-budget, test-run, search-decisions, etc.)
- Sparkline charts for velocity trends (AFMT-01)

## Agent's Discretion

- Velocity display layout (plans/day rate, forecast format, per-milestone table)
- Quick-summary condensed format
- Intent show detail level (outcomes list, criteria display)
- Intent drift score visualization (progress bar? color-coded score?)
- Intent validate pass/fail display
