# Phase 74: Custom LLM Tools - Research

**Researched:** 2026-03-09
**Domain:** Host editor plugin custom tool API, Zod schema validation, in-process CLI replacement
**Confidence:** HIGH

## Summary

Phase 74 adds five native LLM-callable tools (`bgsd_status`, `bgsd_progress`, `bgsd_context`, `bgsd_plan`, `bgsd_validate`) to the plugin. All foundation is in place: Phase 71 delivered the ESM build pipeline, `safeHook` error boundary, shared parsers, and `createToolRegistry` with `bgsd_` prefix enforcement. Phase 73 delivered `getProjectState()` as a unified cached facade over all 6 parsers, plus `buildSystemPrompt()` and `buildCompactionContext()` patterns. Both phases are marked complete.

The host editor's custom tool API uses a `tool()` helper from `@opencode-ai/plugin` with `tool.schema` (which is Zod) for argument definitions. Tools can also import Zod directly. The execute function returns a string (the framework displays it to the LLM). The plugin returns tools in a `tool: { name: toolDef }` object alongside hook registrations.

**Primary recommendation:** Create one file per tool in `src/plugin/tools/`, each exporting a tool definition using Zod (bundled by esbuild). Register all tools in the plugin's return object under the `tool` key. Use `getProjectState()` for reads and CLI `state.js` mutation patterns for `bgsd_progress` writes. Bundle Zod as a dev dependency (already installed: v4.3.6).

<user_constraints>

## User Constraints

From CONTEXT.md — these are **locked decisions** the planner MUST honor:

1. **One file per tool** in `src/plugin/tools/` directory plus an index (e.g., `bgsd-status.js`, `bgsd-progress.js`, etc.)
2. **Tool names:** `bgsd_status`, `bgsd_progress`, `bgsd_context`, `bgsd_plan`, `bgsd_validate` (bgsd_ prefix, underscores)
3. **Zod bundled as dev dependency** into plugin.js during build — zero runtime dependencies preserved
4. **Conditional registration:** tools only appear when `.planning/` directory exists
5. **Dynamic registration:** tools register on-the-fly when `.planning/` is created mid-session (no editor restart)
6. **bgsd_progress behavior:** Can mark tasks complete, update blockers, record decisions, advance plan position. File update only — no git commits. Strict validation with ordering rules. Basic file locking. Returns updated state snapshot. Batch operations via array. Undo supported. Single 'action' parameter design with action types: `complete-task | add-blocker | record-decision | advance | uncomplete-task | remove-blocker`
7. **bgsd_progress must invalidate** ProjectState cache after writes so next read gets fresh data
8. **Error types:** `validation_error` (bad args from LLM — 4xx) vs `runtime_error` (operational failures — 5xx)
9. **Error messages:** actionable ("Phase 99 not found. Run /bgsd-progress to see available phases.")
10. **Response shape:** fields always present with null for missing data — predictable shape, never omit fields. No metadata (timing, cache freshness). No versioning. Return complete data, no truncation. Clean redesign for LLM consumption — don't carry over CLI field name quirks
11. **"No project" response:** specific response (not an error) when `.planning/` doesn't exist, with guidance to run /bgsd-new-project
12. **Use Zod coercion** (`z.coerce`) for numbers and booleans — be lenient with LLM type mismatches
13. **Minimal signatures** — few/no optional args per tool. Each tool does one thing simply
14. **Detailed multi-line tool descriptions** explaining purpose, when to use, and what each param does
15. **Both unit tests per tool AND integration tests** for registration/callability
16. **Strict separation:** each piece of data lives in exactly one tool. Minimize overlap
17. **Tools strictly require Phase 73 ProjectState cache** — error if cache not available
18. **bgsd_status:** Execution state — current phase, plan, full task list with statuses, blockers, progress %. No milestone/project-level info
19. **bgsd_context:** Accepts optional task number (defaults to current). Returns file paths, line ranges, summaries — not actual file contents
20. **bgsd_plan:** Two modes — no args returns roadmap summary; phase number arg returns detailed phase info plus plan contents if plans exist
21. **bgsd_validate:** Validates everything (STATE.md, ROADMAP.md, PLAN.md, requirement traceability). Auto-fixes trivial formatting issues. Issues categorized by severity: error, warning, info

</user_constraints>

<phase_requirements>

## Phase Requirements

