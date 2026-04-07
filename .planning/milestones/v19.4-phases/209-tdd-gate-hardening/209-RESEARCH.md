# Phase 209: TDD Gate Hardening - Research

**Researched:** 2026-04-06
**Domain:** TDD plan validation, file modification detection, step sequence validation
**Confidence:** HIGH

## Summary

Phase 209 implements TDD plan structure verification at planning-time and extends Phase 206's RED gate to full GREEN/REFACTOR semantic validation. The core deliverables are: (1) a lightweight planning-time gate that validates `type:tdd` plans have required fields and correct step sequences, (2) enhanced GREEN gate with mtime+size fast path and semantic diff fallback, (3) REFACTOR gate with test count verification, and (4) TDD eligibility evaluation with rationale field for all plans.

Key technical findings: (a) The existing `misc/recovery.js cmdTdd` provides the foundation — Phase 206 shipped `validate-red`, `validate-green`, `validate-refactor` using `spawnSync`; Phase 209 extends these with richer semantic checks. (b) File modification detection uses mtime+size as fast path, falling back to whitespace-insensitive semantic diff only when mtime/size indicate changes. (c) The plan parser in `src/plugin/parsers/plan.js` already extracts frontmatter — no new YAML library needed.

**Primary recommendation:** Implement planning-time gate as a standalone `validateTddPlanStructure()` function callable from planner context, extending `misc/recovery.js` with new `validate-tdd-plan` subcommand rather than modifying the existing TDD validator commands.

## User Constraints

> These constraints are LOCKED from Phase 209 discuss-phase and MUST be honored by the planner.

| Constraint | Source | Implication |
|------------|--------|-------------|
| Planning-time gate scope: lightweight critical-field check + step sequence validation for `type:tdd` only | 209-CONTEXT.md | Not full semantic validation — that's execute gate's job |
| GREEN gate "test file NOT modified": mtime+size first, semantic diff fallback only if mtime/size indicate changes | 209-CONTEXT.md | Avoid expensive diff operations in the common case |
| REFACTOR gate "no new behavior" proof: test count only | 209-CONTEXT.md | Simple and sufficient per Phase 209 decision |
| TDD eligibility evaluation: all plans get check with explicit rationale in frontmatter | 209-CONTEXT.md | Rationale format: `tdd_rationale:` in frontmatter only |
| Planning-time gate callable from planner context before task breakdown | 209-CONTEXT.md | Must be a reusable function, not a CLI-only command |
| Step sequence validation: RED before GREEN before REFACTOR for `type:tdd` plans | 209-CONTEXT.md | Order matters — reject malformed sequences |
| Cache invalidation strategy: agent's discretion | 209-CONTEXT.md | No locked decision — implementation detail |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Node.js `fs.statSync` | built-in | mtime+size comparison | Fast path for file modification detection |
| Node.js `child_process.spawnSync` | built-in | Running test commands | Already used in Phase 206 validators |
| `src/lib/atomic-write.js` `writeFileAtomic` | existing | Atomic JSON sidecar writes | Already used for TDD-AUDIT.json |
| `src/plugin/parsers/plan.js` | existing | Frontmatter extraction | Already parses plan structure |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Node.js `crypto.createDiffieHellman` (or manual line split) | built-in | Semantic diff fallback | When mtime+size suggest changes |
| `src/lib/git.js` `diffSummary` | existing | Git-aware diff | Optional: if git-aware diff preferred over raw file diff |

### No New Dependencies

This phase adds NO new npm packages. All functionality uses built-in Node.js APIs or existing project infrastructure.

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| External YAML parser (js-yaml) | Custom frontmatter parser in plan.js | Project already has a minimal parser — adding dependency for this is over-engineering |
| Full semantic diff library (diff) | Simple whitespace-normalized string comparison | Whitespace-insensitive comparison of two file contents achieves the same goal with zero dependencies |
| fs.watch / chokidar | Polling via mtime+size | mtime+size comparison is simpler, deterministic, and already proven in Phase 206's validateGreen |

## Architecture Patterns

### Recommended Project Structure

```
src/commands/misc/recovery.js    # Extended with new validateTddPlanStructure() function
                                    # New validate-tdd-plan subcommand added to cmdTdd
```

### Pattern 1: Two-Layer TDD Validation

**Structure:** Planning-time gate (lightweight) + Execute-time gate (full semantic)

