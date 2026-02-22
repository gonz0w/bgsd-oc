# Codebase Structure

**Analysis Date:** 2026-02-21

## Directory Layout

```
gsd-opencode/
├── bin/                           # CLI tool (the "brain")
│   ├── gsd-tools.cjs             # Main CLI — 6,495 lines, zero dependencies
│   └── gsd-tools.test.cjs        # Test suite — 2,302 lines, node:test runner
├── workflows/                     # Orchestration prompts (32 files)
│   ├── new-project.md            # Project initialization (1,116 lines)
│   ├── execute-phase.md          # Phase execution orchestrator (430 lines)
│   ├── execute-plan.md           # Single plan execution
│   ├── plan-phase.md             # Phase planning orchestrator (426 lines)
│   ├── verify-work.md            # UAT testing workflow (569 lines)
│   ├── quick.md                  # Quick ad-hoc task workflow (453 lines)
│   ├── progress.md               # Progress report + routing (381 lines)
│   ├── resume-project.md         # Session resume workflow
│   ├── map-codebase.md           # Codebase mapping orchestrator
│   ├── research-phase.md         # Phase research workflow
│   ├── discovery-phase.md        # Phase discovery workflow
│   ├── discuss-phase.md          # Capture design decisions
│   ├── verify-phase.md           # Phase verification
│   ├── help.md                   # Command reference (486 lines)
│   ├── health.md                 # Project health check
│   ├── settings.md               # View/edit config
│   ├── set-profile.md            # Change model profile
│   ├── update.md                 # Plugin update workflow
│   ├── transition.md             # Phase transition
│   ├── complete-milestone.md     # Milestone completion
│   ├── new-milestone.md          # New milestone creation
│   ├── audit-milestone.md        # Milestone audit
│   ├── plan-milestone-gaps.md    # Gap planning for milestone
│   ├── add-phase.md              # Add phase to roadmap
│   ├── insert-phase.md           # Insert decimal phase
│   ├── remove-phase.md           # Remove phase from roadmap
│   ├── add-todo.md               # Capture todo item
│   ├── check-todos.md            # Review pending todos
│   ├── list-phase-assumptions.md # List phase assumptions
│   ├── cleanup.md                # Project cleanup
│   ├── diagnose-issues.md        # Troubleshooting
│   └── pause-work.md             # Save WIP state
├── templates/                     # Document templates (24+ files)
│   ├── config.json               # Default config.json template
│   ├── state.md                  # STATE.md template + usage guide
│   ├── roadmap.md                # ROADMAP.md template (202 lines)
│   ├── project.md                # PROJECT.md template
│   ├── requirements.md           # REQUIREMENTS.md template
│   ├── summary.md                # SUMMARY.md template (248 lines)
│   ├── summary-minimal.md        # Minimal summary variant
│   ├── summary-standard.md       # Standard summary variant
│   ├── summary-complex.md        # Complex summary variant
│   ├── research.md               # RESEARCH.md template
│   ├── discovery.md              # DISCOVERY.md template
│   ├── context.md                # CONTEXT.md template
│   ├── milestone.md              # Milestone tracking template
│   ├── milestone-archive.md      # Milestone archive template
│   ├── verification-report.md    # VERIFICATION.md template
│   ├── UAT.md                    # UAT.md template
│   ├── DEBUG.md                  # DEBUG.md template
│   ├── continue-here.md          # Session resume template
│   ├── phase-prompt.md           # Phase prompt template
│   ├── planner-subagent-prompt.md  # Planner agent spawn template
│   ├── debug-subagent-prompt.md  # Debugger agent spawn template
│   ├── user-setup.md             # First-run setup guide
│   ├── codebase/                 # Codebase mapping templates (7 files)
│   │   ├── architecture.md       # Architecture analysis template
│   │   ├── concerns.md           # Technical debt template
│   │   ├── conventions.md        # Coding conventions template
│   │   ├── integrations.md       # External integrations template
│   │   ├── stack.md              # Technology stack template
│   │   ├── structure.md          # Directory structure template
│   │   └── testing.md            # Testing patterns template
│   └── research-project/         # Research project templates (5 files)
│       ├── ARCHITECTURE.md       # Architecture research template
│       ├── FEATURES.md           # Features research template
│       ├── PITFALLS.md           # Pitfalls research template
│       ├── STACK.md              # Stack research template
│       └── SUMMARY.md            # Research summary template
├── references/                    # Behavioral rules for agents (13 files)
│   ├── ui-brand.md               # UI patterns: banners, checkpoints, symbols (160 lines)
│   ├── checkpoints.md            # Checkpoint types: human-verify, decision, action (776 lines)
│   ├── git-integration.md        # Git commit strategy and formats (248 lines)
│   ├── git-planning-commit.md    # Planning-specific commit patterns
│   ├── model-profiles.md         # Model profile definitions and resolution (92 lines)
│   ├── model-profile-resolution.md # Detailed model resolution logic
│   ├── planning-config.md        # Config schema and behavior (196 lines)
│   ├── phase-argument-parsing.md # How to parse phase arguments
│   ├── decimal-phase-calculation.md # Decimal phase numbering rules
│   ├── continuation-format.md    # Session continuation format
│   ├── verification-patterns.md  # Verification and quality patterns
│   ├── questioning.md            # Deep questioning methodology
│   └── tdd.md                    # Test-driven development patterns
├── .planning/                     # Plugin's own planning directory
│   └── codebase/                 # Codebase analysis documents
├── AGENTS.md                      # Development workspace README (91 lines)
├── VERSION                        # Plugin version: 1.20.5
└── deploy.sh                      # Deploy to ~/.config/opencode/get-shit-done/ (29 lines)
```

