# PITFALLS: Dependency-Driven Plugin Acceleration (bGSD v9.1)

**Question answered:** What pitfalls should be avoided when introducing performance-oriented dependencies into a mature CLI/plugin codebase like bGSD?

**Scope note:** This register is intentionally focused on dependency adoption risk controls (not benchmarking methodology).

**Repository context used:**
- Single-file CLI artifact: `bin/bgsd-tools.cjs` (esbuild-bundled from 34 source modules)
- Plugin runtime split: `plugin.js` (ESM hooks) + CLI runtime (CJS artifact)
- Node engine floor: `>=18` with selective use of newer Node capabilities
- Strong compatibility constraints: existing `.planning/*` formats must not break

## Risk Register (Concrete to bGSD)

| ID | Pitfall | Why this is acute in bGSD | Impact | Prevention controls | Early detection | Confidence |
|---|---|---|---|---|---|---|
| DEP-01 | Choosing a dependency that weakens single-file deploy | bGSD depends on `deploy.sh` and a single bundled CLI artifact | Broken install/deploy path; rollout friction | Require "bundleability" review before adoption (no runtime asset folders, no postinstall binary downloads in critical path) | Build output starts requiring extra files or runtime `node_modules` presence | HIGH |
| DEP-02 | Cold-start regressions from "fast" deps with heavy init | CLI workload is short-lived; parse/init cost dominates command latency | Slower command start despite faster internals | Require lazy-init plan + import boundary review per new dependency | Startup/first-command latency increases after dependency merge | HIGH |
| DEP-03 | ESM/CJS boundary regressions | Repo intentionally ships ESM plugin + CJS CLI; interop mistakes are easy | Runtime crashes, subtle import shape bugs | Add explicit compatibility contract test for both entrypoints when new dep is introduced | Errors like `ERR_REQUIRE_ASYNC_MODULE`, default export mismatch, loader edge cases | HIGH |
| DEP-04 | Node-version drift from dependency requirements | Project supports Node >=18 while some modern deps assume >=20/22 features | Users on supported floor break unexpectedly | Enforce `engines` compatibility gate and test matrix at floor + current LTS | New syntax/API errors on Node 18 CI run | HIGH |
| DEP-05 | Adopting unstable platform APIs via wrappers | Existing cache stack already uses `node:sqlite` (release-candidate stability) | Future Node changes can break perf path | Keep hard fallback path (Map/L1) and guard all unstable feature usage | Behavior divergence between Node minors; fallback path not exercised | HIGH |
| DEP-06 | Bundle bloat via transitive dependency fan-out | Current bundle is already near/over size budget historically | Worse startup, memory, and parse time | Make "size budget delta" a merge gate for new dependencies; prefer narrow packages | Bundle size delta spikes from one dependency addition | HIGH |
| DEP-07 | Tree-shaking assumptions that do not hold in Node/CJS mode | esbuild docs note tree-shaking limits around CommonJS/main field selection | Dead code remains bundled; no real gain | Verify package has ESM-friendly entrypoints; inspect esbuild metafile before merge | Dependency appears large in metafile despite selective import usage | HIGH |
| DEP-08 | Supply-chain risk traded for speed | Performance libs are often low-level and widely depended-on | Security incident, urgent patch churn | Require dependency hygiene checklist: maintainer activity, advisories, lockfile discipline, npm audit posture | Audit findings increase or unmaintained package signals | MEDIUM-HIGH |
| DEP-09 | Behavioral regressions in parser/state semantics | bGSD has strict backward-compat promises for ROADMAP/STATE/PLAN parsing | "Faster" parser breaks legacy documents | For parser-like deps, require fixture corpus parity test before merge | Legacy fixtures pass previously, fail after dependency swap | HIGH |
| DEP-10 | Replacing deterministic internal logic with opaque abstractions | Mature codebase encodes domain rules in readable modules and tests | Debuggability loss; slower incident resolution | Keep adapter seams thin; avoid hard-coupling domain logic to dependency API surface | Increased "cannot reproduce" / "inside dependency" bug reports | MEDIUM-HIGH |
| DEP-11 | Runtime behavior changes from dependency side effects | Some packages execute setup at import time or patch globals | Nondeterministic plugin/CLI behavior | Ban global side-effect dependencies in hot paths; isolate side-effectful imports | Different output depending on import order or plugin load context | MEDIUM |
| DEP-12 | Upgrade cadence mismatch (maintenance tax) | bGSD ships frequently; stale deps create periodic painful catch-up | Security + compatibility debt and emergency upgrades | Define owner and review cadence per critical dependency | Long periods without upgrades followed by large, risky jumps | MEDIUM-HIGH |

