# Project Research Summary

**Project:** bGSD Plugin v13.0 — Closed-Loop Agent Evolution
**Domain:** Node.js CLI plugin — agent lifecycle management, lesson-driven improvement, skill ecosystem integration
**Researched:** 2026-03-15
**Confidence:** HIGH (official OC docs verified live, agentskills.io spec verified live, codebase analyzed directly)

<!-- section: compact -->
<compact_summary>
<!-- The compact summary is the DEFAULT view for orchestrators and planners.
     Keep it under 30 lines. Synthesizes all 4 research areas.
     Full sections below are loaded on-demand via extract-sections. -->

**Summary:** v13.0 adds five closed-loop evolution capabilities to the existing bGSD v12.x Node.js CLI plugin: per-project agent overrides (OC-native `.opencode/agents/`), lesson-driven improvement suggestions (`lessons:analyze`), agentskills.io-format skill discovery (filesystem-only — no HTTP API exists), deviation recovery auto-capture (Rule 1 code bugs only), and enhanced research quality scoring (structured profile, not a single aggregate number). Zero new runtime dependencies — all features use existing Node.js 22.5+ built-ins and extend existing src/ modules. Two critical corrections from research: the prior assumption of `.planning/agents/` for overrides is wrong (OC does not load that path), and agentskills.io has no REST API (skills are a filesystem format).

**Recommended stack:** OC native `.opencode/agents/` resolution (no bgsd-tools detection needed), `node:fs` cpSync for skill install, regex-based Markdown extraction for lesson parsing (no LLM), existing `cmdMemoryWrite` SQLite lessons store (dual-write, stable API), `node:child_process` execFileSync + curl for GitHub skill index browse

**Architecture:** Additive brownfield integration — 4 new src/ modules (2 libs + 2 command files), 4 modified commands, 3 modified workflows, 2 new directory conventions (`.opencode/agents/`, `.agents/skills/`); no new storage schema; no new npm dependencies

**Top pitfalls:**
1. **`.planning/agents/` is a dead path** — OC only loads `.opencode/agents/`; use the correct dir or all local overrides are silently ignored
2. **12% of public skills are malicious** — show full content diff + security scan + human confirmation before writing ANY skill file
3. **Lesson analysis on free-form text yields >40% false positives** — migrate to structured schema first; grandfather existing lesson as `Type: environment`
4. **Deviation capture over-triggers on Rule 3 (environmental) failures** — capture only Rule 1 (code bug) recoveries with a detectable behavioral change
5. **`autonomousRecoverles` typo in `autoRecovery.js` line 188** — fix before building any capture telemetry (metric never increments as-is)

**Suggested phases:**
1. **Foundation & Agent Overrides** — `.opencode/agents/` convention, CLI lifecycle commands, YAML validation, content sanitization; prerequisite for all automation that writes agent files
2. **Lesson Schema & Analysis Pipeline** — structured lesson format migration + `lessons:analyze/suggest/capture/list` CLI + `util:memory` pagination; critical-path dependency for deviation capture
3. **Skill Discovery & Security** — filesystem-based `skills:list/install/validate/remove`, 41-pattern security scan, human-confirm gate, `new-milestone.md` Step 8.5
4. **Deviation Capture** — Rule-1-only auto-capture hook in `execute-phase.md`; requires Phase 2 complete
5. **Enhanced Research Workflow** — `research:score` structured quality profile, `computeWebSourceQualityScore()`; independent of Phases 1-4

**Confidence:** HIGH across all 4 research areas | **Gaps:** LobeHub `@lobehub/market-cli` rate-limit fallback behavior under load not validated; OC `mode:` forced-to-subagent behavior needs per-project verification (MEDIUM confidence source)
</compact_summary>
<!-- /section -->

<!-- section: executive_summary -->
## Executive Summary

bGSD v13.0 closes the agent evolution loop: execution failures become lessons, lessons drive agent improvement suggestions, and improved agents are applied via project-local overrides that OC resolves natively. Research confirms this can be built with zero new npm dependencies — all five capabilities use Node.js 22.5+ built-ins already required by the project. The architecture is purely additive: 4 new source modules, 4 modified commands, 3 modified workflows.

