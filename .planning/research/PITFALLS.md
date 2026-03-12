# Pitfalls Research

**Domain:** Natural Language UI & Visualization for CLI Tools + Code Audit & Performance Profiling
**Researched:** 2026-03-11 (NL UI), 2026-03-12 (Code Audit)
**Confidence:** HIGH

<!-- section: compact -->
<pitfalls_compact>
<!-- Compact view for planners. Keep under 25 lines. -->

**Top pitfalls:**
1. **Interactive prompts block agents** — Add --non-interactive escape hatches for every prompt (Phase 1)
2. **NL parsing hallucinations** — Validate and sanitize all natural language-extracted parameters (Phase 1-2)
3. **Human-structured output breaks agents** — Always provide --json flag, treat output as API contract (Phase 1)
4. **Visualization context pollution** — Rich terminal output consumes agent context tokens; provide --quiet modes (Phase 2)
5. **No escape from pagination** — Agents can't navigate pagers; add --no-pager or --limit flags (Phase 1)

**Tech debt traps:** Hardcoding prompt text, ignoring exit codes, assuming TTY availability

**Security risks:** Shell injection via NL-generated parameters, prompt injection in user input

**"Looks done but isn't" checks:**
- NL parsing: verify edge cases (empty input, typos, ambiguous intent)
- Visualization: verify works in non-TTY, minimal terminals
- Output: verify JSON schema is stable across versions
</pitfalls_compact>
<!-- /section -->

<!-- section: critical_pitfalls -->
## Critical Pitfalls

### Pitfall 1: Interactive Prompts Block Agent Execution

**What goes wrong:**
Natural language interface adds conversational prompts that require human input. When AI agents invoke the CLI, they get stuck waiting for responses that can't be provided through shell commands. The workflow halts entirely.

**Why it happens:**
"Make it conversational" design principle leads to interactive prompts for humans. These become blockers for agents that invoke the CLI programmatically. The same design that feels friendly for humans becomes hostile for automation.

**How to avoid:**
- Add `--non-interactive` or `--skip-prompts` flag to every command
- Implement sensible defaults when in non-interactive mode
- Make the default behavior work without user input, with interactive mode as opt-in
- Test all commands with `CI=true` environment variable to simulate agent invocation

**Warning signs:**
- Any `readline()`, `inquirer`, or stdin-read in command flow
- Commands that fail without a TTY attached
- Documentation that doesn't explain automated/scripted usage

**Phase to address:** Phase 1 (Foundation)

---

### Pitfall 2: Natural Language Parsing Generates Invalid Parameters

**What goes wrong:**
Natural language input is interpreted into CLI arguments. The LLM hallucinates parameters, misunderstands intent, or generates syntactically invalid values. The CLI either fails unexpectedly or silently does the wrong thing.

**Why it happens:**
- LLMs generate creative outputs including incorrect parameters
- Ambiguous user input gets resolved incorrectly
- No validation layer between NL interpretation and command execution
- Edge cases (empty strings, special characters, paths) aren't handled

**How to avoid:**
- Implement input validation schema (use valibot which bGSD already has)
- Add `--dry-run` flag for destructive operations to preview interpreted intent
- Log the interpreted parameters before execution for debugging
- Create a validation phase: interpret → validate → confirm → execute
- Handle shell metacharacters in NL-generated paths (the `../../.ssh` problem)

**Warning signs:**
- No validation on NL-extracted parameters
- Commands accept arbitrary strings without type checking
- Error messages don't explain what went wrong with the input

**Phase to address:** Phase 1-2 (Foundation + NL Parsing)

---

### Pitfall 3: Human-Optimized Output Breaks Agent Consumption

**What goes wrong:**
CLI outputs beautifully formatted tables, progress bars, and prose explanations. Agents must parse this "human-friendly" output to extract structured data. Parsing fails when terminal width changes, colors are stripped, or format varies.

