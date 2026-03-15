# Requirements: v13.0 Closed-Loop Agent Evolution

**Status:** Active
**Created:** 2026-03-15
**Coverage:** All requirements must map to exactly one phase

---

## Milestone v13.0 Requirements

### LOCAL — Local Agent Overrides

- [ ] **LOCAL-01:** User can list all agents showing both global (~/.config/opencode/agents/) and project-local (.opencode/agents/) with scope annotation
- [ ] **LOCAL-02:** User can create a project-local override copy of any global agent via `agent:override <name>` writing to `.opencode/agents/`
- [ ] **LOCAL-03:** User can synchronize a local override with the upstream global agent (see diff, accept/reject changes) via `agent:sync`
- [ ] **LOCAL-04:** User can view a diff between a local override and its global counterpart via `agent:diff`
- [ ] **LOCAL-05:** All agent file writes (override creation, sync) pass YAML frontmatter validation before writing — missing `name:` field is a hard error
- [ ] **LOCAL-06:** All agent file writes sanitize generated content to prevent system-prompt mangling (no literal editor name, use generic terms)
- [ ] **LOCAL-07:** bgsd-context enricher exposes `local_agent_overrides: [string]` listing which agents have project-local versions

### LESSON — Lesson Schema & Analysis Pipeline

- [ ] **LESSON-01:** User can capture a structured lesson entry via `lessons:capture` with required fields: `Date`, `Title`, `Severity`, `Type` (workflow|agent-behavior|tooling|environment), `Root Cause`, `Prevention Rule`, `Affected Agents`
- [ ] **LESSON-02:** Existing free-form lessons.md is migrated to structured format with `Type: environment` (producing 0 improvement suggestions)
- [ ] **LESSON-03:** User can list all lessons with filtering by type, severity, date via `lessons:list [--type] [--since] [--severity]`
- [ ] **LESSON-04:** User can analyze lesson patterns via `lessons:analyze` — groups recurrent patterns (≥2 supporting lessons) by affected agent
- [ ] **LESSON-05:** User can generate structured agent improvement suggestions via `lessons:suggest [--agent]` — advisory only, never auto-applied, threshold ≥2 lessons before surfacing
- [ ] **LESSON-06:** `util:memory read --store lessons` supports pagination via `--limit`, `--since`, `--type` to handle stores with 100+ entries
- [ ] **LESSON-07:** `lessons:compact` deduplicates lessons when store exceeds configurable threshold (default 100) — groups identical root causes, keeps latest
- [ ] **LESSON-08:** verify-work workflow surfaces `lessons:suggest` advisory after phase verification completes (non-blocking, informational)
- [ ] **LESSON-09:** complete-milestone workflow surfaces `lessons:suggest` at milestone wrapup (non-blocking, informational)

### SKILL — Skill Discovery & Security

- [ ] **SKILL-01:** User can list installed project-local skills in `.agents/skills/` via `skills:list`
- [ ] **SKILL-02:** User can install a skill from a GitHub URL or local directory via `skills:install <source>` — installs to `.agents/skills/` only, never to `~/.config`
- [ ] **SKILL-03:** Every skill installation path runs a 41-pattern security scan before writing any file — dangerous verdict blocks install; policy/warn findings require human confirmation
- [ ] **SKILL-04:** Every skill installation shows full content diff and requires explicit human confirmation before writing to disk
- [ ] **SKILL-05:** All skill install attempts (including blocked/rejected) are logged to `.agents/skill-audit.json` with timestamp, source, scan result, outcome
- [ ] **SKILL-06:** User can validate any skill in `.agents/skills/` against the security scanner via `skills:validate <name>`
- [ ] **SKILL-07:** User can remove an installed project-local skill via `skills:remove <name>`
- [ ] **SKILL-08:** `new-milestone.md` includes an optional Step 8.5 for skill discovery — presents agentskills.io browse link and prompts whether to install any skills before proceeding to requirements
- [ ] **SKILL-09:** bgsd-context enricher exposes `installed_skills: [string]` listing skill names from `.agents/skills/`

### DEVCAP — Deviation Recovery Auto-Capture

