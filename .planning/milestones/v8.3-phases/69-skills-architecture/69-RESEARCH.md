# Phase 69: Skills Architecture - Research

**Researched:** 2026-03-08
**Domain:** OpenCode skills system, agent content refactoring, build/deploy pipeline
**Confidence:** HIGH

## Summary

This phase reorganizes shared agent content (protocols, references, patterns) into OpenCode skills — reusable instruction modules that agents can load on-demand. The existing 10 agent files total 7,361 lines with significant content duplication: `<project_context>` blocks (10 copies, ~14 lines each), `<structured_returns>` (10 copies, varying sizes), `<deviation_rules>` (2 copies), `<checkpoint_return_format>` (2 copies), and more. The 12 reference files total 3,148 lines and will be absorbed into skills entirely. The transformation is structural — no agent behavioral changes, just reorganization that reduces duplication and enables lazy-loading.

OpenCode's skill system is well-documented and straightforward: skills live in `skills/{name}/SKILL.md` directories, require YAML frontmatter with `name` and `description` fields, are discovered automatically from global config (`~/.config/opencode/skills/`) or project-local paths, and are loaded on-demand via the native `skill` tool. The bGSD approach extends this with explicit `<skill:name />` reference tags in agent definitions, eager vs lazy loading control, and build-time skill expansion — none of which conflict with OpenCode's native system.

**Primary recommendation:** Create fine-grained skills (one per protocol/concern), replace inline content with skill reference tags, extend build.cjs for skill expansion and validation, extend deploy.sh for skills deployment, and run the migration as a big bang (all at once, not incremental).

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- One skill per protocol — fine-grained (commit-protocol, checkpoint-protocol, goal-backward, etc.)
- Always extract — no threshold. Even small/single-agent protocols become skills
- Domain-adapted content uses placeholders: `{{agent_name}}`, `{{action_verb}}`, `{{phase}}`, `{{gsd_home}}`
- Skills can cross-reference other skills
- Skill index is a skill named 'skill-index', auto-generated at build time
- Each skill is a directory with SKILL.md + optional supporting files
- Follow OpenCode convention: skills/{name}/SKILL.md
- No versioning needed — skills deploy in same cycle as agents
- References/ directory migrated into skills and then removed entirely
- bGSD-specific only — no portability requirement
- No migration trail comments in agents — clean removal of inline content
- Standard YAML frontmatter in SKILL.md
- Both `<skills>` section at top AND inline `<skill:name />` markers
- `<skills>` section has structured list with skill names, hints, when to load, placeholder values
- Inline markers use XML-style: `<skill:commit-protocol />`
- Tags support attributes: `<skill:project-context action="executing" />`
- Tags support section selection: `<skill:commit-protocol section="pre-commit" />`
- Hybrid loading: `eager` attribute for build-time expansion, default is lazy
- Skills have good descriptions for OpenCode's native matching; agents reference by explicit name
- deploy.sh validates agent skill references exist — fail deploy if missing
- Workflows can also reference skills
- ALL standardized blocks become skills: project_context, structured_returns, commit protocol, checkpoint protocol, state update protocol
- Domain-specific content also extracted (executor deviation handling, planner task breakdown, etc.)
- structured_returns: one skill with per-agent sections, agents load via section attribute
- Agent definitions become thin: identity + execution flow + skills list
- Agent-specific skills use agent-prefixed naming: executor-deviations, planner-task-breakdown
- Shared protocol skills use concept naming: commit-protocol, checkpoint-protocol
- References/ reorganized by topic during migration (not 1:1 mapping)
- Content rewritten/improved during extraction — not just copy-paste
- Big bang migration — all at once
- kebab-case for directory names
- SKILL.md internal sections (required): Purpose, Placeholders, Content, Cross-references, Examples
- YAML frontmatter fields: name, description, type (shared | agent-specific), agents (list), sections (list)
- Skills deployed alongside agents/ in host editor config (same level)
- Build.cjs extended for eager-loaded skill expansion and skill-index auto-generation
- deploy.sh validates skills before deploying (structure, frontmatter, cross-refs)
- Tests added for skill validation

