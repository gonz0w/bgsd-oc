# Stack Research - v17.1 Workflow Reliability & Foundation Hardening

## Scope

Assess whether this milestone needs new runtime dependencies or whether the highest-leverage work is inside the existing Node.js, SQLite, JJ, and markdown-planning stack.

## Sources

- `.planning/memory/lessons.json`
- `.planning/research/CODEBASE-EFFICIENCY-RELIABILITY-AUDIT-PRD.md`
- `.planning/PROJECT.md`

## Findings

- No new product-layer stack is required for the core milestone goals.
- The highest-value work is in shared helpers, transactional file handling, JJ-aware execution paths, and parser/storage consolidation inside the existing codebase.
- Existing foundational technologies already cover the needed solution space:
  - Node.js >= 22.5 for filesystem, process control, and `node:sqlite`
  - SQLite-backed planning cache and session state
  - JJ colocated workflow for path-scoped commits and workspace operations
  - Markdown planning artifacts as the human-readable source of truth

## Recommended Stack Direction

- Prefer internal consolidation over dependency expansion.
- Use existing JJ-native paths for atomic file-scoped commit flows instead of introducing a new VCS abstraction.
- Use shared parser/config/storage modules rather than parallel regex or cache implementations.
- Use atomic temp-file plus rename patterns and narrow project-level locks where file output remains required.

## What Not To Add

- No broad storage migration beyond current Markdown + SQLite dual-surface model.
- No speculative performance libraries or queue systems without proof they solve a current hotspot.
- No new logging framework if the existing output helpers can support a single verbosity contract.

## Implications For Planning

- Requirements should focus on execution correctness, shared contracts, and repeated-work reduction.
- Success should be measured by fewer execution failures, less metadata drift, cleaner verification, and lower repeated-scan overhead rather than by adopting new tools.
