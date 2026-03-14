# Project Research Summary

**Project:** bGSD Plugin — v11.4 Housekeeping & Stabilization
**Domain:** Internal quality, test infrastructure, CLI routing, planning artifact cleanup
**Researched:** 2026-03-13
**Confidence:** HIGH

<!-- section: compact -->
<compact_summary>
<!-- The compact summary is the DEFAULT view for orchestrators and planners.
     Keep it under 30 lines. Synthesizes all 4 research areas.
     Full sections below are loaded on-demand via extract-sections. -->

**Summary:** Four areas of technical debt researched: test suite failures (607/1014 failing — 97% caused by a single Bun runtime banner bug), CLI command routing gaps (2 missing routes, 1 orphaned module, stale validator data), planning artifact inconsistencies (30 issues across MILESTONES.md, PROJECT.md, STATE.md, INTENT.md), and intent archival pitfalls (7 pitfalls around traceability, ID collision, workflow sequencing). All fixes are well-understood with high confidence.

**Recommended stack:** Existing Node.js CLI (`bin/bgsd-tools.cjs`), `node:test` runner, `execSync` test harness — no new dependencies needed

**Architecture:** Single-file CLI with modular `src/` build, 130+ routes across 9 namespaces, 41 slash commands, 43 workflows

**Top pitfalls:**
1. **Bun banner poisons JSON output** — guard `showBanner` on `process.stdout.isTTY` (1-line fix, 589 tests recovered)
2. **Missing CLI routes called by workflows** — `verify:handoff` and `verify:agents` don't exist but `execute-phase.md` calls them
3. **Intent ID collision after archival** — `getNextId()` must continue sequence monotonically, never reset to DO-01
4. **MILESTONES.md missing 6 entries** — v8.0, v8.1, v9.1, v11.0, v11.1, v11.2 shipped but never recorded
5. **Partial archival on failure** — snapshot INTENT.md before modify, restore on error

**Suggested phases:**
1. **Test Suite Stabilization** — fix banner bug + 18 residual test failures (unblocks all other work)
2. **CLI Routing Cleanup** — fix missing routes, remove dead code, sync validator
3. **Planning Artifact Normalization** — fix MILESTONES.md, PROJECT.md, STATE.md, INTENT.md formatting and data
4. **Intent Archival System** — implement automated outcome archival in milestone completion workflow

**Confidence:** HIGH | **Gaps:** v11.2 milestone status unclear (no archives found); intent archival timing (complete-milestone vs new-milestone) needs design decision
</compact_summary>
<!-- /section -->

<!-- section: executive_summary -->
## Executive Summary

This milestone targets four areas of accumulated technical debt in the bGSD plugin. The test suite has 607 of 1014 tests failing, but 97% share a single root cause: a Bun runtime banner that pollutes JSON output parsed by tests. A one-line guard in `src/router.js` fixes 589 failures instantly. The remaining 18 failures are spread across stale profiler references, plugin test isolation issues, and infrastructure edge cases — all individually straightforward.

The CLI command routing audit found 130+ registered routes across 9 namespaces. Two routes (`verify:handoff`, `verify:agents`) are called by the main execution workflow but don't exist — they'll fail at runtime. One command module (`src/commands/ci.js`, 327 lines) is completely orphaned: not imported, not routed, never loaded. The command validator (`commandDiscovery.js`) is missing the `audit` namespace and has 5 stale subcommand lists. None of these issues are interconnected; all fixes are independent.

Planning artifacts have accumulated 30 issues across 5 files over 18 milestones. The most impactful: MILESTONES.md is missing entries for 6 shipped milestones, has entries out of chronological order, and the v9.2 entry contains v9.0's description (copy-paste error). PROJECT.md has stale module counts, orphaned HTML tags, and broken table rows. INTENT.md history entries are out of order with a mislabeled version. The intent archival system (automating outcome cleanup during milestone completion) has 7 identified pitfalls, with ID collision and workflow sequencing being the most critical design decisions.
<!-- /section -->

<!-- section: key_findings -->
## Key Findings

### Test Suite (STACK.md)

The test suite uses `node:test` with `execSync`-based CLI invocation. Tests pipe stdout and `JSON.parse()` the output. When Bun is installed on the system, a runtime banner (`[bGSD] Running with Bun v1.3.10`) is written to stdout via `console.log()`, prepending invalid text to JSON output.

**Root cause breakdown:**