| ID | Requirement | Tool | Verification |
|----|-------------|------|-------------|
| TOOL-01 | `bgsd_status` tool registered — returns current phase, plan, progress, blockers | bgsd_status | Tool callable by LLM, returns structured JSON |
| TOOL-02 | `bgsd_progress` tool registered — updates plan progress, marks tasks complete | bgsd_progress | Tool callable, STATE.md/PLAN.md updated |
| TOOL-03 | `bgsd_context` tool registered — returns task-scoped context with files and conventions | bgsd_context | Tool callable, returns file paths for current task |
| TOOL-04 | `bgsd_plan` tool registered — analyzes roadmap, returns phase details and dependencies | bgsd_plan | Tool callable, returns phase/roadmap data |
| TOOL-05 | `bgsd_validate` tool registered — runs state/roadmap validation checks | bgsd_validate | Tool callable, returns issues array |
| TOOL-06 | All custom tools have typed Zod argument schemas and return structured JSON strings | All 5 tools | Zod schema present, JSON.stringify returns valid JSON |

</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Zod | 4.3.6 | Argument schema definition and validation | Already installed as dev dependency; host editor `tool.schema` is Zod; bundled by esbuild into plugin.js |
| esbuild | 0.27.3 | Bundles Zod + tool files into plugin.js ESM | Already configured with ESM plugin build target |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@opencode-ai/plugin` (tool helper) | N/A | `tool()` helper and `tool.schema` | NOT needed — raw Zod import works identically; avoids adding a runtime dependency |
| Node.js `fs` | Built-in | File writes for bgsd_progress | STATE.md/PLAN.md mutations |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Raw Zod import | `tool()` helper from `@opencode-ai/plugin` | Helper adds a dependency; raw Zod + plain object export is equivalent per docs ("You can also import Zod directly and return a plain object") |
| Bundling Zod into plugin.js | Using `tool.schema` at runtime | `tool.schema` is the framework's re-export of Zod; bundling our own Zod copy keeps plugin self-contained and avoids version mismatch |

## Architecture Patterns

### Recommended Project Structure
```
src/plugin/
├── tools/
│   ├── index.js          # Tool barrel — exports all tools, handles conditional registration
│   ├── bgsd-status.js    # bgsd_status tool definition
│   ├── bgsd-progress.js  # bgsd_progress tool definition (write operations)
│   ├── bgsd-context.js   # bgsd_context tool definition
│   ├── bgsd-plan.js      # bgsd_plan tool definition
│   └── bgsd-validate.js  # bgsd_validate tool definition
├── index.js              # Plugin entry point — imports tools/index.js
├── project-state.js      # Existing ProjectState facade (read-only)
├── parsers/              # Existing parser modules
│   ├── state.js
│   ├── roadmap.js
│   ├── plan.js
│   ├── config.js
│   ├── project.js
│   └── intent.js
├── tool-registry.js      # Existing registry (bgsd_ prefix enforcement)
├── safe-hook.js          # Existing error boundary
└── ...
```

### Pattern 1: Tool Definition Pattern
Each tool file exports a plain object with `description`, `args` (Zod schema), and `execute` function. The execute function receives `(args, context)` where `context` has `{ directory, worktree, sessionID, messageID, agent, abort }`.

```javascript
import { z } from 'zod';
import { getProjectState } from '../project-state.js';

export const bgsd_status = {
  description: `Get current bGSD execution state...`,
  args: {
    // Minimal or no args for read-only tools
  },
  async execute(args, context) {
    const projectDir = context.directory || process.cwd();
    const state = getProjectState(projectDir);
    if (!state) {
      return JSON.stringify({
        status: 'no_project',
        message: 'No .planning/ directory found. Run /bgsd-new-project to start.',
      });
    }
    // Build response...
    return JSON.stringify(result);
  },
};
```

### Pattern 2: Plugin Tool Registration
The plugin entry point returns a `tool` key alongside hook registrations:

```javascript
// In src/plugin/index.js
import { getTools } from './tools/index.js';

