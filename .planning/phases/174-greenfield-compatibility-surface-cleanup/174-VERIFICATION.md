---
phase: 174-greenfield-compatibility-surface-cleanup
verified: 2026-04-01T00:56:43Z
status: gaps_found
score: 9/12
intent_alignment: misaligned
requirements_coverage: partial
gaps:
  - id: GAP-174-01
    severity: blocker
    requirement: CLEAN-02
    type: artifact
    summary: Plugin roadmap parsing still ships legacy TDD normalization helpers in a touched artifact.
    evidence:
      - src/plugin/parsers/roadmap.js:17
      - src/plugin/parsers/roadmap.js:29
  - id: GAP-174-02
    severity: blocker
    requirement: CLEAN-03
    type: truth
    summary: Touched NL/fallback helpers still point users toward unsupported non-routed commands, so discovery remains split-brain.
    evidence:
      - src/lib/nl/command-registry.js:11
      - src/lib/nl/command-registry.js:17
      - src/lib/nl/command-registry.js:30
      - src/lib/nl/help-fallback.js:180
      - src/lib/nl/suggestion-engine.js:22
      - src/lib/nl/conversational-planner.js:105
      - src/lib/nl/nl-parser.js:249
  - id: GAP-174-03
    severity: warning
    requirement: CLEAN-03
    type: shipped-surface
    summary: Repo-wide surfaced guidance still fails command-integrity validation against the canonical CLI, so the product docs/help surface is not fully cleaned up.
    evidence:
      - docs/commands.md:345
      - docs/workflows.md:149
      - workflows/plan-phase.md:22
      - workflows/discuss-phase.md:67
---

# Phase 174 Verification

## Intent Alignment

**Verdict:** misaligned

The core expected user change was not fully achieved. Phase 174 removed major compatibility-era surfaces, but the repo still ships touched hidden discovery mappings to unsupported commands and still contains a legacy roadmap-normalization helper in the plugin parser, so the support model is not yet a single clean greenfield surface.

## Goal Achievement

| Truth | Status | Evidence |
|---|---|---|
| `util:config-migrate` is no longer routed or advertised as a supported CLI/discovery command. | ✓ VERIFIED | `src/router.js` rejects unknown util subcommands; `tests/infra.test.cjs:344`; `tests/integration.test.cjs:400`; `node bin/bgsd-tools.cjs util:config-migrate` returns unknown-command failure. |
| Canonical config troubleshooting points users to validation/edit flows instead of a migration helper. | ✓ VERIFIED | `docs/troubleshooting.md:190-206`; `docs/expert-guide.md`; `tests/guidance-docs.test.cjs:61-67`. |
| Active memory and init flows no longer auto-import legacy JSON memory stores. | ✓ VERIFIED | `src/commands/memory.js:497-529`; `tests/memory.test.cjs:105-147`; `node bin/bgsd-tools.cjs util:memory read --store decisions --query Legacy` returns `count: 0`, `source: sql`. |
| Canonical `.planning/` roadmap/plan reads still parse and validate without rewrite-on-read normalization on active paths. | ✓ VERIFIED | `tests/init.test.cjs` targeted Phase 174 assertions passed; `tests/plugin.test.cjs` targeted `parseRoadmap` assertion passed; `src/commands/roadmap.js` reads roadmap directly. |
| Plugin roadmap parser no longer preserves hidden normalization behind the scenes. | ✗ FAILED | `src/plugin/parsers/roadmap.js:17-43` still contains `normalizeRoadmapTddMetadata()` and `readRoadmapWithTddNormalization()`. |
| Published config docs/templates teach the supported workspace-first model. | ✓ VERIFIED | `templates/config-full.json:51-54`; `docs/configuration.md:81-84`; `docs/expert-guide.md` workspace-first guidance; Phase 174 docs tests pass even though unrelated Phase 158 checks still fail. |
| Touched NL and fallback registries resolve only to supported canonical commands. | ✗ FAILED | `src/lib/nl/command-registry.js`, `src/lib/nl/help-fallback.js`, `src/lib/nl/suggestion-engine.js`, `src/lib/nl/conversational-planner.js`, and `src/lib/nl/nl-parser.js` still reference unsupported commands such as `execute:phase`, `execute:quick`, `verify:work`, `session:resume`, and `session:pause`. |
| Regression coverage protects against reintroducing removed compatibility surfaces. | ? PARTIAL | Targeted tests cover `config-migrate`, legacy memory import, worktree-era guidance, and four stale NL names, but current stale NL mappings remain outside that regression slice. |

## Required Artifacts

