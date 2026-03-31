# bGSD Command Reference

Canonical reference for the supported bGSD slash commands and CLI operations.

Preferred canonical command families:

- `/bgsd-plan ...` for planning, roadmap, gaps, and plan-scoped todo flows
- `/bgsd-inspect ...` for read-only diagnostics and search/history flows
- `/bgsd-settings ...` for configuration profile switching and config validation

Compatibility shims still exist during migration, but this reference stays canonical-first and lists the runnable commands users should follow.

---

## Slash Commands (19)

### Project Initialization

#### `/bgsd-new-project`

Initialize a new project through the full lifecycle: questioning, research, requirements, roadmap.

| Option | Description |
|--------|-------------|
| `--auto` | Automatic mode. Expects idea document via `@` reference. Collects settings in 2 rounds instead of interactive questioning. |

**Workflow:** `workflows/new-project.md`
**Agents:** gsd-project-researcher (x4), gsd-roadmapper
**Creates:** `PROJECT.md`, `INTENT.md`, `REQUIREMENTS.md`, `ROADMAP.md`, `STATE.md`, `config.json`, optionally `research/`

---

#### `/bgsd-map-codebase`

Analyze an existing codebase using 4 parallel mapper agents. Produces structured analysis documents.

| Argument | Description |
|----------|-------------|
| `[area]` | Optional focus area (e.g., "api", "auth") to narrow analysis |

**Workflow:** `workflows/map-codebase.md`
**Agents:** gsd-codebase-mapper (x4, parallel)
**Creates:** 7 documents in `.planning/codebase/`: `STACK.md`, `INTEGRATIONS.md`, `ARCHITECTURE.md`, `STRUCTURE.md`, `CONVENTIONS.md`, `TESTING.md`, `CONCERNS.md`

---

### Phase Planning

Reference-style planning-family index: `phase`, `discuss`, `research`, and `assumptions` are family labels inside `/bgsd-plan`, not runnable shorthand. Use the concrete examples in the table below when you want to execute one of these routes.

#### `/bgsd-plan`

Canonical planning family for plan preparation, planning, roadmap changes, gap planning, and plan-scoped todos.

| Sub-action | Example | Description |
|------------|---------|-------------|
| `assumptions <phase>` | `/bgsd-plan assumptions 159` | Surface planning assumptions before discussion or planning |
| `discuss <phase>` | `/bgsd-plan discuss 159` | Gather locked decisions and create `CONTEXT.md` |
| `research <phase>` | `/bgsd-plan research 159` | Run standalone deep research and create `RESEARCH.md` |
| `phase <phase> [flags]` | `/bgsd-plan phase 159 --research` | Create executable `PLAN.md` files for the phase |
| `roadmap add <description>` | `/bgsd-plan roadmap add "Add export functionality"` | Append a new roadmap phase |
| `roadmap insert <after> <description>` | `/bgsd-plan roadmap insert 3 "Fix critical auth vulnerability"` | Insert a decimal phase after an existing one |
| `roadmap remove <phase>` | `/bgsd-plan roadmap remove 7` | Remove an unstarted future phase |
| `gaps <phase-or-context>` | `/bgsd-plan gaps 159` | Create gap-closure plans for the requested phase or active milestone context |
| `todo add <description>` | `/bgsd-plan todo add "Fix the edge case in user validation"` | Capture a plan-scoped todo |
| `todo check [area]` | `/bgsd-plan todo check auth` | Review pending plan-scoped todos |

**Planning flags:** `/bgsd-plan phase 159 --auto`, `/bgsd-plan phase 159 --skip-verify`, `/bgsd-plan phase 159 --skip-research`

**Workflows:** `workflows/list-phase-assumptions.md`, `workflows/discuss-phase.md`, `workflows/research-phase.md`, `workflows/plan-phase.md`, `workflows/add-phase.md`, `workflows/insert-phase.md`, `workflows/remove-phase.md`, `workflows/plan-milestone-gaps.md`, `workflows/add-todo.md`, `workflows/check-todos.md`

---

### Execution

#### `/bgsd-execute-phase`

Execute all plans in a phase with wave-based parallel execution.

| Argument | Description |
|----------|-------------|
| `<phase>` | Phase number to execute |
| `--gaps-only` | Only execute gap closure plans (from UAT) |

**Workflow:** `workflows/execute-phase.md`
**Agents:** gsd-executor (per plan), gsd-verifier
**Creates:** `SUMMARY.md` per plan, `VERIFICATION.md` for phase

---

#### `/bgsd-quick`

Execute small ad-hoc tasks with bGSD tracking (atomic commits, state updates) but minimal ceremony.

| Argument | Description |
|----------|-------------|
| `[description]` | What to do (in natural language) |
| `--full` | Add plan-checking and verification |