export const BgsdPlugin = async ({ directory }) => {
  // ...existing hooks...
  return {
    'session.created': sessionCreated,
    'shell.env': shellEnv,
    // ...
    tool: getTools(directory),  // Returns { bgsd_status: def, bgsd_plan: def, ... }
  };
};
```

### Pattern 3: Conditional + Dynamic Registration
Per CONTEXT.md decisions, tools only appear when `.planning/` exists. For dynamic registration when `.planning/` is created mid-session, the tool execute functions can check and return a "no project" response — the tools are always registered but gracefully handle absence.

Note: The host editor loads plugin return values at startup. True dynamic registration (adding tools mid-session) may not be supported by the current plugin API. The pragmatic approach is to always register tools but have them return a "no project" guidance response when `.planning/` doesn't exist. This satisfies the UX intent (agent always has access, gets helpful guidance) without requiring framework-level dynamic registration.

### Pattern 4: bgsd_progress Write Pattern
bgsd_progress is the only write tool. It reads current state, validates the operation, applies changes via regex replacement (same pattern as CLI `state.js`), writes the file, and invalidates the parser cache:

```javascript
import { invalidateState } from '../parsers/state.js';
import { invalidatePlans } from '../parsers/plan.js';
import { writeFileSync } from 'fs';

// After writing STATE.md:
invalidateState(projectDir);
// After writing PLAN.md:
invalidatePlans(projectDir);
```

### Pattern 5: Uniform Error Envelope
```javascript
// Success
{ phase: "74", plan: "P01", progress: 45, tasks: [...], blockers: [...] }

// Validation error (bad args)
{ error: "validation_error", message: "Phase number must be between 1-99. Run /bgsd-progress to see available phases." }

// Runtime error (operational failure)
{ error: "runtime_error", message: "Failed to read STATE.md: permission denied" }

// No project
{ status: "no_project", message: "No .planning/ directory found. Run /bgsd-new-project to start." }
```

### Anti-Patterns to Avoid
1. **Don't import from `src/lib/`** — plugin parsers are self-contained copies (Phase 71 decision). Never `require()` from CLI source modules
2. **Don't use `tool()` helper from `@opencode-ai/plugin`** — the package isn't installed; raw Zod + plain object works identically
3. **Don't return objects from execute** — always `JSON.stringify()`. The framework expects a string return (never `[object Object]`)
4. **Don't add CJS patterns** — plugin is ESM. Use `import`, not `require()`
5. **Don't duplicate data across tools** — each piece of data lives in exactly one tool
6. **Don't spawn subprocesses** — the whole point is to avoid shell overhead; use in-process parsers
7. **Don't add metadata to responses** — no timing, cache freshness, or version fields

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Schema validation | Custom validation logic | Zod schemas with `z.coerce` | Zod is the standard; host editor uses it; provides type safety + error messages |
| STATE.md parsing | New regex patterns | Existing `parseState()` from `src/plugin/parsers/state.js` | Already built, tested, cached in Phase 71 |
| ROADMAP.md parsing | New roadmap parser | Existing `parseRoadmap()` with `getPhase()` method | Already built in Phase 71, includes milestones, phases, progress |
| PLAN.md parsing | New plan parser | Existing `parsePlan()`, `parsePlans()` | Already built in Phase 71, handles frontmatter + tasks |
| Unified state reads | Multiple parser calls per tool | Existing `getProjectState()` facade | Composes all 6 parsers with caching |
| Error boundary | Try/catch in each tool | `safeHook` wrapping (via `createToolRegistry`) | Already wraps tool handlers; retry, timeout, circuit breaker |
| Tool name enforcement | Manual prefix checks | `createToolRegistry.registerTool()` | Auto-prefixes and validates bgsd_ + snake_case |
| File locking for writes | Custom lock implementation | Simple `.lock` file pattern (mkdir atomic) | Node.js `mkdirSync` is atomic on POSIX; sufficient for single-session |

## Common Pitfalls

### Pitfall 1: `[object Object]` in LLM responses
**What goes wrong:** Tool returns an object instead of a string. The framework renders it as `[object Object]` to the LLM.
**Why it happens:** The execute function returns a plain object instead of `JSON.stringify()`'d string.
**How to avoid:** Always `return JSON.stringify(result)` from execute. Add a unit test per tool asserting `typeof result === 'string'` and `JSON.parse(result)` succeeds.
**Warning signs:** LLM complains about receiving garbage or `[object Object]`.

### Pitfall 2: Stale cache after bgsd_progress writes
**What goes wrong:** After bgsd_progress updates STATE.md, subsequent bgsd_status reads return old data.
**Why it happens:** Parser caches (Map instances) aren't invalidated after file writes.
**How to avoid:** Call `invalidateState(cwd)` and/or `invalidatePlans(cwd)` after every write in bgsd_progress.
**Warning signs:** bgsd_status returns old progress percentage after bgsd_progress marks a task complete.

### Pitfall 3: ESM/CJS mismatch in build
**What goes wrong:** Build fails or produces `require()` calls in plugin.js.
**Why it happens:** Importing from `src/lib/` (CJS source) instead of self-contained `src/plugin/` (ESM source).
**How to avoid:** Only import from `src/plugin/` modules and Zod. Never cross the ESM/CJS boundary.
**Warning signs:** Build CJS leak validation fails (`ESM plugin.js contains N require() calls`).

### Pitfall 4: Zod version conflict with host editor
**What goes wrong:** Schema validation behaves unexpectedly or tool registration fails.
**Why it happens:** Plugin bundles Zod v4.x but host editor uses a different Zod version for `tool.schema`.
**How to avoid:** The plugin bundles its own Zod copy via esbuild. The host editor consumes the args object (schema shape), not the Zod instance. This is safe because Zod schemas serialize to JSON Schema for the LLM's tool list. Verify by checking that tools appear in the LLM tool list after registration.
**Warning signs:** Tools don't appear in LLM tool list, or args aren't validated.

### Pitfall 5: Race condition in bgsd_progress writes
**What goes wrong:** Concurrent calls to bgsd_progress corrupt STATE.md.
**Why it happens:** Two writes read the same file, modify independently, and one overwrites the other.
**How to avoid:** Use basic file locking (`mkdirSync` as atomic lock, `rmdirSync` to release). Keep the lock window tight (read-modify-write in one critical section).
**Warning signs:** STATE.md has missing or duplicated entries after batch operations.

### Pitfall 6: Plugin bundle size explosion from Zod
**What goes wrong:** Plugin.js grows significantly after adding Zod.
**Why it happens:** Zod v4 is larger than expected; esbuild may include unused code paths.
**How to avoid:** Monitor plugin size in build output (currently 36KB; build script already reports). Zod v4 is ~40-60KB minified; total should stay well under 100KB (existing test: `plugin bundle size under 100KB`). Use tree-shakeable imports (`import { z } from 'zod'`).
**Warning signs:** Build reports plugin size > 100KB; existing test fails.

## Code Examples

### Example 1: Tool definition with Zod args (from host editor docs)
```javascript
// Source: https://opencode.ai/docs/custom-tools/
import { z } from 'zod';

