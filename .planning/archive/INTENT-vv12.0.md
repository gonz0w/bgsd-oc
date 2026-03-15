**Revision:** 21
**Created:** 2026-02-25
**Updated:** 2026-03-14

<objective>
A high-performance, data-driven agent orchestration engine. This milestone transforms SQLite from a dumb file cache into the structured data backbone for all workflow operations — parsed state persists across invocations, queries replace markdown re-parsing, and workflows get deterministic data from SQL instead of subprocess calls or LLM inference.
</objective>

<users>
- Software developers using AI coding assistants (OpenCode) for project planning and execution
- Solo developers managing complex multi-phase projects with AI assistance
- The GSD plugin's own development workflow (self-referential: planning GSD improvements using GSD)
</users>

<outcomes>
- DO-79 [P1]: Structured SQLite tables for planning data — phases, plans, tasks, requirements stored as rows with indexes, replacing markdown re-parsing
- DO-80 [P1]: Cross-invocation persistence — parsed roadmap, plan metadata, phase mappings survive between CLI invocations with git-hash watermark invalidation
- DO-81 [P1]: Session state in SQLite — current position, metrics, accumulated context stored in SQL; STATE.md becomes a generated view for human readability
- DO-82 [P1]: Memory store migration — decisions.json, lessons.json, trajectories.json, bookmarks.json migrated to SQLite tables with proper indexes and searchability
- DO-83 [P1]: Enricher acceleration — eliminated duplication (3x listSummaryFiles, 2x parsePlans), all workflow data pre-computed from SQLite
- DO-84 [P2]: 6-8 new deterministic decision functions consuming SQLite-backed state — resolve-model, resolve-verification-route, resolve-research-gate, resolve-phase-readiness, resolve-milestone-completion, resolve-commit-strategy
- DO-85 [P2]: Subprocess elimination — workflows consume pre-computed bgsd-context data instead of CLI subprocess calls for read-only operations
</outcomes>

<criteria>
- SC-58: All planning data (phases, plans, tasks) queryable via SQLite without markdown parsing on cache hit
- SC-59: CLI cold-start with warm SQLite cache is measurably faster than cold-start with file-only parsing
- SC-60: STATE.md can be regenerated from SQLite state — SQL is the source of truth for programmatic access
- SC-61: Memory stores (decisions, lessons, trajectories, bookmarks) are fully searchable via SQL queries
- SC-62: Enricher makes zero redundant parser calls per enrichment pass (no 3x/2x duplication)
- SC-63: At least 6 new deterministic decision functions registered and consumed by workflows
- SC-64: Map fallback still works on Node <22.5 — no SQLite-only code paths without fallback
- SC-65: `npm test` continues to pass with zero failures after each phase
</criteria>

<constraints>
### Technical
- C-03: All operations are advisory — never block workflow execution
- C-08: Map fallback must still work on Node <22.5 — SQLite is an acceleration layer, not a hard dependency
- C-09: Markdown files remain human-readable and git-trackable — SQLite augments, doesn't hide data

### Business
- C-04: Backward compatible — projects without SQLite work exactly as before via Map fallback
- C-05: Analysis adds value without adding ceremony — no mandatory steps
</constraints>

<health>
### Quantitative
- HM-08: All tests pass with zero failures after each phase
- HM-09: Enricher completes in <50ms with warm SQLite cache
- HM-10: Zero redundant file reads per enrichment pass

### Qualitative
The data layer should be invisible to users — workflows feel faster, decisions are instant, and the human-readable markdown files stay accurate. SQLite is infrastructure, not ceremony.
</health>

<history>
### v12.0 — 2026-03-14
- **Updated** objective: Shifted from internal quality/housekeeping to SQLite-first data layer architecture
  - Reason: Milestone v12.0: Transform SQLite from file cache to structured data backbone
- **Archived** outcomes: DO-72 through DO-78 (7 outcomes delivered in v11.4) — all housekeeping goals achieved
  - Reason: Milestone v12.0: All v11.4 outcomes delivered, fresh scope for SQLite work
- **Added** outcomes: DO-79 through DO-85 for structured tables, persistence, memory migration, enricher acceleration, decisions
  - Reason: Milestone v12.0: SQLite-first data layer features
- **Archived** criteria: SC-51 through SC-57 (7 criteria from v11.4) — all achieved
  - Reason: Milestone v12.0: Fresh criteria for SQLite architecture
- **Added** criteria: SC-58 through SC-65 for v12.0 verification
  - Reason: Milestone v12.0: Measurable criteria for data layer work
- **Removed** C-07 (test fixes preserve behavior) — v11.4-specific, no longer relevant
  - Reason: Housekeeping constraint completed
- **Added** C-08 (Map fallback on Node <22.5) — SQLite must not become a hard dependency
  - Reason: Milestone v12.0: Backward compatibility for older Node versions
- **Added** C-09 (markdown stays human-readable) — SQLite augments, doesn't replace human-facing files
  - Reason: Milestone v12.0: Preserve git-trackable planning artifacts

### v11.4 — 2026-03-13
- **Reset** objective: Shifted from LLM offloading to internal quality and planning debt cleanup
  - Reason: Milestone v11.4: Housekeeping & Stabilization — 44 outcomes had accumulated across 18 milestones
- **Archived** outcomes: DO-20 through DO-71 (44 outcomes delivered across v1.0-v11.3) — moved to completed status
  - Reason: Milestone v11.4: Full intent reset — all prior outcomes were delivered or no longer relevant
- **Archived** criteria: SC-01 through SC-50 (35 criteria from prior milestones) — all achieved or superseded
  - Reason: Milestone v11.4: Clean slate for measurable success criteria
- **Added** outcomes: DO-72 through DO-78 for test stabilization, planning cleanup, and command audit
  - Reason: Milestone v11.4: Fresh outcomes specific to housekeeping scope
- **Added** criteria: SC-51 through SC-57 for v11.4 verification
  - Reason: Milestone v11.4: Measurable criteria for cleanup work
- **Removed** C-06 (workflow prompt simplification) — achieved in v11.3
  - Reason: No longer needed as an active constraint
- **Added** C-07 (test fixes preserve behavior) — guard against test changes masking real issues
  - Reason: Milestone v11.4: Ensure test fixes are infrastructure-only

### v9.2 — 2026-03-13
- **Modified** objective: Shift from performance benchmarking to LLM offloading
- **Added** DO-68 through DO-71 for LLM offloading audit and implementation
- **Added** C-06 for workflow prompt modification

### v11.1 — 2026-03-11
- **Added** DO-60 through DO-62 for command execution and polish

### v10.0 — 2026-03-10
- **Added** DO-49 through DO-59 for agent intelligence and UX

### v9.3 — 2026-03-10
- **Added** DO-46 through DO-48 for CLI tool integrations and Bun runtime

### v9.0 — 2026-03-09
- **Added** DO-39 through DO-45 for embedded plugin experience
- **Added** SC-31 through SC-36 for plugin verification

### v8.3 — 2026-03-08
- **Added** DO-37, DO-38 for skills architecture and test suite health
- **Added** SC-28 through SC-30 for agent quality

### v11.2 — 2026-03-12
- **Added** DO-63 through DO-67 for code audit and performance

### v8.2 — 2026-03-06
- **Added** DO-33 through DO-36 for cleanup and validation
- **Added** SC-24 through SC-27 for cleanup criteria

### v7.1 — 2026-03-02
- **Modified** objective: Added performance and agent architecture focus
</history>
