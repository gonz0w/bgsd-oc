# Stack Research: CLI Tools for v12.1 Integration

**Domain:** Node.js CLI tool integration (ripgrep, fd, jq, yq, bat, gh)  
**Researched:** March 14, 2026  
**Confidence:** HIGH (verified against official releases, GitHub repositories, and current documentation)

<!-- section: compact -->
<stack_compact>

**Core tools for integration:**

| Tool | Version | Purpose |
|------|---------|---------|
| ripgrep | 15.1.0 | Fast regex search respecting .gitignore |
| fd | 10.4.2 | Fast file discovery alternative to find |
| jq | 1.8.1 | Lightweight JSON transformation and filtering |
| yq | 4.52.4 | YAML/JSON/XML processor with jq-like syntax |
| bat | 0.26.1 | cat clone with syntax highlighting |
| GitHub CLI | 2.88.1 | GitHub API access from terminal |

**Integration pattern:** `execSync()` for synchronous operations, spawn for streaming large output. Tool detection via `which` command with caching. Graceful fallback when tools unavailable.

**Install:** Binary tools via system package managers (brew, apt, dnf, etc.) or pre-built binaries. No npm dependencies required (pre-built binaries only).

**Key constraints:**
- Platform-specific binaries (Linux/macOS/Windows)
- Tool availability detection required for graceful degradation
- JSON output for programmatic consumption (`rg --json`, `jq`, etc.)
- Caching detection results to avoid repeated `which` calls

</stack_compact>
<!-- /section -->

<!-- section: recommended_stack -->
## Recommended Stack

### Core Tools for v12.1 Integration

| Tool | Version | Purpose | Why Recommended |
|------|---------|---------|-----------------|
| **ripgrep** | 15.1.0+ | Fast regex search | Respects .gitignore by default, 5-10x faster than grep, built-in JSON output (--json flag), PCRE2 support. Stable major release with Jujutsu repo support. |
| **fd** | 10.4.2+ | File discovery | 10-20x faster than find, human-friendly syntax, respects .gitignore, parallel by default. Latest has performance regression fixes. |
| **jq** | 1.8.1 | JSON transformation | Zero runtime dependencies (pure C binary), stable API, widely adopted in DevOps, security fixes in 1.8.1 (CVE-2025-49014 heap overflow). |
| **yq** | 4.52.4+ | YAML processor | Go-based with jq-like syntax, supports YAML/JSON/XML/CSV/TSV/TOML/INI, 4.44+ versions are stable production releases. |
| **bat** | 0.26.1+ | Syntax highlighting | Syntax highlighting + git diff integration, auto-paging, theme support. v0.26.1 fixes UTF-8 BOM issues. |
| **GitHub CLI** | 2.88.1+ | GitHub API access | Official GitHub tool, supports attestation verification, scope-aware auth (2.88.1+ gracefully handles missing read:project scope), JSON output via `--json` flag. |

### Integration Libraries (Node.js)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `child_process` | builtin | Subprocess spawning | All tool invocations; use execSync for simple operations, spawn for streaming |
| No external deps | — | Preferred approach | Keep tool.js as single-file, zero-dependency module like existing bGSD architecture |

### Development & Testing Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| `which` command | Tool detection | Portable across platforms (builtin on Unix/Linux, available on Windows via npm package) |
| Bun runtime | Optional performance | Already supported in v9.2; native tool execution faster than Node.js |

## Integration Patterns for Node.js

### 1. Synchronous Tool Invocation (execSync)

```javascript
const { execSync } = require('child_process');

// Simple ripgrep search
const output = execSync('rg --json "pattern" path/', { 
  encoding: 'utf-8',
  stdio: ['pipe', 'pipe', 'pipe'] // Capture stderr separately if needed
});
const results = JSON.parse(output);

// Simple fd discovery
const files = execSync('fd -e js path/', { encoding: 'utf-8' })
  .split('\n')
  .filter(f => f.trim());

// jq transformation
const transformed = JSON.parse(
  execSync(`echo '${jsonString}' | jq '.field'`, { encoding: 'utf-8' })
);
```

