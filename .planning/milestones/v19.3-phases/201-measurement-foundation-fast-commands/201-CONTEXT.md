# Phase 201: Measurement Foundation & Fast Commands - Context

**Gathered:** 2026-04-05
**Status:** Ready for planning

<phase_intent>
## Phase Intent
- **Local Purpose:** Establish baseline telemetry for routing/caching decisions and implement `--fast`/`--batch` flags to reduce turns on routine work
- **Expected User Change:** Before: every phase discussion starts fresh with no performance history. After: baseline telemetry guides routing decisions, and routine phases use fewer turns via `--fast`/`--batch` flags
- **Non-Goals:**
  - Parallelization safety (Phase 202)
  - State mutation safety (Phase 203)
  - Permanent cache storage beyond session (TTL-backed only)
</phase_intent>

<domain>
## Phase Boundary
Establish baseline hot-path profiling, adaptive telemetry hooks, TTL-backed PlanningCache with file-hash+TTL hybrid freshness, batch freshness checks, and `--fast`/`--batch` command flags
</domain>

<decisions>
## Implementation Decisions

### High-Impact Decisions
- **PlanningCache TTL** — Hybrid (file-hash primary, 10min TTL fallback). File changes invalidate immediately; 10min TTL catches edge cases like copied files with old mtime. Defaulted.
- **"Routine" criteria for `--fast`** — Low gray-area count. Phases with ≤2 low-ranked gray areas qualify as routine. Locked.

### Medium Decisions
- **Batch size N for `verify-work --batch`** — Risk-aware default: N=1 for verify, N=5 for routine check, configurable. Locked.
- **Telemetry granularity** — Coarse + frequency (route name + hit count). Good signal-to-noise for hotpath analysis. Defaulted.
- **Freshness criteria for SQLite batch checks** — Hybrid: TTL as primary, mtime as fallback for critical paths. Locked.

### Low Defaults and Open Questions
- **ACCEL-BASELINE.json format** — JSON with named fields (easy to extend). Defaulted.
- **`workflow:hotpath` output format** — Clarification needed later; not blocking. Untouched.
</decisions>

<specifics>
## Specific Ideas
No specific requirements — open to standard approaches
</specifics>

<stress_tested>
## Stress-Tested Decisions
- **Original:** 60s fixed TTL for PlanningCache
- **Stress-test revision:** File-hash based hybrid with 10min TTL fallback
- **Follow-on clarification:** None needed — hybrid approach handles mtime edge case
</stress_tested>

<deferred>
## Deferred Ideas
None — discussion stayed within phase scope
</deferred>

---
*Phase: 201-measurement-foundation-fast-commands*
*Context gathered: 2026-04-05*
