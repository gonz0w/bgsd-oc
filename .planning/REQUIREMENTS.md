# v12.1 Requirements: Tool Integration & Agent Enhancement

**Milestone:** v12.1  
**Status:** In Progress  
**Created:** 2026-03-15

## Overview

v12.1 focuses on integrating modern CLI tools (ripgrep, fd, jq, yq, bat, gh) into core workflows and improving agent routing & collaboration. This milestone delivers "smarter tools, smarter agents" — enabling faster code operations and better inter-agent coordination.

---

## Requirements by Category

### TOOL-01: ripgrep Integration

**Requirement:** User can leverage ripgrep for fast code search across the codebase when available

**Acceptance Criteria:**
- ripgrep detection works on macOS, Linux, Windows (via tool detection infrastructure)
- Search operations use ripgrep by default when available (50x+ faster than grep)
- Graceful fallback to Node.js regex search when ripgrep unavailable
- Shell injection protection via execFileSync array args
- Performance: <100ms for search of 10K+ file codebase

---

### TOOL-02: fd Integration

**Requirement:** User can leverage fd for fast file discovery across the codebase when available

**Acceptance Criteria:**
- fd detection works on macOS, Linux, Windows
- File discovery operations use fd when available (20x+ faster than find)
- Graceful fallback to Node.js fs.readdirSync traversal
- Respects .gitignore automatically via fd's default behavior
- Integration with codebase analysis workflows (convention extraction, dependency graphs)

---

### TOOL-03: jq Integration

**Requirement:** User can transform JSON data via jq for complex metrics extraction and configuration

**Acceptance Criteria:**
- jq detection and version checking (1.8.1+)
- JSON transformation in workflows (e.g., extracting metrics from test output)
- Graceful fallback to JavaScript JSON.parse/stringify for simple operations
- Safe argument passing (no shell injection)
- Performance: jq overhead <50ms per invocation

---

### TOOL-04: yq Integration

**Requirement:** User can transform YAML data via yq for configuration management and analysis

**Acceptance Criteria:**
- yq detection and version checking (4.44+)
- YAML transformation in workflows (e.g., config processing)
- Graceful fallback to JavaScript YAML parsing for simple operations
- Cross-platform support (Windows/macOS/Linux)

---

### TOOL-05: bat Integration

**Requirement:** User can display syntax-highlighted code and config files via bat for enhanced output

**Acceptance Criteria:**
- bat detection and integration with code display commands
- Syntax highlighting for code snippets in CLI output
- Graceful fallback to plain text output when bat unavailable
- Git diff integration where applicable

---

### TOOL-06: GitHub CLI Integration

**Requirement:** User can execute GitHub operations via gh CLI for PR creation, merging, issue management

**Acceptance Criteria:**
- gh CLI detection and authentication validation
- Integration with existing `/bgsd-github-ci` workflow
- Safe operation even when user not logged in (graceful skip)
- Version constraint: gh 2.88.1+ (avoid 2.88.0 regression)

---

### AGENT-01: Tool-Aware Agent Routing

**Requirement:** Agents are aware of available tools and can optimize task decomposition accordingly

**Acceptance Criteria:**
- Tool availability included in agent context (tool_availability object)
- New decision function: `resolveFileDiscoveryMode()` → ripgrep vs Node.js decision
- New decision function: `resolveSearchMode()` → fd vs find decision
- New decision function: `resolveJsonTransformMode()` → jq vs JavaScript decision
- Agents can see which tools are available BEFORE decomposing tasks
- Plan complexity scoring accounts for tool availability

---

### AGENT-02: Enhanced Agent Handoffs

**Requirement:** Inter-agent handoffs use consistent shared context patterns with tool information

**Acceptance Criteria:**
- Tool availability passed between agents in context
- RACI matrix validated for improved handoff patterns
- New handoff patterns for tool-dependent operations
- Handoff documentation updated with tool assumptions
- Test coverage for all agent pair handoffs

---

### AGENT-03: Multi-Phase Sequencing Decisions

**Requirement:** New decision functions improve coordination across multi-phase projects

**Acceptance Criteria:**
- New decision function: `resolvePhaseDependencies()` for sequencing
- New decision function: `resolveAgentCapabilityLevel()` based on tool count
- Decision inputs include tool availability and phase complexity
- 85%+ confidence thresholds with contract tests
- Integration into phase planning workflows

---

### TOOL-DET-01: Unified Tool Detection

**Requirement:** Centralized tool detection with caching and cross-platform support

