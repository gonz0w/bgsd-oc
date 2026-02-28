<purpose>
Verify phase goal achievement through goal-backward analysis. Check codebase delivers what the phase promised, not just that tasks completed.
</purpose>

<core_principle>
Task completion ≠ Goal achievement. Goal-backward: What must be TRUE → What must EXIST → What must be WIRED. Verify each against the codebase.
</core_principle>

<required_reading>
Load sections as needed from verification-patterns.md via extract-sections.
Use templates/verification-report.md for output format.
</required_reading>

<process>

<step name="load_context" priority="first">
```bash
INIT=$(node __OPENCODE_CONFIG__/get-shit-done/bin/gsd-tools.cjs init phase-op "${PHASE_ARG}" --compact)
```

Parse: `phase_dir`, `phase_number`, `phase_name`, `plan_count`.

Load phase goal from ROADMAP.md, requirements from REQUIREMENTS.md, list plans/summaries in phase_dir.
</step>

<step name="establish_must_haves">
**Option A — PLAN frontmatter must_haves:**
```bash
for plan in "$PHASE_DIR"/*-PLAN.md; do
  node __OPENCODE_CONFIG__/get-shit-done/bin/gsd-tools.cjs frontmatter get "$plan" --field must_haves
done
```
Returns: `{ truths: [...], artifacts: [...], key_links: [...] }`. Aggregate across plans.

**Option B — ROADMAP Success Criteria** (if no must_haves):
```bash
node __OPENCODE_CONFIG__/get-shit-done/bin/gsd-tools.cjs roadmap get-phase "${phase_number}"
```
Use each criterion as a truth, derive artifacts and key links.

**Option C — Derive from goal** (fallback): State goal → derive 3-7 truths → artifacts → key links.

**Option D — INTENT.md desired outcomes** (if .planning/INTENT.md exists):
Read .planning/INTENT.md. For outcomes relevant to this phase:
- Each relevant outcome becomes a truth to verify
- Success criteria (SC-XX) become additional verification gates
- Merge with Option A/B/C truths (intent adds, doesn't replace)
</step>

<step name="verify_truths">
For each truth: identify supporting artifacts → check status → check wiring → determine truth status.

For intent-derived truths: verification should check that the desired outcome is observably achieved, not just that code exists. Example: "AI agents see intent" requires checking init output, not just that intent.js has a function.

Status: ✓ VERIFIED | ✗ FAILED | ? UNCERTAIN (needs human)
</step>

<step name="verify_artifacts">
```bash
for plan in "$PHASE_DIR"/*-PLAN.md; do
  node __OPENCODE_CONFIG__/get-shit-done/bin/gsd-tools.cjs verify artifacts "$plan"
done
```

Parse: `{ all_passed, passed, total, artifacts: [{path, exists, issues, passed}] }`

Levels: exists=false → MISSING | issues non-empty → STUB | passed=true → check wiring:
```bash
grep -r "import.*$artifact_name" src/  # IMPORTED
grep -r "$artifact_name" src/ | grep -v "import"  # USED
```
WIRED = imported AND used. ORPHANED = exists but not imported/used.
</step>

<step name="verify_wiring">
```bash
for plan in "$PHASE_DIR"/*-PLAN.md; do
  node __OPENCODE_CONFIG__/get-shit-done/bin/gsd-tools.cjs verify key-links "$plan"
done
```

Parse: `{ all_verified, verified, total, links: [{from, to, via, verified, detail}] }`

Fallback patterns if no key_links: Component→API, API→Database, Form→Handler, State→Render.
</step>

<step name="verify_requirements">
If REQUIREMENTS.md exists: match each requirement to supporting truths/artifacts.
Status: ✓ SATISFIED | ✗ BLOCKED | ? NEEDS HUMAN
</step>

<step name="scan_antipatterns">
Scan files from SUMMARYs for: TODO/FIXME/HACK (⚠️), placeholder content (🛑), empty returns (⚠️), log-only functions (⚠️).
</step>

<step name="verify_review_coverage">
**Review coverage check:**
For each SUMMARY.md in the phase:
- Check if "Review Findings" section exists
- If missing and plan was autonomous (not gap_closure): flag as ⚠️ "No post-execution review"
- If present with status "changes_requested" and blockers: flag as ⚠️ "Unresolved review blockers"
- If present with status "approved" or "info_only": ✓ Review completed

Include review coverage in verification report:

| Plan | Review Status | Blockers |
|------|---------------|----------|
| 41-01 | approved | 0 |
| 41-02 | changes_requested | 2 |
</step>

<step name="identify_human_verification">
Always needs human: visual appearance, user flows, real-time behavior, external integrations, performance feel, error clarity.

Format: Test Name → Steps → Expected → Why programmatic check insufficient.
</step>

<step name="determine_status">
- **passed:** All truths verified, artifacts pass levels 1-3, key links wired, no blockers.
- **gaps_found:** Any truth failed, artifact missing/stub, link unwired, or blocker found.
- **human_needed:** All automated checks pass but human items remain.
Score: `verified_truths / total_truths`
</step>

<step name="generate_fix_plans">
If gaps_found: cluster related gaps → generate focused plan per cluster (objective, 2-3 tasks, re-verify) → order by dependency (missing → stubs → wiring → verify).
</step>

<step name="create_report">
Write `$PHASE_DIR/${PHASE_NUM}-VERIFICATION.md` using verification-report.md template.
Sections: frontmatter, goal achievement, artifact table, wiring table, requirements, anti-patterns, human verification, gaps, fix plans.
</step>

<step name="return_to_orchestrator">
Return: status, score (N/M), report path.
If gaps_found: list gaps + fix plan names.
If human_needed: list items requiring human testing.
</step>

</process>

<success_criteria>
- [ ] Must-haves established (frontmatter, criteria, or derived)
- [ ] All truths verified with evidence
- [ ] Artifacts checked at all three levels
- [ ] Key links verified
- [ ] Requirements coverage assessed
- [ ] Anti-patterns scanned
- [ ] Review coverage assessed
- [ ] Human verification items identified
- [ ] Overall status determined
- [ ] Fix plans generated (if gaps_found)
- [ ] VERIFICATION.md created
- [ ] Results returned to orchestrator
</success_criteria>