## Directory Purposes

**`bin/`:**
- Purpose: CLI tool executable and tests
- Contains: Single-file Node.js CLI (`gsd-tools.cjs`) and its test suite (`gsd-tools.test.cjs`)
- Key constraint: Must remain a single file with zero npm dependencies
- Key files: `gsd-tools.cjs` (6,495 lines — the entire backend logic)

**`workflows/`:**
- Purpose: Orchestration prompts that define multi-step AI agent workflows
- Contains: 32 markdown files, each defining one workflow/command
- Pattern: XML-tagged sections (`<purpose>`, `<process>`, `<step>`) with embedded shell commands calling `gsd-tools.cjs`
- Key files: `execute-phase.md` (phase execution), `plan-phase.md` (phase planning), `new-project.md` (project initialization), `quick.md` (ad-hoc tasks)

**`templates/`:**
- Purpose: Document structure definitions for all `.planning/` artifacts
- Contains: Markdown templates with placeholder patterns, a default `config.json`
- Subdirectories: `codebase/` (7 templates for codebase mapping), `research-project/` (5 templates for research output)
- Used by: Workflows via `@` file references, CLI `template fill` command

**`references/`:**
- Purpose: Behavioral rules, patterns, and guidelines that agents must follow
- Contains: 13 markdown files defining UI branding, git strategy, model profiles, checkpoint types, etc.
- Pattern: Loaded by workflows via `<required_reading>` blocks with `@` file references
- Key files: `ui-brand.md` (visual output patterns), `checkpoints.md` (interaction patterns), `git-integration.md` (commit strategy)

## Key File Locations

**Entry Points:**
- `bin/gsd-tools.cjs`: Main CLI entry point — `main()` function at line 6022, router at line 6035
- `deploy.sh`: Deployment script — copies source to `~/.config/opencode/get-shit-done/`

**Configuration:**
- `templates/config.json`: Default project configuration template (modes, gates, parallelization)
- `VERSION`: Plugin version string (currently `1.20.5`)

**Core Logic (all inside `bin/gsd-tools.cjs`):**
- Lines 130-144: `MODEL_PROFILES` — Agent-to-model mapping table
- Lines 146-487: Helpers — `loadConfig()`, `execGit()`, `extractFrontmatter()`, `output()`, `error()`
- Lines 488-1190: Atomic commands — slug, timestamp, todos, config, history
- Lines 1191-2110: State progression engine — state CRUD, metrics, decisions, blockers
- Lines 2111-2174: Web search (Brave API)
- Lines 2175-2237: Frontmatter CRUD
- Lines 2239-2530: Verification suite — 6 verify commands
- Lines 2531-3132: Roadmap analysis + phase operations (add, insert, remove)
- Lines 3133-3525: Requirements + phase complete + milestone complete
- Lines 3526-3895: Validation (consistency, health)
- Lines 3896-4058: Progress render, todo complete, scaffold
- Lines 4059-5010: Compound init commands (12 workflows)
- Lines 5012-6018: Extended features (15 additional commands)
- Lines 6020-6495: CLI router (`main()` function)

**Testing:**
- `bin/gsd-tools.test.cjs`: 2,302-line test suite using `node:test` runner

**Primary Workflow Files:**
- `workflows/new-project.md`: Full project initialization (questioning → research → requirements → roadmap)
- `workflows/plan-phase.md`: Phase planning (research → plan → verify loop, max 3 iterations)
- `workflows/execute-phase.md`: Phase execution (discover plans → group waves → spawn executors)
- `workflows/execute-plan.md`: Single plan execution (task-by-task with checkpoints)
- `workflows/progress.md`: Progress report with intelligent routing to next action
- `workflows/quick.md`: Quick ad-hoc tasks with GSD guarantees

## Naming Conventions

