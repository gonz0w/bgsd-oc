# Research Summary - v17.1 Workflow Reliability & Foundation Hardening

## Milestone Framing

The next milestone should turn recurring lessons and the codebase audit into a focused foundation-hardening push: improve workflow execution reliability without changing the lessons process itself.

## Recommended Milestone

- **Name:** v17.1 Workflow Reliability & Foundation Hardening
- **Goal:** Improve end-to-end workflow execution reliability by hardening JJ-aware execution, verifier metadata handling, shared planning contracts, and plan-scoped state/summary updates.

## Key Findings

- The biggest recurring operational problem is the mismatch between JJ-first execution and Git-style commit helpers during detached or dirty workspace runs.
- Verification fidelity is a second major weakness: current helper paths can miss valid `must_haves` metadata, trust stale binaries, or verify too narrow a surface.
- Workflow and skill examples drift from the live CLI often enough to create avoidable retries during planning and execution.
- Summary, state, and completion helpers still infer too much from ambient workspace state, which becomes unsafe in dirty or parallel runs.
- The audit confirms these workflow failures are symptoms of deeper shared-contract, repeated-scan, and mutation-coordination issues.

## Recommended Requirement Categories

- `FOUND` - shared parser/config/storage contracts, atomic mutation paths, and repeated-work reduction
- `EXEC` - JJ-aware execution and path-scoped commit reliability
- `VERIFY` - verifier metadata parsing, direct evidence, and fail-loud behavior
- `PLAN` - planner/checker execution realism and verifier compatibility checks
- `STATE` - plan-scoped summaries plus consistent state/roadmap completion updates
- `LOG` - one logging contract with quieter defaults and clearer diagnostics

## Non-Goals

- Rewriting the architecture wholesale
- Building new user-facing product features unrelated to workflow hardening
- Reworking the lessons system instead of acting on the current lessons data
- Adding speculative optimizations without evidence

## Skills

- No additional external skills are recommended for this milestone.
