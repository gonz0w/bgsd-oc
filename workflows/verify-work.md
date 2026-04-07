<purpose>
Validate features through conversational testing with persistent state. Creates UAT.md tracking test progress. User tests, the agent records. One test at a time.
</purpose>

<philosophy>
Show expected, ask if reality matches. "yes"/"pass"/"next" → pass. Anything else → logged as issue, severity inferred. Never ask severity questions.
</philosophy>

<template>
@__OPENCODE_CONFIG__/bgsd-oc/templates/UAT.md
</template>

<process>

<step name="initialize" priority="first">
**Context:** This workflow receives project context via `<bgsd-context>` auto-injected by the bGSD plugin's `command.execute.before` hook. If no `<bgsd-context>` block is present, the plugin is not loaded.

**If no `<bgsd-context>` found:** Stop and tell the user: "bGSD plugin required for v9.0. Install with: npx bgsd-oc"

Parse `<bgsd-context>` JSON for: `planner_model`, `checker_model`, `commit_docs`, `phase_found`, `phase_dir`, `phase_number`, `phase_name`, `has_verification`, `resume_summary`, `effective_intent`, `jj_planning_context`.

Parse `$ARGUMENTS` for optional `--batch N`.
- No `--batch` → keep the default one-test-at-a-time flow.
- `--batch N` → enable grouped verification mode with batch size `N`, while still falling back to exact item-level handling only for failing groups.
</step>

<step name="gate_chain_continuation">
```
Task(
  prompt="Determine verification continuation action. resume_summary: {resume_summary}, latest_valid_step: {latest_valid_step}, resume_valid: {resume_valid}, stale_sources: {stale_sources}",
  subagent_type="bgsd-context-bootstrapper",
  model="gpt-5.4-nano",
  description="Validate verification handoff"
)
```
</step>

<step name="check_active_session">
```bash
find .planning/phases -name "*-UAT.md" -type f 2>/dev/null | head -5
```

If active sessions AND no args: show sessions table, ask which to resume or start new.
If active sessions AND args: check if session exists for phase — offer resume/restart.
If no sessions AND no args: prompt for phase number.
If no sessions AND args: continue to create_uat_file.

→ Options: `questionTemplate('verify-session-resume', 'SINGLE_CHOICE')` (Resume existing session / Start new session)
</step>

<step name="find_summaries">
```bash
ls "$phase_dir"/*-SUMMARY.md 2>/dev/null
```
Read each to extract testable deliverables.
</step>

<step name="extract_tests">
From SUMMARYs, parse accomplishments and user-facing changes. Create tests with name + expected observable behavior. Skip internal/non-observable items.

Use injected `effective_intent` as the default intent contract. For each desired outcome (DO-XX) relevant to this phase's requirements:
- Create a test verifying the outcome is observable (e.g., "DO-02: AI agents see intent" → test that init output includes intent data)
- Mark these tests with "[Intent]" prefix in the test name to distinguish from accomplishment-based tests
- Only include outcomes that map to this phase (cross-reference with ROADMAP requirements or intent trace)

Intent-based tests check "did we achieve what we intended?" vs accomplishment-based tests which check "does what we built work?"

If the active phase exposes an explicit `Phase Intent` block, derive a separate Intent Alignment judgment for the final UAT artifact:
- report one plain-language verdict using `aligned`, `partial`, or `misaligned`
- if the core expected user change did not land, the verdict cannot be `partial`
- keep this Intent Alignment section before or alongside Requirement Coverage instead of burying it in summary prose
- if the phase lacks the explicit phase-intent block, record Intent Alignment as `not assessed` / unavailable with a plain reason instead of guessing

Use injected `jj_planning_context` only as advisory capability context when verification routes into follow-up planning or gap closure. Do not depend on live workspace inventory.

When a tested deliverable depends on generated runtime artifacts (for example `plugin.js` or `bin/bgsd-tools.cjs`), validate the repo-local current checkout and rebuild the local runtime before asking the user to trust shipped output. The agent runs `npm run build`, reruns the focused proof against the rebuilt local runtime, and only then presents the verification step.

Prefer focused verification commands that stay attached to the touched behavior: explicit `node --test <file>...` file lists, direct smoke scripts, or helper invocations. Avoid `npm test --test-name-pattern` when it still runs unrelated suites or hides timeouts inside large files.