| Category | Failures | Fix Complexity |
|----------|----------|----------------|
| Bun runtime banner (stdout pollution) | 589 | 1-line guard on `process.stdout.isTTY` |
| Missing `src/lib/profiler` module | 3 | Remove stale tests |
| Plugin parser/tool test isolation | 7 | Use temp dirs, not live project |
| Infrastructure assertions (`_tmpFiles`) | 3 | Update assertions |
| Config migration edge cases | 2 | Update test expectations |
| Env/misc edge cases | 3 | Individual investigation |

**Estimated total effort:** 1.5-2 hours across 5 fix waves.

### CLI Command Routing (FEATURES.md)

Full inventory of 130+ routes across 9 namespaces verified via static analysis.

**Critical findings:**
- 2 missing routes: `verify:handoff` and `verify:agents` — called by `execute-phase.md` but have no implementation
- 1 orphaned module: `src/commands/ci.js` (327 lines) — no lazy loader, no route, never imported
- 1 missing validator namespace: `audit` not in `commandDiscovery.js`
- 5 stale subcommand lists in validator vs actual router
- 20 routes missing `COMMAND_HELP` entries
- 1 dead route: `execute:profile` just prints an error
- 2 duplicate routes: `runtime` and `measure` exist as both `util:` and standalone

**Key dependency:** All fixes are independent; no ordering constraints.

### Planning Artifacts (ARCHITECTURE.md)

30 issues cataloged across MILESTONES.md (11), PROJECT.md (14), STATE.md (2), config.json (1), INTENT.md (2).

**Major issues:**
1. **MILESTONES.md missing 6 milestone entries** — v8.0, v8.1, v9.1, v11.0, v11.1, v11.2 all shipped (archives exist) but were never recorded
2. **MILESTONES.md v9.2 entry has v9.0's content** — heading says "CLI Tool Integrations" but body describes "Embedded Plugin Experience"
3. **Non-chronological ordering** in both MILESTONES.md and INTENT.md history
4. **PROJECT.md stale counts** — "53 modules" (actual: ~119), "45 workflows" (actual: 44), "34-module split" (actual: 61+)
5. **Orphaned HTML tags** — standalone `</details>` at PROJECT.md:68
6. **Broken table rows** — 3 rows missing columns in Key Decisions table

### Critical Pitfalls (PITFALLS.md)

7 pitfalls identified for the intent archival system:

1. **Broken traceability** — Plans reference outcome IDs (DO-72, etc.) that become invalid after archival. `cmdIntentTrace()` only checks active INTENT.md.
2. **History grows unbounded** — Append-only history section inflates context windows across milestones.
3. **Partial archival failure** — `cmdMilestoneComplete()` uses best-effort try/catch; adding intent archival adds another failure point.
4. **ID collision after reset** — `getNextId()` scans only current outcomes; if list is cleared, it returns DO-01 instead of continuing the sequence.
5. **`new-milestone` workflow assumes active outcomes exist** — If archival runs during `complete-milestone`, the evolution questionnaire in `new-milestone` Step 4.5 finds nothing to review.
6. **Plugin stale cache** — Module-level intent cache isn't invalidated after CLI-driven INTENT.md modifications.
7. **Advisory guardrails block archival** — INTENT.md modification allowlist doesn't include `complete-milestone`.
<!-- /section -->

<!-- section: roadmap_implications -->
## Implications for Roadmap

Based on research, suggested phase structure:

### Phase 1: Test Suite Stabilization
**Rationale:** Tests must be green before making any other changes — they provide the safety net for all subsequent work.
**Delivers:** All 1014 tests passing (zero failures).
**Addresses:** DO-72 (test suite green), SC-51 (npm test zero failures)
**Avoids:** Bun banner pitfall — single guard in `src/router.js`; stale test references to deleted modules
**Estimated effort:** 1.5-2 hours across 5 fix waves

### Phase 2: CLI Routing Cleanup
**Rationale:** Routing issues affect agent execution reliability. Missing routes silently fail during phase execution workflows. Independent of test fixes but benefits from green tests for verification.
**Delivers:** Verified command routing with zero broken routes, zero orphaned modules.
**Addresses:** DO-74 (CLI routing verified), SC-53 (working routes), SC-54 (no orphaned commands)
**Avoids:** Missing route pitfall — workflow calls to non-existent `verify:handoff`/`verify:agents`
**Estimated effort:** 1-1.5 hours

