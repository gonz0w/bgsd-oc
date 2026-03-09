# Phase 67: GitHub CI Agent Overhaul - Research

**Researched:** 2026-03-08
**Domain:** Agent definition quality patterns (internal project architecture)
**Confidence:** HIGH

## Summary

The GitHub CI agent (`agents/gsd-github-ci.md`) is a 409-line agent definition that handles push → PR → check → fix → merge loops. It already has a working execution flow and completion format, but lacks five structural quality patterns that gsd-executor (483 lines) and gsd-planner (1197 lines) have: (1) `<project_context>` discovery block, (2) formal `<deviation_rules>` framework, (3) `<structured_returns>` with CHECKPOINT REACHED format matching executor's pattern, (4) state tracking via `verify:state` gsd-tools commands, and (5) TodoWrite progress tracking. The workflow (`workflows/github-ci.md`, 163 lines) and command wrapper (`commands/bgsd-github-ci.md`, 29 lines) also need updates for proper orchestration gates.

This is a pure agent-definition editing phase — no source code changes to gsd-tools.cjs, no new CLI commands, no build step. All work is in `.md` files under `agents/`, `workflows/`, and `commands/`. The patterns to replicate are fully documented in existing agent files.

**Primary recommendation:** Use gsd-executor.md as the primary reference implementation — it has the cleanest examples of every pattern the CI agent needs. The planner has the same patterns but is 2.5x larger with planning-specific complexity that would distract.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Record outcome summary only in STATE.md: PR merged/blocked, checks passed/failed, iteration count
- No full alert breakdown or audit trail in STATE.md — that detail lives in the PR/commit history
- Record ALL decisions the agent makes (auto-fixes, dismissals, escalations) as decision entries in STATE.md
- Session info only — no cumulative metrics (no CI run counters or success rates)
- Parent workflow handles state when CI agent is spawned by another workflow (e.g., execute-phase). CI agent returns structured output, parent decides what to record. Avoids duplicate writes.
- Auto-fix simple true positives (unused imports, straightforward sanitization). Escalate complex fixes requiring architectural changes.
- False positive dismissals: auto-dismiss low severity (note/warning) with reasoning. Present medium+ severity suspected false positives to user for confirmation.
- Deviation rules: hardcoded sensible defaults in agent definition, with config.json overrides per project
- Non-scanning check failures (build errors, lint errors, test failures): attempt fix using the same loop as code scanning alerts
- TodoWrite uses high-level phases: ~5-6 items (Push branch, Create PR, Wait for checks, Analyze failures, Fix & repush, Merge)
- No per-alert todo items — keep the list clean
- Conversational status updates between steps ("Pushing branch...", "Waiting for checks (2/5 passed)...")
- Show iteration banner during fix loops: "Fix iteration 2/3: addressing 2 remaining alerts"
- CI COMPLETE structured return includes timing information (total duration, check wait time, fix time)
- Max iterations reached: checkpoint with recommendations (specific next actions: dismiss, manual fix, or close PR)
- Merge blocked by branch protection: wait 2-3 minutes for auto-review bots, then checkpoint if still blocked
- Auth failures: run `gh auth status` for diagnostics before stopping. Include diagnostic output in checkpoint.
- Check timeout (15 min): always escalate immediately. No offer to extend.

