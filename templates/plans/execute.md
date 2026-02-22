---
phase: [XX-phase-name]
plan: [NN]
type: execute
wave: 1
depends_on: []
files_modified:
  - [path/to/file1]
  - [path/to/file2]
autonomous: true
requirements:
  - [REQ-ID]
must_haves:
  truths:
    - "[Invariant that must hold after execution]"
  artifacts:
    - path: "[path/to/artifact]"
      provides: "[What this artifact delivers]"
  key_links:
    - from: "[source file]"
      to: "[target file]"
      via: "[relationship description]"
      pattern: "[command or verification method]"
---

<objective>
[What this plan accomplishes and why it matters.]

Purpose: [The specific problem being solved or capability being added.]
Output: [Concrete deliverables when complete.]
</objective>

<execution_context>
@/home/cam/.config/opencode/get-shit-done/workflows/execute-plan.md
@/home/cam/.config/opencode/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@[additional context files as needed]
</context>

<tasks>

<task type="auto">
  <name>Task 1: [Descriptive task name]</name>
  <files>
    [path/to/file1]
    [path/to/file2]
  </files>
  <action>
[Detailed implementation instructions. Be specific about what to create, modify, or configure.
Include code snippets, exact values, and step-by-step instructions where helpful.]
  </action>
  <verify>
[Exact commands or checks to confirm task completion.]
```bash
[verification command]
```
  </verify>
  <done>[Clear completion criteria — what must be true when this task is done.]</done>
</task>

<!-- Add more <task type="auto"> blocks as needed. -->

<!-- Optional: Add a verification checkpoint after significant work. -->
<!--
<task type="checkpoint:human-verify" gate="blocking">
  <what-built>[What was automated and is ready for review]</what-built>
  <how-to-verify>
    [Numbered steps for the human to verify]
    1. Visit [URL] or run [command]
    2. Check [specific behavior]
    3. Verify [expected outcome]
  </how-to-verify>
  <resume-signal>Type "approved" or describe issues</resume-signal>
</task>
-->

</tasks>

<verification>
1. [Global verification check 1]
2. [Global verification check 2]
3. [Global verification check 3]
</verification>

<success_criteria>
- [ ] [Criterion 1 — measurable and specific]
- [ ] [Criterion 2 — measurable and specific]
- [ ] [Criterion 3 — measurable and specific]
</success_criteria>

<output>
After completion, create `.planning/phases/[XX-phase-name]/[XX]-[NN]-SUMMARY.md`
</output>
