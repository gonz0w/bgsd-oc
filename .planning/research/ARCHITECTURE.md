# Architecture Research: v8.2 Audit & Validation Patterns

**Domain:** CLI + agent system hardening — module boundary validation, dead export detection, command-agent-workflow connection auditing  
**Researched:** 2026-03-06  
**Overall confidence:** HIGH  
**Mode:** Ecosystem — What exists for validating and tightening a CJS CLI + markdown agent system?

## Executive Summary

v8.2 audits and hardens a system with four interconnected layers: **34 src/ modules** (18 lib + 14 commands + router + index), **9 AI agents** with manifests, **41 slash commands** in markdown, and **45 workflow files**. The central challenge is that no single tool validates the connections *between* these layers. JavaScript dead-code tools (Knip, no-dead-code) handle module→module dependencies well. But the command→workflow→agent chain lives in markdown files with `@path` references and `gsd-tools` CLI invocations embedded in prose — invisible to any JavaScript analysis tool.

The recommended architecture splits validation into three tiers:

1. **JavaScript module validation** (automated) — Use the project's own AST tooling (`src/lib/ast.js` already has `extractExports`, `extractCjsExports`) plus Knip for cross-validation to find dead exports, unused functions, and circular dependencies within `src/`.

2. **Connection graph validation** (new CLI command) — Build a custom `audit:connections` command that parses markdown files (commands/, workflows/, agents/) to extract `gsd-tools` invocations, `@path` references, and `agent:` frontmatter declarations, then cross-references against actual CLI routes in `router.js` and actual agent files. This is the novel piece no off-the-shelf tool provides.

3. **Performance validation** (instrumented) — Use the existing `GSD_PROFILE=1` profiler infrastructure plus bundle size tracking to detect regressions. Extend with per-module size contribution analysis via esbuild metafile output.

## System Architecture Map

### Current Layer Topology

```
Layer 1: Slash Commands (41 .md files in commands/)
  ├── frontmatter: description, agent, tools
  ├── @path references to workflows/ and references/
  └── invoke: gsd-tools CLI commands
         │
Layer 2: Workflows (45 .md files in workflows/)
  ├── gsd-tools CLI invocations (embedded bash)
  ├── @path references to agents/, references/, templates/
  ├── Task() spawns referencing agents
  └── file path references to .planning/ artifacts
         │
Layer 3: CLI Router (src/router.js — 1642 lines)
  ├── 7 namespaces: init, plan, execute, verify, util, research, cache
  ├── ~30 lazy-loaded module references
  ├── legacy flat commands (backward compat)
  └── routes to exported functions in src/commands/*.js
         │
Layer 4: Source Modules (34 files in src/)
  ├── src/lib/ (18 modules) — shared libraries
  ├── src/commands/ (14+ modules) — command implementations
  ├── src/router.js — command routing
  └── src/index.js — entry point
         │
Layer 5: Agent Definitions (9 .md files in agents/)
  ├── frontmatter: description, tools, color
  ├── GSD_HOME path resolution
  ├── gsd-tools CLI invocations
  └── referenced by workflows via Task() spawns
```

### Dependency Direction Rules (Current)

```
VALID:
  commands/*.md → workflows/*.md (via @path)
  commands/*.md → references/*.md (via @path)
  workflows/*.md → agents/*.md (via Task() spawn)
  workflows/*.md → templates/*.md (via @path)
  workflows/*.md → gsd-tools CLI (via bash invocations)
  src/commands/*.js → src/lib/*.js (via require)
  src/router.js → src/commands/*.js (via lazy require)
  src/router.js → src/lib/*.js (git, orchestration, profiler)

QUESTIONABLE:
  src/commands/init.js → src/commands/{intent,env,codebase,worktree,trajectory,research}.js
  src/commands/research.js → src/commands/env.js (checkBinary)
  
INVALID (none found):
  src/lib/*.js → src/commands/*.js (would be upward dependency)
```

### Component Boundaries