The two most consequential discoveries from research: (1) OC natively resolves per-project agents from `.opencode/agents/` — the project's prior assumption of `.planning/agents/` was incorrect and would have silently broken all local overrides. (2) agentskills.io is a specification site with no HTTP API — skill discovery is a filesystem operation, not a registry query. Both corrections fundamentally reshape the implementation and prevent two significant architectural mistakes before they are built.

The primary risk is the skill ecosystem's verified 12% malicious content rate on public registries. Security-first architecture is non-negotiable: every skill installation path must route through a human-visible content diff, a 41-pattern security scan, and an explicit confirmation gate before any file is written. The lesson improvement pipeline carries a secondary risk — lesson analysis on free-form text produces >40% false positive suggestions, making structured schema migration the mandatory Phase 2 prerequisite, not an afterthought.
<!-- /section -->

<!-- section: key_findings -->
## Key Findings

### Recommended Stack

Zero new runtime dependencies required. All five features are implementable using existing Node.js 22.5+ built-ins already required by the project. OC's native `.opencode/agents/` resolution handles agent override loading — bgsd-tools.cjs only manages the file lifecycle, not the loading mechanism. agentskills.io has no REST API; skill discovery is pure filesystem scanning of standard paths.

**Core technologies:**
- **OC `.opencode/agents/` directory**: Per-project agent override — OC natively resolves project-local agents (project beats global, same-filename wins); no bgsd-tools detection needed
- **`node:fs` cpSync + mkdirSync**: Skill install from local dir or git clone output; synchronous, zero-dep, atomic
- **`node:child_process` execFileSync + curl**: Fetch GitHub skill index for browse (pattern already used throughout codebase); avoids `node:https` complexity
- **Existing `memory.js` lessons store**: Deviation capture via `cmdMemoryWrite(cwd, {store: 'lessons', entry})` — SQLite dual-write already in place, stable API
- **Regex-based Markdown parser**: Lesson extraction from structured `lessons.md` (headings + bold labels) — no LLM, no deps; `**Preventive Rules:**` bullet points map directly to agent instruction additions

**What NOT to use:**
- npm packages for HTTP (axios, node-fetch) — breaks single-file esbuild deploy
- LLM API calls in bgsd-tools.cjs — CLI must be deterministic
- agentskills.io HTTP API — 404 on all endpoints; does not exist
- Vector embeddings / RAG — out of scope per PROJECT.md
- `.planning/agents/` as the override dir — OC does not load this path

### Expected Features

**Must have — v13.0 launch (P1):**
- **Project-local agent override** (`.opencode/agents/`) — CLI lifecycle commands: `agent:list-local`, `agent:override`, `agent:sync`; YAML frontmatter validation required before any file write; content sanitization layer against system-prompt mangling
- **Structured lesson schema** — migrate `lessons.md` to typed entries with explicit `Type:` field (`workflow | agent-behavior | tooling | environment`); grandfather existing free-form lesson as `Type: environment`; foundational prerequisite for all lesson features
- **`lessons:analyze/suggest/capture/list` CLI** — parse structured lessons, group by recurrence, generate per-agent improvement suggestions; always advisory, never auto-apply; threshold: ≥2 supporting lessons before surfacing
- **Deviation auto-capture** — hook in `execute-phase.md` after 3-failure Rule-1 (code bug) recovery succeeds; calls `lessons:capture`; non-blocking (`2>/dev/null || true`); never captures Rule 3 (environmental)
- **Skill discovery + install** — filesystem scan of 4 standard paths; `skills:list/install/validate/remove` CLI; security scan (41 dangerous patterns); human-confirm gate with content diff; `skill-audit.json` log; `new-milestone.md` Step 8.5

