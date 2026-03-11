# Pitfalls Research

**Domain:** Natural Language UI & Visualization for CLI Tools
**Researched:** 2026-03-11
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
