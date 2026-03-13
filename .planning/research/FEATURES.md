# Feature Research: LLM Offloading

**Domain:** LLM-to-Code Decision Offloading in AI-Assisted Development Tooling
**Researched:** 2026-03-13
**Confidence:** HIGH (based on direct analysis of 44 workflow files, plugin.js, router.js, and 5 native LLM tools)

<!-- section: compact -->
<features_compact>

**Table stakes (must have):**
- Workflow routing pre-computation — LLM currently reads workflows to determine next step; code can resolve routing deterministically from state
- State transition automation — LLM manually parses STATE.md to decide "what next"; code already has this data in plugin parsers
- Template/file path resolution — LLM constructs file paths from phase numbers; code already does this in command-enricher.js and init.js

**Differentiators:**
- Pre-computed execution plans — Plugin resolves wave ordering, plan dependencies, execution mode (parallel vs sequential) BEFORE LLM sees the workflow
- Deterministic checkpoint classification — Code classifies task types (auto vs checkpoint) and segments plans without LLM reasoning
- Workflow step elimination — Remove LLM-interpreted steps that are pure data lookup (e.g., "Run CLI, parse JSON, extract field")

**Defer (v2+):** Full autonomous workflow execution, LLM-free plan generation, programmatic code review

**Key dependencies:** All offloading builds on existing plugin parsers (state, roadmap, plan, config); command-enricher already injects context; router.js already handles 100+ commands
</features_compact>
<!-- /section -->

<!-- section: feature_landscape -->
## Feature Landscape

### Table Stakes (Users Expect These)

These are the minimum offloading opportunities — decisions the LLM currently makes that are clearly deterministic. Missing these means the plugin is leaving obvious token savings on the table.

| Feature | Why Expected | Complexity | Frequency | Notes |
|---------|--------------|------------|-----------|-------|
| **Workflow routing from state** | Every workflow starts with "Read STATE.md, determine position, decide what to do." This is a pure lookup. | LOW | Every command invocation (~50/session) | `progress.md` Route A/B/C/D/E/F is entirely deterministic from plan/summary counts. Plugin already has `parseState()`, `parsePlans()`, `parseRoadmap()`. Emit routing decision in `<bgsd-context>`. |
| **Phase/plan file path resolution** | LLM constructs paths like `.planning/phases/XX-name/XX-YY-PLAN.md` by parsing numbers and slugs. Code already does this. | LOW | ~20/session | `command-enricher.js` already resolves `phase_dir`, `plans[]`, `incomplete_plans[]`. Extend to emit full resolved paths for all artifacts (PLAN, SUMMARY, CONTEXT, RESEARCH, VERIFICATION, UAT). |
| **Next-action determination** | After every plan execution, the LLM decides: "more plans → execute, all done → transition, milestone done → complete." This is arithmetic. | LOW | ~10/session | Count PLANs vs SUMMARYs per phase. Already computed in `init.js`. Emit `next_action: {execute\|transition\|milestone_complete\|plan\|discuss}` in enrichment. |
| **Configuration flag resolution** | LLM reads config.json to check `research_enabled`, `plan_checker_enabled`, `verifier`, `commit_docs`, `branching_strategy`. All are boolean/string lookups. | LOW | ~15/session | `parseConfig()` already reads all config. Emit resolved flags directly. Currently done partially — extend to all workflow-referenced config fields. |
| **Phase argument parsing/normalization** | Every workflow parses `PHASE_ARG` to extract phase number, handle decimal phases, validate existence. | LOW | ~15/session | `detectPhaseArg()` in enricher + `findPhaseInternal()` in helpers already do this. Emit `padded_phase`, `phase_slug`, `phase_exists`, `phase_dir` — already partially done. |
| **Plan execution pattern classification** | `execute-plan.md` classifies plans as Pattern A (autonomous), B (segmented), or C (main context) by checking for checkpoint tasks. | LOW | ~5/session | `parsePlan()` already extracts tasks with types. Classification = `plan.tasks.some(t => t.type.startsWith('checkpoint'))`. Emit `execution_pattern: A\|B\|C` in enrichment. |
| **Commit type inference** | LLM decides commit prefix (`feat`, `fix`, `docs`, `refactor`, etc.) from task content. This could be pre-classified from plan frontmatter. | LOW | ~8/session | Plan frontmatter has `type: execute\|tdd\|gap_closure`. Task types map to commit prefixes. Emit `commit_prefix` per task. |

