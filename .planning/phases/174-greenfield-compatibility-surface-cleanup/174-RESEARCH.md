# Phase 174: Greenfield Compatibility Surface Cleanup - Research

**Researched:** 2026-03-31
**Domain:** Greenfield-only CLI/config/schema cleanup for bGSD's JJ/workspace-first model
**Confidence:** HIGH

## User Constraints

- Prefer deletion, flattening, and source-of-truth reduction over new abstraction.
- Preserve supported JJ/workspace-first behavior and canonical command families while removing legacy-only paths.
- Remove retired compatibility surfaces by default; only still-supported parsers may emit explicit unsupported-shape errors.
- Active mutating/planning/runtime paths should hard-fail on non-canonical config/planning shapes; no rewrite-on-read normalization on supported paths.
- Docs, help, and templates must be canonical-only; do not keep migration notes for obsolete worktree-era or upgrade-era behavior.
- Do not allow hidden/internal compatibility behavior on active paths; delete historical fallback mappings and mirrored normalization wherever they survive, while keeping only resilience fallbacks that still protect supported environments.
- When removing a route or command surface, delete its docs, help text, discovery entries, and tests in the same change so no contract drift survives.
- Keep the inspect/health-style diagnostic lane intentionally narrow for this phase; broader diagnostic-lane removal is deferred.

## Phase Requirements

- **CLEAN-01:** Remove migration-only commands and helpers for legacy installs, storage transitions, or obsolete local-state upgrades.
- **CLEAN-02:** Remove planning/config normalization paths that only support superseded file shapes while canonical `.planning/` artifacts still parse and validate.
- **CLEAN-03:** Align docs, templates, and help text to the supported JJ/workspace-first model.

## Summary

Phase 174 should be planned as a deletion-first contract cleanup, not a refactor-heavy feature phase. The strongest repo-local evidence is that compatibility logic still survives in four forms: explicit upgrade commands (`util:config-migrate`), one-time JSON→SQLite migration helpers (`migrateMemoryStores()`), rewrite-on-read planning normalization for legacy TDD metadata in both CLI and plugin parsers, and stale published guidance or registries that still advertise retired worktree-era or pre-canonical command names.

The safest implementation posture is: remove high-confidence dead compatibility surfaces first, then tighten canonical parsing, then clean guidance and discovery surfaces, and only then prune medium-confidence hidden registries and output shims. Preserve explicit unsupported errors where a supported parser still encounters a legacy key (`worktree` in config is already the right pattern), and pair each removal with targeted regression checks so Phase 174 reduces surface area without reopening supported JJ/workspace behavior.

**Primary recommendation:** Plan Phase 174 around source-of-truth reduction: delete migration-only commands/helpers, remove every mirrored write-on-read normalization path so no hidden compatibility behavior survives, and delete stale docs/help/tests/registry entries in the same slices that remove retired routes.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Node.js | `>=18` | Runtime for the single-file CLI and build/test tooling | Project contract in `package.json`; all touched cleanup must preserve Node 18+ compatibility |
| Jujutsu (`jj`) workspace commands | Current official docs | Canonical local execution/workspace model | Official JJ docs explicitly say `git-worktree` is not supported and direct users to `jj workspace` |
| Valibot | `^1.2.0` | Runtime schema validation for canonical config/data contracts | Standard lightweight validation library already shipped in repo dependencies |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| fast-glob | `^3.3.3` | Fast file pattern matching | Keep for canonical discovery/search flows; do not replace with hand-rolled traversal during cleanup |
| SQLite-backed planning cache | repo-internal | Canonical persisted cache/memory backend | Keep canonical cache paths; remove only migration/import bridges that exist for historical JSON stores |
| Git (colocated under JJ) | current supported system tool | Backing repo interoperability under JJ | Preserve colocated/JJ-backed behavior, but do not reintroduce Git-worktree product guidance |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Hard deletion of compatibility surfaces | Keep deprecated aliases/stubs | Violates locked greenfield-only posture and preserves split-brain product behavior |
| Canonical parse + explicit unsupported errors | Rewrite legacy shapes on read | Easier short-term compatibility, but directly conflicts with locked canonical-schema enforcement |
| Existing libraries (`valibot`, `fast-glob`) | Custom validators or file walkers | Adds fresh maintenance surface during a cleanup phase whose goal is reduction |

## Architecture Patterns

### Recommended Project Structure

Plan cleanup work by compatibility surface, not by file type:
1. **Migration-only commands/helpers** — router/help/tests/docs for `util:config-migrate`, JSON→SQLite import helpers.
2. **Canonical schema enforcement** — CLI helpers plus mirrored plugin parser normalization paths.
3. **Published guidance** — docs, templates, troubleshooting/help text, workflow text.
4. **Discovery/registry cleanup** — stale NL/discovery entries and hidden fallback mappings.

### Pattern 1: Canonical active path + explicit unsupported error

Use the existing `src/lib/config.js` pattern as the model: reject legacy `worktree` config immediately with a direct error instead of silently mapping it. Phase 174 should extend this posture to other retired config/planning shapes.

