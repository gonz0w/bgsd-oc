# bGSD Plugin — OpenCode Best Practices Audit Report

**Date:** 2026-03-07
**Version audited:** 1.20.5 (v8.2)
**Auditor scope:** Commands (40 files), Agents (9 files), Configuration, Plugin API, Deployment

---

## Executive Summary

| Severity | Count | Description |
|----------|-------|-------------|
| **Critical** | 2 | Breaks OpenCode compatibility or causes runtime issues |
| **Warning** | 8 | Deviates from best practice but functional |
| **Info** | 7 | Improvement opportunities |

**Overall assessment:** bGSD is a mature, well-architected plugin that exceeds typical OpenCode plugins in sophistication. The file-copy deployment model works well but diverges from OpenCode's evolving plugin ecosystem. Two critical items require attention: a ghost command in documentation and the deployment directory naming mismatch (`command/` vs `commands/`). Most warnings relate to underutilization of OpenCode's frontmatter capabilities and structural inconsistencies between command files.

---

## Area 1: Command Format (`commands/*.md`)

### Finding 1.1 — Missing command file referenced in AGENTS.md and README.md

**Severity:** Critical
**Current state:** AGENTS.md (line 101) and README.md (line 176) reference `/bgsd-join-discord` but no file `commands/bgsd-join-discord.md` exists. The directory contains 40 files, while documentation claims 41 commands.
**Best practice:** Every documented command must have a corresponding command file, and vice versa.
**Recommendation:** Either create `commands/bgsd-join-discord.md` or remove the reference from AGENTS.md (line 101) and README.md (line 176). If the command was removed intentionally during a cleanup phase, update all documentation to reflect 40 commands.

### Finding 1.2 — All 40 commands have `description` frontmatter ✅

**Severity:** Info (positive finding)
**Current state:** Every command file includes a `description:` field in YAML frontmatter. This is the primary required field for OpenCode command discovery.
**Assessment:** Full compliance with OpenCode's command frontmatter requirements.

### Finding 1.3 — Only 1 of 40 commands uses `agent` frontmatter

**Severity:** Warning
**Current state:** Only `bgsd-plan-phase.md` declares `agent: gsd-planner` in frontmatter. Other commands that spawn specific agents (e.g., `bgsd-execute-phase` → `gsd-executor`, `bgsd-debug` → `gsd-debugger`, `bgsd-map-codebase` → `gsd-codebase-mapper`) do so via workflow logic rather than frontmatter.
**Best practice:** OpenCode's command frontmatter supports `agent` to specify which agent handles the command. This enables the runtime to select the correct agent before loading the command body.
**Recommendation:** Add `agent:` frontmatter to commands that always route to a specific agent:
- `bgsd-debug.md` → `agent: gsd-debugger`
- `bgsd-map-codebase.md` → `agent: gsd-codebase-mapper`
- `bgsd-verify-work.md` → `agent: gsd-verifier`

However, most bGSD commands act as **orchestrators** that spawn multiple agents — for these, omitting `agent:` is correct. The inconsistency with `bgsd-plan-phase.md` is the real issue: either use `agent:` consistently for all single-agent commands, or remove it from `bgsd-plan-phase.md` since it too is an orchestrator (it spawns both gsd-planner and gsd-plan-checker).

### Finding 1.4 — No commands use `model` or `mode` frontmatter

**Severity:** Info
**Current state:** Zero commands specify `model:` or `mode:` in frontmatter.
**Best practice:** OpenCode supports `model` (override default model for this command) and `mode` in command frontmatter.
**Recommendation:** Not needed for most bGSD commands since model selection is handled by the profile system (`util:resolve-model`). This is actually a **strength** — bGSD's profile system is more sophisticated than per-command model pinning. No action required.

### Finding 1.5 — `$ARGUMENTS` usage is consistent across commands that accept args

