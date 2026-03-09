---
phase: 73-context-injection
plan: 03
type: execute
wave: 3
depends_on: [02]
files_modified:
  - workflows/execute-phase.md
  - workflows/execute-plan.md
  - workflows/plan-phase.md
  - workflows/verify-work.md
  - workflows/research-phase.md
  - workflows/discuss-phase.md
  - workflows/new-project.md
  - workflows/new-milestone.md
  - workflows/resume-project.md
  - workflows/progress.md
  - workflows/quick.md
  - workflows/github-ci.md
  - workflows/map-codebase.md
  - workflows/add-phase.md
  - workflows/insert-phase.md
  - workflows/remove-phase.md
  - workflows/add-todo.md
  - workflows/check-todos.md
  - workflows/audit-milestone.md
  - build.cjs
autonomous: true
requirements: [CINJ-04]
outcome_ids: [DO-39, DO-42]

must_haves:
  truths:
    - "No workflow file contains init:* subprocess calls — all context comes from plugin command enrichment"
    - "Each workflow has a plugin-required guard that shows a clear error if context is missing"
    - "Workflows continue to receive the same data they got from init:* calls, now via <bgsd-context> injection"
    - "Build succeeds and all tests pass after workflow changes"
  artifacts:
    - path: "workflows/execute-phase.md"
      provides: "Phase execution workflow without init:execute-phase subprocess call"
    - path: "workflows/plan-phase.md"
      provides: "Phase planning workflow without init:plan-phase subprocess call"
    - path: "workflows/execute-plan.md"
      provides: "Plan execution workflow without init:execute-phase subprocess call"
  key_links:
    - from: "workflows/*.md"
      to: "src/plugin/command-enricher.js"
      via: "command.execute.before hook prepends <bgsd-context> to all /bgsd-* commands"
      pattern: "bgsd-context"
    - from: "workflows/*.md"
      to: "plugin.js"
      via: "Workflows depend on plugin being loaded — no fallback"
      pattern: "bGSD plugin required"
---

<objective>
Remove all init:* subprocess calls from the 19 workflow files, replacing them with reliance on the command.execute.before hook's auto-injected context. Add plugin-required guards to each workflow.

Purpose: Complete the transition from subprocess-based context loading to plugin-based context injection. This is the final step that makes init:* calls obsolete for v9.0.
Output: All 19 workflows updated, build passes, tests pass.
</objective>

<execution_context>
@/home/cam/.config/oc/bgsd-oc/workflows/execute-plan.md
@/home/cam/.config/oc/bgsd-oc/templates/summary.md
</execution_context>

<context>
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/73-context-injection/73-CONTEXT.md
@.planning/phases/73-context-injection/73-P01-SUMMARY.md
@.planning/phases/73-context-injection/73-P02-SUMMARY.md
@src/plugin/command-enricher.js
@workflows/execute-phase.md
@workflows/plan-phase.md
@workflows/execute-plan.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Remove init:* calls from all 19 workflow files</name>
  <files>workflows/execute-phase.md, workflows/execute-plan.md, workflows/plan-phase.md, workflows/verify-work.md, workflows/research-phase.md, workflows/discuss-phase.md, workflows/new-project.md, workflows/new-milestone.md, workflows/resume-project.md, workflows/progress.md, workflows/quick.md, workflows/github-ci.md, workflows/map-codebase.md, workflows/add-phase.md, workflows/insert-phase.md, workflows/remove-phase.md, workflows/add-todo.md, workflows/check-todos.md, workflows/audit-milestone.md</files>
  <action>
For each of the 19 workflow files that contain `init:*` calls:

1. **Remove the INIT=... bash block** that spawns a bgsd-tools.cjs subprocess
   - Delete the entire `INIT=$(node ... init:* ...)` line and any surrounding bash block markers
   - Delete any "Extract from init JSON" instructions that reference the INIT variable

2. **Replace with a plugin-required guard:**
   ```markdown
   **Context:** This workflow receives project context via `<bgsd-context>` auto-injected by the bGSD plugin's `command.execute.before` hook. If no `<bgsd-context>` block is present, the plugin is not loaded.

   **If no `<bgsd-context>` found:** Stop and tell the user: "bGSD plugin required for v9.0. Install with: npx bgsd-oc"
   ```