**Workflow:** `workflows/quick.md`
**Agents:** gsd-planner, gsd-executor, optionally gsd-plan-checker and gsd-verifier
**Creates:** `.planning/quick/{num}-{slug}/PLAN.md`, `SUMMARY.md`

---

#### `/bgsd-github-ci`

Run the GitHub CI quality gate: push a branch, create a PR, monitor code scanning checks (CodeQL), fix true positive findings, dismiss false positives, and auto-merge when clean.

| Argument | Description |
|----------|-------------|
| `--branch <name>` | Custom branch name (default: `ci/{scope}`) |
| `--base <branch>` | Target branch for PR (default: `main`) |
| `--no-merge` | Skip auto-merge after checks pass |
| `--scope <id>` | Context identifier for naming (e.g., `phase-01`, `quick-11`) |

**Workflow:** `workflows/github-ci.md`
**Agents:** gsd-github-ci
**Integration:** Also available as an optional post-execution step in `/bgsd-execute-phase` and `/bgsd-quick` via `--ci` flag or `workflow.ci_gate` config.

---

### Roadmap Management

Preferred canonical roadmap routes: `/bgsd-plan roadmap add`, `/bgsd-plan roadmap insert`, and `/bgsd-plan roadmap remove`.

Use `/bgsd-plan roadmap ...` examples directly:

- `/bgsd-plan roadmap add "Add export functionality"`
- `/bgsd-plan roadmap insert 3 "Fix critical auth vulnerability"`
- `/bgsd-plan roadmap remove 7`

---

### Milestone Management

#### `/bgsd-new-milestone`

Start a new milestone cycle with questioning, research, requirements, and roadmap.

| Argument | Description |
|----------|-------------|
| `[name]` | Milestone name (e.g., "v1.1 Notifications") |

**Workflow:** `workflows/new-milestone.md`
**Agents:** gsd-project-researcher (x4), gsd-roadmapper

---

#### `/bgsd-complete-milestone`

Archive completed milestone, create historical record, tag release.

| Argument | Description |
|----------|-------------|
| `<version>` | Milestone version to complete |

**Workflow:** `workflows/complete-milestone.md`

---

#### `/bgsd-audit-milestone`

Audit milestone against original intent. Cross-phase integration check.

| Argument | Description |
|----------|-------------|
| `[version]` | Milestone version to audit |

**Workflow:** `workflows/audit-milestone.md`
**Agents:** gsd-verifier
**Creates:** `MILESTONE-AUDIT.md`

---

Use `/bgsd-plan gaps` for gap closure planning:

- `/bgsd-plan gaps 159` for phase-scoped gap follow-up
- `/bgsd-plan gaps` after `/bgsd-audit-milestone` when the milestone context is already active

---

### Progress, Inspection & Session

#### `/bgsd-inspect`

Canonical read-only diagnostics family for progress, traceability, search/history, and analysis flows.

Canonical route: `/bgsd-inspect progress`.
Canonical inspection route: `/bgsd-inspect health`.
Canonical route: `/bgsd-inspect search decisions <query>`.
Canonical route: `/bgsd-inspect search lessons <query>`.
Canonical route: `/bgsd-inspect trace <req-id>`.

| Sub-action | Example | Description |
|------------|---------|-------------|
| `progress` | `/bgsd-inspect progress` | Check project progress and get routed to the next action |
| `health` | `/bgsd-inspect health` | Check `.planning/` integrity without repair |
| `impact <files...>` | `/bgsd-inspect impact bin/bgsd-tools.cjs` | Show module dependencies and blast radius for one or more files |
| `trace <req-id>` | `/bgsd-inspect trace CMD-04` | Trace a requirement from `REQUIREMENTS.md` through plans to files |
| `search decisions <query>` | `/bgsd-inspect search decisions "database"` | Search recorded decisions in active and archived state |
| `search lessons <query>` | `/bgsd-inspect search lessons "auth"` | Search prior lessons in `.planning/memory/lessons.json` |
| `velocity` | `/bgsd-inspect velocity` | Show execution velocity metrics and completion forecast |
| `context-budget <phase-or-plan>` | `/bgsd-inspect context-budget 159-09` | Estimate token usage for a phase or plan file |
| `rollback-info <plan-id>` | `/bgsd-inspect rollback-info 159-08` | Show commits and the revert command for a specific plan |
| `session-diff` | `/bgsd-inspect session-diff` | Show commits since the last planning session activity |
| `validate-deps <phase>` | `/bgsd-inspect validate-deps 159` | Validate the dependency graph for a phase |

**Workflow router:** `commands/bgsd-inspect.md`

---

#### `/bgsd-resume`

Restore context from a previous session.

