# Stack Research: v4.0 Environment & Execution Intelligence

**Researched:** 2026-02-25
**Focus:** Stack additions needed for environment detection, MCP profiling, worktree orchestration

## Summary

No new runtime dependencies required. All features implementable with Node.js standard library (`child_process.execSync`, `fs`, `path`). Git worktree commands via `execSync`. MCP config parsing via existing JSON parser.

## Stack Additions Needed

### Environment Detection
- **No new deps.** File existence checks via `fs.existsSync()` (~0.1ms each). Binary detection via `execSync('which <tool>')` (~5-10ms). Version capture via `execSync('<tool> --version')` (~50-200ms, timeout 3s).
- **Detection patterns from:** devcontainers (devcontainer.json features), mise/asdf (.tool-versions, mise.toml), GitHub Linguist (file-to-language mapping), npm detect-package-manager (lockfile precedence).
- **15+ manifest file patterns:** package.json, tsconfig.json, go.mod, mix.exs, Cargo.toml, pyproject.toml, Gemfile, pom.xml, build.gradle, composer.json, deno.json, pubspec.yaml, Package.swift, *.csproj, CMakeLists.txt.

### MCP Profiling
- **No new deps.** Config parsing: JSON.parse on .mcp.json / opencode.json. Token estimation: static lookup table (no server connections needed).
- **Known server token costs** (from community benchmarks): GitHub ~46K (91 tools), Docker ~126K (135 tools), Postgres ~15-20K (30-40 tools), Terraform ~6.4K (7 tools), Brave ~500-1K (2 tools).
- **Average per tool:** 100-300 tokens depending on inputSchema complexity.

### Worktree Orchestration
- **No new deps.** Git worktree commands via `execSync`: `git worktree add/list/remove`. Conflict detection via `git merge-tree` (Git 2.38+, released 2022). Agent spawning via tmux commands.
- **Requirement:** Git 2.38+ for `git merge-tree --write-tree` dry-run support.

### Structured Requirements
- **No new deps.** Template changes only. Markdown parsing via existing regex patterns in gsd-tools.cjs.

## Integration Points

| Feature | Existing Module | Integration |
|---------|----------------|-------------|
| Env detection | `src/commands/init.js` | New `env scan` command, inject into init output |
| MCP profiling | `src/lib/config.js` | New `mcp-profile` command, read existing config paths |
| Structured reqs | `src/lib/markdown.js` | Extended requirement parser for acceptance criteria |
| Worktrees | `src/commands/verify.js` | New `worktree` command family, extend wave execution |

## What NOT to Add

- **tree-sitter** — Heavy native dependency for code parsing. Ripgrep + regex sufficient.
- **SQLite** — Persistent index overkill. JSON manifest + file cache sufficient.
- **MCP SDK** — No need to connect to servers. Static analysis of configs is enough.
- **tmux library** — Shell out to tmux directly. No wrapper needed.
