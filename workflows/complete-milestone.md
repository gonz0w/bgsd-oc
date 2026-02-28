<purpose>
Mark a shipped version as complete. Creates historical record in MILESTONES.md, evolves PROJECT.md, reorganizes ROADMAP.md, archives requirements, tags release in git.
</purpose>

<required_reading>
templates/milestone.md, templates/milestone-archive.md, .planning/ROADMAP.md, .planning/REQUIREMENTS.md, .planning/PROJECT.md
</required_reading>

<process>

<step name="verify_readiness">
```bash
ROADMAP=$(node __OPENCODE_CONFIG__/get-shit-done/bin/gsd-tools.cjs roadmap analyze)
```

Verify: all milestone phases complete (`disk_status === 'complete'`), `progress_percent` 100%.

Check REQUIREMENTS.md traceability: count total vs checked-off requirements.

Present milestone breakdown (phases, plans, requirements count).

**If requirements incomplete:** show unchecked requirements. Offer: 1) Proceed anyway (note gaps), 2) Run audit first, 3) Abort.

Yolo: auto-approve scope. Interactive: ask confirmation.
</step>

<step name="gather_stats">
```bash
git log --oneline --grep="feat(" | head -20
git diff --stat FIRST_COMMIT..LAST_COMMIT | tail -1
```
Present: phases, plans, tasks, files, LOC, timeline, git range.
</step>

<step name="extract_accomplishments">
```bash
for summary in .planning/phases/*-*/*-SUMMARY.md; do
  node __OPENCODE_CONFIG__/get-shit-done/bin/gsd-tools.cjs summary-extract "$summary" --fields one_liner | jq -r '.one_liner'
done
```
Extract 4-6 key accomplishments.
</step>

<step name="create_milestone_entry">
Created automatically by `milestone complete` CLI. Add extra details (git range, LOC) manually if needed.
</step>

<step name="evolve_project_full_review">
Read all phase summaries. Full review checklist:
1. "What This Is" accuracy — update if product changed
2. Core Value check — still right priority?
3. Requirements audit — move shipped to Validated (`✓ [Req] — v[X.Y]`), add new to Active, audit Out of Scope
4. Context update — LOC, tech stack, known issues
5. Key Decisions audit — add all milestone decisions with outcomes
6. Constraints check — any changed?

Update "Last updated" footer.
</step>

<step name="reorganize_roadmap">
Group completed milestone phases in collapsed `<details>` block. Keep active/planned phases expanded.
</step>

<step name="archive_milestone">
```bash
ARCHIVE=$(node __OPENCODE_CONFIG__/get-shit-done/bin/gsd-tools.cjs milestone complete "v[X.Y]" --name "[Name]")
```

CLI handles: milestones dir, ROADMAP archive, REQUIREMENTS archive, MILESTONES.md entry, STATE.md update.

**Phase archival:** Ask user to move phase dirs to `milestones/v[X.Y]-phases/` or keep in place.

After CLI archival, AI handles: reorganize ROADMAP.md, evolve PROJECT.md, delete original ROADMAP.md and REQUIREMENTS.md.
</step>

<step name="reorganize_roadmap_and_delete_originals">
Reorganize ROADMAP.md with milestone groupings. Delete originals:
```bash
rm .planning/ROADMAP.md
rm .planning/REQUIREMENTS.md
```
</step>

<step name="update_state">
Verify STATE.md: update Project Reference (core value, current focus), clear resolved decisions/blockers, keep open blockers.
</step>

<step name="handle_branches">
Check branching_strategy from init. If "none": skip.

If branches exist: offer squash merge / merge with history / delete / keep. Handle commit_docs stripping from staging if false.
</step>

<step name="git_tag">
```bash
git tag -a v[X.Y] -m "v[X.Y] [Name] — [accomplishments]"
```
Ask: push to remote?
</step>

<step name="git_commit_milestone">
```bash
node __OPENCODE_CONFIG__/get-shit-done/bin/gsd-tools.cjs commit "chore: complete v[X.Y] milestone" --files .planning/milestones/v[X.Y]-ROADMAP.md .planning/milestones/v[X.Y]-REQUIREMENTS.md .planning/MILESTONES.md .planning/PROJECT.md .planning/STATE.md
```
</step>

<step name="offer_next">
Present: milestone complete, what shipped, archived files, tag.
Next: `/gsd-new-milestone` (after `/clear`).
</step>

</process>

<milestone_naming>
v1.0 (MVP), v1.1/v1.2 (minor), v2.0+ (major). Names: 1-2 words.
</milestone_naming>

<what_qualifies>
Milestones for: releases, major feature sets shipped. Not for: every phase, WIP, internal iterations.
Heuristic: "Is this deployed/usable/shipped?" → milestone.
</what_qualifies>

<success_criteria>
- [ ] MILESTONES.md entry with stats and accomplishments
- [ ] PROJECT.md full evolution review completed
- [ ] ROADMAP.md reorganized with milestone grouping
- [ ] Archives created (ROADMAP, REQUIREMENTS)
- [ ] Original REQUIREMENTS.md deleted
- [ ] STATE.md updated
- [ ] Git tag created
- [ ] Incomplete requirements surfaced with options
- [ ] User knows next step (/gsd-new-milestone)
</success_criteria>
