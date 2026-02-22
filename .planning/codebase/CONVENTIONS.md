# Coding Conventions

**Analysis Date:** 2026-02-21

## Language & Runtime

**Primary Language:** JavaScript (Node.js, CommonJS)
- Zero external dependencies — only `fs`, `path`, `child_process` from Node stdlib
- Single-file architecture: all logic in `bin/gsd-tools.cjs` (6,495 lines, 103 functions)
- Shebang: `#!/usr/bin/env node`

## Naming Patterns

**Functions — Helpers:**
- `camelCase` with descriptive verbs
- Pure utility functions at file top (lines 148-480)
- Examples: `safeReadFile()`, `loadConfig()`, `normalizePhaseName()`, `extractFrontmatter()`, `reconstructFrontmatter()`

**Functions — Command Handlers:**
- Prefix `cmd` + PascalCase command name
- 79 command functions total
- Pattern: `cmdStateLoad()`, `cmdPhaseAdd()`, `cmdRoadmapAnalyze()`, `cmdInitExecutePhase()`
- Compound commands use `cmdInit` prefix: `cmdInitPlanPhase()`, `cmdInitExecutePhase()`

**Functions — Internal Helpers (non-exported):**
- Suffix `Internal` for functions used by both commands and compound init
- Examples: `findPhaseInternal()`, `resolveModelInternal()`, `getRoadmapPhaseInternal()`, `searchPhaseInDir()`, `generateSlugInternal()`

**Variables:**
- `camelCase` throughout: `phaseDir`, `roadmapContent`, `summaryPath`
- Configuration keys use `snake_case` in JSON output: `phase_number`, `plan_count`, `has_research`
- Constants are `UPPER_SNAKE_CASE`: `MODEL_PROFILES`

**Command-line Arguments:**
- Kebab-case for CLI subcommands: `phase-plan-index`, `roadmap get-phase`, `state-snapshot`
- Double-dash flags: `--raw`, `--force`, `--phase`, `--name`, `--fields`

## File Organization

**Sections are delimited by ASCII line separators:**
```javascript
// --- Model Profile Table -------------------------------------------------------

// --- Helpers -------------------------------------------------------------------

// --- Commands ------------------------------------------------------------------

// --- State Progression Engine --------------------------------------------------

// --- Frontmatter CRUD ---------------------------------------------------------

// --- Compound Commands ---------------------------------------------------------

// --- main() dispatch -----------------------------------------------------------
```

**Ordering within `bin/gsd-tools.cjs`:**
1. Shebang + header comment (lines 1-124) — full CLI usage documentation
2. Constants: `MODEL_PROFILES` (lines 130-144)
3. Helper functions (lines 146-486) — `safeReadFile`, `loadConfig`, `execGit`, `normalizePhaseName`, `extractFrontmatter`, `reconstructFrontmatter`, `parseMustHavesBlock`, `output`, `error`
4. Command functions (lines 488-5990) — 79 `cmd*` functions
5. Compound init commands (lines 4059-4985) — `cmdInit*` functions
6. Feature commands (lines 5012-5990) — session-diff, context-budget, test-run, etc.
7. `main()` dispatch function (lines 6008-6495) — switch/case routing

## Output Pattern

**All commands use the `output()` / `error()` pattern:**

```javascript
// Success — structured JSON to stdout
function output(result, raw, rawValue) {
  if (raw && rawValue !== undefined) {
    process.stdout.write(String(rawValue));  // --raw: compact string
  } else {
    const json = JSON.stringify(result, null, 2);  // Default: pretty JSON
    if (json.length > 50000) {
      // Large payloads write to tmpfile with @file: prefix
      const tmpPath = path.join(require('os').tmpdir(), `gsd-${Date.now()}.json`);
      fs.writeFileSync(tmpPath, json, 'utf-8');
      process.stdout.write('@file:' + tmpPath);
    } else {
      process.stdout.write(json);
    }
  }
  process.exit(0);
}

// Failure — message to stderr, exit code 1
function error(message) {
  process.stderr.write('Error: ' + message + '\n');
  process.exit(1);
}
```

**Rules for new commands:**
- Always call `output(result, raw)` or `output(result, raw, rawValue)` for success
- Always call `error('descriptive message')` for unrecoverable failures
- Return structured JSON objects with descriptive keys
- Include a `rawValue` third argument when `--raw` should output a compact string
- For "soft" errors (file not found but not fatal), include `error` key in result JSON instead of calling `error()`

