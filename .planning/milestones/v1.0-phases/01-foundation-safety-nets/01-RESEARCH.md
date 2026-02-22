# Phase 1: Foundation & Safety Nets — Research

**Researched:** 2026-02-22
**Domain:** Node.js CLI testing, config schema extraction, package.json setup
**Confidence:** HIGH

## Summary

Phase 1 establishes the safety net required before any refactoring in later phases. It delivers five concrete outputs: (1) a single `CONFIG_SCHEMA` constant that replaces three independent config definitions, (2) round-trip tests for all 8 state mutation commands, (3) round-trip tests for the frontmatter extract→reconstruct cycle, (4) a `package.json` formalizing Node 18+ and test/build scripts, and (5) a one-line documentation fix in AGENTS.md.

The technical risk is concentrated in the CONFIG_SCHEMA extraction. The three current config sources (`loadConfig()` at line 158, `cmdConfigEnsureSection()` at line 616, and `cmdValidateConfig()` at line 5932) use different field names and different structural patterns (flat vs. nested vs. schema-with-metadata). The research below provides a complete field mapping table and a recommended schema structure. The testing work is straightforward — the project already has a well-established black-box testing pattern using `node:test`, temp directories, and JSON output parsing.

**Primary recommendation:** Start with the CONFIG_SCHEMA extraction (highest-leverage refactor, prerequisite for clean config testing), then tests (state mutations first — highest data-corruption risk), then package.json (quick win), then DOC-01 (trivial).

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| FOUND-02 | Single `CONFIG_SCHEMA` constant — `loadConfig()`, `cmdConfigEnsureSection()`, and `cmdValidateConfig()` all derive from one canonical schema with alias mappings | Config field mapping table in Architecture section. Three-source comparison identifies all fields, aliases, structural differences, and type metadata. |
| FOUND-03 | State mutation tests — round-trip tests for all 8 state mutation commands | All 8 commands documented with signatures, behaviors, and edge cases in Code Examples section. Test patterns match existing `node:test` black-box approach. |
| FOUND-04 | Frontmatter round-trip tests — extract→reconstruct cycle verified lossless | Frontmatter parser analyzed (lines 251-323, 326-388). Edge cases identified: nested objects, inline arrays, quoted strings with colons, empty arrays, multi-level nesting. |
| FOUND-05 | `package.json` with name, version, engines, scripts, devDependencies | Standard Node.js package.json pattern. No package.json exists yet. Engines: `>=18`, scripts: `test` and `build` (build is placeholder until Phase 4). |
| DOC-01 | Fix stale line count in AGENTS.md (says 5400+, actual is 6,495+) | AGENTS.md line 11 confirmed stale. Actual: 6,495 lines. Single line edit. |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| node:test | Node 18+ built-in | Test runner | Zero dependencies, already used in existing 2,302-line test file |
| node:assert | Node 18+ built-in | Assertions | Strict mode (`strictEqual`, `deepStrictEqual`), already established |
| node:child_process | Node 18+ built-in | CLI subprocess testing | `execSync` for black-box command invocation, existing pattern |
| node:fs | Node 18+ built-in | Fixture creation/cleanup | Temp directory pattern already established |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| node:os | Node 18+ built-in | Temp directory creation | `os.tmpdir()` for test fixture dirs |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| node:test | jest/vitest | Would add external deps, violating zero-dependency testing pattern |
| Black-box CLI tests | Unit tests with imports | Would require exporting functions from gsd-tools.cjs, breaking single-file encapsulation |
| Inline fixture data | Shared fixture files | Shared fixtures create coupling between tests; inline is the established pattern |

**Installation:**
No installation needed — all tools are Node.js built-ins. The `package.json` creation is itself a deliverable, not a dependency.

## Architecture Patterns

### Config Schema Structure

The central deliverable is a `CONFIG_SCHEMA` constant. Based on analysis of all three current sources, the recommended structure:

