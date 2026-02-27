# Requirements: GSD Plugin v7.0

**Defined:** 2026-02-26
**Core Value:** Intelligent agent orchestration for building large-scale software — right agent, right context, right time

## v7.0 Requirements

Requirements for milestone v7.0 Agent Orchestration & Efficiency. Each maps to roadmap phases.

### Foundation & Safety

- [x] **SAFE-01**: CLI JSON output has consumer contract tests (snapshot-based) covering all init and state commands
- [x] **SAFE-02**: Pre-commit safety checks detect dirty tree, rebase in progress, detached HEAD before git-write operations

### AST Intelligence

- [ ] **AST-01**: User can generate function signature extraction for JS/TS files via acorn parser
- [ ] **AST-02**: User can generate export surface analysis for any JS/TS module
- [x] **AST-03**: User can generate per-function/module complexity metrics for task classification
- [ ] **AST-04**: Non-JS languages fall back to regex-based signature extraction via detector registry pattern

### Context Efficiency

- [x] **CTX-01**: User can generate a repository map (~1k token compact codebase summary from AST signatures)
- [x] **CTX-02**: Each agent type declares required context via manifest; system provides only declared context at spawn
- [x] **CTX-03**: CLI commands support compact serialization format with 40-60% token reduction for agent consumption
- [x] **CTX-04**: Task-scoped file injection loads only task-relevant files using dependency graph and relevance scoring

### Orchestration Intelligence

- [x] **ORCH-01**: User can classify task complexity (1-5 score) based on file count, cross-module reach, and test requirements
- [x] **ORCH-02**: System auto-selects agent type and model tier based on task classification
- [x] **ORCH-03**: System auto-selects between single/parallel/team execution mode based on plan structure

### Agent Quality

- [x] **QUAL-01**: Code review agent (gsd-reviewer) reviews code changes against project conventions before commit
- [x] **QUAL-02**: Commits are tagged with agent type in metadata for attribution and tracking
- [x] **QUAL-03**: Verification pipeline includes post-execution review step via gsd-reviewer

### Git Intelligence

- [x] **GIT-01**: User can query structured git log, diff summary, blame, and branch info via enhanced git.js commands
- [x] **GIT-02**: Pre-commit checks detect uncommitted changes, active rebase, detached HEAD, and shallow clones

### TDD Execution

- [x] **TDD-01**: Executor follows RED→GREEN→REFACTOR state machine for `type: tdd` plans, with verification gates between each phase
- [x] **TDD-02**: RED phase commits a failing test before any implementation code exists; orchestrator verifies test actually fails
- [x] **TDD-03**: GREEN phase writes minimal implementation; orchestrator verifies previously-failing test now passes
- [x] **TDD-04**: REFACTOR phase commits are verified to not break any passing tests
- [x] **TDD-05**: TDD commit discipline uses git trailers (`GSD-Phase: red|green|refactor`) for audit trail

### Execution Discipline

- [x] **EXEC-01**: Auto test-after-edit: executor runs test suite after each file modification to catch errors early
- [ ] **EXEC-02**: Anti-pattern detection blocks common AI mistakes (pre-test code in TDD, YAGNI violations, over-mocking) with explanations

### Review Gate Hardening

- [ ] **QUAL-04**: Reviewer performs two-stage review: spec compliance (plan must_haves) THEN code quality (conventions, patterns)
- [ ] **QUAL-05**: Review findings are severity-classified (blocker/warning/info) with blockers preventing task completion
- [ ] **QUAL-06**: Stuck/loop detection identifies when executor is repeating failed patterns and triggers recovery

## Future Requirements

Deferred to future release. Tracked but not in current roadmap.

### Orchestration

- **ORCH-04**: Agent performance tracking — per-agent success/failure rates fed back into routing decisions

### Context Efficiency

- **CTX-05**: Conversation compaction via Claude API compact-2026-01-12 for long-running sessions

