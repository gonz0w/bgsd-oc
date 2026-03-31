<purpose>
Start new milestone for existing project. Load context → gather goals → update PROJECT.md/STATE.md → optional research → define requirements → spawn roadmapper → commit.
</purpose>

<required_reading>
Read all execution_context files before starting.
</required_reading>

<skill:bgsd-context-init />

<process>

<!-- section: load_context -->
## 1. Load Context

- Read PROJECT.md (existing project, validated requirements, decisions)
- Read MILESTONES.md (what shipped previously)
- Read STATE.md (pending todos, blockers)
- Check for MILESTONE-CONTEXT.md (reference-only: created by the milestone discuss flow, not a standalone command)
- Use `init:new-milestone` lesson snapshot fields as the frozen milestone baseline when available (`lesson_snapshot_path`, `remediation_summary`, `remediation_buckets`) instead of rediscovering live lesson history.
<!-- /section -->

<!-- section: gather_goals -->
## 2. Gather Milestone Goals

**If MILESTONE-CONTEXT.md exists:** Use features/scope from discuss-milestone; present summary for confirmation.

**If no context file:** Present last milestone's shipped features. Use questionTemplate('new-milestone-goals', 'EXPLORATION') to explore features, priorities, constraints, scope.
<!-- /section -->

<!-- section: determine_version -->
## 3. Determine Milestone Version

Parse last version from MILESTONES.md. Suggest next version (v1.0 → v1.1, or v2.0 for major). Use questionTemplate('new-milestone-version', 'BINARY') to confirm with user.
<!-- /section -->

<!-- section: update_project -->
## 4. Update PROJECT.md

Add/update:
```markdown
## Current Milestone: v[X.Y] [Name]

**Goal:** [One sentence]
**Target features:**
- [Feature 1]
- [Feature 2]
```

Update Active requirements section and "Last updated" footer.
<!-- /section -->

<!-- section: review_intent -->
## 4.5. Review Project Intent and Refresh Milestone Intent

**If INTENT.md does NOT exist:** Ask Q1-Q4 (Objective, Desired Outcomes, Success Criteria, Constraints), create INTENT.md as the enduring project intent, commit.

**If INTENT.md exists:**
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 bGSD ► REVIEWING PROJECT INTENT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

```bash
node __OPENCODE_CONFIG__/bgsd-oc/bin/bgsd-tools.cjs plan:intent show
```

Ask only whether the enduring project north star changed: objective still valid? durable outcomes complete/new? success criteria updated? constraints changed? Apply changes with `--reason` flag only for true project-level intent changes. Commit if changed.

```bash
node __OPENCODE_CONFIG__/bgsd-oc/bin/bgsd-tools.cjs execute:commit "docs: evolve intent for milestone v[X.Y]" --files .planning/INTENT.md
```

After reviewing project intent, create or refresh `.planning/MILESTONE-INTENT.md` using `templates/MILESTONE-INTENT.md` as the single owned home for milestone-specific why-now strategy, targeted outcomes, priorities, and non-goals.

Do **not** evolve `.planning/INTENT.md` just to capture temporary milestone focus, milestone-local priorities, or short-lived sequencing decisions.

Roadmapper inputs must distinguish the two layers explicitly:
- `.planning/INTENT.md` = project north star and durable outcomes
- `.planning/MILESTONE-INTENT.md` = current milestone strategy and boundaries

Present: `✓ Project intent reviewed for v[X.Y]: {N} modifications` or `✓ Project intent unchanged — carrying forward to v[X.Y]`
Present: `✓ Milestone intent refreshed for v[X.Y]` once `.planning/MILESTONE-INTENT.md` is written.
<!-- /section -->

<!-- section: update_state -->
## 5. Update STATE.md

Set current position to: Phase not started, Status: Defining requirements. Keep Accumulated Context from previous milestone.
<!-- /section -->

<!-- section: cleanup_commit -->
## 6. Cleanup and Commit