**Severity:** Info (positive finding)
**Current state:** 21 of 40 commands reference `$ARGUMENTS`. Commands that don't accept arguments correctly omit it. Usage patterns are consistent: `$ARGUMENTS` appears in `<context>` blocks where the orchestrator parses it.
**Assessment:** Full compliance with OpenCode's argument passing convention.

### Finding 1.6 — `__OPENCODE_CONFIG__` placeholder usage is universal and correct

**Severity:** Info (positive finding)
**Current state:** All 40 commands use `@__OPENCODE_CONFIG__/get-shit-done/...` paths in `<execution_context>` blocks. The placeholder is resolved at deploy time by `deploy.sh` (line 119) to `~/.config/oc` (symlink to `~/.config/opencode`).
**Assessment:** Excellent pattern. Avoids hardcoded paths and works around the Anthropic auth plugin mangling issue.

### Finding 1.7 — Two commands embed inline process logic instead of referencing workflows

**Severity:** Warning
**Current state:** `bgsd-debug.md` (157 lines) and `bgsd-research-phase.md` (183 lines) contain full inline process logic with bash code blocks, spawn templates, and multi-step orchestration — unlike the other 38 commands which reference workflows via `<execution_context>`.
**Best practice:** OpenCode commands should be thin wrappers that delegate to workflows. This keeps command files small (under ~40 lines) and puts complex logic in workflow files where it can be updated independently.
**Recommendation:** Extract the process logic from `bgsd-debug.md` into `workflows/debug.md` and from `bgsd-research-phase.md` into `workflows/research-phase.md`. Replace the inline content with `<execution_context>` references. Note: `bgsd-research-phase.md` already references a workflow path on line 31 (`__OPENCODE_CONFIG__/get-shit-done/bin/gsd-tools.cjs init:phase-op`) but doesn't use `@`-prefixed workflow loading. The workflow files `diagnose-issues.md` and `research-phase.md` already exist in the workflows directory but aren't referenced.

### Finding 1.8 — Structural inconsistency between command files

**Severity:** Warning
**Current state:** Command files use different XML tag patterns:
- **Pattern A (29 files):** `<objective>`, `<execution_context>`, `<process>` — clean, minimal
- **Pattern B (8 files):** `<objective>`, `<execution_context>`, `<context>`, `<process>` — adds context block
- **Pattern C (2 files):** `<objective>`, `<context>`, `<process>` with inline logic — no execution_context
- **Pattern D (1 file):** `<purpose>`, `<process>`, `<success_criteria>` — unique to `bgsd-reapply-patches.md`

