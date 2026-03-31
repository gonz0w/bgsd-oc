# Phase 164: Shared Planning Indexes & Metadata Truthfulness - Research

**Researched:** 2026-03-30
**Domain:** Plan metadata normalization, verifier truthfulness, and shared planning/workspace indexes in the bGSD CLI
**Confidence:** HIGH

## User Constraints

- Stay inside the existing Node.js single-file CLI architecture centered on `bin/bgsd-tools.cjs` and `src/` modules; no broad rewrite or new platform.
- Preserve backward compatibility with existing planning artifacts and roadmap/state/plan markdown formats.
- Focus on reliability, drift prevention, truthfulness, and repeated-work reduction rather than new user-facing features.
- Honor the Phase 164 roadmap goal exactly: planning and verification flows must consume real plan metadata through shared indexes and fail loudly when evidence is missing or inconclusive.
- Cover all phase requirements: `FOUND-03`, `VERIFY-01`, `VERIFY-02`, and `PLAN-01`.

## Summary

This phase should not invent a new planning model. The repo already had the right building blocks before execution: a frontmatter parser that can preserve nested objects and inline arrays, cached phase discovery, and multiple consumers that all needed the same `must_haves` data. The real problem was contract drift: verifier, scaffold, and feature-tracing logic were interpreting plan metadata differently, and verifier output could collapse malformed or empty extraction into quiet or misleading results.

The correct planning direction is one shared verifier-facing metadata contract, backed by reusable planning and workspace indexes, with explicit `missing` versus `inconclusive` semantics. Planning approval must use the same semantic contract as verification. That means no field-presence-only gate, no indentation-specific hand parsing as the source of truth, and no per-command rescans of the same plan or workspace evidence.

**Primary recommendation:** Build around a shared `plan-metadata` helper that normalizes `must_haves` once, reuses cached plan/workspace context, and makes verifier plus planner/checker flows fail loudly when metadata is absent or non-consumable.

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Node.js built-ins (`fs`, `path`) | repo standard | File and path operations | Project constraint: zero-dependency Node CLI architecture |
| `extractFrontmatter()` in `src/lib/frontmatter.js` | in-repo | Parse structured plan frontmatter | Already handles nested objects and inline arrays better than bespoke raw parsing |
| `createPlanMetadataContext()` in `src/lib/plan-metadata.js` | in-repo | Shared normalized plan metadata + caches | Canonical consumer contract for `must_haves` and plan reuse |
| `getPhaseTree()` / workspace evidence helpers in `src/lib/helpers.js` | in-repo | Shared phase/workspace indexes | Reuses existing cached discovery instead of repeated scans |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `verify:verify plan-structure` | current repo command | Approval-time semantic gate | Use before plans are considered execution-ready |
| `src/commands/verify.js` | current repo module | Artifact/key-link/quality verification | Use the shared metadata contract instead of bespoke parsing |
| `src/commands/scaffold.js` | current repo module | Must-have extraction for scaffolding/verification support | Use shared plan metadata context |
| `src/commands/features.js` | current repo module | Requirement tracing against plan truths | Use shared plan metadata context |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Shared metadata helper | Patch `parseMustHavesBlock()` in place | Too narrow; leaves consumer drift and shape mismatch risks |
| Shared caches/indexes | Per-command `readdirSync()`/`readFileSync()` scans | Simpler locally, but repeats work and reintroduces inconsistent discovery |
| Semantic approval gate | Check only `must_haves` field presence | Faster to implement, but fails `PLAN-01` and allows malformed metadata through |

## Architecture Patterns

### Recommended Project Structure

- `src/lib/frontmatter.js` remains the parsing substrate.
- `src/lib/plan-metadata.js` owns normalization and plan-level metadata reuse.
- `src/lib/helpers.js` owns shared phase/workspace discovery and evidence indexing.
- `src/commands/verify.js`, `src/commands/scaffold.js`, and `src/commands/features.js` consume the shared metadata context rather than parsing plan files independently.
- Planning approval surfaces (`verify:verify plan-structure`, planner guidance, checker guidance) all point at the same semantic contract.

### Pattern 1: Shared verifier-facing metadata contract

Use one helper to:

1. read plan content once
2. parse frontmatter once
3. normalize `must_haves.truths`, `must_haves.artifacts`, and `must_haves.key_links`
4. expose explicit section and overall status (`present`, `missing`, `inconclusive`)

This is the core pattern that keeps verifier, scaffold, feature tracing, and approval logic truthful.

### Pattern 2: Reusable planning and workspace indexes

Create one metadata context per command invocation, then reuse:

- cached phase listing
- cached plan reads
- cached workspace evidence checks

This satisfies `FOUND-03` without changing plan/task structure.

### Pattern 3: Approval uses the same semantics as verification

`verify:verify plan-structure` should reject malformed or inconclusive verifier-facing metadata. Planner and checker instructions must treat that command as the approval gate, not as optional advice.

### Anti-Patterns to Avoid

- Parsing `must_haves` differently in each consumer
- Treating empty actionable extraction as neutral or successful
- Using frontmatter field presence as proof of verifier readiness
- Fixing only one YAML indentation edge case instead of normalizing all supported shapes

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Plan metadata interpretation | Per-command custom `must_haves` parsing | Shared `plan-metadata` normalization | Prevents consumer drift |
| Artifact/key-link truthfulness | Quiet `total: 0` or "no must_haves defined" fallbacks | Explicit `missing` vs `inconclusive` failure states | Keeps verifier output honest |
| Repeated plan discovery | New ad hoc directory scans in each command | `getPhaseTree()` plus cached plan metadata context | Reuses existing index direction |
| Repeated file evidence checks | Per-item raw file reads | Shared workspace evidence index | Reduces duplicate work and inconsistent results |
| Approval readiness | Manual/frontmatter-only review | `verify:verify plan-structure` semantic gate | Enforces `PLAN-01` directly |

