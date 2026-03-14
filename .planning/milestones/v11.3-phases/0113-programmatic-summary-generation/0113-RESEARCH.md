# Phase 113: Programmatic Summary Generation - Research

**Researched:** 2026-03-13
**Domain:** CLI command development, git data extraction, SUMMARY.md template generation
**Confidence:** HIGH

<user_constraints>

## User Constraints (from CONTEXT.md)

These decisions are LOCKED — planner MUST honor them:

1. **Commit source:** Use STATE.md commit hashes as primary; fall back to git log message pattern matching
2. **Timing source:** Prefer STATE.md session data; fall back to git commit timestamps
3. **Frontmatter inference:** Derive subsystem from directory, tags from file types, key-files from most-changed files
4. **Five LLM judgment sections:** one-liner, accomplishments, decisions made, deviations, lessons learned
5. **TODO markers with hints:** e.g. `TODO: accomplishments (2-3 bullets, what changed and why)`
6. **Commit/file data inline** in scaffold (not hidden/collapsed) so LLM can reference them
7. **Writes directly to disk** (no stdout mode)
8. **Merge/preserve on re-run:** Regenerate data sections, keep LLM-written sections (detect by checking for TODO markers)
9. **Validate output** against `verify:summary` before writing
10. **Graceful fallback** on failure — fall back to current full-authorship with warning
11. **Workflow-internal only** — not exposed as a standalone user-facing slash command
12. **Executor workflow lists remaining TODOs** explicitly when handing scaffold to LLM

</user_constraints>

<phase_requirements>

## Phase Requirements

| ID | Description | How Verified |
|----|-------------|--------------|
| SUM-01 | `summary:generate` produces a pre-filled SUMMARY.md with frontmatter, performance, task commits, and files created/modified — all without LLM | Run command against completed plan, verify output has all data sections populated |
| SUM-02 | Execute-plan workflow calls `summary:generate` and LLM only fills judgment sections — at least 50% less writing | Compare line counts between old full-authorship and new scaffold approach |
| SUM-03 | Generated summaries pass `verify:summary` and `summary-extract` parsing without regressions | Run verify:summary and summary-extract against generated output |

</phase_requirements>

## Summary

Phase 113 builds a `summary:generate` CLI command that programmatically extracts deterministic data from git history, PLAN.md frontmatter, and STATE.md to pre-fill SUMMARY.md scaffolds. The current workflow requires the LLM to author entire SUMMARY.md files (~100-120 lines), including data it already has access to (commit hashes, file lists, timing). This phase offloads the data-driven sections to code, leaving only 5 judgment sections for the LLM.

The codebase already has all the building blocks: `structuredLog()` and `diffSummary()` in `src/lib/git.js` for commit/diff extraction, `extractFrontmatter()` in `src/lib/frontmatter.js` for PLAN.md parsing, `reconstructFrontmatter()` for YAML output, `findPhaseInternal()` for phase directory resolution, `verify:summary` for validation, and `summary-extract` for downstream parsing. The command needs to compose these existing primitives — no new libraries or patterns needed.

The execute-plan workflow (`workflows/execute-plan.md`) creates summaries at `<step name="create_summary">` (line 234). The integration point is clear: call `summary:generate` after `record_completion_time` and before `create_summary`, replacing the LLM's full authorship with filling in TODO-marked sections.

**Primary recommendation:** Build `summary:generate` as a new subcommand in the `util` namespace (following existing patterns like `util:summary-extract`), housed in `src/commands/misc.js` alongside related summary commands. Compose existing git.js and frontmatter.js primitives — zero new dependencies needed.

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Node.js built-ins (fs, path, child_process) | N/A | File I/O, path resolution, git exec | Already used everywhere in codebase |
| `src/lib/git.js` (execGit, structuredLog, diffSummary) | Internal | Commit log extraction, file diff stats | Proven git patterns, zero-shell overhead |
| `src/lib/frontmatter.js` (extractFrontmatter, reconstructFrontmatter) | Internal | PLAN.md parsing, SUMMARY.md frontmatter generation | Existing cached parser handles all YAML subset |
| `src/lib/helpers.js` (findPhaseInternal, getPhaseTree) | Internal | Phase directory resolution, plan/summary enumeration | Single-call phase tree cached across lookups |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `src/lib/output.js` (output, error) | Internal | JSON output formatting | Command output |
| `src/lib/config.js` (loadConfig) | Internal | Read config.json settings | Check commit_docs flag |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Custom YAML generation | Template literals | Template literals are simpler but `reconstructFrontmatter()` already handles edge cases (quoting colons, arrays) — use it |
| Namespace `summary:generate` | `util:summary-generate` or `execute:summary-generate` | `util` namespace already houses `summary-extract`; keep related commands together |

