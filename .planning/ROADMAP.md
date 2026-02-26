# Roadmap: GSD Plugin Performance & Quality Improvement

## Milestones

- ✅ **v1.0 Performance & Quality** — Phases 1-5 (shipped 2026-02-22)
- ✅ **v1.1 Context Reduction & Tech Debt** — Phases 6-9 (shipped 2026-02-22)
- ✅ **v2.0 Quality & Intelligence** — Phases 10-13 (shipped 2026-02-24)
- ✅ **v3.0 Intent Engineering** — Phases 14-17 (shipped 2026-02-25)
- ✅ **v4.0 Environment & Execution Intelligence** — Phases 18-22 (shipped 2026-02-25)
- 🔵 **v5.0 Codebase Intelligence** — Phases 23-29 (active)

## Phases

<details>
<summary>✅ v1.0 Performance & Quality (Phases 1-5) — SHIPPED 2026-02-22</summary>

- [x] Phase 1: Foundation & Safety Nets (4/4 plans) — completed 2026-02-22
- [x] Phase 2: Error Handling & Hardening (2/2 plans) — completed 2026-02-22
- [x] Phase 3: Developer Experience & Discoverability (3/3 plans) — completed 2026-02-22
- [x] Phase 4: Build System & Module Split (3/3 plans) — completed 2026-02-22
- [x] Phase 5: Performance & Polish (2/2 plans) — completed 2026-02-22

Full details: `.planning/milestones/v1.0-ROADMAP.md`

</details>

<details>
<summary>✅ v1.1 Context Reduction & Tech Debt (Phases 6-9) — SHIPPED 2026-02-22</summary>

- [x] Phase 6: Token Measurement & Output Infrastructure (3/3 plans) — completed 2026-02-22
- [x] Phase 7: Init Command Compaction (3/3 plans) — completed 2026-02-22
- [x] Phase 8: Workflow & Reference Compression (3/3 plans) — completed 2026-02-22
- [x] Phase 9: Tech Debt Cleanup (1/1 plans) — completed 2026-02-22

Full details: `.planning/milestones/v1.1-ROADMAP.md`

</details>

<details>
<summary>✅ v2.0 Quality & Intelligence (Phases 10-13) — SHIPPED 2026-02-24</summary>

- [x] Phase 10: State Intelligence (2/2 plans) — completed 2026-02-22
- [x] Phase 11: Session Continuity (3/3 plans) — completed 2026-02-24
- [x] Phase 12: Quality Gates (4/4 plans) — completed 2026-02-24
- [x] Phase 13: Test Infrastructure & Polish (4/4 plans) — completed 2026-02-24

Full details: `.planning/milestones/v2.0-ROADMAP.md`

</details>

<details>
<summary>✅ v3.0 Intent Engineering (Phases 14-17) — SHIPPED 2026-02-25</summary>

- [x] Phase 14: Intent Capture Foundation (3/3 plans) — completed 2026-02-25
- [x] Phase 15: Intent Tracing & Validation (2/2 plans) — completed 2026-02-25
- [x] Phase 16: Workflow Integration & Self-Application (3/3 plans) — completed 2026-02-25
- [x] Phase 17: Intent Enhancement (2/2 plans) — completed 2026-02-25

Full details: `.planning/milestones/v3.0-ROADMAP.md`

</details>

<details>
<summary>✅ v4.0 Environment & Execution Intelligence (Phases 18-22) — SHIPPED 2026-02-25</summary>

- [x] Phase 18: Environment Awareness (3/3 plans) — completed 2026-02-25
- [x] Phase 19: MCP Server Profiling (3/3 plans) — completed 2026-02-25
- [x] Phase 20: Structured Requirements (3/3 plans) — completed 2026-02-25
- [x] Phase 21: Worktree Parallelism (3/3 plans) — completed 2026-02-25
- [x] Phase 22: Workflow Polish (1/1 plans) — completed 2026-02-25

Full details: `.planning/milestones/v4.0-ROADMAP.md`

</details>

### v5.0 Codebase Intelligence (Phases 23-29)

#### Phase 23: Infrastructure & Storage
Goal: Build the foundation — codebase-intel.json storage, git-based staleness detection, incremental analysis, auto-trigger on init commands
Requirements: INFRA-01, INFRA-02, INFRA-03, INFRA-04
Depends on: None (foundation phase)
Plans: 2 plans
- [x] 23-01-PLAN.md — Core intel engine + CLI commands (codebase analyze, codebase status)
- [ ] 23-02-PLAN.md — Init auto-trigger integration + test coverage
Success criteria:
1. `codebase analyze` creates codebase-intel.json with git hash watermark; cached reads <10ms
2. `codebase status` detects staleness via git diff in <50ms with reason reported
3. Incremental mode re-analyzes only changed files (not full codebase)
4. Init commands auto-trigger analysis when stale (follows env.js pattern)
5. New `src/lib/codebase-intel.js` and `src/commands/codebase.js` modules created

#### Phase 24: Convention Extraction
Goal: Auto-detect naming patterns, file organization rules, and framework-specific conventions with confidence scoring
Requirements: CONV-01, CONV-02, CONV-03, CONV-04, CONV-05
Depends on: Phase 23 (storage infrastructure)
Plans: 2 plans
- [ ] 24-01-PLAN.md — Convention extraction engine + `codebase conventions` CLI command
- [ ] 24-02-PLAN.md — Framework patterns (Elixir) + `codebase rules` generator + tests
Success criteria:
1. `codebase conventions` detects naming patterns (camelCase, snake_case) with confidence percentages
2. File organization rules detected (directory structure, file placement patterns)
3. Framework-specific patterns work for Elixir (Phoenix routes, Ecto schemas, plugs)
4. Each convention has confidence score; only patterns above threshold shown
5. `codebase rules` generates agent-consumable rules document capped at 15 rules

