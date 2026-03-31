# Phase 145: Structured Agent Memory - Research

**Researched:** 2026-03-28
**Domain:** File-backed agent memory, prompt snapshotting, and memory-entry threat screening
**Confidence:** HIGH

## User Constraints

- Keep scope to a human-editable, git-trackable `.planning/MEMORY.md`; do **not** add broader retrieval systems, embeddings, or on-demand injection.
- Inject memory into agent system prompts as a **frozen snapshot at session start**; mid-session disk writes update the file but **do not** mutate the active prompt.
- If memory changes mid-session, show a concise refresh/restart notice so staleness is visible.
- Screen memory entries for prompt-injection patterns **before** injection; true matches are blocked, not warn-only.
- Treat direct instruction override, exfiltration attempts, and tool-coercion/bypass language as first-class blocker categories.
- For blocked entries, show blocker category plus a redacted snippet; do **not** offer rewrite suggestions.
- Preserve a balanced CLI UX: predictable structured writes, section-grouped list output mirroring `MEMORY.md`, and preview-first pruning.
- Pruning must consider both age and relevance; explicit keep intent matters.
- Respect project rules: backward compatible parsing, no breaking changes to existing planning files, single-file CLI, path-agnostic behavior, and low-ceremony workflows.

## Summary

Implement this phase as a **file-backed, schema-light memory layer**: one human-readable `MEMORY.md`, a tiny deterministic parser/serializer, a session-scoped frozen snapshot cache in the plugin, and a pre-injection screening pass that reuses the project's existing normalization and regex-guardrail style. This fits the repo's established architecture: manual markdown parsing, no new runtime dependencies, cached prompt/context builders, and advisory notifications routed through the plugin.

The strongest architectural constraint is the frozen snapshot boundary. Current prompt injection in the plugin is rebuilt on demand from cached project state, but this phase should **capture memory once per session object and reuse that exact text** until the session ends. If `MEMORY.md` changes later, mark the snapshot stale and surface a low-noise notice through the existing notification path rather than silently re-reading and re-injecting the file.

For security, do **entry-level blocking** rather than whole-file failure: normalize text, scan both raw and normalized forms, exclude matched entries from the injected snapshot, and warn once with counts/categories. For schema, prefer readable markdown entries with one required text line plus a few lightweight metadata lines (`Type`, `Added`, `Updated`; optional `Source`, `Keep`, `Status`). Avoid YAML-heavy records, hidden databases, or framework-style autonomous memory.

**Primary recommendation:** Use a manual markdown section parser + session-frozen injected snapshot + normalized regex screening, with no new npm dependency.

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Node.js built-ins (`fs`, `path`) | Project runtime | Read/write `MEMORY.md`, stat timestamps, manage file paths | Matches repo architecture and zero-dependency rule |
| Existing plugin hook pipeline (`experimental.chat.system.transform`, file watcher, notifier) | Existing repo code | Inject snapshot, detect staleness, surface concise notices | Already how project context enters prompts |
| Existing regex/line-parser approach | Existing repo code | Parse markdown sections and entry blocks deterministically | Consistent with `STATE.md`/`INTENT.md` parsers and single-file CLI |
| JavaScript `String.prototype.normalize()` | Baseline since 2016 (MDN) | Unicode normalization before security scanning | Required to catch obfuscated prompt-injection strings |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| CommonMark-compatible markdown conventions | 0.31.2 spec | Keep memory file readable, stable, and hand-editable | For section/header/list formatting only |
| Existing guardrail normalization pipeline from `src/plugin/advisory-guardrails.js` | Existing repo code | Reuse NFKD + zero-width stripping + combining-mark stripping | Before prompt-injection pattern matching |
| Existing `src/commands/memory.js` command patterns | Existing repo code | Reuse command organization, list/compact style, dry-run ergonomics | For new `memory:list/add/remove/prune` UX |
| Existing token budget checks from `src/plugin/token-budget.js` | Existing repo code | Bound injected memory size and warn on overflow | When building snapshot text |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Manual markdown parser | Markdown AST library (`remark`, `markdown-it`) | Rejected: adds dependency weight and breaks repo's current parser style |
| `MEMORY.md` as source of truth | JSON/SQLite-only memory | Rejected: fails human-editable, git-trackable requirement |
| Frozen per-session snapshot | Re-read file on every turn | Rejected: violates phase boundary and weakens prompt-cache/predictability benefits |
| Regex screening with normalization | LLM-based classifier | Rejected for v1: harder to make deterministic, noisier, slower, and less testable |
| Structured markdown memory | Embeddings / vector RAG memory | Rejected: outside phase boundary and too much ceremony |

