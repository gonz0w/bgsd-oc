# Technology Stack

**Analysis Date:** 2026-02-21

## Languages

**Primary:**
- JavaScript (Node.js CommonJS) — All application logic in `bin/gsd-tools.cjs` (6,495 lines) and `bin/gsd-tools.test.cjs` (2,302 lines)
- Markdown — 79 files (20,542 lines) comprising workflows, templates, and references that serve as LLM prompts and document templates

**Secondary:**
- Bash — `deploy.sh` (29 lines) for deployment; also embedded bash snippets inside workflow `.md` files for gsd-tools CLI invocations
- JSON — `templates/config.json` for project configuration template

## Runtime

**Environment:**
- Node.js (tested on v25.6.1, requires `>=18` for native `fetch` API and `node:test` module)
- No `.nvmrc` or `.node-version` file present — version managed externally

**Package Manager:**
- None — **zero dependencies**. No `package.json`, no `node_modules/`, no lockfile.
- All code uses only Node.js built-in modules.

## Frameworks & Libraries

**Core Application:**
- No frameworks. `bin/gsd-tools.cjs` is a zero-dependency, single-file CLI tool.

**Testing:**
- `node:test` (built-in) — Test runner via `require('node:test')` in `bin/gsd-tools.test.cjs`
- `node:assert` (built-in) — Assertions via `require('node:assert')`

**Build/Dev:**
- No build step. Code is interpreted directly via `node bin/gsd-tools.cjs`.
- No transpilation, bundling, or compilation required.

## Node.js Built-in Module Usage

The CLI relies exclusively on Node.js standard library:

| Module | Import | Purpose |
|--------|--------|---------|
| `fs` | `require('fs')` | All file system operations (read/write/exists/mkdir/readdir) |
| `path` | `require('path')` | Path joining, resolution, basename extraction |
| `child_process` | `require('child_process').execSync` | Git commands, shell commands (`find`, `grep`) |
| `os` | `require('os')` (inline) | `homedir()` for `~/.gsd/` paths, `tmpdir()` for large JSON overflow |
| `fetch` | Global `fetch()` (Node 18+) | Brave Search API HTTP requests |
| `node:test` | Test file only | Test runner (`describe`, `test`, `beforeEach`, `afterEach`) |
| `node:assert` | Test file only | Test assertions (`deepStrictEqual`, `ok`, `strictEqual`) |

## Key Dependencies

**None.** This is a deliberately zero-dependency project. The `AGENTS.md` explicitly states:
> "Single-file CLI: `gsd-tools.cjs` stays as one file (Node.js, zero dependencies)"

## Configuration

**Project-level config (per-project):**
- `.planning/config.json` — Created from `templates/config.json` template. Controls:
  - `model_profile`: `"quality"` | `"balanced"` | `"budget"` — AI model selection tier
  - `commit_docs`: boolean — Whether to git-commit planning artifacts
  - `search_gitignored`: boolean — Include `.planning/` in broad searches
  - `branching_strategy`: `"none"` | `"phase"` | `"milestone"` — Git branching approach
  - `phase_branch_template` / `milestone_branch_template` — Branch name patterns
  - `workflow.research` / `workflow.plan_check` / `workflow.verifier` — Toggle workflow steps
  - `parallelization` — Enable parallel plan execution (boolean or `{ enabled, max_concurrent_agents }`)
  - `brave_search` — Enable web search integration
  - `gates.*` — User confirmation gates for various operations
  - `safety.*` — Safety confirmations for destructive/external operations

**User-level config (global):**
- `~/.gsd/defaults.json` — User-level defaults merged into new project configs
- `~/.gsd/brave_api_key` — File-based Brave API key storage (alternative to env var)

**Environment Variables:**
- `BRAVE_API_KEY` — Brave Search API authentication (optional)
- `HOME` — Used for `~` path expansion in file references

## Build & Deploy

**Development:**
```bash
# Run any CLI command directly
node bin/gsd-tools.cjs <command> [args] [--raw]

# Run tests
node --test bin/gsd-tools.test.cjs
```

**Deployment:**
- `deploy.sh` copies `bin/`, `workflows/`, `templates/`, `references/`, and `VERSION` to `~/.config/opencode/get-shit-done/`
- Creates timestamped backup of existing installation before overwriting
- No build step — raw source files are the deployed artifacts

**Versioning:**
- `VERSION` file contains current version: `1.20.5`
- Plain text, single line, semver format

## Platform Requirements

**Development:**
- Linux (developed and tested on Linux)
- Node.js >=18 (for native `fetch` and `node:test`)
- Git (required for commit operations, history analysis, rollback features)

**Production (plugin runtime):**
- OpenCode AI assistant (replaces Claude Code) — the host environment that invokes workflows
- Node.js >=18 available on `PATH`
- Git repository in the target project
- Write access to `~/.config/opencode/get-shit-done/` for installation

## File Organization

**Source files:**
- `bin/gsd-tools.cjs` — Single-file CLI (6,495 lines, all application logic)
- `bin/gsd-tools.test.cjs` — Test suite (2,302 lines)

**Content files (Markdown):**
- `workflows/*.md` — 32 workflow definitions (10,266 lines total) — LLM prompt scripts
- `templates/*.md` + `templates/**/*.md` — 24 document templates
- `references/*.md` — 13 reference documents loaded by workflows

**Config/Meta:**
- `templates/config.json` — Default project configuration template
- `VERSION` — Current version identifier
- `deploy.sh` — Deployment script
- `AGENTS.md` — Development workspace documentation

---

*Stack analysis: 2026-02-21*
