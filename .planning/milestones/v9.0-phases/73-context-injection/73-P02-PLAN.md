---
phase: 73-context-injection
plan: 02
type: execute
wave: 2
depends_on: [01]
files_modified:
  - src/plugin/context-builder.js
  - src/plugin/command-enricher.js
  - src/plugin/index.js
  - plugin.js
autonomous: true
requirements: [CINJ-03, CINJ-04]
outcome_ids: [DO-42, DO-45]

must_haves:
  truths:
    - "After compaction, the LLM retains awareness of PROJECT.md context, INTENT.md objective, active decisions, blockers, and current task"
    - "Compaction context uses structured XML blocks (<project>, <task>, <decisions>, <intent>) that are self-documenting"
    - "When no .planning/ exists, compaction injects nothing (no empty markers)"
    - "All /bgsd-* slash commands receive auto-injected project context before workflow execution"
    - "Non-bgsd commands are not intercepted by the enrichment hook"
    - "Phase-aware commands receive phase-specific context (phase dir, plans, goal)"
  artifacts:
    - path: "src/plugin/command-enricher.js"
      provides: "Command argument parsing and init-equivalent context building"
      exports: ["enrichCommand"]
    - path: "src/plugin/context-builder.js"
      provides: "Enhanced compaction context builder (extends Plan 01)"
      exports: ["buildCompactionContext"]
  key_links:
    - from: "src/plugin/index.js"
      to: "src/plugin/context-builder.js"
      via: "experimental.session.compacting hook calls buildCompactionContext"
      pattern: "buildCompactionContext"
    - from: "src/plugin/index.js"
      to: "src/plugin/command-enricher.js"
      via: "command.execute.before hook calls enrichCommand"
      pattern: "enrichCommand"
    - from: "src/plugin/command-enricher.js"
      to: "src/plugin/project-state.js"
      via: "getProjectState provides cached data for enrichment"
      pattern: "getProjectState"
---

<objective>
Implement enhanced compaction that preserves full project context across context window resets, and command enrichment that auto-injects project state into all /bgsd-* slash commands before their workflows execute.

Purpose: After compaction, the AI retains rich project awareness (not just STATE.md). Slash commands receive full init-equivalent context without subprocess calls.
Output: Enhanced compaction hook, command.execute.before hook, both wired into plugin.
</objective>

<execution_context>
@/home/cam/.config/oc/bgsd-oc/workflows/execute-plan.md
@/home/cam/.config/oc/bgsd-oc/templates/summary.md
</execution_context>

<context>
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/73-context-injection/73-CONTEXT.md
@.planning/phases/73-context-injection/73-RESEARCH.md
@.planning/phases/73-context-injection/73-P01-SUMMARY.md
@src/plugin/index.js
@src/plugin/context-builder.js
@src/plugin/project-state.js
@plugin.js
</context>

<tasks>

<task type="auto">
  <name>Task 1: Build enhanced compaction context and command enricher module</name>
  <files>src/plugin/context-builder.js, src/plugin/command-enricher.js</files>
  <action>
Add to `src/plugin/context-builder.js`:
- Export `buildCompactionContext(cwd)`:
  - Call `getProjectState(cwd)`
  - If null: return null (no .planning/ → inject nothing, per CONTEXT.md decision)
  - Build structured XML blocks per CONTEXT.md format (use these tag names: `project`, `task-state`, `decisions`, `intent`, `session`):
    - `<project>` block: Core value + Tech stack (1 line each from PROJECT.md)
    - `<task-state>` block: Phase N: Name — Plan PNN, Task X/Y: current task name + files
    - `<decisions>` block: Last 3 decisions from STATE.md
    - `<intent>` block: Objective from INTENT.md
    Note: Use `task-state` (not `task`) as the tag name to avoid XML parser conflicts with PLAN.md task tags
  - Extract decisions from `state.getSection('Decisions')` — parse bullet points, take last 3
  - Extract current task from current plan's tasks list (find first task without completion marker)
  - Include session continuity hint: derive from STATE.md `Session Continuity` section (stopped_at, next_step)
  - If individual sections fail (e.g., no INTENT.md): skip that XML block, don't fail entire compaction
  - Add `session` block at end: `Stopped at: {stopped_at}\nNext step: {next_step}`
  - Total target: under 1000 tokens

