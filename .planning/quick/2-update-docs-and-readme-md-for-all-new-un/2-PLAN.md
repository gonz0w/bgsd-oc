---
phase: quick-2
plan: 1
type: execute
wave: 1
depends_on: []
files_modified:
  - README.md
  - docs/commands.md
  - docs/milestones.md
autonomous: true
must_haves:
  truths:
    - "README.md reflects accurate stats (716 tests, 41 slash commands)"
    - "All 41 slash commands are documented in docs/commands.md"
    - "All CLI command groups including trajectory, git, classify are documented"
    - "v7.1 milestone progress is documented in docs/milestones.md"
  artifacts:
    - path: "README.md"
      provides: "Accurate project overview with current stats"
    - path: "docs/commands.md"
      provides: "Complete reference for all 41 slash commands and CLI operations"
    - path: "docs/milestones.md"
      provides: "v7.1 trajectory engineering milestone documentation"
  key_links: []
---

<objective>
Update README.md, docs/commands.md, and docs/milestones.md to accurately reflect all features, commands, and capabilities that exist in the current codebase.

Purpose: The documentation has fallen behind — README claims 669 tests (actually 716), 32 slash commands (actually 41), and multiple CLI command groups (trajectory, git, classify, review) and 13 slash commands are undocumented.
Output: Accurate, comprehensive documentation covering all features.
</objective>

<context>
@README.md
@docs/commands.md
@docs/milestones.md
@commands/ (directory listing — 41 files)
@bin/gsd-tools.cjs (CLI help output)
</context>

<tasks>

<task type="auto">
  <name>Task 1: Update docs/commands.md with all missing slash commands and CLI operations</name>
  <files>docs/commands.md</files>
  <action>
Add the following 13 missing slash commands to docs/commands.md in appropriate sections:

**Under a new "### Utility / Analytics" section (these 11 are thin wrappers calling gsd-tools.cjs):**

1. `/gsd-velocity` — Execution velocity metrics and completion forecast. No args. Workflow: `cmd-velocity.md`.
2. `/gsd-codebase-impact` — Module dependencies and blast radius analysis. Arg: `<files...>`. Workflow: `cmd-codebase-impact.md`.
3. `/gsd-context-budget` — Token usage estimation for plan files. Arg: `[file-path]`. Workflow: `cmd-context-budget.md`.
4. `/gsd-rollback-info` — Commits and revert command for a plan. Arg: `<plan-id>`. Workflow: `cmd-rollback-info.md`.
5. `/gsd-search-decisions` — Search past decisions across STATE.md and archives. Arg: `<query>`. Workflow: `cmd-search-decisions.md`.
6. `/gsd-search-lessons` — Search completed phase lessons for patterns. Arg: `<query>`. Workflow: `cmd-search-lessons.md`.
7. `/gsd-session-diff` — Git commits since last session activity. No args. Workflow: `cmd-session-diff.md`.
8. `/gsd-test-run` — Parse test output with pass/fail gating. No args. Workflow: `cmd-test-run.md`.
9. `/gsd-trace-requirement` — Trace requirement from spec to files on disk. Arg: `<req-id>`. Workflow: `cmd-trace-requirement.md`.
10. `/gsd-validate-config` — Schema validation for config.json. No args. Workflow: `cmd-validate-config.md`.
11. `/gsd-validate-deps` — Phase dependency graph validation. Arg: `[phase]`. Workflow: `cmd-validate-deps.md`.

**Under a new "### Community" section:**
12. `/gsd-join-discord` — Display Discord invite link for the GSD community server. No args. No workflow (inline output).

**Under "### Utility" section (merge with existing):**
13. `/gsd-reapply-patches` — Reapply local modifications after a GSD update. No args. Intelligent merge of user's local changes back into new version after update.

**Add missing CLI command groups to the CLI section:**

Add `trajectory` command group:
```
gsd-tools trajectory checkpoint <name> [--scope scope] [--description text]
gsd-tools trajectory list [--scope scope] [--name name] [--limit N]
```
Description: Trajectory engineering — create named checkpoints with auto-metrics (test count, LOC delta, cyclomatic complexity). Creates git branch at trajectory/<scope>/<name>/attempt-N.

