# Phase 163: Shared Contracts & Safe Mutation - Research

Researched on 2026-03-30 against the current repo state.

This phase should harden the mutation path, not the read path. The repo already has the right building blocks in isolated places: SQLite WAL + busy timeout (`src/lib/db.js:461-502`, `src/plugin/lib/db-cache.js:267-327`), transactional session writes (`src/lib/planning-cache.js:1263-1311`), temp-file + rename for handoffs (`src/lib/phase-handoff.js:373-408`), and a plugin-side lock for one tool (`src/plugin/tools/bgsd-progress.js:20-107`). The problem is that the touched mutation surfaces do not use one shared contract. They mix direct whole-file rewrites, best-effort SQLite side effects, duplicated parsers/defaults, and inconsistent locking.

The planning target is therefore clear: centralize writes for touched state/session/config/storage flows behind one canonical mutator layer that owns read-refresh, lock acquisition, Markdown patch/render, SQLite transaction, mtime/cache updates, and rollback semantics. Do not plan a broad architecture rewrite; plan a focused extraction that moves the currently duplicated state/config/memory/handoff write logic onto shared primitives while preserving existing file formats.

## Standard Stack

### Canonical mutation substrate

| Component | Current repo standard | Use in this phase | Why standard here |
|---|---|---|---|
| SQLite engine | built-in `node:sqlite` `DatabaseSync` via `src/lib/db.js` and `src/plugin/lib/db-cache.js` | Keep as the durable coordination store | Already configured with WAL + busy timeout and already backs session/cache tables |
| Durable metadata DB | `.planning/.cache.db` | Make it the transaction anchor for touched state/session/storage mutations | Existing tables already cover `session_state`, `session_decisions`, `session_metrics`, `session_blockers`, `session_continuity`, and memory stores |
| Markdown persistence | existing `.planning/*.md` files | Preserve as user-facing artifacts, but write through shared mutators | Backward compatibility is a hard project rule |
| Atomic file publish | temp file + `renameSync` pattern from `writePhaseHandoff` | Standardize for JSON/Markdown writes that replace whole files | Current direct `writeFileSync` rewrites are race-prone |
| Concurrency control | directory lock pattern from `src/plugin/tools/bgsd-progress.js` | Extract into shared lock helper and reuse across CLI + plugin mutation flows | Only one surface currently coordinates writes |
| Cache freshness | `PlanningCache.updateMtime/checkFreshness/invalidateFile` | Keep, but run from the canonical mutator only | Current callers update mtimes inconsistently |

### High-risk mutation surfaces to cover first

| Surface | Current files | Current problem | Phase 163 directive |
|---|---|---|---|
| State/session dual-write | `src/commands/state.js`, `src/plugin/tools/bgsd-progress.js`, `src/plugin/parsers/state.js`, `src/lib/planning-cache.js`, `src/plugin/lib/db-cache.js` | Same conceptual mutation implemented multiple ways; SQLite and Markdown can drift on partial failure | Build one shared state/session mutation contract and migrate touched callers to it |
| Memory JSON + SQLite dual-write | `src/commands/memory.js`, `src/commands/lessons.js`, `src/commands/trajectory.js` | Lock-free read/modify/write of whole JSON files plus best-effort SQLite append | Add shared locked append/update helpers; do not let each command roll its own store rewrite |
| Phase handoffs | `src/lib/phase-handoff.js`, `src/commands/state.js` | Per-file atomic rename exists, but run cleanup and multi-step updates are still unlocked | Fold handoff writes into shared lock discipline |
| Config contract | `src/lib/config.js`, `src/plugin/parsers/config.js`, `src/commands/misc.js`, `src/plugin/idle-validator.js` | Read defaults/shape duplicated; writes bypass a single schema-aware mutator | Create one shared config read/write contract and make plugin + CLI consume it |

### Current code facts the plan should assume

- SQLite session writes are already available and reusable through `PlanningCache` (`src/lib/planning-cache.js:1032-1493`).
- `cmdStateCompletePlan` is the only touched state path that attempts anything close to atomic core behavior (`src/commands/state.js:1198-1288`), and even it leaves metric/session tail writes outside the core transaction (`src/commands/state.js:1290-1327`).
- Most other state commands update SQLite first, then rewrite `STATE.md` with regex, with no rollback if the second step fails (`src/commands/state.js:574-643`, `645-705`, `955-1008`, `1011-1195`).
- Plugin `bgsd_progress` adds a lock, but only for that one tool; CLI state/memory/handoff/config mutations still run lock-free (`src/plugin/tools/bgsd-progress.js:78-107`).
- Memory commands rewrite entire JSON arrays from stale reads (`src/commands/memory.js:398-456`, `611-712`; `src/commands/lessons.js:194-231`; `src/commands/trajectory.js:66-184`).