**Why it happens:**
- Default output optimized for human readability, not machine parsing
- Tables wrap differently based on terminal width
- Color codes and formatting escape sequences pollute data
- No machine-readable alternative by default

**How to avoid:**
- Make JSON the default or ensure `--json`/`--output json` works everywhere
- Use line-delimited JSON (NDJSON) for streaming data
- Output JSON to stdout, human messages to stderr
- Include `next_actions` field with command templates agents can run next
- Treat CLI output as a stable API contract with semantic versioning

**Warning signs:**
- Only text/table output available
- Help text varies based on environment
- No `--quiet` flag for bare output

**Phase to address:** Phase 1 (Foundation)

---

### Pitfall 4: Visualization Consumes Excessive Context Tokens

**What goes wrong:**
Rich terminal visualizations (progress bars, charts, dashboards) are rendered. Agents consuming this output spend context tokens on visual elements that provide no programmatic value. Large outputs exhaust context windows.

**Why it happens:**
- Visualization libraries output ANSI escape sequences and box-drawing characters
- Progress bars emit continuous updates that compound token usage
- Terminal width calculations embed formatting into output

**How to avoid:**
- Provide `--quiet` or `--no-progress` flag to disable visualizations
- Output structured data instead of rendered visualizations
- Use streaming JSON lines instead of full renders
- Truncate unbounded output with file pointers for full data
- Create separate "data export" commands for programmatic access

**Warning signs:**
- No way to disable progress indicators
- Output size grows linearly with data size
- Visual elements mixed with data in output

**Phase to address:** Phase 2 (Visualization)

---

### Pitfall 5: Pagination Breaks Agent Workflows

**What goes wrong:**
CLI uses a pager (less, more) or waits for keypresses to navigate output. Agents cannot interact with pagers, causing hangs or truncated results.

**Why it happens:**
- Default terminal behavior enables paging for long output
- Interactive features assumed, not detected
- No explicit flag to disable paging

**How to avoid:**
- Detect non-TTY environments and disable paging automatically
- Add explicit `--no-pager` and `--limit` flags
- Set `PAGER=cat` or `LESS=` environment variable handling
- Implement `--page-size` for controlling output batches
- Never require terminal interaction for automated flows

**Warning signs:**
- Commands hang without input in CI environments
- Output truncated in automated tests
- No `--limit` or `--max-results` options

**Phase to address:** Phase 1 (Foundation)

---

### Pitfall 6: Shell Injection via NL-Generated Parameters

**What goes wrong:**
Natural language input is interpreted into shell commands. Malicious prompts or hallucinated parameters contain shell metacharacters (`;`, `|`, `&&`, `$()`) that execute arbitrary commands.

**Why it happens:**
- NL output directly interpolated into shell commands
- No sanitization of extracted parameters
- User prompts can contain prompt injection attacks
- LLM generates parameters with special characters

**How to avoid:**
- Use `execFile` instead of `exec` or shell interpolation
- Sanitize all NL-extracted parameters with shell escaping
- Implement command allowlist (if feasible)
- Add input validation that rejects suspicious patterns
- Document in AGENTS.md: "This CLI is frequently invoked by AI/LLM agents. Always assume inputs can be adversarial."

**Warning signs:**
- Uses `execSync` with string concatenation
- No parameter sanitization before shell invocation
- Accepts arbitrary user strings without escaping

**Phase to address:** Phase 1-2 (Foundation + NL Parsing)

---

### Pitfall 7: Model Fabricates User Messages in Conversational UI

**What goes wrong:**
During long conversational sessions, the NL interface generates fabricated user messages and processes them as genuine input. Actions are taken based on conversations that never happened.

**Why it happens:**
- Context window pressure causes the model to fill gaps
- Long conversations lose track of what's real vs. generated
- No message provenance tracking

**How to avoid:**
- Implement message ID tracking with collision detection
- Add gap analysis to detect missing messages
- Validate message timestamps are monotonically increasing
- Include "source" metadata for each message
- Add confirmation step for actions derived from interpreted intent