#### Phase 25: Dependency Graph
Goal: Build module dependency graph from import/require/use statements with impact analysis and cycle detection
Requirements: DEPS-01, DEPS-02, DEPS-03, DEPS-04, DEPS-05
Depends on: Phase 23 (storage infrastructure)
Success criteria:
1. `codebase deps` builds forward + reverse adjacency-list graph stored in intel JSON
2. Import parsing works for 6 languages: JavaScript, TypeScript, Python, Go, Elixir, Rust
3. `codebase impact <file>` shows transitive dependents with fan-in count
4. Cycle detection via Tarjan's SCC identifies circular dependencies
5. >85% accuracy for JS/TS/Elixir import patterns

#### Phase 26: Init Integration & Context Summary
Goal: Wire codebase analysis into init commands with compact summary injection and auto-trigger
Requirements: CTXI-01, INFRA-04
Depends on: Phase 24 (conventions), Phase 25 (dependency graph)
Success criteria:
1. Init commands include `codebase_summary` field when intel exists (<500 tokens)
2. Auto-trigger runs quick analysis mode in <200ms when stale
3. Analysis failures produce null/empty fields, never crash init commands
4. Convention summary + dependency overview available in init output

#### Phase 27: Task-Scoped Context
Goal: On-demand per-file architectural context for executor agents with heuristic relevance scoring
Requirements: CTXI-02, CTXI-03, CTXI-04
Depends on: Phase 24 (conventions), Phase 25 (dependency graph)
Success criteria:
1. `codebase context --files <paths>` returns per-file imports, dependents, conventions, risk level
2. Heuristic scoring ranks results by graph distance + plan scope + git recency
3. Total injected context never exceeds 5K tokens per invocation
4. Response time <100ms from cached intel

#### Phase 28: Lifecycle Analysis
Goal: Detect execution order relationships — seeds after migrations, config at boot, framework-specific initialization patterns
Requirements: LIFE-01, LIFE-02, LIFE-03
Depends on: Phase 23 (storage infrastructure)
Success criteria:
1. `codebase lifecycle` shows execution order relationships for detected frameworks
2. Elixir/Phoenix patterns detected: application.ex boot order, migration → seed dependency, router compilation
3. Lifecycle chains output as dependency graph (what must run before what)

#### Phase 29: Workflow Integration
Goal: Wire codebase intelligence into execute-phase, plan-phase, and map-codebase workflows
Requirements: WKFL-01, WKFL-02, WKFL-03
Depends on: Phase 26 (init integration), Phase 27 (task-scoped context)
Success criteria:
1. execute-phase workflow calls `codebase context --files` for plan file references
2. Pre-flight convention check warns when plan touches files with known conventions
3. Existing `codebase-impact` command uses cached dependency graph when available

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Foundation & Safety Nets | v1.0 | 4/4 | Complete | 2026-02-22 |
| 2. Error Handling & Hardening | v1.0 | 2/2 | Complete | 2026-02-22 |
| 3. Developer Experience & Discoverability | v1.0 | 3/3 | Complete | 2026-02-22 |
| 4. Build System & Module Split | v1.0 | 3/3 | Complete | 2026-02-22 |
| 5. Performance & Polish | v1.0 | 2/2 | Complete | 2026-02-22 |
| 6. Token Measurement & Output Infrastructure | v1.1 | 3/3 | Complete | 2026-02-22 |
| 7. Init Command Compaction | v1.1 | 3/3 | Complete | 2026-02-22 |
| 8. Workflow & Reference Compression | v1.1 | 3/3 | Complete | 2026-02-22 |
| 9. Tech Debt Cleanup | v1.1 | 1/1 | Complete | 2026-02-22 |
| 10. State Intelligence | v2.0 | 2/2 | Complete | 2026-02-22 |
| 11. Session Continuity | v2.0 | 3/3 | Complete | 2026-02-24 |
| 12. Quality Gates | v2.0 | 4/4 | Complete | 2026-02-24 |
| 13. Test Infrastructure & Polish | v2.0 | 4/4 | Complete | 2026-02-24 |
| 14. Intent Capture Foundation | v3.0 | 3/3 | Complete | 2026-02-25 |
| 15. Intent Tracing & Validation | v3.0 | 2/2 | Complete | 2026-02-25 |
| 16. Workflow Integration & Self-Application | v3.0 | 3/3 | Complete | 2026-02-25 |
| 17. Intent Enhancement | v3.0 | 2/2 | Complete | 2026-02-25 |
| 18. Environment Awareness | v4.0 | 3/3 | Complete | 2026-02-25 |
| 19. MCP Server Profiling | v4.0 | 3/3 | Complete | 2026-02-25 |
| 20. Structured Requirements | v4.0 | 3/3 | Complete | 2026-02-25 |
| 21. Worktree Parallelism | v4.0 | 3/3 | Complete | 2026-02-25 |
| 22. Workflow Polish | v4.0 | 1/1 | Complete | 2026-02-25 |
| 23. Infrastructure & Storage | 2/2 | Complete    | 2026-02-26 | — |
| 24. Convention Extraction | v5.0 | 0/2 | Planned | — |
| 25. Dependency Graph | v5.0 | 0/0 | Planned | — |
| 26. Init Integration & Context Summary | v5.0 | 0/0 | Planned | — |
| 27. Task-Scoped Context | v5.0 | 0/0 | Planned | — |
| 28. Lifecycle Analysis | v5.0 | 0/0 | Planned | — |
| 29. Workflow Integration | v5.0 | 0/0 | Planned | — |