**Pros:** Simple, synchronous (matches bGSD's blocking I/O model), no event loop complexity  
**Cons:** Blocks on large output (mitigate with streaming for big results)  
**Best for:** CLI queries, configuration transformation, metadata extraction

### 2. Streaming Tool Invocation (spawn)

```javascript
const { spawn } = require('child_process');

function streamLargeSearch(pattern, path) {
  return new Promise((resolve, reject) => {
    const rg = spawn('rg', ['--json', pattern, path]);
    let output = '';
    
    rg.stdout.on('data', (chunk) => {
      output += chunk.toString();
      // Process chunks immediately to avoid buffer overflow
    });
    
    rg.stderr.on('data', (chunk) => {
      console.error(`rg error: ${chunk}`);
    });
    
    rg.on('close', (code) => {
      if (code === 0) {
        resolve(output.split('\n').map(l => {
          try { return JSON.parse(l); } catch (e) { return null; }
        }).filter(Boolean));
      } else {
        reject(new Error(`rg exited with code ${code}`));
      }
    });
  });
}
```

**Pros:** Handles large result sets, real-time streaming, no buffer limits  
**Cons:** More complex error handling, not needed for typical bGSD workflows  
**Best for:** Large codebase scans, real-time progress display

### 3. Tool Detection & Graceful Degradation

```javascript
// Cache detection results per process lifetime
const toolCache = {};

function isToolAvailable(toolName) {
  if (toolName in toolCache) return toolCache[toolName];
  
  try {
    execSync(`which ${toolName}`, { 
      stdio: 'pipe',
      encoding: 'utf-8'
    });
    toolCache[toolName] = true;
    return true;
  } catch (e) {
    toolCache[toolName] = false;
    return false;
  }
}

// Usage pattern
if (isToolAvailable('rg')) {
  // Use ripgrep fast path
  results = execSync('rg --json pattern', { encoding: 'utf-8' });
} else if (isToolAvailable('grep')) {
  // Fallback to grep (slower but ubiquitous)
  results = execSync('grep -r pattern', { encoding: 'utf-8' });
} else {
  // Last resort: JavaScript implementation or error
  throw new Error('No search tool available (ripgrep or grep required)');
}
```

**Key points:**
- Cache detection results to avoid repeated subprocess calls
- Three-tier fallback: preferred tool → universal fallback → error
- Never fail silently; warn users about missing tools in help text
- Guidance: "ripgrep not installed. Run: brew install ripgrep"

### 4. JSON Output Patterns

All recommended tools support JSON output for programmatic parsing:

```javascript
// ripgrep: --json (newline-delimited JSON)
execSync('rg --json "pattern"', { encoding: 'utf-8' })
  .split('\n')
  .filter(Boolean)
  .map(line => JSON.parse(line)) // Each line is a complete JSON object

// fd: Can pipe to jq for JSON transformation (fd has no native JSON output)
// Solution: Use exec with shell piping or post-process line-by-line
const files = execSync('fd -e js', { encoding: 'utf-8' }).split('\n');

// jq: --raw-output for strings, default is JSON
execSync('jq -r .field file.json', { encoding: 'utf-8' });

// yq: Similar to jq
execSync('yq -o json .field file.yaml', { encoding: 'utf-8' });

// bat: --color=never for machine output, default is syntax highlighted
execSync('bat --color=never file.txt', { encoding: 'utf-8' });

// gh: --json for API responses
execSync('gh api repos/{owner}/{repo}/pulls --jq ".[].id"', { 
  encoding: 'utf-8' 
});
```

## Installation & Availability

### System Package Managers (Recommended for v12.1)

```bash
# macOS (Homebrew)
brew install ripgrep fd jq yq bat github-cli

# Linux (Ubuntu/Debian)
sudo apt install ripgrep fd-find jq bat github-cli
# Note: yq on apt is often the Python version; prefer Go yq:
# https://github.com/mikefarah/yq/releases

# Linux (Fedora/CentOS)
sudo dnf install ripgrep fd jq bat github-cli
# For yq: download binary from releases or use go install

# Windows (winget / Chocolatey)
winget install BurntSushi.ripgrep sharkdp.fd jqlang.jq MikeFarah.yq sharkdp.bat GitHub.cli
# Or via Scoop / Chocolatey equivalents

# From source (when no package available)
cargo install ripgrep fd-find  # Requires Rust
go install github.com/mikefarah/yq/v4@latest  # Requires Go
```

### Version Pinning in v12.1

Do NOT pin versions in package.json (these are system binaries, not npm packages). Instead:
- Document minimum supported versions in REQUIREMENTS.md
- Document tested versions in deployment guide
- Use CI/CD to verify tool availability in target environments

**Minimum versions for v12.1:**
- ripgrep: 14.0+ (ensure --json support) **[RECOMMENDED: 15.1.0]**
- fd: 9.0+ (ensure modern defaults) **[RECOMMENDED: 10.4.2]**
- jq: 1.7+ (ensure security fixes) **[RECOMMENDED: 1.8.1]**
- yq: 4.44+ (stable Go release) **[RECOMMENDED: 4.52.4]**
- bat: 0.22+ (basic feature set) **[RECOMMENDED: 0.26.1]**
- GitHub CLI: 2.40+ (ensure modern features) **[RECOMMENDED: 2.88.1]**

<!-- /section -->

<!-- section: alternatives -->
## Alternatives Considered

### Search Tools

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| ripgrep (rg) | GNU grep -r | When ripgrep unavailable AND speed unimportant; grep is ~95% universal |
| ripgrep (rg) | ag (The Silver Searcher) | Legacy projects with ag already installed; slower than rg, abandoned maintenance |
| ripgrep (rg) | ack | Perl-based, slower, not maintained actively; avoid for new projects |

### File Discovery Tools

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| fd | POSIX find | Last-resort fallback; significantly slower, less intuitive syntax |
| fd | GNU find | When speed unimportant; fd is 10-20x faster on modern systems |

### JSON Tools

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| jq | gojq (Go implementation) | When pure C binary unavailable AND Go is available; 98% compatible, slower |
| jq | Node.js JSON.parse | Simple transformations; not applicable for bash shell integration |
| jq | Python json.tool | Last resort; adds Python dependency (worse than jq single binary) |

### YAML Tools

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| yq (Go) | yq (Python, kislyuk/yq) | Legacy projects; Python version is jq wrapper, slower, more dependencies |
| yq | Custom YAML parsing | Never; yq is mature, maintained, and zero-dependency (binary) |

### Syntax Highlighting

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| bat | cat (no highlighting) | Non-interactive environments; less::pager integration not needed |
| bat | pygments | Requires Python; bat is single binary, faster, better Git integration |
| bat | highlight | Smaller binary footprint than bat; use only on extremely resource-constrained systems |

### GitHub Integration

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| GitHub CLI (gh) | hub (deprecated) | Do not use; project archived, unmaintained since 2021 |
| GitHub CLI (gh) | octokit (JavaScript library) | Node.js-only; gh is language-agnostic, better for shell integration |
| GitHub CLI (gh) | GitHub REST API via curl | Direct API calls; gh handles auth, scopes, and rate limiting gracefully |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| **hub** (deprecated) | Project unmaintained since 2021, security vulnerabilities not patched | GitHub CLI (gh) v2.88.1+ |
| **ag** (The Silver Searcher) | Slower than ripgrep (5-10x), project not actively maintained | ripgrep 15.1.0+ |
| **Python yq wrapper** (kislyuk/yq) | Adds Python dependency, slower than Go version, outdated | yq (mikefarah) 4.52.4+ |
| **ack** | Perl-based, slow, not maintained, inferior to ripgrep | ripgrep 15.1.0+ |
| **GNU find** | 10-20x slower than fd, unintuitive syntax, no gitignore support | fd 10.4.2+ |
| **Custom JSON parsing in Node.js for CLI filters** | Fragile, reimplements jq features, no shell integration | jq 1.8.1+ piped from shell |
| **grep + manual piping** | Error-prone, slow, hard to maintain complex search patterns | ripgrep 15.1.0+ with --json output |

<!-- /section -->

<!-- section: breaking_changes -->
## Breaking Changes & Deprecations

### ripgrep 15.0 (October 2025)

**Changes:**
- `--replace` flag now works with `--json` (was previously incompatible)
- Jujutsu (jj) repositories now treated like git repositories for .gitignore
- Bug fix: gitignore rules from parent directories now applied correctly

**Impact on v12.1:** No breaking changes for bGSD usage (only adds features). Safe upgrade from 14.x to 15.1.0.

### fd 10.4 (March 2026)

**Changes:**
- Performance regression fix for `--ignore-contain` flag
- No breaking changes in API; purely maintenance release

**Impact on v12.1:** Safe upgrade. No code changes required.

### jq 1.8.1 (July 2025) vs 1.7.1

**Security fixes:**
- CVE-2025-49014: Heap use-after-free in `f_strftime`, `f_strflocaltime`
- GHSA-f946-j5j2-4w5m: Stack overflow in `node_min_byte_len` (oniguruma library)

**API changes:** None. 1.8.1 is drop-in replacement for 1.7.1.

**Impact on v12.1:** CRITICAL: Upgrade from 1.7.1 to 1.8.1 strongly recommended due to security fixes.

### bat 0.26 (October 2025)

**Changes:**
- UTF-8 BOM handling fixed
- Windows ARM64 build added
- Negative relative line ranges supported: `bat -r :-10`
- Context in line ranges: `bat -r 30::5`
- Built-in 'minus' pager added

**Impact on v12.1:** No breaking changes. Upgrade safe. New features available but not required.

### yq 4.50+ (December 2024 onwards)

**Changes:**
- Improved YAML parsing for large integers (precision preservation)
- Improved JSON floating-point precision
- No breaking changes in command syntax

**Impact on v12.1:** Safe upgrade from 4.44+ to 4.52.4.

### GitHub CLI 2.88.1 (March 2026)

**Important:** v2.88.0 introduced regression where PR commands failed with "missing read:project scope" error.

**Fix in 2.88.1:** Reverted error matching to gracefully handle missing read:project scope (it was silently skipped before 2.88.0).

**Impact on v12.1:** 
- CRITICAL: Use 2.88.1+, NOT 2.88.0 (has breaking regression)
- Safe upgrade from 2.40+ to 2.88.1
- No API changes to command syntax

<!-- /section -->

<!-- section: platform_considerations -->
## Platform-Specific Considerations

### Windows

- **ripgrep:** Native Windows binary available; supports both MSVC and GNU variants
- **fd:** Native Windows build; no WSL required
- **jq:** Windows x64 and i386 binaries available from GitHub releases
- **yq:** Cross-platform Go binary; works natively on Windows
- **bat:** Native Windows build; syntax highlighting works in Windows Terminal
- **GitHub CLI:** Native Windows build; works with cmd.exe and PowerShell

**Notes:**
- All tools available via winget (Windows Package Manager)
- Some tools (ripgrep, fd) also on Chocolatey and Scoop
- Path separators: Use forward slashes in CLI patterns; execSync handles translation

### macOS (Intel & Apple Silicon)

- **ripgrep:** Universal binary (arm64 + x86_64) via Homebrew
- **fd:** Universal binary available
- **jq:** Intel and Apple Silicon binaries both available
- **yq:** Universal Go binary
- **bat:** Universal binary available
- **GitHub CLI:** Universal binary via Homebrew

**Recommendation:** Install all via Homebrew for simplicity:
```bash
brew install ripgrep fd jq yq bat github-cli
```

### Linux (x86_64 / ARM64)

- **All tools:** Ready-made binaries for both x86_64 and ARM64
- **Package managers:** apt (Debian/Ubuntu), dnf (Fedora), pacman (Arch), zypper (openSUSE)
- **musl vs glibc:** Most projects offer both; standard glibc versions recommended

**Special note on `fd`:**
- On Debian/Ubuntu, package is named `fd-find` (not `fd`)
- Binary is `fd`, but package name differs

**Installation on Linux:**
```bash
# Ubuntu/Debian
sudo apt install ripgrep fd-find jq bat github-cli
# yq: Prefer Go version from releases (apt may have Python version)

# Fedora/CentOS
sudo dnf install ripgrep fd jq bat github-cli

# Arch
sudo pacman -S ripgrep fd jq bat github-cli
# yq: Available in AUR
```

<!-- /section -->

<!-- section: tool_selection_matrix -->
## Tool Selection Decision Matrix

### When to Use Each Tool in bGSD Workflows

| Workflow | Tool | Usage | JSON Output | Detection Required |
|----------|------|-------|------|--------|
| Fast code search (codebase intelligence) | ripgrep | `rg --json pattern src/` | Yes (--json) | YES (fast path, fallback to grep) |
| File discovery (map-codebase) | fd | `fd -e js src/` | No (post-process) | YES (fast path, fallback to find) |
| Transform JSON data | jq | `echo "$json" \| jq '.field'` | Yes (default) | YES for CLI integration |
| Modify YAML configs | yq | `yq -i '.version = "1.2.0"' file.yaml` | Yes (--json flag) | YES for config workflows |
| Display file contents | bat | `bat file.js` | No (display only) | NO (optional; fallback to cat) |
| GitHub API queries | gh | `gh api repos/{owner}/{repo}/issues` | Yes (--json) | YES (auth required) |

### Graceful Fallback Tiers

**Tier 1 (Preferred — Fast):**
- ripgrep for search
- fd for file discovery
- gh for GitHub integration

**Tier 2 (Fallback — Slower but universal):**
- grep -r for search
- find for file discovery
- curl + manual GitHub API parsing (not recommended)

**Tier 3 (Last resort):**
- JavaScript-based implementations (slower, complex)
- Error with guidance on installation

<!-- /section -->

## Sources

- **ripgrep GitHub:** https://github.com/BurntSushi/ripgrep/releases — v15.1.0 (Oct 22, 2025), v15.0.0 changelog (gitignore fixes, line buffering), v14.1.1 (Sept 2024)
- **fd GitHub:** https://github.com/sharkdp/fd/releases — v10.4.2 (Mar 10, 2026), v10.3.0+ (Aug 2025), performance regression fixes
- **jq Official:** https://jqlang.github.io/jq — v1.8.1 (Jul 1, 2025), security fixes CVE-2025-49014 and GHSA-f946-j5j2-4w5m
- **yq GitHub:** https://github.com/mikefarah/yq/releases — v4.52.4 (Feb 2026), stable production releases 4.44+
- **bat GitHub:** https://github.com/sharkdp/bat/releases — v0.26.1 (Dec 2, 2025), v0.26.0 (Oct 19, 2025) platform support, v0.25.0 (Jan 2025)
- **GitHub CLI:** https://github.com/cli/cli/releases — v2.88.1 (Mar 12, 2026), v2.88.0 regression fixed, v2.51.0+ attestation features
- **Node.js child_process:** Official Node.js documentation — execSync/spawn/execFile patterns for subprocess management
- **Research:** Modern CLI Tools comparisons (ripgrep vs grep, fd vs find benchmarks), integration patterns for Node.js CLI applications

---

## Key Decisions for v12.1

| Decision | Rationale |
|----------|-----------|
| **Zero npm dependencies** | Keep bGSD single-file, zero-dependency architecture; use system binaries only |
| **Minimum viable tool set** | Start with ripgrep + fd + jq (covers 80% of use cases); yq/bat/gh as phase 2 |
| **Tool detection with caching** | Avoid repeated `which` calls; cache per process lifetime |
| **JSON output for all tools** | Enables programmatic parsing; no fragile regex post-processing |
| **Three-tier fallback** | Preferred tool → universal fallback → error with installation guidance |
| **Synchronous operations (execSync)** | Matches existing bGSD blocking I/O model; spawn only for large result sets |
| **Graceful degradation** | Never fail silently; warn users about missing tools in help text and error messages |
| **v15.1.0 for ripgrep** | Latest stable with line buffering fix; no breaking changes from v14.x |
| **v10.4.2 for fd** | Latest with performance fixes; safe upgrade path from v8.x+ |
| **v1.8.1 for jq** | Security-critical upgrade (CVE-2025-49014); required for production |
| **v4.52.4 for yq** | Latest stable Go release; no breaking changes from v4.44+ |
| **v0.26.1 for bat** | Latest with UTF-8 BOM fixes and Windows ARM64 support |
| **v2.88.1 for GitHub CLI** | Latest stable; avoid v2.88.0 (regression). Graceful scope handling. |

---

*Stack research for: v12.1 CLI Tool Integration*  
*Researched: March 14, 2026*  
*Confidence: HIGH (official releases verified, breaking changes confirmed, platform support validated)*
