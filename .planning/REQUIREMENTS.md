# Requirements — v11.4 Housekeeping & Stabilization

## Test Suite Stabilization

- [ ] **TEST-01**: User can run `npm test` and see all tests pass — Bun runtime banner suppressed in piped mode via `process.stdout.isTTY` guard
- [ ] **TEST-02**: User can run tests without missing profiler module errors — profiler import paths resolved or mocked
- [ ] **TEST-03**: User can run plugin tests in isolation — test setup handles missing plugin context gracefully
- [ ] **TEST-04**: User can trust test assertions — stale infrastructure assertions updated to match current output
- [ ] **TEST-05**: User can run config migration tests — expected migration outputs updated for current schema
- [ ] **TEST-06**: User can run all edge case tests — env and miscellaneous test failures fixed

## CLI Command Routing

- [ ] **CMD-01**: User can call `verify:handoff` without silent failure — route either implemented or workflow references removed
- [ ] **CMD-02**: User can call `verify:agents` without silent failure — route either implemented or workflow references removed
- [ ] **CMD-03**: User can run builds without bundling dead code — orphaned `src/commands/ci.js` removed
- [ ] **CMD-04**: User can run `util:validate-commands` and see accurate results — `audit` namespace added to `commandDiscovery.js`, 5 stale subcommand lists corrected
- [ ] **CMD-05**: User can run `--help` on any routed command — 32 missing COMMAND_HELP entries added for util, verify, and cache routes
- [ ] **CMD-06**: User sees no duplicate command routes — `runtime` and `measure` deduplicated, `execute:profile` dead route removed

## Planning Artifact Cleanup

- [ ] **ART-01**: User can read MILESTONES.md with complete history — 6 missing milestone entries added (v8.0, v8.1, v9.1, v11.0, v11.1, v11.2)
- [ ] **ART-02**: User can read MILESTONES.md with accurate content — v9.2 entry corrected (currently contains v9.0 description)
- [ ] **ART-03**: User can read MILESTONES.md with consistent formatting — checkmarks, dates, and archive references normalized
- [ ] **ART-04**: User can read PROJECT.md without broken HTML — orphaned `</details>` tag removed, broken table rows fixed
- [ ] **ART-05**: User can read PROJECT.md with accurate counts — module count, workflow count, test format, Node.js version updated
- [ ] **ART-06**: User can see current out-of-scope list — stale items removed, irrelevant exclusions pruned
- [ ] **ART-07**: User can see current constraints and decisions — resolved items archived, current items verified

## Intent Archival System

- [ ] **INT-01**: User can complete a milestone and have INTENT.md automatically snapshot to `.planning/milestones/{version}-INTENT.md`
- [ ] **INT-02**: User can complete a milestone and have completed outcomes/criteria stripped from active INTENT.md
- [ ] **INT-03**: User can add new outcomes after archival without ID collisions — `getNextId()` tracks highest-ever ID, not just current items
- [ ] **INT-04**: User can complete a milestone and have history section archived alongside outcomes — keeping active INTENT.md lean

## Future Requirements

- Intent archival rollback (restore archived outcomes to active)
- Automated INTENT.md health check in `/bgsd-health`
- Intent drift validation against archived milestones

## Out of Scope

- Test behavior changes — only infrastructure fixes (Bun banner, imports, assertions)
- New CLI commands — only fixing existing routing
- New features or capabilities — this is purely cleanup
- ROADMAP.md format changes — existing format works

## Traceability

| REQ-ID | Phase | Plan |
|--------|-------|------|
| TEST-01 | Phase 114 | — |
| TEST-02 | Phase 114 | — |
| TEST-03 | Phase 114 | — |
| TEST-04 | Phase 114 | — |
| TEST-05 | Phase 114 | — |
| TEST-06 | Phase 114 | — |
| CMD-01 | Phase 115 | — |
| CMD-02 | Phase 115 | — |
| CMD-03 | Phase 115 | — |
| CMD-04 | Phase 115 | — |
| CMD-05 | Phase 115 | — |
| CMD-06 | Phase 115 | — |
| ART-01 | Phase 116 | — |
| ART-02 | Phase 116 | — |
| ART-03 | Phase 116 | — |
| ART-04 | Phase 116 | — |
| ART-05 | Phase 116 | — |
| ART-06 | Phase 116 | — |
| ART-07 | Phase 116 | — |
| INT-01 | Phase 117 | — |
| INT-02 | Phase 117 | — |
| INT-03 | Phase 117 | — |
| INT-04 | Phase 117 | — |
