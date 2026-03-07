---
phase: quick-09
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - README.md
  - docs/getting-started.md
autonomous: true
requirements: [QUICK-09]
must_haves:
  truths:
    - "README is concise (~150-200 lines) and visually inviting"
    - "All detailed content links to existing docs/ pages"
    - "First-time visitor understands what bGSD is and how to install in <30 seconds"
    - "No information is lost — everything cut from README exists in docs/"
    - "docs/getting-started.md reflects npm install method, not git clone"
  artifacts:
    - path: "README.md"
      provides: "Streamlined project landing page"
    - path: "docs/getting-started.md"
      provides: "Updated install instructions using npx"
  key_links:
    - from: "README.md"
      to: "docs/"
      via: "markdown links"
      pattern: "\\[.*\\]\\(docs/.*\\.md\\)"
---

<objective>
Streamline README.md from 661 lines to ~150-200 lines, making it an inviting landing page that highlights features and links to the existing docs/ folder for details.

Purpose: The README is the first thing visitors see. Currently it's a reference manual — it should be a showcase that makes people want to install bGSD, with clear links to docs for depth.
Output: A concise, visually appealing README.md and updated docs/getting-started.md
</objective>

<execution_context>
@.planning/quick/9-streamline-readme-and-create-docs-folder/9-PLAN.md
</execution_context>

<context>
@README.md
@docs/getting-started.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Rewrite README.md as a concise landing page</name>
  <files>README.md</files>
  <action>
Rewrite README.md to ~150-200 lines with this structure:

**1. Hero Section** (~10 lines)
- Title with tagline: "AI Project Planning for OpenCode"
- One-sentence value prop (turns ad-hoc AI coding into milestone-driven development)
- Stats badge line: tests | zero deps | commands | agents | milestones shipped
- Note about the ~/.config/oc symlink

**2. The Problem / The Solution** (~25 lines)
- Keep the existing "The Problem" bullet list (6 bullets) — it's effective
- Keep the existing "The Solution" diagram and one-liner — it's compelling
- Cut the ".planning/ structure" block — link to docs/planning-system.md instead

**3. Quick Start** (~25 lines)
- Keep: npm install (`npx get-shit-done-oc`), uninstall, update commands
- Keep: `/bgsd-new-project` first command
- Keep: Links to Getting Started and Expert Guide
- Cut: No changes needed here, this section is already good

**4. Two Flows** (~25 lines)
- Keep: Easy Flow code block (4 commands)
- Keep: Expert Flow code block (8 commands)
- These are the "hook" — keep them but cut the "What Gets Created" block after them (link to docs/planning-system.md instead)

