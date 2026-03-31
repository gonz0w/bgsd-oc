---
phase: quick-6
plan: 01
type: execute
wave: 1
depends_on: []
files_modified: []
autonomous: true
must_haves:
  truths:
    - "Comprehensive audit report exists identifying all deviations from OpenCode plugin best practices"
    - "Each finding has severity (critical/warning/info) and actionable recommendation"
    - "Report covers all 5 plugin surface areas: commands, agents, config, deployment, and plugin API"
  artifacts:
    - path: ".planning/quick/6-review-plugin-and-ensure-it-follows-best/6-REVIEW.md"
      provides: "Complete best practices audit report"
      min_lines: 100
  key_links: []
---

<objective>
Audit the bGSD plugin against OpenCode's official plugin best practices and produce a comprehensive review report with prioritized findings and actionable recommendations.

Purpose: Identify gaps between the current bGSD implementation and OpenCode's evolving plugin ecosystem standards, so the user can prioritize improvements for better compatibility, discoverability, and maintainability.

Output: A structured review document at `.planning/quick/6-review-plugin-and-ensure-it-follows-best/6-REVIEW.md`
</objective>

<context>
@AGENTS.md
@README.md
@package.json
@deploy.sh
@build.js
@.planning/memory/lessons.json
</context>

<tasks>

<task type="auto">
  <name>Task 1: Audit plugin structure against OpenCode best practices</name>
  <files></files>
  <action>
Perform a comprehensive audit of the bGSD plugin across 5 areas, comparing current implementation against OpenCode's official plugin conventions. For each area, document: current state, best practice, gap severity, and recommendation.

**Area 1: Command Format (commands/*.md)**
- Check all 40 command files for consistent frontmatter structure
- OpenCode commands support: `description`, `agent`, `model`, `mode` in frontmatter
- Verify `description` field exists on every command (required by OpenCode)
- Check if any commands could benefit from `agent` or `model` frontmatter to specify which agent/model should handle them
- Check for `$ARGUMENTS` usage consistency (how user args are passed through)
- Check `@__OPENCODE_CONFIG__` placeholder usage in execution_context paths
- Flag any inconsistencies in command structure patterns

**Area 2: Agent Format (agents/*.md)**
- Check all 9 agent files for consistent frontmatter structure
- OpenCode agents support: `description`, `mode`, `model`, `temperature`, `tools`, `color` in frontmatter
- Verify `mode: subagent` is set on all agents (required for subagent spawning)
- Check tool grants — are all declared tools actually used? Are any missing?
- Verify `description` fields are descriptive enough for agent selection
- Check if agents properly declare `model` preferences or rely on profile system
- Flag any deviations from OpenCode's agent markdown spec

**Area 3: Configuration & opencode.json**
- The project has NO `opencode.json` — assess whether one should exist
- Review deploy.sh target paths: `~/.config/opencode/get-shit-done/`, `~/.config/opencode/commands/`, `~/.config/opencode/agents/`
- OpenCode uses `.opencode/` (per-project) and `~/.config/opencode/` (global) with plural subdirectories: `agents/`, `commands/`, `modes/`, `plugins/`, `skills/`, `tools/`, `themes/`
- Check if the deployment aligns with OpenCode's expected directory structure
- Assess the `__OPENCODE_CONFIG__` placeholder substitution pattern — is this still the best approach?
- Review the `~/.config/oc` symlink workaround for the Anthropic auth plugin mangling

**Area 4: Plugin API Compatibility**
- OpenCode now has a formal plugin system (`@opencode-ai/plugin`) with hooks, events, and custom tools
- bGSD uses a file-copy deployment model (commands + agents + bin + workflows)
- Assess whether bGSD should/could adopt the plugin API for any functionality
- Available hooks: `tool.execute.before`, `tool.execute.after`, `session.created`, `session.idle`, `command.executed`, `file.edited`, etc.
- Could any bGSD behavior benefit from hook-based integration (e.g., session tracking, auto-context injection)?
- Assess feasibility vs. current architecture — bGSD's CLI tool model may be fundamentally different from plugin hooks

**Area 5: Deployment & Distribution**
- Current: `deploy.sh` copies files, substitutes paths, runs smoke test, manifest-based sync with stale file removal
- OpenCode supports: npm plugin installation (`"plugin": ["package-name"]`), local plugin loading (`"plugin": ["./local-plugin.ts"]`), and manual file placement
- Assess whether publishing to npm would be beneficial
- Review the backup/rollback mechanism in deploy.sh
- Check if the manifest-based deployment is robust
- Flag any deployment anti-patterns

For each finding, assign severity:
- **Critical**: Breaks OpenCode compatibility or causes runtime issues
- **Warning**: Deviates from best practice but functional
- **Info**: Improvement opportunity, not a gap

Also note what bGSD does WELL — patterns that exceed typical OpenCode plugins.
  </action>
  <verify>
Review report exists at `.planning/quick/6-review-plugin-and-ensure-it-follows-best/6-REVIEW.md` with:
- All 5 audit areas covered
- Each finding has severity, current state, best practice, and recommendation
- Executive summary with critical/warning/info counts
- Strengths section noting what bGSD does well
- Prioritized action items at the end
  </verify>
  <done>
A comprehensive, actionable review report exists covering commands, agents, configuration, plugin API, and deployment — with severity-rated findings, strengths, and prioritized recommendations for alignment with OpenCode best practices.
  </done>
</task>

</tasks>

<verification>
- Review report is well-structured with clear sections per audit area
- Findings are specific (not vague) with file paths and line references where relevant
- Recommendations are actionable (not just "fix this" but "change X in Y file to Z")
- Severity ratings are reasonable and consistent
</verification>

<success_criteria>
- Complete audit report at `.planning/quick/6-review-plugin-and-ensure-it-follows-best/6-REVIEW.md`
- All 5 plugin surface areas audited
- Minimum 10 findings across all areas
- Each finding has severity + recommendation
- Executive summary with counts and top-priority items
</success_criteria>

<output>
After completion, create `.planning/quick/6-review-plugin-and-ensure-it-follows-best/6-SUMMARY.md`
</output>
