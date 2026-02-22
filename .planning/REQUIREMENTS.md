# Requirements: GSD Plugin v1.1

**Defined:** 2026-02-22
**Core Value:** Every improvement must make the plugin more reliable and faster for developers using GSD to plan and execute real projects

## v1.1 Requirements

Requirements for context reduction and tech debt cleanup. Each maps to roadmap phases.

### Measurement & Baselines

- [x] **MEAS-01**: CLI provides accurate token estimation for any text input using tokenx library
- [x] **MEAS-02**: Token baselines are measured for each of the 32 workflow invocations
- [x] **MEAS-03**: User can run before/after comparison showing token reduction per workflow

### CLI Output Reduction

- [x] **CLIP-01**: User can pass `--fields` flag to any JSON command to return only specified fields
- [ ] **CLIP-02**: Init commands support `--compact` flag returning essential-only data (38-50% smaller)
- [ ] **CLIP-03**: Init commands return context manifests telling agents which files/sections to load

### Workflow Compression

- [ ] **WKFL-01**: Large reference files are split so agents load only relevant sections
- [ ] **WKFL-02**: CLI supports selective markdown section extraction (load specific headers from files)
- [ ] **WKFL-03**: Repeated boilerplate across workflow files is deduplicated into shared references
- [ ] **WKFL-04**: Research output supports summary/detail tiers for context-aware loading

### Tech Debt

- [ ] **DEBT-01**: `roadmap analyze` test passes (fix expected vs actual percentage)
- [ ] **DEBT-02**: All 79 commands have `--help` text
- [ ] **DEBT-03**: Plan template files exist in `templates/plans/` for common patterns

## Future Requirements

Deferred beyond v1.1. Tracked but not in current roadmap.

### Advanced Context Management

- **ACTX-01**: Progressive workflow step loading (load only current step instructions)
- **ACTX-02**: Automated workflow regression testing (verify agent behavior after compression)
- **ACTX-03**: `--precise` flag for exact BPE token counting via lazy-loaded gpt-tokenizer
- **ACTX-04**: Default `--compact` mode (v1.2 — breaking change requires migration period)

## Out of Scope

| Feature | Reason |
|---------|--------|
| RAG / vector search | Wrong architecture — GSD is a CLI tool, not a retrieval system |
| LLM-based summarization | Research showed deterministic compression outperforms LLM summarization (JetBrains NeurIPS 2025) |
| Conversation compaction | Host tool's responsibility (Claude Code/OpenCode), not GSD's |
| Model routing | Out of GSD's control — host tool manages model selection |
| Token truncation | Lossy and unpredictable — selective loading is strictly better |
| Response caching | CLI process is short-lived (<5s); caching across invocations needs external state |
| Streaming output | JSON-over-stdout protocol is batch by design; streaming adds complexity without context savings |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| MEAS-01 | Phase 6: Token Measurement & Output Infrastructure | ✅ Complete |
| MEAS-02 | Phase 6: Token Measurement & Output Infrastructure | ✅ Complete |
| MEAS-03 | Phase 6: Token Measurement & Output Infrastructure | ✅ Complete |
| CLIP-01 | Phase 6: Token Measurement & Output Infrastructure | ✅ Complete |
| CLIP-02 | Phase 7: Init Command Compaction | Pending |
| CLIP-03 | Phase 7: Init Command Compaction | Pending |
| WKFL-01 | Phase 8: Workflow & Reference Compression | Pending |
| WKFL-02 | Phase 8: Workflow & Reference Compression | Pending |
| WKFL-03 | Phase 8: Workflow & Reference Compression | Pending |
| WKFL-04 | Phase 8: Workflow & Reference Compression | Pending |
| DEBT-01 | Phase 9: Tech Debt Cleanup | Pending |
| DEBT-02 | Phase 9: Tech Debt Cleanup | Pending |
| DEBT-03 | Phase 9: Tech Debt Cleanup | Pending |

**Coverage:**
- v1.1 requirements: 13 total
- Mapped to phases: 13
- Unmapped: 0 ✓

---
*Requirements defined: 2026-02-22*
*Last updated: 2026-02-22 after roadmap creation*
