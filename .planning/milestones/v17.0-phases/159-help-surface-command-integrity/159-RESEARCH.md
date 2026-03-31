# Phase 159: Help Surface & Command Integrity - Research

**Researched:** 2026-03-29
**Domain:** Canonical command help, surfaced guidance validation, and parameter-correct command examples across bGSD user-facing assets
**Confidence:** HIGH

## User Constraints

- Keep the main help surface intentionally small: lead with a compact core path, then show command families instead of a broad flat menu.
- Include `/bgsd-review` in the primary help path.
- Treat user-facing guidance as canonical-only. Legacy aliases should not appear in normal help, follow-up guidance, or examples.
- Validation must cover all user-facing surfaces: help, workflows, templates, skills, agent prompts, docs, runtime notices, and persisted next-command guidance.
- When the workflow knows the right shape, show executable commands with required arguments and flags already filled in.
- Validation failures should report grouped actionable issues by file/surface.

## Phase Requirements

| Requirement | What planning must deliver |
|---|---|
| `CMD-04` | Refresh the main help output so it teaches the reduced canonical set, separates core vs advanced, and includes `/bgsd-review`. |
| `CMD-05` | Add an auditable validation path that catches nonexistent commands, stale preferred aliases, and wrong next-step guidance in user-facing surfaces. |
| `CMD-06` | Ensure workflows, templates, skills, agents, and docs use examples with the required arguments and flags for the intended flow. |

## Summary

Phase 159 is not just a wording pass. The repo already has canonical wrappers from Phase 158, but the remaining work spans three coupled areas: the main help surface itself, a broad repo-wide command-reference audit, and a stronger validator that can prove surfaced guidance is both current and runnable. The planning boundary should assume that changing text alone is insufficient; this phase needs a durable source-of-truth plus automated enforcement.

The strongest planning input is the Phase 158 verification gap. It already names the remaining planning-prep alias drift in docs and workflows, and the new phase context expands scope beyond those files to agents, skills, templates, runtime notices, and persisted next-command artifacts. There is also evidence that command integrity problems are broader than slash aliases: `docs/commands.md` still contains old `gsd-tools` CLI examples and obsolete command groups, while `util:validate-commands` currently checks only registry/help alignment and still reports 23 namespace/format issues without scanning user-facing guidance at all.

The best implementation shape is a layered integrity system: one inventory of shipped slash-command wrappers, one inventory of supported CLI commands, one scan over user-facing surfaces, and semantic rules for flow-specific correctness (canonical-vs-legacy, required phase numbers, required flags like `--gaps-only`, and correct next-step routing for planning vs gap closure vs settings). Plan for broad fixture coverage because this phase touches many low-complexity files plus one higher-risk validator core.

**Primary recommendation:** Plan Phase 159 as three clusters: redesign `workflows/help.md`, build a repo-wide command-reference validator driven by real command inventories, and sweep/lock all surfaced examples plus persisted next-command outputs to canonical, runnable forms.

## Standard Stack

### Core
| Artifact | Role | Why standard |
|---|---|---|
| `bin/manifest.json` | Shipped slash-command inventory | It is the closest repo-wide source of truth for what wrappers are actually deployed. |
| `commands/*.md` | Slash-command contracts and alias/canonical wording | Canonical-vs-compatibility intent already lives here. |
| `workflows/*.md` | Main help, next-step guidance, and command examples | Most user-facing guidance drift currently lives here. |
| `src/lib/commandDiscovery.js` | Existing command-registry validation helper | Best starting point for extending validation beyond registry alignment. |
| `src/commands/misc.js` + `src/router.js` | `util:validate-commands` entrypoint | Existing CLI hook for an auditable validator command already exists. |
| `plugin.js` | Shipped runtime notices and bundled help text | Runtime guidance must stay aligned with source changes. |
| `.planning/phase-handoffs/*.json` | Persisted `next_command` guidance | Explicitly in scope per context; currently still stores legacy research handoffs. |

