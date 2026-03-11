# Stack Research — v10.0 Agent Intelligence & UX

## Overview
Research on stack additions needed for v10.0 (Agent Intelligence & UX).

## Existing Stack
- Node.js >= 22.5 (for node:sqlite)
- esbuild (bundler)
- acorn (AST parsing)
- tokenx (token estimation)
- picocolors (inline, TTY-aware colors)

## Recommended Additions

### TTY Formatting (UX)
| Package | Version | Purpose | Dependencies |
|---------|---------|---------|--------------|
| chalk | ^5.3.0 | Colors, text styling | 0 deps |
| cli-table3 | ^0.6.5 | Unicode tables | string-width |

**Recommendation:** Extend existing format.js with inline utilities + cli-table3 for complex tables.

### Interactive Prompts (UX)
| Package | Version | Purpose | Dependencies |
|---------|---------|---------|--------------|
| inquirer | ^9.x | Interactive prompts, wizards | Multiple (RxJS) |

**Recommendation:** Integrate inquirer with non-interactive fallback for wizard workflows.

### Agent Intelligence
- Task decomposition patterns: Implement using existing codebase patterns
- Verification intelligence: Extend current test/verification infrastructure
- Execution deviation handling: Build on existing checkpoint/recovery patterns
- Multi-agent handoffs: Extend RACI matrix with structured context transfer

**Recommendation:** No new external dependencies — build on existing infrastructure.

## Integration Points
- `src/lib/format-advanced.js` - Rich table rendering, progress bars
- `src/lib/interactive.js` - Prompt wrappers with fallback
- Enhanced `src/lib/errors.js` - Context-rich error handling

## What NOT to Add
- terminal-kit (too large, 2MB+)
- @oclif/table (requires Ink/React, ESM only)
- Full inquirer if simple prompts suffice
- Vector/RAG libraries (wrong architecture)

## Rationale
- Maintain single-file deploy (minimize new deps)
- Use inline utilities where possible (picocolors pattern)
- Add dependencies only when complexity justifies it

## Confidence
- **HIGH**: TTY formatting recommendations (npm verified)
- **MEDIUM**: Interactive prompts (need to evaluate complexity)
- **HIGH**: Agent intelligence - no new deps needed
