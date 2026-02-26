# Requirements: GSD Plugin — Codebase Intelligence

**Defined:** 2026-02-25
**Core Value:** Manage and deliver high-quality software with high-quality documentation, while continuously reducing token usage and improving performance

## v5.0 Requirements

Requirements for codebase intelligence milestone. Each maps to roadmap phases.

### Infrastructure

- [x] **INFRA-01**: CLI produces a codebase-intel.json cache file with git hash watermarks for freshness validation
- [x] **INFRA-02**: Staleness check completes in <50ms by comparing cached git hash to current HEAD
- [x] **INFRA-03**: Incremental updates re-analyze only files changed since last cached commit
- [x] **INFRA-04**: Cache auto-triggers on init commands when stale (follows env.js autoTrigger pattern)

### Convention Extraction

- [x] **CONV-01**: User can run `codebase conventions` to extract naming patterns from project files
- [x] **CONV-02**: Convention detector identifies file organization rules (directory structure, file placement patterns)
- [x] **CONV-03**: Framework-specific macro/pattern detection works for Elixir (Phoenix routes, Ecto schemas, plugs), with extensible pattern registry
- [x] **CONV-04**: Each extracted convention has a confidence score (percentage of files following the pattern)
- [x] **CONV-05**: User can run `codebase rules` to generate a conventions rules document for agent consumption (capped at 15 rules)

### Dependency Analysis

- [x] **DEPS-01**: User can run `codebase deps` to build a module dependency graph from import/require/use statements
- [x] **DEPS-02**: Import parsing covers 6 languages via regex: JavaScript, TypeScript, Python, Go, Elixir, Rust
- [x] **DEPS-03**: Dependency graph uses adjacency-list representation with forward and reverse edges
- [x] **DEPS-04**: User can run `codebase impact <file>` to see transitive dependents (what breaks if this file changes)
- [x] **DEPS-05**: Cycle detection identifies circular dependencies using Tarjan's strongly connected components

### Lifecycle Awareness

- [ ] **LIFE-01**: User can run `codebase lifecycle` to see execution order relationships (seeds after migrations, config at boot)
- [ ] **LIFE-02**: Lifecycle detection identifies framework-specific initialization patterns (starting with Elixir/Phoenix)
- [ ] **LIFE-03**: Lifecycle analysis outputs a dependency chain showing which files/operations must run before others

### Context Injection

- [ ] **CTXI-01**: Init commands include a compact codebase summary (<500 tokens) when codebase-intel.json exists
- [ ] **CTXI-02**: User can run `codebase context --files <paths>` to get task-scoped architectural context for specific files
- [ ] **CTXI-03**: Task-scoped context uses heuristic scoring (graph distance + plan scope + git recency) for relevance ranking
- [ ] **CTXI-04**: Total injected codebase context never exceeds 5K tokens per invocation

### Workflow Integration

- [ ] **WKFL-01**: Execute-phase workflow auto-injects relevant codebase context based on plan file references
- [ ] **WKFL-02**: Pre-flight convention check warns before execution if plan touches files with known conventions
- [ ] **WKFL-03**: Existing `codebase-impact` command is updated to use cached dependency graph when available

## Future Requirements

### Advanced Analysis

- **ADVN-01**: Convention drift detection over time (conventions that are losing consistency)
- **ADVN-02**: Co-change analysis (files that frequently change together)
- **ADVN-03**: Module boundary detection and enforcement
- **ADVN-04**: Cross-project convention sharing

### Language Expansion

- **LANG-01**: Ruby import/require parsing
- **LANG-02**: Java/Kotlin import parsing
- **LANG-03**: C/C++ include parsing

## Out of Scope

| Feature | Reason |
|---------|--------|
| Tree-sitter AST parsing | 616KB per language grammar + 252KB runtime; regex provides 85-90% accuracy at zero cost |
| Embedding-based retrieval | Requires API calls, external dependencies, and vector storage; heuristic scoring is sufficient |
| LSP integration | Heavy dependency, overlaps with editor-native features |
| Real-time analysis during execution | Performance budget incompatible; cached analysis with freshness checks is sufficient |
| Universal lifecycle detection | Too framework-specific to generalize; build incrementally per framework |
| Full codebase in context | Models degrade past 25-30K tokens; task-scoped injection is the correct approach |

## Traceability

| Requirement | Phase | Status | Test Command |
|-------------|-------|--------|--------------|
| INFRA-01 | Phase 23 | Complete | node bin/gsd-tools.cjs codebase analyze --raw |
| INFRA-02 | Phase 23 | Complete | node bin/gsd-tools.cjs codebase status --raw |
| INFRA-03 | Phase 23 | Complete | node bin/gsd-tools.cjs codebase analyze --raw |
| INFRA-04 | Phase 23 | Complete | node bin/gsd-tools.cjs init progress --raw |
| CONV-01 | Phase 24 | Complete | node bin/gsd-tools.cjs codebase conventions --raw |
| CONV-02 | Phase 24 | Complete | node bin/gsd-tools.cjs codebase conventions --raw |
| CONV-03 | Phase 24 | Complete | node bin/gsd-tools.cjs codebase conventions --raw |
| CONV-04 | Phase 24 | Complete | node bin/gsd-tools.cjs codebase conventions --raw |
| CONV-05 | Phase 24 | Complete | node bin/gsd-tools.cjs codebase rules --raw |
| DEPS-01 | Phase 25 | Complete | node bin/gsd-tools.cjs codebase deps --raw |
| DEPS-02 | Phase 25 | Complete | node bin/gsd-tools.cjs codebase deps --raw |
| DEPS-03 | Phase 25 | Complete | node bin/gsd-tools.cjs codebase deps --raw |
| DEPS-04 | Phase 25 | Complete | node bin/gsd-tools.cjs codebase impact src/lib/state.js --raw |
| DEPS-05 | Phase 25 | Complete | node bin/gsd-tools.cjs codebase deps --cycles --raw |
| LIFE-01 | Phase 28 | Pending | node bin/gsd-tools.cjs codebase lifecycle --raw |
| LIFE-02 | Phase 28 | Pending | node bin/gsd-tools.cjs codebase lifecycle --raw |
| LIFE-03 | Phase 28 | Pending | node bin/gsd-tools.cjs codebase lifecycle --raw |
| CTXI-01 | Phase 26 | Pending | node bin/gsd-tools.cjs init progress --raw |
| CTXI-02 | Phase 27 | Pending | node bin/gsd-tools.cjs codebase context --files src/index.js --raw |
| CTXI-03 | Phase 27 | Pending | node bin/gsd-tools.cjs codebase context --files src/index.js --raw |
| CTXI-04 | Phase 27 | Pending | node bin/gsd-tools.cjs codebase context --files src/index.js --raw |
| WKFL-01 | Phase 29 | Pending | manual verification |
| WKFL-02 | Phase 29 | Pending | manual verification |
| WKFL-03 | Phase 29 | Pending | node bin/gsd-tools.cjs codebase-impact src/lib/state.js --raw |

**Coverage:**
- v5.0 requirements: 20 total
- Mapped to phases: 20
- Unmapped: 0 ✓

---
*Requirements defined: 2026-02-25*
*Last updated: 2026-02-25 after roadmap creation*
