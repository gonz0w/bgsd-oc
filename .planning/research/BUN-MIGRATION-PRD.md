# Bun-First Migration PRD

## Overview

This document defines a future milestone to move `bgsd-oc` from a Node/npm-centered development and distribution model to a Bun-first model where Bun is the primary runtime, package manager, script runner, and developer workflow entrypoint.

This is a planning artifact only. No implementation is included here.

## Problem

The plugin currently mixes several runtime assumptions:

- Development commands are npm/Node-first in `package.json`, `README.md`, `build.cjs`, `install.js`, and `deploy.sh`.
- The CLI bundle is built specifically for Node CommonJS in `build.cjs`.
- The plugin bundle is ESM, but still depends on Node-oriented build assumptions.
- Tests are written around `node:test` and invoked with `node --test`.
- The data layer depends on `node:sqlite`, which ties important behavior to modern Node.
- Bun support exists today mostly as detection, benchmarking, and graceful fallback logic rather than as the canonical runtime path.

This creates friction in four places:

1. The project cannot honestly claim Bun as the primary runtime.
2. The install/build/test/deploy story is split across Node, npm, and partial Bun support.
3. The runtime support matrix is unclear because `package.json`, `README.md`, and SQLite assumptions disagree.
4. A future "full Bun plugin" milestone is too risky without a structured plan and explicit go/no-go checks.

## Goal

Define and eventually deliver a Bun-first plugin where:

- Bun is the default local development workflow.
- Bun is the default script runner for build, test, and audit tasks when feasible.
- Bun is the default package manager and lockfile authority.
- The CLI and plugin have a documented, validated runtime strategy under Bun.
- Distribution and installation flows are consistent with the Bun-first story.
- Any remaining Node dependency is explicit, justified, and covered by fallback policy.

## Non-Goals

- Rewriting the codebase to TypeScript.
- Replacing esbuild unless Bun makes that clearly necessary.
- Removing all Node compatibility if Node remains useful as a fallback runtime.
- Changing plugin product scope, feature set, or editor integration behavior.
- Implementing the migration in this round.

## Primary Decision to Resolve

Before planning implementation, the milestone must decide which of these target states is actually desired:

### Option A: Bun-first, Node-compatible

Bun becomes the primary dev and runtime path, while Node remains a supported fallback for compatibility and distribution.

### Option B: Bun-only for development, mixed runtime in production

Developers use Bun for install/build/test, but shipped artifacts may still target Node in selected areas.

### Option C: Full Bun runtime replacement

Both the dev workflow and shipped runtime behavior are treated as Bun-primary, with Node reduced to legacy support or removed.

Current evidence suggests Option A is the safest likely target for the first milestone unless the `node:sqlite` story proves clean under Bun.

## Current State Summary

### Tooling and packaging

- `package.json` uses Node and npm script conventions throughout.
- `package-lock.json` is the active root lockfile.
- `install.js` is the npm package entrypoint via `npx bgsd-oc`.
- `deploy.sh` bootstraps dependencies with `npm ci` or `npm install`.

### Build system

- `build.cjs` runs under Node CommonJS.
- The CLI is bundled as `bin/bgsd-tools.cjs` with `format: 'cjs'`, `platform: 'node'`, and `target: 'node18'`.
- The plugin is bundled separately as ESM into `plugin.js`.
- Build smoke tests execute the CLI with `node` explicitly.

### Tests

- `package.json` uses `node --test` for all top-level test scripts.
- `tests/*.test.cjs` use `node:test` and CommonJS helpers.
- `tests/helpers.cjs` shells out with `node ".../bin/bgsd-tools.cjs"` directly.

### Runtime assumptions

- `src/lib/db.js` and `src/plugin/lib/db-cache.js` rely on `node:sqlite`.
- `src/lib/runtime-capabilities.js` contains Node/V8 compile-cache logic.
- `src/package.json` forces `src/` to CommonJS.
- Bun support exists in `src/lib/cli-tools/bun-runtime.js` and `src/commands/runtime.js`, but that support is advisory rather than canonical.

### Version and support ambiguity

- `package.json` declares Node `>=18`.
- `README.md` requires Node `>=22.5`.
- SQLite documentation and code behavior effectively assume Node `22.5+` for full capability.
- `build.cjs` still targets `node18`.

## User Personas Affected

- Maintainers developing the plugin locally.
- Contributors installing dependencies and running tests.
- Users installing the plugin from a package command such as `npx` or a future `bunx` path.
- OpenCode runtime environments loading `plugin.js`.

## Desired Outcomes

### Developer experience