export default {
  description: "Tool description",
  args: {
    param: z.string().describe("Parameter description"),
  },
  async execute(args, context) {
    return "result string";
  },
};
```

### Example 2: Plugin returning tools alongside hooks
```javascript
// Source: https://opencode.ai/docs/plugins/
export const BgsdPlugin = async (ctx) => {
  return {
    // Hooks
    'session.created': async (input, output) => { /* ... */ },
    // Tools
    tool: {
      bgsd_status: { description: '...', args: {}, async execute(args, ctx) { return '{}'; } },
      bgsd_plan: { description: '...', args: { phase: z.coerce.number().optional() }, async execute(args, ctx) { return '{}'; } },
    },
  };
};
```

### Example 3: Existing getProjectState() facade (Phase 73)
```javascript
// From src/plugin/project-state.js
import { parseState } from './parsers/state.js';
import { parseRoadmap } from './parsers/roadmap.js';
// ...

export function getProjectState(cwd) {
  const state = parseState(cwd);
  if (!state) return null; // No .planning/

  return Object.freeze({
    state,        // STATE.md fields: phase, currentPlan, status, progress, getField(), getSection()
    roadmap,      // ROADMAP.md: milestones[], phases[], getPhase(num), currentMilestone
    config,       // config.json: model_profile, branching_strategy, etc.
    project,      // PROJECT.md: coreValue, techStack, currentMilestone
    intent,       // INTENT.md: objective, outcomes[]
    plans,        // PLAN.md[]: frontmatter, tasks[], objective, verification
    currentPhase, // roadmap.getPhase(num): name, goal, dependsOn, requirements, successCriteria
    currentMilestone,
  });
}
```

### Example 4: Existing tool registry usage (Phase 71)
```javascript
// From src/plugin/tool-registry.js
const registry = createToolRegistry(safeHook);
// registerTool auto-prefixes with bgsd_ and wraps execute in safeHook
registry.registerTool('status', { description: '...', args: {}, execute: fn });
// getTools() returns { bgsd_status: { name: 'bgsd_status', description, args, execute } }
```

### Example 5: Existing parser cache invalidation
```javascript
// From src/plugin/parsers/index.js
import { invalidateState } from './state.js';
import { invalidateRoadmap } from './roadmap.js';
import { invalidatePlans } from './plan.js';

