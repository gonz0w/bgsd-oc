# Milestone Intent: v18.1 Greenfield Cleanup & CLI Simplification

## Why Now

The workflow and plugin foundation is strong enough that the biggest drag has shifted from missing capability to accumulated complexity. The repo still carries migration-era behavior and an increasingly overloaded command system, and both humans and LLM agents now pay that complexity tax on almost every change. This milestone focuses on subtraction before expansion.

## Targeted Outcomes

- DO-122 - Keep one canonical greenfield support model by removing compatibility-only product drag
- DO-123 - Make the CLI cheaper to reason about by simplifying routing, command metadata, oversized command hotspots, and ambient globals
- Advance the enduring project objective by lowering maintenance overhead and token cost per safe change

## Priorities

- Prefer deletion, flattening, and source-of-truth reduction over new abstraction
- Preserve supported JJ/workspace-first behavior and canonical command families while removing legacy-only paths
- Tackle the highest-leverage hotspots first: router/metadata sprawl, giant command buckets, compatibility shims, and ambient shared state
- Pair risky cleanup with regression proof, validation, or clear blast-radius containment

## Non-Goals

- Shipping new end-user features beyond cleanup-driven clarity and reliability
- Bun-first runtime migration or package-manager replacement
- Multi-user repo coordination, ownership, lease, or lock semantics
- Removing resilience fallbacks that still protect supported current environments

## Notes

- Use `.planning/research/GREENFIELD-COMPAT-CLEANUP-PRD.md` and `.planning/research/CLI-SIMPLIFICATION-PRD.md` as the primary planning seeds.
- Treat the user-supplied code review and simplification prompt as the audit bar for identifying deletion, hardening, and refactor targets.
- Bias toward measurable reductions in code-path count, source-of-truth count, and ambient shared state.
