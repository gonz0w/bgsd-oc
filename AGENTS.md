# bGSD Plugin — Development Workspace

## What This Is
Development workspace for the Better Getting Stuff Done (bGSD) planning plugin.

## Project Structure
```
bin/bgsd-tools.cjs         # Main CLI tool 
src/                       # Source modules (built into bin/bgsd-tools.cjs)
commands/*.md              # Slash command wrappers (deployed to host editor)
workflows/*.md             # Workflow definitions (invoked by commands)
templates/*.md             # Document templates (PLAN.md, STATE.md, etc.)
references/*.md            # Reference docs loaded by agents
plugin.js                  # OpenCode plugin (session, env, compaction hooks)
install.js                 # installer (mirrors deploy.sh for end users)
deploy.sh                  # Deploy changes to host editor config (dev workflow)
build.cjs                  # Build script — bundles src/ into bin/bgsd-tools.cjs
```

## Key Commands
```bash
node bin/bgsd-tools.cjs <command> [args]   # Test locally
npm run build                              # Build from source
npm test                                   # Full test suite (762+ tests)
./deploy.sh                                # Deploy to live config
```

## Development Rules
1. **Test against current project**: Always test against the current working directory's `.planning/`
2. **Backward compatible**: All regex/parser changes must accept both old and new formats
3. **No breaking changes**: Existing ROADMAP.md, STATE.md, PLAN.md files must keep working
4. **Single-file CLI**: `bgsd-tools.cjs` stays as one file (Node.js, zero dependencies)
5. **Path-agnostic**: Use config paths from environment, not hardcoded paths

## Architecture
- `bgsd-tools.cjs` is the brain — all parsing, analysis, git operations, validation
- Workflows (`.md` files) are prompts that agents follow, calling bgsd-tools.cjs for data
- Commands (`commands/`) are thin wrappers deployed to the host editor's `command/` dir
- Agents are subagent definitions with system prompts in the editor's `agents/` dir
- Hooks are JS scripts for statusline and update checks in the editor's `hooks/` dir

## Testing
```bash
npm test          # Full test suite (762+ tests)
npm run build     # Build validation
```