## Architecture Patterns

### Recommended Module Structure

```
src/commands/misc.js          # Add cmdSummaryGenerate() alongside cmdSummaryExtract()
src/router.js                 # Add 'summary-generate' case in 'util' namespace
src/lib/constants.js           # Add COMMAND_HELP entry for util:summary-generate
src/lib/commandDiscovery.js    # Add to routerImplementations.util
workflows/execute-plan.md      # Modify create_summary step to call summary:generate first
```

No new files needed — follows the existing pattern of adding commands to misc.js.

### Pattern 1: Data Extraction Pipeline

The command follows a clear pipeline:

1. **Resolve inputs:** Phase number + plan number → find phase directory, PLAN.md path
2. **Extract PLAN.md frontmatter:** phase, plan, type, requirements, files_modified, etc.
3. **Extract git commits:** Use `structuredLog()` filtered by conventional commit scope (`{phase}-{plan}`)
4. **Extract file diffs:** Use `diffSummary()` with first-commit-parent to last-commit range
5. **Extract timing:** From STATE.md session data or git commit timestamps
6. **Infer frontmatter fields:** subsystem from directory paths, tags from file extensions, key-files from most-changed
7. **Generate markdown:** Template literal with `reconstructFrontmatter()` for YAML header
8. **Merge/preserve:** If existing SUMMARY.md, detect TODO markers to identify unfilled sections; preserve filled sections
9. **Validate:** Run `verify:summary` logic before writing
10. **Write to disk:** Write file, output status

### Pattern 2: Commit Extraction Strategy

Two data sources with fallback chain (per user constraint):

**Primary: STATE.md commit hashes**
- STATE.md records task commit hashes via `util:memory write --store bookmarks` (execute-plan.md line 167)
- Extract hashes from bookmarks store or from STATE.md execution notes
- These are the most reliable source — exact hashes from actual execution

**Fallback: Git log pattern matching**
- Use `structuredLog()` with conventional commit scope matching
- Filter by scope `{phase_number}-{plan_number}` (e.g., `0112-01`)
- Already proven in `cmdReview()` at misc.js:1576-1579

```javascript
// Primary: get commits from scope matching
const all = structuredLog(cwd, { count: 30 });
const scoped = Array.isArray(all) 
  ? all.filter(c => c.conventional && c.conventional.scope === `${phase}-${plan}`)
  : [];
```

### Pattern 3: Merge/Preserve on Re-run

When SUMMARY.md already exists:

1. Read existing file
2. For each section, check if it contains `TODO:` markers
3. If markers present → section is unfilled → regenerate with fresh data
4. If markers absent → section was filled by LLM → preserve as-is
5. Always regenerate data sections (frontmatter, commits, files) with latest data

```javascript
function isSectionFilled(content, sectionHeader) {
  const sectionStart = content.indexOf(sectionHeader);
  if (sectionStart === -1) return false;
  const nextSection = content.indexOf('\n## ', sectionStart + sectionHeader.length);
  const sectionContent = nextSection !== -1 
    ? content.slice(sectionStart, nextSection)
    : content.slice(sectionStart);
  return !sectionContent.includes('TODO:');
}
```

### Pattern 4: Router Registration

Follow the exact pattern used by `summary-extract` (router.js:967-971):

```javascript
// In router.js, util namespace:
} else if (subcommand === 'summary-generate') {
  const phaseArg = restArgs[0];
  const planArg = restArgs[1];
  lazyMisc().cmdSummaryGenerate(cwd, phaseArg, planArg, raw);
}
```

Plus entries in:
- `constants.js` COMMAND_HELP: `'util:summary-generate'` with usage string
- `commandDiscovery.js` routerImplementations.util: `'summary-generate': null`

### Anti-Patterns to Avoid

