# Architecture Research - v17.1 Workflow Reliability & Foundation Hardening

## Scope

Identify where the milestone should touch the existing architecture to reduce execution and planning friction.

## Sources

- `.planning/memory/lessons.json`
- `.planning/research/CODEBASE-EFFICIENCY-RELIABILITY-AUDIT-PRD.md`
- `.planning/PROJECT.md`

## Likely Integration Points

- `src/commands/execute*` and commit helper paths for JJ-aware task and metadata commits
- `src/commands/verify*` and plan metadata extraction helpers for `must_haves` parsing and verifier truthfulness
- planner/checker workflow docs, templates, and validation helpers for command-surface and execution-realism checks
- summary/state mutation paths for plan-scoped file discovery, totals refresh, and readback validation
- shared config, planning-cache, and state parser/storage modules to remove duplicate contracts
- workspace inventory and handoff/resume flows where repeated subprocess or race-prone mutation patterns exist
- output/logging helpers across CLI and plugin surfaces for one debug/verbosity contract

## Architectural Guidance

- Introduce shared helpers before migrating all callers.
- Prefer additive hardening that preserves backward compatibility for planning artifacts.
- Keep CLI and plugin consumers on the same parser/config/storage contract where possible.
- Treat JJ-native execution as a first-class supported path, not a fallback-only edge case.
- Ensure optimization work is paired with before/after evidence or regression coverage.

## Suggested Build Order

1. Shared state/config/storage contracts
2. Atomic and coordination-safe mutation paths
3. JJ-aware execution and plan-scoped metadata generation
4. Verifier and planner/checker compatibility hardening
5. Shared indexes and workspace scan reduction
6. Logging normalization and module-boundary cleanup