## Architecture Patterns

### Recommended Project Structure

- `.planning/MEMORY.md` — canonical, human-edited memory file.
- `src/commands/memory*.js` or `src/commands/memory.js` — CLI CRUD/prune commands plus parser/serializer helpers.
- `src/plugin/` integration — session snapshot cache, stale flag, notification routing, and prompt injection builder.
- Tests split across parser/command/plugin integration: parser fixtures, command behavior, snapshot-freeze behavior, screening behavior.

### Pattern 1: File-backed canonical memory with deterministic section parser

Use `MEMORY.md` as the only canonical store. Parse only the limited structure you define; do **not** implement a full markdown parser.

Recommended shape:

```markdown
# Agent Memory

## Active / Recent
- **MEM-001** [project-fact] CLI is single-file and zero-dependency.
  - Added: 2026-03-28
  - Updated: 2026-03-28
  - Source: AGENTS.md
  - Status: active

## Project Facts
- **MEM-010** The plugin injects context through system-transform hooks.
  - Added: 2026-03-28
  - Updated: 2026-03-28

## User Preferences
## Environment Patterns
## Correction History
```

Prescriptive schema rules:

- Top-level sections: `Active / Recent`, `Project Facts`, `User Preferences`, `Environment Patterns`, `Correction History`.
- One entry = one lead bullet line plus indented metadata bullets.
- Required metadata: `Added`, `Updated`.
- Required semantic type tag in the lead line: `project-fact`, `user-preference`, `environment-pattern`, `correction`.
- Optional metadata only when helpful: `Source`, `Keep`, `Status`, `Expires`, `Replaces`.
- Keep IDs stable (`MEM-001`, `MEM-002`) so remove/prune operations and git diffs stay predictable.

Why this shape: it is readable in raw markdown, diff-friendly, easy to parse with regex/indent rules, and aligned with the user's “small schema, not rigid records” guidance.

### Pattern 2: Session-frozen snapshot injection

Treat memory injection as a session lifecycle concern, not a per-turn file read.

Recommended flow:

1. First prompt injection in a session loads and parses `MEMORY.md`.
2. Screen entries and build a **snapshot string**.
3. Cache that exact injected string in plugin memory for the life of the session/plugin instance.
4. On later turns, reuse the cached string instead of re-reading disk.
5. If file watcher sees `MEMORY.md` change, mark snapshot `stale=true` and emit one concise notification like: `Memory updated on disk; restart/refresh session to load new entries.`

This matches the phase requirement and improves stability. It also aligns with current API guidance that conversation state is application-managed and with prompt-caching guidance that exact static prefixes benefit latency/cost.

### Pattern 3: Entry-level screening before injection

Run screening **after parsing and before snapshot assembly**.

Recommended screening pipeline:

1. Scan raw entry text.
2. Normalize with existing repo pipeline: NFKD → remove zero-width chars → remove combining marks.
3. Lowercase/collapse whitespace for matching convenience.
4. Match against a focused dangerous-pattern library.
5. If matched, exclude that entry from the injected snapshot and collect a structured warning record.
6. Inject only safe entries.

Recommended blocker categories:

- **Instruction override:** `ignore previous instructions`, `you are now`, `new instructions`, `<system>`, `[INST]`.
- **Exfiltration / prompt leak:** `reveal system prompt`, `show hidden instructions`, `print secrets`, `output env`.
- **Tool coercion / bypass:** `always use bash`, `skip confirmation`, `disable guardrails`, `bypass approvals`, `force tool call`.

Block on strong matches only. For v1, prefer high-precision deterministic patterns over speculative heuristics.

### Pattern 4: Preview-first pruning with reversible selection

`memory:prune` should never silently delete. Default behavior should show a candidate set with reason codes.

Recommended scoring rules:

- Never prune entries with `Keep: always` or equivalent pinned marker.
- Protect `Active / Recent` entries unless explicitly forced.
- Candidate if `Updated` older than threshold **and** not pinned **and** not in active/recent.
- For correction history, prefer pruning superseded or one-off corrections first.
- Default output: grouped preview with reasons like `old`, `superseded`, `inactive`, `duplicate`.
- `--apply` performs deletion; without it, preview only.

For v1, approximate “recent use” via section placement (`Active / Recent`) and explicit keep intent rather than automatic last-used writes every session, because auto-touching the file would create noisy git churn.

### Pattern 5: CLI ergonomics mirror the file

- `memory:list` should print sections in file order with compact entry summaries.
- `memory:add` should write in the same shape the human sees in `MEMORY.md`.
- `memory:remove` should accept stable ID, not fragile line numbers.
- `memory:prune` should report candidates by section, reason, and age.

Recommended `memory:add` API:

```bash
bgsd-tools memory:add --section "Project Facts" --text "CLI is single-file and zero-dependency" --source AGENTS.md --keep always
```

Avoid free-form conversational writes as the primary interface. Deterministic flags produce more consistent stored structure.

### Anti-Patterns to Avoid

- Re-reading `MEMORY.md` on every turn.
- Auto-mutating `MEMORY.md` every session just to update “last used”.
- Whole-file rejection because one entry is unsafe.
- General markdown AST parsing for a tiny fixed schema.
- Hidden secondary truth source where markdown and JSON/SQLite can drift.
- Suggesting rewrites for blocked unsafe entries.
- Expanding scope into retrieval memory, search ranking, or autonomous summarization.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Unicode obfuscation defense | A new custom normalization algorithm | Reuse `String.normalize()` plus the repo's existing zero-width/combining-mark stripping pipeline | Already implemented, testable, and fits current guardrail style |
| Markdown parsing | A full markdown parser/renderer | A tiny section-and-entry parser for the fixed schema | Lower risk, no dependency, aligns with repo conventions |
| Prompt-injection classifier | A fuzzy LLM-based judge in the hot path | Deterministic regex categories with normalization | Faster, explainable, easier to regression-test |
| Session change visibility | A bespoke output channel | Existing notifier/system-context notification path | Fits plugin architecture and keeps warnings low-noise |
| Human-editable memory store | Hidden DB-first storage | `MEMORY.md` as canonical, optional cached projection only | Meets git-trackable requirement |
| Prune safety | One-shot destructive cleanup | Preview-first candidate listing + `--apply` | Reduces accidental data loss |

## Common Pitfalls

### Pitfall 1: Snapshot accidentally becomes live state
**What goes wrong:** The plugin re-parses `MEMORY.md` during later turns, so mid-session edits silently change model behavior.  
**Why it happens:** Existing project context injection is built dynamically, so it is easy to copy that pattern without adding a session cache boundary.  
**How to avoid:** Cache the rendered memory snapshot in plugin instance state and reuse it until session restart.  
**Warning signs:** A test edits `MEMORY.md` mid-session and later turns immediately reflect the new text.

