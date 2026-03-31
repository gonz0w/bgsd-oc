# Phase 129: Foundation & Agent Overrides - Research

**Researched:** 2026-03-15
**Domain:** CLI command implementation, YAML frontmatter parsing, unified diff generation, content sanitization
**Confidence:** HIGH

## Summary

Phase 129 adds four new CLI subcommands (`agent:list-local`, `agent:override`, `agent:diff`, `agent:sync`) to `bgsd-tools.cjs` and a `local_agent_overrides` field to the command enricher's `<bgsd-context>` block. The codebase already has strong foundations for all of these:

- **Command registration:** New subcommands slot into the existing `util:agent` namespace in `src/router.js` (lines 959-969), backed by `src/commands/agent.js` which already exports `cmdAgentList`, `cmdAgentAudit`, and `cmdAgentValidateContracts`. Adding new exports (`cmdAgentListLocal`, `cmdAgentOverride`, `cmdAgentDiff`, `cmdAgentSync`) follows the exact same pattern.
- **Agent file format:** Global agents live at `~/.config/opencode/agents/<name>.md` (10 files currently). Each is YAML frontmatter (`---\n...\n---`) followed by a Markdown body. The frontmatter parser at `src/lib/frontmatter.js` handles extraction and reconstruction, and `src/commands/agent.js:scanAgents()` already reads/parses them.
- **Enricher extension:** The command enricher (`src/plugin/command-enricher.js`) builds a JSON `enrichment` object and wraps it in `<bgsd-context>`. Adding `local_agent_overrides: string[]` is a single `try/catch` block reading `.opencode/agents/` — same pattern as every other enrichment field.
- **Diff generation and YAML validation** require no external dependencies. Node.js provides everything needed for a line-level unified diff algorithm and YAML frontmatter validation using the existing `extractFrontmatter()` parser.

**Primary recommendation:** Implement all four commands in `src/commands/agent.js`, wire them through `src/router.js` under the existing `util:agent` namespace, add the enricher field in `src/plugin/command-enricher.js`, and add tests in `tests/agent.test.cjs`.

<user_constraints>

## User Constraints (from CONTEXT.md)

These decisions are LOCKED — planner must honor exactly:

1. **Override creation** (`agent:override <name>`): Full copy of global agent file; hard-error if already overridden (point user to `agent:diff`/`agent:sync`); validate only `name:` field in YAML frontmatter; output just the file path on success; fuzzy-suggest closest match on unknown name; auto-create `.opencode/agents/` silently; same filename as global; don't touch `.gitignore`
2. **Diff** (`agent:diff <name>`): Standard unified diff format; hard-error if no local override (hint: use `agent:override`); silent exit if no differences
3. **Sync** (`agent:sync <name>`): Show summary of changes, prompt accept/reject (whole-file); no backup (user has git); silent exit if no differences; one agent at a time only; hard-error if no local override
4. **Validation**: Parse frontmatter block; hard-error with line number on YAML failure; only `name:` required; validation runs on write only
5. **Sanitization**: Guards against both editor-name mangling AND structural injection; build generic layer; auto-fix silently
6. **List** (`agent:list-local`): Columnar table; show ALL global agents; columns: Name, Scope, Drift; scope values: `global` or `local-override`; drift shown as checkmark/delta symbols (only for overridden agents)

</user_constraints>

<phase_requirements>

## Phase Requirements

| Requirement | Description | Confidence |
|-------------|-------------|------------|
| LOCAL-01 | `agent:list-local` showing global + local with scope annotations | HIGH |
| LOCAL-02 | `agent:override <name>` creating project-local copy in `.opencode/agents/` | HIGH |
| LOCAL-03 | `agent:sync <name>` showing upstream changes with accept/reject | HIGH |
| LOCAL-04 | `agent:diff <name>` showing line-level unified diff | HIGH |
| LOCAL-05 | YAML frontmatter validation — missing `name:` is hard error | HIGH |
| LOCAL-06 | Content sanitization against system-prompt mangling | HIGH |
| LOCAL-07 | bgsd-context enricher `local_agent_overrides` field | HIGH |

