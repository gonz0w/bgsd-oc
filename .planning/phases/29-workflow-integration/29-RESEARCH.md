# Phase 29: Workflow Integration - Research

**Researched:** 2026-02-26
**Domain:** GSD workflow prompt engineering + CLI enhancement
**Confidence:** HIGH

## Summary

Phase 29 wires codebase intelligence into the GSD workflow `.md` files so executor agents automatically receive architectural context during plan execution. The work has three distinct parts: (1) injecting `codebase context --files` output into executor agent spawn prompts in execute-phase.md, (2) adding a pre-flight convention check that warns when plans touch files with known naming conventions, and (3) updating the standalone `codebase-impact` command to use the cached dependency graph when available.

All prerequisite commands already exist and are tested. The `codebase context --files` command (Phase 27) returns task-scoped context with imports, dependents, conventions, and risk levels within a 5K token budget. The convention data lives in `codebase-intel.json`. The dependency graph is cached in `intel.dependencies`. This phase is primarily workflow prompt editing (WKFL-01, WKFL-02) plus one CLI function update (WKFL-03).

**Primary recommendation:** Keep changes minimal and surgical — add codebase context injection points to existing workflow prompts, don't restructure workflows. The CLI change for WKFL-03 is a simple conditional at the top of the features module's `cmdCodebaseImpact`.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Execute-phase workflow spawns executor agents with `<files_to_read>` blocks — add `codebase context --files` call for the plan's `files_modified` list
- Context injection happens in the executor spawn prompt, not in the plan itself — plans stay clean, workflow adds context at spawn time
- Pass context as a `<codebase_context>` block in the executor prompt so agents can reference it during implementation
- Only inject if codebase intel exists — graceful no-op if `codebase analyze` hasn't been run
- Add a pre-flight step in execute-phase that runs `codebase context --files` for all files in the wave's plans
- Flag files where naming conventions differ from project conventions — advisory only, never block
- Convention warnings go in the executor prompt so the agent knows about them during implementation
- `codebase-impact` command updated to use cached dependency graph from `intel.dependencies` when available
- Fall back to current behavior (scanning files) when no cached graph exists

