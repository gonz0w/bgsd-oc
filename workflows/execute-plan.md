<purpose>
Execute a phase prompt (PLAN.md) and create the outcome summary (SUMMARY.md).
</purpose>

<required_reading>
Read STATE.md and config.json before any operation.
Load git-integration.md sections as needed via extract-sections.
</required_reading>

<process>

<step name="init_context" priority="first">
**Context:** This workflow receives project context via `<bgsd-context>` auto-injected by the bGSD plugin's `command.execute.before` hook. If no `<bgsd-context>` block is present, the plugin is not loaded.

**If no `<bgsd-context>` found:** Stop and tell the user: "bGSD plugin required for v9.0. Install with: npx bgsd-oc"

Parse `<bgsd-context>` JSON for: `executor_model`, `commit_docs`, `phase_dir`, `phase_number`, `plans`, `summaries`, `incomplete_plans`.

If `.planning/` missing: error.
</step>

<step name="identify_plan">
Find first PLAN without matching SUMMARY. Decimal phases supported (`01.1-hotfix/`).

Yolo: auto-approve → parse_segments. Interactive: present, wait for confirmation.
</step>

<step name="record_start_time">
```bash
PLAN_START_TIME=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
PLAN_START_EPOCH=$(date +%s)
```
</step>

<step name="context_budget_check">
**Pre-computed decision:** If `decisions.context-budget-gate` exists in `<bgsd-context>`, use its `.value` (proceed/warn/stop) to determine budget action. Skip CLI budget command interpretation below.

**Fallback** (if decisions not available):

```bash
BUDGET=$(node __OPENCODE_CONFIG__/bgsd-oc/bin/bgsd-tools.cjs verify:context-budget "${PLAN_PATH}" 2>/dev/null)
```

If `warning` truthy: yolo → log and continue. Interactive → ask proceed/stop.
If no warning: continue silently.
</step>

<step name="parse_segments">
**Pre-computed decision:** If `decisions.execution-pattern` exists in `<bgsd-context>`, use its `.value` as the pattern letter (A/B/C). Skip checkpoint type scanning below.

**Fallback** (if decisions not available):

```bash
grep -n "type=\"checkpoint" .planning/phases/XX-name/{phase}-{plan}-PLAN.md
```

| Checkpoints | Pattern | Execution |
|-------------|---------|-----------|
| None | A (autonomous) | Single subagent: full plan + SUMMARY + commit |
| Verify-only | B (segmented) | Segments between checkpoints |
| Decision | C (main) | Execute in main context |

**Pattern A:** init_agent_tracking → spawn Task(subagent_type="bgsd-executor", model=executor_model) with plan path, autonomous execution, all tasks + SUMMARY + commit → track → wait → report.
**Pattern B:** Segment-by-segment. Autonomous segments: subagent. Checkpoints: main. After all: aggregate → SUMMARY → commit → self-check.
**Pattern C:** Execute using standard flow (step execute).
</step>

<step name="init_agent_tracking">
```bash
if [ ! -f .planning/agent-history.json ]; then
  echo '{"version":"1.0","max_entries":50,"entries":[]}' > .planning/agent-history.json
fi
```

On spawn: write agent_id to `current-agent-id.txt`, append to history. On completion: update status, delete current-agent-id.txt. Run for Pattern A/B. Skip for C.
</step>

<step name="segment_execution">
Pattern B only. Per segment: subagent for auto tasks, main for checkpoints. After ALL segments: aggregate → SUMMARY → commit → self-check (verify files exist, commits present).

**classifyHandoffIfNeeded bug:** If agent reports failure with this error → runtime bug. Spot-check; if pass → treat as success.
</step>

<step name="load_prompt">
Read PLAN.md — this IS the execution instructions. If plan references CONTEXT.md: honor throughout.
</step>

<step name="previous_phase_check">
**Pre-computed decision:** If `decisions.previous-check-gate` exists in `<bgsd-context>`, use its `.value` (proceed/warn/block). Skip previous SUMMARY analysis below.

**Fallback** (if decisions not available):

If previous SUMMARY has unresolved issues or blockers: ask proceed/address/review.
</step>

<step name="execute">
1. Read @context files
2. Per task: `type="auto"` → implement (TDD if `tdd="true"`), verify, commit. `type="checkpoint:*"` → STOP, wait for user.
3. Run `<verification>` checks
4. Confirm `<success_criteria>` met
5. Document deviations
</step>