**Workflow Files:**
- Pattern: `kebab-case.md` — matches the slash command name minus the `/gsd-` prefix
- Examples: `execute-phase.md` → `/gsd-execute-phase`, `new-project.md` → `/gsd-new-project`

**Template Files:**
- Pattern: `kebab-case.md` for main templates, matching the document they generate
- Examples: `state.md` → generates `STATE.md`, `roadmap.md` → generates `ROADMAP.md`
- Variants use suffixes: `summary-minimal.md`, `summary-standard.md`, `summary-complex.md`

**Reference Files:**
- Pattern: `kebab-case.md` — descriptive of the behavioral domain they cover
- Examples: `ui-brand.md`, `git-integration.md`, `model-profiles.md`

**CLI Functions (inside `gsd-tools.cjs`):**
- Command functions: `cmd` prefix + PascalCase — `cmdStateLoad()`, `cmdPhaseAdd()`, `cmdInitExecutePhase()`
- Internal helpers: camelCase — `findPhaseInternal()`, `resolveModelInternal()`, `getMilestoneInfo()`
- Parser helpers: camelCase — `extractFrontmatter()`, `parseMustHavesBlock()`, `reconstructFrontmatter()`

**Phase Directories (in target projects):**
- Pattern: `XX-kebab-case-name` where `XX` is zero-padded phase number
- Examples: `01-foundation`, `02-auth`, `02.1-critical-fix`

**Plan/Summary Files (in target projects):**
- Pattern: `XX-YY-PLAN.md` and `XX-YY-SUMMARY.md` where `XX` = phase, `YY` = plan
- Examples: `01-01-PLAN.md`, `01-01-SUMMARY.md`, `01-02-PLAN.md`

## Where to Add New Code

**New CLI Command:**
1. Write the command function in `bin/gsd-tools.cjs` (place in appropriate section by category)
2. Add a `case` entry in the `main()` switch router (line 6035+)
3. Add test cases in `bin/gsd-tools.test.cjs`
4. Update the header comment (lines 9-123) with usage documentation

**New Workflow:**
1. Create `workflows/your-workflow.md` with `<purpose>`, `<process>`, `<step>` structure
2. Start with an `init` call to `gsd-tools.cjs` if the workflow needs project context
3. Reference behavioral rules from `references/` via `<required_reading>` blocks
4. Add corresponding slash command in `~/.config/opencode/command/` (outside this repo)

**New Template:**
1. Create `templates/your-template.md` with the template content
2. If the CLI should fill it, add support in `cmdTemplateFill()` (line 1681)
3. Reference from workflows using `@` file references

**New Reference:**
1. Create `references/your-reference.md` with behavioral rules
2. Reference from workflows via `<required_reading>` blocks

**New Init Command (compound context gatherer):**
1. Write `cmdInitYourWorkflow(cwd, args, raw)` in the compound commands section (after line 4059)
2. Add routing in the `init` case of the CLI router (line 6356)
3. Return a comprehensive JSON object with all context the workflow needs

## Special Directories

**`.planning/`:**
- Purpose: Plugin's own planning artifacts (if using GSD to develop GSD)
- Generated: Partially (codebase analysis documents)
- Committed: Yes

**`templates/codebase/`:**
- Purpose: Templates for the `/gsd-map-codebase` workflow output
- Contains: 7 markdown templates (architecture, concerns, conventions, integrations, stack, structure, testing)
- Generated: No (static templates)
- Committed: Yes

**`templates/research-project/`:**
- Purpose: Templates for parallel research agent outputs during project initialization
- Contains: 5 markdown templates (ARCHITECTURE.md, FEATURES.md, PITFALLS.md, STACK.md, SUMMARY.md)
- Generated: No (static templates)
- Committed: Yes

## File Organization

The plugin follows a clear separation between code (behavior) and content (structure):

**Code lives in `bin/`:** All executable logic is in `gsd-tools.cjs`. The single-file constraint is intentional — zero dependencies, zero build step, copy-deploy model.

**Prompts live in `workflows/`:** Each workflow is a self-contained orchestration script. Workflows call `gsd-tools.cjs` for data but make all creative/routing decisions themselves.

**Structure lives in `templates/`:** Document templates define what `.planning/` artifacts look like. Templates are both filled programmatically (via `template fill` command) and referenced by agents for manual creation.

**Rules live in `references/`:** Behavioral constraints that multiple workflows share. Extracted to avoid duplication — `ui-brand.md` is referenced by 5+ workflows, `checkpoints.md` by 3+ workflows.

**Deployment is copy-based:** `deploy.sh` copies `bin/`, `workflows/`, `templates/`, `references/`, and `VERSION` to `~/.config/opencode/get-shit-done/`. No build, no compilation, no package manager.

---

*Structure analysis: 2026-02-21*
