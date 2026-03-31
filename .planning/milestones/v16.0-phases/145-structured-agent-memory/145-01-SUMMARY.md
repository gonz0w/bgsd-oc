---
phase: 145-structured-agent-memory
plan: 01
subsystem: cli
tags:
  - cli
  - javascript
  - markdown
  - memory
  - commonjs
requires:
  - phase: 144-safety-guardrails
    provides: destructive-command guardrails and normalized advisory patterns reused by later memory work
provides:
  - canonical `.planning/MEMORY.md` parser/serializer with stable `MEM-###` entry IDs
  - structured `memory:list`, `memory:add`, `memory:remove`, and preview-first `memory:prune` commands
  - deterministic command-level coverage for readable markdown-backed memory workflows
affects:
  - 145-02 frozen memory snapshot injection
  - prompt-memory management CLI expectations
tech-stack:
  added: []
  patterns:
    - manual markdown parsing for fixed schemas without AST dependencies
    - preview-first destructive maintenance commands with explicit `--apply`
    - stable memory IDs for user-facing file edits and CLI operations
key-files:
  created: []
  modified:
    - bin/bgsd-tools.cjs
    - plugin.js
    - skills/skill-index/SKILL.md
    - src/commands/memory.js
    - src/router.js
    - src/lib/constants.js
    - src/lib/command-help.js
    - tests/memory.test.cjs
key-decisions:
  - "Use `.planning/MEMORY.md` as the canonical store and keep legacy `util:memory` JSON stores intact for backward compatibility."
  - "Represent entries as stable lead bullets plus ordered metadata bullets so hand edits survive deterministic re-serialization."
  - "Make `memory:prune` preview-only by default, protecting `Active / Recent` and `Keep: always` entries from accidental cleanup."
patterns-established:
  - "Structured memory entries use `**MEM-###** [type] text` followed by ordered metadata bullets."
  - "CLI routing mirrors the file model: grouped list output, deterministic add flags, ID-based remove, and preview-first prune."
requirements-completed: [MEM-01, MEM-04]
one-liner: "Markdown-backed project memory with stable IDs, grouped CLI management, and preview-first pruning."
duration: 12 min
completed: 2026-03-28
---

# Phase 145 Plan 01: Create the file-backed structured memory CLI around a canonical `.planning/MEMORY.md`. Summary

**Markdown-backed project memory with stable IDs, grouped CLI management, and preview-first pruning.**

## Performance

- **Duration:** 12 min
- **Started:** 2026-03-28T18:21:25Z
- **Completed:** 2026-03-28T18:33:56Z
- **Tasks:** 3
- **Files modified:** 9

## Accomplishments

- Added a canonical `.planning/MEMORY.md` format with fixed sections, stable `MEM-###` IDs, deterministic metadata ordering, and prune-candidate reasoning.
- Exposed `memory:list`, `memory:add`, `memory:remove`, and `memory:prune` so the CLI mirrors the markdown file users review and edit by hand.
- Expanded command-level tests to prove bootstrap, round-trip parsing, ID-based removal, preview-first pruning, and legacy `util:memory` compatibility.

## Task Commits

Each task was committed atomically:

1. **Task 1: Implement the canonical MEMORY.md schema, parser, serializer, and prune candidate logic** - `a5ed6ac` (feat)
2. **Task 2: Add memory:list/add/remove/prune routing and backward-compatible CLI help** - `69049a8` (feat)
3. **Task 3: Add command-level tests for file format, grouped output, removal, and preview-first pruning** - `b867ed0` (test)

## Files Created/Modified

- `bin/bgsd-tools.cjs` [+441/-407]
- `bin/manifest.json` [+1/-1]
- `plugin.js` [+34/-0]
- `skills/skill-index/SKILL.md` [+1/-1]
- `src/commands/memory.js` [+460/-52]
- `src/lib/command-help.js` [+12/-0]
- `src/lib/constants.js` [+34/-0]
- `src/router.js` [+38/-2]
- `tests/memory.test.cjs` [+258/-3]

## Decisions Made

- `.planning/MEMORY.md` is the only structured-memory source of truth so diffs stay reviewable and there is no hidden secondary store to drift.
- Entry metadata is intentionally small and ordered (`Added`, `Updated`, then optional fields) to preserve hand edits while keeping serializer output predictable.
- Pruning uses age plus relevance signals instead of age alone, with section placement and explicit keep intent protecting active knowledge.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- Existing dual-write assertions queried temp directories by symlinked `/var/...` paths while the CLI stored canonical `/private/var/...` paths; tests now resolve the real path before querying SQLite.

## Next Phase Readiness

- Phase 145 plan 02 can now build frozen prompt snapshots from a stable, human-readable `MEMORY.md` schema.
- The plugin layer has clear command and file contracts for injection, stale-notice behavior, and prompt-screening work.

## Self-Check: PASSED

- Verified required implementation files exist on disk.
- Verified task commits `a5ed6ac`, `69049a8`, and `b867ed0` are present in git history.

---
*Phase: 145-structured-agent-memory*
*Completed: 2026-03-28*
