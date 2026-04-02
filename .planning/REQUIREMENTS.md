# Requirements: bGSD Plugin

**Defined:** 2026-04-02
**Core Value:** Manage and deliver high-quality software with high-quality documentation, while continuously reducing token usage and improving performance.

## v19.1 Requirements

### JJ-First UX & Bookmark Handling

- [ ] **JJUX-01**: User sees bookmark/workspace terminology as the canonical local model across JJ-first help, workflows, and runtime guidance
- [ ] **JJUX-02**: JJ-backed repos treat detached Git HEAD as expected/informational instead of a generic health failure
- [ ] **JJUX-03**: Runtime can inspect local bookmark state (existence, tracked status, target, conflict state) without inferring health from checked-out Git branch state
- [ ] **JJUX-04**: Logical branch handling for phase and milestone work consistently computes and updates canonical bookmark names
- [ ] **JJUX-05**: Git-oriented user-facing surfaces preserve required interoperability language only where remote Git behavior is actually relevant

### Simplification Engine

- [ ] **SIMP-01**: Phase execution can identify phase-touched files and separate simplification targets from test/reference files
- [ ] **SIMP-02**: CLI can analyze touched source files for duplication, dead code, cognitive/structural complexity, and clarity opportunities with structured JSON output
- [ ] **SIMP-03**: Execution workflow can run a bounded simplification decision step between execution aggregation and verification
- [ ] **SIMP-04**: When warranted, bGSD can generate a refactor-only simplification plan and run a bounded simplify loop without changing behavior
- [ ] **SIMP-05**: Simplification writes before/after reporting and verification handoff artifacts so downstream proof reflects the simplified state

### Speculative-Decoding Readiness

- [ ] **SPEC-01**: Agent prompts suppress conversational preambles and begin with required structured output frames where applicable
- [ ] **SPEC-02**: Shared enum vocabularies and schema conventions reduce avoidable variance across agent outputs
- [ ] **SPEC-03**: Core planning, summary, and verification templates use more stable key ordering and canonical section shapes
- [ ] **SPEC-04**: Workflow definitions and inter-agent communication use anchored, predictable output structures rather than loosely framed prose
- [ ] **SPEC-05**: Research-heavy or summary-heavy outputs gain stricter contracts that reduce unnecessary free-text entropy without dropping required content
- [ ] **SPEC-06**: Speculative-decoding-oriented contract changes are paired with measurable validation so performance claims are evidence-backed

## Future Requirements

### Deferred

- **GIT-01**: Remove Git as a backend or remote-interop dependency entirely
- **INF-01**: Implement provider- or host-level speculative decoding infrastructure changes outside bGSD contracts
- **JJUX-06**: Complete end-to-end bookmark-native GitHub PR/release automation
- **SIMP-06**: Expand simplification into repo-wide continual cleanup beyond phase-bounded execution

## Out of Scope

| Feature | Reason |
|---------|--------|
| Full Git removal | Too broad for a safety-first milestone; Git compatibility remains required |
| Host inference stack rewrites | Out of scope for bGSD repo planning/contracts work |
| New agent roles for simplification or speculative decoding | Milestone intentionally prefers deterministic CLI/contracts over agent proliferation |
| Whole-repo prompt/schema rewrite in one pass | Needs phased rollout to preserve execution safety and artifact compatibility |

## Traceability

| Requirement | Phase | Status | Test Command |
|-------------|-------|--------|--------------|
| JJUX-01 | Phase 189 | Pending | TBD |
| JJUX-02 | Phase 188 | Pending | TBD |
| JJUX-03 | Phase 188 | Pending | TBD |
| JJUX-04 | Phase 190 | Pending | TBD |
| JJUX-05 | Phase 189 | Pending | TBD |
| SIMP-01 | Phase 191 | Pending | TBD |
| SIMP-02 | Phase 191 | Pending | TBD |
| SIMP-03 | Phase 192 | Pending | TBD |
| SIMP-04 | Phase 192 | Pending | TBD |
| SIMP-05 | Phase 192 | Pending | TBD |
| SPEC-01 | Phase 193 | Pending | TBD |
| SPEC-02 | Phase 193 | Pending | TBD |
| SPEC-03 | Phase 193 | Pending | TBD |
| SPEC-04 | Phase 193 | Pending | TBD |
| SPEC-05 | Phase 193 | Pending | TBD |
| SPEC-06 | Phase 193 | Pending | TBD |

**Coverage:**
- v19.1 requirements: 16 total
- Mapped to phases: 16
- Unmapped: 0 ✓

---
*Requirements defined: 2026-04-02*
*Last updated: 2026-04-02 after roadmap creation for milestone v19.1*
