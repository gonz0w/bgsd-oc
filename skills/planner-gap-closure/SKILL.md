---
name: planner-gap-closure
description: Gap closure planning methodology — creating plans from verification or UAT failures. Covers finding gap sources, parsing gap data, loading existing SUMMARYs, grouping gaps into plans, and writing gap closure PLAN.md files.
type: agent-specific
agents: [planner]
sections: [find-gaps, parse-gaps, group-and-plan, write-plan]
---

## Purpose

When verification or UAT reveals gaps (failed truths, missing artifacts, broken wiring), the planner uses this methodology to create targeted fix plans. Gap closure plans are surgical — they address specific failures rather than rebuilding features.

## Placeholders

| Placeholder | Description | Example |
|-------------|-------------|---------|
| `{{phase}}` | Current phase identifier | `01-foundation` |

## Content

<!-- section: find-gaps -->
### Finding Gap Sources

Triggered by `--gaps` flag. Use init context (from load_project_state) which provides `phase_dir`:

```bash
# Check for VERIFICATION.md (code verification gaps)
ls "$phase_dir"/*-VERIFICATION.md 2>/dev/null

# Check for UAT.md with diagnosed status (user testing gaps)
grep -l "status: diagnosed" "$phase_dir"/*-UAT.md 2>/dev/null
```
<!-- /section -->

<!-- section: parse-gaps -->
### Parsing Gaps

Each gap has:
- **truth** — The failed observable behavior
- **reason** — Why it failed
- **artifacts** — Files with issues (path + what's wrong)
- **missing** — Things to add or fix

Load existing SUMMARYs to understand what's already built. Find next plan number (if plans 01-03 exist, next is 04).
<!-- /section -->

<!-- section: group-and-plan -->
### Grouping Gaps into Plans

Group by:
- Same artifact (fixes to the same file)
- Same concern (related failures)
- Dependency order (can't wire if artifact is stub — fix stub first)

### Creating Gap Closure Tasks

```xml
<task name="{fix_description}" type="auto">
  <files>{artifact.path}</files>
  <action>
    {For each item in gap.missing:}
    - {missing item}

    Reference existing code: {from SUMMARYs}
    Gap reason: {gap.reason}
  </action>
  <verify>{How to confirm gap is closed}</verify>
  <done>{Observable truth now achievable}</done>
</task>
```
<!-- /section -->

<!-- section: write-plan -->
### Writing Gap Closure PLAN.md

```yaml
---
phase: {{phase}}
plan: NN              # Sequential after existing
type: execute
wave: 1               # Gap closures typically single wave
depends_on: []
files_modified: [...]
autonomous: true
gap_closure: true     # Flag for tracking
---
```

Gap closure plans are typically single-wave (all fixes can run independently) and fully autonomous.
<!-- /section -->

## Cross-references

- <skill:planner-task-breakdown /> — Task anatomy applies to gap closure tasks too

## Examples

See planner agent's `<gap_closure_mode>` section for the original comprehensive reference.
