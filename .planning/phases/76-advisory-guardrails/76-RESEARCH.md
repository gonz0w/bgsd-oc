# Phase 76: Advisory Guardrails - Research

**Researched:** 2026-03-09
**Domain:** Plugin tool interception, convention detection, advisory notification patterns
**Confidence:** HIGH

## Summary

Phase 76 extends the existing `tool.execute.after` hook to add three advisory guardrails: convention violation warnings (GARD-01), planning file protection (GARD-02), and test-after-edit suggestions (GARD-03). All three operate on the same hook already used by stuck detection — the guardrails module intercepts tool calls, inspects results, and injects advisory messages via the existing notification system (context injection through `experimental.chat.system.transform`).

The host editor's `tool.execute.after` hook provides `input: { tool: string, sessionID: string, callID: string, args: any }` and `output: { title: string, output: string, metadata: any }`. The `args` field contains tool-specific parameters — for `write` and `edit` tools, this includes `filePath` (and for `write`, `content`). This gives the guardrails module all data needed to detect what files are being modified and, for writes, the content being written. Critically, `tool.execute.after` fires AFTER the tool succeeds — the guardrails never block the operation, only observe and advise.

**Primary recommendation:** Create a single `advisory-guardrails.js` module with three guardrail functions, wire it into the existing `tool.execute.after` handler alongside stuck detection, and deliver all advisories via the existing notification system's context injection channel. Convention detection uses AGENTS.md content and filename pattern analysis from the existing `conventions.js` classifiers. Planning file protection uses a static file→command mapping table. Test suggestions use debounced batching with language-aware source file detection.

## User Constraints

These are locked decisions from CONTEXT.md that MUST be honored in planning:

1. **Structured advisory block format** — visually distinct, e.g. `[warn]` or `[suggest]` prefix with clear formatting
2. **Two severity levels:** `warn` (convention violations, file protection) and `suggest` (test reminders) — visual distinction between them
3. **Verbose format:** issue + brief reason + suggested action (e.g., "File uses camelCase naming. Project convention is kebab-case (see AGENTS.md). Consider renaming to foo-bar.js")
4. **Dedup with threshold:** show individual warnings for first 3 occurrences of same type, then summarize ("...and N more similar warnings")
5. **Convention source:** AGENTS.md as primary, codebase stats (from init/codebase analysis) as fallback for detected conventions
6. **Convention scope:** project files only — ignore writes to temp dirs, node_modules, external paths, and .planning/ (has its own guardrail)
7. **Confidence threshold:** only advise on conventions detected at 70%+ confidence — reduces false positives
8. **Which conventions to check:** Agent's discretion based on what's detectable from tool.execute.after hook data (file path, content)
9. **Protected scope:** ALL files under .planning/ — not just PLAN.md, ROADMAP.md, STATE.md
10. **Detection method for "outside bGSD workflow":** Agent's discretion — determine the most reliable way to distinguish bgsd-tools.cjs/workflow-driven writes from direct Write tool calls
11. **Advisory message for planning files:** name the specific correct bGSD command to use — e.g., "ROADMAP.md was edited directly. Use /bgsd-add-phase or /bgsd-remove-phase to modify the roadmap safely."
12. **Command mapping:** static mapping table (file pattern → recommended command) — hardcoded, predictable, maintainable
13. **Test trigger files:** auto-detect based on project language (JS project → .js/.ts/.cjs; Python → .py; etc.)
14. **Test command source:** read from package.json scripts (e.g., `npm test`) or equivalent project config; fall back to generic "run your tests" if not found
15. **Test suggestion frequency:** debounced per batch — if multiple files are written in quick succession, one suggestion after the batch completes, not one per file
16. **Test suggestion specificity:** Agent's discretion — determine what level of specificity is achievable from available hook data

## Phase Requirements

