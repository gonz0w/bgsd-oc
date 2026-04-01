# Phase 173: Simplification Audit & Safe Sequencing - Research

**Researched:** 2026-03-31
**Domain:** Repository simplification auditing, deduped findings ledgers, and cleanup-safe sequencing
**Confidence:** HIGH

## User Constraints

- Deliver **one execution-ready audit artifact** as the primary output.
- Organize that artifact as a **canonical deduped findings ledger**, not scattered notes.
- Support an **exhaustive six-pass review** across the repo: dead code, duplication, simplification, concurrency, error handling, and hygiene/maintainability.
- Classify each finding with a **hybrid model**: action bucket + confidence.
- Use **gate-based stages with explicit prerequisites**, not fake exact waves.
- Preserve **pass traceability via pass tags on canonical findings**, not duplicated per-pass hotspot lists.
- Keep Phase 173 **milestone-local**: identify cleanup, sequencing, and defer candidates, but do not execute cleanup or drift into redesign.
- Do **not** rely on JJ live workspace inventory for audit truth; use repo artifacts and direct code evidence.

## Phase Requirements

- **AUDIT-01:** one milestone audit with dead code, duplication, simplification opportunities, concurrency risks, error-handling gaps, and maintainability hotspots with file-level references.
- **AUDIT-02:** prioritization by blast radius and safe order so low-risk deletions land before risky refactors.

## Summary

Phase 173 should be planned as a **repo-wide evidence collection and reduction pass** that produces a single canonical ledger, not as six independent reports and not as cleanup execution. The main architecture pattern is: scan the whole repo through six lenses, merge duplicate hotspots into one finding record, attach pass tags and evidence links to that record, then derive gate-based cleanup stages from blast radius, evidence strength, and prerequisites. This keeps later phases from rebuilding the same audit and prevents sequencing from drifting into guesswork.

For this repo, the standard implementation stack is mostly already present. Use repo-local evidence first: `package.json` audit tooling (`knip`, `madge`), existing AST/search capability (`acorn`, `fast-glob`, ripgrep-style searches), locked milestone context, and the two v18.1 PRDs. The audit should treat the current codebase shape itself as input evidence: `src/router.js` still concentrates 127 `indexOf('--...')` parses and 18 `includes('--...')` checks, `src/` currently has 188 JS files with 18 files over 1,000 lines, there are 61 `global._gsd*` references across `src/`, and direct `process.argv` reads still appear in command handlers. Those facts are enough to justify an audit focused on deletion, flattening, coupling reduction, and safe sequencing.

**Primary recommendation:** Plan Phase 173 around one stable `finding_id` ledger with columns for passes, files, action bucket, confidence, blast radius, evidence strength, sequencing dependency, and stage gate; use tooling only to gather evidence, never as the final truth by itself.

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `knip` | `^5.85.0` | Unused files/exports/dependency evidence | Already wired in `package.json` as `audit:dead-code`; best fit for safe-delete candidate discovery |
| `madge` | `^8.0.0` | Circular dependency and graph hot-spot evidence | Already wired in `package.json` as `audit:circular`; useful for simplification/concurrency risk surfacing |
| `acorn` | `^8.16.0` | AST-backed code inspection when grep is too weak | Already in repo toolchain; safer than regex for export/import evidence |
| `fast-glob` | `^3.3.3` | Deterministic repo traversal for exhaustive pass coverage | Already installed; supports whole-repo pass completeness |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `ripgrep` / grep-style search | repo tool | Fast cross-repo hotspot counting | Use for evidence collection, pass coverage checks, and confirming repeated patterns |
| Existing `npm test` suite | Node >=18 | Blast-radius and contract evidence | Use before promoting findings from suspect to safe-delete or safe-simplify |
| `jscpd` | user-installed locally | Duplicate-block corroboration | Available for this phase as supporting evidence when duplication needs machine confirmation; do not make it the sole duplicate truth |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| One canonical findings ledger | Separate per-pass reports | Easier to write, but duplicates hotspots and weakens sequencing reuse |
| Gate-based stages | Exact execution waves | Looks precise, but invents ordering the audit cannot honestly prove yet |
| Repo-local audit tools plus direct code evidence | Fully custom analyzer first | Too much build cost for Phase 173; the deliverable is the audit artifact, not a new audit platform |
| `knip` for dead-surface evidence | Pure manual review | Misses exhaustive coverage and scales poorly across the repo |

## Architecture Patterns

### Recommended Project Structure

Use one primary audit artifact with this shape:

1. **Method / scope header** — state six passes, evidence policy, and classification rules.
2. **Canonical findings ledger** — one row per hotspot or cleanup candidate.
3. **Stage gates** — a short table mapping findings into prerequisite-based stages.
4. **Deferred adjacent work** — explicitly list out-of-scope or later-phase follow-ups.
5. **Coverage notes** — note any thin-evidence areas or validate-before-delete suspects.

