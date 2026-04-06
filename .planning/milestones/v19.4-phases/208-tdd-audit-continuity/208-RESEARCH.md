# Phase 208: TDD Audit Continuity - Research

**Researched:** 2026-04-06
**Domain:** CLI tooling, TDD workflow integration, summary generation
**Confidence:** HIGH

## Summary

Phase 208 implements TDD proof continuity across execute → verify → summary transitions. The phase builds on Phase 206's TDD validator shipping and Phase 207's fresh-context chaining. Four success criteria must be met: (1) TDD rationale visibility in plan output, (2) tdd_audit in handoff artifact inventory, (3) human-legible TDD proof in summary:generate, and (4) TDD audit checks in verify:state.

Existing infrastructure is partial: `discoverPhaseProofContext` already finds TDD-AUDIT.json files and includes them as `tdd_audits` in context, but this is not explicitly tracked in the handoff artifact inventory. `cmdSummaryGenerate` is a stub returning "not fully implemented". `cmdVerifySummary` has a known bug where backtick-wrapped command strings are misclassified as file references. `cmdStateValidate` lacks TDD audit continuity checks.

**Primary recommendation:** Extend phase-handoff.js to explicitly track TDD audits in artifact inventory, implement narrative-format TDD proof in summary:generate, add TDD audit checks to state validation, and surface TDD rationale in plan output.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Node.js | built-in | CLI runtime | Required by project |
| JSON | built-in | TDD audit storage | Existing format |
| fs/path | built-in | File operations | Required by project |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| jj (Jujutsu) | any | VCS operations | All phase operations |
| spawnSync | built-in | Fresh-context chaining | Phase 207 pattern |

## Architecture Patterns

### TDD Audit Flow
```
TDD Plan Execution
    ↓
TDD-AUDIT.json created (plan-N-TDD-AUDIT.json)
    ↓
discoverPhaseProofContext → tdd_audits[] in context
    ↓
Handoff artifact includes tdd_audits reference
    ↓
Summary:generate renders narrative proof
    ↓
State validation verifies audit continuity
```

### Current Partial Implementation
- `discoverPhaseProofContext` (phase-handoff.js:97-128) already scans for `*-TDD-AUDIT.json` files
- `normalizeTddAuditStageList` extracts red/green/refactor stages from audit JSON
- TDD audits are discovered but NOT explicitly tracked as handoff artifacts

### Anti-Patterns to Avoid
1. **Backtick-wrapped commands in summaries** — verify:summary extracts backtick tokens as file paths, misclassifying TDD command examples
2. **Raw JSON in human-facing output** — TDD audit data should render as narrative, not raw tokens
3. **Duplicating TDD audit discovery** — reuse `discoverPhaseProofContext` rather than re-implementing

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| TDD audit file discovery | Custom scanner | `discoverPhaseProofContext` | Already implements discovery with error handling |
| TDD stage normalization | Custom parser | `normalizeTddAuditStageList` | Handles malformed input gracefully |
| File existence checks | Regex extraction | Use `verify:summary` with proper path validation | Has edge case handling for paths |

## Common Pitfalls

### Pitfall 1: Backtick Command Misclassification
**What goes wrong:** `cmdVerifySummary` extracts `\`npm run test -- tests/foo.test.cjs\`` as a file path because it matches the pattern `\`([^`]+\.[a-zA-Z]+)\``.
**Why it happens:** Pattern `/`([^`]+\.[a-zA-Z]+)`/` greedily matches any backtick-wrapped content with a dot, including command-line arguments.
**How to avoid:** Only match path patterns that start with `./`, `../`, or `/` and don't contain spaces or shell metacharacters.
**Warning signs:** "Missing files" errors referencing command strings.

### Pitfall 2: TDD Audit Not Surviving Resume
**What goes wrong:** TDD proof is lost when session is cleared mid-phase because audits aren't tracked in handoff artifact inventory.
**Why it happens:** `discoverPhaseProofContext` adds audits to context, but `buildPhaseHandoffPayload` doesn't explicitly include them as tracked artifacts.
**How to avoid:** Add `tdd_audits` to the explicit artifact inventory in `buildPhaseHandoffPayload`.
**Warning signs:** TDD audit files exist on disk but aren't restored after resume.

### Pitfall 3: Summary Generation is Stub
**What goes wrong:** `cmdSummaryGenerate` returns "not fully implemented" instead of generating narrative summary.
**Why it happens:** Function was scaffolded but never completed.
**How to avoid:** Implement full summary generation that reads PLAN.md, TDD-AUDIT.json, and handoff artifacts to produce narrative output.
**Warning signs:** "Summary generation not fully implemented" in output.

## Code Examples

### TDD Audit JSON Structure (existing)
```json
{
  "phases": {
    "red": {
      "target_command": "npm run test:file -- tests/foo.test.cjs",
      "exit_code": 1,
      "matched_evidence_snippet": "✖ test-name - expected behavior",
      "expected_outcome": "fail",
      "observed_outcome": "fail"
    },
    "green": { ... },
    "refactor": { ... }
  }
}
```

### Narrative TDD Proof Rendering (desired)
```javascript
// Instead of:
`- Commit: \`abc123f\` (test: add failing test)
- Target: \`npm run test -- tests/foo.test.cjs\`
- Exit: 1`

// Render as:
`- **RED** (test: add failing test)
  - Commit: abc123f
  - Ran: npm run test -- tests/foo.test.cjs
  - Result: Test failed as expected (exit 1)
  - Evidence: "✖ test-name - expected behavior"`
```

### Adding TDD Audits to Handoff Inventory
```javascript
// In buildPhaseHandoffPayload, add:
const tddAuditFiles = listPhaseHandoffTddAudits
  ? listPhaseHandoffTddAudits(cwd, artifact.phase)
  : [];

return {
  ...payload,
  context: {
    ...payload.context,
    tdd_audits: tddAuditFiles.map(f => ({
      path: f.path,
      plan: f.plan,
      stages: f.stages,
    })),
  },
};
```

## Open Questions

1. Should TDD rationale be stored in PLAN.md frontmatter, TDD-AUDIT.json, or both?
2. Should summary:generate read directly from TDD-AUDIT.json or from handoff context?
3. Should verify:state check TDD audit continuity for all phases or only TDD-type plans?

## Sources

### Primary (HIGH confidence)
- Source: `.planning/phases/206-tdd-validator-shipping/` — TDD validator implementation
- Source: `src/lib/phase-handoff.js` — TDD audit discovery implementation
- Source: `src/commands/misc/templates.js:365-406` — summary:generate stub

### Secondary (MEDIUM confidence)
- Source: `.planning/memory/lessons.json` — lesson "Summary verifier mistakes backticked commands for file references"
- Source: `src/commands/misc/git-helpers.js:198-294` — verify:summary implementation

### Tertiary (LOW confidence)
- Source: `src/commands/state.js:1338-` — state validation implementation

## Metadata

**Confidence breakdown:** Domain understanding HIGH, implementation approach HIGH, risk assessment MEDIUM (backtick misclassification is known issue)

**Research date:** 2026-04-06

**Valid until:** Phase 208 completion

**Key files to modify:**
1. `src/lib/phase-handoff.js` — add tdd_audits to explicit artifact inventory
2. `src/commands/misc/templates.js` — implement cmdSummaryGenerate with narrative TDD proof
3. `src/commands/misc/git-helpers.js` — fix backtick pattern to avoid command misclassification
4. `src/commands/state.js` — add TDD audit sidecar checks to cmdStateValidate
5. `src/lib/helpers.js` or `src/lib/phase-handoff.js` — add listPhaseHandoffTddAudits function
