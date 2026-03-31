# Phase 165: JJ Execution & Repo-Local Verification - Research

**Researched:** 2026-03-30
**Domain:** JJ path-scoped execution, commit fallback behavior, and repo-local verification/runtime truth
**Confidence:** HIGH

## User Constraints

- Stay inside the existing single-file Node.js CLI architecture and current JJ-backed execution model.
- Preserve backward compatibility for existing planning artifacts, command contracts, and structured JSON output.
- Keep the phase focused on reliability in real local repos: dirty or detached JJ workspaces, path-scoped commits, local runtime truth, and repo-local verification evidence.
- Do not reopen Git worktree behavior or reintroduce generic Git-first execution guidance.
- Fail loudly when local runtime or verification evidence is stale, missing, or inconclusive instead of quietly validating against the wrong thing.

## Phase Requirements

| Requirement | What this phase must make true |
|-------------|--------------------------------|
| EXEC-01 | Users can complete task and metadata commits safely in detached or dirty JJ colocated workspaces using a supported path-scoped flow |
| EXEC-02 | Users get an automatic or clearly documented JJ-native fallback when generic commit helpers reject a valid path-scoped execution state |
| EXEC-03 | Maintainers verify runtime-sensitive source changes against the correct local or rebuilt runtime so stale bundled artifacts do not hide real behavior |
| VERIFY-03 | Verification results in the development workspace use repo-local current-state evidence that matches the active checkout |

## Summary

Phase 165 should tighten the real local execution path, not invent a new backend. The repo already has JJ-aware execution entrypoints and workspace inspection, but `execute:commit` still stages and commits through Git-only logic in `src/commands/misc.js`. That means the user-facing execution model and the actual commit helper can disagree in exactly the detached or dirty JJ states this phase is supposed to make safe.

The verifier side has a similar realism gap. `verify:verify deliverables` already runs local test commands and can cross-check plan artifacts and key links, but the current evidence is still shallow: it mainly checks existence in the current workspace and does not yet make the local-versus-rebuilt runtime contract explicit enough for source-sensitive changes. That leaves room for stale built assets or bundle drift to hide the behavior users actually invoke in the development repo.

**Primary recommendation:** Plan Phase 165 as three linked slices: (1) make `execute:commit` JJ-aware with a supported path-scoped fallback contract, (2) make verifier/runtime checks use repo-local current-state evidence plus explicit rebuild or freshness handling, and (3) lock the workflow and runtime surfaces with real JJ temp-repo regressions plus rebuilt bundle parity.

## Existing Codebase Reality

### Primary touchpoints

| Area | Current state | Planning implication |
|------|---------------|----------------------|
| `src/commands/misc.js` | `cmdCommit()` stages with `git add` and commits with `git commit` | Main implementation target for JJ-aware path-scoped commit fallback |
| `src/lib/jj.js` | Shared JJ environment detection and execution-gate helpers | Best place for JJ-native commit-state helpers or fallback classification |
| `src/lib/jj-workspace.js` | Real workspace inspection and recovery preview logic | Keep execution-state behavior aligned with existing JJ workspace truth |
| `src/commands/init.js` | Carries `resume_summary`, `stale_sources`, and capability-only JJ planning context | Runtime freshness and repo-local validation guidance should reuse this contract |
| `src/commands/verify.js` | Deliverables verification runs local test commands and checks plan artifacts/key links | Needs stronger repo-local evidence and local-versus-rebuilt runtime truth |
| `src/plugin/idle-validator.js` + `plugin.js` | Shipped runtime guidance depends on rebuilt plugin output staying aligned with source | Runtime-sensitive source changes need bundle-parity proof, not source-only edits |

### Scope boundary to preserve

- Do not widen this phase into a new generalized execution architecture; stay on JJ-backed local reliability.
- Do not re-litigate planning metadata truthfulness from Phase 164 except where Phase 165 needs the verifier to consume repo-local evidence correctly.
- Do not broaden into plan-scoped completion accuracy or noisy guidance cleanup; those belong to Phases 166 and 167.

## Standard Stack

### Core

| Library / Tool | Version | Purpose | Why Standard |
|----------------|---------|---------|--------------|
| Jujutsu CLI (`jj`) | repo-local toolchain | Supported execution backend and colocated workspace state source | Existing execution model already requires JJ for execution surfaces |
| Git CLI (`git`) | repo-local toolchain | Underlying storage and fallback baseline for existing commit helper | Still present, but should no longer be the only successful path in valid JJ states |
| Node.js CLI modules in `src/` | repo standard | Command routing, verification logic, runtime checks, and bundle rebuild flow | Required project architecture |

### Supporting

| Library / Tool | Version | Purpose | When to Use |
|----------------|---------|---------|-------------|
| `src/lib/jj.js` | in-repo | JJ environment classification and execution helpers | Extend for commit/fallback classification instead of scattering JJ logic |
| `src/lib/jj-workspace.js` | in-repo | Real workspace-state inspection | Reuse for supported dirty/stale/divergent execution-state handling |
| `src/commands/verify.js` | in-repo | Deliverables and plan-linked evidence verification | Strengthen repo-local evidence and runtime truth here |
| `npm run build` | repo standard | Rebuild generated runtime artifacts like `plugin.js` and `bin/bgsd-tools.cjs` | Use whenever runtime-sensitive source changes affect shipped output |
| JJ temp repos in tests | repo test pattern | Real execution-state regression proof | Needed for detached/dirty JJ and repo-local verification realism |

