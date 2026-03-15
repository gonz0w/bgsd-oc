# Phase 127: Agent Routing Enhancement - Research

**Depth:** Quick
**Date:** 2026-03-15
**Requirement:** AGENT-01

## Key Findings

### 1. Decision Rules Engine (src/lib/decision-rules.js)

The existing decision engine has 17 registered rules following the contract:
```
(state) => { value, confidence, rule_id, metadata? }
```

All functions are pure (no file I/O). They're registered in `DECISION_REGISTRY` with metadata (id, name, category, inputs, outputs, confidence_range, resolve function). The `evaluateDecisions(command, state)` aggregator evaluates all applicable rules.

New resolve functions for Phase 127 should follow this exact pattern and register in the same registry.

### 2. Tool Detection Infrastructure (src/lib/cli-tools/)

**detector.js** - Core detection: `detectTool(toolName)`, `getToolStatus()`, `resolveToolPath()`, `parseVersion()`, `meetsMinVersion()`, `clearCache()`. Returns `{ available, path, name, version }` per tool. 5-min cache.

**fallback.js** - Config-aware wrapper: `isToolEnabled(toolName)` checks config toggle first, then `detectTool`. `withToolFallback(toolName, cliFn, fallbackFn)` runs CLI or fallback.

**index.js** - Barrel export + pipelines: `getAllToolStatus()`, `checkToolAvailability()`, `searchFiles()`, `searchAndTransform()`.

Supported tools: ripgrep, fd, jq, yq, bat, gh.

### 3. bgsd-context Enrichment (src/plugin/command-enricher.js)

579 lines. The `enrichCommand(input, output, cwd)` function builds the `<bgsd-context>` JSON block prepended to command output. Currently includes paths, config flags, milestone, phase info, plan data, state inputs, and pre-computed `decisions` map.

**Critical gap:** `tool_availability` is NOT in the enricher yet. It exists only in `cmdValidateHealth` (src/commands/verify.js:666-698). Adding it to the enricher is the primary integration point.

### 4. Orchestration (src/lib/orchestration.js)

`routeTask()` (line 356) does model routing based on complexity + config profile. Could consume tool availability for enhanced routing.

### 5. Existing File Discovery Patterns

- **fd**: Used in `src/lib/adapters/discovery.js` - `getSourceDirs()` and `getSourceFiles()` use `isToolEnabled('fd')` with Node.js readdirSync fallback.
- **ripgrep**: `src/lib/cli-tools/ripgrep.js` - `searchRipgrep()` with JSON output parsing.
- **jq**: `src/lib/cli-tools/index.js` - `searchAndTransform()` pipeline (fd -> rg -> jq).

### 6. Implementation Architecture

**Where new code goes:**
- `resolveFileDiscoveryMode()`, `resolveSearchMode()`, `resolveJsonTransformMode()` → `src/lib/decision-rules.js` (register in DECISION_REGISTRY)
- `tool_availability` enrichment → `src/plugin/command-enricher.js` (call getToolStatus/getAllToolStatus)
- Plan decomposition heuristics → workflow markdown (per CONTEXT.md decision: "Plan decomposition heuristics live in workflow markdown")
- Tests → existing test patterns (decision rules have their own test file)

**Key constraint from CONTEXT.md decisions:**
- Resolve functions return just the tool name (no rationale)
- tool_availability is just true/false per tool (no version info)
- Same tasks regardless of tool availability (no plan adjustment)
- Abstract tool choice away from plans (tasks describe goals, executors resolve at runtime)
- Hardcoded fallback chains (no config override)

### 7. Test Infrastructure

Current: 1427 tests passing. Decision rules tests exist in the test suite. New resolve functions need contract tests following the same pattern.

---

*Research complete. Ready for planning.*
