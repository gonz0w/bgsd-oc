---
phase: 174-greenfield-compatibility-surface-cleanup
plan: 05
subsystem: core
tags: [javascript, commonjs, nl, command-routing]

# Dependency graph
requires:
  - phase: 174-01
    provides: retired command/help cleanup baseline used by the NL registry sweep
provides:
  - NL registry phrases route to canonical command families only
  - Fallback help points progress lookups at `/bgsd-inspect progress`
  - Command-integrity regressions catch stale hidden compatibility mappings
affects: [phase-175-command-surface-alignment, nl, help, command-discovery]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - canonical-only NL discovery mappings
    - file-tied command-integrity regressions for hidden fallback surfaces

key-files:
  created: []
  modified:
    - tests/validate-commands.test.cjs
    - src/lib/nl/command-registry.js
    - src/lib/nl/help-fallback.js
    - src/lib/nl/suggestion-engine.js
    - src/lib/nl/conversational-planner.js
    - src/lib/nl/nl-parser.js

key-decisions:
  - "Repoint stale progress and phase-verification phrases to canonical `verify:state` instead of preserving hidden compatibility commands."
  - "Use `plan:milestone` plus `/bgsd-inspect progress` guidance so milestone and progress discovery stays aligned with the routed command families."

patterns-established:
  - "Hidden NL discovery must match supported routed command families, not retired internal command names."
  - "Command-integrity tests should read touched NL files directly so stale compatibility mappings fail with actionable file-level evidence."

requirements-completed: [CLEAN-03]
one-liner: "Canonical NL registry and fallback guidance now route phase verification, progress lookups, and milestone prompts through `verify:state`, `plan:milestone`, and `/bgsd-inspect progress`."

# Metrics
duration: 5min
completed: 2026-04-01
---

# Phase 174 Plan 05: Prune stale NL and fallback registries so hidden discovery behavior matches the supported canonical command surface instead of preserving compatibility-era mappings. Summary

**Canonical NL registry and fallback guidance now route phase verification, progress lookups, and milestone prompts through `verify:state`, `plan:milestone`, and `/bgsd-inspect progress`.**

## Performance

- **Duration:** 5 min
- **Started:** 2026-04-01T00:37:31Z
- **Completed:** 2026-04-01T00:42:41Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments

- Removed hidden `verify:phase`, `session:progress`, `roadmap:show`, and `milestone:new` references from the touched NL discovery stack so Phase 174 intent stays **aligned** with canonical-only active paths.
- Replaced stale fallback suggestions with canonical `verify:state` and `plan:milestone` command families while explicitly teaching `/bgsd-inspect progress` for progress-oriented follow-up.
- Added command-integrity regressions that read the touched NL files directly, so stale compatibility-era names now fail fast with actionable file evidence.

## Task Commits

Each task was committed atomically:

1. **Task 1: Add RED regressions for stale NL and fallback mappings** - `31db613` (test)
2. **Task 2: Remove hidden compatibility mappings from NL registries and fallback helpers** - `ba86c1d` (feat)

**Plan metadata:** recorded in the final metadata commit for this plan.

## TDD Audit Trail

Review the exact RED/GREEN/REFACTOR proof package here. REFACTOR evidence is required when a refactor commit exists.

### RED
- **Commit:** `31db613` (test: test(174-05): add failing NL command cleanup regressions)
- **GSD-Phase:** red
- **Target command:** `node --test tests/validate-commands.test.cjs --test-name-pattern "stale registry commands|NL fallback surfaces"`
- **Exit status:** `1`
- **Matched evidence:** `✖ stale registry commands are rejected from NL fallback surfaces`

### GREEN
- **Commit:** `ba86c1d` (feat: feat(174-05): align NL discovery with canonical commands)
- **GSD-Phase:** green
- **Target command:** `npm run test:file -- tests/validate-commands.test.cjs`
- **Exit status:** `0`
- **Matched evidence:** `✔ NL fallback surfaces teach only canonical routed replacements`

### Machine-Readable Stage Proof

```json
{
  "red": {
    "commit": {
      "hash": "31db613a1d8f58f3a2a40c34d605bc9ea692bf4c",
      "message": "test(174-05): add failing NL command cleanup regressions",
      "gsd_phase": "red"
    },
    "proof": {
      "target_command": "node --test tests/validate-commands.test.cjs --test-name-pattern \"stale registry commands|NL fallback surfaces\"",
      "exit_code": 1,
      "matched_evidence_snippet": "✖ stale registry commands are rejected from NL fallback surfaces"
    }
  },
  "green": {
    "commit": {
      "hash": "ba86c1d59c3059c912edcdb98a2091c625c1ae75",
      "message": "feat(174-05): align NL discovery with canonical commands",
      "gsd_phase": "green"
    },
    "proof": {
      "target_command": "npm run test:file -- tests/validate-commands.test.cjs",
      "exit_code": 0,
      "matched_evidence_snippet": "✔ NL fallback surfaces teach only canonical routed replacements"
    }
  }
}
```

## Files Created/Modified

- `src/lib/nl/command-registry.js` [+17/-16]
- `src/lib/nl/conversational-planner.js` [+2/-2]
- `src/lib/nl/help-fallback.js` [+8/-8]
- `src/lib/nl/nl-parser.js` [+0/-5]
- `src/lib/nl/suggestion-engine.js` [+8/-10]
- `tests/validate-commands.test.cjs` [+65/-0]
- `src/lib/nl/command-registry.js
    src/lib/nl/help-fallback.js
    src/lib/nl/suggestion-engine.js
    src/lib/nl/conversational-planner.js
    src/lib/nl/nl-parser.js` [declared plan file]

## Decisions Made

- Mapped hidden phase-verification and progress-style NL phrases onto `verify:state` so the internal registry stops advertising retired non-routed commands while keeping a supported verification surface.
- Standardized milestone discovery on `plan:milestone` and progress guidance on `/bgsd-inspect progress` so fallback teaching matches the canonical routed families instead of legacy aliases.
- Intent alignment: **aligned** — the touched discovery helpers now remove compatibility-era command names instead of silently preserving split-brain behavior.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- `verify:state complete-plan` crashed on a pre-existing bundled runtime bug (`writeDebugDiagnostic is not defined`), so state updates were completed with the workflow's granular fallback commands instead.

## Next Phase Readiness

- Hidden NL discovery and fallback guidance are now **aligned** with the canonical command surface for the touched progress, verification, and milestone paths.
- Phase 175 can build on a cleaner command-surface baseline without stale internal NL mappings reintroducing removed compatibility commands behind the scenes.

## Self-Check

PASSED

- Found `.planning/phases/174-greenfield-compatibility-surface-cleanup/174-05-SUMMARY.md`
- Found `tests/validate-commands.test.cjs`, `src/lib/nl/command-registry.js`, and `src/lib/nl/help-fallback.js`
- Verified task commits `31db613a` and `ba86c1d5` in `jj log`

---
*Phase: 174-greenfield-compatibility-surface-cleanup*
*Completed: 2026-04-01*
