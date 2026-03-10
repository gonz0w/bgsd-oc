# Feature Research

**Domain:** CLI Tool Integrations & Bun Runtime
**Researched:** 2026-03-10
**Confidence:** HIGH
**Milestone:** v9.2 CLI Tool Integrations & Runtime Modernization

<!-- section: compact -->
<features_compact>
<!-- Compact view for planners. Keep under 30 lines. -->

**Table stakes (must have):**
- ripgrep integration — fast code search with --json for machine parsing (replaces slow Node.js regex)
- fd integration — faster file discovery than Node.js globs, respects .gitignore
- jq integration — JSON parsing/transforming for CLI output processing
- Tool availability detection — graceful fallback when tools not installed

**Differentiators:**
- yq integration — YAML frontmatter processing (faster than custom parser)
- bat integration — syntax-highlighted file previews in search results
- gh CLI integration — GitHub API access for PRs, issues, workflows
- fzf integration — interactive fuzzy search (limited automation value)

**Defer (v2+):** Bun runtime migration, lazygit integration

**Key dependencies:** fd enables faster file discovery; ripgrep enables code search; both require tool availability detection and graceful fallback to existing Node.js implementations.
</features_compact>
<!-- /section -->

<!-- section: feature_landscape -->
## Feature Landscape

### Table Stakes (Users Expect These)

Features users assume exist. Missing these = product feels incomplete.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| ripgrep integration | 10-100x faster than Node.js regex for code search; --json output enables programmatic parsing | LOW | Use `execSync` with `--json` flag; existing git grep can be replaced |
| fd integration | Faster than Node.js fast-glob for file discovery; respects .gitignore by default | LOW | Use `execSync` with JSON output; complements existing file discovery |
| jq integration | Standard tool for CLI JSON processing; enables pipeline composition | LOW | Use `execSync` to pipe JSON through jq filters |
| Tool availability detection | Users won't have all tools installed; must fail gracefully | LOW | Check `which` or `command -v` before invoking; fallback to existing implementation |

### Differentiators (Competitive Advantage)

Features that set the product apart. Not required, but valuable.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| yq integration | Faster than custom YAML parsers for frontmatter; supports merge/eval | MEDIUM | Existing custom parser works; yq is backup for complex YAML |
| bat integration | Syntax-highlighted file previews in search results; better than raw cat | MEDIUM | Good for human-facing output; adds dependency |
| gh CLI integration | Direct GitHub API access for PR status, issue lookup, workflow triggers | MEDIUM | Authenticated gh can replace some GitHub API calls |
| fzf integration | Interactive fuzzy search in planning workflows; "choose from list" patterns | MEDIUM | Requires TTY detection; limited value for automated agents |
| Bun runtime | 3-5x faster CLI startup; significant for short-running CLI tools | HIGH | Breaks single-file deploy pattern; ecosystem still maturing |

### Anti-Features (Commonly Requested, Often Problematic)