1. **Don't create a new source file** — `misc.js` already has `cmdVerifySummary` and `cmdSummaryExtract`, keep summary commands together
2. **Don't add a new namespace** — `util` is the right home (already has summary-extract)
3. **Don't parse markdown body** for commit data — use git.js functions directly
4. **Don't shell out to git** — use `execGit()` which is already shell-free (execFileSync)
5. **Don't require the LLM to pass commit hashes** as args — the command discovers them from git log

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| YAML frontmatter generation | Custom string concatenation | `reconstructFrontmatter()` from frontmatter.js | Handles quoting, arrays, nested objects correctly |
| Git log extraction | Custom `git log` parsing | `structuredLog()` from git.js | Returns structured objects with file stats, conventional commit parsing |
| Git diff stats | Custom `git diff` parsing | `diffSummary()` from git.js | Returns structured file list with insertions/deletions |
| Phase directory resolution | Manual path construction | `findPhaseInternal()` from helpers.js | Handles normalization, archived phases, cached tree |
| Summary validation | Custom checks | `cmdVerifySummary()` validation logic | Already checks file existence, commit existence, self-check section |
| Frontmatter parsing | Custom YAML parser | `extractFrontmatter()` from frontmatter.js | Cached, pre-compiled regexes, handles all SUMMARY.md frontmatter |

## Common Pitfalls

### Pitfall 1: Commit Scope Mismatch

**What goes wrong:** Git commits may not use conventional commit format or may have inconsistent scopes (e.g., `feat(112-01)` vs `feat(0112-01)`)
**Why it happens:** Different executors may format commit messages differently; phase numbers may or may not be zero-padded
**How to avoid:** Normalize both the target scope and git commit scopes before comparison. Accept both `112-01` and `0112-01` as matching. Fall back gracefully to "recent N commits" if no scoped commits found.
**Warning signs:** Empty commit list despite visible recent commits in git log

### Pitfall 2: Empty or Missing STATE.md Session Data

**What goes wrong:** STATE.md may not have timing data for the current plan, especially if the plan was executed across multiple sessions or if STATE.md was manually edited
**Why it happens:** Session data is written by `verify:state record-session` which may not always capture start time
**How to avoid:** Always have a fallback: git commit timestamps for the first and last scoped commits provide reliable timing bounds. Don't error — compute from git.
**Warning signs:** Duration shows as "0 min" or timing is wildly wrong

### Pitfall 3: Merge/Preserve False Positive

**What goes wrong:** A section that was partially edited by the LLM still contains `TODO:` in a different context (e.g., "TODO items were tracked" in prose)
**Why it happens:** TODO detection is based on string matching
**How to avoid:** Use the specific marker format `TODO:` followed by a section hint in parentheses, e.g., `TODO: accomplishments (2-3 bullets)`. Check for this exact pattern, not just `TODO` anywhere.
**Warning signs:** LLM-written content being overwritten on re-generation

### Pitfall 4: File Diff Baseline Ambiguity

**What goes wrong:** `diffSummary()` needs a "from" ref, but the first commit of the plan may not be the right baseline
**Why it happens:** The first commit's parent might include changes from other work if the plan wasn't a clean break
**How to avoid:** Per CONTEXT.md, the agent has discretion on baseline approach. Recommended: use `firstCommit~1` (parent of first scoped commit) as baseline. This captures exactly the changes introduced by the plan.
**Warning signs:** Files appearing in diff that weren't part of this plan

### Pitfall 5: verify:summary Validation Failure

**What goes wrong:** Generated scaffold may fail `verify:summary` because it checks for mentioned files existing on disk and commit hashes being valid
**Why it happens:** Summary references files and commits that are real — but the check runs regexes that might match TODO markers as file paths or hashes
**How to avoid:** Ensure TODO markers don't look like file paths (use parenthesized hints, not backtick-wrapped text). Ensure data sections have real hashes. Run validation before write and handle failures gracefully.
**Warning signs:** `verify:summary` reports false positives on generated scaffold

## Code Examples

### Example 1: Commit Extraction (from existing codebase)

From `src/commands/misc.js:1576-1583` (cmdReview):

```javascript
const { structuredLog, diffSummary } = require('../lib/git');
const scope = `${phaseInfo.phase_number}-${padPlan}`;
const all = structuredLog(cwd, { count: 20 });
const scoped = Array.isArray(all) 
  ? all.filter(c => c.conventional && c.conventional.scope === scope) 
  : [];
```

### Example 2: Frontmatter Generation (from existing codebase)

From `src/lib/frontmatter.js:93-155` (reconstructFrontmatter):

```javascript
const { reconstructFrontmatter } = require('../lib/frontmatter');
const fm = reconstructFrontmatter({
  phase: '0113-programmatic-summary-generation',
  plan: '01',
  subsystem: 'cli',
  tags: ['summary', 'git', 'enrichment'],
  // ...nested objects handled automatically
});
// Returns YAML string ready for ---\n...\n---
```

### Example 3: Phase Resolution (from existing codebase)

From `src/lib/helpers.js:426-475` (findPhaseInternal):

