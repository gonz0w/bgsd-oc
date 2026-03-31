# Phase 146: Code Review Workflow - Research

**Researched:** 2026-03-28
**Domain:** Diff-scoped code review scanning, mechanical autofix routing, and workflow orchestration
**Confidence:** HIGH

## User Constraints

These constraints are locked by `146-CONTEXT.md` and phase requirements and should drive the design:

- Default scope is the staged diff; if nothing is staged, ask for a review target instead of guessing.
- Warn when adjacent unstaged or untracked changes suggest the review scope is incomplete.
- Silent fixes are limited to clearly mechanical changes; ambiguous fixes route to ASK.
- Failed silent fixes downgrade to ASK instead of aborting the whole review.
- ASK findings are batched by theme, but each finding remains individually answerable.
- Unanswered ASK findings stay unresolved rather than blocking the workflow.
- User-facing output is a structured report ordered by severity, not a narrative review.
- Confidence scores remain internal; the user sees the routed outcome, not the numeric score.
- A clean review should end quietly.
- Exclusions target rule-plus-path combinations and must include a reason.
- Repo rules still apply: single-file CLI build output, low ceremony, backward compatibility, path-agnostic behavior, and no dependency-heavy architecture.

### Phase Requirements

| ID | Requirement | Implementation Impact |
|----|-------------|-----------------------|
| REV-01 | `review:scan` emits structured JSON findings with file, line, category, severity, confidence, suggested fix | Need deterministic scan pipeline and stable finding schema |
| REV-02 | Findings classified as AUTO-FIX, ASK, INFO | Need explicit routing stage after detection, before presentation |
| REV-03 | Only findings >= 8/10 confidence reported; threshold configurable | Need confidence gate centralized in scanner config |
| REV-04 | `/bgsd-review` orchestrates CLI scan plus verifier judgment in two stages | Need CLI-first JSON output, then workflow/agent consumption |
| REV-05 | `.planning/review-exclusions.json` suppresses known false positives with exact rule-plus-path entries and a required reason | Need exclusion matcher before final report emission |

## Summary

Implement Phase 146 as a **CLI-first review pipeline**: collect the review target from Git, normalize it into file hunks, run a deterministic rule engine over only the changed ranges, route each surviving finding into AUTO-FIX / ASK / INFO, then let `/bgsd-review` hand the routed payload to an agent for higher-judgment quality review. This matches the repo's existing architecture: deterministic Node CLI commands produce structured JSON, workflows orchestrate user interaction, and agents consume pre-shaped artifacts instead of discovering everything from scratch.

The highest-leverage decision is to keep the scanner **diff-scoped, rule-based, and patch-oriented**. Git already defines the staged and commit-range diff boundaries (`git diff --cached`, `A...B`), so the scanner should not invent its own review target model. Likewise, the repo already has reusable AST helpers in `src/lib/ast.js`, JSON output helpers in `src/lib/output.js`, and existing severity concepts in `src/lib/review/severity.js`; Phase 146 should extend those patterns rather than introducing a separate lint framework.

For fixing, use an ESLint-like split: only tiny, mechanical edits become AUTO-FIX, while behavior-affecting or intent-dependent changes become ASK suggestions. The scanner should assemble exact edit hunks, validate them before applying, and degrade cleanly when a fix no longer applies. This keeps silent fixes safe and gives the workflow a stable contract: deterministic scan first, judgment later.

