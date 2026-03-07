# Project Research Summary

**Project:** bGSD Plugin
**Domain:** CLI tool hardening — dead code removal, performance tuning, command restructuring, agent architecture refinement
**Researched:** 2026-03-06
**Confidence:** HIGH

<!-- section: compact -->
<compact_summary>
**Summary:** v8.2 hardens a mature Node.js CLI tool (34 src/ modules, ~1216KB bundle, 9 agents, 41 commands, 45 workflows) by auditing and removing dead code, tuning performance hot paths, restructuring stale commands, and sharpening agent boundaries. No new runtime dependencies — only two dev-only tools (knip, madge) plus existing esbuild metafile analysis. The critical risk is removing "dead" exports that are actually consumed by 49 markdown agent/workflow files invisible to JavaScript static analysis.

**Recommended stack:** knip (dead code/unused export detection for CJS), madge (circular dependency detection), esbuild metafile (per-module bundle composition — already available), node --cpu-prof (V8 profiling — built-in), GSD_PROFILE=1 (operational timing — already exists)

**Architecture:** Three-tier validation — (1) JavaScript module validation via knip + self-hosted AST analysis, (2) connection graph validation via new CLI command parsing markdown→CLI→agent references, (3) performance/bundle validation via esbuild metafile + existing profiler

**Top pitfalls:**
1. **Invisible consumers** — 49 markdown files invoke 131+ CLI commands; static analysis sees these exports as "dead" — build command reference map via grep BEFORE any removal
2. **Backward-compat command breakage** — 37+ non-namespaced command forms still active in workflows; migrate ALL markdown references BEFORE removing compat block
3. **Output shape changes break agents** — agents parse specific JSON fields; treat CLI output as a public API with additive-only changes
4. **Over-engineering the audit** — cleanup milestones attract exhaustive cataloguing instead of actual deletion; time-box audit to 20% of milestone
5. **Deploy.sh stale files** — file-copy deploy doesn't delete removed files from target; add clean-deploy or manifest-based sync

**Suggested phases:**
1. **Tooling & Safety** — install dev tools, enable metafile, harden deploy.sh, establish baselines
2. **Audit** — run knip, madge, build connection graph, identify all dead code/stale files
3. **Dead Code Removal** — remove confirmed dead exports, unused files, stale constants
4. **Command & Workflow Cleanup** — migrate backward-compat references, remove stale commands, consolidate subgroups
5. **Performance Tuning** — profile hot paths, optimize identified bottlenecks, verify bundle size reduction
6. **Agent Architecture** — sharpen boundaries, refine manifests, validate token budgets, improve handoff contracts

**Confidence:** HIGH | **Gaps:** Connection graph validation requires new CLI command (no off-the-shelf tool); agent smoke testing through host editor is manual-only
</compact_summary>
<!-- /section -->

<!-- section: executive_summary -->
## Executive Summary

v8.2 is a hardening milestone for a mature CLI tool that has shipped 10 versions in rapid succession. The codebase has accumulated dead code, stale commands, orphaned files, and architectural debt across 34 source modules, 9 AI agents, 41 slash commands, and 45 workflows. Research confirms no new runtime dependencies are needed — the existing stack (esbuild, acorn, tokenx, node:sqlite) is correct. Two dev-only tools (knip for dead code detection, madge for circular dependency analysis) plus esbuild's built-in metafile analysis cover all audit needs.

The central challenge is that this system has four interconnected layers — JavaScript modules, a CLI router, markdown workflows, and AI agent definitions — and no single tool validates the connections between them. JavaScript analysis tools can find dead exports within `src/`, but the 49 markdown files that invoke 131+ CLI commands are invisible to static analysis. The recommended approach is a three-tier validation architecture: automated JS module analysis, a new connection graph validator for the markdown→CLI→agent chain, and performance/bundle validation using existing tooling.

The highest risk is removing "dead" code that is actually consumed by agent workflows. Every removal must be preceded by a grep-based command reference map that includes all markdown consumers. The second-highest risk is breaking the 37+ backward-compatible command forms still actively used in production workflows. Migration must precede removal, with one milestone of dual-support as a safety buffer.
<!-- /section -->

<!-- section: key_findings -->
## Key Findings

### Recommended Stack

No new runtime dependencies. Two dev-only tools plus enhanced use of existing esbuild capabilities. See [STACK.md](STACK.md) for full details.