### Agent's Discretion
- Whether to distinguish protocol skills vs reference skills structurally, or treat all skills uniformly

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| SKIL-01 | OpenCode skills created from shared reference content (checkpoints, goal-backward, research patterns, commit protocol, deviation rules, state updates) | Skill inventory identifies 15-20 skills covering all shared/agent-specific content. OpenCode convention verified via Context7 — SKILL.md with frontmatter is the standard. |
| SKIL-02 | Agent definitions slimmed by replacing duplicated inline content with skill load instructions | Current agent line counts measured (7,361 total). Duplication audit shows `<project_context>` in all 10 agents, `<structured_returns>` in all 10, deviation rules in 2, checkpoint formats in 2. Replacement with `<skill:name />` tags dramatically reduces line counts. |
| SKIL-03 | deploy.sh updated to include skills/ directory in deployment manifest | Current deploy.sh uses manifest-based sync with `dest_for_file()` routing. build.cjs generates manifest by scanning directories. Both need skills/ directory added. Deploy path: `~/.config/opencode/skills/`. |
| SKIL-04 | Skill descriptions tuned for accurate agent loading (tested for false positive/negative load rates) | OpenCode discovery uses description-based matching. bGSD agents reference skills by explicit name (avoiding false positives), but descriptions still matter for native OpenCode discovery. Each skill needs a unique, specific description. |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| OpenCode skills system | Native | Skill discovery and loading | Built into the host editor; no external dependency needed |
| YAML frontmatter | Standard | Skill metadata in SKILL.md files | Required by OpenCode convention; already used in agent definitions |
| esbuild (build.cjs) | Existing | Build pipeline — skill expansion, index generation, validation | Already the project's build tool; extending, not replacing |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Node.js fs/path | Built-in | Skill directory scanning, file validation | Build-time and deploy-time validation |
| jq (CLI) | Existing | Manifest JSON processing in deploy.sh | Already used in deploy.sh |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Custom skill tags | OpenCode native skill tool only | Native tool doesn't support section selection or placeholder substitution — custom tags give finer control |
| One mega-skill | Many fine-grained skills | Fine-grained is the locked decision; enables selective loading |

**Installation:**
No new dependencies needed. This is pure reorganization of existing content.

## Architecture Patterns

### Recommended Project Structure

```
skills/                              # NEW — top-level, alongside agents/, commands/
├── project-context/                 # Shared: project context discovery block
│   └── SKILL.md
├── commit-protocol/                 # Shared: task commit protocol
│   └── SKILL.md
├── checkpoint-protocol/             # Shared: checkpoint handling + formats
│   └── SKILL.md
│   └── checkpoints-reference.md     # Supporting file (from references/checkpoints.md)
├── state-update-protocol/           # Shared: state update procedures
│   └── SKILL.md
├── goal-backward/                   # Shared: goal-backward methodology
│   └── SKILL.md
├── structured-returns/              # Shared: per-agent return format sections
│   └── SKILL.md
├── deviation-rules/                 # Shared: deviation handling (executor + CI variants)
│   └── SKILL.md
├── verification-patterns/           # Shared: verification methodology (from references/)
│   └── SKILL.md
│   └── stub-detection.md            # Supporting file
├── research-patterns/               # Shared: research methodology
│   └── SKILL.md
├── tdd-execution/                   # Shared: TDD red-green-refactor flow
│   └── SKILL.md
├── executor-continuation/           # Agent-specific: continuation handling
│   └── SKILL.md
├── planner-task-breakdown/          # Agent-specific: task anatomy, sizing
│   └── SKILL.md
├── planner-checkpoints/             # Agent-specific: checkpoint planning guidelines
│   └── SKILL.md
├── planner-dependency-graph/        # Agent-specific: dependency graph building
│   └── SKILL.md
├── debugger-hypothesis-testing/     # Agent-specific: hypothesis testing methodology
│   └── SKILL.md
├── debugger-investigation/          # Agent-specific: investigation techniques
│   └── SKILL.md
├── debugger-verification/           # Agent-specific: debug verification patterns
│   └── SKILL.md
├── automation-reference/            # Reference: CLI/service automation patterns
│   └── SKILL.md
├── raci/                            # Reference: agent responsibility matrix
│   └── SKILL.md
├── skill-index/                     # Auto-generated at build time
│   └── SKILL.md
└── ...
```

### Pattern 1: SKILL.md Structure (OpenCode-compatible with bGSD extensions)

**What:** Each skill follows a standard structure combining OpenCode's required frontmatter with bGSD-specific content sections.

