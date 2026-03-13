# Roadmap: bGSD Plugin

## Milestones

- 🆕 **v11.3 LLM Offloading** - Phases 110-113 (2026-03-13)
  - Phase 110: Audit & Decision Framework — Scan codebase, catalog offloading candidates, establish rubric
  - Phase 111: Decision Engine & Enrichment — Build decision-rules.js, decision engine, CLI command, confidence model
  - Phase 112: Workflow Integration & Measurement — Extend bgsd-context, simplify workflows, measure token savings
  - Phase 113: Programmatic Summary Generation — Pre-build SUMMARY.md from git/plan data, LLM fills only judgment sections
- 🆕 **v11.2 Code Cleanup** - Phases 106-109 (2026-03-12)
  - ✅ Phase 106: Code Cleanup — Remove verify:orphans, profiler, test infrastructure
  - Phase 107: Unused Exports Cleanup — Find and remove unused exports from src/
  - Phase 108: Dead Code Removal — Find and remove unreachable code paths
  - Phase 109: Duplicate Code Merge — Find duplicate code patterns and consolidate
- 🆕 **v11.1 Command Execution & Polish** - Phases 103-105 (2026-03-11)
  - ✅ Phase 103: Direct Command Routing — Simplify wrapper → workflow → CLI chain
  - Phase 104: Zero Friction — Remove clarification loops, smart defaults
  - Phase 105: Polish & Fixes — Fix edge cases, streamline execution
- 🆕 **v11.0 Natural Interface & Insights** - Phases 98-102 (2026-03-11) — see `.planning/milestones/v11.0-ROADMAP.md`
  - Phase 98: NL Foundation — Intent classification, parameter extraction, smart aliases, fallback help
  - Phase 99: Conversational Planning — Multi-intent detection, contextual suggestions
  - Phase 100: Visualization Core — Progress bars, milestone progress, quality scores
  - Phase 101: Rich Visualization — Burndown charts, sparklines, terminal dashboard ✅
  - Phase 102: Reporting & Metrics — Milestone summaries, velocity metrics
- ✅ **v10.0 Agent Intelligence & UX** - Phases 91-97 (2026-03-11) — see `.planning/milestones/v10.0-ROADMAP.md`
  - Phase 91: Rich TTY Output & Error Handling ✅
  - Phase 92: Planning Intelligence ✅
  - Phase 93: Verification Intelligence ✅
  - Phase 94: Execution Intelligence ✅
  - Phase 95: Interactive Workflows ✅
- ✅ **v9.3 Quality, Performance & Agent Sharpening** - Phases 86-90 (2026-03-10) — see `.planning/milestones/v9.3-ROADMAP.md`
- ✅ **v9.2 CLI Tool Integrations & Runtime Modernization** - Phases 82-85 (2026-03-10) — see `.planning/milestones/v9.2-ROADMAP.md`

---

## Phases

