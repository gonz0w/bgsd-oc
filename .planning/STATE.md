# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-25)

**Core value:** Manage and deliver high-quality software with high-quality documentation, while continuously reducing token usage and improving performance
**Current focus:** v4.0 Phase 21 — Worktree Parallelism

## Current Position

**Phase:** 21 of 22 (Worktree Parallelism)
**Current Plan:** Not started
**Status:** Milestone complete
**Last Activity:** 2026-02-25

Progress: [██████████] 100% (5/5 phases)

## Performance Metrics

**Velocity:**
- Total plans completed: 47 (across v1.0–v3.0)
- Average duration: ~15 min/plan
- Total execution time: ~12 hours

**By Milestone:**

| Milestone | Phases | Plans | Timeline |
|-----------|--------|-------|----------|
| v1.0 | 5 | 14 | 2 days |
| v1.1 | 4 | 10 | 1 day |
| v2.0 | 4 | 13 | 3 days |
| v3.0 | 4 | 10 | 1 day |
| Phase 18 P01 | 14 min | 2 tasks | 14 files |
| Phase 18 P02 | 11 min | 2 tasks | 6 files |
| Phase 18 P03 | 8 min | 2 tasks | 5 files |
| Phase 19 P01 | 9 min | 2 tasks | 5 files |
| Phase 19 P02 | 4 min | 2 tasks | 3 files |
| Phase 19 P03 | 9 min | 2 tasks | 4 files |
| Phase 20 P01 | 8 min | 2 tasks | 6 files |
| Phase 20 P02 | 11 min | 2 tasks | 4 files |
| Phase 20 P03 | 2 min | 2 tasks | 3 files |
| Phase 21 P01 | 14 min | 2 tasks | 7 files |
| Phase 21 P02 | 8 min | 2 tasks | 4 files |
| Phase 21 P03 | 9 min | 2 tasks | 4 files |

## Accumulated Context

### Decisions

All v1.0–v3.0 decisions recorded in PROJECT.md Key Decisions table with outcomes.

v4.0 decisions:
- Structured assertions over Gherkin — 80% benefit at 20% ceremony, research-backed
- Static MCP profiling over runtime connection — known-server database sufficient
- Worktrees as deployment mechanism on existing wave system — not architectural change
- Bundle budget raised from 450KB to 500KB for new command modules
- [Phase 18]: Raised bundle budget from 450KB to 500KB in build.js — env module adds ~19KB
- [Phase 18]: Two-file split: gitignored env-manifest.json (machine-specific) + committed project-profile.json (team-visible)
- [Phase 18]: Staleness detection based on watched file mtime comparison — root manifests, lockfiles, version manager files, docker-compose
- [Phase 18]: Env summary wired into progress/execute-phase/resume/quick init commands; NOT phase-op/new-project/new-milestone per CONTEXT.md
- [Phase 19]: 20-server known-DB with regex pattern matching for token estimation
- [Phase 19]: Deduplication by name: .mcp.json > opencode.json > user-level config
- [Phase 19]: HOME env var isolation in tests to prevent user-config interference
- [Phase 19]: Fuzzy name matching for server→indicator mapping (contains check both directions)
- [Phase 19]: Low-cost threshold at 1000 tokens — always marked relevant
- [Phase 19]: Env hints checked in .env, .env.local, .env.development, docker-compose.yml/yaml
- [Phase 19]: Compact RELEVANCE_INDICATORS format to stay within 500KB bundle budget
- [Phase 19]: Only opencode.json mutated by --apply (not .mcp.json — no standard disable field)
- [Phase 19]: Trimmed intent help text to fit apply/restore code within 500KB bundle budget
- [Phase 20]: Bundle budget raised from 500KB to 525KB for assertion commands
- [Phase 20]: Parser in verify.js (not helpers.js) since consumed by verifier
- [Phase 20]: Heading-based section splitting for parseAssertionsMd (## REQ-ID: format)
- [Phase 20]: Assertion reading integrated into existing plan-phase steps — 12 net new lines, under 20-line target
- [Phase 20]: Planner derives must_haves.truths from assertions with fallback to requirement text
- [Phase 20]: Test-command column added to requirements traceability table template
- [Phase 20]: File-type assertions check disk existence via path extraction; CLI-type match against known command list
- [Phase 20]: Behavior/api assertions always need_human — no static verification possible
- [Phase 20]: Traceability regex uses [^|\n]* to prevent cross-row matching in markdown tables
- [Phase 20]: Cross-reference assertion text against plan must_haves.truths for planned/gap detection
- [Phase 21]: Bundle budget raised from 525KB to 550KB for worktree module
- [Phase 21]: Worktree config read directly from config.json (not via loadConfig) since loadConfig only handles CONFIG_SCHEMA fields
- [Phase 21]: Setup hook failures mark worktree as setup_failed but don't delete it — skip failing plan, let rest proceed
- [Phase 21]: Lockfile auto-resolution uses checkout --theirs during conflicted merge — handles git merge machinery correctly
- [Phase 21]: Static overlap analysis only flags same-wave plans — different waves are sequential by design
- [Phase 21]: Worktree execution gated on three conditions: worktree_enabled AND parallelization AND multi-plan wave
- [Phase 21]: Merge ordering: plan number order (smallest first) for predictable sequential merge-back
- [Phase 21]: Yolo/auto mode skips conflicting plans on merge failure — consistent with "let all agents finish" decision

### Pending Todos

None.

### Blockers/Concerns

None.

## Session Continuity

Last session: 2026-02-25
Stopped at: Completed 21-03-PLAN.md (worktree workflow integration + init extensions + tests)
Resume file: None