### Pitfall 2: Unsafe entry blocks the whole memory file
**What goes wrong:** One malicious or malformed entry disables all memory injection.  
**Why it happens:** Simpler implementation path is file-level fail/skip.  
**How to avoid:** Screen entries independently and inject only the safe subset.  
**Warning signs:** A single blocked entry causes `MEMORY.md` to disappear entirely from the prompt.

### Pitfall 3: Security scan misses obfuscated text
**What goes wrong:** Fullwidth, zero-width, or combining-mark variants bypass simple regex checks.  
**Why it happens:** Scanning only raw text misses Unicode obfuscation patterns documented by OWASP.  
**How to avoid:** Scan both raw and normalized forms using the existing normalization pipeline.  
**Warning signs:** `ｉｇｎｏｒｅ previous instructions` or zero-width variants are not blocked.

### Pitfall 4: CLI writes drift from hand-edited markdown
**What goes wrong:** `memory:add` creates one structure while humans edit a different one.  
**Why it happens:** Command output is designed independently from the file format.  
**How to avoid:** Make CLI serialization the same shape as canonical markdown examples and list output.  
**Warning signs:** Hand-edited entries are lost, reformatted unexpectedly, or cannot be removed by ID.

### Pitfall 5: Pruning creates git-noise or data-loss fear
**What goes wrong:** Users avoid pruning because the tool feels destructive or noisy.  
**Why it happens:** Automatic `last_used` touches or apply-by-default deletion make the file churny.  
**How to avoid:** Preview first, protect pinned/active entries, and avoid passive write amplification.  
**Warning signs:** `MEMORY.md` changes every session or prune output lacks reasons.

### Pitfall 6: Prompt budget bloat
**What goes wrong:** Memory grows until prompt injection becomes expensive or noisy.  
**Why it happens:** No section caps, no pruning discipline, and no active/recent staging boundary.  
**How to avoid:** Build snapshot from bounded sections, preserve an active/recent lane, and warn on token budget overflow.  
**Warning signs:** Snapshot text becomes the dominant part of the system prompt or repeatedly exceeds budget warnings.

## Code Examples

Verified patterns from official sources and current repo code.

### 1. Normalize before matching

From current repo guardrails, adapted for memory entry screening:

```js
function normalizeForMemoryScan(raw) {
  let normalized = raw.normalize('NFKD');
  normalized = normalized.replace(/[\u200B-\u200D\u2060\uFEFF]/g, '');
  normalized = normalized.replace(/[\u0300-\u036F]/g, '');
  return normalized;
}
```

### 2. High-precision blocker categories

```js
const BLOCK_PATTERNS = [
  { id: 'inject-ignore', category: 'instruction-override', pattern: /ignore\s+(all\s+)?previous\s+instructions?/i },
  { id: 'inject-role', category: 'instruction-override', pattern: /you\s+are\s+now/i },
  { id: 'inject-system', category: 'instruction-override', pattern: /<system>|\[INST\]/i },
  { id: 'exfil-prompt', category: 'exfiltration', pattern: /reveal\s+(your\s+)?system\s+prompt/i },
  { id: 'tool-bypass', category: 'tool-bypass', pattern: /(skip|bypass|disable).{0,20}(guardrails|confirmation|approval)/i },
];
```

### 3. Session-frozen snapshot boundary

```js
let memorySnapshot = null;
let memorySnapshotStale = false;

function getMemorySnapshot(cwd) {
  if (memorySnapshot) return memorySnapshot;
  memorySnapshot = buildAndScreenMemorySnapshot(cwd);
  return memorySnapshot;
}

function markMemoryStale() {
  memorySnapshotStale = true;
}
```

### 4. Preview-first prune result shape

