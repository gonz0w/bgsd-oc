<purpose>
Execute a phase prompt (PLAN.md) and create the outcome summary (SUMMARY.md).
</purpose>

<required_reading>
Read STATE.md and config.json before any operation.
</required_reading>

<skill:bgsd-context-init />

<process>

<!-- section: init_context -->
<step name="init_context" priority="first">
Parse `<bgsd-context>` JSON for: `executor_model`, `commit_docs`, `phase_dir`, `phase_number`, `plans`, `summaries`, `incomplete_plans`, `file-discovery-mode` (from `decisions.file-discovery-mode.value`), `search-mode` (from `decisions.search-mode.value`), `structural-search-mode` (from `decisions.structural-search-mode.value`), `json-transform-mode` (from `decisions.json-transform-mode.value`), `yaml-transform-mode` (from `decisions.yaml-transform-mode.value`), `text-replace-mode` (from `decisions.text-replace-mode.value`), `benchmark-mode` (from `decisions.benchmark-mode.value`), `verification-route` (from `decisions.verification-routing.value`), `tool_availability`, `tool_availability_meta`, `capability_level` (from `handoff_tool_context.capability_level`, may be `UNKNOWN`). If `.planning/` missing: error.
</step>
<!-- /section -->

<!-- section: tool_routing -->
<step name="tool_aware_guidance">
## Tool-Aware Execution Guidance

**Pre-computed decision:** If `decisions.file-discovery-mode` exists in `<bgsd-context>`, use its `.value`:
- `"fd"` → Executor agents should prefer `fd` for file discovery (e.g., `fd -e ts -e tsx`)
- `"node"` → Executor agents should use Glob tool or `node bgsd-tools.cjs` for file discovery

**Pre-computed decision:** If `decisions.search-mode` exists in `<bgsd-context>`, use its `.value`:
- `"ripgrep"` → Executor agents should prefer `rg` for content search (e.g., `rg "pattern" --type ts`)
- `"node"` → Executor agents should use Grep tool or node-based search

**Pre-computed decision:** If `decisions.structural-search-mode` exists in `<bgsd-context>`, use its `.value`:
- `"ast-grep"` → Executor agents should prefer `sg` for syntax-aware code search or safe structural rewrites (e.g., `sg --pattern 'foo($X)' src/`)
- `"ripgrep"` → Executor agents should fall back to `rg` when a text match is sufficient
- `"node"` → Executor agents should use MCP tools or node-based parsing

**Pre-computed decision:** If `decisions.json-transform-mode` exists in `<bgsd-context>`, use its `.value`:
- `"jq"` → Prefer `jq` for JSON extraction, filtering, and reshaping
- `"node"` → Use node-based JSON parsing

**Pre-computed decision:** If `decisions.yaml-transform-mode` exists in `<bgsd-context>`, use its `.value`:
- `"yq"` → Prefer `yq` for YAML extraction and mutation
- `"node"` → Use node-based YAML handling

**Pre-computed decision:** If `decisions.text-replace-mode` exists in `<bgsd-context>`, use its `.value`:
- `"sd"` → Prefer `sd` for straightforward multi-file text replacement
- `"node"` → Use node or file-edit tools for replacements

**Pre-computed decision:** If `decisions.benchmark-mode` exists in `<bgsd-context>`, use its `.value`:
- `"hyperfine"` → Prefer `hyperfine` when comparing command speed or validating faster execution paths
- `"node"` → Use manual timing only when benchmarking CLI support is absent

Include the resolved tool guidance in the executor Task() prompt context as a brief "Preferred tools" line. Favor `fd` + `rg` + `xargs` for broad repo scans, `sg` for structural code search, `jq`/`yq` for structured data transforms, `sd` for direct text replacement, and `hyperfine` for performance comparisons. Do not duplicate full tool_availability — agents receive their own bgsd-context injection with complete details. This guidance applies to the executor spawn prompts in Patterns A/B/C.
</step>
<!-- /section -->

<!-- section: identify_plan -->
<step name="identify_plan">
Find first PLAN without matching SUMMARY. Decimal phases supported (`01.1-hotfix/`).

Yolo: auto-approve → parse_segments. Interactive: present, wait for confirmation.
</step>
<!-- /section -->

<step name="record_start_time">
```bash
PLAN_START_TIME=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
PLAN_START_EPOCH=$(date +%s)
```
</step>

