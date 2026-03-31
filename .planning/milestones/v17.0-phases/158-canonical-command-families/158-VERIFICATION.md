---
phase: 158
verified_at: 2026-03-30T00:02:42Z
status: gaps_found
score: 3/4
requirements:
  - CMD-01
  - CMD-02
  - CMD-03
must_haves:
  truths:
    - "`/bgsd-quick` is the clearly recommended quick-entry path while `/bgsd-quick-task` still resolves as a compatibility alias."
    - "Planning, roadmap, todo, settings, and advanced inspection flows are available through grouped canonical command families instead of multiple sibling top-level commands."
    - "Legacy slash commands still route successfully during migration, and surfaced guidance consistently prefers the canonical grouped forms."
    - "Canonical commands and legacy aliases land on equivalent underlying behavior."
  artifacts:
    - path: commands/bgsd-quick.md
      provides: Canonical quick-entry wrapper wording and routing
    - path: commands/bgsd-plan.md
      provides: Canonical planning family contract for phase, discuss, research, assumptions, roadmap, gaps, and todo flows
    - path: commands/bgsd-inspect.md
      provides: Canonical inspect family contract
    - path: commands/bgsd-settings.md
      provides: Canonical settings family contract
    - path: src/plugin/command-enricher.js
      provides: Canonical command enrichment parity
    - path: bin/manifest.json
      provides: Shipped canonical and legacy command inventory
    - path: deploy.sh
      provides: Manifest-driven deploy wiring
    - path: install.js
      provides: Manifest-driven install wiring
    - path: docs/commands.md
      provides: Command reference for canonical and compatibility command surfaces
    - path: workflows/help.md
      provides: Canonical help surface for planning-family guidance
    - path: tests/guidance-remaining-surfaces.test.cjs
      provides: Prior focused regressions for earlier Phase 158 closure surfaces
    - path: tests/guidance-docs-phase-158-gap.test.cjs
      provides: Focused regressions for Plan 14 documentation surfaces
    - path: tests/guidance-workflows-phase-158-gap.test.cjs
      provides: Focused regressions for Plan 15 workflow surfaces
  key_links:
    - from: commands/bgsd-quick.md
      to: commands/bgsd-quick-task.md
      via: quick workflow parity through workflows/quick.md
    - from: commands/bgsd-plan-phase.md
      to: commands/bgsd-plan.md
      via: legacy planning alias routed to canonical planning family
    - from: commands/bgsd-plan-gaps.md
      to: commands/bgsd-plan.md
      via: legacy gap planning alias routed to canonical planning family
    - from: commands/bgsd-set-profile.md
      to: commands/bgsd-settings.md
      via: legacy settings alias routed to canonical settings family
    - from: commands/bgsd-velocity.md
      to: commands/bgsd-inspect.md
      via: legacy inspect alias routed to canonical inspect family
    - from: bin/manifest.json
      to: deploy.sh
      via: manifest-backed command deployment
    - from: bin/manifest.json
      to: install.js
      via: manifest-backed command installation