Delete MILESTONE-CONTEXT.md if exists (consumed).

```bash
node __OPENCODE_CONFIG__/bgsd-oc/bin/bgsd-tools.cjs execute:commit "docs: start milestone v[X.Y] [Name]" --files .planning/PROJECT.md .planning/STATE.md .planning/MILESTONE-INTENT.md
```
<!-- /section -->

<!-- section: resolve_models -->
## 7. Load Context and Resolve Models

Extract from `<bgsd-context>` JSON: `researcher_model`, `synthesizer_model`, `roadmapper_model`, `commit_docs`, `research_enabled`, `current_milestone`, `project_exists`, `roadmap_exists`.
<!-- /section -->

<!-- section: research -->
## 8. Research Decision

Use questionTemplate('new-milestone-research', 'SINGLE_CHOICE') to decide:
- "Research first (Recommended)" — Discover patterns, features, architecture for NEW capabilities
- "Skip research" — Go straight to requirements

```bash
# Persist choice
node __OPENCODE_CONFIG__/bgsd-oc/bin/bgsd-tools.cjs util:config-set workflow.research true   # or false
```

**If "Research first":**

```bash
mkdir -p .planning/research
```

<skill:research-pipeline context="milestone" />

**If "Skip research":** Continue to Step 9.
<!-- /section -->

<!-- section: skill_discovery -->
## 8.5. Skill Discovery (Optional)

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 bGSD ► SKILL DISCOVERY (Optional)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

```bash
SKILLS=$(node __OPENCODE_CONFIG__/bgsd-oc/bin/bgsd-tools.cjs skills:list)
```

If `.planning/research/SKILLS.md` exists, read it and present:
- currently installed project skills from `skills:list`
- top recommended skills from research, including repo URL and brief rationale

Use questionTemplate('new-milestone-skills', 'BINARY') to confirm installing the research-backed recommendations.

**If yes and research recommendations exist:** For each recommended repo URL in `SKILLS.md`, run `node __OPENCODE_CONFIG__/bgsd-oc/bin/bgsd-tools.cjs skills:install --source <url>` — security scan runs automatically.

**If yes and no research recommendations exist:** Fall back to manual discovery — display current skills and `https://agentskills.io`, then user provides GitHub URL(s) to install.

**If no:** Continue to Step 9.
<!-- /section -->

<!-- section: define_requirements -->
## 9. Define Requirements

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 bGSD ► DEFINING REQUIREMENTS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

Use `.planning/INTENT.md` as the enduring north star and `.planning/MILESTONE-INTENT.md` as the milestone-local strategy source. Desired outcomes come from project intent; priorities and non-goals for this milestone come from milestone intent.

Read PROJECT.md for core value, milestone goals, existing requirements. If research exists: read FEATURES.md, extract feature categories. If no research: gather requirements through conversation.
When lesson snapshot metadata is available from init, treat that frozen artifact as the milestone-scoping source of truth; do not query live lessons again for scope definition.

**Scope each category** via questionTemplate('new-milestone-scope-category', 'MULTI_CHOICE'):
- Present features by category with table stakes / differentiators
- "None for this milestone" — defer entire category

**Generate REQUIREMENTS.md:** Requirements grouped by category (checkboxes, REQ-IDs: `[CATEGORY]-[NUMBER]` format), Future Requirements, Out of Scope, Traceability.

**Quality criteria — good requirements are:** specific+testable, user-centric ("User can X"), atomic, independent.

Present full list for confirmation. If "adjust": return to scoping.

```bash
node __OPENCODE_CONFIG__/bgsd-oc/bin/bgsd-tools.cjs execute:commit "docs: define milestone v[X.Y] requirements" --files .planning/REQUIREMENTS.md
```
<!-- /section -->