| Artifact | Exists | Substantive | Wired | Notes |
|---|---|---|---|---|
| `src/router.js` | ✓ | ✓ | ✓ | Artifact helper false-negative on `contains`, but routing and unknown-command behavior are present and exercised by tests. |
| `src/lib/constants.js` | ✓ | ✓ | ✓ | `COMMAND_HELP` no longer lists `util:config-migrate`. |
| `src/lib/commandDiscovery.js` | ✓ | ✓ | ✓ | Discovery inventory excludes `config-migrate`; command-integrity tests cover it. |
| `src/lib/planning-cache.js` | ✓ | ✓ | ✓ | No migration bridge remains; canonical search path is SQL-first. |
| `src/commands/memory.js` | ✓ | ✓ | ✓ | Current reads/searches stay on canonical store. |
| `src/commands/roadmap.js` | ✓ | ✓ | ✓ | Reads roadmap directly without rewrite helper. |
| `src/plugin/parsers/roadmap.js` | ✓ | ✗ | PARTIAL | Active parse path works, but dead compatibility normalization helpers still ship in the touched file. |
| `templates/config-full.json` | ✓ | ✓ | ✓ | Uses `workspace`, not `worktree`. |
| `docs/configuration.md` | ✓ | ✓ | ✓ | Workspace-first settings documented. |
| `src/lib/nl/command-registry.js` | ✓ | ✗ | ✓ | File is wired, but substantive content still includes unsupported command mappings. |
| `src/lib/nl/help-fallback.js` | ✓ | ✗ | ✓ | Fallback suggestions still advertise unsupported commands. |
| `tests/validate-commands.test.cjs` | ✓ | ✓ | ✓ | Covers targeted stale names only; misses other unsupported NL mappings. |

## Key Link Verification

| Link | Status | Evidence |
|---|---|---|
| `tests/infra.test.cjs` → `src/router.js` | WIRED | Helper verified pattern; test asserts unknown-command failure for `util:config-migrate`. |
| `tests/validate-commands.test.cjs` → `src/lib/commandDiscovery.js` | WIRED | Helper verified pattern; inventory assertions cover `config-migrate` removal. |
| `tests/memory.test.cjs` → `src/lib/planning-cache.js` | WIRED | Manual verification: tests at `105-147` exercise SQL-backed reads/searches; `src/lib/planning-cache.js:530-603` implements search path. |
| `tests/init.test.cjs` → `src/commands/init.js` | WIRED | Manual verification from passing targeted test `init memory leaves legacy JSON memory stores inactive...`. |
| `tests/init.test.cjs` → `src/lib/helpers.js` | WIRED | Helper verified pattern for canonical roadmap/plan metadata behavior. |
| `tests/plugin.test.cjs` → `src/plugin/parsers/roadmap.js` | WIRED | Helper verified pattern and passing targeted `parseRoadmap` assertion. |
| `tests/guidance-docs.test.cjs` → `docs/configuration.md` | WIRED | Helper verified pattern; workspace-first doc assertions pass. |
| `tests/guidance-docs.test.cjs` → `templates/config-full.json` | WIRED | Helper verified pattern; template assertions pass. |
| `tests/validate-commands.test.cjs` → `src/lib/nl/command-registry.js` | PARTIAL | Tests verify only the removed names from the plan; current file still maps other unsupported commands. |
| `tests/validate-commands.test.cjs` → `src/lib/nl/help-fallback.js` | PARTIAL | Tests verify targeted replacements, but fallback content still contains unsupported commands outside the tested set. |

## Requirement Coverage

| Requirement | Verdict | Evidence |
|---|---|---|
| CLEAN-01 | covered | `util:config-migrate` removed; legacy memory auto-import removed from active paths. |
| CLEAN-02 | partial | Canonical planning artifacts parse/validate, but `src/plugin/parsers/roadmap.js` still ships legacy normalization helpers. |
| CLEAN-03 | partial | Workspace-first docs/template slice is aligned, but touched NL/fallback surfaces still advertise unsupported commands and repo-wide surfaced guidance still has stale command-integrity failures. |

**Overall requirement coverage verdict:** partial

## Anti-Patterns Found

| Severity | Finding | Evidence |
|---|---|---|
| 🛑 Blocker | Dead compatibility helper still ships in touched plugin roadmap parser. | `src/plugin/parsers/roadmap.js:17-43` |
| 🛑 Blocker | Hidden discovery still maps to unsupported commands in touched NL files. | `src/lib/nl/command-registry.js:11-45`; `src/lib/nl/help-fallback.js:180-191`; `src/lib/nl/suggestion-engine.js:22-35`; `src/lib/nl/conversational-planner.js:103-107`; `src/lib/nl/nl-parser.js:245-256` |
| ⚠️ Warning | Bundled verifier helper crashed during `verify:key-links` because `writeDebugDiagnostic` is undefined in the runtime path. | `bin/bgsd-tools.cjs` crash during helper execution; source call site `src/lib/helpers.js:82` |
| ℹ️ Info | Broad docs and plugin suites still contain unrelated baseline failures/hangs; touched-slice proofs were separated from those baselines. | `tests/guidance-docs.test.cjs` Phase 158 failures; `tests/plugin.test.cjs` timeout after relevant Phase 174 assertions passed. |

## Human Verification Required

None for this phase. The blocking issues are code-surface and verification-tooling problems that are directly observable in the repository.

## Gaps Summary

Phase 174 made substantial progress: the config migration command is gone, legacy memory auto-import is gone, canonical planning reads work without rewrite-on-read on active paths, and the workspace-first docs/template slice is aligned. However, the phase goal was not fully achieved because the repo still carries compatibility drag in touched artifacts: the plugin roadmap parser still ships dead normalization helpers, and the touched NL/fallback stack still routes to unsupported commands that keep the support model split-brain. Repo-wide command-integrity failures in surfaced docs/workflows reinforce that the canonical greenfield support model is not yet consistently reflected across shipped guidance.
