---
phase: 159
verified_at: 2026-03-30T04:41:28Z
status: passed
score:
  verified: 4
  total: 4
requirements_checked:
  - CMD-04
  - CMD-05
  - CMD-06
must_haves:
  truths:
    - The main help surface clearly separates core vs advanced commands and includes /bgsd-review in the primary path.
    - Automated command-reference validation catches nonexistent commands, stale preferred aliases, and incorrect next-step guidance in user-facing surfaces.
    - Workflow, template, skill, agent, and doc examples include the arguments and flags required for the intended flow.
    - Users following surfaced guidance for planning, gap closure, settings, and execution do not have to guess missing parameters to reach the right path.
---

# Phase 159 Verification

## Goal Achievement

Goal: Users can trust bGSD help and next-step guidance to be smaller, current, and executable exactly as written.

Re-verification mode: prior `159-VERIFICATION.md` had blockers. This pass re-checked the failed truths fully against the current codebase and sanity-checked previously passed truths for regression.

| Observable truth | Status | Evidence |
|---|---|---|
| Main help separates core vs advanced paths and includes `/bgsd-review` in the primary path | ✓ VERIFIED | `workflows/help.md:10-19` presents a compact Core Path with `/bgsd-review`; `workflows/help.md:20-63` separates advanced command families from the core path. |
| Automated validation catches nonexistent commands, stale aliases, and wrong next-step guidance | ✓ VERIFIED | `src/lib/commandDiscovery.js:1203-1237` implements `validateCommandIntegrity()` over collected surfaced files; `src/commands/misc.js:2272-2305` exposes `cmdValidateCommands()`; `src/router.js:1008-1009` wires `util:validate-commands`; `tests/validate-commands.test.cjs:37-309` passes; direct repo scan via `node -e "...validateCommandIntegrity..."` returned `issueCount: 0`. |
| Workflow/template/skill/agent/doc examples include required args and flags for intended flows | ✓ VERIFIED | Gap-closure regression slices all pass: `tests/guidance-command-integrity-workflow-prep-a.test.cjs`, `...-b.test.cjs`, `...-c.test.cjs`, `...-d.test.cjs`, `tests/guidance-command-integrity-runtime-tail.test.cjs`, and `tests/guidance-command-integrity-skill-tail.test.cjs`. The tests assert canonical examples and reject the specific stale aliases/missing-argument forms previously called out. |
| Users can follow surfaced planning/gap/settings/execution guidance without guessing parameters | ✓ VERIFIED | `src/plugin/tools/bgsd-context.js:38-45` now falls back to `/bgsd-inspect progress` when phase context is unavailable; workflow next-step surfaces now use concrete or explicitly reference-only forms (`workflows/add-phase.md:83-95`, `workflows/check-todos.md:26-30,55-57,123-125`, `workflows/new-project.md:140-142`, `workflows/new-milestone.md:263-271`); repo-wide command-integrity scan now reports zero surfaced issues. |

## Required Artifacts

| Artifact | Exists | Substantive | Wired | Evidence |
|---|---|---|---|---|
| `workflows/help.md` | ✓ | ✓ | ✓ | Compact help surface with explicit core path, advanced families, `/bgsd-review`, and `/bgsd-inspect progress` (`workflows/help.md:10-19,20-63,127-169`). |
| `src/lib/commandDiscovery.js` | ✓ | ✓ | ✓ | Real validator implementation iterates extracted mentions across surfaced files and groups semantic issues (`src/lib/commandDiscovery.js:1203-1237`). |
| `src/commands/misc.js` + `src/router.js` | ✓ | ✓ | ✓ | CLI entrypoint and router wiring expose `util:validate-commands` for repo-wide auditing (`src/commands/misc.js:2272-2305`, `src/router.js:1008-1009`). |
| Plan 14 workflow slice: `workflows/add-phase.md`, `workflows/add-todo.md`, `tests/guidance-command-integrity-workflow-prep-a.test.cjs` | ✓ | ✓ | ✓ | Canonical roadmap/todo commands are surfaced and stale aliases are excluded; direct-file regression reads shipped files and passes (`workflows/add-phase.md:14-22,83-95`; `workflows/add-todo.md:27-29,133-138`; `tests/guidance-command-integrity-workflow-prep-a.test.cjs:17-50`). |
| Plan 15 workflow slice: `workflows/discuss-phase.md`, `tests/guidance-command-integrity-workflow-prep-b.test.cjs` | ✓ | ✓ | ✓ | Discuss/progress guidance uses canonical forms and keeps bare discuss forms reference-only; regression passes (`workflows/discuss-phase.md:53-67`; `tests/guidance-command-integrity-workflow-prep-b.test.cjs:17-40`). |
| Plan 16 workflow slice: `workflows/check-todos.md`, `workflows/new-project.md`, `tests/guidance-command-integrity-workflow-prep-c.test.cjs` | ✓ | ✓ | ✓ | Todo/project guidance uses canonical inspect and planning-family routes; regression passes (`workflows/check-todos.md:22-30,55-57,123-125`; `workflows/new-project.md:22,140-142`; `tests/guidance-command-integrity-workflow-prep-c.test.cjs:17-50`). |
| Plan 17 workflow slice: `workflows/new-milestone.md`, `tests/guidance-command-integrity-workflow-prep-d.test.cjs` | ✓ | ✓ | ✓ | Milestone guidance uses canonical planning-family commands and explicit reference-only wording for `MILESTONE-CONTEXT.md`; regression passes (`workflows/new-milestone.md:19,263-271`; `tests/guidance-command-integrity-workflow-prep-d.test.cjs:17-38`). |
| Plan 18 runtime slice: `src/plugin/tools/bgsd-context.js`, `src/plugin/context-builder.js`, `src/plugin/command-enricher.js`, `src/plugin/tools/bgsd-plan.js`, `src/plugin/notification.js`, `plugin.js`, `tests/guidance-command-integrity-runtime-tail.test.cjs` | ✓ | ✓ | ✓ | Runtime messaging now routes unknown-phase fallbacks through inspect, uses canonical inspect-health diagnostics, and avoids nonexistent notifications commands; shipped bundle regression passes (`src/plugin/tools/bgsd-context.js:38-45`, `src/plugin/context-builder.js:368-382`, `src/plugin/command-enricher.js:49-54`, `src/plugin/tools/bgsd-plan.js:40-44`, `src/plugin/notification.js:188-194`, `plugin.js:8365-8368`; `tests/guidance-command-integrity-runtime-tail.test.cjs:15-50`). |
| Plan 19 skill slice: `skills/planner-dependency-graph/SKILL.md`, `skills/skill-index/SKILL.md`, `tests/guidance-command-integrity-skill-tail.test.cjs` | ✓ | ✓ | ✓ | Skill examples now use valid `bgsd-tools verify:verify plan-wave` and `bgsd-tools plan:find-phase` naming; direct-file regression passes (`skills/planner-dependency-graph/SKILL.md:171-176`, `skills/skill-index/SKILL.md:31`; `tests/guidance-command-integrity-skill-tail.test.cjs:17-41`). |
| Plan 20 validator boundary: `src/lib/commandDiscovery.js`, `tests/validate-commands.test.cjs` | ✓ | ✓ | ✓ | Contract tests prove the boundary between allowed reference-only text and rejected runnable guidance mistakes; repo-wide validator now returns zero issues (`tests/validate-commands.test.cjs:78-129,147-260,262-309`). |