### Pattern 1: Canonical Deduped Findings Ledger

Each finding should have a stable `finding_id` and these minimum fields:

- `finding_id`
- `files`
- `hotspot`
- `pass_tags[]`
- `action_bucket` (`safe_delete`, `simplify_consolidate`, `validate_before_delete`, `high_risk_refactor_defer`)
- `confidence` (`HIGH`, `MEDIUM`, `LOW`)
- `blast_radius` (`low`, `medium`, `high`)
- `evidence_strength`
- `sequencing_dependency`
- `recommended_stage_gate`
- `notes`

This is the core pattern for Phase 173. Passes are trace metadata on the finding, not separate record owners.

### Pattern 2: Evidence-First Classification

Classify findings from evidence, not from cleanup desire:

- **Safe delete** only when routing/import/test/docs evidence agrees the surface is dead or legacy-only.
- **Simplify/consolidate** when behavior is still live but represented redundantly.
- **Validate before delete** when static evidence is strong but runtime or contract proof is incomplete.
- **High-risk refactor/defer** when the hotspot is real but tightly coupled to router, output, state, or command-surface behavior.

### Pattern 3: Gate-Based Staging

Derive stages from safety boundaries:

- **Stage 0 - Audit truth established:** inventory complete, findings deduped, confidence assigned.
- **Stage 1 - Low-blast-radius deletions:** dead files, dead commands, stale docs/templates, proven legacy-only helpers.
- **Stage 2 - Validate-before-delete set:** suspects that need contract/test/routing proof before removal.
- **Stage 3 - Simplify live but redundant surfaces:** duplicated metadata, repeated predicates, repeated shaping logic.
- **Stage 4 - High-risk hotspots:** router, ambient globals, direct argv reads, oversized bucket breakup.

Inside a stage, avoid pretending one exact order exists unless a real prerequisite exists.

### Anti-Patterns to Avoid

- **Per-pass hotspot duplication** — same router hotspot repeated in dead-code, simplification, and maintainability sections as separate findings.
- **Severity-only labeling** — not enough; later phases need actionability and proof status.
- **Wave theater** — fake fine-grained ordering without real dependencies.
- **Tool-output-as-truth** — static analysis can nominate findings, but the ledger must carry human-reviewed evidence.
- **Repo-scope drift** — Phase 173 must not become a redesign backlog or implementation phase.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Unused export/file detection | Custom regex-based dead-code scanner | `knip` + direct import/routing verification | Faster, already present, and easier to corroborate |
| Circular/hotspot dependency review | Manual graph reconstruction in notes | `madge` + targeted source reads | Gives fast cycle evidence and keeps review grounded |
| JS structure inference | Regex-only parser for complex exports/imports | `acorn`-backed inspection | Safer for real evidence on live code surfaces |
| Duplicate hotspot tracking | Separate lists per review pass | One canonical findings ledger with pass tags | Prevents double counting and planning drift |
| Exact cleanup scheduling | Artificial wave numbering | Gate-based stages with explicit prerequisites | More honest and safer for downstream cleanup |
| Safe-delete confidence | Gut feel | Routing + import + docs/help + tests cross-check | Prevents deleting compatibility or resilience paths by mistake |

## Common Pitfalls

### Pitfall 1: Counting the same hotspot multiple times
**What goes wrong:** Router or init hotspots appear as several separate findings because they trigger multiple passes.  
**Why it happens:** Reviewers organize by pass instead of by canonical cleanup unit.  
**How to avoid:** Deduplicate by hotspot first, then attach all relevant `pass_tags`.  
**Warning signs:** Findings count looks high but unique affected files stay low.

### Pitfall 2: Confusing resilience fallbacks with compatibility debt
**What goes wrong:** Safe runtime fallbacks get labeled as dead compatibility code.  
**Why it happens:** Both look like alternate paths.  
**How to avoid:** Require explicit classification: `legacy-compat`, `migration`, `resilience`, or `dead`.  
**Warning signs:** A candidate removal still protects current supported environments or optional-tool absence.

### Pitfall 3: Promoting static-analysis hits directly to safe delete
**What goes wrong:** Tool findings are treated as approved cleanup.  
**Why it happens:** `knip`/duplicate reports feel authoritative.  
**How to avoid:** Only mark `safe_delete` when source, routing/help/discovery, and regression evidence align. Otherwise mark `validate_before_delete`.  
**Warning signs:** Finding cites only one tool output and no repo-local corroboration.

### Pitfall 4: Sequencing by file size instead of blast radius
**What goes wrong:** Giant files get scheduled first because they look ugly.  
**Why it happens:** Maintainability pain gets mistaken for safe first move.  
**How to avoid:** Sequence by prerequisite and contract risk, not annoyance. Router/global-state work belongs late unless prior simplifications reduce the blast radius.  
**Warning signs:** Stage 1 contains router or shared-state rewrites.

