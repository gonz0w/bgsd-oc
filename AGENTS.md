# bGSD Plugin — Development Workspace

## What This Is
Development workspace for the Better Getting Stuff Done (bGSD) planning plugin (v8.0).
The production install lives at `~/.config/OC/bgsd-oc/` (where OC = the host editor's config dir).

## Project Structure
```
bin/bgsd-tools.cjs          # Main CLI tool (single file, zero dependencies)
src/                       # Source modules (built into bin/bgsd-tools.cjs)
commands/*.md              # Slash command wrappers (deployed to host editor)
workflows/*.md             # Workflow definitions (invoked by commands)
templates/*.md             # Document templates (PLAN.md, STATE.md, etc.)
references/*.md            # Reference docs loaded by agents
plugin.js                  # OpenCode plugin (session, env, compaction hooks)
install.js                 # npx installer (mirrors deploy.sh for end users)
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

## Slash Commands
41 commands available in `commands/`:

**Project Lifecycle:**
- `/bgsd-new-project` — Initialize a new project with planning structure
- `/bgsd-new-milestone` — Start a new milestone
- `/bgsd-complete-milestone` — Complete current milestone and archive
- `/bgsd-progress` — Show project progress and status
- `/bgsd-resume-work` — Resume work on an existing project
- `/bgsd-pause-work` — Pause current work session

**Planning:**
- `/bgsd-discuss-phase` — Discuss and scope a phase before planning
- `/bgsd-plan-phase` — Create execution plans for a phase
- `/bgsd-research-phase` — Research phase requirements
- `/bgsd-execute-phase` — Execute plans in a phase
- `/bgsd-add-phase` — Add a new phase to the roadmap
- `/bgsd-insert-phase` — Insert a phase at a specific position
- `/bgsd-remove-phase` — Remove a phase from the roadmap
- `/bgsd-plan-milestone-gaps` — Plan gap closure from verification
- `/bgsd-list-phase-assumptions` — List assumptions for a phase

**Execution & Verification:**
- `/bgsd-verify-work` — Verify completed work against criteria
- `/bgsd-audit-milestone` — Audit milestone completion
- `/bgsd-check-todos` — Check and manage todo items
- `/bgsd-add-todo` — Add a todo item
- `/bgsd-quick` — Quick task execution
- `/bgsd-github-ci` — Push, create PR, run code scanning, fix loop, and auto-merge

**Analysis & Diagnostics:**
- `/bgsd-velocity` — Execution velocity metrics and forecast
- `/bgsd-codebase-impact` — Module dependencies and blast radius
- `/bgsd-context-budget` — Token usage estimation for plans
- `/bgsd-map-codebase` — Map codebase structure
- `/bgsd-health` — Project health check
- `/bgsd-debug` — Debug planning issues

**Search & History:**
- `/bgsd-search-decisions` — Search past decisions
- `/bgsd-search-lessons` — Search completed phase lessons
- `/bgsd-session-diff` — Git commits since last session
- `/bgsd-rollback-info` — Commits and revert command for a plan
- `/bgsd-trace-requirement` — Trace requirement from spec to files

**Configuration & Maintenance:**
- `/bgsd-settings` — View/edit settings
- `/bgsd-set-profile` — Set user profile
- `/bgsd-validate-config` — Schema validation for config.json
- `/bgsd-validate-deps` — Phase dependency graph validation
- `/bgsd-test-run` — Parse test output with pass/fail gating
- `/bgsd-update` — Check for and apply updates
- `/bgsd-reapply-patches` — Reapply editor patches
- `/bgsd-cleanup` — Clean up stale planning artifacts
- `/bgsd-help` — Show help and available commands
## IMPORTANT: String Replacement Warning
The Anthropic auth plugin rewrites ALL system prompt text, replacing the host editor
name with "Claude Code" and its lowercase form with "Claude". This means any file path,
project name, or config path containing the editor name will be silently mangled.
Never use the literal editor name in instruction files. Use generic terms like
"host editor", `$PWD`, or the abbreviation `OC` instead. See `lessons.md` for details.
