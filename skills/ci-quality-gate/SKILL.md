---
name: ci-quality-gate
description: CI quality gate spawn pattern for post-execution code scanning — checks config, displays gate header, spawns bgsd-github-ci with ci_parameters, and handles merged/checkpoint results.
type: shared
agents: [orchestrator]
sections: [ci-gate]
---

## Purpose

Provides the standard CI quality gate block shared by `execute-phase.md` and `quick.md`. After plan execution completes, this block checks whether CI is enabled, displays the gate header, spawns the `bgsd-github-ci` agent with parameterized branch and scope, and handles the result (merged vs checkpoint).

## Placeholders

| Placeholder | Description | Example |
|---|---|---|
| `{{scope}}` | Branch name component identifying what's being gated | `phase-${PHASE_NUMBER}`, `quick-${next_num}` |
| `{{base_branch}}` | Target branch for the PR | `main`, `${BASE_BRANCH:-main}` |

## Content

<!-- section: ci-gate -->
**Pre-computed decision:** If `decisions.ci-gate` exists in `<bgsd-context>`, use its `.value` (run/skip/warn). Skip CI flag evaluation below.

**Fallback** (if decisions not available):

Check `CI_FLAG` from the initialize step:
- `CI_FLAG="force"` → run CI regardless of config
- `CI_FLAG="skip"` → skip CI regardless of config
- `CI_FLAG=""` → check config:

```bash
CI_ENABLED=$(node __OPENCODE_CONFIG__/bgsd-oc/bin/bgsd-tools.cjs util:config-get workflow.ci_gate 2>/dev/null || echo "false")
```

**If CI enabled:**

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 bGSD ► CI QUALITY GATE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
◆ Pushing branch, creating PR, running code scanning...
```

```
Task(
  prompt="
Run the GitHub CI quality gate.

<ci_parameters>
BRANCH_NAME: ci/{{scope}}
BASE_BRANCH: {{base_branch}}
AUTO_MERGE: true
SCOPE: {{scope}}
</ci_parameters>

<files_to_read>
- .planning/STATE.md
- ./AGENTS.md (if exists)
</files_to_read>
",
  subagent_type="bgsd-github-ci",
  model="{executor_model}",
  description="GitHub CI: {{scope}}"
)
```

**Handle CI result:**
- `## CI COMPLETE` with `Status: merged` → continue to next step (code is now on base branch)
- `## CHECKPOINT REACHED` with `human-action` → present to user, wait for resolution, then continue
- `## CHECKPOINT REACHED` with `human-verify` → present remaining alerts, offer: 1) Dismiss and merge, 2) Abort CI (continue without merge)

**If CI disabled:** Skip silently, continue.
<!-- /section -->

## Cross-references

- `execute-phase.md` — `<step name="ci_quality_gate">` uses this block with `scope=phase-${PHASE_NUMBER}`
- `quick.md` — Step 5.25 uses this block with `scope=quick-${next_num}`
- <skill:checkpoint-protocol /> — CI checkpoint results follow the standard checkpoint handling flow

## Examples

**execute-phase usage:**
```
{{scope}} = phase-${PHASE_NUMBER}
{{base_branch}} = ${BASE_BRANCH:-main}
```

**quick.md usage:**
```
{{scope}} = quick-${next_num}
{{base_branch}} = main
```
