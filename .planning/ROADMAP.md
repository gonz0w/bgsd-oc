# Roadmap: bGSD Plugin — v11.4 Housekeeping & Stabilization

## Overview

This milestone eliminates accumulated technical debt across four areas: a broken test suite (600 failures from a single Bun banner bug), CLI command routing gaps, stale planning artifacts, and an overgrown INTENT.md. Test stabilization comes first to provide a safety net, followed by code-level routing fixes, then markdown artifact cleanup, and finally an automated intent archival system.

## Phases

- [x] **Phase 114: Test Suite Stabilization** - Fix Bun runtime banner and 18 residual test failures to restore green test suite
- [x] **Phase 115: CLI Command Routing** - Fix missing routes, remove dead code, sync command validator (completed 2026-03-14)
- [x] **Phase 116: Planning Artifact Cleanup** - Normalize MILESTONES.md, fix PROJECT.md, audit out-of-scope and decisions (completed 2026-03-14)
- [x] **Phase 117: Intent Archival System** - Automate INTENT.md outcome archival during milestone completion (completed 2026-03-14)

## Phase Details

### Phase 114: Test Suite Stabilization
**Goal**: All 1014 tests pass with zero failures — the test suite provides reliable signal for all subsequent changes
**Depends on**: Nothing (first phase)
**Requirements**: TEST-01, TEST-02, TEST-03, TEST-04, TEST-05, TEST-06
**Success Criteria** (what must be TRUE):
  1. User can run `npm test` and see zero test failures across all suites
  2. User can run tests with Bun installed without JSON parse errors from stdout pollution
  3. User can run plugin tests in isolation without errors from missing project context
  4. User can trust that test assertions match current CLI output (no stale expected values)
  5. User can run the full test suite without missing module import errors
**Plans**: 2/2 plans complete
  - Plan 01 (Wave 1): Suppress Bun banner + fix profiler tests + rebuild CLI [TEST-01, TEST-02] ✓
  - Plan 02 (Wave 2): Fix all residual test failures — stale assertions, plugin isolation, config migration, env edge cases [TEST-03, TEST-04, TEST-05, TEST-06] ✓

### Phase 115: CLI Command Routing
**Goal**: Every registered CLI command resolves correctly — no missing routes, no orphaned modules, no stale validator data
**Depends on**: Phase 114
**Requirements**: CMD-01, CMD-02, CMD-03, CMD-04, CMD-05, CMD-06
**Success Criteria** (what must be TRUE):
  1. User can call every command referenced in workflows without silent failures (including `verify:handoff` and `verify:agents`)
  2. User can run builds without bundling the orphaned `src/commands/ci.js` module
  3. User can run `util:validate-commands` and see results matching actual router state
  4. User can run `--help` on any routed command and receive usage information
   5. User sees no duplicate command routes when listing available commands
**Plans**: 4/4 plans complete
  - Plan 01 (Wave 1): Implement verify:handoff and verify:agents commands [CMD-01, CMD-02] ✓
  - Plan 02 (Wave 1): Remove orphaned ci.js, execute:profile, deduplicate runtime/measure [CMD-03, CMD-06] ✓
  - Plan 03 (Wave 1): Fix commandDiscovery.js validator — add audit namespace, fix 5 stale subcommand lists [CMD-04] ✓
  - Plan 04 (Wave 1): Add 32 missing COMMAND_HELP entries for util, verify, cache [CMD-05] ✓

### Phase 116: Planning Artifact Cleanup
**Goal**: Planning artifacts are accurate, complete, and consistently formatted — every agent consuming these files gets correct data
**Depends on**: Phase 114
**Requirements**: ART-01, ART-02, ART-03, ART-04, ART-05, ART-06, ART-07
**Success Criteria** (what must be TRUE):
  1. User can read MILESTONES.md and find entries for all 18+ shipped milestones in chronological order with consistent formatting
  2. User can read PROJECT.md without encountering broken HTML, stale counts, or broken table rows
  3. User can see an out-of-scope list that reflects actual current exclusions (no stale items from 12+ milestones ago)
  4. User can see a Key Decisions table where all entries are current and properly formatted
  5. User can see constraints that are still relevant — resolved constraints archived
**Plans**: 3/3 plans complete
  - Plan 01 (Wave 1): Fix MILESTONES.md — add missing entries, fix v9.2 content, normalize formatting [ART-01, ART-02, ART-03] ✓
  - Plan 02 (Wave 1): Fix PROJECT.md — repair HTML, update counts, clean out-of-scope [ART-04, ART-05, ART-06]
  - Plan 03 (Wave 1): Update constraints/decisions + add CLI validation [ART-07]

### Phase 117: Intent Archival System
**Goal**: INTENT.md is automatically cleaned during milestone completion — completed outcomes archived, active file stays lean
**Depends on**: Phase 116
**Requirements**: INT-01, INT-02, INT-03, INT-04
**Success Criteria** (what must be TRUE):
  1. User can complete a milestone and have INTENT.md outcomes automatically snapshot to a versioned archive file
  2. User can complete a milestone and have completed outcomes stripped from active INTENT.md
  3. User can add new outcomes after archival without ID collisions (IDs continue monotonically)
  4. User can complete a milestone and have the history section archived alongside outcomes — keeping INTENT.md under 100 lines
**Plans**: 1/1 plans complete
  - Plan 01 (Wave 1): Add intent archival to cmdMilestoneComplete + update workflow + guardrails [INT-01, INT-02, INT-03, INT-04] ✓

## Progress

**Execution Order:**
Phases execute in numeric order: 114 → 115 → 116 → 117

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 114. Test Suite Stabilization | 1/2 | Complete    | 2026-03-14 |
| 115. CLI Command Routing | 3/4 | Complete    | 2026-03-14 |
| 116. Planning Artifact Cleanup | 2/3 | Complete    | 2026-03-14 |
| 117. Intent Archival System | 1/1 | Complete    | 2026-03-14 |