## Critical Pitfalls (Avoid First)

### 1) "Performance" dependency that breaks deploy model (DEP-01)
- **What goes wrong:** dependency assumes multi-file runtime, native binaries, or install-time downloads.
- **Why here:** bGSD deployment expects deterministic, single-file-friendly behavior.
- **Controls:** pre-adoption checklist: "works under esbuild single-file output", "no runtime asset lookup outside bundle".
- **Phase warning:** do not approve dependency until install + deploy smoke test passes.

### 2) Net slower user experience from initialization overhead (DEP-02, DEP-06)
- **What goes wrong:** dependency is algorithmically faster but has heavier parse/init/module graph cost.
- **Why here:** many bGSD commands are short-lived CLI invocations where startup dominates.
- **Controls:** require lazy-init and "hot-path import map" in PR description for each added dependency.
- **Phase warning:** adoption PR must include explicit startup impact note, even without full benchmark harness.

### 3) Module-system mismatch between plugin and CLI (DEP-03, DEP-07)
- **What goes wrong:** mixed ESM/CJS semantics lead to default import shape bugs or async module load failures.
- **Why here:** bGSD deliberately runs ESM plugin code and CJS CLI code with separate build targets.
- **Controls:** entrypoint parity tests: plugin load, CLI command smoke, and dependency import contract tests.
- **Phase warning:** reject dependency if it requires top-level await on CJS-required paths.

### 4) Faster code, wrong behavior (DEP-09)
- **What goes wrong:** replacing internal parser/state logic with dependency changes edge-case handling.
- **Why here:** project has explicit backward-compat guarantees for existing planning files and regex-driven parsing.
- **Controls:** regression harness over legacy `.planning/` fixtures before merge.
- **Phase warning:** correctness parity is a hard gate; performance is secondary.

## Practical Controls for Downstream Risk Register

- **Dependency choice controls**
  - Require a short ADR per critical dependency: reason, alternatives rejected, rollback plan.
  - Prefer focused packages over meta-frameworks for hot-path acceleration.
  - Reject packages without recent maintenance or with unresolved high-severity advisories.

- **Bundle growth controls**
  - Enforce per-PR bundle delta budget (absolute KB and % threshold).
  - Inspect esbuild metafile for transitive heavy hitters before approving.
  - Prefer ESM entrypoints where safe to improve tree-shaking outcomes.

- **Cold-start controls**
  - Require deferred import/initialization for non-essential paths.
  - Keep first-command path free of optional dependency initialization.
  - Add lightweight startup smoke timing in CI to detect obvious regressions.

- **Maintenance risk controls**
  - Assign explicit owner for each critical dependency.
  - Define update cadence (e.g., monthly patch window).
  - Keep lockfile deterministic and use clean installs (`npm ci`) in CI.

- **Behavior regression controls**
  - Run full existing test suites plus legacy fixture parity tests for parser/state changes.
  - Add contract tests around command output shape for any dependency-backed rewrite.
  - Keep fast rollback path (feature flag or adapter switch) for newly introduced dependency behavior.

## Source Notes

Primary references used:
- Node.js module behavior and CJS/ESM interoperability: https://nodejs.org/api/modules.html
- Node.js `node:sqlite` stability and lifecycle notes: https://nodejs.org/api/sqlite.html
- Node.js performance instrumentation primitives (`perf_hooks`): https://nodejs.org/api/perf_hooks.html
- esbuild docs on platform/main-fields/tree-shaking/bundling behavior: https://esbuild.github.io/api/
- npm deterministic install guidance (`npm ci`): https://docs.npmjs.com/cli/v10/commands/npm-ci
- npm audit report semantics: https://docs.npmjs.com/about-audit-reports
- Project constraints/context: `.planning/PROJECT.md`, `.planning/STATE.md`, `AGENTS.md`

Confidence rubric:
- **HIGH:** direct Node/esbuild/npm docs + repository constraints
- **MEDIUM-HIGH:** ecosystem/maintenance risk controls inferred from official tooling behavior
