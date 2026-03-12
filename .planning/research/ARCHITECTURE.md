# Architecture Research — Code Audit & Performance Tooling Integration

**Research mode:** Ecosystem -> Architecture Integration  
**Scope:** How code audit and performance profiling integrate with existing bGSD CLI architecture  
**Question:** How should code audit capabilities be integrated into an existing CLI tool? Consider: AST-based analysis module structure, performance profiling commands, CLI wrappers for external tools, and where these fit in the existing command namespace (util: commands?).  
**Date:** 2026-03-12  
**Overall confidence:** HIGH

---

## Executive Recommendation

Add a **dual-module architecture** under the `util:` namespace:
- **`src/lib/audit.js`** — AST-based code pattern detection (static analysis rules)
- **`src/lib/performance.js`** — Extended profiling with baseline comparison and trend analysis

**Key insight:** The existing codebase already has AST infrastructure (`src/lib/ast.js`, 1199 lines) and profiler (`src/lib/profiler.js`, 116 lines). New capabilities should extend these modules rather than create parallel systems.

---

## Integration Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         CLI Input Layer                                      │
│  ┌─────────────────────────────────────────────────────────────────────┐  │
│  │  bgsd-tools util:audit <subcommand>                                  │  │
│  │  bgsd-tools util:profile <subcommand>                               │  │
│  └─────────────────────────────────────────────────────────────────────┘  │
│                                    │                                        │
│                                    ▼                                        │
│  ┌─────────────────────────────────────────────────────────────────────┐  │
│  │                    Router (existing)                                  │  │
│  │  - namespace: 'util'                                                │  │
│  │  - subcommands: audit, profile                                     │  │
│  └─────────────────────────────────────────────────────────────────────┘  │
│                                    │                                        │
│           ┌────────────────────────┴────────────────────────┐             │
│           ▼                                             ▼              │
│  ┌─────────────────────┐                    ┌─────────────────────────┐   │
│  │  audit.js module   │                    │  performance.js module │   │
│  │  (NEW ~5KB)        │                    │  (NEW ~4KB)            │   │
│  │  - pattern detection│                    │  - extended profiling  │   │
│  │  - anti-patterns   │                    │  - baseline comparison │   │
│  │  - dead code       │                    │  - trend analysis      │   │
│  └──────────┬──────────┘                    └───────────┬────────────┘   │
│              │                                             │               │
│              ▼                                             ▼               │
│  ┌─────────────────────┐                    ┌─────────────────────────┐   │
│  │ ast.js (existing)   │                    │  profiler.js (existing) │   │
│  │ - signatures        │                    │  - timing               │   │
│  │ - complexity        │                    │  - baselines            │   │
│  │ - exports           │                    │  - BGSD_PROFILE=1       │   │
│  └─────────────────────┘                    └─────────────────────────┘   │
│              │                                             │               │
│              └─────────────────────┬───────────────────────┘             │
│                                    ▼                                      │
│                    ┌───────────────────────────────────┐                 │
│                    │  .planning/codebase/audit.json     │                 │
│                    │  .planning/baselines/*.json       │                 │
│                    └───────────────────────────────────┘                 │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## New Modules Required

### Module Breakdown

| File | Type | Purpose | Estimated Size | Depends On |
|------|------|---------|---------------|------------|
| `src/lib/audit.js` | NEW | Pattern detection, anti-patterns, dead code | ~5KB | ast.js |
| `src/lib/performance.js` | NEW | Extended profiling, trend analysis | ~4KB | profiler.js |
| `src/commands/audit.js` | NEW | `util:audit` command handler | ~3KB | audit.js |
| `src/commands/performance.js` | NEW | `util:profile` command handler | ~3KB | performance.js |
| `src/lib/constants.js` | MODIFIED | Add COMMAND_HELP entries | ~1KB | — |

---

## Integration Points

### With Existing Modules

| Module | Integration | Approach |
|--------|-------------|----------|
| `src/lib/ast.js` | audit.js uses for signature extraction | Reuse `extractSignatures()`, `extractExports()` |
| `src/lib/profiler.js` | performance.js extends timing | Reuse `startTimer()`, `endTimer()`, add `compareBaselines()` |
| `src/router.js` | Add lazy loaders, command routes | Extend existing namespace routing |
| `src/lib/output.js` | Both modules use for JSON output | Standard `output()` pattern |
| `src/commands/codebase.js` | audit.js reads codebase-intel.json | Read cached intel, extend analysis |

### Data Flow

```
[User: bgsd-tools util:audit run --patterns dead-code]
    │
    ▼
[audit.js: loadCodebaseIntel()]
    │ → reads .planning/codebase/codebase-intel.json
    │
    ▼
[audit.js: detectPatterns(files, options)]
    │ → uses ast.js for AST traversal
    │ → applies rule-based detection
    │
    ▼
[audit.js: writeAuditReport(results)]
    │ → writes .planning/codebase/audit.json
    │
    ▼
[Output JSON to stdout]
```

```
[User: bgsd-tools util:profile run --command "verify:state validate"]
    │
    ▼
[performance.js: spawnWithProfiling(command)]
    │ → runs with BGSD_PROFILE=1
    │ → captures timing via profiler.js
    │
    ▼
[performance.js: compareWithBaseline(results)]
    │ → loads .planning/baselines/
    │ → computes deltas
    │
    ▼
[Output JSON with regression warnings]
```

---

## Architectural Patterns

### Pattern 1: Rule-Based AST Analysis

**What:** Extend existing AST infrastructure with pattern detection rules.

**When to use:** Static analysis without external linting tools.

**Trade-offs:**
- ✅ Zero new dependencies, fast, works offline
- ✅ Reuses existing ast.js infrastructure
- ❌ Limited to JS/TS without external parser support

```javascript
// src/lib/audit.js
const AUDIT_RULES = {
  'dead-code': {
    detect: (signatures, exports) => {
      // Function defined but never exported = potential dead code
      const defined = new Set(signatures.map(s => s.name));
      const exported = new Set([...exports.named, ...exports.cjsExports]);
      return [...defined].filter(fn => !exported.has(fn));
    },
  },
  'complex-function': {
    threshold: 15,
    detect: (complexityData) => {
      return complexityData.functions.filter(fn => fn.complexity > 15);
    },
  },
  'unused-import': {
    // Would require deeper import analysis
  },
};

function runAudit(filePath, options) {
  const signatures = extractSignatures(filePath);
  const exports = extractExports(filePath);
  const complexity = computeComplexity(filePath);
  
  const results = {};
  for (const [rule, config] of Object.entries(AUDIT_RULES)) {
    if (options.patterns && !options.patterns.includes(rule)) continue;
    results[rule] = config.detect(signatures, exports, complexity);
  }
  return results;
}
```

### Pattern 2: External Tool Wrapper

**What:** CLI wrappers for existing tools (eslint, prettier) following existing cli-tools pattern.

**When to use:** When full static analysis capabilities needed beyond custom rules.

**Trade-offs:**
- ✅ Leverages proven tools
- ❌ External dependency, installation required

```javascript
// src/lib/cli-tools/eslint.js (existing pattern)
const { execSync } = require('child_process');

function runEslint(cwd, options = {}) {
  const args = ['--format', 'json', '--no-error-on-unmatched-pattern'];
  if (options.fix) args.push('--fix');
  if (options.dir) args.push(options.dir);
  
  try {
    const result = execSync(`eslint ${args.join(' ')}`, {
      cwd,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return { success: true, results: JSON.parse(result) };
  } catch (e) {
    return { success: false, error: e.message, results: [] };
  }
}
```

### Pattern 3: Performance Baseline Comparison

**What:** Extend existing profiler with baseline management and regression detection.

**When to use:** Tracking performance trends over time.

**Trade-offs:**
- ✅ Reuses existing profiler.js infrastructure
- ✅ Clear regression signals
- ❌ Requires baseline establishment

```javascript
// src/lib/performance.js
function compareWithBaseline(currentTimings, baselinePath) {
  const baseline = JSON.parse(fs.readFileSync(baselinePath, 'utf-8'));
  
  const results = currentTimings.map(current => {
    const before = baseline.timings.find(t => t.label === current.label);
    if (!before) return { label: current.label, status: 'new' };
    
    const delta = current.duration_ms - before.duration_ms;
    const percentChange = (delta / before.duration_ms) * 100;
    
    return {
      label: current.label,
      before: before.duration_ms,
      after: current.duration_ms,
      delta,
      percentChange,
      status: Math.abs(percentChange) > 10 ? 'regression' : 'stable',
    };
  });
  
  return results;
}
```

---

## Command Structure

### util:audit Subcommands

| Command | Purpose | Flags |
|---------|---------|-------|
| `util:audit run` | Run audit on codebase | `--patterns <list>`, `--dir <path>`, `--fix` |
| `util:audit status` | Show last audit results | `--json` |
| `util:audit rules` | List available audit rules | |
| `util:audit trends` | Show audit history | `--since <date>` |

### util:profile Subcommands

| Command | Purpose | Flags |
|---------|---------|-------|
| `util:profile run` | Run command with profiling | `--command <cmd>`, `--baseline <name>` |
| `util:profile baselines` | List available baselines | |
| `util:profile compare` | Compare two profiles | `--before <file>`, `--after <file>` |
| `util:profile trends` | Show performance over time | `--since <date>` |

---

## Build & Deploy Impact

### Build Order

1. **Create `src/lib/audit.js`** — Pattern detection rules extending ast.js
2. **Create `src/lib/performance.js`** — Extended profiling extending profiler.js
3. **Create `src/commands/audit.js`** — `util:audit` command handler
4. **Create `src/commands/performance.js`** — `util:profile` command handler
5. **Update `src/router.js`** — Add lazy loaders and routes
6. **Update `src/lib/constants.js`** — Add COMMAND_HELP entries
7. **Run `npm run build`** — Verify < 1550KB

### Dependency Graph

```
audit.js ──────► ast.js (existing)
                    │
performance.js ───► profiler.js (existing)
                         │
codebase.js ◄─────── audit.json ◄── audit.js
                              │
baselines/ ◄──────── performance.js
```

### Bundle Size Impact

| Component | Estimated Size |
|-----------|----------------|
| Current bundle | ~1163KB |
| audit.js module | ~5KB |
| performance.js module | ~4KB |
| audit command | ~3KB |
| performance command | ~3KB |
| **Total new** | ~15KB |
| **Projected total** | ~1178KB |

**Conclusion:** Well within 1550KB budget. No external dependencies added.

---

## Anti-Patterns to Avoid

| Anti-Pattern | Why Wrong | Correct Approach |
|--------------|-----------|------------------|
| Full ESLint integration | Heavy external dependency, complex config | Rule-based patterns in audit.js |
| Duplicate AST parsing | Re-parsing wastes time | Reuse ast.js extractSignatures() |
| Separate data store | Duplication, sync issues | Extend codebase-intel.json |
| Parallel profiler | Confusion, code duplication | Extend profiler.js |

---

## Sources

1. **ast-grep:** https://github.com/ast-grep/ast-grep — Structural search, lint, rewrite (Rust-based, fast)
2. **AST Guard:** https://www.npmjs.com/package/ast-guard — Production-ready AST validator with rule-based validation
3. **estree-toolkit:** https://www.npmjs.com/package/estree-toolkit — Fast ESTree AST manipulation
4. **Clinic.js:** https://clinicjs.org — Node.js performance profiling suite (CPU, memory, async)
5. **log-sweep:** https://github.com/AmElmo/log-sweep — AST-based console removal tool
6. **Existing ast.js:** src/lib/ast.js (1199 lines) — Current AST infrastructure
7. **Existing profiler.js:** src/lib/profiler.js (116 lines) — Current profiling infrastructure

---

## Confidence Assessment

| Area | Level | Reason |
|------|-------|--------|
| Architecture approach | HIGH | Extends existing patterns cleanly |
| Bundle size | HIGH | 15KB estimate well within budget |
| Integration pattern | HIGH | Uses existing util: namespace |
| External tools | MEDIUM | Optional wrappers, not required |
| Offline capability | HIGH | Core features work without external deps |

---

## Roadmap Implications

### Suggested Phase Structure

| Phase | Focus | Notes |
|-------|-------|-------|
| Phase 1 | audit.js core + util:audit run | Pattern detection for dead-code, complex functions |
| Phase 2 | util:profile run + baseline comparison | Extend existing profiler |
| Phase 3 | External tool wrappers | ESLint, prettier integration (optional) |
| Phase 4 | Audit trends + Performance trends | Historical analysis |

---

*Architecture research for: Code Audit & Performance Tooling Integration*
*Researched: 2026-03-12*