**Warning signs:**
- Message IDs out of sequence
- Gaps in conversation timeline
- Model generates "realistic but fake" user messages

**Phase to address:** Phase 2 (NL Parsing)

---
<!-- /section -->

<!-- section: tech_debt -->
## Technical Debt Patterns

Shortcuts that seem reasonable but create long-term problems.

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Skip --json flag, parse text with regex | Faster initial implementation | Brittle, breaks on format changes | Never - use proper JSON output |
| Hardcode prompt text strings | Quick to write | Hard to localize, no theming | Only for MVP, refactor before ship |
| Ignore exit codes beyond 0/1 | Simpler error handling | Agents can't distinguish error types | Never - use semantic exit codes |
| Assume TTY always available | Simpler output code | Breaks in CI, scripts, agents | Always detect and handle non-TTY |
| Single output format for all modes | One code path | Can't satisfy humans AND agents | Never - separate output modes |
<!-- /section -->

<!-- section: performance -->
## Performance Traps

Patterns that work at small scale but fail as usage grows.

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Continuous progress updates | Token exhaustion, slow rendering | Batch updates, --quiet flag | In agent context |
| Full result dumps to stdout | Context overflow | Pagination, --limit, streaming | Large datasets |
| Re-parsing NL input each command | Latency accumulation | Cache interpreted intents | High-frequency commands |
| Visualization rendering per line | Slow output, buffer bloat | Render once, update incrementally | Large data exports |
<!-- /section -->

<!-- section: security -->
## Security Mistakes

Domain-specific security issues beyond general web security.

| Mistake | Risk | Prevention |
|---------|------|------------|
| NL input directly in shell commands | Arbitrary code execution | Parameter sanitization, execFile |
| No input validation on NL-extracted params | Command injection, data corruption | Schema validation, allowlists |
| Pasting @ symbols triggers file expansion | Unexpected file access | Escape @ in input handling |
| Prompt injection in user input | Manipulated agent behavior | Input sanitization, rate limiting |
| Logging NL input with secrets | Credential exposure | Scrub sensitive patterns from logs |
<!-- /section -->

<!-- section: ux -->
## UX Pitfalls

Common user experience mistakes in this domain.

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Mixed noun-verb grammar | Confused command guessing | Consistent `noun verb` hierarchy |
| Unhelpful error messages | Can't fix problems | Actionable errors with error codes |
| No --dry-run for destructive ops | Accidental data loss | Preview before execute |
| Non-idempotent commands | Repeated execution causes issues | Idempotent by default or explicit handling |
| Inconsistent field names across commands | Hard to script | Unified schema across commands |
| Help varies by environment | Unpredictable behavior | Static, discoverable help |
<!-- /section -->

<!-- section: looks_done -->
## "Looks Done But Isn't" Checklist

Things that appear complete but are missing critical pieces.

- [ ] **NL Parsing:** Often missing validation on edge cases — verify with empty input, special chars, maximum length
- [ ] **--json flag:** Often works for some commands but not all — verify every command supports JSON output
- [ ] **--non-interactive:** Often missing on subset of commands — verify all prompts have escape hatches
- [ ] **Error codes:** Often only 0/1 — verify semantic exit codes (1=error, 2=usage, 3=validation)
- [ ] **Terminal detection:** Often assumes TTY — verify works in CI, pipes, scripts
- [ ] **Visualization fallback:** Often no plain-text alternative — verify --quiet mode works everywhere
- [ ] **Input sanitization:** Often missing for NL-generated params — verify shell metacharacters are escaped
<!-- /section -->

<!-- section: recovery -->
## Recovery Strategies

