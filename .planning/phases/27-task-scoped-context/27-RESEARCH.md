# Phase 27: Task-Scoped Context - Research

**Researched:** 2026-02-26
**Domain:** CLI command engineering — per-file architectural context assembly with heuristic scoring and token budgeting
**Confidence:** HIGH

## Summary

Phase 27 adds a `codebase context --files <paths>` command that assembles per-file architectural context from already-cached intel data (dependency graph from Phase 25, conventions from Phase 24) and returns it as structured JSON under a 5K token hard cap. The core challenge is the heuristic relevance scoring algorithm (graph distance 50%, plan scope 30%, git recency 20%) and the graceful degradation logic that trims output to fit the budget without partial entries.

All data sources already exist in `codebase-intel.json` — `intel.dependencies` (forward/reverse adjacency lists), `intel.conventions` (naming, file_organization, frameworks), and `intel.files` (per-file metadata). No new analysis is needed; this phase reshapes cached data into a task-scoped view. The `<100ms from cached intel` performance target is achievable since all operations are in-memory lookups on JSON objects already loaded by `readIntel()`.

**Primary recommendation:** Implement as a new `cmdCodebaseContext()` function in `src/commands/codebase.js` (the `require_codebase` module), following the exact pattern of `cmdCodebaseImpact()` — read intel, auto-build graph if missing, assemble per-file results, output JSON. The scoring and budget logic should be pure functions for testability.

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions
- **Context density per file:** Show direct imports (1-hop) and direct dependents (1-hop), not full transitive trees. Max 8 imports and 8 dependents per file sorted by fan-in/fan-out. Risk level: high fan-in (>10 dependents) = "high risk", has cycles = "caution", else "normal". Convention info: applicable naming pattern + framework patterns for file type. Files with no intel data return `{ file, status: "no-data", conventions: null }`.
- **Relevance scoring heuristics:** Three signals: graph distance (50%), plan scope (30%), git recency (20%). Graph distance: 1-hop highest, 2-hop half, 3+ excluded. Plan scope: files in current plan's `files_modified` get boost. Git recency: files modified in last 10 commits get boost. Hard cutoff: top results that fit token budget, no partial entries (each file is atomic).
- **Output shape:** Structured JSON grouped by file path. Fields per file: `imports[]`, `dependents[]`, `conventions{}`, `risk_level`, `relevance_score`. `--raw` outputs JSON, without flag outputs human-readable table. Designed for prompt injection.
- **Token budget:** 5K hard cap per invocation. Divide budget equally across files, then scoring trims. Degradation order: drop dependents → drop imports to top-3 → drop conventions → drop to file+risk only. Truncated results include `truncated: true` and `omitted_files: N`. Single file gets full budget; 10+ files get sparse summaries.

### Agent's Discretion
- Exact JSON field names and nesting structure
- Human-readable table format
- Whether to cache scored results or recompute per invocation
- Internal scoring algorithm implementation (as long as weights are respected)

### Deferred Ideas
None — discussion stayed within phase scope.

</user_constraints>

<phase_requirements>

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| CTXI-02 | `codebase context --files <paths>` returns per-file imports, dependents, conventions, risk level | Existing `cmdCodebaseImpact` pattern provides exact template; `intel.dependencies.forward` gives imports, `intel.dependencies.reverse` gives dependents, `intel.conventions` gives naming/framework patterns |
| CTXI-03 | Heuristic scoring (graph distance + plan scope + git recency) for relevance ranking | Graph distance from `intel.dependencies.forward/reverse` BFS; plan scope from `extractFrontmatter(planContent).files_modified`; git recency from `execGit(cwd, ["log", "-10", "--name-only", ...])` |
| CTXI-04 | Total injected context never exceeds 5K tokens per invocation | `estimateJsonTokens()` from `require_context()` provides accurate token counting; budget enforcement as post-assembly trim loop |