Additionally, some commands include `<success_criteria>` (5 files) while most don't.
**Best practice:** Consistent structure across all commands improves maintainability and reduces cognitive load.
**Recommendation:** Standardize on Pattern A/B as the canonical form. Convert `bgsd-reapply-patches.md` to use `<objective>` instead of `<purpose>`. Consider whether `<success_criteria>` should be standard (it's useful for orchestrator commands but not needed for simple wrappers).

---

## Area 2: Agent Format (`agents/*.md`)

### Finding 2.1 — All 9 agents have `mode: subagent` ✅

**Severity:** Info (positive finding)
**Current state:** Every agent file declares `mode: subagent` in frontmatter. This is required for OpenCode's subagent spawning mechanism.
**Assessment:** Full compliance.

### Finding 2.2 — All 9 agents have descriptive `description` fields ✅

**Severity:** Info (positive finding)
**Current state:** Descriptions are detailed and action-oriented (e.g., "Creates executable phase plans with task breakdown, dependency analysis, and goal-backward verification. Spawned by /bgsd-plan-phase orchestrator."). Most include the spawning context.
**Assessment:** Exceeds typical OpenCode agent descriptions which tend to be terse.

### Finding 2.3 — All 9 agents have `color` fields ✅

**Severity:** Info (positive finding)
**Current state:** All agents declare `color` in hex format. Colors are semantically grouped: yellow for executor, orange for debugger, green for planner/checker/verifier, cyan for researchers/mapper, purple for roadmapper.
**Assessment:** Good visual differentiation in OpenCode's TUI.

### Finding 2.4 — No agents declare `model` in frontmatter

**Severity:** Warning
**Current state:** Zero agents specify `model:` in frontmatter. Model selection is entirely handled by the runtime profile system (`util:resolve-model gsd-{agent} --raw`).
**Best practice:** OpenCode agents can declare `model` in frontmatter as a default/preferred model. While bGSD's profile system is more flexible (quality/balanced/budget tiers), this means OpenCode's built-in model routing has no information about agent preferences.
**Recommendation:** Consider adding a `# model: anthropic/claude-sonnet-4-5` comment (or actual frontmatter) as a documented default that the profile system can override. This provides a fallback if the profile system isn't available and makes agent resource requirements visible. Low priority — the profile system works well.

### Finding 2.5 — Tool grant `websearch` is non-standard

**Severity:** Warning
**Current state:** Three agents declare `websearch: true` in their `tools:` block (`gsd-debugger`, `gsd-phase-researcher`, `gsd-project-researcher`). OpenCode's standard tool name is `web_search` or the MCP-based `mcp__brave-search__*`.
**Best practice:** Tool grants should match OpenCode's actual tool names. If `websearch` is a bGSD-specific alias or custom tool, it should be documented.
**Recommendation:** Verify that `websearch` resolves correctly in the OpenCode runtime. If it's an alias, ensure it maps to the correct underlying tool. If it's a legacy name from an earlier OpenCode version, update to the current tool name. Check the deployed environment to confirm these agents can actually use web search — if the tool grant doesn't match, agents silently lose web search capability.

### Finding 2.6 — MCP tool grant pattern is well-formed

**Severity:** Info (positive finding)
**Current state:** Two agents (`gsd-planner`, `gsd-phase-researcher`, `gsd-project-researcher`) use `mcp__context7__*: true` wildcard grants. This correctly grants access to all Context7 MCP server tools.
**Assessment:** Proper use of OpenCode's MCP tool grant syntax.

### Finding 2.7 — No agents use `temperature` frontmatter

**Severity:** Info
**Current state:** OpenCode supports `temperature` in agent frontmatter for controlling LLM creativity/determinism. No bGSD agent uses this.
**Recommendation:** Consider adding `temperature: 0` to deterministic agents like `gsd-plan-checker` and `gsd-verifier` where consistency matters more than creativity. Low priority — default temperature works acceptably.

---

## Area 3: Configuration & opencode.json

### Finding 3.1 — No `opencode.json` exists in the project

**Severity:** Warning
**Current state:** The project has no `opencode.json`. Configuration is handled through `.planning/config.json` (bGSD's own config) and deploy.sh (deployment config).
**Best practice:** OpenCode supports project-level `opencode.json` for plugin configuration, MCP servers, instructions, and permissions. A plugin development project should ideally have one for dogfooding.
**Recommendation:** Create a minimal `opencode.json` for the development workspace:
```json
{
  "$schema": "https://opencode.ai/config.json",
  "instructions": ["AGENTS.md"]
}
```
This would let OpenCode load AGENTS.md automatically instead of relying on the developer remembering to reference it. Low priority since the current setup works.

### Finding 3.2 — Deploy target uses singular `command/` not plural `commands/`

**Severity:** Critical
**Current state:** `deploy.sh` line 27 sets `CMD_DIR="$HOME/.config/opencode/command"` (singular). OpenCode's official documentation states the directory should be `commands/` (plural): "The `.opencode` and `~/.config/opencode` directories use plural names for subdirectories: `agents/`, `commands/`, `modes/`, `plugins/`, `skills/`, `tools/`, and `themes/`."
**Best practice:** Use `~/.config/opencode/commands/` (plural) as per OpenCode's documented convention.
**Impact assessment:** OpenCode documents that "Singular names (e.g., `agent/`) are also supported for backward compatibility" — so this likely still works. However, using the deprecated singular form risks breakage in future OpenCode versions.
**Recommendation:** Update `deploy.sh` line 27 from:
```bash
CMD_DIR="$HOME/.config/opencode/command"
```
to:
```bash
CMD_DIR="$HOME/.config/opencode/commands"
```
Also verify that the deployed environment uses `commands/` (plural). The agent deploy path on line 35 (`$HOME/.config/opencode/agents`) already correctly uses plural.

### Finding 3.3 — Symlink workaround for Anthropic auth plugin is well-documented

**Severity:** Info (positive finding)
**Current state:** `deploy.sh` line 117 sets `OPENCODE_CFG="$HOME/.config/oc"` (symlink → `~/.config/opencode`). This avoids the Anthropic auth plugin's text replacement of "opencode" → "Claude" in system prompts. `lessons.md` provides thorough documentation of the root cause, symptoms, and resolution.
**Assessment:** Creative and effective workaround. Well-documented for future maintainers.

### Finding 3.4 — Plugin deploys to custom `get-shit-done/` subdirectory

**Severity:** Warning
**Current state:** The plugin deploys to `~/.config/opencode/get-shit-done/` with subdirectories `bin/`, `workflows/`, `templates/`, `references/`, `src/`. This is a custom location outside OpenCode's standard directory structure.
**Best practice:** OpenCode's standard global directories are `~/.config/opencode/{agents,commands,modes,plugins,skills,tools,themes}/`. There's no standard for a plugin's "home" directory with its own internal structure.
**Recommendation:** This is a pragmatic choice given bGSD's architecture (CLI tool + workflows + templates + references). No change needed now, but if OpenCode's plugin API matures to support structured plugins with multiple assets, migration should be considered. Document this as a known deviation.

---

## Area 4: Plugin API Compatibility

### Finding 4.1 — bGSD uses file-copy deployment, not the plugin API

**Severity:** Warning
**Current state:** bGSD deploys via `deploy.sh` which copies files to OpenCode's config directories. OpenCode now has a formal plugin system (`@opencode-ai/plugin`) with:
- TypeScript-first plugin definitions
- 32+ lifecycle events/hooks
- Custom tool registration
- npm distribution (`"plugin": ["package-name"]`)
- Local plugin loading (`"plugin": ["./local-plugin.ts"]`)

bGSD does not use any of these.
**Assessment:** This is a **fundamental architectural difference**, not a simple gap. bGSD's value is in its agent system prompts (commands, agents, workflows) — these are markdown files loaded as context, not JavaScript hooks. The plugin API is designed for code-level integration (event handlers, tool definitions), while bGSD operates at the prompt/instruction level.

**Could bGSD benefit from plugin hooks?**

| Hook | Potential Use | Value | Feasibility |
|------|--------------|-------|-------------|
| `session.created` | Auto-inject bGSD context, load STATE.md | Medium | High |
| `session.idle` | Auto-pause-work, write session checkpoint | Medium | Medium |
| `tool.execute.after` | Track tool usage for velocity metrics | Low | High |
| `file.edited` | Detect .planning/ edits, trigger validation | Low | Medium |
| `experimental.session.compacting` | Inject bGSD state into compaction summary | High | High |
| `chat.params` | Auto-set instructions to load bGSD workflows | Medium | High |

**Recommendation:** A **hybrid approach** is the best path forward:
1. Keep the core architecture (commands/agents/workflows as markdown)
2. Create a thin plugin (`opencode-bgsd`) that handles bootstrapping:
   - `session.created`: Auto-load STATE.md into session context
   - `experimental.session.compacting`: Ensure bGSD state survives compaction
   - `chat.params`: Auto-add bGSD instructions
3. This would enable npm installation: `"plugin": ["opencode-bgsd"]`

This is a **medium-term opportunity**, not an urgent gap. Current file-copy deployment works.

### Finding 4.2 — No custom tools registered via plugin API

**Severity:** Info
**Current state:** bGSD provides 100+ CLI operations via `gsd-tools.cjs` invoked through `bash` tool calls. OpenCode's plugin API supports registering custom tools with typed schemas.
**Assessment:** CLI invocation via bash is actually a **strength** — it works in any context, doesn't require OpenCode-specific code, and is testable independently. Custom tool registration would provide better UX (tool descriptions in OpenCode's tool list, argument validation) but would tie bGSD to OpenCode's specific plugin API.
**Recommendation:** No change. CLI-through-bash is more portable and maintainable.

---

## Area 5: Deployment & Distribution

### Finding 5.1 — Manifest-based deployment is robust ✅

**Severity:** Info (positive finding)
**Current state:** `build.js` generates `bin/manifest.json` listing all deployable files. `deploy.sh` uses manifest diff for add/update/remove tracking. Stale files from old manifests are automatically cleaned.
**Assessment:** This exceeds typical plugin deployment patterns. Most OpenCode plugins use simple file copy without tracking.

### Finding 5.2 — Backup and rollback mechanism works correctly

**Severity:** Info (positive finding)
**Current state:** `deploy.sh` creates timestamped backups before deployment (lines 20-31) and rolls back on smoke test failure (lines 128-134). This is a proper deployment safety net.
**Assessment:** Production-quality deployment with rollback.

### Finding 5.3 — Smoke test validates deployed artifact

**Severity:** Info (positive finding)
**Current state:** Both `build.js` (line 50) and `deploy.sh` (line 127) run `gsd-tools.cjs util:current-timestamp --raw` as smoke tests. Build fails if smoke test fails. Deploy rolls back if smoke test fails.
**Assessment:** Double smoke testing (build time + deploy time) is excellent practice.

### Finding 5.4 — No npm distribution path exists

**Severity:** Warning
**Current state:** `package.json` has `"private": true` and installation is via `git clone` + `deploy.sh`. OpenCode supports npm plugin installation: `"plugin": ["opencode-bgsd"]`.
**Best practice:** npm distribution provides:
- Version management with semver
- Easy installation (`npx opencode-bgsd` or config-based)
- Automatic updates
- Dependency resolution
**Recommendation:** Publishing to npm would significantly improve distribution. The path forward:
1. Create a thin npm wrapper that runs `deploy.sh` as a postinstall script
2. Or: restructure as a proper OpenCode plugin (see Finding 4.1)
3. Or: publish to npm as a CLI tool (`npx bgsd-tools deploy`)

This is blocked on the plugin API hybrid approach (Finding 4.1). Medium-term goal.

### Finding 5.5 — Source files deployed alongside built artifact

**Severity:** Warning
**Current state:** The manifest includes `src/` files (all source files are deployed to `~/.config/opencode/get-shit-done/src/`). These source files are not needed at runtime — only `bin/gsd-tools.cjs` (the bundled output) is executed.
**Best practice:** Deploy only what's needed at runtime to minimize disk footprint and avoid confusion.
**Recommendation:** In `build.js` line 220, remove the `src/` collection:
```js
// src/ — all files  ← Remove this
collectFiles('src', () => true);  ← Remove this
```
Unless there's a specific runtime need for source files (e.g., agent prompts reference them for debugging), they should not be deployed. The build output `bin/gsd-tools.cjs` is the single-file artifact. **Note:** Verify no workflow or agent references `src/` paths before removing.

---

## Strengths — What bGSD Does Well

### S1. Sophisticated Agent Architecture
Nine specialized agents with clear RACI separation, model profile system, and wave-based parallel execution. This far exceeds typical OpenCode plugins which use a single agent or no agents at all.

### S2. Session Memory and State Persistence
STATE.md, decisions, lessons, trajectory journals — bGSD maintains context across sessions in a way no other OpenCode plugin attempts. This solves one of the biggest pain points in AI-assisted development.

### S3. Manifest-Based Deployment with Rollback
The build → manifest → deploy → smoke test → rollback pipeline is more robust than most production deployment systems, let alone plugin installers.

### S4. Path Mangling Workaround
The `__OPENCODE_CONFIG__` placeholder system with `~/.config/oc` symlink is an elegant solution to the Anthropic auth plugin's text replacement issue. Well-documented for future maintainers.

### S5. CLI-First Architecture
The `gsd-tools.cjs` single-file CLI with 100+ operations is testable, debuggable, and portable. It works in any environment where Node.js runs, regardless of the host editor.

### S6. Comprehensive Test Suite
762+ tests with node:test is exceptional for a plugin. Most OpenCode plugins have zero tests.

### S7. Bundle Budget Enforcement
Build-time size tracking with a 1500KB budget, per-module analysis, and large-file warnings. This kind of build discipline is rare in any project.

### S8. Documentation Quality
README.md, docs/ directory with 12 guides, inline comments, lessons.md — documentation exceeds most standalone projects, let alone plugins.

---

## Prioritized Action Items

### Priority 1 — Critical (Fix immediately)

| # | Finding | Action | Files |
|---|---------|--------|-------|
| 1 | 1.1 Ghost command | Create `commands/bgsd-join-discord.md` or remove from AGENTS.md line 101 and README.md line 176 | `AGENTS.md`, `README.md`, optionally `commands/bgsd-join-discord.md` |
| 2 | 3.2 Singular `command/` dir | Change `deploy.sh` line 27 from `command` to `commands` | `deploy.sh` |

### Priority 2 — Warning (Fix in next maintenance cycle)

| # | Finding | Action | Files |
|---|---------|--------|-------|
| 3 | 1.3 Inconsistent `agent` frontmatter | Either add `agent:` to 3-4 more commands, or remove from `bgsd-plan-phase.md` | `commands/bgsd-plan-phase.md` or multiple command files |
| 4 | 1.7 Inline process logic | Extract inline logic from `bgsd-debug.md` and `bgsd-research-phase.md` into workflow files | `commands/bgsd-debug.md`, `commands/bgsd-research-phase.md` |
| 5 | 1.8 Structural inconsistency | Standardize `bgsd-reapply-patches.md` to use `<objective>` instead of `<purpose>` | `commands/bgsd-reapply-patches.md` |
| 6 | 2.4 No agent `model` defaults | Add commented model defaults to agent frontmatter for documentation | `agents/gsd-*.md` (9 files) |
| 7 | 2.5 `websearch` tool name | Verify `websearch` resolves in OpenCode; update to `web_search` if needed | `agents/gsd-debugger.md`, `agents/gsd-phase-researcher.md`, `agents/gsd-project-researcher.md` |
| 8 | 5.5 Source files in deploy | Remove `src/` from manifest after verifying no runtime references | `build.js` |

### Priority 3 — Info (Track for future consideration)

| # | Finding | Action |
|---|---------|--------|
| 9 | 3.1 No opencode.json | Create minimal opencode.json for dev workspace |
| 10 | 4.1 Plugin API hybrid | Design thin npm plugin for bootstrapping (session.created, compaction hooks) |
| 11 | 5.4 npm distribution | Publish to npm when plugin API hybrid is ready |
| 12 | 2.7 No temperature | Consider `temperature: 0` for deterministic agents |

---

## Methodology

This audit compared the bGSD plugin against:
1. OpenCode's official documentation (https://opencode.ai/docs/)
2. The `@opencode-ai/plugin` package API
3. Community plugin examples (`opencode-gitbutler`, `opencode-helicone-session`)
4. OpenCode's config schema and directory conventions
5. Plugin development guides from SkillMD.ai and LobeHub

Files examined: 40 command files, 9 agent files, `deploy.sh`, `build.js`, `package.json`, `README.md`, `AGENTS.md`, `lessons.md`, `VERSION`.