**Acceptance Criteria:**
- Single source of truth for tool detection (detect.js)
- Platform detection works on macOS (Homebrew), Linux (apt/dnf/pacman), Windows (native/WSL)
- 5-minute detection cache to avoid repeated spawning
- Tool version detection and feature flagging
- Fallback to "tool not found" message with installation guidance
- <50ms total detection time for all 6 tools (with caching)

---

### TOOL-DEGR-01: Graceful Degradation

**Requirement:** Workflows complete successfully even when tools unavailable, with clear guidance

**Acceptance Criteria:**
- All workflows have fallback implementations (no hard tool requirements)
- User receives clear message when feature unavailable (e.g., "Install ripgrep for faster search")
- Fallback quality acceptable for common operations
- Tool absence never crashes CLI
- Optional features gracefully skip when tools unavailable

---

## Future Requirements (v13.0+)

These are candidates for future milestones based on research findings:

- **PERF-01:** SQLite-backed tool detection caching across sessions
- **PERF-02:** Batch tool invocation for parallel operations
- **PERF-03:** Tool performance profiling and benchmark suite
- **DOC-01:** Enhanced skill documentation for tool usage patterns
- **ARCH-01:** Custom decision functions for tool-specific workflows

---

## Traceability to Intent

### v12.1 Outcomes

| Outcome | Requirement(s) | Status |
|---------|----------------|--------|
| DO-86: Support ripgrep, fd, jq, yq, bat, gh with graceful degradation | TOOL-01, TOOL-02, TOOL-03, TOOL-04, TOOL-05, TOOL-06, TOOL-DEGR-01, TOOL-DET-01 | Pending |
| DO-87: Smarter agent routing based on task complexity and capabilities | AGENT-01, AGENT-03 | Pending |
| DO-88: Better inter-agent collaboration patterns | AGENT-02, AGENT-03 | Pending |
| DO-89: Decision functions for tool selection and multi-phase sequencing | AGENT-01, AGENT-03 | Pending |
| DO-90: Improved agent context efficiency through capability-aware filtering | AGENT-01, AGENT-02 | Pending |

### v12.1 Success Criteria

| Criterion | Requirement(s) | Measurement |
|-----------|----------------|-------------|
| SC-66: All CLI tools detected and available | TOOL-DET-01, TOOL-01 through TOOL-06 | Detection works for all 6 tools on macOS/Linux/Windows |
| SC-67: 25%+ context overhead reduction via capability-aware dispatch | AGENT-01, AGENT-02, AGENT-03 | Agent context size reduced, task count per phase reduced |
| SC-68: All inter-agent handoffs use shared context patterns | AGENT-02 | RACI audit confirms all handoffs include tool info |
| SC-69: New decision functions with contract tests | AGENT-01, AGENT-03 | 4+ decision functions with 85%+ confidence, 100+ tests |
| SC-70: Tool absence gracefully handled | TOOL-DEGR-01, TOOL-DET-01 | All workflows complete without tools, with clear guidance |

---

## Out of Scope for v12.1

- **Async tool invocation** — Keep synchronous execution for CLI/plugin consistency
- **Custom tool plugins** — Only integrate the 6 identified tools
- **Tool version auto-installation** — Assume tools pre-installed via package manager
- **Advanced tool chaining** — Basic invocation; advanced pipelines defer to v13
- **Performance optimization beyond v12.0 baseline** — Focus on correctness first

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| Tool not installed on user's system | Medium | Low | Graceful degradation, clear guidance |
| Version incompatibilities (jq 1.6→1.7 breaking changes) | Low | Medium | Feature detection, version constraints documented |
| Platform-specific bugs (Windows PATH issues) | Medium | Medium | CI matrix testing Windows/macOS/Linux |
| Plugin performance regression from tool spawning | Low | Medium | Performance budgets (<100ms), caching |
| Shell injection vulnerabilities | Very Low | High | execFileSync array args, security audit |

---

## Success Criteria Summary

✅ All 6 CLI tools integrated with graceful fallbacks  
✅ Agent routing improved by 25%+ (context reduction)  
✅ 4+ new decision functions with contracts and tests  
✅ All inter-agent handoffs validated via RACI  
✅ Tool absence causes no CLI failures  
✅ Performance <100ms per tool call (with caching)  
✅ Cross-platform verified (macOS/Linux/Windows)  
✅ 1280+ test suite remains green  

---

*Last updated: 2026-03-15 during v12.1 milestone planning*
