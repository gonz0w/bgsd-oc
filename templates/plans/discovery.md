---
phase: [XX-phase-name]
plan: [NN]
type: execute
wave: 1
depends_on: []
files_modified:
  - .planning/phases/[XX-phase-name]/DISCOVERY.md
autonomous: true
requirements:
  - [REQ-ID]
must_haves:
  truths:
    - "[Key questions are answered with evidence]"
  artifacts:
    - path: ".planning/phases/[XX-phase-name]/DISCOVERY.md"
      provides: "Research findings and recommendations"
---

<!-- Discovery/Research Plan: Produces research artifacts, not production code. -->
<!-- Tasks focus on evaluating options, prototyping, and documenting findings. -->

<objective>
[What questions need answering and why this research is needed before implementation.]

Purpose: [Reduce uncertainty — evaluate approaches, validate assumptions, or assess feasibility.]
Output: [DISCOVERY.md with findings, recommendations, and decision rationale.]
</objective>

<execution_context>
@__OPENCODE_CONFIG__/get-shit-done/workflows/execute-plan.md
@__OPENCODE_CONFIG__/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@[existing code or docs relevant to the research]
</context>

<tasks>

<task type="auto">
  <name>Task 1: Evaluate [option/library/approach]</name>
  <files>
    .planning/phases/[XX-phase-name]/DISCOVERY.md
  </files>
  <action>
[Research instructions: what to evaluate, criteria to assess, sources to consult.]

Evaluation criteria:
- [Criterion 1 — e.g., performance, API ergonomics, bundle size]
- [Criterion 2 — e.g., community support, documentation quality]
- [Criterion 3 — e.g., compatibility with existing stack]

Document findings in DISCOVERY.md with:
- Summary of each option evaluated
- Pros/cons comparison table
- Recommendation with rationale
  </action>
  <verify>
[How to verify research quality — e.g., DISCOVERY.md exists and contains comparison table.]
```bash
[ -f .planning/phases/[XX-phase-name]/DISCOVERY.md ] && echo "FOUND" || echo "MISSING"
```
  </verify>
  <done>[DISCOVERY.md contains evaluation of all options with comparison table and recommendation.]</done>
</task>

<task type="auto">
  <name>Task 2: Prototype recommended approach</name>
  <files>
    [prototype file paths — may be temporary/throwaway]
  </files>
  <action>
[Build a minimal prototype to validate the recommended approach.]

Prototype scope:
- [What to build — minimal, focused]
- [What to measure — performance, ergonomics, integration fit]
- [What to skip — production concerns, edge cases]

Add prototype results to DISCOVERY.md under "## Prototype Results".
  </action>
  <verify>
[Prototype runs and produces measurable results.]
```bash
[prototype verification command]
```
  </verify>
  <done>[Prototype validates (or invalidates) the recommended approach. Results documented in DISCOVERY.md.]</done>
</task>

<task type="auto">
  <name>Task 3: Document final recommendation</name>
  <files>
    .planning/phases/[XX-phase-name]/DISCOVERY.md
  </files>
  <action>
Update DISCOVERY.md with final recommendation section:

## Recommendation

**Selected approach:** [name]
**Rationale:** [why this over alternatives]
**Confidence:** [high/medium/low]
**Risks:** [known risks and mitigations]
**Next steps:** [what implementation plans should cover]
  </action>
  <verify>
DISCOVERY.md contains Recommendation section with selected approach and rationale.
  </verify>
  <done>[DISCOVERY.md is complete with evaluation, prototype results, and actionable recommendation.]</done>
</task>

</tasks>

<verification>
1. DISCOVERY.md exists and is well-structured
2. All evaluated options are documented with pros/cons
3. Recommendation is clear with supporting evidence
4. Prototype results (if applicable) validate the recommendation
</verification>

<success_criteria>
- [ ] All research questions answered with evidence
- [ ] Options evaluated with comparison table
- [ ] Prototype validates recommended approach (if applicable)
- [ ] DISCOVERY.md contains actionable recommendation
- [ ] Findings are sufficient to create implementation plans
</success_criteria>

<output>
After completion, create `.planning/phases/[XX-phase-name]/[XX]-[NN]-SUMMARY.md`
</output>
