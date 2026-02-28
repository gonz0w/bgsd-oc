---
phase: 38-ast-intelligence-repo-map
plan: 02
subsystem: codebase-intel
tags: [ast, complexity, cyclomatic, repo-map, acorn, codebase-intelligence]

requires:
  - phase: 38-01
    provides: extractSignatures, extractExports, DETECTOR_REGISTRY, acorn parser
provides:
  - "Per-function cyclomatic complexity scoring via AST analysis"
  - "Compact ~1k token repo-map generator from AST signatures"
  - "CLI commands: codebase complexity <file>, codebase repo-map [--budget N]"
affects: [agent-context, task-classification, codebase-intelligence]

tech-stack:
  added: []
  patterns:
    - "AST complexity walker: count branching nodes + track nesting depth"
    - "Budget-aware text generation: cap signatures per file, stop at char budget"
    - "Regex fallback complexity for non-JS languages"

key-files:
  created: []
  modified:
    - "src/lib/ast.js"
    - "src/commands/codebase.js"
    - "src/router.js"
    - "src/lib/constants.js"
    - "bin/gsd-tools.test.cjs"

key-decisions:
  - "Base complexity 1 per function + 1 per branching node (simplified cyclomatic)"
  - "Skip bin/dist/build dirs in repo-map to avoid analyzing bundled output"
  - "Cap signatures per file based on remaining budget to keep output compact"
  - "Regex fallback for non-JS complexity: count branching keywords as approximation"

patterns-established:
  - "Complexity walker: separate function body extraction from complexity counting"
  - "Budget-aware generation: charBudget = tokenBudget * 4, stop adding files when exceeded"

requirements-completed: [AST-03, CTX-01]

duration: 9min
completed: 2026-02-27
---

# Phase 38 Plan 02: Complexity Scoring & Repo Map Summary

**Per-function cyclomatic complexity scoring via AST analysis and compact ~1k token repo-map generator using extractSignatures for agent context injection**

## Performance

- **Duration:** 9 min
- **Started:** 2026-02-27T15:04:52Z
- **Completed:** 2026-02-27T15:14:14Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- Added computeComplexity() with acorn AST per-function cyclomatic complexity (branching nodes + nesting depth)
- Added generateRepoMap() producing compact ~1k token codebase summary from AST signatures
- Wired `codebase complexity <file>` and `codebase repo-map [--budget N]` CLI commands with formatted and raw output
- Added 11 new tests: 6 complexity (simple, branching, nesting, module sum, error, logical), 4 repo-map (format, budget, source files, budget flag), 1 integration
- Total: 619 tests pass, 0 failures (was 608)
- Bundle size: 968KB (within 1000KB budget)

## Task Commits

Each task was committed atomically:

1. **Task 1: Complexity scoring + repo-map generator** - `66b1043` (feat)
2. **Task 2: Tests for complexity and repo-map** - `ab11cbe` (test)

## Files Created/Modified
- `src/lib/ast.js` - Added computeComplexity, generateRepoMap, walkComplexity, extractFunctionBodies, regexComplexity
- `src/commands/codebase.js` - Added cmdCodebaseComplexity and cmdCodebaseRepoMap with formatters
- `src/router.js` - Added 'complexity' and 'repo-map' subcommand routing in codebase case
- `src/lib/constants.js` - Added COMMAND_HELP entries for codebase complexity and codebase repo-map
- `bin/gsd-tools.test.cjs` - 11 new tests for complexity and repo-map commands

## Decisions Made
- Base complexity 1 per function + 1 per branching node (simplified cyclomatic approach)
- Skip bin/dist/build directories in repo-map to avoid analyzing bundled output files
- Cap signatures per file based on remaining budget (30 default, 10 when tight) to keep output compact
- Regex fallback for non-JS language complexity: count branching keywords (if, for, while, switch, etc.)
- repo-map uses output(result, raw, rawText) legacy pattern for formatted mode (print summary directly)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Repo-map included bundled bin/gsd-tools.cjs with 457 signatures**
- **Found during:** Task 1 verification
- **Issue:** The bundled CLI binary `bin/gsd-tools.cjs` was included in repo-map, consuming entire token budget with one file
- **Fix:** Filter out files in `bin/`, `dist/`, `build/` directories from repo-map generation
- **Files modified:** src/lib/ast.js
- **Commit:** 66b1043

**2. [Rule 2 - Missing Critical] No per-file signature capping in repo-map**
- **Found during:** Task 1 verification
- **Issue:** Files with many signatures (even after filtering bundles) could blow budget — no truncation within a file
- **Fix:** Added maxSigsPerFile logic: 30 signatures default, 10 when remaining budget is tight, with "+N more" indicator
- **Files modified:** src/lib/ast.js
- **Commit:** 66b1043

---

**Total deviations:** 2 auto-fixed (1 bug, 1 missing critical)
**Impact on plan:** Both fixes necessary for repo-map to produce useful budget-respecting output. No scope creep.

## Issues Encountered
None — both commands worked on first implementation with only the budget-related fixes noted above.

## User Setup Required

None — all functionality uses existing acorn dependency from Plan 01.

## Next Phase Readiness
- AST intelligence stack complete: signatures, exports, complexity, repo-map
- All 4 `codebase ast|exports|complexity|repo-map` commands working
- Ready for integration into agent context injection workflows

---
*Phase: 38-ast-intelligence-repo-map*
*Completed: 2026-02-27*
