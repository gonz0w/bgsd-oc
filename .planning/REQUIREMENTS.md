# Requirements: GSD Plugin — UX & Developer Experience

**Defined:** 2026-02-26
**Core Value:** Manage and deliver high-quality software with high-quality documentation, while continuously reducing token usage and improving performance

## v6.0 Requirements

Requirements for UX overhaul milestone. Each maps to roadmap phases.

### Formatting Infrastructure

- [ ] **FMT-01**: User gets a shared `formatTable(headers, rows, options)` utility with column alignment, truncation, and optional borders
- [ ] **FMT-02**: User gets a TTY-aware color utility (~2KB picocolors pattern) with bold, dim, red, green, yellow, cyan, and auto-disable for non-TTY
- [ ] **FMT-03**: User gets a shared `progressBar(percent, width)` utility replacing the 2 duplicated implementations
- [ ] **FMT-04**: User gets `banner(title)` and `box(content, type)` renderers implementing the ui-brand.md visual spec
- [ ] **FMT-05**: User gets exported status symbol constants (`SYMBOLS.check`, `SYMBOLS.cross`, `SYMBOLS.progress`, etc.) used consistently across all output

### Smart Output

- [ ] **OUT-01**: CLI auto-detects TTY and renders human-readable output when interactive, JSON when piped
- [ ] **OUT-02**: `--raw` flag forces JSON output regardless of TTY detection
- [ ] **OUT-03**: `--pretty` flag forces human-readable output regardless of TTY detection (e.g., for `less -R`)
- [ ] **OUT-04**: Output destination is consistent — all human-readable output goes to stdout, debug/diagnostics to stderr

### Command Renderers

- [ ] **CMD-01**: All init commands (`init progress`, `init execute-phase`, `init plan-phase`, etc.) produce branded human-readable output in TTY mode
- [ ] **CMD-02**: State commands (`state`, `state show`, `state update-progress`) produce clean formatted output in TTY mode
- [ ] **CMD-03**: Verification commands (`verify requirements`, `verify quality`) produce summary tables with pass/fail indicators in TTY mode
- [ ] **CMD-04**: Codebase commands (`codebase analyze`, `codebase status`, `codebase conventions`, `codebase deps`, `codebase context`, etc.) produce formatted output in TTY mode
- [ ] **CMD-05**: Feature commands (`velocity`, `quick-summary`, `context-budget`, `search-decisions`, `trace-requirement`, etc.) produce formatted output in TTY mode
- [ ] **CMD-06**: Intent commands maintain existing rendering quality and adopt shared formatting utilities

### Workflow Output

- [ ] **WKFL-04**: All workflow .md files audited for token usage with before/after baselines measured
- [ ] **WKFL-05**: Workflow output instructions tightened — status messages reduced, redundant information eliminated
- [ ] **WKFL-06**: Updated `ui-brand.md` with tighter patterns and concrete examples for information-dense output
- [ ] **WKFL-07**: Workflow table instructions use consistent column widths and alignment patterns

### Slash Commands & Integration

- [ ] **INTG-01**: 11 missing command wrapper files created in OpenCode command directory
- [ ] **INTG-02**: `deploy.sh` updated to sync command wrappers during deployment
- [ ] **INTG-03**: AGENTS.md updated to reflect current project state — stale items removed, v5.0/v6.0 status current

### Quality

- [ ] **QUAL-01**: 2 failing tests from v5.0 fixed
- [ ] **QUAL-02**: New tests cover formatting utilities (table, color, progress bar, banner, box)
- [ ] **QUAL-03**: Bundle size stays reasonable after adding formatting module

## Future Requirements

### Advanced Formatting

- **AFMT-01**: Sparkline charts for velocity/progress trends
- **AFMT-02**: Interactive table scrolling (if terminal supports it)
- **AFMT-03**: Theme support (light/dark mode detection)
- **AFMT-04**: Convention drift detection over time

### Language Expansion

- **LANG-01**: Ruby import/require parsing
- **LANG-02**: Java/Kotlin import parsing
- **LANG-03**: C/C++ include parsing

## Out of Scope

| Feature | Reason |
|---------|--------|
| Ink/React-based TUI framework | Heavy dependency, violates zero-deps constraint |
| Blessed/ncurses terminal UI | Full-screen TUI is overkill for a CLI tool |
| chalk/kleur color library | Bundling a ~2KB picocolors pattern is sufficient |
| Animated spinners/loaders | CLI runs are short (<5s); static progress is sufficient |
| Mouse interaction | Terminal-only, keyboard workflows |
| Custom terminal font rendering | Beyond scope — work with standard monospace |

## Traceability

| Requirement | Phase | Status | Test Command |
|-------------|-------|--------|--------------|
| FMT-01 | — | Pending | — |
| FMT-02 | — | Pending | — |
| FMT-03 | — | Pending | — |
| FMT-04 | — | Pending | — |
| FMT-05 | — | Pending | — |
| OUT-01 | — | Pending | — |
| OUT-02 | — | Pending | — |
| OUT-03 | — | Pending | — |
| OUT-04 | — | Pending | — |
| CMD-01 | — | Pending | — |
| CMD-02 | — | Pending | — |
| CMD-03 | — | Pending | — |
| CMD-04 | — | Pending | — |
| CMD-05 | — | Pending | — |
| CMD-06 | — | Pending | — |
| WKFL-04 | — | Pending | — |
| WKFL-05 | — | Pending | — |
| WKFL-06 | — | Pending | — |
| WKFL-07 | — | Pending | — |
| INTG-01 | — | Pending | — |
| INTG-02 | — | Pending | — |
| INTG-03 | — | Pending | — |
| QUAL-01 | — | Pending | — |
| QUAL-02 | — | Pending | — |
| QUAL-03 | — | Pending | — |

**Coverage:**
- v6.0 requirements: 25 total
- Mapped to phases: 0
- Unmapped: 25 (pending roadmap creation)

---
*Requirements defined: 2026-02-26*
*Last updated: 2026-02-26 after initial definition*