### Agent's Discretion
- Exact structured return field names and formatting (match patterns from executor/planner)
- How project context discovery integrates into the existing step flow
- Config.json schema for deviation rule overrides
- Specific wording of conversational updates

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| GHCI-01 | GitHub CI agent has `<structured_returns>` section with CHECKPOINT REACHED and CI COMPLETE formats matching executor/planner patterns | Gap analysis shows current agent has `<completion_format>` but lacks `<structured_returns>` section and CHECKPOINT REACHED format. Executor's `<checkpoint_return_format>` provides the exact template. |
| GHCI-02 | GitHub CI agent has `<project_context>` discovery block (AGENTS.md + project skills check) | Gap analysis shows current agent reads AGENTS.md inline in step 1 but has no `<project_context>` block. Executor's block is 13 lines — copy-and-adapt. |
| GHCI-03 | GitHub CI agent has `<deviation_rules>` framework for auto-fix vs escalate decisions on check failures | Current agent has classification table in `<step name="analyze_failures">` but it's not a formal `<deviation_rules>` block. Executor's deviation_rules (72 lines) provides the structural template. CI agent needs CI-specific rules, not executor's code-change rules. |
| GHCI-04 | GitHub CI agent records state updates (metrics, decisions, session info) via gsd-tools commands | Current agent has zero state tracking. Executor's `<state_updates>` block shows exact gsd-tools commands: `verify:state add-decision`, `verify:state record-session`. CI agent needs subset (decisions + session, not plan advance). |
| GHCI-05 | GitHub CI agent uses TodoWrite for step-by-step progress tracking during execution | Current agent has zero TodoWrite usage. Need to add TodoWrite instructions at execution start (5-6 high-level items) and update-as-complete during flow. |
| GHCI-06 | GitHub CI workflow (`/bgsd-github-ci`) updated with proper orchestration gates and structured spawning | Current workflow has prerequisite validation (auth, commits, remote) but no structured result parsing from agent return. Needs to match execute-phase workflow's result-handling pattern. |
</phase_requirements>

## Standard Stack

This phase doesn't introduce external libraries. All work is editing existing `.md` agent definition files using established internal patterns.

### Core (Internal Patterns)
| Pattern | Source | Purpose | Why Standard |
|---------|--------|---------|--------------|
| `<project_context>` block | `agents/gsd-executor.md:33-46` | AGENTS.md + skills discovery | Used by 4/10 agents already; standard 13-line block |
| `<structured_returns>` section | `agents/gsd-executor.md:453-469` | Completion/checkpoint output format | Used by executor, planner, researcher, verifier, checker |
| `<checkpoint_return_format>` | `agents/gsd-executor.md:247-279` | CHECKPOINT REACHED structure | Standard checkpoint protocol shared across agents |
| `<deviation_rules>` block | `agents/gsd-executor.md:115-186` | Auto-fix vs escalate framework | 4-rule priority system with scope boundary and fix limits |
| `<state_updates>` block | `agents/gsd-executor.md:391-443` | STATE.md via gsd-tools commands | verify:state CLI for decisions, session, metrics |
| TodoWrite integration | Host editor tool API | Step-by-step progress tracking | Available to all agents via `tools:` frontmatter |

### Supporting (gsd-tools Commands)
| Command | Purpose | Used By |
|---------|---------|---------|
| `verify:state add-decision` | Record agent decisions | Executor |
| `verify:state record-session` | Update session continuity | Executor |
| `verify:state record-metric` | Record execution timing | Executor |
| `verify:state add-blocker` | Record blockers found | Executor |

## Architecture Patterns

### Current CI Agent Structure (409 lines)
```
agents/gsd-github-ci.md
├── Frontmatter (13 lines)
├── PATH SETUP (4 lines)
├── <role> (10 lines)
├── <execution_flow>
│   ├── <step name="parse_input"> (28 lines) — reads AGENTS.md inline here
│   ├── <step name="push_branch"> (28 lines)
│   ├── <step name="create_pr"> (34 lines)
│   ├── <step name="wait_for_checks"> (45 lines)
│   ├── <step name="analyze_failures"> (60 lines) — has alert classification table inline
│   ├── <step name="fix_and_repush"> (57 lines) — has iteration loop
│   └── <step name="auto_merge"> (55 lines)
├── <completion_format> (24 lines) — CI COMPLETE only, no CHECKPOINT REACHED
└── <success_criteria> (8 lines)
```

### Target CI Agent Structure (estimated ~550-600 lines)
```
agents/gsd-github-ci.md
├── Frontmatter (13 lines)
├── PATH SETUP (4 lines)
├── <role> (10 lines)
├── <project_context> (13 lines) — NEW: AGENTS.md + skills discovery
├── <execution_flow>
│   ├── <step name="parse_input"> (20 lines) — trimmed, no longer reads AGENTS.md here
│   ├── <step name="setup_progress"> (15 lines) — NEW: TodoWrite 5-6 items
│   ├── <step name="push_branch"> (28 lines)
│   ├── <step name="create_pr"> (34 lines)
│   ├── <step name="wait_for_checks"> (45 lines)
│   ├── <step name="analyze_failures"> (30 lines) — trimmed, delegates to deviation_rules
│   ├── <step name="fix_and_repush"> (40 lines) — with iteration banner
│   ├── <step name="auto_merge"> (40 lines) — trimmed
│   └── <step name="update_state"> (25 lines) — NEW: gsd-tools state commands
├── <deviation_rules> (50 lines) — NEW: CI-specific auto-fix vs escalate
├── <state_ownership> (15 lines) — NEW: direct-invocation vs spawned-by-parent
├── <structured_returns> — NEW: replaces <completion_format>
│   ├── CHECKPOINT REACHED (25 lines)
│   └── CI COMPLETE (20 lines)
└── <success_criteria> (10 lines)
```

