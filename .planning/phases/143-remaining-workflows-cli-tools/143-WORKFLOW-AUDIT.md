# bGSD Workflow Audit: Question Template Migration Status

**Audit Date:** 2026-03-19  
**Phase:** 143-remaining-workflows-cli-tools  
**Plan:** 143-02  
**Purpose:** Inventory all workflows, document inline question patterns, identify migration targets

---

## Summary

| Category | Count |
|----------|-------|
| Total workflows | 44 |
| Already migrated (uses questionTemplate) | 6 |
| Needs migration (inline question patterns) | 6 |
| Conversational-only questions | 2 |
| No structured questions | 30 |

---

## Migration Status Detail

### ✅ ALREADY MIGRATED (6 workflows)
These workflows use `questionTemplate()` calls — no migration needed.

| Workflow | Question Count | Pattern | Status |
|----------|----------------|---------|--------|
| discuss-phase.md | 5 | questionTemplate() | Migrated |
| new-milestone.md | 5 | questionTemplate() | Migrated |
| plan-phase.md | 4 | questionTemplate() | Migrated |
| transition.md | 3 | questionTemplate() | Migrated |
| verify-work.md | 4 | questionTemplate() | Migrated |
| execute-phase.md | 4 | questionTemplate() | Migrated |

---

### ❌ NEEDS MIGRATION (6 workflows)

#### 1. settings.md — `question([...])` inline arrays
- **Line 39-96:** First `question([...])` call with 6 settings (model profile, research, plan check, verifier, auto-advance, git branching)
- **Line 126-136:** Second `question([...])` call for "Save as defaults?"
- **Migration:** Replace with `questionTemplate('settings-...')` calls

#### 2. check-todos.md — `Use question:` inline options
- **Line 102-109:** "Use question:" with action options for roadmap-matched todos
- **Line 113-120:** "Use question:" with action options for non-matched todos
- **Migration:** Replace with `questionTemplate('check-todos-action', ...)`

#### 3. add-todo.md — `Use question:` inline options
- **Line 70-76:** "Use question:" for duplicate handling (Skip/Replace/Add anyway)
- **Migration:** Replace with `questionTemplate('add-todo-duplicate', ...)`

#### 4. update.md — `Use question:` inline options
- **Line 126-130:** "Use question:" for update confirmation (Yes, update now / No, cancel)
- **Migration:** Replace with `questionTemplate('update-confirm', ...)`

#### 5. cleanup.md — `question:` inline question
- **Line 96:** `question: "Proceed with archiving?"` with options "Yes — archive listed phases" | "Cancel"
- **Migration:** Replace with `questionTemplate('cleanup-confirm', ...)`

#### 6. complete-milestone.md — `Ask:` inline question
- **Line 189:** `Ask: push to remote?`
- **Migration:** Replace with `questionTemplate('complete-milestone-push', ...)`

---

### 💬 CONVERSATIONAL-ONLY QUESTIONS (2 workflows)
These use free-form questions, not structured patterns.

| Workflow | Question Count | Pattern | Notes |
|----------|----------------|---------|-------|
| debug.md | 5 | Conversational | Lines 35-42: "Expected behavior", "Actual behavior", "Error messages", "Timeline", "Reproduction" — gathering symptoms |
| list-phase-assumptions.md | 1+ | Conversational | "What do you think?" at line 118 — feedback gathering |

**Note:** These don't use structured `question()` patterns. Migration would require redesigning the conversational flow to use templates, which may not be appropriate for open-ended symptom gathering.

---

### 🚫 NO STRUCTURED QUESTIONS (30 workflows)