<authentication_gates>
Auth errors are NOT failures — they're interaction points. Indicators: 401/403, "Not authenticated", "Set {ENV_VAR}".

Protocol: recognize gate → STOP → create checkpoint:human-action → wait → verify → retry → continue.
Document as normal flow, not deviations.
</authentication_gates>

<deviation_rules>
| Rule | Trigger | Action | Permission |
|------|---------|--------|------------|
| **1: Bug** | Broken behavior, errors, security vulns | Fix → test → verify → track `[Rule 1 - Bug]` | Auto |
| **2: Missing Critical** | Missing error handling, validation, auth, indexes | Add → test → verify → track `[Rule 2 - Missing Critical]` | Auto |
| **3: Blocking** | Missing deps, wrong types, broken imports | Fix → verify → track `[Rule 3 - Blocking]` | Auto |
| **4: Architectural** | New DB table, schema change, switching libs | STOP → present decision → track `[Rule 4 - Architectural]` | Ask |

Priority: R4 (STOP) > R1-3 (auto) > unsure → R4.

Document in SUMMARY: per deviation with rule/category/task/issue/fix/files/commit. None? → "plan executed exactly as written."
</deviation_rules>

<deviation_auto_capture>
After a SUCCESSFUL Rule 1 (Bug) deviation recovery — meaning the fix was applied, verified working, and execution continued — auto-capture the recovery pattern as a structured lesson:

```bash
node __OPENCODE_CONFIG__/bgsd-oc/bin/bgsd-tools.cjs lessons:deviation-capture \
  --rule 1 \
  --failure-count "${FAILURE_COUNT}" \
  --behavioral-change "${WHAT_FIXED_IT}" \
  --agent "${AGENT_NAME}" \
  2>/dev/null || true
```

Where:
- `FAILURE_COUNT`: Number of failed attempts before the successful recovery (1-3)
- `WHAT_FIXED_IT`: Brief description of the behavioral change that resolved the issue (e.g., "Added null check before property access", "Used path.resolve instead of relative path")
- `AGENT_NAME`: The agent that performed the recovery (e.g., bgsd-executor)

**Rules:**
- ONLY capture after Rule 1 (Bug) recoveries — the command filters internally, but do NOT invoke for Rule 3 (Blocking/environmental) failures like missing deps, npm errors, or permission issues
- ONLY capture after SUCCESSFUL recovery (fix verified working) — never on failure or escalation
- The `2>/dev/null || true` suffix is MANDATORY — capture must never block execution
- The command silently stops after 3 captures per milestone — no action needed from the executor
- Do NOT capture Rule 2 (Missing Critical) or Rule 4 (Architectural) deviations — only Rule 1 code bugs carry reusable behavioral patterns
</deviation_auto_capture>

<tdd_plan_execution>
For `type: tdd` plans, follow the dedicated TDD workflow:
@__OPENCODE_CONFIG__/bgsd-oc/workflows/tdd.md

The TDD workflow enforces RED→GREEN→REFACTOR gates via CLI validation commands. Do NOT use the standard task execution flow for TDD plans.
</tdd_plan_execution>

<auto_test_after_edit>
After each file modification during task execution (not just at task end), for ALL plan types:

1. Check if project has a test command:
   - Config: read `test_commands` from config.json
   - Fallback: check `package.json` scripts.test, or look for pytest/go test/cargo test
   - If no test command found: skip auto-test

2. Run auto-test:
   ```bash
   AUTOTEST=$(node __OPENCODE_CONFIG__/bgsd-oc/bin/bgsd-tools.cjs execute:tdd auto-test --test-cmd "<test_command>")
   ```

3. If test fails:
   - Log the failure: "Auto-test failed after editing {file}: {output_snippet}"
   - Fix the issue immediately before continuing to next file edit
   - Do NOT accumulate broken states across multiple edits

4. Frequency: Run after each logical file change (not after every save, but after completing an edit to a file). For rapid multi-file changes within a single conceptual step, run once after the batch.

Purpose: Catch compounding errors early. A test failure after editing file A is much easier to diagnose than a test failure after editing files A, B, C, D.
</auto_test_after_edit>

<task_commit>
After each task: `git status --short` → stage individually (NEVER `git add .`) → commit as `{type}({phase}-{plan}): {description}` → record hash.

