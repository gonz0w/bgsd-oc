# Roadmap: GSD Plugin Performance & Quality Improvement

## Milestones

- ✅ **v1.0 Performance & Quality** — Phases 1-5 (shipped 2026-02-22)
- ✅ **v1.1 Context Reduction & Tech Debt** — Phases 6-9 (shipped 2026-02-22)
- ✅ **v2.0 Quality & Intelligence** — Phases 10-13 (shipped 2026-02-24)
- ✅ **v3.0 Intent Engineering** — Phases 14-17 (shipped 2026-02-25)
- 🔵 **v4.0 Environment & Execution Intelligence** — Phases 18-22 (active)

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

## Active Milestone: v4.0 Environment & Execution Intelligence

- [x] **Phase 18: Environment Awareness** — Detect project languages, tools, and runtimes; produce machine-readable manifest (completed 2026-02-25)
- [ ] **Phase 19: MCP Server Profiling** — Estimate MCP token costs, score relevance, recommend disabling wasteful servers
- [ ] **Phase 20: Structured Requirements** — Upgrade requirements with testable assertions, test mapping, and verifier integration
- [ ] **Phase 21: Worktree Parallelism** — Create, manage, and merge git worktrees for parallel plan execution
- [ ] **Phase 22: Workflow Polish** — Complete-and-clear workflow for session handoffs

## Phase Details

### Phase 18: Environment Awareness
**Goal**: Agents know what languages, tools, and runtimes are available in the project before they start working
**Depends on**: Nothing (first phase of v4.0)
**Requirements**: ENV-01, ENV-02, ENV-03, ENV-04, ENV-05, ENV-06
**Success Criteria** (what must be TRUE):
  1. `env scan` on a Node+Go polyglot project reports both languages with correct versions and identifies the primary language from root manifest
  2. `env scan` detects the correct package manager (e.g., pnpm from pnpm-lock.yaml) and respects packageManager field override
  3. `env-manifest.json` contains complete detection results with sources, and is regenerated automatically when manifests change (stale detection)
  4. `init progress --raw` output includes a compact "Tools:" line listing detected runtimes and versions when manifest exists
**Plans**: 3/3 plans complete
Plans:
- [ ] 18-01-PLAN.md — Core detection engine (languages, package managers, binary availability)
- [ ] 18-02-PLAN.md — Manifest persistence and staleness detection
- [ ] 18-03-PLAN.md — Init command integration and auto-trigger

### Phase 19: MCP Server Profiling
**Goal**: Users can see exactly how many tokens their MCP servers consume and get actionable recommendations to reduce context waste
**Depends on**: Nothing (independent of Phase 18)
**Requirements**: MCP-01, MCP-02, MCP-03, MCP-04, MCP-05
**Success Criteria** (what must be TRUE):
  1. `mcp-profile` lists all configured servers from opencode.json and .mcp.json with transport type and command
  2. `mcp-profile` shows per-server token cost estimate and total context window percentage (e.g., "GitHub: ~46K tokens, 23% of 200K window")
  3. `mcp-profile` scores each server as relevant/possibly-relevant/not-relevant based on project files and recommends keep/disable/review with reasoning
  4. `mcp-profile --apply` disables recommended servers in config with backup, and `--restore` undoes the change
**Plans**: 2/3 plans executed
Plans:
- [x] 19-01-PLAN.md — Server discovery from .mcp.json/opencode.json + known-server token estimation database
- [ ] 19-02-PLAN.md — Project-aware relevance scoring + keep/disable/review recommendations
- [ ] 19-03-PLAN.md — Auto-disable with backup and restore functionality

### Phase 20: Structured Requirements
**Goal**: Requirements carry testable acceptance criteria that flow through planning into verification, closing the loop between "what we said" and "what we proved"
**Depends on**: Nothing (independent of Phases 18-19)
**Requirements**: SREQ-01, SREQ-02, SREQ-03, SREQ-04, SREQ-05
**Success Criteria** (what must be TRUE):
  1. Each requirement in REQUIREMENTS.md has 2-5 indented assertion bullets that are specific and testable (template enforced)
  2. The traceability table includes a test-command column, and `verify requirements` confirms test commands exist and reports coverage percentage
  3. Phase verifier reads structured assertions from REQUIREMENTS.md and reports per-assertion pass/fail (not just requirement-level pass/fail)
  4. Plan `must_haves.truths` in YAML frontmatter are auto-populated from the mapped requirements' assertions during planning
**Plans**: TBD

### Phase 21: Worktree Parallelism
**Goal**: Multiple plans within a wave execute in parallel via isolated git worktrees, with conflict detection and sequential merge
**Depends on**: Phase 18 (env manifest used for setup hooks — graceful degradation if missing)
**Requirements**: WKTR-01, WKTR-02, WKTR-03, WKTR-04, WKTR-05, WKTR-06
**Success Criteria** (what must be TRUE):
  1. `worktree create <plan-id>` creates an isolated worktree with a named branch, syncs configured files, and runs setup hooks; `worktree list` shows it with disk usage
  2. `worktree merge <plan-id>` runs `git merge-tree` dry-run first — clean merges proceed automatically, conflicts block with a file-level report
  3. Config.json `worktree` section controls base_path, sync_files, setup_hooks, and max_concurrent (validated against available resources)
  4. Execute-phase workflow creates worktrees per wave, monitors agent progress, merges sequentially with test gates, and cleans up before advancing to next wave
  5. `files_modified` overlap from plan-time static analysis and `git merge-tree` from merge-time both feed into the merge decision
**Plans**: TBD

### Phase 22: Workflow Polish
**Goal**: Sessions end cleanly with a summary and context reset prompt, so the next session starts fresh
**Depends on**: Phase 18 (uses env context for session summary — graceful degradation)
**Requirements**: WFLW-01
**Success Criteria** (what must be TRUE):
  1. `/gsd-complete-and-clear` generates a session summary from STATE.md showing what was completed, suggests the next command to run, and updates session continuity
  2. Running the workflow leaves STATE.md in a clean state ready for the next session to pick up without stale context
**Plans**: TBD

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
| 18. Environment Awareness | 3/3 | Complete    | 2026-02-25 | - |
| 19. MCP Server Profiling | 2/3 | In Progress|  | - |
| 20. Structured Requirements | v4.0 | 0/? | Not started | - |
| 21. Worktree Parallelism | v4.0 | 0/? | Not started | - |
| 22. Workflow Polish | v4.0 | 0/? | Not started | - |
