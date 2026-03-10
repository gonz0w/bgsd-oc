# Architecture Research: CLI Tool Integrations & Bun Runtime (v9.2)

**Research mode:** Ecosystem -> Architecture Integration
**Scope:** How CLI tool integrations (ripgrep, fd, fzf, bat, gh, lazygit, jq, yq) integrate with existing architecture, and Bun runtime integration
**Question:** How do CLI tool integrations and Bun runtime integrate with existing bGSD architecture?
**Date:** 2026-03-10
**Overall confidence:** HIGH (research patterns + Context7 docs + existing architecture)

## Executive Recommendation

Adopt a **subprocess wrapper layer** pattern with tool detection and graceful fallback. This integrates seamlessly with existing `child_process.execSync` patterns already used in the codebase.

For Bun runtime: Use a **runtime abstraction adapter** that detects Bun and provides Bun-native spawn while maintaining Node.js compatibility.

---

## Integration Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     CLI Router (existing)                    │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────────┐  ┌──────────────────────────────────┐ │
│  │ Existing Modules │  │     NEW: CLI Tools Layer         │ │
│  │  (src/lib/cmd/) │  │  ┌────────────────────────────┐  │ │
│  └────────┬─────────┘  │  │ cli-tools/detector.js    │  │ │
│           │             │  │ (availability check)      │  │ │
│           │             │  ├────────────────────────────┤  │ │
│           │             │  │ cli-tools/ripgrep.js     │  │ │
│           │             │  │ cli-tools/fd.js         │  │ │
│           │             │  │ cli-tools/fzf.js        │  │ │
│           │             │  │ cli-tools/bat.js         │  │ │
│           │             │  │ cli-tools/gh.js          │  │ │
│           │             │  │ cli-tools/lazygit.js    │  │ │
│           │             │  │ cli-tools/jq.js         │  │ │
│           │             │  │ cli-tools/yq.js         │  │ │
│           │             │  └────────────────────────────┘  │ │
│           │             │  ┌────────────────────────────┐  │ │
│           │             │  │ runtime/bun-runtime.js    │  │ │
│           │             │  │ (Bun detection/adapter)  │  │ │
│           │             │  └────────────────────────────┘  │ │
│           │             └──────────────────────────────────┘ │
└───────────┼─────────────────────────────────────────────────┘
            │
            ▼
┌─────────────────────────────────────────────────────────────┐
│                  Node.js child_process                       │
│              (or Bun.spawn for Bun runtime)                 │
└─────────────────────────────────────────────────────────────┘
```

---

## Integration Points

### New vs Modified Files

| File | Type | Purpose |
|------|------|---------|
| `src/lib/cli-tools/` | NEW (directory) | All CLI tool wrappers |
| `src/lib/cli-tools/index.js` | NEW | Unified export, registry |
| `src/lib/cli-tools/detector.js` | NEW | Availability detection + caching |
| `src/lib/cli-tools/ripgrep.js` | NEW | ripgrep wrapper |
| `src/lib/cli-tools/fd.js` | NEW | fd wrapper |
| `src/lib/cli-tools/fzf.js` | NEW | fzf wrapper |
| `src/lib/cli-tools/bat.js` | NEW | bat wrapper |
| `src/lib/cli-tools/gh.js` | NEW | gh wrapper |
| `src/lib/cli-tools/lazygit.js` | NEW | lazygit wrapper |
| `src/lib/cli-tools/jq.js` | NEW | jq wrapper |
| `src/lib/cli-tools/yq.js` | NEW | yq wrapper |
| `src/lib/runtime/bun-runtime.js` | NEW | Bun detection + adapter |
| `src/lib/git.js` | MODIFIED | Could use ripgrep for advanced queries |
| Router/commands | MODIFIED | Add new CLI tool commands |

---

## Architectural Patterns

### Pattern 1: Subprocess Wrapper with Sanitization

**What:** Standardized wrapper around `execSync` with tool detection, argument sanitization, error handling, and output parsing.

**When to use:** Non-interactive CLI tools (ripgrep, fd, bat, jq, yq, gh)

**Trade-offs:**
- Pros: Consistent API, centralized error handling, easy fallbacks
- Cons: Synchronous blocking, less control over streaming

**Example:**
```javascript
// src/lib/cli-tools/ripgrep.js
const { execSync } = require('child_process');
const { sanitizeShellArg } = require('../lib/utils.js');

function ripgrep(pattern, options = {}) {
  const { cwd = process.cwd(), glob = null, ignoreCase = false } = options;
  
  // Tool availability check (cached)
  if (!detector.isAvailable('ripgrep')) {
    throw new Error('ripgrep not installed');
  }
  
  // Build args array
  const args = ['--line-number'];
  if (ignoreCase) args.push('--ignore-case');
  if (glob) args.push('--glob', glob);
  args.push('--', pattern];
  
  try {
    const output = execSync(['rg', ...args].join(' '), {
      cwd,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe']
    });
    return parseRipgrepOutput(output);
  } catch (error) {
    if (error.status === 1) return []; // No matches
    throw new Error(`ripgrep failed: ${error.stderr}`);
  }
}
```

### Pattern 2: TTY Passthrough for Interactive Tools

**What:** Spawn interactive tools (fzf, lazygit) with `stdio: 'inherit'` to pass through terminal control.

**When to use:** TUI tools requiring terminal control (fzf, lazygit)

**Trade-offs:**
- Pros: Full interactivity, familiar UX
- Cons: Blocks execution, no output capture

**Example:**
```javascript
// src/lib/cli-tools/lazygit.js
const { spawn } = require('child_process');