**Core technologies:**
- **knip** (^5.85.0, dev-only): Dead code detection — finds unused files, exports, and dependencies across CJS codebase. Explicitly supports `require()`/`module.exports`. Auto-fix with `--fix`. 1.7M weekly downloads.
- **madge** (^8.0.0, dev-only): Circular dependency detection and dependency graph visualization. Zero-config for CJS. SVG graph output via Graphviz.
- **esbuild metafile** (existing): Per-module byte attribution via `metafile: true` + `analyzeMetafile()`. Already a devDependency — just needs enabling in `build.js`.
- **node --cpu-prof** (built-in): V8 CPU profiling for deep hot path analysis. Generates `.cpuprofile` files for Chrome DevTools.
- **GSD_PROFILE=1** (existing): Operational timing with labeled spans, JSON baselines, comparison tooling.

**Explicitly rejected:** size-limit (duplicates existing budget), clinic.js (overkill for CLI), ESM migration (wrong scope), code splitting (breaks single-file deploy), minification (bundle must stay debuggable). See STACK.md "What NOT to Add" for full list.

### Expected Features

Research identified table stakes (must-complete for milestone success) and differentiators (lasting improvements beyond audit). See [FEATURES.md](FEATURES.md) for full details.

**Table stakes (must have):**
- Dead code audit (unused exports and files) via knip
- Bundle composition report via esbuild metafile
- Stale command removal from router.js
- Unused dependency detection
- Circular dependency check (confirm zero cycles)
- Bundle size regression tracking (metafile history)

**Differentiators (should have):**
- Constants.js audit (71.9KB — largest pure-source module, likely has unused regex patterns)
- Build script metafile integration (permanent per-build composition tracking)
- Agent manifest validation script (verify 9 agents reference only existing commands/workflows)
- Command consolidation into subgroups (41 → fewer top-level commands)
- Connection graph validation (new — command→workflow→agent reference integrity)

**Anti-features (explicitly not building):**
- Automated dead code removal CI gate (needs human review)
- Tree-shaking via ESM migration (out of scope)
- Code splitting (breaks single-file deploy constraint)
- Coverage-based dead code detection (coverage ≠ dead exports)
- Bundle minification (`minify: false` is intentional for debuggability)
- Performance monitoring daemon (CLI is <5s, not a server)

### Architecture Approach

The recommended architecture splits validation into three tiers reflecting the four interconnected layers of the system: source modules → CLI router → markdown workflows → AI agents. See [ARCHITECTURE.md](ARCHITECTURE.md) for full details.

**Major components:**

1. **Tier 1: JavaScript Module Validation** — Use the project's own AST tooling (`src/lib/ast.js` with `extractCjsExports`) plus knip for cross-validation. Detects dead exports, unused functions, circular dependencies, and module boundary violations within `src/`. Self-hosted approach is recommended primary; knip is supplementary cross-validation.

2. **Tier 2: Connection Graph Validation** — New `util:audit connections` CLI command that parses markdown files (commands/, workflows/, agents/) to extract `gsd-tools` invocations, `@path` references, and agent declarations, then cross-references against router.js routes and actual files. This is the novel piece — no off-the-shelf tool provides it. Catches broken command→workflow references, orphaned workflows, stale CLI invocations in markdown.

3. **Tier 3: Performance & Bundle Validation** — esbuild metafile for per-module size decomposition, existing `GSD_PROFILE=1` profiler for operational timing, `node --cpu-prof` for V8-level analysis. Detect regressions via before/after baselines.

**Key architectural findings:**
- Router.js (1642 lines) has dual routing: namespaced + backward-compat. Both call the same functions. ~2x larger than necessary but load-bearing.
- init.js imports from 6 sibling command modules — defensible for context assembly but should be documented as intentional.
- No upward dependencies found (lib → commands). Architecture is clean.
- 5 system layers: slash commands → workflows → CLI router → source modules → agent definitions.

### Critical Pitfalls

Top 5 from 12 identified. See [PITFALLS.md](PITFALLS.md) for full details including moderate and minor pitfalls.

1. **Invisible consumers** — 49 markdown files invoke 131+ CLI commands via `gsd-tools.cjs`. Static analysis (knip, esbuild) sees these exports as "dead" because the consumers are in markdown, not JavaScript. **Avoid:** Build command reference map (`grep -roP 'gsd-tools\.cjs\s+\S+' agents/ workflows/ references/ templates/ commands/`) BEFORE any removal. Cross-reference against router.js. Only remove functions absent from BOTH the JS import graph AND the grep output.

