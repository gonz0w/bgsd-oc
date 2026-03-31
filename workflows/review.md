<purpose>
Run the Phase 146 code review workflow from a single command.
</purpose>

<required_reading>
Bootstrap through `init:review` before any review-stage prompting so model selection and phase metadata come from the CLI instead of markdown guesswork.
</required_reading>

<process>

<step name="initialize" priority="first">
Parse `<bgsd-context>` JSON for: `review_model`, `verifier_model`, `commit_docs`, `phase_found`, `phase_dir`, `phase_number`, `phase_name`, `current_plan`, `plan_path`, `review_command`.

If no `<bgsd-context>` block is present, stop and tell the user: "bGSD plugin required for /bgsd-review. Install with: npx bgsd-oc".

If the plugin did not inject review-specific bootstrap data, run:
```bash
node __OPENCODE_CONFIG__/bgsd-oc/bin/bgsd-tools.cjs init:review
```
Use that result as the fallback bootstrap context.
</step>

<step name="run_deterministic_scan">
Run `review:scan` before any judgment-stage questioning or agent review. Treat the returned JSON as the deterministic source of truth for findings, summaries, ask groups, auto-fix counts, suppressed counts, scope warnings, and review target metadata.

If `review:scan` returns `needs-input`, ask the user which review target to use and rerun the scan with the chosen explicit scope.

Keep scope warnings separate from actual findings. Nearby unstaged/untracked warnings inform review completeness but do not become issues by themselves.
</step>

<step name="summarize_mechanical_results">
If auto-fixes were applied, report them as a concise summary only: count, files touched, and whether any mechanical fix degraded to ASK. Do not interrupt the workflow with a verbose patch diff.

If the scan is clean, stay quiet: brief confirmation plus any non-finding scope warning, then end without a celebratory success banner.
</step>

<step name="ask_judgment_questions">
Use `ask_groups` from `review:scan` to batch ASK findings by theme.

For each themed batch:
- show the shared theme heading and rationale;
- list each finding separately with file, line, severity, and evidence;
- collect a per-finding decision so similar items can receive different answers.

If the user leaves any ASK finding unanswered, preserve it with status `unresolved`. Unresolved items remain in the final report and do not block workflow completion.
</step>

<step name="structural_audit_stage">
Pass the surviving routed findings — not a fresh rediscovery prompt — into the judgment-stage agent for structural audit first.

The structural audit stage should evaluate architecture, correctness boundaries, and change-shape concerns using the scan JSON plus any user decisions already collected.

If review context is needed for surrounding conventions, load it through:
```bash
node __OPENCODE_CONFIG__/bgsd-oc/bin/bgsd-tools.cjs verify:review ${phase_number} ${current_plan}
```
</step>

<step name="quality_assessment_stage">
After structural audit, run a second judgment pass focused on code quality, maintainability, and readiness using the same surviving findings payload. This is a separate stage from structural audit, not a second scan.

Confidence scores remain internal. User-facing review output should describe severity, reasoning, and recommended next action without exposing numeric confidence.
</step>

<step name="final_report">
Produce a structured report ordered by severity buckets first, then finding details.

The final report must:
- stay severity-led (`BLOCKER`, `WARNING`, `INFO`);
- include concise auto-fix summary data;
- include themed ASK outcomes with unanswered items marked `unresolved`;
- distinguish incomplete-scope warnings from actual findings; and
- preserve structured data so later readiness/reporting workflows can consume the result without reclassification.
</step>

</process>

<success_criteria>
- `review:scan` runs first and remains the deterministic findings source
- ASK findings are presented in themed batches with per-finding decisions
- Unanswered ASK findings remain unresolved instead of blocking completion
- Judgment review happens in two stages: structural audit, then quality assessment
- Final reporting is severity-led, quiet on clean output, and structured for downstream reuse
</success_criteria>