- A new contributor can clone the repo and use one primary command set based on Bun.
- Build, test, deploy, and audit commands follow one documented workflow.
- Lockfile, package manager, and runtime expectations are unambiguous.

### Runtime behavior

- The CLI executes correctly under the chosen Bun strategy.
- The plugin entrypoint behaves correctly under the chosen Bun strategy.
- Data-layer behavior is preserved or explicitly degraded with documented tradeoffs.

### Distribution

- Installer and packaging flow match the chosen Bun-first position.
- Smoke tests validate the actual supported install path.
- Documentation no longer advertises contradictory requirements.

## Functional Requirements

### FR1: Bun-first command surface

The repo must define Bun-first commands for install, build, test, and audit workflows.

### FR2: Single source of truth for runtime support

The project must publish one explicit support matrix covering:

- developer runtime
- shipped CLI runtime
- plugin runtime
- installer/distribution runtime
- test runner runtime

### FR3: Data-layer viability under target runtime

The milestone must either:

- prove required SQLite behavior works under the target Bun model, or
- define an acceptable fallback architecture with explicit tradeoffs.

### FR4: Build parity

The Bun-first build path must produce functionally equivalent deployable artifacts for:

- `bin/bgsd-tools.cjs` or its replacement
- `plugin.js`
- `bin/manifest.json`

### FR5: Test parity

The project must define whether the canonical test runner stays Node-based or moves to Bun, and the choice must be verified with at least a representative compatibility matrix.

### FR6: Install parity

The project must define the canonical end-user install command and verify it against the built artifact.

### FR7: Documentation parity

README, architecture docs, and development docs must reflect the same Bun-first story.

## Success Criteria

The milestone is successful when all of the following are true:

1. The repo has one canonical Bun-first developer workflow.
2. The runtime support matrix is documented without contradictions.
3. Build and smoke-test flows validate the actual supported runtime path.
4. Data-layer behavior under Bun has a clear pass/fail decision.
5. Test strategy is explicit, repeatable, and CI-ready.
6. Install/distribution guidance matches reality.
7. Remaining Node dependencies, if any, are intentional and documented.

## Constraints

- Preserve backward compatibility where practical for existing users.
- Avoid breaking the current single-file CLI deployment story unless there is a strong replacement.
- Avoid destabilizing OpenCode plugin loading behavior.
- Respect the project's zero-dependency bias for shipped runtime artifacts.
- Do not assume Bun parity for Node built-ins without direct validation.

## Risks

### High risk

- `node:sqlite` may be incomplete or behaviorally different under Bun.
- The current CJS CLI plus ESM plugin split may become harder, not easier, during migration.
- Installer and package publishing may still be npm-centric even if local dev switches to Bun.

### Medium risk

- Bun test compatibility may not cover the current `node:test` suite cleanly.
- Build scripts may run under Bun but still encode Node-only assumptions.
- Smoke tests may pass locally while OpenCode plugin loading still differs in practice.

### Low risk

- Documentation and command renaming work.
- Lockfile migration itself.

## Open Questions for Dedicated Research

These should be left to the later milestone researcher rather than prematurely answered here:

1. Does Bun fully support the `node:sqlite` features used in `src/lib/db.js` and `src/plugin/lib/db-cache.js`?
2. Should the CLI remain bundled as CommonJS, move to ESM, or keep dual compatibility?
3. Should esbuild remain the bundler, or should Bun build tooling replace only the runner layer?
4. Should package distribution remain npm-first with `npx`, switch to `bunx`, or support both equally?
5. Should tests remain on `node:test`, move to Bun test, or run as a mixed matrix?
6. What exact OpenCode plugin runtime guarantees exist when loading `plugin.js`?
7. What is the minimum acceptable fallback if Bun cannot support the full SQLite-backed data layer?

## Recommended Milestone Workstreams

1. Runtime policy and support matrix
2. Data-layer feasibility and SQLite validation
3. Build and bundling migration
4. Test harness and CI strategy
5. Installer, distribution, and deploy flow migration
6. Documentation and support-policy cutover

## Recommended Go/No-Go Gates

The milestone should stop and reassess if either of these fail:

- Bun cannot safely support the required SQLite behavior for the chosen target state.
- OpenCode plugin loading cannot reliably support the Bun-oriented artifact strategy.

## Handoff Notes for Planner and Researcher

- The planner should treat this as a multi-epic milestone, not a single-plan refactor.
- The researcher should validate runtime behavior before proposing implementation sequencing.
- Early planning should emphasize support policy and feasibility proofs over code churn.
- A phased rollout is likely safer than a one-shot migration.