2. **Backward-compat command breakage** — 37+ non-namespaced command forms (`commit`, `state`, `verify`, etc.) are still actively used in 49 agent/workflow/reference files. Removing the backward-compat switch block in router.js breaks every workflow that hasn't been migrated. **Avoid:** Migrate ALL markdown references to namespaced forms first. Verify zero non-namespaced references remain. Keep backward-compat for one more milestone even after migration.

3. **Output shape changes break agents** — Agents are brittle JSON consumers. Renaming fields, restructuring objects, or removing "redundant" fields silently breaks agent workflows. Only init/state have contract test snapshots — 100+ other commands are untested at the contract level. **Avoid:** Treat CLI output as a public API. Additive changes only. Expand contract tests to ALL agent-consumed commands.

4. **Over-engineering the audit** — Cleanup milestones attract exhaustive cataloguing (building audit tools, generating reports, debating priorities) instead of actual deletion. The audit IS the trap. **Avoid:** Time-box audit to 20% of milestone. Set concrete targets (e.g., bundle 1216KB → <1100KB, dead exports reduced ≥30%). Delete first, analyze later.

5. **Deploy.sh stale files** — File-copy deploy adds files but doesn't remove deleted files from target. Removing `commands/bgsd-join-discord.md` from repo doesn't remove it from `~/.config/OC/get-shit-done/commands/`. **Avoid:** Add clean-deploy mode or manifest-based sync to deploy.sh. Expand smoke test coverage. Establish deploy safety BEFORE any file removal.
<!-- /section -->

<!-- section: roadmap_implications -->
## Implications for Roadmap

Based on research, suggested phase structure:

### Phase 1: Tooling & Safety Net
**Rationale:** Must establish audit tooling, deploy safety, and performance baselines BEFORE making any changes. Deploy.sh safety must be in place before any file removal (Pitfall 5). Profiler baselines needed for before/after comparison (Pitfall 6).
**Delivers:** Dev tools installed, esbuild metafile enabled, deploy.sh hardened with clean-deploy and expanded smoke test, profiler baselines captured, knip configured.
**Addresses:** Bundle composition report, bundle size regression tracking (table stakes)
**Avoids:** Deploy.sh as silent breakage vector (Pitfall 5), no baseline for performance comparison (Pitfall 6)

### Phase 2: Audit & Discovery
**Rationale:** Audit before removal — must know the full picture before deleting anything. Command reference map (grep of all markdown consumers) must exist before dead code removal (Pitfall 1). Connection graph identifies orphaned files. Keep audit time-boxed (Pitfall 4).
**Delivers:** Dead code report (knip output), circular dependency check (madge), connection graph (command→workflow→agent), command reference map, stale file inventory. All reports — no code changes yet.
**Uses:** knip, madge, esbuild metafile, new `util:audit connections` command
**Avoids:** Removing invisible consumers (Pitfall 1), over-engineering the audit (Pitfall 4)

### Phase 3: Dead Code Removal
**Rationale:** Remove confirmed dead code with full test suite verification after each batch. Dead code removal reduces surface area for all subsequent work. Must cross-reference knip output against command reference map to avoid removing markdown-consumed exports.
**Delivers:** Smaller bundle, fewer dead exports, unused files removed, constants.js trimmed.
**Addresses:** Dead code audit, stale file audit, constants.js audit (differentiator)
**Avoids:** Removing security-adjacent code (Pitfall 11), removing files used by external projects (Pitfall 8)

### Phase 4: Command & Workflow Cleanup
**Rationale:** With dead code removed, restructure the live command surface. Migrate backward-compat references BEFORE removing compat block (Pitfall 2). Two-step: migrate first, remove second.
**Delivers:** All markdown references migrated to namespaced commands, stale commands removed, command consolidation into subgroups, router.js simplified.
**Addresses:** Command restructuring, stale command removal
**Avoids:** Breaking backward-compat (Pitfall 2), output shape changes (Pitfall 3)

### Phase 5: Performance Tuning
**Rationale:** After cleanup, measure the delta. Profile init command with `--cpu-prof` to find actual V8 hot spots. Compare bundle size and init time against Phase 1 baselines. Only optimize if data shows a measurable bottleneck.
**Delivers:** Performance comparison report, optimized hot paths (if any identified), bundle size reduction verified, cache effectiveness validated.
**Addresses:** Performance tuning (init times, bundle size, file load optimization)
**Avoids:** Performance regression from refactoring (Pitfall 6), cache corruption (Pitfall 9)