Add `git` command group:
```
gsd-tools git log [--count N] [--since D] [--until D] [--author A] [--path P]
gsd-tools git diff-summary [--from ref] [--to ref] [--path P]
gsd-tools git blame <file>
gsd-tools git branch-info
gsd-tools git rewind --ref <ref> [--confirm] [--dry-run]
gsd-tools git trajectory-branch --phase N --slug name [--push]
```
Description: Structured git intelligence with JSON output. Includes selective code rewind (protects .planning/ and root configs) and trajectory branch creation.

Add `classify` command group:
```
gsd-tools classify plan <plan-path>
gsd-tools classify phase <phase-number>
```
Description: Task complexity classification (1-5) and execution strategy recommendation.

Add `review` command group:
```
gsd-tools review <plan-path>
```
Description: Two-stage code review (spec compliance + code quality) with severity classification.

Add missing `codebase` subcommands to existing codebase group:
```
gsd-tools codebase ast <file>
gsd-tools codebase complexity [file]
gsd-tools codebase exports <file>
gsd-tools codebase repo-map [--budget N]
```

Add `mcp-profile` as alias:
```
gsd-tools mcp-profile [--window N] [--apply] [--dry-run] [--restore]
```

Update the header count from "Slash Commands (32)" to "Slash Commands (41)".