gaps:
  - id: GAP-158-01
    truth: "Legacy slash commands still route successfully during migration, and surfaced guidance consistently prefers the canonical grouped forms."
    severity: blocker
    reason: "Plans 14 and 15 closed the previously cited `/bgsd-plan phase`, `/bgsd-plan gaps`, and `/bgsd-settings profile` evidence slices, but the broader planning-family migration is still incomplete. Multiple shipped docs and workflows still present legacy planning-prep aliases (`/bgsd-discuss-phase`, `/bgsd-research-phase`, `/bgsd-list-assumptions`) as primary user guidance instead of the canonical `/bgsd-plan discuss|research|assumptions` forms."
    evidence:
      - "docs/expert-guide.md:103,120,135 still teach `/bgsd-list-assumptions 1`, `/bgsd-discuss-phase 1`, and `/bgsd-research-phase 1` as the primary planning-prep commands."
      - "docs/troubleshooting.md:37-39 still recommends `/bgsd-discuss-phase` and `/bgsd-list-assumptions` before planning."
      - "docs/planning-system.md:158-159 still labels CONTEXT.md and RESEARCH.md as coming from `/bgsd-discuss-phase` and `/bgsd-research-phase`."
      - "docs/commands.md:51-87 still documents `/bgsd-discuss-phase` and `/bgsd-research-phase` as standalone top-level entries without compatibility-only wording, even though line 49 declares `/bgsd-plan discuss|research|assumptions` as the preferred canonical routes."
      - "workflows/new-project.md:142, new-milestone.md:267-292, and progress.md:197-205,270-277 still send users first to `/bgsd-discuss-phase` or `/bgsd-list-assumptions` instead of the canonical planning-family subcommands."
      - "workflows/list-phase-assumptions.md:156 still offers `/bgsd-discuss-phase ${PHASE}`, discuss-phase.md:351-357 still records `/bgsd-research-phase ${PHASE}` as the handoff next-command, and research-phase.md:23-24 still advertises `Usage: /bgsd-research-phase <phase-number>`."
    missing:
      - "Finish canonicalizing the remaining planning-prep guidance so user-facing docs and workflows prefer `/bgsd-plan discuss`, `/bgsd-plan research`, and `/bgsd-plan assumptions`, while keeping `/bgsd-discuss-phase`, `/bgsd-research-phase`, and `/bgsd-list-assumptions` compatibility-only."
      - "Add regression coverage for the remaining planning-prep alias surfaces so future re-verification is not limited to the already-fixed `/bgsd-plan phase|gaps` and settings slices."
---

# Phase 158 Verification

## Goal Achievement

Goal: Users can drive bGSD through a smaller canonical command set while existing entrypoints continue to work during migration.

| Observable truth | Status | Evidence |
|---|---|---|
| `/bgsd-quick` is the recommended quick entry and `/bgsd-quick-task` remains a compatibility alias | ✓ VERIFIED | `commands/bgsd-quick.md:2-20` marks the canonical quick path; `commands/bgsd-quick-task.md:2-20` keeps the same workflow as compatibility-only |
| Planning, roadmap, todo, settings, and advanced inspection flows are available through grouped canonical families | ✓ VERIFIED | `commands/bgsd-plan.md:24-65`, `commands/bgsd-inspect.md:16-56`, and `commands/bgsd-settings.md:18-35` define the grouped families; `bin/manifest.json:40-63` still ships canonical wrappers alongside aliases |
| Legacy commands still route successfully and surfaced guidance consistently prefers canonical grouped forms | ✗ FAILED | Plan 14 and 15 surfaces now pass (`docs/architecture.md:55`, `docs/planning-system.md:225`, `docs/agents.md:28,130,149`, `docs/configuration.md:10-12`, `docs/troubleshooting.md:47`, `workflows/transition.md:184-185`, `workflows/insert-phase.md:93,111`, `workflows/plan-milestone-gaps.md:167`, `workflows/resume-project.md:114-116`, `workflows/debug.md:89-94`, `workflows/audit-milestone.md:97-101`, `workflows/add-phase.md:83-89`) and the focused regressions pass, but broader planning-family guidance still prefers legacy `/bgsd-discuss-phase`, `/bgsd-research-phase`, and `/bgsd-list-assumptions` on `docs/expert-guide.md:103,120,135`, `docs/troubleshooting.md:37-39`, `docs/planning-system.md:158-159`, `docs/commands.md:51-87`, `workflows/new-project.md:142`, `workflows/new-milestone.md:267-292`, `workflows/progress.md:197-205,270-277`, `workflows/list-phase-assumptions.md:156`, `workflows/discuss-phase.md:351-357`, and `workflows/research-phase.md:23-24` |
| Canonical commands and legacy aliases land on equivalent underlying behavior | ✓ VERIFIED | `commands/bgsd-plan-phase.md:3-20`, `commands/bgsd-plan-gaps.md:3-20`, `commands/bgsd-set-profile.md:4-21`, and `commands/bgsd-velocity.md:4-21` explicitly route to the canonical families |

## Required Artifacts