</phase_requirements>

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Node.js `fs` | Built-in | File I/O (read global agents, write local overrides) | Already used throughout codebase |
| Node.js `path` | Built-in | Path resolution for agents dirs | Already used throughout codebase |
| `src/lib/frontmatter.js` | Internal | YAML frontmatter parse/reconstruct | Already handles all planning files; `extractFrontmatter()` parses, `reconstructFrontmatter()` rebuilds |
| `src/lib/output.js` | Internal | `output()` and `error()` for CLI output | Standard output pattern used by all 23 command modules |
| `src/lib/helpers.js` | Internal | `safeReadFile()`, `sanitizeShellArg()` | Already used by `agent.js` and `init.js` |
| `src/lib/commandDiscovery.js` | Internal | `levenshteinDistance()` for fuzzy name matching | Already used for command suggestions in router.js |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `src/lib/format.js` | Internal | ANSI color formatting for TTY table output | For `agent:list-local` columnar table (symbols: ✓ and Δ) |
| `src/plugin/command-enricher.js` | Internal | Command context enrichment | For adding `local_agent_overrides` field |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Custom YAML frontmatter parser | `js-yaml` npm package | Would violate zero-dependency constraint; existing `extractFrontmatter()` handles our YAML subset perfectly |
| Custom unified diff | `diff` npm package | Would violate zero-dependency constraint; Myers diff algorithm is ~40 lines of code |
| Git diff via child_process | `git diff --no-index` | Would require both files on disk and add subprocess overhead; inline diff is simpler and faster |

## Architecture Patterns

### Recommended Project Structure

New code goes in existing files — no new source modules needed:

```
src/commands/agent.js          # Add 4 new cmd* functions (extend existing file)
src/router.js                  # Add 4 new routes in util:agent switch block (lines 959-969)
src/plugin/command-enricher.js # Add local_agent_overrides enrichment block
tests/agent.test.cjs           # Add test cases for new commands
```

### Pattern 1: Command Registration (existing pattern)

Every CLI command follows this structure in `src/commands/<module>.js`:

```javascript
function cmdAgentOverride(cwd, agentName, raw) {
  // 1. Validate inputs
  // 2. Do the work (file I/O, parsing)
  // 3. Call output(result, raw) for JSON/formatted output
  //    or error('message') for hard errors
}

module.exports = { cmdAgentOverride, /* ... */ };
```

Router registration in `src/router.js` under the existing `util:agent` block:

```javascript
} else if (agentSub === 'override') {
  lazyAgent().cmdAgentOverride(cwd, restArgs[1], raw);
} else if (agentSub === 'diff') {
  lazyAgent().cmdAgentDiff(cwd, restArgs[1], raw);
}
```

**Important:** The commands use `namespace:subcommand` syntax. Per CONTEXT.md, the commands are named `agent:override`, `agent:list-local`, etc. These map to `util:agent list-local`, `util:agent override <name>` in the router since `agent` is already a subcommand of `util`.

### Pattern 2: Global Agent Path Resolution (existing)

`src/commands/agent.js` already resolves the global agents directory:

```javascript
function resolveBgsdPaths() {
  const __OPENCODE_CONFIG__/bgsd-oc = resolved plugin path state || 
    path.join(process.env.HOME || '/tmp', '.config', 'oc', 'bgsd-oc');
  const agentsDir = path.join(path.dirname(__OPENCODE_CONFIG__/bgsd-oc), 'agents');
  return { __OPENCODE_CONFIG__/bgsd-oc, agentsDir };
}
```

This resolves to `~/.config/opencode/agents/` (sibling of the bgsd-oc directory). Reuse this directly.

### Pattern 3: Local Override Path

Per OC native behavior, project-local agent overrides go in `.opencode/agents/` relative to the project root. This path does NOT exist in any current source files — it's new for Phase 129.

```javascript
const localAgentsDir = path.join(cwd, '.opencode', 'agents');
```

### Pattern 4: Enricher Extension (existing pattern in command-enricher.js)

Every enrichment field follows this exact pattern:

```javascript
// Wrapped in try/catch — enrichment failure is never fatal
try {
  const localAgentsDir = join(resolvedCwd, '.opencode', 'agents');
  if (existsSync(localAgentsDir)) {
    const overrides = readdirSync(localAgentsDir)
      .filter(f => f.endsWith('.md'))
      .map(f => f.replace('.md', ''));
    if (overrides.length > 0) {
      enrichment.local_agent_overrides = overrides;
    }
  }
} catch { /* non-fatal */ }
```

### Anti-Patterns to Avoid

