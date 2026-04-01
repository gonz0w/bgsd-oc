# Requirements: bGSD Plugin

**Defined:** 2026-04-01
**Core Value:** Manage and deliver high-quality software with high-quality documentation, while continuously reducing token usage and improving performance.

## v19.0 Requirements

### Trusted JJ Workspace Execution

- [x] **JJ-01**: Operator can run a workspace-targeted plan and prove the executor's working directory matches the intended `jj workspace root`
- [ ] **JJ-02**: Plan-local outputs are written in the assigned workspace until reconcile rather than mutating shared `.planning/` artifacts directly
- [x] **JJ-03**: System can fall back to the supported sequential path when workspace pinning proof fails or workspace mode is unavailable

### Deterministic Reconcile & Finalization

- [ ] **FIN-01**: System updates `.planning/STATE.md`, `.planning/ROADMAP.md`, and `.planning/REQUIREMENTS.md` through one explicit single-writer finalize path after reconcile
- [ ] **FIN-02**: Healthy sibling workspaces can reconcile and report useful status even when another workspace in the same wave fails, goes stale, or needs recovery
- [ ] **FIN-03**: Final shared planning state is deterministic regardless of the order in which healthy workspaces finish or are finalized
- [ ] **FIN-04**: System preserves inspectable recovery metadata when a workspace becomes stale, divergent, or finalize fails partway through

### cmux Runtime Coordination & Observability

- [ ] **CMUX-01**: Plugin coalesces noisy runtime events into a debounced, bounded cmux refresh pipeline that avoids duplicate parse or process storms during parallel activity
- [ ] **CMUX-02**: User can see truthful workspace-scoped status, progress, and logs in cmux for running, blocked, waiting, stale, reconciling, finalize-failed, idle, and complete states
- [ ] **CMUX-03**: User receives clear cmux attention signals when human input, stale-workspace recovery, or finalize intervention is required
- [ ] **CMUX-04**: Plugin preserves quiet fail-open behavior when cmux is unavailable, unreachable, or not trusted for attachment

### Risk-Based Verification Routing

- [ ] **TEST-01**: Planner and execution artifacts carry an explicit `verification_route` of `skip`, `light`, or `full` for implementation work
- [ ] **TEST-02**: Runtime, shared-state, plugin, and generated-artifact changes in this milestone require focused proof plus broad regression when the blast radius is high
- [ ] **TEST-03**: Docs-, workflow-, template-, and guidance-only slices can use structural or focused proof without defaulting to repeated broad-suite runs
- [ ] **TEST-04**: Verifier output distinguishes missing behavior proof, missing regression proof, and missing human verification instead of conflating them

## Future Requirements

### Collaboration

- **COORD-01**: Team can claim plan ownership with durable lease or handoff metadata in a multi-user repository
- **COORD-02**: System distinguishes shared team state from personal resume state under concurrent use

### Deeper cmux UX

- **CMUX-FUTURE-01**: User can inspect richer per-agent or multi-session cmux views once agent identity and cross-session semantics are trustworthy

## Out of Scope

| Feature | Reason |
|---------|--------|
| General multi-user coordination and lock store | Important future milestone, but separate from this execution-hardening slice |
| New npm dependencies or JJ SDK layer | Current docs and repo architecture support CLI-first integration without expanding the package surface |
| Broad cmux UI redesign beyond supported sidebar/status/progress/log primitives | This milestone is about truthful coordination, not building a custom orchestration UI |
| Removing the sequential execution fallback | Sequential mode remains the safe supported path while workspace mode is hardened |

## Traceability

| Requirement | Phase | Status | Test Command |
|-------------|-------|--------|--------------|
| JJ-01 | Phase 181 | Complete | TBD |
| JJ-02 | Phase 183 | Pending | TBD |
| JJ-03 | Phase 181 | Complete | TBD |
| FIN-01 | Phase 183 | Pending | TBD |
| FIN-02 | Phase 184 | Pending | TBD |
| FIN-03 | Phase 184 | Pending | TBD |
| FIN-04 | Phase 184 | Pending | TBD |
| CMUX-01 | Phase 185 | Pending | TBD |
| CMUX-02 | Phase 186 | Pending | TBD |
| CMUX-03 | Phase 186 | Pending | TBD |
| CMUX-04 | Phase 185 | Pending | TBD |
| TEST-01 | Phase 182 | Pending | TBD |
| TEST-02 | Phase 182 | Pending | TBD |
| TEST-03 | Phase 182 | Pending | TBD |
| TEST-04 | Phase 182 | Pending | TBD |

**Coverage:**
- v19.0 requirements: 15 total
- Mapped to phases: 15
- Unmapped: 0

---
*Requirements defined: 2026-04-01*
*Last updated: 2026-04-01 after creating the v19.0 active milestone roadmap*