If a broad verification gate is already failing for unrelated historical reasons, record that baseline separately from the plan-specific result so new regressions are not conflated with pre-existing failures.

If explicit overlap evidence shows low risk, planners may manually prefer safe low-overlap sibling work for follow-up fixes. Keep that preference manual and non-heuristic.

When a phase success criterion depends on command-family or discoverability outcomes, expand verification beyond the directly touched regression file. Check the broader surfaced guidance or command-family output that users actually rely on, not just the touched test file. Keep the check scoped to the owned command family instead of inheriting unrelated validator assertions from outside the slice.

Route-aware reporting rules:
- keep behavior proof, regression proof, and human verification as separate buckets in verifier output
- render route-exempt buckets as `not required`, not as missing proof
- docs-, workflow-, template-, and guidance-only slices may stay on structural or focused proof paths without being framed as broad-regression failures

Read raw intent source docs only when direct source-text review is actually required.
</step>

<step name="plan_batches">
Only when `--batch N` is present:

1. Preserve the canonical ordered test list.
2. Partition pending tests into groups of size `N`.
3. Treat each group as a cheap clean-path pass candidate:
   - present a compact grouped summary first
   - if the group passes cleanly, mark every test in that group passed without forcing redundant item-by-item turns
   - if the group does **not** pass cleanly, drill down into that group only using the normal exact one-test-at-a-time flow

Default mode still skips this step entirely.
</step>

<step name="create_uat_file">
Write `{phase_num}-UAT.md` with frontmatter (status: testing, started), Current Test section, numbered test list (all pending), an empty Intent Alignment section, a separate Requirement Coverage section, Summary counts, and an empty Gaps section.
</step>

<step name="present_test">
If grouped mode is active and the current group has not failed yet:
Display checkpoint box with:
- Group {G}: Tests {start}-{end}
- short list of test names
- expected grouped clean-path statement

Prompt: "Pass group" or describe which test(s) failed.

If the user reports a clean pass, mark the whole group passed and continue to the next group.
If the user reports any failure or ambiguity, switch only that group into exact drill-down and present each member test individually.

Otherwise (default mode or drill-down mode):
Display checkpoint box: Test {N}: {name}, expected behavior, → "pass" or describe what's wrong.
Wait for response.

→ Options: `questionTemplate('verify-test-response', 'SINGLE_CHOICE')` (Pass / Fail / Skip)
</step>

