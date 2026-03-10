# Phase 89: Runtime Bun Migration - Research

**Researched:** 2026-03-10
**Domain:** Bun runtime integration with Node.js CLI tool
**Confidence:** HIGH

## Summary

Phase 89 focuses on fully integrating Bun runtime into the bGSD CLI tool while maintaining backward compatibility. The existing codebase already has Bun detection infrastructure (`src/lib/cli-tools/bun-runtime.js`) with session caching, but full integration requires:

1. **Startup integration**: Detecting Bun at CLI startup and re-running scripts with Bun when available
2. **Config persistence**: Caching detection results in project config for faster subsequent runs
3. **User controls**: Config option to force Node.js, env var override (BUN_PATH)
4. **Benchmarking**: Demonstrating 3-5x startup improvement

**Primary recommendation:** Extend the existing `bun-runtime.js` module with config persistence, add startup banner output, integrate Bun script execution into the router, and validate 3-5x speedup with the existing benchmark command.

## User Constraints

(from 89-CONTEXT.md - these are LOCKED decisions)

- Detect using `bun --version` command
- Any Bun version works (agent determines if minimum version needed)
- Check at startup and cache result in config for faster subsequent runs
- Inform user when Bun is detected/available
- Silent fail if detection command fails (continue with fallback)
- If multiple Bun installations found, use highest version
- Agent decides on override mechanism (e.g., BUN_PATH env var)

### Backward compatibility (LOCKED)
- Auto-detect Bun with automatic fallback to Node.js
- Allow config option to force Node.js and skip Bun entirely
- Existing Node.js projects work identically with Bun (same behavior)
- No migration steps required — seamless adoption

### Fallback behavior (LOCKED)
- When Bun not available, automatically use Node.js
- Notify user when falling back to Node.js
- If Bun found but version doesn't meet requirements, fall back to Node.js
- Remember fallback decision for the session (cache decision)

### Output/reporting (LOCKED)
- Startup banner showing which runtime is being used
- Banner shows runtime name + version (e.g., "Running with Bun v1.2.3")
- When falling back to Node.js, show "Falling back to Node.js"
- Verbose mode (-v) shows additional runtime details

### Agent's Discretion (research these options)
- Minimum Bun version requirement (if any)
- Override mechanism design (env var, config key)
- Exact banner format and styling
- What extra details to show in verbose mode

## Phase Requirements

| Requirement | Description |
|-------------|-------------|
| RUNT-01 | Bun runtime fully integrated — 3-5x startup improvement demonstrated |
| RUNT-02 | Backward compatible — projects without Bun work exactly as before |
| RUNT-03 | Bundle size not significantly increased by Bun support |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Bun | 1.x | JavaScript runtime with native bundler, test runner | 4x faster startup than Node.js on Linux |
| Node.js | 18+ | Fallback runtime | Existing CLI foundation |

### Existing Infrastructure
| Module | Purpose | Status |
|--------|---------|--------|
| `src/lib/cli-tools/bun-runtime.js` | Bun detection, benchmarking | Already implemented |
| `src/commands/runtime.js` | Runtime status and benchmark commands | Already implemented |
| `src/router.js` | CLI entry point | Needs Bun integration |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| execFileSync | Node.js built-in | Subprocess execution with shell injection prevention | Detecting Bun availability |

## Architecture Patterns

### Recommended Project Structure

```
src/
├── lib/
│   ├── cli-tools/
│   │   └── bun-runtime.js      # Existing - extend with config persistence
│   └── config.js               # Extend to read Bun config options
├── commands/
│   └── runtime.js              # Existing - benchmark already implemented
└── router.js                   # Integrate Bun detection at startup
```

### Pattern 1: Runtime Detection at Startup

The CLI should detect Bun at startup, cache the result, and optionally re-execute itself with Bun:

```javascript
// In router.js - at startup
const { detectBun } = require('./lib/cli-tools/bun-runtime');
const config = require('./lib/config');

// Check config for forced runtime
const forcedRuntime = config.runtime || process.env.BGSD_RUNTIME;

// Detect Bun
const bunStatus = detectBun();
const useBun = forcedRuntime === 'bun' || 
  (!forcedRuntime && bunStatus.available);

// Re-execute with Bun if applicable
if (useBun && !process.versions.bun) {
  execFileSync('bun', [process.argv[1], ...process.argv.slice(2)], {
    stdio: 'inherit',
    env: { ...process.env, BGSD_RUNTIME: 'bun' }
  });
  process.exit(0);
}
```

### Pattern 2: Config-Based Runtime Selection

Add to CONFIG_SCHEMA:

```javascript
runtime: {
  type: 'string',
  default: 'auto',  // 'auto' | 'node' | 'bun'
  description: 'Runtime to use (auto/bun/node)',
  aliases: [],
  nested: null
}
```

### Anti-Patterns to Avoid

1. **Blocking on detection**: Don't let Bun detection block CLI startup - use cached results
2. **Version pinning without need**: Don't require specific Bun version unless necessary
3. **Silent failures without fallback**: Always fallback to Node.js, never block

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Subprocess detection | Custom PATH searching | `execFileSync('bun', ['--version'])` | Security - prevents shell injection |
| Version comparison | Custom semver parsing | Simple string or numeric comparison | No need for full semver |
| Script execution | shell:true in spawn | execFileSync with array args | Prevents shell injection |

