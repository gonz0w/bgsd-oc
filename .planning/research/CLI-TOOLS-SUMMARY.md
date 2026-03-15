# v12.1 CLI Tools Integration — Research Summary

**Researched:** March 14, 2026  
**Status:** Ready for Roadmap Synthesis

## Executive Summary

v12.1 should integrate six modern CLI tools via Node.js `child_process.execSync()`:

1. **ripgrep (15.1.0)** — Fast code search
2. **fd (10.4.2)** — Fast file discovery  
3. **jq (1.8.1)** — JSON transformation
4. **yq (4.52.4)** — YAML transformation
5. **bat (0.26.1)** — Syntax highlighting
6. **GitHub CLI (2.88.1)** — GitHub API access

All are **zero-dependency system binaries** (no npm packages). Integration adds **no new Node.js dependencies** to bGSD's single-file architecture.

## Key Findings

### Versions (Current as of March 14, 2026)

| Tool | Latest | Min Required | Why Upgrade |
|------|--------|--------------|-------------|
| ripgrep | **15.1.0** (Oct 2025) | 14.0 | Line buffering fix, gitignore correctness |
| fd | **10.4.2** (Mar 2026) | 9.0 | Performance regression fixed |
| jq | **1.8.1** (Jul 2025) | 1.7 | **Security fix: CVE-2025-49014 (heap overflow)** |
| yq | **4.52.4** (Feb 2026) | 4.44 | Stable production release |
| bat | **0.26.1** (Dec 2025) | 0.22 | UTF-8 BOM fixes, ARM64 Windows |
| GitHub CLI | **2.88.1** (Mar 2026) | 2.40 | **Critical: NOT v2.88.0 (regression)** |

### Integration Pattern: Three-Tier Graceful Fallback

```javascript
// Tier 1 (Preferred): Fast modern tools
if (isToolAvailable('rg')) use ripgrep

// Tier 2 (Fallback): Universal Unix tools  
else if (isToolAvailable('grep')) use grep

// Tier 3 (Error): Tell user how to install
else throw Error("ripgrep required...")
```

**Cache detection results** to avoid repeated `which` calls per process.

### Platform Support (Verified)

✅ **macOS** — All via Homebrew (universal binaries for Intel/ARM64)  
✅ **Linux** — All via apt/dnf/pacman (separate arm64/x86_64 builds)  
✅ **Windows** — All available via winget (native binaries, not WSL)

### No Breaking Changes

- **ripgrep 15.0+:** Only adds `--replace` + `--json` compatibility; no API breaks
- **fd 10.4:** Maintenance release; API unchanged
- **jq 1.8.1:** Drop-in replacement for 1.7 (security fix only)
- **yq 4.52.4:** Safe upgrade from 4.44+
- **bat 0.26.1:** Additive improvements
- **GitHub CLI 2.88.1:** Critical to avoid 2.88.0 (read:project scope regression)

## Recommended Phase Structure

**Phase 1 (Minimum Viable):**
- ripgrep integration for fast code search
- fd integration for file discovery
- jq integration for JSON transformation
- Tool detection + caching infrastructure

**Phase 2 (Extended):**
- yq integration for config management
- bat integration for output formatting
- GitHub CLI integration for API access

## Integration Checklist

- [ ] Create `src/lib/tools.js` with detection + graceful fallback
- [ ] Add tool availability detection with per-process caching
- [ ] Implement `execSync()` wrappers for each tool
- [ ] JSON output parsing for all tools
- [ ] Platform-specific path handling (Windows forward slashes)
- [ ] Error messages with install guidance when tool missing
- [ ] Document minimum versions in REQUIREMENTS.md
- [ ] CI/CD gate to verify tool availability in test environments
- [ ] Update agent manifests to show tool availability as capability flag

## Risks & Mitigations

| Risk | Severity | Mitigation |
|------|----------|-----------|
| User doesn't have ripgrep installed | Medium | Three-tier fallback to grep + clear install guidance in errors |
| jq security vulnerability (CVE-2025-49014) | High | Recommend 1.8.1+ in docs; never use versions < 1.8 |
| GitHub CLI 2.88.0 regression | High | Document "use 2.88.1+" in REQUIREMENTS.md; test in CI |
| Platform-specific binaries differ | Low | Test on all three platforms (Linux/macOS/Windows); use `which` for detection |
| Tool availability changes mid-workflow | Low | Check detection at workflow start; fail fast with guidance |

## Sources Verified

✅ Official GitHub releases (BurntSushi/ripgrep, sharkdp/fd, jqlang/jq, mikefarah/yq, sharkdp/bat, cli/cli)  
✅ Official documentation (jqlang.github.io/jq, mikefarah.gitbook.io/yq)  
✅ CVE databases (CVE-2025-49014, GHSA-f946-j5j2-4w5m)  
✅ Node.js child_process API (node.js official docs)  
✅ Integration patterns (exa.ai code examples, community best practices)

## Next Steps for Synthesizer

1. Use this stack research + CLI-TOOLS-STACK.md to build SUMMARY.md for roadmap creation
2. Recommend two phases: Phase 1 (ripgrep + fd + jq) and Phase 2 (yq + bat + gh)
3. Flag "tool detection + caching infrastructure" as shared dependency between phases
4. Recommend REQUIREMENTS.md include minimum tool versions
5. Consider creating new agent role (tool-integration-specialist) or expanding orchestrator intelligence

---

*Research completed by Project Researcher (phase 6)*  
*Quality gate: All version claims verified against official sources*  
*Confidence: HIGH*
