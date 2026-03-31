<!-- section: purpose -->
<purpose>
Initialize a new project: questioning → research (optional) → requirements → roadmap. Idea to ready-for-planning in one workflow.
</purpose>
<!-- /section -->

<!-- section: auto_mode -->
<auto_mode>
If `--auto` flag: requires idea document, skip brownfield/questioning, YOLO implicit, auto-approve all.
</auto_mode>
<!-- /section -->

<process>

<!-- section: setup -->
## 1. Setup

<skill:bgsd-context-init />

Parse `<bgsd-context>` JSON for: `researcher_model`, `synthesizer_model`, `roadmapper_model`, `commit_docs`, `project_exists`, `needs_codebase_map`, `has_git`, `project_path`.

If `project_exists` true → error, use `/bgsd-inspect progress`. If `has_git` false → `git init`.
<!-- /section -->

<!-- section: brownfield_check -->
## 2. Brownfield Offer

**Auto mode:** Skip to Step 4.

If `needs_codebase_map` true: offer "Map codebase?" or "Skip". If map → `/bgsd-map-codebase`, exit.
<!-- /section -->

<!-- section: auto_mode -->
## 2a. Auto Mode Config (auto only)

YOLO implicit. 2 question rounds: **Core** (Depth, Execution, Git Tracking) then **Agents** (Research, Plan Check, Verifier, AI Models). Create config.json (`mode: "yolo"`, `auto_advance: true`), commit. Skip to Step 4.
<!-- /section -->

<!-- section: questioning -->
## 3. Deep Questioning

**Auto mode:** Skip.

Ask "What do you want to build?" → follow threads → probe motivations, edges, assumptions. Consult `questioning` skill. Loop until "Create PROJECT.md?" confirmed.
<!-- /section -->

<!-- section: write_project -->
## 4. Write PROJECT.md

**Auto mode:** Synthesize from document, commit directly.

Write `.planning/PROJECT.md` (templates/project.md). Greenfield: Active requirements as hypotheses. Brownfield: infer Validated from codebase map.

```bash
mkdir -p .planning
node __OPENCODE_CONFIG__/bgsd-oc/bin/bgsd-tools.cjs execute:commit "docs: initialize project" --files .planning/PROJECT.md
```
<!-- /section -->

<!-- section: capture_intent -->
## 4.5. Capture Project Intent

**Auto mode:** Extract intent from idea document. Write INTENT.md directly.

**Interactive:** 4 guided questions (use PROJECT.md context): Q1 Objective → `<objective>`, Q2 Outcomes (P1/P2/P3) → `<outcomes>`, Q3 Criteria (measurable gates) → `<criteria>`, Q4 Constraints → `<constraints>`.

```bash
node __OPENCODE_CONFIG__/bgsd-oc/bin/bgsd-tools.cjs plan:intent create
node __OPENCODE_CONFIG__/bgsd-oc/bin/bgsd-tools.cjs execute:commit "docs: capture project intent" --files .planning/INTENT.md
```
<!-- /section -->

<!-- section: preferences -->
## 5. Workflow Preferences

**Auto mode:** Skip (handled in 2a).

Check `~/.gsd/defaults.json`. **Round 1:** Mode, Depth, Execution, Git Tracking. **Round 2:** Research, Plan Check, Verifier, AI Models. Create config.json. If commit_docs=No: `.planning/` → `.gitignore`.

```bash
node __OPENCODE_CONFIG__/bgsd-oc/bin/bgsd-tools.cjs execute:commit "chore: add project config" --files .planning/config.json
```

## 5.5. Resolve Model Profile

Use `researcher_model`, `synthesizer_model`, `roadmapper_model` from `<bgsd-context>`.
<!-- /section -->

<!-- section: research -->
## 6. Research Decision

**Auto mode:** Default "Research first". Ask: "Research domain ecosystem?" → Yes/No.

**If yes:**

<skill:research-pipeline context="new-project" />

**If no:** Continue to Step 7.
<!-- /section -->

<!-- section: define_requirements -->
## 7. Define Requirements

Use INTENT.md outcomes to seed categories (P1/P2 → ≥1 requirement). Read PROJECT.md and research FEATURES.md.

**Auto mode:** All table stakes + document features. Generate and commit directly. **Interactive:** MultiSelect by category, capture additions, validate against Core Value, approve/loop.

Generate REQUIREMENTS.md: v1 (checkboxes, `[CATEGORY]-[NUMBER]`), v2 deferred, out of scope, traceability. Requirements: specific, testable, user-centric, atomic.

```bash
node __OPENCODE_CONFIG__/bgsd-oc/bin/bgsd-tools.cjs execute:commit "docs: define v1 requirements" --files .planning/REQUIREMENTS.md
```
<!-- /section -->

<!-- section: create_roadmap -->
## 8. Create Roadmap

```
Task(prompt="
<files_to_read>
- .planning/PROJECT.md
- .planning/REQUIREMENTS.md
- .planning/research/SUMMARY.md (if exists)
- .planning/INTENT.md (if exists)
- .planning/config.json
</files_to_read>
Create roadmap: derive phases, map every v1 requirement, 2-5 success criteria per phase, 100% coverage. Write ROADMAP.md, STATE.md, update REQUIREMENTS.md traceability. Return ROADMAP CREATED.
", subagent_type="bgsd-roadmapper", model="{roadmapper_model}", description="Create roadmap")
```

ROADMAP BLOCKED → resolve, re-spawn. ROADMAP CREATED → present phases table. Auto → commit. Interactive → approve/adjust loop.

```bash
node __OPENCODE_CONFIG__/bgsd-oc/bin/bgsd-tools.cjs verify:validate roadmap --repair 2>/dev/null
node __OPENCODE_CONFIG__/bgsd-oc/bin/bgsd-tools.cjs execute:commit "docs: create roadmap ([N] phases)" --files .planning/ROADMAP.md .planning/STATE.md .planning/REQUIREMENTS.md
```
<!-- /section -->

<!-- section: done -->
## 9. Done

Present: project name, artifact locations, phase/requirement counts. **Auto:** `/bgsd-plan discuss 1 --auto`. **Interactive:** Next Up block with `/bgsd-plan discuss 1`.
<!-- /section -->

</process>

<output>`.planning/PROJECT.md`, `config.json`, `INTENT.md`, `research/` (if selected), `REQUIREMENTS.md`, `ROADMAP.md`, `STATE.md`</output>

<!-- section: success_criteria -->
<success_criteria>
- [ ] .planning/ created, git initialized
- [ ] PROJECT.md captures full context → committed
- [ ] config.json configured → committed
- [ ] INTENT.md captures project intent → committed
- [ ] Research completed if selected → committed
- [ ] Requirements gathered and scoped → committed
- [ ] ROADMAP.md with phases, mappings, criteria → committed
- [ ] STATE.md initialized
- [ ] User knows next step
</success_criteria>
<!-- /section -->