When pitfalls occur despite prevention, how to recover.

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Agent stuck on prompt | LOW | Kill process, add --non-interactive, retry |
| Invalid NL parameters | MEDIUM | Enable --dry-run, review logs, fix validation |
| Output parsing failure | LOW | Add --json flag, parse structured output |
| Context overflow from visualization | LOW | Add --quiet flag, reduce output size |
| Shell injection detected | HIGH | Audit logs, rotate credentials, patch validation |
| Fabricated messages detected | MEDIUM | Reset conversation, add message provenance |
<!-- /section -->

## Pitfall-to-Phase Mapping

How roadmap phases should address these pitfalls.

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Interactive prompts block agents | Phase 1 | Test with CI=true, verify --non-interactive works |
| NL parsing generates invalid params | Phase 1-2 | Test with adversarial input, verify validation |
| Human output breaks agents | Phase 1 | Verify --json on all commands |
| Visualization context pollution | Phase 2 | Test with large dataset, verify --quiet |
| Pagination breaks agents | Phase 1 | Test in non-TTY, verify --no-pager |
| Shell injection via NL params | Phase 1-2 | Audit code, verify sanitization |
| Model fabricates messages | Phase 2 | Test long conversations, verify message tracking |
| Mixed noun-verb grammar | Phase 1 | Consistency audit across all commands |
| Non-idempotent operations | Phase 1 | Test repeated execution, verify idempotency |

---

## Sources

