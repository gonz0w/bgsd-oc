# Phase 61: Tooling & Safety Net - Context

**Gathered:** 2026-03-06
**Status:** Ready for planning

<domain>
## Phase Boundary

Establish audit infrastructure, deploy safety, and performance baselines before any code changes. This phase produces tooling and measurements — it does not remove code, refactor, or change behavior. Downstream phases (62-65) consume the tools and baselines established here.

**Requirements:** AUDIT-01, AUDIT-05, AUDIT-06

</domain>

<decisions>
## Implementation Decisions

### Build metafile output format
- Enable esbuild `metafile: true` option in build.js
- Console output: all modules grouped by directory (src/lib/, src/commands/, etc.) with per-file byte counts and directory subtotals
- Persist per-module breakdown to `.planning/baselines/build-analysis.json` alongside existing `bundle-size.json`
- Granularity: per source file — every .js file in the bundle gets a byte count
- Warn (don't fail) if any single module exceeds a size threshold (e.g., 50KB) — only the existing total bundle budget is a hard gate

### Manifest-based deploy sync
- Build step generates `manifest.json` listing all deployable files (paths only, no hashes)
- Deploy script reads manifest to determine what to copy and what to delete from target
- Stale files at deploy target: delete with printed summary of what was removed
- First deploy (no previous manifest at target): full copy, write manifest, no deletions
- Manifest is existence-based sync — all listed files are copied every time, unlisted files at target are removed

### Performance baseline capture & storage
- Dedicated `npm run baseline` script — independent from build (build still tracks bundle size only)
- Init timing: run `gsd-tools.cjs` 3-5 times, take median to reduce cold/warm cache noise
- File I/O counting: instrument fs.readFileSync/writeFileSync in source with counter wrapper, report totals at end of run
- Storage: single `baselines/performance.json` file, overwritten each run — git history preserves previous snapshots
- Fields: init_timing_ms (median), init_timing_runs (array), fs_read_count, fs_write_count, bundle_size_kb, timestamp

### Dev tool configuration scope
- Install knip and madge as devDependencies (`npm install --save-dev knip madge`)
- Add dedicated npm scripts: `npm run audit:dead-code` (knip) and `npm run audit:circular` (madge)
- knip targets `src/` only — commands/workflows/templates are .md files, not analyzable code
- madge targets `src/` directory — analyzes the source module graph, not the built bundle

### Agent's Discretion
- Exact warning threshold for per-module size (50KB suggested, agent can adjust based on current distribution)
- Manifest file location within the build output (bin/manifest.json or similar)
- Number of init timing runs (3-5, agent picks based on noise observed)
- knip and madge config file format (inline in package.json vs separate config files)
- Exact fs instrumentation approach (monkey-patch vs wrapper module)

</decisions>

<specifics>
## Specific Ideas

- Build already tracks bundle size in `.planning/baselines/bundle-size.json` — new analysis file sits alongside it
- Deploy script already creates timestamped backups — manifest sync replaces the copy-only approach, backup stays as safety net
- The bundle is currently ~1216KB against a 1500KB budget — per-module attribution will reveal where the weight is before Phase 63 starts removing dead code
- esbuild has native metafile support (`metafile: true` option) — no external tooling needed for build analysis

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 61-tooling-safety-net*
*Context gathered: 2026-03-06*
