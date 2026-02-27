<purpose>
Initialize a new project: questioning → research (optional) → requirements → roadmap. One workflow from idea to ready-for-planning.
</purpose>

<required_reading>
Read all execution_context files before starting.
</required_reading>

<auto_mode>
If `--auto` flag present:
- Requires idea document (`@prd.md` or pasted text). Error if missing.
- Skip brownfield mapping (assume greenfield)
- Skip deep questioning (extract context from document)
- YOLO mode implicit; ask depth/git/agents in Step 2a
- Auto-approve requirements and roadmap
</auto_mode>

<process>

## 1. Setup

```bash
INIT=$(node /home/cam/.config/opencode/get-shit-done/bin/gsd-tools.cjs init new-project --compact)
```

Parse: `researcher_model`, `synthesizer_model`, `roadmapper_model`, `commit_docs`, `project_exists`, `needs_codebase_map`, `has_git`, `project_path`.

If `project_exists` true → error, use `/gsd-progress`.
If `has_git` false → `git init`.

## 2. Brownfield Offer

**Auto mode:** Skip to Step 4.

If `needs_codebase_map` true: ask "Map codebase first?" or "Skip mapping". If map → run `/gsd-map-codebase`, exit. Otherwise continue.

## 2a. Auto Mode Config (auto only)

YOLO implicit. Collect remaining settings in 2 rounds:

**Round 1 — Core (3 questions, no Mode):** Depth (Quick/Standard/Comprehensive), Execution (Parallel/Sequential), Git Tracking (Yes/No).

**Round 2 — Agents (4 questions):** Research (Yes/No), Plan Check (Yes/No), Verifier (Yes/No), AI Models (Balanced/Quality/Budget).

Create config.json with `mode: "yolo"`, `workflow.auto_advance: true`. Commit. Skip to Step 4.

## 3. Deep Questioning

**Auto mode:** Skip.

Ask "What do you want to build?" → follow threads → probe motivations, edges, assumptions, specifics. Consult questioning.md techniques.

When ready: ask "Create PROJECT.md?" or "Keep exploring". Loop until ready.

## 4. Write PROJECT.md

**Auto mode:** Synthesize from document, commit directly.

Write `.planning/PROJECT.md` using templates/project.md. For greenfield: requirements as hypotheses (Active). For brownfield: infer Validated from codebase map. Include Key Decisions from questioning.

```bash
mkdir -p .planning
node /home/cam/.config/opencode/get-shit-done/bin/gsd-tools.cjs commit "docs: initialize project" --files .planning/PROJECT.md
```

## 4.5. Capture Project Intent

**Auto mode:** Extract intent from the idea document — synthesize objective, desired outcomes (3-5), and success criteria (2-4) from the document's goals and requirements. Create INTENT.md directly without asking questions.

**Interactive mode:**

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 bGSD ► DEFINING INTENT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

Ask 4 guided questions to extract structured intent. Use PROJECT.md context to make questions specific to the user's project.

**Q1 — Objective:** "In one sentence, what does this project do and why does it matter?"
- Probe: "What problem does it solve? Who suffers without it?"
- Maps to: `<objective>` section

**Q2 — Desired Outcomes:** "What are the 3-5 most important things this project must achieve?"
- Probe: "If this project succeeds, what's different? What can users do that they couldn't before?"
- Prompt for prioritization: "Which of these are critical (P1), important (P2), or nice-to-have (P3)?"
- Maps to: `<outcomes>` section (format: `DO-XX [PX]: description`)

**Q3 — Success Criteria:** "How will you know this project is ready to ship?"
- Probe: "What's the minimum bar? What tests would you run to prove it works?"
- Maps to: `<criteria>` section (format: `SC-XX: measurable gate`)

**Q4 — Constraints:** "Are there any hard limits — technical, business, or timeline?"
- Probe: "Must-use technologies? Budget caps? Deadlines? Backward compatibility?"
- Maps to: `<constraints>` section

Also derive:
- `<users>` from PROJECT.md target users / audience (already captured in deep questioning)
- `<health>` metrics from success criteria where measurable numbers exist

Write INTENT.md using `intent create` with the structured data from answers:

```bash
node /home/cam/.config/opencode/get-shit-done/bin/gsd-tools.cjs intent create
```

Note: `intent create` reads from stdin when no arguments provided — pipe the structured intent data to it. Alternatively, write INTENT.md directly using the Write tool following the INTENT.md template format, then commit.

```bash
node /home/cam/.config/opencode/get-shit-done/bin/gsd-tools.cjs commit "docs: capture project intent" --files .planning/INTENT.md
```

Present intent summary:
```
✓ Intent captured:
  Objective: {truncated objective}
  Outcomes: {count} ({P1 count}×P1, {P2 count}×P2, {P3 count}×P3)
  Criteria: {count} success gates
  Constraints: {count} limits
```

## 5. Workflow Preferences

**Auto mode:** Skip (handled in 2a).

Check `~/.gsd/defaults.json` — if exists, offer to use saved defaults (skip questions).

**Round 1 — Core (4 questions):** Mode (YOLO/Interactive), Depth, Execution, Git Tracking.
**Round 2 — Agents:** Research, Plan Check, Verifier, AI Models.

Create config.json. If commit_docs=No: add `.planning/` to `.gitignore`.

```bash
node /home/cam/.config/opencode/get-shit-done/bin/gsd-tools.cjs commit "chore: add project config" --files .planning/config.json
```

