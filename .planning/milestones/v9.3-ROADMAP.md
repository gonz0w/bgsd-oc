# Roadmap: bGSD Plugin

## Milestones

- ✅ **v9.2 CLI Tool Integrations & Runtime Modernization** - Phases 82-85 (2026-03-10) — see `.planning/milestones/v9.2-ROADMAP.md`
- 🚧 **v9.3 Quality, Performance & Agent Sharpening** - Phases 86-90 (in progress)
- 📋 **v10.0** - Future major release

---

## Phases

- [x] **Phase 86: Agent Sharpening** - Zero overlap, validated boundaries, handoff contracts (completed 2026-03-10)
- [x] **Phase 87: Command Consolidation** - Subcommand groups, reduced surface, stale removal (completed 2026-03-10)
- [ ] **Phase 88: Quality & Context** - Deterministic context, zero orphaned code
  - **Plans**: 2/2 plans complete
  - [x] 88-01: Deterministic context loading for agents
  - [x] 88-02: Reachability audit system
- [x] **Phase 89: Runtime Bun Migration** - Bun integration with backward compatibility (in progress)
  - **Plans**: 4/4 plans complete
  - [x] 89-01: Bun runtime detection with config persistence
  - [x] 89-02: Backward compatibility and bundle size validation
  - [x] 89-03: Runtime banner fix for forced Node.js
  - [x] 89-04: Gap closure - extended benchmark with realistic workloads
- [x] **Phase 90: Benchmark** - Plugin adapter, baseline metrics (completed 2026-03-10)

## Phase Details

### Phase 86: Agent Sharpening
**Goal**: Each agent has single clear responsibility, validated boundaries, and documented handoff contracts
**Depends on**: Nothing (first phase)
**Requirements**: AGNT-01, AGNT-02, AGNT-03
**Success Criteria** (what must be TRUE):
  1. Each agent has a single, documented responsibility in its manifest
  2. Agent role boundaries are validated — no two agents claim the same capability
  3. Agent handoff contracts are documented and enforced
  4. Agent context loading is minimal — each agent loads only what it needs
**Plans**: 2/2 plans complete

Plans:
- [x] 86-01: Agent manifest audit and overlap resolution
- [x] 86-02: Handoff contract documentation and enforcement

### Phase 87: Command Consolidation
**Goal**: Slash command surface reduced through subcommand groups and stale removal
**Depends on**: Phase 86
**Requirements**: CMND-01, CMND-02, CMND-03, CMND-04
**Success Criteria** (what must be TRUE):
  1. Commands organized into logical subcommand groups (e.g., /bgsd plan, /bgsd exec)
  2. Stale commands removed from slash command surface
  3. Overlapping commands consolidated into single entry points
  4. Internal-only functions not exposed as slash commands
**Plans**: 3/3 plans complete

Plans:
- [x] 87-01: Subcommand group restructuring
- [x] 87-02: Stale and overlapping command cleanup
- [x] 87-03: Command routing implementation (gap closure - host editor native)

### Phase 88: Quality & Context
**Goal**: Deterministic context loading and zero orphaned code
**Depends on**: Phase 87
**Requirements**: CTXT-01, CTXT-02, CTXT-03
**Success Criteria** (what must be TRUE):
  1. Context loading is deterministic — agents receive pre-computed context, not search-and-discover
  2. Zero orphaned code — every function, export, workflow, template, and config entry is reachable
  3. Dead code audit produces zero orphaned items
  4. Codebase has clear import/export relationships
**Plans**: 1/2 plans executed
- [x] 88-01: Deterministic context implementation
- [x] 88-02: Orphaned code audit and cleanup

### Phase 89: Runtime Bun Migration
**Goal**: Bun runtime fully integrated with backward compatibility maintained
**Depends on**: Phase 88
**Requirements**: RUNT-01, RUNT-02, RUNT-03
**Success Criteria** (what must be TRUE):
  1. Bun runtime fully integrated — 3-5x startup improvement demonstrated
  2. Projects without Bun work exactly as before (backward compatible)
  3. Bundle size not significantly increased by Bun support
  4. Bun detection and fallback work correctly
**Plans**: 4/4 plans complete
- [x] 89-01: Bun runtime integration (config persistence, startup banner)
- [x] 89-02: Backward compatibility and bundle size validation
- [x] 89-03: Runtime banner fix for forced Node.js
- [x] 89-04: Gap closure - extended benchmark with realistic workloads

### Phase 90: Benchmark
**Goal**: Plugin benchmark adapter built and baseline metrics captured
**Depends on**: Phase 89
**Requirements**: BENCH-01, BENCH-02
**Success Criteria** (what must be TRUE):
  1. Plugin benchmark adapter built for cross-plugin comparison
  2. Baseline metrics captured for v9.3
  3. Benchmark can measure startup time, command execution, context loading
**Plans**: 1/1 plans complete

Plans:
- [x] 90-01: Benchmark adapter and baseline capture

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 86. Agent Sharpening | v9.3 | Complete    | 2026-03-10 | 2026-03-10 |
| 87. Command Consolidation | 3/3 | Complete    | 2026-03-10 | - |
| 88. Quality & Context | 1/2 | In Progress|  | - |
| 89. Runtime Bun Migration | v9.3 | Complete    | 2026-03-10 | - |
| 90. Benchmark | v9.3 | Complete    | 2026-03-10 | 2026-03-10 |

---

*Roadmap created: 2026-03-10*
*Ready for planning: /bgsd plan phase*