## Common Pitfalls

### Pitfall 1: Treating parser fallback as the primary contract
**What goes wrong:** Raw fallback parsing becomes the real source of truth.
**Why it happens:** It is tempting to patch the older helper where the bug appears.
**How to avoid:** Keep frontmatter-backed normalization as canonical; use fallback only to preserve compatibility when needed.
**Warning signs:** Consumers still import older block-specific parsers directly.

### Pitfall 2: Collapsing missing and inconclusive into one result
**What goes wrong:** Users cannot tell whether the plan omitted metadata or the verifier failed to interpret it.
**Why it happens:** Both states often produce zero actionable entries.
**How to avoid:** Carry section status through normalization and expose distinct error text/status codes.
**Warning signs:** Output says "missing" when metadata exists, or quality reports `0/0`-style neutrality.

### Pitfall 3: Fixing verifier without fixing approval
**What goes wrong:** Execution-ready plans can still pass approval with malformed verifier-facing metadata.
**Why it happens:** Verification and planning paths evolve separately.
**How to avoid:** Make `verify:verify plan-structure` the shared approval gate and update planner/checker prompts in the same slice.
**Warning signs:** Planner/checker guidance mentions only field presence or `util:frontmatter get`.

### Pitfall 4: Sharing phase scans but not evidence lookups
**What goes wrong:** The repo still rereads plan files or workspace files repeatedly even after phase discovery is cached.
**Why it happens:** Teams stop after centralizing directory listing.
**How to avoid:** Cache at the actual hot spots: plan metadata reads and workspace evidence checks.
**Warning signs:** Multiple consumers each recreate file-content scans inside the same invocation.

## Code Examples

Verified patterns from current repo sources.

```js
// src/lib/plan-metadata.js
function normalizeMustHaves(rawMustHaves) {
  const truths = normalizeSection(source?.truths, normalizeTruthItem);
  const artifacts = normalizeSection(source?.artifacts, normalizeArtifactItem);
  const keyLinks = normalizeSection(source?.key_links ?? source?.keyLinks, normalizeKeyLinkItem);
}
```

```js
// src/lib/plan-metadata.js
function createPlanMetadataContext(options = {}) {
  const planCache = new Map();
  const phaseCache = new Map();
  const workspace = createWorkspaceEvidenceIndex(cwd, options.workspace || {});
}
```

```js
// src/commands/verify.js
if (artifacts.status === 'inconclusive') {
  output({ status: 'inconclusive', error: getInconclusiveMetadataMessage('artifacts') }, raw, 'invalid');
}
```

```js
// agents/bgsd-planner.md
`verify:verify plan-structure` is the approval-time semantic gate for verifier-facing metadata.
Do not treat a visible `must_haves` field as sufficient.
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Indentation-sensitive `must_haves` parsing in individual consumers | Shared normalization in `src/lib/plan-metadata.js` | Phase 164 | Real metadata shapes become verifier-readable |
| Repeated consumer-specific plan scans | Shared metadata context with plan/phase caches | Phase 164 | Less repeated analysis and one consistent view of plans |
| Quiet empty-success or ambiguous verifier outcomes | Explicit `missing` vs `inconclusive` statuses | Phase 164 | Users get actionable failure semantics |
| Approval based on field presence or informal review | Semantic `verify:verify plan-structure` gate used by planner/checker | Phase 164 | Malformed verifier-facing metadata is blocked before execution |

## Open Questions

- How aggressively should legacy raw-parser fallbacks be retained once all known plan shapes are covered by frontmatter normalization?
- Should future phases tighten `key_links` authoring conventions so more links are machine-provable instead of prose-shaped?

## Sources

### Primary (HIGH confidence)

- Repo roadmap and requirements:
  - `.planning/ROADMAP.md`
  - `.planning/REQUIREMENTS.md`
- Existing phase artifacts:
  - `.planning/phases/164-shared-planning-indexes-metadata-truthfulness/164-01-PLAN.md`
  - `.planning/phases/164-shared-planning-indexes-metadata-truthfulness/164-02-PLAN.md`
  - `.planning/phases/164-shared-planning-indexes-metadata-truthfulness/164-03-PLAN.md`
  - `.planning/phases/164-shared-planning-indexes-metadata-truthfulness/164-VERIFICATION.md`
- Current implementation:
  - `src/lib/plan-metadata.js`
  - `src/lib/helpers.js`
  - `src/commands/verify.js`
  - `src/commands/scaffold.js`
  - `src/commands/features.js`
  - `agents/bgsd-planner.md`
  - `agents/bgsd-plan-checker.md`

### Secondary (MEDIUM confidence)

- Existing prior research draft:
  - `.planning/phases/164-shared-planning-indexes-metadata-truthfulness/164-RESEARCH.md` (replaced by this version)

### Tertiary (LOW confidence)

- None needed; this phase is primarily governed by current in-repo contracts rather than external ecosystem uncertainty.

## Metadata

**Confidence breakdown:** HIGH for repo structure, current implementation, and requirement mapping; MEDIUM for future cleanup direction on legacy fallback removal; LOW for none.
**Research date:** 2026-03-30
**Valid until:** Next material change to plan metadata, verifier contracts, or planning approval workflow surfaces.
