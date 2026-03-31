# Phase 144: Safety Guardrails - Research

**Researched:** 2026-03-28
**Domain:** Destructive command detection, Unicode normalization, container detection
**Confidence:** HIGH

## Summary

Phase 144 extends the existing advisory-guardrails system (`src/plugin/advisory-guardrails.js`) with a new GARD-04 guardrail that detects destructive shell commands (rm -rf, DROP TABLE, git push --force, etc.) executed via the `bash` tool. The existing architecture is well-established: factory function pattern, `tool.execute.after` hook integration via `safeHook()`, notification via the dual-channel notifier, and config nesting under `advisory_guardrails` in `config.json`.

The implementation requires: (1) a pattern library of ~25 categorized regex patterns with three severity tiers, (2) Unicode NFKD normalization with zero-width character stripping before pattern matching, (3) cached container/sandbox detection at plugin startup, and (4) user-configurable overrides at global, category, and per-pattern granularity.

**Primary recommendation:** Extend `advisory-guardrails.js` with a new GARD-04 section following the exact same factory-function pattern as GARD-01/02/03. Add a `BASH_TOOLS` set (containing 'bash') parallel to the existing `WRITE_TOOLS` set. Pattern library structure should mirror the proven `SECURITY_PATTERNS` array from `src/commands/skills.js` (id, category, severity, pattern, description).

## User Constraints

These constraints are locked decisions from CONTEXT.md and MUST be honored:

| Constraint | Source | Impact |
|-----------|--------|--------|
| Advisory-only via `tool.execute.after` hook | Implementation Decision | No blocking — uses context injection notifications |
| Three severity tiers: CRITICAL, WARNING, INFO | Implementation Decision | Pattern definitions must include severity; notification behavior differs per tier |
| Post-execution timing | Implementation Decision | Hook fires AFTER bash execution, not before |
| Context injection only (`<bgsd-notification>` blocks) | Implementation Decision | No OS-level notifications for GARD-04 (unlike GARD-01/02 which use OS notifications for warning+) |
| Config nests under `advisory_guardrails.destructive_commands` | Implementation Decision | Extends existing config structure |
| Custom patterns merge with built-ins (don't replace) | Implementation Decision | Merge strategy needed |
| Container detection via env vars first, then filesystem probes | Implementation Decision | Detection order is prescribed |
| Detect once at plugin startup, cache result | Implementation Decision | Container status checked in factory init, not per-call |
| `sandbox_mode` config: 'auto' (default), true, false | Implementation Decision | Three-value config key |
| In sandbox: skip WARNING/INFO, CRITICAL still fires | Implementation Decision | Sandbox modifies notification threshold |
| Three override levels: global toggle, per-category, per-pattern `disabled_patterns` | Implementation Decision | Config structure must support all three |
| No session overrides | Stress-Tested Decision | Config is the ONLY control plane |
| Unicode NFKD + strip zero-width + strip combining marks | Implementation Decision | Normalization pipeline before pattern matching |
| LLM behavioral guidance in notification by severity | Implementation Decision | CRITICAL="Confirm with user", WARNING="Proceed with caution", INFO=facts only |

### Phase Requirements

| ID | Requirement | Maps To |
|----|-------------|---------|
| DO-114 | Destructive command detection with safety guardrails | This entire phase |
| SC-93 | Zero false negatives on core patterns (rm -rf, DROP TABLE, force-push) | Pattern library completeness + test coverage |
| C-03 | All operations are advisory — never block workflow execution | Post-execution hook, no blocking |

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Node.js `String.prototype.normalize('NFKD')` | Built-in (ES2015+) | Unicode normalization | Zero dependencies; NFKD is the right decomposition form for security normalization — it decomposes compatibility characters AND canonical equivalents |
| Node.js `RegExp` | Built-in | Pattern matching | Zero dependencies; same approach used by SECURITY_PATTERNS in skills.js (41 patterns, proven) |
| Node.js `fs.existsSync` / `fs.readFileSync` | Built-in | Container filesystem probes | Same sync approach used by `is-docker` and `is-inside-container` packages |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `process.env` | Built-in | Container env var detection | First-pass container detection (DOCKER_HOST, CODESPACES, GITPOD_WORKSPACE_ID, etc.) |
| Existing `createNotifier` | In-project | Notification delivery | Already wired; GARD-04 calls `notifier.notify()` same as GARD-01/02/03 |
| Existing `safeHook` | In-project | Error boundary wrapping | Already wraps the `tool.execute.after` hook |
| Existing `parseConfig` | In-project | Config loading | Already handles nested object merging for `advisory_guardrails` |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Hand-rolled container detection | `is-docker` / `is-inside-container` npm packages | Zero-dependency policy prohibits npm packages; source code is trivial (~30 lines) and can be inlined |
| Regex patterns | AST-based command parsing (e.g., `shell-quote`) | Massive complexity for marginal gain; regex is proven with SECURITY_PATTERNS; advisory-only means false positives are annoying not blocking |
| NFKD normalization | NFC normalization | NFC only handles canonical equivalences, NOT compatibility characters; NFKD handles both (e.g., fullwidth apostrophe U+FF07 → regular apostrophe) |

## Architecture Patterns

### Recommended Project Structure

```
src/plugin/advisory-guardrails.js    # Extend with GARD-04 section
src/plugin/parsers/config.js         # Add destructive_commands defaults under advisory_guardrails
src/lib/constants.js                 # No changes needed (CONFIG_SCHEMA is flat keys only, advisory_guardrails is handled by plugin parser)
tests/plugin-advisory-guardrails.test.cjs  # Add GARD-04 test section
```

### Pattern 1: Factory Extension Pattern (GARD-04 in advisory-guardrails.js)

The existing `createAdvisoryGuardrails` factory function initializes per-session state in closures and returns an `onToolAfter` handler. GARD-04 follows the same pattern:

```javascript
// At module level (like WRITE_TOOLS):
const BASH_TOOLS = new Set(['bash']);

// Destructive command patterns (like SECURITY_PATTERNS in skills.js):
const DESTRUCTIVE_PATTERNS = [
  { id: 'fs-rm-rf', category: 'filesystem', severity: 'critical', pattern: /\brm\s+(-[a-zA-Z]*r[a-zA-Z]*\s+|--recursive)/, description: 'Recursive file deletion' },
  // ... 25+ patterns
];

// Inside createAdvisoryGuardrails factory:
// 1. Read destructive_commands config
// 2. Detect container/sandbox status (cached)
// 3. Build merged pattern list (built-in + custom)
// 4. In onToolAfter: check BASH_TOOLS, normalize command, match patterns, notify
```

### Pattern 2: Unicode Normalization Pipeline

Three-step normalization applied to command strings before pattern matching:

```javascript
function normalizeCommand(raw) {
  // Step 1: NFKD decomposition — expands compatibility characters
  // e.g., fullwidth 'ｒｍ' → 'rm', ligatures decomposed
  let normalized = raw.normalize('NFKD');

  // Step 2: Strip zero-width characters (U+200B, U+200C, U+200D, U+2060, U+FEFF)
  normalized = normalized.replace(/[\u200B-\u200D\u2060\uFEFF]/g, '');

  // Step 3: Strip combining marks (Unicode category Mn — marks, nonspacing)
  // After NFKD, accented chars become base + combining mark. Strip the marks.
  // e.g., 'é' (U+00E9) → 'e' + combining acute (U+0301) → 'e'
  normalized = normalized.replace(/[\u0300-\u036F]/g, '');

  return normalized;
}
```

### Pattern 3: Container Detection (Cached at Init)

```javascript
function detectSandboxEnvironment(configOverride) {
  // Config override takes precedence
  if (configOverride === true) return true;
  if (configOverride === false) return false;
  // 'auto' (default) — run detection

  // Phase 1: Environment variables (fast, no I/O)
  const envSignals = [
    'DOCKER_HOST',           // Docker
    'SINGULARITY_NAME',      // Singularity/Apptainer
    'MODAL_TASK_ID',         // Modal
    'DAYTONA_WS_ID',         // Daytona
    'CODESPACES',            // GitHub Codespaces
    'GITPOD_WORKSPACE_ID',   // Gitpod
  ];
  if (envSignals.some(key => process.env[key])) return true;

  // Phase 2: Filesystem probes (Linux only)
  try { fs.statSync('/.dockerenv'); return true; } catch {}
  try { fs.statSync('/run/.containerenv'); return true; } catch {}
  try {
    const cgroup = fs.readFileSync('/proc/self/cgroup', 'utf-8');
    if (/docker|containerd|kubepods/i.test(cgroup)) return true;
  } catch {}

  return false;
}
```

### Pattern 4: Notification Format with LLM Behavioral Guidance

```xml
<bgsd-notification type="advisory-destructive" severity="critical">
GARD-04: rm -rf /tmp/build matched [filesystem-recursive-delete] (CRITICAL)
Confirm with user before proceeding with this destructive operation.
</bgsd-notification>
```

Severity-based behavioral instructions:
- CRITICAL: "Confirm with user before proceeding with this destructive operation."
- WARNING: "Proceed with caution — this operation may be difficult to reverse."
- INFO: (no behavioral instruction — facts only)

### Pattern 5: Config Structure

```json
{
  "advisory_guardrails": {
    "enabled": true,
    "conventions": true,
    "planning_protection": true,
    "test_suggestions": true,
    "destructive_commands": {
      "enabled": true,
      "sandbox_mode": "auto",
      "categories": {
        "filesystem": true,
        "database": true,
        "git": true,
        "system": true,
        "supply-chain": true
      },
      "disabled_patterns": [],
      "custom_patterns": []
    }
  }
}
```

### Anti-Patterns to Avoid

1. **Don't parse bash commands as AST.** Regex is the right tool for advisory-only detection. Shell parsing is a rabbit hole (quoting, escaping, heredocs, pipes) that adds complexity without proportional value when false positives are annoying but not blocking.

2. **Don't normalize AFTER pattern matching.** Normalization MUST happen before matching or Unicode bypass characters will evade detection.

3. **Don't detect container status per-call.** Container status doesn't change mid-session. Detecting on every bash call wastes I/O.

4. **Don't use `tool.execute.before` hook.** The host editor doesn't support pre-execution hooks that can block. Even if it did, C-03 constraint means advisory-only regardless. Post-execution is the correct pragmatic choice.

5. **Don't check `args.filePath` for bash tool.** The bash tool uses `args.command` (the shell command string), not `args.filePath`. GARD-01/02/03 check filePath because they intercept write/edit/patch tools.

6. **Don't create a separate module.** GARD-04 belongs in `advisory-guardrails.js` with GARD-01/02/03. The factory function pattern supports adding new guardrail types without architectural changes.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Unicode normalization | Custom character tables | `String.prototype.normalize('NFKD')` | Built-in, spec-compliant, handles all Unicode planes |
| Zero-width char stripping | Manual char-by-char filtering | Regex `[\u200B-\u200D\u2060\uFEFF]` + combining marks `[\u0300-\u036F]` | Covers all common zero-width and combining characters; well-documented Unicode ranges |
| Container detection | Complex runtime introspection | Env var check + filesystem probe (is-docker pattern) | Proven by sindresorhus/is-docker (85M+ downloads); trivial to inline |
| Pattern library | Inventing dangerous command categories | Draw from existing SECURITY_PATTERNS structure + OWASP command injection patterns | Proven 41-pattern structure in skills.js; extend, don't reinvent |
| Config merging | Custom deep merge | Existing `NESTED_OBJECT_KEYS` shallow merge in `parsers/config.js` | Already handles nested advisory_guardrails config with user overrides |
| Notification delivery | Custom notification channel | Existing `notifier.notify()` with type/severity/message | Already handles dedup, rate limiting, DND, ring buffer history |

## Common Pitfalls

### Pitfall 1: Unicode Bypass via Confusable Characters

**What goes wrong:** Attacker (or copy-paste from Stack Overflow) uses fullwidth characters (ｒｍ), Cyrillic lookalikes (рм using Cyrillic р), or zero-width joiners between characters to bypass pattern matching.

**Why it happens:** Regex patterns match ASCII; Unicode provides thousands of visually identical or invisible characters. The OpenAI Codex project documented this exact vulnerability (CVE-style issue #13095: "Unicode confusable characters can bypass exec policy matching").

**How to avoid:** Three-step normalization pipeline: NFKD decomposition → strip zero-width characters → strip combining marks. This collapses fullwidth, compatibility, and decorated forms back to ASCII base characters. Note: cross-script confusables (Cyrillic а vs Latin a) are NOT solved by NFKD — they require homoglyph detection tables. For Phase 144's advisory-only context, NFKD is sufficient; homoglyph detection is out of scope.

**Warning signs:** Tests pass with ASCII but fail when fed copy-pasted commands from web pages with smart quotes or em-dashes.

### Pitfall 2: False Positives on Safe Commands

**What goes wrong:** Pattern matches unintended commands — e.g., `rm` matches `format`, `chmod 777` matches comments explaining what NOT to do, `eval` matches `evaluation`.

**Why it happens:** Regex patterns without word boundaries or context anchoring match substrings.

**How to avoid:** Use `\b` word boundaries in patterns. Test against common false-positive triggers: variable names containing pattern keywords, comments explaining dangerous commands, commands in echo/printf strings, and compound commands where only a safe subcommand matches.

**Warning signs:** Excessive INFO-level warnings on benign commands during normal development.

### Pitfall 3: CGroup v2 Detection Differences

**What goes wrong:** Container detection via `/proc/self/cgroup` fails on hosts using CGroup v2 (modern Linux kernels 5.8+). In CGroup v2, the content is `0::/` instead of containing `docker` or `containerd`.

**Why it happens:** CGroup v2 uses a unified hierarchy. The Docker/containerd-specific paths only appear in CGroup v1.

**How to avoid:** Env var detection runs first (covers most cases). Filesystem probe (/.dockerenv) works regardless of cgroup version. The `/proc/self/cgroup` check is a fallback, not the primary method. Also check `/proc/self/mountinfo` for `/docker/containers/` (the approach used by `is-docker` v4+).

**Warning signs:** `sandbox_mode: 'auto'` returns false inside containers on modern Linux hosts.

### Pitfall 4: Bash Tool Input Shape

**What goes wrong:** Code looks for `input.args.filePath` or `input.args.content` on bash tool calls and finds nothing.

**Why it happens:** The bash tool's input shape is `{ tool: 'bash', args: { command: '...' } }`, not the same as write/edit tools which have `args.filePath`.

**How to avoid:** For GARD-04, extract `input.args.command` (the shell command string). The existing stuck-detector already demonstrates correct bash tool input handling: `const argsStr = JSON.stringify(input.args || {})`.

**Warning signs:** GARD-04 never fires because it's checking for a property that doesn't exist on bash tool calls.

### Pitfall 5: Config Defaults Not Propagated to Plugin Parser

**What goes wrong:** New `destructive_commands` config keys work in tests but are undefined at runtime because `CONFIG_DEFAULTS` in `parsers/config.js` wasn't updated.

**Why it happens:** The plugin uses its own inlined config defaults (separate from `CONFIG_SCHEMA` in `constants.js`), and these must be manually synchronized.

**How to avoid:** Update `CONFIG_DEFAULTS` in `src/plugin/parsers/config.js` to include `destructive_commands` nested under `advisory_guardrails`. The shallow merge in `NESTED_OBJECT_KEYS` already handles `advisory_guardrails`, so adding sub-keys propagates correctly.

**Warning signs:** Features work when config.json has explicit settings but fail with default config.

### Pitfall 6: Notification Routing Mismatch

**What goes wrong:** GARD-04 notifications go to OS notifications when they should be context-only, or vice versa.

**Why it happens:** The existing notifier routes `severity: 'critical'` and `severity: 'warning'` to OS notifications. But per CONTEXT.md, GARD-04 uses context injection only — no OS-level notifications.

**How to avoid:** GARD-04 should use `severity: 'info'` for all tiers in the notification object, with the logical severity (CRITICAL/WARNING/INFO) embedded in the message text. OR: add a `channel: 'context-only'` option to the notifier. The simplest approach: make the notification message contain the severity text ("CRITICAL", "WARNING", "INFO") while using a notification severity that routes correctly for context-only delivery.

**Warning signs:** OS notification popups for every bash command that matches a pattern.

## Code Examples

### Example 1: Pattern Definition Structure (Mirrors skills.js SECURITY_PATTERNS)

```javascript
const DESTRUCTIVE_PATTERNS = [
  // ── Filesystem ──
  { id: 'fs-rm-recursive',   category: 'filesystem',   severity: 'critical', pattern: /\brm\s+(-[a-zA-Z]*r[a-zA-Z]*\b|--(recursive|force))/,   description: 'Recursive or forced file deletion (rm -r, rm -rf, rm --recursive)' },
  { id: 'fs-rm-force',       category: 'filesystem',   severity: 'warning',  pattern: /\brm\s+-[a-zA-Z]*f[a-zA-Z]*\b(?!.*-[a-zA-Z]*r)/,        description: 'Forced file deletion without recursive (rm -f)' },
  { id: 'fs-rm-plain',       category: 'filesystem',   severity: 'info',     pattern: /\brm\s+(?!-)/,                                             description: 'Plain file deletion (rm)' },
  { id: 'fs-format',         category: 'filesystem',   severity: 'critical', pattern: /\b(mkfs|format)\b/,                                         description: 'Disk formatting' },
  { id: 'fs-dd',             category: 'filesystem',   severity: 'critical', pattern: /\bdd\s+.*of=/,                                              description: 'Raw disk write (dd of=)' },

  // ── Database ──
  { id: 'db-drop-table',     category: 'database',     severity: 'critical', pattern: /\bDROP\s+(TABLE|DATABASE|SCHEMA)\b/i,                        description: 'Drop database object' },
  { id: 'db-truncate',       category: 'database',     severity: 'critical', pattern: /\bTRUNCATE\s+TABLE\b/i,                                      description: 'Truncate table' },
  { id: 'db-delete-no-where',category: 'database',     severity: 'warning',  pattern: /\bDELETE\s+FROM\s+\w+\s*(?:;|$)/i,                          description: 'DELETE without WHERE clause' },

  // ── Git ──
  { id: 'git-force-push',    category: 'git',          severity: 'critical', pattern: /\bgit\s+push\s+.*--force\b/,                                 description: 'Force push (rewrite remote history)' },
  { id: 'git-force-push-f',  category: 'git',          severity: 'critical', pattern: /\bgit\s+push\s+-[a-zA-Z]*f/,                                 description: 'Force push shorthand (-f)' },
  { id: 'git-reset-hard',    category: 'git',          severity: 'warning',  pattern: /\bgit\s+reset\s+--hard\b/,                                   description: 'Hard reset (discard uncommitted changes)' },
  { id: 'git-clean-fd',      category: 'git',          severity: 'warning',  pattern: /\bgit\s+clean\s+-[a-zA-Z]*f/,                                description: 'Force clean untracked files' },

  // ── System ──
  { id: 'sys-kill-9',        category: 'system',       severity: 'warning',  pattern: /\bkill\s+-9\b/,                                              description: 'Force kill process (SIGKILL)' },
  { id: 'sys-chmod-777',     category: 'system',       severity: 'warning',  pattern: /\bchmod\s+777\b/,                                            description: 'World-writable permissions' },
  { id: 'sys-chmod-recursive',category: 'system',      severity: 'warning',  pattern: /\bchmod\s+-[a-zA-Z]*R/,                                      description: 'Recursive permission change' },
  { id: 'sys-chown-recursive',category: 'system',      severity: 'warning',  pattern: /\bchown\s+-[a-zA-Z]*R/,                                      description: 'Recursive ownership change' },
  { id: 'sys-shutdown',      category: 'system',       severity: 'critical', pattern: /\b(shutdown|reboot|halt|poweroff)\b/,                         description: 'System shutdown/reboot' },
  { id: 'sys-iptables-flush',category: 'system',       severity: 'critical', pattern: /\biptables\s+-F\b/,                                          description: 'Flush firewall rules' },

  // ── Supply Chain ──
  { id: 'sc-curl-pipe',      category: 'supply-chain', severity: 'info',     pattern: /\bcurl\s+.*\|\s*(ba)?sh\b/,                                  description: 'Pipe remote script to shell (curl | bash)' },
  { id: 'sc-wget-pipe',      category: 'supply-chain', severity: 'info',     pattern: /\bwget\s+.*\|\s*(ba)?sh\b/,                                  description: 'Pipe remote script to shell (wget | bash)' },
  { id: 'sc-eval',           category: 'supply-chain', severity: 'info',     pattern: /\beval\s+/,                                                   description: 'Shell eval (arbitrary code execution)' },
  { id: 'sc-npm-global',     category: 'supply-chain', severity: 'info',     pattern: /\bnpm\s+install\s+-g\b/,                                     description: 'Global npm package installation' },
];
```

### Example 2: onToolAfter Extension for GARD-04

```javascript
async function onToolAfter(input) {
  if (guardConfig.enabled === false) return;

  try {
    const toolName = input?.tool;
    if (!toolName) return;

    // ── GARD-04: Destructive command detection ────────────
    if (destructiveEnabled && BASH_TOOLS.has(toolName)) {
      const rawCommand = input?.args?.command;
      if (!rawCommand) return;

      const normalized = normalizeCommand(rawCommand);
      const matches = matchPatterns(normalized, mergedPatterns, disabledPatterns, categoryConfig);

      for (const match of matches) {
        // Sandbox suppression: skip WARNING and INFO in sandbox mode
        if (isSandbox && match.severity !== 'critical') continue;

        const behavioral = match.severity === 'critical'
          ? 'Confirm with user before proceeding with this destructive operation.'
          : match.severity === 'warning'
            ? 'Proceed with caution — this operation may be difficult to reverse.'
            : '';

        await notifier.notify({
          type: 'advisory-destructive',
          severity: match.severity === 'critical' ? 'warning' : 'info',
          message: `GARD-04: ${rawCommand.slice(0, 80)} matched [${match.id}] (${match.severity.toUpperCase()})${behavioral ? '. ' + behavioral : ''}`,
        });
      }
      return; // Don't fall through to GARD-01/02/03 for bash tool
    }

    // Existing GARD-01/02/03 logic for write/edit/patch tools...
    if (!WRITE_TOOLS.has(toolName)) return;
    // ... rest unchanged
  } catch (err) {
    getLogger().write('ERROR', `Advisory guardrails error: ${err.message}`);
  }
}
```

### Example 3: Custom Pattern Merge

```javascript
function mergePatterns(builtIn, custom) {
  // Custom patterns have 'custom-' prefix by convention
  const merged = [...builtIn];
  for (const cp of custom) {
    // Validate required fields
    if (!cp.id || !cp.pattern || !cp.category || !cp.severity) continue;
    // Convert string pattern to RegExp if needed
    const pattern = typeof cp.pattern === 'string' ? new RegExp(cp.pattern) : cp.pattern;
    merged.push({ ...cp, pattern, custom: true });
  }
  return merged;
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| CGroup v1 container detection (`/proc/self/cgroup` with `docker` string) | Multi-signal: env vars → filesystem probes → cgroup v1/v2 → mountinfo | 2023 (CGroup v2 adoption) | `is-docker` v4+ added `/proc/self/mountinfo` check; env vars are most reliable |
| Simple string matching for dangerous commands | Regex with word boundaries + Unicode normalization | 2025 (OpenAI Codex issue #13095) | Unicode confusable bypass is a documented attack vector; normalization is now standard practice |
| Binary dangerous/safe classification | Severity tiers (critical/warning/info) | Industry trend 2024-2025 | AWS GuardDuty, Datadog, Falco all use severity-based detection; avoids alert fatigue |
| Blocking execution on dangerous commands | Advisory-only with LLM behavioral guidance | Emerging 2025-2026 | AI coding assistants can't block tools without breaking flow; advisory + LLM instruction is the pragmatic middle ground |

## Open Questions

1. **Notification routing for GARD-04:** The existing notifier sends OS notifications for `severity: 'warning'` and `severity: 'critical'`. CONTEXT.md says "context injection only" for GARD-04. Decision needed: (a) use `severity: 'info'` for all GARD-04 notifications and embed logical severity in message text, OR (b) add a notification channel option. Recommendation: option (a) is simpler and consistent with the advisory-only principle. The planner should decide.

2. **Custom pattern RegExp from JSON:** `config.json` stores patterns as strings, but matching requires RegExp objects. The merge function needs to handle `new RegExp(stringPattern)` conversion with error handling for invalid regex. The planner should specify whether to validate custom patterns at init time (fail-fast) or at match time (lazy, more tolerant).

3. **False-positive testing for Unicode normalization:** CONTEXT.md stress-tested decision flags this: "Needs false-positive testing against real-world command pastes (Stack Overflow smart quotes, em-dashes, etc.) before shipping." The planner should include a dedicated test task for this.

## Sources

### Primary (HIGH confidence)

- **Existing codebase:** `src/plugin/advisory-guardrails.js` (435 lines) — factory function pattern, WRITE_TOOLS set, onToolAfter handler, config integration, tests. Direct source of truth for architecture.
- **Existing codebase:** `src/commands/skills.js` SECURITY_PATTERNS (41 patterns) — proven pattern library structure with id/category/severity/pattern/description. Direct model for DESTRUCTIVE_PATTERNS.
- **Existing codebase:** `src/plugin/index.js` — plugin hook registration, safeHook wrapping, guardrails initialization and wiring.
- **Existing codebase:** `src/plugin/parsers/config.js` — CONFIG_DEFAULTS structure, NESTED_OBJECT_KEYS shallow merge, advisory_guardrails default schema.
- **Existing codebase:** `src/plugin/notification.js` — notifier.notify() signature, severity routing (critical/warning → OS, all → context queue), dedup/rate limiting.
- **Existing codebase:** `src/plugin/stuck-detector.js` — parallel example of tool.execute.after consumer; demonstrates input shape handling.
- **Existing tests:** `tests/plugin-advisory-guardrails.test.cjs` (525 lines) — test patterns for GARD-01/02/03, mock notifier, temp project setup.
- **MDN Web Docs:** `String.prototype.normalize()` — NFKD form decomposes both canonical and compatibility characters. HIGH confidence on behavior.

### Secondary (MEDIUM confidence)

- **sindresorhus/is-docker v4 source code** (GitHub) — container detection methods: `/.dockerenv`, `/proc/self/cgroup`, `/proc/self/mountinfo`. 85M+ downloads, battle-tested.
- **sindresorhus/is-inside-container source code** (GitHub) — adds Podman detection via `/run/.containerenv` on top of is-docker.
- **GitHub Codespaces docs** — `CODESPACES` env var is always `true` in codespaces. Official GitHub documentation.
- **Gitpod docs** — `GITPOD_WORKSPACE_ID` env var set automatically in workspaces.
- **OpenAI Codex issue #13095** — Unicode confusable characters bypassing exec policy matching. Documents the exact attack vector NFKD normalization addresses.
- **AppCheck NG** — Unicode normalization vulnerabilities article documenting NFKD security implications (fullwidth apostrophe U+FF07 → standard apostrophe).

### Tertiary (LOW confidence)

- **Docker Community Forums** — CGroup v2 detection differences (`0::/` instead of `docker` string). Community discussion, not official docs. Multiple contributors confirm the behavior.
- **Zero-width steganography research** (dev.to, cloudthat.com) — Documents zero-width character attacks on LLM systems. Confirms the zero-width stripping approach but not specific to shell commands.
- **Modal, Daytona, Singularity env vars** — Environment variable names sourced from context discussions, not official documentation. MEDIUM-LOW confidence; the config override (`sandbox_mode: true/false`) handles cases where auto-detection fails.

## Metadata

**Confidence breakdown:**
| Area | Level | Reason |
|------|-------|--------|
| Architecture pattern | HIGH | Direct codebase analysis — existing factory pattern, hook wiring, config structure |
| Pattern library structure | HIGH | Mirrors proven SECURITY_PATTERNS from skills.js |
| Unicode NFKD normalization | HIGH | Built-in Node.js API, well-documented behavior |
| Container env var detection | MEDIUM | Some env var names from community sources, not all officially documented; config override mitigates |
| Filesystem container probes | HIGH | is-docker v4 source code, widely deployed |
| Custom pattern merge strategy | MEDIUM | No direct precedent in codebase; recommendation based on skills.js merge patterns |

**Research date:** 2026-03-28
**Valid until:** 2026-06-28 (3 months — Unicode normalization and container detection methods are stable; pattern library may need updates for new dangerous commands)