### Agent's Discretion
- Exact prompt formatting for injected codebase context
- How to handle large context (many files) — truncation strategy
- Whether to inject lifecycle info alongside task-scoped context
- Error handling for failed codebase queries (silent skip vs warning)

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| WKFL-01 | Execute-phase workflow auto-injects relevant codebase context based on plan file references | `codebase context --files` already returns structured JSON with imports, dependents, conventions, risk_level per file within 5K token budget. Plan `files_modified` frontmatter provides the file list. Integration point is the executor spawn prompt in execute-phase.md lines 207-241. |
| WKFL-02 | Pre-flight convention check warns before execution if plan touches files with known conventions | `codebase context --files` output already includes `conventions.naming` per file with pattern and confidence. Can extract convention warnings from the context output. Integration point is a new pre-flight step in execute-phase.md between existing pre-flights and wave execution. |
| WKFL-03 | Existing `codebase-impact` command updated to use cached dependency graph when available | Two implementations exist: `codebase impact` (codebase module, line 9795) already uses cached graph; `codebase-impact` (features module, line 13954) uses live grep. Need to add graph-first logic to the features module version. |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| gsd-tools.cjs | current | All CLI operations | Single-file zero-dependency architecture per project rules |
| workflows/*.md | current | Agent prompt definitions | Markdown workflow files are the prompt layer |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `codebase context --files` | Phase 27 | Task-scoped context with 5K token budget | Extracting architectural context for files |
| `codebase conventions` | Phase 24 | Convention data with confidence scores | Convention checking |
| `intel.dependencies` | Phase 25 | Cached dependency graph (forward + reverse adjacency lists) | Impact analysis with cached data |

### Alternatives Considered
None — this phase uses existing infrastructure exclusively.

## Architecture Patterns

### Current Executor Spawn Pattern (execute-phase.md Mode B, lines 207-241)
```markdown
Task(
  subagent_type="gsd-executor",
  model="{executor_model}",
  prompt="
    <objective>...</objective>
    <execution_context>
    @execute-plan.md
    @summary.md
    </execution_context>
    <files_to_read>
    Read these files at execution start using the Read tool:
    - {phase_dir}/{plan_file} (Plan)
    - .planning/STATE.md (State)
    - .planning/config.json (Config, if exists)
    - ./AGENTS.md (Project instructions, if exists)
    </files_to_read>
    <success_criteria>...</success_criteria>
  "
)
```

### Pattern 1: Codebase Context Injection (WKFL-01)
**What:** Before spawning executor agents, run `codebase context --files` for the plan's `files_modified` list, then pass the output as a `<codebase_context>` block in the executor prompt.
**When to use:** Every plan execution when codebase intel exists.
**Integration point:** execute-phase.md, inside the executor spawn prompt construction, after `<files_to_read>` and before `<success_criteria>`.

```markdown
# In execute-phase.md, before spawning executor for each plan:
PLAN_FILES=$(node gsd-tools.cjs frontmatter "${PLAN_PATH}" --field files_modified --raw 2>/dev/null)

# Only if codebase intel exists AND plan has files_modified:
CODEBASE_CTX=$(node gsd-tools.cjs codebase context --files ${PLAN_FILES} --plan ${PLAN_PATH} --raw 2>/dev/null)

# If CODEBASE_CTX succeeded, add to executor prompt:
<codebase_context>
{CODEBASE_CTX output — imports, dependents, conventions, risk levels}
</codebase_context>
```

### Pattern 2: Pre-flight Convention Check (WKFL-02)
**What:** Before executing a wave, collect all `files_modified` from the wave's plans, run `codebase context --files` to get convention data, and warn about any convention mismatches.
**When to use:** As a pre-flight step, after existing pre-flights (dependency check, state validation, worktree check) but before wave execution.

```markdown
# Collect all files from wave's plans
ALL_WAVE_FILES=$(for each plan in wave: extract files_modified → deduplicate)

# Run context check
CTX=$(node gsd-tools.cjs codebase context --files ${ALL_WAVE_FILES} --raw 2>/dev/null)

# Extract convention warnings from CTX output
# Convention mismatch: file uses different naming than project convention
```

### Pattern 3: codebase-impact Graph Upgrade (WKFL-03)
**What:** In the features module `cmdCodebaseImpact` (line 13954), add a graph-first path that uses `intel.dependencies` when available.
**When to use:** Whenever `codebase-impact` is called and cached intel exists.

```javascript
// At top of features cmdCodebaseImpact:
const intel = readIntel(cwd);
if (intel && intel.dependencies) {
  // Delegate to codebase module's graph-based implementation
  return lazyCodebase().cmdCodebaseImpact(cwd, filePaths, raw);
}
// Fall through to existing grep-based implementation
```

### Anti-Patterns to Avoid
- **Restructuring workflows:** Don't change the overall flow of execute-phase.md. Add context injection as a discrete step, don't interleave with existing logic.
- **Blocking on missing intel:** Never make codebase intel a prerequisite. Always graceful no-op. Projects without `codebase analyze` must work identically to before.
- **Injecting too much context:** The `codebase context --files` command already enforces a 5K token budget. Don't add additional context (lifecycle, full dependency tree) beyond what this returns.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| File context extraction | Custom per-file analysis | `codebase context --files` | Already handles scoring, budget, degradation |
| Convention checking | Custom naming analysis | `codebase context --files` conventions field | Already returns naming pattern + confidence per file |
| Dependency impact | New dependency scanning | `intel.dependencies` graph | Already built with forward + reverse adjacency lists |
| Frontmatter extraction | Custom PLAN.md parsing | `gsd-tools.cjs frontmatter --field files_modified` | Already exists, handles arrays and strings |

**Key insight:** All the intelligence layer is built. This phase just wires existing outputs into existing prompts.

## Common Pitfalls

### Pitfall 1: Breaking Projects Without Codebase Intel
**What goes wrong:** Workflow fails or behaves differently when `codebase-intel.json` doesn't exist.
**Why it happens:** Commands return errors instead of graceful no-ops.
**How to avoid:** Guard every codebase command with `2>/dev/null` and check for success before using output. If command fails, skip the injection silently.
**Warning signs:** Execute-phase workflow throws errors on projects that haven't run `codebase analyze`.

### Pitfall 2: Token Budget Explosion
**What goes wrong:** Injecting codebase context pushes executor agent over its context budget.
**Why it happens:** Plan has many `files_modified`, each with imports/dependents.
**How to avoid:** `codebase context --files` already enforces 5K token budget with degradation. Trust the existing budget enforcement. Don't add extra context on top.
**Warning signs:** Executor agents seem confused or truncate their own output.

### Pitfall 3: Convention Warnings as Noise
**What goes wrong:** Every file gets a convention warning, desensitizing agents to real issues.
**Why it happens:** Convention confidence is too low, or warnings are too generic.
**How to avoid:** Only warn when convention confidence is HIGH (>80%) and the new file's naming pattern would violate it. Advisory only — log as `⚠` prefix, never block.
**Warning signs:** Agents spending time on convention fixes instead of their actual task.

### Pitfall 4: Two cmdCodebaseImpact Implementations Diverge
**What goes wrong:** `codebase impact` and `codebase-impact` return different formats after WKFL-03.
**Why it happens:** The features module version (grep-based) has a different output shape than the codebase module version (graph-based).
**How to avoid:** When cached graph exists, delegate from features to codebase module entirely (same output format). When falling back to grep, keep existing format.
**Warning signs:** Downstream consumers (cmd-codebase-impact.md workflow) break on output format changes.

### Pitfall 5: Worktree Mode Context Path
**What goes wrong:** Codebase context commands fail in worktree directories because `codebase-intel.json` is in the main working directory.
**Why it happens:** Worktrees have a different path than the main repo.
**How to avoid:** Check if worktree mode is active. If so, the codebase intel should still be accessible (worktrees share .git). Verify `readIntel(cwd)` works from worktree paths.
**Warning signs:** Plans executed in worktrees don't get codebase context.

## Code Examples

### Existing: How execute-phase.md spawns executors (Mode B, line 207)
```markdown
Task(
  subagent_type="gsd-executor",
  model="{executor_model}",
  prompt="
    <objective>
    Execute plan {plan_number} of phase {phase_number}-{phase_name}.
    </objective>
    <execution_context>
    @/home/cam/.config/opencode/get-shit-done/workflows/execute-plan.md
    @/home/cam/.config/opencode/get-shit-done/templates/summary.md
    </execution_context>
    <files_to_read>
    - {phase_dir}/{plan_file} (Plan)
    - .planning/STATE.md (State)
    - .planning/config.json (Config, if exists)
    - ./AGENTS.md (Project instructions, if exists)
    </files_to_read>
    <success_criteria>...</success_criteria>
  "
)
```

### Existing: codebase context --files output format
```json
{
  "success": true,
  "files": {
    "src/lib/state.js": {
      "imports": ["src/lib/helpers.js", "src/lib/output.js"],
      "dependents": ["src/router.js", "src/commands/features.js"],
      "conventions": {
        "naming": { "pattern": "kebab-case", "confidence": 95 },
        "frameworks": [{ "framework": "node", "evidence": ["require()", "module.exports"] }]
      },
      "risk_level": "caution",
      "relevance_score": 1.0
    }
  },
  "file_count": 1,
  "truncated": false,
  "omitted_files": 0
}
```

### Existing: features cmdCodebaseImpact (line 13954) — grep-based
```javascript
function cmdCodebaseImpact(cwd, filePaths, raw) {
  // Scans files with grep for import references
  // Returns: { files_analyzed, total_dependents, overall_risk, files[] }
  // Each file: { path, exists, dependent_count, dependents[], risk }
}
```

### Existing: codebase cmdCodebaseImpact (line 9795) — graph-based
```javascript
function cmdCodebaseImpact(cwd, args, raw) {
  const intel = readIntel(cwd);
  let graph = intel.dependencies;
  if (!graph) {
    graph = buildDependencyGraph(intel);
    intel.dependencies = graph;
    writeIntel(cwd, intel);
  }
  // Uses getTransitiveDependents(graph, filePath)
  // Returns: { success, files[] } — each with transitive dependents from graph
}
```

### Existing: Pre-flight pattern in execute-phase.md
```markdown
<step name="preflight_dependency_check">
DEPS=$(node gsd-tools.cjs validate-dependencies "${PHASE_NUMBER}" --raw 2>/dev/null)
# Parse for valid (bool) and issues (array)
# If valid or command fails: continue silently
</step>
```

## Integration Details

### WKFL-01: Execute-phase Context Injection

**Files to modify:** `workflows/execute-phase.md`

**Where:** Inside the executor spawn prompt construction (both Mode A and Mode B), add codebase context between `<files_to_read>` and `<success_criteria>`.

**Mechanism:**
1. Before spawning each executor, extract `files_modified` from the plan's frontmatter
2. Run `codebase context --files {files_modified} --plan {plan_path} --raw`
3. If successful, format as `<codebase_context>` block and include in spawn prompt
4. If command fails (no intel, no files), skip silently — no `<codebase_context>` block

**Prompt format (Agent's Discretion — recommendation):**
```markdown
<codebase_context>
Architectural context for files this plan modifies.
Use this to understand import relationships, naming conventions, and risk levels.

{JSON output from codebase context --files}
</codebase_context>
```

**Truncation strategy (Agent's Discretion — recommendation):**
The `codebase context --files` command already enforces a 5K token budget with multi-level degradation (trim dependents → trim imports → remove conventions → remove graphs → drop low-relevance files). No additional truncation needed. If a plan has >10 files in `files_modified`, the command handles it.

**Error handling (Agent's Discretion — recommendation):**
Silent skip. Use `2>/dev/null` and check exit code. Log a single-line `ℹ Codebase context: not available (no intel)` in verbose mode only. Never warn the user — this is purely additive.

### WKFL-02: Pre-flight Convention Check

**Files to modify:** `workflows/execute-phase.md`

**Where:** New step `preflight_convention_check` after `preflight_worktree_check` and before `discover_and_group_plans`.

**Mechanism:**
1. Collect all `files_modified` from all incomplete plans in the phase
2. Run `codebase context --files {all_files} --raw`
3. Parse conventions from output
4. For each file where conventions exist: check if the file path follows the detected naming pattern
5. Log advisory warnings for mismatches

**Warning format:**
```
⚠ Convention advisory:
  src/NewComponent.tsx — project uses kebab-case (95% confidence) in this directory
  lib/myHelper.js — project uses snake_case (88% confidence) in this directory
```

**Important:** This checks the file NAMES in the plan against known conventions. It does NOT check file contents (those don't exist yet). The convention data comes from `codebase context --files` which returns `conventions.naming.pattern` per file.

### WKFL-03: codebase-impact Graph Integration

**Files to modify:** `bin/gsd-tools.cjs`

**Where:** Features module `cmdCodebaseImpact` function (line 13954)

**Mechanism:**
1. At the top of the function, attempt to read intel: `readIntel(cwd)`
2. If intel exists AND `intel.dependencies` exists: use the codebase module's graph-based `cmdCodebaseImpact` instead
3. If no intel or no dependencies: fall through to existing grep-based implementation

**Key consideration:** The two implementations return different output formats. The features version returns `{ files_analyzed, total_dependents, overall_risk, files[] }`. The codebase version returns `{ success, files[] }`. The WKFL-03 requirement says "uses cached dependency graph when available" — simplest approach is to keep the features output format but source data from the graph when available, rather than delegating entirely to the codebase module.

## Open Questions

1. **Lifecycle info injection**
   - What we know: CONTEXT.md lists this as Agent's Discretion — "Whether to inject lifecycle info alongside task-scoped context"
   - What's unclear: Whether lifecycle info (seeds, migrations, boot order) adds value during plan execution
   - Recommendation: Skip for now. Lifecycle is primarily useful for understanding execution order, which is more relevant during planning than execution. Can add later if agents make lifecycle-related mistakes.

2. **map-codebase workflow integration**
   - What we know: CONTEXT.md says the phase description mentions map-codebase, but the actual requirements and CONTEXT.md decisions don't include it
   - What's unclear: Whether map-codebase needs codebase intelligence integration
   - Recommendation: Out of scope per CONTEXT.md decisions. map-codebase is an exploration workflow, not an execution workflow.

## Sources

### Primary (HIGH confidence)
- `workflows/execute-phase.md` — current executor spawn pattern, pre-flight steps (read directly)
- `workflows/execute-plan.md` — current plan execution flow (read directly)
- `workflows/plan-phase.md` — current planning flow (read directly)
- `bin/gsd-tools.cjs` lines 9795-10198 — codebase module: cmdCodebaseImpact, cmdCodebaseContext, scoreRelevance, enforceTokenBudget (read directly)
- `bin/gsd-tools.cjs` lines 13954-14044 — features module: cmdCodebaseImpact grep-based (read directly)
- `bin/gsd-tools.cjs` lines 16220-16237 — routing: both `codebase impact` and `codebase-impact` commands (read directly)
- `.planning/REQUIREMENTS.md` — WKFL-01, WKFL-02, WKFL-03 definitions (read directly)
- `.planning/phases/29-workflow-integration/29-CONTEXT.md` — locked decisions and discretion areas (read directly)

### Secondary (MEDIUM confidence)
- Previous phase summaries (Phases 24-28) — convention, dependency, lifecycle, context features (referenced from STATE.md decisions)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all tools are internal, read directly from source
- Architecture: HIGH — workflow patterns read from actual files, integration points identified precisely with line numbers
- Pitfalls: HIGH — based on understanding of the codebase and existing error handling patterns

**Research date:** 2026-02-26
**Valid until:** 2026-03-26 (stable — internal tooling, no external dependencies)
