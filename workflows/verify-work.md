<purpose>
Validate features through conversational testing with persistent state. Creates UAT.md tracking test progress. User tests, the agent records. One test at a time.
</purpose>

<philosophy>
Show expected, ask if reality matches. "yes"/"pass"/"next" → pass. Anything else → logged as issue, severity inferred. Never ask severity questions.
</philosophy>

<template>
@__OPENCODE_CONFIG__/get-shit-done/templates/UAT.md
</template>

<process>

<step name="initialize" priority="first">
```bash
INIT=$(node __OPENCODE_CONFIG__/get-shit-done/bin/gsd-tools.cjs init verify-work "${PHASE_ARG}" --compact)
```
Parse: `planner_model`, `checker_model`, `commit_docs`, `phase_found`, `phase_dir`, `phase_number`, `phase_name`, `has_verification`.
</step>

<step name="check_active_session">
```bash
find .planning/phases -name "*-UAT.md" -type f 2>/dev/null | head -5
```

If active sessions AND no args: show sessions table, ask which to resume or start new.
If active sessions AND args: check if session exists for phase — offer resume/restart.
If no sessions AND no args: prompt for phase number.
If no sessions AND args: continue to create_uat_file.
</step>

<step name="find_summaries">
```bash
ls "$phase_dir"/*-SUMMARY.md 2>/dev/null
```
Read each to extract testable deliverables.
</step>

<step name="extract_tests">
From SUMMARYs, parse accomplishments and user-facing changes. Create tests with name + expected observable behavior. Skip internal/non-observable items.

Also read .planning/INTENT.md if it exists. For each desired outcome (DO-XX) relevant to this phase's requirements:
- Create a test verifying the outcome is observable (e.g., "DO-02: AI agents see intent" → test that init output includes intent data)
- Mark these tests with "[Intent]" prefix in the test name to distinguish from accomplishment-based tests
- Only include outcomes that map to this phase (cross-reference with ROADMAP requirements or intent trace)

Intent-based tests check "did we achieve what we intended?" vs accomplishment-based tests which check "does what we built work?"
</step>

<step name="create_uat_file">
Write `{phase_num}-UAT.md` with frontmatter (status: testing, started), Current Test section, numbered test list (all pending), Summary counts, empty Gaps section.
</step>

<step name="present_test">
Display checkpoint box: Test {N}: {name}, expected behavior, → "pass" or describe what's wrong.
Wait for response.
</step>

<step name="process_response">
**Pass** ("yes", "y", "pass", "next", empty): result: pass
**Skip** ("skip", "can't test"): result: skipped
**Anything else**: result: issue, infer severity (crash→blocker, doesn't work→major, slow/weird→minor, color/spacing→cosmetic, default→major). Append to Gaps as YAML.

Update counts. More tests → present_test. No more → complete_session.
</step>

<step name="resume_from_file">
Read UAT file, find first pending test, announce progress, continue from there.
</step>

<step name="complete_session">
Update status: complete. Clear Current Test. Commit UAT file.

Present summary table. If intent-based tests were included: report intent outcome coverage alongside pass/fail counts.
If issues > 0 → diagnose_issues. If issues == 0 → suggest next phase.
</step>

<step name="diagnose_issues">
Spawn parallel debug agents for each issue. Collect root causes. Update UAT.md. Proceed to plan_gap_closure.
</step>

<step name="plan_gap_closure">
```
Task(
  prompt="Phase {phase_number}, Mode: gap_closure.
Read: {phase_dir}/{phase_num}-UAT.md, .planning/STATE.md, .planning/ROADMAP.md
Requirements: {phase_req_ids}. Read ./AGENTS.md and .agents/skills/ if they exist.
Output: Gap closure PLAN.md files.",
  subagent_type="gsd-planner", model="{planner_model}", description="Plan gap closure"
)
```
PLANNING COMPLETE → verify_gap_plans. INCONCLUSIVE → report, offer manual.
</step>

<step name="verify_gap_plans">
```
Task(
  prompt="Phase {phase_number}, goal: close diagnosed gaps.
Read: {phase_dir}/*-PLAN.md. Verify coverage + must_haves.",
  subagent_type="gsd-plan-checker", model="{checker_model}", description="Check gap plans"
)
```
PASSED → present_ready. ISSUES → revision_loop.
</step>

<step name="revision_loop">
Max 3 iterations:
```
Task(
  prompt="Read __OPENCODE_CONFIG__/agents/gsd-planner.md for instructions.
Revision mode. Read: {phase_dir}/*-PLAN.md. Checker issues: {issues}.
Make targeted updates, return what changed.",
  subagent_type="general", model="{planner_model}", description="Revise gap plans"
)
```
After revision → re-check. Max reached: offer force proceed / provide guidance / abandon.
</step>

<step name="present_ready">
Display fixes ready: gap table, plan references. Next: `/gsd-execute-phase {phase} --gaps-only`.
</step>

</process>

<update_rules>
Batched writes: on issue found, every 5 passes (safety net), and session complete. On context reset: file shows last checkpoint.
</update_rules>

<severity_inference>
| User says | Infer |
|-----------|-------|
| crash/error/exception/fails | blocker |
| doesn't work/wrong/missing | major |
| slow/weird/minor | minor |
| color/spacing/alignment | cosmetic |
Default: major. Never ask severity.
</severity_inference>

<success_criteria>
- [ ] UAT file created with tests from SUMMARYs
- [ ] Tests presented one at a time, responses processed
- [ ] Severity inferred (never asked)
- [ ] Committed on completion
- [ ] If issues: diagnose → plan fixes → check → revision loop → ready for execution
</success_criteria>
