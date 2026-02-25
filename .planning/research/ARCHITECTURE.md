# Architecture Research: v4.0 Environment & Execution Intelligence

**Researched:** 2026-02-25
**Focus:** Integration patterns with existing gsd-tools.cjs architecture

## Summary

All four features integrate as new command families in gsd-tools.cjs with minimal changes to existing modules. Environment awareness and MCP profiling are read-only analysis commands. Structured requirements extends existing markdown parsing. Worktree parallelism adds a new orchestration layer on top of the existing wave system.

## Existing Architecture (16 modules, 12,729 lines)

```
src/
├── commands/        # 8 command modules
│   ├── init.js      # Init commands (progress, execute, etc.)
│   ├── intent.js    # Intent CRUD
│   ├── memory.js    # Cross-session memory
│   ├── milestone.js # Milestone management
│   ├── plan.js      # Plan analysis
│   ├── roadmap.js   # Roadmap operations
│   ├── state.js     # State mutations
│   └── verify.js    # Verification commands
├── lib/             # 7 library modules
│   ├── cache.js     # In-memory file cache
│   ├── config.js    # Config management
│   ├── git.js       # Git operations
│   ├── markdown.js  # Markdown parsing (309+ regex patterns)
│   ├── tokens.js    # Token estimation (tokenx)
│   ├── utils.js     # Utilities
│   └── validation.js # State validation
├── router.js        # Command routing
└── index.js         # Entry point
```

## New Command Modules

| Module | Commands | Depends On |
|--------|----------|------------|
| `src/commands/env.js` | `env scan`, `env show`, `env check-binary` | `lib/config.js`, `lib/cache.js` |
| `src/commands/mcp.js` | `mcp-profile`, `mcp-recommend`, `mcp-disable`, `mcp-restore` | `lib/config.js`, `lib/tokens.js` |
| `src/commands/worktree.js` | `worktree create`, `worktree list`, `worktree merge`, `worktree cleanup` | `lib/git.js`, `lib/config.js` |

## Modified Existing Modules

| Module | Changes |
|--------|---------|
| `src/router.js` | Add `env`, `mcp-profile`, `worktree` case routes |
| `src/commands/init.js` | Inject env manifest summary into init output |
| `src/lib/markdown.js` | Parse structured acceptance criteria in requirements |
| `src/commands/verify.js` | Check assertions from REQUIREMENTS.md during verification |
| `src/lib/config.js` | Add worktree config section to CONFIG_SCHEMA |

## Data Flow

```
Environment Detection:
  fs.existsSync(patterns) → language/PM detection
  execSync('which tool') → binary availability
  → env-manifest.json → init command output → agent context

MCP Profiling:
  .mcp.json + opencode.json → server list
  × mcp-servers.json lookup → token estimates
  × project file scan → relevance scores
  → recommendations → optional auto-disable

Structured Requirements:
  REQUIREMENTS.md (with assertions) → markdown parser
  → must_haves in plan frontmatter → verification checks

Worktree Orchestration:
  Wave analysis (existing) → worktree create per plan
  → agent spawn (tmux) → monitor → git merge-tree check
  → sequential merge → test → cleanup → next wave
```

## Build Order

1. **Environment Awareness** — Independent, no deps on other features
2. **MCP Profiling** — Independent, can use env detection for project-type context
3. **Structured Requirements** — Independent, template/parser changes
4. **Worktree Parallelism** — Benefits from env awareness for setup hooks
5. **Complete-and-Clear** — Independent, small scope

Phases 1-3 can potentially parallelize. Phase 4 is the most complex.

## Bundle Size Impact

| Feature | Estimated Size | Notes |
|---------|---------------|-------|
| env.js | ~8KB | Detection logic + patterns |
| mcp.js | ~6KB | Profiling + server database |
| worktree.js | ~10KB | CRUD + orchestration |
| Template changes | ~2KB | Markdown templates |
| Data files | ~4KB | mcp-servers.json + env-patterns.json |
| **Total** | **~30KB** | 447KB → ~477KB |

Raise bundle budget from 450KB to 500KB for v4.0.
