# Architecture Research — v10.0 Agent Intelligence & UX

**Research mode:** Ecosystem -> Architecture Integration
**Scope:** How agent intelligence and UX improvements integrate with existing bGSD architecture
**Question:** How do agent intelligence and UX improvements integrate with existing bGSD architecture?
**Date:** 2026-03-10
**Overall confidence:** HIGH

## Executive Recommendation

Adopt an **enhanced module layer** pattern that extends existing infrastructure (format.js, errors.js, planner, executor) rather than creating new architectural patterns.

---

## Integration Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     CLI Router (existing)                   │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────────┐  ┌────────────────────────────────┐ │
│  │ Existing Modules │  │     NEW: Enhanced Layers        │ │
│  │ (src/lib/)       │  │  ┌──────────────────────────┐  │ │
│  └────────┬─────────┘  │  │ format-advanced.js     │  │ │
│           │             │  │ (rich TTY output)        │  │ │
│           │             │  ├──────────────────────────┤  │ │
│           │             │  │ interactive.js           │  │ │
│           │             │  │ (prompts, wizards)      │  │ │
│           │             │  ├──────────────────────────┤  │ │
│           │             │  │ errors-enhanced.js      │  │ │
│           │             │  │ (context + recovery)    │  │ │
│           │             │  ├──────────────────────────┤  │ │
│           │             │  │ planner-intelligence.js │  │ │
│           │             │  │ (task decomposition)    │  │ │
│           │             │  ├──────────────────────────┤  │ │
│           │             │  │ verifier-intelligence.js │  │ │
│           │             │  │ (regression detection)  │  │ │
│           │             │  ├──────────────────────────┤  │ │
│           │             │  │ executor-intelligence.js│  │ │
│           │             │  │ (deviation handling)   │  │ │
│           │             │  └──────────────────────────┘  │ │
│           │             └────────────────────────────────┘ │
└───────────┼─────────────────────────────────────────────────┘
            │
            ▼
┌─────────────────────────────────────────────────────────────┐
│                  Existing Infrastructure                     │
│         (state, intent, verification, execution)            │
└─────────────────────────────────────────────────────────────┘
```

---

## Integration Points

### New vs Modified Files

| File | Type | Purpose |
|------|------|---------|
| `src/lib/format-advanced.js` | NEW | Rich TTY output (colors, tables, progress) |
| `src/lib/interactive.js` | NEW | Prompts, wizards, interactive flows |
| `src/lib/errors-enhanced.js` | NEW | Context-rich errors, recovery suggestions |
| `src/lib/planner-intelligence.js` | NEW | Task decomposition, dependency detection |
| `src/lib/verifier-intelligence.js` | NEW | Regression detection, edge case discovery |
| `src/lib/executor-intelligence.js` | NEW | Deviation handling, autonomous recovery |
| `src/lib/agent-handoff.js` | NEW | Multi-agent context transfer |
| `src/lib/format.js` | MODIFIED | Add advanced formatting utilities |

---

## Architectural Patterns

### Pattern 1: Enhanced Formatting Layer

**What:** Extend format.js with rich output capabilities.

```javascript
// src/lib/format-advanced.js
const chalk = require('chalk');
const Table = require('cli-table3');

function richTable(options) {
  return new Table({
    head: options.headers,
    colWidths: options.widths,
    style: { compact: true }
  });
}

function progressBar(current, total) {
  // Implementation
}
```

### Pattern 2: Interactive Prompt Wrapper

**What:** Wrapper around inquirer with non-interactive fallback.

```javascript
// src/lib/interactive.js
const inquirer = require('inquirer');

async function prompt(question, options = {}) {
  if (!process.stdin.isTTY) {
    return options.default || null;
  }
  return inquirer.prompt([question]);
}

async function wizard(steps) {
  for (const step of steps) {
    const answer = await prompt(step.question);
    if (answer === null) return null; // Abort
  }
}
```

### Pattern 3: Context-Rich Errors

**What:** Enhanced error classes with recovery suggestions.

```javascript
// src/lib/errors-enhanced.js

class ContextError extends Error {
  constructor(message, context = {}) {
    super(message);
    this.context = context;
    this.suggestions = [];
  }
  
  addSuggestion(text) {
    this.suggestions.push(text);
  }
}
```

### Pattern 4: Planner Intelligence

**What:** Task decomposition with dependency analysis.

```javascript
// src/lib/planner-intelligence.js

function decompose(goal) {
  // Use existing patterns + new intelligence
  const tasks = [];
  const deps = new Map();
  
  // Detect dependencies
  // Apply sizing heuristics
  // Identify parallelization opportunities
  
  return { tasks, deps };
}
```

---

## Build Order Recommendation

1. **Phase 1:** Enhanced formatting (foundation for all)
2. **Phase 2:** Context-rich errors (improves debugging)
3. **Phase 3:** Planner intelligence (task decomposition)
4. **Phase 4:** Verifier intelligence (regression detection)
5. **Phase 5:** Executor intelligence (deviation handling)
6. **Phase 6:** Interactive prompts/wizards
7. **Phase 7:** Multi-agent handoffs

---

## Confidence Assessment

| Area | Level | Reason |
|------|-------|--------|
| TTY formatting | HIGH | Based on existing format.js + npm packages |
| Interactive prompts | HIGH | inquirer is mature, well-documented |
| Error handling | HIGH | Build on existing error patterns |
| Agent intelligence | MEDIUM | New patterns, but build on existing |

---

## Sources

1. **Task decomposition:** https://ronniehuss.co.uk/building-ai-multiplied-teams-plan-and-execute-agents/
2. **Planner-Worker pattern:** https://atoms.dev/insights/the-planner-executor-agent-pattern/
3. **inquirer npm:** https://www.npmjs.com/package/inquirer
4. **cli-table3 npm:** https://www.npmjs.com/package/cli-table3
5. **chalk npm:** https://www.npmjs.com/package/chalk

---
*Architecture research for: v10.0 Agent Intelligence & UX*
*Researched: 2026-03-10*
