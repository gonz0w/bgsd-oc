---
phase: 159-help-surface-command-integrity
plan: 12
subsystem: cli
tags:
  - markdown
  - commonjs
  - json
  - javascript
requires:
  - phase: 159-05
    provides: Canonical planning-family and settings-family guidance for touched support surfaces
  - phase: 159-06
    provides: Canonical inspect-family guidance and reference-only compatibility framing
  - phase: 159-11
    provides: Full-file regression style for exact shipped command-guidance blockers
provides:
  - Canonical planning, inspect, and direct CLI wording on the remaining high-traffic workflow, doc, agent, and runtime help surfaces
  - Phase-aware planning guidance that keeps compatibility notes reference-only instead of runnable
  - Direct regression coverage for the exact remaining surfaced files named by Phase 159 verification
affects: [verification, runtime-help, docs, workflows, agent-prompts]
tech-stack:
  added: []
  patterns:
    - Full-file surfaced-guidance regression checks fed by exact shipped file contents plus targeted runtime-help extracts
    - Canonical slash guidance paired with namespaced `bgsd-tools` direct CLI examples for executable help text
key-files:
  created:
    - tests/guidance-command-integrity-remaining-surfaces.test.cjs
  modified: [docs/workflows.md, workflows/plan-phase.md, workflows/execute-phase.md, docs/architecture.md, docs/agents.md, agents/bgsd-verifier.md, src/lib/constants.js, src/plugin/advisory-guardrails.js, plugin.js, bin/bgsd-tools.cjs]
key-decisions:
  - "Keep compatibility aliases out of runnable prose and describe them generically unless the surface is explicitly reference-only."
  - "Use canonical `bgsd-tools util:...` and `execute:...` examples in shipped help text so runtime guidance matches routed CLI commands exactly."
patterns-established:
  - "Remaining command-integrity regressions should read shipped files directly and validate only the relevant runtime-help extracts instead of synthetic snippets."
  - "Planning and progress surfaces should prefer phase-aware `/bgsd-plan ...` and `/bgsd-inspect progress` examples whenever users are told what to run next."
requirements-completed: [CMD-05, CMD-06]
one-liner: "Canonical planning, inspect, and runtime help guidance across the remaining Phase 159 docs, workflows, agent prompt, and bundle surfaces"
duration: 13min
completed: 2026-03-30
---

# Phase 159 Plan 12: Close the remaining repo-wide surfaced-guidance blockers so Phase 159's command-integrity contract applies to the last high-traffic docs, workflow prompts, agent guidance, and runtime help output. Summary

**Canonical planning, inspect, and runtime help guidance across the remaining Phase 159 docs, workflows, agent prompt, and bundle surfaces**

## Performance

- **Duration:** 13 min
- **Started:** 2026-03-29 21:13:50 -0600
- **Completed:** 2026-03-29 21:27:04 -0600
- **Tasks:** 3
- **Files modified:** 14

## Accomplishments

- Rewrote the last planning and execution guidance tables and follow-ups to use canonical `/bgsd-plan ...`, `/bgsd-inspect progress`, `/bgsd-settings ...`, and phase-aware arguments instead of legacy runnable aliases.
- Fixed the remaining architecture, agent, verifier, advisory, and runtime-help examples so shipped direct CLI text now points at real routed `bgsd-tools util:...` and `execute:...` commands.
- Added a focused regression that reads the exact shipped remaining surfaces and validator-checks the relevant runtime-help extracts to keep CMD-06 locked going forward.

## Task Commits

Each task was committed atomically:

1. **Task 1: Canonicalize the remaining planning and execution guidance surfaces** - `lnqozmoq` (docs)
2. **Task 2: Fix the remaining docs, agent, and runtime help examples called out by verification** - `prqmlyto` (docs)
3. **Task 3: Lock the remaining surfaced files with direct validator-backed regression coverage** - `worrknmw` (test)

**Plan metadata:** `xwrlotko` (docs)

## Files Created/Modified

- `agents/bgsd-verifier.md` [+1/-1]
- `bin/bgsd-tools.cjs` [+337/-333]
- `bin/manifest.json` [+3/-3]
- `docs/agents.md` [+12/-12]
- `docs/architecture.md` [+22/-22]
- `docs/workflows.md` [+31/-29]
- `plugin.js` [+61/-57]
- `skills/skill-index/SKILL.md` [+1/-1]
- `src/lib/constants.js` [+56/-52]
- `src/plugin/advisory-guardrails.js` [+5/-5]
- `tests/guidance-command-integrity-remaining-surfaces.test.cjs` [+116/-0]
- `tests/plugin-advisory-guardrails.test.cjs` [+2/-2]
- `workflows/execute-phase.md` [+2/-2]
- `workflows/plan-phase.md` [+3/-3]

## Decisions Made

- Kept compatibility wording generic on runnable surfaces so the validator treats aliases as reference-only context rather than active next-step guidance.
- Updated shipped direct CLI help to namespaced `bgsd-tools util:...` and `execute:...` examples because the old space-separated variants advertised nonexistent routes.
- Scoped the new regression to exact shipped files plus relevant runtime-help extracts so the proof stays fast while still validating the real surfaces users read.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## Next Phase Readiness

- The remaining Phase 159 blocker surfaces are now canonicalized and backed by one focused validator regression path.
- Verification can re-run against the cleaned workflow, doc, agent, advisory, and bundle surfaces without users having to guess aliases or missing arguments.

## Self-Check

PASSED

- Found `.planning/phases/159-help-surface-command-integrity/159-12-SUMMARY.md`
- Found task commit `lnqozmoq`
- Found task commit `prqmlyto`
- Found task commit `worrknmw`

---
*Phase: 159-help-surface-command-integrity*
*Completed: 2026-03-30*
