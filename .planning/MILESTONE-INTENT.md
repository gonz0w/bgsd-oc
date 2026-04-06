# Milestone Intent: v19.4 Workflow Acceleration II + TDD Reliability

## Why Now

v19.3 shipped workflow acceleration improvements. v19.4 continues that thread while adding TDD reliability hardening. TDD reliability was flagged as a backlog seed in earlier milestones — the TDD-RELIABILITY-PRD research document is available. Combining these two focuses lets the milestone advance both workflow speed and correctness guarantees together.

## Targeted Outcomes

- DO-128 (implied) — faster workflow orchestration continued from v19.3
- TDD reliability hardening — address TDD-RELIABILITY-PRD backlog seed
- Workflow hot-path optimization building on v19.3 caching/batching improvements

## Priorities

- Measure before optimizing: use `workflow:baseline` to establish v19.3 baseline first
- Focus on TDD contracts that have drifted from the canonical TDD skill definition
- Continue hot-path optimizations from v19.3 in priority order
- Preserve correctness: acceleration without regression on test quality

## Non-Goals

- Rewriting the routing architecture end-to-end
- Parallelizing inherently sequential operations
- Adding new bundle dependencies
- Changing the CLI command surface or aliases
- Full Bun migration (BUN-MIGRATION-PRD is a separate follow-up)

## Notes

- Primary inputs: v19.3 acceleration results, TDD-RELIABILITY-PRD research document
- Use `workflow:baseline`, `workflow:compare` to measure v19.3→v19.4 improvements
- Sequence: measure v19.3 baseline, identify TDD contract gaps, address in priority order
