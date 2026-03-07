# Requirements: bGSD Plugin v8.2

**Defined:** 2026-03-06
**Core Value:** Manage and deliver high-quality software with high-quality documentation, while continuously reducing token usage and improving performance

## v8.2 Requirements

Requirements for the cleanup, performance & validation milestone. Each maps to roadmap phases.

### Audit & Tooling

- [x] **AUDIT-01**: Build system produces esbuild metafile with per-module byte attribution on every build
- [ ] **AUDIT-02**: Dead code detection identifies all unused exports, files, and dependencies across src/ modules
- [ ] **AUDIT-03**: Circular dependency check confirms zero cycles across the module graph
- [ ] **AUDIT-04**: Command reference map cross-references all CLI commands against their markdown consumers (agents, workflows, commands, templates)
- [ ] **AUDIT-05**: Performance baselines captured for init command timing, bundle size, and file I/O counts
- [x] **AUDIT-06**: Deploy script uses manifest-based sync to remove stale files from deploy target

### Dead Code Removal

- [ ] **DEAD-01**: All unused function exports identified by audit are removed from src/ modules
- [ ] **DEAD-02**: All unreferenced workflow, template, and reference files are removed
- [ ] **DEAD-03**: Constants.js audited and unused regex patterns, constants, and mappings removed
- [ ] **DEAD-04**: Stale config.json keys and agent manifest fields cleaned

### Command Structure

- [ ] **CMD-01**: Stale commands removed (join-discord and any other non-functional commands)
- [ ] **CMD-02**: Internal-only CLI calls no longer exposed as user-facing slash commands
- [ ] **CMD-03**: Overlapping commands consolidated into subcommand groups
- [ ] **CMD-04**: All markdown references migrated from flat command forms to namespaced forms, backward-compat router block removed

### Agent Architecture

- [ ] **AGENT-01**: RACI matrix re-validated with zero overlap warnings across all 9 agents
- [ ] **AGENT-02**: Agent manifests tightened — unused context fields removed, token budgets verified against actual usage
- [ ] **AGENT-03**: Structured handoff contracts documented for each agent-to-agent transition
- [ ] **AGENT-04**: Agent merge evaluation completed — any agents with overlapping responsibilities merged or restructured

### Performance

- [ ] **PERF-01**: CPU hot paths profiled and top bottlenecks optimized
- [ ] **PERF-02**: Bundle size measurably reduced vs v8.1 baseline (~1216KB)
- [ ] **PERF-03**: Init commands optimized toward <100ms with cache layer
- [ ] **PERF-04**: Redundant file reads and parsing in hot paths reduced

## Future Requirements

Deferred to future milestone. Tracked but not in current roadmap.

### Testing

- **TEST-01**: Contract test coverage expanded to all agent-consumed CLI commands (top 15+)
- **TEST-02**: Agent smoke tests automated through host editor integration

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| ESM migration | Wrong scope — not worth 34-module migration cost |
| Bundle minification | Bundle must stay debuggable for development |
| Code splitting | Breaks single-file deploy requirement |
| Async I/O rewrite | Synchronous I/O is appropriate for short-lived CLI process |
| Auto-deletion of dead code | Must be human-reviewed — risk of removing agent-consumed code |
| Runtime enforcement of agent contracts | In prompt-based system, enforcement is illusory — audit-time validation is correct |
| New agent roles | Agent cap at 9 — intelligence via data, not new agents |
| Coverage-based dead code detection | Test coverage doesn't indicate production usage in CLI tools |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status | Test Command |
|-------------|-------|--------|--------------|
| AUDIT-01 | Phase 61 | Complete | npm run build |
| AUDIT-05 | Phase 61 | Pending | npm test |
| AUDIT-06 | Phase 61 | Complete | ./deploy.sh |
| AUDIT-02 | Phase 62 | Pending | npm test |
| AUDIT-03 | Phase 62 | Pending | npm test |
| AUDIT-04 | Phase 62 | Pending | npm test |
| DEAD-01 | Phase 63 | Pending | npm test |
| DEAD-02 | Phase 63 | Pending | npm test |
| DEAD-03 | Phase 63 | Pending | npm test |
| DEAD-04 | Phase 63 | Pending | npm test |
| CMD-01 | Phase 64 | Pending | npm test |
| CMD-02 | Phase 64 | Pending | npm test |
| CMD-03 | Phase 64 | Pending | npm test |
| CMD-04 | Phase 64 | Pending | npm test |
| PERF-01 | Phase 65 | Pending | npm test |
| PERF-02 | Phase 65 | Pending | npm run build |
| PERF-03 | Phase 65 | Pending | npm test |
| PERF-04 | Phase 65 | Pending | npm test |
| AGENT-01 | Phase 66 | Pending | npm test |
| AGENT-02 | Phase 66 | Pending | npm test |
| AGENT-03 | Phase 66 | Pending | npm test |
| AGENT-04 | Phase 66 | Pending | npm test |

**Coverage:**
- v8.2 requirements: 22 total
- Mapped to phases: 22
- Unmapped: 0

---
*Requirements defined: 2026-03-06*
*Last updated: 2026-03-06 after initial definition*
