# Skills Research Template

Template for `.planning/research/SKILLS.md` — project-local skill recommendations discovered during research.

<template>

```markdown
# Project Skill Recommendations

**Project:** [name from PROJECT.md]
**Milestone focus:** [new capabilities being researched]
**Researched:** [date]
**Confidence:** [HIGH/MEDIUM/LOW]

## Recommendation Summary

[1 paragraph: whether any project-local skills are worth proposing, and why or why not.]

## Recommended Skills

### [Skill Name]
- **Repo:** [GitHub URL]
- **Why it fits:** [specific tie to milestone requirements, stack, or architecture]
- **Use during:** [planning / execution / verification / debugging / CI]
- **Confidence:** [HIGH/MEDIUM/LOW]
- **Notes:** [adoption caveats, overlap with existing installed skills, or "none"]

### [Skill Name]
- **Repo:** [GitHub URL]
- **Why it fits:** [specific tie to milestone requirements, stack, or architecture]
- **Use during:** [planning / execution / verification / debugging / CI]
- **Confidence:** [HIGH/MEDIUM/LOW]
- **Notes:** [adoption caveats, overlap with existing installed skills, or "none"]

[Repeat for up to 5 skills. If none are compelling, replace this section with: "No strong skill recommendations — existing project context is sufficient."]

## Rejected Candidates

- [Skill or repo] — [why it was not recommended: weak fit, stale, unclear value, missing docs, etc.]
- [Skill or repo] — [reason]

## Selection Criteria

- Repositories must be real, directly installable skill repos with `SKILL.md`
- Recommendations must materially help this milestone, not just be generally interesting
- Prefer skills that complement the project's current stack and workflow
- Prefer high-confidence, clearly scoped skills over broad or speculative ones

## Sources

- [agentskills.io page or GitHub repo URL] — [what was checked]
- [agentskills.io page or GitHub repo URL] — [what was checked]

---
*Research completed: [date]*
*Ready to propose to user: yes/no*
```

</template>

<guidelines>

- Recommend at most 5 skills
- Be conservative; "none" is valid when no strong fit exists
- Tie every recommendation to a concrete milestone need
- Include repo URLs so the workflow can install with `skills:install --source <url>`
- Call out overlap with already installed project-local skills when relevant

</guidelines>