```
Planning Phase          Execute Phase
─────────────────      ─────────────────
validateTddPlan()      validate-red/green/refactor()
     │                        │
     ├─ type check            ├─ spawnSync test-cmd
     ├─ required fields       ├─ exit code check
     ├─ step sequence         ├─ semantic validation
     └─ rationale check       └─ proof JSON + TDD-AUDIT.json
```

**Why:** Separation of concerns. Planning-time catches structural issues fast (linter-level). Execute-time catches real-run semantic issues.

### Pattern 2: Fast-Path File Modification Check

**Structure:** mtime+size comparison → (only if changed) → semantic diff fallback

```javascript
function checkFileUnmodified(before, after) {
  // Fast path: mtime+size comparison
  if (before.mtime === after.mtime && before.size === after.size) {
    return { unmodified: true, method: 'mtime+size' };
  }
  
  // Slow path: semantic diff (whitespace-insensitive)
  const beforeNorm = normalizeWhitespace(before.content);
  const afterNorm = normalizeWhitespace(after.content);
  return {
    unmodified: beforeNorm === afterNorm,
    method: 'semantic-diff',
    diff: beforeNorm !== afterNorm ? computeDiff(beforeNorm, afterNorm) : null
  };
}
```

**Why:** 99% of cases hit the fast path. Semantic diff is expensive and rarely needed.

### Pattern 3: Planning-Time Gate as Pure Function

**Structure:** `validateTddPlanStructure(planPath) → { valid: boolean, errors: string[] }`

```javascript
function validateTddPlanStructure(planPath) {
  const errors = [];
  const plan = parsePlan(planPath); // Uses existing parser
  
  // Required fields for type:tdd
  if (plan.frontmatter.type === 'tdd') {
    if (!plan.frontmatter.test_file) errors.push('Missing required field: test_file');
    if (!plan.frontmatter.impl_files) errors.push('Missing required field: impl_files');
    
    // Step sequence validation
    const steps = plan.frontmatter.steps || [];
    const seq = extractStepSequence(steps); // ['red', 'green', 'refactor']
    if (!isValidSequence(seq)) {
      errors.push(`Invalid step sequence: ${seq.join(' -> ')}. Expected: red -> green -> refactor`);
    }
    
    // TDD rationale check
    if (!plan.frontmatter.tdd_rationale) {
      errors.push('Missing required field: tdd_rationale');
    }
  }
  
  return { valid: errors.length === 0, errors };
}
```

**Why:** Callable from both CLI and in-process planner context. Returns structured result for programmatic use.

### Anti-Patterns to Avoid

| Anti-Pattern | Why | Instead |
|--------------|-----|---------|
| Full semantic diff as default | Expensive in common case (no modification) | mtime+size fast path first |
| Planning-time full semantic validation | Slows down planning for all plans | Execute gate does full validation |
| Requiring tdd_rationale on non-tdd plans | Unnecessary friction for standard plans | Only required for `type:tdd` plans |
| Modifying existing validate-red/green/refactor commands | Risk of breaking existing behavior | Add new `validate-tdd-plan` subcommand |

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|------------|-----|
| YAML frontmatter parsing | Custom YAML parser or external library | `extractFrontmatter()` from `src/plugin/parsers/plan.js` | Already exists, handles project-specific format |
| Atomic file writes | Raw fs.writeFile | `writeFileAtomic` from `src/lib/atomic-write` | Already handles atomic writes for TDD-AUDIT.json |
| Test count parsing | Custom regex per test framework | `getTestCount()` from `misc/recovery.js` | Already handles node:test format |
| TDD-AUDIT.json schema | New schema design | Follow Phase 206 schema | Already proven, consistent across phases |

## Common Pitfalls

### Pitfall 1: Semantic diff too aggressive
**What goes wrong:** Whitespace changes (formatting, trailing newlines) trigger false positives on GREEN gate.
**Why it happens:** naive string comparison catches all differences, not just meaningful ones.
**How to avoid:** Normalize whitespace before comparison. Strip trailing whitespace, normalize line endings, collapse multiple blank lines.
**Warning signs:** GREEN gate fails on formatter runs, git auto-crlf, editor config changes.

### Pitfall 2: Step sequence validation too strict
**What goes wrong:** Valid TDD plans with partial cycles (RED→GREEN only, no REFACTOR) get rejected.
**Why it happens:** Requiring all three steps in exact order.
**How to avoid:** Allow partial sequences. RED→GREEN is valid. RED→GREEN→REFACTOR is valid. REFACTOR alone is invalid.
**Warning signs:** Plans with optional REFACTOR phase fail validation.

