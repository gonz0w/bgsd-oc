# Phase 95: Interactive Workflows - Research

**Researched:** 2026-03-11
**Domain:** CLI interactive prompts/wizards and enhanced compaction for context preservation
**Confidence:** HIGH

## Summary

This phase implements guided prompts/wizards for complex CLI tasks and enhances compaction to preserve full project context. Research confirms inquirer v8 is the right choice for CommonJS projects (v9 is ESM-only). Compaction improvements build on existing `buildCompactionContext` which already preserves project, task-state, decisions, intent, and session blocks — PERF-05 requires adding trajectory tracking, PERF-06 requires sacred data protection.

**Primary recommendation:** Implement interactive workflows using inquirer v8 with graceful abort handling. Extend existing compaction system to preserve trajectory data and protect sacred project data through configurable preservation rules.

---

## User Constraints

None from CONTEXT.md — this phase has no prior context file.

---

## Requirements

| ID | Requirement |
|----|-------------|
| UX-04 | Complex commands support guided prompts/wizards |
| UX-05 | Interactive mode available for multi-step tasks |
| UX-06 | User can abort interactive workflows gracefully |
| PERF-05 | Compaction preserves full context (decisions, blockers, intent, trajectory) |
| PERF-06 | Compaction automatically protects sacred project data |

---

## Standard Stack

### Core - Interactive Prompts
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| inquirer | ^8.x | Interactive prompts and wizards | Most popular Node.js CLI prompt library, stable API, CommonJS compatible |
| ora | ^7.x | Spinner for long operations | Used alongside inquirer for progress indication |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @inquirer/prompts | N/A | Reference for prompt patterns | Don't use (ESM-only), but study for API patterns |
| chalk | ^5.x | Terminal colors | Already in project for TTY output |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| inquirer v8 | @inquirer/prompts (ESM) | v9 requires ESM migration, v8 is stable for CommonJS |
| ora | cli-spinners | ora has better TypeScript support and API |

---

## Architecture Patterns

### Recommended Project Structure

```
src/lib/
  prompts.js           # NEW - Prompt factory and wizard templates
  wizard.js           # NEW - Multi-step wizard orchestration
  abort-handler.js    # NEW - Graceful Ctrl+C handling
```

### Existing Compaction Structure (to extend)

The `src/plugin/context-builder.js` already has `buildCompactionContext()` that produces:
- `<project>` - Core value + tech stack
- `<task-state>` - Phase, plan, current task
- `<decisions>` - Last 3 decisions
- `<intent>` - Objective from INTENT.md
- `<session>` - Session continuity hints

**Extend for PERF-05:** Add `<trajectory>` block for execution history

**Extend for PERF-06:** Add `<sacred>` block for protected project data

### Pattern 1: Interactive Prompt Flow

```javascript
const inquirer = require('inquirer');

async function runWizard(steps) {
  for (const step of steps) {
    try {
      const answer = await inquirer.prompt([step]);
      // Process answer
    } catch (err) {
      if (err.isTtyError || err.message.includes('cancel')) {
        console.log('\nWizard aborted. Progress saved.');
        return; // Graceful exit
      }
      throw err;
    }
  }
}
```

### Pattern 2: Graceful Abort Handling

```javascript
process.on('SIGINT', () => {
  console.log('\nOperation cancelled. Cleaning up...');
  // Save state
  process.exit(0);
});

// Wrap prompts
try {
  const answer = await inquirer.prompt([question]);
} catch (err) {
  if (err.message?.includes('User force closed')) {
    handleGracefulAbort();
  }
}
```

### Pattern 3: Compaction Extension

```javascript
// In context-builder.js, extend buildCompactionContext():
function buildCompactionContext(cwd) {
  // ... existing blocks ...
  
  // NEW: <trajectory> block - execution history
  blocks.push(buildTrajectoryBlock(state));
  
  // NEW: <sacred> block - protected project data
  blocks.push(buildSacredBlock(project, intent));
  
  return blocks.join('\n\n');
}
```

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Interactive prompts | Custom TTY input handling | inquirer v8 | Battle-tested, handles edge cases |
| Progress indication | Custom spinner | ora | Consistent with project style |
| Abort detection | Check for specific error codes | inquirer's isTtyError + catch | Reliable across platforms |

---

## Common Pitfalls

### Pitfall 1: ESM/CommonJS Mismatch with Inquirer
**What goes wrong:** Installing latest inquirer (v9+) breaks CommonJS require() calls.
**Why it happens:** Inquirer v9 is ESM-only.
**How to avoid:** Pin to `@inquirer@8` or `inquirer@^8.0.0`.
**Warning signs:** `SyntaxError: Cannot use import statement outside a module`