**Workflow:** `workflows/resume-project.md`

---

#### `/bgsd-pause`

Create a handoff file for session continuity.

**Workflow:** `workflows/pause-work.md`
**Creates:** `.continue-here.md`

---

### Verification

#### `/bgsd-verify-work`

Conversational UAT testing with gap tracking and fix plan generation.

| Argument | Description |
|----------|-------------|
| `[phase]` | Phase number to verify |

**Workflow:** `workflows/verify-work.md`
**Creates:** `{phase}-UAT.md`

---

### Debugging

#### `/bgsd-debug`

Systematic debugging with persistent state across context resets.

| Argument | Description |
|----------|-------------|
| `[description]` | Issue description. No args = resume active session. |

**Workflow:** `workflows/diagnose-issues.md`
**Agents:** gsd-debugger
**Creates:** `.planning/debug/{slug}.md`

---

### Todo Management

Preferred canonical todo routes: `/bgsd-plan todo add` and `/bgsd-plan todo check`.

Use the planning-family todo routes directly:

- `/bgsd-plan todo add "Fix the edge case in user validation"`
- `/bgsd-plan todo check auth`

**Workflow:** `workflows/add-todo.md`, `workflows/check-todos.md`
**Creates:** `.planning/todos/pending/{date}-{slug}.md`

---

### Configuration

#### `/bgsd-settings`

Canonical settings family for interactive configuration, model-profile switching, and config validation.

| Sub-action | Description |
|------------|-------------|
| `[settings args]` | Open the interactive settings workflow |
| `profile <profile>` | Switch model profile (`quality`, `balanced`, `budget`) — for example `/bgsd-settings profile quality` |
| `validate [path]` | Validate `.planning/config.json` or another config path — for example `/bgsd-settings validate .planning/config.json` |

**Workflow:** `workflows/settings.md`
**Updates:** `.planning/config.json`, optionally `~/.gsd/defaults.json`

---

### Utility

#### `/bgsd-cleanup`

Archive phase directories from completed milestones.

**Workflow:** `workflows/cleanup.md`

---

#### `/bgsd-update`

Check for and install bGSD updates via npm.

**Workflow:** `workflows/update.md`

---

#### `/bgsd-help`

Display the complete bGSD command reference.

**Workflow:** `workflows/help.md`

---

### Test Utility

#### `/bgsd-test-run`

Parse test output and apply pass/fail gating. Detects test framework (ExUnit, Go test, pytest, Node.js test runner) and reports structured results.

**Workflow:** `workflows/cmd-test-run.md`

---

## Direct CLI (`bgsd-tools.cjs`)

Run direct CLI commands with the shipped binary name:

```bash
node bin/bgsd-tools.cjs <command> [args] --raw
```

### Common executable CLI routes

These are the direct CLI commands most often used in planning, execution, validation, and settings flows:

```bash
node bin/bgsd-tools.cjs init:execute-phase 159
node bin/bgsd-tools.cjs init:plan-phase 159
node bin/bgsd-tools.cjs plan:roadmap get-phase 159
node bin/bgsd-tools.cjs plan:find-phase 159
node bin/bgsd-tools.cjs plan:requirements mark-complete CMD-05 CMD-06
node bin/bgsd-tools.cjs verify:state update-progress
node bin/bgsd-tools.cjs verify:state validate --fix
node bin/bgsd-tools.cjs verify:verify plan-structure .planning/phases/159-help-surface-command-integrity/159-03-PLAN.md
node bin/bgsd-tools.cjs util:validate-commands --raw
node bin/bgsd-tools.cjs util:config-get workflow.auto_advance
node bin/bgsd-tools.cjs lessons:list --phase 159
```

### Global flags

| Flag | Effect |
|------|--------|
| `--raw` | JSON output to stdout |
| `--verbose` | Full output |
| `--compact` | Minimal output for init-style commands |
| `--fields f1,f2` | Filter JSON to specific fields |
| `--help` / `-h` | Print help text |

When JSON output exceeds 50KB, stdout emits a temp-file reference such as `@file:/tmp/bgsd-TIMESTAMP.json`.

For lower-level command families beyond the routes above, use `node bin/bgsd-tools.cjs --help` or inspect the workflow file that owns the surface command you are following.

---

## Related Documentation

- **[Getting Started](getting-started.md)** — First project walkthrough
- **[Expert Guide](expert-guide.md)** — Full control flow and advanced patterns
- **[Architecture](architecture.md)** — Internal design
- **[Agent System](agents.md)** — All 10 agents and their roles
- **[Workflows](workflows.md)** — All 45 workflows
- **[TDD Guide](tdd.md)** — TDD execution engine
- **[Configuration](configuration.md)** — Full configuration reference