1. **Don't use child_process for diff** — inline diff algorithm is faster and has no subprocess overhead
2. **Don't parse full YAML** — the `extractFrontmatter()` parser handles our YAML subset; a full YAML parser isn't needed
3. **Don't create a separate `src/commands/agent-local.js` file** — extend the existing `src/commands/agent.js` (keeps code colocated)
4. **Don't use `fs.cpSync()`** — use `fs.readFileSync()` + sanitize + validate + `fs.writeFileSync()` (we need to transform content between read and write)
5. **Don't hardcode the editor name** — AGENTS.md warns that the Anthropic auth plugin rewrites literal editor names. Use `OC` or generic terms in any strings that might appear in system prompts

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| YAML frontmatter parsing | New YAML parser | `extractFrontmatter()` from `src/lib/frontmatter.js` | Already handles the exact YAML subset in agent files |
| Fuzzy name matching | Custom fuzzy matcher | `levenshteinDistance()` from `src/lib/commandDiscovery.js` | Already battle-tested, used for CLI command suggestions |
| CLI output formatting | Custom JSON/table serializer | `output()` from `src/lib/output.js` | Handles both raw JSON and TTY-formatted output modes automatically |
| Path resolution to global agents | Manual path construction | `resolveBgsdPaths()` from `src/commands/agent.js` | Already handles __OPENCODE_CONFIG__/bgsd-oc env var + fallback correctly |

## Common Pitfalls

### Pitfall 1: Editor Name Mangling in Override Content
**What goes wrong:** The Anthropic auth plugin rewrites ALL system prompt text, replacing the host editor name with "Claude Code". If an agent override file contains the literal editor name, paths and references get mangled.
**Why it happens:** Auth plugin runs string replacement on the entire system prompt, including content from `.opencode/agents/`.
**How to avoid:** The sanitization layer (LOCAL-06) must detect and neutralize editor name patterns before writing. Use regex patterns that match both the full editor name and its lowercase form. Replace with generic terms (`OC`, `host editor`).
**Warning signs:** File paths containing the editor name appear broken; config references point to wrong locations.

### Pitfall 2: YAML Frontmatter Without `name:` Field
**What goes wrong:** Agent files without a `name:` field in frontmatter may work in OC but produce confusing behavior when bgsd-tools tries to reference them.
**Why it happens:** OC doesn't require `name:` — it derives the name from the filename. But bgsd-tools uses `name:` for display in tables and diff headers.
**How to avoid:** Hard-error at `agent:override` creation time if the source global agent lacks `name:`. This catches the issue at the earliest possible point.
**Warning signs:** Blank or `null` values in the Name column of `agent:list-local`.

### Pitfall 3: Diff Algorithm Edge Cases
**What goes wrong:** Naive line-by-line diff produces noisy output when lines are merely reordered or when trailing whitespace differs.
**Why it happens:** Simple line comparison doesn't handle whitespace normalization.
**How to avoid:** Use a proper longest-common-subsequence (LCS) or Myers diff algorithm. Normalize trailing whitespace before comparison. The diff should be line-level only — character-level diff is unnecessary for agent files.
**Warning signs:** Diff output shows entire file as changed when only a few lines differ.

### Pitfall 4: Race Condition in Directory Creation
**What goes wrong:** Two concurrent `agent:override` calls could both check that `.opencode/agents/` doesn't exist, then both try to create it.
**Why it happens:** `fs.existsSync()` + `fs.mkdirSync()` is not atomic.
**How to avoid:** Use `fs.mkdirSync(dir, { recursive: true })` — it's a no-op if the directory already exists. This is idempotent.
**Warning signs:** `EEXIST` errors in override creation.

### Pitfall 5: Sync Accept Destroys User Changes Without Warning
**What goes wrong:** `agent:sync` with "accept" replaces the local file entirely with the global version, losing all user customizations.
**Why it happens:** Per CONTEXT.md, sync is whole-file accept/reject — no merge.
**How to avoid:** The diff summary shown before the accept/reject prompt must be clear about what changes the user will lose. The CONTEXT.md decision says "No backup of old local version before overwriting — user has git." This is a conscious design choice.
**Warning signs:** Users losing local customizations unexpectedly (mitigated by requiring explicit accept).

## Code Examples

### Example 1: Unified Diff Algorithm (Myers/LCS approach, zero dependencies)

