# Phase 18: Environment Awareness - Context

**Gathered:** 2026-02-25
**Status:** Ready for planning

<domain>
## Phase Boundary

Detect what languages, tools, and runtimes are available in a project so downstream agents have context before they start working. The scanner produces a machine-readable manifest that init commands inject into agent context. This covers detection, manifest output, staleness management, and agent consumption. Restore commands, MCP profiling, and agent behavior changes based on environment are separate phases.

</domain>

<decisions>
## Implementation Decisions

### Detection scope & depth
- Recursive scanning with depth limit (3 levels), skipping node_modules/vendor/deps/_build/etc.
- Detect languages from manifests (package.json, go.mod, mix.exs, Cargo.toml, pyproject.toml, etc.)
- Detect build/runtime tools, infrastructure services, version managers, CI configs, test frameworks, linters/formatters, and MCP server configurations
- Detect everything useful — comprehensive scan including databases/brokers from docker-compose, but just note the service name (don't parse connection details)
- Docker/compose-level infra detection only — no Nomad/Consul/Vault orchestration detection
- No IDE/editor config detection (.vscode/, .idea/)
- No OpenCode config detection (AGENTS.md — agents already load these)

### Primary language determination
- Agent's Discretion — agent picks the best approach for determining primary language in polyglot projects

### Version detection strategy
- Report both: configured version (from mise.toml, .tool-versions, .nvmrc) AND installed version (from binary --version) when they differ
- Two-tier performance: fast file existence checks (<10ms), lazy binary version checks on first access or background
- Binary version checks cached for 24h — only file detection re-runs on staleness rescan

### Missing binary handling
- Warn but include: if go.mod exists but `go` isn't on PATH, report the language as detected with binary marked as missing

### Scripts detection
- Capture well-known scripts only: test, build, lint, start, deploy, format, check
- Extract from package.json scripts, mix aliases, Makefile/Justfile targets

### Workspace/monorepo detection
- Detect workspace structures (npm workspaces, Go workspaces, Elixir umbrella apps) and list workspace members
- Agent's Discretion on depth of per-workspace language/tool detection

### Framework detection
- Agent's Discretion — agent determines the right granularity for detecting major frameworks (Ash, Phoenix, Ecto, chi, sqlc) from dependency manifests

### Test framework detection
- Detect test runner, config file, and test directory conventions from project manifests and config files

### Code quality tools detection
- Detect linters and formatters (credo, dialyzer, golangci-lint, eslint, prettier) from their config files

### CI/CD detection
- Detect CI platform and key workflows from config files (GitHub Actions, GitLab CI, etc.)

### MCP server detection
- Detect configured MCP servers from .mcp.json and other MCP config files

### Manifest output shape
- Agent's Discretion on JSON structure (categorized sections vs flat with type field)
- Detection sources tracked as arrays: `"sources": ["mix.exs", "mise.toml"]` when detected from multiple files
- No confidence indicators — binary detected/not-detected
- Agent's Discretion on scan metadata (timestamp, duration, etc.)

### Committed vs gitignored split
- Two files: a committed "project profile" for non-machine-specific structure (languages used, project structure) and a gitignored `env-manifest.json` for machine-specific versions/paths
- Agent's Discretion on committed profile filename and location

### Staleness & re-scan triggers
- Staleness detected from both git changes AND filesystem timestamps — either triggers rescan
- Notify then rescan: print "Environment changed, rescanning..." when stale manifest detected during init
- Agent's Discretion on which files to watch for staleness (core manifests vs all scanned files)

### Agent injection format
- `init progress` and `init execute` commands include environment info; `init phase-op` does not
- `env scan` command: silent by default, `--raw` flag dumps JSON for scripting
- Auto-trigger scan on first init command if no manifest exists — seamless first-run experience
- Agent's Discretion on compact vs verbose injection format

### Agent's Discretion
- Primary language determination approach
- JSON manifest structure (categorized vs flat)
- Workspace detection depth (per-member scanning)
- Framework detection granularity
- Scan metadata inclusion
- Committed profile filename/location
- Staleness watch file scope
- Injection format verbosity (compact line vs sections)

</decisions>

<specifics>
## Specific Ideas

- Event-pipeline is the reference polyglot project: Elixir + Go + Node tooling — scanner must handle this correctly
- Two-tier scan: file existence checks must be <10ms, binary version checks run lazily/in background
- Binary versions cached for 24h since they rarely change between sessions
- Well-known scripts pattern: don't capture every npm script, just the ones agents would actually use (test, build, lint, start, deploy, format, check)
- "Just note the service" for docker-compose — don't try to parse POSTGRES_USER from environment variables
- Committed project profile enables team members to understand project structure without running a scan

</specifics>

<deferred>
## Deferred Ideas

- MCP Profiling deep-dive (server capabilities, tool inventories) — Phase 19
- Nomad/Consul/Vault orchestration detection — future phase if needed
- IDE/editor config awareness — determined not relevant for agent behavior

</deferred>

---

*Phase: 18-environment-awareness*
*Context gathered: 2026-02-25*
