# Phase 75: Event-Driven State Sync - Context

**Gathered:** 2026-03-09
**Status:** Ready for planning

<domain>
## Phase Boundary

Project state stays synchronized automatically — validation on idle, cache invalidation on file changes, and visible notifications for important events. Depends on Phase 73 (ProjectState cache, context builder) and Phase 74 (tool patterns). Requirements: EVNT-01, EVNT-02, EVNT-03, EVNT-04.

</domain>

<decisions>
## Implementation Decisions

### Idle Validation Behavior
- Auto-fix STATE.md inconsistencies silently — correct the file, log the fix, don't interrupt the user
- Validation scope: STATE.md + ROADMAP.md cross-check (verify position matches phase statuses), NOT full plan-level cross-check
- Also validate config.json schema validity during idle checks — auto-fix invalid fields with defaults
- Also detect stale progress: plans marked in-progress with no recent git activity — auto-fix by marking as paused
- Stale progress threshold is configurable via settings
- "Idle" defined as: no LLM output AND no user typing/input for the configured threshold (default 5s)
- Idle threshold is configurable via config.json settings
- Skip validation during active plan execution (state is expected to be in flux)
- After an auto-fix, don't re-validate until the next user interaction (prevents fix loops)
- If no .planning/ directory exists (no project initialized), silently skip validation
- Validation errors: swallow all exceptions and log them — never let validation crash the plugin
- When an auto-fix changes a file, show a minimal toast (e.g., "State synced") — not detailed
- Logging is sufficient for diagnostics — no structured fix-count tracking needed
- Idle validation can be disabled entirely via a config.json toggle (`idle_validation.enabled`)

### File Watcher Scope & Sensitivity
- Broad watch scope: `.planning/` files, `config.json`, and any files referenced by state (like test results)
- Watch for all file events: creates, modifications, and deletes
- Configurable debounce timing (default determined by agent) for handling rapid successive edits
- Plugin tracks its own writes and ignores self-changes to prevent feedback loops
- Use native OS file watchers (fs.watch or similar) — not polling
- Reasonable cap on watched paths (e.g., ~500), log a warning if exceeded
- External edits trigger cache invalidation only — next read returns fresh data, no immediate validation
- Start watching after `.planning/` directory is confirmed to exist (not on plugin load, not lazy)
- On watcher errors (permission denied etc.): log and degrade gracefully — skip that path, continue watching what it can
- No manual cache refresh command needed — watcher handles everything

### Toast Notification Design
- Dual-channel by severity: important events (stuck detection, phase completion) get OS/editor system notifications; routine events (state synced) get agent context injection
- System notifications: severity-based persistence — routine auto-dismiss, critical (stuck) stays until dismissed
- Include suggested next action in notifications (e.g., "Phase 72 complete. Next: /bgsd-plan-phase 73")
- Phase completion notifications include summary stats (plans, tasks, duration)
- Notification configuration: per-category controls AND severity threshold — layered approach
- Deduplicate related events within a time window into a single notification
- Rate limiting to prevent notification storms (cap at reasonable rate, queue/drop excess)
- Context-injected notifications use structured XML tags (e.g., `<bgsd-notification type="phase-complete">...</bgsd-notification>`)
- Simple notification history: last 10-20 notifications accessible via command
- Notification history available as both bgsd-tools command AND a thin slash command wrapper (`/bgsd-notifications`)
- Do Not Disturb mode: suppresses routine notifications, critical (stuck detection) still comes through
- When DND ends, show one summary notification pointing to history command
- Sound is configurable per severity level (off by default, user can enable)

### Stuck/Loop Detection
- Trigger: same tool call producing the exact same error message 3+ times
- Also detect spinning: non-error repetitive patterns (same tool call sequence repeating)
- Spinning detection threshold is configurable
- Error loop threshold (default 3) is configurable via config.json
- On detection: toast notification + inject system message to agent context + suggest agent pause for user input
- Notification includes diagnostic detail (which tool, what error, how many failures)
- Counter resets on user input OR on a successful tool call
- Escalation: if stuck detection fires a 2nd time in the same session, show a stronger warning/suggestion

### Agent's Discretion
- Idle validation frequency while idle (once on entry vs. periodic)
- Cache invalidation granularity (granular per-file vs. wholesale vs. tiered)
- Specific debounce timing defaults for file watcher
- Rate limiting exact thresholds for notifications
- Watched path cap exact number
- Spinning detection default threshold values

</decisions>

<specifics>
## Specific Ideas

- Idle validation should be aware of workflow state — skip during active plan execution to avoid false positives
- Self-change tracking is important for the file watcher to avoid feedback loops between auto-fix and cache invalidation
- Notification deduplication window should align with the file watcher debounce window
- The notification system should be extensible — Phase 76 (Advisory Guardrails) will add its own notification types
- Context-injected notifications should be parseable by downstream agents using the `<bgsd-notification>` XML tag format
- DND mode should be toggleable at runtime, not just via config file

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 75-event-driven-state-sync*
*Context gathered: 2026-03-09*
