# Stack Research — Code Audit & Performance Tools

**Domain:** Code Audit & Performance Tools for Node.js CLI
**Researched:** 2026-03-12
**Confidence:** HIGH

<!-- section: compact -->
<stack_compact>
<!-- Compact view for planners. Keep under 25 lines. -->

**Core stack (built-in + lightweight):**

| Technology | Purpose | Version |
|------------|---------|---------|
| acorn | AST parsing (already bundled) | ^9.0.0 |
| node:inspector | CPU/memory profiling | built-in |
| node:perf_hooks | Performance metrics | built-in |

**External CLI tools (invoke as subprocess):**

| Tool | Purpose | Install |
|------|---------|---------|
| knip | Unused deps/exports/files | `npm i -D knip` |
| unimported | Unused source files | `npm i -D unimported` |
| eslint | Code quality rules | `npm i -D eslint` |

**Avoid bundling:** ESLint (~114KB), clinic.js (CLI-only), Knip (14 deps)

**Install:** `npm install acorn acorn-walk` (or use built-ins + CLI tools)
</stack_compact>
<!-- /section -->

<!-- section: recommended_stack -->
## Recommended Stack

### Core Technologies (Already Available or Built-in)

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| acorn | ^9.0.0 | AST parsing for code analysis | Already bundled in bGSD (~114KB). Provides full ESTree AST for analyzing code structure. |
| acorn-walk | ^9.0.0 | AST traversal utilities | Lightweight companion to acorn. Enables visitor-pattern code analysis without bundling a linter. |
| node:inspector | built-in | CPU profiling, heap snapshots | No external deps. Can capture profiles programmatically and save to files. |
| node:perf_hooks | built-in | Performance timing, event loop metrics | Built-in since Node.js 12. No deps. Provides precise timing data. |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| acorn | ^9.0.0 | Parse JavaScript into AST | For custom analysis (unused exports, complexity, pattern detection) |
| acorn-walk | ^9.0.0 | Traverse AST nodes | For implementing custom rules without bundling ESLint |

### External CLI Tools (Subprocess Invocation)

| Tool | Purpose | Notes |
|------|---------|-------|
| knip | Unused dependencies, exports, files | 8.1k stars, TypeScript-based, comprehensive. Run via `npx knip`. |
| unimported | Unused source files | Simpler than Knip, faster for quick checks. Run via `npx unimported`. |
| ESLint | Code quality rules | Use existing `.eslintrc` for complexity, no-unused-vars, require-atomic-updates. Run via `npx eslint`. |

## Installation

```bash
# Core AST utilities (add to dependencies)
npm install acorn acorn-walk

# CLI tools for detailed analysis (dev dependencies)
npm install -D knip unimported eslint

# No changes needed for profiling — use built-in node:inspector
```
<!-- /section -->

## Existing Stack (Pre v11.1)
- Node.js >= 22.5 (for node:sqlite)
- esbuild (bundler)
- acorn (AST parsing) — already bundled
- tokenx (token estimation)
- picocolors (inline, TTY-aware colors)
- inquirer ^8.x (interactive prompts)

<!-- section: alternatives -->
## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| acorn + acorn-walk | ESLint (bundled) | Need full lint rule ecosystem. Warning: adds ~114KB, complex API |
| node:inspector | clinic.js | When visual flamegraphs needed. Warning: CLI-only, not bundleable |
| knip (CLI) | depcheck | depcheck is unmaintained; Knip is actively maintained |
| Custom AST analysis | eslint-plugin-unused-imports | Only if already using ESLint; adds linter dependency |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| ESLint (bundled) | Heavy (~114KB), complex API, requires separate config | Use acorn-walk for custom analysis + ESLint CLI for rules |
| clinic.js | CLI-only tool, cannot be bundled or invoked programmatically | node:inspector + node:perf_hooks for built-in profiling |
| Knip (bundled) | 14 dependencies, TypeScript-based, heavy for CLI tool | Use via npx CLI for periodic checks |
| depcheck | Unmaintained since 2024 | knip or unimported |
| ts-morph | Heavy (~1MB), TypeScript-only | acorn-walk for JS analysis |
<!-- /section -->

<!-- section: patterns -->
## Stack Patterns by Variant

**If the goal is real-time code analysis during CLI execution:**
- Use acorn + acorn-walk for custom AST analysis
- Implement detection for: unused exports (walk exports, check imports), complexity (count branch nodes), file dependencies (trace require/import)
- Reason: Zero external deps, fully programmatic, fits single-file architecture

**If the goal is comprehensive codebase audit (periodic):**
- Invoke `npx knip` or `npx unimported` as subprocess
- Parse JSON output for reporting
- Reason: These tools have large dependency trees; CLI invocation is appropriate

**If the goal is performance profiling:**
- Use node:inspector for CPU profiles: `session.post('Profiler.start')`, `session.post('Profiler.stop')`
- Use node:perf_hooks for timing: `perf_hooks.performance.mark()`, `perf_hooks.performance.measure()`
- Reason: Built-in, no deps, programmatic control

**If the goal is N+1 / race condition detection:**
- These patterns are primarily runtime issues; static detection is limited
- For race conditions: use ESLint's `require-atomic-updates` rule via CLI
- For N+1: Not applicable — bGSD doesn't use an ORM; file I/O patterns are already async
<!-- /section -->

<!-- section: compatibility -->
## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|-----------------|-------|
| acorn@^9.0.0 | acorn-walk@^9.0.0 | Must match major versions |
| acorn@^9.0.0 | Node.js 18+ | acorn 9+ requires Node 14.8+ |
| node:inspector | Node.js 8+ | Built-in since Node 8, stable |
| node:perf_hooks | Node.js 12+ | Stable since Node 12 |

## Detection Capabilities by Approach

| Detection Target | Method | Tool |
|-----------------|--------|------|
| Unused exports | AST analysis | acorn-walk (custom) |
| Unused files | CLI scan | knip / unimported |
| Duplicate code | ESLint rules | no-dupe-else-if, no-duplicate-imports |
| Complexity | AST analysis | acorn-walk (custom count) |
| Race conditions | ESLint rule | require-atomic-updates |
| N+1 patterns | Not applicable | No ORM in bGSD |
| Performance bottlenecks | Profiling | node:inspector |
| Event loop metrics | Timing | node:perf_hooks |

## Sources

- Context7 (/eslint/eslint) — confirmed complexity, no-unused-vars, require-atomic-updates rules
- Context7 (/webpro-nl/knip) — confirmed 8.1k stars, unused detection, CLI usage
- Context7 (/acornjs/acorn) — confirmed plugin architecture, AST walking
- WebSearch — verified clinic.js is CLI-only, no programmatic API
- WebSearch — verified depcheck is unmaintained, recommends knip
- WebSearch — confirmed N+1 detection is ORM-specific (TypeORM, Prisma), not applicable to bGSD

---

*Stack research for: Code Audit & Performance Tools*
*Researched: 2026-03-12*