```javascript
const { findPhaseInternal } = require('../lib/helpers');
const phaseInfo = findPhaseInternal(cwd, '113');
// Returns: { found, directory, phase_number, phase_name, plans, summaries, ... }
```

### Example 4: Diff Summary (from existing codebase)

From `src/lib/git.js:115-150` (diffSummary):

```javascript
const { diffSummary } = require('../lib/git');
const diff = diffSummary(cwd, { 
  from: firstCommitHash + '~1', 
  to: lastCommitHash 
});
// Returns: { files: [{ path, insertions, deletions }], file_count, total_insertions, total_deletions }
```

### Example 5: Expected Command Output Format

The generated SUMMARY.md should match the exact format in `templates/summary.md`:

```markdown
---
phase: 0113-programmatic-summary-generation
plan: 01
subsystem: cli
tags: [summary, git, enrichment]
requires:
  - phase: 0112-workflow-integration-measurement
    provides: Decision engine and enrichment pipeline
provides:
  - summary:generate CLI command for programmatic SUMMARY.md scaffolding
affects: [execute-plan, summary-extract, verify-summary]
tech-stack:
  added: []
  patterns: [data-extraction-pipeline, merge-preserve]
key-files:
  created: [tests/summary-generate.test.cjs]
  modified: [src/commands/misc.js, src/router.js, bin/bgsd-tools.cjs]
key-decisions:
  - "TODO: key-decisions (record decisions during execution)"
patterns-established:
  - "TODO: patterns-established (any new patterns)"
requirements-completed: [SUM-01]
one-liner: "TODO: one-liner (substantive one-liner describing outcome)"
duration: Xmin
completed: 2026-03-13
---

# Phase 113 Plan 01: [Plan Name] Summary

**TODO: one-liner (substantive one-liner — NOT "phase complete")**

## Performance

- **Duration:** X min
- **Started:** 2026-03-13TXXZZ
- **Completed:** 2026-03-13TXXZZ
- **Tasks:** N
- **Files modified:** M

## Accomplishments
TODO: accomplishments (2-3 bullets, what changed and why)

## Task Commits

Each task was committed atomically:

1. **Task 1: [task name from PLAN.md]** - `abc123f` (feat)
2. **Task 2: [task name from PLAN.md]** - `def456g` (test)

## Files Created/Modified
- `src/commands/misc.js` - [+45/-2]
- `src/router.js` - [+8/-1]
- `tests/summary-generate.test.cjs` - [+120/-0]

## Decisions Made
TODO: decisions (key decisions with brief rationale, or "None - followed plan as specified")

## Deviations from Plan
TODO: deviations (describe any deviations, or "None - plan executed exactly as written")

## Lessons Learned
TODO: lessons (what would you do differently, or "None")

## Issues Encountered
TODO: issues (problems and how resolved, or "None")

## Next Phase Readiness
TODO: next-phase-readiness (what's ready for next phase)
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| LLM writes entire SUMMARY.md (~100-120 lines) | LLM writes entire SUMMARY.md | Current | ~1.5K tokens/summary in LLM output |
| No programmatic summary support | `summary-extract` reads frontmatter from existing summaries | Phase 77+ | Downstream tools can parse summaries |
| Manual commit tracking | `util:memory write --store bookmarks` tracks commits | Phase 91+ | Commit hashes available programmatically |

After Phase 113:
| LLM writes entire SUMMARY.md | Code generates ~70% of content, LLM fills 5 judgment sections | Phase 113 | ~50% less LLM writing per summary |

## Open Questions

1. **Namespace placement:** `util:summary-generate` keeps all summary commands together (alongside `summary-extract`). Alternatively, `execute:summary-generate` would group it with execution commands. Recommendation: `util` namespace — it's a data extraction tool, not an execution step. The workflow just happens to call it during execution.

2. **Task name extraction:** PLAN.md stores task names in XML-like `<name>Task 1: ...</name>` tags. The command needs to parse these to populate the "Task Commits" section. This is a simple regex extraction — no XML parser needed.

3. **Frontmatter field inference quality:** Inferring `subsystem` from file paths (e.g., files in `src/plugin/` → subsystem "plugin") may not always be accurate for plans touching multiple subsystems. The TODO marker approach handles this gracefully — if inference confidence is low, leave as TODO for LLM.

## Existing Infrastructure Summary

### Commands Already Available

| Command | What It Does | Reuse For |
|---------|-------------|-----------|
| `util:summary-extract` | Parses SUMMARY.md frontmatter into JSON | Validates that generated summaries are parseable |
| `verify:summary` | Checks file refs, commit hashes, self-check section | Post-generation validation |
| `verify:state` | Reads/writes STATE.md fields | Session timing data |
| `execute:commit` | Git add + commit with conventional format | N/A (commits already exist) |
| `util:frontmatter get/set/merge` | CRUD on frontmatter fields | Could be used for merge/preserve |
| `plan:find-phase` | Resolves phase number to directory | Phase directory resolution |

### Git Functions in src/lib/git.js

| Function | Signature | Returns |
|----------|-----------|---------|
| `execGit(cwd, args)` | Shell-free git execution | `{ exitCode, stdout, stderr }` |
| `structuredLog(cwd, opts)` | Commit log with file stats | `[{ hash, author, date, message, conventional, files, file_count }]` |
| `diffSummary(cwd, opts)` | Diff between refs | `{ files: [{ path, insertions, deletions }], file_count, total_insertions, total_deletions }` |

### Frontmatter Functions in src/lib/frontmatter.js

| Function | Purpose |
|----------|---------|
| `extractFrontmatter(content)` | Parse YAML frontmatter → object (cached) |
| `reconstructFrontmatter(obj)` | Object → YAML string (handles quoting, arrays, nesting) |
| `spliceFrontmatter(content, newObj)` | Replace frontmatter in existing content |

### Helper Functions in src/lib/helpers.js

| Function | Purpose |
|----------|---------|
| `findPhaseInternal(cwd, phase)` | Phase number → `{ directory, plans, summaries, phase_name, ... }` |
| `getPhaseTree(cwd)` | Cached full phase directory tree scan |
| `cachedReadFile(path)` | Cached file reads |
| `normalizePhaseName(phase)` | Normalize phase number strings |

## Workflow Integration Point

### Current execute-plan.md Flow (relevant steps)

```
record_completion_time → generate_user_setup → post_execution_review → create_summary → update_current_position → ...
```

### Proposed Integration

```
record_completion_time → generate_user_setup → post_execution_review → [NEW: call summary:generate] → create_summary (now just fill TODOs) → update_current_position → ...
```

In `workflows/execute-plan.md`, modify `<step name="create_summary">`:

```markdown
<step name="create_summary">
Generate SUMMARY.md scaffold with deterministic data:
```bash
SCAFFOLD=$(node __OPENCODE_CONFIG__/bgsd-oc/bin/bgsd-tools.cjs util:summary-generate ${PHASE} ${PLAN} --raw 2>/dev/null)
```