| Req ID | Description | How Addressed |
|--------|-------------|---------------|
| GARD-01 | Advisory warning via `tool.execute.after` when file writes don't match project conventions | Intercept `write` and `edit` tool calls, extract filePath, classify filename against convention rules from AGENTS.md + codebase stats, inject advisory via notification system |
| GARD-02 | Advisory warning when PLAN.md, ROADMAP.md, or STATE.md are edited outside bGSD workflow patterns | Detect `.planning/` path in `write`/`edit` args, check whether the call is from a bGSD workflow (session tracking or bgsd_ tool context), inject "use /bgsd-X instead" advisory |
| GARD-03 | Advisory suggestion to run tests after source file modifications detected via tool interception | Track source file modifications, debounce across batch, detect test command from package.json, inject "suggest: run tests" after batch completes |

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Node.js `fs` (readFileSync) | v18+ (built-in) | Read AGENTS.md, package.json for convention/test detection | Already used throughout plugin |
| Node.js `path` | v18+ (built-in) | Path manipulation for file classification | Already used throughout plugin |
| Existing `notification.js` | Phase 75 | Advisory delivery via context injection | Already implemented with dedup, rate limiting, history |
| Existing `safe-hook.js` | Phase 71 | Error boundary for guardrail logic | Already wraps all hooks |
| Existing `conventions.js` classifiers | src/lib | `classifyName()`, `NAMING_PATTERNS` regex | Already implements camelCase/PascalCase/snake_case/kebab-case classification |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Existing `parsers/config.js` | Phase 75 | Read guardrails config settings | Config-driven enable/disable |
| Existing `context-builder.js` | Phase 73 | System prompt delivery of advisories | Notification injection already wired |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| AGENTS.md parsing in plugin | Importing conventions.js from CLI | conventions.js uses CJS require(), plugin is ESM; importing would pull entire CLI dependency graph. Inline simplified regex classifiers instead |
| Static command mapping table | Dynamic mapping from bgsd-tools analysis | Static is predictable, maintainable, zero overhead; dynamic adds complexity for minimal benefit |
| Notification system for advisories | Direct console.log output | Notification system has dedup, rate limiting, history, structured XML delivery — exactly what advisories need |

## Architecture Patterns

### Recommended Project Structure

```
src/plugin/
  index.js                  # Plugin entry point — extend tool.execute.after handler
  advisory-guardrails.js    # NEW: All three guardrail functions
  notification.js           # EXISTING: Advisory delivery channel
  safe-hook.js              # EXISTING: Error boundary
  parsers/config.js         # EXISTING: Guardrails configuration
```

One new file, one modified file. Minimal footprint.

### Pattern 1: Guardrails Module with Factory Pattern

Create a factory that initializes all three guardrails and returns a single `onToolAfter()` handler:

```javascript
export function createAdvisoryGuardrails(cwd, notifier, config) {
  // Load convention rules once at init
  const conventions = loadConventionRules(cwd);
  const commandMap = buildCommandMapping();
  const testConfig = detectTestConfig(cwd);

  // Debounce state for test suggestions
  let testBatchTimer = null;
  let testBatchFiles = [];

  // Dedup state for convention warnings
  const warnCounts = new Map(); // type → count

  async function onToolAfter(input) {
    const { tool, args } = input;

    // Only intercept file-modifying tools
    if (tool !== 'write' && tool !== 'edit') return;
    const filePath = args?.filePath;
    if (!filePath) return;

    // GARD-02: Planning file protection (check first — takes priority)
    await checkPlanningFileProtection(filePath, tool, input);

    // GARD-01: Convention violation warnings
    await checkConventionViolations(filePath, args);

    // GARD-03: Test suggestions (debounced)
    trackSourceFileModification(filePath);
  }

  return { onToolAfter };
}
```

### Pattern 2: Planning File Protection with Static Command Mapping

```javascript
const PLANNING_COMMANDS = {
  'ROADMAP.md': ['/bgsd-add-phase', '/bgsd-remove-phase', '/bgsd-insert-phase'],
  'STATE.md': ['/bgsd-progress', '/bgsd-execute-phase'],
  'PLAN.md': ['/bgsd-plan-phase'],
  'CONTEXT.md': ['/bgsd-discuss-phase'],
  'RESEARCH.md': ['/bgsd-research-phase'],
  'REQUIREMENTS.md': ['/bgsd-new-milestone'],
  'config.json': ['/bgsd-settings'],
};

function checkPlanningFileProtection(filePath) {
  if (!filePath.includes('.planning/')) return null;

  // Extract filename for command lookup
  const basename = path.basename(filePath);
  for (const [pattern, commands] of Object.entries(PLANNING_COMMANDS)) {
    if (basename.endsWith(pattern)) {
      return {
        severity: 'warn',
        message: `${basename} was edited directly. Use ${commands.join(' or ')} to modify safely.`,
      };
    }
  }

  // Generic warning for other .planning/ files
  return {
    severity: 'warn',
    message: `File in .planning/ was edited directly. bGSD workflows manage these files automatically.`,
  };
}
```