### Pitfall 5: Missing non-`src/` surfaces
**What goes wrong:** Audit only covers JS files and misses docs, templates, workflows, and help/discovery drift.  
**Why it happens:** Code review defaults to `src/`.  
**How to avoid:** Include command docs, templates, workflows, and `.planning/` references in the pass checklist.  
**Warning signs:** Findings mention code removals but never mention stale guidance or command-surface drift.

### Pitfall 6: No stable finding identity
**What goes wrong:** Later phases cannot reference or close findings cleanly.  
**Why it happens:** Audit is written as prose instead of a reusable ledger.  
**How to avoid:** Assign stable IDs and keep one row per canonical finding.  
**Warning signs:** Cleanup plans have to quote paragraphs instead of referencing IDs.

## Code Examples

Verified patterns from repo evidence and locked phase context.

### Example 1: Canonical findings ledger row

```markdown
| Finding ID | Hotspot | Files | Pass Tags | Action Bucket | Confidence | Blast Radius | Evidence | Stage Gate | Notes |
|------------|---------|-------|-----------|---------------|------------|--------------|----------|------------|-------|
| AUD-017 | Legacy config migration path still routed | `src/router.js`, `src/commands/misc.js`, `src/lib/constants.js` | dead-code, simplification, hygiene | safe_delete | HIGH | low | routed legacy command + migration-only helper + help entry | Stage 1: Proven dead/legacy-only | Remove only with command/help/docs parity check |
```

### Example 2: Pass-tagged dedupe rule

```markdown
If `src/router.js` appears in dead-code, simplification, and hygiene passes,
record one `finding_id` for the router hotspot and set:

pass_tags: [dead-code, simplification, hygiene]

Do not create three separate rows.
```

### Example 3: Gate-based staging table

```markdown
| Stage Gate | Can Start When | Includes | Must Exclude |
|------------|----------------|----------|--------------|
| Stage 1: Proven dead/legacy-only | routing/help/import evidence agrees | dead commands, stale docs, migration-only helpers | router rewrites, shared-state changes |
| Stage 2: Validation-required cleanup | proof plan exists | suspects needing tests or contract checks | high-coupling structural edits |
| Stage 3: Live-surface simplification | low-risk deletions already landed | duplicate metadata, repeated helper logic | behavior-changing dispatch changes |
| Stage 4: High-risk structural cleanup | earlier stages reduced blast radius | router, globals, oversized buckets | speculative redesign |
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Narrative cleanup notes | Canonical deduped findings ledger | Locked in Phase 173 context | Reusable by later plans without re-audit |
| Severity-only triage | Action bucket + confidence | Locked in Phase 173 context | Safer separation of proven deletes vs suspects |
| Review pass sections duplicating hotspots | Pass tags on one canonical finding | Stress-tested clarification for Phase 173 | Less double counting and clearer closure tracking |
| Exact cleanup waves | Gate-based stages with prerequisites | Stress-tested revision for Phase 173 | More honest sequencing and less fake precision |
| “Probably removable” prose | `validate_before_delete` explicit label | Stress-tested revision for Phase 173 | Prevents accidental deletion of live contracts |

## Open Questions

1. Should the audit artifact embed stage-gate rationale inline per finding, or keep stage rationale in a separate short table plus per-row stage reference?
2. What exact threshold should separate `MEDIUM` from `HIGH` confidence when routing/help/docs agree but targeted regression proof is absent?

## Sources

### Primary (HIGH confidence)
- `.planning/milestones/v18.1-phases/173-simplification-audit-safe-sequencing/173-CONTEXT.md`
- `.planning/REQUIREMENTS.md`
- `.planning/ROADMAP.md`
- `.planning/MILESTONE-INTENT.md`
- `.planning/INTENT.md`
- `.planning/research/CLI-SIMPLIFICATION-PRD.md`
- `.planning/research/GREENFIELD-COMPAT-CLEANUP-PRD.md`
- `package.json`
- Current source evidence from `src/router.js`, `src/commands/init.js`, `src/commands/misc.js`, `src/lib/config.js`, `src/lib/planning-cache.js`, and related grep counts collected during research

### Secondary (MEDIUM confidence)
- `.planning/research/completed/CODEBASE-EFFICIENCY-RELIABILITY-AUDIT-PRD.md`
- `.planning/milestones/v9.3-phases/88-quality-and-context/88-RESEARCH.md`
- `.planning/phases/109-duplicate-code-merge/109-01-SUMMARY.md`

### Tertiary (LOW confidence)
- Prior repo history referencing `jscpd` usage lineage; useful for precedent, not authoritative for current required stack

## Metadata

**Confidence breakdown:** scope and artifact shape HIGH; sequencing model HIGH; repo hotspot evidence HIGH; duplicate corroboration approach HIGH now that `jscpd` is available as optional supporting tooling.  
**Research date:** 2026-03-31  
**Valid until:** until milestone scope or phase context changes, or until Phase 174 begins cleanup and invalidates hotspot counts.