</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Node.js stdlib (`fs`, `path`, `child_process`) | N/A | File I/O, path manipulation, git commands | Zero-dependency constraint (C-01) |
| `require_codebase_intel()` | internal | `readIntel()`, `writeIntel()`, `INTEL_PATH()` | Existing cache layer all codebase commands use |
| `require_deps()` | internal | `buildDependencyGraph()`, `findCycles()`, `getTransitiveDependents()` | Phase 25 infrastructure for dependency lookups |
| `require_conventions()` | internal | `extractConventions()`, `generateRules()` | Phase 24 infrastructure for convention data |
| `require_context()` | internal | `estimateTokens()`, `estimateJsonTokens()`, `checkBudget()` | Tokenx-based estimation, already used by context-budget command |
| `require_git()` | internal | `execGit()` | Safe git command execution for recency checks |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `require_output()` | internal | `output()`, `error()`, `debugLog()` | Standard CLI output for --raw JSON vs human-readable |
| `require_frontmatter()` | internal | `extractFrontmatter()` | Reading plan `files_modified` for plan-scope signal |

### Alternatives Considered
None — all infrastructure is internal and already established by Phases 23-26.

## Architecture Patterns

### Recommended Structure Within gsd-tools.cjs

The new command slots into the existing `require_codebase` module (`src/commands/codebase.js` section, line ~8850):

```
require_codebase module:
├── cmdCodebaseAnalyze()    # Phase 23
├── cmdCodebaseStatus()     # Phase 23
├── cmdCodebaseConventions() # Phase 24
├── cmdCodebaseRules()      # Phase 24
├── cmdCodebaseDeps()       # Phase 25
├── cmdCodebaseImpact()     # Phase 25
└── cmdCodebaseContext()    # Phase 27 (NEW)
```

Router addition at line ~15414:
```javascript
} else if (sub === "context") {
  lazyCodebase().cmdCodebaseContext(cwd, args.slice(2), raw);
}
```

### Pattern 1: Command Structure (follow cmdCodebaseImpact)

**What:** Load intel → auto-build missing data → assemble result → output
**When to use:** Every codebase subcommand follows this
**Example (from existing cmdCodebaseImpact, line 9169):**
```javascript
function cmdCodebaseContext(cwd, args, raw) {
  const filesIdx = args.indexOf("--files");
  const filePaths = args.filter(a => !a.startsWith("-"));
  // or: filePaths = args after --files until next flag
  
  if (!filePaths.length) {
    error("Usage: codebase context --files <file1> [file2] ...");
    return;
  }
  
  const intel = readIntel(cwd);
  if (!intel) {
    error("No codebase intel. Run: codebase analyze");
    return;
  }
  
  // Auto-build graph if missing (same as cmdCodebaseImpact)
  let graph = intel.dependencies;
  if (!graph) {
    graph = buildDependencyGraph(intel);
    intel.dependencies = graph;
    writeIntel(cwd, intel);
  }
  
  // Auto-extract conventions if missing (same as cmdCodebaseRules)
  let conventions = intel.conventions;
  if (!conventions) {
    conventions = extractConventions(intel, { cwd });
    intel.conventions = conventions;
    writeIntel(cwd, intel);
  }
  
  // Optional: --plan <path> for plan-scope signal
  const planIdx = args.indexOf("--plan");
  const planPath = planIdx !== -1 ? args[planIdx + 1] : null;
  
  const result = assembleContext(intel, filePaths, { cwd, planPath });
  output(result, raw);
}
```

### Pattern 2: Heuristic Scoring as Pure Function

**What:** Score relevance of context items relative to target files
**When to use:** When ranking what to include within the token budget
**Approach:**
```javascript
function scoreRelevance(file, targetFiles, graph, planFiles, recentFiles) {
  let score = 0;
  
  // Graph distance (50% weight): is this file 1-hop from a target?
  const is1Hop = targetFiles.some(t => 
    (graph.forward[t] || []).includes(file) || 
    (graph.reverse[t] || []).includes(file)
  );
  const is2Hop = /* BFS check */;
  if (is1Hop) score += 0.50;
  else if (is2Hop) score += 0.25;
  
  // Plan scope (30% weight): is this file in plan's files_modified?
  if (planFiles.includes(file)) score += 0.30;
  
  // Git recency (20% weight): was this file modified in last 10 commits?
  if (recentFiles.includes(file)) score += 0.20;
  
  return score;
}
```