### Differentiators (Competitive Advantage)

Higher-complexity offloading that significantly reduces LLM reasoning and token usage.

| Feature | Value Proposition | Complexity | Frequency | Notes |
|---------|-------------------|------------|-----------|-------|
| **Pre-computed execution plans** | `execute-phase.md` has the LLM: discover plans, parse wave numbers, check dependencies, determine parallel vs sequential, resolve worktree eligibility, construct execution order. All deterministic. | MEDIUM | ~3/session | CLI `util:phase-plan-index` already computes this. Emit full execution plan in `<bgsd-context>`: `{ waves: [{ plans: [...], parallel: bool }], total_incomplete: N, execution_mode: "worktree\|sequential" }`. Eliminates 50+ lines of LLM workflow parsing. |
| **Spawn prompt pre-assembly** | Orchestrator workflows construct complex Task() spawn prompts by string-templating phase numbers, plan paths, model names, file lists. All are variable substitutions. | MEDIUM | ~5/session | Generate complete spawn context as structured data: `{ plan_path, phase_dir, model, files_to_read: [...], codebase_context_available: bool }`. LLM just passes through rather than constructing. |
| **Transition/routing state machine** | `transition.md` is a 500-line workflow that is essentially a state machine: check completion → update roadmap → evolve PROJECT.md → offer next. Most steps are CLI calls. | HIGH | ~3/session | Model as explicit state machine in code. Steps like `update_roadmap_and_state`, `offer_next_phase` are CLI calls. Only `evolve_project` requires LLM judgment (which decisions matter, what changed). |
| **Preflight check aggregation** | `execute-phase.md` runs 5 preflight checks sequentially (dependency, state validation, worktree, convention, plan discovery). LLM interprets each result. | MEDIUM | ~3/session | Run all preflights as single CLI command returning aggregated results: `{ preflights: { deps: {valid: true}, state: {status: "clean"}, worktree: {eligible: false}, conventions: {warnings: []}, plans: {waves: [...]} } }`. |
| **Deterministic checkpoint handling** | `execute-plan.md` checkpoint protocol: auto-mode auto-approves `human-verify`, auto-selects first option for `decision`, presents `human-action`. This routing is a simple switch statement. | LOW | ~2/session | Emit checkpoint resolution in enrichment when auto-mode enabled: `{ auto_resolve: { "human-verify": "approve", "decision": "first_option" } }`. LLM follows rather than reasons. |
| **SUMMARY.md template pre-fill** | After plan execution, LLM constructs SUMMARY.md with frontmatter copied from PLAN, duration calculated, dates filled. Most is mechanical. | MEDIUM | ~5/session | CLI generates SUMMARY.md skeleton with frontmatter pre-filled from PLAN frontmatter + git metadata. LLM fills only the substantive sections (one-liner, accomplishments, issues). |
| **Requirement traceability automation** | Workflows extract REQ-IDs from plan frontmatter, cross-reference with REQUIREMENTS.md, mark complete. Pure data operations. | LOW | ~3/session | Already partially done via `plan:requirements mark-complete`. Extend: auto-extract REQ-IDs from all plans in a phase, batch-verify coverage, emit traceability report. |
| **Model resolution** | Every workflow resolves agent models from config profile (balanced/quality/budget). Currently the LLM reads `<bgsd-context>` but the resolution is already programmatic. | LOW | ~10/session | Already done in `resolveModelInternal()`. Ensure all model references are pre-resolved and emitted. No LLM reasoning needed. |

### Anti-Features (Commonly Requested, Often Problematic)

Features that seem like good offloading targets but should NOT be moved from LLM to code.

