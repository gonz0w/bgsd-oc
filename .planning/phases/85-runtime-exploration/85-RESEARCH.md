# Phase 85: Runtime Exploration - Research

**Researched:** 2026-03-10
**Domain:** Bun runtime detection, compatibility, and startup benchmarking
**Confidence:** HIGH

## Summary

This phase enables the bGSD plugin to detect Bun runtime availability, document compatibility, and benchmark startup performance. The research confirms Bun can be detected via `bun --version` command or PATH lookup using `which bun`. Bun shows 4-10x faster startup times compared to Node.js (~8ms vs ~40-80ms for CLI tools). However, Bun has known Node.js API compatibility gaps that must be documented as limitations.

**Primary recommendation:** Implement Bun detection using the existing tool detection infrastructure (Phase 82 pattern), with platform-specific install instructions. Use hyperfine or time-based benchmarking for startup comparison.

---

## User Constraints

From CONTEXT.md - These MUST be honored:

1. **Detection approach:** Use both detection methods - version command (`bun --version`) first, fallback to PATH lookup
2. **Cache behavior:** Cache detection results for current session only (session cache)
3. **Auto-detect:** Auto-detect Bun when running any bgsd-tools command
4. **No configuration:** Not configurable via settings - always auto-detect
5. **When Bun detected:** Show full details: Bun version, path, and that it's ready to use
6. **When NOT detected:** Show platform-specific install instructions (macOS, Linux, Windows)

---

## Standard Stack

### Core
| Library/Command | Version | Purpose | Why Standard |
|----------------|---------|---------|--------------|
| `bun --version` | N/A | Primary detection method | Returns version string, works cross-platform |
| `which bun` | N/A | Fallback detection | Standard PATH lookup, reliable |
| `process.versions.bun` | N/A | Runtime detection | Built-in Bun API for in-process detection |
| hyperfine | latest | Benchmarking | Rust-based, statistically rigorous timing |

### Supporting
| Library/Command | Purpose | When to Use |
|----------------|---------|-------------|
| `time` command | Simple benchmarking | When hyperfine unavailable |
| `/proc/time` (Linux) | Process timing | For inline timing in scripts |

---

## Architecture Patterns

### Recommended Project Structure

The Bun runtime exploration will extend the existing CLI tools infrastructure from Phase 82:

```
src/lib/
  cli-tools/
    detector.js      # Existing - TOOL_CONFIG extended with 'bun'
    install-guidance.js  # Existing - Add bun install instructions
    bun-runtime.js   # NEW - Bun detection, version, benchmark logic
```

### Pattern 1: Tool Detection with Session Caching

Following the Phase 82 pattern:

```javascript
// Detection order: version command first, then PATH lookup
async function detectBun() {
  // Try bun --version first
  try {
    const version = execFileSync('bun', ['--version'], { 
      encoding: 'utf8', 
      stdio: ['pipe', 'pipe', 'pipe'] 
    }).trim();
    if (version) {
      const path = execFileSync('which', ['bun'], { 
        encoding: 'utf8' 
      }).trim();
      return { available: true, version, path };
    }
  } catch {}
  
  // Fallback: PATH lookup only
  try {
    const path = execFileSync('which', ['bun'], { 
      encoding: 'utf8' 
    }).trim();
    if (path) return { available: true, path };
  } catch {}
  
  return { available: false };
}
```

### Pattern 2: Platform-Specific Install Instructions

Following install-guidance.js pattern:

```javascript
const BUN_INSTALL = {
  darwin: [
    'curl -fsSL https://bun.sh/install | bash',
    'brew install oven-sh/bun/bun'
  ],
  linux: [
    'curl -fsSL https://bun.sh/install | bash',
    'npm install -g bun'
  ],
  win32: [
    'powershell -c "irm bun.sh/install.ps1|iex"',
    'scoop install bun'
  ]
};
```

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Version detection | Custom parsing | `bun --version` | Standard CLI interface |
| PATH lookup | Custom PATH walking | `which bun` | OS-native, reliable |
| Startup timing | ad-hoc measurement | hyperfine or `time` | Statistically valid results |
| Platform detection | Custom os.name | `process.platform` | Node.js built-in |

---

## Common Pitfalls

### Pitfall 1: Incomplete Node.js API Compatibility
**What goes wrong:** Some npm packages fail because Bun doesn't implement all Node.js APIs.
**Why it happens:** Bun prioritizes speed and modern APIs over complete Node.js compatibility.
**How to avoid:** Document known incompatible APIs; don't assume all Node.js code runs on Bun.
**Warning signs:** `process.binding()` errors, missing `node:*` module exports.

### Pitfall 2: Windows WSL Requirement
**What goes wrong:** Bun on Windows requires WSL or specific versions.
**Why it happens:** Bun's native Windows support is limited to specific configurations.
**How to avoid:** Provide WSL instructions as primary Windows guidance.
**Warning signs:** PowerShell install failures on non-1809+ Windows.

