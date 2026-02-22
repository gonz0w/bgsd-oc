# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-22)

**Core value:** Every improvement must make the plugin more reliable and faster for developers using GSD to plan and execute real projects
**Current focus:** v1.1 Context Reduction & Tech Debt — Phase 8: Workflow & Reference Compression

## Current Position

Phase: 8 of 9 (Workflow & Reference Compression)
Plan: 1 of 3 — complete
Status: Executing Phase 8
Last activity: 2026-02-22 — Plan 08-01 executed (extract-sections CLI + reference file markers)

Progress: [█████░░░░░] 50% (2/4 phases)

## Accumulated Context

### Decisions

All v1.0 decisions have been reviewed and recorded in PROJECT.md Key Decisions table with outcomes.

v1.1 decisions:
- tokenx 1.3.0 selected for token estimation (4.5KB bundled, ~96% accuracy, zero deps)
- Build config change needed: `packages: 'external'` → selective externals so tokenx bundles
- Layered reduction strategy: measure → CLI output → workflows → templates
- Bundle npm deps via esbuild (ESM→CJS conversion works automatically)
- Keep heuristic_tokens alongside accurate counts for comparison
- Sort baselines by total_tokens desc, comparisons by delta asc
- Added baseline_file to baseline output for tooling integration
- --compact profiles: test size reduction on execute-phase/plan-phase/new-milestone (>38%) not progress (25% due to phases array weight)
- Compact profiles drop model names, commit_docs, static file paths, redundant existence booleans
- Context manifests built dynamically — only reference files that exist on disk
- Manifest entries use path/sections/required structure for selective section loading
- Split --compact into --compact (fields only, 46.7% avg reduction) + --manifest (opt-in guidance) to fix manifest overhead gap
- Section markers use HTML comments (<!-- section: name -->) — invisible to markdown rendering, machine-parseable
- extract-sections supports dual-boundary parsing: ## headers and <!-- section --> markers in same file
- Case-insensitive section matching for ergonomic CLI usage

### Pending Todos

None.

### Pre-existing Issues

- 1 test failure in `roadmap analyze > parses phases with goals and disk status` (expects 50%, gets 33%) — targeted in Phase 9 (DEBT-01)

### Blockers/Concerns

None.

## Session Continuity

Last session: 2026-02-22
Stopped at: Completed 08-01-PLAN.md (extract-sections CLI + reference file markers)
Resume file: None