```json
{
  "preview": true,
  "threshold_days": 90,
  "candidates": [
    { "id": "MEM-021", "section": "Correction History", "reason": "superseded", "age_days": 184 }
  ]
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| “Memory” means vector DB / autonomous long-term retrieval | For this class of assistant integration, a file-backed, explicit, auditable memory layer is often preferred when trust, diffs, and operator control matter | 2024-2026 ecosystem shift toward simpler, inspectable agent state for production workflows | Better debuggability and lower ceremony for bGSD-style tooling |
| Rebuild prompt context every turn | Keep stable prefixes/static instructions and reuse them; exact-prefix prompt caching rewards this shape | Reinforced by 2025-2026 API guidance on prompt caching and app-managed conversation state | Frozen session snapshots improve predictability and can reduce latency/cost |
| Keyword-only prompt injection filters | Normalize Unicode and account for obfuscation/typoglycemia classes | 2024-2026 security guidance (OWASP) | Safer screening without needing a heavyweight classifier |
| Leak-proof the prompt with complex tricks | Prefer simpler prompts plus pre-screening, post-screening, and monitoring | 2025-2026 Anthropic guidance | Lower complexity and less model-performance degradation |

## Open Questions

1. Should v1 expose `memory:prune --force-active` or reserve active/recent pruning for manual edits only?
2. Should blocked entries remain visible in `memory:list` with a blocked marker, or only surface through warnings at injection time?
3. Is there an existing session identifier in the plugin lifecycle worth reusing for stale-memory notices, or should the plugin instance itself define the session boundary?

## Sources

### Primary (HIGH confidence)

- Current repo code: `src/plugin/index.js` — existing system prompt injection, file watcher, notifier hooks.
- Current repo code: `src/plugin/context-builder.js` — prompt building and token-budget warning pattern.
- Current repo code: `src/plugin/advisory-guardrails.js` — normalization pipeline for obfuscation-resistant matching.
- Current repo code: `src/plugin/parsers/state.js`, `src/plugin/parsers/intent.js` — established manual markdown parsing style.
- Current repo code: `src/commands/memory.js` — existing memory command ergonomics, dry-run/compact patterns.
- OWASP LLM Prompt Injection Prevention Cheat Sheet — direct/remote injection, encoding, typoglycemia, structured separation, and monitoring: https://cheatsheetseries.owasp.org/cheatsheets/LLM_Prompt_Injection_Prevention_Cheat_Sheet.html
- Anthropic docs, “Mitigate jailbreaks and prompt injections” — validation screens, monitoring, layered safeguards: https://docs.anthropic.com/en/docs/test-and-evaluate/strengthen-guardrails/mitigate-jailbreaks
- Anthropic docs, “Reduce prompt leak” — avoid unnecessary complexity, use monitoring/post-processing: https://docs.anthropic.com/en/docs/test-and-evaluate/strengthen-guardrails/reduce-prompt-leak

### Secondary (MEDIUM confidence)

- OpenAI docs, “Conversation state” — state is application-managed unless explicitly persisted; context window management matters: https://platform.openai.com/docs/guides/conversation-state
- OpenAI docs, “Prompt caching” — exact prefix matches benefit from stable static prompt prefixes: https://platform.openai.com/docs/guides/prompt-caching
- OpenAI docs, “Safety best practices” — adversarial testing, HITL, and limiting risky inputs/outputs: https://platform.openai.com/docs/guides/safety-best-practices
- MDN, `String.prototype.normalize()` — normalization forms and compatibility behavior: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/normalize
- CommonMark Spec 0.31.2 — markdown readability rationale and stable structural conventions: https://spec.commonmark.org/0.31.2/

### Tertiary (LOW confidence)

- General ecosystem observation that explicit file-backed memory is increasingly preferred for high-trust coding agents when operator control matters. Useful directional signal, but not a single official standard.

## Metadata

**Confidence breakdown:** HIGH for repo architecture, snapshot-boundary recommendation, and normalization-based screening; MEDIUM for ecosystem-wide prompt caching/state guidance as applied to this exact plugin; LOW only for broader “industry trend” framing.  
**Research date:** 2026-03-28  
**Valid until:** 2026-06-28 or until prompt hook/session lifecycle architecture changes materially.