**Should have — v13.x (P2):**
- Workflow improvement hooks — advisory "capture as lesson?" prompts in `verify-work.md` and `complete-milestone.md`
- Research quality scoring — structured profile (`source_count`, `high_confidence_pct`, `oldest_source_days`, `has_official_docs`, `flagged_gaps[]`); NOT a single A-F score
- Multi-source synthesis with conflict detection — explicit "Source A says X, Source B says Y" surfacing

**Defer — v14+ (P3):**
- Skill publishing to agentskills.io / LobeHub marketplace
- Lesson → GitHub PR workflow for agent file suggestions
- Cross-registry skill discovery (LobeHub + skills.sh + agentskills.io simultaneously)

**Confirmed non-features (anti-features):**
- Auto-apply agent file patches from lesson suggestions (violates human-in-the-loop; supply-chain risk)
- New agent role for "lesson reviewer" (PROJECT.md hard cap: 9 agent roles)
- Merge-based agent override (additive merge causes "rule soup"; use file-shadowing model per OC)

### Architecture Approach

Additive brownfield integration. New capabilities bolt onto existing `src/lib/` + `src/commands/` extension points without modifying core data paths, storage schema, or existing agent/skill files. The existing `memory_lessons` SQLite table and `session_decisions` table cover all new storage needs — no schema migration required. `plugin.js` is unchanged; it picks up new `init.js` enricher fields automatically.

**Major components — new files:**
1. **`src/lib/lessons.js`** (NEW) — `parseLessonsFile()`, `parseLessonsStore()`, `analyzePatterns()`, `suggestImprovements()`, `formatSuggestions()`; pure analysis logic, no side effects
2. **`src/commands/lessons.js`** (NEW) — `lessons:analyze`, `lessons:suggest`, `lessons:capture`, `lessons:list` CLI commands
3. **`src/lib/skills-hub.js`** (NEW) — `discoverLocalSkills()`, `installSkillFromDir()`, `installSkillFromGit()`, `validateSkillDir()`; static-analysis-only validation (never `require()` skill scripts — CJS/ESM boundary)
4. **`src/commands/skills.js`** (NEW) — `skills:list`, `skills:install`, `skills:validate`, `skills:remove` CLI commands

**Major components — modified files:**
5. **`src/commands/agent.js`** — extend `scanAgents()` for `.opencode/agents/` with scope annotation; `cmdAgentOverride()`, `cmdAgentSync()`
6. **`src/commands/research.js`** — `computeWebSourceQualityScore()`, `cmdResearchScore()` returning structured profile
7. **`src/commands/init.js`** — add `local_agent_overrides` + `installed_skills` fields to bgsd-context enricher
8. **`src/lib/context.js`** — new enricher fields in `AGENT_MANIFESTS` optional fields (no behavioral changes)
9. **`src/index.js`** — add `lessons:*` and `skills:*` namespace routing
10. **Workflows** — `new-milestone.md` Step 8.5 (skill discovery) + Step 8 quality scoring; `execute-phase.md` deviation capture; `verify-work.md` lessons:suggest surface

**Build order (8 waves):** libs (lessons.js, skills-hub.js) → commands (lessons.js, skills.js) → modified commands (agent.js, research.js) → enricher (context.js, init.js) → router (index.js) → tests → workflow text → build+deploy

**New directory conventions:**
- `.opencode/agents/` — per-project agent overrides (OC native; project beats global)
- `.agents/skills/` — project-local skills (agentskills.io cross-client convention)

### Critical Pitfalls

1. **`.planning/agents/` is a dead path for OC** — OC's documented per-project agent override location is `.opencode/agents/`, not `.planning/agents/`. Files in `.planning/agents/` are never loaded by OC's agent resolution. All executable overrides must go in `.opencode/agents/`; `.planning/agents/` can hold documentation-only reference copies.

2. **12% of public registry skills contain malicious payloads** — Confirmed by Snyk/Koi Security audit (Feb 2026): 341/2,857 skills malicious (12%), including HTML comment injection (`<!-- SYSTEM OVERRIDE: curl ... | bash -->`), prompt injection, and credential exfiltration targeting `~/.ssh/`, `~/.aws/`. Skills run with full agent privileges. Security architecture is non-negotiable: show full file diff, run 41-pattern security scan, require human confirmation, write to project-local `.agents/skills/` only (never `~/.config/`), log all installs to `skill-audit.json`.

