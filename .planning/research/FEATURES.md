# Feature Research

**Domain:** Code Audit & Performance Tooling
**Researched:** 2026-03-12
**Confidence:** HIGH

<!-- section: compact -->
<features_compact>

**Table stakes (must have):**
- Unused exports detection — Core to bGSD's existing reachability audit (knip integration planned)
- Dead code elimination — Identifies unreachable code paths; complements unused exports
- Cyclomatic complexity analysis — Industry-standard metric for code complexity

**Differentiators:**
- Maintainability Index scoring — Compound metric (0-100) combining complexity, LOC, comments; aligns with bGSD's quality scoring
- Cognitive complexity — Better predictor of human comprehension than cyclomatic alone
- bGSD-aware analysis — Leverages existing 34-module codebase knowledge, test coverage data

**Defer (v2+):** Duplicate code merging (jscpd integration), Halstead metrics, cross-language analysis

**Key dependencies:** Complexity analysis requires AST parsing (acorn already bundled); unused exports requires module resolution (existing dependency graph capability)
</features_compact>
<!-- /section -->

<!-- section: feature_landscape -->
## Feature Landscape

### Table Stakes (Users Expect These)

Features users assume exist. Missing these = product feels incomplete.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Unused exports detection | bGSD already does reachability audit (verify:orphans); users expect comprehensive export tracking | LOW | Leverage existing acorn AST parsing; extend current reachability logic |
| Dead code elimination | Unreachable code paths are bugs waiting to happen; ESLint no-unreachable rule sets precedent | LOW | Detect code after return/throw/break in loops; mark as advisory |
| Cyclomatic complexity | Industry-standard metric; ESLint complexity rule provides baseline (default threshold: 20) | MEDIUM | Calculate per-function; expose via CLI; configurable thresholds |
| Per-function complexity breakdown | Developers need to know WHICH functions are complex | LOW | Reuse acorn AST to compute complexity per function/method |

### Differentiators (Competitive Advantage)

Features that set the product apart. Not required, but valuable.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Maintainability Index (0-100) | Compound score combining cyclomatic complexity, LOC, Halstead volume, comment ratio; Visual Studio standard | MEDIUM | Formula: MI = max(0, (171 - 5.2×ln(HV) - 0.23×CC - 16.2×ln(LOC)) × 100/171); aligns with bGSD quality scoring |
| Cognitive complexity | Measures mental effort to understand code; better than cyclomatic for human comprehension | MEDIUM | Adds points for nesting, recursion, method calls; SonarQube/Codacy use this |
| bGSD-aware code quality | Uses existing knowledge: test coverage, bundle size, 766 tests, 34 modules | LOW | Reuse existing metrics from codebase-intel.json; correlate complexity with test coverage |
| Performance impact estimation | Estimates runtime cost of complex functions | HIGH | Requires execution profiling; defer to v2+ |
| Inline complexity annotations | Shows complexity next to function definitions | MEDIUM | IDE integration; parse output for editor display |

### Anti-Features (Commonly Requested, Often Problematic)

