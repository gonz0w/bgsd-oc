# Phase 78: File Discovery and Ignore Optimization - Research

**Researched:** 2026-03-10
**Domain:** Large-repo file traversal and gitignore-parity matching for scan-heavy CLI flows
**Confidence:** HIGH

## User Constraints

- Preserve exact file-selection behavior while improving speed (`SCAN-03` is a hard gate).
- Keep backward compatibility for existing `.planning/` artifacts and command outputs.
- Keep single-file CLI deploy behavior intact (`bin/bgsd-tools.cjs` remains the runtime artifact).
- Keep Node 18+ compatibility and path-agnostic behavior.
- Scope this phase to dependency-driven acceleration (no broad architecture rewrite).

## Phase Requirements

- `SCAN-01`: Faster file-heavy command execution via optimized traversal (`fast-glob`) in discovery hotspots.
- `SCAN-02`: Remove repeated ignore subprocess overhead via in-process matching (`ignore`).
- `SCAN-03`: Preserve exact legacy file-selection parity.

## Intent Alignment (Why this phase matters now)

This phase directly supports milestone intent to deliver measurable latency reduction in hot paths with controlled complexity. It aligns to:

- **DO-20 / DO-32**: optimize slow commands and reduce I/O-heavy overhead.
- **DO-38**: keep full test suite green during performance changes.
- **Constraint C-04**: preserve backward behavior while modernizing internals.

## Current Baseline (What Exists Today)

### Hotspots

1. `src/lib/codebase-intel.js:getSourceDirs`
   - Scans top-level directories with `fs.readdirSync`.
   - Calls `execGit(cwd, ['check-ignore', '-q', name])` once per top-level directory.
   - This is repeated subprocess overhead in a discovery hot path.

2. `src/lib/codebase-intel.js:walkSourceFiles`
   - Manual recursive sync traversal of source dirs.
   - Called in full analysis (`performAnalysis`) and staleness fallback paths.

3. `src/lib/ast.js:generateRepoMap`
   - Reuses `getSourceDirs` + `walkSourceFiles`; inherits same traversal/ignore behavior and costs.

### Non-hotspot note

- `src/lib/config.js:isGitIgnored` uses `git check-ignore` for `.planning` commit decisions in `misc` flows; this is not the large fan-out scan path and should not drive phase scope.

### Test coverage baseline

- Existing `tests/codebase.test.cjs` validates analyze modes and output shape.
- There is no dedicated parity matrix for ignore semantics in `getSourceDirs`/`walkSourceFiles` (nested `.gitignore`, negations, symlink behavior, dotfile handling).

## Standard Stack Recommendation

### Core

| Library | Version | Purpose | Why standard for this phase |
|---------|---------|---------|-----------------------------|
| `fast-glob` | `3.3.3` | High-performance file discovery | Replaces manual recursive scanning in discovery hotspots with mature optimized traversal |
| `ignore` | `7.0.5` | In-process `.gitignore` rule evaluation | Removes per-path git subprocess checks while keeping gitignore semantics |

### Supporting / Keep

| Tool | Role | When to use |
|------|------|-------------|
| Existing legacy walkers (`getSourceDirs` / `walkSourceFiles`) | Parity reference + fallback | Shadow compare, rollback, and mismatch triage until parity is proven |
| Git (`check-ignore --stdin` optional) | Diagnostic oracle for parity tests only | Test/debug mode, not default runtime path |

## Architecture Patterns (Recommended)

### Pattern 1: Adapter seam with dual path

- Add one internal discovery adapter (for example `src/lib/adapters/discovery.js`) that exposes stable functions for:
  - source directory detection
  - source file walking
  - optional parity compare hooks
- Keep existing callers (`codebase-intel`, `ast`) unchanged at API boundaries.
- Start with legacy default + shadow compare; then switch default once parity passes.

### Pattern 2: Preserve behavior contract first, optimize implementation second

The optimized path must preserve these legacy semantics:

- `SKIP_DIRS` exclusion behavior.
- Hidden directory handling (`entry.name.startsWith('.')` directories skipped except root context behavior).
- Binary extension exclusion.
- Root-source-file behavior (`.` included when root has source files).
- Fallback-to-root behavior when no source dirs found.
- Relative path output shape consumed by downstream code.

### Pattern 3: Centralized ignore context

- Build ignore matcher once per scan context (root + relevant nested ignore files).
- Normalize candidate paths before matching (relative, POSIX-style separators).
- Keep directory-vs-file distinctions explicit where needed (`foo/` semantics).

## Critical Parity Risks (Planning Focus)

1. **Gitignore semantics drift (highest risk)**
   - `git check-ignore` consults full git exclude mechanisms and precedence.
   - Naive `ignore` usage can miss nested rules, negations, path normalization rules, or exclude sources.
   - Planning implication: parity tests must be first-class, not an afterthought.

