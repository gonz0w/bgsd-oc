# Phase 155: JJ Execution Gate & Workspace Lifecycle - Context

**Gathered:** 2026-03-29
**Status:** Ready for planning

<domain>
## Phase Boundary
Make JJ-backed execution mandatory for bGSD execution flows and replace worktree-shaped local execution commands with JJ-native workspace lifecycle entrypoints. This phase covers the execution gate, the visible workspace command surface, and the first-pass JJ-first posture. It does not add deeper parallel wave semantics, stale-workspace recovery, or planner workspace-awareness beyond what Phase 156+ already own.
</domain>

<decisions>
## Implementation Decisions

### High-Impact Decisions
- Execution gate coverage - Locked. Fail fast not just on execution starts, but also on execute-specific init/context surfaces in Git-only repos, so users learn the JJ prerequisite before doing meaningful execution prep. Read-only planning/help flows stay allowed.
- Command migration stance - Locked. Hard-remove the old worktree command surface rather than keeping aliases or migration shims. Reasoning: this is a greenfield app with no existing users, so product clarity matters more than compatibility.
- JJ workspace command model - Locked. Use a dedicated top-level `workspace` command family as the canonical lifecycle surface rather than hiding it under `execute:*`. Reasoning: the big-bang surface reset should make the new model obvious and first-class.

### Medium Decisions
- Config migration behavior - Locked. Hard-reject legacy `worktree` config instead of silently mapping or tolerating it. Reasoning: keep the JJ-first contract explicit and implementation simpler in the first cut.
- Supported local parallel story - Locked. Execution surfaces should clearly advertise JJ-first execution and workspace lifecycle now, while leaving deeper wave/recovery semantics to Phase 156.

### Low Defaults and Open Questions
- Workspace naming/path policy - Defaulted. Use predictable phase/plan-derived names under a JJ-focused base path, mirroring the current predictable layout style.
- Inspect output shape - Defaulted, then stress-test revised. Keep JSON/machine output structured, and keep human output scan-friendly but richer than a minimal terse default so users can debug without dumping full JJ internals.

### Agent's Discretion
- Exact setup guidance copy for JJ-required failures, as long as it clearly states JJ is required and points users to the supported setup path.
- Exact subcommand names within the top-level `workspace` family, as long as they cover create/add, list/status, cleanup/forget, and integrate/reconcile in a JJ-native way.
- Exact human-readable fields shown in default workspace inspection output, as long as the output stays richer than terse and still easy to scan.
</decisions>

<specifics>
## Specific Ideas
- User context: this is effectively greenfield with no existing user base, so compatibility cost is low.
- User endorsed a big-bang command-surface reset rather than transitional aliasing.
- User is comfortable with explicit config breakage for now if it keeps the first implementation cleaner.
- User preference for inspect/list output: not full-detail JJ internals, but more informative than a sparse default.
</specifics>

<stress_tested>
## Stress-Tested Decisions
- Execution gate coverage
  - Original decision: Agent-default conservative boundary around execution starts.
  - Stress-test revision: Expand fail-fast gating to execution starts plus execute-specific init/context surfaces.
  - Follow-on clarification: Keep read-only planning/help surfaces outside the gate.
- Inspect output shape
  - Original decision: Concise human output plus structured JSON output.
  - Stress-test revision: Human output should remain scan-friendly but include richer default status/context for debugging.
  - Follow-on clarification: Do not dump full JJ internals by default; keep machine output structured.
- All other challenged decisions held up under stress testing, including hard removal of worktree commands, top-level `workspace` family, and hard rejection of legacy `worktree` config.
</stress_tested>

<deferred>
## Deferred Ideas
None - discussion stayed within phase scope.
</deferred>

---
*Phase: 155-jj-execution-gate-workspace-lifecycle*
*Context gathered: 2026-03-29*