### Pitfall 2: Unhandled Ctrl+C in Wizards
**What goes wrong:** Promise rejection crashes the CLI with stack trace.
**Why it happens:** Inquirer rejects with error on abort, not caught.
**How to avoid:** Wrap all prompt calls in try/catch, handle specific abort errors.
**Warning signs:** `Error: User force closed the prompt` in stack traces

### Pitfall 3: Compaction Data Loss on Partial Parse Failure
**What goes wrong:** One failed block causes entire compaction to fail.
**Why it happens:** No graceful degradation in existing code.
**How to avoid:** Wrap each block in try/catch, skip failed blocks (already done in existing code).
**Warning signs:** Empty compaction output when one file is corrupted

### Pitfall 4: Sacred Data Overwrite
**What goes wrong:** Critical project data lost during compaction.
**Why it happens:** No distinction between ephemeral and permanent data.
**How to avoid:** Mark certain data as sacred, always preserve in compaction.
**Warning signs:** Lost INTENT.md outcomes after long sessions

---

## Code Examples

### Example 1: Basic Inquirer Prompt (v8)

```javascript
const inquirer = require('inquirer');

async function promptUser() {
  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'projectName',
      message: 'What is your project name?',
      default: 'my-app',
      validate: (input) => input.length > 0 || 'Name is required'
    },
    {
      type: 'list',
      name: 'framework',
      message: 'Select a framework:',
      choices: ['React', 'Vue', 'Svelte', 'None']
    }
  ]);
  
  return answers;
}
```

### Example 2: Multi-Step Wizard

```javascript
const inquirer = require('inquirer');

const WIZARD_STEPS = [
  {
    type: 'input',
    name: 'name',
    message: 'Project name:',
    validate: (v) => v.length > 0
  },
  {
    type: 'confirm',
    name: 'useTypescript',
    message: 'Use TypeScript?',
    default: true
  },
  {
    type: 'checkbox',
    name: 'features',
    message: 'Select features:',
    choices: ['Router', 'State', 'API', 'Auth']
  }
];

async function runWizard() {
  const answers = {};
  for (const step of WIZARD_STEPS) {
    try {
      const result = await inquirer.prompt([step]);
      Object.assign(answers, result);
    } catch (err) {
      if (err.isTtyError || err.message?.includes('cancel')) {
        console.log('\nWizard cancelled.');
        return null;
      }
      throw err;
    }
  }
  return answers;
}
```

### Example 3: Existing Compaction Block (reference)

```javascript
// From src/plugin/context-builder.js - existing pattern
function buildDecisionsBlock(state) {
  if (!state?.raw) return null;
  const section = state.getSection('Decisions');
  if (!section) return null;
  
  const decisions = section
    .split('\n')
    .filter(l => l.startsWith('- '))
    .slice(-3);
    
  return decisions.length > 0 
    ? `<decisions>\n${decisions.join('\n')}\n</decisions>`
    : null;
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| No interactive prompts | inquirer v8 prompts | This phase | Enables guided wizards |
| Basic compaction (project, task, decisions) | Extended compaction with trajectory + sacred | This phase | Full context preservation |
| No abort handling | Graceful Ctrl+C handling | This phase | Better UX on cancellation |

---

## Open Questions

1. **Which specific commands get wizard modes?** Need to identify high-friction commands that would benefit from guided flows (e.g., `bgsd plan project`, `bgsd milestone new`).

2. **What constitutes "sacred" data?** Should be configurable or have sensible defaults (INTENT.md objectives, ROADMAP.md phases, critical decisions).

3. **Trajectory tracking scope:** How much history to preserve? Full execution log vs. summary of completed tasks?

---

## Sources

### Primary (HIGH confidence)
- inquirer npm page: https://www.npmjs.com/package/inquirer (v8.x CommonJS compatibility confirmed)
- inquirer GitHub: https://github.com/SBoudrias/Inquirer.js
- Existing `src/plugin/context-builder.js` for compaction patterns

### Secondary (MEDIUM confidence)
- @inquirer/prompts documentation (for API patterns, even though we use v8)
- Claude Code context preservation best practices from web research

### Tertiary (LOW confidence)
- General CLI best practices articles

---

## Metadata

**Confidence breakdown:**
- Interactive prompts implementation: HIGH (well-documented library)
- Wizard orchestration: HIGH (straightforward async flow)
- Abort handling: HIGH (standard Node.js patterns)
- Compaction extension: HIGH (existing code to extend)
- Sacred data protection: MEDIUM (requires defining what data is sacred)

**Research date:** 2026-03-11
**Valid until:** 2026-09-11 (6 months, revisit if inquirer major version changes)