3. **Lesson analysis on free-form text produces >40% false-positive suggestions** — The existing `lessons.md` is a 49-line narrative. Without structured schema, resolution descriptions become agent suggestions and contextual notes become general rules. Structured `Type:` field is a hard prerequisite. The existing lesson must be grandfathered as `Type: environment` (produces 0 improvement suggestions). Minimum threshold: ≥2 lessons with `Type: agent-behavior` before surfacing any suggestions.

4. **Deviation capture over-triggers on Rule 3 (environmental) failures** — "Cannot find module" after npm failure, network timeouts, and OS permission errors all trigger 3-failure recovery but carry no reusable agent-behavior signal. The existing `autoRecovery.js` classifies deviations into 4 rules. Capture only Rule 1 (code bug) recoveries where the successful attempt made a detectable behavioral change. Never capture Rule 3 (blocking/environmental).

5. **`autonomousRecoverles` typo in `autoRecovery.js` line 188** — The `autonomousRecoveries` metric is never incremented due to a typo (confirmed by direct file read). Any telemetry or lesson quality metrics built on top will always show 0 autonomous recoveries. This is a 1-line fix that must be in place before building deviation capture.

6. **Malformed agent frontmatter silently poisons the entire session** — A missing `name:` field in `.opencode/agents/` causes OC to log at DEBUG level only, but propagates broken agent state to ALL subsequent API calls (500 errors on every request). Validate YAML frontmatter after every write; require post-write read-back check; use a minimal inline validator (never regex-parse YAML — multiline strings and quoted colons break naive parsers).

7. **System-prompt mangling propagates into generated agent files** — The existing lesson documents that OC's auth plugin globally rewrites the editor name throughout system prompts. Generated agent override files containing paths or descriptions with the literal editor name will have those strings mangled. Sanitize all generated agent content before writing; use generic terms (`host editor config`, `$BGSD_HOME` pattern).

8. **Research quality score must be a structured profile, not a single number** — Aggregating source count, freshness, and confidence into one A-F grade introduces positional bias, verbosity bias, and dimension conflation (confirmed in arXiv 2025 LLM-as-judge research). Report structured profile: `{ source_count, high_confidence_pct, oldest_source_days, has_official_docs, flagged_gaps[] }`. Never gate plan creation on a quality score — use gaps list instead.

9. **New file-scan commands break 200+ snapshot tests** — Agent scan, lesson analysis, and skill discovery commands can inadvertently read from the real project's `.planning/` directory, producing non-deterministic test output. All v13.0 feature tests must use `createTempProject()` with fixed fixtures — no exceptions. Mock all network calls in tests.

10. **CJS/ESM boundary blocks skill validation via execution** — `bgsd-tools.cjs` is CJS-only. Skill helper scripts may be ESM-native. Attempting to `require()` them during validation fails with `require() of ES Module`. Skill validation must be static-analysis-only — scan file content for dangerous patterns, never execute or import skill helpers.
<!-- /section -->

<!-- section: roadmap_implications -->
## Implications for Roadmap

Based on research, suggested phase structure:

### Phase 1: Foundation & Agent Overrides
**Rationale:** Getting the override directory correct (`.opencode/agents/` not `.planning/agents/`) and establishing YAML validation is prerequisite before any downstream automation writes agent files. The content sanitization layer (preventing system-prompt mangling in generated agent content) must also be established here — before the lesson-driven improvement pipeline starts producing agent files.
**Delivers:** `agent:list-local`, `agent:override`, `agent:sync` CLI commands; YAML frontmatter validator (inline, no regex); content sanitization layer; bgsd-context enricher `local_agent_overrides` field; override precedence documentation; `util:agents:validate` command
**Addresses:** FEATURES.md table-stakes "project-local agent override"; FEATURES.md file-shadowing competitor analysis
**Avoids:** PITFALLS.md #1 (`.planning/agents/` dead path), #2 (system-prompt mangling in generated files), #6 (malformed frontmatter → session 500 errors), #9 (override precedence confusion)