**When to use:** Every skill file.

**Example:**
```markdown
---
name: commit-protocol
description: Task commit protocol for atomic commits with proper type, scope, and format. Covers staging, commit messages, and hash tracking for SUMMARY.md.
type: shared
agents: [executor, github-ci]
sections: [staging, commit-message, hash-tracking]
---

## Purpose

Standardizes how agents commit code changes after completing tasks.
Used by executor for per-task commits and by CI agent for fix commits.

## Placeholders

| Placeholder | Description | Example |
|-------------|-------------|---------|
| `{{phase}}` | Current phase identifier | `01-foundation` |
| `{{plan}}` | Current plan number | `01` |

## Content

<!-- section: staging -->
### Staging Protocol

**Stage task-related files individually** (NEVER `git add .` or `git add -A`):
```bash
git add src/api/auth.ts
git add src/types/user.ts
```

<!-- section: commit-message -->
### Commit Message Format

| Type       | When                                            |
| ---------- | ----------------------------------------------- |
| `feat`     | New feature, endpoint, component                |
| `fix`      | Bug fix, error correction                       |
| `test`     | Test-only changes (TDD RED)                     |
| `refactor` | Code cleanup, no behavior change                |
| `chore`    | Config, tooling, dependencies                   |

```bash
git commit -m "{type}({{phase}}-{{plan}}): {concise task description}

- {key change 1}
- {key change 2}
"
```

<!-- section: hash-tracking -->
### Hash Tracking

```bash
TASK_COMMIT=$(git rev-parse --short HEAD)
```
Record for SUMMARY.md completion table.

## Cross-references

- `<skill:state-update-protocol />` — After commits, update STATE.md
- `<skill:structured-returns />` — Commit hashes go in return format

## Examples

See executor agent's `<task_commit_protocol>` section (original source).
```

### Pattern 2: Agent Skill Reference Tags

**What:** How agent definitions reference skills they need.

**When to use:** In every agent .md file after migration.

**Example (top of agent file):**
```markdown
<skills>
| Skill | Provides | When to Load | Placeholders |
|-------|----------|--------------|--------------|
| project-context | Project discovery block | Always (eager) | action="executing" |
| commit-protocol | Task commit format | During task completion | phase="{{PHASE}}", plan="{{PLAN}}" |
| deviation-rules | Auto-fix decision framework | When encountering unexpected issues | |
| checkpoint-protocol | Checkpoint format + handling | When hitting checkpoints | |
| state-update-protocol | STATE.md update procedures | After plan completion | |
| structured-returns | Return format for orchestrator | When returning results | section="executor" |
</skills>
```

**Example (inline markers, replacing removed content):**
```markdown
<step name="execute_tasks">
For each task:
1. Execute task
2. Apply deviation rules: <skill:deviation-rules />
3. Handle checkpoints: <skill:checkpoint-protocol />
4. Commit: <skill:commit-protocol />
5. Track completion
</step>
```

### Pattern 3: Structured Returns as Sectioned Skill

**What:** One skill file with `<!-- section: agent-name -->` markers, loaded per-agent via section attribute.

**When to use:** For `structured_returns` which has unique content per agent but a shared pattern.

**Example:**
```markdown
---
name: structured-returns
description: Agent-specific structured return formats for orchestrator communication
type: shared
agents: [executor, planner, verifier, debugger, github-ci, roadmapper, codebase-mapper, project-researcher, phase-researcher, plan-checker]
sections: [executor, planner, verifier, debugger, github-ci, roadmapper, codebase-mapper, project-researcher, phase-researcher, plan-checker]
---

<!-- section: executor -->
## Executor Returns

### PLAN COMPLETE
```markdown
## PLAN COMPLETE
**Plan:** {phase}-{plan}
...
```

<!-- section: planner -->
## Planner Returns

### PLANNING COMPLETE
...
```

**Agent references:** `<skill:structured-returns section="executor" />`

### Anti-Patterns to Avoid