- [x] **Phase 110: Audit & Decision Framework** — Scan codebase for LLM waste, replace deterministic LLM calls with inline code, remove old audit CLI artifacts (completed 2026-03-13)
- [x] **Phase 111: Decision Engine & Enrichment** — Build shared decision-rules.js module, in-process decision engine, CLI decisions command, progressive confidence model (completed 2026-03-13)
- [x] **Phase 112: Workflow Integration & Measurement** — Extend bgsd-context with pre-computed decisions, simplify workflows, measure before/after token savings (completed 2026-03-13)
- [x] **Phase 113: Programmatic Summary Generation** — Pre-build SUMMARY.md from git history and plan metadata, reduce LLM summary work by 50%+ (completed 2026-03-13)
- [ ] **Phase 106: Code Cleanup** — Remove verify:orphans, profiler, test infrastructure from bundle
- [ ] **Phase 107: Unused Exports Cleanup** — Find and remove unused exports from src/ directory
- [ ] **Phase 108: Dead Code Removal** — Find and remove unreachable code paths
- [ ] **Phase 109: Duplicate Code Merge** — Find duplicate code patterns and consolidate
- [x] **Phase 103: Direct Command Routing** — Simplify wrapper → workflow → CLI chain ✅
- [x] **Phase 104: Zero Friction** — Remove clarification loops, smart defaults ✅
- [ ] **Phase 105: Polish & Fixes** — Fix edge cases, streamline execution
- [ ] **Phase 98: NL Foundation** — Intent classification, parameter extraction, smart aliases, fallback help
- [ ] **Phase 99: Conversational Planning** — Multi-intent detection, contextual suggestions
- [ ] **Phase 100: Visualization Core** — Progress bars, milestone progress, quality scores
- [x] **Phase 101: Rich Visualization** — Burndown charts, sparklines, terminal dashboard ✅
- [x] **Phase 102: Reporting & Metrics** — Milestone summaries, velocity metrics (completed 2026-03-11)
- [x] **Phase 91: Rich TTY Output & Error Handling** — Complete ✅
- [x] **Phase 92: Planning Intelligence** — Complete ✅
- [x] **Phase 93: Verification Intelligence** — Complete ✅
- [x] **Phase 94: Execution Intelligence** — Complete ✅
- [x] **Phase 95: Interactive Workflows** — Complete ✅
- [x] **Phase 96: Multi-Agent Collaboration** — Better handoffs (completed 2026-03-11)
- [x] **Phase 97: UX Polish** — Command improvements and error handling (completed 2026-03-11)

---

*Roadmap updated: 2026-03-13*
*Ready for: /bgsd plan phase 110*

---

# Phase Details

### Phase 110: Audit & Decision Framework (Rescoped)
**Goal:** Scan the codebase for places where LLM calls handle deterministic work that code could do, then directly replace those calls with inline code logic. Remove old audit CLI artifacts from prior scope.

**Depends on:** Nothing (first phase of v11.3)

**Requirements:** AUDIT-01, AUDIT-02, AUDIT-03

**Success Criteria** (what must be TRUE):
  1. All identified deterministic LLM decision points are replaced with inline code logic (lookup tables, conditionals, enricher pre-computation)
  2. Old audit CLI artifacts removed (src/commands/audit.js, router references, .planning/audit-catalog.json)
  3. All 762+ existing tests pass, plus targeted tests added for each replaced decision point
  4. Workflows that previously required LLM reasoning for deterministic decisions now consume pre-computed values

**Plans:**
2/2 plans complete
- 0110-02: Inline replace 4 LLM decision points in enricher + tests (wave 1, AUDIT-01, AUDIT-02)

---

### Phase 111: Decision Engine & Enrichment
**Goal:** Build the programmatic decision infrastructure — shared rules module, in-process engine, CLI access, and confidence-gated fallback — so deterministic decisions are resolved by code instead of LLM

**Depends on:** Phase 110 (needs catalog of validated candidates to implement)

**Requirements:** ENGINE-01, ENGINE-02, ENGINE-03, ENGINE-04

**Success Criteria** (what must be TRUE):
  1. A shared `decision-rules.js` module provides pure functions (lookup tables, weighted scoring, template functions) that resolve deterministic decisions without LLM involvement
  2. The plugin's decision engine evaluates rules in-process during existing hooks — no new subprocess overhead for decision resolution
  3. User can run `decisions` CLI command to query what decisions are available, inspect their logic, and debug resolution for a given state
  4. Every decision returns `{value, confidence}` where HIGH confidence is authoritative, MEDIUM invites LLM confirmation, and LOW falls back to LLM — no decision kills the LLM escape hatch
  5. Contract tests validate output format for every offloaded decision to prevent regression avalanche

**Plans:**
2/2 plans complete
- 0111-02: CLI decisions command, enricher integration, router wiring (wave 2, ENGINE-02, ENGINE-03)

---

### Phase 112: Workflow Integration & Measurement
**Goal:** Connect the decision engine to workflows via bgsd-context enrichment and validate real-world token savings with before/after telemetry