### Phase 6: Agent Architecture Refinement
**Rationale:** Agent audit runs last because it depends on knowing which workflows/commands are actually live (after Phases 3-4). Token budget validation requires stable context boundaries.
**Delivers:** Sharpened agent boundaries, refined manifests, validated token budgets, improved handoff contracts, hardcoded agent lists replaced with filesystem scans.
**Addresses:** Agent architecture audit, agent handoff contracts
**Avoids:** Token budget overflow (Pitfall 7), removing agent-consumed references (Pitfall 8)

### Phase Ordering Rationale

- **Tooling before audit:** Can't audit without tools. Deploy safety must exist before any file removal.
- **Audit before removal:** Must build command reference map to avoid invisible consumer breakage. Time-boxed to prevent audit trap.
- **Dead code before commands:** Removing dead commands first reduces the surface area for command restructuring.
- **Commands before performance:** Command changes affect bundle size and init time; measure performance after structural changes are complete.
- **Performance before agents:** Performance baselines inform whether agent context loading needs optimization.
- **Agents last:** Depends on stable command surface and workflow inventory.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 2 (Audit):** Connection graph validation requires building a new CLI command — needs design for markdown parsing patterns and output format.
- **Phase 4 (Commands):** Command consolidation into subgroups needs design decisions on grouping strategy and migration path.
- **Phase 6 (Agents):** Agent boundary sharpening requires measuring actual token usage and identifying overlap areas.

Phases with standard patterns (skip research-phase):
- **Phase 1 (Tooling):** Well-documented tools (knip, madge, esbuild metafile). Straightforward configuration.
- **Phase 3 (Dead Code Removal):** Mechanical process — review knip output, cross-reference grep map, delete, test.
- **Phase 5 (Performance):** Existing profiler infrastructure handles measurement; optimization is data-driven.
<!-- /section -->

<!-- section: confidence -->
## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All tools verified via Context7, npm registry, and official docs. esbuild metafile tested on this project. |
| Features | HIGH | Table stakes derived from codebase analysis. Anti-features clearly bounded by project constraints. |
| Architecture | HIGH | Three-tier validation architecture grounded in direct inspection of all 4 system layers. |
| Pitfalls | HIGH | Top pitfalls verified by codebase grep (49 files, 131+ commands, 37+ non-namespaced forms). |

**Overall confidence:** HIGH

### Gaps to Address

- **Connection graph CLI command:** No off-the-shelf tool validates command→workflow→agent references. Must be built as part of Phase 2. Design markdown parsing patterns during phase planning.
- **Contract test expansion scope:** Currently only init/state have snapshot tests. Expanding to all 131+ agent-consumed commands is the right goal but the exact list needs derivation from the command reference map.
- **Agent smoke testing:** End-to-end testing through the host editor is manual-only. No way to automate agent→CLI→agent pipeline validation. Accept this as a manual gate after each phase.
- **Router lazy registration value:** Research suggests deferring router lazy registration unless profiling shows command registration >10ms. Actual measurement needed in Phase 5.
<!-- /section -->

<!-- section: sources -->
## Sources

### Primary (HIGH confidence)
- Context7 `/evanw/esbuild` — metafile API, analyzeMetafile(), bundle composition
- Context7 `/webpro-nl/knip` — CJS configuration, entry points, dead export detection
- Context7 `/pahen/madge` — circular dependency detection, CLI usage, CJS support
- npm registry — knip@5.85.0 (Feb 2026), madge@8.0.0, esbuild@0.27.3
- knip.dev/guides/working-with-commonjs — CJS module.exports support
- esbuild.github.io/api/#metafile — metafile output specification
- nodejs.org/en/learn/diagnostics — --cpu-prof usage
- Direct codebase analysis — router.js (1642 lines), 49 gsd-tools-referencing files, 131+ unique commands, 37+ non-namespaced forms

### Secondary (MEDIUM confidence)
- GitHub Engineering Blog (2026-02-24) — multi-agent workflow failure modes
- ETH Zurich AGENTS.md study (2026-02-12) — agent documentation pitfalls (138-repo sample)
- Refactoring literature (FreeCodeCamp, Medium 2025-2026) — characterization tests, silent regressions

### Tertiary (LOW confidence)
- push-based.io — advanced CPU profiling in Node.js (community article, patterns verified against official docs)

---
*Research completed: 2026-03-06*
*Ready for roadmap: yes*
<!-- /section -->