### Performance

- **PERF-01**: Performance profiler module with node:perf_hooks wrapper, GSD_PROFILE=1, baseline tracking

### Agent Roles

- **ROLE-01**: Security scanning agent integration (use snyk/semgrep)
- **ROLE-02**: Dependency management agent integration (use dependabot/renovate)
- **ROLE-03**: Refactoring agent for automated code improvement
- **ROLE-04**: Documentation generation agent

### Git

- **GIT-03**: Full PR automation with human gate
- **GIT-04**: Stacked PR workflow support
- **GIT-05**: Merge intelligence and conflict resolution

## Out of Scope

| Feature | Reason |
|---------|--------|
| Autonomous agent teams | 67% AI PR rejection rate (LinearB), 9% more bugs (DORA 2025) — human-in-the-loop is correct |
| Dynamic agent spawning | Cursor's 20-agent failure validates pre-planned parallelism over self-spawning |
| LLM SDK integration | bGSD produces prompts, doesn't call LLM APIs directly |
| TypeScript migration | Not worth 18-module migration cost this milestone |
| Database/SQLite | JSON + git history suffices for current scale |
| Agent role explosion | Cap at 12 roles (current 11 + gsd-reviewer). Intelligence = data, not agents |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status | Test Command |
|-------------|-------|--------|--------------|
| SAFE-01 | Phase 37 | Complete | npm test -- --grep contract |
| SAFE-02 | Phase 37 | Complete | npm test -- --grep safety |
| GIT-01 | Phase 37 | Complete | npm test -- --grep git |
| GIT-02 | Phase 37 | Complete | npm test -- --grep precommit |
| AST-01 | Phase 38 | Pending | npm test -- --grep ast |
| AST-02 | Phase 38 | Pending | npm test -- --grep export |
| AST-03 | Phase 38 | Complete | npm test -- --grep complexity |
| AST-04 | Phase 38 | Pending | npm test -- --grep registry |
| CTX-01 | Phase 38 | Complete | npm test -- --grep repomap |
| ORCH-01 | Phase 39 | Complete | npm test -- --grep classify |
| ORCH-02 | Phase 39 | Complete | npm test -- --grep routing |
| ORCH-03 | Phase 39 | Complete | npm test -- --grep mode |
| CTX-02 | Phase 40 | Complete | npm test -- --grep manifest |
| CTX-03 | Phase 40 | Complete | npm test -- --grep compact |
| CTX-04 | Phase 40 | Complete | npm test -- --grep buildTaskContext |
| QUAL-01 | Phase 41 | Complete | npm test -- --grep reviewer |
| QUAL-02 | Phase 41 | Complete | npm test -- --grep attribution |
| QUAL-03 | Phase 41 | Complete | npm test -- --grep verification |
| TDD-01 | Phase 43 | Complete | npm test -- --grep tdd |
| TDD-02 | Phase 43 | Complete | npm test -- --grep tdd-red |
| TDD-03 | Phase 43 | Complete | npm test -- --grep tdd-green |
| TDD-04 | Phase 43 | Complete | npm test -- --grep tdd-refactor |
| TDD-05 | Phase 43 | Complete | npm test -- --grep tdd-trailer |
| EXEC-01 | Phase 43 | Complete | npm test -- --grep auto-test |
| EXEC-02 | Phase 43 | Pending | npm test -- --grep anti-pattern |
| QUAL-04 | Phase 44 | Pending | npm test -- --grep two-stage |
| QUAL-05 | Phase 44 | Pending | npm test -- --grep severity |
| QUAL-06 | Phase 44 | Pending | npm test -- --grep stuck |

**Coverage:**
- v7.0 requirements: 29 total
- Mapped to phases: 29
- Unmapped: 0 ✓

---
*Requirements defined: 2026-02-26*
*Last updated: 2026-02-27 after Phase 43-44 requirements added*