### Phase 3: Planning Artifact Normalization
**Rationale:** Planning files are consumed by every agent. Stale data wastes tokens and creates confusion. Can be done independently but benefits from green tests.
**Delivers:** Clean MILESTONES.md (all entries, chronological, consistent format), accurate PROJECT.md, ordered INTENT.md history.
**Addresses:** DO-75 (artifacts normalized), DO-76 (out-of-scope reviewed), DO-77 (decisions audited), DO-78 (health metrics), SC-55-SC-57
**Avoids:** Copy-paste anti-pattern — generate entries from archived ROADMAP data, not from other entries
**Estimated effort:** 2-3 hours across 3 plans (mechanical fixes, MILESTONES.md overhaul, PROJECT.md streamlining)

### Phase 4: Intent Archival System
**Rationale:** Depends on understanding gathered from Phase 3 artifact audit. Requires design decisions about archive timing, ID continuity, and workflow integration.
**Delivers:** Automated INTENT.md outcome archival during milestone completion.
**Addresses:** DO-73 (INTENT.md clean and current), SC-52 (fewer than 15 active outcomes)
**Avoids:** All 7 intent archival pitfalls — especially ID collision (monotonic IDs), partial failure (snapshot-before-modify), and workflow sequencing (archive during `complete-milestone`, load archive in `new-milestone` for evolution review)
**Estimated effort:** 2-3 hours

### Phase Ordering Rationale

- **Phase 1 first:** Green tests are the prerequisite for safe changes everywhere else. The banner fix is a 1-line change with massive impact (589 tests).
- **Phase 2 before Phase 3:** Routing fixes are code changes that should happen while the test suite is fresh. Artifact fixes are markdown-only and lower risk.
- **Phase 3 before Phase 4:** The artifact audit reveals the full scope of planning debt (especially MILESTONES.md gaps). Intent archival design should account for all the patterns discovered.
- **Phase 4 last:** Intent archival is the most complex work (7 pitfalls, design decisions, workflow integration). All other cleanup should be complete first.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 4 (Intent Archival):** Design decision needed on archive timing — during `complete-milestone` vs `new-milestone`. PITFALLS.md recommends archiving during `complete-milestone` with workflow updates for `new-milestone` to load archived intents for evolution review.

Phases with standard patterns (skip research-phase):
- **Phase 1 (Test Stabilization):** Root cause fully identified; fix strategy verified via env-var test.
- **Phase 2 (CLI Routing):** All issues enumerated with specific file/line references.
- **Phase 3 (Artifact Normalization):** All 30 issues cataloged with fixes. Mechanical work.
<!-- /section -->

<!-- section: confidence -->
## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack (Test Suite) | HIGH | Root cause verified via live test runs with/without env suppression |
| Features (CLI Routing) | HIGH | Source-of-truth analysis of router.js, constants.js, commandDiscovery.js, all slash commands and workflows |
| Architecture (Artifacts) | HIGH | All findings verified against filesystem; line numbers confirmed |
| Pitfalls (Intent Archival) | HIGH | Direct code analysis of phase.js, intent.js, helpers.js, workflows |

**Overall confidence:** HIGH

### Gaps to Address

- **v11.2 milestone status:** No archives exist (no ROADMAP, REQUIREMENTS, DOCS, or phases directory). Only referenced in INTENT.md history. Needs investigation: was it shipped, folded into another milestone, or abandoned?
- **Intent archival timing:** Research recommends archiving during `complete-milestone` and loading archives in `new-milestone` for evolution review, but this is a design recommendation, not a verified pattern. Needs user confirmation.
- **Test count accuracy after fixes:** The projected pass/fail counts after banner fix are based on env-var suppression testing, not the actual code fix. Final numbers may differ slightly.
<!-- /section -->

<!-- section: sources -->
## Sources

### Primary (HIGH confidence)
- **Live test run:** `node --test --test-force-exit --test-concurrency=8 tests/*.test.cjs` — 1014 tests, 407 pass, 607 fail
- **Banner suppression test:** `BGSD_RUNTIME=node BGSD_RUNTIME_DETECTED=true` — 996 pass, 18 fail
- **Source analysis:** `src/router.js` (1337 lines), `src/lib/constants.js` (1021 lines), `src/lib/commandDiscovery.js` (584 lines)
- **Source analysis:** `src/commands/phase.js` lines 848-1241, `src/commands/intent.js` (1260 lines), `src/lib/helpers.js` lines 655-999
- **Filesystem audit:** `.planning/milestones/` (71 archive files, 21 version prefixes), `src/lib/` (35 files), `src/commands/` (24 files)
- **Cross-reference:** 41 slash commands, 43 workflows, 24 command modules — all verified

### Secondary (MEDIUM confidence)
- **v11.2 status:** Only evidence is INTENT.md history entry at line 93 — no corroborating archives

---
*Research completed: 2026-03-13*
*Ready for roadmap: yes*
<!-- /section -->