### Supporting
| Artifact | Purpose | When to use |
|---|---|---|
| `docs/commands.md` | Largest command-reference surface | Use for canonical help/reference cleanup and CLI-example auditing. |
| `agents/*.md` | Agent prompts with surfaced command examples | Use for CMD-06 and canonical-only cleanup. |
| `skills/*.md` | Shared workflow examples and Next Up patterns | Use for stale alias detection and example correctness. |
| `templates/*.md` | Generated planning/UAT/discovery examples | Use for parameter/flag correctness checks. |
| `tests/guidance-*.test.cjs` | Existing text-contract pattern | Use as the starting regression style for deterministic wording surfaces. |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|---|---|---|
| Ad hoc grep-only cleanup | Inventory-backed validator plus targeted tests | More setup, but catches future drift instead of only this pass. |
| One giant repo-wide string test | Layered validation (inventory + surface scan + semantic checks) | Slightly more implementation work, but clearer failures and lower brittleness. |
| Leaving legacy names as compatibility notes | Canonical-only surfaced guidance | Matches locked context and avoids split-brain help. |

## Architecture Patterns

### Recommended Project Structure

Keep the phase centered on these files and layers:

1. `workflows/help.md` for the visible help redesign.
2. `src/lib/commandDiscovery.js` and `src/commands/misc.js` for validation logic and CLI entrypoint.
3. Repo-wide user-facing surfaces: `docs/`, `workflows/`, `agents/`, `skills/`, `templates/`, `plugin.js`, and `.planning/phase-handoffs/`.
4. Focused regression tests in `tests/` for both validator behavior and high-risk string surfaces.

### Pattern 1: Inventory-driven command integrity

Use real inventories, not hand-maintained regex lists, for validation inputs:

- Slash-command inventory from `bin/manifest.json` and/or `commands/*.md`
- CLI inventory from router/help metadata (`src/router.js`, `src/lib/constants.js`, `src/lib/commandDiscovery.js`)
- User-facing surface scan over docs/workflows/agents/skills/templates/plugin/handoffs

This lets the validator answer three distinct questions:

1. Does the command exist?
2. Is the surfaced command canonical for this context?
3. Does the example include the required parameters/flags for the flow it describes?

### Pattern 2: Semantic validation, not only existence checks

The validator must understand common command families and flow-specific rules, for example:

- planning prep uses `/bgsd-plan discuss|research|assumptions <phase>`
- direct planning uses `/bgsd-plan phase <phase>`
- gap execution uses `/bgsd-execute-phase <phase> --gaps-only`
- settings profile switches use `/bgsd-settings profile <profile>`
- validation commands use `/bgsd-settings validate [path]`

Existence-only validation will miss the actual Phase 159 failures.

### Pattern 3: Small primary help, deeper family help

The top-level help should act like a trustable front door:

- a short primary path
- a visible split between core and advanced
- canonical-only command names
- examples that users can run immediately

Deeper command-family detail can stay in family docs or the full command reference.

### Pattern 4: Source-plus-bundle sync

Any runtime wording changes that affect `plugin.js` must rebuild the shipped bundle immediately. Phase 158 already established this expectation for canonical guidance.

### Anti-Patterns to Avoid

- Do not hardcode a second, drifting command list just for validation.
- Do not treat legacy aliases as acceptable in normal surfaced guidance; context says they should be errors.
- Do not rely only on focused string tests from prior phases; this phase needs broader surface coverage.
- Do not update help without also auditing persisted `next_command` and runtime notices.
- Do not conflate milestone-gap planning with generic planning text; validate the intended flow, not only the command token.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---|---|---|---|
| Slash-command inventory | Manual allowlist in tests | `bin/manifest.json` and `commands/*.md` | Shipped wrapper inventory already exists. |
| CLI command inventory | Regex-only command guessing | `src/router.js` + `src/lib/constants.js` + existing validator hooks | Router/help metadata already models supported commands. |
| Per-file guidance checks | One-off assertions for every file forever | Shared validator plus a few targeted regression tests | Better coverage and lower maintenance. |
| Runtime message validation | Manual eyeballing of `plugin.js` | Source edits plus rebuild plus targeted tests | Prevents source/bundle drift. |

## Current State Findings

### Help surface gaps

