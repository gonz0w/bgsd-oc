---
phase: 03-developer-experience
plan: 01
subsystem: cli
tags: [help, cli, config, migration, developer-experience]

requires:
  - phase: 01-foundation
    provides: "CONFIG_SCHEMA constant, loadConfig(), config commands"
provides:
  - "COMMAND_HELP map with 43 command help entries"
  - "--help/-h flag routing before command dispatch"
  - "cmdConfigMigrate() for schema-aware config migration"
affects: [03-developer-experience]

tech-stack:
  added: []
  patterns: ["Help text to stderr (never stdout)", "Schema-driven config migration"]

key-files:
  created: []
  modified: [bin/gsd-tools.cjs, bin/gsd-tools.test.cjs]

key-decisions:
  - "Help text to stderr — prevents contamination of JSON stdout for piped scripts"
  - "43 COMMAND_HELP entries covering all switch cases — comprehensive self-documentation"
  - "Config migration creates .bak backup only when changes are made — no unnecessary files"
  - "Nested config keys handled via CONFIG_SCHEMA.nested metadata — single source of truth"

patterns-established:
  - "COMMAND_HELP map: centralized help text registry for all commands"
  - "--help intercept pattern: check before switch(command) dispatch"

requirements-completed: [DX-01, DX-03]

duration: 4min
completed: 2026-02-22
---

# Phase 3 Plan 1: CLI Help & Config Migration Summary

**COMMAND_HELP map with 43 command entries, --help/-h routing to stderr, and cmdConfigMigrate with schema-driven defaults merging**

## Performance

- **Duration:** 4 min
- **Started:** 2026-02-22T14:53:14Z
- **Completed:** 2026-02-22T14:57:29Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- COMMAND_HELP map with help text for all 43 CLI commands (state, frontmatter, verify, roadmap, phase, milestone, init, commit, template, config-*, and 30+ feature commands)
- --help/-h flag intercepted before switch(command) dispatch, prints to stderr to avoid contaminating JSON stdout
- cmdConfigMigrate reads existing config, compares with CONFIG_SCHEMA, adds missing keys with defaults, preserves all existing values, creates .bak backup
- 9 new tests: 4 for --help flag behavior, 5 for config-migrate edge cases

## Task Commits

Each task was committed atomically:

1. **Task 1: Add COMMAND_HELP map and --help routing** - `a4ed0f5` (feat)
2. **Task 2: Add config migration command and tests** - `e54f38d` (feat)

## Files Created/Modified
- `bin/gsd-tools.cjs` - Added COMMAND_HELP map (43 entries), --help routing in main(), cmdConfigMigrate function, config-migrate switch case
- `bin/gsd-tools.test.cjs` - Added 4 --help tests (known command, unknown command, stdout clean, coverage count) and 5 config-migrate tests (missing keys, preserve existing, backup, complete config, help text)

## Decisions Made
- Help text to stderr: All help output uses `process.stderr.write()` to never contaminate JSON stdout, consistent with debugLog pattern
- 43 entries for full coverage: Every switch case in main() has a corresponding COMMAND_HELP entry including subcommands with detailed usage
- Backup only on changes: cmdConfigMigrate skips backup/write when config is already complete (migrated_keys.length === 0)
- Nested key handling: Uses CONFIG_SCHEMA.nested metadata to correctly place keys like workflow.research in their nested structure

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Help system complete, ready for Phase 3 Plan 2 (wire commands to slash commands)
- Config migration available for users upgrading from older config versions
- COMMAND_HELP map is easily extensible for future commands

## Self-Check: PASSED

- [x] bin/gsd-tools.cjs exists
- [x] bin/gsd-tools.test.cjs exists
- [x] 03-01-SUMMARY.md exists
- [x] Commit a4ed0f5 exists
- [x] Commit e54f38d exists
- [x] COMMAND_HELP in gsd-tools.cjs
- [x] cmdConfigMigrate in gsd-tools.cjs
- [x] COMMAND_HELP in tests

---
*Phase: 03-developer-experience*
*Completed: 2026-02-22*