export function invalidateAll(cwd) {
  invalidateState(cwd);
  invalidateRoadmap(cwd);
  invalidatePlans(cwd);
  invalidateConfig(cwd);
  invalidateProject(cwd);
  invalidateIntent(cwd);
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| CLI subprocess calls (`init:state`, `plan:roadmap`) | In-process parsers via `getProjectState()` | Phase 71/73 (2026-03-09) | Eliminates shell overhead for reads |
| Agents manually run `bgsd-tools.cjs init:*` for context | System prompt auto-injection + compaction | Phase 73 (2026-03-09) | Context always available without agent action |
| All agent operations via CLI subprocess | Native LLM tools for hot-path ops | Phase 74 (this phase) | Faster, typed, no serialization overhead |
| `tool.schema.*` from `@opencode-ai/plugin` | Direct Zod import (`import { z } from 'zod'`) | Current best practice | Both work identically per docs; direct import avoids dependency |

## Open Questions

1. **Dynamic tool registration at runtime** — The host editor likely loads tool definitions at plugin init. True mid-session tool registration (when `.planning/` is created) may not be supported. **Recommendation:** Always register tools; have them return "no project" guidance when `.planning/` is absent. This satisfies the UX intent.

2. **`createToolRegistry` vs direct tool object** — Phase 71 built `createToolRegistry` for prefix enforcement and safeHook wrapping. However, the host editor expects a `tool: { name: def }` return object. **Recommendation:** The tool registry's `getTools()` returns exactly the right shape. Continue using it for the safeHook wrapping benefit, but verify the output shape matches what the host editor expects (specifically that the `name` field inside each definition doesn't conflict).

3. **Plugin tool context vs hook context** — Tool execute receives `(args, context)` where context has `{ directory, worktree, sessionID, messageID, agent, abort }`. The `directory` field from tool context should match the `directory` parameter the plugin receives at init. **Recommendation:** Prefer using `context.directory` from execute arguments rather than closure-captured directory, for correctness.

4. **bgsd_progress file locking strategy** — CONTEXT.md specifies "basic file locking." In a single-session environment, contention is low. **Recommendation:** Use `mkdirSync` for atomic lock creation with a `.planning/.lock` directory. If lock exists and is stale (>10s), break it. Keep it simple.

## Sources

### Primary (HIGH confidence)
- Host editor custom tool API docs: https://opencode.ai/docs/custom-tools/ — tool definition pattern, `tool.schema` = Zod, execute returns string, context object shape
- Host editor plugin docs: https://opencode.ai/docs/plugins/ — plugin structure, `tool:` return key, hook registration
- `src/plugin/index.js` — current plugin entry point, hook registrations, tool registry initialization
- `src/plugin/project-state.js` — `getProjectState()` facade API
- `src/plugin/tool-registry.js` — `createToolRegistry()`, `registerTool()`, `getTools()` API
- `src/plugin/parsers/` — all 6 parser modules with cache + invalidation
- `src/plugin/safe-hook.js` — error boundary, retry, timeout, circuit breaker
- `build.cjs` — ESM plugin build configuration, validation checks
- `.planning/phases/74-custom-llm-tools/74-CONTEXT.md` — all locked decisions

### Secondary (MEDIUM confidence)
- `src/commands/state.js` — CLI state mutation logic (cmdStateValidate, cmdStateAdvancePlan, etc.) — reference for bgsd_progress and bgsd_validate implementation
- `src/commands/init.js` — CLI init command logic — reference for data shapes tools should return
- OpenCode plugin development gist (rstacruz) — confirms tool.schema.string(), .number(), .enum(), .optional() API

### Tertiary (LOW confidence)
- Zod v4 bundle size estimate (~40-60KB) — based on general knowledge, not measured. Monitor in build output.
- Dynamic tool registration at runtime — not documented in host editor docs. Assumed not supported.

## Metadata

**Confidence breakdown:**
- Tool registration API: HIGH (official docs + working code examples)
- Existing parser/cache infrastructure: HIGH (source code read directly)
- Zod bundling into ESM: HIGH (esbuild already bundles npm deps for CLI; same config for plugin)
- bgsd_progress write patterns: MEDIUM (CLI reference exists but write logic is new for plugin)
- Dynamic registration: LOW (not documented; assumed always-register approach)

**Research date:** 2026-03-09
**Valid until:** No library version changes expected within this milestone
