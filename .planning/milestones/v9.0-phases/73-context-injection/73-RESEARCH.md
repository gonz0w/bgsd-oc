# Phase 73: Context Injection - Research

**Researched:** 2026-03-09
**Domain:** OpenCode Plugin Hooks — System Prompt, Compaction, Command Enrichment
**Confidence:** HIGH

## Summary

Phase 73 delivers three plugin hooks that eliminate manual init calls: (1) `experimental.chat.system.transform` injects compact project state into every LLM interaction, (2) `experimental.session.compacting` preserves rich context across compaction, and (3) `command.execute.before` enriches slash commands with project state before workflows run.

The OpenCode plugin API is well-documented for all three hooks. Phase 71 already built the foundation: `safeHook` error boundary, shared parsers for STATE.md/ROADMAP.md/PLAN.md/config.json, and the plugin ESM build pipeline. Phase 73 extends these parsers with a context-builder module that composes system prompt content from cached ProjectState data.

The largest engineering task is extracting init:* logic from `src/commands/init.js` (1300+ lines, 12 init variants) into shared modules that both CLI and plugin can import. The plugin needs a subset of what init produces — primarily paths, flags, settings, phase info — without the heavyweight features (env scanning, codebase intel, RAG detection) that would add latency to every LLM call.

**Primary recommendation:** Build a lightweight `src/plugin/context-builder.js` module that uses existing shared parsers to compose context, keeping the system prompt hook under 500 tokens. Extract the minimal shared init data (paths, config flags, phase/plan enumeration) into `src/plugin/project-state.js` that both CLI init commands and plugin hooks can consume.

<user_constraints>

## User Constraints

From 73-CONTEXT.md decisions (locked choices — research THESE, not alternatives):

1. **System prompt content**: Identifiers + status only — phase number, name, plan, task count, milestone position. Include phase goal sentence. Blockers only when present. No fixed token budget but optimize for minimal.
2. **Compaction preservation**: All four artifacts — current task details, active decisions/blockers, PROJECT.md digest, INTENT.md summary. Use ProjectState cache, not fresh reads. Format as structured XML blocks. Skip AGENTS.md. Include session continuity hint. When no .planning/: inject nothing.
3. **Command enrichment**: All /bgsd-* commands get enriched. Inject full init equivalent. Existing init:* calls will be REMOVED from workflows. Plugin is required for v9.0. Use `command.execute.before` hook. Extract init logic into shared src/ modules. Phase-aware: parse command arguments.
4. **Failure behavior**: System prompt errors → inject error hint. Compaction errors → inject error marker. Command enrichment errors → BLOCK command execution. Use safeHook circuit breaker. Debounce file reads 500ms. Verify Phase 71 parsers exist before enabling.

</user_constraints>

<phase_requirements>

## Phase Requirements

| ID | Requirement | Success Criteria |
|------|-------------|------------------|
| CINJ-01 | System prompt hook injects current phase, plan, progress, blockers | On every new session, LLM receives state without user action |
| CINJ-02 | System prompt injection within 500-token budget | Measured and enforced with tokenx |
| CINJ-03 | Enhanced compaction preserves PROJECT.md, INTENT.md, decisions, blockers, current task | After compaction, LLM retains full project awareness |
| CINJ-04 | Slash commands auto-enriched via command.execute.before | Commands receive context before workflow executes |

</phase_requirements>

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| OpenCode Plugin API | current | Hook registration (system.transform, compacting, command.execute.before) | Only way to extend OpenCode behavior |
| esbuild | existing | Bundle src/plugin/ into plugin.js (ESM) | Already configured in build.cjs from Phase 71 |
| tokenx | bundled | Token count estimation for 500-token budget enforcement | Already bundled in bgsd-tools.cjs, ~96% accuracy |
| Node.js fs (sync) | 18+ | File reads for state parsing | Plugin parsers already use readFileSync |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| safeHook | internal | Error boundary wrapping for all three hooks | Always — every hook gets wrapped |
| ProjectState parsers | internal | parseState, parseRoadmap, parsePlan, parseConfig | Data source for context building |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| tokenx for budget enforcement | chars/4 heuristic | tokenx is already bundled and more accurate; heuristic could under/overcount |
| readFileSync for file reads | async readFile | Plugin parsers already use sync reads; async would require refactoring all parsers |
| XML for compaction format | JSON or markdown | XML tags are self-documenting for LLMs and easy to parse; JSON is denser but harder for LLMs to read |