<!-- section: context_budget -->
<step name="context_budget_check">
**Pre-computed decision:** If `decisions.context-budget-gate` in `<bgsd-context>`, use `.value` (proceed/warn/stop). Skip CLI below.

**Fallback:**
```bash
BUDGET=$(node __OPENCODE_CONFIG__/bgsd-oc/bin/bgsd-tools.cjs verify:context-budget "${PLAN_PATH}" 2>/dev/null)
```

If `warning` truthy: yolo → log and continue. Interactive → ask proceed/stop.
</step>
<!-- /section -->

<!-- section: parse_segments -->
<step name="parse_segments">
**Pre-computed decision:** If `decisions.execution-pattern` in `<bgsd-context>`, use `.value` (A/B/C). Skip grep below.

**Fallback:**
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
<!-- /section -->

<step name="init_agent_tracking">
```bash
if [ ! -f .planning/agent-history.json ]; then
  echo '{"version":"1.0","max_entries":50,"entries":[]}' > .planning/agent-history.json
fi
```

On spawn: write agent_id to `current-agent-id.txt`, append to history. On completion: update status, delete current-agent-id.txt. Run for Pattern A/B. Skip for C.
</step>

<step name="segment_execution">
Pattern B only. Per segment: subagent for auto tasks, main for checkpoints. After ALL segments: aggregate → SUMMARY → commit → self-check.

<!-- classifyHandoffIfNeeded: if agent reports failure with this error → runtime bug; spot-check; if pass → treat as success -->
</step>

<step name="load_prompt">
Read PLAN.md — this IS the execution instructions. If plan references CONTEXT.md: honor throughout.

**Pre-computed decision:** If `decisions.previous-check-gate` in `<bgsd-context>`, use `.value` (proceed/warn/block). Else: if previous SUMMARY has unresolved issues/blockers, ask proceed/address/review.
</step>

<!-- section: execute -->
<step name="execute">
1. Read @context files
2. Per task: `type="auto"` → implement, verify, commit. `type="checkpoint:*"` → STOP, wait for user.

<!-- section: tdd_execution if="is_tdd" -->
   If `tdd="true"`: load <skill:tdd-execution section="executor" /> as the canonical TDD contract and follow its RED→GREEN→REFACTOR vocabulary, exact declared target commands, targeted-only GREEN/REFACTOR default, `execute:tdd` command names, and structured proof artifacts.
<!-- /section -->

<!-- section: auto_test if="has_test_command" -->
3. **Auto-test policy:**
   - TDD tasks still use the canonical `tdd-execution` skill plus `tdd.md` workflow steps; keep those checks mandatory.
   - For non-TDD `type="auto"` tasks, treat the task's `<verify>` command as the primary validation after implementation.
   - If the discovered project test command is a broad suite (`npm test`, `pnpm test`, `yarn test`, `bun test`, `pytest`, `go test ./...`, `cargo test`), do NOT run it after each logical file change.
   - `verification-route = skip` -> rely on explicit task `<verify>` and plan `<verification>` only; no extra broad-suite reruns.
   - `verification-route = light` -> prefer focused commands scoped to the touched behavior or files when available (for example `npm test -- tests/foo.test.cjs` or `npm run test:file -- tests/foo.test.cjs`).
   - `verification-route = full` -> reserve one broad project regression command for the end of plan execution or the overall `<verification>` block, never per edit.
<!-- /section -->

4. Run `<verification>` checks
5. Confirm `<success_criteria>` met
6. Document deviations
</step>
<!-- /section -->

<!-- section: deviation_rules -->
<skill:deviation-rules section="executor" />
<!-- /section -->

<!-- section: task_commit -->
<skill:commit-protocol />

After committing task work, save bookmark:
```bash
node __OPENCODE_CONFIG__/bgsd-oc/bin/bgsd-tools.cjs util:memory write --store bookmarks --entry '{"phase":"${PHASE}","plan":"${PLAN}","task":${TASK_NUM},"total_tasks":${TOTAL_TASKS},"git_head":"'$(jj log -r @- --no-graph -T 'commit_id.shortest(8)')'"}'
```
<!-- /section -->

<!-- section: checkpoint_protocol -->
<skill:checkpoint-protocol />

<step name="checkpoint_return_for_orchestrator">
When spawned via Task: return completed tasks table (hashes + files), current task (blocker), checkpoint details, what's awaited.
</step>
<!-- /section -->

<!-- section: verification_gate -->
<step name="verification_failure_gate">
If verification fails: STOP. Options: Retry | Skip (mark incomplete) | Stop.
</step>
<!-- /section -->

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

