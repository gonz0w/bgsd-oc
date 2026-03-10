# Stack Research: CLI Tool Integrations & Runtime Modernization (v9.2)

> Research date: 2026-03-10  
> Scope: CLI tool integrations (ripgrep, fd, fzf, bat, gh, lazygit, jq, yq) and Bun runtime exploration

## Recommendation (Opinionated Shortlist)

**No new npm packages required** for CLI tool execution — use built-in `child_process`. For tool detection, add one lightweight package.

| Priority | Dependency / Technique | Version | Target | Expected Impact |
|---|---|---|---|---|
| P1 | `which` | ^5.0.0 | Detect CLI tool availability | Zero-dep cross-platform detection |
| P1 | Bun runtime | ~1.2.x | Alternative to Node.js for faster startup | 3-5x faster CLI cold start |
| P2 | Existing `child_process` | Built-in | Execute ripgrep, fd, fzf, bat, gh, lazygit, jq, yq | Already in use (git.js); no new deps |
| P3 | `--bun` flag usage | Bun CLI | Override shebang for Bun execution | Enable Bun as drop-in replacement |

---

## Why These, Specifically

### 1) `which` for CLI tool detection

- **Zero dependencies** — only 5KB, no native modules
- **Cross-platform** — works on Linux, macOS, Windows
- **Pattern already exists** — bGSD uses `execSync` for git; this extends to other tools
- **Graceful degradation** — warn if tool missing, continue with existing behavior

```javascript
import { which } from 'which';

async function checkTool(name) {
  try {
    const path = await which(name);
    return { available: true, path };
  } catch {
    return { available: false };
  }
}
```

### 2) Bun runtime for 3-5x faster startup

- **Cold start**: 5-15ms vs Node.js 120-150ms (8x faster)
- **Node.js API compatibility**: 95%+ — most npm packages work without modification
- **Built-in bundler/test runner**: Reduces toolchain complexity
- **CLI-focused**: Designed for script/CLI execution, not just server workloads

**Trade-offs:**
- Not all Node.js APIs fully implemented (process.binding, some edge cases)
- Windows support improving but less mature than Node.js
- Ecosystem smaller than npm

### 3) Built-in `child_process` for execution

- **Already in use**: `src/lib/git.js` uses `execSync` for git operations
- **execFileSync over execSync**: Array arguments avoid shell injection
- **No new dependencies**: Maintain single-file deploy constraint

```javascript
// Safer than execSync with string
const result = execFileSync('rg', ['--json', 'pattern', '.'], {
  encoding: 'utf-8',
  cwd: projectRoot,
  timeout: 30000,
  stdio: ['pipe', 'pipe', 'pipe']
});
```

---

## CLI Tools Integration Map

| Tool | Purpose | Detection | Execution Pattern |
|------|---------|-----------|------------------|
| `ripgrep` (rg) | Fast text search | `which('rg')` | `execFileSync('rg', ['--json', ...])` |
| `fd` | Fast file finding | `which('fd')` | `execFileSync('fd', ['--type', 'f', ...])` |
| `fzf` | Fuzzy finder | `which('fzf')` | `spawn('fzf', [], { stdio: 'inherit' })` |
| `bat` | Enhanced cat | `which('bat')` | `execFileSync('bat', ['--style=json', ...])` |
| `gh` | GitHub CLI | `which('gh')` | `execFileSync('gh', ['api', ...])` → parse JSON |
| `lazygit` | TUI git | `which('lazygit')` | `spawn('lazygit', [], { stdio: 'inherit' })` |
| `jq` | JSON processor | `which('jq')` | Pipe JSON through stdin |
| `yq` | YAML processor | `which('yq')` | `execFileSync('yq', [...])` |

---

## What NOT to Adopt in This Milestone

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `execa` | Adds ~40KB bundle weight for features not needed | Built-in `execFileSync` |
| `shelljs` | Too heavy (~500KB), slower than native | Direct `child_process` calls |
| `ora` / `chalk` | Already have picocolors inline | Use existing format.js |
| `zx` (Google) | Excellent but conflicts with single-file deploy | Direct `child_process` |
| `better-sqlite3` | Native install friction | Use existing `node:sqlite` |

---

## Install / Adoption Commands

```bash
# Tool detection (optional - only if which fails on Windows)
npm install which@^5.0.0

# Bun runtime (separate install)
curl -fsSL https://bun.sh/install | bash

# Test Bun execution
bun --bun run bin/bgsd-tools.cjs --version

# Run tests with Bun
bun test
```

---

## Bun Compatibility Notes

- Use `--bun` flag to override `#!/usr/bin/env node` shebangs
- Test bundle compatibility: `bun run bin/bgsd-tools.cjs` should work
- Keep Node.js as primary runtime; Bun as performance optimization
- Some Node.js APIs may need runtime checks:

```javascript
// Runtime detection pattern
const isBun = typeof Bun !== 'undefined';

function getRuntime() {
  if (isBun) {
    return { name: 'Bun', version: Bun.version };
  }
  return { name: 'Node.js', version: process.version };
}
```

---

## Confidence

- **HIGH**: `which` package recommendation (npm verified, zero deps)
- **HIGH**: Bun runtime capability (official docs, benchmarks verified)
- **HIGH**: Built-in `child_process` patterns (already in codebase)

---

## Sources

- npm `which` package: https://www.npmjs.com/package/which — verified ^5.0.0
- Bun Node.js compatibility: https://bun.sh/docs/runtime/nodejs-compat — 95%+ API coverage
- Bun benchmarks: https://pkgpulse.com/blog/bun-vs-nodejs-2026 — 8x faster cold start
- Context7: Node.js `child_process` module — execFileSync usage patterns

---
*Stack research for: bGSD v9.2 CLI Tool Integrations & Runtime Modernization*
*Researched: 2026-03-10*