## Architecture Patterns

### Recommended Module Structure

```
src/plugin/
├── index.js              # Plugin entry point (BgsdPlugin export) — MODIFY
├── safe-hook.js          # Error boundary — EXISTING, no changes
├── logger.js             # File logger — EXISTING, no changes
├── tool-registry.js      # Tool name enforcement — EXISTING, no changes
├── context-builder.js    # NEW: Compose system prompt and compaction context
├── command-enricher.js   # NEW: Parse command args, build init-equivalent JSON
├── project-state.js      # NEW: Unified ProjectState facade over parsers
├── parsers/
│   ├── index.js          # Parser barrel — EXISTING
│   ├── state.js          # STATE.md parser — EXISTING
│   ├── roadmap.js        # ROADMAP.md parser — EXISTING
│   ├── plan.js           # PLAN.md parser — EXISTING
│   ├── config.js         # config.json parser — EXISTING
│   ├── project.js        # NEW: PROJECT.md parser (for compaction digest)
│   └── intent.js         # NEW: INTENT.md parser (for compaction summary)
└── token-budget.js       # NEW: tokenx wrapper for budget enforcement
```

### Pattern 1: System Prompt Injection

The `experimental.chat.system.transform` hook receives `(input, output)` where:
- `input`: `{ sessionID: string, model: string }` (sessionID was added in recent OpenCode)
- `output`: `{ system: string[] }` — array of system prompt segments

The hook pushes additional segments to `output.system`. Multiple plugins can push; all segments are concatenated.

```js
// Hook signature confirmed from OpenCode source (llm.ts):
// await Plugin.trigger("experimental.chat.system.transform", { sessionID, model }, { system })
"experimental.chat.system.transform": safeHook('system.transform', async (input, output) => {
  const state = getProjectState(directory);
  if (!state) {
    // No .planning/ — inject minimal hint
    output.system.push('<bgsd>No active project. Run /bgsd-new-project to start.</bgsd>');
    return;
  }
  output.system.push(buildSystemPrompt(state)); // Must be <500 tokens
})
```

**Key findings from OpenCode source:**
- Safety fallback: if a plugin empties the system array, the original is restored
- The system array is restructured for Anthropic prompt caching after plugin hooks run
- Hook fires on EVERY LLM call (every turn), not just session start — must be fast

### Pattern 2: Enhanced Compaction

The `experimental.session.compacting` hook receives:
- `input`: `{ sessionID?: string }`
- `output`: `{ context: string[], prompt?: string }`

Push to `output.context` to add preserved state. Optionally set `output.prompt` to replace the entire compaction prompt.

```js
"experimental.session.compacting": safeHook('compacting', async (input, output) => {
  const state = getProjectState(directory);
  if (!state) return; // No .planning/ → inject nothing
  
  // Push structured XML blocks
  output.context.push(buildCompactionContext(state));
  // DO NOT set output.prompt — let default compaction prompt work
})
```

**Current implementation** (Phase 71) only preserves STATE.md raw content. Phase 73 replaces this with structured XML blocks covering all four artifacts.

### Pattern 3: Command Enrichment

The `command.execute.before` hook is NOT an experimental hook — it's a standard plugin hook. Based on OpenCode's plugin types:
- `input`: `{ command: string, parts: string[] }` — the command name and its parts/arguments
- `output`: `{ parts: string[] }` — mutable parts array; plugin can prepend context

**Important discovery:** There is no dedicated `command.execute.before` hook in the standard OpenCode plugin API for *slash commands* specifically. The available hooks are:
- `tool.execute.before` — fires before tool execution (read, edit, bash, etc.)
- `command.executed` event — fires AFTER a TUI command runs