```javascript
const CONFIG_SCHEMA = {
  model_profile:              { type: 'string',  default: 'balanced', aliases: [], nested: null,                                    description: 'Active model profile' },
  commit_docs:                { type: 'boolean', default: true,       aliases: [], nested: { section: 'planning', field: 'commit_docs' },  description: 'Auto-commit planning docs' },
  search_gitignored:          { type: 'boolean', default: false,      aliases: [], nested: { section: 'planning', field: 'search_gitignored' }, description: 'Include gitignored files in searches' },
  branching_strategy:         { type: 'string',  default: 'none',     aliases: [], nested: { section: 'git', field: 'branching_strategy' },  description: 'Git branching strategy' },
  phase_branch_template:      { type: 'string',  default: 'gsd/phase-{phase}-{slug}', aliases: [], nested: { section: 'git', field: 'phase_branch_template' }, description: 'Phase branch name template' },
  milestone_branch_template:  { type: 'string',  default: 'gsd/{milestone}-{slug}',   aliases: [], nested: { section: 'git', field: 'milestone_branch_template' }, description: 'Milestone branch name template' },
  research:                   { type: 'boolean', default: true,       aliases: ['research_enabled'], nested: { section: 'workflow', field: 'research' }, description: 'Enable research phase' },
  plan_checker:               { type: 'boolean', default: true,       aliases: [],                  nested: { section: 'workflow', field: 'plan_check' }, description: 'Enable plan checking' },
  verifier:                   { type: 'boolean', default: true,       aliases: [],                  nested: { section: 'workflow', field: 'verifier' },   description: 'Enable verification phase' },
  parallelization:            { type: 'boolean', default: true,       aliases: [], nested: null, description: 'Enable parallel plan execution', coerce: 'parallelization' },
  brave_search:               { type: 'boolean', default: false,      aliases: [], nested: null, description: 'Enable Brave Search API' },
  // Fields only in cmdValidateConfig but should be canonical:
  mode:                       { type: 'string',  default: 'interactive', aliases: [], nested: null, description: 'Execution mode (interactive or yolo)' },
  model_profiles:             { type: 'object',  default: {},         aliases: [], nested: null, description: 'Model assignments per agent' },
  depth:                      { type: 'string',  default: 'standard', aliases: [], nested: null, description: 'Planning depth' },
  test_commands:              { type: 'object',  default: {},         aliases: [], nested: null, description: 'Test commands by framework' },
  test_gate:                  { type: 'boolean', default: true,       aliases: [], nested: null, description: 'Block plan completion on test failure' },
};
```

### Config Field Mapping Table (Three-Source Comparison)

This is the critical analysis — the exact field-by-field comparison:

| Canonical Key | `loadConfig()` (line 158) | `cmdConfigEnsureSection()` (line 616) | `cmdValidateConfig()` (line 5932) | Notes |
|---|---|---|---|---|
| `model_profile` | `model_profile` (flat) | `model_profile` (flat) | `model_profile` (string) | Consistent across all three |
| `commit_docs` | `commit_docs` (flat, nested `planning.commit_docs`) | `commit_docs` (flat) | `commit_docs` (boolean) | loadConfig reads nested alias |
| `search_gitignored` | `search_gitignored` (flat, nested `planning.search_gitignored`) | `search_gitignored` (flat) | — **MISSING** | Not in validate schema |
| `branching_strategy` | `branching_strategy` (flat, nested `git.branching_strategy`) | `branching_strategy` (flat) | — **MISSING** | Not in validate schema |
| `phase_branch_template` | `phase_branch_template` (flat, nested `git.phase_branch_template`) | `phase_branch_template` (flat) | — **MISSING** | Not in validate schema |
| `milestone_branch_template` | `milestone_branch_template` (flat, nested `git.milestone_branch_template`) | `milestone_branch_template` (flat) | — **MISSING** | Not in validate schema |
| `research` | `research` (flat, nested `workflow.research`) | `workflow.research` (**NESTED**) | — **MISSING** (has `research_enabled` alias) | **Key mismatch**: loadConfig uses flat `research`, ensure-section uses nested `workflow.research`, validate uses `research_enabled` |
| `plan_checker` | `plan_checker` (flat, nested `workflow.plan_check`) | `workflow.plan_check` (**NESTED**) | — in `workflow` object | **Key mismatch**: flat key is `plan_checker`, nested field is `plan_check` |
| `verifier` | `verifier` (flat, nested `workflow.verifier`) | `workflow.verifier` (**NESTED**) | — in `workflow` object | Consistent name, but flat vs nested |
| `parallelization` | `parallelization` (boolean, coerced from object) | `parallelization` (flat boolean) | `parallelization` (boolean) | loadConfig has special coercion for `{enabled: true}` format |
| `brave_search` | `brave_search` (flat) | `brave_search` (auto-detected) | — **MISSING** | ensure-section auto-detects from env/file |
| `mode` | — **MISSING** | — **MISSING** | `mode` (string, default 'interactive') | Only in validate |
| `model_profiles` | — **MISSING** | — **MISSING** | `model_profiles` (object) | Only in validate |
| `depth` | — **MISSING** | — **MISSING** | `depth` (string) | Only in validate |
| `test_commands` | — **MISSING** | — **MISSING** | `test_commands` (object) | Only in validate |
| `test_gate` | — **MISSING** | — **MISSING** | `test_gate` (boolean) | Only in validate |
| `workflow` | — (reads nested subfields) | writes as nested object | `workflow` (object) | Structural container, not a direct value |

