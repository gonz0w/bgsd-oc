# Pitfalls Research - v17.1 Workflow Reliability & Foundation Hardening

## Scope

Highlight the main failure patterns this milestone should avoid repeating.

## Sources

- `.planning/memory/lessons.json`
- `.planning/research/CODEBASE-EFFICIENCY-RELIABILITY-AUDIT-PRD.md`

## Key Pitfalls

- Fixing only workflow wording while leaving runtime helpers broken, especially around `execute:commit` and verifier metadata extraction
- Shipping JJ guidance without making path-scoped commit flows reliable in detached or dirty colocated workspaces
- Trusting helper output that silently returns empty or partial verification results for valid plan metadata
- Deriving summaries, touched files, or completion totals from the ambient working copy instead of plan-owned truth
- Updating source-side behavior without rebuilding or validating bundled runtime artifacts that users actually execute
- Adding performance changes without proving which repeated scans or subprocess hotspots were removed
- Changing parser or storage behavior in one surface while leaving plugin or secondary consumers on older logic
- Making logs quieter by hiding actionable failures instead of routing them through a consistent debug contract

## Prevention Strategy

- Pair workflow guidance changes with underlying helper/runtime fixes.
- Add regression coverage for JJ detached/dirty workspace execution paths.
- Validate verifier-facing plan metadata during planning, not only during verification.
- Read back summary/state/roadmap high-level fields after automated updates.
- Use repo-local runtime checks when validating source changes in the dev workspace.
- Require measurable evidence for hotspot optimizations and shared-index work.
