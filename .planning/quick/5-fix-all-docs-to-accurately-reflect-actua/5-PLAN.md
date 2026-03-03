---
phase: quick-5
plan: 1
type: execute
wave: 1
depends_on: []
files_modified:
  - "AGENTS.md"
  - "README.md"
  - "lessons.md"
  - "docs/*.md"
  - "workflows/*.md"
  - "references/*.md"
  - "templates/*.md"
  - "agents/*.md"
  - "commands/bgsd-*.md"
autonomous: true
requirements: [ACCURACY-01]
must_haves:
  truths:
    - "Every slash command reference in docs uses /bgsd-* prefix (not /gsd-*)"
    - "/gsd-tools references remain unchanged (correct CLI tool name)"
    - "Every /bgsd-* command referenced in docs has a matching bgsd-*.md file in commands/"
    - "All 41 restored bgsd-*.md command files are committed"
    - "All 762+ tests still pass after the rename"
  artifacts:
    - path: "AGENTS.md"
      provides: "Corrected command references with /bgsd-* prefix"
    - path: "README.md"
      provides: "Corrected command references with /bgsd-* prefix"
    - path: "docs/"
      provides: "All doc files with corrected /bgsd-* references"
    - path: "workflows/"
      provides: "All workflow files with corrected /bgsd-* references"
    - path: "commands/"
      provides: "41 bgsd-*.md command files committed"
  key_links:
    - from: "docs/*.md"
      to: "commands/bgsd-*.md"
      via: "slash command name references"
      pattern: "/bgsd-[a-z-]+"
---

<objective>
Fix all documentation to use the correct `/bgsd-*` command prefix instead of the stale `/gsd-*` prefix, and commit the 41 restored command files.

Purpose: 622 references across 77 .md files use the old `/gsd-*` prefix, but deployed commands are all `/bgsd-*`. This creates user confusion and makes docs inaccurate for v8.0 release.
Output: All docs accurate, all command files committed, tests passing.
</objective>

