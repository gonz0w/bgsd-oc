# Milestone Intent: v19.1 Execution Simplicity, Speculative Decoding & JJ-First UX

## Why Now

v19.0 made execution safer and more truthful, but the next quality bottlenecks are now obvious: phase output can still arrive more complex than needed, agent and template contracts still waste predictable tokens, and the repo still teaches Git-shaped mental models in places where JJ bookmarks and colocated detached HEAD are already the real runtime truth. This milestone tightens those three seams together so execution quality, inference efficiency, and JJ-first operator experience improve in the same planning slice.

## Targeted Outcomes

- DO-124 - Make JJ workspace-parallel execution safe and deterministic
- DO-127 - Explore Bun-first/runtime efficiency and token-efficiency improvements through more predictable orchestration output
- Milestone-local outcome: add a simplification pass that reduces unnecessary complexity before verification locks in phase output

## Priorities

- Keep implementation split across multiple coherent phases rather than one broad rewrite
- Prefer deterministic CLI analysis and schema tightening over adding new agent roles
- Make JJ bookmarks/workspaces the canonical local vocabulary while preserving Git interoperability where required
- Preserve behavioral correctness: simplification is refactor-only, speculative-decoding work is contract/output shaping, and JJ UX work should not regress current execution safety

## Non-Goals

- Removing Git as a backend or replacing remote Git/GitHub semantics end to end
- Changing provider infrastructure, vLLM internals, or host-editor inference plumbing
- Rewriting every Git-backed helper or every free-form document in one milestone
- Broad product expansion outside simplification, output predictability, and JJ-first UX/bookmark handling

## Notes

- Primary planning inputs are `.planning/research/SIMPLIFY-EDD.md`, `.planning/research/SPECULATIVE-DECODING-EDD.md`, and `.planning/research/JJ-FIRST-UX-EDD.md`
- Sequence work so misleading JJ health checks and vocabulary drift are corrected early, simplification safety rails land before broad refactor loops, and speculative-decoding contract hardening follows stable artifact shapes
