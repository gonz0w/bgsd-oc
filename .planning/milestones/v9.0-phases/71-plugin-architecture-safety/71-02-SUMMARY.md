---
phase: 71-plugin-architecture-safety
plan: 02
subsystem: infra
tags: [parsers, tool-registry, esm, plugin, state, roadmap, plan, config]

# Dependency graph
requires:
  - phase: 71-01
    provides: "ESM build pipeline, safeHook error boundary"
provides:
  - "In-process STATE.md parser (parseState) — no subprocess"
  - "In-process ROADMAP.md parser (parseRoadmap) — no subprocess"
  - "In-process PLAN.md parser (parsePlan/parsePlans) — no subprocess"
  - "In-process config.json parser (parseConfig) with schema defaults"
  - "Tool registry with bgsd_ prefix enforcement and snake_case validation"
  - "invalidateAll() for cache management"
affects: [72-status-bar-hooks, 73-prompt-context-engine, 74-custom-tools-framework, 75-event-driven-state-sync]

# Tech tracking
tech-stack:
  added: []
  patterns: [parser-module-pattern, cwd-auto-discovery, freeze-immutability, cache-with-invalidation, tool-name-prefix-enforcement]

key-files:
  created:
    - "src/plugin/parsers/state.js"
    - "src/plugin/parsers/roadmap.js"
    - "src/plugin/parsers/plan.js"
    - "src/plugin/parsers/config.js"
    - "src/plugin/parsers/index.js"
    - "src/plugin/tool-registry.js"
  modified:
    - "src/plugin/index.js"
    - "build.cjs"
    - "bin/gsd-tools.test.cjs"
    - "plugin.js"

key-decisions:
  - "Parsers are self-contained — regex patterns copied from CLI source, no imports from src/lib/ or src/commands/"
  - "Object.freeze for immutability — parsed objects cannot be mutated (verified via Object.isFrozen in tests)"
  - "Auto-discover CWD pattern — parseState() with no args finds .planning/STATE.md from process.cwd()"
  - "Tool registry auto-prefixes bgsd_ silently — developers don't need to remember the prefix"

patterns-established:
  - "Parser module pattern: read file → extract with regex → return frozen object with accessors → cache by CWD"
  - "CWD auto-discovery: parsers find .planning/ files automatically, optional cwd override"
  - "Invalidation pattern: per-parser invalidate() + invalidateAll() for bulk cache clearing"
  - "Tool name enforcement: auto-prefix + snake_case regex validation + duplicate warn-and-overwrite"

requirements-completed: [PFND-03, PFND-04]

# Metrics
duration: 9min
completed: 2026-03-09
---

# Phase 71 Plan 02: Shared Parsers & Tool Registry Summary

**In-process parsers for STATE.md/ROADMAP.md/PLAN.md/config.json with immutable cached results, plus tool registry enforcing bgsd_ prefix and snake_case naming — completing plugin architecture foundation**

## Performance

- **Duration:** 9 min
- **Started:** 2026-03-09T03:03:53Z
- **Completed:** 2026-03-09T03:13:19Z
- **Tasks:** 3
- **Files modified:** 10

## Accomplishments
- 4 parser modules + barrel index: parseState, parseRoadmap, parsePlan/parsePlans, parseConfig — all work in-process via `import('./plugin.js')`
- Parsed objects are immutable (Object.freeze) and cached until explicit invalidation
- Parsers auto-discover files from CWD — no path arguments required
- Tool registry enforces bgsd_ prefix (auto-adds), snake_case validation, duplicate warn-and-overwrite, safeHook wrapping
- Plugin bundle at 21KB (well under 100KB budget) with 6 critical exports verified at build time
- 12 new tests (total 16 plugin tests) covering exports, live data parsing, immutability, prefix enforcement, and name rejection

## Task Commits

Each task was committed atomically:

1. **Task 1: Extract shared parsers from CLI into src/plugin/parsers/** - `008a392` (feat)
2. **Task 2: Create tool registry with bgsd_ prefix enforcement** - `bf5ce05` (feat)
3. **Task 3: Wire parsers and registry into plugin bundle, add tests** - `a5fbb41` (feat)

## Files Created/Modified
- `src/plugin/parsers/state.js` - STATE.md parser with getField/getSection accessors
- `src/plugin/parsers/roadmap.js` - ROADMAP.md parser with milestones, phases, progress table
- `src/plugin/parsers/plan.js` - PLAN.md parser with frontmatter and task extraction
- `src/plugin/parsers/config.js` - config.json parser with inlined schema defaults
- `src/plugin/parsers/index.js` - Barrel re-export with invalidateAll()
- `src/plugin/tool-registry.js` - Tool name validation and registration
- `src/plugin/index.js` - Updated to re-export all parsers, createToolRegistry, safeHook
- `build.cjs` - Added ESM export validation (6 critical exports)
- `bin/gsd-tools.test.cjs` - 12 new tests for parser/registry functionality
- `plugin.js` - Rebuilt with parsers and registry (5KB → 21KB)

## Decisions Made
- Parsers are fully self-contained — regex patterns copied from CLI source code, no imports from src/lib/ or src/commands/ to avoid pulling CLI dependency graph into plugin bundle
- Used Object.isFrozen checks in tests instead of assert.throws — frozen object assignments silently fail in non-strict CJS mode
- Config defaults inlined rather than imported from constants.js — keeps plugin bundle independent
- Tool names auto-prefixed with bgsd_ rather than erroring — developer convenience

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 71 fully complete — all 4 success criteria met:
  1. ✅ npm run build produces both bin/gsd-tools.cjs (CJS) and plugin.js (ESM)
  2. ✅ Every plugin hook survives thrown exceptions (safeHook error boundary)
  3. ✅ STATE.md, ROADMAP.md, PLAN.md parsable via plugin imports (no subprocess)
  4. ✅ Custom tool registration rejects non-bgsd_ names
- Ready for Phase 72 (Status Bar Hooks) and Phase 73 (Prompt Context Engine)
- Parsers provide the in-process read capability that Phase 73's ProjectState cache will build upon
- Tool registry provides the naming convention that Phase 74's custom tools will use

---
*Phase: 71-plugin-architecture-safety*
*Completed: 2026-03-09*
