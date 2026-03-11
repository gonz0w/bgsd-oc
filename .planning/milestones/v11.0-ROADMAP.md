# Roadmap: bGSD Plugin

## Milestones

- 🆕 **v11.0 Natural Interface & Insights** - Phases 98-102 (2026-03-11) — see `.planning/milestones/v11.0-ROADMAP.md`
  - Phase 98: NL Foundation — Intent classification, parameter extraction, smart aliases, fallback help
  - Phase 99: Conversational Planning — Multi-intent detection, contextual suggestions
  - Phase 100: Visualization Core — Progress bars, milestone progress, quality scores
  - Phase 101: Rich Visualization — Burndown charts, sparklines, terminal dashboard
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

- [ ] **Phase 98: NL Foundation** — Intent classification, parameter extraction, smart aliases, fallback help
- [ ] **Phase 99: Conversational Planning** — Multi-intent detection, contextual suggestions
- [ ] **Phase 100: Visualization Core** — Progress bars, milestone progress, quality scores
- [ ] **Phase 101: Rich Visualization** — Burndown charts, sparklines, terminal dashboard
- [ ] **Phase 102: Reporting & Metrics** — Milestone summaries, velocity metrics
- [x] **Phase 91: Rich TTY Output & Error Handling** — Complete ✅
- [x] **Phase 92: Planning Intelligence** — Complete ✅
- [x] **Phase 93: Verification Intelligence** — Complete ✅
- [x] **Phase 94: Execution Intelligence** — Complete ✅
- [x] **Phase 95: Interactive Workflows** — Complete ✅
- [x] **Phase 96: Multi-Agent Collaboration** — Better handoffs (completed 2026-03-11)
- [x] **Phase 97: UX Polish** — Command improvements and error handling (completed 2026-03-11)

---

*Roadmap updated: 2026-03-11*
*Ready for: /bgsd plan phase 98*

---

# Phase Details

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

**Plans:** TBD

---

### Phase 102: Reporting & Metrics

**Goal:** Users receive rich formatted reports for completed milestones and velocity analytics

**Depends on:** Phase 101 (Rich Visualization provides chart rendering for reports)

**Requirements:** VIS-07, VIS-08

**Success Criteria** (what must be TRUE):
1. User sees formatted milestone summary when milestone completes with key metrics
2. User can view computed velocity metrics showing tasks completed per session

**Plans:** TBD

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

## Coverage Map

| Phase | Requirements | Count | Status | Completed |
|-------|--------------|-------|--------|-----------|
| 98 | NL-01, NL-02, NL-03, NL-04 | 4 | Pending | - |
| 99 | NL-05, NL-06, NL-07 | 3 | Pending | - |
| 100 | VIS-01, VIS-02, VIS-03 | 3 | Pending | - |
| 101 | VIS-04, VIS-05, VIS-06 | 3 | Pending | - |
| 102 | VIS-07, VIS-08 | 2 | Pending | - |
| 91 | UX-01, UX-02, UX-03, UX-10, UX-11, UX-12, PERF-01, PERF-02 | 8 | Complete | 2026-03-11 |
| 92 | AGENT-01, AGENT-02, AGENT-03 | 3 | Complete | 2026-03-11 |
| 93 | AGENT-04, AGENT-05, AGENT-06 | 3 | Complete | 2026-03-11 |
| 94 | AGENT-07, AGENT-08, AGENT-09 | 3 | Complete | 2026-03-11 |
| 95 | UX-04, UX-05, UX-06, PERF-05, PERF-06 | 5 | Complete | 2026-03-11 |
| 96 | AGENT-10, AGENT-11, AGENT-12 | 3 | Complete | 2026-03-11 |
| 97 | UX-07, UX-08, UX-09, PERF-03, PERF-04 | 5 | Complete | 2026-03-11 |

**Total: 15 requirements across 5 v11.0 phases | 30 requirements across 12 phases total**