## Architecture Patterns

### 1. One canonical mutator per domain, not per command

Create shared mutation modules under source control that both CLI and plugin can call. Minimum domains for this phase:

1. `state-session-mutator`
2. `memory-store-mutator`
3. `handoff-mutator`
4. `config-mutator`

Each mutator should own this sequence:

1. acquire project-scoped lock
2. refresh from disk/SQLite if mtime changed
3. compute next canonical document/data model
4. persist durable core in SQLite transaction
5. publish Markdown/JSON with temp-file + rename
6. update file-cache mtimes + invalidate parser caches
7. release lock

Do not leave any touched caller performing its own read/regex/write flow after this extraction.

### 2. Canonical state/session mutation contract

Use `STATE.md` as the compatibility artifact and SQLite as the durable structured core, but derive both from one mutation payload. The mutator should accept intent-level operations such as:

- `setPosition`
- `appendDecision`
- `appendBlocker`
- `resolveBlocker`
- `recordContinuity`
- `completePlanCore`

Internally, that mutator should:

- read current structured state once
- calculate the next canonical structured model once
- write all affected SQLite session tables in one transaction
- render the matching `STATE.md` content from that canonical model, not from ad hoc regex snippets

Preserve regex patching only as a compatibility fallback for legacy sections the canonical renderer cannot yet safely regenerate.

### 3. Locked whole-file mutation pattern for memory and handoff stores

For JSON-backed stores, standardize on:

- lock
- read current file
- apply pure transform
- write temp file
- rename into place
- then update SQLite mirror in the same locked critical section

`writePhaseHandoff()` already demonstrates the right file publish primitive (`src/lib/phase-handoff.js:384-386`). Reuse that pattern instead of raw `writeFileSync`.

### 4. Shared schema/default contract for config

Treat `CONFIG_SCHEMA` in `src/lib/constants.js` / `src/lib/config.js` as the single contract source. Remove plugin-local default drift by generating or sharing the same normalized config shape for:

- CLI reads (`loadConfig`)
- plugin reads (`parseConfig`)
- CLI writes (`cmdConfigSet`, `cmdConfigMigrate`)
- plugin repairs (`idle-validator`)

The plugin should not maintain its own hardcoded config defaults while CLI uses schema-driven defaults.

### 5. Recommended plan split

Plan this phase in three slices:

1. **Shared mutation primitives** — extract project lock helper, atomic file writer, and shared SQLite-backed mutation helpers used by both runtimes.
2. **State/session hardening** — migrate `src/commands/state.js` and `src/plugin/tools/bgsd-progress.js` onto one shared state/session contract; make Markdown + SQLite updates come from one canonical payload.
3. **Storage/config hardening** — migrate memory stores, handoff writes, and config writes/repairs onto the same locking + atomic publish contract; remove duplicate config normalization logic.

That split keeps FOUND-01/02/04 directly traceable and avoids mixing planning-index or verifier work from later phases.

## Don't Hand-Roll

| Problem | Do not keep doing this | Use instead |
|---|---|---|
| State updates | Per-command regex rewrite + separate `cache.storeSessionState()` call | Shared state/session mutator that computes one next model and persists both representations |
| Memory store writes | Command-local `readFileSync` → mutate array → `writeFileSync` | Shared locked JSON-store helper with temp-file publish and SQLite mirror step |
| Config normalization | Duplicated hardcoded defaults in plugin plus separate CLI schema logic | One schema-driven config normalizer and one config writer |
| Concurrency handling | Surface-specific ad hoc lock logic | One reusable project-scoped lock helper across CLI + plugin |
| Partial durability | Best-effort dual-write where Markdown or SQLite can succeed alone | Explicit core transaction + file publish + rollback/error contract |
| Cache sync | Manually sprinkling `updateMtime()` / parser invalidation | Mutator-owned post-commit cache synchronization |

## Common Pitfalls

### 1. Best-effort dual-write still loses FOUND-01

Current repo behavior often updates SQLite and Markdown in separate steps with no rollback (`src/commands/state.js:574-643`, `645-705`, `955-1008`, `1011-1195`; `src/plugin/tools/bgsd-progress.js:132-264`). If the second write fails, the two views diverge.