**Soft error pattern (don't crash, return info):**
```javascript
if (!fs.existsSync(fullPath)) {
  output({ error: 'File not found', path: summaryPath }, raw);
  return;
}
```

## Error Handling

**Try-catch with silent fallback — the dominant pattern:**
```javascript
try {
  const content = fs.readFileSync(filePath, 'utf-8');
  // ... process
} catch {
  return null;  // or return defaults
}
```

- Empty `catch {}` blocks are intentional and widespread — used for "check if exists" operations
- Never re-throw errors from file operations or git commands
- `safeReadFile()` wraps all file reads that might not exist
- `execGit()` wraps all git commands, returns `{ exitCode, stdout, stderr }` instead of throwing
- `loadConfig()` returns defaults object on any parse failure

**Guard-and-exit pattern for required parameters:**
```javascript
function cmdSomeCommand(cwd, requiredParam, raw) {
  if (!requiredParam) {
    error('description of what is required');
  }
  // ... proceed
}
```

**Graceful degradation for optional data:**
```javascript
// Nullable fields default to null or empty arrays
const result = {
  current_phase: currentPhase,         // null if not found
  decisions: decisions || [],           // empty array fallback
  session: { last_date: null, ... },   // structured with null defaults
};
```

## Command Signature Pattern

**Every command handler follows this signature:**
```javascript
function cmdXxx(cwd, [specific params...], raw) {
  // 1. Validate required params (guard clauses)
  // 2. Build file paths from cwd
  // 3. Read and parse files
  // 4. Compute result
  // 5. Call output(result, raw) or output(result, raw, rawValue)
}
```

- `cwd` is always the first parameter — the project root directory
- `raw` is always the last parameter — the `--raw` flag boolean
- Specific params come between `cwd` and `raw`

## Argument Parsing

**Manual argument parsing in `main()` — no library:**
```javascript
const args = process.argv.slice(2);
const raw = args.includes('--raw');
if (raw) args.splice(args.indexOf('--raw'), 1);
const command = args[0];
```

**Flag extraction pattern:**
```javascript
const phaseIndex = args.indexOf('--phase');
const phase = phaseIndex !== -1 ? args[phaseIndex + 1] : null;
```

**Multi-word value collection:**
```javascript
const nameIndex = args.indexOf('--name');
const nameArgs = [];
for (let i = nameIndex + 1; i < args.length; i++) {
  if (args[i].startsWith('--')) break;
  nameArgs.push(args[i]);
}
const name = nameArgs.join(' ') || null;
```

## Regex Patterns

**Markdown field extraction — the core parsing pattern:**
```javascript
// **Field Name:** value  (bold markdown key-value)
const pattern = new RegExp(`\\*\\*${fieldName}:\\*\\*\\s*(.+)`, 'i');
```

- Used extensively in STATE.md, ROADMAP.md parsing
- Case-insensitive (`'i'` flag)
- Field names are regex-escaped before use: `field.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')`

**Phase header matching — supports multiple heading depths:**
```javascript
// Matches ##, ###, or #### Phase headers
/#{2,4}\s*Phase\s+(\d+(?:\.\d+)?)\s*:\s*([^\n]+)/
```

**Backward compatibility — optional colon after bold fields:**
```javascript
// **Goal:** value  OR  **Goal** value  (both accepted)
/\*\*Goal:?\*\*:?\s*(.+)/i
/\*\*Depends on:?\*\*:?\s*(.+)/i
/\*\*Plans:?\*\*:?\s*(.+)/i
/\*\*Requirements:?\*\*:?\s*(.+)/i
```

**Phase number normalization:**
```javascript
function normalizePhaseName(phase) {
  const match = phase.match(/^(\d+(?:\.\d+)?)/);
  const parts = num.split('.');
  const padded = parts[0].padStart(2, '0');  // 6 → 06
  return parts.length > 1 ? `${padded}.${parts[1]}` : padded;
}
```

**File pattern matching for phase directories:**
```javascript
const plans = phaseFiles.filter(f => f.endsWith('-PLAN.md') || f === 'PLAN.md').sort();
const summaries = phaseFiles.filter(f => f.endsWith('-SUMMARY.md') || f === 'SUMMARY.md').sort();
```

**Regex for dynamic phase references in ROADMAP.md (used in renumbering):**
```javascript
// Phase headers: ### Phase 18: Name → ### Phase 17: Name
new RegExp(`(#{2,4}\\s*Phase\\s+)${oldStr}(\\s*:)`, 'gi')
// Phase references: Phase 18 → Phase 17
new RegExp(`(Phase\\s+)${oldStr}([:\\s])`, 'g')
// Plan references: 18-01 → 17-01
new RegExp(`${oldPad}-(\\d{2})`, 'g')
// Depends on references
new RegExp(`(Depends on:?\\*\\*:?\\s*Phase\\s+)${oldStr}\\b`, 'gi')
```

## YAML Frontmatter Handling

**Custom YAML parser (no library):**
- `extractFrontmatter()` at line 251 — handles nested objects, arrays, inline arrays `[a, b]`, and quoted values
- `reconstructFrontmatter()` at line 326 — serializes back to YAML-like format
- `spliceFrontmatter()` at line 390 — replaces frontmatter in a document, preserving body
- Supports up to 3 levels of nesting with indentation-based parsing
- Frontmatter delimited by `---\n...\n---`

## Markdown Document Conventions

**Workflow files (`workflows/*.md`):**
- Use XML-like tags for structure: `<purpose>`, `<core_principle>`, `<process>`, `<step>`, `<required_reading>`
- Steps have `name` attributes: `<step name="initialize" priority="first">`
- Bash commands use fenced code blocks with full paths to gsd-tools.cjs
- Reference other files with `@` prefix: `@/home/cam/.config/opencode/get-shit-done/references/ui-brand.md`

**Template files (`templates/*.md`):**
- Contain markdown templates wrapped in fenced code blocks
- Use `[placeholder]` bracket notation for fill-in values
- Include frontmatter schemas for structured documents

**Reference files (`references/*.md`):**
- Use XML-like tags: `<core_principle>`, `<stub_detection>`, `<react_components>`
- Heavy use of fenced code blocks for examples
- Structured as reference material for AI agents

**Planning document naming:**
- Phase directories: `{NN}-{slug}` (e.g., `01-foundation`, `02.1-hotfix`)
- Plan files: `{NN}-{MM}-PLAN.md` (e.g., `03-01-PLAN.md`)
- Summary files: `{NN}-{MM}-SUMMARY.md` (e.g., `03-01-SUMMARY.md`)
- Phase-level files: `{NN}-CONTEXT.md`, `{NN}-RESEARCH.md`, `{NN}-VERIFICATION.md`, `{NN}-UAT.md`
- Root files: `STATE.md`, `ROADMAP.md`, `REQUIREMENTS.md`, `PROJECT.md`, `MILESTONES.md` (all caps)

## Git Integration

**All git operations go through `execGit()` helper:**
```javascript
function execGit(cwd, args) {
  try {
    const escaped = args.map(a => {
      if (/^[a-zA-Z0-9._\-/=:@]+$/.test(a)) return a;
      return "'" + a.replace(/'/g, "'\\''") + "'";
    });
    const stdout = execSync('git ' + escaped.join(' '), { cwd, stdio: 'pipe', encoding: 'utf-8' });
    return { exitCode: 0, stdout: stdout.trim(), stderr: '' };
  } catch (err) {
    return { exitCode: err.status ?? 1, stdout: ..., stderr: ... };
  }
}
```

- Manual shell escaping — no shell injection via user input
- Returns structured result instead of throwing
- All `execSync` calls have `timeout` option (5000-15000ms)

## Configuration Handling

**Config lives in `.planning/config.json`:**
- `loadConfig()` returns defaults for ALL keys if file missing or malformed
- Supports both flat keys and nested `{ section: { field: value } }` format
- Boolean coercion for `parallelization`: accepts `true`, `false`, or `{ enabled: true }`
- No config validation on load — consumer functions handle missing/invalid values

## Code Style

**No formatter or linter configured** — consistent manual style:
- 2-space indentation
- Single quotes for strings
- Semicolons used consistently
- Template literals for string interpolation
- Arrow functions for callbacks, regular `function` declarations for named functions
- `const` for most declarations, `let` for mutable variables
- Ternary expressions for simple conditionals
- No TypeScript — pure JavaScript with no type annotations

## Comments

**Section headers use ASCII art dividers:**
```javascript
// --- Section Name -----------------------------------------------
```

**Inline comments are sparse but targeted:**
- Explain "why" not "what" for non-obvious logic
- Feature comments reference feature numbers: `// --- Session Diff (Feature 2) ---`
- Complex regex patterns get explanatory comments

**JSDoc:** Single file-level block comment documenting all commands (lines 3-124). No per-function JSDoc.

---

*Convention analysis: 2026-02-21*