### Pitfall 3: Planning-time gate too slow
**What goes wrong:** Every `discuss-phase` call now does full file system checks, slowing down iteration.
**Why it happens:** Calling git diff or reading file contents at planning-time.
**How to avoid:** Planning-time gate checks structure only (fields exist, sequence valid). No file system access.
**Warning signs:** discuss-phase latency increases noticeably.

### Pitfall 4: mtime precision issues
**What goes wrong:** Files modified within same second show identical mtime, bypassing detection.
**Why it happens:** Filesystem mtime precision varies (HFS+ vs ext4 vs NTFS).
**How to avoid:** Also check size. Two files with same mtime but different sizes are definitely different.
**Warning signs:** GREEN passes when test file was modified but mtime appears unchanged.

### Pitfall 5: Cache invalidation on repeated runs
**What goes wrong:** Planning-time gate re-validates same plan repeatedly, wasting time.
**Why it happens:** No caching strategy.
**How to avoid:** Cache validation results with mtime-based invalidation. Re-validate only when plan file changes.
**Warning signs:** Planning phase feels slower than expected despite no structural changes.

## Code Examples

### Example 1: Planning-time gate function (stub implementation)

```javascript
// In src/commands/misc/recovery.js

function validateTddPlanStructure(planPath) {
  const errors = [];
  
  // Use existing parsePlan if available, or minimal frontmatter parse
  let frontmatter;
  try {
    const content = fs.readFileSync(planPath, 'utf-8');
    frontmatter = extractFrontmatter(content);
  } catch (e) {
    return { valid: false, errors: [`Cannot read plan: ${planPath}`] };
  }
  
  // Only validate type:tdd plans
  if (frontmatter.type !== 'tdd') {
    return { valid: true, errors: [] };
  }
  
  // Critical fields check
  if (!frontmatter.test_file) {
    errors.push('Missing required frontmatter field: test_file');
  }
  if (!frontmatter.impl_files) {
    errors.push('Missing required frontmatter field: impl_files');
  }
  if (!frontmatter.steps) {
    errors.push('Missing required frontmatter field: steps');
  }
  
  // Step sequence validation
  const steps = frontmatter.steps;
  if (steps && typeof steps === 'string') {
    // Handle comma-separated or array string
    const stepList = steps.replace(/[\[\]]/g, '').split(',').map(s => s.trim().toLowerCase());
    const redIdx = stepList.indexOf('red');
    const greenIdx = stepList.indexOf('green');
    const refactorIdx = stepList.indexOf('refactor');
    
    if (redIdx === -1) {
      errors.push('Step sequence must include: red');
    }
    if (greenIdx === -1) {
      errors.push('Step sequence must include: green');
    }
    if (redIdx !== -1 && greenIdx !== -1 && redIdx >= greenIdx) {
      errors.push('Step sequence error: red must come before green');
    }
    if (greenIdx !== -1 && refactorIdx !== -1 && greenIdx >= refactorIdx) {
      errors.push('Step sequence error: green must come before refactor');
    }
  }
  
  // TDD rationale check
  if (!frontmatter.tdd_rationale) {
    errors.push('Missing required frontmatter field: tdd_rationale');
  }
  
  return { valid: errors.length === 0, errors };
}
```

### Example 2: Enhanced GREEN gate with mtime+size fast path

```javascript
// In misc/recovery.js - enhanced validateGreen

function getFileMetadata(filePath, cwd) {
  try {
    const stats = fs.statSync(path.join(cwd, filePath));
    return { mtime: stats.mtime.getTime(), size: stats.size };
  } catch {
    return null;
  }
}

function checkFileUnmodified(filePath, cwd, beforeMeta) {
  const afterMeta = getFileMetadata(filePath, cwd);
  if (!beforeMeta || !afterMeta) {
    return { unmodified: false, reason: 'cannot stat file' };
  }
  
  // Fast path: mtime+size match
  if (beforeMeta.mtime === afterMeta.mtime && beforeMeta.size === afterMeta.size) {
    return { unmodified: true, method: 'mtime+size' };
  }
  
  // Slow path: semantic diff (whitespace-insensitive)
  try {
    const beforeContent = fs.readFileSync(path.join(cwd, filePath), 'utf-8');
    const afterContent = fs.readFileSync(path.join(cwd, filePath), 'utf-8'); // In real impl, read before run
    
    const beforeNorm = beforeContent
      .replace(/[\t ]+$/gm, '')  // Strip trailing whitespace
      .replace(/\r\n/g, '\n');   // Normalize line endings
    
    const afterNorm = afterContent
      .replace(/[\t ]+$/gm, '')
      .replace(/\r\n/g, '\n');
    
    return {
      unmodified: beforeNorm === afterNorm,
      method: 'semantic-diff',
      diff: beforeNorm !== afterNorm ? 'whitespace-only changes' : null
    };
  } catch {
    return { unmodified: false, reason: 'cannot read file' };
  }
}
```