### Pattern 3: bGSD Workflow Detection (Distinguishing Direct vs. Workflow Edits)

The key challenge is distinguishing between a bGSD workflow editing `.planning/` files (expected) and the agent directly writing to them (unexpected). Several approaches:

**Approach A — Session-level flag:** Set a flag in the guardrails module when a `/bgsd-*` command is active (detected via `command.execute.before`). Clear it when the command completes. If a `.planning/` write happens while the flag is set, suppress the warning.

**Approach B — Tool name check:** bGSD's own tools (`bgsd_progress`, `bgsd_validate`) are custom tools registered with the `bgsd_` prefix. If the current tool call is `bgsd_*`, it's a workflow edit. But the actual `write`/`edit` calls happen via built-in tools, not custom tools.

**Approach C — Self-write tracking (recommended):** Similar to file-watcher's self-write tracking from Phase 75. Before any bGSD workflow writes to `.planning/`, register the path in a shared Set. The guardrails module checks this Set and suppresses warnings for tracked paths. This is the most reliable approach because it directly tracks intent.

**Recommended: Approach A (command-active flag)** is simplest. A bGSD command sets a flag via `command.execute.before` — all `.planning/` writes during that command are suppressed. Reset on idle or next user message. This requires no cross-module coupling beyond a shared boolean.

### Pattern 4: Convention Detection from AGENTS.md + Fallback

```javascript
function loadConventionRules(cwd) {
  const rules = [];

  // Primary: Parse AGENTS.md for explicit conventions
  const agentsPath = path.join(cwd, 'AGENTS.md');
  try {
    const content = readFileSync(agentsPath, 'utf-8');
    // Extract naming conventions from AGENTS.md content
    // Look for patterns like "kebab-case", "camelCase", "PascalCase" in rules
    const namingMatch = content.match(/naming|convention|file.*nam/i);
    if (namingMatch) {
      // Extract specific patterns mentioned
    }
  } catch { /* No AGENTS.md */ }

  // Fallback: Codebase stats from .planning/codebase/codebase-intel.json
  const intelPath = path.join(cwd, '.planning', 'codebase', 'codebase-intel.json');
  try {
    const intel = JSON.parse(readFileSync(intelPath, 'utf-8'));
    if (intel.conventions?.naming?.overall) {
      // Use detected conventions above 70% confidence
    }
  } catch { /* No intel data */ }

  return rules;
}
```

### Pattern 5: Debounced Test Suggestions

```javascript
function createTestSuggester(cwd, notifier, config) {
  let batchTimer = null;
  let batchFiles = [];
  const debounceMs = 500; // Half-second batch window

  const testCommand = detectTestCommand(cwd);
  const sourceExtensions = detectSourceExtensions(cwd);

  function trackFile(filePath) {
    const ext = path.extname(filePath);
    if (!sourceExtensions.has(ext)) return;

    // Ignore test files themselves
    if (isTestFile(filePath)) return;

    batchFiles.push(filePath);

    if (batchTimer) clearTimeout(batchTimer);
    batchTimer = setTimeout(flushBatch, debounceMs);
  }

  async function flushBatch() {
    if (batchFiles.length === 0) return;
    const files = [...batchFiles];
    batchFiles = [];

    const suggestion = files.length === 1
      ? `Modified ${path.basename(files[0])}. Consider running: ${testCommand}`
      : `Modified ${files.length} source files. Consider running: ${testCommand}`;

    await notifier.notify({
      type: 'advisory-test',
      severity: 'info', // Maps to [suggest] presentation
      message: suggestion,
    });
  }

  return { trackFile };
}
```

### Pattern 6: Advisory Notification Format

Advisories use the existing notification system but with a distinct XML tag structure:

```xml
<bgsd-advisory type="convention" severity="warn">
File uses camelCase naming (myComponent.js). Project convention is kebab-case (see AGENTS.md). Consider renaming to my-component.js
</bgsd-advisory>

<bgsd-advisory type="planning-file" severity="warn">
ROADMAP.md was edited directly. Use /bgsd-add-phase or /bgsd-remove-phase to modify safely.
</bgsd-advisory>

<bgsd-advisory type="test-suggestion" severity="suggest">
Modified 3 source files. Consider running: npm test
</bgsd-advisory>
```

