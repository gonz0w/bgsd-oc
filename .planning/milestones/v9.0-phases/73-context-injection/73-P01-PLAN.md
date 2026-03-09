---
phase: 73-context-injection
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/plugin/parsers/project.js
  - src/plugin/parsers/intent.js
  - src/plugin/parsers/index.js
  - src/plugin/project-state.js
  - src/plugin/context-builder.js
  - src/plugin/token-budget.js
  - src/plugin/index.js
  - plugin.js
autonomous: true
requirements: [CINJ-01, CINJ-02]
outcome_ids: [DO-39]

must_haves:
  truths:
    - "On every new LLM interaction, the system prompt contains current phase, plan, progress, and milestone position"
    - "System prompt injection is under 500 tokens as measured by tokenx"
    - "When no .planning/ directory exists, a minimal hint is injected instead"
    - "When .planning/ exists but has errors, an error hint is injected"
    - "PROJECT.md and INTENT.md can be parsed by in-process shared parsers"
  artifacts:
    - path: "src/plugin/parsers/project.js"
      provides: "PROJECT.md parser with core value and tech stack extraction"
      exports: ["parseProject", "invalidateProject"]
    - path: "src/plugin/parsers/intent.js"
      provides: "INTENT.md parser with objective and outcomes extraction"
      exports: ["parseIntent", "invalidateIntent"]
    - path: "src/plugin/project-state.js"
      provides: "Unified ProjectState facade over all parsers"
      exports: ["getProjectState"]
    - path: "src/plugin/context-builder.js"
      provides: "System prompt composition from ProjectState data"
      exports: ["buildSystemPrompt"]
    - path: "src/plugin/token-budget.js"
      provides: "tokenx wrapper for budget enforcement"
      exports: ["countTokens", "TOKEN_BUDGET"]
  key_links:
    - from: "src/plugin/index.js"
      to: "src/plugin/context-builder.js"
      via: "experimental.chat.system.transform hook calls buildSystemPrompt"
      pattern: "buildSystemPrompt"
    - from: "src/plugin/context-builder.js"
      to: "src/plugin/project-state.js"
      via: "getProjectState provides cached data to buildSystemPrompt"
      pattern: "getProjectState"
    - from: "src/plugin/project-state.js"
      to: "src/plugin/parsers/index.js"
      via: "imports all parsers including new project.js and intent.js"
      pattern: "parseProject|parseIntent|parseState|parseRoadmap"
---

<objective>
Build the foundation for always-on context injection: new parsers for PROJECT.md and INTENT.md, a unified ProjectState facade, the context-builder module, and the system prompt hook that injects compact project state into every LLM interaction.

Purpose: Eliminate the need for manual init calls — the AI always knows current project state (phase, plan, progress, blockers, goal) via system prompt injection.
Output: Working system prompt hook registered in plugin, new parser modules, token budget enforcement.
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
@src/plugin/index.js
@src/plugin/parsers/index.js
@src/plugin/parsers/state.js
@src/plugin/parsers/roadmap.js
@plugin.js
@build.cjs
</context>

<tasks>

<task type="auto">
  <name>Task 1: Create PROJECT.md parser, INTENT.md parser, and ProjectState facade</name>
  <files>src/plugin/parsers/project.js, src/plugin/parsers/intent.js, src/plugin/parsers/index.js, src/plugin/project-state.js</files>
  <action>
Create `src/plugin/parsers/project.js`:
- Self-contained regex parser (no imports from src/lib/ — follows Phase 71 pattern)
- `parseProject(cwd)` extracts from `.planning/PROJECT.md`:
  - `coreValue`: from "Core value:" or similar field pattern
  - `techStack`: from tech/stack section (1-line summary)
  - `raw`: full file content
- Module-level `Map` cache, frozen results, `invalidateProject(cwd)` export
- Returns `null` if file doesn't exist

Create `src/plugin/parsers/intent.js`:
- Self-contained regex parser
- `parseIntent(cwd)` extracts from `.planning/INTENT.md`:
  - `objective`: content within `<objective>` tags
  - `outcomes`: array of `DO-XX` entries from `<outcomes>` section
  - `raw`: full file content
- Module-level `Map` cache, frozen results, `invalidateIntent(cwd)` export
- Returns `null` if file doesn't exist

Update `src/plugin/parsers/index.js`:
- Add re-exports for `parseProject`, `invalidateProject`, `parseIntent`, `invalidateIntent`
- Update `invalidateAll()` to include `invalidateProject()` and `invalidateIntent()`

Create `src/plugin/project-state.js`:
- `getProjectState(cwd)` — unified facade that calls all parsers and returns a single frozen object:
  ```
  { state, roadmap, config, project, intent, plans, currentPhase, currentMilestone }
  ```