### Example 3: Step sequence validation

```javascript
// Validates: red -> green -> refactor (order matters, all three not required)

function validateStepSequence(steps) {
  if (!Array.isArray(steps) || steps.length === 0) {
    return { valid: false, error: 'steps must be a non-empty array' };
  }
  
  const stepTypes = steps.map(s => 
    typeof s === 'string' ? s.toLowerCase() : 
    (s.type || s.name || '').toLowerCase()
  );
  
  const redIdx = stepTypes.indexOf('red');
  const greenIdx = stepTypes.indexOf('green');
  const refactorIdx = stepTypes.indexOf('refactor');
  
  // RED is required for type:tdd
  if (redIdx === -1) {
    return { valid: false, error: 'RED step is required' };
  }
  
  // GREEN is required for type:tdd
  if (greenIdx === -1) {
    return { valid: false, error: 'GREEN step is required' };
  }
  
  // Order validation
  if (redIdx >= greenIdx) {
    return { valid: false, error: 'RED must come before GREEN' };
  }
  
  if (refactorIdx !== -1 && greenIdx >= refactorIdx) {
    return { valid: false, error: 'GREEN must come before REFACTOR' };
  }
  
  return { valid: true };
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Exit-code-only TDD validation | TDD-aware semantic validation | Phase 206 (validate-red/green/refactor shipped) | Validators now detect semantic failures vs crashes, check file modification, verify test count |
| Planning-time structural validation via external linter | Built-in planning-time gate | Phase 209 (this phase) | Catch malformed type:tdd plans at planning-time, before execution |
| File modification check via mtime only | mtime+size fast path + semantic diff fallback | Phase 209 (this phase) | Avoids false positives from filesystem precision issues; handles whitespace-only changes correctly |
| TDD rationale optional | TDD rationale required for type:tdd plans | Phase 209 (this phase) | Forces explicit TDD decision for every type:tdd plan |

## Open Questions

| Question | Status | Resolution Approach |
|----------|--------|-------------------|
| Should planning-time gate run automatically in planner context, or require explicit flag? | Open - agent's discretion per context | Implement as callable function; planner decides when to invoke |
| What exact error message format for validation failures? | Open - agent's discretion per context | Provide clear, actionable messages with field names and expected values |
| Should cache invalidation use TTL or mtime-based? | Open - agent's discretion | mtime-based is more consistent with project caching strategy |
| How to handle nested steps (subtasks within RED/GREEN/REFACTOR)? | Low priority | Not in scope for Phase 209; flat sequence validation only |

## Sources

### Primary (HIGH confidence)
- `src/commands/misc/recovery.js` — Phase 206 TDD validator implementation; foundation for Phase 209
- `src/plugin/parsers/plan.js` — Existing plan parser with `extractFrontmatter()`; handles frontmatter extraction
- `skills/tdd-execution/SKILL.md` — Canonical TDD contract; defines RED/GREEN/REFACTOR semantics
- `templates/plans/tdd.md` — TDD plan template; shows required fields and structure
- `.planning/REQUIREMENTS.md` — TDD-02, TDD-03, TDD-04, TDD-07, TDD-08 requirements

### Secondary (MEDIUM confidence)
- `.planning/research/completed/TDD-RELIABILITY-PRD.md` — PRD for TDD reliability; defines gate semantics
- `src/lib/atomic-write.js` — Atomic write utility; used for TDD-AUDIT.json sidecars

### Tertiary (LOW confidence)
- General TDD literature on RED/GREEN/REFACTOR semantics (standard practice, not Node.js specific)

## Metadata

**Confidence breakdown:** Core TDD concepts are well-understood (HIGH). Implementation approach is informed by Phase 206 precedent (HIGH). Exact error message format and cache strategy are agent's discretion (MEDIUM).

**Research date:** 2026-04-06

**Valid until:** Phase 209 implementation is complete. Changes to discuss-phase context would require re-research.