| Feature | Why Tempting | Why Problematic | Keep In LLM |
|---------|-------------|-----------------|-------------|
| **Plan content generation** | Plans follow templates; seems automatable | Plans require understanding of requirements, codebase context, and making architectural judgment calls | LLM generates plan content; code only validates structure |
| **Code review decisions** | Review protocol has severity rules | Whether a finding is a BLOCKER vs INFO requires understanding code semantics, not just pattern matching | LLM reasons about code quality; code provides review context |
| **Scope creep detection** | `discuss-phase.md` redirects out-of-scope requests | Determining whether a user request is "in scope" requires understanding the domain boundary, not just keyword matching | LLM interprets user intent; code provides scope boundaries |
| **Deviation classification** | `execute-plan.md` has 4 deviation rules | Classifying an unexpected issue as Rule 1 (bug) vs Rule 4 (architectural) requires understanding code impact | LLM classifies deviations; code provides deviation rule reference |
| **PROJECT.md evolution** | `transition.md` updates PROJECT.md with phase learnings | Deciding which requirements are "validated" vs "invalidated" requires understanding what was built | LLM synthesizes phase outcomes; code provides SUMMARY data |
| **Gray area identification** | `discuss-phase.md` identifies phase-specific gray areas | Generating meaningful discussion topics requires domain understanding | LLM identifies gray areas; code provides phase context |
| **Severity inference** | `verify-work.md` infers bug severity from user descriptions | "Doesn't work" vs "crashes" requires natural language understanding | LLM classifies severity; code provides inference rules as reference |
| **Commit message content** | Commit messages describe what changed and why | Summarizing code changes requires understanding intent, not just diff statistics | LLM writes messages; code provides commit type prefix |
<!-- /section -->

<!-- section: dependencies -->
## Feature Dependencies

```
[Workflow Routing]
    └──requires──> [State Parser (exists)]
                       └──requires──> [Plan Parser (exists)]

[File Path Resolution]
    └──requires──> [Command Enricher (exists)]
                       └──requires──> [Phase Finder (exists)]

[Next-Action Determination]
    └──requires──> [Workflow Routing]
    └──requires──> [Plan/Summary Counting (exists in init.js)]

[Pre-computed Execution Plans]
    ├──requires──> [phase-plan-index CLI (exists)]
    ├──requires──> [Worktree Config (exists)]
    └──requires──> [File Path Resolution]

[Spawn Prompt Pre-assembly]
    ├──requires──> [Pre-computed Execution Plans]
    ├──requires──> [Model Resolution (exists)]
    └──requires──> [Codebase Context (exists)]

[Preflight Check Aggregation]
    ├──requires──> [State Validation (exists)]
    ├──requires──> [Dependency Validation (exists)]
    ├──requires──> [Convention Check (exists)]
    └──requires──> [Plan Discovery (exists)]

[Transition State Machine]
    ├──requires──> [Workflow Routing]
    ├──requires──> [Next-Action Determination]
    └──conflicts──> [Full PROJECT.md Evolution (keep in LLM)]

[SUMMARY.md Pre-fill]
    ├──requires──> [Plan Parser (exists)]
    └──requires──> [Git Metadata (exists)]
```

### Dependency Notes

- **State/Plan/Roadmap parsers already exist** in `plugin.js` — `parseState()`, `parsePlans()`, `parseRoadmap()`. These are the foundation for all offloading.
- **Command enricher is the injection point** — `enrichCommand()` in `command-enricher.js` already attaches `<bgsd-context>` JSON. All new pre-computed data flows through this.
- **init.js is the heavy lifter** — `cmdInitExecutePhase()`, `cmdInitPlanPhase()`, etc. already compute most of the data workflows need. The gap is that workflows still re-derive some of this data.
- **Transition state machine conflicts with PROJECT.md evolution** — The state machine can handle all mechanical steps, but `evolve_project` requires LLM synthesis. Must clearly separate.
- **Spawn prompt pre-assembly requires all upstream resolutions** — Model, paths, context, execution mode. Build incrementally — each resolved field is independently useful.
<!-- /section -->

<!-- section: offloading_categories -->
## Offloading Categories

Systematic analysis of 44 workflow files reveals 6 categories of offloadable decisions, ordered by frequency and impact.

