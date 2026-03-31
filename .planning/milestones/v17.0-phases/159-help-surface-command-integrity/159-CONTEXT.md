# Phase 159: Help Surface & Command Integrity - Context

**Gathered:** 2026-03-29
**Status:** Ready for planning

## Phase Boundary
This phase makes bGSD help, surfaced next-step guidance, and command-reference validation reliably point users to the right canonical commands with runnable examples. It sharpens the user-facing command contract after Phase 158 by making the primary help path smaller, current, and executable exactly as written, while protecting that guidance with automated validation across user-facing surfaces.

## Implementation Decisions

### High-Impact Decisions
- Core help shape - Locked. The main help surface should lead with a small core path plus visible command families, not a broad flat menu. Reasoning: users should get a compact trustworthy first screen, but still see the family map needed to drill down without guesswork; this also preserves the roadmap requirement that core help distinguishes primary vs advanced paths and keeps `/bgsd-review` in the primary path.
- Validation coverage boundary - Locked. Automated command-reference validation should cover all user-facing guidance surfaces, including help workflows, templates, skills, agent prompts, docs, runtime notices, and persisted next-step text anywhere users are told what to run. Reasoning: Phase 159 is specifically about command integrity, so partial coverage would leave stale guidance escape hatches and undercut trust in surfaced help.
- Next-step specificity rule - Locked. Guidance should prefer executable examples with required arguments and flags already filled when the workflow knows the correct shape. Reasoning: the phase goal is zero guesswork; concise placeholders are acceptable only when the system genuinely cannot know the concrete input, not as the default presentation style.

### Medium Decisions
- Legacy mention style - Locked. User-facing guidance should be greenfield and canonical-only; legacy command names and aliases should not appear in normal help or follow-up guidance. Reasoning: the user wants the product surface to feel new rather than migration-oriented, and the stress test confirmed they do not want a split between documented and preferred paths.
- Validation failure UX - Locked. Guidance validation should fail with a grouped actionable report organized by surface/file and issue so maintainers can fix multiple stale references in one pass. Reasoning: the check should stay strict without turning repairs into repetitive reruns.

### Low Defaults and Open Questions
- Compatibility entrypoints in surfaced guidance - Defaulted. Treat compatibility-era entrypoints as non-primary and avoid promoting them in user-facing help. This default was accepted before the later greenfield revision and is superseded by the stronger canonical-only guidance rule above.
- Next-step examples include required args/flags - Defaulted. Any surfaced next command that needs a phase number, scope, or flag should show the concrete required arguments rather than making users infer them.

### Agent's Discretion
No open "agent decides" areas were left intentionally. Downstream agents should treat the help surface as canonical-first, validation as broad, and surfaced examples as executable-first.

## Specific Ideas
- Keep the main help surface intentionally small, but make deeper help available through command-family follow-up surfaces.
- Include `/bgsd-review` in the primary help path per roadmap success criteria.
- Treat command-reference validation as the guardrail for help text, docs, workflow prompts, skill examples, agent prompts, runtime notices, and persisted next-command guidance.
- When the correct next step is known, show the exact runnable command rather than a placeholder form.

## Stress-Tested Decisions
- Legacy mention style
  - Original decision: keep legacy command names out of the main path and confine them to a compatibility section or similar secondary treatment.
  - Stress-test revision: remove legacy command names and aliases from surfaced guidance entirely; the desired user-facing product is greenfield and canonical-only.
  - Follow-on clarification: validation should treat legacy command mentions as errors anywhere user-facing guidance is checked, so downstream agents enforce canonical-only surfaces consistently.
- All other discussed decisions held under stress testing with no revision.

## Deferred Ideas
- Removing legacy runtime aliases or changing prior-phase compatibility commitments may require revisiting Phase 158 or roadmap assumptions. That broader compatibility cleanup is outside this phase discussion; for Phase 159 planning, treat surfaced guidance as canonical-only and do not reintroduce migration-oriented wording.

---
*Phase: 159-help-surface-command-integrity*
*Context gathered: 2026-03-29*
