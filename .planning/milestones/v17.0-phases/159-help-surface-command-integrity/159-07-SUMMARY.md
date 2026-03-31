---
phase: 159-help-surface-command-integrity
plan: 07
subsystem: validation
tags: [commands, validator, guidance, docs, skills, tests]
requires:
  - phase: 158-canonical-command-families
    provides: canonical slash-command families used as the validation baseline
  - phase: 159-help-surface-command-integrity
    provides: shared command-integrity validator and touched-surface coverage from earlier plans
provides:
  - reference-style command validation that distinguishes indexes and ownership tables from runnable guidance
  - path-fragment-safe slash-command extraction for surfaced guidance scans
  - focused regression coverage for placeholder and family-form reference examples versus runnable mistakes
affects: [docs, skills, help-surfaces, validation, 159-08]
tech-stack:
  added: []
  patterns: [reference-versus-runnable validator classification, path-fragment-safe command extraction]
key-files:
  created: []
  modified: [src/lib/commandDiscovery.js, tests/validate-commands.test.cjs, tests/guidance-command-integrity-agent-skill-surfaces.test.cjs]
key-decisions:
  - "Allow placeholder and family-form commands only when the surrounding line is clearly reference-style, not runnable guidance."
  - "Ignore slash-like path fragments such as /bgsd-oc during mention extraction before semantic validation runs."
patterns-established:
  - "Semantic command checks stay strict for runnable prose while reference indexes and ownership tables may use placeholders or family forms."
  - "Command extraction should validate boundary context so config and filesystem paths do not become surfaced-guidance failures."
requirements-completed: [CMD-05, CMD-06]
one-liner: "Reference-style command examples now pass validation while runnable help guidance still fails missing arguments and gap flags"
duration: 4min
completed: 2026-03-30
---

# Phase 159 Plan 07: Reference-style validator integrity summary

**Reference-style command examples now pass validation while runnable help guidance still fails missing arguments and gap flags**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-30T02:08:03Z
- **Completed:** 2026-03-30T02:12:14Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- Refined command mention extraction so placeholder arguments survive parsing in reference contexts and slash-like path fragments such as `/bgsd-oc` no longer create false positives.
- Taught the validator to distinguish reference-style indexes and ownership tables from runnable guidance before enforcing missing-argument, wrong-command, and gap-flag rules.
- Added focused regressions proving reference-style command families pass while runnable prose without concrete phase arguments or `--gaps-only` still fails.

## Task Commits

Each task was committed atomically:

1. **Task 1: Refine validator extraction and rule classification for reference-style command forms** - `rlxwmyss` (fix)
2. **Task 2: Lock the refined validator contract with focused reference-versus-runnable regression coverage** - `olkplzzz` (test)
3. **Verification follow-up: Exclude config path fragments from validator scans** - `srustyvt` (fix)

## Files Created/Modified

- `src/lib/commandDiscovery.js` - Adds reference-style detection, preserves placeholder tokens, and filters slash-like path fragments from surfaced-guidance extraction.
- `tests/validate-commands.test.cjs` - Covers allowed reference-style command families and still-failing runnable guidance mistakes.
- `tests/guidance-command-integrity-agent-skill-surfaces.test.cjs` - Confirms `skills/raci/SKILL.md` remains validator-clean with placeholder phase references.

## Decisions Made

- Limited the new exception to clearly reference-style lines so help text and next-step prose still require concrete runnable commands when the flow shape is known.
- Applied the path-fragment fix at extraction time rather than post-filtering issues so non-command strings never enter semantic validation.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Excluded config-path fragments from slash-command extraction**
- **Found during:** Final plan verification
- **Issue:** `__OPENCODE_CONFIG__/bgsd-oc` in `skills/phase-argument-parsing/SKILL.md` still surfaced a false `/bgsd-oc` nonexistent-command issue.
- **Fix:** Tightened slash-command boundary detection and added a focused regression for path-style fragments.
- **Files modified:** `src/lib/commandDiscovery.js`, `tests/validate-commands.test.cjs`
- **Verification:** `npm run test:file -- tests/validate-commands.test.cjs`; repo validation summary shows `hasBgsdOcNoise: false`
- **Committed in:** `srustyvt` (follow-up fix)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Narrow follow-up fix completed the intended validator cleanup without changing scope.

## Issues Encountered

- Repo-wide validation still reports 309 genuine remaining command-integrity issues across 49 surfaced files that belong to the remaining help/doc cleanup sweep in Plan 08, but `skills/raci/SKILL.md` and `/bgsd-oc`-style path fragments are no longer part of that blocker class.

## Next Phase Readiness

- Plan 08 can now focus on the remaining real help/doc/skill guidance drift without fighting placeholder-table or path-fragment noise from the shared validator.
- Repo-wide validation is narrowed to genuine surfaced guidance mistakes, which makes the final content sweep auditable again.

## Self-Check: PASSED

- FOUND: `.planning/phases/159-help-surface-command-integrity/159-07-SUMMARY.md`
- FOUND: `rlxwmyss` task commit for reference-style validator classification
- FOUND: `olkplzzz` task commit for reference-vs-runnable regression coverage
- FOUND: `srustyvt` follow-up fix commit for config path fragment filtering
