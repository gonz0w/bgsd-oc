<purpose>
Run the Phase 147 security audit workflow from a single command.
</purpose>

<required_reading>
Bootstrap through `init:security` before any security-stage prompting so model selection, phase metadata, and report destinations come from the CLI instead of markdown guesswork.
</required_reading>

<process>

<step name="initialize" priority="first">
Parse `<bgsd-context>` JSON for: `workflow_model`, `verifier_model`, `commit_docs`, `phase_found`, `phase_dir`, `phase_number`, `phase_name`, `current_plan`, `plan_path`, `workflow_path`, `security_command`, `report_path`, `exclusions_path`.

If no `<bgsd-context>` block is present, stop and tell the user: "bGSD plugin required for /bgsd-security. Install with: npx bgsd-oc".

If the plugin did not inject security-specific bootstrap data, run:
```bash
node __OPENCODE_CONFIG__/bgsd-oc/bin/bgsd-tools.cjs init:security
```
Use that result as the fallback bootstrap context.
</step>

<step name="run_deterministic_scan">
Run `security:scan` before any verifier assessment or user-facing summary. Treat the returned JSON as the deterministic source of truth for findings, suppressed items, warnings, exclusions, and machine-readable report metadata.

If `security:scan` returns a clean result above the configured confidence gate, stay quiet: brief confirmation plus any warning, then end without a celebratory success banner.
</step>

<step name="verify_surviving_findings">
Pass surviving findings from `security:scan` into the verifier stage for independent assessment rather than rediscovering vulnerabilities in prompt space.

For each surfaced finding:
- preserve the original scanner evidence and rationale;
- independently verify the finding strength, especially medium-confidence results;
- keep findings that cannot be strengthened explicitly labeled as medium-confidence with rationale; and
- do not silently upgrade or suppress findings just because the verifier is uncertain.
</step>

<step name="exclusion_guidance">
If a finding appears intentional or low-value after assessment, suggest only finding-level exclusions using exact rule/path (and fingerprint when available). Do not recommend broad rule-wide or project-wide suppressions.
</step>

<step name="final_report">
Produce a structured report ordered by severity first, then finding details.

The final report must:
- stay severity-led (`BLOCKER`, `WARNING`, `INFO`);
- preserve explicit confidence labeling in user-facing output;
- distinguish scanner warnings from verified findings;
- include concise rationale and concrete next-step guidance for each surfaced finding;
- include narrow exclusion suggestions only for the specific findings that warrant them; and
- preserve structured output so later readiness/reporting workflows can consume the result without reclassification.
</step>

</process>

<success_criteria>
- `security:scan` runs first and remains the deterministic findings source
- Surviving findings receive independent verifier assessment instead of prompt-space rediscovery
- Medium-confidence findings stay explicitly labeled when evidence cannot be strengthened
- Exclusion guidance remains finding-specific and auditable
- Final reporting is severity-led, confidence-explicit, quiet on clean output, and reusable downstream
</success_criteria>