| Artifact | Exists | Substantive | Wired | Evidence |
|---|---|---|---|---|
| `commands/bgsd-quick.md` | ✓ | ✓ | ✓ | Canonical quick command is explicit and points at `workflows/quick.md` (`commands/bgsd-quick.md:4-20`) |
| `commands/bgsd-plan.md` | ✓ | ✓ | ✓ | Canonical planning umbrella covers `phase`, `discuss`, `research`, `assumptions`, `roadmap`, `gaps`, and `todo` routes (`commands/bgsd-plan.md:24-65`) |
| `commands/bgsd-inspect.md` | ✓ | ✓ | ✓ | Canonical inspect family normalizes read-only diagnostics (`commands/bgsd-inspect.md:16-56`) |
| `commands/bgsd-settings.md` | ✓ | ✓ | ✓ | Canonical settings family normalizes `profile` and `validate` (`commands/bgsd-settings.md:18-35`) |
| `bin/manifest.json` | ✓ | ✓ | ✓ | Manifest still ships canonical families and compatibility aliases together (`bin/manifest.json:40-63`) |
| `docs/architecture.md` | ✓ | ✓ | ✓ | Plan 14 doc surface now uses canonical `/bgsd-plan phase` in the data-flow walkthrough (`docs/architecture.md:52-69`) |
| `docs/expert-guide.md` | ✓ | ✓ | PARTIAL | Plan 14 gap examples for `/bgsd-plan phase|gaps` were fixed, but the file still teaches legacy planning-prep aliases on other surfaces (`docs/expert-guide.md:103,120,135`) |
| `workflows/transition.md` | ✓ | ✓ | ✓ | Plan 15 next-step routing now uses canonical `/bgsd-plan discuss` and `/bgsd-plan phase` (`workflows/transition.md:183-185`) |
| `workflows/list-phase-assumptions.md` | ✓ | ✓ | PARTIAL | File exists and the planning next step is canonical, but its discuss next step still names the legacy alias (`workflows/list-phase-assumptions.md:156-157`) |
| `tests/guidance-docs-phase-158-gap.test.cjs` | ✓ | ✓ | ✓ | Plan 14 focused regression exists and passed in verification |
| `tests/guidance-workflows-phase-158-gap.test.cjs` | ✓ | ✓ | ✓ | Plan 15 focused regression exists and passed in verification |
| `tests/guidance-remaining-surfaces.test.cjs` | ✓ | ✓ | ✓ | Prior focused regression exists and passed in verification |

## Key Link Verification

| From | To | Status | Evidence |
|---|---|---|---|
| `commands/bgsd-quick.md` | `commands/bgsd-quick-task.md` | WIRED | Both point to `workflows/quick.md` with canonical vs compatibility-only wording (`commands/bgsd-quick.md:8-20`; `commands/bgsd-quick-task.md:8-20`) |
| `commands/bgsd-plan-phase.md` | `commands/bgsd-plan.md` | WIRED | Alias explicitly translates to `/bgsd-plan phase $ARGUMENTS` (`commands/bgsd-plan-phase.md:15-20`) |
| `commands/bgsd-plan-gaps.md` | `commands/bgsd-plan.md` | WIRED | Alias explicitly translates to `/bgsd-plan gaps $ARGUMENTS` (`commands/bgsd-plan-gaps.md:15-20`) |
| `commands/bgsd-set-profile.md` | `commands/bgsd-settings.md` | WIRED | Alias explicitly translates to `/bgsd-settings profile $ARGUMENTS` (`commands/bgsd-set-profile.md:16-21`) |
| `commands/bgsd-velocity.md` | `commands/bgsd-inspect.md` | WIRED | Velocity alias remains compatibility-only for the canonical inspect family (`commands/bgsd-velocity.md:16-21`; `commands/bgsd-inspect.md:33-45`) |
| `bin/manifest.json` | `deploy.sh` | WIRED | Deployment still installs both canonical and compatibility wrappers from the manifest (`bin/manifest.json:40-63`) |
| `bin/manifest.json` | `install.js` | WIRED | Installer still ships both canonical and compatibility wrappers from the manifest (`bin/manifest.json:40-63`) |

## Requirements Coverage

