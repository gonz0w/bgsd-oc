# v12.1 Roadmap: Tool Integration & Agent Enhancement

**Milestone:** v12.1  
**Created:** 2026-03-15  
**Status:** In Progress (Phase 124 execution)  
**Phase Range:** 124–128  

## Overview

v12.1 focuses on integrating modern CLI tools (ripgrep, fd, jq, yq, bat, gh) into core workflows and improving agent routing & collaboration. This milestone delivers "smarter tools, smarter agents" — enabling faster code operations and better inter-agent coordination.

**Progress:** Phase 124 complete! (10 min total: Plan 01 3 min + Plan 02 7 min; file caching, detect:tools command, 67 comprehensive tests).

---

## Phases

- [✓] **Phase 124: Tool Detection & Infrastructure** (2/2 plans complete) - Unified tool capability detection with caching and cross-platform support
- [ ] **Phase 125: Core Tools Integration** - ripgrep, fd, jq integration with graceful degradation
- [ ] **Phase 126: Extended Tools** - yq, bat, GitHub CLI integration for enhanced workflows
- [ ] **Phase 127: Agent Routing Enhancement** - Tool-aware agent routing with decision functions
- [ ] **Phase 128: Agent Collaboration** - Enhanced handoffs, multi-phase sequencing, shared patterns

---

## Phase Details

### Phase 124: Tool Detection & Infrastructure

**Goal:** Establish unified tool capability detection infrastructure that can be reused across all tool integrations, with caching and cross-platform support.

**Depends on:** Nothing (foundation phase)

**Requirements:** TOOL-DET-01

**Success Criteria** (what must be TRUE):
  1. User runs `bgsd-tools detect:tools` and gets JSON output listing ripgrep, fd, jq, yq, bat, gh with availability status (installed/missing)
  2. Tool detection works on macOS (Homebrew), Linux (apt/dnf/pacman), Windows (native/WSL) with correct $PATH resolution
  3. Detection output is cached for 5 minutes; subsequent invocations return cached result in <10ms
  4. User receives install guidance when tool missing (e.g., "Install ripgrep: brew install ripgrep")
  5. Tool version detection works for version-specific features (e.g., jq 1.8.1+ required)

**Plans:**
  - Plan 01 (Wave 1): File-based cache, cross-platform detection, version comparison, detect:tools command
  - Plan 02 (Wave 2): Comprehensive test suite (40+ tests for detection infrastructure)

---

### Phase 125: Core Tools Integration

**Goal:** Integrate ripgrep, fd, and jq into core workflows, enabling fast search, discovery, and JSON transformation with graceful fallback to Node.js equivalents.

**Depends on:** Phase 124

**Requirements:** TOOL-01, TOOL-02, TOOL-03, TOOL-DEGR-01

**Success Criteria** (what must be TRUE):
  1. User runs codebase search (e.g., via `/bgsd-search-code` or internal codebase scanning) and ripgrep is used when available, delivering <100ms search on 10K+ file codebase
  2. Workflows automatically discover files via fd (respecting .gitignore) when available, with 20x+ speedup vs Node.js traversal
  3. Complex metrics extraction uses jq transformation when available (e.g., parsing test JSON output), with graceful JavaScript fallback
  4. CLI never crashes when tools unavailable; workflows complete with clear messages ("ripgrep not installed, using slower regex search")
  5. All 3 tools integrated with execFileSync array args (zero shell injection vulnerabilities)

**Plans:**
  - Plan 01 (Wave 1): Config toggles (tools_ripgrep/fd/jq) + config-aware fallback + ripgrep integration into conventions.js, deps.js, env.js
  - Plan 02 (Wave 2): fd integration into discovery adapter + jq integration into JSON processing + health check tool status
  - Plan 03 (Wave 3): Integration test suite (30+ tests) validating all tools with CLI and fallback paths

---

### Phase 126: Extended Tools

**Goal:** Integrate yq, bat, and GitHub CLI for configuration management, syntax highlighting, and GitHub operations.

**Depends on:** Phase 124

**Requirements:** TOOL-04, TOOL-05, TOOL-06

**Success Criteria** (what must be TRUE):
  1. Configuration workflows transform YAML via yq when available (e.g., extracting database config), with JavaScript fallback for simple operations
  2. Code display commands use bat for syntax highlighting when available, with fallback to plain text for any environment
  3. GitHub CI workflows (PR creation, merge, issue management) use gh CLI when authenticated, gracefully skip when user not logged in
  4. Git diff display enhanced with bat highlighting (2-color diff output, line number markers)
  5. gh CLI version constraint enforced (2.88.1+, avoiding 2.88.0 regression)

**Plans:** TBD

---

### Phase 127: Agent Routing Enhancement

**Goal:** Enable agents to make informed routing decisions based on available tools, task complexity, and required capabilities.