### Anti-Patterns to Avoid

1. **Don't block tool execution** — `tool.execute.after` fires AFTER the tool completes. Guardrails are advisory only. Never throw from the handler.
2. **Don't import from CLI CJS modules** — Plugin is ESM. Inline any needed logic (naming classifiers are simple regexes).
3. **Don't fire convention warnings for .planning/ files** — Those have their own guardrail (GARD-02). Don't double-warn.
4. **Don't fire test suggestions for non-source files** — Markdown, JSON, config edits should not trigger test suggestions.
5. **Don't fire warnings for bGSD's own tool calls** — `bgsd_progress`, `bgsd_validate` etc. are legitimate workflow operations.
6. **Don't warn on every file in a batch** — Dedup convention warnings (first 3 individual, then summarize). Debounce test suggestions.
7. **Don't read files synchronously in the hot path** — AGENTS.md and package.json should be read and cached at guardrails init time, not on every tool call.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Advisory delivery | Custom console.log or output injection | Existing `notifier.notify()` from `notification.js` | Has dedup, rate limiting, history, context injection — exactly what advisories need |
| Error boundaries | Custom try-catch in guardrails | Existing `safeHook()` from `safe-hook.js` | Already wraps `tool.execute.after` handler with retry, timeout, circuit breaker |
| Filename classification | New regex library | Inline copies of `NAMING_PATTERNS` from `conventions.js` | Five simple regexes (camelCase, PascalCase, snake_case, kebab-case, UPPER_SNAKE_CASE) |
| Config defaults | Hardcoded values | Extend `CONFIG_DEFAULTS` in `parsers/config.js` | Existing nested config pattern with shallow merge |
| Context injection XML | Custom string building | Follow existing `<bgsd-notification>` pattern from `context-builder.js` | Already established XML tag pattern for agent-visible messages |
| File path filtering | Custom path analysis | Standard `path.basename()`, `path.extname()`, `path.dirname()` | Node.js built-ins, already used throughout |

## Common Pitfalls

### Pitfall 1: Convention False Positives on Single-Word Files
**What goes wrong:** File named `index.js` triggers "not kebab-case" warning
**Why it happens:** Single-word filenames match no multi-word pattern
**How to avoid:** Skip convention checks for single-word filenames (existing `classifyName()` already returns 'single-word' for these). Only warn when a multi-word name uses a DIFFERENT pattern than the project convention.
**Warning signs:** Warnings on index.js, main.py, app.js, etc.

### Pitfall 2: Notification Storm During Plan Execution
**What goes wrong:** Executing a plan that creates 20 files generates 20 advisory warnings
**Why it happens:** Each write triggers the guardrails handler independently
**How to avoid:** Dedup threshold (first 3 individual, then summarize). Rate limiting from existing notification system. Consider suppressing all advisories during active plan execution (check STATE.md status or command-active flag).
**Warning signs:** Agent context flooded with `<bgsd-advisory>` tags, slowing inference

### Pitfall 3: Stale Convention Cache
**What goes wrong:** AGENTS.md is updated but guardrails still use old convention rules
**Why it happens:** Convention rules cached at guardrails init time, never refreshed
**How to avoid:** Refresh conventions when file watcher detects AGENTS.md change. Or re-read on every batch with a simple mtime check.
**Warning signs:** Warnings persist for conventions the user has already changed in AGENTS.md

### Pitfall 4: Planning File Warning for bGSD Workflows
**What goes wrong:** Running `/bgsd-plan-phase` writes PLAN.md, which triggers "edited outside workflow" warning
**Why it happens:** The guardrails module doesn't know the write is from a bGSD workflow
**How to avoid:** Implement bGSD-active flag or self-write tracking (see Pattern 3). Set flag in `command.execute.before` for `/bgsd-*` commands, clear on completion.
**Warning signs:** False "use /bgsd-plan-phase" warnings when actually running /bgsd-plan-phase

### Pitfall 5: Test Command Detection Failure
**What goes wrong:** Plugin suggests "run your tests" instead of `npm test` in a Node.js project
**Why it happens:** package.json not found or `scripts.test` not defined
**How to avoid:** Read package.json at init. Check `scripts.test`, `scripts.check`, etc. Fall back gracefully to generic message. Cache result.
**Warning signs:** Generic suggestions in projects that have well-defined test commands

