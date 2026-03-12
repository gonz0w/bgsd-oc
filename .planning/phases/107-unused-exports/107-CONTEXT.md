# Phase 107 Context: Unused Exports Cleanup

**Phase:** 107
**Goal:** Find and remove unused exports from src/ directory

## Decisions

1. **Detection Method:** Use both AST analysis (if no bundle overhead) and external tools (knip via npx)
2. **Removal Strategy:** Mark unused exports first, validate they aren't used, then remove
3. **Protected Exports:** Maintain an allowlist of exports that should never be removed (public API, future use)
4. **Scope:** Only src/ directory - .planning/ is not part of the plugin codebase

## Key Considerations

- AST analysis should not add bundle overhead (use existing infrastructure)
- Protected exports allowlist prevents breaking external consumers
- Mark-first-verify approach ensures safe removal

## Gray Areas Resolved

- Detection: Both internal and external tools
- Safety: Mark → validate → remove
- Protected: Maintain allowlist
- Scope: src/ only
