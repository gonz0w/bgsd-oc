# Phase 71: Plugin Architecture & Safety - Research

**Researched:** 2026-03-08
**Domain:** Node.js build systems, ESM/CJS dual output, plugin hook safety, markdown parsing extraction
**Confidence:** HIGH

## Summary

Phase 71 establishes the architectural foundation that all five downstream phases (72-76) depend on. The current codebase is well-positioned for this work: esbuild is already the build tool (v0.27.3), the source tree is cleanly modular (`src/lib/` and `src/commands/`), and parsing logic is centralized in `helpers.js`, `state.js`, `roadmap.js`, and `config.js`. The plugin (`plugin.js`) is currently a minimal 45-line ESM file with three hooks and zero error handling — it needs to grow into a robust, safe, modular plugin bundle.

The four deliverables are technically independent and can be planned as parallel workstreams: (1) dual-output build pipeline, (2) safeHook error boundary, (3) shared parser extraction, (4) tool naming enforcement. The biggest risk is the CJS/ESM boundary — `src/` uses CJS (`require`/`module.exports`) with `src/package.json` declaring `{"type": "commonjs"}`, while `plugin.js` is ESM. The shared parser modules must work in both formats, which esbuild handles natively via separate build targets from the same source.

**Primary recommendation:** Add a second esbuild target in `build.cjs` for ESM plugin output, extract parsers into `src/plugin/parsers/`, create `src/plugin/safe-hook.js` for the error boundary, and add `src/plugin/tool-registry.js` for naming enforcement — all consuming shared source from `src/lib/`.

<user_constraints>

## User Constraints

From CONTEXT.md decisions (locked — research these, not alternatives):

1. **Error boundary behavior:** Retry once silently → log to file AND stderr → circuit breaker after 3 consecutive failures → auto-disable hook with toast notification → re-enable via /bgsd-settings → 5-second async timeout → skip hook contribution on failure → BGSD_DEBUG=1 bypasses boundary → >500ms slow hook logging → correlation IDs on errors → log file in global config dir (~/.config/...) → human-readable text format with timestamps → 512KB cap with rotation to .log.1
2. **Shared parser API:** Typed objects with accessor methods → return null on parse failure → cache until explicit invalidation → read-only parsers → individual tree-shakeable imports → extract FROM existing gsd-tools.cjs source → auto-discover files from CWD → immutable (Object.freeze) → parsePlans(phaseNum) returns array → include raw markdown alongside structured data → lenient best-effort parsing
3. **Build output:** Shared source, dual output (CJS + ESM) → switch to esbuild (already done for CJS) → ESM preserves module structure (not single bundle) → single `npm run build` → no source maps for ESM → update deploy.sh → validate ESM output has no require() leaks → audit/clean dev dependencies → remove old build.cjs after migration
4. **Tool naming:** Auto-prefix silently → enforce snake_case → internal registry with conflict detection → duplicate names warn and overwrite → permanent registration (no unregister) → handlers wrapped in safeHook → no tool count limit → registry is internal only (no public API)

### Agent's Discretion Areas
- Error boundary: One universal `safeHook` wrapper vs type-specific wrappers
- Build: ESM output directory location (`dist/`, `lib/`, or root with package.json exports)
- Tool naming: Whether registration API includes schema/description metadata or just name + handler

</user_constraints>

<phase_requirements>

## Phase Requirements

| Req ID | Description | Success Criteria |
|--------|-------------|------------------|
| PFND-01 | Plugin source split into `src/plugin/` modules, bundled to single ESM file via esbuild | `npm run build` produces both `bin/bgsd-tools.cjs` (CJS) and `plugin.js` (ESM) from same source |
| PFND-02 | Every hook wrapped in `safeHook()` error boundary | Every plugin hook survives a thrown exception — errors logged, never crash host |
| PFND-03 | Shared parser module extracted from CLI for in-process use | STATE.md, ROADMAP.md, PLAN.md parsable via imports from plugin bundle (no subprocess) |
| PFND-04 | All custom tools use `bgsd_` prefix | Custom tool registration rejects names not prefixed with `bgsd_` |