If scaffold generation succeeded, the file is written to disk with all data sections populated.

**Remaining TODO sections to fill:**
List each remaining TODO from the scaffold output, e.g.:
- one-liner
- accomplishments
- decisions made
- deviations
- lessons learned / issues / next phase readiness

Fill each TODO section with substantive content based on your execution experience.
</step>
```

The key insight: the executor workflow should **explicitly list** the remaining TODO sections (per CONTEXT.md constraint), not ask the LLM to "find the TODOs."

## Sources

### Primary (HIGH confidence)
- Direct analysis: `src/lib/git.js` — 392 lines, all git functions documented
- Direct analysis: `src/lib/frontmatter.js` — 166 lines, parse/reconstruct/splice
- Direct analysis: `src/commands/misc.js` — cmdVerifySummary (661-755), cmdSummaryExtract (1173-1236), cmdReview (1559-1606)
- Direct analysis: `src/router.js` — namespace routing patterns, lazy-loading, arg parsing
- Direct analysis: `src/lib/helpers.js` — findPhaseInternal, getPhaseTree, cached reads
- Direct analysis: `src/lib/constants.js` — COMMAND_HELP entries
- Direct analysis: `src/lib/commandDiscovery.js` — routerImplementations registry
- Direct analysis: `templates/summary.md` — 265 lines, full template with frontmatter guidance
- Direct analysis: `workflows/execute-plan.md` — 322 lines, create_summary step at line 234
- Direct analysis: 2 real SUMMARY.md files (0112-01, 0112-02) — actual format verification

### Secondary (MEDIUM confidence)
- Token savings estimates — based on comparing full SUMMARY.md (~100-120 lines) vs TODO-only sections (~30-40 lines)

## Metadata

**Confidence breakdown:**
- Existing infrastructure: HIGH (all functions verified in source code)
- Integration approach: HIGH (clear insertion point in workflow)
- Merge/preserve logic: MEDIUM (TODO marker detection is simple but edge cases exist)
- Frontmatter inference: MEDIUM (subsystem/tags inference from paths is heuristic)

**Research date:** 2026-03-13
**Valid until:** Next major refactor of summary template or execute-plan workflow
