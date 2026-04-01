# Milestone v19.0 Skill Recommendations

Focus: JJ workspace execution hardening, cmux-backed runtime coordination/observability, and risk-based testing policy alignment.

## Recommendation

Install **2** project-local skills for this milestone. Do **not** add a generic testing-policy skill; the external options I found were too generic and would likely conflict with bGSD's existing repo-specific TDD and verification contracts.

## Recommended Skills

### 1. Jujutsu VCS Skill

- **Repo:** https://github.com/danverbraganza/jujutsu-skill
- **Why it fits:** This milestone's highest-risk execution work is JJ-specific: workspace pinning, detached or dirty workspace handling, reconcile/finalize flows, and avoiding Git-first habits in colocated repos. This skill is directly about safe JJ agent behavior, including non-interactive `jj` usage, commit/message discipline, bookmark handling, and avoiding Git commands that can corrupt JJ workflows.
- **When it helps:** During runtime workspace hardening, any JJ-spawned executor work, reconcile/finalize command design, and regression testing around dirty/detached workspace recovery.
- **Confidence:** **HIGH** — direct milestone fit, active repo, explicit JJ-agent workflow coverage.

### 2. cmux Orchestration Skill

- **Repo:** https://github.com/jiahao-shao1/cmux-skill
- **Why it fits:** The cmux side of v19.0 needs agents to reason in terms of workspaces, panes, surfaces, sidebar status, progress, logs, and parallel pane orchestration. This skill directly covers those primitives and has concrete guidance for spawning parallel work, reading surface output, and updating sidebar observability state.
- **When it helps:** While designing or validating cmux-backed coordination flows, reproducing multi-pane behavior, exercising sidebar status/progress/log updates, and manually probing event-storm or coordination bugs in real cmux sessions.
- **Confidence:** **HIGH** — very close conceptual match to the cmux coordination/observability slice, with concrete command-level guidance.

## Conditional / Nice-to-Have

### 3. cmux Cross-Session Control Skills

- **Repo:** https://github.com/KyubumShin/cmux-skills
- **Why it fits:** This is not the best primary implementation skill, but it is useful if milestone execution needs realistic multi-session testing. Its `cmux-control` and `cmux-get` patterns are relevant to validating cross-workspace session monitoring, remote prompt handling, and long-running session observation.
- **When it helps:** During live integration testing, especially if you want one session to observe or drive another while validating workspace coordination, ASK flows, or operator-facing recovery behavior.
- **Confidence:** **MEDIUM** — useful for testing and repro workflows, but less directly aligned than the simpler orchestration skill above.

## Rejected Candidates

### Risk-based testing skill registries

- **Repo reviewed:** https://github.com/PramodDutta/qaskills
- **Decision:** **Do not recommend for v19.0**.
- **Why rejected:** The available risk-based-testing skill I found is generic QA guidance, not a strong fit for bGSD's repo-specific `skip` / `light` / `full` policy, TDD gate contracts, or planner/executor/verifier alignment work. It would add broad testing advice, but not the policy-shaping nuance this milestone needs.
- **Confidence:** **HIGH** — mismatch is clear from the skill content and this repo already has stronger internal testing workflow conventions.

### Generic TDD skills

- **Decision:** **Do not recommend for v19.0**.
- **Why rejected:** bGSD already ships richer project-native TDD and execution skills. A generic external TDD skill is more likely to duplicate or conflict than materially improve this milestone.
- **Confidence:** **HIGH**.

## Bottom Line

If you install anything for v19.0, install:

1. `danverbraganza/jujutsu-skill`
2. `jiahao-shao1/cmux-skill`

Only add `KyubumShin/cmux-skills` if the milestone plan includes substantial live multi-session cmux testing or remote-session repro work.