### Pattern 1: Project Context Discovery Block
**What:** 13-line standard block that reads AGENTS.md and checks for skills
**When to use:** First thing after role, before any execution steps
**Source:** `agents/gsd-executor.md:33-46`

The CI agent currently reads AGENTS.md inside `parse_input` step (line 54: `Read ./AGENTS.md if it exists for project-specific guidelines.`). This needs to be extracted into a proper `<project_context>` block.

### Pattern 2: Deviation Rules as Separate Block
**What:** Formal `<deviation_rules>` section outside execution flow, referenced from within steps
**When to use:** When agent encounters unexpected failures during execution
**Source:** `agents/gsd-executor.md:115-186`

The CI agent currently has alert classification as an inline table inside `<step name="analyze_failures">`. This needs to be extracted into a formal `<deviation_rules>` block with:
- CI-specific rules (not executor's code-change rules)
- Auto-fix thresholds (severity x context matrix already exists — formalize it)
- Config.json override mechanism
- Scope boundary and fix attempt limits

### Pattern 3: State Ownership Model
**What:** Convention for when CI agent writes state vs. returns data for parent to write
**When to use:** At the end of execution, before returning structured output
**Decision (from CONTEXT.md):** CI agent updates state when invoked directly. When spawned by execute-phase, it returns structured output and the parent records state.

**Detection mechanism:** The CI agent needs to know if it was spawned directly or by a parent workflow. Options:
- Check if a `<spawned_by>` tag exists in the prompt (parent workflows include this)
- Check for a `--standalone` flag in parameters
- Default to state-writing, with parent workflows passing `--no-state-update`

### Pattern 4: Structured Returns with Timing
**What:** CHECKPOINT REACHED and CI COMPLETE with consistent field structure
**Decision (from CONTEXT.md):** CI COMPLETE includes timing (total duration, check wait time, fix time)

From executor's checkpoint format, CI agent's CHECKPOINT REACHED needs:
- **Type:** `human-verify | human-action`
- **PR:** URL
- **Progress:** step/total format
- **Checkpoint Details:** type-specific content
- **Awaiting:** what user needs to do

CI COMPLETE needs (extending current `<completion_format>`):
- **PR:** URL
- **Status:** merged | checks-passed-awaiting-merge | needs-human-review
- **Checks:** N passed, M fixed, K dismissed
- **Iterations:** count
- **Merge:** method used
- **Duration:** total, check wait, fix time (NEW per CONTEXT.md decision)
- **Decisions:** list of decisions made (auto-fixes, dismissals, escalations)

### Anti-Patterns to Avoid
- **Duplicating executor patterns verbatim:** CI agent's deviation rules are CI-specific (check failures, scanning alerts, build errors), not code-change rules (bugs, missing functionality). Don't copy-paste executor's rules.
- **Over-engineering state tracking:** CONTEXT.md is explicit — outcome summary only, no cumulative metrics. Don't add CI run counters.
- **Per-alert TodoWrite items:** CONTEXT.md locks this — 5-6 high-level items only, no per-alert todos.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| State updates | Custom STATE.md parsing/writing | `verify:state` gsd-tools commands | Already handles edge cases (missing sections, placeholder cleanup, format consistency) |
| Checkpoint format | Ad-hoc markdown in each step | `<checkpoint_return_format>` from executor | Ensures continuation agent can parse structured return |
| Progress tracking | Custom progress strings | TodoWrite tool API | Already integrated into host editor, visible in statusline |

## Common Pitfalls

### Pitfall 1: State Write Conflicts When Spawned by Parent
**What goes wrong:** CI agent writes state, then parent workflow also writes state, producing duplicate/conflicting entries in STATE.md
**Why it happens:** No convention for state ownership between nested agent calls
**How to avoid:** Implement state ownership model per CONTEXT.md decision — CI agent checks if spawned by parent; if yes, returns data in structured output without writing state; if no, writes state directly
**Warning signs:** Duplicate decision entries in STATE.md, session info overwritten

### Pitfall 2: Deviation Rules Too Broad for CI Context
**What goes wrong:** CI agent auto-fixes things it shouldn't (complex architectural issues flagged by CodeQL) or escalates things it should auto-fix (unused import warnings)
**Why it happens:** Copying executor's deviation rules without adapting to CI context
**How to avoid:** CI deviation rules should be specific to CI failure types: scanning alerts (severity-based), build errors (auto-fix if simple), lint errors (auto-fix), test failures (attempt fix with iteration limit)
**Warning signs:** Agent spending iterations on unfixable architectural issues, agent escalating trivial lint fixes

### Pitfall 3: TodoWrite Overload
**What goes wrong:** Too many TodoWrite items make the host editor statusline unusable
**Why it happens:** Adding per-alert or per-file todo items instead of high-level phases
**How to avoid:** CONTEXT.md locks this — exactly 5-6 items: Push branch, Create PR, Wait for checks, Analyze failures, Fix & repush, Merge
**Warning signs:** More than 6 items in todo list during CI execution

### Pitfall 4: Structured Return Missing Data for Continuation
**What goes wrong:** When checkpoint is reached, continuation agent doesn't have enough context to resume
**Why it happens:** Checkpoint return doesn't include PR number, branch name, fix iteration count, or previously-dismissed alerts
**How to avoid:** Include all CI context in CHECKPOINT REACHED: PR URL, PR number, branch name, iteration count, dismissed alerts list, remaining alerts list
**Warning signs:** Continuation agent re-creates PR or re-dismisses already-dismissed alerts

### Pitfall 5: Workflow Missing Result Parsing
**What goes wrong:** Workflow spawns CI agent but doesn't parse the structured return, losing information about what happened
**Why it happens:** Current workflow (163 lines) has basic result parsing but doesn't handle all checkpoint types
**How to avoid:** Workflow needs to handle: CI COMPLETE (display summary), CHECKPOINT REACHED:human-action (display and stop), CHECKPOINT REACHED:human-verify (display and ask user)
**Warning signs:** Workflow completes without showing user the CI outcome details

## Code Examples

### Example 1: Project Context Block (from executor, adapt for CI)
```markdown
<project_context>
Before executing, discover project context:

**Project instructions:** Read `./AGENTS.md` if it exists in the working directory. Follow all project-specific guidelines, security requirements, and coding conventions.

**Project skills:** Check `.agents/skills/` directory if it exists:
1. List available skills (subdirectories)
2. Read `SKILL.md` for each skill (lightweight index ~130 lines)
3. Load specific `rules/*.md` files as needed during CI operations
4. Do NOT load full `AGENTS.md` files (100KB+ context cost)
5. Follow skill rules relevant to fix decisions

This ensures project-specific patterns are applied when fixing CI failures.
</project_context>
```

### Example 2: CI-Specific Deviation Rules Structure
```markdown
<deviation_rules>
When CI checks fail, classify and handle each failure:

**RULE 1: Auto-fix simple true positives**
Trigger: Low-complexity code scanning alert with clear fix
Examples: Unused imports, missing input sanitization (simple cases), hardcoded test credentials
Action: Fix inline → commit → repush → track as deviation

**RULE 2: Auto-fix build/lint/test failures**
Trigger: Non-scanning check failure (build error, lint error, test failure)
Examples: TypeScript error, ESLint violation, failing test from code change
Action: Read error output → attempt fix → commit → repush → track

**RULE 3: Dismiss false positives (low severity)**
Trigger: Note/warning severity alert that's clearly a false positive
Examples: Alert in test file, pattern match on variable name, vendored code
Action: Dismiss via API with reasoning → track as decision

**RULE 4: Escalate to user**
Trigger: Medium+ severity suspected false positive, or complex fix requiring architectural changes
Examples: Alert requiring new DB table, alert suggesting library replacement, ambiguous security finding
Action: STOP → return CHECKPOINT REACHED with alert details and recommendations

**RULE PRIORITY:**
1. Rule 4 applies → STOP (needs user judgment)
2. Rule 3 applies → Dismiss automatically with reasoning
3. Rules 1-2 apply → Fix automatically
4. Genuinely unsure → Rule 4 (ask)

**FIX ATTEMPT LIMIT:** After {MAX_FIX_ITERATIONS} attempts, return checkpoint with remaining issues.

**SCOPE BOUNDARY:** Only fix issues reported by CI checks. Do not proactively fix pre-existing issues in touched files.

**Config overrides:** Check `config.json` for project-specific deviation rules:
```bash
node $GSD_HOME/bin/gsd-tools.cjs util:config-get ci.deviation_rules 2>/dev/null
```
</deviation_rules>
```

### Example 3: State Ownership Check
```markdown
<step name="update_state">
**State ownership check:** Only update state when invoked directly (not spawned by parent workflow).

If prompt contains `<spawned_by>` tag, skip state updates — return data in CI COMPLETE for parent to record.

If invoked directly:
```bash
# Record decisions (auto-fixes, dismissals, escalations)
for decision in "${DECISIONS[@]}"; do
  node $GSD_HOME/bin/gsd-tools.cjs verify:state add-decision \
    --phase "ci" --summary "${decision}"
done

# Update session info
node $GSD_HOME/bin/gsd-tools.cjs verify:state record-session \
  --stopped-at "CI: ${STATUS} — PR ${PR_URL}"
```
</step>
```

### Example 4: TodoWrite Integration
```markdown
<step name="setup_progress">
Use TodoWrite to create high-level progress items:

TodoWrite([
  { id: "ci-push", title: "Push branch to remote", status: "in_progress" },
  { id: "ci-pr", title: "Create pull request", status: "pending" },
  { id: "ci-checks", title: "Wait for CI checks", status: "pending" },
  { id: "ci-analyze", title: "Analyze check results", status: "pending" },
  { id: "ci-fix", title: "Fix failures & repush", status: "pending" },
  { id: "ci-merge", title: "Merge pull request", status: "pending" }
])

Update each item to "in_progress" when starting, "completed" when done.
Skip items not needed (e.g., skip "Fix failures" if all checks pass).
</step>
```

### Example 5: CI COMPLETE with Timing (matches CONTEXT.md decision)
```markdown
## CI COMPLETE

**PR:** {PR_URL}
**Status:** {merged | checks-passed-awaiting-merge | needs-human-review}
**Checks:** {N} passed, {M} fixed, {K} dismissed (false positive)
**Iterations:** {fix_iteration_count} / {MAX_FIX_ITERATIONS}
**Merge:** {squash-merged | rebase-merged | merge-commit | pending | skipped}

**Timing:**
- Total duration: {total_time}
- Check wait time: {wait_time}
- Fix time: {fix_time}

**Decisions Made:**
| Decision | Type | Reasoning |
|----------|------|-----------|
| {description} | auto-fix / dismiss / escalate | {why} |

{If fixes applied:}
### Fixes Applied
| Alert | Rule | File | Fix |
|-------|------|------|-----|
| {id} | {rule_id} | {path} | {description} |

{If dismissed:}
### Dismissed (False Positives)
| Alert | Rule | Reason |
|-------|------|--------|
| {id} | {rule_id} | {reason} |
```

## Gap Analysis: Current vs Target

### What the CI Agent Has Today
| Feature | Status | Location |
|---------|--------|----------|
| PATH SETUP | Present | Line 15-19 |
| Role definition | Present | Lines 22-31 |
| Execution flow (7 steps) | Present | Lines 33-373 |
| Alert classification table | Present (inline) | Lines 203-220 |
| CI COMPLETE format | Present (basic) | Lines 376-399 |
| CHECKPOINT REACHED format | Partial (3 ad-hoc formats in different steps) | Lines 73-90, 288-313, 339-360 |

### What the CI Agent Needs
| Feature | Status | Effort | Reference |
|---------|--------|--------|-----------|
| `<project_context>` block | Missing | Copy + adapt (13 lines) | executor:33-46 |
| `<deviation_rules>` block | Missing (inline classification exists) | Extract + formalize (~50 lines) | executor:115-186 |
| `<structured_returns>` section | Missing (has `<completion_format>`) | Replace + extend (~45 lines) | executor:247-279, 453-469 |
| State updates via gsd-tools | Missing | Add `<step name="update_state">` + state ownership check (~30 lines) | executor:391-443 |
| TodoWrite progress tracking | Missing | Add `<step name="setup_progress">` + inline updates (~15 lines) | Pattern is straightforward |
| Consistent CHECKPOINT REACHED | Partial (3 different formats) | Unify into single `<checkpoint_return_format>` block | executor:247-279 |
| Timing in CI COMPLETE | Missing | Add start/end timestamps + duration calc (~10 lines) | CONTEXT.md decision |
| Decisions in CI COMPLETE | Missing | Add decisions table to return format (~10 lines) | CONTEXT.md decision |

### What the Workflow Needs
| Feature | Status | Effort | Reference |
|---------|--------|--------|-----------|
| Structured result parsing | Partial (basic) | Expand to handle all checkpoint types (~15 lines) | Current workflow lines 136-154 |
| State ownership signal | Missing | Add `<spawned_by>` convention to agent prompt (~5 lines) | CONTEXT.md decision |
| Pre-check display | Present | Already has prerequisite checks | No change needed |

### What the Command Wrapper Needs
| Feature | Status | Effort | Reference |
|---------|--------|--------|-----------|
| Proper `<process>` section | Present (basic) | Verify workflow reference is correct | commands/bgsd-github-ci.md |
| Orchestration gates | Present (delegates to workflow) | Verify gates are preserved | May need minor wording update |

## File Impact Summary

| File | Change Type | Estimated Delta |
|------|-------------|-----------------|
| `agents/gsd-github-ci.md` | Major restructure | +150-200 lines (409 → ~550-600) |
| `workflows/github-ci.md` | Moderate update | +20-30 lines (163 → ~185-195) |
| `commands/bgsd-github-ci.md` | Minor update (if any) | +0-5 lines |

## Open Questions

1. **State ownership detection mechanism**
   - What we know: CI agent needs to know if spawned by parent workflow
   - What's unclear: Exact detection method — `<spawned_by>` tag in prompt vs. flag vs. environment variable
   - Recommendation: Use `<spawned_by>` tag presence check — parent workflows already pass structured prompt blocks, this is the most consistent pattern. Agent's discretion per CONTEXT.md.

2. **Config.json schema for deviation overrides**
   - What we know: CONTEXT.md says "hardcoded sensible defaults with config.json overrides per project"
   - What's unclear: Exact schema (what keys, what values, nesting)
   - Recommendation: Simple severity threshold override: `ci.auto_dismiss_max_severity: "warning"`, `ci.auto_fix_max_severity: "medium"`. Agent's discretion per CONTEXT.md.

3. **Non-scanning check failure handling scope**
   - What we know: CONTEXT.md says "attempt fix using the same loop as code scanning alerts"
   - What's unclear: How to read error output from non-CodeQL checks (build, lint, test) — `gh pr checks` gives pass/fail but not error details
   - Recommendation: For non-scanning failures, read check details URL, or re-run the failing command locally (npm test, npm run build, npm run lint) to get error output. This is the same approach used in executor's fix loop.

## Sources

### Primary (HIGH confidence)
- `agents/gsd-executor.md` — Reference implementation for all target patterns (project_context, deviation_rules, structured_returns, state_updates, checkpoint format)
- `agents/gsd-planner.md` — Secondary reference for project_context and structured_returns
- `agents/gsd-github-ci.md` — Current implementation being overhauled
- `workflows/github-ci.md` — Current workflow being updated
- `commands/bgsd-github-ci.md` — Current command wrapper
- `.planning/phases/67-github-ci-agent-overhaul/67-CONTEXT.md` — User decisions constraining implementation

### Secondary (MEDIUM confidence)
- `agents/gsd-verifier.md` — Additional reference for structured_returns pattern
- `references/checkpoints.md` — Checkpoint protocol reference
- `agents/gsd-phase-researcher.md` — project_context block reference

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — All patterns come from existing agent definitions in this codebase, fully inspectable
- Architecture: HIGH — Target structure derived from gap analysis between current CI agent and executor reference
- Pitfalls: HIGH — Based on direct comparison of current agent gaps and CONTEXT.md constraints

**Research date:** 2026-03-08
**Valid until:** Indefinite (internal codebase patterns, no external dependencies)