### Category 1: State Lookups & Routing (HIGHEST frequency, LOW complexity)

**Current behavior:** Every workflow starts with "Read STATE.md, parse current phase/plan, determine position." The LLM reads raw markdown, extracts fields with regex, and routes accordingly.

**Evidence from workflows:**
- `progress.md` Step "route": 6 conditional routes (A-F) based on plan count, summary count, UAT gaps, milestone status — all computable from file counts
- `execute-phase.md` Step "initialize": parses `<bgsd-context>` JSON for 15+ fields — already computed by code
- `execute-plan.md` Step "identify_plan": finds first PLAN without SUMMARY — pure file comparison
- `transition.md` Step "offer_next_phase": Route A (more phases) vs Route B (milestone complete) — arithmetic on phase numbers

**What code would do:** Plugin emits `{ route: "execute", next_plan: "83-02-PLAN.md", remaining: 2 }` in enrichment. Workflow skips all routing logic.

**Estimated savings:** ~200-400 tokens per command invocation × ~50 invocations/session = 10K-20K tokens/session

### Category 2: File Path Construction (HIGH frequency, LOW complexity)

**Current behavior:** LLM constructs paths like `.planning/phases/83-offloading/83-02-PLAN.md` by string-interpolating phase numbers, slugs, and plan numbers.

**Evidence from workflows:**
- `execute-phase.md`: `${phase_dir}/{plan_file}` in every spawn prompt
- `plan-phase.md`: `${phase_dir}/{phase_num}-RESEARCH.md`, `${phase_dir}/{phase_num}-CONTEXT.md`
- `verify-work.md`: `${phase_dir}/*-SUMMARY.md`, `${phase_dir}/${phase_num}-UAT.md`
- `discuss-phase.md`: `${phase_dir}/${padded_phase}-CONTEXT.md`
- `transition.md`: `${phase_dir}/*-PLAN.md`, `${phase_dir}/*-SUMMARY.md`

**What code would do:** Emit `{ paths: { plan: "...", summary: "...", context: "...", research: "...", verification: "...", uat: "..." } }` — all resolved.

**Estimated savings:** ~100 tokens per path construction × ~20/session = 2K tokens/session. More importantly, eliminates path construction errors.

### Category 3: Preflight/Validation Aggregation (MEDIUM frequency, MEDIUM complexity)

**Current behavior:** Orchestrator workflows run 3-5 sequential CLI commands, parse each result's JSON, make decisions, then continue. The LLM acts as a shell script interpreter.

**Evidence from workflows:**
- `execute-phase.md` preflights: dependency check → state validation → worktree check → convention check → plan discovery = 5 sequential CLI calls
- `plan-phase.md`: existing plans check → research check → context check = 3 conditional checks
- `health.md`: runs `verify:validate health`, parses result, formats output — pure formatting

**What code would do:** Single CLI command `init:execute-phase-preflight {phase}` returns aggregated preflight results. Workflow receives structured outcome, skips all intermediate parsing.

**Estimated savings:** ~500 tokens per preflight sequence × ~3/session = 1.5K tokens/session. Also eliminates multi-step error handling.

### Category 4: Execution Plan Resolution (MEDIUM frequency, MEDIUM complexity)

**Current behavior:** `execute-phase.md` has the LLM: (1) discover plans, (2) check which have SUMMARYs, (3) parse wave/dependency info from frontmatter, (4) determine execution mode (parallel vs sequential), (5) construct ASCII execution diagram, (6) decide worktree eligibility. All deterministic.

**Evidence from workflows:**
- `execute-phase.md` Steps "discover_and_group_plans" + "visualize_execution_plan": ~40 lines of LLM-interpreted logic
- Wave ordering depends only on frontmatter `wave:` field
- Execution mode depends on 3 boolean flags: `parallelization`, `worktree_enabled`, wave plan count

**What code would do:** Emit complete execution plan: `{ waves: [{ id: 1, plans: [{id: "83-01", path: "...", objective: "...", tasks: 3}], mode: "sequential" }], visualization: "..." }`. LLM just displays and executes.