2. **Traversal semantics drift**
   - `fast-glob` defaults can differ from current behavior (dotfiles, symlink traversal, path formats).
   - Planning implication: explicitly set options (e.g., `followSymbolicLinks`, `dot`, `onlyFiles`, `cwd`, `absolute`) to match legacy behavior.

3. **Cross-platform path behavior**
   - `ignore` expects relative normalized paths; Windows separators can produce false mismatches.
   - Planning implication: add path-normalization utility and include platform-sensitive tests.

4. **Regression blast radius**
   - Discovery feeds `codebase analyze`, staleness fallback scanning, and repo-map generation.
   - Planning implication: treat this as shared infrastructure and verify all dependent commands.

## Don’t Hand-Roll

| Problem | Don't build | Use instead | Why |
|---------|-------------|-------------|-----|
| High-performance recursive traversal engine | Custom recursive walkers with ad hoc pruning | `fast-glob` via adapter | Mature, optimized, less maintenance risk |
| Custom gitignore parser | Homegrown ignore rule interpreter | `ignore` with explicit normalization and rule loading strategy | Better spec alignment and reduced bug surface |
| One-off parity checks | Manual spot checks | Repeatable parity fixture suite + optional shadow compare | Needed to prove `SCAN-03` reliably |

## Verification Implications (Must be planned)

### Functional parity gates (for `SCAN-03`)

- Golden parity tests comparing legacy and optimized outputs for:
  - `getSourceDirs` equivalent result set
  - `walkSourceFiles` equivalent result set
  - downstream `codebase analyze` file counts/stats on parity fixtures
- Fixture scenarios should include:
  - nested `.gitignore`
  - negation patterns (`!`)
  - hidden dirs/files
  - symlinked dirs/files
  - root-level source files and empty-source fallback

### Performance gates (for `SCAN-01` / `SCAN-02`)

- Measure before/after discovery duration on synthetic large tree fixture.
- Confirm no repeated per-directory `git check-ignore` process spawning in optimized path.
- Keep user-visible command contract unchanged (`util:codebase analyze`, repo-map).

### Minimum command validation

- `npm test`
- Focus loop: `npm run test:file tests/codebase.test.cjs`
- `npm run build` (single-file artifact integrity)

## Suggested Plan Shape (What to plan)

1. **Task A - Discovery adapter + dual engine wiring**
   - Introduce adapter and feature flag/shadow compare path.
   - No default behavior switch yet.

2. **Task B - Migrate `codebase-intel` + repo-map discovery calls**
   - Route `getSourceDirs` / `walkSourceFiles` call sites through adapter.
   - Preserve output contracts and fallback.

3. **Task C - Parity/perf test matrix + default switch criteria**
   - Add fixture-based parity tests and overhead checks.
   - Enable optimized default only when parity + tests are green.

This three-task shape aligns with current project velocity and keeps each step reversible.

## Open Questions for Planner

- Should `.git/info/exclude` and `core.excludesFile` parity be in Phase 78 scope, or deferred to Phase 81 safety hardening?
- Should shadow-compare logging be debug-only (`BGSD_DEBUG`) from day one to avoid noisy runtime output?

## Assertions Status

- `.planning/ASSERTIONS.md` does not exist in this project.
- Planning should include explicit parity assertions in Phase 78 plans (especially around ignore and traversal semantics).

## Sources

### Primary (HIGH confidence)

- Project constraints and scope:
  - `.planning/REQUIREMENTS.md`
  - `.planning/STATE.md`
  - `.planning/INTENT.md`
  - `.planning/ROADMAP.md`
  - `AGENTS.md`
- Current implementation:
  - `src/lib/codebase-intel.js`
  - `src/lib/ast.js`
  - `src/lib/config.js`
  - `src/commands/codebase.js`
  - `tests/codebase.test.cjs`
- Existing milestone research:
  - `.planning/research/SUMMARY.md`
  - `.planning/research/STACK.md`
  - `.planning/research/ARCHITECTURE.md`

### Secondary (HIGH/MEDIUM confidence)

- Context7 `fast-glob` docs: `/mrmlnc/fast-glob` (options: ignore, dot, objectMode/stats, symlink handling).
- Context7 `ignore` docs: `/kaelzhang/node-ignore` (`add`, `ignores`, `test`, pathname conventions).
- Official Git docs: `git-check-ignore` manual (stdin mode, verbose mode, exit statuses, matching semantics): https://git-scm.com/docs/git-check-ignore

## Metadata

- Confidence breakdown: HIGH on hotspot identification and migration shape; MEDIUM-HIGH on exact speedup magnitude until measured on large fixture repos.
- Valid until: discovery call graph changes materially or dependency versions/policies change in milestone scope.
