# Phase 82: Tool Detection Infrastructure - Research

**Researched:** 2026-03-10
**Domain:** CLI Tool Availability Detection / Node.js Subprocess Management
**Confidence:** HIGH

## Summary

Phase 82 establishes the foundational tool detection infrastructure for bGSD v9.2 CLI integrations. The phase delivers three key capabilities: (1) detecting which CLI tools (ripgrep, fd, jq, yq, bat, gh) are available on the system, (2) showing clear, platform-specific install instructions when tools are missing, and (3) gracefully falling back to existing Node.js implementations when CLI tools are unavailable.

**Primary recommendation:** Use `execFileSync('which', [binaryName])` with a simple in-memory Map cache for tool availability detection. Create a `detectTool()` function that returns `{ available: boolean, path?: string, version?: string }`. Use `process.platform` for platform detection and embed platform-specific install instructions in a lookup table.

## User Constraints

Based on 82-CONTEXT.md decisions:

| Constraint | Requirement |
|------------|-------------|
| **Detail level** | Detailed multi-line output showing what tool does, why needed, how to install, alternatives |
| **Platform detection** | Auto-detect OS and show install commands specific to that platform (macOS, Linux, Windows) |
| **Fallback mention** | Per-operation basis — each operation decides whether to mention the Node.js fallback |
| **When to show** | On-demand (lazy) — only when user runs a command that needs the missing tool |

Agent's discretion: Exact wording/formatting, OS detection method (node os module), cache duration/invalidation, how each operation mentions fallbacks.

## Phase Requirements

| ID | Requirement | Success Criteria |
|----|-------------|------------------|
| CLI-01 | Plugin can detect available CLI tools (ripgrep, fd, jq, etc.) with caching | Tool detection returns available/unavailable status with caching |
| CLI-02 | Plugin shows clear install instructions when CLI tool is unavailable | Platform-specific install commands displayed for macOS/Linux/Windows |
| CLI-03 | Plugin gracefully degrades to existing Node.js implementations when CLI tools unavailable | Operations work without errors using Node.js fallbacks |

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Node.js `child_process` | Built-in | Subprocess execution | Already in use via src/lib/git.js; use `execFileSync` not `execSync` to prevent shell injection |
| Node.js `process.platform` | Built-in | Platform detection | Returns 'darwin'/'linux'/'win32' for macOS/Linux/Windows |
| None (zero dependencies) | — | Tool detection | Use `which` command via execFileSync, no npm package needed |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Node.js `os` module | Built-in | OS details (release, arch) | When platform-specific version detection needed |
| Node.js `Map` | Built-in | In-memory caching | Tool availability cache with TTL |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `which` command | `command -v` (bash) | `which` is more portable across shells; `command -v` requires bash |
| `which` npm package | Shelljs or bash authors' which | Zero dependencies preferred; execFileSync('which') sufficient |
| Cache invalidation | SQLite persistent cache | Simplicity; Map with TTL sufficient for tool detection |
| execSync | execFileSync with array args | execFileSync prevents shell injection (REQUIRED) |

## Architecture Patterns

### Recommended Project Structure

```
bin/bgsd-tools.cjs
├── lib/
│   └── cli-tools/
│       ├── detector.js      # Tool availability detection with caching
│       ├── index.js         # Unified exports
│       └── install-guidance.js  # Platform-specific install instructions
```

### Pattern 1: Tool Detection with Cache

```javascript
// Simple in-memory cache with TTL
const toolCache = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

function detectTool(binaryName) {
  const cached = toolCache.get(binaryName);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.result;
  }
  
  try {
    const path = execFileSync('which', [binaryName], { 
      encoding: 'utf-8', 
      stdio: ['pipe', 'pipe', 'pipe'] 
    }).trim();
    
    const result = { available: true, path };
    toolCache.set(binaryName, { result, timestamp: Date.now() });
    return result;
  } catch (error) {
    const result = { available: false };
    toolCache.set(binaryName, { result, timestamp: Date.now() });
    return result;
  }
}
```

### Pattern 2: Platform-Specific Install Guidance