</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| esbuild | ^0.27.3 | Dual CJS/ESM build | Already in devDependencies, proven for CJS build |
| Node.js built-ins | >=18 | fs, path, os, crypto | Zero-dependency constraint — no external runtime deps |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @opencode-ai/plugin | latest | Type definitions for Plugin, tool() | Type-safe hook and tool definitions in plugin |
| zod (via tool.schema) | bundled | Tool argument schemas | Phase 74 tool registration (not this phase) |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| esbuild dual build | tsup | tsup wraps esbuild but adds config complexity; esbuild already works here |
| Manual ESM validation | eslint-plugin-import | Overkill; a simple post-build grep for `require(` in ESM output suffices |
| winston/pino for error logging | Custom log writer | Zero-dependency constraint rules out logging libraries |

## Architecture Patterns

### Recommended Project Structure

```
src/
  index.js              # CLI entry point (CJS, unchanged)
  router.js             # CLI command router (CJS, unchanged)
  lib/                  # Shared libraries (CJS, consumed by both targets)
    helpers.js           
    config.js            
    ...existing lib files...
  commands/             # CLI commands (CJS only)
  plugin/               # NEW: Plugin-specific modules (ESM target)
    index.js            # Plugin entry point — exports BgsdPlugin
    safe-hook.js        # safeHook() error boundary + circuit breaker
    tool-registry.js    # Tool name validation + registration
    logger.js           # File-based error logger with rotation
    parsers/            # Shared parsers (extracted from helpers.js, state.js, roadmap.js)
      state.js          # parseState() — extracts fields from STATE.md
      roadmap.js        # parseRoadmap() — phase data, milestones, progress
      plan.js           # parsePlan()/parsePlans() — plan structure, tasks, frontmatter
      config.js         # parseConfig() — config.json with schema defaults
      index.js          # Re-exports all parsers
```

### Pattern 1: Dual Build Target (esbuild)

The build script runs two esbuild invocations sequentially:

```javascript
// Target 1: CJS CLI bundle (existing, unchanged)
await esbuild.build({
  entryPoints: ['src/index.js'],
  outfile: 'bin/gsd-tools.cjs',
  format: 'cjs',
  platform: 'node',
  bundle: true,
  // ...existing config
});

// Target 2: ESM plugin bundle (NEW)
await esbuild.build({
  entryPoints: ['src/plugin/index.js'],
  outfile: 'plugin.js',       // or outdir for preserved structure
  format: 'esm',
  platform: 'node',
  bundle: true,
  external: ['@opencode-ai/plugin', 'zod'],
  // ...no sourcemap, no minify
});
```

**Key insight:** Both targets can import from `src/lib/` — esbuild handles CJS→ESM conversion automatically when bundling. The `src/lib/` files stay as CJS (require/module.exports), and esbuild converts them to ESM imports/exports in the plugin bundle.

### Pattern 2: safeHook Error Boundary

```javascript
// src/plugin/safe-hook.js
function safeHook(name, fn, { timeout = 5000 } = {}) {
  let consecutiveFailures = 0;
  let disabled = false;
  
  return async (input, output) => {
    if (disabled) return; // Circuit breaker tripped
    
    if (process.env.BGSD_DEBUG === '1') {
      return fn(input, output); // Bypass for debugging
    }
    
    const correlationId = generateCorrelationId();
    const start = Date.now();
    
    for (let attempt = 0; attempt < 2; attempt++) { // Retry once
      try {
        const result = await Promise.race([
          fn(input, output),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Hook timeout')), timeout)
          ),
        ]);
        consecutiveFailures = 0;
        const elapsed = Date.now() - start;
        if (elapsed > 500) logSlowHook(name, elapsed);
        return result;
      } catch (err) {
        if (attempt === 0) continue; // Silent retry
        consecutiveFailures++;
        logError(name, err, correlationId);
        showToast(`bGSD hook failed: ${name} [${correlationId}]`);
        if (consecutiveFailures >= 3) {
          disabled = true;
          showToast(`Hook ${name} disabled after repeated failures`);
        }
      }
    }
  };
}
```

