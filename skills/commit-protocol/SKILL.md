---
name: commit-protocol
description: Atomic task commit protocol with staging rules, conventional commit message format, and hash tracking for SUMMARY.md. Used after completing each task during plan execution.
type: shared
agents: [executor, github-ci]
sections: [staging, commit-message, hash-tracking]
---

## Purpose

Standardizes how agents commit code changes after completing tasks. Ensures atomic commits per task, proper commit message format for traceability, and hash tracking for SUMMARY.md documentation. Used by the executor for per-task commits and by the CI agent for fix commits.

## Placeholders

| Placeholder | Description | Example |
|---|---|---|
| `{{phase}}` | Current phase identifier | `01-foundation` |
| `{{plan}}` | Current plan number | `01` |

## Content

<!-- section: staging -->
### Staging Protocol

After each task completes (verification passed, done criteria met), commit immediately.

**Check modified files:**
```bash
git status --short
```

**Stage task-related files individually** — never use `git add .` or `git add -A`:
```bash
git add src/api/auth.ts
git add src/types/user.ts
```

Staging files individually ensures only task-related changes are committed. Avoid catching unrelated modifications, generated files, or temporary artifacts.

<!-- section: commit-message -->
### Commit Message Format

Select the commit type based on the nature of the change:

| Type | When |
|---|---|
| `feat` | New feature, endpoint, component |
| `fix` | Bug fix, error correction |
| `test` | Test-only changes (TDD RED phase) |
| `refactor` | Code cleanup, no behavior change |
| `chore` | Config, tooling, dependencies |
| `perf` | Performance improvement |
| `docs` | Documentation-only changes |
| `style` | Code style, formatting |

**Format:**
```bash
git commit -m "{type}({{phase}}-{{plan}}): {concise task description}

- {key change 1}
- {key change 2}
"
```

The scope `({phase}-{plan})` provides traceability from commit to plan. The body bullets summarize the most important changes for quick scanning.

<!-- section: hash-tracking -->
### Hash Tracking

After committing, record the short hash for inclusion in SUMMARY.md:

```bash
TASK_COMMIT=$(git rev-parse --short HEAD)
```

Track all task commit hashes throughout execution. These are included in the SUMMARY.md "Task Commits" section, enabling rollback and audit.

### Bookmark After Commit

Save execution progress after each task commit:
```bash
node $BGSD_HOME/bin/bgsd-tools.cjs util:memory write --store bookmarks \
  --entry '{"phase":"${PHASE}","plan":"${PLAN}","task":${TASK_NUM},"total_tasks":${TOTAL_TASKS},"git_head":"'$(git rev-parse --short HEAD)'"}'
```

This enables resumption if the agent is interrupted mid-plan.

## Cross-references

- <skill:state-update-protocol /> — After all commits, update STATE.md
- <skill:structured-returns /> — Commit hashes appear in return formats

## Examples

**Standard task commit:**
```bash
git add src/api/auth.ts
git add src/types/user.ts
git commit -m "feat(01-02): implement login endpoint

- POST /api/auth/login with bcrypt validation
- Returns JWT in httpOnly cookie
"
TASK_COMMIT=$(git rev-parse --short HEAD)
```

**CI fix commit:**
```bash
git add src/utils/sanitize.ts
git commit -m "fix(ci): address js/sql-injection - parameterized queries

- Fixed: SQL injection in user lookup
- Alert: #42
"
```