```javascript
/**
 * Generate unified diff between two strings.
 * Returns a standard unified diff string (like git diff).
 * Zero dependencies — implements basic LCS diff.
 */
function unifiedDiff(oldText, newText, oldLabel, newLabel) {
  const oldLines = oldText.split('\n');
  const newLines = newText.split('\n');
  
  // Compute longest common subsequence using dynamic programming
  const lcs = computeLCS(oldLines, newLines);
  
  // Generate diff hunks from LCS
  const hunks = generateHunks(oldLines, newLines, lcs, 3); // 3 lines context
  
  if (hunks.length === 0) return ''; // No differences
  
  const header = [
    `--- ${oldLabel}`,
    `+++ ${newLabel}`,
  ];
  
  const hunkLines = hunks.flatMap(hunk => [
    `@@ -${hunk.oldStart},${hunk.oldCount} +${hunk.newStart},${hunk.newCount} @@`,
    ...hunk.lines,
  ]);
  
  return [...header, ...hunkLines].join('\n');
}

function computeLCS(a, b) {
  const m = a.length, n = b.length;
  // Use O(n) space variant for large files
  const prev = new Array(n + 1).fill(0);
  const curr = new Array(n + 1).fill(0);
  
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i-1] === b[j-1]) {
        curr[j] = prev[j-1] + 1;
      } else {
        curr[j] = Math.max(prev[j], curr[j-1]);
      }
    }
    // Copy curr to prev
    for (let j = 0; j <= n; j++) prev[j] = curr[j];
  }
  
  // Backtrack to get actual LCS (need full table for this)
  // For production: use Hunt-McIlroy or patience diff for better results
  return backtraceLCS(a, b);
}
```

**Note:** The O(n) space optimization above only computes LCS length. For actual diff output, the full O(mn) table or a more sophisticated algorithm (patience diff, Myers) is needed. Agent files are small (<500 lines), so O(mn) is fine.

### Example 2: YAML Frontmatter Validation

```javascript
/**
 * Validate YAML frontmatter of an agent file.
 * Returns { valid: true } or { valid: false, error: string, line: number }.
 */
function validateAgentFrontmatter(content) {
  // Check frontmatter delimiters exist
  if (!content.startsWith('---\n')) {
    return { valid: false, error: 'Missing YAML frontmatter (must start with ---)', line: 1 };
  }
  
  const endIdx = content.indexOf('\n---', 4);
  if (endIdx === -1) {
    return { valid: false, error: 'Unclosed YAML frontmatter (missing closing ---)', line: 1 };
  }
  
  const yaml = content.slice(4, endIdx);
  const lines = yaml.split('\n');
  
  // Check for name: field
  let hasName = false;
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (trimmed === '' || trimmed.startsWith('#')) continue;
    
    // Validate basic YAML structure (key: value)
    if (trimmed.startsWith('- ')) continue; // list item
    if (/^\s/.test(lines[i]) && !lines[i].trim().startsWith('-')) continue; // indented continuation
    
    const keyMatch = trimmed.match(/^([a-zA-Z0-9_-]+):\s*(.*)/);
    if (!keyMatch && !trimmed.startsWith('-') && !/^\s/.test(lines[i])) {
      return { valid: false, error: `Invalid YAML at line ${i + 2}: "${trimmed}"`, line: i + 2 };
    }
    
    if (keyMatch && keyMatch[1] === 'name') {
      hasName = true;
    }
  }
  
  // name: is required per CONTEXT.md
  // Note: Global agent files may not have name: — this is checked in agent:override
  // which reads the source and validates before writing
  
  return { valid: true, hasName };
}
```

### Example 3: Content Sanitization

```javascript
/**
 * Sanitize agent file content to prevent system-prompt mangling.
 * Detects and neutralizes patterns that the Anthropic auth plugin would rewrite.
 * 
 * Generic approach: not just current known patterns, but structural detection.
 */
function sanitizeAgentContent(content) {
  let sanitized = content;
  
  // Pattern 1: Literal editor name in various casings
  // The auth plugin replaces the editor name with "Claude Code" 
  // and its lowercase with "Claude"
  // Use generic replacement terms
  const editorPatterns = [
    // File paths containing the editor name
    /\.config\/opencode\//g,  // → .config/OC/  (but this is already correct)
    // Prevent the reverse: if someone writes the mangled form, normalize it
  ];
  
  // Pattern 2: Structural injection detection
  // Look for system-prompt markers that shouldn't appear in agent overrides
  const dangerousPatterns = [
    /<system-reminder>/gi,
    /\{\{SYSTEM_PROMPT\}\}/gi,
    /\[INST\]/gi,
    /\[\/INST\]/gi,
  ];
  
  for (const pattern of dangerousPatterns) {
    sanitized = sanitized.replace(pattern, '[sanitized]');
  }
  
  return sanitized;
}
```

