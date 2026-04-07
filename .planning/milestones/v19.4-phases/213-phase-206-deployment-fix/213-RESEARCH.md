# Phase 213: Phase 206 Deployment Fix - Research

**Researched:** 2026-04-06
**Domain:** CLI Deployment / Build Artifacts
**Confidence:** HIGH

## Summary

Phase 213 closes GAP-I1 by deploying the updated CLI that includes Phase 206's TDD validator implementation. The milestone audit identified that the installed CLI (1287012 bytes, built 07:25) was outdated compared to DEV (1290582 bytes, built 08:44), causing users to see "not yet implemented" when running `execute:tdd validate-red`.

Current state shows DEV at 1297962 bytes and installed at 1297865 bytes (97 byte delta, likely banner timestamp). The `validate-red/green/refactor` subcommands are now present in the installed CLI.

**Primary recommendation:** Verify deployed CLI has Phase 206 implementation, then run regression suite to confirm REGR-01 through REGR-08.

## Standard Stack

### Core
| Component | Version | Purpose |
|-----------|---------|---------|
| esbuild | latest | Bundles src/ into single-file CLI |
| Node.js | 18+ | Runtime for CLI |
| bash | any | deploy.sh orchestration |

### Deployment Pipeline
| Step | Tool | Purpose |
|------|------|---------|
| Build | `npm run build` → esbuild | Bundle src/index.js → bin/bgsd-tools.cjs |
| Sync | deploy.sh manifest-based | Sync deployable files to ~/.config/opencode/ |
| Smoke test | `bgsd-tools.cjs util:current-timestamp` | Verify deployed artifact runs |
| Path substitution | sed | Replace `__OPENCODE_CONFIG__` placeholders |

## Architecture Patterns

### Single-File CLI
The CLI is a single bundled file (`bin/bgsd-tools.cjs`) built via esbuild with:
- `treeShaking: true` for dead code elimination
- `minify: true` for size reduction
- `banner` with timestamp via `BGSD_INCLUDE_BENCHMARKS` flag

### Manifest-Based Deployment
`bin/manifest.json` lists all deployable files. deploy.sh:
1. Builds from source
2. Backs up current installation
3. Copies files listed in manifest
4. Removes stale files (in old manifest but not new)
5. Substitutes path placeholders
6. Runs smoke test

## Don't Hand-Roll

| Problem | Don't Build | Use Instead |
|---------|-------------|-------------|
| CLI bundling | Custom require() bundler | esbuild |
| Path substitution | Hardcoded paths | `__OPENCODE_CONFIG__` placeholder + sed |
| File sync | rsync/full-copy | Manifest-based diff sync |

## Common Pitfalls

### Pitfall 1: Bundle size regression
**What goes wrong:** New code increases bundle past 1550KB budget, build fails.
**Why it happens:** Tree-shaking not enabled or large dependencies added.
**How to avoid:** build.cjs enforces BUNDLE_BUDGET_KB = 1550 with exit(1) on breach.
**Warning signs:** esbuild output shows bundle_size > 1550KB.

### Pitfall 2: Timestamp drift causing false mismatches
**What goes wrong:** Banner contains build timestamp, causing DEV and installed sizes to differ by ~100 bytes even when content is identical.
**Why it happens:** `global.BGSD_INCLUDE_BENCHMARKS = <bool>` banner set at build time.
**How to avoid:** Compare actual command output, not just file size.
**Warning signs:** Size delta ~97 bytes with no code changes.

### Pitfall 3: Stale files after deployment
**What goes wrong:** Old files remain in installed location after deploy.
**Why it happens:** Files removed from source but old manifest still references them.
**How to avoid:** deploy.sh uses comm -23 to find and remove stale files.

## Code Examples

### Deployment Verification
```bash
# Compare sizes (account for timestamp drift)
ls -la bin/bgsd-tools.cjs  # DEV
ls -la ~/.config/opencode/bgsd-oc/bin/bgsd-tools.cjs  # Installed

# Verify TDD subcommands present
node ~/.config/opencode/bgsd-oc/bin/bgsd-tools.cjs execute:tdd validate-red --help

# Smoke test
node ~/.config/opencode/bgsd-oc/bin/bgsd-tools.cjs util:current-timestamp --raw
```

### Regression Test Run
```bash
npm test  # Full test suite (762+ tests)
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manual file copy | Manifest-based deploy | v19.x | Atomic, auditable deployments |
| Hardcoded paths | `__OPENCODE_CONFIG__` placeholder | v19.x | Config-agnostic deployment |

## Open Questions

1. **Was deploy.sh run manually after the audit?** The sizes suggest it was run, but Phase 213 should formally verify and close GAP-I1.
2. **Is the 97-byte delta just timestamp?** Need to verify content equivalence, not just size.

## Sources

### Primary (HIGH confidence)
- build.cjs — build pipeline definition
- deploy.sh — deployment orchestration
- v19.4-MILESTONE-AUDIT.md — gap documentation

### Secondary (MEDIUM confidence)
- ROADMAP.md — phase dependencies

## Metadata

**Confidence breakdown:** HIGH — direct evidence from milestone audit, file sizes, and command output verification.
**Research date:** 2026-04-06
**Valid until:** Phase 213 execution complete
