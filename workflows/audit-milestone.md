<purpose>
Verify milestone achieved its definition of done by aggregating phase verifications, checking cross-phase integration, and assessing requirements coverage. Reads existing VERIFICATION.md files, aggregates tech debt and deferred gaps, then spawns integration checker for cross-phase wiring.
</purpose>

<required_reading>
Read all execution_context files before starting.
</required_reading>

<process>

<!-- section: initialize -->
<skill:bgsd-context-init />

Extract from `<bgsd-context>` JSON: `milestone_version`, `milestone_name`, `phase_count`, `completed_phases`, `commit_docs`.

Resolve verifier model — use `verifier_model`/`checker_model` from context if present. Fallback:
```bash
CHECKER_MODEL=$(node __OPENCODE_CONFIG__/bgsd-oc/bin/bgsd-tools.cjs util:resolve-model bgsd-verifier)
```
<!-- /section -->

<!-- section: determine_scope -->
## 1. Determine Milestone Scope

```bash
node __OPENCODE_CONFIG__/bgsd-oc/bin/bgsd-tools.cjs plan:phases list
```

Parse milestone version from arguments or detect from ROADMAP.md. Identify phase directories, milestone definition of done, and requirements mapped to this milestone.
<!-- /section -->

<!-- section: read_verifications -->
## 2. Read All Phase Verifications

```bash
PHASE_INFO=$(node __OPENCODE_CONFIG__/bgsd-oc/bin/bgsd-tools.cjs plan:find-phase 01)
```

For each phase, read VERIFICATION.md and extract: Status (passed|gaps_found), critical gaps (blockers), non-critical gaps (tech debt/deferred), anti-patterns, requirements coverage. Missing VERIFICATION.md → flag as unverified phase (blocker).
<!-- /section -->

<!-- section: spawn_checker -->
## 3. Spawn Integration Checker

Extract `MILESTONE_REQ_IDS` from REQUIREMENTS.md traceability table.

```
Task(
  prompt="Check cross-phase integration and E2E flows. Phases: {phase_dirs}. Phase exports: {from SUMMARYs}. API routes: {routes}. Milestone Requirements: {MILESTONE_REQ_IDS with description+phase}. Map each finding to affected REQ-IDs. Verify cross-phase wiring and E2E user flows.",
  subagent_type="bgsd-verifier",
  model="{verifier_model}"
)
```
<!-- /section -->

<!-- section: collect_results -->
## 4. Collect Results

Combine: phase-level gaps/tech debt (step 2) + integration checker's report (wiring gaps, broken flows).
<!-- /section -->

<!-- section: requirements_coverage -->
## 5. Requirements Coverage (3-Source Cross-Reference)

For each REQ-ID, cross-reference: (1) REQUIREMENTS.md traceability table (ID, phase, checkbox), (2) Phase VERIFICATION.md requirements table (status, evidence), (3) SUMMARY.md frontmatter `requirements-completed`:
```bash
for summary in .planning/phases/*-*/*-SUMMARY.md; do
  node __OPENCODE_CONFIG__/bgsd-oc/bin/bgsd-tools.cjs util:summary-extract "$summary" --fields requirements_completed | jq -r '.requirements_completed'
done
```

**Status matrix:** passed+listed+`[x]`→satisfied | passed+listed+`[ ]`→satisfied (update) | passed+missing→partial | gaps_found→unsatisfied | missing+listed→partial | missing+missing→unsatisfied.

**FAIL gate:** Any `unsatisfied` → forces `gaps_found`. **Orphans** (in traceability, absent from all VERIFICATIONs) → `unsatisfied`.
<!-- /section -->

<!-- section: aggregate_report -->
## 6. Aggregate into v{version}-MILESTONE-AUDIT.md

YAML frontmatter fields: `milestone`, `audited`, `status` (passed|gaps_found|tech_debt), `scores` (requirements/phases/integration/flows as N/M), `gaps.requirements[]` (id, status, phase, claimed_by_plans, completed_by_plans, verification_status, evidence), `gaps.integration[]`, `gaps.flows[]`, `tech_debt[]` (phase + items list).

Plus full markdown report (requirements, phases, integration, tech debt tables).
<!-- /section -->

<!-- section: present_results -->
## 7. Present Results

Route by status (see `<offer_next>`).
<!-- /section -->

</process>

<!-- section: offer_next -->
<offer_next>
Output directly (not code block). Route:

**passed:** `## ✓ Milestone {version} — Audit Passed` | Score: {N}/{M} | Report: .planning/v{version}-MILESTONE-AUDIT.md | Next: `/bgsd-complete-milestone {version}`

**gaps_found:** `## ⚠ Milestone {version} — Gaps Found` | Score: {N}/{M} | List unsatisfied REQs, cross-phase issues, broken flows | Next: `/bgsd-plan gaps`

**tech_debt:** `## ⚡ Milestone {version} — Tech Debt Review` | Score: {N}/{M} | Tech debt by phase | Options: A) `/bgsd-complete-milestone {version}` B) `/bgsd-plan gaps`

All routes: `<sub>/clear first → fresh context window</sub>`
</offer_next>
<!-- /section -->

<!-- section: success_criteria -->
<success_criteria>
- [ ] Milestone scope identified
- [ ] All phase VERIFICATION.md files read
- [ ] SUMMARY.md `requirements-completed` frontmatter extracted for each phase
- [ ] REQUIREMENTS.md traceability table parsed for all milestone REQ-IDs
- [ ] 3-source cross-reference completed (VERIFICATION + SUMMARY + traceability)
- [ ] Orphaned requirements detected
- [ ] Tech debt and deferred gaps aggregated
- [ ] Integration checker spawned with milestone requirement IDs
- [ ] v{version}-MILESTONE-AUDIT.md created with structured requirement gap objects
- [ ] FAIL gate enforced — any unsatisfied requirement forces gaps_found status
- [ ] Results presented with actionable next steps
</success_criteria>
<!-- /section -->
