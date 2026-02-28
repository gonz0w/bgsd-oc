---
phase: quick-1
plan: 1
type: execute
wave: 1
depends_on: []
files_modified:
  - bin/gsd-tools.cjs
  - src/commands/init.js
  - src/commands/features.js
autonomous: true
requirements: [PERF-01]
must_haves:
  truths:
    - "init commands return smaller JSON payloads for quick/simple operations"
    - "history-digest supports a --limit flag to cap output size"
    - "context-budget baseline runs faster with cached tokenizer"
  artifacts:
    - path: "src/commands/init.js"
      provides: "Leaner init outputs with conditional sections"
    - path: "src/commands/features.js"
      provides: "Optimized history-digest with --limit and --phases flags"
  key_links:
    - from: "src/commands/init.js"
      to: "src/lib/helpers.js"
      via: "getMilestoneInfo, findPhaseInternal"
      pattern: "getMilestoneInfo|findPhaseInternal"
---

<objective>
Reduce token consumption in GSD tool outputs that agents consume, cutting unnecessary context from init commands and history-digest.

Purpose: The CLI itself is fast (70-95ms), but the JSON outputs are bloated — agents parse large payloads that waste context window. `history-digest` alone outputs 45KB (~11K tokens). Init commands include intent summaries, worktree configs, and env data even when not needed.

Output: Leaner JSON from init commands, history-digest with size limits, measurable reduction in agent context consumption.
</objective>

<execution_context>
@__OPENCODE_CONFIG__/get-shit-done/workflows/execute-plan.md
@__OPENCODE_CONFIG__/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/ROADMAP.md
@AGENTS.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add --slim flag to init commands and history-digest --limit</name>
  <files>src/commands/init.js, src/commands/features.js, src/router.js</files>
  <action>
**Research findings (already done):**
- CLI executes in 70-95ms — NOT the bottleneck
- Agent context loading IS the bottleneck: gsd-planner.md (38KB), gsd-executor.md (18KB), history-digest (45KB JSON)
- `init execute-phase` outputs worktree config, intent drift, env summary even when unused
- `init plan-phase` outputs intent summary with full user/outcome text
- `history-digest` outputs ALL 23 phases with decisions/tech — 45KB for 11K tokens

**Changes to make:**

1. **`history-digest` — add `--limit N` and `--phases` flags** in `src/commands/features.js`:
   - Find the `cmdHistoryDigest` function (or equivalent)
   - Add `--limit N` flag: only output the N most recent phases (default: all, for backward compat)
   - Add `--phases 10,11,12` flag: output only specific phases
   - Add `--compact` flag: omit `decisions` and `tech_stack` arrays, only output `phases` dict
   - When `--limit 5` is used, output should shrink from ~45KB to ~10KB

2. **Init commands — trim conditional sections** in `src/commands/init.js`:
   - In `cmdInitExecutePhase`: When worktree is disabled (`worktree_enabled: false`), omit `worktree_config`, `worktree_active`, `file_overlaps` entirely from output (saves ~200 tokens per call)
   - In `cmdInitExecutePhase`: When intent_drift is null, omit `intent_drift` and `intent_summary` keys entirely
   - In `cmdInitPlanPhase`: Same intent trimming
   - In `cmdInitQuick`: Ensure this already outputs minimal JSON (it does — 174B, good)
   - In `cmdInitProgress`: When `--compact` flag is passed, omit `session_diff`, `bookmarks`, `archived_phases` 

3. **Update router.js** to pass new flags through to the commands (parse `--limit`, `--phases`, `--compact` from argv)