### Pattern 3: Token Budget Enforcement with Graceful Degradation

**What:** Assemble full context, then trim to fit 5K token budget
**When to use:** After scoring, when building the final output
**Approach:**
```javascript
function enforceTokenBudget(fileContexts, maxTokens = 5000) {
  // Try full output first
  let tokens = estimateJsonTokens(fileContexts);
  if (tokens <= maxTokens) return { files: fileContexts, truncated: false };
  
  // Degradation levels (per CONTEXT.md decisions):
  // 1. Drop dependents beyond top-3
  // 2. Drop imports beyond top-3
  // 3. Drop conventions
  // 4. Drop to file + risk_level only
  // 5. Drop lowest-scored files entirely
  
  const levels = [
    (ctx) => { ctx.dependents = ctx.dependents.slice(0, 3); },
    (ctx) => { ctx.imports = ctx.imports.slice(0, 3); },
    (ctx) => { delete ctx.conventions; },
    (ctx) => { delete ctx.imports; delete ctx.dependents; },
  ];
  
  for (const degrade of levels) {
    for (const ctx of fileContexts) degrade(ctx);
    tokens = estimateJsonTokens(fileContexts);
    if (tokens <= maxTokens) return { files: fileContexts, truncated: true, omitted_files: 0 };
  }
  
  // Last resort: drop lowest-scored files
  fileContexts.sort((a, b) => b.relevance_score - a.relevance_score);
  while (tokens > maxTokens && fileContexts.length > 1) {
    fileContexts.pop();
    tokens = estimateJsonTokens(fileContexts);
  }
  
  return { files: fileContexts, truncated: true, omitted_files: originalCount - fileContexts.length };
}
```

### Anti-Patterns to Avoid

- **Reading files from disk at query time:** All data must come from `intel` cache. The only disk read should be `readIntel()` (and optionally a plan file for `--plan`). Reading source files would blow the <100ms target.
- **Transitive tree expansion:** CONTEXT.md explicitly says 1-hop only for imports/dependents. `getTransitiveDependents()` exists but does full BFS — use direct array lookups on `graph.forward[file]` and `graph.reverse[file]` instead.
- **Calling `estimateTokens()` per field:** Token estimation has overhead from the tokenx library. Estimate on the full JSON string once, not per-field. Only re-estimate after degradation steps.
- **Breaking atomic file entries:** Each file's context is all-or-nothing per CONTEXT.md. Never include a file with partial fields missing unless it's a degradation step applied to ALL files equally.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Token estimation | Character-count heuristic | `estimateTokens()` / `estimateJsonTokens()` from `require_context()` | Already uses tokenx BPE-based estimation; fallback to `ceil(len/4)` |
| Dependency graph | New import parsing | `intel.dependencies.forward` / `intel.dependencies.reverse` | Phase 25 already built it; just do O(1) lookups |
| Convention matching | New file scanning | `intel.conventions.naming`, `intel.conventions.frameworks` | Phase 24 already extracted; match by file path/extension |
| Git recency | Custom git log parsing | `execGit(cwd, ["log", "-10", "--name-only", "--pretty=format:", "--no-merges"])` | Standard git command, already used throughout codebase |
| Cycle detection | Manual graph traversal | `findCycles(graph)` from `require_deps()` | Tarjan's SCC already implemented in Phase 25 |

**Key insight:** This phase is purely an assembly layer. Every data source already exists. The value is in the scoring, budgeting, and output shaping — not in new analysis.

## Common Pitfalls

### Pitfall 1: Token Budget Off-By-One
**What goes wrong:** JSON serialization adds structural overhead (braces, quotes, commas) that heuristic estimates miss, causing the 5K cap to be exceeded.
**Why it happens:** Estimating tokens on individual file objects, then summing, misses the wrapper object overhead.
**How to avoid:** Always estimate on the complete serialized output `JSON.stringify(fullResult)`, not on individual parts.
**Warning signs:** Tests pass with small inputs but fail at 5+ files.