```javascript
const INSTALL_GUIDANCE = {
  ripgrep: {
    name: 'ripgrep',
    description: 'Ultra-fast grep alternative that respects .gitignore',
    macos: 'brew install ripgrep',
    linux: 'sudo apt install ripgrep',
    windows: 'winget install BurntSushi.ripgrep.MSVC'
  },
  fd: {
    name: 'fd',
    description: 'Fast find alternative that respects .gitignore',
    macos: 'brew install fd',
    linux: 'sudo apt install fd-find',
    windows: 'winget install sharkdp.fd'
  },
  // ... other tools
};

function getInstallGuidance(toolName, platform) {
  const guidance = INSTALL_GUIDANCE[toolName];
  if (!guidance) return null;
  
  return {
    tool: guidance.name,
    description: guidance.description,
    installCommand: guidance[platform] || guidance.linux
  };
}
```

### Pattern 3: Graceful Fallback Wrapper

```javascript
function withToolFallback(toolName, cliFn, nodeJsFallback) {
  const detection = detectTool(toolName);
  
  if (!detection.available) {
    const guidance = getInstallGuidance(toolName, process.platform);
    return {
      success: false,
      usedFallback: true,
      guidance,  // For display to user
      result: nodeJsFallback()  // Actually use Node.js fallback
    };
  }
  
  return {
    success: true,
    usedFallback: false,
    result: cliFn()  // Use CLI tool
  };
}
```

### Anti-Patterns to Avoid

| Anti-Pattern | Why It's Wrong | Correct Approach |
|--------------|----------------|------------------|
| `execSync('which ' + binaryName)` | Shell injection vulnerability | Use `execFileSync('which', [binaryName])` with array args |
| Detecting tools at startup (eager) | Unnecessary latency | Lazy detection on first use |
| Showing install guidance proactively | Annoys users who don't need the tool | Show on-demand when operation needs missing tool |
| Hardcoding install commands | Cross-platform breakage | Platform detection + lookup table |

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Tool detection | Custom PATH parsing | `which` command via execFileSync | Portable, handles PATH, handles shebangs |
| Platform detection | Environment variable guessing | `process.platform` | Node.js built-in, reliable |
| Install instructions | Dynamic web scraping | Static lookup table | Reliable, no network needed, faster |
| Shell execution | execSync with string interpolation | execFileSync with array args | Prevents shell injection |

## Common Pitfalls

### Pitfall 1: Shell Injection via execSync
**What goes wrong:** User input in command string allows arbitrary code execution.  
**Why it happens:** execSync passes string through shell, interpolating variables.  
**How to avoid:** Always use execFileSync with array arguments: `execFileSync('rg', ['pattern', path])`, never `execSync('rg ' + pattern)`.  
**Warning signs:** Any string interpolation in execSync calls, user input reaching subprocess.

### Pitfall 2: Cache Never Expires / Too Aggressive
**What goes wrong:** Tool becomes available/unavailable after detection but cache returns stale result.  
**Why it happens:** No TTL on cache entries, or detection runs too frequently.  
**How to avoid:** Use 5-minute TTL; provide cache invalidation for `bgsd-reapply-patches` or similar.  
**Warning signs:** "Tool X not found" after user just installed it; repeated detection calls.

### Pitfall 3: Windows Path Separators
**What goes wrong:** Tool path uses backslashes on Windows, breaks downstream processing.  
**Why it happens:** `which` on Windows returns paths with backslashes.  
**How to avoid:** Normalize paths with `.replace(/\\/g, '/')` or use path module.  
**Warning signs:** Path tests fail on Windows; backslash in tool paths.

### Pitfall 4: Tool Exists But Version Incompatible
**What goes wrong:** Tool is found but lacks required features (e.g., `--json` flag).  
**Why it happens:** Only checks existence, not capability.  
**How to avoid:** Run tool with `--version` or feature flag after detection; warn if version too old.  
**Warning signs:** "Unknown flag --json" errors after detection passes.

## Code Examples

### Complete Tool Detection with Guidance