Features that seem good but create problems.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Bun runtime | 3-5x faster startup cited as major improvement | Breaks single-file deploy (esbuild doesn't bundle for Bun); adds runtime complexity; ecosystem still maturing | Keep Node.js, optimize existing code paths |
| lazygit integration | Git UI is popular, seems natural to automate | Interactive TUI, no stable CLI interface, designed for human use | Use existing git.js module; gh CLI for GitHub operations |
| Full tool dependency | "Install all the things" mentality | Users may not have tools; adds install burden; platform-specific binaries | Graceful fallback; optional features |
| Shell=True in execSync | Simpler command construction | Security risk (shell injection); harder to debug | Use array args with shell=False; sanitize inputs |
<!-- /section -->

<!-- section: dependencies -->
## Feature Dependencies

```
ripgrep integration (replaces existing git grep)
    └──requires──> Tool availability detection

fd integration (complements fast-glob)
    └──requires──> Tool availability detection

jq integration (used by ripgrep/gh JSON output)
    └──requires──> Tool availability detection

yq integration (optional backup for YAML)
    └──requires──> Tool availability detection

fzf integration (optional, human-facing)
    └──requires──> TTY detection
    └──requires──> Tool availability detection

gh CLI integration (optional GitHub ops)
    └──requires──> gh auth status check
```

### Dependency Notes

- **ripgrep requires tool availability detection:** Must check if `rg` exists before invoking; fallback to existing Node.js-based search
- **fd requires tool availability detection:** Must check if `fd` exists; fallback to fast-glob (existing)
- **fzf enhances interactive workflows:** Only useful when TTY is available; not valuable for automated agents
- **Bun conflicts with single-file deploy:** Cannot use esbuild for Bun bundling; would require separate build pipeline

<!-- /section -->

<!-- section: mvp -->
## MVP Definition

### Launch With (v1)

Minimum viable product — what's needed to validate the concept.

- [ ] ripgrep integration — Add `--json` output parsing; replace slow Node.js regex in search commands
- [ ] fd integration — Add faster file discovery; complement fast-glob for specific use cases
- [ ] jq integration — Add JSON processing pipeline for CLI output
- [ ] Tool availability detection — Check for tool presence; fallback gracefully

### Add After Validation (v1.x)

Features to add once core is working.

- [ ] yq integration — For complex YAML operations (frontmatter merge, evaluation)
- [ ] bat integration — For syntax-highlighted previews in human-facing output
- [ ] gh CLI integration — For GitHub API operations (PR status, issues)

### Future Consideration (v2+)

Features to defer until product-market fit is established.

- [ ] Bun runtime migration — Requires separate build pipeline; ecosystem stability TBD
- [ ] lazygit integration — Interactive TUI; not suitable for automation
- [ ] Full fzf interactive workflows — Requires TTY management; limited agent value
<!-- /section -->

<!-- section: prioritization -->
## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| ripgrep integration | HIGH | LOW | P1 |
| fd integration | HIGH | LOW | P1 |
| jq integration | HIGH | LOW | P1 |
| Tool availability detection | HIGH | LOW | P1 |
| yq integration | MEDIUM | MEDIUM | P2 |
| bat integration | MEDIUM | MEDIUM | P2 |
| gh CLI integration | MEDIUM | MEDIUM | P2 |
| fzf integration | LOW | MEDIUM | P3 |
| Bun runtime | HIGH | HIGH | P3 (defer) |

**Priority key:**
- P1: Must have for launch
- P2: Should have, add when possible
- P3: Nice to have, future consideration

<!-- /section -->

<!-- section: competitors -->
## Competitor Feature Analysis

| Feature | Traditional CLI Tools | Modern AI Agents | Our Approach |
|---------|---------------------|------------------|--------------|
| ripgrep integration | Native shell scripts | Via subprocess | Direct integration with fallback |
| fd integration | Shell pipelines | Via subprocess | Complement fast-glob |
| jq integration | Shell pipelines | Via subprocess | Pipe JSON output through jq |
| fzf integration | Common in dotfiles | Rarely used | Optional, TTY-dependent |
| bat integration | Common in dotfiles | Rarely used | Human output enhancement |
| gh CLI | Standard for GitHub | Uses API directly | gh CLI for authenticated ops |
| Bun runtime | Some tools migrating | Emerging | Defer until ecosystem matures |

## Sources

- ripgrep features: https://ripgrep.dev/features/
- ripgrep JSON output: https://github.com/BurntSushi/ripgrep/issues/930
- fd-find documentation: https://github.com/sharkdp/fd
- Bun vs Node.js performance: https://bun.com/docs/runtime/nodejs-compat
- GitHub CLI JSON output: https://cli.github.com/manual/gh_help_formatting
- jq documentation: https://jqlang.org/
- yq processor: https://github.com/mikefarah/yq
- Node.js subprocess: https://nodejs.org/api/child_process.html

---

*Feature research for: CLI Tool Integrations & Bun Runtime*
*Researched: 2026-03-10*
*Milestone: v9.2 CLI Tool Integrations & Runtime Modernization*
