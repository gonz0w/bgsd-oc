# Phase 76: Advisory Guardrails - Context

**Gathered:** 2026-03-09
**Status:** Ready for planning

<domain>
## Phase Boundary

The plugin provides helpful advisory warnings about conventions and testing — never blocking, always suggesting. Three guardrail types: convention violation warnings on file writes (GARD-01), planning file protection warnings when .planning/ files are edited outside bGSD workflows (GARD-02), and test-after-edit suggestions when source files are modified (GARD-03). All advisories are injected via the existing `tool.execute.after` hook infrastructure from Phase 75.

</domain>

<decisions>
## Implementation Decisions

### Warning presentation
- Structured advisory block format — visually distinct, e.g. `[warn]` or `[suggest]` prefix with clear formatting
- Two severity levels: **warn** (convention violations, file protection) and **suggest** (test reminders) — visual distinction between them
- Verbose format: issue + brief reason + suggested action (e.g., "File uses camelCase naming. Project convention is kebab-case (see AGENTS.md). Consider renaming to foo-bar.js")
- Dedup with threshold: show individual warnings for first 3 occurrences of same type, then summarize ("...and N more similar warnings")

### Convention violation detection
- Convention source: AGENTS.md as primary, codebase stats (from init/codebase analysis) as fallback for detected conventions
- Scope: project files only — ignore writes to temp dirs, node_modules, external paths, and .planning/ (has its own guardrail)
- Confidence threshold: only advise on conventions detected at 70%+ confidence — reduces false positives
- Which conventions to check: Agent's discretion based on what's detectable from tool.execute.after hook data (file path, content)

### Planning file protection
- Protected scope: ALL files under .planning/ — not just PLAN.md, ROADMAP.md, STATE.md
- Detection method for "outside bGSD workflow": Agent's discretion — determine the most reliable way to distinguish bgsd-tools.cjs/workflow-driven writes from direct Write tool calls
- Advisory message: name the specific correct bGSD command to use — e.g., "ROADMAP.md was edited directly. Use /bgsd-add-phase or /bgsd-remove-phase to modify the roadmap safely."
- Command mapping: static mapping table (file pattern → recommended command) — hardcoded, predictable, maintainable

### Test suggestion behavior
- Trigger files: auto-detect based on project language (JS project → .js/.ts/.cjs; Python → .py; etc.)
- Test command source: read from package.json scripts (e.g., `npm test`) or equivalent project config; fall back to generic "run your tests" if not found
- Frequency: debounced per batch — if multiple files are written in quick succession, one suggestion after the batch completes, not one per file
- Specificity of suggestion: Agent's discretion — determine what level of specificity is achievable from available hook data (e.g., suggest co-located test file if detectable)

### Agent's Discretion
- Which specific convention types to check (file naming, placement, imports, etc.) — based on what's reliably detectable from tool.execute.after hook data
- Detection method for distinguishing bGSD workflow edits from direct edits in .planning/
- Test suggestion specificity — whether to suggest specific test files or just the general test command
- Exact debounce timing for test suggestion batching

</decisions>

<specifics>
## Specific Ideas

- Advisory format should be a structured block that's visually scannable — not a wall of text
- The "name the right command" pattern for planning file protection is key — the advisory should teach the agent the correct workflow, not just scold
- Convention checks should use the same codebase stats infrastructure already available from `init:phase-op` (naming conventions, structure detection)

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 76-advisory-guardrails*
*Context gathered: 2026-03-09*
