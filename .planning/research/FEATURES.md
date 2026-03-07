# Feature Landscape: v8.2 Cleanup, Performance & Validation

**Domain:** Hardening milestone for a mature Node.js CLI tool (34 src/ modules, ~1216KB bundle)
**Researched:** 2026-03-06
**Confidence:** HIGH (tools verified via Context7, npm registry, and direct measurement on this codebase)

## Table Stakes

Features that define what "hardened" means for this milestone. Missing = milestone incomplete.

| Feature | Why Expected | Complexity | Notes |
|---|---|---|---|
| Dead code audit (unused exports) | 37 source files accumulated over 8 versions — guaranteed dead exports exist | Low | knip finds them automatically; removal is manual review |
| Dead code audit (unused files) | Workflows, templates, references accumulated — some may be orphaned | Low | knip + manual audit of non-source files |
| Bundle composition report | Must know WHERE 1216KB comes from before optimizing | Low | esbuild metafile already available — just enable it |
| Stale command removal | Router has 100+ commands — some likely obsolete (e.g., join-discord) | Low | Manual audit of `src/router.js` against actual usage |
| Unused dependency detection | npm packages in package.json that nothing imports | Low | knip covers this |
| Circular dependency check | Architectural health baseline — must confirm zero cycles | Low | madge one-liner |
| Bundle size regression tracking | Already have budget (1500KB) but no per-build metafile history | Low | Write metafile JSON alongside bundle-size.json |

## Differentiators

Features that move beyond "audit" into lasting improvement.

| Feature | Value Proposition | Complexity | Notes |
|---|---|---|---|
| Constants.js audit (71.9KB) | Largest pure-source module — likely has unused regex patterns from deprecated features | Med | Requires cross-referencing each constant against usage across 36 other files |
| Router lazy registration | 100+ routes registered on every CLI invocation even if only 1 is used | Med | Could defer registration to command groups — reduces startup time |
| Build script metafile integration | Permanent bundle composition tracking in every build | Low | Add to existing `build.js` — 5 lines of code |
| Agent manifest validation script | Verify 9 agent manifests reference only existing commands/workflows | Med | Custom script using madge JSON output + agent file parsing |
| Profiler hot path identification | Use `--cpu-prof` to find actual V8 hot spots (not just labeled spans) | Med | One-time analysis to guide optimization; results inform code changes |
| Command consolidation into subgroups | 41 slash commands into fewer top-level commands with subcommands | Med | Already planned in milestone spec; requires workflow/command file changes |

## Anti-Features

Features to explicitly NOT build. These are over-engineering traps for a hardening milestone.

| Anti-Feature | Why Avoid | What to Do Instead |
|---|---|---|
| Automated dead code removal CI gate | Knip output needs human review — auto-fix in CI could delete intentionally-exported APIs | Run `knip` manually or in advisory mode; review before `--fix` |
| Tree-shaking via ESM migration | CJS→ESM rewrite of 37 files for marginal tree-shaking gains is out of scope; `minify: false` is intentional for debuggability | Focus on removing dead code at source level, not relying on bundler elimination |
| Code splitting the bundle | Single-file deploy is a core constraint — splitting would break `deploy.sh` | Reduce module sizes through dead code removal instead |
| Coverage-based dead code detection | c8/nyc test coverage ≠ dead exports. 100% coverage doesn't mean all exports are used by consumers | Use knip for export-level analysis |
| Dynamic import() for lazy loading | Would break CJS single-file bundle architecture | Keep static requires; reduce what's loaded by removing dead code |
| Bundle minification | `minify: false` is intentional — bundle must be debuggable in production | Remove dead code at source, not by minifying |
| Custom dependency graph tool | Madge + existing `src/lib/ast.js` already cover this | Use madge for self-analysis; keep ast.js for target project analysis |
| Performance monitoring daemon | CLI processes are <5s; APM/monitoring is for servers | Stick with `GSD_PROFILE=1` opt-in spans |

## Feature Dependencies

```
Bundle composition report → Constants.js audit (need to know sizes before optimizing)
Dead code audit (knip) → Stale command removal (knip identifies unused exports in router)
Circular dependency check → Agent manifest validation (architecture must be clean first)
Dead code audit → Command consolidation (remove dead commands before reorganizing live ones)
```

## MVP Recommendation

**Phase 1 — Audit (low risk, high signal):**
1. Enable esbuild metafile in build.js (5 minutes)
2. Run `knip` to find all dead code (30 minutes of review)
3. Run `madge --circular src/` to confirm zero cycles (5 minutes)
4. Audit router.js for stale commands (30 minutes)

**Phase 2 — Remove (medium risk, requires testing):**
5. Remove dead exports/files identified by knip
6. Remove stale commands from router
7. Remove unused constants from constants.js
8. Run full test suite after each batch of removals

**Phase 3 — Optimize (targeted, data-driven):**
9. Profile init command with `--cpu-prof` to find actual hot paths
10. Optimize identified hot paths (if any exceed threshold)
11. Consolidate commands into subgroups

**Defer:** Router lazy registration — only pursue if profiling shows command registration is a measurable bottleneck (likely <10ms, not worth the complexity).

## Sources

- esbuild metafile API (Context7 `/evanw/esbuild`, official docs)
- knip configuration guide (Context7 `/webpro-nl/knip`, knip.dev)
- madge CLI reference (Context7 `/pahen/madge`, GitHub README)
- Direct bundle analysis: `esbuild.analyzeMetafile()` run on this project
- PROJECT.md milestone spec for v8.2