**5. Key Features** (~50 lines)
- Convert from detailed sections to a BRIEF highlights format
- Each feature: 2-3 line description max, with "See [Guide](docs/X.md)" link
- Features to highlight (brief description + link only):
  - 9 Specialized AI Agents → link docs/agents.md
  - Intelligent Orchestration (task scoring, model selection) — 2 lines
  - Model Profiles — show the 3-profile table (it's compact), link docs/configuration.md
  - Wave-Based Parallel Execution — 2 lines + the wave diagram (compact)
  - TDD Execution Engine — 2 lines, link docs/tdd.md
  - Quality Gates — bullet list of gate types (already compact)
  - AST Intelligence & Repo Map — 2 lines
  - Context Efficiency — 2 lines
  - Session Memory — 2 lines
  - RAG Research Pipeline — 3 lines + tier table (compact), link docs/configuration.md for setup
  - Trajectory Engineering — 3 lines, link docs/architecture.md
  - Git Integration — bullet list (already compact)
  - Codebase Intelligence — 2 lines
- CUT entirely from README (these are fully covered in docs):
  - Full command tables (4 tables, ~70 lines) — link to docs/commands.md
  - Detailed agent table with all 9 agents — link to docs/agents.md
  - Full RAG setup instructions (~100 lines of install/config steps) — link to docs/configuration.md
  - Trajectory engineering full code examples (~60 lines) — summarize in 3 lines
  - Model profiles override JSON example — link to docs/configuration.md
  - Configuration table — link to docs/configuration.md

**6. Documentation Table** (~15 lines)
- Keep the existing docs table exactly as-is — it's a great index

**7. Commands** (~10 lines)
- Replace the 4 command tables with: "bGSD includes **40 slash commands** across project lifecycle, planning, execution, analysis, and configuration. See the [Full Command Reference](docs/commands.md)."
- Show ONLY the 4-5 most important commands in a mini table: `/bgsd-new-project`, `/bgsd-plan-phase`, `/bgsd-execute-phase`, `/bgsd-progress`, `/bgsd-quick`

**8. Development** (~20 lines)
- Keep: clone, install, build, test commands
- CUT: Full source architecture tree (~45 lines) — link to docs/architecture.md instead
- Keep: "Built with esbuild" one-liner

**9. Requirements + License** (~5 lines)
- Keep as-is

**Style guidelines:**
- Use horizontal rules (---) between major sections
- Use emoji sparingly (only if already present — don't add new ones)
- Ensure all docs/ links use relative paths: `docs/filename.md`
- Keep the tone direct and technical — not marketing-speak
  </action>
  <verify>
    - Count lines: `wc -l README.md` should be 140-220 lines
    - Check all doc links resolve: `for f in $(grep -oP 'docs/[a-z-]+\.md' README.md | sort -u); do test -f "$f" && echo "OK: $f" || echo "MISSING: $f"; done`
    - Visual scan: no orphaned sections, no duplicated content, all major features mentioned
  </verify>
  <done>README.md is 140-220 lines, all docs/ links resolve, every feature is mentioned (briefly) with link to detailed docs, no information is lost</done>
</task>

<task type="auto">
  <name>Task 2: Update docs/getting-started.md install instructions</name>
  <files>docs/getting-started.md</files>
  <action>
Update the install section in docs/getting-started.md (lines 10-19) to use the npm install method:

Replace the current git clone + deploy.sh instructions:
```
git clone https://github.com/gonz0w/bgsd-oc.git
cd bgsd-oc
npm install && npm run build
./deploy.sh
```

With the npm method:
```bash
npx get-shit-done-oc
```

Add a note: "This installs all bGSD commands, agents, workflows, and the plugin into your OpenCode config directory (`~/.config/opencode/`)."

Keep the "Restart OpenCode to pick up the new commands" note.

Add an "Updating" subsection after install:
```bash
npx get-shit-done-oc@latest
```

Add an "Uninstalling" subsection:
```bash
npx get-shit-done-oc --uninstall
```

Add a "For Contributors" note at the bottom of the install section linking to the Development section in README.md:
"To develop bGSD itself, see [Development](../README.md#development) in the main README."
  </action>
  <verify>
    - `grep -c "git clone" docs/getting-started.md` should return 0 (no git clone in install section)
    - `grep "npx get-shit-done-oc" docs/getting-started.md` should find the install command
    - Visually confirm the install section flows: Prerequisites → Install → Update → Uninstall → For Contributors
  </verify>
  <done>docs/getting-started.md uses npx install method, includes update/uninstall commands, links to README for contributor setup</done>
</task>

</tasks>

<verification>
- README.md is 140-220 lines (down from 661)
- All `docs/*.md` links in README resolve to existing files
- No detailed content was deleted without being available in docs/
- docs/getting-started.md reflects npm install, not git clone
- README reads as an inviting landing page, not a reference manual
</verification>

<success_criteria>
- README line count reduced by ~65-75% (from 661 to ~150-200)
- Every feature mentioned in old README is either briefly described or linked to docs
- All 13 docs/ links resolve correctly
- docs/getting-started.md install instructions match README Quick Start
- A first-time visitor can understand what bGSD is and install it within 30 seconds of reading
</success_criteria>

<output>
After completion, create `.planning/quick/9-streamline-readme-and-create-docs-folder/9-SUMMARY.md`
</output>
