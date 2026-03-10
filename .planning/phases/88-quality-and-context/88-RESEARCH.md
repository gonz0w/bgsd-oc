# Phase 88: Quality & Context - Research

**Researched:** 2026-03-10
**Domain:** Context Pre-computation, Dead Code Detection, Codebase Reachability Analysis
**Confidence:** HIGH

## Summary

Phase 88 requires implementing deterministic context loading (CTXT-01) and achieving zero orphaned code (CTXT-02, CTXT-03). The existing codebase already has substantial infrastructure for both: agent manifests in `context.js` define per-agent context scopes, and the `deps.js`/`ast.js` modules provide dependency graph building and export/signature extraction.

The primary work for CTXT-01 is **caching pre-computed context per agent** — currently, context is computed on-demand via `scopeContextForAgent()` during init. The existing `codebase-intel.json` cache can be extended to store pre-scoped agent contexts.

For CTXT-02/CTXT-03, the existing `buildDependencyGraph()` and `extractExports()` functions provide the building blocks. The gap is **reachability analysis** — mapping every export, workflow, template, and config entry to something that imports/calls it. The existing deps module already tracks forward/reverse edges; the missing piece is a **reachability audit** that reports orphaned items.

**Primary recommendation:** Extend the existing codebase-intel pipeline to include pre-computed agent contexts and a reachability audit. Use existing deps graph for import tracking; build reachability on top of it.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `acorn` | ^8.x | AST parsing for JS/TS | Already in use (`ast.js`) |
| Existing deps.js | N/A | Dependency graph building | Already implemented |
| Existing ast.js | N/A | Signature/export extraction | Already implemented |
| `codebase-intel.json` | N/A | Pre-computed codebase metadata | Already in use |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Context7 (for verification) | N/A | Verify patterns | Research only |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Build custom reachability | Use `knip` (external tool) | External tool adds dependency; custom is more integrated |
| Live context computation | Always-on context builder | Current approach is already lazy; caching is simpler |
| External dead code scanner | Custom audit using existing deps | Existing infrastructure handles this |

---

## Architecture Patterns

### Recommended Approach

1. **Pre-computed Agent Context Cache** (CTXT-01)
   - Extend `codebase-intel.json` to include `agent_contexts: { [agentType]: { fields, ... } }`
   - Generate on first init after phase; invalidate on roadmap/agent manifest changes
   - Agents receive cached context directly, not computed on-demand

2. **Reachability Audit System** (CTXT-02, CTXT-03)
   - Build on existing `deps.js` dependency graph (forward/reverse edges)
   - For each export in codebase: check if it appears in any import
   - Categorize: orphaned exports, orphaned files, orphaned workflows/templates/configs
   - Report format: `{ type: 'orphan', item: '...', reason: 'not imported' }`

3. **Clear Import/Export Relationships**
   - Use existing `extractExports()` to enumerate all exports
   - Use existing `buildDependencyGraph()` to map imports
   - Surface: for each file, show what it exports and what imports it

### Anti-Patterns to Avoid

- **Runtime context discovery** — Don't compute context on every agent call; pre-compute and cache
- **File-by-file orphan checking** — Use graph-based analysis for efficiency
- **Ignoring config files** — Templates, workflows, and configs must be included in reachability

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| AST parsing | Custom JS parser | `acorn` (already in use) | Already handles JS/TS |
| Dependency tracking | Custom graph | `deps.js` (already implemented) | Already handles multi-language |
| Export extraction | Custom regex | `ast.extractExports()` (already implemented) | Already handles ESM + CJS |

---

## Common Pitfalls

### Pitfall 1: Context cache invalidation
**What goes wrong:** Pre-computed context becomes stale when files change.
**Why it happens:** No invalidation trigger on file modifications.
**How to avoid:** Tie cache to git commit hash (like existing codebase-intel staleness check). Invalidate when HEAD differs.
**Warning signs:** Agent receives outdated context → wrong decisions.

### Pitfall 2: False positives in orphan detection
**What goes wrong:** Dynamic imports, reflection, or eval() flagged as orphaned.
**Why it happens:** Static analysis can't detect runtime patterns.
**How to avoid:** Allow marking items as "known runtime" in a config; exclude from audit. Document limitation.
**Warning signs:** Valid code flagged as orphan → ignore audit results.

### Pitfall 3: Incomplete reachability for workflows/templates
**What goes wrong:** Only checking JS imports, missing slash command references.
**Why it happens:** Commands are defined in `commands/*.md`, not imported.
**How to avoid:** Include command definitions as reachability sources. Parse command files for workflow/template references.
**Warning signs:** Valid workflows flagged as orphaned.

### Pitfall 4: Cache generation performance
**What goes wrong:** Pre-computing context for all agents takes too long.
**Why it happens:** Computing all agent contexts upfront is expensive.
**How to avoid:** Lazy generation on first agent request; incremental update. Use existing staleness check to avoid recomputation.
**Warning signs:** Init commands slow → users disable caching.

---

## Code Examples

### Example 1: Pre-computed Agent Context Structure

```javascript
// In codebase-intel.json, extend with:
{
  "agent_contexts": {
    "bgsd-executor": {
      "generated_at": "2026-03-10T...",
      "fields": {
        "phase_dir": "...",
        "plans": [...],
        "branch_name": "..."
      }
    },
    "bgsd-planner": { ... }
  }
}
```

### Example 2: Reachability Check Using Existing Deps

```javascript
// Using existing deps.js graph
const { buildDependencyGraph } = require('./deps');
const { extractExports } = require('./ast');

function findOrphanedExports(intel) {
  const graph = buildDependencyGraph(intel);
  const orphans = [];
  
  for (const file of Object.keys(intel.files)) {
    const exports = extractExports(file);
    for (const exp of exports.named) {
      // Check if any file imports this export
      const importers = graph.reverse[file] || [];
      if (importers.length === 0) {
        orphans.push({ file, export: exp });
      }
    }
  }
  return orphans;
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Live context computation | Pre-computed cache | This phase | Faster agent init |
| No orphan detection | Graph-based reachability audit | This phase | Zero orphaned code |
| Implicit import relationships | Explicit graph + audit | This phase | Clear dependencies |

---

## Open Questions

1. **Scope of "reachable":** Should workflows be considered reachable only if directly referenced by commands, or also if indirectly reachable via chain?
2. **Config file handling:** How to handle config entries that are optional/not always loaded?
3. **Performance threshold:** How long is acceptable for initial context cache generation? Target: <5 seconds.

---

## Sources

### Primary (HIGH confidence)
- `src/lib/context.js` — Existing agent manifests, `scopeContextForAgent()`
- `src/lib/deps.js` — Existing dependency graph building, `buildDependencyGraph()`
- `src/lib/ast.js` — Existing export extraction, `extractExports()`

### Secondary (MEDIUM confidence)
- `src/lib/codebase-intel.js` — Existing intel caching, staleness detection

### Tertiary (LOW confidence)
- Web search: "knip dead code detection" — Patterns for unused export detection
- Web search: "agent context pre-computation" — General patterns for deterministic context

---

## Metadata

**Confidence breakdown:**
- Deterministic context caching: HIGH (existing infrastructure, clear path)
- Dead code detection: HIGH (existing graph + export extraction)
- Reachability audit: MEDIUM (need to integrate command/workflow references)

**Research date:** 2026-03-10
**Valid until:** 2026-04-10