**Key findings from mapping:**
1. **5 fields are only in `cmdValidateConfig()`** — `mode`, `model_profiles`, `depth`, `test_commands`, `test_gate`. These must be added to `loadConfig()` defaults.
2. **5 fields are missing from `cmdValidateConfig()`** — `search_gitignored`, `branching_strategy`, `phase_branch_template`, `milestone_branch_template`, `brave_search`. Validate will flag these as "unknown key" — a bug.
3. **`research` has 3 names** — `research` (loadConfig flat), `workflow.research` (ensure-section nested), `research_enabled` (validate). The schema must map all three.
4. **`plan_checker` vs `plan_check`** — loadConfig reads flat `plan_checker`, but the nested path uses `plan_check`. Both must work.
5. **`parallelization` has special coercion** — accepts `true`, `false`, or `{enabled: true}`. This coercion logic must live in or near the schema.

### How to Derive Functions from CONFIG_SCHEMA

```javascript
// loadConfig() derives defaults from schema
function loadConfig(cwd) {
  const defaults = {};
  for (const [key, def] of Object.entries(CONFIG_SCHEMA)) {
    defaults[key] = def.default;
  }
  // ... rest of config loading with get() helper using def.nested for alias lookup
}

// cmdValidateConfig() derives knownKeys from schema  
function cmdValidateConfig(cwd, raw) {
  const knownKeys = {};
  for (const [key, def] of Object.entries(CONFIG_SCHEMA)) {
    knownKeys[key] = { type: def.type, default: def.default, description: def.description };
  }
  // ... validation logic unchanged
}

// cmdConfigEnsureSection() derives hardcoded defaults from schema
function cmdConfigEnsureSection(cwd, raw) {
  const hardcoded = {};
  for (const [key, def] of Object.entries(CONFIG_SCHEMA)) {
    if (def.nested) {
      // Reconstruct nested structure for written config.json
      if (!hardcoded[def.nested.section]) hardcoded[def.nested.section] = {};
      hardcoded[def.nested.section][def.nested.field] = def.default;
    } else {
      hardcoded[key] = def.default;
    }
  }
  // ... merge with user defaults, write file
}
```

### State Mutation Command Inventory

All 8 state mutation commands and their behavior:

| # | Command | Function | Line | What It Mutates | How |
|---|---------|----------|------|-----------------|-----|
| 1 | `state update <field> <value>` | `cmdStateUpdate()` | 1169 | Single `**Field:** value` line | Regex replace |
| 2 | `state patch --field val ...` | `cmdStatePatch()` | 1141 | Multiple `**Field:** value` lines | Batch regex replace |
| 3 | `state add-decision` | `cmdStateAddDecision()` | 1309 | Decisions section (append bullet) | Section find + append |
| 4 | `state add-blocker` | `cmdStateAddBlocker()` | 1336 | Blockers section (append bullet) | Section find + append |
| 5 | `state resolve-blocker` | `cmdStateResolveBlocker()` | 1359 | Blockers section (remove bullet) | Section find + filter |
| 6 | `state record-session` | `cmdStateRecordSession()` | 1391 | Session fields (Last session, Stopped at, Resume file) | Multiple field replace |
| 7 | `state advance-plan` | `cmdStateAdvancePlan()` | 1208 | Current Plan number, Status, Last Activity | Field replace + increment |
| 8 | `state record-metric` | `cmdStateRecordMetric()` | 1237 | Performance Metrics table (append row) | Section find + table append |

### Test Structure for State Mutations

Each test follows the established pattern:
1. `createTempProject()` → creates temp dir with `.planning/phases/`
2. Write a STATE.md with known content into temp dir
3. Run `node gsd-tools.cjs <command> <args>` against temp dir
4. Read STATE.md back and verify content changed correctly
5. Parse JSON output and verify return value