### Pattern 2: Delete write-on-read normalization from every reader, not just one

Legacy TDD normalization exists in `src/lib/helpers.js` and is mirrored again in `src/plugin/parsers/roadmap.js`. Cleanup must remove both the CLI and plugin copies in the same phase slice; any surviving mirror counts as forbidden hidden compatibility behavior.

### Pattern 3: One canonical command/discovery source of truth

Router/help/discovery/registry surfaces should converge on routed commands only. If a command name is absent from `src/router.js` and help surfaces but still appears in NL/discovery registries, delete the stale registry entry instead of inventing a compatibility alias.

### Anti-Patterns to Avoid

- Removing public surfaces in code without deleting the matching help/docs/tests/discovery contract.
- Deleting only one half of duplicated normalization logic and leaving the plugin or parser side still mutating files on read.
- Conflating resilience fallbacks with historical compatibility fallbacks.
- Replacing deleted compatibility code with new abstraction layers “for future flexibility.”
- Broad delete passes without regression proof on routed commands and canonical planning artifacts.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Legacy config support | Silent field remapping or auto-migration | Explicit unsupported error at parse boundary | Matches locked phase policy and current `worktree` rejection pattern |
| Legacy planning/schema support | Rewrite-on-read normalization | Canonical parser + targeted diagnostic lane only where already allowed | Prevents hidden support from surviving behind the scenes |
| File discovery during cleanup | Custom recursive fs traversal | `fast-glob`-backed discovery already in stack | Keeps cleanup small and consistent |
| Config validation | Ad-hoc object checks | Existing schema contract / Valibot-backed validation paths | Avoids new validation drift during cleanup |
| Memory-store transition behavior | New upgrade adapters | Canonical SQLite/current stores only | Phase goal is to remove obsolete transitions, not replace them |

## Common Pitfalls

### Pitfall 1: Deleting the route but not the surrounding contract
**What goes wrong:** `util:config-migrate` can disappear from the router while remaining in help text, docs, tests, audits, or built bundles.  
**Why it happens:** The command surface is duplicated across `src/router.js`, `src/lib/constants.js`, `src/lib/commandDiscovery.js`, docs, and tests.  
**How to avoid:** Treat each retired command as a contract-removal checklist and require the deletion set to land together: route, help, discovery, docs, workflow text, tests, audits, built bundle. A route removal is incomplete until those companions are removed too.  
**Warning signs:** Unknown-command output, docs, or tests still mention deleted command names.

### Pitfall 2: Hidden write-on-read compatibility surviving in a mirrored parser
**What goes wrong:** CLI cleanup removes normalization but plugin/parsers still rewrite legacy TDD metadata on read.  
**Why it happens:** Legacy normalization logic is duplicated between `src/lib/helpers.js` and `src/plugin/parsers/roadmap.js`.  
**How to avoid:** Plan schema cleanup as mirrored deletions with parity verification on both CLI and plugin readers. Do not allow a leftover parser, plugin, or diagnostic helper to keep compatibility behavior alive behind the scenes.  
**Warning signs:** Any code path still calls `readRoadmapWithTddNormalization()` or `normalizePhasePlanFilesTddMetadata()`.

### Pitfall 3: Confusing resilience fallbacks with compatibility shims
**What goes wrong:** Cleanup accidentally removes protections for supported environments while trying to remove historical fallbacks.  
**Why it happens:** Some fallback code is operationally useful; other fallback code exists only to preserve retired behavior.  
**How to avoid:** Classify each candidate explicitly as canonical resilience vs historical compatibility before deletion.  
**Warning signs:** A fallback is still referenced by current JJ/workspace flows or protects required tool availability.

### Pitfall 4: Registry drift after command-family cleanup
**What goes wrong:** NL/discovery surfaces still map to non-routed commands such as `verify:phase`, `verify:work`, `session:progress`, `roadmap:show`, or `milestone:new`.  
**Why it happens:** These registries are easy to overlook because they are not the primary router.  
**How to avoid:** Diff registry/discovery command inventories against routed/help-backed commands and delete stale entries instead of preserving aliases.  
**Warning signs:** Greps find command names in `src/lib/nl/*` that do not exist in router/help.

### Pitfall 5: Guidance drift around workspace-first behavior
**What goes wrong:** Runtime rejects `worktree`, but docs still teach worktree config or worktree-based execution modes.  
**Why it happens:** Published docs outside templates/tests have not all been updated since the JJ/workspace transition.  
**How to avoid:** Include docs/help/templates as first-class scope, especially `docs/configuration.md`, `docs/expert-guide.md`, `docs/troubleshooting.md`, and related architecture docs.  
**Warning signs:** Any shipped docs still show `worktree.*` keys or describe isolated Git worktrees as the supported model.

## Code Examples

Verified patterns from official sources and current repo code.

### 1. Preferred unsupported-shape rejection pattern

Source: `src/lib/config.js:17-19`