<execution_context>
@/home/cam/.config/oc/get-shit-done/workflows/execute-plan.md
@/home/cam/.config/oc/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@AGENTS.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Bulk rename /gsd-* → /bgsd-* across all docs</name>
  <files>AGENTS.md, README.md, lessons.md, docs/*.md, workflows/*.md, references/*.md, templates/*.md, agents/*.md</files>
  <action>
Perform a bulk find-and-replace across ALL .md files in the repo:
- Pattern: `/gsd-` → `/bgsd-` 
- EXCEPT: `/gsd-tools` must remain unchanged (it's the CLI tool name, not a slash command)

Use this exact approach:
1. Run: `rg --pcre2 -l '/gsd-(?!tools)' -g '*.md'` to get the list of all 77 affected files
2. For each file, use sed with PCRE to replace `/gsd-` with `/bgsd-` but NOT `/gsd-tools`:
   ```
   find . -name '*.md' -exec sed -i 's|/gsd-\([^t]\)|/bgsd-\1|g; s|/gsd-t\([^o]\)|/bgsd-t\1|g; s|/gsd-to\([^o]\)|/bgsd-to\1|g; s|/gsd-too\([^l]\)|/bgsd-too\1|g' {} +
   ```
   
   Actually, simpler and safer approach — use perl for negative lookahead:
   ```
   find . -name '*.md' -not -path './.planning/*' -not -path './node_modules/*' | xargs perl -pi -e 's{/gsd-(?!tools)}{/bgsd-}g'
   ```
   
   NOTE: Also include files IN .planning/ that may have references (like templates). But do NOT touch .planning/phases/ archives or .planning/quick/ plan files. The safe scope:
   ```
   # Main repo files
   perl -pi -e 's{/gsd-(?!tools)}{/bgsd-}g' AGENTS.md README.md lessons.md
   
   # Directories with docs/workflows
   find docs workflows references templates agents commands -name '*.md' | xargs perl -pi -e 's{/gsd-(?!tools)}{/bgsd-}g'
   ```

3. After replacement, verify zero remaining stale references:
   ```
   rg --pcre2 '/gsd-(?!tools)' -g '*.md' --no-filename -c
   ```
   This should return nothing (or only hits inside .planning/phases/ archives which we don't touch).

IMPORTANT edge cases:
- `gsd-tools.cjs` / `gsd-tools` / `/gsd-tools` — must NOT be changed
- `get-shit-done` (the directory name) — not affected (no `/gsd-` prefix)
- Backtick-quoted references like `` `/gsd-velocity` `` — DO rename these (they're command references)
- AGENTS.md "Slash Commands" section lists 11 `/gsd-*` commands — all must become `/bgsd-*`; also update the count to 41 commands
  </action>
  <verify>
Run: `rg --pcre2 '/gsd-(?!tools)' AGENTS.md README.md lessons.md docs/ workflows/ references/ templates/ agents/ commands/` — should return zero matches.
Run: `rg '/gsd-tools' AGENTS.md` — should still find gsd-tools references (proves we didn't over-replace).
  </verify>
  <done>All 622 occurrences of `/gsd-*` (excluding `/gsd-tools`) replaced with `/bgsd-*` across 77 files. Zero stale references remain in docs, workflows, references, templates, agents, or commands directories.</done>
</task>

<task type="auto">
  <name>Task 2: Verify doc-to-command accuracy and update AGENTS.md command list</name>
  <files>AGENTS.md</files>
  <action>
After the rename, perform a cross-reference audit:

1. Extract all unique `/bgsd-*` command names referenced anywhere in docs:
   ```
   rg -o '/bgsd-[a-z-]+' docs/ workflows/ references/ AGENTS.md README.md | grep -oP '/bgsd-[a-z-]+' | sort -u
   ```

2. List all actual command files:
   ```
   ls commands/bgsd-*.md | sed 's|commands/||; s|\.md$||; s|^|/|'
   ```

3. Compare the two lists:
   - Commands referenced in docs but missing from commands/ → ERROR (phantom references)
   - Commands in commands/ but never referenced in docs → WARNING (undocumented commands)
   
   Both lists should align. Flag any mismatches.

4. Update AGENTS.md "Slash Commands" section:
   - Change "11 commands" to "41 commands" (the actual count)
   - Replace the current 11-item list with the full list of all 41 bgsd-*.md commands, grouped logically:
   
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
   - `/bgsd-join-discord` — Join the bGSD Discord community
  </action>
  <verify>
Run the cross-reference check: extract all `/bgsd-*` from docs vs `ls commands/bgsd-*.md`. Every command referenced must exist as a file. Report any orphan references or undocumented commands.
Verify AGENTS.md now lists 41 commands with `/bgsd-*` prefix.
  </verify>
  <done>AGENTS.md accurately lists all 41 `/bgsd-*` commands. Every command referenced in any doc file has a matching `commands/bgsd-*.md` file. No phantom references, no undocumented commands.</done>
</task>

<task type="auto">
  <name>Task 3: Run tests and commit everything</name>
  <files>commands/bgsd-*.md (41 restored files), all modified .md files</files>
  <action>
1. Build to make sure source still compiles:
   ```
   npm run build
   ```

2. Run the full test suite:
   ```
   npm test
   ```
   All 762+ tests must pass. The tests validate gsd-tools.cjs functionality, not doc content, so they should be unaffected — but verify.

3. Stage and commit ALL changes in a single commit:
   - The 41 restored `commands/bgsd-*.md` files (already staged as 'A')
   - All modified .md files from the bulk rename
   - Updated AGENTS.md with full command list
   
   Commit message: `docs(v8.0): rename /gsd-* → /bgsd-* across all docs and restore 41 command files`

4. Final verification — run the stale reference check one more time:
   ```
   rg --pcre2 '/gsd-(?!tools)' -g '*.md' --stats
   ```
   Should show zero matches in docs/workflows/references/templates/agents/commands (only archive files in .planning/phases/ may still have old references, which is fine — they're historical).
  </action>
  <verify>
`npm run build` succeeds. `npm test` shows 762+ tests passing. `git log -1` shows the commit. `rg --pcre2 '/gsd-(?!tools)' AGENTS.md README.md docs/ workflows/ references/ templates/ agents/ commands/` returns zero matches.
  </verify>
  <done>Build passes, all 762+ tests pass, single commit created with all renamed files and restored command files. Zero stale `/gsd-*` references remain in active documentation.</done>
</task>

</tasks>

<verification>
1. `rg --pcre2 '/gsd-(?!tools)' AGENTS.md README.md lessons.md docs/ workflows/ references/ templates/ agents/ commands/` returns zero matches
2. `rg '/gsd-tools' AGENTS.md` still finds references (no over-replacement)
3. Cross-reference: every `/bgsd-*` in docs matches a `commands/bgsd-*.md` file
4. AGENTS.md lists exactly 41 commands with `/bgsd-*` prefix
5. `npm test` passes with 762+ tests
6. Single clean commit with all changes
</verification>

<success_criteria>
- Zero stale `/gsd-*` command references in active docs (622 → 0)
- `/gsd-tools` references preserved (CLI tool name unchanged)
- All 41 `commands/bgsd-*.md` files committed
- AGENTS.md command list accurate and complete (41 commands)
- All tests passing
- Clean git history with single descriptive commit
</success_criteria>

<output>
After completion, create `.planning/quick/5-fix-all-docs-to-accurately-reflect-actua/5-SUMMARY.md`
</output>
