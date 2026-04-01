# Milestone Intent: v19.0 Workspace Execution, cmux Coordination & Risk-Based Testing

## Why Now

The repo now teaches a JJ-first, workspace-capable execution model, but the highest-risk parts of that story are still split across prompt guidance, partial runtime contracts, and follow-on design docs. This milestone turns parallel JJ execution, shared-state finalization, cmux runtime visibility, and verification routing into one truthful execution-control layer before new feature expansion adds more operational complexity.

## Targeted Outcomes

- DO-124 - Make JJ workspace-parallel execution safe and deterministic
- DO-125 - Formalize a risk-based testing strategy

## Priorities

- Prove spawned execution is pinned to the intended JJ workspace root
- Keep `STATE.md`, `ROADMAP.md`, and `REQUIREMENTS.md` single-writer artifacts finalized from trusted main-checkout state
- Make cmux reflect real execution and recovery states without event storms or noisy churn
- Carry `verification_route` through planning, execution, proof, and verification so broad regression runs where the blast radius justifies it

## Non-Goals

- General multi-user repo coordination or lock-management design
- A large cmux UX expansion beyond truthful status, progress, logs, and attention
- New npm dependencies, alternate test frameworks, or a JJ SDK layer
- Removing the existing sequential execution fallback

## Notes

- Use the current milestone research set in `.planning/research/` as the source for requirement wording and roadmap sequencing
- If scope tightens, cut cmux polish before runtime workspace truth or finalize safety
