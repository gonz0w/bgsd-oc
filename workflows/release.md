<purpose>
Run the Phase 148 release workflow from a single command.
</purpose>

<required_reading>
Bootstrap through `init:release` before any release-stage prompting so model selection, active phase metadata, release command names, and resume-state paths come from the CLI instead of markdown guesswork.
</required_reading>

<process>

<step name="initialize" priority="first">
Parse `<bgsd-context>` JSON for: `workflow_model`, `verifier_model`, `commit_docs`, `phase_found`, `phase_dir`, `phase_number`, `phase_name`, `current_plan`, `plan_path`, `workflow_path`, `release_commands`, `release_state_path`.

If no `<bgsd-context>` block is present, stop and tell the user: "bGSD plugin required for /bgsd-release. Install with: npx bgsd-oc".

If the plugin did not inject release-specific bootstrap data, run:
```bash
node __OPENCODE_CONFIG__/bgsd-oc/bin/bgsd-tools.cjs init:release
```
Use that result as the fallback bootstrap context.
</step>

<step name="run_deterministic_release_analysis">
Run the deterministic dry-run commands first:
- `release:bump`
- `release:changelog`
- optional readiness preview if the workflow wants advisory context, keeping it separate from release confirmation

Treat CLI JSON output as the source of truth for proposed version bump, changelog summary, tag name, PR title/body details, and any ambiguity or advisory metadata. Do not rediscover release facts from raw files in prompt space.
</step>

<step name="present_release_preview">
Show a dry-run preview that stays limited to the release essentials only:
- proposed version bump;
- changelog summary;
- tag name; and
- target PR details.

Do not add hidden readiness gates, extra checklists, or unrelated operational detail.
</step>

<step name="confirm_release">
Use a single explicit confirmation gate before any git mutation command runs.

If the user does not confirm, stop after the preview with no local mutations performed.
</step>

<step name="execute_release_mutations">
Only after confirmation, run the mutation steps in order using the bootstrapped command names:
- `release:tag` to apply synchronized version/changelog updates and create the annotated tag;
- `release:pr` to push release refs and open the PR when git/GitHub preflight allows it.

If `release:pr` returns a blocked result because git remote setup, gh usability, or gh authentication is missing, surface its `message`, `fix_command`, and `next_safe_command` directly. Do not invent an alternate GitHub flow.
</step>

<step name="resume_guidance">
If a mutation step stops after work has begun, read `${release_state_path}` and offer resume guidance from the next safe step rather than restarting the entire release.

Resume messaging should explain which safe steps already completed, what cleanup was performed (if any), and the exact next safe command reported by persisted release state.
</step>

<step name="github_ci_handoff">
When `release:pr` succeeds, end with explicit guidance to continue through the existing `/bgsd-github-ci` workflow using the returned branch/base/scope metadata.

Do not create a separate post-PR release automation path; reuse the repo's established github-ci contract.
</step>

</process>

<success_criteria>
- `init:release` provides workflow bootstrap context instead of hard-coded model or path assumptions
- `release:bump` and `release:changelog` run before any mutation step
- The preview stays limited to bump, changelog summary, tag name, and target PR details
- Exactly one explicit confirmation gate appears before `release:tag` or `release:pr`
- Resume guidance comes from persisted `.planning/release-state.json` state
- Successful PR completion points users to `/bgsd-github-ci` instead of a bespoke post-PR flow
</success_criteria>
