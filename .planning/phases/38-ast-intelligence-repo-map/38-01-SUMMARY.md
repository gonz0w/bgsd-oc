---
phase: 38-ast-intelligence-repo-map
plan: 01
subsystem: codebase-intel
tags: [ast, acorn, signatures, exports, regex, codebase-intelligence]

requires:
  - phase: 37
    provides: v7.0 foundation + safety net
provides:
  - "Acorn-based JS/TS function/class/method signature extraction"
  - "ESM and CJS export surface analysis"
  - "Regex-based signature extraction for Python, Go, Rust, Ruby, Elixir, Java, PHP"
  - "CLI commands: codebase ast <file>, codebase exports <file>"
affects: [codebase-intelligence, agent-context, repo-map]

tech-stack:
  added:
    - "acorn (JS parser, bundled by esbuild)"
  patterns:
    - "AST walking with acorn + regex fallback for non-JS languages"
    - "TypeScript stripping via regex before acorn parsing"
    - "DETECTOR_REGISTRY pattern: language → regex extractor map"
    - "Comment stripping for reliable CJS export regex matching"

key-files:
  created:
    - "src/lib/ast.js"
  modified:
    - "src/commands/codebase.js"
    - "src/router.js"
    - "src/lib/constants.js"
    - "bin/gsd-tools.test.cjs"
    - "package.json"

key-decisions:
  - "Use acorn with sourceType module → script fallback for maximum JS compatibility"
  - "TypeScript stripping via regex rather than full TS parser to keep bundle small"
  - "DETECTOR_REGISTRY with extractSignature callback pattern for consistent multi-language output"
  - "Strip single-line comments before CJS export regex to avoid matching patterns in comments"

patterns-established:
  - "DETECTOR_REGISTRY: extensible language → regex extractor map"
  - "AST + regex fallback: acorn for JS, regex for everything else"

requirements-completed: [AST-01, AST-02, AST-04]

duration: 10min
completed: 2026-02-27
---

# Phase 38 Plan 01: AST Intelligence Foundation Summary

**Acorn-based JS/TS signature and export extraction with regex fallback registry for 7 additional languages, wired as `codebase ast` and `codebase exports` CLI commands**

## Performance

- **Duration:** 10 min
- **Started:** 2026-02-27T14:51:29Z
- **Completed:** 2026-02-27T15:02:19Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- Created src/lib/ast.js with extractSignatures, extractExports, and DETECTOR_REGISTRY exports
- Acorn-based JS/TS parsing with TypeScript stripping for .ts/.tsx/.jsx files
- Regex-based DETECTOR_REGISTRY for Python, Go, Rust, Ruby, Elixir, Java, PHP signature extraction
- ESM export detection via AST (named, default, re-exports) and CJS export detection via regex
- Wired `codebase ast <file>` and `codebase exports <file>` CLI commands with formatted and JSON output
- Added 9 new tests covering JS functions, classes, CJS modules, ESM exports, Python fallback, error cases
- Total: 608 tests pass, 0 failures (was 599)
- Bundle size: 951KB (within 1000KB budget, acorn adds ~254KB)

## Task Commits

Each task was committed atomically:

1. **Task 1: AST parser module with acorn + regex fallback registry** - `0cda317` (feat)
2. **Task 2: Wire codebase ast/exports CLI commands + tests** - `1470a7f` (feat)

## Files Created/Modified
- `src/lib/ast.js` - New module: extractSignatures, extractExports, DETECTOR_REGISTRY, TypeScript stripping
- `src/commands/codebase.js` - Added cmdCodebaseAst and cmdCodebaseExports with formatters
- `src/router.js` - Added 'ast' and 'exports' subcommand routing in codebase case
- `src/lib/constants.js` - Added COMMAND_HELP entries for codebase ast and codebase exports
- `bin/gsd-tools.test.cjs` - 9 new tests for ast and exports commands
- `package.json` - Added acorn as production dependency

## Decisions Made
- Use acorn with sourceType module → script fallback for maximum JS compatibility
- TypeScript stripping via regex (not full TS parser) to keep bundle small (~254KB vs ~1MB for typescript)
- DETECTOR_REGISTRY with extractSignature callback pattern for consistent multi-language output shape
- Strip single-line comments before CJS export regex scanning to avoid matching patterns in comments/docs

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] CJS export regex matched patterns in comments**
- **Found during:** Task 2 verification
- **Issue:** `extractCjsExports` regex matched `module.exports = { foo, bar, baz }` in JSDoc/code comments before finding the real exports
- **Fix:** Strip single-line comments (`// ...`) before applying CJS export regex patterns
- **Files modified:** src/lib/ast.js
- **Commit:** 1470a7f

## Issues Encountered
- Acorn doesn't parse TypeScript natively — resolved with regex-based TypeScript stripping before acorn parse
- CJS export regex falsely matched comment examples — fixed by stripping comments first

## User Setup Required

None - acorn is bundled by esbuild into gsd-tools.cjs.

## Next Phase Readiness
- AST intelligence foundation complete — extractSignatures and extractExports available via CLI and programmatic API
- DETECTOR_REGISTRY extensible for additional languages
- Ready for Phase 38 Plan 02 (repo map generation using AST data)

---
*Phase: 38-ast-intelligence-repo-map*
*Completed: 2026-02-27*
