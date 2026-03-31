# Greenfield Compatibility and Migration Cleanup PRD

**Project:** bGSD Plugin
**Author:** OpenCode
**Date:** 2026-03-29
**Status:** Backlog
**Target window:** Next cleanup-focused milestone after current JJ/workspace execution work

## Problem

`bgsd-oc` is now treated as a greenfield app, but the repo still carries code and docs that exist mainly to preserve backward compatibility with older installs, older planning-file shapes, older command surfaces, or older storage formats.

That compatibility layer now creates product drag:
- it keeps unsupported config and workflow models visible in templates and docs
- it preserves migration and normalization code that new projects should never need
- it increases routing, parsing, and output complexity across the CLI and plugin
- it makes dead or stale surfaces harder to distinguish from supported behavior

The result is a larger maintenance surface, more confusing repo guidance, and avoidable complexity in a codebase that no longer needs historical upgrade paths.

## Goal

Remove backward-compatibility logic, migration-only code, stale legacy docs/templates, and clearly unused compatibility-era surfaces so the repo reflects one canonical greenfield model.

The cleanup should:
- keep only the current JJ-first, workspace-first execution model
- keep only one supported config and planning-document schema
- remove upgrade helpers for legacy installs and legacy storage transitions
- simplify command routing, discovery, and output handling where compatibility shims are the only reason for extra code
- leave the repo easier to understand, test, and evolve

## Non-Goals

- Rewriting healthy core features that are still part of the current product
- Removing resilience fallbacks that protect current runtime environments rather than legacy product formats
- Performing speculative dead-code deletion without evidence from routing, tests, or usage audit
- Changing the current milestone scope or mixing this cleanup into unrelated JJ execution work

## User Need

As a maintainer of a greenfield bGSD app, I want the codebase to expose only the current supported model, so I do not have to reason about upgrade paths, legacy aliases, or stale migration behavior that no longer matters.

## Why This Belongs In Backlog Now

This work is valuable, but it is not required to finish the current milestone. It belongs in backlog because it is:
- high leverage for future development speed and maintainability
- safest when handled as a dedicated cleanup milestone with explicit validation
- best done after current JJ/workspace execution work lands so the canonical model is fully settled first

## Current State Audit

### High-confidence cleanup targets

#### 1. Migration-only commands and upgrade helpers

- `src/commands/misc.js:387` defines `cmdConfigMigrate()`, which exists to backfill older `.planning/config.json` files and create backup files.
- `src/router.js:1134` still routes `util:config-migrate`.
- `src/lib/planning-cache.js` still contains `migrateMemoryStores()` to import legacy JSON memory stores into SQLite.

These are upgrade paths, not greenfield product features.

#### 2. Legacy planning schema normalization

- `src/lib/helpers.js` contains TDD metadata normalization helpers for older roadmap/plan shapes and older callout formats.
- `src/commands/init.js` still invokes that normalization path when reading plan state.
- `src/commands/lessons.js` still special-cases migration-era lesson shapes such as `type:environment` entries created during older format transitions.

These paths exist to smooth over historical document formats that greenfield projects do not need.

#### 3. Unsupported worktree-era guidance still published

- `src/lib/config.js` rejects legacy `worktree` config usage.
- `templates/config.json` and `templates/config-full.json` still publish `worktree` settings.
- Multiple docs still describe worktree-era behavior even though the runtime is now JJ/workspace-first.

This is an especially visible form of stale compatibility debt because product guidance and runtime behavior disagree.

### Medium-confidence cleanup targets requiring validation

#### 4. CLI compatibility shims

- `src/router.js` still silently accepts compatibility no-ops such as legacy `--raw` and `--compact` handling.
- `src/lib/output.js` still supports older output call patterns.

These may still be covered by tests and external expectations, so they should be removed only after contract review.

#### 5. Legacy alias and registry debt

- `src/lib/commandDiscovery.js` contains comments and logic for backward-compatible signatures and fallback command lists.
- `src/lib/nl/command-registry.js` appears to reference obsolete or unsupported command names.

This area looks partly stale and partly compatibility-driven, so it needs a targeted audit before deletion.

#### 6. Dual-path implementations retained for parity or fallback

- Discovery and adapter layers still carry optimized-vs-legacy behavior in places where only one modern path may be needed.

These should be reviewed carefully so current runtime resilience is not confused with historical format compatibility.

## Product Decision

Adopt a greenfield-only support policy for this repository.

