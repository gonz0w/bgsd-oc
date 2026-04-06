# Phase 209: TDD Gate Hardening - Context

**Gathered:** 2026-04-06
**Status:** Ready for planning

<phase_intent>
## Phase Intent
- **Local Purpose:** Implement TDD plan structure verification and RED/GREEN/REFACTOR gate semantics beyond exit-code checks
- **Expected User Change:** Before: TDD plans could be malformed or have invalid gate semantics with no early detection. After: Malformed TDD plans rejected at planning-time with clear errors; gate semantics validated beyond exit codes (file-modification checks, step sequence, test count).
- **Non-Goals:**
  - Implementing new TDD workflow commands (cmdTdd is Phase 206 complete)
  - Changing TDD audit sidecar persistence (handled by Phase 208)
  - Parallel TDD safety (Phase 210)
</phase_intent>

<domain>
## Phase Boundary
Implement TDD plan structure verification at planning-time and semantic gate validation at execute-time. Extends Phase 206 RED gate work to GREEN/REFACTOR semantics. Does NOT implement new TDD commands — those are Phase 206 shipping.
</domain>

<decisions>
## Implementation Decisions

### High-Impact Decisions
- **Planning-time gate scope** — Locked. Lightweight critical-field check (type, test_file, steps exist) + step sequence validation for `type:tdd` plans only. Not full semantic validation — that's execute gate's job.
- **GREEN gate "test file NOT modified"** — Locked. Mtime+size comparison first (fast path). Semantic diff fallback (whitespace-insensitive) only if mtime/size indicate changes.

### Medium Decisions
- **REFACTOR gate "no new behavior" proof** — Locked. Test count only (tests run === tests expected). Simple and sufficient.
- **TDD eligibility evaluation scope** — Locked. All plans get TDD eligibility check with explicit rationale in frontmatter.
- **Rationale field format** — Locked. `tdd_rationale:` in plan frontmatter only. Not duplicated in summary.

### Agent's Discretion
- How to structure the planning-time gate as a reusable function that can be called from the planner
- Specific error messages for each validation failure
- Cache invalidation strategy for repeated planning-time gate runs on same plan
</decisions>

<specifics>
## Specific Ideas
- Planning-time gate should be callable from planner context before task breakdown begins
- GREEN gate mtime/size check: record mtime+size before test run, compare after
- Step sequence validation: verify steps array has RED before GREEN before REFACTOR (for type:tdd plans)
- Double-gate rationale: planning-time catches linter-level issues fast; execute gate catches real-run issues
</specifics>

<stress_tested>
## Stress-Tested Decisions
- Planning-time gate: narrowed to critical fields + `type:tdd` sequence check only — accepted as "linter not gate" concern, resolved by keeping execute gate as full semantic validation
- GREEN gate fallback: no change — agent-driven model has no pre-commit hooks, mtime/size fast path sufficient
- All decisions held up under stress testing — no revisions needed
</stress_tested>

<deferred>
## Deferred Ideas
- None — discussion stayed within phase scope
</deferred>

---
*Phase: 209-tdd-gate-hardening*
*Context gathered: 2026-04-06*
