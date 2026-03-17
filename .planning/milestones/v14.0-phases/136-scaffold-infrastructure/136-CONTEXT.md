# Phase 136: Scaffold Infrastructure - Context

**Gathered:** 2026-03-16
**Status:** Ready for planning

<domain>
## Phase Boundary

CLI generates pre-filled PLAN.md and VERIFICATION.md scaffolds from deterministic data sources, with clear data/judgment section separation. LLM agents fill only judgment sections instead of writing from scratch. Follows and extends the proven `summary:generate` pattern.

</domain>

<decisions>
## Implementation Decisions

### Data vs Judgment Boundaries — PLAN.md
- **Frontmatter:** DATA — pre-fill phase number, plan number, subsystem, requirement links, dependency info from ROADMAP
- **Objective section:** DATA (seed) — pre-fill with ROADMAP phase goal text as starting point; LLM refines/narrows for this specific plan
- **Requirement IDs and success criteria references:** DATA — extract from ROADMAP and REQUIREMENTS.md, include in scaffold
- **Task content (descriptions, verify steps, done-when):** JUDGMENT — LLM writes all task substance
- **File paths in tasks:** JUDGMENT — CLI does NOT attempt file path guessing (accuracy risk too high; wrong paths anchor LLM on bad data)
- **Section markers:** HTML comments only (`<!-- data -->` / `<!-- judgment -->`) — invisible in rendered markdown, machine-parseable

### Data vs Judgment Boundaries — VERIFICATION.md
- **Success criteria table:** DATA — pre-fill rows from ROADMAP success criteria (one row per criterion)
- **Requirement mapping table:** DATA — pre-fill from REQUIREMENTS.md
- **Key links / commit hashes:** DATA — extract from SUMMARY.md files if they exist
- **Required artifacts table:** DATA (graceful fallback) — pre-fill from PLAN.md file lists if plans exist; leave as judgment section if no plans yet
- **All section structure:** DATA — pre-create all standard VERIFICATION.md sections (Observable Truths, Required Artifacts, Wiring, Requirement Mapping, Key Links, Assessment)
- **Status, evidence, gap analysis:** JUDGMENT — verifier fills findings
- **Test results:** JUDGMENT (placeholder only) — scaffold creates section structure but does NOT run tests

### Judgment Section Hints
- All judgment sections get `TODO: <description of what goes here>` hints, matching the `summary:generate` JUDGMENT_SECTIONS pattern
- Rationale: hints improve LLM output quality by anchoring on what each section needs

### Task Count in PLAN.md
- Agent's Discretion — planner decides how many tasks based on plan scope

### Source Tracing
- No inline source comments for pre-filled data — sources are predictable from section type; comments add noise without enough debugging value

### Idempotency & Merge Behavior
- **PLAN.md re-runs:** Agent's Discretion on merge strategy for refreshing data sections while preserving judgment content
- **VERIFICATION.md re-runs:** Row matching to preserve verifier evidence when criteria change (revised from full rebuild during stress test — losing an hour of verification work is too costly)
- **Row matching strategy:** Agent's Discretion on implementation (position-based, ID-based, or fuzzy text matching)
- **Overwrite safety:** Warning only, no `--force` required — git is the safety net for both interactive and automated use

### CLI Interface
- **Command naming:** Agent's Discretion — either new top-level namespaces or unified under `util:scaffold`; research flagged interface inconsistency pitfall
- **Output format:** JSON result object matching `summary:generate` pattern — `{file_written, sections_populated, todos_remaining}` for workflow consumption and interface consistency
- **No --dry-run flag** — generate the file, git handles undo; avoid feature creep
- **Plan targeting:** Agent's Discretion on `--plan N` vs auto-detect next sequential
- **Internal architecture:** Shared scaffold engine from day one — plan:generate, verify:generate, and summary:generate should share template resolution, merge logic, and output formatting (cheaper to design upfront than refactor 3 commands later)

### Agent's Discretion
- Dependency graph / wave analysis section inclusion in PLAN.md scaffold
- Command naming pattern (top-level vs util:scaffold)
- Plan number targeting mechanism
- PLAN.md merge strategy on re-runs
- Row matching implementation approach for VERIFICATION.md

</decisions>

<specifics>
## Specific Ideas

- Follow `summary:generate` JUDGMENT_SECTIONS constant pattern exactly — proven in production with 50%+ LLM writing reduction
- VERIFICATION.md should be the richer scaffold (more reliable source data); PLAN.md stays leaner (speculative data risk)
- Warnings go to stderr, JSON to stdout — automated workflows parse stdout and ignore stderr
- `cmdSummaryGenerate()` in `src/commands/misc.js` (lines ~2059-2350) is the blueprint implementation

</specifics>

<stress_tested>
## Stress-Tested Decisions

### REVISED: PLAN.md Scaffold Depth
- **Original:** Headers and frontmatter only (minimal scaffold)
- **Challenge:** "summary:generate pre-fills 60% of SUMMARY.md — why is the plan scaffold so much weaker?"
- **Revised:** Pre-fill frontmatter + phase goal seed + requirement IDs + success criteria references. Still skip file path guessing. Meaningful scaffold without accuracy risk.

### REVISED: VERIFICATION.md Re-run Behavior
- **Original:** Full table rebuild (simpler, avoids fragile row matching)
- **Challenge:** "I just spent an hour verifying 6 criteria and you want me to lose all that because ONE criterion got reworded?"
- **Revised:** Row matching to preserve verifier evidence. Implementation strategy is Agent's Discretion. The cost of lost work outweighs the cost of complex merge code.

### REVISED: Internal Architecture
- **Original:** Not discussed (implied: independent commands like summary:generate)
- **Challenge:** "Every new document type gets its own command with its own quirks. When are you going to unify this?"
- **Revised:** Design shared scaffold engine from day one. CLI surface stays as separate commands, but internally they share template resolution, merge logic, and output formatting.

### HELD: Warning-only overwrite (no --force)
- **Challenge:** "Warnings I can't see in automated workflows aren't a safety net"
- **Defense:** Git is the safety net. Warnings go to stderr for humans. Automated workflows commit before re-scaffolding. Decision held.

</stress_tested>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 136-scaffold-infrastructure*
*Context gathered: 2026-03-16*
