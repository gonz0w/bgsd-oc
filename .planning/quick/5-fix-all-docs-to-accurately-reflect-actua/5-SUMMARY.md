---
phase: quick-5
plan: 1
subsystem: docs
tags: [rename, slash-commands, bgsd, documentation]

requires:
  - phase: quick-4
    provides: "Updated docs for v8.0 release readiness"
provides:
  - "All 622 /gsd-* command references renamed to /bgsd-* across 77 files"
  - "AGENTS.md updated with full 41-command list"
  - "Zero stale slash command references in active docs"
affects: [docs, commands, workflows, templates, references, agents]

tech-stack:
  added: []
  patterns: ["perl negative lookahead for safe bulk rename: s{/gsd-(?!tools)}{/bgsd-}g"]

key-files:
  created: []
  modified:
    - "AGENTS.md"
    - "README.md"
    - "lessons.md"
    - "docs/*.md (9 files)"
    - "workflows/*.md (37 files)"
    - "references/*.md (3 files)"
    - "templates/*.md (8 files)"
    - "agents/*.md (9 files)"
    - "commands/bgsd-reapply-patches.md"
    - "commands/bgsd-research-phase.md"

key-decisions:
  - "Used perl negative lookahead s{/gsd-(?!tools)}{/bgsd-}g for safe bulk rename"
  - "Left /gsd-worktrees path reference intact (temp directory, not a slash command)"
  - "Phantom doc references (bgsd-oc, bgsd-planner, etc.) are agent/URL paths, not missing commands"

patterns-established:
  - "All slash commands use /bgsd-* prefix consistently"

requirements-completed: [ACCURACY-01]

duration: 6min
completed: 2026-03-03
---

# Quick Task 5: Fix All Docs Summary

**Renamed 622 stale `/gsd-*` slash command references to `/bgsd-*` across 77 doc files and updated AGENTS.md with full 41-command catalog**

## Performance

- **Duration:** 6 min
- **Started:** 2026-03-03T02:05:05Z
- **Completed:** 2026-03-03T02:11:51Z
- **Tasks:** 3
- **Files modified:** 77

## Accomplishments
- Bulk-renamed all 622 `/gsd-*` command references to `/bgsd-*` across 77 .md files using perl negative lookahead
- Preserved all `/gsd-tools` references (CLI tool name) and `/gsd-worktrees` (temp path)
- Updated AGENTS.md from stale 11-command list to full 41-command catalog organized by category
- Cross-referenced all doc references against commands/ directory — zero phantom commands
- All 762 tests pass after rename

## Task Commits

Each task was committed atomically:

1. **Task 1: Bulk rename /gsd-* to /bgsd-* across all docs** - `b5595f9` (docs)
2. **Task 2: Verify doc-to-command accuracy and update AGENTS.md** - `0596eaa` (docs)
3. **Task 3: Run tests and verify** - verification only (no new files, 762/762 tests pass)

## Files Created/Modified
- `AGENTS.md` — Renamed commands + expanded to full 41-command list
- `README.md` — 53 command references renamed
- `lessons.md` — 2 references renamed
- `docs/*.md` (9 files) — 223 references renamed
- `workflows/*.md` (37 files) — 242 references renamed
- `references/*.md` (3 files) — 20 references renamed
- `templates/*.md` (8 files) — 16 references renamed
- `agents/*.md` (9 files) — 36 references renamed
- `commands/bgsd-reapply-patches.md` — 2 references renamed
- `commands/bgsd-research-phase.md` — 2 references renamed

## Decisions Made
- Used perl negative lookahead (`s{/gsd-(?!tools)}{/bgsd-}g`) instead of sed for safe pattern matching
- Left `/gsd-worktrees` in `templates/config.json` — it's a temp directory path, not a slash command
- Identified 10 "phantom" doc references as legitimate agent file paths, repo URLs, and config paths (not missing commands)

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All documentation accurately reflects v8.0 `/bgsd-*` command naming
- Ready for v8.0 release — docs, commands, and tests all aligned

## Self-Check: PASSED

- [x] Commit b5595f9 exists (Task 1: bulk rename)
- [x] Commit 0596eaa exists (Task 2: AGENTS.md update)
- [x] 5-SUMMARY.md exists
- [x] AGENTS.md exists with 41 commands
- [x] Zero stale `/gsd-` references (excluding `/gsd-tools` and `/gsd-worktrees`)
- [x] `/gsd-tools` references preserved (4 found in AGENTS.md)
- [x] 762/762 tests pass

---
*Quick Task: 5-fix-all-docs-to-accurately-reflect-actua*
*Completed: 2026-03-03*