**Plan rule:** no touched state/session mutation may call SQLite and Markdown writers independently.

### 2. Locking only the plugin tool does not solve concurrent CLI writes

`bgsd_progress` uses a lock directory (`src/plugin/tools/bgsd-progress.js:44-107`), but `state`, `memory`, `lessons`, `trajectory`, `config-set`, and handoff writes do not. Concurrent commands can still overwrite each other.

**Plan rule:** the lock helper must be reused by CLI and plugin mutations, not left inside one tool.

### 3. Whole-file JSON rewrites silently drop concurrent updates

`cmdMemoryWrite`, `writeLessonsStore`, and trajectory checkpointing all read the whole file, mutate an in-memory array, then overwrite the file (`src/commands/memory.js:398-456`; `src/commands/lessons.js:194-231`; `src/commands/trajectory.js:66-184`). Two writers racing here will lose one append.

**Plan rule:** every touched JSON store must move to locked transform + atomic publish.

### 4. Duplicated config defaults will drift again unless one source is removed

CLI config derives from `CONFIG_SCHEMA` (`src/lib/config.js:30-69`). Plugin config parsing hardcodes its own defaults and merge rules (`src/plugin/parsers/config.js:19-156`). `idle-validator` also writes a truncated default object (`src/plugin/idle-validator.js:237-245`).

**Plan rule:** there must be exactly one config normalization contract and exactly one default source.

### 5. Regex-only state mutation is format-fragile

The repo supports many legacy headings/field spellings, and current state commands patch them with targeted regexes. That preserves compatibility, but it also means every new state command re-implements section matching.

**Plan rule:** centralize legacy parsing/compatibility handling once; individual commands should request semantic mutations, not author new regexes.

### 6. `invalidateState()` only clears `session_state`

Plugin state invalidation clears the in-memory cache and deletes `session_state`, but not related session tables (`src/plugin/parsers/state.js:236-250`). If a future mutator assumes invalidation means all session-derived views are reset, it will be wrong.

**Plan rule:** canonical mutators must update/invalidate every affected table explicitly rather than relying on parser invalidation as a repair strategy.

## Code Examples

### Good seed: SQLite transaction for core state + decisions

Use `storeSessionCompletionCore()` as the starting shape for canonical session writes because it already bundles related table updates in one transaction.

```js
// src/lib/planning-cache.js:1263-1311
cache.storeSessionCompletionCore(cwd, {
  state: completionState,
  decisions: [decision],
});
```

Extend this pattern so all touched state/session mutations go through equivalent transaction-scoped helpers.

### Good seed: temp-file + rename publish

`writePhaseHandoff()` already uses the correct file publish primitive for replacing a JSON artifact.

```js
// src/lib/phase-handoff.js:384-386
const tempPath = `${filePath}.tmp-${process.pid}`;
fs.writeFileSync(tempPath, JSON.stringify(artifact, null, 2) + '\n', 'utf-8');
fs.renameSync(tempPath, filePath);
```

Reuse this for touched Markdown/JSON writers instead of direct `writeFileSync(target, content)`.

### Good seed: project-scoped lock discipline

`bgsd_progress` proves the repo can coordinate writes with a simple directory lock.

```js
// src/plugin/tools/bgsd-progress.js:44-107
const lockDir = join(projectDir, '.planning', '.lock');
mkdirSync(lockDir); // atomic on POSIX
// ... mutate ...
rmdirSync(lockDir);
```

Extract this into shared code and make all touched CLI/plugin mutators use it.

### Bad current pattern to replace: best-effort dual-write

```js
// src/commands/state.js:1017-1049 (representative)
cache.writeSessionDecision(cwd, decision); // first side effect
content = content.replace(sectionPattern, `${match[1]}${sectionBody}`);
fs.writeFileSync(statePath, content, 'utf-8'); // second side effect
```

This is the core anti-pattern for FOUND-01 and FOUND-02. Replace it with one semantic mutator that owns both writes.

### Bad current pattern to replace: lock-free JSON append

```js
// src/commands/memory.js:400-456 (representative)
const raw = fs.readFileSync(filePath, 'utf-8');
entries = JSON.parse(raw);
entries.push(entry);
fs.writeFileSync(filePath, JSON.stringify(entries, null, 2), 'utf-8');
```

This is the core anti-pattern for concurrent memory/handoff-affecting commands. Replace it with locked transform + atomic publish.
