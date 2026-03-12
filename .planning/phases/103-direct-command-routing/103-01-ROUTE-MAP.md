# Phase 103 Route Map: Command Routing Analysis

## Command Groups Overview

Total: **14 command groups** with **39 subcommands** (spec mentions 41 - possibly includes aliases)

### 1. bgsd-plan (5 subcommands)
- **project**: Run `init:new-project` then invoke new-project workflow
- **discuss**: Invoke discuss-phase workflow
- **research**: Invoke research-phase workflow
- **assumptions**: Invoke list-phase-assumptions workflow
- **phase**: Run `init:plan-phase <phase>` then invoke plan-phase workflow

### 2. bgsd-milestone (4 subcommands)
- **new**: Run `init:new-milestone` then invoke new-milestone workflow
- **complete**: Run `init:milestone-op` then invoke complete-milestone workflow
- **audit**: Invoke audit-milestone workflow
- **gaps**: Invoke plan-milestone-gaps workflow

### 3. bgsd-exec (3 subcommands)
- **phase**: Run `init:execute-phase <phase>` then invoke execute-phase workflow
- **quick**: Run `init:quick` then invoke quick workflow
- **ci**: Invoke github-ci workflow

### 4. bgsd-roadmap (3 subcommands)
- **add**: Invoke add-phase workflow
- **insert**: Invoke insert-phase workflow (pass phase and position)
- **remove**: Invoke remove-phase workflow

### 5. bgsd-session (3 subcommands)
- **resume**: Run `init:resume` then invoke resume-project workflow
- **pause**: Invoke pause-work workflow
- **progress**: Run `init:progress` then invoke progress workflow

### 6. bgsd-todo (2 subcommands)
- **add**: Run `init:todos add` then invoke add-todo workflow
- **check**: Run `init:todos` then invoke check-todos workflow

### 7. bgsd-util (16 subcommands)
- **map**: Run `init:map-codebase` then invoke map-codebase workflow
- **cleanup**: Invoke cleanup workflow
- **help**: Invoke help workflow
- **update**: Invoke update workflow
- **velocity**: Invoke cmd-velocity workflow
- **validate-deps**: Invoke cmd-validate-deps workflow
- **test-run**: Invoke cmd-test-run workflow
- **trace**: Invoke cmd-trace-requirement workflow
- **search-decisions**: Invoke cmd-search-decisions workflow
- **search-lessons**: Invoke cmd-search-lessons workflow
- **session-diff**: Invoke cmd-session-diff workflow
- **rollback-info**: Invoke cmd-rollback-info workflow
- **context-budget**: Invoke cmd-context-budget workflow
- **impact**: Invoke cmd-codebase-impact workflow
- **patches**: Invoke cleanup workflow
- **health**: Invoke health workflow

### 8. bgsd-config (3 subcommands)
- **settings**: Invoke settings workflow (default if no subcommand)
- **profile**: Invoke set-profile workflow
- **validate**: Invoke cmd-validate-config workflow

### 9-14. Standalone Commands (no subcommands)
- bgsd-debug
- bgsd-health
- bgsd-github-ci
- bgsd-progress
- bgsd-quick
- bgsd-verify-work

---

## Routing Flow Analysis

### Entry Point: Host Editor Command Parsing
1. User types `/bgsd plan phase 103`
2. Host editor parses as: command=`bgsd-plan`, arguments=`phase 103`
3. Plugin's command-enricher.js adds context
4. Command wrapper file `commands/bgsd-plan.md` is loaded

### Route Pattern: Init-First Pattern (8 commands)
Commands that run `init:*` CLI commands first:
- plan project, plan phase
- milestone new, milestone complete
- exec phase, exec quick
- session resume, session progress
- todo add, todo check

**Current Flow:**
```
command wrapper → init:<command> → workflow → output
```

**Proposed Direct Flow:**
```
command wrapper → workflow → output
```

Init commands fetch context and prepare files, but this adds latency and complexity. For direct routing, we need to either:
1. Remove init step (some commands may lose context)
2. Make init optional with fallback behavior

---

## Clarification Prompt Locations

### 1. conversational-planner.js (line 90)
**Trigger:** Compound commands without phase number
```javascript
clarification: 'Please specify a phase number for the command(s)'
```
**When triggered:** When user says something like "run plan and verify" without specifying phase

### 2. requirement-extractor.js (lines 95-160)
**Function:** `generateClarifyingQuestions(partialRequirements)`
**Triggers:**
- Missing feature type (line 100-114)
- Missing scope (line 117-127)
- Complex features with dependencies (line 130-142)
- API type questions (line 145-157)

**Questions generated:**
- "What type of feature are you building?"
- "What is the scope of this feature?"
- "Does this feature depend on any other features?"
- "What type of API do you need?"

### 3. help-fallback.js (line 50-59)
**Trigger:** Unrecognized input with Levenshtein distance ≤ 3
**Function:** `generateDidYouMean(input)`
**Shows:** "did you mean" style suggestions

---

## Bypass Criteria for Direct Routing

To achieve direct command routing (ROUTE-01, ROUTE-02, ROUTE-03):

| Current Blocker | Location | Bypass Strategy |
|----------------|----------|-----------------|
| init:new-project | plan/project | Remove init call, use defaults |
| init:plan-phase | plan/phase | Remove init call, inline context |
| init:new-milestone | milestone/new | Remove init call |
| init:milestone-op | milestone/complete | Remove init call |
| init:execute-phase | exec/phase | Remove init call |
| init:quick | exec/quick | Remove init call |
| init:resume | session/resume | Remove init call |
| init:progress | session/progress | Remove init call |
| init:todos | todo/add, todo/check | Remove init call |
| Clarifying questions | conversational-planner | Disable NL parsing for commands |
| "did you mean" | help-fallback | Disable fallback suggestions |

---

## Files to Modify (Plan 103-02)

1. **commands/bgsd-*.md** - Remove init:* calls
2. **src/lib/nl/conversational-planner.js** - Add flag to bypass clarification
3. **src/lib/nl/help-fallback.js** - Add flag to disable suggestions
4. **src/lib/nl/requirement-extractor.js** - Add flag to disable questions
