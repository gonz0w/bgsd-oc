---
phase: 73-context-injection
plan: 01
subsystem: plugin
tags: [system-prompt, parsers, context-injection, esm, plugin-hooks]

# Dependency graph
requires:
  - phase: 71-plugin-architecture
    provides: "ESM plugin build pipeline, safeHook, shared parsers (state, roadmap, plan, config)"
provides:
  - "PROJECT.md parser (parseProject, invalidateProject)"
  - "INTENT.md parser (parseIntent, invalidateIntent)"
  - "Unified ProjectState facade (getProjectState)"
  - "System prompt injection via experimental.chat.system.transform hook"
  - "Token budget enforcement module (countTokens, isWithinBudget, TOKEN_BUDGET)"
  - "Context builder (buildSystemPrompt) composing compact <bgsd> system prompt"
affects: [74-custom-tools, 75-event-sync, 73-P02-compaction]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Self-contained regex parsers with Map cache and frozen results (project.js, intent.js)"
    - "Facade pattern: ProjectState composes 6 parsers into single cached call"
    - "System prompt hook pushes to output.system array per OpenCode plugin API"
    - "Token budget: chars/4 heuristic estimator (tokenx not in plugin bundle)"

key-files:
  created:
    - "src/plugin/parsers/project.js"
    - "src/plugin/parsers/intent.js"
    - "src/plugin/project-state.js"
    - "src/plugin/context-builder.js"
    - "src/plugin/token-budget.js"
  modified:
    - "src/plugin/parsers/index.js"
    - "src/plugin/index.js"
    - "build.cjs"
    - "plugin.js"

key-decisions:
  - "Used chars/4 token estimator instead of tokenx in plugin bundle — tokenx is bundled in CLI but not in ESM plugin; chars/4 is sufficient for 500-token budget enforcement"
  - "Parser barrel (parsers/index.js) re-exports new parsers alongside existing ones; invalidateAll() covers all 6 parsers"
  - "System prompt shows first blocker only to save tokens — full blocker list available via /bgsd-health"

patterns-established:
  - "Self-contained plugin parser pattern: readFileSync, Map cache, frozen results, invalidate(cwd) export"
  - "ProjectState facade: single getProjectState(cwd) call composes all parser data"
  - "System prompt format: <bgsd>Phase N: Name | Plan info | Milestone info\\nGoal: ...\\nBlocker: ...</bgsd>"

requirements-completed: [CINJ-01, CINJ-02]

# Metrics
duration: 12min
completed: 2026-03-09
---

# Phase 73 Plan 01: Context Injection Foundation Summary

**PROJECT.md and INTENT.md parsers, unified ProjectState facade, compact system prompt injection via experimental.chat.system.transform hook — ~70 tokens per injection**

## Performance

- **Duration:** 12 min
- **Started:** 2026-03-09T11:41:21Z
- **Completed:** 2026-03-09T11:54:08Z
- **Tasks:** 2
- **Files modified:** 10

## Accomplishments
- New parsers for PROJECT.md (core value, tech stack, milestone) and INTENT.md (objective, outcomes)
- Unified ProjectState facade composing all 6 parsers into a single cached call
- System prompt hook wired via `experimental.chat.system.transform` — injects compact `<bgsd>` tag
- Token budget enforcement module with ~70 token output (well under 500-token budget)
- Build validation expanded to 10 critical exports; ESM validation passes with 0 require() calls

## Task Commits

Each task was committed atomically:

1. **Task 1: Create PROJECT.md/INTENT.md parsers, parser barrel, and ProjectState facade** - `dca2a90` (feat)
2. **Task 2: Create context-builder, token-budget, and wire system prompt hook** - `bc18fb2` (feat)

## Files Created/Modified
- `src/plugin/parsers/project.js` - PROJECT.md parser with core value and tech stack extraction
- `src/plugin/parsers/intent.js` - INTENT.md parser with objective and outcomes extraction
- `src/plugin/parsers/index.js` - Updated parser barrel with new exports and invalidateAll()
- `src/plugin/project-state.js` - Unified ProjectState facade over all 6 parsers
- `src/plugin/context-builder.js` - System prompt composition from ProjectState data
- `src/plugin/token-budget.js` - chars/4 token estimator with TOKEN_BUDGET = 500
- `src/plugin/index.js` - System prompt hook registration, new re-exports
- `build.cjs` - Extended requiredExports to 10 critical exports
- `plugin.js` - Built ESM output (28KB) with all new modules
- `bin/manifest.json` - Updated deployment manifest

## Decisions Made
- Used chars/4 token estimator in plugin bundle instead of importing tokenx — tokenx adds weight to the ESM bundle and chars/4 is sufficient for comparing against a generous 500-token budget
- System prompt shows only the first blocker to save tokens — blockers section can have multiple items but only one is injected
- No additional caching layer in ProjectState facade — each parser maintains its own Map cache with frozen results

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- System prompt hook is registered and functional — ready for Plan 02 (enhanced compaction + command enrichment)
- ProjectState facade provides data source for compaction context building
- Parser caches will be invalidated by Phase 75 file watchers

---
*Phase: 73-context-injection*
*Completed: 2026-03-09*
