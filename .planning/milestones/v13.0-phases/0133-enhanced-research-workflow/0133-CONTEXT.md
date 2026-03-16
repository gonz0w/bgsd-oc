# Phase 133: Enhanced Research Workflow - Context

**Gathered:** 2026-03-15
**Status:** Ready for planning

<domain>
## Phase Boundary

This phase upgrades `research:score` from returning a single A-F grade to a structured JSON quality profile, adds `research:gaps` as a convenience extractor, surfaces multi-source conflicts, and integrates the profile into `new-milestone.md` for LOW-confidence flagging.

</domain>

<decisions>
## Implementation Decisions

### Output Presentation
- All commands (`research:score`, `research:gaps`) output raw structured JSON to stdout — no human-formatted summaries, no flags like `--pretty`
- `research:score` also caches the profile as a visible file in the phase directory (e.g., `research-score.json`)
- `research:gaps` is a convenience wrapper that extracts `flagged_gaps[]` from the cached profile — not an independent computation
- `new-milestone.md` workflow dumps the full JSON profile for the agent to interpret
- The legacy A-F letter grade is dropped entirely — clean break, no backward-compatible `overall_grade` field

### Confidence Thresholds
- Confidence is determined by a composite score — LOW requires multiple weak factors (few sources AND old AND no official docs), not a single red flag
- Thresholds are hardcoded defaults — no config.json surface for tuning sensitivity
- Profile includes a computed `confidence_level` field with three tiers: HIGH/MEDIUM/LOW — consumers don't recompute
- Presence of multi-source conflicts is a negative signal that drags confidence down

### Conflict Handling
- Conflicts are surfaced as a top-level `conflicts[]` array in the profile (flat structure alongside `flagged_gaps[]`)
- Each conflict entry follows the success criteria shape: `{claim, source_a, source_b}`
- Conflicts are listed neutrally — no `suggested_source` or trust ranking; consumer decides which to trust

### Agent's Discretion
- Conflict detection sensitivity — agent determines what counts as a "disagreement" between sources (contradictory vs merely different claims)

### Gap Prioritization
- Each gap is a rich object: `{ gap, severity, section, suggestion }` — includes description, severity (HIGH/MEDIUM/LOW), location in doc, and what to research
- `new-milestone.md` surfaces HIGH + MEDIUM severity gaps only — LOW gaps are filtered out to reduce noise
- `research:gaps` always returns all gaps with no filtering — consumers filter if needed

</decisions>

<specifics>
## Specific Ideas

- Profile JSON shape (flat, top-level fields): `{ source_count, high_confidence_pct, oldest_source_days, has_official_docs, confidence_level, flagged_gaps[], conflicts[] }`
- Cache file is visible (not dotfile): `research-score.json` in the phase directory
- Gap entries are rich: `{ gap, severity, section, suggestion }`
- Conflict entries match success criteria: `{ claim, source_a, source_b }`

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 0133-enhanced-research-workflow*
*Context gathered: 2026-03-15*