- `workflows/help.md` still presents a broad flat reference rather than a compact core-vs-advanced model.
- `/bgsd-review` is absent from `Quick Start`, even though the roadmap requires it in the primary path.
- `/bgsd-quick-task` still appears as a primary execution command in help.
- Help still contains compatibility mentions in primary surfaces (`/bgsd-plan-gaps`), which conflicts with the canonical-only user constraint.

### Existing validator is too narrow

- `util:validate-commands` only checks command registry/help alignment.
- It does not scan workflows, docs, agents, skills, templates, runtime notices, or persisted handoffs.
- Running it now returns 23 issues, including unknown namespaces such as `release`, `review`, `security`, `memory`, `questions`, `workflow`, and `phase:snapshot`, which means the validator itself needs repair before it can become the Phase 159 integrity gate.

### Known stale guidance surfaces already identified

- Phase 158 verification cites remaining canonicalization gaps in `docs/expert-guide.md`, `docs/troubleshooting.md`, `docs/planning-system.md`, `docs/commands.md`, `workflows/new-project.md`, `workflows/new-milestone.md`, `workflows/progress.md`, `workflows/list-phase-assumptions.md`, `workflows/discuss-phase.md`, and `workflows/research-phase.md`.
- The active handoff file `.planning/phase-handoffs/159/discuss.json` still stores `"/bgsd-research-phase 159"` as the next command.

### Additional Phase 159 scope beyond the Phase 158 blocker

- `agents/` still teaches legacy planning aliases (`bgsd-phase-researcher.md`, `bgsd-planner.md`, `bgsd-plan-checker.md`, `bgsd-roadmapper.md`, `bgsd-verifier.md`, `bgsd-codebase-mapper.md`).
- `skills/` still teaches stale examples (`skills/continuation-format/SKILL.md`, `skills/model-profiles/SKILL.md`, `skills/raci/SKILL.md`).
- `templates/` still references old planning aliases (`templates/discovery.md`, `templates/UAT.md`, `templates/research.md`, `templates/assertions.md`).
- `docs/commands.md` still contains large sections using the older `gsd-tools` binary name and obsolete command groups like `worktree`, which makes this phase partly a command-reference accuracy cleanup, not only a slash-command cleanup.

## Common Pitfalls

### Pitfall 1: Treating Phase 159 as only a help rewrite
**What goes wrong:** Help looks better, but stale next-step guidance and old examples remain elsewhere.
**Why it happens:** `workflows/help.md` is the most visible surface, so it feels like the whole phase.
**How to avoid:** Plan a separate validator + repo sweep cluster, not just help edits.
**Warning signs:** Help passes review but `phase-handoffs`, agents, or templates still point to legacy commands.

### Pitfall 2: Keeping compatibility wording in primary surfaces
**What goes wrong:** Users see both canonical and legacy routes and lose trust in which path is real.
**Why it happens:** Phase 158 often used "compatibility alias" phrasing on touched docs.
**How to avoid:** Apply the stricter Phase 159 rule: legacy mentions in user-facing guidance are validation errors.
**Warning signs:** Text like "remains a compatibility alias" survives in help or next-step blocks.

### Pitfall 3: Validating existence without validating intent
**What goes wrong:** A command exists, but it is the wrong command, missing a phase number, or missing a required flag.
**Why it happens:** Registry validators are easier than flow-aware validation.
**How to avoid:** Encode semantic rules for planning prep, gap planning, gap execution, and settings/profile flows.
**Warning signs:** Users still have to infer `<phase>` or `--gaps-only` from surrounding prose.

### Pitfall 4: Forgetting source-to-bundle synchronization
**What goes wrong:** Source markdown is fixed, but shipped runtime guidance in `plugin.js` still teaches old strings.
**Why it happens:** `plugin.js` is bundled output and easy to forget during docs-style work.
**How to avoid:** Treat plugin rebuild/test as required verification for any runtime wording change.
**Warning signs:** Source tests pass but installed runtime still shows stale next-step text.

### Pitfall 5: Extending validation to generated or archived artifacts indiscriminately
**What goes wrong:** The validator becomes noisy and blocks on historical files that are not active product surfaces.
**Why it happens:** Scope is broad and many old artifacts contain old command names.
**How to avoid:** Define active validation scope explicitly (current shipped assets + current live handoff artifacts) and keep archives advisory-only unless intentionally included.
**Warning signs:** Validation output is dominated by archived milestone or phase artifacts.