- [Making your CLI agent-friendly - Speakeasy](https://www.speakeasy.com/blog/engineering-agent-friendly-cli)
- [Designing CLI Tools for AI Agents - nibzard](http://nibzard.com/ai-native/)
- [Writing CLI Tools That AI Agents Actually Want to Use - DEV Community](https://dev.to/uenyioha/writing-cli-tools-that-ai-agents-actually-want-to-use-39no)
- [CLI Design for AI Agents - JoelClaw](https://joelclaw.com/cli-design-for-ai-agents)
- [Keep the Terminal Relevant: Patterns for AI Agent Driven CLIs - InfoQ](https://infoq.com/articles/ai-agent-cli)
- [Securing CLI Based AI Agent - Vishal Mysore](https://medium.com/@visrow/securing-cli-based-ai-agent-c36429e88783)
- [Top 7 CLI Developer Experience Mistakes - TechBuddies](https://www.techbuddies.io/2026/01/09/top-7-cli-developer-experience-mistakes-devs-still-make-in-2025/)
- [Model fabricates user messages - OpenClaw Issue #25021](https://github.com/openclaw/openclaw/issues/25021)
- [Robust @ paste escaping - Google Gemini CLI PR #21239](https://github.com/google-gemini/gemini-cli/pull/21239)
- [Claude Code Issue #32176 - Agent draws false conclusions](https://github.com/anthropics/claude-code/issues/32176)

---
*Pitfalls research for: Natural Language UI & Visualization for CLI Tools*
*Researched: 2026-03-11*

---

# CODE AUDIT & PERFORMANCE TOOLING PITFALLS

**Domain:** Code Audit & Performance Profiling for CLI Tools
**Researched:** 2026-03-12
**Confidence:** HIGH

<!-- section: compact_audit -->
<pitfalls_compact>
<!-- Compact view for planners. Keep under 25 lines. -->

**Top pitfalls:**
1. **False positives in unused code detection** — Build allowlist for generated code, tests, exports (Phase 1)
2. **Complexity metrics misread as quality scores** — Use multiple metrics, not just cyclomatic (Phase 1-2)
3. **Profiling overhead distorts measurements** — Use sampling, separate warmup from measurement (Phase 1)
4. **Static analysis misses runtime behavior** — Combine with dynamic analysis, warn about limitations (Phase 1)
5. **Noisy audit output causes alert fatigue** — Implement severity tiers, confidence levels, suppression (Phase 2)

**Tech debt traps:** Hardcoding thresholds, ignoring language differences, single-metric obsession

**Security risks:** Audit tool DoS via large codebase, path traversal in file analysis, memory exhaustion

**"Looks done but isn't" checks:**
- Unused code: verify generated code excluded, dynamic requires handled
- Complexity: verify metric thresholds documented, context considered
- Profiling: verify warmup separated, sampling overhead measured
</pitfalls_compact>
<!-- /section -->

<!-- section: critical_audit -->
## Critical Pitfalls

### Pitfall 1: False Positives in Unused Code Detection

**What goes wrong:**
The unused code detector reports legitimate code as dead: generated functions (`.gen.go`, `_pb.go`), dynamically required modules (`require('./' + name)`), test files, polyfills, and conditionally compiled code. Users stop trusting the tool.

**Why it happens:**
- Static analysis cannot understand dynamic requires, code generation, or conditional compilation
- Generated code follows patterns that look "unused" to simple AST analysis
- Build toolchain transformations aren't modeled in the analysis
- Reflection and runtime metaprogramming are invisible to static analysis

**How to avoid:**
- Build an allowlist of patterns to exclude (generated files, test files, node_modules by default)
- Implement dynamic-require detection that tracks string concatenation in require calls
- Add configuration for project-specific exclusions (build outputs, conditional compilation)
- Report confidence levels: "likely unused" vs "definitely unused"
- Create a `--include-generated` flag for thorough scans with manual filtering

**Warning signs:**
- High percentage of "unused" findings in well-maintained projects
- No configuration options for exclusions
- Reports generated code as unused
- Single-pass analysis without iteration

**Phase to address:** Phase 1 (Foundation - unused code detection)

---

### Pitfall 2: Complexity Metrics Misread as Quality Scores

**What goes wrong:**
Cyclomatic complexity is treated as the definitive quality metric. Developers refactor to lower scores while actually making code harder to understand. Short functions with complex logic score well; long functions with simple logic score poorly.

**Why it happens:**
- Cyclomatic complexity is easy to measure but captures only control flow
- Cognitive complexity, coupling, and cohesion aren't considered
- Thresholds (e.g., "max complexity 10") become goals rather than guidelines
- No context: utility functions, error handlers, and test helpers have different complexity profiles than business logic

**How to avoid:**
- Use multiple metrics: cyclomatic + cognitive complexity + coupling + lines of code
- Set context-aware thresholds: higher for utilities, lower for business logic
- Never block builds on complexity alone — use as warning/advisory
- Track complexity trends over time, not absolute values
- Document what complexity means for your codebase

**Warning signs:**
- Single metric drives all decisions
- Thresholds enforced as hard limits
- Refactoring to lower scores increases confusion
- No trend analysis over time

**Phase to address:** Phase 1-2 (Foundation + complexity analysis)

---

### Pitfall 3: Profiling Overhead Distorts Measurements

**What goes wrong:**
The profiler adds so much overhead that the results don't reflect production behavior. Instrumented code runs 10-100x slower. Hot paths appear slower than they are because profiling adds overhead to every operation.

**Why it happens:**
- Heavy instrumentation on every function call
- No warmup period — measures JIT compilation time
- Sampling rate too high, overwhelming the application
- Memory profiling triggers additional allocations
- Ignoring that profiling changes timing

**How to avoid:**
- Use sampling-based profiling (not instrumentation) for CPU
- Separate warmup phase from measurement phase
- Run multiple iterations, discard first results
- Measure and report profiling overhead separately
- Use production-like workloads, not synthetic benchmarks
- Provide `--profile-mode=sampling` vs `--profile-mode=instrumentation` options

**Warning signs:**
- Profiling 10x+ slower than normal execution
- Results vary wildly between runs
- No warmup or JIT consideration
- Single run results accepted without iteration

**Phase to address:** Phase 1 (Foundation - performance profiling)

---

### Pitfall 4: Static Analysis Misses Runtime Behavior

**What goes wrong:**
The code audit reports issues based on static analysis that don't occur at runtime: dead code that's actually used via reflection, performance issues that only manifest under load, or type errors that TypeScript erases.

**Why it happens:**
- Static analysis operates on source code, not runtime behavior
- Build steps (transpilation, minification) change code
- Runtime conditions (environment variables, feature flags) affect behavior
- Native modules and bindings bypass static analysis

**How to avoid:**
- Document static analysis limitations prominently
- Combine static analysis with dynamic/runtime checks where possible
- Add "known limitations" section to audit output
- Warn when analysis makes assumptions about runtime
- Support `--include-runtime` or `--trace-execution` for deeper analysis
- Provide confidence levels: "static analysis shows X" vs "runtime confirms X"

**Warning signs:**
- Audit claims confidence it shouldn't have
- No runtime verification option
- Results differ from runtime behavior
- Build artifacts not accounted for

**Phase to address:** Phase 1 (Foundation - static analysis scope)

---

### Pitfall 5: Noisy Audit Output Causes Alert Fatigue

**What goes wrong:**
The code audit produces hundreds of findings with equal severity. Users ignore all findings because they can't prioritize. Real issues are lost in noise. The tool becomes useless.

**Why it happens:**
- No severity classification (blocking vs warning vs info)
- No confidence scoring (definite vs likely vs possible)
- All findings reported regardless of user interest
- No suppression or ignore mechanism
- Findings not actionable (e.g., "this is complex" without guidance)

**How to avoid:**
- Implement three-tier severity: ERROR (fix now), WARNING (review), INFO (consider)
- Add confidence levels: HIGH (definite), MEDIUM (likely), LOW (possible)
- Support file/pattern suppression with documentation requirements
- Make findings actionable: explain WHY it's a problem and HOW to fix it
- Default to showing only ERROR + WARNING; INFO is opt-in
- Provide `--severity-threshold` and `--confidence-threshold` flags
- Allow grouping/sorting by severity, confidence, file, or age

**Warning signs:**
- 100+ findings on clean codebase
- No filtering options
- Equal severity across all findings
- No ignore/suppress mechanism

**Phase to address:** Phase 2 (Audit output refinement)

---

### Pitfall 6: Performance Regression Without Baselines

**What goes wrong:**
Performance profiling shows current numbers but no way to know if performance improved or degraded. Each run is a one-off measurement. Performance drift goes undetected until it becomes a problem.

**Why it happens:**
- No baseline storage or comparison
- Measurements vary too much to compare meaningfully
- Environment differences between runs (CPU, memory, load)
- No standardized benchmarks for comparison
- Results aren't persisted or trend-analyzed

**How to avoid:**
- Store baseline metrics with version/timestamp
- Compare current run to baseline, report % change
- Run benchmarks multiple times, report p50/p95/p99
- Capture environment metadata (Node version, CPU, memory)
- Implement `--baseline` flag to set, `--compare` to diff
- Show trend charts for tracked metrics over time
- Allow baseline updates on known-good states

**Warning signs:**
- No way to compare to previous runs
- High variance in measurements between runs
- No environment capture
- Performance changes go unnoticed

**Phase to address:** Phase 2 (Performance tracking)

---

### Pitfall 7: Memory Leak Detection Without Context

**What goes wrong:**
Memory profiling shows growing heap but doesn't explain why. Allocations are attributed to the wrong function. GC cycles confuse the picture. The "leak" is actually expected growth, not a bug.

**Why it happens:**
- Heap snapshots taken at wrong times
- Growth attributed to allocation site, not retention source
- Normal GC behavior misinterpreted as leaks
- No baseline comparison for "this grew unexpectedly"
- Missing context about expected vs unexpected growth

**How to avoid:**
- Take snapshots at key lifecycle points (not random intervals)
- Use retained size, not allocated size, to find leaks
- Compare to baseline snapshots to identify unexpected growth
- Track GC cycles and exclude from leak analysis
- Provide interpretation: "X grew by Y bytes since baseline — likely retained by Z"
- Document expected growth patterns (caches, buffers)

**Warning signs:**
- Single heap snapshot analyzed in isolation
- Allocations blamed on wrong functions
- GC behavior treated as leak
- No baseline comparison

**Phase to address:** Phase 2 (Memory profiling)

---

<!-- /section -->

<!-- section: tech_debt_audit -->
## Technical Debt Patterns

Shortcuts that seem reasonable but create long-term problems.

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Hardcode complexity thresholds | Simple implementation | Can't adapt to different code styles | Never - always configurable |
| Single language support | Easier parser | Limited utility, rewrite needed | Only for single-language projects |
| No caching of analysis results | Simple code | Slow on large codebases, repeated work | Small projects only |
| Skip test file analysis | Faster scans | Miss test-only dead code | Only if explicitly configured |
| No incremental analysis | Simpler architecture | Full rescans on every change | One-time audits only |
| Ignore build artifacts | Simpler implementation | False positives from generated code | Never - must handle |
<!-- /section -->

<!-- section: integration_audit -->
## Integration Gotchas

Common mistakes when connecting audit tools to external systems.

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|-----------------|
| Git integration | Analyzing generated files in git history | Exclude .git-ignored files, build outputs |
| CI/CD pipeline | Blocking builds on warnings | Use severity thresholds, fail only on errors |
| Editor integration | Blocking on every save | Debounce, batch analysis, background |
| Build system | Analyzing before build completes | Hook into post-build, not pre-build |
| IDE | Blocking UI thread | Run analysis in background, async |
| Pre-commit hook | Slowing commits unacceptably | Run fast checks only, defer heavy analysis |
<!-- /section -->

<!-- section: performance_traps_audit -->
## Performance Traps

Patterns that work at small scale but fail as usage grows.

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Full AST parse every run | Minutes to analyze small projects | Cache parsed AST, incremental analysis | Projects >10K lines |
| No parallelism | Single-threaded analysis is slow | Use worker threads for independent files | Multi-core machines, large codebases |
| Loading entire files into memory | Memory exhaustion on large files | Stream analysis, process in chunks | Files >1MB |
| No early exit | Analyzes everything even when errors found | Fail fast with --fail-fast flag | Large codebases |
| Exponential analysis | Analysis time grows superlinearly | Complexity limits, timeout limits | Deep dependency trees |
<!-- /section -->

<!-- section: security_audit -->
## Security Mistakes

Domain-specific security issues beyond general web security.

| Mistake | Risk | Prevention |
|---------|------|------------|
| No DoS protection | Maliciously large codebase exhausts resources | Timeout limits, file size limits, memory limits |
| Path traversal in file analysis | Attacker reads arbitrary files | Validate paths, restrict to project root |
| Command injection in analysis | Malicious code triggers unwanted commands | Sandbox analysis, no shell execution |
| Credential exposure in logs | Sensitive data in audit output | Scrub paths, tokens, secrets |
| ReDoS in regex analysis | Pathological regex causes hang | Timeout regex operations, limit complexity |
<!-- /section -->

<!-- section: ux_audit -->
## UX Pitfalls

Common user experience mistakes in code audit tools.

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| All findings equal priority | Can't focus on what matters | Severity + confidence tiers |
| No suppression mechanism | Can't hide false positives | Allowlist with documentation |
| Unactionable output | "Fix this" without guidance | Explain why and how to fix |
| No progress indicator | Don't know if stuck or done | Progress bar, ETA, file count |
| Verbose by default | Overwhelming output | Opt-in verbosity, summary first |
| No diff from baseline | Can't see what changed | Baseline comparison, trend view |
| Ignoring configuration | Wrong thresholds for project | Load from config file, document options |
<!-- /section -->

<!-- section: looks_done_audit -->
## "Looks Done But Isn't" Checklist

Things that appear complete but are missing critical pieces.

- [ ] **Unused code detection:** Often missing generated code exclusion — verify with .gen.go, _pb.go files
- [ ] **Complexity analysis:** Often uses single metric — verify multiple metrics, context-aware thresholds
- [ ] **Performance profiling:** Often missing warmup separation — verify JIT compilation excluded
- [ ] **Static analysis:** Often overclaims confidence — verify limitations documented
- [ ] **Audit output:** Often noisy without filtering — verify severity/confidence tiers
- [ ] **Memory analysis:** Often single snapshot — verify baseline comparison available
- [ ] **Incremental analysis:** Often full rescan — verify caching works between runs
- [ ] **Timeout protection:** Often missing — verify large codebases don't hang
<!-- /section -->

<!-- section: recovery_audit -->
## Recovery Strategies

When pitfalls occur despite prevention, how to recover.

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| False positives in unused detection | LOW | Add exclusion patterns, adjust confidence threshold |
| Complexity misread as quality | MEDIUM | Add multi-metric analysis, context thresholds |
| Profiling overhead distorting results | LOW | Switch to sampling mode, add warmup |
| Static analysis false confidence | MEDIUM | Add runtime verification, lower confidence claims |
| Alert fatigue from noisy output | LOW | Increase severity threshold, enable suppression |
| No baseline for regression | MEDIUM | Capture baseline, run comparison |
| Memory analysis without context | MEDIUM | Add baseline snapshots, track lifecycle |
<!-- /section -->

## Pitfall-to-Phase Mapping

How roadmap phases should address these pitfalls.

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| False positives in unused code | Phase 1 | Test with generated code, dynamic requires |
| Complexity metrics as quality | Phase 1-2 | Verify multiple metrics, context thresholds |
| Profiling overhead | Phase 1 | Measure profiling overhead separately |
| Static analysis scope | Phase 1 | Document limitations, add runtime verification |
| Noisy audit output | Phase 2 | Test with clean codebase, verify filtering |
| No performance baselines | Phase 2 | Verify baseline storage, comparison |
| Memory leak without context | Phase 2 | Verify baseline snapshots, retention analysis |
| Hardcoded thresholds | Phase 1 | All thresholds must be configurable |
| DoS via large codebase | Phase 1 | Verify timeout, memory limits work |

---

## Sources

- [golangci-lint unused rule issues](https://github.com/golangci/golangci-lint/issues/3354)
- [Vulture Python dead code detection issues](https://github.com/jendrikseipp/vulture/issues/253)
- [Static analysis false positives - Parasoft](https://www.parasoft.com/blog/false-positives-in-static-code-analysis/)
- [Reducing SAST false positives - AppSecSanta](https://appsecsanta.com/application-security/reducing-sast-false-positives)
- [Common pitfalls of code metrics - Solnic](https://solnic.dev/common-pitfalls-of-code-metrics)
- [Cyclomatic complexity misleading - LinearB](https://linearb.io/blog/cyclomatic-complexity)
- [Why code metrics mislead - DX](https://getdx.com/blog/cyclomatic-complexity/)
- [Node.js benchmarks lying about throughput - Medium](https://medium.com/@bhagyarana80/your-node-benchmarks-are-lying-about-throughput-bfc4d569dcaf)
- [Node.js wrong bottleneck - Medium](https://medium.com/%40jickpatel611/node-load-tests-and-the-wrong-bottleneck-666fad252049)
- [Profiler lied about copies - Medium](https://medium.com/@ThinkingLoop/the-profiler-lied-your-copies-are-the-hot-path-609813ab0759)
- [Node.js profiling best practices - PushBased](https://push-based.io/article/advanced-cpu-profiling-in-node-best-practices-and-pitfalls)
- [Semgrep false positive reduction](https://semgrep.dev/docs/kb/semgrep-code/reduce-false-positives)

---

*Pitfalls research for: Code Audit & Performance Profiling for CLI Tools*
*Researched: 2026-03-12*
