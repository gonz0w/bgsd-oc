<purpose>
Configure bGSD workflow agents (research, plan_check, verifier) and model profile via multi-question prompt. Updates .planning/config.json. Optionally saves as global defaults (~/.gsd/defaults.json).
</purpose>

<required_reading>
Read all execution_context files before starting.
</required_reading>

<process>

<step name="ensure_and_load_config">
Ensure config exists and load current state:

```bash
node __OPENCODE_CONFIG__/bgsd-oc/bin/bgsd-tools.cjs util:config-ensure-section
INIT=$(node __OPENCODE_CONFIG__/bgsd-oc/bin/bgsd-tools.cjs verify:state load)
```

Creates `.planning/config.json` with defaults if missing and loads current config values.
</step>

<step name="read_current">
```bash
cat .planning/config.json
```

Parse current values (default to `true` if not present):
- `workflow.research` — spawn researcher during plan-phase
- `workflow.plan_check` — spawn plan checker during plan-phase
- `workflow.verifier` — spawn verifier during execute-phase
- `model_profile` — which model each agent uses (default: `balanced`)
- `git.branching_strategy` — branching approach (default: `"none"`)
</step>

<step name="present_settings">
Use question with current values pre-selected:

```
let qtModel = questionTemplate('settings-model-profile', 'SINGLE_CHOICE');
let qtResearcher = questionTemplate('settings-plan-researcher', 'BINARY');
let qtChecker = questionTemplate('settings-plan-checker', 'BINARY');
let qtVerifier = questionTemplate('settings-execution-verifier', 'BINARY');
let qtAuto = questionTemplate('settings-auto-advance', 'BINARY');
let qtBranching = questionTemplate('settings-branching-strategy', 'SINGLE_CHOICE');

question([
  {
    question: "Which model profile for agents?",
    header: "Model",
    multiSelect: false,
    options: qtModel.options
  },
  {
    question: "Spawn Plan Researcher? (researches domain before planning)",
    header: "Research",
    multiSelect: false,
    options: qtResearcher.options
  },
  {
    question: "Spawn Plan Checker? (verifies plans before execution)",
    header: "Plan Check",
    multiSelect: false,
    options: qtChecker.options
  },
  {
    question: "Spawn Execution Verifier? (verifies phase completion)",
    header: "Verifier",
    multiSelect: false,
    options: qtVerifier.options
  },
  {
    question: "Auto-advance pipeline? (discuss → plan → execute automatically)",
    header: "Auto",
    multiSelect: false,
    options: qtAuto.options
  },
  {
    question: "Git branching strategy?",
    header: "Branching",
    multiSelect: false,
    options: qtBranching.options
  }
])
```
</step>

<step name="update_config">
Merge new settings into existing config.json:

```json
{
  ...existing_config,
  "model_profile": "quality" | "balanced" | "budget",
  "workflow": {
    "research": true/false,
    "plan_check": true/false,
    "verifier": true/false,
    "auto_advance": true/false
  },
  "git": {
    "branching_strategy": "none" | "phase" | "milestone"
  }
}
```

Write updated config to `.planning/config.json`.
</step>

<step name="save_as_defaults">
Ask whether to save these settings as global defaults for future projects:

```
let qtDefaults = questionTemplate('settings-save-defaults', 'BINARY');

question([
  {
    question: "Save these as default settings for all new projects?",
    header: "Defaults",
    multiSelect: false,
    options: qtDefaults.options
  }
])
```

If "Yes": write the same config object (minus project-specific fields like `brave_search`) to `~/.gsd/defaults.json`:

```bash
mkdir -p ~/.gsd
```

Write `~/.gsd/defaults.json` with:
```json
{
  "mode": <current>,
  "depth": <current>,
  "model_profile": <current>,
  "commit_docs": <current>,
  "parallelization": <current>,
  "branching_strategy": <current>,
  "workflow": {
    "research": <current>,
    "plan_check": <current>,
    "verifier": <current>,
    "auto_advance": <current>
  }
}
```
</step>

<step name="confirm">
Display:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 bGSD ► SETTINGS UPDATED
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

| Setting              | Value |
|----------------------|-------|
| Model Profile        | {quality/balanced/budget} |
| Plan Researcher      | {On/Off} |
| Plan Checker         | {On/Off} |
| Execution Verifier   | {On/Off} |
| Auto-Advance         | {On/Off} |
| Git Branching        | {None/Per Phase/Per Milestone} |
| Saved as Defaults    | {Yes/No} |

These settings apply to future /bgsd-plan phase and /bgsd-execute-phase runs.

Quick commands:
- /bgsd-settings profile <profile> — switch model profile (`/bgsd-set-profile` remains a compatibility alias)
- /bgsd-plan phase <phase> --research — force research
- /bgsd-plan phase <phase> --skip-research — skip research
- /bgsd-plan phase <phase> --skip-verify — skip plan check
```
</step>

</process>

<success_criteria>
- [ ] Current config read
- [ ] User presented with 6 settings (profile + 4 workflow toggles + git branching)
- [ ] Config updated with model_profile, workflow, and git sections
- [ ] User offered to save as global defaults (~/.gsd/defaults.json)
- [ ] Changes confirmed to user
</success_criteria>