<!-- section: create_roadmap -->
## 10. Create Roadmap

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 bGSD ► CREATING ROADMAP
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
◆ Spawning roadmapper...
```

Read MILESTONES.md for last phase number (continue from there).

```
Task(prompt="
<planning_context>
<files_to_read>
- .planning/PROJECT.md
- .planning/REQUIREMENTS.md
- .planning/research/SUMMARY.md (if exists)
- .planning/INTENT.md (if exists — project north star)
- .planning/MILESTONE-INTENT.md (if exists — milestone strategy)
- .planning/config.json
- .planning/MILESTONES.md
</files_to_read>
</planning_context>

<instructions>
Create roadmap for milestone v[X.Y]:
1. Start phase numbering from [N]
2. Derive phases from THIS MILESTONE's requirements only
3. Map every requirement to exactly one phase
4. Derive 2-5 success criteria per phase (observable user behaviors)
4.5. Treat project intent as the durable north star and milestone intent as the current why-now/priorities/non-goals layer
5. Validate 100% coverage
6. Write files immediately (ROADMAP.md, STATE.md, update REQUIREMENTS.md traceability)
7. Return ROADMAP CREATED with summary
</instructions>
", subagent_type="bgsd-roadmapper", model="{roadmapper_model}", description="Create roadmap")
```

**If `## ROADMAP BLOCKED`:** Present blocker, work with user, re-spawn.

**If `## ROADMAP CREATED`:** Present inline table + phase details. Ask approval via question:
- "Approve" — commit and continue
- "Adjust phases" — tell me what to change → re-spawn with revision context
- "Review full file" — show raw ROADMAP.md, re-ask

**Validate before commit:**
```bash
ROADMAP_CHECK=$(node __OPENCODE_CONFIG__/bgsd-oc/bin/bgsd-tools.cjs verify:validate roadmap --repair 2>/dev/null)
```

```bash
node __OPENCODE_CONFIG__/bgsd-oc/bin/bgsd-tools.cjs execute:commit "docs: create milestone v[X.Y] roadmap ([N] phases)" --files .planning/ROADMAP.md .planning/STATE.md .planning/REQUIREMENTS.md
```
<!-- /section -->

<!-- section: done -->
## 11. Done

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 bGSD ► MILESTONE INITIALIZED ✓
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**Milestone v[X.Y]: [Name]**

| Artifact       | Location                    |
|----------------|-----------------------------|
| Project        | `.planning/PROJECT.md`      |
| Project intent | `.planning/INTENT.md`       |
| Milestone intent | `.planning/MILESTONE-INTENT.md` |
| Research       | `.planning/research/`       |
| Requirements   | `.planning/REQUIREMENTS.md` |
| Roadmap        | `.planning/ROADMAP.md`      |

**[N] phases** | **[X] requirements** | Ready to build ✓

## ▶ Next Up

**Phase [N]: [Phase Name]** — [Goal]

`/bgsd-plan discuss [N]` — gather context and clarify approach

<sub>`/clear` first → fresh context window</sub>

Also: `/bgsd-plan phase [N]` — skip discussion, plan directly
```
<!-- /section -->

</process>

<!-- section: success_criteria -->
<success_criteria>
- [ ] PROJECT.md updated with Current Milestone section
- [ ] STATE.md reset for new milestone
- [ ] Project intent reviewed/created as enduring north star → committed (if changed)
- [ ] MILESTONE-INTENT.md created or refreshed as the milestone strategy source
- [ ] MILESTONE-CONTEXT.md consumed and deleted (if existed)
- [ ] Research completed (if selected) — 5 parallel agents, milestone-aware
- [ ] Requirements gathered and scoped per category
- [ ] REQUIREMENTS.md created with REQ-IDs
- [ ] bgsd-roadmapper spawned with phase numbering context
- [ ] Roadmap files written immediately (not draft)
- [ ] User feedback incorporated (if any)
- [ ] ROADMAP.md phases continue from previous milestone
- [ ] All commits made
- [ ] User knows next step: `/bgsd-plan discuss [N]`
</success_criteria>
<!-- /section -->