Create `src/plugin/command-enricher.js`:
- Import `getProjectState` from `./project-state.js`
- Import `parsePlans` from `./parsers/index.js`
- Export `enrichCommand(input, output, cwd)`:
  - Extract command name from `input.command` or `input.parts[0]`
  - If command doesn't start with `bgsd-`: return immediately (don't intercept non-bgsd commands)
  - Call `getProjectState(cwd)`
  - If null and command is not `bgsd-new-project` or `bgsd-help`: output error hint and return
  - Build enrichment object (init-equivalent JSON):
    ```js
    {
      // Paths
      planning_dir: '.planning',
      phase_dir: '{resolved phase dir}',
      state_path: '.planning/STATE.md',
      roadmap_path: '.planning/ROADMAP.md',
      config_path: '.planning/config.json',
      
      // Phase info (when phase-aware)
      phase_number: '{N}',
      phase_name: '{name}',
      phase_slug: '{N}-{slug}',
      plans: ['{list of plan files}'],
      incomplete_plans: ['{plans without SUMMARY}'],
      
      // Config flags
      commit_docs: true/false,
      branching_strategy: 'none',
      verifier_enabled: true/false,
      research_enabled: true/false,
      
      // Milestone
      milestone: '{version}',
      milestone_name: '{name}',
    }
    ```
  - Phase-aware detection: scan `input.parts` for a phase number argument (digit pattern)
    - If found: populate phase-specific fields (phase_dir, plans, goal)
    - If not found: only project-level context (milestone, overall progress)
  - Prepend enrichment as a formatted context block to `output.parts` using `bgsd-context` XML tags wrapping `JSON.stringify(enrichment, null, 2)`
  - On enrichment failure: log error, push error message to output.parts telling agent to run /bgsd-health
  </action>
  <verify>
Run `npm run build` — verify plugin.js includes `buildCompactionContext` and `enrichCommand`. Verify ESM validation passes.
  </verify>
  <done>
buildCompactionContext produces structured XML with all 4 artifacts plus session hint. enrichCommand intercepts only /bgsd-* commands, builds init-equivalent JSON, handles phase-aware and non-phase commands, handles no-.planning/ gracefully.
  </done>
</task>

<task type="auto">
  <name>Task 2: Wire compaction and command.execute.before hooks in plugin index</name>
  <files>src/plugin/index.js, plugin.js</files>
  <action>
Update `src/plugin/index.js`:
- Import `buildCompactionContext` from `./context-builder.js`
- Import `enrichCommand` from `./command-enricher.js`
- Replace existing `compacting` hook with enhanced version:
  ```js
  'experimental.session.compacting': safeHook('compacting', async (input, output) => {
    const projectDir = directory || process.cwd();
    const ctx = buildCompactionContext(projectDir);
    if (ctx && output?.context) {
      output.context.push(ctx);
    }
  })
  ```
  Note: This REPLACES the Phase 71 compacting hook that only preserved raw STATE.md. The new version preserves all 4 artifacts as structured XML.

- Add command.execute.before hook:
  ```js
  'command.execute.before': safeHook('command.enrich', async (input, output) => {
    const projectDir = directory || process.cwd();
    enrichCommand(input, output, projectDir);
  })
  ```
  Note: This is NOT an experimental hook — it's a standard plugin hook per research.

- Add `buildCompactionContext`, `enrichCommand` to exports
- Verify all hooks are registered in the return object

Build and validate:
- Run `npm run build`
- Verify plugin.js contains all hook registrations: session.created, shell.env, experimental.chat.system.transform, experimental.session.compacting, command.execute.before
- Update `build.cjs` requiredExports to include new critical exports: `buildCompactionContext`, `enrichCommand`, `getProjectState`
- Run `npm test` for regression check
  </action>
  <verify>
Run `npm run build` — all exports validated, ESM clean. Run `npm test` — no regressions. Verify plugin.js contains 5 hook registrations (session.created, shell.env, system.transform, compacting, command.execute.before).
  </verify>
  <done>
Enhanced compaction replaces Phase 71's raw STATE.md dump with structured XML covering project, task, decisions, intent, and session continuity. Command enrichment hook intercepts all /bgsd-* commands and prepends init-equivalent context. Both hooks wrapped in safeHook. Build and tests pass.
  </done>
</task>

</tasks>

<verification>
1. `npm run build` succeeds with updated export validation
2. `plugin.js` contains 5 hook registrations
3. Compaction context includes `<project>`, `<task>`, `<decisions>`, `<intent>`, `<session>` XML blocks
4. Command enrichment only fires for `bgsd-*` commands
5. Phase-aware commands receive phase-specific context
6. Non-phase commands receive project-level context only
7. `npm test` passes with no regressions
</verification>

<success_criteria>
- Compaction preserves PROJECT.md core value, INTENT.md objective, last 3 decisions, current task, session hint
- Command enrichment provides init-equivalent JSON for all /bgsd-* commands
- Phase-aware commands get phase directory, plans list, goal
- Failures are caught by safeHook — never crash host process
- Build passes ESM validation with updated exports
</success_criteria>

<output>
After completion, create `.planning/phases/73-context-injection/73-P02-SUMMARY.md`
</output>