function launchLazygit(args = [], options = {}) {
  const proc = spawn('lazygit', args, {
    cwd: options.cwd || process.cwd(),
    stdio: 'inherit',  // Pass through TTY
    env: { ...process.env, ...options.env }
  });
  
  return new Promise((resolve, reject) => {
    proc.on('close', (code) => {
      if (code === 0) resolve({ success: true });
      else reject(new Error(`lazygit exited with code ${code}`));
    });
    proc.on('error', reject);
  });
}
```

### Pattern 3: Tool Availability Detection with Graceful Fallback

**What:** Check tool availability at startup, cache result, provide fallback behavior when tool unavailable.

**When to use:** Optional CLI tool dependencies

**Example:**
```javascript
// src/lib/cli-tools/detector.js
const { execSync } = require('child_process');

const cache = new Map();

function isAvailable(tool) {
  if (cache.has(tool)) return cache.get(tool);
  
  try {
    execSync(`${tool} --version`, { stdio: 'ignore' });
    cache.set(tool, true);
    return true;
  } catch {
    cache.set(tool, false);
    return false;
  }
}

function requireTool(tool) {
  if (!isAvailable(tool)) {
    throw new Error(`Required tool '${tool}' not found. Install with: ...`);
  }
}
```

### Pattern 4: Runtime Abstraction Layer

**What:** Abstract subprocess spawning behind runtime-agnostic API that works with both Node.js and Bun.

**When to use:** Supporting multiple JS runtimes

**Example:**
```javascript
// src/lib/runtime/bun-runtime.js
const isBun = process.versions.bun !== undefined;

function spawnSubprocess(command, args, options = {}) {
  if (isBun) {
    return Bun.spawn([command, ...args], options);
  } else {
    const { spawn } = require('child_process');
    return spawn(command, args, options);
  }
}

module.exports = { isBun, spawnSubprocess };
```

---

## Data Flow

### Request Flow: CLI Tool Invocation

```
[Caller Code]
    │
    ▼
[cli-tools/index.js] → [tool-specific wrapper]
    │
    ▼
[detector.isAvailable()] ──cache──→ Check tool installed
    │
    ▼ (tool available)
[execSync / spawn]
    │
    ▼
[Parse output] → Return structured data
    │
    ▼
[Caller receives result]
```

### Request Flow: Interactive Tool (fzf/lazygit)

```
[Caller Code]
    │
    ▼
[cli-tools/lazygit.js / fzf.js]
    │
    ▼
[detector.isAvailable()]
    │
    ▼
[spawn with stdio: 'inherit']
    │
    ▼
[User interacts with TUI]
    │
    ▼
[Process exits] → Return exit code
```

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Shell Injection via Unsanitized Input

**What people do:**
```javascript
// BAD
execSync(`rg ${userPattern}`);  // Injection risk!
```

**Do this instead:**
```javascript
// GOOD
execSync(['rg', '--', userPattern]);  // Array form, no shell
```

### Anti-Pattern 2: Hard Dependency on Optional Tools

**What people do:** Assume all CLI tools are installed, crash if missing

**Do this instead:** Detect availability, provide clear error with install instructions
```javascript
if (!detector.isAvailable('ripgrep')) {
  throw new Error('ripgrep not found. Install: brew install ripgrep');
}
```

### Anti-Pattern 3: Blocking Interactive Tools Without TTY

**What people do:** Try to run fzf/lazygit with piped I/O instead of TTY passthrough

**Do this instead:** Use `stdio: 'inherit'`
```javascript
spawn('lazygit', [], { stdio: 'inherit' });
```

### Anti-Pattern 4: Not Handling Non-Zero Exit Codes

**What people do:** Ignore exit codes, treat all errors as exceptions

**Do this instead:** Check specific exit codes
```javascript
try {
  return execSync(['rg', pattern], { cwd });
} catch (error) {
  if (error.status === 1) return [];  // No matches - valid
  throw error;  // Actual error
}
```

---

## Build Order Recommendation

1. **Phase 1:** `cli-tools/detector.js` + basic structure (foundation)
2. **Phase 2:** Non-interactive tools (ripgrep, fd, bat, jq, yq) — easier to test
3. **Phase 3:** Interactive tools (fzf, lazygit) — TTY handling complexity
4. **Phase 4:** GitHub CLI integration (gh) — requires auth flow
5. **Phase 5:** Bun runtime adapter — optional, progressive enhancement

---

## Confidence Assessment

| Area | Level | Reason |
|------|-------|--------|
| CLI tool integration patterns | HIGH | Based on existing child_process usage in codebase + Context7 docs |
| ripgrep/fd/fzf/bat integration | HIGH | Mature tools, well-documented APIs |
| gh/lazygit integration | HIGH | Standard subprocess patterns, clear TTY requirements |
| jq/yq integration | HIGH | Simple pipe-through patterns |
| Bun runtime integration | MEDIUM | Bun API compatible with Node.js but requires testing |

---

## Sources

1. **Node.js child_process docs:** https://nodejs.org/api/child_process.html
2. **Bun spawn documentation:** https://github.com/oven-sh/bun/blob/main/docs/runtime/child-process.mdx
3. **Context7 Bun docs:** /oven-sh/bun
4. **ripgrep documentation:** https://github.com/BurntSushi/ripgrep
5. **fd finder documentation:** https://github.com/sharkdp/fd
6. **fzf documentation:** https://github.com/junegunn/fzf
7. **bat documentation:** https://github.com/sharkdp/bat
8. **GitHub CLI documentation:** https://cli.github.com/
9. **lazygit documentation:** https://github.com/jesseduffield/lazygit
10. **jq manual:** https://stedolan.github.io/jq/manual/
11. **yq documentation:** https://github.com/mikefarah/yq

---
*Architecture research for: CLI Tool Integration & Bun Runtime*
*Researched: 2026-03-10*