| Requirement | In phase/plan frontmatter | Requirement text present | Verified status | Evidence |
|---|---|---|---|---|
| CMD-01 | ✓ | ✓ | ✓ VERIFIED | `REQUIREMENTS.md:35`; quick canonical/alias contract remains intact in `commands/bgsd-quick.md:2-20` and `commands/bgsd-quick-task.md:2-20` |
| CMD-02 | ✓ | ✓ | △ PARTIAL | `REQUIREMENTS.md:37`; canonical grouped families exist, but some still-shipped docs/workflows continue to steer users through legacy planning-prep siblings instead of `/bgsd-plan discuss|research|assumptions` |
| CMD-03 | ✓ | ✓ | ✗ NOT FULLY VERIFIED | `REQUIREMENTS.md:39`; alias routing still works, but guidance is not consistently canonical-first because legacy planning-prep aliases remain primary on multiple shipped surfaces |

Plan frontmatter cross-check: all Phase 158 plans reference only `CMD-01`, `CMD-02`, and/or `CMD-03` (`158-01-PLAN.md:18`, `158-02-PLAN.md:17`, `158-03-PLAN.md:17`, `158-04-PLAN.md:16`, `158-05-PLAN.md:18`, `158-06-PLAN.md:12`, `158-07-PLAN.md:16`, `158-08-PLAN.md:12`, `158-09-PLAN.md:12`, `158-10-PLAN.md:12`, `158-11-PLAN.md:12`, `158-12-PLAN.md:9`, `158-13-PLAN.md:18`, `158-14-PLAN.md:16`, `158-15-PLAN.md:18`). Those IDs all exist in `REQUIREMENTS.md:35-39`. No orphaned requirement IDs found.

## Anti-Patterns Found

| Severity | Finding | Evidence |
|---|---|---|
| 🛑 Blocker | Canonical-first migration is still incomplete for planning-prep aliases, so users are not yet consistently steered through the reduced canonical command set across shipped docs and workflows | `docs/expert-guide.md:103,120,135`, `docs/troubleshooting.md:37-39`, `docs/planning-system.md:158-159`, `docs/commands.md:51-87`, `workflows/new-project.md:142`, `workflows/new-milestone.md:267-292`, `workflows/progress.md:197-205,270-277`, `workflows/list-phase-assumptions.md:156`, `workflows/discuss-phase.md:351-357`, `workflows/research-phase.md:23-24` |
| ℹ️ Info | The previously cited Plan 14 and Plan 15 evidence surfaces are now canonical-first and their focused regressions pass | `npm run test:file -- tests/guidance-docs-phase-158-gap.test.cjs`; `npm run test:file -- tests/guidance-workflows-phase-158-gap.test.cjs` |
| ℹ️ Info | Earlier focused regression coverage also still passes on the prior closure slice | `npm run test:file -- tests/guidance-remaining-surfaces.test.cjs` |

## Human Verification Required

| Item | Why human |
|---|---|
| In-editor slash-command discoverability/autocomplete | Static verification confirms files, routing, and shipped strings, but a human must confirm how canonical vs alias commands are surfaced in editor UX |

## Gaps Summary

Re-verification confirms that Plans 14 and 15 closed the exact doc and workflow slices cited in the previous report: the touched architecture, operational docs, workflow next steps, and their focused regressions are now canonical-first, and the earlier focused regression suite still passes. However, the phase goal is broader than those slices. The planning-family migration is still incomplete on other shipped surfaces that continue to present `/bgsd-discuss-phase`, `/bgsd-research-phase`, and `/bgsd-list-assumptions` as primary user guidance rather than compatibility aliases behind canonical `/bgsd-plan discuss|research|assumptions`. Because users are still not consistently guided through the smaller canonical command set, Phase 158 cannot yet be marked achieved.

## Verification Evidence

- Passed targeted regressions: `npm run test:file -- tests/guidance-docs-phase-158-gap.test.cjs`, `npm run test:file -- tests/guidance-workflows-phase-158-gap.test.cjs`, `npm run test:file -- tests/guidance-remaining-surfaces.test.cjs`
- Canonical families and compatibility aliases are still shipped together in `bin/manifest.json:40-63`
- Remaining blocker evidence is outside the focused Plan 14/15 slices and lives on still-shipped planning-prep guidance surfaces in docs and workflows listed above
