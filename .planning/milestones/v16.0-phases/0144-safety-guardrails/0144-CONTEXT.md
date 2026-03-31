# Phase 144: Safety Guardrails - Context

**Gathered:** 2026-03-28
**Status:** Ready for planning

<domain>
## Phase Boundary
Destructive command detection (GARD-04) extending the existing advisory-guardrails system in `src/plugin/advisory-guardrails.js`. Pattern-based detection with Unicode NFKD normalization, three-tier severity, container/sandbox bypass, and user-configurable overrides. Advisory-only via `tool.execute.after` hook — consistent with existing GARD-01/02/03 architecture and the C-03 non-blocking constraint.
</domain>

<decisions>
## Implementation Decisions

### Warning Presentation
- **Channel:** Context injection only (via `<bgsd-notification>` blocks) — no OS-level notifications. Consistent with GARD-01/02/03 existing behavior.
- **Content:** Pattern name, severity level, and the exact command that triggered it. Example: `GARD-04: rm -rf /tmp/build matched [filesystem-recursive-delete] (CRITICAL)`
- **Severity tiers:** Three levels — CRITICAL (irreversible data loss: rm -rf, DROP TABLE, format disk), WARNING (dangerous but recoverable: git push --force, kill -9, chmod 777), INFO (context-dependent: curl | bash, plain rm, eval)
- **LLM instructions:** Severity-based behavioral guidance in the notification. CRITICAL = "Confirm with user before executing", WARNING = "Proceed with caution", INFO = no extra instruction (facts only)
- **Timing:** Post-execution via `tool.execute.after` hook. Pragmatic choice — upgrade to `tool.execute.before` pre-execution if/when the host editor supports it. Under C-03 (nothing blocks workflow), both are functionally advisory regardless.

### Pattern Library Scope
- **Breadth:** Wide — data destruction, system/privilege ops, AND supply-chain/injection risks. Advisory-only means false positives are annoying but not blocking. Severity tiers absorb borderline cases (INFO for low-confidence patterns).
- **Rationale:** AI agents running commands need wider guardrails than human operators (no muscle memory, less context). Three-tier severity prevents noise.
- **Organization:** Patterns grouped by category (filesystem, database, git, system, supply-chain). Each category has a default severity that individual patterns can override.
- **rm detection tiers:** `rm -r`/`rm -rf` = CRITICAL, `rm -f` (force, no recursive) = WARNING, plain `rm` = INFO
- **Custom patterns:** Users can add patterns via `config.json` at `advisory_guardrails.destructive_commands.custom_patterns`. Custom patterns merge with (don't replace) built-ins. Merge strategy details deferred to planning.
- **Unicode NFKD:** Normalize command strings with `str.normalize('NFKD')` + strip zero-width characters + strip combining marks BEFORE pattern matching. **Needs false-positive testing against real-world command pastes (Stack Overflow smart quotes, em-dashes, etc.) before shipping.**

### Container/Sandbox Detection
- **Method:** Environment variables first (DOCKER_HOST, SINGULARITY_NAME, MODAL_TASK_ID, DAYTONA_WS_ID, etc.), then filesystem probes (/.dockerenv, /run/.containerenv, /proc/1/cgroup containing docker|containerd)
- **Timing:** Detect once at plugin startup, cache the result. Container status doesn't change mid-session.
- **Config override:** `advisory_guardrails.sandbox_mode` accepts `'auto'` (default, uses detection), `true` (force sandbox), or `false` (force non-sandbox). Handles cloud IDEs (Codespaces, Gitpod) without bloating detection logic.
- **Sandbox behavior:** In sandbox mode, skip WARNING and INFO warnings. CRITICAL warnings still fire — bind mounts, networked databases, and remote git operations punch through container boundaries.

### Bypass and Override Behavior
- **Granularity:** Three levels — global toggle (`destructive_commands.enabled`), per-category enable/disable, per-pattern disable via `disabled_patterns` list
- **Override format:** Disabled patterns list (opt-out). Everything fires by default; users silence specific patterns by ID. Safer default.
- **Session overrides:** NONE. Config is the only control plane. Session quiet mode was considered and rejected — env vars for temporary state have no expiry and no visibility, leading to months of silently suppressed guardrails.
- **Sandbox override:** Handled via `sandbox_mode` config key, NOT session state.

### Agent's Discretion
- Exact regex patterns for the 25+ built-in destructive command library
- Notification XML format and field structure
- Internal data structures for pattern matching and caching
- Custom pattern merge conflict resolution strategy (flagged for planning)
</decisions>

<specifics>
## Specific Ideas
- Pattern library should draw from the existing 41-pattern skills security scanner in `src/commands/skills.js` (similar structure, proven pattern)
- Container detection should use the same `safeHook()` wrapper that protects all other plugin hooks (timeout, circuit breaker)
- Config keys nest under existing `advisory_guardrails` object in `src/plugin/parsers/config.js` — extends, doesn't restructure
- The `WRITE_TOOLS` set in advisory-guardrails.js needs extending (or a parallel `BASH_TOOLS` set) to include 'bash' tool
</specifics>

<stress_tested>
## Stress-Tested Decisions
- **Three severity tiers held up:** Tiers drive LLM behavior, not user-facing taxonomy. Users never see tier names unless debugging config.
- **Post-execution advisory held up:** C-03 constraint means even pre-execution would be advisory. Post vs pre is a timing difference, not a functional one.
- **Unicode NFKD normalization — needs validation:** NFKD normalization should be tested against real-world command pastes (smart quotes, em-dashes from Stack Overflow) to verify false positive rate before shipping.
- **Custom pattern merge — deferred to planning:** Merge strategy (namespacing, conflict resolution, update compatibility) is implementation detail the planner should define.
- **Session quiet mode DROPPED:** Environment variable for temporary state has no expiry/visibility. Config is the only control plane. This decision changed during stress testing.
</stress_tested>

<deferred>
## Deferred Ideas
- **Pre-execution hook migration:** When host editor supports `tool.execute.before`, upgrade from post-execution advisory to pre-execution advisory
- **Remote/cloud environment detection:** Codespaces, Gitpod, SSH sessions handled via `sandbox_mode` config override rather than auto-detection. Auto-detection for cloud IDEs could be a future enhancement.
- **WSL detection:** Not addressed — treat as regular Linux unless user sets `sandbox_mode: true`
- **Nested container detection:** Docker-in-Docker and similar — not addressed in this phase
</deferred>

---
*Phase: 0144-safety-guardrails*
*Context gathered: 2026-03-28*
