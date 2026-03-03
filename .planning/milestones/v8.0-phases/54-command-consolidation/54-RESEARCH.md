# Phase 54: Command Consolidation - Research

**Researched:** 2026-03-02
**Domain:** CLI command architecture, namespace organization
**Confidence:** HIGH

## Summary

Phase 54 focuses on reorganizing the flat command structure in `gsd-tools.cjs` into logical namespaces. The current router.js has ~70+ top-level commands (from `case 'state'` to `case 'trajectory'`) that need grouping. The key technical challenge is:

1. **Router migration**: Converting flat `case` statements to nested namespace handlers
2. **Reference updates**: Updating all command invocations in workflows, tests, and agent prompts
3. **Help system migration**: Updating COMMAND_HELP constants
4. **No backward compatibility**: Old names are removed entirely

**Primary recommendation:** Implement namespace routing in router.js first, then systematically update all references. The namespace structure is already defined in CONTEXT.md.

## User Constraints (from CONTEXT.md)

### Locked Decisions
- **Namespace Structure**: `lifecycle:command` (e.g., `init:new`, `plan:intent create`)
- **Grouping**: Init, Plan, Execute, Verify, Utility
- **Naming**: kebab-case for all commands (e.g., `session-summary`, `intent-create`)
- **Prefix**: No `gsd-` prefix (unbranding)
- **Backward Compatibility**: Remove entirely — immediate breakage, no aliases
- **Help command**: `/bgsd-help` (prefixed to avoid conflict with OpenCode's `/help`)
- **Internal Commands**: Hidden from user UI (generate-slug, current-timestamp, summary-extract, history-digest, extract-sections, template, test-coverage, quick-summary, config-migrate, mcp, mcp-profile, env, resolve-model, classify, websearch, codebase-* commands, validate-config, frontmatter, progress)

### Agent's Discretion
- Exact implementation of namespace routing in router.js
- Help output grouping format

### Deferred Ideas (OUT OF SCOPE)
None

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| CMD-01 | Orphan commands grouped under namespaced parents (~15-20 commands relocated) | Router.js needs nested case structure; command files remain in src/commands/ |
| CMD-02 | All references (tests, workflows, agent prompts) updated to new command names | Tests use runGsdTools('command-name'), workflows reference gsd-tools.cjs commands, agent prompts via workflows |
| CMD-03 | Milestone wrapup workflow generates documentation artifact automatically | Requires workflow update, not CLI change |

## Current State

### Command Inventory (from router.js lines 112, 131-986)
Current flat commands (~70 total):
- **State/Planning**: state, roadmap, phase, phases, find-phase, milestone, intent, requirements
- **Execution**: commit, verify, session-diff, session-summary, velocity, worktree, tdd, test-run, profile
- **Verification**: verify-summary, verify-path-exists, validate, validate-dependencies, validate-config, assertions, review, context-budget, token-budget
- **Config/Utility**: config-get, config-set, config-ensure-section, config-migrate, env, mcp, mcp-profile, frontmatter
- **Data**: template, summary-extract, extract-sections, test-coverage, quick-summary
- **Search/Analysis**: search-decisions, search-lessons, rollback-info, trace-requirement, codebase, codebase-impact
- **Other**: init, scaffold, generate-slug, current-timestamp, list-todos, todo, memory, progress, websearch, classify, resolve-model, state-snapshot, phase-plan-index, agent, git, trajectory, cache

### Reference Locations
| Location | Count | Examples |
|----------|-------|----------|
| workflows/*.md | ~60 | new-milestone.md, execute-phase.md, cmd-*.md |
| src/lib/constants.js | 1 | COMMAND_HELP object |
| bin/gsd-tools.test.cjs | ~1000+ | runGsdTools('command-name', ...) |
| commands/*.md | 40 | gsd-*.md files in commands/ |

## Implementation Approach

### Architecture: Namespace Router Pattern
```javascript
// Current: flat case
switch (command) {
  case 'intent': { ... }
  case 'commit': { ... }
}

// New: namespace + command
const [namespace, ...cmdParts] = command.split(':');
const cmd = cmdParts.join(' '); // "intent create" -> cmd="intent create"

switch (namespace) {
  case 'init':
    switch (cmd) { case 'new': ..., case 'scaffold': ... }
    break;
  case 'plan':
    switch (cmd) { case 'intent': ..., case 'requirements': ... }
    break;
  case 'execute':
    switch (cmd) { case 'commit': ..., case 'tdd': ... }
    break;
  case 'verify':
    switch (cmd) { case 'state': ..., case 'phase': ... }
    break;
  case 'util':
    // internal commands
    break;
  default:
    // backward compat or error
}
```

### Namespace Mapping
| Namespace | Commands |
|-----------|----------|
| init | init, scaffold, generate-slug |
| plan | intent, requirements, roadmap, phases, find-phase, milestone |
| execute | commit, rollback-info, session-diff, session-summary, velocity, worktree, tdd, test-run, profile |
| verify | state, verify, assertions, search-decisions, search-lessons, review, context-budget, token-budget |
| util | config-get, config-set, env, current-timestamp, list-todos, todo, memory, mcp, classify, frontmatter, progress, websearch, history-digest, trace-requirement, codebase |

### Internal Commands (hidden from help)
- generate-slug, current-timestamp, summary-extract, history-digest, extract-sections, template, test-coverage, quick-summary, config-migrate, mcp, mcp-profile, env, resolve-model, classify, websearch, codebase-* commands, validate-config, frontmatter, progress

### Key Implementation Steps
1. **Router.js**: Add namespace parsing before switch, restructure case statements
2. **COMMAND_HELP**: Update keys from 'intent' to 'plan:intent' etc.
3. **Error messages**: Update command list in router.js line 112
4. **Test file**: Update all runGsdTools('old-name') to runGsdTools('namespace:new-name')
5. **Workflows**: Update gsd-tools.cjs invocations (most use __OPENCODE_CONFIG__ path)
6. **Agent prompts**: Via workflow updates
7. **Deploy**: Update commands/ directory filenames (gsd-*.md → bgsd-*.md)

## Common Pitfalls

### Pitfall 1: Missing Reference Updates
**What goes wrong:** Commands renamed but tests/workflows still use old names → silent failures
**How to avoid:** Comprehensive grep for old command names before and after changes
**Warning signs:** Tests pass but workflows fail

### Pitfall 2: Help System Breakage
**What goes wrong:** COMMAND_HELP keys not updated → --help returns nothing
**How to avoid:** Update all help keys to namespace:command format
**Warning signs:** gsd-tools --help shows empty help text

### Pitfall 3: Compound Commands
**What goes wrong:** Commands like "intent create" need to become "plan:intent create"
**How to avoid:** Test compound commands explicitly
**Warning signs:** "intent create" works but "plan:intent create" fails

## Code Examples

### Test Migration Pattern
```javascript
// Before (bin/gsd-tools.test.cjs)
const result = runGsdTools('intent create', tmpDir);
const result = runGsdTools('state get phase', tmpDir);

// After
const result = runGsdTools('plan:intent create', tmpDir);
const result = runGsdTools('verify:state get phase', tmpDir);
```

### Workflow Migration Pattern
```yaml
# Before
node __OPENCODE_CONFIG__/get-shit-done/bin/gsd-tools.cjs intent show

# After  
node __OPENCODE_CONFIG__/get-shit-done/bin/gsd-tools.cjs plan:intent show
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Flat commands | Namespace:command | Phase 54 | Better organization, zero orphans |
| gsd- prefix | No prefix | Phase 54 | Unbranding from OpenCode |
| --help | /bgsd-help | Phase 54 | Avoid conflict with host editor |

## Open Questions

1. **Compound command syntax**: Should "plan:intent create" use space or colon?
   - Context says `lifecycle:command` (e.g., `plan:intent create`) - uses space after first colon
   - Recommendation: Support both "plan:intent create" and "plan:intent:create" for flexibility

2. **How to handle subcommands with spaces?**
   - Example: "state get phase" becomes "verify:state get phase" or "verify:state:get:phase"?
   - Recommendation: Split on first colon only, preserve rest as args

## Sources

### Primary (HIGH confidence)
- router.js (lines 131-986) - current command structure
- src/lib/constants.js (COMMAND_HELP) - help system
- bin/gsd-tools.test.cjs - test patterns
- workflows/*.md - reference patterns

### Secondary (MEDIUM confidence)
- AGENTS.md - command count (11 slash commands)

## Metadata

**Confidence breakdown:**
- Standard stack: N/A - pure JavaScript/Node.js routing change
- Architecture: HIGH - clear namespace pattern from CONTEXT.md
- Pitfalls: HIGH - common refactoring issues well understood

**Research date:** 2026-03-02
**Valid until:** Phase completion (stable once implemented)