**Minimum STATE.md fixture for all 8 commands:**
```markdown
# Project State

## Current Position

**Phase:** 1 of 3 (Foundation)
**Current Plan:** 1
**Total Plans in Phase:** 3
**Plan:** 01-01 — Setup
**Status:** In progress
**Last Activity:** 2026-01-01

**Progress:** [░░░░░░░░░░] 0%

## Performance Metrics

| Plan | Duration | Tasks | Files |
|------|----------|-------|-------|
| - | - | - | - |

## Accumulated Context

### Decisions

None yet.

### Blockers/Concerns

None yet.

## Session Continuity

**Last session:** 2026-01-01
**Stopped at:** Phase 1 setup
**Resume file:** None
```

### Anti-Patterns to Avoid
- **Don't export functions from gsd-tools.cjs:** The single-file encapsulation is intentional. All testing is black-box via CLI invocation.
- **Don't create shared fixture files:** Each test creates its own inline fixtures. Shared fixtures create coupling.
- **Don't mock the filesystem:** Tests use real temp directories. This is the established pattern and catches real I/O issues.
- **Don't change config behavior while extracting schema:** The schema extraction must be behavior-preserving. The exact same config.json files must produce the exact same results.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Test runner | Custom test harness | `node:test` (built-in) | Already used, zero deps, stable in Node 18+ |
| Assertion library | Custom assertion helpers | `node:assert` strict mode | Already used, descriptive failure messages |
| YAML parsing | External YAML library | Existing `extractFrontmatter()` | Zero-dependency constraint; custom parser works for project's YAML subset |
| JSON schema validation | Schema validation library | Simple object comparison | Only 16 config fields; a library is overkill |

**Key insight:** This phase adds no new dependencies. Everything is built on Node.js built-ins and existing project patterns.

## Common Pitfalls

### Pitfall 1: Config Schema Extraction Drops Field Aliases
**What goes wrong:** Extracting a single schema but failing to handle the 3-way name differences (`research` vs `workflow.research` vs `research_enabled`, `plan_checker` vs `plan_check`). Real config.json files using the old names break.
**Why it happens:** The three definitions evolved independently over time.
**How to avoid:** The field mapping table above is the prevention. Build CONFIG_SCHEMA with explicit `aliases` and `nested` fields. Write a test that loads a config.json with every alias variant and verifies loadConfig() returns the correct value.
**Warning signs:** `cmdValidateConfig()` reports "unknown key" warnings for keys that loadConfig() actually reads.

### Pitfall 2: State Mutation Tests That Don't Verify Round-Trip
**What goes wrong:** Tests check the command's JSON return value but don't re-read STATE.md to verify the file was actually mutated correctly.
**Why it happens:** It's easier to just check `output.updated === true` than to read the file back.
**How to avoid:** Every state mutation test MUST: (1) write initial STATE.md, (2) run command, (3) check JSON output, AND (4) read STATE.md back and verify content.
**Warning signs:** Tests pass but state mutations silently corrupt files.

### Pitfall 3: Frontmatter Round-Trip Lossy for Edge Cases
**What goes wrong:** `extractFrontmatter()` → `reconstructFrontmatter()` cycle loses data for edge cases like values containing colons (e.g., `name: "Phase: Setup"`), empty objects converted to arrays, or deeply nested structures.
**Why it happens:** The custom YAML parser handles a subset of YAML. `reconstructFrontmatter()` may not reconstruct exactly what was parsed.
**How to avoid:** Test specific edge cases documented in CONCERNS.md: nested objects, arrays, inline arrays `[a, b]`, quoted strings with colons, empty arrays, 3-level nesting.
**Warning signs:** Frontmatter set/merge operations silently drop or alter fields.