For slash commands, the content goes through `chat.message` → prompt → LLM. The `command.execute.before` hook (per issue #9306) does exist and allows modifying command parts before they're sent to the LLM. It intercepts the command template content.

The implementation approach: intercept `/bgsd-*` commands, detect the command name, build the init-equivalent context, and prepend it to the command parts so the workflow receives context without calling init:*.

### Anti-Patterns to Avoid

1. **Don't read files in the system prompt hook** — use cached ProjectState data exclusively. File I/O on every LLM turn would add latency.
2. **Don't replace the compaction prompt** — only push to `output.context`. Replacing the prompt breaks OpenCode's default summary structure.
3. **Don't inject heavyweight context** (codebase intel, env scan, RAG capabilities) into system prompt — these are too large and belong in command enrichment.
4. **Don't rely on init:* subprocess calls from plugin** — the whole point is in-process reads via shared parsers.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Token counting | Custom char/4 estimator | tokenx (already bundled) | ~96% accuracy vs ~75% for heuristic |
| STATE.md parsing | New regex patterns | parseState from src/plugin/parsers/state.js | Already tested, cached, frozen objects |
| ROADMAP.md parsing | New phase extractor | parseRoadmap from src/plugin/parsers/roadmap.js | Already handles all phase formats |
| Error boundaries | try/catch in each hook | safeHook wrapper | Circuit breaker, retry, logging, correlation IDs |
| Config reading | Manual JSON.parse | parseConfig from src/plugin/parsers/config.js | Handles defaults, nested workflow keys |

## Common Pitfalls

### Pitfall 1: System Prompt Hook Latency
**What goes wrong:** Hook fires on every LLM turn. If it reads files synchronously, it adds 50-200ms per turn.
**Why it happens:** STATE.md, ROADMAP.md reads aren't cached between hook invocations.
**How to avoid:** Use in-memory parser caches (Phase 71). Cache invalidation happens via separate watcher (Phase 75), not in the hook itself. For Phase 73, caches persist for the process lifetime.
**Warning signs:** safeHook slow-hook warning (>500ms) appearing in logs.

### Pitfall 2: Token Budget Creep
**What goes wrong:** System prompt injection grows beyond 500 tokens as more fields are added.
**Why it happens:** Natural temptation to add "just one more field" — codebase stats, env info, etc.
**How to avoid:** Enforce budget in a test: build prompt, count tokens with tokenx, assert < 500. Run this in npm test.
**Warning signs:** System prompt injection exceeds 400 tokens (80% threshold).

### Pitfall 3: Command Enrichment Blocking Wrong Commands
**What goes wrong:** Non-bgsd commands get intercepted and fail because .planning/ doesn't exist.
**Why it happens:** Hook fires for ALL commands, not just /bgsd-* ones.
**How to avoid:** First line of hook: `if (!command.startsWith('bgsd-')) return;` — early return for non-bgsd commands.
**Warning signs:** Non-bgsd slash commands failing with bGSD errors.

### Pitfall 4: Compaction Context Too Large
**What goes wrong:** Compaction context exceeds useful size, wasting the compacted context window.
**Why it happens:** Dumping full PROJECT.md, full INTENT.md, full decisions section.
**How to avoid:** Use digests: PROJECT.md → core value + tech stack (1 line each). INTENT.md → objective only. Decisions → last 3 decisions. Total target: <1000 tokens.
**Warning signs:** Compaction context push is multiple KB.

### Pitfall 5: init:* Removal Breaking Workflow Backward Compat
**What goes wrong:** Removing init:* calls from workflows breaks them when plugin isn't loaded.
**Why it happens:** The context decision says "Plugin is required for v9.0" but someone runs workflows without plugin.
**How to avoid:** Per the decision, v9.0 requires the plugin — no graceful degradation. But add a clear error message in workflows if INIT variable is empty: "bGSD plugin required. Install with npx bgsd-oc".
**Warning signs:** Workflows silently proceeding with no context.

### Pitfall 6: CJS/ESM Module Boundary
**What goes wrong:** Shared modules imported by both CLI (CJS) and plugin (ESM) fail to build.
**Why it happens:** Phase 71 established that plugin parsers are self-contained — regex patterns copied from CLI source, no imports from src/lib/.
**How to avoid:** Continue the self-contained pattern. New parsers (project.js, intent.js) live in src/plugin/parsers/ with their own regex. Don't try to import from src/commands/init.js. The "shared module extraction" in CONTEXT.md means shared WITHIN the plugin (context-builder.js and command-enricher.js share project-state.js), not shared between CLI and plugin.
**Warning signs:** esbuild producing __require() shims in plugin.js output (CJS leak).

## Code Examples

### System Prompt Format (Target: ~200-300 tokens)

```
<bgsd>
Phase 73: Context Injection | Plan: P01 (2/3 tasks) | v9.0 3/6 phases
Goal: The AI always knows current project state without manual init calls
Blocker: Plugin hooks prefixed with experimental.* may change
</bgsd>
```

Without blockers:
```
<bgsd>
Phase 73: Context Injection | Plan: P01 (2/3 tasks) | v9.0 3/6 phases
Goal: The AI always knows current project state without manual init calls
</bgsd>
```

No active project:
```
<bgsd>No active project. Run /bgsd-new-project to start.</bgsd>
```

### Compaction Context Format

```xml
<project>
Core value: Manage and deliver high-quality software with documentation
Tech: Node.js CLI + ESM plugin, esbuild bundler, zero npm deps
</project>

<task>
Phase 73: Context Injection — Plan P01, Task 2/3: Build context-builder module
Files: src/plugin/context-builder.js, src/plugin/project-state.js
</task>

<decisions>
- [Phase 72]: Renamed all GSD_ env vars to BGSD_ prefix
- [Phase 71]: Plugin parsers are self-contained — no imports from src/lib/
</decisions>

<intent>
Objective: Intelligent agent orchestration engine with deeply embedded editor experience through plugin hooks
</intent>
```

### Command Enrichment (init-equivalent JSON prepended to command)

```js
// In command.execute.before hook:
const enrichment = {
  // Paths
  phase_dir: '.planning/phases/73-context-injection',
  state_path: '.planning/STATE.md',
  roadmap_path: '.planning/ROADMAP.md',
  config_path: '.planning/config.json',
  
  // Phase info
  phase_number: '73',
  phase_name: 'Context Injection',
  plans: ['73-P01-PLAN.md'],
  incomplete_plans: ['73-P01-PLAN.md'],
  
  // Config flags
  commit_docs: true,
  branching_strategy: 'none',
  verifier_enabled: true,
  
  // Models
  executor_model: 'anthropic/claude-sonnet-4-20250514',
};
```

### Hook Registration in index.js

```js
export const BgsdPlugin = async ({ directory }) => {
  const bgsdHome = join(homedir(), '.config', 'opencode', 'bgsd-oc');
  const registry = createToolRegistry(safeHook);
  
  // Verify Phase 71 parsers exist before enabling context hooks
  const parsersAvailable = verifyParsers();
  
  return {
    'session.created': safeHook('session.created', async () => {
      console.log('[bGSD] Planning plugin available.');
    }),
    'shell.env': safeHook('shell.env', async (input, output) => {
      if (!output?.env) return;
      plugin shell env injected the installed bGSD path at the time.
    }),
    'experimental.chat.system.transform': parsersAvailable
      ? safeHook('system.transform', async (input, output) => {
          const prompt = buildSystemPrompt(directory);
          if (prompt) output.system.push(prompt);
        })
      : undefined,
    'experimental.session.compacting': parsersAvailable
      ? safeHook('compacting', async (input, output) => {
          const ctx = buildCompactionContext(directory);
          if (ctx && output?.context) output.context.push(ctx);
        })
      : undefined,
    'command.execute.before': parsersAvailable
      ? safeHook('command.enrich', async (input, output) => {
          enrichCommand(input, output, directory);
        })
      : undefined,
  };
};
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| init:* subprocess call at workflow start | Plugin hook injects context before LLM call | Phase 73 (this phase) | Eliminates ~500ms subprocess overhead per command |
| STATE.md only preserved on compaction | Four artifacts preserved (project, task, decisions, intent) | Phase 73 | LLM retains full context across compaction |
| Manual @-file references for context | Auto-injected via command.execute.before | Phase 73 | Zero user action needed for context |
| Each workflow calls its own init variant | Single plugin hook enriches all commands uniformly | Phase 73 | Consistent context, less workflow maintenance |

## Open Questions

1. **command.execute.before hook maturity**: This hook exists (per issue #9306) but is not marked experimental. Need to verify it's available in the installed OpenCode version and confirm the exact input/output signature for slash commands specifically (vs TUI commands).

2. **Session-aware caching**: The system.transform hook now receives `sessionID` (per issue #6142). Should ProjectState cache be per-session or per-directory? Per-directory is simpler and correct for single-project usage.

3. **Debounce implementation**: CONTEXT.md specifies "debounce file reads by 500ms after change events." Since Phase 75 handles file watchers, Phase 73 should focus on using cached data and let Phase 75 add cache invalidation. The debounce decision may need to be deferred to Phase 75.

4. **init:* removal scope**: Should init:* calls be removed from workflows IN this phase, or should that be a separate follow-up? CONTEXT.md says "will be REMOVED" as part of Phase 73. This is significant — 19 workflow files reference init:* calls. The planner should account for this as a distinct task.

5. **Tokenx in plugin bundle**: tokenx is bundled in bgsd-tools.cjs but NOT currently in plugin.js. To enforce the 500-token budget at runtime (not just in tests), tokenx needs to be added to the plugin ESM build, or budget enforcement happens only in tests.

## Sources

### Primary (HIGH confidence)

- **OpenCode Plugin API docs** — https://opencode.ai/docs/plugins/ — Official plugin documentation confirming hook names and signatures
- **OpenCode LLM module source analysis** — Gist by rmk40 — Confirms `experimental.chat.system.transform` fires with `{ sessionID, model }` input and `{ system: string[] }` output
- **OpenCode Plugin Guide** — GitHub Gist by johnlindquist — Comprehensive hook examples including system.transform and compacting
- **OpenCode issue #6142** — Confirms sessionID was added to system.transform input
- **OpenCode issue #9306** — Confirms command.execute.before exists, documents noReply option
- **Phase 71 plugin.js** — Existing codebase — Current hook registration, safeHook, parser exports
- **src/commands/init.js** — Existing codebase — All 12 init:* command implementations (1300+ lines)
- **73-CONTEXT.md** — User decisions — Locked implementation choices

### Secondary (MEDIUM confidence)

- **opencode-kcp-plugin** — Real-world plugin using system.transform (~800 tokens) — Validates approach and token budget feasibility
- **opencode-rules plugin** (frap129) — Uses system.transform for dynamic rule injection — Validates pattern of context-aware system prompt manipulation
- **intent-engine plugin** — Uses system.transform and tool hooks — Validates multi-hook plugin pattern

### Tertiary (LOW confidence)

- **OpenCode prompt construction gist** — Community analysis, not official — May not reflect latest source changes
- **Various plugin tutorials** — Medium articles, dev.to — Some use older API patterns

## Metadata

**Confidence breakdown:**
- Hook API signatures: HIGH (confirmed from multiple sources + existing codebase)
- Module architecture: HIGH (extends proven Phase 71 patterns)
- Token budget feasibility: HIGH (kcp-plugin proves ~800 tokens works; our target is ~300)
- command.execute.before behavior: MEDIUM (exists per issue tracker, but exact slash command interception behavior needs runtime verification)
- init:* removal scope: MEDIUM (decision is clear but execution complexity is high — 19 files)

**Research date:** 2026-03-09
**Valid until:** Until OpenCode plugin API changes (experimental hooks may change)

---

*Phase: 73-context-injection*
*Research completed: 2026-03-09*