### Pitfall 3: Version Detection Timeout
**What goes wrong:** `bun --version` hangs if Bun is installed but corrupted.
**Why it happens:** Binary exists but fails on execution.
**How to avoid:** Add timeout (3s) to version detection; fallback to PATH-only detection.
**Warning signs:** Detection hangs; must kill process.

---

## Code Examples

### Example 1: Detect Bun Runtime Availability

```javascript
const { execFileSync } = require('child_process');

function detectBun() {
  const cacheKey = 'bun';
  // Check session cache first (from Phase 82 pattern)
  if (sessionCache.has(cacheKey)) {
    return sessionCache.get(cacheKey);
  }
  
  let result = { available: false, name: 'bun', version: null, path: null };
  
  // Method 1: Try bun --version
  try {
    const version = execFileSync('bun', ['--version'], {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 3000
    }).trim();
    
    if (version) {
      result.available = true;
      result.version = version;
      
      const path = execFileSync('which', ['bun'], {
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe']
      }).trim();
      result.path = path;
    }
  } catch {
    // Fallback to PATH-only detection
    try {
      const path = execFileSync('which', ['bun'], {
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe']
      }).trim();
      
      if (path) {
        result.available = true;
        result.path = path;
      }
    } catch {
      // Not available
    }
  }
  
  sessionCache.set(cacheKey, result);
  return result;
}
```

### Example 2: Benchmark Startup Time

```javascript
const { execFileSync } = require('child_process');
const path = require('path');

function benchmarkStartup(scriptPath, runs = 10) {
  const results = {
    node: [],
    bun: []
  };
  
  // Benchmark Node.js
  for (let i = 0; i < runs; i++) {
    const start = Date.now();
    try {
      execFileSync('node', [scriptPath], { 
        stdio: 'pipe',
        timeout: 5000 
      });
      results.node.push(Date.now() - start);
    } catch {}
  }
  
  // Benchmark Bun
  for (let i = 0; i < runs; i++) {
    const start = Date.now();
    try {
      execFileSync('bun', [scriptPath], { 
        stdio: 'pipe',
        timeout: 5000 
      });
      results.bun.push(Date.now() - start);
    } catch {}
  }
  
  const avgNode = results.node.reduce((a, b) => a + b, 0) / results.node.length;
  const avgBun = results.bun.reduce((a, b) => a + b, 0) / results.bun.length;
  
  return {
    node: avgNode.toFixed(2) + 'ms',
    bun: avgBun.toFixed(2) + 'ms',
    speedup: (avgNode / avgBun).toFixed(2) + 'x'
  };
}
```

### Example 3: Runtime Detection (Bun-specific code)

```javascript
// Check if running under Bun at runtime
function isRunningUnderBun() {
  // Method 1: Check process.versions.bun
  if (process.versions.bun) {
    return { isBun: true, version: process.versions.bun };
  }
  
  // Method 2: Check global Bun object
  if (typeof Bun !== 'undefined') {
    return { isBun: true, version: Bun.version };
  }
  
  // Method 3: Check globalThis
  if ('Bun' in globalThis) {
    return { isBun: true, version: globalThis.Bun?.version };
  }
  
  return { isBun: false };
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Node.js only | Bun detection optional | 2026 (this phase) | Enables runtime switching |
| Manual timing | hyperfine-based benchmarking | 2026 (this phase) | Statistically valid comparisons |
| No runtime info | Auto-detect on every command | 2026 (this phase) | User awareness of Bun |

---

## Open Questions

1. **Minimum Bun version:** Should the plugin enforce a minimum Bun version? If so, what version?
2. **Auto-switching:** Should bgsd-tools automatically use Bun when available, or just report availability?
3. **Benchmark complexity:** Should benchmarks measure simple script execution or full CLI initialization?

---

## Sources

### Primary (HIGH confidence)
- https://bun.com/docs/guides/util/detect-bun - Official Bun detection docs
- https://bun.com/docs/guides/util/version - Official version docs
- https://bun.sh/docs/installation - Official installation guide

### Secondary (MEDIUM confidence)
- https://www.pkgpulse.com/blog/bun-vs-nodejs-2026 - Startup benchmark data
- https://github.com/oven-sh/bun/issues/3546 - Known Node.js API incompatibilities
- https://www.bolderapps.com/blog-posts/node-js-vs-bun-vs-deno-the-ultimate-runtime-performance-showdown - Performance comparison

### Tertiary (LOW confidence)
- https://www.reddit.com/r/bun/comments/1ggl7rd/ - Community feedback on Bun limitations

---

## Metadata

**Confidence breakdown:** 
- Detection methods: HIGH (official docs)
- Benchmarking approach: HIGH (industry standard)
- Compatibility info: MEDIUM (evolving, check current Bun version)
- Install instructions: HIGH (official docs)

**Research date:** 2026-03-10
**Valid until:** 2026-09-10 (Bun API changes slowly, but check version quarterly)
