# Requirements: GSD Plugin — UX & Developer Experience

**Defined:** 2026-02-26
**Core Value:** Manage and deliver high-quality software with high-quality documentation, while continuously reducing token usage and improving performance

## v6.0 Requirements

Requirements for UX overhaul milestone. Each maps to roadmap phases.

### Formatting Infrastructure

- [x] **FMT-01**: User gets a shared `formatTable(headers, rows, options)` utility with column alignment, truncation, and optional borders
- [x] **FMT-02**: User gets a TTY-aware color utility (~2KB picocolors pattern) with bold, dim, red, green, yellow, cyan, and auto-disable for non-TTY
- [x] **FMT-03**: User gets a shared `progressBar(percent, width)` utility replacing the 2 duplicated implementations
- [x] **FMT-04**: User gets `banner(title)` and `box(content, type)` renderers implementing the ui-brand.md visual spec
- [x] **FMT-05**: User gets exported status symbol constants (`SYMBOLS.check`, `SYMBOLS.cross`, `SYMBOLS.progress`, etc.) used consistently across all output

### Smart Output

- [x] **OUT-01**: CLI auto-detects TTY and renders human-readable output when interactive, JSON when piped
- [x] **OUT-02**: `--raw` flag forces JSON output regardless of TTY detection
- [x] **OUT-03**: `--pretty` flag forces human-readable output regardless of TTY detection (e.g., for `less -R`)
- [x] **OUT-04**: Output destination is consistent — all human-readable output goes to stdout, debug/diagnostics to stderr

### Command Renderers

- [ ] **CMD-01**: All init commands (`init progress`, `init execute-phase`, `init plan-phase`, etc.) produce branded human-readable output in TTY mode
- [ ] **CMD-02**: State commands (`state`, `state show`, `state update-progress`) produce clean formatted output in TTY mode
- [x] **CMD-03**: Verification commands (`verify requirements`, `verify quality`) produce summary tables with pass/fail indicators in TTY mode
- [x] **CMD-04**: Codebase commands (`codebase analyze`, `codebase status`, `codebase conventions`, `codebase deps`, `codebase context`, etc.) produce formatted output in TTY mode
- [ ] **CMD-05**: Feature commands (`velocity`, `quick-summary`, `context-budget`, `search-decisions`, `trace-requirement`, etc.) produce formatted output in TTY mode
- [ ] **CMD-06**: Intent commands maintain existing rendering quality and adopt shared formatting utilities

### Workflow Output

- [x] **WKFL-04**: All workflow .md files audited for token usage with before/after baselines measured
- [x] **WKFL-05**: Workflow output instructions tightened — status messages reduced, redundant information eliminated
- [x] **WKFL-06**: Updated `ui-brand.md` with tighter patterns and concrete examples for information-dense output
- [x] **WKFL-07**: Workflow table instructions use consistent column widths and alignment patterns

### Slash Commands & Integration

- [ ] **INTG-01**: 11 missing command wrapper files created in OpenCode command directory
- [ ] **INTG-02**: `deploy.sh` updated to sync command wrappers during deployment
- [ ] **INTG-03**: AGENTS.md updated to reflect current project state — stale items removed, v5.0/v6.0 status current

### Quality

- [x] **QUAL-01**: 2 failing tests from v5.0 fixed
- [x] **QUAL-02**: New tests cover formatting utilities (table, color, progress bar, banner, box)
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
| FMT-01 | Phase 30 | Complete | — |
| FMT-02 | Phase 30 | Complete | — |
| FMT-03 | Phase 30 | Complete | — |
| FMT-04 | Phase 30 | Complete | — |
| FMT-05 | Phase 30 | Complete | — |
| OUT-01 | Phase 30 | Complete | — |
| OUT-02 | Phase 30 | Complete | — |
| OUT-03 | Phase 30 | Complete | — |
| OUT-04 | Phase 30 | Complete | — |
| CMD-01 | Phase 32 | Pending | — |
| CMD-02 | Phase 32 | Pending | — |
| CMD-03 | Phase 33 | Complete | 2026-02-27 |
| CMD-04 | Phase 33 | Complete | 2026-02-27 |
| CMD-05 | Phase 34 | Pending | — |
| CMD-06 | Phase 34 | Pending | — |
| WKFL-04 | Phase 35 | Complete | 2026-02-27 |
| WKFL-05 | Phase 35 | Complete | 2026-02-27 |
| WKFL-06 | Phase 35 | Complete | 2026-02-27 |
| WKFL-07 | Phase 35 | Complete | 2026-02-27 |
| INTG-01 | Phase 36 | Pending | — |
| INTG-02 | Phase 36 | Pending | — |
| INTG-03 | Phase 36 | Pending | — |
| QUAL-01 | Phase 31 | Complete | — |
| QUAL-02 | Phase 31 | Complete | — |
| QUAL-03 | Phase 36 | Pending | — |

**Coverage:**
- v6.0 requirements: 25 total
- Mapped to phases: 25
- Unmapped: 0

---
*Requirements defined: 2026-02-26*
*Last updated: 2026-02-26 after roadmap creation*
