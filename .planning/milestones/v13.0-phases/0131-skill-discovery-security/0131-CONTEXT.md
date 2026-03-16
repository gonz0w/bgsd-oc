# Phase 131: Skill Discovery & Security - Context

**Gathered:** 2026-03-15
**Status:** Ready for planning

<domain>
## Phase Boundary

CLI commands for browsing, installing, validating, and removing project-local skills with a mandatory 41-pattern security scanner and human confirmation gate before any file is written. Includes bgsd-context exposing installed skills to downstream agents.

</domain>

<decisions>
## Implementation Decisions

### Security Scan Presentation
- Findings grouped severity-first (dangerous > warn > info), then file + line within each group
- Clean scans get a brief one-liner: "Security scan passed (41 patterns, 0 findings)"
- Warn-level findings show pattern name + line number only (no code snippet by default)
- Dangerous findings listed without explanations — trust the user knows why patterns are dangerous
- All files scanned equally — no distinction between SKILL.md and bundled resource files
- ANSI colors: red for DANGEROUS, yellow for WARN, green for PASS
- `--verbose` flag available to show full matched code snippets
- Always show count summary at end: "2 dangerous, 3 warnings, 36 clean"
- Show scan progress as checklist with marks per pattern category (e.g., "✓ eval patterns  ✓ network access  ✗ filesystem ops (2 warnings)")
- Blocked installs show all findings then explicit "Install BLOCKED — dangerous patterns found" message
- No force/trust override — dangerous findings are a hard block, period

### Install Confirmation Flow
- Content diff shows file list + sizes (not full contents) by default
- Human confirmation via classic Y/N: "Install skill 'foo' (3 files, 4.2KB)? [y/N]"
- Warn-level findings: single confirmation with warning note — "Install skill 'foo' (3 warnings)? [y/N]"
- Success message is a one-liner with path: "Installed 'foo' to .agents/skills/foo/ (3 files)"
- Invalid skill (no SKILL.md): error with explanation of expected structure
- Repo root only — no subdirectory support, one skill per repo
- Existing skill with same name: block with message directing user to skills:remove first
- Fetch via GitHub API — no git clone, no .git dependency

### List & Browse Output
- skills:list shows name + description per skill, simple aligned list
- Empty state: "No skills installed." — no hints
- Show scan status per skill (✓ clean / ⚠ 3 warnings)
- No separate skills:info command — skills:list + skills:validate is sufficient
- bgsd-context `installed_skills` field includes names + descriptions as objects

### Audit Trail
- Full audit entries: timestamp, action (install/remove/validate), source URL, outcome, plus scan verdict breakdown (dangerous count, warn count, pattern matches)
- No CLI command for audit — skill-audit.json is read directly by power users
- Log grows indefinitely — no rotation or cap
- Remove audit entries: just skill name + timestamp, no file list

### Agent's Discretion
None — all areas were discussed with explicit decisions.

</decisions>

<specifics>
## Specific Ideas

- Scan progress should feel like a security checklist being worked through (✓/✗ per category)
- The security posture is strict: no bypass for dangerous findings, ever
- Keep CLI output concise throughout — one-liners for success, severity-first for problems
- GitHub API fetch keeps the tool zero-dependency (no git required)

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 0131-skill-discovery-security*
*Context gathered: 2026-03-15*