## Architecture Patterns

### Pattern 1: Supported path-scoped commit flow over valid JJ states

Keep `--files` as the path-scoped contract, but stop assuming Git-only commit success is the only acceptable outcome. A valid JJ colocated workspace may be detached or otherwise rejected by generic Git helpers while still being a supported local execution state. The command should classify that state, preserve structured result output, and take a JJ-native fallback or emit explicit next-step guidance instead of reporting a misleading generic failure.

### Pattern 2: Repo-local evidence must come from the active checkout

Verification should read the current repo state on disk, not stale assumptions about previously built artifacts or installed runtime surfaces. Artifact checks, key-link checks, and any runtime-sensitive validation should explicitly anchor to the active checkout and fail or require rebuild when the current source and local runtime diverge.

### Pattern 3: Runtime-sensitive source edits require rebuild-aware proof

When touched source feeds generated runtime artifacts such as `plugin.js` or the bundled CLI, verification should either use the rebuilt local runtime or fail loudly with rebuild guidance. Source-only success is not enough when users actually invoke the built output.

### Anti-Patterns to Avoid

- Leaving `execute:commit` Git-only while the rest of execution is JJ-first
- Treating detached JJ state as automatically invalid just because Git commit rejects it
- Verifying source edits only against source files when shipped runtime artifacts are what users invoke
- Letting tests prove isolated helper behavior without real JJ temp-repo or rebuilt bundle coverage

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| JJ execution-state truth | Ad hoc filesystem heuristics for detached/dirty state | Shared JJ helper behavior plus real JJ CLI outcomes | Keeps commit fallback aligned with the supported backend |
| Path-scoped execution commit fallback | Separate per-workflow commit logic | One `execute:commit` contract with structured fallback reasons | Prevents drift across execution flows |
| Repo-local verification evidence | Cached assumptions about prior bundle state | Active-checkout reads plus explicit rebuild/freshness checks | Users need truth about the repo they are in right now |
| Runtime-sensitive parity | Manual reminders to rebuild | Verification/runtime contract that detects or requires rebuilt local artifacts | Makes stale runtime confusion actionable |

## Common Pitfalls

### Pitfall 1: Fixing commit success without fixing structured fallback semantics
**What goes wrong:** JJ-native fallback works sometimes, but callers cannot distinguish supported fallback from real failure.
**How to avoid:** Keep structured `reason` output and add explicit tests for fallback outcomes.

### Pitfall 2: Verifying the wrong runtime after touching source
**What goes wrong:** Tests pass against source or an old bundle while the shipped runtime still behaves differently.
**How to avoid:** Make runtime-sensitive verification prove the rebuilt local runtime or fail with rebuild guidance.

### Pitfall 3: Treating repo-local evidence as plain file existence
**What goes wrong:** Verification passes because files exist, even though they do not match the active checkout or current built runtime.
**How to avoid:** Pair active-checkout evidence with runtime freshness or rebuild checks when the touched surface is generated.

### Pitfall 4: Using isolated fixtures instead of real JJ state
**What goes wrong:** Detached or dirty execution paths look solved in unit tests but still fail in actual JJ repos.
**How to avoid:** Add JJ temp-repo integration coverage for commit and verification flows.

## Code Examples

Verified current-repo anchors:

```js
// src/commands/misc.js
const filesToStage = files && files.length > 0 ? files : ['.planning/'];
for (const file of filesToStage) {
  execGit(cwd, ['add', file]);
}
```

```js
// src/lib/jj.js
function requireJjForExecution(cwd, surface) {
  const status = classifyJjEnvironment(cwd);
  if (status.ok) return status;
  // ... JJ-required guidance
}
```

```js
// src/commands/verify.js
const verdict = testResult === 'pass' && artifactsOk && keyLinksOk ? 'pass' : 'fail';
```

## Sources

### Primary (HIGH confidence)

- `.planning/ROADMAP.md`
- `.planning/REQUIREMENTS.md`
- `.planning/PROJECT.md`
- `src/commands/misc.js`
- `src/lib/jj.js`
- `src/lib/jj-workspace.js`
- `src/commands/init.js`
- `src/commands/verify.js`
- `tests/misc.test.cjs`
- `tests/verify.test.cjs`
- `tests/init.test.cjs`
- `tests/integration.test.cjs`

### Secondary (MEDIUM confidence)

- Prior JJ milestone artifacts from Phases 155-156 for command-surface and workspace-state patterns

## Metadata

**Confidence breakdown:** HIGH for current code paths, requirement mapping, and JJ/test anchor files; MEDIUM for exact runtime-parity implementation shape because the current repo has partial but not yet unified rebuild truth.
**Research date:** 2026-03-30
**Valid until:** Next material change to `execute:commit`, JJ execution helpers, or repo-local verification/runtime surfaces.