**Depends on:** Phase 124

**Requirements:** AGENT-01

**Success Criteria** (what must be TRUE):
  1. Agent context includes `tool_availability` object showing which tools are available (ripgrep, fd, jq, yq, bat, gh with true/false status)
  2. New decision function `resolveFileDiscoveryMode()` examines tool availability and task scope, recommending ripgrep vs Node.js vs fd appropriately
  3. New decision function `resolveSearchMode()` recommends fd vs find vs Node.js based on available tools and .gitignore respect requirements
  4. New decision function `resolveJsonTransformMode()` recommends jq vs JavaScript based on JSON complexity and tool availability
  5. Plan decomposition heuristics account for tool availability (e.g., tasks are smaller when tools available, larger when fallback required)

**Plans:** TBD

---

### Phase 128: Agent Collaboration

**Goal:** Improve inter-agent handoffs with shared context patterns and multi-phase coordination via new decision functions.

**Depends on:** Phases 124–127

**Requirements:** AGENT-02, AGENT-03

**Success Criteria** (what must be TRUE):
  1. Tool availability information passed between agents in handoff context (executor → reviewer, planner → executor, etc.) with RACI validation confirming patterns
  2. New decision function `resolvePhaseDependencies()` sequences multi-phase projects accounting for tool capabilities (e.g., fast discovery phase before complex analysis)
  3. New decision function `resolveAgentCapabilityLevel()` scores agent capability based on available tool count (HIGH if 5–6 tools, MEDIUM if 2–4, LOW if 0–1)
  4. Handoff test coverage confirms all 9 agent pairs share tool context correctly (new handoff tests in test suite)
  5. Agent context efficiency improved: capability-aware filtering reduces context size by 25%+ for tool-independent tasks

**Plans:** TBD

---

## Progress Tracking

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 124. Tool Detection & Infrastructure | 2/2 | ✅ Complete | 2026-03-15 |
| 125. Core Tools Integration | 0/3 | Planning Complete | — |
| 126. Extended Tools | 0/2 | Planned | — |
| 127. Agent Routing Enhancement | 0/2 | Planned | — |
| 128. Agent Collaboration | 0/2 | Planned | — |

**Total:** 2/11 plans complete · 18% progress

---

## Traceability

### Requirements → Phases

| Requirement | Phase | Category |
|-------------|-------|----------|
| TOOL-DET-01 | 124 | Tool Infrastructure |
| TOOL-01 | 125 | Core Tools |
| TOOL-02 | 125 | Core Tools |
| TOOL-03 | 125 | Core Tools |
| TOOL-DEGR-01 | 125 | Graceful Degradation |
| TOOL-04 | 126 | Extended Tools |
| TOOL-05 | 126 | Extended Tools |
| TOOL-06 | 126 | Extended Tools |
| AGENT-01 | 127 | Agent Routing |
| AGENT-02 | 128 | Agent Collaboration |
| AGENT-03 | 128 | Agent Collaboration |

**Coverage:** 11/11 requirements mapped ✓

---

## Dependencies

```
Phase 124 (Foundation)
  ↓
Phases 125–127 (Parallel, depend on 124)
  ↓
Phase 128 (Aggregates 125–127)
```

- **Phase 124** is a prerequisite for all others (provides tool detection)
- **Phases 125–127** can execute in parallel once 124 is complete
- **Phase 128** depends on completion of 125, 126, and 127 (integrates all tool routing improvements)

---

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Start phase numbering at 124 | v12.0 ended at phase 123 | Clean sequence for v12.1 |
| Unified tool detection (phase 124) | All tools share detection, caching, install guidance logic | Avoid duplicating detection code 6 times |
| Core tools (125) vs Extended tools (126) | ripgrep/fd/jq are performance-critical; yq/bat/gh are secondary | Different delivery cadence if needed |
| Tool-aware routing (127) before collaboration (128) | Agents need capability data before making joint decisions | Natural ordering: individual → collective |
| 25%+ context reduction target (SC-67) | Measured via before/after agent context size on identical tasks | Achievable via tool-aware filtering |

---

## Success Criteria Summary

✅ All 6 CLI tools integrated with graceful fallbacks  
✅ Unified tool detection with caching (<50ms total, <10ms cached)  
✅ 4+ new decision functions (resolveFileDiscoveryMode, resolveSearchMode, resolveJsonTransformMode, resolvePhaseDependencies, resolveAgentCapabilityLevel) with contract tests  
✅ All inter-agent handoffs include tool availability context  
✅ Tool absence causes no CLI failures; workflows complete with clear guidance  
✅ Performance <100ms per tool call (with caching)  
✅ Cross-platform verified (macOS/Linux/Windows)  
✅ 1280+ test suite remains green  

---

*Last updated: 2026-03-15 during v12.1 milestone roadmapping*
