# Milestone v11.2 Requirements

**Version:** v11.2
**Name:** Code Audit & Performance
**Started:** 2026-03-12

## Current Requirements

### Code Audit Core (AUDIT-01 - AUDIT-05)

- [ ] **AUDIT-01**: Unused exports detection — Detect exported functions/variables that are never imported using AST analysis
- [ ] **AUDIT-02**: Dead code detection — Identify unreachable code paths (after return/throw/break in loops)
- [ ] **AUDIT-03**: Cyclomatic complexity — Calculate complexity per function with configurable threshold (default 20)
- [ ] **AUDIT-04**: Complexity summary CLI — `bgsd util:audit complexity` showing top-N complex functions
- [ ] **AUDIT-05**: Audit command integration — Single entry point for all audit subcommands

### Performance Profiling (PERF-01 - PERF-04)

- [ ] **PERF-01**: CPU profiling — Capture CPU profiles using node:inspector programmatically
- [ ] **PERF-02**: Memory profiling — Heap snapshot support via node:inspector
- [ ] **PERF-03**: Baseline comparison — Compare current metrics vs stored baselines
- [ ] **PERF-04**: Trend analysis — Track metrics over time with trend indicators

### CLI Tool Integration (TOOL-01 - TOOL-03)

- [ ] **TOOL-01**: knip integration — Wrapper command to invoke knip for comprehensive unused code detection
- [ ] **TOOL-02**: eslint integration — Wrapper for running ESLint rules (complexity, no-unused-vars)
- [ ] **TOOL-03**: Unified output — Parse and format external tool output for consistent UX

### Quality Improvements (QUAL-01 - QUAL-03)

- [ ] **QUAL-01**: Bundle size audit — Report bundle composition and identify reduction opportunities
- [ ] **QUAL-02**: Export surface audit — Analyze public API surface and identify unused exports
- [ ] **QUAL-03**: Test coverage correlation — Link complexity metrics to test coverage data

## Future Requirements (Deferred)

- Duplicate code detection (jscpd integration)
- Cognitive complexity scoring
- Maintainability Index (0-100)
- Auto-fix suggestions for common issues

## Out of Scope

- Runtime performance optimization (profiling shows where to optimize, not how)
- Cross-language analysis (focus on JavaScript/Node.js)
- Real-time scanning on file change (use editor plugins)

---

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| AUDIT-01 | Phase 106 | Pending |
| AUDIT-02 | Phase 106 | Pending |
| AUDIT-03 | Phase 106 | Pending |
| AUDIT-04 | Phase 106 | Pending |
| AUDIT-05 | Phase 106 | Pending |
| PERF-01 | Phase 107 | Pending |
| PERF-02 | Phase 107 | Pending |
| PERF-03 | Phase 107 | Pending |
| PERF-04 | Phase 107 | Pending |
| TOOL-01 | Phase 108 | Pending |
| TOOL-02 | Phase 108 | Pending |
| TOOL-03 | Phase 108 | Pending |
| QUAL-01 | Phase 109 | Pending |
| QUAL-02 | Phase 109 | Pending |
| QUAL-03 | Phase 109 | Pending |