### Pattern 3: Shared Parser with Typed Objects

```javascript
// src/plugin/parsers/state.js
function parseState(cwd) {
  const content = readStateFile(cwd);
  if (!content) return null;
  
  const fields = extractFields(content);
  const result = {
    raw: content,
    phase: fields.Phase || null,
    currentPlan: fields['Current Plan'] || null,
    status: fields.Status || null,
    progress: parseProgressBar(content),
    // ... accessor methods
    getField(name) { return fields[name] || null; },
    getSection(name) { return extractSection(content, name); },
  };
  
  return Object.freeze(result);
}
```

### Pattern 4: Tool Registration with Prefix Enforcement

```javascript
// src/plugin/tool-registry.js
function createToolRegistry() {
  const registry = new Map();
  
  function registerTool(name, handler) {
    // Normalize: auto-prefix if missing
    const normalized = name.startsWith('bgsd_') ? name : `bgsd_${name}`;
    // Enforce snake_case
    if (!/^bgsd_[a-z][a-z0-9_]*$/.test(normalized)) {
      throw new Error(`Tool name must be snake_case: ${normalized}`);
    }
    if (registry.has(normalized)) {
      console.warn(`[bGSD] Tool '${normalized}' already registered — overwriting`);
    }
    registry.set(normalized, wrapHandler(normalized, handler));
    return normalized;
  }
  
  return { registerTool, getTools: () => Object.fromEntries(registry) };
}
```

### Anti-Patterns to Avoid