### Pitfall 2: Missing Files in Graph
**What goes wrong:** User passes a file path that exists on disk but isn't in `intel.files` (e.g., newly created file, or file in `.gitignore`).
**Why it happens:** Intel is generated from `walkSourceFiles()` which skips certain patterns.
**How to avoid:** Return `{ file, status: "no-data", conventions: null }` stub per CONTEXT.md decision. Never crash.
**Warning signs:** Error output instead of graceful degradation.

### Pitfall 3: Git Recency Subprocess Latency
**What goes wrong:** `execGit()` for the last-10-commits lookup takes 50+ ms, blowing the 100ms budget.
**Why it happens:** `execFileSync` has spawn overhead + git has index lock contention.
**How to avoid:** Consider caching the recency set for the session, or making it optional (skip recency boost if git command is slow). The git log for 10 commits should be fast, but monitor.
**Warning signs:** Command consistently takes >100ms; profile shows git as bottleneck.

### Pitfall 4: Plan Path Resolution
**What goes wrong:** `--plan` flag provided but path doesn't resolve, or plan has no `files_modified` frontmatter.
**Why it happens:** Plans are in `.planning/phases/XX-name/XX-NN-PLAN.md` — user might pass relative or absolute path.
**How to avoid:** Use `path.resolve(cwd, planPath)` and gracefully fall back to zero plan-scope boost if file is unreadable or has no `files_modified`.
**Warning signs:** Plan scope signal is always zero.

### Pitfall 5: Convention Matching by File Type
**What goes wrong:** Conventions are stored at project level (overall naming, directory patterns) but need to be matched to specific files.
**Why it happens:** Phase 24 conventions are aggregate data, not per-file.
**How to avoid:** Match conventions by: (a) file extension → naming pattern for that type, (b) directory → directory-level conventions from `conventions.naming.by_directory`, (c) framework patterns by checking if file path matches framework detector patterns.
**Warning signs:** All files get the same convention info regardless of type/location.

## Code Examples

### Example 1: Reading 1-Hop Imports and Dependents from Graph

```javascript
// Source: existing intel.dependencies structure (Phase 25, gsd-tools.cjs:8730)
const graph = intel.dependencies;
const file = "src/commands/codebase.js";

// Direct imports (what this file imports)
const imports = (graph.forward[file] || []).slice(0, 8);

// Direct dependents (what imports this file)
const dependents = (graph.reverse[file] || []).slice(0, 8);

// Sort by fan-in (most-imported first) for imports
imports.sort((a, b) => (graph.reverse[b] || []).length - (graph.reverse[a] || []).length);

// Sort by fan-out (most-importing first) for dependents
dependents.sort((a, b) => (graph.forward[b] || []).length - (graph.forward[a] || []).length);
```

### Example 2: Risk Level Computation

```javascript
// Source: CONTEXT.md decisions on risk level
function computeRiskLevel(file, graph, cycleFiles) {
  const dependentCount = (graph.reverse[file] || []).length;
  if (dependentCount > 10) return "high";
  if (cycleFiles.has(file)) return "caution";
  return "normal";
}

// Get cycle files from findCycles (Phase 25)
const { findCycles } = require_deps();
const cycleData = findCycles(graph);
const cycleFiles = new Set();
for (const scc of cycleData.cycles) {
  for (const f of scc) cycleFiles.add(f);
}
```

### Example 3: Git Recency Check (Last 10 Commits)

```javascript
// Source: execGit pattern used throughout gsd-tools.cjs
function getRecentlyModifiedFiles(cwd, commitCount = 10) {
  const result = execGit(cwd, [
    "log", `-${commitCount}`, "--name-only", "--pretty=format:", "--no-merges"
  ]);
  if (result.exitCode !== 0) return new Set();
  return new Set(result.stdout.split("\n").filter(f => f.trim().length > 0));
}
```

### Example 4: Plan Scope Signal

