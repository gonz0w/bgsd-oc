# Requirements: bGSD Plugin v9.2

**Defined:** 2026-03-10
**Core Value:** Manage and deliver high-quality software with high-quality documentation, while continuously reducing token usage and improving performance

## v9.2 Requirements

### Table Stakes (Must Have)

#### Tool Detection & Infrastructure

- [x] **CLI-01**: Plugin can detect available CLI tools (ripgrep, fd, jq, etc.) with caching
- [x] **CLI-02**: Plugin shows clear install instructions when CLI tool is unavailable
- [x] **CLI-03**: Plugin gracefully degrades to existing Node.js implementations when CLI tools unavailable

#### Search & Discovery

- [ ] **CLI-04**: User can use ripgrep for content search with --json output for parsing
- [ ] **CLI-05**: User can use fd for file discovery with .gitignore respect
- [ ] **CLI-06**: User can use jq for JSON processing in CLI pipelines

### Differentiators (Should Have)

#### Extended Tools

- [x] **CLI-07**: User can use yq for YAML processing
- [x] **CLI-08**: User can use bat for syntax-highlighted file output
- [x] **CLI-09**: User can use gh CLI for GitHub operations (PRs, issues)

#### Runtime Exploration

- [ ] **RUNT-01**: Plugin can detect Bun runtime availability
- [ ] **RUNT-02**: Plugin documents Bun compatibility and known limitations
- [ ] **RUNT-03**: Plugin can benchmark startup time comparison (Node vs Bun)

### Out of Scope

| Feature | Reason |
|---------|--------|
| lazygit integration | Interactive TUI with no stable CLI interface, blocks automation |
| fzf full automation | Requires TTY, limited value for automated agents |
| Bun as primary runtime | Breaks single-file esbuild deploy model, ecosystem maturing |
| ugrep integration | ripgrep sufficient for v9.2 scope |
| gitui integration | lazygit preferred if TUI needed, gitui adds overlap |

## Out of Scope

| Feature | Reason |
|---------|--------|
| Full runtime rewrite | High risk; incremental adoption preferred |
| New dependency without hotspot evidence | Avoids bundle bloat |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| CLI-01 - Tool detection with caching | Phase 82 | Pending |
| CLI-02 - Install instructions when unavailable | Phase 82 | Pending |
| CLI-03 - Graceful fallback to Node.js | Phase 82 | Pending |
| CLI-04 - ripgrep with --json output | Phase 83 | Pending |
| CLI-05 - fd with .gitignore respect | Phase 83 | Pending |
| CLI-06 - jq for JSON processing | Phase 83 | Pending |
| CLI-07 - yq for YAML processing | Phase 84 | Complete |
| CLI-08 - bat for syntax-highlighted output | Phase 84 | Complete |
| CLI-09 - gh CLI for GitHub operations | Phase 84 | Complete |
| RUNT-01 - Bun runtime detection | Phase 85 | Pending |
| RUNT-02 - Bun compatibility documentation | Phase 85 | Pending |
| RUNT-03 - Node vs Bun benchmark | Phase 85 | Pending |

---
*Requirements defined: 2026-03-10*
*Last updated: 2026-03-10*
