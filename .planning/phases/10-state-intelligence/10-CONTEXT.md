# Phase 10: State Intelligence - Context

**Gathered:** 2026-02-22
**Status:** Ready for planning

<domain>
## Phase Boundary

Plugin detects when its declared state drifts from filesystem/git reality and warns before execution begins. Covers drift detection between ROADMAP.md claims and disk reality, position validation in STATE.md, stale activity detection via git history, auto-correction of unambiguous drift, blocker/TODO staleness tracking, and pre-flight validation in execute-phase.

Requirements: SVAL-01, SVAL-02, SVAL-03, SVAL-04, SVAL-05, SVAL-06

</domain>

<decisions>
## Implementation Decisions

### Validation output & reporting
- Structured table format with columns: Type | Location | Expected | Actual | Severity
- Two severity levels: **error** (must fix) and **warn** (should look at)
- Clean state outputs short confirmation: "State validation passed — no issues found"
- Supports `--raw` flag for JSON output, consistent with other gsd-tools commands. JSON returns array of `{type, location, expected, actual, severity}` objects

### Auto-fix boundaries
- `--fix` scope is **count mismatches only** — plan counts in ROADMAP.md that don't match actual files on disk
- No preview/confirmation — just fix and show what changed
- Auto-commits each fix with descriptive message (e.g., `fix(state): correct phase 3 plan count 3/5 → 4/5`)
- Partial fix behavior: fix what it can, warn on issues that require manual resolution
- Timestamps, position, and other non-count drift are NOT auto-fixed (too ambiguous)

### Pre-flight integration
- Execute-phase runs state validation as pre-flight check automatically
- **Errors block execution**, warnings print but don't block
- Error classification: **position errors + count mismatches = error (blocking)**; staleness = warning (non-blocking)
- Default behavior: pre-flight auto-runs `--fix` first for what it can, then blocks only on remaining errors
- `--skip-validate` flag available to bypass pre-flight entirely for experienced users
- Output: minimal banner on clean state ("Pre-flight: OK"), full table only when issues exist

### Staleness thresholds
- Activity staleness uses **both checks**: compare STATE.md's declared "last activity" timestamp against (1) most recent .planning/ git commit AND (2) STATE.md's own git commit history
- Blocker AND TODO staleness both tracked — flag items open for N completed plans without resolution
- Default threshold: **2 plans** (aggressive — surfaces forgotten items quickly)
- Threshold is **configurable** via `.planning/config.json` (key TBD by planner, default 2)

### Agent's Discretion
- Exact table formatting and column widths
- JSON schema details beyond the specified fields
- Commit message format variations for auto-fix
- Config key naming for staleness threshold

</decisions>

<specifics>
## Specific Ideas

- Pre-flight should feel lightweight — not a ceremony. "Pre-flight: OK" when clean, detailed table only when something is wrong.
- Auto-fix + continue as the default pre-flight flow means most sessions self-heal without user intervention.
- The combination of `--skip-validate` (bypass entirely) and auto-fix-then-block (default) gives both power users and standard flows what they need.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 10-state-intelligence*
*Context gathered: 2026-02-22*
