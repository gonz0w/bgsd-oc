# Project Research Summary

**Project:** bGSD CLI Tool Integrations & Runtime Modernization (v9.2)
**Domain:** CLI Plugin / Developer Tool
**Researched:** 2026-03-10
**Confidence:** HIGH

<!-- section: compact -->
<compact_summary>

**Summary:** Researched CLI tool integrations (ripgrep, fd, fzf, bat, gh, lazygit, jq, yq) and Bun runtime for v9.2. Recommended approach uses built-in `child_process` with a subprocess wrapper layer and tool availability detection via `which` package. Bun runtime migration deferred due to single-file deploy conflicts. Top risk is shell injection when adding new execSync calls.

**Recommended stack:** `which` (tool detection), Node.js `child_process` (execution), Bun (future consideration)

**Architecture:** Subprocess wrapper layer pattern — detector.js checks tool availability with caching, individual wrappers (ripgrep.js, fd.js, etc.) provide unified API with graceful fallback to existing Node.js implementations.

**Top pitfalls:**
1. Shell injection via user input — use spawn with array args, never string interpolation
2. Missing tool detection — check availability before use, show clear install instructions
3. Interactive TUI tools (lazygit, fzf) hang — use stdio:'inherit' or avoid for automation

**Suggested phases:**
1. Tool Detection Infrastructure — detector.js + ripgrep/fd/jq wrappers with fallback
2. Extended Tool Integrations — yq, bat, gh CLI with auth handling
3. Interactive Tools — fzf, lazygit with TTY passthrough (optional)
4. Bun Runtime Exploration — adapter layer with Node.js fallback (deferred)

**Confidence:** HIGH | **Gaps:** Bun migration breaks single-file deploy, deferred to v2+
</compact_summary>
<!-- /section -->

<!-- section: executive_summary -->
## Executive Summary

This research addresses CLI tool integrations and Bun runtime exploration for bGSD v9.2. The goal is to accelerate common development workflows by leveraging best-in-class CLI tools (ripgrep, fd, fzf, bat, gh, lazygit, jq, yq) while maintaining bGSD's single-file deploy model and graceful degradation when tools are unavailable.

**Recommended approach:** Adopt a subprocess wrapper layer pattern using built-in `child_process.execFileSync` (not execSync) with array arguments to prevent shell injection. Use the `which` package for cross-platform tool availability detection with caching. This integrates seamlessly with existing patterns in `src/lib/git.js` while adding new capabilities.

**Key risks mitigated:** Shell injection (CLI-01), missing tools (CLI-02), TUI hangs (CLI-03), and credential prompts (CLI-04) are the critical pitfalls addressed. The Bun runtime provides 3-5x faster startup but breaks the single-file deploy model and is recommended for v2+.

**Architecture recommendation:** Create `src/lib/cli-tools/` directory with detector.js (availability checking), index.js (unified exports), and individual tool wrappers. Use graceful fallback — if ripgrep isn't installed, fall back to existing Node.js-based search.
<!-- /section -->

<!-- section: key_findings -->
## Key Findings

### Recommended Stack

**Core technologies:**
- **`which` (^5.0.0):** Zero-dependency cross-platform tool detection — only 5KB, works on Linux/macOS/Windows
- **Built-in `child_process`:** Already in use via `src/lib/git.js` — use `execFileSync` over `execSync` to avoid shell injection
- **Bun runtime:** 3-5x faster cold start (5-15ms vs 120-150ms) but defers due to single-file deploy conflicts
- **No new npm packages for execution:** Direct subprocess calls avoid dependency bloat

### Expected Features

**Must have (table stakes):**
- **ripgrep integration** — 10-100x faster than Node.js regex; use `--json` for machine parsing
- **fd integration** — faster file discovery than fast-glob; respects .gitignore
- **jq integration** — standard CLI JSON processing for pipeline composition
- **Tool availability detection** — check `which` before invoking; fallback to existing implementation

**Should have (competitive):**
- **yq integration** — faster YAML frontmatter processing
- **bat integration** — syntax-highlighted file previews
- **gh CLI integration** — GitHub API access for PRs, issues, workflows

**Defer (v2+):**
- **Bun runtime** — breaks single-file esbuild deploy, ecosystem still maturing
- **lazygit integration** — interactive TUI, no stable CLI interface
- **Full fzf workflows** — requires TTY, limited automation value

### Architecture Approach

The integration uses a **subprocess wrapper layer** with three core patterns:

1. **Subprocess Wrapper with Sanitization** — Standardized wrapper around execFileSync with tool detection, argument sanitization, error handling, and output parsing (for ripgrep, fd, bat, jq, yq, gh)

2. **TTY Passthrough for Interactive Tools** — Spawn fzf/lazygit with `stdio: 'inherit'` to pass terminal control (blocks execution but enables full interactivity)

3. **Tool Availability Detection with Graceful Fallback** — Check tool availability at startup, cache result, provide fallback behavior when tool unavailable

**Major components:**
1. `src/lib/cli-tools/detector.js` — Availability checking with caching
2. `src/lib/cli-tools/*.js` — Individual tool wrappers (ripgrep, fd, fzf, bat, gh, lazygit, jq, yq)
3. `src/lib/runtime/bun-runtime.js` — Bun detection adapter (optional, deferred)