### Pitfall 6: Bundle Size Growth
**What goes wrong:** New module adds significant bytes to plugin.js
**Why it happens:** Importing CLI modules or adding complex logic
**How to avoid:** Keep advisory-guardrails.js self-contained. Inline only the needed regex classifiers. No new dependencies. Target <5KB contribution.
**Warning signs:** Plugin build shows >10KB increase from Phase 76

## Code Examples

### tool.execute.after Hook Type Signature (from OpenCode source, HIGH confidence)

```typescript
// From packages/plugin/src/index.ts — exact hook signature
"tool.execute.after"?: (
  input: { tool: string; sessionID: string; callID: string; args: any },
  output: { title: string; output: string; metadata: any },
) => Promise<void>
```

Key facts:
- `input.tool` — tool name: `"write"`, `"edit"`, `"bash"`, `"read"`, `"grep"`, `"glob"`, etc.
- `input.args` — tool arguments as passed by the LLM. For `write`: `{ filePath, content }`. For `edit`: `{ filePath, oldString, newString }`.
- `output.output` — tool output string (note: mutations to output.output are NOT reflected in UI per issue #13574, but the hook is still useful for observation)
- Hook fires AFTER tool execution completes — cannot block operations

### Built-in Tool Names and Args (from OpenCode docs + source, HIGH confidence)

```javascript
// File-modifying tools that guardrails should intercept:
// tool: "write"  → args: { filePath: string, content: string }
// tool: "edit"   → args: { filePath: string, oldString: string, newString: string, replaceAll?: boolean }
// tool: "patch"  → args: { filePath: string, patch: string }

// File-modifying tools NOT intercepted by tool.execute.after:
// tool: "bash"   → args: { command: string } — could modify files via shell, but args don't reveal file paths
```

### Existing Naming Pattern Classifiers (from conventions.js, HIGH confidence)

```javascript
// These exact regexes from src/lib/conventions.js can be inlined in the plugin:
const NAMING_PATTERNS = {
  camelCase: /^[a-z][a-z0-9]*[A-Z][a-zA-Z0-9]*$/,
  PascalCase: /^[A-Z][a-zA-Z0-9]*[a-z][a-zA-Z0-9]*$/,
  snake_case: /^[a-z][a-z0-9]*(_[a-z0-9]+)+$/,
  'kebab-case': /^[a-z][a-z0-9]*(-[a-z0-9]+)+$/,
  UPPER_SNAKE_CASE: /^[A-Z][A-Z0-9]*(_[A-Z0-9]+)*$/,
};

function classifyName(name) {
  if (/^[a-z][a-z0-9]*$/.test(name)) return 'single-word';
  if (/^[A-Z][A-Z0-9]*$/.test(name)) return 'single-word';
  for (const [pattern, regex] of Object.entries(NAMING_PATTERNS)) {
    if (regex.test(name)) return pattern;
  }
  return 'mixed';
}
```

### Notification System Integration (from existing codebase, HIGH confidence)

```javascript
// Advisories use the existing notification system for delivery
await notifier.notify({
  type: 'advisory-convention',  // or 'advisory-planning', 'advisory-test'
  severity: 'warning',          // warn → warning severity (OS + context)
  message: 'File uses camelCase...',
  action: 'Consider renaming to kebab-case',
});

// Notifications are drained into system prompt via existing mechanism:
// <bgsd-notification type="advisory-convention" severity="warning">
//   File uses camelCase... Action: Consider renaming to kebab-case
// </bgsd-notification>
```

### Config Extension Pattern (from parsers/config.js, HIGH confidence)

```javascript
// Add guardrails defaults to CONFIG_DEFAULTS in parsers/config.js:
advisory_guardrails: Object.freeze({
  enabled: true,
  conventions: true,
  planning_protection: true,
  test_suggestions: true,
  convention_confidence_threshold: 70,
  dedup_threshold: 3,
  test_debounce_ms: 500,
}),

// Add to NESTED_OBJECT_KEYS set:
const NESTED_OBJECT_KEYS = new Set([
  'idle_validation', 'notifications', 'stuck_detection', 'file_watcher',
  'advisory_guardrails',  // NEW
]);
```

### Existing tool.execute.after Wiring (from index.js, HIGH confidence)

```javascript
// Current handler — extend this, don't replace:
const toolAfter = safeHook('tool.execute.after', async (input) => {
  stuckDetector.trackToolCall(input);
  // NEW: Advisory guardrails check
  await guardrails.onToolAfter(input);
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| No convention checking | Plugin can detect naming patterns from AGENTS.md + codebase stats | Phase 76 (this phase) | Agents get feedback on convention violations |
| No planning file protection | Plugin tracks .planning/ writes and warns on direct edits | Phase 76 (this phase) | Agents learn correct bGSD workflow commands |
| No test suggestions | Plugin detects source file modifications and suggests test runs | Phase 76 (this phase) | Test discipline improves without blocking workflow |
| `tool.execute.after` used only for stuck detection | Extended to also serve advisory guardrails | Phase 76 (this phase) | Single hook serves multiple observation purposes |
| Convention detection in CLI only (conventions.js) | Simplified classifiers inlined in ESM plugin | Phase 76 (this phase) | Plugin can check naming without subprocess |

## Open Questions

1. **Should advisories use the existing `<bgsd-notification>` tag or a new `<bgsd-advisory>` tag?** Using the existing tag means no changes to system.transform — advisories just go through notify(). Using a new tag adds semantic clarity but requires modifying context-builder.js. **Recommendation:** Use the existing `<bgsd-notification>` mechanism — advisories ARE notifications. Use `type="advisory-convention"`, `type="advisory-planning"`, `type="advisory-test"` to distinguish them. The notification system already has everything needed.

2. **How to handle projects with NO conventions detected (new/small projects)?** If no AGENTS.md exists and no codebase-intel.json is available, there are no conventions to enforce. **Recommendation:** Silently skip convention checking. No convention data = no warnings. This aligns with constraint C-04 (backward compatible).

3. **Should `patch` tool be intercepted alongside `write` and `edit`?** The `patch` tool also modifies files. Its args contain `{ filePath, patch }`. **Recommendation:** Yes, intercept `patch` for GARD-02 (planning file protection) and GARD-03 (test suggestions). Convention checking may not be meaningful for patches since they modify existing files rather than creating new ones.

## Sources

### Primary (HIGH confidence)
- **OpenCode Plugin API Source** — `packages/plugin/src/index.ts` on GitHub (anomalyco/opencode, dev branch). Exact TypeScript type definitions for `tool.execute.after` hook: `input: { tool: string; sessionID: string; callID: string; args: any }`, `output: { title: string; output: string; metadata: any }`. Verified 2026-03-09.
- **OpenCode Plugin Docs** — https://opencode.ai/docs/plugins/. Official documentation confirming hook patterns, tool interception, `.env` protection example. Verified 2026-03-09.
- **OpenCode Built-in Tools** — https://open-code.ai/en/docs/tools. Lists all built-in tools: write, edit, patch, bash, read, grep, glob, etc. Confirmed tool names that guardrails should intercept. Verified 2026-03-09.
- **Existing Codebase** — `src/plugin/` directory. Phase 75 infrastructure (notification.js, stuck-detector.js, file-watcher.js, parsers/config.js) provides all building blocks. `src/lib/conventions.js` provides naming pattern classifiers. All verified 2026-03-09.

### Secondary (MEDIUM confidence)
- **GitHub Issue #13574** — `tool.execute.after` output mutations not reflected in UI. Confirms that the hook is observation-only in practice — mutations to `output.output` are silently ignored. This reinforces our advisory approach: inject via notification system, not output mutation. Closed as not planned.
- **OpenCode Plugin Logging Gist** — Community guide showing `tool.execute.after` with `input.tool` values like `"edit"` and tracking of modified files. Confirms real-world tool name/args patterns. January 2026.

### Tertiary (LOW confidence)
- **GitHub Issue #10027** — Feature request for `tool.execute.error` hook. Suggests `tool.execute.after` does NOT fire on tool errors — only on success. If confirmed, guardrails only observe successful writes (which is actually desirable for advisory purposes).

## Metadata

**Confidence breakdown:**
- GARD-01 (Convention warnings): HIGH — `tool.execute.after` confirmed, naming classifiers exist, notification system proven
- GARD-02 (Planning file protection): HIGH — file path available in `args.filePath`, static mapping straightforward, workflow detection achievable via command flag
- GARD-03 (Test suggestions): HIGH — source file detection via extension matching, debounce pattern proven in Phase 75 file watcher, package.json test command extraction straightforward

**Research date:** 2026-03-09
**Valid until:** 2026-06-09 (3 months — host editor plugin API may change)