- `currentPhase`: derived from `state.phase` field (parse phase number, look up in roadmap)
- `currentMilestone`: from `roadmap.currentMilestone` or find milestone containing current phase
- `plans`: call `parsePlans(phaseNum, cwd)` for current phase
- Returns `null` if no `.planning/` directory (check state parser returns null)
- Uses existing parser caches — no additional caching layer needed
  </action>
  <verify>
Build with `npm run build` — verify plugin.js includes parseProject, parseIntent, getProjectState exports. Check 0 require() calls in ESM output.
  </verify>
  <done>
All four files exist with self-contained implementations. Parser barrel re-exports all new functions. ProjectState facade composes all parsers into a single call. Build succeeds with ESM validation.
  </done>
</task>

<task type="auto">
  <name>Task 2: Create context-builder, token-budget, and wire system prompt hook</name>
  <files>src/plugin/context-builder.js, src/plugin/token-budget.js, src/plugin/index.js</files>
  <action>
Create `src/plugin/token-budget.js`:
- Import tokenx's `countTokens` (or the estimation function already bundled in the project)
- If tokenx is not available in plugin bundle: implement a simple chars/4 estimator with a named export `countTokens(text)` that returns estimated token count
- Export `TOKEN_BUDGET = 500` constant
- Export `isWithinBudget(text)` convenience function

Create `src/plugin/context-builder.js`:
- Import `getProjectState` from `./project-state.js`
- Export `buildSystemPrompt(cwd)`:
  - Call `getProjectState(cwd)`
  - If null (no .planning/): return `'<bgsd>No active project. Run /bgsd-new-project to start.</bgsd>'`
  - Build compact prompt format per CONTEXT.md decision:
    ```
    <bgsd>
    Phase {N}: {Name} | Plan: {plan} ({tasks done}/{total} tasks) | {version} {X}/{Y} phases
    Goal: {phase goal sentence}
    {Blocker: {text} — only if blockers present}
    </bgsd>
    ```
  - Extract phase number from `state.phase` field (e.g., "73 — Context Injection" → 73)
  - Get plan info from `plans` array — find current/incomplete plan
  - Get milestone position from roadmap milestones (count complete vs total phases in current milestone)
  - If state parsing fails: return error hint `'<bgsd>Failed to load project state. Run /bgsd-health to diagnose.</bgsd>'`
  - Log warning if prompt exceeds TOKEN_BUDGET (don't block, just warn)

Update `src/plugin/index.js`:
- Import `buildSystemPrompt` from `./context-builder.js`
- Add new hook `'experimental.chat.system.transform'`:
  ```js
  'experimental.chat.system.transform': safeHook('system.transform', async (input, output) => {
    const projectDir = directory || process.cwd();
    const prompt = buildSystemPrompt(projectDir);
    if (prompt && output?.system) {
      output.system.push(prompt);
    }
  })
  ```
- Add `parseProject`, `invalidateProject`, `parseIntent`, `invalidateIntent`, `getProjectState`, `buildSystemPrompt` to exports
- Keep existing hooks (session.created, shell.env, compacting) unchanged for now
  </action>
  <verify>
Run `npm run build` — verify plugin.js builds without errors and passes ESM validation. Verify `buildSystemPrompt` appears in plugin.js output. Verify `experimental.chat.system.transform` hook is registered. Check build export validation passes (update build.cjs requiredExports array to include new critical exports if needed). Run `npm test` to ensure no regressions.
  </verify>
  <done>
System prompt hook is registered and functional. When a .planning/ directory exists with STATE.md and ROADMAP.md, the hook injects a compact `<bgsd>` tag with phase, plan, progress, goal, and milestone info. Token budget is enforced via warning. Build succeeds. Tests pass.
  </done>
</task>

</tasks>

<verification>
1. `npm run build` succeeds with both CJS and ESM targets
2. `plugin.js` contains `experimental.chat.system.transform` hook registration
3. `plugin.js` exports include: `parseProject`, `parseIntent`, `getProjectState`, `buildSystemPrompt`
4. ESM validation: 0 require() calls in plugin.js
5. `npm test` passes (no regressions from new modules)
6. System prompt format matches CONTEXT.md decision: `<bgsd>Phase N: Name | Plan: PNN (X/Y tasks) | vX.X N/M phases\nGoal: ...\n</bgsd>`
</verification>

<success_criteria>
- System prompt hook registered in plugin.js via experimental.chat.system.transform
- ProjectState facade returns unified cached data from all 6 parsers
- System prompt injection produces compact output under 500 tokens
- No-project case returns minimal hint
- Error case returns diagnostic hint
- Build passes ESM validation
</success_criteria>

<output>
After completion, create `.planning/phases/73-context-injection/73-P01-SUMMARY.md`
</output>