**Depends on:** Phase 111 (workflows can't consume pre-computed decisions until the engine exists)

**Requirements:** FLOW-01, FLOW-02, FLOW-03

**Success Criteria** (what must be TRUE):
  1. The `<bgsd-context>` JSON injected into workflows includes a `decisions` field with pre-computed routing, paths, execution plans, and other resolved decisions
  2. Workflow .md files are simplified to consume pre-computed decisions from context instead of re-deriving them via LLM reasoning — measurably fewer LLM reasoning steps per workflow
  3. Token savings telemetry captures before/after LLM call counts per workflow, with total savings reported and compared against Phase 110 estimates

**Plans:**
3/3 plans complete
- 0112-02: Workflow simplifications + measurement report (wave 2, FLOW-02, FLOW-03)

---

### Phase 113: Programmatic Summary Generation

**Goal:** Build a `summary:generate` CLI command that pre-builds SUMMARY.md from git history, plan metadata, and STATE.md — reducing LLM summary writing from full authorship to filling in 3-4 judgment sections

**Depends on:** Phase 112 (continues the LLM offloading pattern established in v11.3)

**Requirements:** SUM-01, SUM-02, SUM-03

**Success Criteria** (what must be TRUE):
  1. `summary:generate` command produces a pre-filled SUMMARY.md with frontmatter (phase, plan, subsystem, tags, key-files), performance section (duration, timestamps), task commits (from git log), and files created/modified (from git diff) — all without LLM involvement
  2. The execute-plan workflow calls `summary:generate` to get a pre-built scaffold, and the LLM only fills in: one-liner, accomplishments, decisions made, and deviations — at least 50% less LLM writing per summary
  3. Generated summaries pass `verify:summary` validation and `summary-extract` parsing without regressions

**Plans:**
2/2 plans complete
- 0113-01: cmdSummaryGenerate CLI command with git data extraction, merge/preserve, 20 contract tests (wave 1, SUM-01, SUM-03)
- 0113-02: Workflow integration — summary:generate scaffold in execute-plan, SUM-01/02/03 requirements (wave 2, SUM-02)

---

### Phase 103: Direct Command Routing

**Goal:** Simplify the wrapper → workflow → CLI chain so `/bgsd {cmd} {sub}` executes immediately

**Depends on:** Nothing (first phase of v11.1)

**Requirements:** ROUTE-01, ROUTE-02, ROUTE-03

**Success Criteria** (what must be TRUE):
1. `/bgsd milestone new` executes new-milestone workflow without clarification prompts
2. All 41 slash commands route correctly on first attempt
3. Command routing is deterministic — same command always routes to same workflow

**Plans:**
1/2 plans executed
- 103-02: Implement direct routing (wave 2)
- 103-03: Verify all 41 commands route correctly (wave 3)

---

### Phase 104: Zero Friction

**Goal:** Remove clarification loops and add smart defaults for ambiguous commands

**Depends on:** Phase 103

**Requirements:** FRIC-01, FRIC-02, FRIC-03

**Success Criteria** (what must be TRUE):
1. Commands execute without asking "did you mean X?" questions
2. When ambiguity exists, system uses context to pick most likely option
3. Users can always override with explicit intent specification

**Plans:** 3/3 plans executed ✅ COMPLETE

---

### Phase 105: Polish & Fixes

**Goal:** Fix edge cases and streamline workflow execution

**Depends on:** Phase 104

**Requirements:** POLY-01, POLY-02, POLY-03

**Success Criteria** (what must be TRUE):
1. Command confusion scenarios are handled gracefully
2. Unnecessary steps in command chain are removed
3. Error messages include actionable suggestions for correction

**Plans:** 105-01 (wave 1, 3 tasks)

---

### Phase 98: NL Foundation

**Goal:** Users can input natural language commands that are parsed into CLI operations with smart fallback handling

**Depends on:** Nothing (first phase of v11.0)

**Requirements:** NL-01, NL-02, NL-03, NL-04

**Success Criteria** (what must be TRUE):
1. User can type "show my progress" and system parses it to `session progress` command
2. User can say "plan phase 5" and system extracts phase number 5 and routes to planning workflow
3. User can use conversational phrases like "what's left" and system maps to appropriate commands
4. When input is unclear, system shows contextual suggestions instead of errors

**Plans:** TBD

---

### Phase 99: Conversational Planning

**Goal:** Users can describe goals in natural language and system converts them to structured plans with contextual awareness

**Depends on:** Phase 98 (NL Foundation)

**Requirements:** NL-05, NL-06, NL-07

**Success Criteria** (what must be TRUE):
1. User can describe "I want to add user authentication" and system extracts requirements from description
2. User can say "plan phase 5 and verify it" and system detects two intents and sequences them
3. After completing a command, system suggests next logical actions based on current state

**Plans:** TBD

---

### Phase 100: Visualization Core

**Goal:** Users see visual progress indicators for tasks, phases, and quality metrics

**Depends on:** Phase 99 (Conversational Planning builds context for what to visualize)

**Requirements:** VIS-01, VIS-02, VIS-03

**Success Criteria** (what must be TRUE):
1. User sees ASCII progress bar showing task completion in current phase (e.g., "[███░░░] 3/8 tasks")
2. User sees milestone completion percentage with visual indicator (e.g., "Milestone: 65% complete")
3. User sees quality grades displayed with visual indicators (e.g., "Quality: A ████████")

**Plans:**
- ✅ 100-01: Visualization core modules (progress, milestone, quality)
- ✅ 100-02: Unified API and integration

---

### Phase 101: Rich Visualization

**Goal:** Users can view ASCII-based charts and terminal dashboard for project insights

**Depends on:** Phase 100 (Visualization Core provides base rendering)

**Requirements:** VIS-04, VIS-05, VIS-06

**Success Criteria** (what must be TRUE):
1. User can view ASCII burndown chart showing planned vs actual progress over milestone timeline
2. User sees velocity sparkline inline with session output showing trend (e.g., "Velocity: ▁▃▅▇▅▄▆")
3. User can run dashboard command to see overview of key metrics in terminal

**Plans:** 
  - ✅ 101-01: Burndown chart module (VIS-04)
  - ✅ 101-02: Sparkline module (VIS-05)
  - ✅ 101-03: Terminal dashboard (VIS-06)

---

### Phase 102: Reporting & Metrics

**Goal:** Users receive rich formatted reports for completed milestones and velocity analytics

**Depends on:** Phase 101 (Rich Visualization provides chart rendering for reports)

**Requirements:** VIS-07, VIS-08

**Success Criteria** (what must be TRUE):
1. User sees formatted milestone summary when milestone completes with key metrics
2. User can view computed velocity metrics showing tasks completed per session

**Plans:** 
  2/2 plans complete
  - ✅ 102-02: Velocity metrics and CLI commands (VIS-08)

---

# Phase Details (v10.0 and prior)


**Goal:** Foundation layer — enhanced formatting and context-rich error handling

**Depends on:** Nothing (first phase)

**Requirements:** UX-01, UX-02, UX-03, UX-10, UX-11, UX-12, PERF-01, PERF-02

**Success Criteria** (what must be TRUE):
1. Commands produce color-coded output when TTY detected
2. Tables render with proper alignment and styling
3. Progress indicators show for long operations
4. Error messages include actionable recovery suggestions
5. Debug helpers available (trace, context dump)
6. Errors include relevant context (file, line, recent changes)

**Plans:**
- ✅ 91-01: format.js enhancements (CLI flags, Spinner, ProgressTracker)
- ✅ 91-02: error.js module (BgsdError, formatting, utilities)
- ✅ 91-03: debug.js module (trace, context dump, inspection)
- ✅ 91-04: Integration (main CLI with new modules)

**Completed:** 2026-03-11

---


**Goal:** Better task decomposition with dependency detection and sizing

**Depends on:** Phase 91 (uses enhanced formatting)

**Requirements:** AGENT-01, AGENT-02, AGENT-03

**Success Criteria** (what must be TRUE):
1. Planner produces task decomposition with clear dependency chains
2. Tasks sized using 15-60 minute heuristic automatically
3. Independent tasks grouped for parallel execution

**Plans:**
- ✅ 92-01: Enhance planner skills (dependency detection, task sizing, parallelization)
- ✅ 92-02: Add CLI commands (analyze-deps, estimate-scope, plan-wave enhancements)

---


**Goal:** Smarter verification with regression detection

**Depends on:** Phase 92 (planning outputs)

**Requirements:** AGENT-04, AGENT-05, AGENT-06

**Success Criteria** (what must be TRUE):
1. Verifier automatically detects regression patterns in code changes
2. Edge case suggestions provided based on project patterns
3. Coverage analysis identifies untested paths

**Plans:**
- ✅ 93-01: Enhanced verification with regression detection, edge cases, coverage analysis

---


**Goal:** Autonomous deviation handling and recovery

**Depends on:** Phase 93 (verification context)

**Requirements:** AGENT-07, AGENT-08, AGENT-09

**Success Criteria** (what must be TRUE):
1. Executor handles common deviations autonomously with recovery
2. Checkpoint decisions made based on task complexity
3. Stuck/loop patterns detected and pivots suggested

**Plans:**
- ✅ 94-01: Execution Intelligence (deviation recovery, checkpoint decisions, loop detection)

**Completed:** 2026-03-11

---


**Goal:** Guided prompts and wizards for complex tasks

**Depends on:** Phase 91 (TTY foundation)

**Requirements:** UX-04, UX-05, UX-06, PERF-05, PERF-06

**Success Criteria** (what must be TRUE):
1. Complex commands support guided prompts
2. Interactive mode available for multi-step tasks
3. User can abort workflows gracefully
4. Compaction preserves full context (decisions, blockers, intent)

**Plans:**
- ✅ 95-01: Interactive workflows with prompts, wizards, and enhanced compaction

**Completed:** 2026-03-11

---


**Goal:** Better handoffs between agents

**Depends on:** Phases 92, 93, 94 (agent capabilities)

**Requirements:** AGENT-10, AGENT-11, AGENT-12

**Success Criteria** (what must be TRUE):
1. Agent handoffs include structured context transfer
2. Shared context enables collaboration on related tasks
3. Handoff contracts verified before transfer

**Plans:**
1/1 plans complete

---


**Goal:** Command improvements and final UX enhancements

**Depends on:** Phase 91 (foundation), Phase 95 (interactive)

**Requirements:** UX-07, UX-08, UX-09, PERF-03, PERF-04

**Success Criteria** (what must be TRUE):
1. Help includes contextual suggestions based on recent commands
2. Command discoverability improved with autocomplete hints
3. Examples included in help for common use cases
4. Bundle size reduced beyond v9.3 baseline

**Plans:**
- 97-01: Help system enhancements (UX-07, UX-08, UX-09)
- 97-02: Bundle size reduction (PERF-03, PERF-04)

---

### Phase 106: Code Audit & Cleanup
**Goal:** Clean up the codebase by removing unused code, test infrastructure, and performance tools from the bundle

**Depends on:** Nothing (first phase of v11.2)

**Requirements:** CLEAN-01, CLEAN-02, CLEAN-03, CLEAN-04, CLEAN-05

**Success Criteria** (what must be TRUE):
1. Audit src/ for unused exports and remove them
2. Remove verify:orphans command permanently (one-time cleanup)
3. All test infrastructure removed from bundle (node:test, test files)
4. All performance profiling removed from bundle (profiler.js, benchmarking)
5. Bundle size measurably reduced after cleanup

**Plans:** 106-01 (complete) — Removed verify:orphans command and performance profiler from bundle

---

### Phase 107: Unused Exports Cleanup
**Goal:** Find and remove unused exports from src/ directory

**Depends on:** Phase 106

**Requirements:** UNUSED-01, UNUSED-02, UNUSED-03

**Success Criteria** (what must be TRUE):
1. Scan src/ for all exported functions/variables
2. Identify which exports are never imported within the codebase
3. Remove unused exports after verification

**Plans:** 107-01 (wave 1, 3 tasks), 107-02 (wave 2, 3 tasks)

---

### Phase 108: Dead Code Removal
**Goal:** Find and remove unreachable code paths

**Depends on:** Phase 107

**Requirements:** DEAD-01, DEAD-02, DEAD-03

**Success Criteria** (what must be TRUE):
1. Identify code paths that can never execute (after return/throw/break in loops)
2. Remove unreachable code after verification
3. Verify no runtime errors after removal

**Plans:** TBD

---

### Phase 109: Duplicate Code Merge
**Goal:** Find duplicate code patterns and consolidate

**Depends on:** Phase 108

**Requirements:** DUPE-01, DUPE-02, DUPE-03

**Success Criteria** (what must be TRUE):
1. Identify duplicate code patterns across src/
2. Extract common patterns into shared utilities
3. Verify functionality after consolidation

**Plans:** TBD

---

## Coverage Map

| Phase | Requirements | Count | Status | Completed |
|-------|--------------|-------|--------|-----------|
| 110 | AUDIT-01, AUDIT-02, AUDIT-03 | Complete    | 2026-03-13 | - |
| 111 | 2/2 | Complete    | 2026-03-13 | - |
| 112 | 3/3 | Complete    | 2026-03-13 | - |
| 113 | SUM-01, SUM-02, SUM-03 | Complete    | 2026-03-13 | 2026-03-13 |
| 106 | CLEAN-01, CLEAN-02, CLEAN-03, CLEAN-04, CLEAN-05 | 5 | Complete | 2026-03-12 |
| 107 | UNUSED-01, UNUSED-02, UNUSED-03 | 3 | Not Started | - |
| 108 | DEAD-01, DEAD-02, DEAD-03 | 3 | Not Started | - |
| 109 | DUPE-01, DUPE-02, DUPE-03 | 3 | Not Started | - |
| 98 | NL-01, NL-02, NL-03, NL-04 | 4 | Pending | - |
| 99 | NL-05, NL-06, NL-07 | 3 | Pending | - |
| 100 | VIS-01, VIS-02, VIS-03 | 3 | Pending | - |
| 101 | VIS-04, VIS-05, VIS-06 | 3 | Pending | - |
| 102 | 2/2 | Complete   | 2026-03-11 | - |
| 91 | UX-01, UX-02, UX-03, UX-10, UX-11, UX-12, PERF-01, PERF-02 | 8 | Complete | 2026-03-11 |
| 92 | AGENT-01, AGENT-02, AGENT-03 | 3 | Complete | 2026-03-11 |
| 93 | AGENT-04, AGENT-05, AGENT-06 | 3 | Complete | 2026-03-11 |
| 94 | AGENT-07, AGENT-08, AGENT-09 | 3 | Complete | 2026-03-11 |
| 95 | UX-04, UX-05, UX-06, PERF-05, PERF-06 | 5 | Complete | 2026-03-11 |
| 96 | AGENT-10, AGENT-11, AGENT-12 | 3 | Complete | 2026-03-11 |
| 97 | UX-07, UX-08, UX-09, PERF-03, PERF-04 | 5 | Complete | 2026-03-11 |
| 103 | ROUTE-01, ROUTE-02, ROUTE-03 | 3 | Not Started | - |
| 104 | 1/3 | In Progress|  | - |
| 105 | POLY-01, POLY-02, POLY-03 | 3 | Not Started | - |

**Total: 13 v11.3 requirements across 4 phases | 67 requirements across 26 phases total**

