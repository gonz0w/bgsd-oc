# Command Routing Research Summary

## Problem Statement
User pain point: "when i typed /bgsd milestone new, it was a struggle to get to the workflow command. i need everything to know what is asked and execute it immediately. no hunting and pecking. if i want a new milestone with that command, it should happen."

## Current Architecture

### CLI Layer (router.js)
- Uses namespace:command syntax: `init:new-milestone`, `plan:phase`, etc.
- Parses command and routes to appropriate handler
- 7 namespaces: init, plan, execute, verify, util, research, cache

### Plugin Layer (plugin.js)
- Enriches commands with project context before execution
- Provides `<bgsd-context>` injection for workflows
- Handles slash command routing via `command.execute.before` hook

### Command Wrappers (commands/*.md)
- Thin wrappers that route to workflows
- e.g., `bgsd-milestone.md` routes to `new-milestone` or `complete-milestone` workflows

### Workflows (workflows/*.md)
- Markdown files containing the actual process steps
- Called by the plugin after context enrichment

## Friction Points

1. **Multi-step routing**: `/bgsd milestone new` → wrapper → workflow → CLI command
2. **Command parsing**: Plugin must understand user intent and route correctly
3. **Context injection**: Multiple layers of context enrichment
4. **Workflow selection**: Determining which workflow to invoke based on subcommand

## Target State (v11.1)
- `/bgsd {cmd} {sub}` executes immediately without clarification prompts
- Zero friction - commands understand user intent directly
- All 41 slash commands execute their intended workflow without routing errors

## Approaches to Consider

1. **Direct routing**: Simplify the wrapper → workflow → CLI chain
2. **Intent recognition**: Better NLP/pattern matching for command understanding
3. **Smarter defaults**: Auto-detect most likely workflow based on context
4. **Command aliasing**: Shortcuts for common command patterns
