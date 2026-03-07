---
phase: quick-7
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - AGENTS.md
  - README.md
  - docs/commands.md
  - deploy.sh
  - build.js
  - commands/bgsd-plan-phase.md
  - commands/bgsd-reapply-patches.md
  - commands/bgsd-debug.md
  - commands/bgsd-research-phase.md
  - agents/gsd-debugger.md
  - agents/gsd-phase-researcher.md
  - agents/gsd-project-researcher.md
autonomous: true
requirements: [AUDIT-CRITICAL, AUDIT-WARNING]

must_haves:
  truths:
    - "Every command referenced in docs has a corresponding file (no ghosts)"
    - "deploy.sh deploys to the correct plural commands/ directory"
    - "All command files follow consistent structure patterns"
    - "Agent tool grants use correct OpenCode tool names"
    - "Only runtime-needed files are in the deploy manifest"
  artifacts:
    - path: "AGENTS.md"
      provides: "Accurate 40-command listing without join-discord"
      contains: "40 commands"
    - path: "README.md"
      provides: "Accurate command count and listing"
      contains: "40 slash commands"
    - path: "deploy.sh"
      provides: "Correct plural commands/ directory"
      contains: "commands"
    - path: "build.js"
      provides: "Manifest without src/ files"
  key_links:
    - from: "AGENTS.md"
      to: "commands/"
      via: "listed commands match actual files"
      pattern: "40 commands"
    - from: "deploy.sh"
      to: "~/.config/opencode/commands/"
      via: "CMD_DIR variable"
      pattern: 'opencode/commands"'
---

<objective>
Address critical and warning findings from the OpenCode best practices audit (6-REVIEW.md).

Purpose: Fix 2 critical issues (ghost command reference, deploy directory naming) and 5 warning-level issues (inconsistent frontmatter, inline process logic, structural inconsistency, tool name, deploy manifest).
Output: Clean, consistent plugin files passing all audit items.
</objective>

<execution_context>
@.planning/quick/6-review-plugin-and-ensure-it-follows-best/6-REVIEW.md
</execution_context>

<context>
@AGENTS.md
@README.md
@deploy.sh
@build.js
</context>

<tasks>

<task type="auto">
  <name>Task 1: Fix critical issues and documentation references</name>
  <files>AGENTS.md, README.md, docs/commands.md, deploy.sh</files>
  <action>
  **Finding 1.1 — Remove ghost bgsd-join-discord references:**

  1. **AGENTS.md line 101:** Remove the line `- /bgsd-join-discord — Join the bGSD Discord community` entirely.
  2. **AGENTS.md line 48:** Change `41 commands available` to `40 commands available`.
  3. **README.md line 176:** Remove the entire table row `| /bgsd-join-discord | Join the GSD Discord community |`. If this leaves the "Todo & Community" section header with only other entries, rename section to just "Todo & Maintenance" or similar. The remaining entries are `/bgsd-add-todo`, `/bgsd-check-todos`, `/bgsd-reapply-patches`.
  4. **README.md line 5:** Change `41 slash commands` to `40 slash commands`.
  5. **README.md line 179:** Change `all 41 commands` to `all 40 commands`.
  6. **docs/commands.md line 7:** Change `## Slash Commands (41)` to `## Slash Commands (40)`.
  7. **docs/commands.md lines 493-501:** Remove the entire `### Community` section and the `/bgsd-join-discord` entry (lines 492-501, including the `---` separator before it).

  **Finding 3.2 — Fix deploy.sh singular command/ directory:**

  8. **deploy.sh line 27:** Change `CMD_DIR="$HOME/.config/opencode/command"` to `CMD_DIR="$HOME/.config/opencode/commands"` (plural).

  **IMPORTANT deploy note:** After this change, the next deploy will create `~/.config/opencode/commands/` as a NEW directory and copy files there. The old `~/.config/opencode/command/` directory will become stale. Add a migration step: After the CMD_DIR line (around line 32, after the backup block), add cleanup logic to migrate from old singular to new plural:

  ```bash
  # Migrate: if old singular command/ exists and new commands/ doesn't yet, rename it
  OLD_CMD_DIR="$HOME/.config/opencode/command"
  if [ -d "$OLD_CMD_DIR" ] && [ "$CMD_DIR" != "$OLD_CMD_DIR" ]; then
    if [ ! -d "$CMD_DIR" ]; then
      mv "$OLD_CMD_DIR" "$CMD_DIR"
      echo "  Migrated command/ → commands/ (OpenCode plural convention)"
    else
      echo "  Note: old command/ dir exists alongside commands/ — clean up manually"
    fi
  fi
  ```

  Insert this block AFTER the backup section (after line 32) and BEFORE Step 3 manifest sync.
  </action>
  <verify>
  - `grep -c "join-discord" AGENTS.md README.md docs/commands.md` returns 0 for each file
  - `grep "40 commands" AGENTS.md` matches
  - `grep "40 slash commands" README.md` matches
  - `grep "Slash Commands (40)" docs/commands.md` matches
  - `grep 'opencode/commands"' deploy.sh` matches the plural form
  - `grep "command/" deploy.sh | grep -v commands | grep -v backup | grep -v OLD_CMD_DIR` returns nothing (no stale singular references except migration logic)
  </verify>
  <done>All ghost bgsd-join-discord references removed from 3 doc files, command counts updated to 40, deploy.sh uses plural commands/ with migration from old singular directory.</done>
