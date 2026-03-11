---
name: raci
description: Agent responsibility matrix and handoff contracts — which agent owns each lifecycle step, what artifacts pass between agents, required sections in handoff documents, and how receiving agents consume them.
type: shared
agents: [planner, executor, verifier, debugger, roadmapper, project-researcher, phase-researcher, codebase-mapper, plan-checker, github-ci]
sections: [matrix, handoff-contracts, coverage-summary]
---

## Purpose

Defines clear ownership boundaries: each lifecycle step has exactly ONE Responsible agent. When agents hand off work, they produce artifacts with required sections that the receiving agent expects. Eliminates ambiguity about "whose job is this?" and ensures handoff artifacts contain everything the next agent needs.

## Placeholders

| Placeholder | Description | Example |
|-------------|-------------|---------|
| (none) | This skill uses no placeholders | — |

## Content

<!-- section: matrix -->
### RACI Matrix

| Step | Responsible (R) | Accountable (A) | Consulted (C) |
|------|----------------|-----------------|---------------|
| project-init | roadmapper | /bgsd-new-project | project-researcher |
| intent-capture | User | /bgsd-new-project | — |
| project-research | project-researcher | /bgsd-new-project | — |
| roadmap-creation | roadmapper | /bgsd-new-project | project-researcher |
| phase-discussion | User | /bgsd-discuss-phase | — |
| phase-research | phase-researcher | /bgsd-plan-phase | — |
| plan-creation | planner | /bgsd-plan-phase | phase-researcher, codebase-mapper |
| plan-checking | plan-checker | /bgsd-plan-phase | planner |
| plan-revision | planner | /bgsd-plan-phase | plan-checker |
| execution-dispatch | User | /bgsd-execute-phase | — |
| task-execution | executor | /bgsd-execute-phase | codebase-mapper |
| commit-management | executor | /bgsd-execute-phase | — |
| checkpoint-handling | User | /bgsd-execute-phase | executor |
| deviation-handling | executor | /bgsd-execute-phase | — |
| post-execution-review | reviewer-agent | /bgsd-execute-phase | executor |
| phase-verification | verifier | /bgsd-verify-work | executor |
| milestone-audit | verifier | /bgsd-audit-milestone | — |
| codebase-mapping | codebase-mapper | /bgsd-map-codebase | — |
| debug-investigation | debugger | /bgsd-debug | User |
| gap-diagnosis | debugger | /bgsd-verify-work | — |
| gap-closure-planning | planner | /bgsd-plan-phase --gaps | verifier, debugger |
| progress-reporting | executor | /bgsd-progress | — |
| state-management | executor | /bgsd-execute-phase | — |

**Rules:** Each step has exactly ONE Responsible agent. Zero dual-R assignments.
<!-- /section -->

<!-- section: handoff-contracts -->
### Key Handoff Contracts

**Researcher → Roadmapper:** `.planning/research/SUMMARY.md` with Executive Summary, Key Findings, Implications for Roadmap, Confidence Assessment, Gaps to Address.

**Roadmapper → Planner:** `ROADMAP.md` with phase details (Goal, Depends on, Requirements, Success Criteria, Plans) + `REQUIREMENTS.md` with requirement IDs.

**Planner → Executor:** `PLAN.md` with frontmatter (phase, plan, type, wave, depends_on, files_modified, autonomous, requirements, must_haves) + XML tasks with name, files, action, verify, done.

**Executor → Verifier:** `SUMMARY.md` with frontmatter (phase, plan, subsystem, tags, requires, provides, affects, tech-stack, key-files, key-decisions, duration, completed) + Performance, Accomplishments, Task Commits, Files, Decisions, Deviations, Issues.

**Verifier → Planner (gap closure):** `VERIFICATION.md` with `status: gaps_found` and `gaps:` array containing truth, status, reason, artifacts, missing items.

**User → Planner (discuss):** `CONTEXT.md` with Implementation Decisions (locked), Agent's Discretion, Deferred Ideas (out of scope).

### Handoff Contract Verification

Each agent-to-agent handoff includes structured context transfer with preconditions verified before transfer completes. Use `verify:agents --verify --from <agent> --to <agent>` to check preconditions.

**Precondition Types:**
- `context_exists`: Required context blocks present in handoff
- `artifacts_exist`: Required files exist
- `state_valid`: Project in correct state for handoff
- `dependencies_met`: Prerequisite tasks complete

**Available Contracts (via verify:agents --contracts):**
- planner-executor: plan_valid, tasks_defined, files_modified_specified
- executor-verifier: summary_exists, commits_recorded
- verifier-planner: verification_done, gaps_identified
- phase-researcher-roadmapper: research_complete
- roadmapper-planner: roadmap_exists, requirements_defined
- planner-plan-checker: plan_structure_valid
- executor-debugger: blocker_documented
- codebase-mapper-planner: analysis_complete
- project-researcher-roadmapper: research_complete
<!-- /section -->

<!-- section: coverage-summary -->
### Agent Coverage Summary

| Agent | Primary Role | Key Outputs |
|-------|-------------|-------------|
| project-researcher | Project domain research | .planning/research/*.md |
| roadmapper | Roadmap and requirements | ROADMAP.md, STATE.md |
| phase-researcher | Phase-specific research | {phase}-RESEARCH.md |
| planner | Plan creation and revision | PLAN.md files |
| plan-checker | Plan validation | Structured issues |
| executor | Task execution, commits, state | SUMMARY.md, code commits |
| verifier | Phase/milestone verification | VERIFICATION.md |
| codebase-mapper | Codebase analysis | .planning/codebase/*.md |
| debugger | Bug investigation | .planning/debug/*.md |
<!-- /section -->

## Cross-references

- <skill:structured-returns /> — Return formats that agents use for handoffs

## Examples

See `references/RACI.md` for the full 291-line reference with all 12 handoff contracts documented in detail.