<step name="process_response">
**Pass** ("yes", "y", "pass", "next", empty): result: pass
**Skip** ("skip", "can't test"): result: skipped
**Anything else**: result: issue, infer severity (crash→blocker, doesn't work→major, slow/weird→minor, color/spacing→cosmetic, default→major). Append to Gaps as YAML.

Grouped-mode rules:
- clean group pass → update counts for every item in the group, then continue
- failing group → do exact per-test drill-down only inside that group until each member has an exact result
- after the failing group is resolved, return to grouped mode for later clean-path groups

Update counts. More tests → present_test. No more → complete_session.
</step>

<step name="resume_from_file">
Read UAT file, find first pending test, announce progress, continue from there.

If grouped mode is active, resume from the first pending group while preserving any prior drill-down results already recorded for that group.
</step>

<step name="complete_session">
Update status: complete. Clear Current Test. Commit UAT file.

Before any transition or gap-routing handoff, write or refresh the durable `verify` artifact. Use `status: complete` for a clean pass, or `status: blocked` when verification found gaps that now route into gap closure:

```bash
VERIFY_STATUS="complete"
VERIFY_SUMMARY="Verification passed for Phase ${PHASE}"
VERIFY_NEXT_COMMAND="/bgsd-inspect progress"
# If gaps remain instead: VERIFY_STATUS="blocked" and VERIFY_NEXT_COMMAND="/bgsd-plan gaps ${PHASE}"

node __OPENCODE_CONFIG__/bgsd-oc/bin/bgsd-tools.cjs verify:state handoff write \
  --phase "${PHASE}" \
  --step verify \
  --status "${VERIFY_STATUS}" \
  --summary "${VERIFY_SUMMARY}" \
  --next-command "${VERIFY_NEXT_COMMAND}"
```

When `/bgsd-verify-work` runs standalone, route the user back through `/bgsd-inspect progress` after a clean pass. `/bgsd-execute-phase` now owns the transition step inline after successful phase verification.

If the phase includes canonical `*-TDD-AUDIT.json` proof sidecars, the shared handoff runtime keeps the discovered proof metadata in `context` when verification refreshes the durable handoff so resume inspection, downstream resume, and summary steps still have deterministic proof continuity.

Present summary table. If intent-based tests were included: report intent outcome coverage alongside pass/fail counts.
Persist the same plain-language Intent Alignment verdict in UAT.md before or alongside Requirement Coverage, using the explicit `not assessed` / unavailable fallback when the phase-intent block is missing.
If issues > 0 → use `questionTemplate('verify-complete-issues', 'SINGLE_CHOICE')` (Diagnose issues / Suggest next phase). If issues == 0 → suggest next phase.
</step>

<step name="surface_lesson_suggestions">
After verification completes, surface any lesson-based improvement suggestions (advisory only):

```bash
node {bgsd-tools-path} lessons suggest 2>/dev/null || true
```

If suggestions are returned, display them as an informational advisory:
- "Based on {N} lessons from this project, here are improvement suggestions:"
- List each suggestion briefly (agent, summary, supporting lesson count)
- Note: "These are advisory only — no action required."

If no suggestions (empty list or command unavailable): skip silently.
Do not display "no suggestions found" — silence is correct when no patterns qualify.

This step is non-blocking: `2>/dev/null || true` ensures lesson command failures never block verification.
</step>

<step name="diagnose_issues">
→ Options: `questionTemplate('verify-diagnose', 'SINGLE_CHOICE')` (Spawn debug agents / Manual handling)
Spawn parallel debug agents for each issue. Collect root causes. Update UAT.md. Proceed to plan_gap_closure.
</step>

<step name="plan_gap_closure">
```
Task(
  prompt="Phase {phase_number}, Mode: gap_closure.
Read: {phase_dir}/{phase_num}-UAT.md, .planning/STATE.md, .planning/ROADMAP.md
Use injected `effective_intent` as the default purpose/alignment contract for follow-up plans.
Use injected `jj_planning_context` as advisory-only capability context — no live workspace inventory and no automatic sibling-work routing.
If file-overlap evidence is clearly low risk, manual low-overlap sibling-work preference is allowed.
Target the unresolved blocker IDs, truths, or warnings named in the UAT/verification artifact explicitly; do not broaden scope back to already-verified phase requirements unless the gap text says they regressed.
Requirements: {phase_req_ids}. Read ./AGENTS.md and .agents/skills/ if they exist.
Output: Gap closure PLAN.md files.",
  subagent_type="bgsd-planner", model="{planner_model}", description="Plan gap closure"
)
```
PLANNING COMPLETE → verify_gap_plans. INCONCLUSIVE → report, offer manual.
</step>

<step name="verify_gap_plans">
```
Task(
  prompt="Phase {phase_number}, goal: close diagnosed gaps.
Read: {phase_dir}/*-PLAN.md. Re-check only the unresolved truths, blocker IDs, or requirement gaps named in the UAT/verification source, treat already-verified phase requirements as satisfied context, and verify coverage + must_haves.",
  subagent_type="bgsd-plan-checker", model="{checker_model}", description="Check gap plans"
)
```
PASSED → present_ready. ISSUES → revision_loop.
</step>

<step name="revision_loop">
Max 3 iterations:
```
Task(
  prompt="Read __OPENCODE_CONFIG__/agents/bgsd-planner.md for instructions.
Revision mode. Read: {phase_dir}/*-PLAN.md. Checker issues: {issues}.
Make targeted updates, return what changed.
Before returning, perform one lessons reflection using the existing lessons subsystem: review your full subagent-visible conversation and tool history for one durable prompt, workflow, tooling, or agent-behavior improvement; if found, capture at most one structured lesson with `bgsd-tools lessons:capture`.",
  subagent_type="general", model="{planner_model}", description="Revise gap plans"
)
```
After revision → re-check. Max reached: offer force proceed / provide guidance / abandon.
</step>

<step name="present_ready">
Display fixes ready: gap table, plan references. Next: `/bgsd-execute-phase {phase} --gaps-only`.
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
