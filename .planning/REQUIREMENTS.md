# Requirements: GSD Plugin for OpenCode

**Defined:** 2026-02-24
**Core Value:** Manage and deliver high-quality software with high-quality documentation, while continuously reducing token usage and improving performance

## v3.0 Requirements

Requirements for v3.0 Intent Engineering milestone. Each maps to roadmap phases.

### Intent Capture

- [x] **ICAP-01**: Plugin provides an INTENT.md template with structured sections: objective, desired outcomes, health metrics, target users, constraints, success criteria
- [x] **ICAP-02**: Plugin can create a new INTENT.md via `intent create` command, populating from provided arguments or interactive input
- [x] **ICAP-03**: Plugin can read and display intent via `intent read` / `intent show` commands with JSON output and human-readable formats
- [x] **ICAP-04**: Plugin can update specific intent sections via `intent update` command without overwriting unmodified sections
- [ ] **ICAP-05**: New-project and new-milestone workflows include guided intent questionnaire that extracts objective, outcomes, and success criteria before proceeding
- [ ] **ICAP-06**: Plugin tracks intent evolution across milestones, logging changes with reasoning in INTENT.md history section

### Intent Tracing

- [x] **ITRC-01**: Each PLAN.md includes an intent section that traces its objective back to specific INTENT.md desired outcomes by ID
- [x] **ITRC-02**: Plugin generates a traceability matrix showing which desired outcomes map to which phases/plans
- [x] **ITRC-03**: Plugin detects desired outcomes with no phase or plan addressing them (outcome coverage gaps)

### Intent Validation

- [x] **IVAL-01**: Plugin detects plan objectives that don't trace to any stated desired outcome (objective mismatch)
- [x] **IVAL-02**: Plugin detects tasks or features in plans that have no backing in INTENT.md outcomes or success criteria (feature creep detection)
- [x] **IVAL-03**: Plugin detects when work is being done on low-priority outcomes while higher-priority outcomes remain unaddressed (priority inversion)
- [x] **IVAL-04**: Plugin produces a numeric intent drift score (0-100) measuring alignment between current work and stated intent
- [x] **IVAL-05**: Intent validation runs as advisory pre-flight check before plan execution, warning but not blocking

### Workflow Integration

- [ ] **WINT-01**: Init commands (progress, execute, plan) include intent summary in their output so agents always see project intent
- [ ] **WINT-02**: Research agents receive intent context (objective, target users, desired outcomes) to scope their exploration
- [ ] **WINT-03**: Planner agents reference intent when creating phase plans, ensuring plan objectives derive from desired outcomes
- [ ] **WINT-04**: Verify-work workflow checks deliverables against desired outcomes and success criteria, not just requirements

### Self-Application

- [x] **SELF-01**: GSD's own development uses INTENT.md to capture the plugin's purpose and guide its own planning/execution

## Future Requirements

Deferred to v4.0 or later. Tracked but not in current roadmap.

### Cross-Project Knowledge

- **XPRJ-01**: Patterns learned in one project can benefit other projects using GSD via global memory location

### Advanced Intent

- **AINT-01**: Intent auto-evolution — plugin suggests intent updates when deliverables consistently drift from original outcomes
- **AINT-02**: Intent comparison — compare two project intents to identify overlap, conflicts, or synergies
- **AINT-03**: Hard intent gates — configurable option to block execution when drift score exceeds threshold

## Out of Scope

| Feature | Reason |
|---------|--------|
| RAG / vector search for intent matching | Wrong architecture for a CLI tool; deterministic text matching is sufficient |
| LLM-based intent scoring | Non-deterministic; use structured text comparison instead |
| Hard blocking gates by default | Advisory-first pattern proven in v2.0; blocking is opt-in future feature |
| Intent negotiation between agents | Single-user CLI tool, not a multi-agent negotiation system |
| Real-time intent monitoring | GSD is a CLI, not a daemon; validation runs at workflow checkpoints |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| ICAP-01 | Phase 14 | Complete |
| ICAP-02 | Phase 14 | Complete |
| ICAP-03 | Phase 14 | Complete |
| ICAP-04 | Phase 14 | Complete |
| ICAP-05 | Phase 17 | Pending |
| ICAP-06 | Phase 17 | Pending |
| ITRC-01 | Phase 15 | Complete |
| ITRC-02 | Phase 15 | Complete |
| ITRC-03 | Phase 15 | Complete |
| IVAL-01 | Phase 15 | Complete |
| IVAL-02 | Phase 15 | Complete |
| IVAL-03 | Phase 15 | Complete |
| IVAL-04 | Phase 15 | Complete |
| IVAL-05 | Phase 15 | Complete |
| WINT-01 | Phase 16 | Pending |
| WINT-02 | Phase 16 | Pending |
| WINT-03 | Phase 16 | Pending |
| WINT-04 | Phase 16 | Pending |
| SELF-01 | Phase 16 | Complete |

**Coverage:**
- v3.0 requirements: 19 total
- Mapped to phases: 19
- Unmapped: 0 ✓

---
*Requirements defined: 2026-02-24*
*Last updated: 2026-02-24 after roadmap creation*