| Component | Responsibility | Communicates With |
|-----------|---------------|-------------------|
| `src/router.js` | CLI arg parsing, namespace routing, lazy module loading | All src/commands/*.js, src/lib/profiler, src/lib/output, src/lib/constants |
| `src/lib/helpers.js` | File I/O, caching, phase resolution, slug generation | src/lib/cache, src/lib/config, src/lib/constants, src/lib/profiler, src/lib/output, src/lib/regex-cache |
| `src/lib/output.js` | JSON/TTY output, field filtering, debug logging, error handling | None (leaf module) |
| `src/lib/format.js` | Branded formatting: tables, banners, progress bars, colors | None (leaf module) |
| `src/lib/ast.js` | AST parsing via acorn, export extraction, complexity metrics | None (uses bundled acorn) |
| `src/lib/cache.js` | Two-layer SQLite/Map caching with staleness detection | node:sqlite (optional) |
| `src/commands/init.js` | Context assembly for all workflow types | 6 sibling command modules, 5 lib modules |
| `src/commands/misc.js` | Mixed bag: config, commits, templates, websearch, TDD, review | 5 lib modules |
| `src/commands/features.js` | Session diff, velocity, context budget, search, validation | 8 lib modules |
| `src/commands/verify.js` | Plan structure, phase completeness, quality scoring | 5 lib modules |

## Recommended Architecture: Three-Tier Validation

### Tier 1: JavaScript Module Validation (Automated)

**What it catches:** Dead exports, unused functions, circular dependencies, module boundary violations.

#### Approach A: Self-Hosted AST Analysis (Recommended Primary)

The project already has `src/lib/ast.js` with `extractExports()` and `extractCjsExports()` — use these to build a dead-export detector as a new CLI command.

**How it works:**

```
1. For each src/**/*.js file:
   - extractExports() → get all named exports
   - Parse all require() calls → build import graph
   
2. For each exported symbol:
   - Search all files for require('./module').symbolName usage
   - Search router.js for lazy-load references
   - Mark as "used" or "potentially dead"

3. Special cases:
   - Exports used only by tests → mark as "test-only"
   - Exports used only by router.js lazy-load → mark as "CLI entry"
   - Exports used only by other command modules → mark as "cross-command"