- **Bundling unrelated protocols into one skill:** Each skill should be one concept. Don't combine commit-protocol and state-update-protocol just because they're both "post-task" activities.
- **Extracting bootstrap blocks (PATH SETUP, Mandatory Initial Read):** These must execute BEFORE any tool calls. They can't be lazy-loaded skills — they're the bootstrap sequence. REQUIREMENTS.md explicitly marks these as out of scope.
- **Leaving migration trail comments:** Per CONTEXT.md decision, no "// Moved to skill: commit-protocol" comments. Clean removal.
- **Copy-paste extraction:** Content should be rewritten and improved during migration, not just moved verbatim.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Skill discovery | Custom discovery system | OpenCode's native `skills/*/SKILL.md` convention | OpenCode auto-discovers skills from `~/.config/opencode/skills/` |
| Skill loading | Custom file loader | OpenCode's native `skill` tool + `<skill:name />` tags | Built-in mechanism; agents can call `use_skill` at runtime |
| Frontmatter parsing | Custom YAML parser | Existing `util:frontmatter` gsd-tools commands | Already handles YAML frontmatter for PLAN.md files |
| Manifest generation | Manual file list | Extend existing `collectFiles()` in build.cjs | Pattern already proven for agents, commands, templates, references |
| Path placeholder substitution | New substitution system | Extend existing `__OPENCODE_CONFIG__` pattern in deploy.sh | deploy.sh already does `sed` substitution for path placeholders |

**Key insight:** Every infrastructure piece needed already exists in the project. build.cjs has manifest generation with recursive directory scanning. deploy.sh has file sync with stale cleanup. gsd-tools has frontmatter parsing. The work is extension, not creation.

## Common Pitfalls

### Pitfall 1: Bootstrap Timing
**What goes wrong:** Extracting PATH SETUP or Mandatory Initial Read into skills causes agents to fail because skills can't be loaded before the tool system is available.
**Why it happens:** These blocks must execute before any tool calls — they're the bootstrap sequence that makes subsequent tool calls work.
**How to avoid:** REQUIREMENTS.md explicitly marks PATH SETUP and Mandatory Initial Read as out of scope. Never extract these.
**Warning signs:** Agent fails to resolve `$GSD_HOME` or doesn't read context files on startup.