Format each new slash command entry consistently with existing entries (####, description, argument table, workflow reference).
  </action>
  <verify>Grep docs/commands.md for all 41 command names to confirm none are missing. Count "####" headers to verify 41 slash command entries.</verify>
  <done>docs/commands.md documents all 41 slash commands and all CLI command groups including trajectory, git, classify, review, and complete codebase subcommands.</done>
</task>

<task type="auto">
  <name>Task 2: Update README.md stats and command tables</name>
  <files>README.md</files>
  <action>
Update these specific items in README.md:

1. **Header stats line** (line 5): Change from:
   `**669 tests** | **Zero runtime dependencies** | **32 slash commands** | **100+ CLI operations** | **12 specialized AI agents** | **7 milestones shipped**`
   To:
   `**716 tests** | **Zero runtime dependencies** | **41 slash commands** | **100+ CLI operations** | **12 specialized AI agents** | **7 milestones shipped**`
   Note: "Zero runtime dependencies" refers to the built artifact having no node_modules — acorn is bundled. This is still accurate.

2. **Core Commands section** — Add missing commands to the tables. The existing tables only show ~16 commands. Add the utility/analytics commands and community commands. Add a new table section:

   ### Analytics & Utility

   | Command | What It Does |
   |---------|-------------|
   | `/gsd-velocity` | Execution velocity metrics and completion forecast |
   | `/gsd-codebase-impact` | Module dependencies and blast radius analysis |
   | `/gsd-context-budget` | Token usage estimation for plan files |
   | `/gsd-rollback-info` | Commits and revert command for a plan |
   | `/gsd-search-decisions` | Search past decisions across archives |
   | `/gsd-search-lessons` | Search completed phase lessons |
   | `/gsd-session-diff` | Git commits since last session activity |
   | `/gsd-test-run` | Parse test output with pass/fail gating |
   | `/gsd-trace-requirement` | Trace requirement from spec to files on disk |
   | `/gsd-validate-config` | Schema validation for config.json |
   | `/gsd-validate-deps` | Phase dependency graph validation |

   ### Roadmap Management

   | Command | What It Does |
   |---------|-------------|
   | `/gsd-add-phase` | Add a new phase to the end of the roadmap |
   | `/gsd-insert-phase` | Insert urgent work as a decimal phase (e.g., 3.1) |
   | `/gsd-remove-phase` | Remove an unstarted future phase |

   ### Todo & Community

   | Command | What It Does |
   |---------|-------------|
   | `/gsd-add-todo` | Capture an idea or task from context |
   | `/gsd-check-todos` | List pending todos, select one to work on |
   | `/gsd-join-discord` | Join the GSD Discord community |
   | `/gsd-reapply-patches` | Reapply local modifications after update |

3. **"See the Full Command Reference" link**: Update text to say "all 41 commands" instead of "all 32 commands".

4. **Documentation table**: Verify all 13 doc entries link correctly (they should, but confirm).

Do NOT change any other content — only update stats and add missing commands.
  </action>
  <verify>Grep README.md for "716 tests" and "41 slash commands" to confirm stats updated. Count command entries in tables to verify completeness.</verify>
  <done>README.md accurately reflects 716 tests, 41 slash commands, and all commands are listed in the core commands section.</done>
</task>

<task type="auto">
  <name>Task 3: Add v7.1 entry to docs/milestones.md</name>
  <files>docs/milestones.md</files>
  <action>
Add v7.1 milestone entry to docs/milestones.md:

1. **Update Summary table**: Add row for v7.1 (in-progress). Also update v7.0 plans from 16 to match actual (15 if that's the real number per STATE.md metric tables).

2. **Add v7.1 section** after the v7.0 section:

```markdown
## v7.1 Trajectory Engineering (In Progress)

**Started:** 2026-02-28 | **Phases:** 45-50 | **Plans:** 4+ completed

**Goal:** Add trajectory engineering capabilities — named checkpoints with auto-metrics, selective code rewind, and decision journaling for safe experimentation.

**What has been delivered so far:**

### Foundation (Phase 45)
- **Trajectory store** — New memory store type (`trajectories`) with auto-generated 6-char hex IDs and collision detection
- **Checkpoint command** — `gsd-tools trajectory checkpoint <name>` creates named git branch at `trajectory/<scope>/<name>/attempt-N` with automatic metrics collection (test count, LOC delta, cyclomatic complexity)
- **Selective rewind** — `gsd-tools git rewind --ref <ref>` reverts code to a checkpoint while protecting `.planning/` directory, root configs (package.json, tsconfig.json, etc.), and auto-stashes dirty working tree. Denylist approach for protected paths.
- **Trajectory branch creation** — `gsd-tools git trajectory-branch --phase N --slug name` creates branches in `gsd/trajectory/` namespace

### Checkpoint & Metrics (Phase 46)
- **Snapshot metrics collection** — Fault-tolerant collection of test count, LOC delta, and cyclomatic complexity at checkpoint time. Partial metrics if any collector fails.
- **Branch ref-only creation** — Uses `git branch` (not checkout) to preserve working tree during checkpoint
- **Trajectory list command** — `gsd-tools trajectory list` with scope/name filtering, limit control, and dual-mode output (JSON for agents, formatted for humans). Sorted newest-first.
- **Dirty tree exclusion** — Excludes `.planning/` from dirty working tree checks for consecutive checkpoints

### Upcoming
- Phase 47: Pivot — Selective Checkout & Branch Switching
- Phases 48-50: Remaining trajectory engineering features
```

Update the Total row in the summary table to include v7.1 plans.

Also update v7.0 stats if the test count (669→716) should be reflected there — no, keep v7.0 at 669 since that was accurate at ship time. The 716 reflects v7.1 additions.
  </action>
  <verify>Grep docs/milestones.md for "v7.1" and "Trajectory Engineering" to confirm the section exists. Verify the summary table has a v7.1 row.</verify>
  <done>docs/milestones.md includes v7.1 milestone with Phase 45-46 deliverables documented.</done>
</task>

</tasks>

<verification>
- `grep -c "####" docs/commands.md` should show 41+ command entries
- `grep "716 tests" README.md` returns a match
- `grep "41 slash commands" README.md` returns a match  
- `grep "v7.1" docs/milestones.md` returns matches
- `grep "trajectory" docs/commands.md` returns matches
- `grep "gsd-join-discord" docs/commands.md` returns a match
- `grep "gsd-reapply-patches" docs/commands.md` returns a match
- All 13 previously-missing slash commands now appear in docs/commands.md
</verification>

<success_criteria>
- README.md stats are accurate (716 tests, 41 slash commands)
- All 41 slash commands have entries in docs/commands.md
- All CLI command groups (including trajectory, git, classify, review) are documented
- v7.1 milestone is documented in docs/milestones.md
- No existing documentation is removed or broken
</success_criteria>

<output>
After completion, create `.planning/quick/2-update-docs-and-readme-md-for-all-new-un/2-SUMMARY.md`
</output>