## Key Link Verification

| Link | Status | Evidence |
|---|---|---|
| Help surface → canonical review/progress path | ✓ WIRED | `workflows/help.md:14-18,129-169`. |
| Validator core → CLI entrypoint | ✓ WIRED | `src/commands/misc.js:2272-2305` calls `validateCommandIntegrity()`. |
| Router → validator command | ✓ WIRED | `src/router.js:1008-1009`. |
| Plans 14-17 workflow files → direct-file regressions | ✓ WIRED | Each regression test reads shipped workflow files directly and passed during verification. |
| Plan 18 runtime sources → shipped `plugin.js` bundle | ✓ WIRED | Runtime-tail regression checks both source files and built `plugin.js`, and passed (`tests/guidance-command-integrity-runtime-tail.test.cjs:15-50`). |
| Plan 19 skill files → direct-file skill regression | ✓ WIRED | `tests/guidance-command-integrity-skill-tail.test.cjs:28-41`. |
| Plan 20 validator boundary → repo-wide final gate | ✓ WIRED | `tests/validate-commands.test.cjs:262-309` and direct `validateCommandIntegrity({ cwd })` summary showed zero issues across surfaced files. |

## Requirements Coverage

| Requirement | Coverage | Status | Evidence |
|---|---|---|---|
| CMD-04 | Core help surface refresh | ✓ Achieved | `workflows/help.md:10-19,20-63` delivers the smaller help surface with `/bgsd-review` in the core path. |
| CMD-05 | Command reference integrity audit | ✓ Achieved | Validator implementation, CLI/router wiring, contract tests, and repo-wide zero-issue scan are all present (`src/lib/commandDiscovery.js:1203-1237`, `src/commands/misc.js:2272-2305`, `src/router.js:1008-1009`, `tests/validate-commands.test.cjs:37-309`). |
| CMD-06 | Parameter-correct next steps | ✓ Achieved | Workflow, runtime, and skill gap-closure slices from Plans 14-20 all now pass direct-file regression and validator checks. |

Plan frontmatter cross-check: all 20 Phase 159 plan files declare only `CMD-04`, `CMD-05`, and/or `CMD-06` (`*.planning/phases/159-help-surface-command-integrity/*-PLAN.md` requirement lines). Gap-closure plans `159-14` through `159-19` trace to `CMD-06`; `159-20` traces to `CMD-05` and `CMD-06`. All requested requirement IDs exist in `.planning/REQUIREMENTS.md:41-45` and map to Phase 159 in `.planning/REQUIREMENTS.md:96-98`.

## Anti-Patterns Found

| Severity | Finding | Evidence |
|---|---|---|
| ℹ️ Info | No remaining surfaced command-integrity violations were found in the repo-wide scan | Direct `validateCommandIntegrity({ cwd })` summary returned `issueCount: 0`, and `tests/validate-commands.test.cjs` passed. |
| ℹ️ Info | No placeholder/stub implementations were found in the verified help, validator, workflow, runtime, or skill slices | Reviewed artifacts are substantive files with direct regression coverage; failures from the prior verification were content-integrity issues and are now closed. |

## Human Verification Required

None blocking automated conclusion.

## Gaps Summary

This re-verification closes the blockers from the prior report.

The previously failing workflow, runtime, and skill guidance slices from Plans 14-20 are now canonicalized and protected by direct-file regressions. The validator boundary also remains broad enough to catch runnable guidance mistakes while allowing truly reference-only text. Most importantly, the repo-wide command-integrity scan now reports zero surfaced issues instead of dozens.

Phase 159 now achieves its full goal: the main help surface is smaller, current, and the surfaced next-step guidance is executable exactly as written.
