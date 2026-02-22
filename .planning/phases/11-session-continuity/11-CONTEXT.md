# Phase 11: Session Continuity - Context

**Gathered:** 2026-02-22
**Status:** Ready for planning

<domain>
## Phase Boundary

Decisions, position, codebase knowledge, and lessons persist across session boundaries and are automatically surfaced at session start. This phase implements the dual-store memory system (STATE.md + memory directory), session bookmarks, and deterministic compaction. It does NOT add new workflows or change existing command behavior — it adds persistence and recall infrastructure that existing commands consume.

</domain>

<decisions>
## Implementation Decisions

### Memory digest format
- Standard density: 10-15 lines at session start (not minimal, not rich)
- Delivered via a **separate `init memory` command** — not folded into existing `init progress`
- **Workflow-aware**: digest adapts to what's about to run (execute-phase gets relevant decisions for that phase; planning gets codebase conventions)
- **Priority hierarchy when token-tight** (cut first → last): conventions → lessons → decisions → todos → position. Position is always present; conventions are expendable since they can be re-read from files.

### Resume granularity
- **Task-level bookmarks**: resume knows phase, plan, and task number (e.g., "Phase 11, Plan 02, Task 3 of 5")
- **Dual save triggers**: auto-save on task completion + explicit save on `/gsd-pause-work` (pause also captures notes/blockers)
- **Resume UX**: brief confirmation at session start — "Resuming Phase 11, Plan 02, Task 3. Last session: 2h ago." — then continues without waiting for user confirmation
- **Drift-aware resume**: compare git HEAD at bookmark time vs current. If files relevant to current task changed since bookmark, warn before resuming

### Decision persistence model
- **Explicit + inferred decisions**: CONTEXT.md decisions (explicit) plus auto-detected decisions from execution (e.g., architectural choices noted in plan summaries)
- **Dual-store**: STATE.md remains the human-readable narrative log; memory directory holds structured JSON for machine querying
- **Memory directory structure**: `.planning/memory/` with separate files — `decisions.json`, `bookmarks.json`, `lessons.json`, `todos.json` — isolates concerns, smaller reads per query
- **Git-committed**: all memory files are tracked in git. Memory travels with the project across machines and clones.

### Compaction strategy
- **Dual trigger**: size-based (compact when a file exceeds entry/size threshold) + milestone-based (full archive on milestone completion)
- **Sacred data**: decisions and lessons are NEVER compacted — kept in full detail permanently. Bookmarks and transient state can be summarized.
- **Compact format**: one summary line per old entry (e.g., "2026-02-22: Chose GenServer over Agent for state management (Phase 11)")
- **Execution**: warn-then-compact — "Memory approaching limit. Compacting old entries..." — informational, not blocking. No user confirmation required.

### Agent's Discretion
- Exact entry/size thresholds for compaction triggers
- Internal structure of individual JSON files (field names, nesting)
- How inferred decisions are detected from plan summaries
- How workflow-awareness determines which memory sections to include
- Codebase knowledge extraction mechanism from `.planning/codebase/` files

</decisions>

<specifics>
## Specific Ideas

- The `init memory` command should be callable with a `--workflow` flag to indicate which workflow is about to run, so it can tailor the digest
- Drift detection on resume should leverage Phase 10's `state validate` infrastructure rather than reimplementing git comparison
- Bookmark auto-save should be lightweight — append to `bookmarks.json`, not rewrite the whole file each time

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 11-session-continuity*
*Context gathered: 2026-02-22*
