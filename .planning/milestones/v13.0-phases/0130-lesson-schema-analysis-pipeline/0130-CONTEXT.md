# Phase 130: Lesson Schema & Analysis Pipeline - Context

**Gathered:** 2026-03-15
**Status:** Ready for planning

<domain>
## Phase Boundary

Structured lesson capture, storage, querying, analysis, and suggestion system — replacing the current free-form `lessons.md` with typed entries stored in the existing memory system, plus CLI commands (`lessons:capture`, `lessons:list`, `lessons:analyze`, `lessons:compact`) and workflow hooks that surface improvement suggestions after verify-work and milestone completion.

</domain>

<decisions>
## Implementation Decisions

### Capture Experience
- Minimal flags + defaults: only `--title` and `--type` required; severity defaults to MEDIUM, other fields optional
- Agents and users use the same `lessons:capture` CLI — no separate internal API path
- Missing optional fields are simply absent — lesson is valid without them
- One-line confirmation on success: "Captured: [title] (severity: HIGH, type: agent-behavior)"
- Type field is open with defaults — 4 standard types (workflow, agent-behavior, tooling, environment) but custom strings accepted; custom types won't trigger analysis patterns
- `--agents` accepts comma-separated list for multiple affected agents per lesson
- Phase auto-inferred from STATE.md; `--phase` flag available as override
- Storage uses existing memory system (`cmdMemoryWrite` to `memory_lessons` SQLite table with dual-write JSON backup)
- Optional `--body` flag for longer free-form description beyond the title
- Date always auto-set to capture time — no backdating
- `lessons:list` default output is compact table: Date | Severity | Type | Title (one line per lesson)

### Analysis & Suggestions Output
- `lessons:analyze` groups recurrent patterns by affected agent (primary grouping)
- `lessons:analyze --suggest` generates actionable, copy-pasteable instructions (e.g., "Add to executor system prompt: Always verify file exists before editing")
- Analyze and suggest are one command — `lessons:analyze` shows patterns, `--suggest` flag adds actionable instructions
- Empty state: "0 patterns found across N lessons." — terse, no guidance
- Suggestions include evidence count: "(3 lessons)" after each suggestion
- Only agents with suggestions are shown — no empty agent sections
- `--json` flag for machine-parseable output; default is human-readable text
- `lessons:compact` reports one-line summary: "Compacted: 12 → 8 lessons"
- Pattern threshold fixed at 2 — not configurable
- Pattern matching groups lessons by same root cause text (exact or near-exact match)

### Migration
- Auto-migration on first `lessons:*` command — detects unstructured lessons.md and converts
- Original `lessons.md` deleted after migration — data is in structured store
- Migration is silent — no output message
- Only the specific grandfathered entry is excluded from suggestions — future Type: environment lessons can generate suggestions normally
- No lessons.md = empty store, works fine — no special initialization needed
- Best-effort parsing of any Markdown format: `##` headings parsed as separate lessons, each becoming Type: environment

### Workflow Hook Integration
- verify-work and complete-milestone show top 1-2 inline suggestions directly in their output (not just a pointer to run a command)
- Silent when no suggestions — nothing printed if fewer than 2 lessons or no patterns
- Suggestions repeat every time — no tracking of what's been shown
- complete-milestone shows suggestions from all lessons (full store), not milestone-scoped
- Config flag `lessons.surface_in_workflows` (default: true) to suppress lesson suggestions project-wide
- Maximum 3 inline suggestions in workflow output, with "N more available" if more exist
- verify-work auto-captures a lesson when verification finds failures (Type: workflow, with failure details)

</decisions>

<specifics>
## Specific Ideas

- Capture UX modeled on compact CLI patterns: minimal required args, sensible defaults, one-line output
- Analysis output should feel like `git log --oneline` — scannable, not verbose
- The `--suggest` flag on `lessons:analyze` keeps the command surface small (one command, two modes) rather than a separate `lessons:suggest` command
- Suggestions should be concrete enough to copy-paste into agent system prompts

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 0130-lesson-schema-analysis-pipeline*
*Context gathered: 2026-03-15*