| Workflow | Deprecation Status | Notes |
|----------|-------------------|-------|
| add-phase.md | Active | No questions |
| audit-milestone.md | Active | No questions |
| cmd-codebase-impact.md | Active (CLI wrapper) | Pure wrapper, referenced by commands/bgsd-impact.md |
| cmd-context-budget.md | Active (CLI wrapper) | Pure wrapper, referenced by commands/bgsd-context-budget.md |
| cmd-rollback-info.md | Active (CLI wrapper) | Pure wrapper, referenced by commands/bgsd-rollback-info.md |
| cmd-search-decisions.md | Active (CLI wrapper) | Pure wrapper, referenced by commands/bgsd-search-decisions.md |
| cmd-search-lessons.md | Active (CLI wrapper) | Pure wrapper, referenced by commands/bgsd-search-lessons.md |
| cmd-session-diff.md | Active (CLI wrapper) | Pure wrapper, referenced by commands/bgsd-session-diff.md |
| cmd-test-run.md | Active (CLI wrapper) | Pure wrapper, referenced by commands/bgsd-test-run.md |
| cmd-trace-requirement.md | Active (CLI wrapper) | Pure wrapper, referenced by commands/bgsd-trace.md |
| cmd-validate-config.md | Active (CLI wrapper) | Pure wrapper, referenced by commands/bgsd-validate-config.md |
| cmd-validate-deps.md | Active (CLI wrapper) | Pure wrapper, referenced by commands/bgsd-validate-deps.md |
| cmd-velocity.md | Active (CLI wrapper) | Pure wrapper, referenced by commands/bgsd-velocity.md |
| diagnose-issues.md | Active | No questions |
| execute-plan.md | Active | No questions |
| github-ci.md | Active | No questions |
| health.md | Active | No questions |
| help.md | Active | No questions |
| insert-phase.md | Active | No questions |
| map-codebase.md | Active | No questions |
| new-project.md | Active | Has "Ask:" at line 92 (see needs-migration) |
| pause-work.md | Active | No questions |
| plan-milestone-gaps.md | Active | No questions |
| progress.md | Active | No questions |
| quick.md | Active | No questions |
| remove-phase.md | Active | No questions |
| research-phase.md | Active | No questions |
| resume-project.md | Active | No questions |
| set-profile.md | Active | No questions |
| tdd.md | Active | No questions |

---

## cmd-*.md Deprecation Analysis

### Reference Check Results

All 12 cmd-*.md workflows are **actively referenced** by command wrappers in `commands/`:

| Workflow | Referenced By | Status |
|----------|---------------|--------|
| cmd-codebase-impact.md | commands/bgsd-impact.md | Active |
| cmd-context-budget.md | commands/bgsd-context-budget.md | Active |
| cmd-rollback-info.md | commands/bgsd-rollback-info.md | Active |
| cmd-search-decisions.md | commands/bgsd-search-decisions.md | Active |
| cmd-search-lessons.md | commands/bgsd-search-lessons.md | Active |
| cmd-session-diff.md | commands/bgsd-session-diff.md | Active |
| cmd-test-run.md | commands/bgsd-test-run.md | Active |
| cmd-trace-requirement.md | commands/bgsd-trace.md | Active |
| cmd-validate-config.md | commands/bgsd-validate-config.md | Active |
| cmd-validate-deps.md | commands/bgsd-validate-deps.md | Active |
| cmd-velocity.md | commands/bgsd-velocity.md | Active |

### Analysis

These cmd-*.md workflows are **pure CLI wrappers** that:
1. Receive arguments from command wrappers
2. Call bgsd-tools CLI commands
3. Parse and display JSON output

**They add value** by providing workflow documentation and consistent output formatting. They are NOT candidates for removal.

**No references found** in `agents/` or `hooks/` directories — but they don't need to be, as they are invoked through the commands layer.

---

## Migration Target List

### Priority 1: 6 workflows identified for migration

| # | Workflow | Current Pattern | Template Needed |
|---|----------|-----------------|-----------------|
| 1 | settings.md | `question([...])` | settings-config, settings-defaults |
| 2 | check-todos.md | `Use question:` | check-todos-action-roadmap, check-todos-action |
| 3 | add-todo.md | `Use question:` | add-todo-duplicate |
| 4 | update.md | `Use question:` | update-confirm |
| 5 | cleanup.md | `question:` | cleanup-confirm |
| 6 | complete-milestone.md | `Ask:` | complete-milestone-push |

### Already Migrated (verify)
- discuss-phase.md ✓
- new-milestone.md ✓
- plan-phase.md ✓
- transition.md ✓
- verify-work.md ✓
- execute-phase.md ✓

### No Migration Needed
- 30 workflows with no structured questions
- 2 workflows with conversational-only questions (debug.md, list-phase-assumptions.md)

---

## Search Patterns Used

```bash
# Migrated workflows
grep -r "questionTemplate" workflows/*.md

# Inline question arrays (settings.md pattern)
grep -r "question\(\[^\)]*\)" workflows/*.md

# Inline options (check-todos, update patterns)
grep -r "Use question:" workflows/*.md

# Inline questions (complete-milestone pattern)
grep -r "Ask:" workflows/*.md

# Conversational questions
grep -r "\?" workflows/*.md | grep -v "questionTemplate\|\$\|\\#"
```

---

## Verification

- [x] All 44 workflows documented
- [x] Migration targets identified (6 workflows)
- [x] Already-migrated verified (6 workflows)
- [x] Deprecation analysis complete (12 cmd-*.md all active)
- [x] Conversational-only workflows identified (2 workflows)