That policy means:
- one canonical config schema
- one canonical planning-document schema
- one canonical workspace model
- no built-in migrations for older local state
- no published legacy examples in templates or docs
- no command-surface aliases kept only for historical compatibility

When a format is no longer supported, the codebase should remove it rather than silently carrying upgrade logic forever.

## Scope

### In scope

- Remove migration-only commands and helpers
- Remove legacy config/schema normalization paths
- Remove stale worktree-era docs, templates, and references
- Audit command discovery and NL surfaces for obsolete aliases or unreachable entries
- Audit likely dead or compatibility-only tests and fixtures
- Update docs so supported behavior matches runtime exactly

### Out of scope

- Replacing all fallbacks across the repo with hard failures
- Reworking healthy runtime degradation for optional external tools
- Large architectural rewrites unrelated to compatibility cleanup

## Proposed Epics

### Epic 1: Remove legacy upgrade paths

Remove explicit migration commands and upgrade-on-read helpers that only exist for older installs.

Backlog focus:
- remove `util:config-migrate` command and routing
- remove legacy memory-store import/migration code
- delete or rewrite tests that exist only for those transitions

Done when:
- no user-facing migration command remains for old local state
- runtime no longer imports or rewrites historical storage formats
- tests reflect the current canonical store only

### Epic 2: Canonicalize planning and config schema

Remove normalization code that preserves older plan, roadmap, lesson, or config shapes.

Backlog focus:
- remove TDD metadata normalization for legacy frontmatter/callouts
- remove lesson-format migration sentinels
- remove rejected legacy config branches and legacy aliases where safe

Done when:
- planning files use one current schema only
- init/parsing paths do not rewrite old document shapes
- config loading documents and enforces one real structure

### Epic 3: Remove stale worktree-era product guidance

Delete or rewrite docs/templates that still describe removed worktree behavior.

Backlog focus:
- remove `worktree` config examples from templates
- update docs to be JJ-first and workspace-first everywhere
- audit help text and reference docs for stale compatibility wording

Done when:
- templates do not publish unsupported settings
- docs no longer contradict runtime behavior
- terminology is consistent across README, docs, templates, and workflows

### Epic 4: Simplify command/discovery surface

Remove compatibility shims and stale registries that keep old command shapes alive.

Backlog focus:
- audit `--raw`, `--compact`, and old output conventions
- prune obsolete NL registry entries and stale discovery aliases
- remove compatibility-only fallback lists where no longer needed

Done when:
- command discovery reflects only supported commands
- output contracts are explicit and current
- obsolete aliases and unreachable entries are removed

### Epic 5: Final dead-surface audit

Run a cleanup pass for tests, fixtures, and references made obsolete by the previous epics.

Backlog focus:
- remove tests that protect deleted migration paths
- remove fixtures for retired legacy formats
- run dead-code and reachability tooling again after cleanup

Done when:
- no remaining references point to removed compatibility surfaces
- the post-cleanup audit reports only supported paths

## Acceptance Criteria

- No migration-only command remains in the routed CLI surface.
- No runtime path rewrites old config, memory, lesson, plan, or roadmap formats for backward compatibility.
- Templates and docs no longer mention unsupported `worktree` configuration or other removed legacy flows.
- Command discovery and NL registries do not advertise obsolete commands.
- Test coverage is updated to validate the canonical greenfield model rather than retired upgrade behavior.
- Build and test suites pass after cleanup.

## Risks and Mitigations

### Risk: Removing a path that is still part of a live contract

Mitigation:
- separate high-confidence removals from medium-confidence candidates
- require routing/help/contract/test verification before deleting public CLI behavior

### Risk: Confusing resilience fallbacks with backward compatibility

Mitigation:
- keep runtime/tool availability fallbacks unless they exist only for retired product formats
- explicitly classify each candidate as legacy-compat, migration, resilience, or dead code before removal

### Risk: Docs drift during cleanup

Mitigation:
- treat docs/templates/help text as first-class scope, not follow-up polish

## Suggested Milestone Sequence

1. Audit and classify removal candidates
2. Remove high-confidence migration paths
3. Canonicalize planning/config schema
4. Remove stale docs/templates/help references
5. Prune medium-confidence command/discovery shims
6. Run dead-surface audit and regression validation

## Suggested Acceptance Guidance For The Milestone Planner

- Plan the work as cleanup epics, not as a single giant delete pass.
- Start with high-confidence migration and stale-doc removals before touching medium-confidence command contracts.
- Require explicit verification that each removal target is legacy-only rather than a current resilience fallback.
- Include test, build, and reachability validation in the final plan.