## 5.5. Resolve Model Profile

Use models from init: `researcher_model`, `synthesizer_model`, `roadmapper_model`.

## 6. Research Decision

**Auto mode:** Default "Research first".

Ask: "Research domain ecosystem?" → Yes/No.

**If yes:** Create `.planning/research/`, spawn 4 parallel researchers:

```
Task(prompt="Read /home/cam/.config/opencode/agents/gsd-project-researcher.md for instructions.
Research: Stack dimension for [domain]. [greenfield|subsequent] context.
Question: What's the standard 2025 stack for [domain]?
Read: {project_path}
Write to: .planning/research/STACK.md (use template research-project/STACK.md)
", subagent_type="general", model="{researcher_model}", description="Stack research")

Task(prompt="Read /home/cam/.config/opencode/agents/gsd-project-researcher.md for instructions.
Research: Features dimension for [domain]. [greenfield|subsequent] context.
Question: What features do [domain] products have? Table stakes vs differentiating?
Read: {project_path}
Write to: .planning/research/FEATURES.md (use template research-project/FEATURES.md)
", subagent_type="general", model="{researcher_model}", description="Features research")

Task(prompt="Read /home/cam/.config/opencode/agents/gsd-project-researcher.md for instructions.
Research: Architecture dimension for [domain]. [greenfield|subsequent] context.
Question: How are [domain] systems typically structured?
Read: {project_path}
Write to: .planning/research/ARCHITECTURE.md (use template research-project/ARCHITECTURE.md)
", subagent_type="general", model="{researcher_model}", description="Architecture research")

Task(prompt="Read /home/cam/.config/opencode/agents/gsd-project-researcher.md for instructions.
Research: Pitfalls dimension for [domain]. [greenfield|subsequent] context.
Question: What do [domain] projects commonly get wrong?
Read: {project_path}
Write to: .planning/research/PITFALLS.md (use template research-project/PITFALLS.md)
", subagent_type="general", model="{researcher_model}", description="Pitfalls research")
```

Then synthesize:

```
Task(prompt="Synthesize research into SUMMARY.md.
Read: .planning/research/STACK.md, FEATURES.md, ARCHITECTURE.md, PITFALLS.md
Write to: .planning/research/SUMMARY.md (use template research-project/SUMMARY.md)
Commit after writing.
", subagent_type="gsd-research-synthesizer", model="{synthesizer_model}", description="Synthesize research")
```

Display key findings from SUMMARY.md.

**If "Skip research":** Continue to Step 7.

## 7. Define Requirements

If INTENT.md exists: Read it and use desired outcomes to seed requirement categories. Each P1/P2 outcome should map to at least one requirement.

Read PROJECT.md core value, constraints, scope. If research exists: read FEATURES.md categories.

**Auto mode:** Include all table stakes + document-mentioned features. Skip category questions, additions question, approval gate. Generate and commit directly.

**Interactive mode:**

Present features by category with table stakes/differentiators. For each category: multiSelect which features are in v1.

Ask "Any requirements research missed?" → capture additions.

Validate against Core Value from PROJECT.md.

Generate REQUIREMENTS.md: v1 requirements (checkboxes, REQ-IDs `[CATEGORY]-[NUMBER]`), v2 deferred, out of scope, traceability section.

Requirements must be specific, testable, user-centric, and atomic.

Present full list for confirmation. If "adjust" → loop.

```bash
node /home/cam/.config/opencode/get-shit-done/bin/gsd-tools.cjs commit "docs: define v1 requirements" --files .planning/REQUIREMENTS.md
```

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

Create roadmap: derive phases from requirements, map every v1 requirement, derive 2-5 success criteria per phase, validate 100% coverage. Write ROADMAP.md, STATE.md, update REQUIREMENTS.md traceability. Return ROADMAP CREATED with summary.
", subagent_type="gsd-roadmapper", model="{roadmapper_model}", description="Create roadmap")
```

If ROADMAP BLOCKED: resolve with user, re-spawn.

If ROADMAP CREATED: present inline (phases table + details).
- **Auto mode:** commit directly.
- **Interactive:** ask approve/adjust/review. If adjust → re-spawn with feedback. Loop until approved.

```bash
node /home/cam/.config/opencode/get-shit-done/bin/gsd-tools.cjs commit "docs: create roadmap ([N] phases)" --files .planning/ROADMAP.md .planning/STATE.md .planning/REQUIREMENTS.md
```

## 9. Done

Present completion: project name, artifact locations, phase/requirement counts.

**Auto mode:** Auto-advance → invoke `/gsd-discuss-phase 1 --auto`.

**Interactive:**
```
## ▶ Next Up
**Phase 1: [Name]** — [Goal]
/gsd-discuss-phase 1
```

</process>

<output>
`.planning/PROJECT.md`, `config.json`, `INTENT.md`, `research/` (if selected), `REQUIREMENTS.md`, `ROADMAP.md`, `STATE.md`
</output>

<success_criteria>
- [ ] .planning/ created, git initialized
- [ ] PROJECT.md captures full context → committed
- [ ] config.json configured → committed
- [ ] INTENT.md captures project intent (objective, outcomes, criteria) → committed
- [ ] Research completed if selected → committed
- [ ] Requirements gathered and scoped → committed
- [ ] ROADMAP.md with phases, mappings, criteria → committed
- [ ] STATE.md initialized
- [ ] User knows next step
</success_criteria>