## Code Examples

Verified repo patterns to reuse:

- Existing validator hook: `src/router.js` routes `util:validate-commands` to `src/commands/misc.js#cmdValidateCommands`, which already returns structured JSON.
- Existing text-contract style: `tests/guidance-workflows.test.cjs` and `tests/guidance-remaining-surfaces.test.cjs` use deterministic file-content assertions for surfaced command wording.
- Existing persisted next-command contract: `workflows/verify-work.md` writes `VERIFY_NEXT_COMMAND` into durable handoff artifacts, so Phase 159 can validate both workflow text and stored next-command outputs.
- Existing slash-command family contract: `commands/bgsd-plan.md` explicitly defines canonical planning-family routes and compatibility shims; use it as the authoritative canonical map for planning-family guidance rules.

## State of the Art

| Old Approach | Current Approach | Impact on Phase 159 |
|---|---|---|
| Focused surface-by-surface regression tests from Phase 158 | Broader integrity gate across all user-facing surfaces | Phase 159 should preserve targeted tests, but add a shared validator so new surfaces do not escape coverage. |
| Compatibility-only wording in touched docs/help | Canonical-only surfaced guidance | Planning should assume stronger cleanup than Phase 158 allowed. |
| Registry-only command validation | Surface-aware semantic validation | Necessary to satisfy CMD-05 and CMD-06. |

## Open Questions

- Should `docs/commands.md` be fully normalized to `bgsd-tools` in this phase, or is some CLI-reference modernization deferred? Evidence suggests it belongs here because it is part of the user-facing command reference.
- Should active `.planning/phase-handoffs/*.json` be validated only for the current phase/run, or for all live handoffs under `.planning/phase-handoffs/`?
- Should command wrappers in `commands/` be exempt from the canonical-only wording rule when they intentionally document compatibility aliases, or should the validator treat wrappers as a special allowed surface?

## Assertions Coverage

`.planning/ASSERTIONS.md` does not exist, so there is currently no assertions-based coverage for `CMD-04`, `CMD-05`, or `CMD-06`.

## Project Context Notes

- Project-local `.agents/skills/` does not exist in this repo.
- The active milestone intent explicitly includes stronger help and command-reference validation under `DO-119`.

## Sources

### Primary (HIGH confidence)
- `AGENTS.md`
- `.planning/STATE.md`
- `.planning/ROADMAP.md`
- `.planning/REQUIREMENTS.md`
- `.planning/INTENT.md`
- `.planning/phases/159-help-surface-command-integrity/159-CONTEXT.md`
- `.planning/phases/158-canonical-command-families/158-VERIFICATION.md`
- `workflows/help.md`
- `workflows/discuss-phase.md`
- `workflows/research-phase.md`
- `workflows/list-phase-assumptions.md`
- `workflows/new-project.md`
- `workflows/new-milestone.md`
- `workflows/verify-work.md`
- `docs/commands.md`
- `commands/bgsd-plan.md`
- `src/lib/commandDiscovery.js`
- `src/commands/misc.js`
- `src/router.js`
- `bin/manifest.json`
- `.planning/phase-handoffs/159/discuss.json`

### Secondary (MEDIUM confidence)
- `agents/bgsd-phase-researcher.md`
- `agents/bgsd-planner.md`
- `skills/continuation-format/SKILL.md`
- `skills/model-profiles/SKILL.md`
- `templates/discovery.md`
- `templates/UAT.md`
- `tests/guidance-workflows.test.cjs`
- `tests/guidance-remaining-surfaces.test.cjs`
- `tests/contracts.test.cjs`

### Tertiary (LOW confidence)
- `node bin/bgsd-tools.cjs util:validate-commands --raw` run on 2026-03-29, used as current-behavior evidence for validator limitations and failures

## Metadata

**Confidence breakdown:** HIGH for repo-state findings and scope; MEDIUM for exact validator design details until implementation chooses the final inventory inputs; LOW only for any inference about whether archived/generated artifacts should be in the default validation scope.
**Research date:** 2026-03-29
**Valid until:** Next major command-surface or validation refactor