**Estimated savings:** ~800 tokens per execution plan resolution × ~3/session = 2.4K tokens/session

### Category 5: Template Pre-fill & Boilerplate (LOW frequency, MEDIUM complexity)

**Current behavior:** LLM constructs SUMMARY.md frontmatter by copying fields from PLAN.md frontmatter, calculating duration, filling dates. Mechanical data copying.

**Evidence from workflows:**
- `execute-plan.md` Step "create_summary": frontmatter phase, plan, subsystem, tags, requirements-completed all copied from PLAN
- `execute-plan.md` Step "record_completion_time": duration = end - start (arithmetic)
- `discuss-phase.md` Step "write_context": CONTEXT.md structure is template + decisions

**What code would do:** `util:template fill summary --plan {path}` generates SUMMARY.md skeleton with all mechanical fields pre-filled. LLM only writes substantive content.

**Estimated savings:** ~300 tokens per template × ~5/session = 1.5K tokens/session

### Category 6: Auto-mode Decision Resolution (LOW frequency, LOW complexity)

**Current behavior:** When auto-mode is enabled, every checkpoint is resolved deterministically: `human-verify → approve`, `decision → first option`. But the LLM still reads the workflow rules and applies them.

**Evidence from workflows:**
- `execute-phase.md` Step "checkpoint_handling": auto-mode rules are a simple lookup table
- `execute-plan.md` Step "checkpoint_protocol": checkpoint type determines response template
- `transition.md`: yolo mode auto-approves transitions

**What code would do:** Emit `{ auto_mode: true, checkpoint_resolutions: { "human-verify": "approve", "decision": "select_first" } }`. Workflow skips all decision logic.

**Estimated savings:** ~200 tokens per checkpoint × ~2/session = 400 tokens/session
<!-- /section -->

<!-- section: concrete_examples -->
## Concrete Examples from Workflow Files

### Example 1: progress.md routing (→ eliminate 100% of LLM reasoning)

