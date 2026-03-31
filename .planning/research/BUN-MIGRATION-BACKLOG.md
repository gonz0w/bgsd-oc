# Bun Migration Backlog

## Milestone

Transition `bgsd-oc` from Node/npm-centered workflows to a Bun-first model without losing deployability, plugin compatibility, or test confidence.

## Planning Guidance

- This backlog is intentionally milestone-scoped, not implementation-ready at task level.
- Items marked `Research` should be handled by later researcher work rather than assumed during planning.
- Items marked `Decision` need an explicit policy choice before deeper execution planning.

## Epic 1: Runtime Strategy

### Outcome

Choose the exact target model for Bun adoption and publish a support matrix.

### Backlog

- `Decision` Choose between Bun-first with Node fallback, mixed runtime, or full Bun runtime replacement.
- `Decision` Reconcile runtime floors across `package.json`, `README.md`, build targets, and SQLite assumptions.
- `Research` Validate how OpenCode actually loads and executes `plugin.js` in environments where Bun is primary.
- `Research` Define what "full Bun plugin" means for this project: development only, runtime only, or both.

### Done when

- A single runtime support matrix exists.
- Runtime terminology is consistent across docs and package metadata.
- The milestone has a clear target state with explicit non-goals.

## Epic 2: Data Layer and SQLite Feasibility

### Outcome

Prove whether the SQLite-first architecture can survive a Bun-first migration.

### Backlog

- `Research` Validate Bun support for `node:sqlite` APIs used in `src/lib/db.js`.
- `Research` Validate Bun support for plugin cache behavior in `src/plugin/lib/db-cache.js`.
- `Research` Test WAL mode, busy timeout, prepared statements, migrations, and fallback behavior.
- `Decision` Decide whether Map fallback is acceptable as a long-term Bun mode or only a temporary bridge.
- `Decision` Decide whether the plugin and CLI may have different storage backends under Bun.

### Done when

- SQLite compatibility is rated pass, partial, or fail.
- Required behavior gaps are documented.
- A go/no-go decision exists for Bun-first runtime execution.

## Epic 3: Build and Artifact Strategy

### Outcome

Define how Bun changes build orchestration without breaking deployable artifacts.

### Backlog

- Inventory Node-specific build assumptions in `build.cjs`.
- `Decision` Decide whether Bun replaces the script runner only or also replaces parts of the build pipeline.
- `Research` Validate esbuild invocation under Bun and compare output parity.
- `Research` Validate whether CLI artifact should remain CJS, move to ESM, or stay dual-compatible.
- Define how manifest generation, smoke tests, size budgets, and artifact validation run in the Bun-first flow.

### Done when

- Build ownership is clear.
- Expected artifact format is decided.
- Artifact parity checks are defined before implementation.

## Epic 4: Package Manager and Distribution

### Outcome

Replace npm-first assumptions with a Bun-first package and install story.

### Backlog

- `Decision` Choose root lockfile authority and package-manager policy.
- Plan migration from `package-lock.json` to Bun lockfile usage if Bun becomes canonical.
- `Research` Evaluate `npx` vs `bunx` vs dual install support for end users.
- Inventory package metadata affected by a Bun-first shift, including `bin`, engines, scripts, and publish expectations.
- Define whether npm publishing remains the distribution channel even if Bun is the primary workflow.

### Done when

- One canonical install story exists for developers.
- One canonical install story exists for users.
- Publishing expectations are explicit.

## Epic 5: Test Harness and CI

### Outcome

Define a credible Bun-era test and verification strategy.

### Backlog

- Inventory Node-specific test runner assumptions in `package.json`, `tests/*.test.cjs`, and `tests/helpers.cjs`.
- `Research` Validate Bun compatibility for the current `node:test` plus CommonJS suite.
- `Decision` Choose between Node test runner retention, Bun-native tests, or a mixed matrix.
- Define the minimum smoke matrix for CLI build, plugin import, installer flow, and DB/cache behavior.
- Define CI expectations for runtime matrix coverage.

### Done when

- Canonical test runner policy is explicit.
- Minimum required compatibility matrix is documented.
- CI changes can be planned without runtime ambiguity.

## Epic 6: Installer and Deploy Flow

### Outcome

Bring install and deploy tooling into alignment with Bun-first positioning.

### Backlog

- Inventory Node/npm assumptions in `install.js` and `deploy.sh`.
- `Research` Validate whether installer execution should remain Node-based, become Bun-based, or support both.
- Define future smoke-test commands for both local deploy and packaged install flows.
- Define rollback expectations if deploy succeeds but runtime smoke tests fail.
- Decide whether development deploy scripts should prefer Bun while retaining compatibility fallbacks.

### Done when

- Installer strategy is explicit.
- Deploy script ownership is explicit.
- Smoke tests verify the real supported install path.

## Epic 7: Documentation Cutover

### Outcome

Remove contradictory runtime guidance and publish the new workflow clearly.

### Backlog

- Update README development commands and runtime requirements.
- Update architecture docs to reflect the real Bun and SQLite story.
- Update install guidance and any command docs referencing npm or Node-only steps.
- Add a support-policy section covering Bun-first expectations and Node fallback, if any.

### Done when

- Docs no longer conflict.
- New contributor setup follows one primary workflow.
- Runtime and support policy are visible from the README.

## Cross-Cutting Unknowns

- Whether Bun can fully replace Node for the plugin runtime, not just local CLI workflows.
- Whether the current bundled `plugin.js` module boundary becomes more fragile under Bun.
- Whether the repo should keep CommonJS in `src/` or use the migration to simplify module boundaries.
- Whether package publishing needs to stay npm-centric even after Bun adoption.

## Suggested Milestone Sequence

1. Runtime strategy and support matrix
2. SQLite feasibility research
3. Build artifact strategy
4. Test/CI policy
5. Installer/distribution policy
6. Execution planning
7. Documentation cutover near rollout

## Suggested Acceptance Criteria for the Milestone Agent

- The milestone plan starts with feasibility proofs, not refactors.
- No implementation plan proceeds without a SQLite decision.
- No toolchain cutover proceeds without a published support matrix.
- The final plan includes rollback and fallback strategy, not just happy-path migration.
