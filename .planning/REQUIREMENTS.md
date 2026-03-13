# Requirements: bGSD Plugin v11.3

**Defined:** 2026-03-13
**Core Value:** Manage and deliver high-quality software with high-quality documentation, while continuously reducing token usage and improving performance

## v11.3 Requirements

Requirements for LLM Offloading milestone. Each maps to roadmap phases.

### Audit & Decision Framework

- [x] **AUDIT-01**: User can run a codebase scan that catalogs all LLM-offloadable decisions across workflows and agents
- [x] **AUDIT-02**: Each offloading candidate is evaluated against a decision criteria rubric (finite inputs, deterministic output, no NLU needed)
- [x] **AUDIT-03**: User can see estimated token savings per offloaded decision and per category

### Decision Engine & Rules

- [x] **ENGINE-01**: Shared decision-rules.js module provides pure functions for deterministic decisions (lookup tables, weighted scoring, template functions)
- [x] **ENGINE-02**: Plugin decision engine makes in-process decisions via existing hooks without subprocess overhead
- [x] **ENGINE-03**: CLI decisions command allows querying and debugging decision logic from the command line
- [x] **ENGINE-04**: Progressive confidence model (HIGH/MEDIUM/LOW) gates decisions — HIGH is authoritative, MEDIUM/LOW invite LLM override

### Workflow Integration

- [x] **FLOW-01**: Extended bgsd-context JSON includes pre-computed decisions that workflows consume directly
- [ ] **FLOW-02**: Workflow files simplified to consume pre-computed decisions instead of re-deriving them via LLM reasoning
- [ ] **FLOW-03**: Token savings telemetry measures before/after LLM call reduction per workflow

## Future Requirements

Deferred to future milestone.

### Advanced Offloading

- **ADV-01**: Automated workflow rewriter that programmatically simplifies workflow .md files based on decision catalog
- **ADV-02**: Decision performance dashboard showing real-time offloading metrics
- **ADV-03**: A/B testing framework comparing LLM vs code decision quality

## Out of Scope

| Feature | Reason |
|---------|--------|
| Full NL understanding in code | Requires LLM — violates the decision criteria rubric |
| Plan content generation | Requires judgment and creativity — not deterministic |
| Code review decisions | Requires understanding intent and quality — LLM territory |
| Scope creep detection | Requires comparing intent to implementation — needs reasoning |
| Deviation classification | Gray areas need LLM judgment, not rule-based classification |
| Rule engine library (json-rules-engine) | Over-engineering — plain JS patterns already proven in codebase |
| Template engine (Handlebars, etc.) | Unnecessary dependency — template literals sufficient |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status | Test Command |
|-------------|-------|--------|--------------|
| AUDIT-01 | Phase 110 | Complete | npm test |
| AUDIT-02 | Phase 110 | Complete | npm test |
| AUDIT-03 | Phase 110 | Complete | npm test |
| ENGINE-01 | Phase 111 | Complete | npm test |
| ENGINE-02 | Phase 111 | Complete | npm test |
| ENGINE-03 | Phase 111 | Complete | npm test |
| ENGINE-04 | Phase 111 | Complete | npm test |
| FLOW-01 | Phase 112 | Complete | npm test |
| FLOW-02 | Phase 112 | Pending | npm test |
| FLOW-03 | Phase 112 | Pending | npm test |

**Coverage:**
- v11.3 requirements: 10 total
- Mapped to phases: 10
- Unmapped: 0

---
*Requirements defined: 2026-03-13*
*Last updated: 2026-03-13 after roadmap creation*
