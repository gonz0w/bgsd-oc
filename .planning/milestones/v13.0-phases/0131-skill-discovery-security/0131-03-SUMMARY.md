---
phase: 0131-skill-discovery-security
plan: 03
subsystem: cli
tags: [javascript, skills, router, enricher, discovery]
requires:
  - phase: 0131-skill-discovery-security plan 01
    provides: cmdSkillsList, cmdSkillsValidate exports in src/commands/skills.js
  - phase: 0131-skill-discovery-security plan 02
    provides: cmdSkillsInstall, cmdSkillsRemove, logAuditEntry exports in src/commands/skills.js
provides:
  - "skills namespace routing in src/router.js with lazySkills() lazy loader"
  - "skills:list, skills:install, skills:validate, skills:remove all routable via CLI"
  - "COMMAND_CATEGORIES, COMMAND_BRIEF, COMMAND_RELATED, COMMAND_TREE updated with skills namespace"
  - "installed_skills field in bgsd-context enrichment — [{name, description}] from .agents/skills/"
  - "Step 8.5 Skill Discovery prompt in new-milestone.md between Research and Requirements"
affects:
  - "0131-04 (bgsd-context test/verification) — installed_skills field now available"
  - "All agents — can now read installed_skills from bgsd-context to personalize behavior"
  - "new-milestone workflow — now includes skill discovery gate before requirements definition"
tech-stack:
  added: []
  patterns:
    - "Skills router pattern: parseSkillsOptions helper + namespace case block with await for install"
    - "Enricher field pattern: try/catch + existsSync check + readdirSync + SKILL.md description extraction"
key-files:
  created: []
  modified:
    - src/router.js
    - src/lib/command-help.js
    - src/lib/commandDiscovery.js
    - src/lib/constants.js
    - src/plugin/command-enricher.js
    - workflows/new-milestone.md
key-decisions:
  - "skills:install uses await in router — cmdSkillsInstall is async (GitHub API fetch), router main() is already async so await is safe"
  - "parseSkillsOptions defined as local function inside the case block — mirrors parseLessonsOptions pattern from lessons namespace"
  - "COMMAND_TREE added as new export from commandDiscovery.js — not previously present, added alongside skills entries"
  - "installed_skills placed before handoff_tool_context — follows local_agent_overrides pattern, both are project-local file reads"
requirements-completed: [SKILL-08, SKILL-09]
one-liner: "Full CLI routing for skills:list/install/validate/remove, bgsd-context installed_skills field, COMMAND_TREE in discovery, and Step 8.5 skill discovery in new-milestone workflow"
duration: 6min
completed: 2026-03-15
---

# Phase 131 Plan 03: Skills CLI Wiring & Integration Layer Summary

**Full CLI routing for skills:list/install/validate/remove, bgsd-context installed_skills field, COMMAND_TREE in discovery, and Step 8.5 skill discovery in new-milestone workflow**

## Performance

- **Duration:** 6 min
- **Started:** 2026-03-15T20:54:55Z
- **Completed:** 2026-03-15T21:01:26Z
- **Tasks:** 2
- **Files modified:** 6 source files + bin artifacts

## Accomplishments

- Wired all 4 skills commands (`skills:list`, `skills:install`, `skills:validate`, `skills:remove`) into the router with a `lazySkills()` loader, parseSkillsOptions helper, and proper `await` for the async install command
- Registered skills in all 4 help/discovery systems: `COMMAND_CATEGORIES`, `COMMAND_BRIEF`, `COMMAND_RELATED`, `NATURAL_LANGUAGE_ALIASES` in command-help.js; `COMMAND_CATEGORIES`, `COMMAND_ALIASES`, and new `COMMAND_TREE` export in commandDiscovery.js; `COMMAND_HELP` entries with usage/options/examples in constants.js
- Added `installed_skills` enrichment to bgsd-context (reads `.agents/skills/` directory, extracts `description:` frontmatter or `## Purpose` content from each SKILL.md, returns `[]` gracefully when dir absent), and inserted Step 8.5 Skill Discovery between Research and Requirements in new-milestone.md

