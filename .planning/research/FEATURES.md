# Feature Research - v17.1 Workflow Reliability & Foundation Hardening

## Scope

Translate lessons and audit findings into user-visible capability categories for the next milestone.

## Sources

- `.planning/memory/lessons.json`
- `.planning/research/CODEBASE-EFFICIENCY-RELIABILITY-AUDIT-PRD.md`

## Table Stakes

- JJ-backed execution can complete task and metadata commits safely in detached or dirty workspaces.
- Verification helpers correctly consume current `PLAN.md` `must_haves` shapes or fail loudly with actionable fallback guidance.
- Workflow, skill, and documentation examples reference commands that actually exist in the shipped CLI.
- Summary and state metadata updates stay scoped to the active plan instead of ambient dirty-workspace state.
- Verification uses repo-local, current-state evidence when validating source changes.

## Differentiators

- Shared planning indexes reduce repeated scans across verification and planning commands.
- State, memory, and handoff mutations become coordination-safe for increasingly parallel JJ execution.
- Logging and diagnostics become predictable, quiet by default, and easier to reason about during agent execution.
- Planner and checker flows validate execution realism earlier, catching verifier-facing and sequencing issues before execution begins.

## Anti-Features

- Broad architectural rewrite without clear acceptance criteria
- New end-user product features unrelated to workflow reliability
- Speculative optimization work without repeated-work or correctness evidence
- Reworking the lessons system itself instead of acting on lessons-derived problems

## Candidate Requirement Categories

- `EXEC` - JJ-aware execution and commit paths
- `VERIFY` - verifier metadata parsing and evidence integrity
- `PLAN` - planner/checker realism and verifier compatibility gates
- `STATE` - summary, state, and completion consistency
- `FOUND` - shared contracts, atomic mutation paths, and repeated-work reduction
- `LOG` - logging contract and default-noise reduction
