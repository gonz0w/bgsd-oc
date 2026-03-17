# Roadmap: v14.1 Tool-Aware Agent Routing

## Overview

Make the tool detection infrastructure from v12.1 actionable — workflows and agents consume tool_availability decisions to route behavior, gh-preflight replaces raw calls, end-to-end tests prove the full chain, and dead-weight infrastructure is pruned. Three phases: wire routing into workflows and agents, validate the full chain with tests, then prune what's unused.

## Phases

- [x] **Phase 138: Workflow & Agent Tool Routing** - Wire tool detection decisions into workflows and agent system prompts so behavior adapts to available tools (completed 2026-03-17)
- [x] **Phase 139: End-to-End Validation** - Prove the full detection → enrichment → workflow behavior chain with E2E and contract tests (completed 2026-03-17)
- [x] **Phase 140: Infrastructure Pruning** - Audit and remove unused Chain B infrastructure after routing is wired and validated (completed 2026-03-17)

## Phase Details

### Phase 138: Workflow & Agent Tool Routing
**Goal**: Workflows and agents consume tool detection decisions to alter their behavior based on available tools
**Depends on**: Nothing (first phase)
**Requirements**: ROUTE-01, ROUTE-02, ROUTE-03, AGENT-01, AGENT-02, GH-01
**Success Criteria** (what must be TRUE):
  1. execute-plan.md emits different search/discovery instructions when tools are present vs absent (e.g., "use rg" vs "use node grep")
  2. execute-phase.md passes tool routing guidance (capability level and tool decisions) to spawned executor agents in the Task() prompt
  3. map-codebase.md uses fd for file discovery and ripgrep for content search when available, falling back to node-based commands when absent
  4. Executor and debugger agent system prompts include tool-specific CLI commands that adapt based on tool_availability from bgsd-context
  5. github-ci.md uses detect:gh-preflight JSON output for authentication validation instead of raw `gh auth status`
**Plans**: 2/2 plans complete

### Phase 139: End-to-End Validation
**Goal**: The full detection → enrichment → workflow behavior chain is validated end-to-end with automated tests
**Depends on**: Phase 138
**Requirements**: TEST-01, TEST-02
**Success Criteria** (what must be TRUE):
  1. An E2E test mocks tool_availability with all tools present, runs the enricher, and verifies workflow output contains tool-specific guidance that differs from all-tools-absent output
  2. A contract test verifies every Chain B decision rule (file-discovery-mode, search-mode, json-transform-mode, agent-capability-level) has at least one workflow or agent consumer — zero orphaned decisions
**Plans**: 1/1 plans complete

### Phase 140: Infrastructure Pruning
**Goal**: Unused tool infrastructure is identified and removed without breaking anything
**Depends on**: Phase 139
**Requirements**: PRUNE-01, PRUNE-02
**Success Criteria** (what must be TRUE):
  1. handoff_tool_context enrichment field either has documented consumers or is removed/simplified
  2. No orphaned detection/caching/decision code paths remain after audit — every tool infrastructure path has a verified consumer
  3. All existing tests continue to pass after pruning changes
**Plans**: 1/1 plans complete

## Progress

**Execution Order:**
Phases execute in numeric order: 138 → 139 → 140

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 138. Workflow & Agent Tool Routing | 2/2 | Complete    | 2026-03-17 |
| 139. End-to-End Validation | 1/1 | Complete    | 2026-03-17 |
| 140. Infrastructure Pruning | 1/1 | Complete    | 2026-03-17 |
