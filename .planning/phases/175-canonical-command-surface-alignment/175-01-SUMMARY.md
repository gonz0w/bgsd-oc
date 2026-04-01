---
phase: 175-canonical-command-surface-alignment
plan: 01
subsystem: cli
tags: [planning, commands, validation, commonjs]
requires:
  - phase: 174-greenfield-compatibility-surface-cleanup
    provides: canonical command-integrity guidance and legacy planning alias classification
provides:
  - planning-family route metadata parsed from commands/bgsd-plan.md
  - strict /bgsd-plan shorthand rejection without intent guessing
  - canonical legacy planning-wrapper suggestions sourced from shared metadata
affects: [phase-175-plan-02, phase-175-plan-03, phase-175-plan-04]
tech-stack:
  added: []
  patterns:
    - command-integrity planning rules derive nested route grammar from command markdown
    - legacy planning aliases stay suggestion-only metadata backed by canonical route definitions
key-files:
  created:
    - src/lib/planning-command-surface.js
  modified:
    - tests/validate-commands.test.cjs
    - src/lib/commandDiscovery.js
    - bin/bgsd-tools.cjs
    - .planning/phases/175-canonical-command-surface-alignment/175-01-SUMMARY.md
key-decisions:
  - "Parse the planning-family route matrix directly from commands/bgsd-plan.md so command discovery stops duplicating hard-coded planning rules."
  - "Validate /bgsd-plan using parsed literal prefixes plus required operand counts so roadmap/todo families stay strict without guessing intent from bare operands."
patterns-established:
  - "Canonical command markdown owns planning-family grammar; validators load metadata instead of restating route tables."
requirements-completed: [CLI-01, CLI-02]
one-liner: "Shared /bgsd-plan route metadata loader with strict shorthand rejection and canonical legacy alias suggestions"
duration: 9min
completed: 2026-04-01
---

# Phase 175 Plan 01: Make `commands/bgsd-plan.md` the maintainable planning-family route matrix that command-integrity validation and planning-family shorthand rules read from directly. Summary

**Shared /bgsd-plan route metadata loader with strict shorthand rejection and canonical legacy alias suggestions**

## Performance

- **Duration:** 9 min
- **Started:** 2026-04-01T03:44:29Z
- **Completed:** 2026-04-01T03:53:29Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments

- Added a focused planning-command-surface loader that parses the canonical route matrix from `commands/bgsd-plan.md`.
- Rewired planning-family validation so `/bgsd-plan 175` and incomplete nested forms fail deterministically instead of relying on hand-maintained route checks.
- Added RED/GREEN regressions covering route-matrix parity, shorthand rejection, and legacy wrapper suggestions sourced from the canonical planning family.

## Task Commits

Each task was committed atomically:

1. **Task 1: Add RED regressions for canonical planning-family parsing and shorthand rejection** - `294aefa` (test)
2. **Task 2: Extract shared planning-family metadata and wire command discovery to it** - `262ee50` (feat)

## TDD Audit Trail

Review the exact RED/GREEN/REFACTOR proof package here. REFACTOR evidence is required when a refactor commit exists.

### RED
- **Commit:** `294aefa` (test: test(175-01): add failing planning surface regressions)
- **GSD-Phase:** red
- **Target command:** `node --test tests/validate-commands.test.cjs`
- **Exit status:** `1`
- **Matched evidence:** `bare phase shorthand should fail instead of being treated as runnable guidance`

### GREEN
- **Commit:** `262ee50` (feat: feat(175-01): derive planning validation from canonical route matrix)
- **GSD-Phase:** green
- **Target command:** `npm run test:file -- tests/validate-commands.test.cjs`
- **Exit status:** `0`
- **Matched evidence:** `ℹ pass 14`

### Machine-Readable Stage Proof

```json
{
  "red": {
    "commit": {
      "hash": "294aefaecb38b0f728bd00148f1c05444d454134",
      "message": "test(175-01): add failing planning surface regressions",
      "gsd_phase": "red"
    },
    "proof": {
      "target_command": "node --test tests/validate-commands.test.cjs",
      "exit_code": 1,
      "matched_evidence_snippet": "bare phase shorthand should fail instead of being treated as runnable guidance"
    }
  },
  "green": {
    "commit": {
      "hash": "262ee50d587f6de983f453a85aa19081c2260e7c",
      "message": "feat(175-01): derive planning validation from canonical route matrix",
      "gsd_phase": "green"
    },
    "proof": {
      "target_command": "npm run test:file -- tests/validate-commands.test.cjs",
      "exit_code": 0,
      "matched_evidence_snippet": "ℹ pass 14"
    }
  }
}
```

## Files Created/Modified

- `bin/bgsd-tools.cjs` [+338/-338]
- `src/lib/commandDiscovery.js` [+139/-34]
- `src/lib/planning-command-surface.js` [+85/-0]
- `tests/validate-commands.test.cjs` [+72/-0]
- `commands/bgsd-plan.md` - Canonical planning-family route matrix consumed by the new loader

## Decisions Made

- Parse the planning-family route matrix from `commands/bgsd-plan.md` so maintainers can change supported planning routes in one canonical place.
- Use parsed literal prefixes plus required operand counts for `/bgsd-plan` validation so nested `roadmap` and `todo` routes stay strict without guessing intent.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- `node bin/bgsd-tools.cjs util:validate-commands --raw` still reports broad command-integrity failures in untouched future-plan surfaces (docs, workflows, agents, runtime guidance). This plan kept scope on the shared planning parser and targeted regressions, so the focused TDD proof is green while later Phase 175 plans remain responsible for those surface rewrites.

## Next Phase Readiness

- Plans 02-04 can now reuse shared planning-family metadata while rewriting docs, workflow guidance, and sibling planning routes.
- Broad command-integrity cleanup for roadmap/todo/help surfaces remains outstanding and is expected follow-up work within the rest of Phase 175.

## Self-Check: PASSED

- Found `.planning/phases/175-canonical-command-surface-alignment/175-01-SUMMARY.md`
- Found `src/lib/planning-command-surface.js`
- Verified commits `294aefae` and `262ee50d` in `jj log`

---
*Phase: 175-canonical-command-surface-alignment*
*Completed: 2026-04-01*