## Common Pitfalls

### Pitfall 1: Re-execution Loop
**What goes wrong:** CLI detects Bun, re-executes with Bun, Bun CLI detects Bun, re-executes...
**Why it happens:** No guard to prevent re-execution when already running under Bun
**How to avoid:** Check `process.versions.bun` before re-executing, or set an environment flag
**Warning signs:** Infinite loop, stack overflow, CLI hangs on startup

### Pitfall 2: Blocking Startup with Detection
**What goes wrong:** CLI hangs on startup while waiting for Bun detection
**Why it happens:** Network timeout or slow PATH resolution
**How to avoid:** Use session cache (already implemented), add timeout to detection
**Warning signs:** Slow CLI startup, especially on first run

### Pitfall 3: Bundle Size Bloat
**What goes wrong:** Adding Bun support significantly increases bundle size
**Why it happens:** Including Bun-related code that isn't tree-shakeable
**How to avoid:** Keep detection code minimal, use lazy loading
**Warning signs:** Bundle size exceeds 1500KB threshold

### Pitfall 4: Detection Failure Breaks CLI
**What goes wrong:** CLI crashes when Bun detection fails unexpectedly
**Why it happens:** No try-catch around detection code
**How to avoid:** Wrap detection in try-catch, always fallback to Node.js
**Warning signs:** CLI fails to start on systems without Bun

## Code Examples

### Detecting Bun from Node.js (already implemented)

```javascript
// src/lib/cli-tools/bun-runtime.js
const { execFileSync } = require('child_process');

function detectBun() {
  try {
    const version = execFileSync('bun', ['--version'], {
      encoding: 'utf8',
      timeout: 3000
    }).trim();
    return { available: true, version };
  } catch {
    return { available: false };
  }
}
```

### Running Scripts with Bun (from Context7)

```javascript
// When Bun is detected, re-execute the current script with Bun
const proc = Bun.spawn(['bun', scriptPath], {
  cwd: './my-project',
  env: { ...process.env, NODE_ENV: 'production' },
  stdout: 'pipe',
  stderr: 'inherit'
});
```

### Detecting if Running Under Bun

```javascript
// Check if currently running with Bun
if (process.versions.bun) {
  console.log('Running with Bun v' + process.versions.bun);
} else {
  console.log('Running with Node.js v' + process.version);
}
```

### Startup Banner Pattern

```javascript
function showRuntimeBanner(runtime, version, isFallback = false) {
  if (isFallback) {
    console.log('[bGSD] Falling back to Node.js');
  } else if (runtime === 'bun') {
    console.log(`[bGSD] Running with Bun v${version}`);
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Node.js only | Bun detection + fallback | Phase 85 | Enables 4x faster startup |
| Session-only cache | Config-persisted cache | Phase 89 (this phase) | Faster subsequent runs |
| No runtime banner | Startup runtime banner | Phase 89 (this phase) | User visibility |
| No runtime choice | Config-based runtime selection | Phase 89 (this phase) | User control |

## Open Questions

1. **Minimum Bun version?** Is there a specific Bun version needed for compatibility? Current code accepts any version.
2. **Config key name?** Should be `runtime` or `prefer_runtime` or something else?
3. **Banner styling?** Should match existing CLI formatting or be minimal?
4. **Verbose mode details?** What extra runtime info should be shown with `-v`?

## Sources

### Primary (HIGH confidence)
- [Bun Runtime Documentation](https://github.com/oven-sh/bun/blob/main/docs/runtime/index.mdx) — Official docs confirming 4x faster startup on Linux
- [Bun Child Process](https://github.com/oven-sh/bun/blob/main/docs/runtime/child-process.mdx) — Official spawn API
- [Detect Bun](https://bun.sh/docs/guides/util/detect-bun) — Official guide for detecting Bun runtime

### Secondary (MEDIUM confidence)
- [Bun vs Node.js 2025](https://zoer.ai/posts/zoer/bun-vs-nodejs-performance-comparison-2025) — 2-4x performance advantage confirmed
- [Bun vs Node.js Comparison](https://strapi.io/blog/bun-vs-nodejs-performance-comparison-guide) — Migration patterns
- [FutureStudio: Detect Node.js running with Bun](https://futurestud.io/tutorials/detect-if-youre-running-a-node-js-script-with-bun) — Detection patterns

### Tertiary (LOW confidence)
- [DEV Community: Bun Performance](https://dev.to/nesterow/bunjs-is-indeed-faster-1man) — Mixed real-world results noted

## Metadata

**Confidence breakdown:** 
- Bun detection patterns: HIGH (official docs)
- 4x startup improvement: HIGH (official docs + Context7 verified)
- Config integration approach: HIGH (existing codebase patterns)
- Bundle size impact: MEDIUM (needs validation during implementation)

**Research date:** 2026-03-10
**Valid until:** 2026-09-10 (6 months)