**Current (LLM does):**
```
1. Run `ls .planning/phases/[dir]/*-PLAN.md | wc -l`
2. Run `ls .planning/phases/[dir]/*-SUMMARY.md | wc -l`
3. Run `grep -l "status: diagnosed" .planning/phases/[dir]/*-UAT.md`
4. IF uat_with_gaps > 0 → Route E
5. ELIF summaries < plans → Route A
6. ELIF summaries == plans AND plans > 0 → Step 3 (milestone check)
7. ELIF plans == 0 → Route B
8. Check if phase has CONTEXT.md → affects Route B display
9. Check milestone status → Route C vs Route D
```

**Offloaded (code does):**
```json
// Emitted in <bgsd-context> by enhanced init:progress
{
  "route": "A",
  "route_reason": "2 plans, 1 summary — 1 unexecuted",
  "next_plan": { "path": "83-02-PLAN.md", "objective": "..." },
  "next_command": "/bgsd-execute-phase 83",
  "has_context": true,
  "milestone_complete": false
}
```
LLM just renders the appropriate display block. **Zero CLI calls, zero routing logic.**

### Example 2: execute-phase.md plan discovery (→ eliminate 80% of LLM reasoning)

**Current (LLM does):**
```
1. Run `util:phase-plan-index ${PHASE_NUMBER}`
2. Parse JSON: plans[], waves, incomplete, has_checkpoints
3. Skip plans with has_summary: true
4. If GAPS_ONLY: also skip non-gap_closure plans
5. Construct execution plan table
6. Construct ASCII wave/dependency diagram
7. For each wave: determine parallel vs sequential
8. Check worktree eligibility
```

**Offloaded (code does):**
```json
// Emitted in <bgsd-context> by enhanced init:execute-phase
{
  "execution_plan": {
    "waves": [
      { "wave": 1, "plans": [
        { "id": "83-01", "path": "...", "objective": "...", "tasks": 3, "pattern": "A" }
      ], "mode": "sequential" },
      { "wave": 2, "plans": [...], "mode": "sequential" }
    ],
    "total_incomplete": 3,
    "worktree_eligible": false,
    "visualization": "Wave 1 sequential:\n  └─ 83-01-PLAN.md (Audit workflow decisions)\n\nWave 2 sequential:\n  └─ 83-02-PLAN.md (Build offloading module)"
  }
}
```
LLM displays visualization, spawns executors with pre-assembled context. **Eliminates plan discovery + wave analysis + mode determination.**

### Example 3: transition.md state machine (→ eliminate 60% of LLM reasoning)

**Current (LLM does):**
```
1. Read STATE.md, parse position
2. Count PLANs vs SUMMARYs → complete or not
3. If incomplete: present options (destructive, always confirm)
4. Run `plan:phase complete ${phase}` → parse result
5. Read phase summaries, evolve PROJECT.md (LLM judgment needed)
6. Update STATE.md sections manually
7. Check `is_last_phase` → Route A or B
8. If Route A: check CONTEXT.md for next phase
9. Present appropriate "Next Up" block
```

**Offloaded (code does):**
Transition result from `plan:phase complete` already returns `is_last_phase`, `next_phase`, `next_phase_name`. Extend to include:
```json
{
  "transition": {
    "phase_complete": true,
    "plans_executed": "3/3",
    "is_last_phase": false,
    "next_phase": 84,
    "next_phase_name": "...",
    "next_phase_has_context": true,
    "route": "A",
    "next_command": "/bgsd-plan-phase 84"
  }
}
```
LLM still handles `evolve_project` (requires synthesis), but skips all mechanical state checking. **Mechanical transitions are ~60% of the workflow.**
<!-- /section -->

<!-- section: mvp -->
## MVP Definition

### Launch With (v1 — This Milestone)

Minimum offloading — highest-frequency, lowest-complexity opportunities first.

- [ ] **Enhanced command enrichment** — Extend `<bgsd-context>` to include routing decisions, next-action, resolved paths for all artifact types (PLAN, SUMMARY, CONTEXT, RESEARCH, VERIFICATION, UAT)
- [ ] **Execution plan pre-computation** — Emit full wave/plan/mode resolution in execute-phase enrichment, eliminating plan discovery and wave analysis from LLM workflow
- [ ] **Plan execution pattern classification** — Classify plans as Pattern A/B/C from task types, emit in enrichment
- [ ] **Progress routing pre-computation** — Emit route (A-F) with next-action and next-command in progress enrichment
- [ ] **Preflight aggregation** — Single CLI call returning aggregated preflight results instead of 5 sequential calls
- [ ] **Checkpoint auto-resolution** — Emit auto-mode checkpoint resolutions when auto_advance enabled

### Add After Validation (v1.x)

Features to add once core offloading pipeline is proven.

- [ ] **SUMMARY.md skeleton generation** — CLI generates pre-filled SUMMARY.md from PLAN frontmatter + git metadata
- [ ] **Spawn context pre-assembly** — Generate complete Task() spawn parameters as structured data
- [ ] **Transition state machine** — Encode mechanical transition steps as state machine; LLM only handles PROJECT.md evolution
- [ ] **Workflow step elimination** — Remove steps from workflow files that are now pre-computed (reduce workflow size)
- [ ] **Token savings telemetry** — Measure actual token reduction per offloaded decision

### Future Consideration (v2+)

Features to defer until offloading patterns are mature.

- [ ] **Full workflow code generation** — Generate entire workflow orchestration as code, LLM fills only judgment gaps
- [ ] **Autonomous plan execution** — Code-driven execution for fully autonomous plans (no checkpoints)
- [ ] **Predictive pre-computation** — Anticipate next command and pre-compute context before user invokes it
<!-- /section -->

<!-- section: prioritization -->
## Feature Prioritization Matrix

| Feature | Token Savings | Implementation Cost | Frequency | Priority |
|---------|--------------|---------------------|-----------|----------|
| Enhanced command enrichment (routing + paths) | HIGH (~20K/session) | LOW | ~50/session | P1 |
| Progress routing pre-computation | HIGH (~5K/session) | LOW | ~10/session | P1 |
| Execution plan pre-computation | HIGH (~7K/session) | MEDIUM | ~3/session | P1 |
| Plan execution pattern classification | MEDIUM (~2K/session) | LOW | ~5/session | P1 |
| Preflight aggregation | MEDIUM (~4.5K/session) | MEDIUM | ~3/session | P1 |
| Checkpoint auto-resolution | LOW (~400/session) | LOW | ~2/session | P1 |
| SUMMARY.md skeleton generation | MEDIUM (~1.5K/session) | MEDIUM | ~5/session | P2 |
| Spawn context pre-assembly | MEDIUM (~3K/session) | MEDIUM | ~5/session | P2 |
| Transition state machine | HIGH (~5K/session) | HIGH | ~3/session | P2 |
| Workflow step elimination | HIGH (structural) | MEDIUM | Permanent | P2 |
| Token savings telemetry | LOW (meta) | LOW | N/A | P2 |
| Full workflow code generation | VERY HIGH | VERY HIGH | N/A | P3 |

**Priority key:**
- P1: Must have for this milestone — clear offloading with existing infrastructure
- P2: Should have — builds on P1 foundation, measurable additional savings
- P3: Future consideration — requires validated patterns from P1/P2

**Estimated total P1 savings:** ~39K tokens/session (conservative; assumes 50-command session)
<!-- /section -->

<!-- section: implementation_notes -->
## Implementation Notes

### Where Offloading Code Lives

All offloading goes through the existing injection pipeline:

1. **`src/commands/init.js`** — Already computes most data via `cmdInitExecutePhase()`, `cmdInitPlanPhase()`, `cmdInitProgress()`. Extend these functions to compute routing decisions, execution plans, and pre-resolved paths.

2. **`src/plugin/command-enricher.js`** — Already injects `<bgsd-context>` JSON. Enriched data flows through `enrichCommand()`. No new injection mechanism needed.

3. **`src/plugin/tools/`** — 5 native LLM tools (`bgsd_status`, `bgsd_plan`, `bgsd_context`, `bgsd_validate`, `bgsd_progress`). These return structured JSON that the LLM currently interprets. Extend tool outputs to include pre-computed decisions.

4. **`workflows/*.md`** — Update to consume pre-computed data from `<bgsd-context>` instead of re-deriving it. Remove redundant CLI calls and parsing steps.

### Module Dependencies

| New Capability | Depends On (existing) | Changes To |
|---------------|----------------------|------------|
| Routing pre-computation | `parseState()`, `parsePlans()`, `parseRoadmap()` | `init.js`, `command-enricher.js` |
| Execution plan emission | `cmdPhasePlanIndex()`, `getWorktreeConfig()` | `init.js` (extend `cmdInitExecutePhase`) |
| Pattern classification | `parsePlan()` (task extraction) | `init.js` or new helper |
| Preflight aggregation | `cmdStateValidate()`, `cmdValidateDependencies()` | New CLI command or init extension |
| SUMMARY pre-fill | `extractFrontmatter()`, `execGit()` | New CLI command |

### What NOT to Change

- **Workflow files remain the source of truth** for process definition — offloading adds computed data, doesn't rewrite processes
- **LLM tools remain LLM-callable** — they're already the right abstraction; just extend their outputs
- **Plugin hook architecture stays the same** — `command.execute.before` enrichment is the right injection point
- **No new agents or tools** — intelligence delivered as data, per PROJECT.md constraints
<!-- /section -->

## Sources

- Direct analysis of 44 workflow files in `workflows/` directory
- Direct analysis of `plugin.js` (2834 lines): parsers, enricher, tools, guardrails, file watcher, idle validator, stuck detector
- Direct analysis of `src/router.js` (1100+ lines): namespace routing for 100+ commands
- Direct analysis of `src/commands/init.js` (1883 lines): context computation for all workflows
- PROJECT.md: architecture decisions, constraints, existing capabilities
- Existing enrichment patterns in `command-enricher.js`: `detectPhaseArg()`, `resolvePhaseDir()`, `enrichCommand()`

---

*Feature research for: LLM Offloading in bGSD Plugin*
*Researched: 2026-03-13*
*Source confidence: HIGH — all findings from direct codebase analysis, no external sources needed*