### Pitfall 2: Overly Eager Loading
**What goes wrong:** Marking too many skills as `eager` (build-time expansion) bloats agent definitions back to their original size, defeating the purpose.
**Why it happens:** Conservative approach — "just include everything to be safe."
**How to avoid:** Only `project-context` should be eager (it's always needed). Everything else lazy-loaded on-demand. The `<skills>` section at agent top provides the index; actual content loads when referenced.
**Warning signs:** Agent line counts don't decrease significantly after migration.

### Pitfall 3: Skills Not Deployed
**What goes wrong:** Skills work in dev (source directory) but not in production because deploy.sh doesn't include them.
**Why it happens:** deploy.sh and build.cjs manifest need explicit updates to handle the `skills/` directory.
**How to avoid:** Update manifest generation in build.cjs to scan `skills/` directory. Update deploy.sh to route skill files to `~/.config/opencode/skills/` (same level as agents, commands). Update install.js similarly.
**Warning signs:** Skills work locally but "skill not found" errors after deploy.

### Pitfall 4: Broken Cross-References
**What goes wrong:** A skill references another skill that doesn't exist (typo, renamed, deleted).
**Why it happens:** Cross-references are text strings, not enforced at parse time.
**How to avoid:** Build-time validation in build.cjs should parse all `<skill:name />` tags in agents AND all `Cross-references` sections in SKILL.md files, then verify every referenced skill exists as a directory.
**Warning signs:** Agent hits a `<skill:nonexistent />` tag at runtime and gets nothing.

### Pitfall 5: Section Selection Ambiguity
**What goes wrong:** Agent loads `<skill:structured-returns section="executr" />` (typo) and gets no content.
**Why it happens:** Section names are strings matched against `<!-- section: name -->` markers.
**How to avoid:** Build-time validation should verify that every `section="X"` attribute in agent files matches a `<!-- section: X -->` marker in the referenced skill. Fail build on mismatch.
**Warning signs:** Agent return format is empty or missing.

### Pitfall 6: deploy.sh Path Routing
**What goes wrong:** Skills deployed to wrong location (e.g., inside `get-shit-done/skills/` instead of `~/.config/opencode/skills/`).
**Why it happens:** deploy.sh's `dest_for_file()` function needs a new case for skills.
**How to avoid:** Add `skills/*/SKILL.md` and `skills/*/*` patterns to `dest_for_file()`. Route to `$HOME/.config/opencode/skills/` (NOT inside `$DEST/skills/`). OpenCode discovers skills from the config-level `skills/` directory.
**Warning signs:** Skills created but OpenCode's `skill` tool can't find them.

### Pitfall 7: Placeholder Substitution in Skills
**What goes wrong:** Skills contain `__OPENCODE_CONFIG__` or `{{gsd_home}}` placeholders that aren't substituted.
**Why it happens:** deploy.sh's `sed` substitution currently only targets `$DEST`, `$CMD_DIR`, and `$AGENT_DIR` directories. Skills need to be included.
**How to avoid:** Add skills directory to the `find ... -exec sed -i` command in deploy.sh's placeholder substitution step.
**Warning signs:** Skills reference literal `__OPENCODE_CONFIG__` instead of the resolved path.

## Code Examples

### build.cjs — Adding Skills to Manifest

Verified pattern from existing build.cjs (extending `collectFiles`):

```javascript
// In build.cjs manifest generation section, add after references/ collection:

// skills/ — all files (SKILL.md + supporting files)
collectFiles('skills', () => true);
```

### build.cjs — Skill Validation

New validation step added to build pipeline:

```javascript
// After manifest generation, validate skills
function validateSkills() {
  const skillsDir = 'skills';
  if (!fs.existsSync(skillsDir)) return;

  const skillDirs = fs.readdirSync(skillsDir)
    .filter(d => fs.statSync(path.join(skillsDir, d)).isDirectory());

  const errors = [];
  const allSkillNames = new Set(skillDirs);

  for (const dir of skillDirs) {
    const skillMd = path.join(skillsDir, dir, 'SKILL.md');

    // Check SKILL.md exists
    if (!fs.existsSync(skillMd)) {
      errors.push(`${dir}: Missing SKILL.md`);
      continue;
    }

    const content = fs.readFileSync(skillMd, 'utf-8');

    // Check frontmatter has required fields
    const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
    if (!fmMatch) {
      errors.push(`${dir}: Missing YAML frontmatter`);
      continue;
    }

    const fm = fmMatch[1];
    if (!fm.includes('name:')) errors.push(`${dir}: Missing 'name' in frontmatter`);
    if (!fm.includes('description:')) errors.push(`${dir}: Missing 'description' in frontmatter`);

    // Check cross-references resolve
    const crossRefs = content.match(/<skill:([a-z0-9-]+)/g) || [];
    for (const ref of crossRefs) {
      const skillName = ref.replace('<skill:', '');
      if (!allSkillNames.has(skillName)) {
        errors.push(`${dir}: Cross-reference to non-existent skill '${skillName}'`);
      }
    }
  }

  if (errors.length > 0) {
    console.error('Skill validation errors:');
    errors.forEach(e => console.error(`  ❌ ${e}`));
    process.exit(1);
  }

  console.log(`Skills validated: ${skillDirs.length} skills, 0 errors`);
}
```

### build.cjs — Skill Index Generation

```javascript
function generateSkillIndex() {
  const skillsDir = 'skills';
  if (!fs.existsSync(skillsDir)) return;

  const skillDirs = fs.readdirSync(skillsDir)
    .filter(d => d !== 'skill-index' && fs.statSync(path.join(skillsDir, d)).isDirectory());

  let index = `---
name: skill-index
description: Auto-generated index of all available bGSD skills. Load this to discover what skills are available without loading their full content.
type: shared
agents: [all]
---

# Skill Index

**Generated:** ${new Date().toISOString()}
**Total skills:** ${skillDirs.length}

| Skill | Type | Agents | Description |
|-------|------|--------|-------------|
`;

  for (const dir of skillDirs) {
    const content = fs.readFileSync(path.join(skillsDir, dir, 'SKILL.md'), 'utf-8');
    const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
    if (!fmMatch) continue;

    // Simple extraction (avoid full YAML parser — zero dependencies)
    const fm = fmMatch[1];
    const name = fm.match(/name:\s*(.+)/)?.[1]?.trim() || dir;
    const desc = fm.match(/description:\s*(.+)/)?.[1]?.trim() || '';
    const type = fm.match(/type:\s*(.+)/)?.[1]?.trim() || 'shared';
    const agents = fm.match(/agents:\s*\[(.+)\]/)?.[1]?.trim() || 'all';

    index += `| ${name} | ${type} | ${agents} | ${desc} |\n`;
  }

  // Write skill-index
  const indexDir = path.join(skillsDir, 'skill-index');
  if (!fs.existsSync(indexDir)) fs.mkdirSync(indexDir, { recursive: true });
  fs.writeFileSync(path.join(indexDir, 'SKILL.md'), index);
  console.log(`Skill index generated: ${skillDirs.length} skills`);
}
```

### deploy.sh — Skills Deployment

```bash
# Add to dest_for_file() function:
SKILL_DIR="$HOME/.config/opencode/skills"

dest_for_file() {
  local file="$1"
  case "$file" in
    commands/bgsd-*.md) echo "$CMD_DIR/$(basename "$file")" ;;
    agents/gsd-*.md) echo "$AGENT_DIR/$(basename "$file")" ;;
    skills/*) echo "$SKILL_DIR/${file#skills/}" ;;  # Preserve subdirectory structure
    *) echo "$DEST/$file" ;;
  esac
}

# Add to mkdir:
mkdir -p "$CMD_DIR" "$AGENT_DIR" "$SKILL_DIR"

# Add skills to placeholder substitution:
find "$SKILL_DIR" -name '*.md' -exec sed -i "s|__OPENCODE_CONFIG__|$OPENCODE_CFG|g" {} +
```

### deploy.sh — Skill Reference Validation

```bash
# After manifest sync, validate agent skill references
echo "Validating skill references..."
SKILL_ERRORS=0
for agent in "$AGENT_DIR"/gsd-*.md; do
  # Extract skill references from agent
  REFS=$(grep -oP '<skill:([a-z0-9-]+)' "$agent" 2>/dev/null | sed 's/<skill://' | sort -u)
  for ref in $REFS; do
    if [ ! -f "$SKILL_DIR/$ref/SKILL.md" ]; then
      echo "  ❌ $(basename "$agent"): references missing skill '$ref'"
      SKILL_ERRORS=$((SKILL_ERRORS + 1))
    fi
  done
done

if [ $SKILL_ERRORS -gt 0 ]; then
  echo "  ❌ $SKILL_ERRORS broken skill references — rolling back"
  # rollback logic...
  exit 1
fi
echo "  ✅ All skill references valid"
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Inline protocols in each agent | Skills-based shared content | This phase | Agents go from ~7,361 total lines to ~3,000-4,000 |
| references/ directory loaded by @-reference | Skills loaded on-demand via `skill` tool | This phase | Lazy-loading replaces always-loaded references |
| No content validation | Build-time validation of skills, cross-refs, sections | This phase | Broken references caught at build, not runtime |
| Manual reference inclusion | Agent skill tags (`<skill:name />`) | This phase | Explicit, verifiable, validatable |

**Deprecated/outdated:**
- `references/` directory: Absorbed into skills, directory removed entirely
- Inline `<project_context>` blocks: Replaced by `<skill:project-context />` (eager-loaded)
- Inline `<structured_returns>` blocks: Replaced by `<skill:structured-returns section="agent-name" />`
- Inline `<deviation_rules>` blocks: Replaced by `<skill:deviation-rules />`

## Skill Inventory

### Shared Protocol Skills (concept-named)

| Skill Name | Source | Agents Using | Est. Lines |
|------------|--------|--------------|------------|
| `project-context` | `<project_context>` from all 10 agents | All 10 | ~20 |
| `commit-protocol` | `<task_commit_protocol>` from executor | executor, github-ci | ~35 |
| `checkpoint-protocol` | `<checkpoint_protocol>` + `<checkpoint_return_format>` from executor, `<checkpoint_return_format>` from CI | executor, github-ci, planner (planning), debugger | ~80 |
| `state-update-protocol` | `<state_updates>` from executor | executor, github-ci | ~50 |
| `goal-backward` | `<goal_backward>` from planner, verifier derives same | planner, verifier, plan-checker, roadmapper | ~100 |
| `structured-returns` | `<structured_returns>` from all 10 agents | All 10 | ~200 (sectioned) |
| `deviation-rules` | `<deviation_rules>` from executor + CI | executor, github-ci | ~70 |
| `research-patterns` | Tool strategy, verification protocol from researchers | phase-researcher, project-researcher | ~60 |
| `tdd-execution` | `<tdd_execution>` from executor, `<tdd_integration>` from planner | executor, planner | ~50 |

### Agent-Specific Skills (agent-prefixed)

| Skill Name | Source | Agent | Est. Lines |
|------------|--------|-------|------------|
| `planner-task-breakdown` | `<task_breakdown>` from planner | planner | ~90 |
| `planner-checkpoints` | `<checkpoints>` from planner | planner | ~90 |
| `planner-dependency-graph` | `<dependency_graph>` from planner | planner | ~70 |
| `planner-scope-estimation` | `<scope_estimation>` from planner | planner | ~60 |
| `planner-gap-closure` | `<gap_closure_mode>` from planner | planner | ~50 |
| `debugger-hypothesis-testing` | `<hypothesis_testing>` from debugger | debugger | ~120 |
| `debugger-investigation` | `<investigation_techniques>` from debugger | debugger | ~200 |
| `debugger-verification` | `<verification_patterns>` from debugger | debugger | ~180 |
| `debugger-research-reasoning` | `<research_vs_reasoning>` from debugger | debugger | ~120 |
| `executor-continuation` | `<continuation_handling>` from executor | executor | ~15 |

### Reference Skills (from references/ directory)

| Skill Name | Source File | Est. Lines |
|------------|------------|------------|
| `checkpoint-reference` | references/checkpoints.md | ~746 (supporting file in checkpoint-protocol) |
| `verification-reference` | references/verification-patterns.md | ~612 (supporting file or standalone) |
| `tdd-reference` | references/tdd.md | ~340 (supporting file in tdd-execution) |
| `raci` | references/RACI.md | ~291 |
| `continuation-format` | references/continuation-format.md | ~254 (supporting file in executor-continuation) |
| `git-integration` | references/git-integration.md | ~248 |
| `automation-reference` | references/ui-brand.md + automation parts of checkpoints.md | ~238+ |
| `questioning` | references/questioning.md | ~145 |
| `model-profiles` | references/model-profiles.md + model-profile-resolution.md | ~124 |
| `phase-argument-parsing` | references/phase-argument-parsing.md | ~61 |

### Auto-Generated

| Skill Name | Generated By | Purpose |
|------------|--------------|---------|
| `skill-index` | build.cjs | Discovery index listing all skills |

**Total estimated skills:** ~22-25

## Agent Line Count Projections

Current total: 7,361 lines across 10 agents.

| Agent | Current Lines | Extractable | Projected After | Reduction |
|-------|--------------|-------------|-----------------|-----------|
| gsd-debugger | 1,231 | ~700 (hypothesis, investigation, verification, research) | ~530 | 57% |
| gsd-planner | 1,197 | ~700 (task breakdown, checkpoints, dependency, scope, goal-backward, TDD) | ~500 | 58% |
| gsd-codebase-mapper | 823 | ~300 (project context, structured returns, templates) | ~520 | 37% |
| gsd-roadmapper | 670 | ~250 (project context, goal-backward, structured returns) | ~420 | 37% |
| gsd-plan-checker | 655 | ~200 (project context, structured returns) | ~455 | 31% |
| gsd-project-researcher | 652 | ~300 (project context, research patterns, structured returns) | ~350 | 46% |
| gsd-verifier | 592 | ~200 (project context, structured returns, goal-backward) | ~390 | 34% |
| gsd-github-ci | 540 | ~250 (project context, deviation rules, checkpoint format, structured returns) | ~290 | 46% |
| gsd-phase-researcher | 518 | ~200 (project context, research patterns, structured returns) | ~320 | 38% |
| gsd-executor | 483 | ~250 (project context, deviation rules, commit protocol, checkpoint, state updates, structured returns) | ~230 | 52% |
| **Total** | **7,361** | **~3,350** | **~4,005** | **46%** |

**Note:** The debugger and planner have the most extractable content because they contain the most domain-specific methodologies (hypothesis testing, task breakdown rules, investigation techniques).

## Build Pipeline Changes

### build.cjs Extensions

1. **Manifest generation** — Add `collectFiles('skills', () => true)` after references
2. **Skill validation** — New `validateSkills()` function: check SKILL.md exists, frontmatter has name+description, cross-references resolve
3. **Skill index generation** — New `generateSkillIndex()` function: scan all skills, generate `skills/skill-index/SKILL.md`
4. **Eager skill expansion** — For skills marked `eager` in agent tags, inline the content at build time (replaces `<skill:name eager />` with actual content)
5. **Section extraction** — For `<skill:name section="X" />` patterns, extract just that section from multi-section skills
6. **Agent skill reference validation** — Parse all agent .md files for `<skill:name />` tags, verify each referenced skill exists

### deploy.sh Extensions

1. **Skills directory routing** — Add `skills/*` case to `dest_for_file()`, route to `$SKILL_DIR`
2. **Skills directory creation** — Add `$SKILL_DIR` to `mkdir -p`
3. **Placeholder substitution** — Add skills directory to `find ... -exec sed` commands
4. **Skill reference validation** — Post-deploy validation that all agent skill references resolve to deployed skills
5. **Install.js** — Same changes as deploy.sh (mirror pattern)

### Test Suite Extensions

1. **Skill structure validation** — SKILL.md exists in each skill directory, frontmatter valid
2. **Cross-reference resolution** — All `<skill:name />` references resolve
3. **Section marker validation** — All `section="X"` attributes match `<!-- section: X -->` markers
4. **Placeholder documentation** — All placeholders used in content are documented in Placeholders section
5. **Agent skill coverage** — Every agent's `<skills>` table matches its inline `<skill:name />` tags
6. **Manifest includes skills** — Generated manifest contains all skill files

## Agent's Discretion Decision: Uniform vs Differentiated Skills

**Recommendation: Treat all skills uniformly.**

Rationale:
- The YAML frontmatter `type: shared | agent-specific` field already distinguishes them at the metadata level
- The naming convention already distinguishes them: concept-named (`commit-protocol`) vs agent-prefixed (`executor-deviations`)
- Adding structural differences (different directory layouts, different frontmatter schemas) adds complexity without clear benefit
- OpenCode's native skill system doesn't differentiate — all skills are just `skills/{name}/SKILL.md`
- Uniform treatment means one validation function, one discovery pattern, one loading mechanism

## Open Questions

1. **Reference files larger than SKILL.md content**
   - What we know: `references/checkpoints.md` is 746 lines — much larger than the skill content that references it
   - What's unclear: Should these become supporting files within the skill directory (e.g., `skills/checkpoint-protocol/checkpoints-reference.md`), or standalone skills?
   - Recommendation: Use supporting files within the parent skill directory. The SKILL.md provides the concise protocol; supporting files provide depth when needed.

2. **Workflow skill references**
   - What we know: Workflows (`.md` files in `workflows/`) currently reference agents and references. CONTEXT.md says workflows can also reference skills.
   - What's unclear: How many workflows need skill references, and should they use the same `<skill:name />` tag syntax?
   - Recommendation: Audit workflows during migration. Use same tag syntax for consistency. Validate in build.cjs alongside agent validation.

3. **install.js synchronization**
   - What we know: install.js mirrors deploy.sh's logic for end-user installs. Both need identical skills handling.
   - What's unclear: Should install.js changes be part of this phase or deferred?
   - Recommendation: Include in this phase — install.js is critical path for end users. Same pattern as deploy.sh changes.

## Sources

### Primary (HIGH confidence)
- OpenCode skills documentation via Context7 (`/anomalyco/opencode`) — SKILL.md format, discovery paths, frontmatter requirements
- OpenCode Skills plugin via Context7 (`/malhashemi/opencode-skills`) — Supporting file structure, skill creation patterns
- Direct codebase analysis of all 10 agent files — Line counts, duplicated blocks, extractable content
- Direct analysis of deploy.sh, build.cjs, install.js — Current pipeline mechanics

### Secondary (MEDIUM confidence)
- Estimation of agent line reductions — Based on manual block identification but actual extraction may vary
- Skill count estimate (22-25) — Some reference files may merge or split differently during actual migration

### Tertiary (LOW confidence)
- None — all findings are based on direct codebase and documentation analysis

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — Using existing project tooling, no new dependencies
- Architecture: HIGH — OpenCode skills convention verified via Context7, bGSD extensions clearly defined in CONTEXT.md
- Pitfalls: HIGH — Based on direct analysis of deploy.sh routing, build.cjs manifest, and bootstrap timing
- Skill inventory: MEDIUM — Specific skill boundaries may shift during actual extraction/rewriting

**Research date:** 2026-03-08
**Valid until:** 2026-04-08 (stable — no external dependency changes expected)