</task>

<task type="auto">
  <name>Task 2: Fix warning-level findings in commands, agents, and build</name>
  <files>commands/bgsd-plan-phase.md, commands/bgsd-reapply-patches.md, commands/bgsd-debug.md, commands/bgsd-research-phase.md, agents/gsd-debugger.md, agents/gsd-phase-researcher.md, agents/gsd-project-researcher.md, build.js</files>
  <action>
  **Finding 1.3 — Remove inconsistent agent frontmatter from bgsd-plan-phase.md:**

  Remove `agent: gsd-planner` from the YAML frontmatter of `commands/bgsd-plan-phase.md`. The file is an orchestrator that spawns both gsd-planner and gsd-plan-checker, so it should NOT declare a single agent — consistent with all other orchestrator commands which omit `agent:`.

  Before:
  ```yaml
  ---
  description: Create detailed phase plan (PLAN.md) with verification loop
  agent: gsd-planner
  ---
  ```

  After:
  ```yaml
  ---
  description: Create detailed phase plan (PLAN.md) with verification loop
  ---
  ```

  **Finding 1.7 — Extract inline process logic into workflow references:**

  For `commands/bgsd-debug.md` (currently 157 lines with inline spawn templates):
  - The workflow file `workflows/diagnose-issues.md` already exists (203 lines) — it handles UAT gap diagnosis, NOT the general debug flow. So we need a separate workflow.
  - Keep the command file as a thin wrapper (~30-40 lines):
    - Keep the `<objective>` block (lines 1-11)
    - Add `<execution_context>` block referencing `@__OPENCODE_CONFIG__/get-shit-done/workflows/debug.md`
    - Keep `<context>` block (lines 13-20) for $ARGUMENTS and session check
    - Remove the inline `<process>` section (lines 22-148) and `<success_criteria>` (lines 151-157)
    - Add a minimal `<process>` that says: "Follow the workflow loaded in execution_context."
  - Create `workflows/debug.md` with the extracted process logic (steps 0-5 from the current command file, lines 22-148), plus the success_criteria.

  For `commands/bgsd-research-phase.md` (currently 183 lines):
  - The workflow file `workflows/research-phase.md` already exists (109 lines) with similar content.
  - Keep the command file as a thin wrapper (~30-40 lines):
    - Keep `<objective>` block (lines 1-18)
    - Add `<execution_context>` block referencing `@__OPENCODE_CONFIG__/get-shit-done/workflows/research-phase.md`
    - Keep `<context>` block (lines 20-24) for $ARGUMENTS
    - Remove the inline `<process>` section (lines 26-174) and `<success_criteria>` (lines 177-183)
    - Add a minimal `<process>` that says: "Follow the workflow loaded in execution_context."
  - Update `workflows/research-phase.md` to incorporate the richer spawn templates and continuation logic from the command file (the existing workflow is simpler — merge the command's orchestration detail into it).

  **Finding 1.8 — Standardize bgsd-reapply-patches.md:**

  Change `<purpose>` tag to `<objective>` in `commands/bgsd-reapply-patches.md` (lines 5 and 7):
  - `<purpose>` → `<objective>`
  - `</purpose>` → `</objective>`

  **Finding 2.5 — Verify and fix websearch tool name in agents:**

  The 3 agent files use `websearch: true` in their tools block. OpenCode uses `webfetch` as the tool name (visible in the current runtime — this conversation has `mcp_webfetch` available, not `websearch`). However, `websearch` may be a valid alias in some configurations.

  **Conservative approach:** Since we cannot confirm whether `websearch` resolves correctly in the deployed OpenCode runtime, and the audit flagged it:
  - In `agents/gsd-debugger.md` line 13: Change `websearch: true` to `webfetch: true`
  - In `agents/gsd-phase-researcher.md` line 12: Change `websearch: true` to `webfetch: true`
  - In `agents/gsd-project-researcher.md` line 12: Change `websearch: true` to `webfetch: true`

  Also in the two researcher agents, there are CLI references to `gsd-tools.cjs websearch` (gsd-phase-researcher.md line 139, gsd-project-researcher.md line 118) — these reference the CLI command `websearch` in gsd-tools.cjs which IS correct (it's a CLI subcommand, not an OpenCode tool grant). Leave those CLI references unchanged.

  **Finding 5.5 — Remove src/ from deploy manifest in build.js:**

  In `build.js` around line 219-220, remove the src/ collection:
  ```js
  // src/ — all files
  collectFiles('src', () => true);
  ```

  Verification confirms no deployed workflow, agent, or command file references the bGSD `src/` directory at runtime — all `src/` mentions in agents/workflows are generic examples (like `src/components/Chat.tsx`). Only `bin/gsd-tools.cjs` (the bundled artifact) is needed at runtime.
  </action>
  <verify>
  - `grep "agent:" commands/bgsd-plan-phase.md` returns nothing (frontmatter agent removed)
  - `wc -l commands/bgsd-debug.md` is ~30-40 lines (thin wrapper)
  - `wc -l commands/bgsd-research-phase.md` is ~30-40 lines (thin wrapper)
  - `test -f workflows/debug.md` confirms new workflow exists
  - `grep "<objective>" commands/bgsd-reapply-patches.md` matches (no more `<purpose>`)
  - `grep "websearch" agents/gsd-debugger.md agents/gsd-phase-researcher.md agents/gsd-project-researcher.md` returns nothing in tools blocks
  - `grep "webfetch: true" agents/gsd-debugger.md agents/gsd-phase-researcher.md agents/gsd-project-researcher.md` matches all 3
  - `grep "collectFiles.*src" build.js` returns nothing
  - `npm run build` succeeds and manifest does NOT contain any `src/` entries
  - `npm test` passes (or pre-existing failures only — no new failures)
  </verify>
  <done>
  Agent frontmatter removed from bgsd-plan-phase.md. Both bgsd-debug.md and bgsd-research-phase.md reduced to thin wrappers with logic in workflow files. bgsd-reapply-patches.md uses `<objective>` tag. All 3 agent files use `webfetch: true` instead of `websearch: true`. build.js no longer includes src/ in deploy manifest. Build succeeds.
  </done>
</task>

</tasks>

<verification>
- All 7 findings addressed (2 critical, 5 warning)
- `npm run build` succeeds
- `npm test` shows no new failures
- `grep -r "join-discord" AGENTS.md README.md docs/commands.md` returns nothing
- `grep -c "41" AGENTS.md README.md docs/commands.md` returns 0 for command count contexts
- Deploy manifest (`bin/manifest.json`) contains 0 `src/` entries
</verification>

<success_criteria>
- Ghost bgsd-join-discord command fully purged from all documentation (AGENTS.md, README.md, docs/commands.md) with counts updated to 40
- deploy.sh targets plural `commands/` directory with backward migration from singular `command/`
- bgsd-plan-phase.md has no `agent:` frontmatter
- bgsd-debug.md and bgsd-research-phase.md are thin command wrappers (<45 lines) with logic in workflows/
- bgsd-reapply-patches.md uses `<objective>` not `<purpose>`
- 3 agent files use `webfetch: true` not `websearch: true`
- build.js manifest excludes `src/` directory
- Build compiles successfully
</success_criteria>

<output>
After completion, create `.planning/quick/7-address-critical-and-warning-findings-fr/7-SUMMARY.md`
</output>