**Primary recommendation:** Build `review:scan` around Git diff scope + existing Acorn-based AST helpers + a small rule registry + patch validation, then wire `/bgsd-review` as a two-stage workflow that consumes the JSON result rather than re-deriving findings.

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Git CLI (`git diff --cached`, `git diff A...B`) | Existing toolchain | Canonical review target and changed-line boundaries | Official Git diff semantics already match staged-first and commit-range review needs (<https://git-scm.com/docs/git-diff>) |
| Node.js built-ins (`fs`, `path`, `child_process`) | Project runtime | Read files, run Git, persist exclusions, write fixes | Fits zero-dependency CLI style already used throughout repo |
| Existing `src/lib/ast.js` (`acorn` + TS stripping) | In-repo | Parse JS/TS and map nodes back to lines | Already present, tested, and aligned with current architecture |
| Existing `src/lib/output.js` JSON output path | In-repo | Emit stable machine-readable scan results | Matches current CLI-first contract for downstream workflows |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Existing `src/lib/review/severity.js` | In-repo | Shared severity vocabulary and summary logic | Reuse/extend so review output and future audit flows stay consistent |
| Existing command/router structure (`src/router.js`, `src/commands/*.js`) | In-repo | Register `review:scan` and helper commands | Follow existing namespace/subcommand patterns |
| `git apply --check` | Existing Git | Validate generated patches before applying | Good fit for mechanical fixes; official docs explicitly support applicability checks and warn against context-free patches (<https://git-scm.com/docs/git-apply>) |
| ESLint custom-rule design patterns | Design reference, not runtime dependency | Model rule metadata, fixable vs suggestion routing, and small-fix discipline | Official docs cleanly separate `fix` from `suggest` semantics (<https://eslint.org/docs/latest/extend/custom-rules>) |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Git diff as source of truth | Custom file-selection / custom diff model | Rejected: duplicates mature Git semantics and weakens staged-first behavior |
| Existing `acorn` path in `src/lib/ast.js` | New parser stack (`babel`, `typescript-eslint`, tree-sitter) | Rejected for v1: bigger dependency/runtime surface without clear need |
| Small internal rule registry | Full embedded linter framework | Rejected: too much ceremony for a diff-scoped workflow command |
| Patch validation before apply | Blind file rewrites | Rejected: unsafe for silent mechanical fixes |
| Project-local exclusions file | Inline ignores in workflow prompts | Rejected: poor auditability and harder to keep deterministic |

## Architecture Patterns

### Recommended Project Structure

- `src/commands/review.js` - command entrypoints for `review:scan` and any small helpers.
- `src/lib/review/target.js` - staged/commit-range target resolution and incomplete-scope warnings.
- `src/lib/review/diff.js` - parse Git patch hunks into changed-line maps.
- `src/lib/review/rules/*.js` or a small registry module - deterministic review checks.
- `src/lib/review/fixes.js` - patch assembly, applicability checking, and safe apply/degrade logic.
- `src/lib/review/exclusions.js` - load/match `.planning/review-exclusions.json`.
- `commands/bgsd-review.md` plus workflow file - orchestration layer consuming scan JSON.
- `tests/review*.test.cjs` - scanner, routing, exclusions, and workflow contract coverage.

### Pattern 1: Resolve review target from Git first, not from file discovery

Recommended precedence:

1. Default: staged diff via `git diff --cached`.
2. If nothing staged: prompt for review target, preferring commit-range review.
3. Optional include-untracked question when untracked files exist.
4. Independently warn if unstaged/untracked neighbors suggest incomplete scope.

Why: Git's own docs define the exact meanings of working-tree, staged, and commit-range diffs, including `--cached` and `A...B` merge-base behavior. Reusing that model keeps the workflow aligned with the change set users actually intend to ship instead of inventing repo-local heuristics.

Recommended target payload:

```json
{
  "mode": "staged",
  "git": {
    "command": ["git", "diff", "--cached", "--unified=3", "--no-color"],
    "base": "HEAD",
    "incomplete_scope_warning": true
  },
  "files": [
    {
      "path": "src/router.js",
      "status": "modified",
      "hunks": [
        { "start": 1311, "end": 1366 }
      ]
    }
  ]
}
```

### Pattern 2: Diff-scoped scan pipeline with explicit stages

Keep the pipeline deterministic and stage-separated:

1. Resolve target.
2. Parse diff hunks into changed-line ranges.
3. Read only changed files.
4. Parse AST where supported via `src/lib/ast.js`; use text heuristics where AST is unnecessary.
5. Run review rules only against changed ranges.
6. Attach evidence, confidence, and optional fix/suggestion payloads.
7. Apply exclusions.
8. Drop findings below threshold.
9. Route remaining findings to AUTO-FIX / ASK / INFO.
10. Optionally apply AUTO-FIX patch set, then emit final JSON summary.

This stage split is important because Phase 147 will likely mirror it for security scanning. A reusable scan pipeline now creates the CLI-first / agent-second pattern Phase 146 is supposed to establish.

### Pattern 3: Rule registry with separate detection and routing

Each rule should report a raw finding with enough metadata for later routing. Do not let every rule decide its own final category in isolation.

Recommended raw finding shape:

```json
{
  "rule_id": "js-unused-import",
  "path": "src/lib/output.js",
  "line": 12,
  "category": "maintainability",
  "severity": "warning",
  "confidence": 0.96,
  "message": "Unused import increases bundle noise.",
  "evidence": {
    "symbol": "path",
    "changed_range": [1, 40]
  },
  "fix": {
    "kind": "patch",
    "mechanical": true,
    "patch": "..."
  }
}
```

Then central routing decides:

- AUTO-FIX if `mechanical === true`, confidence meets threshold, and patch validates.
- ASK if confidence meets threshold but fix is ambiguous, behavioral, or validation fails.
- INFO if advisory only and confidence meets threshold.
- SUPPRESSED if below threshold or matched by exclusion.

This mirrors ESLint's distinction between `fix` and `suggest`, but implemented in bGSD's own pipeline rather than by embedding ESLint.

### Pattern 4: Mechanical autofix uses exact patches plus validation

Silent fixes should be patch-based and reversible, not ad hoc string mutation.

Recommended flow:

1. Rule proposes exact patch text or exact range replacement.
2. Consolidator sorts fixes per file and rejects overlaps.
3. Validate patch applicability before applying.
4. Apply only fully validated mechanical fixes.
5. Any failed or conflicting fix downgrades that finding to ASK.

Recommended safeguards:

- Require at least one line of context in generated unified diffs when practical.
- Avoid `--unidiff-zero`; Git docs explicitly discourage context-free patches.
- Run `git apply --check` before actual apply for patch-backed fixes.
- Never mix mechanical fixes with broad formatting rewrites in the same pass.

This gives the workflow a safe contract: auto-fixes are tiny, local, and checkable.

### Pattern 5: Exclusion matching happens before final output, after rule evaluation

Exclusions should suppress stable false positives without weakening the detector itself.

Recommended file shape:

```json
{
  "version": 1,
  "exclusions": [
    {
      "rule_id": "js-dynamic-require",
      "path": "src/router.js",
      "reason": "Router dispatch intentionally uses runtime command lookup."
    }
  ]
}
```

Matching rules:

- Match on exact `rule_id` plus normalized repo-relative path.
- Do not support path-only global ignores in v1.
- Hide matched exclusions from live review output, but count them in internal metrics.
- Keep the file human-editable and git-friendly; no derived fingerprints required for first version.

### Pattern 6: `/bgsd-review` consumes scan JSON in two stages

Workflow structure should be:

1. Run `review:scan`.
2. Apply silent AUTO-FIX items.
3. Ask the user one batched question for ASK findings, grouped by theme.
4. Pass surviving findings and context into verifier/agent review for structural + quality judgment.
5. Present a quiet severity-led report.

The scanner should therefore emit both per-finding data and aggregate buckets the workflow can use directly:

```json
{
  "summary": {
    "blocker": 1,
    "warning": 3,
    "info": 2,
    "autofixed": 2,
    "asks": 1,
    "suppressed": 4
  },
  "ask_groups": [
    {
      "theme": "error-handling",
      "findings": ["rev-014", "rev-019"]
    }
  ],
  "findings": []
}
```

### Anti-Patterns to Avoid

- Re-scanning the whole repo when only a staged diff is under review.
- Letting rules print human text directly instead of returning structured findings.
- Applying ambiguous fixes silently just because confidence is high.
- Mixing exclusion logic into each individual rule.
- Encoding user-facing report shape directly into low-level detectors.
- Building a giant generalized linter framework before the first workflow exists.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Review target semantics | Custom staged/branch diff model | Git diff modes (`--cached`, `A...B`) | Official semantics already solve staged-first and commit-range review |
| JS/TS parsing | New parser stack | Existing `src/lib/ast.js` + `acorn` path | Already integrated and consistent with repo tooling |
| JSON command output | One-off serialization logic | `src/lib/output.js` conventions | Keeps workflow contracts uniform |
| Safe silent patching | Blind in-memory rewrites | Exact hunks plus `git apply --check` or equivalent applicability validation | Better safety boundary for AUTO-FIX |
| Fix/suggest semantics | Ad hoc per-rule behavior | Central routing layer modeled after fix-vs-suggestion discipline | Keeps AUTO-FIX and ASK consistent across rules |
| False-positive memory | Hidden cache or prompt-only suppression | `.planning/review-exclusions.json` | Human-editable, auditable, and phase-required |

## Common Pitfalls

### Pitfall 1: Scanner quietly reviews the wrong scope
**What goes wrong:** Findings are correct for the files scanned, but the workflow misses the user's intended ship set.  
**Why it happens:** Review target logic guesses between staged, unstaged, and untracked changes instead of following explicit Git semantics.  
**How to avoid:** Make staged diff the default, ask when empty, and surface incomplete-scope warnings separately from findings.  
**Warning signs:** Review output ignores staged files or silently includes large unrelated working-tree changes.

### Pitfall 2: AUTO-FIX expands into behavior changes
**What goes wrong:** A silent fix changes logic rather than formatting or obviously mechanical structure.  
**Why it happens:** Confidence is treated as the only safety gate.  
**How to avoid:** Require both high confidence and a `mechanical: true` classification with patch validation.  
**Warning signs:** Fixes rewrite control flow, rename symbols broadly, or alter function behavior without user confirmation.

### Pitfall 3: Rules produce noisy repo-wide findings
**What goes wrong:** Users see dozens of findings unrelated to the diff they are reviewing.  
**Why it happens:** Detectors run on full files or whole repositories without intersecting changed hunks.  
**How to avoid:** Filter evidence to changed lines/ranges unless a rule explicitly needs a broader enclosing scope.  
**Warning signs:** Old untouched code dominates review output.

### Pitfall 4: Failed fixes abort the whole review
**What goes wrong:** One stale patch or overlap causes the workflow to fail instead of continuing.  
**Why it happens:** Fix application is treated as all-or-nothing.  
**How to avoid:** Validate per finding or per non-overlapping batch, then downgrade failures to ASK.  
**Warning signs:** Review exits early after a single patch conflict.

### Pitfall 5: Exclusions become too broad to trust
**What goes wrong:** Suppressions hide real issues because they match entire directories or vague patterns.  
**Why it happens:** Path-only ignores are easier to implement than rule-plus-path matching.  
**How to avoid:** Require `rule_id` + path + reason, and keep matching exact for v1.  
**Warning signs:** One exclusion suppresses multiple unrelated findings over time.

### Pitfall 6: Workflow duplicates scanner logic inside prompts
**What goes wrong:** Agent review and CLI review disagree because both rediscover findings independently.  
**Why it happens:** The workflow treats scan output as optional context instead of the primary artifact.  
**How to avoid:** Make `review:scan` the source of deterministic findings; agent stage adds judgment, prioritization, and explanation only.  
**Warning signs:** Same issue appears twice with different labels, or an agent contradicts the scanner's routed category.

## Code Examples

### Example 1: Target resolution around staged-first review

```js
function resolveReviewTarget(git) {
  const staged = git.diffCached();
  if (staged.files.length > 0) {
    return { mode: 'staged', diff: staged };
  }

  return {
    mode: 'needs-input',
    prompt: 'No staged changes found. Review a commit range?',
    suggested_mode: 'commit-range'
  };
}
```

### Example 2: Central routing keeps AUTO-FIX and ASK consistent

```js
function routeFinding(finding, threshold) {
  if (finding.confidence < threshold) return 'SUPPRESSED';
  if (finding.fix && finding.fix.mechanical && finding.fix.validated) return 'AUTO-FIX';
  if (finding.requires_judgment || (finding.fix && !finding.fix.validated)) return 'ASK';
  return 'INFO';
}
```

### Example 3: Ask batching groups by decision theme, not file

```js
function groupAskFindings(findings) {
  const groups = new Map();
  for (const finding of findings.filter(f => f.route === 'ASK')) {
    const theme = finding.theme || 'general';
    if (!groups.has(theme)) groups.set(theme, []);
    groups.get(theme).push(finding);
  }
  return Array.from(groups, ([theme, items]) => ({ theme, findings: items }));
}
```

### Example 4: Exclusions suppress after detection, before final report

```js
function isExcluded(finding, exclusions) {
  return exclusions.some(entry =>
    entry.rule_id === finding.rule_id &&
    normalizePath(entry.path) === normalizePath(finding.path)
  );
}
```

## Recommended Initial Rule Set

Start with a small, high-precision set that matches the phase goal and supports safe AUTO-FIX:

| Rule Family | Route Bias | Notes |
|------------|------------|-------|
| Unused imports / trivially dead changed symbols | AUTO-FIX | Good first mechanical class |
| Duplicate/contradictory changed condition branches | ASK | Needs intent judgment |
| Missing error handling in newly added async branches | ASK | High value, but not safely silent |
| Trust-boundary markers (raw exec, raw SQL string concat, unchecked input pass-through) | INFO or ASK | Structural warning for agent follow-up |
| TODO / placeholder / debug leftovers in diff | AUTO-FIX or INFO | Small, easy, high-signal |

Avoid starting with low-precision architecture smell rules until the exclusion system exists.

## Sources

- Git diff semantics and staged / commit-range behavior: <https://git-scm.com/docs/git-diff>
- Git patch applicability and validation rules: <https://git-scm.com/docs/git-apply>
- ESLint custom rule fix vs suggestion model: <https://eslint.org/docs/latest/extend/custom-rules>
- In-repo AST helper and TS stripping: `src/lib/ast.js`
- In-repo JSON output contract: `src/lib/output.js`
- Existing review severity vocabulary: `src/lib/review/severity.js`
- Current phase decisions: `.planning/phases/146-code-review-workflow/146-CONTEXT.md`
- Phase requirements: `.planning/REQUIREMENTS.md`

## Open Questions

- Whether v1 should support non-JS languages beyond text-pattern checks, or explicitly scope AST-backed rules to JS/TS first.
- Whether AUTO-FIX application should use direct file rewrites with internal validation, `git apply`, or both behind one helper.
- Whether the future security scan should share the same exclusion file schema shape for easier parallel implementation in Phase 147.