```js
if (parsed && typeof parsed === 'object' && Object.prototype.hasOwnProperty.call(parsed, 'worktree')) {
  error('Legacy `.planning/config.json.worktree` is no longer supported. Migrate to `.planning/config.json.workspace` with supported JJ settings like `base_path` and `max_concurrent` before running bGSD commands.');
}
```

Use this pattern for any still-supported parser that encounters a retired legacy key: fail explicitly, do not normalize.

### 2. Cleanup target: write-on-read roadmap normalization

Source: `src/lib/helpers.js:101-113`, mirrored in `src/plugin/parsers/roadmap.js:33-46`

```js
function readRoadmapWithTddNormalization(cwd) {
  const roadmapPath = path.join(cwd, '.planning', 'ROADMAP.md');
  const original = cachedReadFile(roadmapPath);
  if (!original) return null;

  const normalized = normalizeRoadmapTddMetadata(original);
  if (normalized.changed) {
    fs.writeFileSync(roadmapPath, normalized.content, 'utf-8');
    invalidateFileCache(roadmapPath);
    return normalized.content;
  }

  return original;
}
```

Phase 174 should remove this rewrite-on-read behavior from active paths.

### 3. Cleanup target: migration-only local-state import

Source: `src/lib/planning-cache.js:521-530`, callers in `src/commands/init.js:1960` and `src/commands/memory.js:500-503`

```js
/**
 * One-time JSON → SQLite migration for memory stores.
 */
migrateMemoryStores(cwd) {
  ...
}
```

This is a classic migration bridge: remove it only with caller cleanup and test replacement so canonical stores remain the only supported path.

### 4. Cleanup target: stale registry entries outside routed command surface

Source: `src/lib/nl/command-registry.js:17-45`

```js
{ phrase: 'verify phase', command: 'verify:phase', intent: 'verify' },
{ phrase: 'show progress', command: 'session:progress', intent: 'query' },
{ phrase: 'show roadmap', command: 'roadmap:show', intent: 'query' },
{ phrase: 'new milestone', command: 'milestone:new', intent: 'plan' },
```

These names do not appear in `src/router.js` or help constants, so Phase 174 should treat them as stale discovery debt unless a supported route is intentionally restored.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Git worktree-first execution guidance | JJ/workspace-first execution guidance | Established in Phase 155-156 and reinforced by current JJ docs | Phase 174 should delete remaining worktree-era docs, not preserve them |
| Upgrade helpers for config/local state | Greenfield-only supported config/stores | Current milestone requirements and Phase 174 context | Migration-only commands/importers are now product drag |
| Rewrite old planning metadata into canonical form on read | Enforce canonical shape on active paths | Locked for Phase 174 | Removes hidden compatibility behavior and reduces parser sprawl |
| Parallel registries advertising legacy commands | Routed canonical command families | Ongoing cleanup direction from milestone requirements | Discovery/help drift must be pruned, not expanded |

## Open Questions

- Should Phase 174 fully remove `migrateMemoryStores()` now, or first narrow it behind the deferred inspect/health-style diagnostic lane? Current context leans toward full removal from active paths.
- Are any stale NL registry entries intentionally retained for non-user-facing experiments? Repo evidence currently suggests they are drift, but planner should verify before deleting broad NL buckets.
- Should plugin-side roadmap normalization be removed in the same plan slice as CLI-side normalization? Recommendation: yes, to avoid hidden split behavior.

## Sources

### Primary (HIGH confidence)
- Phase context: `.planning/phases/174-greenfield-compatibility-surface-cleanup/174-CONTEXT.md`
- Requirements: `.planning/REQUIREMENTS.md`
- PRD: `.planning/research/GREENFIELD-COMPAT-CLEANUP-PRD.md`
- Current repo evidence:
  - `src/lib/config.js`
  - `src/lib/helpers.js`
  - `src/plugin/parsers/roadmap.js`
  - `src/lib/planning-cache.js`
  - `src/commands/misc.js`
  - `src/router.js`
  - `src/lib/commandDiscovery.js`
  - `src/lib/nl/command-registry.js`
  - `docs/configuration.md`
  - `docs/expert-guide.md`
  - `docs/troubleshooting.md`
  - `tests/infra.test.cjs`
  - `tests/integration.test.cjs`
  - `tests/worktree.test.cjs`
  - `tests/contracts.test.cjs`
- Official JJ docs:
  - https://docs.jj-vcs.dev/latest/git-compatibility/
  - https://docs.jj-vcs.dev/latest/cli-reference/

### Secondary (MEDIUM confidence)
- Context7 Valibot docs (`/fabian-hiller/valibot`) for current validation-library role
- Context7 fast-glob docs (`/mrmlnc/fast-glob`) for current file-discovery role

### Tertiary (LOW confidence)
- Brave search result pointing to JJ Git compatibility doc; used only as discovery path, not as sole evidence

## Metadata

**Confidence breakdown:** HIGH for migration-only command/helper targets, write-on-read normalization targets, and worktree-era guidance drift; MEDIUM for breadth of stale NL/discovery registry cleanup until each entry is contract-checked.  
**Research date:** 2026-03-31  
**Valid until:** Next command-surface or config-contract restructuring that materially changes router/discovery ownership.
