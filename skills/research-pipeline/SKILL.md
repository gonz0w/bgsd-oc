---
name: research-pipeline
description: Research + synthesize pipeline shared by new-milestone and new-project — 5 parallel bgsd-project-researcher spawns (Stack, Features, Architecture, Pitfalls, Skills), synthesizer spawn, and research quality scoring with retry loop.
type: shared
agents: [orchestrator]
sections: [spawn-researchers, synthesize, score]
---

## Purpose

Provides the standard 5-researcher + synthesizer pipeline used in `new-milestone.md` (Step 8) and `new-project.md` (Step 6). Each dimension researcher writes its file to `.planning/research/`, then the synthesizer aggregates into `SUMMARY.md`. After synthesis, the quality scoring loop checks confidence levels and offers re-research for LOW confidence files.

## Placeholders

| Placeholder | Description | Example |
|---|---|---|
| `{{research_context}}` | Milestone/project-specific context block injected into each researcher prompt | `SUBSEQUENT MILESTONE — Adding [features] to existing app.` |
| `{{researcher_model}}` | Model string for researcher agents | `{researcher_model}` |
| `{{roadmapper_model}}` | Model string for synthesizer agent | `{roadmapper_model}` |

## Content

<!-- section: spawn-researchers -->
```
 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  bGSD ► RESEARCHING
 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

 ◆ Spawning 5 researchers in parallel...
   → Stack, Features, Architecture, Pitfalls, Skills
```

```bash
mkdir -p .planning/research
```

Spawn 5 parallel `bgsd-project-researcher` agents using this template with dimension-specific fields:

**Common structure for all 4 researchers:**
```
Task(prompt="
<research_type>Project Research — {DIMENSION} for [new features].</research_type>

<milestone_context>
{{research_context}}
</milestone_context>

<question>{QUESTION}</question>

<files_to_read>
- .planning/PROJECT.md (Project context)
</files_to_read>

<downstream_consumer>{CONSUMER}</downstream_consumer>

<quality_gate>{GATES}</quality_gate>

<output>
Write to: .planning/research/{FILE}
Use template: __OPENCODE_CONFIG__/bgsd-oc/templates/research-project/{FILE}
</output>
", subagent_type="bgsd-project-researcher", model="{{researcher_model}}", description="{DIMENSION} research")
```

**Dimension-specific fields:**

| Field | Stack | Features | Architecture | Pitfalls | Skills |
|-------|-------|----------|--------------|----------|--------|
| QUESTION | What stack additions/changes are needed for [new features]? | How do [target features] typically work? Expected behavior? | How do [target features] integrate with existing architecture? | Common mistakes when adding [target features] to [domain]? | Which project-local AI coding skills from agentskills.io or GitHub would materially help implement [new features] in this codebase? |
| CONSUMER | Specific libraries with versions for NEW capabilities, integration points, what NOT to add | Table stakes vs differentiators vs anti-features, complexity noted, dependencies on existing | Integration points, new components, data flow changes, suggested build order | Warning signs, prevention strategy, which phase should address it | 0-5 concrete skill recommendations with repo URLs, fit rationale, when they help, and confidence; recommend none if nothing is compelling |
| GATES | Versions current (verify with Context7), rationale explains WHY, integration considered | Categories clear, complexity noted, dependencies identified | Integration points identified, new vs modified explicit, build order considers deps | Pitfalls specific to adding these features, integration pitfalls covered, prevention actionable | Each recommendation links to a real repo, clearly states why it matches this milestone, and avoids generic or low-confidence suggestions |
| FILE | STACK.md | FEATURES.md | ARCHITECTURE.md | PITFALLS.md | SKILLS.md |
<!-- /section -->

<!-- section: synthesize -->
After all 5 researchers complete, spawn synthesizer:

```
Task(prompt="
Synthesize research outputs into SUMMARY.md.

<files_to_read>
- .planning/research/STACK.md
- .planning/research/FEATURES.md
- .planning/research/ARCHITECTURE.md
- .planning/research/PITFALLS.md
- .planning/research/SKILLS.md
</files_to_read>

Write to: .planning/research/SUMMARY.md
Use template: __OPENCODE_CONFIG__/bgsd-oc/templates/research-project/SUMMARY.md
Commit after writing.
", subagent_type="bgsd-roadmapper", model="{{roadmapper_model}}", description="Synthesize research")
```

Display key findings from SUMMARY.md:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 bGSD ► RESEARCH COMPLETE ✓
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**Stack additions:** [from SUMMARY.md]
**Feature table stakes:** [from SUMMARY.md]
**Watch Out For:** [from SUMMARY.md]
**Recommended skills:** [from SUMMARY.md, if any]
```
<!-- /section -->

<!-- section: score -->
**Research Quality Profile:**

For each research file in `.planning/research/`:

```bash
SCORE=$(node __OPENCODE_CONFIG__/bgsd-oc/bin/bgsd-tools.cjs research:score "$RESEARCH_FILE")
```

Display profile summary for each file:
```
  {filename}: confidence={confidence_level}, sources={source_count}, high_pct={high_confidence_pct}%, age={oldest_source_days}d, official_docs={has_official_docs}
```

If any file has `confidence_level: "LOW"`:

```
  LOW confidence: {filename} — {flagged_gaps count matching HIGH or MEDIUM severity} gaps detected
  Gaps (HIGH/MEDIUM only):
  - {gap.gap} ({gap.severity}) — {gap.suggestion}
  
  Re-research this file? (y/N)
```

Filter: only show gaps where `severity` is `HIGH` or `MEDIUM` — suppress `LOW` severity gaps.

If conflicts detected (`conflicts.length > 0`):
```
  Conflicts detected in {filename}:
  - "{claim}" — {source_a} vs {source_b}
```

If user chooses "yes" for re-research: re-spawn researcher for that dimension with gap context.
If "no" (default): continue — non-blocking.
<!-- /section -->

## Cross-references

- `new-milestone.md` — Step 8 uses this pipeline with `{{research_context}}` set to the subsequent-milestone context block
- `new-project.md` — Step 6 uses this pipeline with `{{research_context}}` set to the greenfield/new-project context block
- `research:score` CLI command — powers the quality scoring loop

## Examples

**new-milestone.md research_context:**
```
SUBSEQUENT MILESTONE — Adding [target features] to existing app.
{EXISTING_CONTEXT}
Focus ONLY on what's needed for the NEW features.
```

**new-project.md research_context:**
```
GREENFIELD PROJECT — Building [domain] from scratch.
Focus on standard 2025 practices for this domain.
```