- [ ] **DEVCAP-01:** `autoRecovery.js` typo `autonomousRecoverles` is fixed to `autonomousRecoveries` so deviation telemetry increments correctly
- [ ] **DEVCAP-02:** execute-phase workflow captures a structured lesson entry after a Rule 1 (code bug) deviation recovery succeeds — non-blocking (`2>/dev/null || true`), never fires for Rule 3 (environmental) failures
- [ ] **DEVCAP-03:** Auto-capture is capped at 3 entries per milestone to prevent noise — additional recoveries are silently skipped after cap is reached
- [ ] **DEVCAP-04:** Auto-captured lessons include: deviation rule type, failure count before success, what behavioral change succeeded, affected agent

### RESEARCH — Enhanced Research Workflow

- [ ] **RESEARCH-01:** `research:score <file>` returns a structured quality profile (not a single grade): `{ source_count, high_confidence_pct, oldest_source_days, has_official_docs, flagged_gaps[] }`
- [ ] **RESEARCH-02:** `new-milestone.md` research completion step surfaces the quality profile summary and flags any research file with LOW confidence for optional re-research (non-blocking)
- [ ] **RESEARCH-03:** `research:gaps` returns the `flagged_gaps[]` array from a research file's quality profile as a formatted list
- [ ] **RESEARCH-04:** research:score detects and surfaces multi-source conflicts — explicit surfacing when two or more sources disagree on a fact (`conflicts: [{claim, source_a, source_b}]`)

---

## Future Requirements

- Skill publishing to agentskills.io / LobeHub marketplace — too early, no write API
- Cross-registry skill discovery (LobeHub + skills.sh simultaneously) — single source sufficient for v13.0
- Lesson → GitHub PR workflow for agent file suggestions — requires gh CLI integration beyond current scope
- Automatic lesson-based agent patching (auto-apply suggestions) — violates human-in-the-loop principle
- New agent role for "lesson reviewer" — PROJECT.md hard cap at 9 agent roles

---

## Out of Scope

- **Agent role cap:** Maximum 9 agent roles — closed-loop learning delivered as CLI data + workflow hooks, not new agents
- **Merge-based agent overrides:** File-shadowing model only (OC native) — merge produces "rule soup"
- **`.planning/agents/` as override path:** OC does not load this path — only `.opencode/agents/` works
- **agentskills.io HTTP API calls:** No REST API exists — filesystem-based discovery only
- **LLM calls in bgsd-tools.cjs CLI:** All analysis must be deterministic — no API calls in CLI
- **Auto-apply agent patches:** Never auto-modify agent files without human confirmation

---

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| LOCAL-01 | Phase 129 | Complete |
| LOCAL-02 | Phase 129 | Complete |
| LOCAL-03 | Phase 129 | Complete |
| LOCAL-04 | Phase 129 | Complete |
| LOCAL-05 | Phase 129 | Complete |
| LOCAL-06 | Phase 129 | Complete |
| LOCAL-07 | Phase 129 | Complete |
| LESSON-01 | Phase 130 | Complete |
| LESSON-02 | Phase 130 | Complete |
| LESSON-03 | Phase 130 | Complete |
| LESSON-04 | Phase 130 | Complete |
| LESSON-05 | Phase 130 | Complete |
| LESSON-06 | Phase 130 | Complete |
| LESSON-07 | Phase 130 | Complete |
| LESSON-08 | Phase 130 | Complete |
| LESSON-09 | Phase 130 | Complete |
| SKILL-01 | Phase 131 | Complete |
| SKILL-02 | Phase 131 | Complete |
| SKILL-03 | Phase 131 | Complete |
| SKILL-04 | Phase 131 | Complete |
| SKILL-05 | Phase 131 | Complete |
| SKILL-06 | Phase 131 | Complete |
| SKILL-07 | Phase 131 | Complete |
| SKILL-08 | Phase 131 | Complete |
| SKILL-09 | Phase 131 | Complete |
| DEVCAP-01 | Phase 132 | Complete |
| DEVCAP-02 | Phase 132 | Complete |
| DEVCAP-03 | Phase 132 | Complete |
| DEVCAP-04 | Phase 132 | Complete |
| RESEARCH-01 | Phase 133 | Complete |
| RESEARCH-02 | Phase 133 | Complete |
| RESEARCH-03 | Phase 133 | Complete |
| RESEARCH-04 | Phase 133 | Complete |