```

**New command:** `util:audit dead-exports`

```javascript
// Pseudocode for the audit command
function cmdAuditDeadExports(cwd) {
  const srcDir = path.join(cwd, 'src');
  const allFiles = glob.sync('**/*.js', { cwd: srcDir });
  
  // Phase 1: Extract all exports from all modules
  const exportMap = {};  // file → [exportName, ...]
  for (const file of allFiles) {
    exportMap[file] = extractCjsExports(readFile(file));
  }
  
  // Phase 2: Extract all imports/requires from all modules  
  const importMap = {};  // file → [{ from: './lib/helpers', names: ['safeReadFile'] }]
  for (const file of allFiles) {
    importMap[file] = parseRequires(readFile(file));
  }
  
  // Phase 3: Cross-reference
  const unused = [];
  for (const [file, exports] of Object.entries(exportMap)) {
    for (const exp of exports) {
      const usedBy = findUsages(exp, file, importMap);
      if (usedBy.length === 0) unused.push({ file, export: exp });
    }
  }
  
  return { unused, total_exports: totalCount, dead_count: unused.length };
}
```

**Confidence:** HIGH — The project already bundles acorn and has CJS export extraction. This is a natural extension of existing capability.

#### Approach B: Knip Cross-Validation (Supplementary)

Knip is the gold-standard for JavaScript dead code detection and explicitly supports CommonJS `module.exports` patterns.

**Configuration for this project:**

```json
{
  "$schema": "https://unpkg.com/knip@latest/schema.json",
  "entry": ["src/index.js"],
  "project": ["src/**/*.js"],
  "ignore": ["bin/**", "*.test.*"],
  "includeEntryExports": true
}
```

**Why supplementary, not primary:**
1. Knip is an external dependency — violates the single-file, zero-dep philosophy
2. It would be a dev dependency only (not bundled), so it's acceptable for CI/audit
3. The self-hosted approach catches the same issues AND can be extended for markdown analysis
4. Knip provides a second opinion to validate the self-hosted tool's accuracy

**Confidence:** HIGH — Knip explicitly documents CJS support with `module.exports` patterns matching this project's conventions.

#### Module Boundary Violations to Detect

1. **Upward dependencies** (lib → commands): Currently clean. The single exception is router.js importing from both lib/ and commands/, which is architecturally correct (it's the composition root).

2. **Cross-command dependencies**: `init.js` imports from 6 other command modules (`intent`, `env`, `codebase`, `worktree`, `trajectory`, `research`). These are *data-gathering* imports for context assembly, not command-calling imports. This pattern is defensible but should be documented as intentional.

3. **Cycle detection**: Already have Tarjan SCC in `src/lib/deps.js`. Run `buildDependencyGraph` on `src/` itself as a self-test.

### Tier 2: Connection Graph Validation (New — Most Novel)

**What it catches:** Broken command→workflow references, orphaned workflows, agents referenced by no workflow, CLI commands invoked in markdown but not registered in router.js, stale `@path` references.

This is the validation tier no off-the-shelf tool provides. It requires parsing markdown files to extract structured references.

#### Connection Types to Validate

| Connection | Source | Target | How to Extract |
|-----------|--------|--------|---------------|
| Command → Workflow | `commands/bgsd-*.md` | `workflows/*.md` | Parse `@__OPENCODE_CONFIG__/get-shit-done/workflows/` in `<execution_context>` |
| Command → Agent | `commands/bgsd-*.md` | `agents/gsd-*.md` | Parse `agent:` in frontmatter |
| Workflow → Agent | `workflows/*.md` | `agents/gsd-*.md` | Parse `Task(prompt="Read .../agents/gsd-*.md` patterns |
| Workflow → CLI | `workflows/*.md` | `router.js` routes | Parse `gsd-tools` or `gsd-tools.cjs` invocations in bash blocks |
| Workflow → Template | `workflows/*.md` | `templates/*.md` | Parse `@path` references |
| Workflow → Reference | `workflows/*.md` | `references/*.md` | Parse `@path` references |
| Agent → CLI | `agents/gsd-*.md` | `router.js` routes | Parse `gsd-tools` invocations in bash blocks |
| CLI Route → Function | `router.js` | `src/commands/*.js` | Parse `lazyX().functionName()` calls |

#### Extraction Strategy

```javascript
// Parse markdown files for gsd-tools invocations
function extractCliInvocations(content) {
  // Match: gsd-tools <command> or gsd-tools.cjs <command>
  // Match: node .../gsd-tools.cjs <namespace:command>
  const pattern = /gsd-tools(?:\.cjs)?\s+([\w:]+[\w-]*)/g;
  const commands = new Set();
  let match;
  while ((match = pattern.exec(content)) !== null) {
    commands.add(match[1]);
  }
  return [...commands];
}

// Parse @path references from markdown
function extractPathReferences(content) {
  const pattern = /@__OPENCODE_CONFIG__\/get-shit-done\/([\w/.-]+)/g;
  const refs = [];
  let match;
  while ((match = pattern.exec(content)) !== null) {
    refs.add(match[1]);
  }
  return [...refs];
}

// Parse Task() spawns that reference agents
function extractAgentSpawns(content) {
  const pattern = /agents\/(gsd-[\w-]+)\.md/g;
  const agents = new Set();
  let match;
  while ((match = pattern.exec(content)) !== null) {
    agents.add(match[1]);
  }
  return [...agents];
}
```

#### New Command: `util:audit connections`

**Output structure:**

```json
{
  "commands": {
    "total": 41,
    "with_workflow": 38,
    "orphaned": ["bgsd-join-discord"],
    "missing_workflow": []
  },
  "workflows": {
    "total": 45,
    "referenced_by_command": 38,
    "orphaned": ["complete-and-clear", "transition"],
    "cli_invocations": {
      "valid": 89,
      "invalid": 2,
      "invalid_details": [
        { "file": "workflows/foo.md", "command": "old-command", "reason": "not in router" }
      ]
    }
  },
  "agents": {
    "total": 9,
    "referenced_by_workflow": 9,
    "unreferenced": []
  },
  "templates": {
    "total": 24,
    "referenced": 18,
    "orphaned": ["planner-subagent-prompt.md", "debug-subagent-prompt.md"]
  },
  "references": {
    "total": 15,
    "referenced": 12,
    "orphaned": []
  },
  "path_references": {
    "total": 142,
    "valid": 139,
    "broken": 3,
    "broken_details": [
      { "file": "workflows/old.md", "ref": "templates/removed.md" }
    ]
  }
}
```

**Confidence:** HIGH — This is regex extraction from markdown, which the project already does extensively (309+ patterns). The patterns are well-defined.

### Tier 3: Performance & Bundle Validation (Instrumented)

**What it catches:** Bundle size regressions, init time degradation, per-module size bloat, cache effectiveness.

#### Bundle Size Decomposition

esbuild supports `metafile: true` which outputs detailed module-by-module size breakdown:

```javascript
// In build.js
const result = await esbuild.build({
  // ... existing config
  metafile: true,
});

// Write metafile for analysis
fs.writeFileSync(
  '.planning/baselines/bundle-meta.json',
  JSON.stringify(result.metafile, null, 2)
);

// Per-module size report
const inputs = result.metafile.inputs;
const moduleBreakdown = Object.entries(inputs)
  .filter(([path]) => path.startsWith('src/'))
  .map(([path, info]) => ({
    module: path,
    bytes: info.bytes,
    kb: Math.round(info.bytes / 1024 * 10) / 10,
  }))
  .sort((a, b) => b.bytes - a.bytes);
```

**New command:** `util:audit bundle` — Reads the metafile and reports per-module sizes, highlights modules over threshold, tracks deltas from baseline.

#### Init Time Profiling

Already instrumented via `GSD_PROFILE=1`. Extend to track cold-start vs warm-start:

```bash
# Cold start (no cache)
GSD_PROFILE=1 node bin/gsd-tools.cjs --no-cache init:execute-phase 1

# Warm start (cached)  
GSD_PROFILE=1 node bin/gsd-tools.cjs init:execute-phase 1
```

The profiler compare command already handles regression detection. The v8.2 addition is making this a pre-deploy gate.

**Confidence:** HIGH — esbuild metafile is a documented, stable feature. The profiler infrastructure already exists.

## Patterns to Follow

### Pattern 1: Registry-Based Route Validation

**What:** Define all valid CLI routes as a data structure, not just code paths in switch statements.

**When:** Router has grown to 1642 lines of switch/case logic with both namespaced and legacy flat commands.

**Why:** A route registry enables automated validation — you can diff the registry against actual function exports and markdown invocations.

```javascript
// Route registry (could be generated or hand-maintained)
const ROUTE_REGISTRY = {
  'init:execute-phase':    { module: 'init', fn: 'cmdInitExecutePhase', args: ['cwd', 'phase', 'raw'] },
  'init:plan-phase':       { module: 'init', fn: 'cmdInitPlanPhase', args: ['cwd', 'phase', 'raw'] },
  'plan:intent create':    { module: 'intent', fn: 'cmdIntentCreate', args: ['cwd', 'args', 'raw'] },
  // ... etc
};

// Validation: every registry entry must resolve to a real export
for (const [route, { module, fn }] of Object.entries(ROUTE_REGISTRY)) {
  const mod = require(`./commands/${module}`);
  assert(typeof mod[fn] === 'function', `Route ${route} references missing function ${fn}`);
}
```

### Pattern 2: Layered Dependency Firewall

**What:** Enforce that dependency arrows only point "inward" (commands → lib, not lib → commands).

**When:** Cross-command imports exist (init.js → 6 sibling modules).

**Why:** Prevents circular dependencies and keeps lib/ stable as the foundation.

```javascript
// In a test or audit command
function validateDependencyDirection(srcDir) {
  const violations = [];
  
  for (const file of glob.sync('lib/**/*.js', { cwd: srcDir })) {
    const content = readFile(path.join(srcDir, file));
    const requires = parseRequires(content);
    
    for (const req of requires) {
      if (req.from.includes('/commands/')) {
        violations.push({
          file: `lib/${file}`,
          imports: req.from,
          violation: 'lib module imports from commands (upward dependency)'
        });
      }
    }
  }
  
  return violations;
}
```

### Pattern 3: Contract Tests for Module Exports

**What:** Snapshot the public API surface of each module and detect unintentional changes.

**When:** 34 modules with varying export counts — easy to accidentally remove or rename an export.

**Why:** The project already uses contract tests for JSON output format. Extend to module APIs.

```javascript
// test: module export contracts
const helpers = require('../src/lib/helpers');
const expectedExports = [
  'safeReadFile', 'cachedReadFile', 'invalidateFileCache', 'cachedReaddirSync',
  'getPhaseTree', 'normalizePhaseName', 'parseMustHavesBlock', 'sanitizeShellArg',
  // ... full list
];