<!-- section: post_execution if="verifier_enabled" -->
<step name="post_execution_review">
Skip if: `gap_closure: true`, has checkpoints (Pattern B/C), review context unavailable, or bundle over budget.

```bash
REVIEW_CTX=$(node __OPENCODE_CONFIG__/bgsd-oc/bin/bgsd-tools.cjs verify:review ${PHASE_NUM} ${PLAN_NUM} --raw 2>/dev/null)
```

If review context available: load `references/reviewer-agent.md`, review changed files, produce findings JSON. Store for SUMMARY — `approved`: note only. `changes_requested`: list blockers (do NOT auto-fix). `info_only`: note for awareness. Review is NON-BLOCKING.
</step>
<!-- /section -->

<!-- section: create_summary -->
<step name="create_summary">
```bash
SCAFFOLD=$(node __OPENCODE_CONFIG__/bgsd-oc/bin/bgsd-tools.cjs util:summary-generate ${PHASE_NUM} ${PLAN_NUM} --raw 2>/dev/null)
```

If error/failed: warn "⚠ summary:generate failed — falling back to full authorship" and use templates/summary.md.

If succeeded: read generated SUMMARY.md, fill TODO sections: `one-liner:`, `key-decisions:`, `patterns-established:`, Accomplishments, Decisions Made, Deviations, Issues Encountered, Next Phase Readiness.

For `type: tdd` plans, also complete the `## TDD Audit Trail` section with exact target commands, exit status, matched evidence, and the resulting `test(...)`, `feat(...)`, and `refactor(...)` commits. Treat REFACTOR proof as required evidence when a refactor commit exists.

If post_execution_review had findings, add Review Findings section. If no review: omit.
</step>
<!-- /section -->

<!-- section: update_position -->
<step name="update_current_position">
```bash
node __OPENCODE_CONFIG__/bgsd-oc/bin/bgsd-tools.cjs verify:state complete-plan \
  --phase "${PHASE}" --plan "${PLAN}" --duration "${DURATION}" \
  --tasks "${TASK_COUNT}" --files "${FILE_COUNT}" \
  --decision-summary "${DECISION_TEXT}" --decision-rationale "${RATIONALE}" \
  --stopped-at "Completed ${PHASE}-${PLAN}-PLAN.md" --resume-file "None"
```

This repaired completion path must read back and repair stale STATE summary fields (current plan, total plans, current focus, status/progress text) so final metadata matches the active plan rather than ambient workspace noise.

If SUMMARY issues ≠ "None": yolo → log. Interactive → present, wait.
</step>
<!-- /section -->

<!-- section: update_roadmap -->
<step name="update_roadmap">
```bash
node __OPENCODE_CONFIG__/bgsd-oc/bin/bgsd-tools.cjs plan:roadmap update-plan-progress "${PHASE}"
node __OPENCODE_CONFIG__/bgsd-oc/bin/bgsd-tools.cjs plan:requirements mark-complete ${REQ_IDS}
```
Read back and repair stale STATE or ROADMAP summary fields before final metadata success is reported.
Extract `requirements:` from plan frontmatter. Skip if absent.
</step>
<!-- /section -->

<step name="git_commit_metadata">
```bash
node __OPENCODE_CONFIG__/bgsd-oc/bin/bgsd-tools.cjs execute:commit "docs({phase}-{plan}): complete [plan-name] plan" --files .planning/phases/XX-name/{phase}-{plan}-SUMMARY.md .planning/STATE.md .planning/ROADMAP.md .planning/REQUIREMENTS.md
```
</step>

<step name="update_codebase_map">
If .planning/codebase/ exists: check structural changes (new dirs, deps, patterns, APIs, config). Update relevant map files, amend commit. Skip for code-only/bugfix changes.
</step>

<!-- section: offer_next -->
<step name="offer_next">
If USER_SETUP_CREATED: display warning at TOP.

| summaries < plans | More plans: find next, yolo auto-continue |
| summaries = plans, not last phase | Phase done: suggest plan-phase/verify-work |
| summaries = plans, last phase | Milestone done: suggest complete-milestone |
</step>
<!-- /section -->

</process>

<!-- section: success_criteria -->
<success_criteria>
- All tasks completed, all verifications pass
- SUMMARY.md created with substantive content
- STATE.md updated (position, decisions, session)
- ROADMAP.md updated
- USER-SETUP.md generated if applicable
</success_criteria>
<!-- /section -->
