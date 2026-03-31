---
name: commit-protocol
description: Atomic task commit protocol using jj (Jujutsu) with conventional commit message format and change-id tracking for SUMMARY.md. Used after completing each task during plan execution.
type: shared
agents: [executor, github-ci]
sections: [commit, commit-message, hash-tracking]
---

## Purpose

Standardizes how agents commit code changes after completing tasks using **jj** (Jujutsu VCS, colocated with Git). Ensures atomic commits per task, proper commit message format for traceability, and change-id tracking for SUMMARY.md documentation. Used by the executor for per-task commits and by the CI agent for fix commits.

**Key difference from git:** jj has no staging area. All file changes in the working copy are automatically part of the current change. There is no `git add` step.

## Placeholders

| Placeholder | Description | Example |
|---|---|---|
| `{{phase}}` | Current phase identifier | `01-foundation` |
| `{{plan}}` | Current plan number | `01` |

## Content

<!-- section: commit -->
### Commit Protocol

After each task completes (verification passed, done criteria met), commit immediately.

**Check modified files:**
```bash
jj status
```

**If the working copy contains unrelated changes**, use `jj split` to separate task-related changes before committing. Otherwise, commit directly — jj automatically includes all working copy changes.

**To exclude specific files from the commit**, use `jj split` interactively or restore unrelated files after committing:
```bash
jj restore --from @- path/to/unrelated-file.ts
```

**Commit the current change:**
```bash
jj commit -m "{type}({{phase}}-{{plan}}): {concise task description}

- {key change 1}
- {key change 2}
"
```

After `jj commit`, the working copy becomes a new empty change automatically — you're ready for the next task.

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
jj commit -m "{type}({{phase}}-{{plan}}): {concise task description}

- {key change 1}
- {key change 2}
"
```

The scope `({phase}-{plan})` provides traceability from commit to plan. The body bullets summarize the most important changes for quick scanning.

<!-- section: hash-tracking -->
### Hash Tracking

After committing, the just-committed change is the parent of `@`. Record its short change-id for inclusion in SUMMARY.md:

```bash
TASK_COMMIT=$(jj log -r @- --no-graph -T 'change_id.shortest(8)')
```

Track all task change-ids throughout execution. These are included in the SUMMARY.md "Task Commits" section, enabling rollback and audit.

**Note:** In a colocated repo, the underlying git commit hash is also available if needed:
```bash
GIT_HASH=$(jj log -r @- --no-graph -T 'commit_id.shortest(8)')
```

### Bookmark After Commit

Save execution progress after each task commit:
```bash
node __OPENCODE_CONFIG__/bgsd-oc/bin/bgsd-tools.cjs util:memory write --store bookmarks \
  --entry '{"phase":"${PHASE}","plan":"${PLAN}","task":${TASK_NUM},"total_tasks":${TOTAL_TASKS},"git_head":"'$(jj log -r @- --no-graph -T 'commit_id.shortest(8)')'"}'
```

This enables resumption if the agent is interrupted mid-plan.

## Cross-references

- <skill:state-update-protocol /> — After all commits, update STATE.md
- <skill:structured-returns /> — Commit hashes appear in return formats

## Examples

**Standard task commit:**
```bash
jj commit -m "feat(01-02): implement login endpoint

- POST /api/auth/login with bcrypt validation
- Returns JWT in httpOnly cookie
"
TASK_COMMIT=$(jj log -r @- --no-graph -T 'change_id.shortest(8)')
```

**CI fix commit:**
```bash
jj commit -m "fix(ci): address js/sql-injection - parameterized queries

- Fixed: SQL injection in user lookup
- Alert: #42
"
```

**Splitting unrelated changes out before committing:**
```bash
# If working copy has both task files and unrelated edits:
jj commit -m "feat(03-01): add payment processing"
# Then restore any files that shouldn't have been included:
jj restore --from @-- path/to/unrelated-file.ts
# Squash the restoration into the commit:
jj squash --from @ --into @-
```
