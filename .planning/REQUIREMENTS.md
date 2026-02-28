# Requirements: bGSD Plugin v7.1 Trajectory Engineering

**Defined:** 2026-02-28
**Core Value:** Manage and deliver high-quality software with high-quality documentation, while continuously reducing token usage and improving performance

## v7.1 Requirements

Requirements for trajectory engineering milestone. Each maps to roadmap phases.

### Foundation

- [ ] **FOUND-01**: Decision journal store exists as `trajectories` sacred memory store in memory.js
- [x] **FOUND-02**: Journal entries persist across sessions and are never auto-compacted

### Checkpoint

- [ ] **CHKPT-01**: User can create a named checkpoint that snapshots current git state with semantic name and optional context description
- [ ] **CHKPT-02**: User can list all checkpoints with metadata (name, scope, timestamp, git ref, metrics summary)
- [ ] **CHKPT-03**: Checkpoint auto-collects metrics at creation time (test count, complexity, LOC delta)
- [ ] **CHKPT-04**: Checkpoint branches follow predictable naming convention `trajectory/<scope>/<name>/attempt-N`

### Pivot

- [ ] **PIVOT-01**: User can rewind code to a named checkpoint via selective git checkout that preserves `.planning/` directory
- [ ] **PIVOT-02**: Pivot requires and records a structured reason (what failed, why, what signals indicated failure)
- [ ] **PIVOT-03**: Current state is auto-checkpointed as "abandoned" before rewind to preserve work
- [ ] **PIVOT-04**: Stuck-detector suggests pivot to last checkpoint when stuck detection fires

### Compare

- [ ] **COMP-01**: User can compare test results (pass/fail/skip) across all attempts for a given scope
- [ ] **COMP-02**: User can compare LOC delta (lines added/removed) across attempts
- [ ] **COMP-03**: User can compare cyclomatic complexity across attempts via ast.js
- [ ] **COMP-04**: Compare produces an aggregated multi-dimension matrix identifying best attempt per metric
- [ ] **COMP-05**: Compare output renders as color-coded TTY table (green=best, red=worst) with JSON fallback

### Choose

- [ ] **CHOOSE-01**: User can merge a winning attempt branch back to the base branch
- [ ] **CHOOSE-02**: Non-chosen attempts are tagged as `archived/trajectory/<scope>/<name>/attempt-N`
- [ ] **CHOOSE-03**: Trajectory branches are cleaned up after archival (tags preserved for reference)

### Integration

- [ ] **INTEG-01**: Dead-end detection queries journal for similar past approaches before new work begins
- [ ] **INTEG-02**: Init execute-phase and execute-plan commands include "previous attempts" section from trajectory journal
- [ ] **INTEG-03**: Failed attempt lessons are carried forward as "what NOT to do" context in subsequent attempts
- [ ] **INTEG-04**: Trajectory commands work at task, plan, and phase levels with scope parameter

## Future Requirements

### Trajectory Analytics

- **ANAL-01**: Trajectory success rate tracking across milestones
- **ANAL-02**: Average attempts-to-resolution metric per phase
- **ANAL-03**: Most common pivot signals aggregation

### Advanced Exploration

- **ADV-01**: Trajectory templates for common exploration patterns
- **ADV-02**: Cross-project trajectory pattern sharing

## Out of Scope

| Feature | Reason |
|---------|--------|
| Worktree per attempt | Disk-expensive (~2-4GB each), sequential exploration on main worktree is sufficient |
| Automatic pivot without human signal | Human-in-the-loop is a core GSD principle — suggest, don't act |
| Code-level diff viewer | `git diff` already exists; provide metrics comparison instead |
| Undo/redo stack | Git is already an undo system; checkpoints + branches are the mechanism |
| Automatic "best approach" selection | Metrics inform but don't decide — context matters beyond numbers |
| Database for trajectory storage | SQLite explicitly out of scope; JSON sacred store is sufficient volume |
| Cross-repository trajectory sharing | Trajectories are project-specific |
| Trajectory playback/replay | Record decisions and signals, not actions — actions are fragile |
| Parallel attempt exploration | Would require worktree + orchestrator changes far beyond scope |

## Traceability

| Requirement | Phase | Status | Test Command |
|-------------|-------|--------|--------------|
| FOUND-01 | Phase 45 | Pending | npm test -- --grep trajectory |
| FOUND-02 | Phase 45 | Complete | npm test -- --grep trajectory |
| CHKPT-01 | Phase 46 | Pending | npm test -- --grep checkpoint |
| CHKPT-02 | Phase 46 | Pending | npm test -- --grep checkpoint |
| CHKPT-03 | Phase 46 | Pending | npm test -- --grep metrics |
| CHKPT-04 | Phase 46 | Pending | npm test -- --grep trajectory |
| PIVOT-01 | Phase 47 | Pending | npm test -- --grep pivot |
| PIVOT-02 | Phase 47 | Pending | npm test -- --grep pivot |
| PIVOT-03 | Phase 47 | Pending | npm test -- --grep pivot |
| PIVOT-04 | Phase 47 | Pending | npm test -- --grep stuck |
| COMP-01 | Phase 48 | Pending | npm test -- --grep compare |
| COMP-02 | Phase 48 | Pending | npm test -- --grep compare |
| COMP-03 | Phase 48 | Pending | npm test -- --grep compare |
| COMP-04 | Phase 48 | Pending | npm test -- --grep compare |
| COMP-05 | Phase 48 | Pending | npm test -- --grep compare |
| CHOOSE-01 | Phase 49 | Pending | npm test -- --grep choose |
| CHOOSE-02 | Phase 49 | Pending | npm test -- --grep choose |
| CHOOSE-03 | Phase 49 | Pending | npm test -- --grep choose |
| INTEG-01 | Phase 50 | Pending | npm test -- --grep dead-end |
| INTEG-02 | Phase 50 | Pending | npm test -- --grep init |
| INTEG-03 | Phase 50 | Pending | npm test -- --grep context |
| INTEG-04 | Phase 50 | Pending | npm test -- --grep scope |

**Coverage:**
- v7.1 requirements: 22 total
- Mapped to phases: 22/22 (100%)
- Unmapped: 0

---
*Requirements defined: 2026-02-28*
*Last updated: 2026-02-28 after roadmap creation*