3. **Update variable references:**
   - Where workflows referenced `$INIT` or specific init JSON fields (like `phase_dir`, `phase_number`, `executor_model`, etc.), update them to reference the equivalent field from the `<bgsd-context>` JSON block
   - The enrichment provides the same fields — just sourced differently
   - Example: `phase_dir` from init JSON → `phase_dir` from `<bgsd-context>` JSON

4. **Preserve non-init bash blocks:**
   - Keep any `node bgsd-tools.cjs` calls that are NOT init:* calls (e.g., `execute:commit`, `verify:verify`, `util:*`)
   - Only remove the `init:*` initialization calls

**Workflow-specific notes:**
- `execute-phase.md` and `execute-plan.md`: Both call `init:execute-phase` — remove both, they share phase context from enrichment
- `plan-phase.md`: Calls `init:plan-phase` — remove, planner gets context from enrichment
- `discuss-phase.md`: Calls `init:phase-op` — remove, discussion gets phase context from enrichment
- `new-project.md`: Calls `init:new-project` — this is special: may not have .planning/ yet. Guard should allow this command to proceed even without <bgsd-context> (new projects have no existing state)
- `github-ci.md`: Already has a fallback `|| echo '{"executor_model":"default"}'` — remove entire block
- `resume-project.md`: Calls `init:resume` — remove, gets state from enrichment
  </action>
  <verify>
Run `grep -r 'init:' workflows/*.md` — should return 0 matches. Run `grep -r 'bgsd-context' workflows/*.md` — should find the guard in all 19 files. Run `npm run build` to verify no build issues.
  </verify>
  <done>
All 19 workflow files have init:* subprocess calls removed. Each has a plugin-required guard. Variable references updated to use <bgsd-context> JSON fields. Non-init bgsd-tools.cjs calls preserved.
  </done>
</task>

<task type="auto">
  <name>Task 2: Update build validation and run full test suite</name>
  <files>build.cjs</files>
  <action>
Update `build.cjs`:
- Add new critical exports to the `requiredExports` array: `buildSystemPrompt`, `buildCompactionContext`, `enrichCommand`, `getProjectState`, `parseProject`, `parseIntent`
- This ensures future builds validate that all Phase 73 exports are present

Run full validation:
- `npm run build` — both CJS and ESM targets succeed
- `npm test` — all 762+ tests pass
- Verify the final state:
  - `grep -r 'init:' workflows/*.md` returns 0 matches
  - `grep -c 'bgsd-context' workflows/*.md` shows all 19 files have the guard
  - plugin.js contains all 5 hook registrations
  - plugin.js contains all new exports
  </action>
  <verify>
Run `npm run build && npm test`. Build must succeed with updated export validation. All tests must pass. Zero init:* references in workflow files.
  </verify>
  <done>
Build validation updated with all Phase 73 exports. Full test suite passes. No init:* calls remain in workflows. Phase 73 context injection is complete — the AI always knows current project state via system prompt, compaction preserves full context, and commands auto-enrich.
  </done>
</task>

</tasks>

<verification>
1. `grep -r 'init:' workflows/*.md` returns 0 matches
2. All 19 workflow files contain plugin-required guard referencing `<bgsd-context>`
3. `new-project.md` allows proceeding without <bgsd-context> (new projects have no state)
4. `npm run build` succeeds with updated requiredExports
5. `npm test` passes — all 762+ tests green
6. Non-init bgsd-tools.cjs calls (execute:commit, verify:verify, util:*) are preserved in workflows
</verification>

<success_criteria>
- Zero init:* subprocess calls remain in any workflow file
- Every workflow has a clear plugin-required guard
- Variable references updated from INIT JSON to <bgsd-context> JSON
- Build succeeds with enhanced export validation
- Full test suite passes
- The transition from subprocess-based init to plugin-based context injection is complete
</success_criteria>

<output>
After completion, create `.planning/phases/73-context-injection/73-P03-SUMMARY.md`
</output>