### Critical Pitfalls

1. **Shell injection (CLI-01):** Using execSync with string interpolation allows command injection. Prevention: Use spawn with array arguments, never string interpolation.

2. **Missing tool detection (CLI-02):** Commands fail with ENOENT on systems without tools installed. Prevention: checkToolAvailability() before first use, show clear install instructions.

3. **TUI tools hang (CLI-03):** lazygit/fzf hang when spawned as background subprocess. Prevention: Use stdio:'inherit' or launch in new terminal.

4. **Credential prompts block (CLI-04):** gh/git without cached credentials hang. Prevention: Set GIT_TERMINAL_PROMPT=0, ensure credentials available.

5. **Bun argument handling (BUN-01):** Bun swaps argv0/argv[1] vs Node. Prevention: Use import.meta.url, test explicitly with Bun.
<!-- /section -->

<!-- section: roadmap_implications -->
## Implications for Roadmap

Based on research, suggested phase structure:

### Phase 1: Tool Detection Infrastructure
**Rationale:** Foundation for all other CLI integrations — must establish availability checking before adding tool wrappers
**Delivers:** `cli-tools/detector.js` + basic wrapper structure, ripgrep/fd/jq integrations with fallback
**Addresses:** FEATURES.md table stakes — ripgrep, fd, jq, tool availability detection
**Avoids:** PITFALLS CLI-01 (shell injection), CLI-02 (missing tools)

### Phase 2: Extended Tool Integrations
**Rationale:** Non-interactive tools that enhance automation — lower risk than TUI tools
**Delivers:** yq, bat, gh CLI wrappers with authentication handling
**Uses:** Stack elements: which, child_process execFileSync
**Implements:** CLI tools layer with output parsing
**Avoids:** PITFALLS CLI-04 (credential prompts), CLI-06 (buffer overflow)

### Phase 3: Interactive Tools (Optional)
**Rationale:** TTY handling complexity requires careful implementation
**Delivers:** fzf integration for fuzzy search, lazygit launcher
**Uses:** spawn with stdio:'inherit' for terminal passthrough
**Implements:** TTY passthrough pattern
**Avoids:** PITFALLS CLI-03 (TUI hang)

### Phase 4: Bun Runtime Exploration (Deferred)
**Rationale:** Breaks single-file deploy — needs separate build pipeline
**Delivers:** Runtime abstraction adapter with Node.js fallback
**Uses:** Bun-specific spawn APIs
**Implements:** Runtime abstraction layer
**Avoids:** PITFALLS BUN-01 through BUN-05

### Phase Ordering Rationale

- **Phase 1 first:** Tool detection is prerequisite — all other phases depend on knowing which tools are available
- **Non-interactive before interactive:** ripgrep/fd/jq/yq/bat/gh are simpler to integrate than fzf/lazygit
- **Bun deferred:** Single-file deploy is core to bGSD's value proposition; Bun compatibility requires esbuild changes
- **Graceful degradation throughout:** Each phase maintains fallback to existing Node.js implementations

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 2 (gh CLI):** Auth flow complexity — needs research on gh auth status checking and token handling
- **Phase 3 (fzf/lazygit):** TTY detection edge cases — needs research on terminal capability detection

Phases with standard patterns (skip research-phase):
- **Phase 1 (detector + ripgrep/fd/jq):** Well-documented subprocess patterns, existing git.js precedent
<!-- /section -->

<!-- section: confidence -->
## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | which package verified on npm; child_process patterns in existing codebase |
| Features | HIGH | CLI tools are mature with well-documented APIs; fallback patterns established |
| Architecture | HIGH | Subprocess wrapper pattern follows existing git.js precedent |
| Pitfalls | HIGH | Based on Node.js docs, Bun issues, CLI tool behavior patterns |

**Overall confidence:** HIGH

### Gaps to Address

- **Bun single-file deploy conflict:** Bun requires separate build pipeline, incompatible with esbuild single-file output. Recommendation: Defer to v2+ when build infrastructure can support dual targets.
  
- **gh CLI auth complexity:** Research didn't deeply explore gh auth status checking edge cases. Recommendation: Plan phase should include auth flow testing on clean system.

- **fzf automation value:** Limited value for automated agents since fzf is primarily interactive. Recommendation: Keep as optional phase, only implement if user-facing workflows benefit.
<!-- /section -->

<!-- section: sources -->
## Sources

### Primary (HIGH confidence)
- Node.js child_process documentation — execFileSync usage patterns, security considerations
- ripgrep documentation — JSON output, glob patterns
- fd-find documentation — JSON output, .gitignore integration
- Bun Node.js compatibility — 95%+ API coverage confirmed

### Secondary (MEDIUM confidence)
- Bun argument handling issues (GitHub issue #19694) — argv differences with Node.js
- Community migration stories — single-file deploy challenges with Bun

### Tertiary (LOW confidence)
- fzf subprocess behavior — needs validation during Phase 3 planning

---

*Research completed: 2026-03-10*
*Ready for roadmap: yes*