```javascript
const { execFileSync } = require('child_process');

const TOOLS = {
  ripgrep: { name: 'ripgrep', aliases: ['rg'], description: 'Fast grep alternative' },
  fd: { name: 'fd', aliases: ['fd-find'], description: 'Fast find alternative' },
  jq: { name: 'jq', description: 'JSON processor' },
  yq: { name: 'yq', description: 'YAML processor' },
  bat: { name: 'bat', description: 'Syntax-highlighted cat' },
  gh: { name: 'gh', description: 'GitHub CLI' }
};

const INSTALL_COMMANDS = {
  darwin: {
    ripgrep: 'brew install ripgrep',
    fd: 'brew install fd',
    jq: 'brew install jq',
    yq: 'brew install yq',
    bat: 'brew install bat',
    gh: 'brew install gh'
  },
  linux: {
    ripgrep: 'sudo apt install ripgrep',
    fd: 'sudo apt install fd-find',
    jq: 'sudo apt install jq',
    yq: 'sudo apt install yq',  // or download binary
    bat: 'sudo apt install bat',
    gh: 'sudo apt install gh'  // or see gh docs
  },
  win32: {
    ripgrep: 'winget install BurntSushi.ripgrep.MSVC',
    fd: 'winget install sharkdp.fd',
    jq: 'winget install jqlang.jq',
    yq: 'winget install黑崎一护.yq',
    bat: 'winget install sharkdp.bat',
    gh: 'winget install GitHub.cli'
  }
};

// Detection with simple Map cache
const cache = new Map();
const CACHE_TTL = 5 * 60 * 1000;

function detectTool(toolName) {
  const cached = cache.get(toolName);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.result;
  }
  
  const tool = TOOLS[toolName];
  const binaries = [tool.name, ...(tool.aliases || [])];
  
  let foundPath = null;
  for (const bin of binaries) {
    try {
      foundPath = execFileSync('which', [bin], { encoding: 'utf-8' }).trim();
      break;
    } catch {
      // Not found, try next
    }
  }
  
  const result = foundPath 
    ? { available: true, path: foundPath, name: tool.name }
    : { available: false, name: tool.name };
  
  cache.set(toolName, { result, timestamp: Date.now() });
  return result;
}

function getInstallGuidance(toolName) {
  const platform = process.platform;
  const commands = INSTALL_COMMANDS[platform] || INSTALL_COMMANDS.linux;
  const tool = TOOLS[toolName];
  
  return {
    name: tool.name,
    description: tool.description,
    command: commands[toolName] || 'See tool documentation'
  };
}

// Usage
function checkToolAndWarn(toolName) {
  const detection = detectTool(toolName);
  
  if (!detection.available) {
    const guidance = getInstallGuidance(toolName);
    console.log(`\n⚠️  ${guidance.name} is not available`);
    console.log(`   ${guidance.description}`);
    console.log(`   Install: ${guidance.command}\n`);
    return { available: false, guidance };
  }
  
  return { available: true, path: detection.path };
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| No tool detection | execFileSync('which') detection | Phase 82 | Enables graceful degradation |
| Hardcoded fallback | Lazy detection + fallback wrapper | Phase 82 | Faster startup, user sees guidance |
| No caching | Map with 5-minute TTL | Phase 82 | Balances responsiveness vs freshness |
| execSync strings | execFileSync arrays | v9.2 roadmap | Security: prevents injection |

## Open Questions

1. **Cache duration:** Is 5 minutes appropriate, or should it be configurable? User preference vs system changes detection.
2. **Tool version checking:** Should detection also verify minimum version? More robust but adds complexity.
3. **Multiple tool versions:** How to handle multiple installed versions (e.g., system ripgrep vs brew ripgrep)? Use first found or prefer specific PATH?
4. **Cache invalidation:** Should there be a `bgsd-reapply-patches` command to force re-detection? Or just wait for TTL.
5. **Alternative tools:** Should detection support alternatives (e.g., ag as ripgrep fallback)? Adds complexity, defer to future.

## Sources

### Primary (HIGH confidence)
- Node.js child_process documentation — execFileSync usage patterns, security considerations
- ripgrep installation docs — ripgrep.dev
- process.platform documentation — Node.js built-in

### Secondary (MEDIUM confidence)
- Community install guides for fd, jq, yq, bat, gh — verified cross-platform availability
- Existing codebase patterns in src/lib/git.js — precedent for subprocess handling

### Tertiary (LOW confidence)
- Windows-specific install quirks — may need validation during planning

## Metadata

**Confidence breakdown:**
- Tool detection patterns: HIGH (Node.js built-in well-documented)
- Platform detection: HIGH (process.platform reliable)
- Install instructions: MEDIUM (verified for major tools, may need minor adjustments)
- Graceful fallback: HIGH (established pattern in codebase)

**Research date:** 2026-03-10
**Valid until:** v9.2 completion (~2-3 weeks)