### Pitfall 4: cmdConfigEnsureSection Writes Nested, loadConfig Reads Flat
**What goes wrong:** `cmdConfigEnsureSection()` writes `{ workflow: { research: true, plan_check: true } }` but `loadConfig()` looks for flat `research` first. A fresh config.json works because `loadConfig()` also checks nested paths. But if you simplify the schema to only generate flat keys, existing nested config.json files break.
**Why it happens:** The nested→flat translation in `loadConfig()` is intentional backward compatibility.
**How to avoid:** CONFIG_SCHEMA must preserve both paths. The `nested` field in the schema definition tells `loadConfig()` where to look for aliases. The `cmdConfigEnsureSection()` output format should remain nested (it's the "official" format written to new projects).
**Warning signs:** Fresh projects work, but projects with custom config.json files that use nested keys break.

### Pitfall 5: package.json Breaks deploy.sh
**What goes wrong:** Adding a `package.json` with a `build` script that doesn't work yet (Phase 4 delivers esbuild). Running `npm run build` fails.
**Why it happens:** Phase 1 creates package.json but esbuild isn't added until Phase 4.
**How to avoid:** Make the `build` script a no-op or echo that says "Build system not configured yet — see Phase 4". The `test` script should work immediately: `"test": "node --test bin/gsd-tools.test.cjs"`.
**Warning signs:** `npm run build` fails, `deploy.sh` hasn't been updated yet.

## Code Examples

### State Mutation Test Pattern (for FOUND-03)

```javascript
// Source: existing pattern from bin/gsd-tools.test.cjs
describe('state add-decision command', () => {
  let tmpDir;
  beforeEach(() => { tmpDir = createTempProject(); });
  afterEach(() => { cleanup(tmpDir); });

  test('appends decision to Decisions section', () => {
    fs.writeFileSync(path.join(tmpDir, '.planning', 'STATE.md'),
      '# State\n\n### Decisions\n\nNone yet.\n\n### Blockers\n\nNone.\n');

    const result = runGsdTools(
      'state add-decision --phase 1 --summary "Use esbuild for bundling" --rationale "Fastest CJS bundler"',
      tmpDir
    );
    assert.ok(result.success, `Command failed: ${result.error}`);
    const output = JSON.parse(result.output);
    assert.strictEqual(output.added, true, 'decision should be added');

    // CRITICAL: Verify file content round-trip
    const content = fs.readFileSync(path.join(tmpDir, '.planning', 'STATE.md'), 'utf-8');
    assert.ok(content.includes('Use esbuild for bundling'), 'STATE.md should contain decision');
    assert.ok(!content.includes('None yet'), 'placeholder should be removed');
  });
});
```

### Frontmatter Round-Trip Test Pattern (for FOUND-04)

```javascript
// Source: project convention extrapolated from extractFrontmatter/reconstructFrontmatter analysis
describe('frontmatter round-trip', () => {
  test('simple key-value survives extract→reconstruct', () => {
    const original = '---\ntitle: My Plan\nphase: 3\nstatus: active\n---\n\n# Content';
    const extracted = extractFrontmatter(original);  // Would need CLI command
    // Use frontmatter-get and frontmatter-set commands for black-box testing
  });

  test('inline array survives round-trip', () => {
    const input = '---\ntags: [foo, bar, baz]\n---\n\n# Body';
    // Write file, run frontmatter-get, modify, run frontmatter-set, verify
  });

  test('nested object with colons in values survives round-trip', () => {
    const input = '---\nconfig:\n  name: "Phase: Setup"\n  items: [a, b]\n---\n\n# Body';
    // Verify colons in values are preserved through extract→reconstruct
  });
});
```

**Note:** Frontmatter round-trip testing uses the `frontmatter-get` and `frontmatter-merge` CLI commands for black-box testing. Alternatively, a dedicated test can write a file with known frontmatter, invoke `frontmatter-get` to extract, invoke `frontmatter-set` to write back, and verify the file content is unchanged.

### CONFIG_SCHEMA Constant (for FOUND-02)

```javascript
// Source: field mapping analysis above
// Place at module level, before loadConfig() (around line 148)

const CONFIG_SCHEMA = {
  model_profile: {
    type: 'string',
    default: 'balanced',
    description: 'Active model profile (quality/balanced/budget)',
    aliases: [],
    nested: null,
  },
  commit_docs: {
    type: 'boolean',
    default: true,
    description: 'Auto-commit planning docs',
    aliases: [],
    nested: { section: 'planning', field: 'commit_docs' },
  },
  // ... (full schema per Architecture section above)
};
```

### package.json (for FOUND-05)

```json
{
  "name": "gsd-tools",
  "version": "1.0.0",
  "description": "CLI utility for GSD workflow operations",
  "bin": {
    "gsd-tools": "./bin/gsd-tools.cjs"
  },
  "engines": {
    "node": ">=18"
  },
  "scripts": {
    "test": "node --test bin/gsd-tools.test.cjs",
    "build": "echo 'Build system not yet configured — see Phase 4 (BUILD-01)'"
  },
  "devDependencies": {},
  "private": true
}
```

**Notes:**
- `private: true` — this is not published to npm
- `version: "1.0.0"` — starting version for the improvement pass
- No `main` field — this is a CLI tool, not a library
- `devDependencies` empty until Phase 4 adds esbuild
- `build` script is a placeholder — Phase 4 delivers the real build system

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Three independent config definitions | Single CONFIG_SCHEMA constant | This phase | Eliminates field drift, false "unknown key" warnings |
| Zero state mutation tests | 8 round-trip test suites | This phase | Catches regex regression in data-mutating code |
| No package.json | Formal package.json with engines | This phase | `npm test` works, Node 18+ requirement declared |
| Stale line count (5400+) | Accurate count (6,495+) | This phase | Documentation accuracy |

**Deprecated/outdated:**
- node:test snapshot API (requires Node 22+) — deferred to v2 requirements (TEST-01). Not used in Phase 1.

## Open Questions

1. **`cmdConfigEnsureSection()` output format: should it remain nested or go flat?**
   - What we know: It currently writes nested format (`workflow: { research: true }`), `loadConfig()` reads both flat and nested. Real-world config.json files exist in both formats.
   - What's unclear: Whether future config.json files should prefer flat or nested.
   - Recommendation: Keep writing nested format (it's more organized for humans). CONFIG_SCHEMA handles the translation. No behavior change.

2. **Should CONFIG_SCHEMA include the `brave_search` auto-detection from `cmdConfigEnsureSection()`?**
   - What we know: `cmdConfigEnsureSection()` auto-detects Brave API key presence and sets `brave_search` accordingly. This is runtime behavior, not schema.
   - What's unclear: Whether the schema's `default: false` should be dynamic.
   - Recommendation: Keep `default: false` in schema. The auto-detection is a `cmdConfigEnsureSection()` behavior — it overrides the default at write time. Schema defines structure, not runtime logic.

3. **Golden fixtures from event-pipeline for state mutation tests**
   - What we know: STATE.md says "Golden fixture selection from event-pipeline needed before state mutation tests"
   - What's unclear: Whether to use real event-pipeline STATE.md or craft minimal synthetic fixtures.
   - Recommendation: Use **minimal synthetic fixtures** for unit tests (faster, no external dependency), but add one **integration test** that runs against the real event-pipeline STATE.md as a sanity check. The synthetic fixture should cover all 8 section patterns that the mutation commands target.

4. **Should `parallelization` coercion be encoded in CONFIG_SCHEMA?**
   - What we know: `loadConfig()` has special logic: `{enabled: true}` → `true`. This is the only field with complex coercion.
   - What's unclear: Whether to add a `coerce` field to schema or keep it as inline logic.
   - Recommendation: Add a `coerce: 'parallelization'` flag in the schema entry. The actual coercion function stays as a named helper. This documents the special case without overcomplicating the schema.

## Sources

### Primary (HIGH confidence)
- Direct code analysis of `bin/gsd-tools.cjs` (6,495 lines) — loadConfig() lines 156-207, cmdConfigEnsureSection() lines 579-644, cmdValidateConfig() lines 5907-5984, all 8 state mutation commands lines 1108-1424, extractFrontmatter() lines 251-323, reconstructFrontmatter() lines 326-388
- Direct code analysis of `bin/gsd-tools.test.cjs` (2,302 lines) — test patterns, helpers, existing 18 test suites
- `.planning/codebase/CONCERNS.md` — config drift analysis, test coverage gaps, frontmatter fragility
- `.planning/codebase/CONVENTIONS.md` — naming patterns, output pattern, error handling conventions
- `.planning/codebase/TESTING.md` — test framework, fixtures, coverage inventory
- `.planning/research/SUMMARY.md` — phase ordering rationale, pitfall documentation

### Secondary (MEDIUM confidence)
- `.planning/STATE.md` — current blockers and decisions affecting Phase 1
- `.planning/REQUIREMENTS.md` — formal requirement definitions for FOUND-02 through FOUND-05, DOC-01

### Tertiary (LOW confidence)
- None — all findings are based on direct code inspection, no external sources needed for this phase.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all Node.js built-ins, already used in project
- Architecture (CONFIG_SCHEMA): HIGH — complete field mapping from direct code analysis of all three sources
- Architecture (test patterns): HIGH — established patterns from existing 2,302-line test file
- Pitfalls: HIGH — every pitfall grounded in specific code locations and field mapping analysis

**Research date:** 2026-02-22
**Valid until:** Indefinite — this phase uses only stable Node.js built-ins and project-internal patterns. No external library versions to track.
