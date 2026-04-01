<purpose>
Configure bGSD workflow behavior through one project-default-first settings flow. Update `.planning/config.json` with the selected shared profile, the concrete models behind `quality` / `balanced` / `budget`, optional sparse agent overrides, and the existing workflow toggles. Optionally save the same contract as global defaults in `~/.gsd/defaults.json`.
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

Parse current values (using shipped defaults when missing):
- `workflow.research` — spawn researcher during plan-phase
- `workflow.plan_check` — spawn plan checker during plan-phase
- `workflow.verifier` — spawn verifier during execute-phase
- `workflow.auto_advance` — chain discuss → plan → execute automatically
- `model_settings.default_profile` — the selected project profile (default: `balanced`)
- `model_settings.profiles.quality.model` — highest-quality concrete model (default: `gpt-5.4`)
- `model_settings.profiles.balanced.model` — everyday concrete model (default: `gpt-5.4-mini`)
- `model_settings.profiles.budget.model` — fastest / lowest-cost concrete model (default: `gpt-5.4-nano`)
- `model_settings.agent_overrides` — sparse direct agent exceptions keyed by canonical agent id
- `git.branching_strategy` — branching approach (default: `"none"`)
</step>

<step name="present_settings">
Lead with the selected project default profile, then collect the concrete models behind each built-in profile, then offer optional sparse overrides, then the workflow toggles.

Use a profile picker with the current default pre-selected:

```
let qtModel = questionTemplate('settings-model-profile', 'SINGLE_CHOICE');
let qtResearcher = questionTemplate('settings-plan-researcher', 'BINARY');
let qtChecker = questionTemplate('settings-plan-checker', 'BINARY');
let qtVerifier = questionTemplate('settings-execution-verifier', 'BINARY');
let qtAuto = questionTemplate('settings-auto-advance', 'BINARY');
let qtBranching = questionTemplate('settings-branching-strategy', 'SINGLE_CHOICE');

question([
  {
    question: "Which shared profile should this project use by default?",
    header: "Project Default",
    multiSelect: false,
    options: qtModel.options
  }
])
```

Then ask for three concrete model ids with the current values prefilled:

- `quality` — best reasoning / review quality
- `balanced` — recommended day-to-day default
- `budget` — fastest / lowest-cost option

Seed new projects with these defaults unless the user changes them:

```json
{
  "quality": { "model": "gpt-5.4" },
  "balanced": { "model": "gpt-5.4-mini" },
  "budget": { "model": "gpt-5.4-nano" }
}
```

After profile definitions, offer optional sparse agent overrides as an advanced step.

- Explain that the normal path is “no overrides”
- Accept canonical agent ids such as `bgsd-executor`
- Store each override as a direct concrete model id such as `ollama/qwen3-coder:latest`
- If the user leaves overrides empty, keep `model_settings.agent_overrides` empty

Finally, ask the existing workflow + git questions:

```
question([
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
  "model_settings": {
    "default_profile": "quality" | "balanced" | "budget",
    "profiles": {
      "quality": { "model": "gpt-5.4" | "<user value>" },
      "balanced": { "model": "gpt-5.4-mini" | "<user value>" },
      "budget": { "model": "gpt-5.4-nano" | "<user value>" }
    },
    "agent_overrides": {
      "bgsd-executor": "ollama/qwen3-coder:latest"
    }
  },
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

Do not teach `model_profile`, `model_profiles`, `model_overrides`, or Anthropic tier names as the preferred user-facing contract. If compatibility fields still exist internally, keep them out of this UX.
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
  "model_settings": {
    "default_profile": <current>,
    "profiles": <current>,
    "agent_overrides": <current>
  },
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
| Project Default      | {quality/balanced/budget} |
| Quality Model        | {gpt-5.4 or user value} |
| Balanced Model       | {gpt-5.4-mini or user value} |
| Budget Model         | {gpt-5.4-nano or user value} |
| Agent Overrides      | {None / N overrides} |
| Plan Researcher      | {On/Off} |
| Plan Checker         | {On/Off} |
| Execution Verifier   | {On/Off} |
| Auto-Advance         | {On/Off} |
| Git Branching        | {None/Per Phase/Per Milestone} |
| Saved as Defaults    | {Yes/No} |

These settings apply to future /bgsd-plan phase and /bgsd-execute-phase runs.

Quick commands:
- /bgsd-settings profile <profile> — switch the selected project profile
- /bgsd-plan phase <phase> --research — force research
- /bgsd-plan phase <phase> --skip-research — skip research
- /bgsd-plan phase <phase> --skip-verify — skip plan check
```
</step>

</process>

<success_criteria>
- [ ] Current config read
- [ ] User guided through selected profile -> profile definitions -> optional overrides -> workflow toggles
- [ ] Config updated with `model_settings`, `workflow`, and `git` sections
- [ ] User offered to save as global defaults (~/.gsd/defaults.json)
- [ ] Changes confirmed to user
</success_criteria>