**Pre-commit test gate:** Before committing, run the project's test suite if available:
1. Check config.json `test_commands` or `package.json` scripts.test for a test command
2. Run `timeout 180 npm test` (or equivalent) — full suite must pass
3. If tests fail: the task is NOT complete — fix the regression before committing
4. If no test command exists: skip the gate and commit directly

Types: feat, fix, test, refactor, perf, docs, style, chore.

After committing task work, save a bookmark:
```bash
node __OPENCODE_CONFIG__/bgsd-oc/bin/bgsd-tools.cjs util:memory write --store bookmarks --entry '{"phase":"${PHASE}","plan":"${PLAN}","task":${TASK_NUM},"total_tasks":${TOTAL_TASKS},"git_head":"'$(git rev-parse --short HEAD)'"}'
```
</task_commit>

<step name="checkpoint_protocol">
On `type="checkpoint:*"`: automate first, then present checkpoint.

| Type | Content | Resume |
|------|---------|--------|
| human-verify | What built + verification steps | "approved" or issues |
| decision | Options with pros/cons | "Select: option-id" |
| human-action | Automated + ONE manual step | "done" |

WAIT for user — do NOT hallucinate completion. See references/checkpoints.md.
</step>

<step name="checkpoint_return_for_orchestrator">
When spawned via Task: return completed tasks table (hashes + files), current task (blocker), checkpoint details, what's awaited.
</step>

<step name="verification_failure_gate">
If verification fails: STOP. Options: Retry | Skip (mark incomplete) | Stop.
</step>

<step name="record_completion_time">
```bash
PLAN_END_EPOCH=$(date +%s)
DURATION_SEC=$(( PLAN_END_EPOCH - PLAN_START_EPOCH ))
DURATION_MIN=$(( DURATION_SEC / 60 ))
DURATION="${DURATION_MIN} min"
```
</step>

<step name="generate_user_setup">
If plan has `user_setup:` frontmatter: create `{phase}-USER-SETUP.md` using template. Otherwise skip.
</step>

<step name="post_execution_review">
After plan execution completes (all tasks committed, before SUMMARY creation):

1. Check if plan has `autonomous: true` and is not a gap_closure plan. Skip review for gap closures and checkpoint plans.

2. Assemble review context:
```bash
REVIEW_CTX=$(node __OPENCODE_CONFIG__/bgsd-oc/bin/bgsd-tools.cjs verify:review ${PHASE_NUM} ${PLAN_NUM} --raw 2>/dev/null)
```

3. If review context available (non-empty, valid JSON), perform review:
   - Load `references/reviewer-agent.md` for review protocol
   - Review the changed files against conventions using the protocol
   - Produce review findings JSON

4. Store review findings for SUMMARY inclusion:
   - If `status: approved` — note in summary, no action needed
   - If `status: changes_requested` with blockers — list blockers, but do NOT auto-fix (reviewer suggests, executor decides in next iteration)
   - If `status: info_only` — note findings in summary for awareness

5. Review is NON-BLOCKING for plan completion. Findings are informational for this iteration.
   Future iterations may make blockers blocking once the review pipeline is proven reliable.

Skip conditions (do NOT review):
- Plan has `gap_closure: true` in frontmatter
- Plan has checkpoints (Pattern B/C) — review happens per-segment if at all
- Review context assembly fails (no commits found, etc.)
- Bundle is over budget (focus on fixing that first)
</step>

<step name="create_summary">
**Step 1: Generate scaffold via CLI**

```bash
SCAFFOLD=$(node __OPENCODE_CONFIG__/bgsd-oc/bin/bgsd-tools.cjs util:summary-generate ${PHASE_NUM} ${PLAN_NUM} --raw 2>/dev/null)
```

Parse the JSON output. If `error` field exists or the command failed (non-zero exit), log a warning:
"⚠ summary:generate failed — falling back to full authorship" and skip to the **Fallback** section below.

If scaffold succeeded: the SUMMARY.md file is already written to disk with all data sections populated. The `todos_remaining` count from the JSON output tells you how many sections need filling.

**Step 2: Fill remaining TODO sections**

Read the generated SUMMARY.md file. Fill each of these sections with substantive content based on execution experience, then write back:

1. **`one-liner:`** in frontmatter — and the matching bold line under the heading (must be identical)
2. **`key-decisions:`** in frontmatter — list of decision strings from execution
3. **`patterns-established:`** in frontmatter — if any new patterns were established (omit if none)
4. **Accomplishments** section — 2-3 bullets describing what changed and why
5. **Decisions Made** section — key decisions with brief rationale, or "None - followed plan as specified"
6. **Deviations from Plan** section — describe deviations per deviation rules format, or "None - plan executed exactly as written"
7. **Issues Encountered** section — problems and how resolved, or "None"
8. **Next Phase Readiness** section — what's ready for next phase, any blockers

After filling, verify the `todos_remaining` count matches the number of sections you filled.

**Step 3: Review Findings**

If post_execution_review produced findings, add a Review Findings section:

## Review Findings

**Status:** {approved|changes_requested|info_only}

| Severity | File | Dimension | Finding | Suggestion |
|----------|------|-----------|---------|------------|
| {severity} | {file} | {dimension} | {finding} | {suggestion} |

If no review was performed (gap closure, skipped, etc.): omit this section entirely.

**Fallback (if scaffold generation failed):**

Create `{phase}-{plan}-SUMMARY.md` using templates/summary.md with full authorship.

Frontmatter: phase, plan, subsystem, tags, requires/provides/affects, tech-stack, key-files, key-decisions, requirements-completed (copy from PLAN frontmatter), duration, completed date.

One-liner MUST be substantive. Include duration, start/end, task count, file count.
</step>

<step name="update_current_position">
```bash
node __OPENCODE_CONFIG__/bgsd-oc/bin/bgsd-tools.cjs verify:state advance-plan
node __OPENCODE_CONFIG__/bgsd-oc/bin/bgsd-tools.cjs verify:state update-progress
node __OPENCODE_CONFIG__/bgsd-oc/bin/bgsd-tools.cjs verify:state record-metric \
  --phase "${PHASE}" --plan "${PLAN}" --duration "${DURATION}" \
  --tasks "${TASK_COUNT}" --files "${FILE_COUNT}"
```
</step>

<step name="extract_decisions_and_issues">
```bash
node __OPENCODE_CONFIG__/bgsd-oc/bin/bgsd-tools.cjs verify:state add-decision \
  --phase "${PHASE}" --summary "${DECISION_TEXT}" --rationale "${RATIONALE}"
```
</step>

<step name="update_session_continuity">
```bash
node __OPENCODE_CONFIG__/bgsd-oc/bin/bgsd-tools.cjs verify:state record-session \
  --stopped-at "Completed ${PHASE}-${PLAN}-PLAN.md" --resume-file "None"
```
</step>

<step name="issues_review_gate">
If SUMMARY issues ≠ "None": yolo → log. Interactive → present, wait.
</step>

<step name="update_roadmap">
```bash
node __OPENCODE_CONFIG__/bgsd-oc/bin/bgsd-tools.cjs plan:roadmap update-plan-progress "${PHASE}"
```
</step>

<step name="update_requirements">
```bash
node __OPENCODE_CONFIG__/bgsd-oc/bin/bgsd-tools.cjs plan:requirements mark-complete ${REQ_IDS}
```
Extract from plan frontmatter `requirements:` field. Skip if absent.
</step>

<step name="git_commit_metadata">
```bash
node __OPENCODE_CONFIG__/bgsd-oc/bin/bgsd-tools.cjs execute:commit "docs({phase}-{plan}): complete [plan-name] plan" --files .planning/phases/XX-name/{phase}-{plan}-SUMMARY.md .planning/STATE.md .planning/ROADMAP.md .planning/REQUIREMENTS.md
```
</step>

<step name="update_codebase_map">
If .planning/codebase/ exists: check structural changes (new dirs, deps, patterns, APIs, config). Update relevant map files, amend commit. Skip for code-only/bugfix changes.
</step>

<step name="offer_next">
If USER_SETUP_CREATED: display warning at TOP.

| summaries < plans | More plans: find next, yolo auto-continue |
| summaries = plans, not last phase | Phase done: suggest plan-phase/verify-work |
| summaries = plans, last phase | Milestone done: suggest complete-milestone |
</step>

</process>

<success_criteria>
- All tasks completed, all verifications pass
- SUMMARY.md created with substantive content
- STATE.md updated (position, decisions, session)
- ROADMAP.md updated
- USER-SETUP.md generated if applicable
</success_criteria>