assert.deepStrictEqual(
  Object.keys(helpers).sort(),
  expectedExports.sort(),
  'helpers.js export contract changed — update test if intentional'
);
```

### Pattern 4: Markdown Reference Integrity Check

**What:** Validate that all `@path` references in markdown files resolve to actual files.

**When:** Any time files are moved, renamed, or deleted.

```javascript
function validateMarkdownReferences(rootDir) {
  const mdFiles = glob.sync('{commands,workflows,agents,references,templates}/**/*.md', { cwd: rootDir });
  const broken = [];
  
  for (const file of mdFiles) {
    const content = readFile(path.join(rootDir, file));
    const refs = extractPathReferences(content);
    
    for (const ref of refs) {
      // After placeholder substitution, check if file exists
      const resolvedPath = ref.replace('__OPENCODE_CONFIG__/get-shit-done/', '');
      if (!fs.existsSync(path.join(rootDir, resolvedPath))) {
        broken.push({ file, reference: ref, resolved: resolvedPath });
      }
    }
  }
  
  return broken;
}
```

## Anti-Patterns to Avoid

### Anti-Pattern 1: Monolithic Audit Command

**What:** Putting all audit logic (dead exports + connections + bundle + performance) into a single command.

**Why bad:** Slow to run, hard to maintain, impossible to run selectively. A single failure blocks all results.

**Instead:** Separate commands: `util:audit dead-exports`, `util:audit connections`, `util:audit bundle`. Each returns JSON with a status field. A top-level `util:audit all` runs all and aggregates.

### Anti-Pattern 2: Regex-Only Export Detection

**What:** Using only regex to find exports and imports without AST parsing.

**Why bad:** CJS exports have many patterns — `module.exports = { a, b }`, `module.exports.a = ...`, `exports.a = ...`, dynamic `module.exports[key]`. Regex misses edge cases.

**Instead:** Use the existing `extractCjsExports()` from `src/lib/ast.js` which handles CJS patterns via acorn AST parsing. Fall back to regex only for patterns acorn can't handle.

### Anti-Pattern 3: Hard-Coded Agent Lists

**What:** Hardcoding agent names in validation logic (currently done in `agent.js` line 127-131).

**Why bad:** Adding or removing an agent requires updating multiple locations.

**Instead:** Derive the valid agent list from filesystem scanning (`agents/gsd-*.md`), which `scanAgents()` already does. The hardcoded `validAgentNames` set in `cmdAgentAudit` should be removed in favor of the scanned list.

### Anti-Pattern 4: Testing Connections Only at Deploy Time

**What:** Running connection validation only in `deploy.sh`.

**Why bad:** Catches issues too late. Deploy-time failures require rollback.

**Instead:** Run `util:audit connections` as part of `npm test`. Fast enough (markdown parsing, no I/O) to include in every test run.

## Audit Execution Order

The phases have dependencies — some audits inform others:

```
Phase 1: Module Audit (no dependencies)
  ├── util:audit dead-exports     → identifies removable code
  ├── util:audit dependencies     → catches circular imports, boundary violations
  └── util:audit bundle           → per-module size breakdown
       │
