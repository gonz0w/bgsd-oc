# bGSD Plugin — Development Workspace

## CRITICAL: Working Directory
**This project lives at the current working directory (`$PWD`) — ALWAYS.**
Use `pwd` or the environment's working directory. Never hardcode or guess the path.

## What This Is
Development workspace for the Better Getting Stuff Done (bGSD) planning plugin (v7.0).
The production install lives at `~/.config/OC/get-shit-done/` (where OC = the host editor's config dir).

## Project Structure
```
bin/gsd-tools.cjs          # Main CLI tool (single file, zero dependencies)
src/                       # Source modules (built into bin/gsd-tools.cjs)
commands/*.md              # Slash command wrappers (deployed to host editor)
workflows/*.md             # Workflow definitions (invoked by commands)
templates/*.md             # Document templates (PLAN.md, STATE.md, etc.)
references/*.md            # Reference docs loaded by agents
deploy.sh                  # Deploy changes to host editor config
build.js                   # Build script — bundles src/ into bin/gsd-tools.cjs
```

## Key Commands
```bash
node bin/gsd-tools.cjs <command> [args]   # Test locally
npm run build                              # Build from source
npm test                                   # Full test suite (669+ tests)
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
- Commands (`commands/`) are thin wrappers deployed to the host editor's `command/` dir
- Agents are subagent definitions with system prompts in the editor's `agents/` dir
- Hooks are JS scripts for statusline and update checks in the editor's `hooks/` dir

## Testing
```bash
npm test          # Full test suite (669+ tests)
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

## IMPORTANT: String Replacement Warning
The Anthropic auth plugin rewrites ALL system prompt text, replacing the host editor
name with "Claude Code" and its lowercase form with "Claude". This means any file path,
project name, or config path containing the editor name will be silently mangled.
Never use the literal editor name in instruction files. Use generic terms like
"host editor", `$PWD`, or the abbreviation `OC` instead. See `lessons.md` for details.