1. **Don't create a separate copy of parser code** — extract from `src/lib/helpers.js` and `src/commands/state.js` into `src/plugin/parsers/`, then have the CLI import from there too (or the build bundles both)
2. **Don't use `try/catch` around each hook individually** — use the universal `safeHook` wrapper for consistency
3. **Don't make plugin.js depend on gsd-tools.cjs at runtime** — the whole point is in-process reads, not subprocess spawning
4. **Don't export the tool registry publicly** — CONTEXT.md explicitly says internal only
5. **Don't use JSON logging format** — CONTEXT.md says human-readable text with timestamps

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| CJS→ESM conversion | Manual AST transforms | esbuild format option | esbuild handles this natively and correctly |
| Promise timeout | Custom timer logic | `Promise.race` with setTimeout | Standard pattern, well-understood |
| Correlation IDs | UUID library | `crypto.randomBytes(4).toString('hex')` | Zero-dependency constraint, 8-char hex is sufficient |
| Log rotation | Custom rotation logic | Simple size-check + rename on write | 512KB cap is trivial to implement inline |
| Schema validation | Custom validator | Zod (via @opencode-ai/plugin's tool.schema) | Phase 74 will use this; don't duplicate |

## Common Pitfalls

### Pitfall 1: CJS/ESM Boundary in Shared Source
**What goes wrong:** `src/lib/` files use `require()` and `module.exports`. If the plugin ESM bundle incorrectly includes these, it breaks.
**Why it happens:** esbuild's `format: 'esm'` with `bundle: true` converts CJS to ESM, but only when the CJS files are part of the bundle graph. External modules or dynamic requires may leak.
**How to avoid:** Post-build validation: grep the ESM output for `require(` — fail the build if found (per CONTEXT.md decision). Test with `node --input-type=module -e "import('./plugin.js')"`.
**Warning signs:** `ERR_REQUIRE_ESM` errors at runtime, `module is not defined` in ESM context.

### Pitfall 2: Error Boundary Masking Real Bugs
**What goes wrong:** safeHook swallows errors silently, making debugging impossible.
**Why it happens:** Circuit breaker disables hooks after 3 failures, and without good logging, the root cause is lost.
**How to avoid:** BGSD_DEBUG=1 bypass, correlation IDs linking toast to log file, slow hook logging (>500ms).
**Warning signs:** Hooks silently stop working with no user-visible indication.

### Pitfall 3: Parser Cache Stale Data
**What goes wrong:** Parsed STATE.md returns outdated data after a file write.
**Why it happens:** Cache invalidation is manual (explicit `invalidate()` call required).
**How to avoid:** Always call `invalidate()` after writes. Phase 75 adds file watchers for automatic invalidation.
**Warning signs:** Parser returns data that doesn't match the file on disk.

### Pitfall 4: Plugin Bundle Size Explosion
**What goes wrong:** The ESM plugin bundle includes all of gsd-tools.cjs (1153KB).
**Why it happens:** Importing shared parsers pulls in the entire dependency graph if not careful.
**How to avoid:** Only import specific parser functions, not entire modules. Use esbuild's tree-shaking. Track plugin bundle size in build output.
**Warning signs:** Plugin bundle >100KB (parsers + error boundary + registry should be <50KB).

### Pitfall 5: OpenCode Plugin API Assumptions
**What goes wrong:** Plugin hooks or tool registration doesn't match the actual host API.
**Why it happens:** Plugin API has `experimental.` prefix hooks that may change. Tool registration uses the `tool` key in the return object, not a programmatic registration API.
**How to avoid:** Use `@opencode-ai/plugin` types. Test against actual OpenCode runtime. The `tool` return key registers tools, and the `tool()` helper provides schema support.
**Warning signs:** Plugin loads but tools don't appear in LLM's tool list.

## Code Examples

### Example 1: Dual esbuild Configuration (from esbuild docs, verified via Context7)

```javascript
// Two sequential builds in build.cjs
async function build() {
  // Build 1: CJS CLI (existing)
  await esbuild.build({
    entryPoints: ['src/index.js'],
    outfile: 'bin/gsd-tools.cjs',
    bundle: true, platform: 'node', format: 'cjs', target: 'node18',
    external: ['node:*', 'child_process', 'fs', 'path', 'os', ...],
    banner: { js: '#!/usr/bin/env node' },
    plugins: [stripShebangPlugin],
    metafile: true,
  });

  // Build 2: ESM Plugin (NEW)
  const pluginResult = await esbuild.build({
    entryPoints: ['src/plugin/index.js'],
    outfile: 'plugin.js',
    bundle: true, platform: 'node', format: 'esm', target: 'node18',
    external: ['node:*', 'child_process', 'fs', 'path', 'os', 'crypto',
               '@opencode-ai/plugin', 'zod'],
    metafile: true,
  });

  // Validate no CJS leaks in ESM output
  const pluginContent = fs.readFileSync('plugin.js', 'utf-8');
  if (/\brequire\s*\(/.test(pluginContent)) {
    console.error('ERROR: ESM plugin contains require() calls');
    process.exit(1);
  }
}
```

### Example 2: OpenCode Plugin Tool Registration (from official docs, verified via Context7)

```typescript
import { type Plugin, tool } from "@opencode-ai/plugin"

export const BgsdPlugin: Plugin = async ({ directory }) => {
  return {
    // Hooks
    "session.created": async (input, output) => { /* ... */ },
    "shell.env": async (input, output) => { /* ... */ },
    "experimental.session.compacting": async (input, output) => { /* ... */ },
    
    // Custom tools — registered via 'tool' key in return object
    tool: {
      bgsd_status: tool({
        description: "Get current project status",
        args: { /* zod schema */ },
        async execute(args, context) {
          return JSON.stringify({ phase: "71", status: "in-progress" });
        },
      }),
    },
  };
};
```

### Example 3: Error Logger with Rotation

```javascript
function createLogger(logDir) {
  const LOG_MAX_SIZE = 512 * 1024; // 512KB
  const logPath = path.join(logDir, 'bgsd-plugin.log');
  const rotatedPath = logPath + '.1';
  
  function write(level, message, correlationId, extra) {
    const timestamp = new Date().toISOString();
    const line = `[${timestamp}] [${level}] [${correlationId}] ${message}`;
    const entry = extra ? `${line}\n  ${extra}\n` : `${line}\n`;
    
    try {
      // Check size and rotate if needed
      try {
        const stat = fs.statSync(logPath);
        if (stat.size >= LOG_MAX_SIZE) {
          // Rotate: current → .log.1 (overwrite old rotation)
          try { fs.unlinkSync(rotatedPath); } catch {}
          fs.renameSync(logPath, rotatedPath);
        }
      } catch {} // File doesn't exist yet
      
      fs.appendFileSync(logPath, entry);
    } catch (err) {
      // Last resort: stderr
      process.stderr.write(`[bGSD] Failed to write log: ${err.message}\n`);
    }
  }
  
  return { write };
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manual CJS bundling | esbuild with format options | esbuild 0.4+ (2020) | Trivial dual CJS/ESM output |
| subprocess spawning for data | In-process shared parsers | Current best practice | Eliminates ~50-100ms per read operation |
| No error handling in plugins | Error boundaries + circuit breakers | Resilience engineering pattern | Prevents host process crashes |
| Flat tool namespace | Prefixed tool names | OpenCode plugin convention | Prevents shadowing built-in tools |

## Current State Analysis

### plugin.js (45 lines)
- **Format:** ESM (import/export)
- **Hooks registered:** 3 — `session.created`, `shell.env`, `experimental.session.compacting`
- **Error handling:** Single try/catch around compaction hook only, swallows error silently
- **Tool registration:** None
- **Dependencies:** `fs.readFileSync`, `path.join`, `os.homedir` — all Node built-ins
- **Config path:** Hardcoded `~/.config/opencode/get-shit-done` (needs rebrand in Phase 72)
- **Size:** Minimal — no shared parsing, no error boundary, no tool registry

### build.cjs (402 lines)
- **Build tool:** esbuild ^0.27.3 (already in devDependencies)
- **Current output:** Single target — `src/index.js` → `bin/gsd-tools.cjs` (CJS)
- **Features:** Shebang stripping plugin, smoke test, bundle size tracking (1500KB budget), metafile analysis, manifest generation, skills validation, skill index generation
- **Adding ESM target:** Straightforward — add second `esbuild.build()` call with `format: 'esm'`
- **Post-build validation:** Already has smoke test pattern; add ESM validation

### src/ Source Tree
- **Structure:** `src/index.js` (entry) → `src/router.js` (930 lines, CJS) → `src/commands/*.js` (18 files) + `src/lib/*.js` (17 files)
- **Module system:** CJS throughout (`src/package.json` has `{"type": "commonjs"}`)
- **Root package.json:** `{"type": "module"}` — meaning plugin.js is ESM (correct for OpenCode)
- **Parser code locations:**
  - `src/lib/helpers.js` (1024 lines): `getRoadmapPhaseInternal()`, `getMilestoneInfo()`, `parsePlanIntent()`, `parseIntentMd()`, `safeReadFile()`, `cachedReadFile()`, `getPhaseTree()`
  - `src/commands/state.js` (714 lines): `stateExtractField()`, `stateReplaceField()`, `cmdStateLoad()`, `cmdStateGet()`, `cmdStatePatch()`, `cmdStateValidate()`
  - `src/commands/roadmap.js` (300 lines): `cmdRoadmapGetPhase()`, `cmdRoadmapAnalyze()`
  - `src/lib/config.js` (76 lines): `loadConfig()` — JSON parsing with schema defaults
  - `src/lib/frontmatter.js`: YAML-like frontmatter extraction

### deploy.sh (180 lines)
- **Current behavior:** Builds, backs up, manifest-based file sync to `~/.config/opencode/get-shit-done/`
- **Impact of Phase 71:** Needs to include new ESM plugin.js in deployment. The `plugin.js` file already exists in `package.json`'s `files` array, so manifest should pick it up if build generates it at the root.
- **Concern:** deploy.sh currently deploys `plugin.js` as a root-level file. If the build now generates it, deploy.sh needs to ensure the generated version (not the old handwritten one) gets deployed.

### Test Infrastructure
- **Test file:** `bin/gsd-tools.test.cjs` (18,130 lines, 762+ tests)
- **Build tests:** `describe('build system')` — verifies build succeeds, produces output, completes in <500ms
- **No plugin tests:** No existing test coverage for plugin.js hooks

## Risk Assessment

### Risk 1: CJS Source → ESM Output Conversion (MEDIUM)
**Likelihood:** Medium — esbuild handles this well, but edge cases exist
**Impact:** Build fails or runtime errors in plugin
**Mitigation:** Post-build validation grep for `require(` in ESM output; smoke test ESM import
**Status:** esbuild's `format: 'esm'` with `bundle: true` handles CJS→ESM conversion. This is a well-tested esbuild feature.

### Risk 2: Parser Extraction Breaking CLI (MEDIUM)
**Likelihood:** Medium — moving code between files risks breaking imports
**Impact:** CLI regression (762+ tests catch this)
**Mitigation:** Extract parsers into `src/plugin/parsers/`, import them back into the CLI modules. Run full test suite after extraction. Both build targets consume the same source.
**Alternative approach:** Don't move files — just have `src/plugin/index.js` import directly from `src/lib/helpers.js` and `src/commands/state.js`. esbuild will bundle the needed functions. This is simpler but means the plugin bundle may include more code than needed.

### Risk 3: Plugin Bundle Size (LOW)
**Likelihood:** Low — tree-shaking should eliminate unused CLI code
**Impact:** Slower plugin load time
**Mitigation:** Track plugin bundle size in build output. Target <50KB for Phase 71 deliverables.

### Risk 4: OpenCode Plugin API Changes (LOW)
**Likelihood:** Low for stable hooks, higher for `experimental.*` hooks
**Impact:** Hooks stop working after OpenCode update
**Mitigation:** Use `@opencode-ai/plugin` types for compile-time checking. The `tool` registration API is stable per official docs.

### Risk 5: Downstream Phase Assumptions (LOW)
**Likelihood:** Low — interfaces are well-defined in CONTEXT.md
**Impact:** Phases 72-76 need rework
**Mitigation:** Ensure exported API matches what downstream phases expect (documented below).

## Downstream Phase Dependencies

### Phase 72: Rebrand
- Needs: build pipeline producing `bin/bgsd-tools.cjs` (new name, from PFND-01)
- Needs: Plugin config path to be changeable (currently hardcoded in plugin.js)
- Does NOT need: parsers, error boundary, or tool registry

### Phase 73: Context Injection
- Needs: Shared parsers (PFND-03) — `parseState()`, `parseRoadmap()` for system prompt injection
- Needs: safeHook (PFND-02) — wrapping `experimental.chat.system.transform` hook
- Needs: Cache infrastructure from parsers for ProjectState cache

### Phase 74: Custom LLM Tools
- Needs: Tool registry with `bgsd_` prefix enforcement (PFND-04)
- Needs: safeHook (PFND-02) — tool handlers wrapped in error boundary
- Needs: Shared parsers (PFND-03) — tools query state, roadmap, plan data
- Needs: Plugin bundle supports `tool` return key with `tool()` helper

### Phase 75: Event-Driven State Sync
- Needs: Parser cache with `invalidate()` method (from PFND-03)
- Needs: safeHook (PFND-02) — wrapping event handlers
- Needs: Logger from error boundary (for notification integration)

### Phase 76: Advisory Guardrails
- Needs: safeHook (PFND-02) — wrapping `tool.execute.after` hooks
- Needs: Event handler infrastructure from Phase 75

## Planning Recommendations

### Task Decomposition Strategy

The four requirements map to 4 natural work units, with a build infrastructure task first:

1. **Build Pipeline** (PFND-01): Add ESM target to `build.cjs`, create `src/plugin/` structure, validate ESM output, update deploy.sh — ~2 tasks
2. **Error Boundary** (PFND-02): Create `safeHook()` with retry, timeout, circuit breaker, logging, correlation IDs — wrap existing plugin hooks — ~1-2 tasks
3. **Shared Parsers** (PFND-03): Extract state/roadmap/plan/config parsing into `src/plugin/parsers/`, typed return objects with Object.freeze, cache integration — ~2 tasks
4. **Tool Registry** (PFND-04): Create tool-registry.js with prefix enforcement, snake_case validation, duplicate detection, safeHook wrapping — ~1 task

**Recommended plan count:** 2-3 plans with 2-3 tasks each.

### Agent's Discretion Recommendations

1. **Error boundary:** Use ONE universal `safeHook` wrapper (not type-specific). The hook signature is uniform across all OpenCode hooks `(input, output) => Promise<void>`. A single wrapper reduces code and testing surface.

2. **ESM output location:** Output to `plugin.js` at project root (current location). This matches `package.json`'s `files` array, deploy.sh's existing copy logic, and the OpenCode plugin discovery path. No need for `dist/` or `lib/` directories.

3. **Tool registration metadata:** Include description and args schema in registration, not just name + handler. Reason: OpenCode's `tool()` helper already expects `{ description, args, execute }`. The registry should validate and store the full definition, since Phase 74 will need it immediately.

## Open Questions

1. **parser.js import path in plugin bundle:** Should downstream phases import parsers as `import { parseState } from './plugin.js'` (single bundle) or separate entry points? CONTEXT.md says "individual imports: `import { parseRoadmap } from 'bgsd/parsers/roadmap'`" — but this requires npm package publishing. For now, single bundle with named exports is pragmatic.

2. **Toast notification mechanism:** CONTEXT.md mentions toast notifications for circuit breaker events. OpenCode's plugin API has no explicit toast API. This likely means `console.log()` output or using the `event` hook. Research shows no dedicated toast API in OpenCode plugins — may need to use `client.session.prompt()` or `console.warn()`. Defer implementation details to executor.

## Sources

### Primary (HIGH confidence)
- **Codebase analysis** — Direct reads of plugin.js, build.cjs, src/, package.json, deploy.sh (all paths verified)
- **OpenCode Plugin Docs** — https://opencode.ai/docs/plugins/ — hook signatures, tool registration, custom tools API (verified via Context7)
- **esbuild Documentation** — https://esbuild.github.io — dual format output, CJS→ESM conversion (verified via Context7)

### Secondary (MEDIUM confidence)
- **OpenCode Plugin Gist** — https://gist.github.com/CypherpunkSamurai/30dc0b7683c06560a74f783097c5f912 — comprehensive plugin guide with all hook types
- **CONTEXT.md decisions** — User-locked implementation decisions for error boundary, parsers, build, tool naming

### Tertiary (LOW confidence)
- **Toast notification in OpenCode** — No official API found. Assumed to use console output or client SDK. LOW confidence.

## Metadata

**Confidence breakdown:**
- Build pipeline (esbuild dual output): HIGH — esbuild docs + existing working build
- Error boundary pattern: HIGH — standard Node.js resilience patterns
- Parser extraction: HIGH — direct codebase analysis, known function locations
- Tool registration: HIGH — OpenCode docs verified via Context7
- Toast notifications: LOW — no official API documentation found

**Research date:** 2026-03-08
**Valid until:** 2026-04-08 (esbuild and OpenCode APIs are stable)

---

*Phase: 71-plugin-architecture-safety*
*Research completed: 2026-03-08*