### Example 4: Enricher Field Addition

```javascript
// In src/plugin/command-enricher.js, inside enrichCommand():
// Add after the existing tool_availability block (~line 476)

try {
  const localAgentsDir = join(resolvedCwd, '.opencode', 'agents');
  if (existsSync(localAgentsDir)) {
    const overrides = readdirSync(localAgentsDir)
      .filter(f => f.endsWith('.md'))
      .map(f => f.replace('.md', ''));
    if (overrides.length > 0) {
      enrichment.local_agent_overrides = overrides;
    }
  }
} catch { /* non-fatal enrichment */ }
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `.planning/agents/` for overrides | `.opencode/agents/` (OC native path) | v13.0 (this phase) | OC resolves project-local agents natively; no bgsd detection layer needed |
| `util:agent list` (global only) | `util:agent list-local` (global + local with scope) | v13.0 (this phase) | Users see override status at a glance |
| No content sanitization | Generic sanitization layer | v13.0 (this phase) | Prevents silent failures from system-prompt mangling |

## Open Questions

1. **`agent:sync` prompting mechanism:** The CONTEXT.md says "prompt accept/reject" but bgsd-tools.cjs runs in a non-interactive pipe context when called from workflows. The command must output the diff summary and a structured result indicating "awaiting user decision" — the agent/workflow handles the interactive prompting. This matches how other commands work (they output data, agents ask users).

2. **Frontmatter `name:` requirement for existing global agents:** The 10 current global agents use `description:` in frontmatter but NOT `name:`. The `name:` field requirement from CONTEXT.md means `agent:override` must inject/derive the `name:` field (from filename) if the source global agent doesn't have one. This avoids breaking on existing agents.

## Sources

### Primary (HIGH confidence)

- **`src/commands/agent.js`** — Existing agent command module (577 lines); `resolveBgsdPaths()`, `scanAgents()`, `extractFrontmatter()` usage patterns
- **`src/router.js`** — Command routing (1372 lines); `util:agent` namespace at lines 959-969; lazy-loading pattern
- **`src/lib/frontmatter.js`** — YAML frontmatter parser (166 lines); `extractFrontmatter()`, `reconstructFrontmatter()`, `spliceFrontmatter()`
- **`src/plugin/command-enricher.js`** — Command enricher (624 lines); enrichment object construction, try/catch wrapping pattern
- **`src/plugin/project-state.js`** — ProjectState facade (168 lines); `getProjectState()` composing all parsers
- **`~/.config/opencode/agents/`** — 10 global agent files; YAML frontmatter format with `description:`, `mode:`, `color:`, `tools:` fields
- **`AGENTS.md`** — String replacement warning about Anthropic auth plugin mangling

### Secondary (MEDIUM confidence)

- **`src/lib/commandDiscovery.js`** — `levenshteinDistance()` implementation for fuzzy matching
- **`src/lib/output.js`** — `output()` and `error()` functions; field filtering with `--fields`
- **`tests/agent.test.cjs`** — Existing agent tests (631 lines); test patterns using `node:test`, `createTempProject()`

### Tertiary (LOW confidence)

- **Myers diff algorithm** — Training data knowledge; standard algorithm for line-level diff; widely implemented in ~40-80 lines of JavaScript. Confidence LOW because exact implementation details should be verified against a reference.

## Metadata

**Confidence breakdown:**
- Command registration pattern: HIGH (directly observable in src/router.js and src/commands/agent.js)
- Agent file format: HIGH (directly observable in ~/.config/opencode/agents/)
- Enricher extension: HIGH (directly observable in src/plugin/command-enricher.js)
- YAML parsing: HIGH (existing extractFrontmatter() handles the exact format)
- Content sanitization: MEDIUM (AGENTS.md documents the mangling; specific patterns need runtime verification)
- Unified diff algorithm: MEDIUM (standard algorithm, but exact Node.js implementation needs coding)

**Research date:** 2026-03-15
**Valid until:** No expiry — all findings are based on current codebase state, not external APIs or libraries
