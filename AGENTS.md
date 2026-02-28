# bGSD Plugin for OpenCode — Development Workspace

## What This Is
Development workspace for the Get Stuff Done (bGSD) planning plugin for OpenCode (v6.0).
The production install lives at `~/.config/opencode/get-shit-done/`.

## Project Structure
```
bin/gsd-tools.cjs          # Main CLI tool (single file, zero dependencies)
src/                       # Source modules (built into bin/gsd-tools.cjs)
commands/*.md              # Slash command wrappers (deployed to OpenCode)
workflows/*.md             # Workflow definitions (invoked by commands)
templates/*.md             # Document templates (PLAN.md, STATE.md, etc.)
references/*.md            # Reference docs loaded by agents
deploy.sh                  # Deploy changes to ~/.config/opencode/
build.js                   # Build script — bundles src/ into bin/gsd-tools.cjs
```

## Key Commands
```bash
node bin/gsd-tools.cjs <command> [args]   # Test locally
npm run build                              # Build from source
npm test                                   # Full test suite (574+ tests)
./deploy.sh                                # Deploy to live config
```

## Development Rules
1. **Test against current project**: Always test against the current working directory's `.planning/`
2. **Backward compatible**: All regex/parser changes must accept both old and new formats
3. **No breaking changes**: Existing ROADMAP.md, STATE.md, PLAN.md files must keep working
4. **Single-file CLI**: `gsd-tools.cjs` stays as one file (Node.js, zero dependencies)
5. **Path-agnostic**: Use config paths from environment, not hardcoded paths

## Architecture
- `gsd-tools.cjs` is the brain — all parsing, analysis, git operations, validation
- Workflows (`.md` files) are prompts that agents follow, calling gsd-tools.cjs for data
- Commands (`commands/`) are thin wrappers deployed to `~/.config/opencode/command/`
- Agents (`~/.config/opencode/agents/`) are subagent definitions with system prompts
- Hooks (`~/.config/opencode/hooks/`) are JS scripts for statusline and update checks

## Testing
```bash
npm test          # Full test suite (574+ tests)
npm run build     # Build validation
```

## Slash Commands
11 commands available in `commands/`:
- `/gsd-velocity` — Execution velocity metrics and completion forecast
- `/gsd-codebase-impact` — Module dependencies and blast radius analysis
- `/gsd-context-budget` — Token usage estimation for plan files
- `/gsd-rollback-info` — Commits and revert command for a plan
- `/gsd-search-decisions` — Search past decisions across STATE.md and archives
- `/gsd-search-lessons` — Search completed phase lessons for patterns
- `/gsd-session-diff` — Git commits since last session activity
- `/gsd-test-run` — Parse test output with pass/fail gating
- `/gsd-trace-requirement` — Trace requirement from spec to files on disk
- `/gsd-validate-config` — Schema validation for config.json
- `/gsd-validate-deps` — Phase dependency graph validation