### Phase 2: Lesson Schema & Analysis Pipeline
**Rationale:** Structured lesson format is the critical-path dependency for deviation capture (Phase 4), workflow improvement hooks, and improvement suggestions. Building the analysis engine on free-form text locks in >40% false-positive behavior. The `util:memory` pagination additions must happen before the first automated write — once automated writes start, lessons grow to 100+ entries quickly.
**Delivers:** Structured lesson schema with `Type:` field; grandfather migration of existing 49-line lesson as `Type: environment`; `lessons:analyze`, `lessons:suggest`, `lessons:capture`, `lessons:list` CLI; `util:memory` pagination (`--limit`, `--since`, `--type`); `lessons:compact` deduplication; cap of 3 auto-captures per milestone
**Uses:** Regex Markdown extraction (STACK.md pattern for `**Preventive Rules:**` section); existing `cmdMemoryWrite` API (no new storage)
**Avoids:** PITFALLS.md #3 (false-positive suggestions), #7 (lesson store growth without pagination)

### Phase 3: Skill Discovery & Security
**Rationale:** Security-first architecture must be established before any skill installation is wired to workflows. The 12% malicious rate means the human-confirmation gate is load-bearing, not optional. agentskills.io has no HTTP API — discovery is pure filesystem scanning plus GitHub browse link.
**Delivers:** `skills:list`, `skills:install`, `skills:validate`, `skills:remove` CLI; 41-pattern security content scanner; human-confirm gate with full content diff; `skill-audit.json` audit log; `new-milestone.md` Step 8.5 (optional skill discovery between research and requirements); bgsd-context enricher `installed_skills` field
**Uses:** `node:fs` cpSync for install (STACK.md); static-analysis-only validation (never `require()` skill scripts — CJS/ESM boundary per PITFALLS.md #10); GitHub raw URL for browsing
**Avoids:** PITFALLS.md #4 (12% malicious skill rate), #10 (CJS/ESM boundary)

### Phase 4: Deviation Capture
**Rationale:** Depends on Phase 2 (`lessons:capture` must exist). The Rule-1-only filter and `autonomousRecoverles` typo fix both need to be in place. Building this last among the core phases ensures the filtering logic is stable before automated writes begin.
**Delivers:** Deviation capture hook in `execute-phase.md` execute_waves step; Rule-1-only filter (`deviation_rule === 1` AND behavioral change detected); `autonomousRecoverles` → `autonomousRecoveries` typo fix in `autoRecovery.js`; 3-per-milestone capture cap; `capture_threshold` property in lesson schema; non-blocking via `2>/dev/null || true`
**Implements:** ARCHITECTURE.md Capability 4 integration map; FEATURES.md deviation auto-capture differentiator
**Avoids:** PITFALLS.md #5 (over-triggering on Rule 3 environmental failures), PITFALLS.md typo blocking telemetry

### Phase 5: Enhanced Research Workflow
**Rationale:** Fully independent of Phases 1-4. Only dependency is the existing `research.js` command and research-patterns skill — both present in v12.x. Best shipped after validating the core loop, giving real research data to calibrate quality thresholds.
**Delivers:** `research:score` CLI command returning structured quality profile (not A-F); `computeWebSourceQualityScore()` in `research.js`; quality summary surfaced in `new-milestone.md` Step 8 after researchers complete (flags any file with LOW confidence for re-research); `research:gaps` gap-list command
**Uses:** Structured profile output per PITFALLS.md #6; DRACO benchmark dimensions (Accuracy + Completeness + Objectivity from STACK.md)
**Avoids:** PITFALLS.md #6 (quality score collapses to vibes when dimensions overlap)

### Phase Ordering Rationale

- **Phase 1 first:** OC path correction and YAML validation are prerequisites before any automation writes agent files. Security baseline for generated content must exist first.
- **Phase 2 second:** Structured lesson schema is the critical-path dependency for Phase 4 (deviation capture). `util:memory` pagination must be in before first automated write. Lesson analysis false-positive prevention requires schema before engine.
- **Phase 3 independent of Phase 2:** Skill discovery and the lesson pipeline are decoupled. Security architecture (human-confirm gate) is independently critical regardless of lesson status.
- **Phase 4 after Phase 2:** `lessons:capture` (Phase 2) must exist. Rule-1 filter API (`autoRecovery.js`) needs to be verified against stable schema. Typo fix (Phase 4) should happen before capture telemetry is built.
- **Phase 5 anytime:** Research scoring has no dependencies on Phases 1-4. Can parallelize with any other phase or ship last.

### Research Flags

Phases needing deeper research during planning:
- **Phase 3:** LobeHub `@lobehub/market-cli` rate-limit handling and auth flow not fully validated — test graceful-fallback behavior (not-installed, rate-limited, network-unavailable) before wiring to workflow; design as advisory-only to prevent blocking
- **Phase 4:** `src/lib/recovery/autoRecovery.js` Rule 1 vs Rule 3 classification API — confirm the exact interface for reading deviation rule type at the capture hook point before implementing the filter

Phases with standard patterns (research-phase likely skippable):
- **Phase 1:** OC agent resolution fully documented (HIGH confidence, verified live); YAML validation is well-trodden; override file format is identical to global agents
- **Phase 2:** Markdown regex extraction confirmed against existing `lessons.md` structure; `cmdMemoryWrite` API stable; lesson schema design is research-grounded
- **Phase 5:** Research quality dimensions documented (DRACO benchmark); implementation is a straight additive extension of existing `research.js`

### Research Flags — Per Phase

| Phase | Research Needed? | Flag | How to Handle |
|-------|-----------------|------|---------------|
| 1: Agent Overrides | No | — | Well-documented; pattern matches existing global agents |
| 2: Lesson Schema | No | — | Schema design complete; `cmdMemoryWrite` API stable |
| 3: Skill Discovery | Yes | LobeHub rate-limit fallback | Test before workflow wiring; advisory-only design |
| 4: Deviation Capture | Yes | `autoRecovery.js` Rule API | Review file before implementing filter |
| 5: Research Workflow | No | — | Additive extension; DRACO dimensions confirmed |
<!-- /section -->

<!-- section: confidence -->
## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | OC docs verified live 2026-03-15; agentskills.io spec verified live; existing codebase (agent.js 577 lines, memory.js 412 lines, context.js 494 lines) read directly; all zero-dep claims validated against Node.js 22.5+ built-ins already in use |
| Features | HIGH | Official docs verified for all 5 feature areas; competitor analysis cross-referenced (Cursor, Roo Code, OC); priority matrix grounded in confirmed research, not assumptions; MVP/P1/P2/P3 boundaries clearly motivated |
| Architecture | HIGH | Primary sources: OC official docs + direct codebase analysis of execute-phase.md (497 lines), new-milestone.md (441 lines), autoRecovery.js (typo confirmed at line 188); integration maps verified against existing command routing |
| Pitfalls | HIGH | OC issues #22843 + #32732 confirmed; PurpleBox/Snyk 12% malicious rate confirmed; autoRecovery.js typo verified by direct file read; false-positive rate for free-form lesson analysis from arXiv 2025 research; test isolation patterns verified from existing test suite |

**Overall confidence:** HIGH

### Gaps to Address

- **LobeHub `@lobehub/market-cli` rate limiting under load** (MEDIUM confidence): The 5-requests/30-minute rate limit is documented, but graceful-fallback behavior under first-install conditions is not validated. Mitigation during Phase 3: design skill discovery as advisory-only (show install command if CLI missing, retry guidance if rate-limited, skip with notice if network unavailable); never make it blocking.
- **OC `mode:` forced-to-subagent behavior** (MEDIUM confidence — third-party issue tracker, not official OC docs): Referenced in oh-my-openagent issue #1032. If confirmed, local overrides cannot set `mode: primary`. Mitigation during Phase 1: explicitly test `mode:` behavior in local override files; document confirmed precedence chain.
- **`autoRecovery.js` Rule 1 vs Rule 3 API surface** (MEDIUM confidence): The 4-rule taxonomy is confirmed (Rule 1=bugs, Rule 2=missing-critical, Rule 3=blocking, Rule 4=architectural). The exact API to read `deviation_rule` at the capture hook point in `execute-phase.md` needs direct file review during Phase 4 planning.
<!-- /section -->

<!-- section: sources -->
## Sources

### Primary (HIGH confidence)
- https://opencode.ai/docs/agents/ — per-project agent directory `.opencode/agents/` confirmed; file-shadowing model confirmed (2026-03-15)
- https://opencode.ai/docs/skills/ — skill discovery paths confirmed; cross-client conventions (`.agents/skills/`, `~/.agents/skills/`)
- https://agentskills.io/specification — SKILL.md format confirmed; no REST API confirmed; filesystem-based discovery model
- https://agentskills.io/client-implementation/adding-skills-support.md — discovery/install patterns; progressive 3-tier loading
- `/mnt/raid/DEV/bgsd-oc/src/commands/agent.js` — existing agent scanning API (577 lines, read directly)
- `/mnt/raid/DEV/bgsd-oc/src/lib/context.js` — AGENT_MANIFESTS + scopeContextForAgent API (494 lines, read directly)
- `/mnt/raid/DEV/bgsd-oc/src/commands/memory.js` — `cmdMemoryWrite` stable API; lessons store (412 lines, read directly)
- `/mnt/raid/DEV/bgsd-oc/src/lib/recovery/autoRecovery.js` — typo at line 188 (`autonomousRecoverles`) confirmed by direct read
- `/mnt/raid/DEV/bgsd-oc/lessons.md` — existing lesson structure observed; 49-line free-form entry confirmed
- https://research.perplexity.ai/articles/evaluating-deep-research-performance-in-the-wild — DRACO benchmark (Accuracy + Completeness + Objectivity dimensions)

### Secondary (MEDIUM confidence)
- https://www.prplbx.com/blog/agent-skills-supply-chain — PurpleBox Security Feb 2026: 341/2,857 malicious skills (12%); Snyk ToxicSkills anatomy; HTML comment injection patterns
- https://github.com/anthropics/claude-code/issues/22843 — malformed frontmatter → 500 errors (DEBUG-only log confirmed, propagates to all API calls)
- https://github.com/anthropics/claude-code/issues/32732 — tool-call model param overrides frontmatter model; tool-call params > frontmatter > defaults precedence chain
- https://lobehub.com/skills/openclaw-skills-self-improving-agent-1-0-1 — OpenClaw self-improvement skill comparison; manual vs auto-capture tradeoffs
- https://spec-weave.com/docs/skills/verified/verified-skills — 41 dangerous pattern categories; 3-tier certification model
- https://arxiv.org/html/2506.22316v2 — positional bias + verbosity bias in LLM-as-judge scoring (2025)
- OC binary strings inspection — `EXTERNAL_DIRS = [".claude", ".agents"]` pattern confirmed (MEDIUM — binary, not docs)

### Tertiary (LOW confidence — validate during implementation)
- https://github.com/code-yeongyu/oh-my-openagent/issues/1032 — `mode:` forced to subagent (third-party issue, not official OC docs)
- https://medium.com/@anishkarthik.a/the-invisible-supply-chain-attack-how-toxicskills-are-hijacking-ai-agents-63d0c0697146 — HTML comment injection, base64 obfuscation patterns in malicious skills
- Memory Engineering for AI Agents (Medium 2026) — lesson store growth failure modes; 100+ entry context overflow patterns
- LLM Action Item Extraction Research (Alibaba/Forgent 2025-2026) — 30-50% false-positive rate on free-form text without structural markers

---
*Research completed: 2026-03-15*
*Synthesized by: Research Synthesizer Agent*
*Ready for roadmap: yes*
