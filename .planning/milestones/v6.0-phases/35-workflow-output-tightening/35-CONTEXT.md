# Phase 35: Workflow Output Tightening — Context

## Decisions

- **Single-pass approach**: Tighten workflow output and measure in one pass (not separate before/after baselines)
- **Brand update**: Update ui-brand.md to use `bGSD` consistently (currently says `GSD ►`, should be `bGSD ►`)
- **Focus**: Reduce token noise in workflow .md files — eliminate "Starting...", "Processing...", "Done." patterns, tighten table instructions

## Deferred Ideas

- None

## Agent's Discretion

- Which workflow files get the most attention (prioritize by token size)
- Specific tightening techniques (shorter instructions, consolidated tables, removed redundancy)
- How to measure token reduction (line count? gsd-tools context-budget?)