**What NOT to change:**
- Do NOT change output when flags are absent — full backward compatibility
- Do NOT change the CLI execution speed (already fast)
- Do NOT modify agent prompt files in this task (that's a separate concern)
  </action>
  <verify>
```bash
# Verify backward compat — existing commands produce same output
node bin/gsd-tools.cjs init quick "test" --raw 2>/dev/null | python3 -c "import json,sys; d=json.load(sys.stdin); print('OK' if 'next_num' in d else 'FAIL')"

# Verify history-digest --limit works
node bin/gsd-tools.cjs history-digest --limit 3 --raw 2>/dev/null | python3 -c "import json,sys; d=json.load(sys.stdin); print(f'phases: {len(d.get(\"phases\",{}))}'); assert len(d.get('phases',{})) <= 3"

# Verify history-digest --compact works
node bin/gsd-tools.cjs history-digest --compact --raw 2>/dev/null | python3 -c "import json,sys; d=json.load(sys.stdin); assert 'decisions' not in d; print('compact OK')"

# Verify init execute-phase trims worktree when disabled
node bin/gsd-tools.cjs init execute-phase 01 --raw 2>/dev/null | python3 -c "import json,sys; d=json.load(sys.stdin); print('worktree_config' not in d if not d.get('worktree_enabled') else 'worktree present (enabled)')"

# Build succeeds
npm run build
```
  </verify>
  <done>
- `history-digest --limit 3` returns ≤3 phases (~10KB instead of 45KB)
- `history-digest --compact` omits decisions/tech arrays
- Init commands omit null/disabled sections instead of including them as null/empty
- All existing commands produce identical output when flags are absent
- `npm run build` succeeds
  </done>
</task>

<task type="auto">
  <name>Task 2: Create context-budget comparison report showing token savings</name>
  <files>src/commands/features.js</files>
  <action>
Add a `context-budget measure` subcommand that measures the token cost of common agent operations:

1. **In `src/commands/features.js`**, add a `cmdContextBudgetMeasure` function:
   - Runs each init command and measures JSON output tokens:
     - `init quick "test"` — baseline vs compact
     - `init execute-phase 01` — baseline vs with worktree/intent trimmed
     - `init plan-phase 01` — baseline vs trimmed  
     - `history-digest` — full vs `--limit 5` vs `--compact`
   - For each, compute: `{ command, full_tokens, slim_tokens, saved_tokens, saved_percent }`
   - Output summary JSON with `total_saved_tokens` and `total_saved_percent`

2. **Wire into router.js** as `context-budget measure` subcommand

This provides a measurable before/after comparison the user can run to see savings.
  </action>
  <verify>
```bash
node bin/gsd-tools.cjs context-budget measure --raw 2>/dev/null | python3 -c "
import json,sys
d = json.load(sys.stdin)
print(f'Commands measured: {len(d.get(\"measurements\",[]))}')
print(f'Total saved: {d.get(\"total_saved_tokens\",0)} tokens ({d.get(\"total_saved_percent\",0)}%)')
for m in d.get('measurements',[]):
    print(f'  {m[\"command\"]}: {m[\"full_tokens\"]} → {m[\"slim_tokens\"]} ({m[\"saved_percent\"]}% saved)')
"
npm run build
```
  </verify>
  <done>
- `context-budget measure` outputs per-command token savings
- Shows total tokens saved across all init+digest commands  
- `npm run build` succeeds with bundle under budget
  </done>
</task>

</tasks>

<verification>
```bash
# Full verification suite
npm run build && echo "Build OK"

# Backward compatibility
node bin/gsd-tools.cjs init progress --raw 2>/dev/null | python3 -c "import json,sys; d=json.load(sys.stdin); print(f'progress: {d.get(\"progress_percent\",\"?\")}%')"
node bin/gsd-tools.cjs history-digest --raw 2>/dev/null | python3 -c "import json,sys; d=json.load(sys.stdin); print(f'full phases: {len(d[\"phases\"])}')"

# New slim outputs  
node bin/gsd-tools.cjs history-digest --limit 3 --raw 2>/dev/null | python3 -c "import json,sys; d=json.load(sys.stdin); print(f'limited phases: {len(d[\"phases\"])}')"
node bin/gsd-tools.cjs context-budget measure --raw 2>/dev/null | python3 -c "import json,sys; d=json.load(sys.stdin); print(f'savings: {d[\"total_saved_percent\"]}%')"
```
</verification>

<success_criteria>
- All existing init commands produce identical output when no new flags are passed
- `history-digest --limit N` caps output to N phases
- `history-digest --compact` omits decisions/tech_stack  
- Init commands omit null/disabled fields (worktree when disabled, intent when absent)
- `context-budget measure` reports measurable token savings (target: 20%+ reduction for slim variants)
- `npm run build` succeeds, bundle stays under 550KB budget
</success_criteria>

<output>
After completion, create `.planning/quick/1-research-and-optimize-gsd-tool-performan/1-SUMMARY.md`
</output>