Phase 2: Dead Code Removal (depends on Phase 1)
  ├── Remove confirmed dead exports
  ├── Remove unused internal functions
  └── Rebuild + verify tests pass
       │
Phase 3: Connection Audit (can run parallel with Phase 1)
  ├── util:audit connections      → command→workflow→agent graph
  ├── Identify orphaned workflows, templates, references
  └── Identify stale CLI invocations in markdown
       │
Phase 4: Connection Cleanup (depends on Phase 3)
  ├── Remove orphaned files
  ├── Update stale CLI invocations
  └── Update RACI matrix if agents change
       │
Phase 5: Performance Validation (depends on Phases 2 & 4)
  ├── Benchmark cold start before/after cleanup
  ├── Compare bundle size before/after
  └── Verify cache effectiveness unchanged
       │
Phase 6: Agent Architecture Audit (depends on Phase 4)
  ├── Analyze agent manifest overlap
  ├── Verify RACI coverage
  └── Measure per-agent context budget utilization
```

### Why This Order

1. **Module audit first** because dead code removal reduces the surface area for all subsequent audits.
2. **Connection audit parallel with module audit** because they examine different layers (JS vs markdown).
3. **Performance validation after cleanup** because you need the before/after delta.
4. **Agent audit last** because it depends on knowing which workflows/commands are actually live.

## Integration Points Between Phases

| Phase | Produces | Consumed By |
|-------|----------|-------------|
| Module Audit | `dead-exports.json`, `dependency-violations.json` | Dead Code Removal |
| Dead Code Removal | Updated src/, new bundle | Performance Validation |
| Connection Audit | `connection-graph.json`, `orphaned-files.json` | Connection Cleanup |
| Connection Cleanup | Updated commands/, workflows/ | Agent Architecture Audit, Performance Validation |
| Performance Validation | `performance-delta.json` | Final Report |
| Agent Architecture Audit | `agent-overlap.json`, `raci-gaps.json` | Final Report |

## What Is New vs Modified

### New (to create)

| Artifact | Type | Purpose |
|----------|------|---------|
| `src/commands/audit.js` | New command module | Houses all audit subcommands |
| `util:audit dead-exports` | New CLI command | Reports unused exports across src/ |
| `util:audit connections` | New CLI command | Validates command→workflow→agent graph |
| `util:audit bundle` | New CLI command | Per-module size breakdown from esbuild metafile |
| `util:audit all` | New CLI command | Runs all audits, aggregates results |
| `knip.json` | New config (dev-only) | Knip configuration for cross-validation |
| Contract test updates | Modified test | Export snapshot tests for all 34 modules |

### Modified (existing)

| Artifact | Change | Purpose |
|----------|--------|---------|
| `build.js` | Add `metafile: true` | Enable per-module size analysis |
| `src/router.js` | Add `audit` namespace routing | Route to new audit commands |
| `src/commands/agent.js` | Remove hardcoded `validAgentNames` | Derive from filesystem scan |
| `src/lib/constants.js` | Add COMMAND_HELP entries for audit commands | Help text |
| `deploy.sh` | Add pre-deploy audit gate | Run `util:audit connections` before deploy |

### Unchanged

| Artifact | Reason |
|----------|--------|
| `src/lib/ast.js` | Already has `extractCjsExports` needed for dead export detection |
| `src/lib/deps.js` | Already has `buildDependencyGraph` and `findCycles` |
| `src/lib/profiler.js` | Already has timer infrastructure for performance measurement |
| Agent .md files | Content validated by audit, not modified by it |

## Router Duplication Analysis

The current `router.js` (1642 lines) contains significant duplication: every namespaced command has a legacy flat-command equivalent. For example:

```
Namespaced: plan:intent create → lazyIntent().cmdIntentCreate()
Legacy:     intent create      → lazyIntent().cmdIntentCreate()
```

**Both routes exist and call the same function.** This is intentional for backward compatibility but means:

1. The router is ~2x larger than necessary
2. Any route change must be made in two places
3. Audit must check both routing paths

**Recommendation:** During v8.2, audit which legacy routes are still invoked by any markdown file. Legacy routes with zero markdown references (i.e., only used by human CLI users, if any) can be marked deprecated. Legacy routes used by markdown files should be migrated to namespaced equivalents, then the legacy route can be removed.

The connection audit command naturally produces this data: it parses all markdown for `gsd-tools` invocations and can report which command forms are actually used.

## Scalability Considerations

| Concern | Current (34 modules) | At 50 modules | At 100 modules |
|---------|---------------------|---------------|----------------|
| Dead export scan | <1s (AST parse all files) | ~2s | ~4s |
| Connection graph | <1s (regex parse ~100 markdown files) | ~1s | ~2s |
| Bundle analysis | Instant (read metafile JSON) | Instant | Instant |
| Full audit suite | <3s total | ~5s | ~8s |

All audit operations are fast enough to run in CI or as part of `npm test`.

## Sources

- **Knip documentation** — Context7 `/webpro-nl/knip`, official CJS support guide (HIGH confidence)
- **esbuild metafile** — Official esbuild docs, `metafile: true` option (HIGH confidence)
- **Project source analysis** — Direct examination of `src/router.js`, `src/lib/ast.js`, `src/commands/agent.js`, all 41 commands, 45 workflows, 9 agents (HIGH confidence)
- **Dead code detection landscape** — Evaluated Knip, no-dead-code, find-unused-exports, webpack-deadcode-plugin; Knip is the clear winner for CJS support and breadth (HIGH confidence)
- **fresh-onion architecture validation** — Layer enforcement pattern for Node.js (MEDIUM confidence — TypeScript-focused but pattern applies)
- **CLI testing strategies** — Integration test patterns for command validation (MEDIUM confidence)