```javascript
// Source: extractFrontmatter pattern (gsd-tools.cjs:4877)
function getPlanFiles(planPath) {
  if (!planPath) return [];
  try {
    const content = fs.readFileSync(planPath, "utf-8");
    const fm = extractFrontmatter(content);
    if (Array.isArray(fm.files_modified)) return fm.files_modified;
    if (typeof fm.files_modified === "string" && fm.files_modified.trim()) return [fm.files_modified];
  } catch (e) {
    debugLog("context.planFiles", "read failed", e);
  }
  return [];
}
```

### Example 5: Token Budget Enforcement

```javascript
// Source: estimateJsonTokens from require_context() (gsd-tools.cjs:11341)
const { estimateJsonTokens } = require_context();

function fitsInBudget(result, maxTokens = 5000) {
  return estimateJsonTokens(result) <= maxTokens;
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Full codebase in context | Task-scoped injection (<5K tokens) | Phase 26-27 | Models degrade past 25-30K; scoped context prevents this |
| No relevance ranking | Heuristic scoring (graph + plan + recency) | Phase 27 | Agents get the most relevant context, not just nearest files |
| Prose context dumps | Structured JSON for agents | Phase 27 | Agents parse programmatically; eliminates interpretation errors |

## Open Questions

1. **`--plan` flag: auto-detect or explicit?**
   - What we know: Plan path is needed for plan-scope signal. Executor agents have the plan path available.
   - What's unclear: Should the command auto-detect the current plan from STATE.md, or require explicit `--plan <path>`?
   - Recommendation: Require explicit `--plan` — keeps the command stateless and testable. Auto-detection adds complexity with marginal benefit since executor agents already know their plan path.

2. **Convention matching granularity**
   - What we know: Conventions are stored at project level and directory level, not per-file.
   - What's unclear: How to determine which conventions apply to a specific file — just by directory? By extension? By framework patterns?
   - Recommendation: Match by directory first (`conventions.naming.by_directory[dirOf(file)]`), fall back to overall (`conventions.naming.overall`), and include matching framework patterns. This is agent's discretion per CONTEXT.md.

3. **Caching scored results**
   - What we know: CONTEXT.md leaves caching as agent's discretion.
   - What's unclear: Whether the overhead of recomputing scores per invocation matters at the <100ms target.
   - Recommendation: Don't cache scored results — the inputs change per invocation (different files, different plan, different git state). The scoring is pure math on in-memory data; it should be fast enough. Optimize only if profiling shows a problem.

## Sources

### Primary (HIGH confidence)
- `gsd-tools.cjs` source code — direct inspection of all referenced functions and data structures
- Phase 25 dependency graph: `buildDependencyGraph()` at line 8684, `getTransitiveDependents()` at line 8798
- Phase 24 conventions: `extractConventions()` at line 8322, `generateRules()` at line 8354
- Phase 26 context injection: `formatCodebaseContext()` at line 9775, `autoTriggerCodebaseIntel()` at line 9029
- Token estimation: `estimateTokens()` at line 11331, `estimateJsonTokens()` at line 11341
- Intel I/O: `readIntel()` at line 7920, `writeIntel()` at line 7931
- Existing codebase commands: `cmdCodebaseImpact()` at line 9169, `cmdCodebaseDeps()` at line 9146
- Router dispatch: line 15414 (codebase subcommand switch)

### Secondary (MEDIUM confidence)
- `27-CONTEXT.md` — locked decisions from phase discussion
- `.planning/REQUIREMENTS.md` — CTXI-02, CTXI-03, CTXI-04 definitions
- `.planning/INTENT.md` — DO-07 (task-scoped context) and SC-06 (queryable artifacts)
- `AGENTS.md` — development rules (zero dependencies, single file, backward compatible)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all internal modules, verified by reading source code
- Architecture: HIGH — follows established patterns from Phases 23-26, all code inspected
- Pitfalls: HIGH — derived from actual code paths and data structures examined
- Scoring algorithm: MEDIUM — weights are specified by CONTEXT.md, but exact implementation is agent's discretion; the code examples are recommendations not verified patterns

**Research date:** 2026-02-26
**Valid until:** indefinite (internal codebase patterns; no external dependencies to go stale)