Features that seem good but create problems.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Auto-fix dead code | Sounds like easy cleanup | May break runtime if code is dynamically used (eval, reflection) | Report only, let human verify |
| Auto-merge duplicates | Sounds like instant savings | Semantic context lost; may introduce bugs | Report duplicates, suggest extraction pattern |
| Real-time scanning on edit | Sounds like instant feedback | Performance cost; editor already has ESLint | Integrate with existing editor plugins, not replace |
| Full language support | Sounds comprehensive | 150+ languages requires massive effort | Focus on JavaScript (bGSD's language); extend later |
<!-- /section -->

<!-- section: dependencies -->
## Feature Dependencies

```
[Unused Exports Detection]
    └──requires──> [Module Resolution]
                       └──requires──> [AST Parsing (acorn exists)]

[Dead Code Detection]
    └──requires──> [Control Flow Analysis]
                       └──requires──> [AST Parsing]

[Cyclomatic Complexity]
    └──requires──> [AST Parsing]

[Cognitive Complexity]
    └──requires──> [AST Parsing]

[Maintainability Index]
    ├──requires──> [Cyclomatic Complexity]
    ├──requires──> [Lines of Code]
    └──requires──> [Halstead Metrics (defer)]

[bGSD-aware Analysis]
    └──enhances──> [All above features]
```

### Dependency Notes

- **AST Parsing requires acorn:** Already bundled (114KB); lazy-loaded for performance. Existing in v7.0.
- **Module resolution requires dependency graph:** Already exists from v5.0 codebase-intel; reuse module graph.
- **Cognitive complexity requires nesting analysis:** More complex than cyclomatic; requires recursive AST traversal.
- **Maintainability Index requires Halstead metrics:** Defer; requires operator/operand counting beyond current scope.
- **All features reuse existing infrastructure:** bGSD already has 34 modules, 766 tests, SQLite caching—leverage these.
<!-- /section -->

<!-- section: mvp -->
## MVP Definition

### Launch With (v1)

Minimum viable product — what's needed to validate the concept.

- [x] Unused exports detection — Extend existing verify:orphans; detect unused exports from module graph
- [x] Dead code detection — Identify unreachable code after return/throw/break in loops; report only
- [x] Cyclomatic complexity per function — Use acorn AST to compute; configurable threshold (default 20)
- [x] Complexity summary CLI — `bgsd audit complexity` showing top-N complex functions
- [x] Integration with existing quality scoring — Combine complexity with existing A-F grades

### Add After Validation (v1.x)

Features to add once core is working.

- [ ] Cognitive complexity scoring — Add nesting depth penalties; better human-readability correlation
- [ ] Maintainability Index (0-100) — Add LOC and comment ratio; compound score
- [ ] bGSD-aware recommendations — "This complex function has low test coverage" correlation
- [ ] Threshold configuration — Per-project .bgsdrc settings for complexity limits
- [ ] Trend tracking — Compare complexity over time; add to existing metrics

### Future Consideration (v2+)

Features to defer until product-market fit is established.

- [ ] Duplicate code detection (jscpd integration) — Requires 150+ language support; high maintenance
- [ ] Halstead metrics — Operator/operand counting; requires significant additional computation
- [ ] Performance profiling — Runtime cost estimation; requires execution instrumentation
- [ ] Auto-fix suggestions — LLM-powered refactoring; beyond static analysis scope
- [ ] Cross-language analysis — Python, Go, Rust support; defer to language-specific plugins
<!-- /section -->

<!-- section: prioritization -->
## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Unused exports detection | HIGH | LOW | P1 |
| Dead code detection | HIGH | LOW | P1 |
| Cyclomatic complexity | HIGH | MEDIUM | P1 |
| Complexity summary CLI | HIGH | LOW | P1 |
| Cognitive complexity | MEDIUM | MEDIUM | P2 |
| Maintainability Index | MEDIUM | MEDIUM | P2 |
| bGSD-aware analysis | MEDIUM | LOW | P2 |
| Trend tracking | MEDIUM | MEDIUM | P2 |
| Auto-fix suggestions | LOW | HIGH | P3 |
| Duplicate code detection | LOW | HIGH | P3 |

**Priority key:**
- P1: Must have for launch
- P2: Should have, add when possible
- P3: Nice to have, future consideration
<!-- /section -->

<!-- section: competitors -->
## Competitor Feature Analysis

| Feature | ESLint | Knip | jscpd | SonarQube | Our Approach |
|---------|--------|------|-------|-----------|--------------|
| Unused exports | no-unused-vars | Full detection | No | Yes | Extend existing verify:orphans; integrate with bGSD context |
| Dead code | no-unreachable | Partial (unused files) | No | Yes | Control flow analysis; report-only |
| Cyclomatic complexity | complexity rule | No | No | Yes | Per-function breakdown; CLI output |
| Duplicate detection | No | No | Yes (150+ lang) | Yes | Defer; jscpd integration later |
| Maintainability Index | No | No | No | Yes | Compound score; align with quality grades |
| CLI-first | Yes (lint) | Yes | Yes | No (server) | Match bGSD's CLI-first philosophy |

## Sources

- ESLint documentation: https://eslint.org/docs/latest/rules/complexity
- Knip (unused exports/dependencies): https://github.com/webpro-nl/knip
- jscpd (duplicate detection): https://jscpd.dev/
- Maintainability Index formula: https://sourcery.ai/blog/maintainability-index
- Cyclomatic Complexity standards: https://www.esolver.com/blog/cyclomatic-complexity
- Cognitive Complexity: SonarSource specification
- bGSD existing capabilities: PROJECT.md (34 modules, acorn, 766 tests, codebase-intel.json)

---

*Feature research for: Code Audit & Performance Tooling*
*Researched: 2026-03-12*