## Task Commits

Each task was committed atomically:

1. **Task 1: Wire skills namespace into router, help, and discovery systems** - `853d2ae` (feat)
2. **Task 2: Add installed_skills to bgsd-context enricher and Step 8.5 to new-milestone** - `c416a5e` (feat)

## Files Created/Modified

- `src/router.js` - Added `lazySkills()` loader, `'skills'` to `KNOWN_NAMESPACES`, full `case 'skills':` block with parseSkillsOptions, and updated error messages
- `src/lib/command-help.js` - Added Skills category, 4 COMMAND_BRIEF entries, 4 COMMAND_RELATED entries, 3 NATURAL_LANGUAGE_ALIASES entries
- `src/lib/commandDiscovery.js` - Added `skills` category, 4 COMMAND_ALIASES shortcuts, `skills` block in validateCommandRegistry routerImplementations, and new `COMMAND_TREE` export
- `src/lib/constants.js` - Added COMMAND_HELP entries for all 4 skills commands with usage/options/examples
- `src/plugin/command-enricher.js` - Added `installed_skills` enrichment field reading `.agents/skills/` with SKILL.md description extraction
- `workflows/new-milestone.md` - Inserted Step 8.5 Skill Discovery between Step 8 (Research) and Step 9 (Requirements)

## Decisions Made

- **`await` for skills:install**: `cmdSkillsInstall` is async (GitHub API fetch). `main()` is already async in router.js, so adding `await lazySkills().cmdSkillsInstall(...)` is safe and correct — no refactoring needed.
- **parseSkillsOptions local function**: Defined inside the `case 'skills':` block, mirroring the `parseLessonsOptions` pattern from the lessons namespace. Keeps option parsing co-located with routing logic.
- **COMMAND_TREE new export**: The plan specified adding skills to `COMMAND_TREE` but no `COMMAND_TREE` existed in commandDiscovery.js. Created the full `COMMAND_TREE` object covering all namespaces and exported it — additive, backward-compatible, enables tree-based autocomplete in the future.
- **installed_skills before handoff_tool_context**: Follows the `local_agent_overrides` placement pattern — project-local enrichment fields are grouped together before the derived handoff context block.

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None.

## Next Phase Readiness

- All 4 skills commands fully routable via `bgsd-tools skills:{list|install|validate|remove}` — ready for Plan 04 verification
- `installed_skills` field now available in bgsd-context for all agents — agents can check what skills are installed before execution
- new-milestone workflow now prompts for skill discovery at Step 8.5, connecting the agentskills.io ecosystem to milestone setup
- No blockers

## Self-Check

- ✓ `src/router.js` has `lazySkills()` and `case 'skills':` block
- ✓ `src/lib/command-help.js` has Skills category and all 4 brief/related entries
- ✓ `src/lib/commandDiscovery.js` has skills in COMMAND_CATEGORIES, COMMAND_ALIASES, COMMAND_TREE, routerImplementations
- ✓ `src/lib/constants.js` has COMMAND_HELP entries for all 4 skills commands
- ✓ `src/plugin/command-enricher.js` has `installed_skills` enrichment
- ✓ `workflows/new-milestone.md` has Step 8.5 between Steps 8 and 9
- ✓ Task 1 commit `853d2ae` found
- ✓ Task 2 commit `c416a5e` found
- ✓ `node bin/bgsd-tools.cjs skills:list` returns `{"skills":[]}` (routes correctly)
- ✓ `node bin/bgsd-tools.cjs skills:list --help` shows help text
- ✓ `node bin/bgsd-tools.cjs skills:install --help` shows help text
- ✓ 1564/1565 tests pass (1 pre-existing failure unrelated to this plan)

---
*Phase: 0131-skill-discovery-security*
*Completed: 2026-03-15*
